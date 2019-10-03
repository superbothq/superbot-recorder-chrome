$stdout.sync = true
require "webdriver"

Signal.trap("TERM") do
  puts "TERM (explore.rb)"
  exit 0
end

webdriver = Webdriver::Client.new "http://localhost:9515", {}
s = webdriver.sessions.first

require "redis"
botdis = Redis.new

def sanitize(url, fragments: true, queries: true, host_matcher: nil)
  uri = URI.parse(url)
  case uri.scheme
  when "http", "https"
  else
    #p [:sanitize, "unknown scheme", url]
    return nil
  end

  if host_matcher && (! host_matcher.match uri.host)
  #p [:sanitize, "host mismatch", uri.host]
    return nil
  end

  parts = [uri.scheme, "://", uri.host]

  unless [80,443].include? uri.port
    parts << uri.port
  end

  if uri.path.include? "."
    _, extension = uri.path.split(".")

    extension_is_valid = false
    valid_extensions = [
      "htm","xhtm","shtm",
      "php","phtm",
      "asp",
      "do","jsp","jsp","action","wss",
      "pl",
      "rhtm",
      "cgi",
      "dll",
      "cfm",
      "yaws",
      "hta"
    ]

    valid_extensions.each do |valid_extension|
      if extension.start_with? valid_extension
        extension_is_valid = true
        break
      end
    end

    return unless extension_is_valid
  end

  parts << uri.path

  if queries && uri.query
    parts << "?"
    parts << uri.query
  end
  if fragments && uri.fragment
    parts << "#"
    parts << uri.fragment
  end

  parts.join("")
rescue Exception => ex
  puts ex
  nil
end

if ENV["EXPLORE_URL"]
  s.url! ENV["EXPLORE_URL"]
end

pages = if ARGV[0]
  Integer ARGV[0]
else
  9999999
end

rampup = if ARGV[1]
  rand(Integer ARGV[1]).floor
else
  0
end

random_delay = if ARGV[2]
  Integer ARGV[2]
else
  10
end

max_page_load_seconds = if ARGV[3]
  Integer ARGV[3]
else
  5
end

host_matcher = if ARGV[4]
 Regexp.new ARGV[4]
else
  u = URI.parse(s.url)
  toplevel_domain = u.host.split(".").last(2).join("\.")
  Regexp.new "#{toplevel_domain}$"
end

all_discovered_urls = []
visited_urls = [
  sanitize(s.url, fragments: false)
]

Thread.abort_on_exception = true
Thread.new do
  thredis = Redis.new
  loop do
    _, msg = thredis.blpop "chrome:requests"
    #p [_, msg]
    request_obj = JSON.parse(msg)
    url = request_obj['url']
    return_channel = "chrome:request:#{url}"
    thredis.lpush return_channel, {}.to_json
  end
end

puts "rampup: #{rampup}"
if rampup > 0
  rampup.times do |i|
    time_left = rampup - i
    overlayer_text = "Starting in #{time_left}s"
    spawn "helpers/overlay_big_center.sh", "1.0", overlayer_text
    sleep 0.9
  end
end

loop do
  current_href_links = s.execute_sync! """
    return Array.from(document.querySelectorAll('a')).map(e => e['href'])
  """
  current_iframe_srcs = s.execute_sync! """
    return Array.from(document.querySelectorAll('iframe')).map(e => e['src'])
  """
  current_frame_srcs = s.execute_sync! """
    return Array.from(document.querySelectorAll('frame')).map(e => e['src'])
  """
  current_area_hrefs = s.execute_sync! """
    return Array.from(document.querySelectorAll('area')).map(e => e['href'])
  """

  destinations = current_href_links | current_iframe_srcs | current_frame_srcs | current_area_hrefs

  p [:destinations, destinations.length]

  sanitized_urls = destinations.map do |url|
    sanitize url, {
      host_matcher: host_matcher,
      fragments: false
    }
  end.compact

  p [:sanitized_urls, sanitized_urls.length]

  all_discovered_urls = all_discovered_url1s | sanitized_urls
  p [:all_discovered_urls, all_discovered_urls.length]

  new_urls_on_this_page = sanitized_urls - visited_urls
  p [:new_urls_on_this_page, new_urls_on_this_page.length]

  look_from_the_same_page = 1 - rand > 0.05

  url ||= if look_from_the_same_page
    new_urls_on_this_page[rand(new_urls_on_this_page.length)]
  end

  url ||= unless url
    puts "no urls in current page, searching history for non-visted urls"
    unvisited_urls_from_history = all_discovered_urls - visited_urls
    unvisited_urls_from_history[rand(unvisited_urls_from_history.length)]
  end

  url ||= unless url
    puts "no non-visited url in history, using full history"
    all_discovered_urls[rand(all_discovered_urls.length)]
  end

  url ||= unless url
    puts "NO URL"
    exit 1
  end

  started_at = Time.now
  success = system("ruby helpers/navigate.rb #{url} #{max_page_load_seconds}")

  metrics_json = botdis.get('metrics')
  metrics = JSON.parse(metrics_json)
  spawn "helpers/overlay_top_left_box.sh", "--duration", "3", "#{metrics['chrome_load_time']}s"

  if metrics['errored']
    overlay_error_borders_pid = spawn "helpers/overlay_borders.sh"
    File.write "/bot/memory/overlay_error_borders_pid", overlay_error_borders_pid
    botdis.rpush 'bot:queue', { type: 'error', errored_at: Time.now, action: 'explore' }.to_json
    system("helpers/overlay_damage.sh")

    exit 0
  end

  visited_urls << url

  random_delay_down = rand(
    random_delay / 3
  ).round(1)

  random_delay_read = rand(
    (random_delay - random_delay_down) / 3 * 2
  ).round(1)

  random_delay_up   = rand(
    (random_delay - random_delay_down - random_delay_read)
  ).round(1)

  scroll_down_amount = 10 + rand(90)
  scroll_up_amount = -1 * (10 + rand(90))

  overlayer_bottom_pid = spawn "helpers/overlay_bottom_line.sh", "Scroll down for #{random_delay_down}s"
  `ruby helpers/scroll.rb #{scroll_down_amount} #{random_delay_down}`
  Process.kill "TERM", overlayer_bottom_pid

  overlayer_bottom_pid = spawn "helpers/overlay_bottom_line.sh", "Wait #{random_delay_read}s"
  sleep random_delay_read
  Process.kill "TERM", overlayer_bottom_pid

  overlayer_bottom_pid = spawn "helpers/overlay_bottom_line.sh", "Scroll up for #{random_delay_read}s"
  `ruby helpers/scroll.rb #{scroll_up_amount} #{random_delay_up}`
  Process.kill "TERM", overlayer_bottom_pid

  if visited_urls.length == pages
    overlayer_bottom_pid = spawn "helpers/overlay_bottom_line.sh", "Maximum number of pages loaded"
    sleep 1
    Process.kill "TERM", overlayer_bottom_pid

    exit 0
  end

  puts "-"*80
end
