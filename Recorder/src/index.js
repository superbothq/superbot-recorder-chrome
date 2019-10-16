import Vue from "vue/dist/vue.runtime.common.prod";
import Popup from './components/Popup.vue'

new Vue({
  el: "#app",
  render: createElement => createElement(Popup)
});
