const rand = (max = null) => {
  if (max === null) {
    max = Math.max();
  }
  return Math.floor(Math.random() * max)
}

//magic easing functions http://goo.gl/5HLl8
const easeInOutQuad = (t, b, c, d) => {
  t /= d / 2;
  if (t < 1) {
    return c / 2 * t * t + b
  }
  t--;
  return -c / 2 * (t * (t - 2) - 1) + b;
};
