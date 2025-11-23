<script setup lang="ts">
import LoadTester from './components/LoadTester.vue'
</script>

<template>
  <div class="app-wrapper">
    <h1 class="title">
      Highload <span class="gradient-text">Benchmark</span>
    </h1>
    <LoadTester />
  </div>
</template>sendRequest 

<style scoped>
.app-wrapper {
  width: 100%;
  max-width: 900px;
  margin: 0 auto;
  padding: 20px;
}

.title {
  text-align: center;
  font-size: 2rem;
  margin-bottom: 20px;
  letter-spacing: -1px;
}

.gradient-text {
  background: linear-gradient(45deg, #3b82f6, #8b5cf6);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}
</style>