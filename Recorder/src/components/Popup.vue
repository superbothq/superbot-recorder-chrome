<template>
  <div id="app">
    <div class="settings">
      <div class="settings-input checkbox">
        <p>Click elements</p>
        <input type="checkbox" :checked="clicksEnabled" @change="toggle" />
      </div>

      <Input
        name="scrollDownDelay"
        label="Scroll down delay"
        unit="s"
        :value="scrollDownDelay"
        @update="onUpdate"
      />

      <Input
        name="scrollDownAmount"
        label="Scroll down amount"
        unit="%"
        :value="scrollDownAmount"
        @update="onUpdate"
      />

      <Input
        name="scrollUpDelay"
        label="Scroll up delay"
        unit="s"
        :value="scrollUpDelay"
        @update="onUpdate"
      />

      <Input
        name="scrollUpAmount"
        label="Scroll up amount"
        unit="%"
        :value="scrollUpAmount"
        @update="onUpdate"
      />

      <Input
        name="sleepDelay"
        label="Sleep delay"
        unit="s"
        :value="sleepDelay"
        @update="onUpdate"
      />
    </div>
    <div class="toggle-explore" @click="toggleExplore" :style="{
        backgroundColor: (exploring ? '#d40000' : '#7fd883'),
        color: (exploring ? '#7e0606' : '#3e7d41' )
      }">
      <p v-if="exploring">STOP</p>
      <p v-else>START</p>
    </div>
  </div>
</template>

<script>
import Input from './Input.vue'

export default {
  name: "popup",
  data() {
    return {
      clicksEnabled: false,
      scrollDownDelay: 2,
      scrollDownAmount: 75,
      scrollUpDelay: 1,
      scrollUpAmount: 25,
      sleepDelay: 1,
      exploring: false
    }
  },
  components: {
    Input
  },
  created() {
    this.getSettings().then(settings => {
        Object.keys(settings).forEach(key => {
          this[key] = settings[key];
        })
      })
  },
  methods: {
    toggle() {
      this.clicksEnabled = !this.clicksEnabled;
      this.updateSettings("clicksEnabled", this.clicksEnabled);
    },
    onUpdate(evnt) {
      this[evnt.target.name] = evnt.target.value;
      this.updateSettings(evnt.target.name, evnt.target.value);
    },
    getSettings() {
      return new Promise(resolve => {
        chrome.storage.local.get("cache", data => {
          if(!data.cache || !data.cache.settings){
            if(!data.cache){
              data.cache = {};
            }
            data.cache.settings = {};
            data.cache.settings.clicksEnabled = false;
            data.cache.settings.scrollDownDelay = 2;
            data.cache.settings.scrollDownAmount = 75;
            data.cache.settings.scrollUpDelay = 1;
            data.cache.settings.scrollUpAmount = 25;
            data.cache.settings.clicksEnabled = 1;
            chrome.storage.local.set("cache", data);
          }

          resolve(data.cache.settings);
        })
      })
    },
    updateSettings(field, value) {
      chrome.storage.local.get("cache", data => {
        data.cache.settings[field] = typeof value === "string" ?
          parseFloat(value) :
          value;

        chrome.storage.local.set(data);
      })
    },
    toggleExplore(){
      this.exploring = !this.exploring;
      //send message to background page
    }
  }
}
</script>

<style>
  body{
    margin: 0;
    width: 250px;
  }
</style>

<style scoped>
  .settings{
    width: 90%;
    margin: auto;
  }
  .settings-input{
    margin-top: 20px;
  }
  .settings-input:nth-last-child(1){
    margin-bottom: 15px;
  }
  .settings-input.checkbox > p{
    display: inline-block;
    margin: 0;
  }
  .settings-input.checkbox > input{
    vertical-align: middle;
  }
  .toggle-explore{
    height: 70px;
    font-size: 40px;
    text-align: center;
    cursor: pointer;
    overflow: hidden;
    width: 100%;
  }
  .toggle-explore > p{
    margin-top: 17px;
  }
</style>
