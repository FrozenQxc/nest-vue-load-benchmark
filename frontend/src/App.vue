<script setup lang="ts">
import { ref } from 'vue'
import InfoView from './components/InfoView.vue'
import LoadTester from './components/LoadTester.vue'

// Состояние текущей вкладки
const currentTab = ref<'test' | 'info'>('test')
</script>

<template>
  <div class="app-wrapper">
    
    <h1 class="title">
      Highload <span class="gradient-text">Benchmark</span>
    </h1>

    <!-- НАВИГАЦИЯ -->
    <div class="nav-tabs">
      <button 
        class="nav-btn" 
        :class="{ active: currentTab === 'test' }"
        @click="currentTab = 'test'"
      >
        📊 Тестирование
      </button>
      <button 
        class="nav-btn" 
        :class="{ active: currentTab === 'info' }"
        @click="currentTab = 'info'"
      >
        ℹ️ О проекте
      </button>
    </div>

    <!-- ДИНАМИЧЕСКИЙ КОМПОНЕНТ -->
    <Transition name="fade" mode="out-in">
      <component :is="currentTab === 'test' ? LoadTester : InfoView" />
    </Transition>

  </div>
</template>

<style scoped>
.app-wrapper {
  width: 100%;
  max-width: 900px;
  margin: 0 auto;
  padding: 40px 20px;
}

.title {
  text-align: center;
  font-size: 2.5rem;
  margin: 0 0 30px 0;
  letter-spacing: -1px;
  font-weight: 800;
}

.gradient-text {
  background: linear-gradient(45deg, #3b82f6, #8b5cf6);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

/* Навигация */
.nav-tabs {
  display: flex;
  justify-content: center;
  gap: 10px;
  margin-bottom: 30px;
  background: #1e293b;
  padding: 6px;
  border-radius: 12px;
  width: fit-content;
  margin-left: auto;
  margin-right: auto;
  border: 1px solid rgba(255,255,255,0.05);
}

.nav-btn {
  background: transparent;
  border: none;
  color: #94a3b8;
  padding: 10px 24px;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 600;
  transition: all 0.2s;
  font-size: 0.95rem;
}

.nav-btn:hover {
  color: #f1f5f9;
}

.nav-btn.active {
  background: #3b82f6;
  color: white;
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
}

/* Анимация переключения */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>