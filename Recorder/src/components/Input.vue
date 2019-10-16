<template>
  <div class="settings-input">
    <p class="label">{{ label }}</p>
    <input type="number" min=0 :name="name" :value="value" @keyup="onChange" />
    <p class="unit">{{ unit }}</p>
  </div>
</template>

<script>
export default {
  name: "input",
  props: ["name", "label", "unit", "value"],
  methods: {
    onChange(evnt) {
      this.$emit("update", evnt);
    }
  }
}
</script>

<style scoped>
  .label {
    display: block;
    margin: 0;
  }
  .settings-input > input{
    width: 99%
  }
  .unit {
    font-size: 18px;
    margin: 0;
    width: 20px;
    text-align: center;
    position: relative;
    top: -20px;
    float: right;
  }
</style>
