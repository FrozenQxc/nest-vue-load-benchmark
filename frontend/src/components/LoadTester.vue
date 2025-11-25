<script setup lang="ts">
import { AxiosError, isAxiosError } from 'axios'
import pLimit from 'p-limit'
import { computed, onUnmounted, reactive, ref, shallowRef } from 'vue'
import { api } from '../../utils/api'

// ---------- ТИПЫ ----------
type LoadMode = 'client' | 'server'

interface HistoryItem {
  id: number
  time: string
  mode: string
  turbo: boolean
  requests: number
  concurrency: number
  duration: string
  rps: number
  errors: number
}

// ---------- СТАТИКА ----------
const config = reactive({
  loadMode: 'client' as LoadMode,
  isTurbo: false,
  requestCount: 500,
  concurrency: 20,
  delay: 0, 
})

// Реактивная статистика
const stats = reactive({
  isRunning: false,
  sent: 0,
  success: 0,
  errors: 0,
  logs: [] as string[],
})

// Локальные переменные
let localSent = 0
let localSuccess = 0
let localErrors = 0
let startTime = 0
let endTime = 0

const timerDisplay = ref('0.00')
const history = shallowRef<HistoryItem[]>([]) 

let timerFrameId: number | null = null
let statsSyncFrameId: number | null = null
let abortController: AbortController | null = null

// ---------- ВЫЧИСЛЯЕМЫЕ ----------
const progressPercent = computed(() => {
  if (config.requestCount === 0) return 0
  return Math.min(100, (stats.sent / config.requestCount) * 100)
})

// ---------- УТИЛИТЫ ----------
function addLog(msg: string) {
  const t = new Date().toLocaleTimeString()
  stats.logs.unshift(`[${t}] ${msg}`)
  if (stats.logs.length > 50) stats.logs.pop()
}

// ---------- ТЕСТ ----------
function toggleTest() {
  if (stats.isRunning) stopTest()
  else startTest()
}

async function startTest() {
  stats.isRunning = true
  stats.sent = stats.success = stats.errors = 0
  stats.logs = []
  
  localSent = 0
  localSuccess = 0
  localErrors = 0
  startTime = Date.now()
  endTime = 0

  abortController = new AbortController()

  startUiLoops()

  const modeName = config.loadMode === 'client' ? 'Браузер (Client)' : 'Сервер (Benchmark)'
  const turboText = config.isTurbo ? 'КЭШ (In-Memory)' : 'БАЗА (PostgreSQL)'
  addLog(`🚀 СТАРТ: ${modeName} | Режим: ${turboText}`)

  try {
    if (config.loadMode === 'client') await runClientLoad()
    else await runServerLoad()
  } catch (e: any) {
    if (!isAxiosError(e) || e.code !== 'ERR_CANCELED') {
       addLog(`❌ Ошибка: ${e.message || e}`)
    }
  } finally {
    finishTest()
  }
}

function stopTest() {
  if (!stats.isRunning) return
  abortController?.abort()
  addLog('⏹️ Тест остановлен')
  finishTest()
}

// Цикл обновления UI
function startUiLoops() {
  const updateTimer = () => {
    if (!stats.isRunning) return
    timerDisplay.value = ((Date.now() - startTime) / 1000).toFixed(2)
    timerFrameId = requestAnimationFrame(updateTimer)
  }
  timerFrameId = requestAnimationFrame(updateTimer)

  const syncStats = () => {
    if (!stats.isRunning) return
    stats.sent = localSent
    stats.success = localSuccess
    stats.errors = localErrors
    statsSyncFrameId = requestAnimationFrame(syncStats)
  }
  statsSyncFrameId = requestAnimationFrame(syncStats)
}

// 1️⃣ ЗАПРОСЫ ИЗ БРАУЗЕРА
async function runClientLoad() {
  const TOTAL_ROWS = 50000
  const limitFn = pLimit(config.concurrency)
  
  const tasks = []
  
  for (let i = 0; i < config.requestCount; i++) {
    let offset: number
    
    if (config.isTurbo) {
      // Hot Data (кэш)
      const pageLimit = 50
      const hotPages = 10 
      offset = Math.floor(Math.random() * hotPages) * pageLimit
    } else {
      // Cold Data (база)
      const maxOffset = Math.max(0, TOTAL_ROWS - 100)
      offset = Math.floor(Math.random() * maxOffset)
    }

    tasks.push(() => sendClientRequest(offset))
  }

  if (config.delay > 0) {
    const chunkSize = config.concurrency
    for (let i = 0; i < tasks.length; i += chunkSize) {
      if (abortController?.signal.aborted) break
      const chunk = tasks.slice(i, i + chunkSize)
      await Promise.all(chunk.map(fn => limitFn(fn)))
      await new Promise(r => setTimeout(r, config.delay))
    }
  } else {
    await Promise.all(tasks.map(fn => limitFn(fn)))
  }
}

async function sendClientRequest(offset: number) {
  if (abortController?.signal.aborted) return
  localSent++

  try {
    await api.get('/items', {
      params: {
        limit: 50,
        offset,
        turbo: config.isTurbo, 
      },
      signal: abortController?.signal,
    })
    localSuccess++
  } catch (e: unknown) {
    if (isAxiosError(e) && e.code === 'ERR_CANCELED') return
    
    localErrors++
    const err = e as AxiosError
    if (err.code === 'ERR_NETWORK') {
      addLog('🛑 Ошибка сети || Server не отвечает')
      abortController?.abort()
    }
  }
}

// ЗАПУСК НА СЕРВЕРЕ
async function runServerLoad() {
  stats.sent = config.requestCount
  
  const { data } = await api.get('/items/benchmark', {
    params: {
      turbo: config.isTurbo,
      count: config.requestCount,
      concurrency: config.concurrency,
    },
    signal: abortController?.signal,
  })

  localSent = data.requests
  localSuccess = data.requests
  localErrors = 0
  
  const durationMs = parseFloat(data.duration)
  startTime = Date.now() - durationMs
  
  stats.sent = localSent
  stats.success = localSuccess
  addLog(`✅ Результат сервера: ${data.rps} RPS, ${data.duration} мс`)
}

// ... остальной код (finishTest, onUnmounted) без изменений ...
function finishTest() {
  stats.isRunning = false
  
  if (timerFrameId) cancelAnimationFrame(timerFrameId)
  if (statsSyncFrameId) cancelAnimationFrame(statsSyncFrameId)

  stats.sent = localSent
  stats.success = localSuccess
  stats.errors = localErrors

  endTime = Date.now()
  const totalSec = (endTime - startTime) / 1000
  const rps = totalSec > 0 ? Math.round(localSuccess / totalSec) : 0
  
  timerDisplay.value = totalSec.toFixed(2)

  if (stats.sent > 0) {
    const newItem: HistoryItem = {
      id: Date.now(),
      time: new Date().toLocaleTimeString(),
      mode: config.loadMode === 'client' ? 'Браузер' : 'Сервер',
      turbo: config.isTurbo,
      requests: config.requestCount,
      concurrency: config.loadMode === 'client' ? config.concurrency : 1,
      duration: timerDisplay.value,
      rps,
      errors: stats.errors,
    }
    history.value = [newItem, ...history.value]
  }

  if (stats.errors === 0 && stats.sent > 0) {
    addLog(`🏁 ГОТОВО – Скорость: ${rps} RPS`)
  }
}

onUnmounted(() => {
  if (timerFrameId) cancelAnimationFrame(timerFrameId)
  if (statsSyncFrameId) cancelAnimationFrame(statsSyncFrameId)
  abortController?.abort()
})
</script>
<template>
  <div class="app-bg">
    <div class="wrapper">
      
      <!-- ШАПКА -->
      <header class="header">
        <div class="title-block">
          <h1>NestJS <span class="gradient-text">Load Tester</span></h1>
        </div>
        <div class="status-badge" :class="{ running: stats.isRunning }">
          <div class="dot"></div>
          {{ stats.isRunning ? 'ИДЕТ НАГРУЗКА...' : 'СИСТЕМА ГОТОВА' }}
        </div>
      </header>

      <div class="main-grid">
        <!-- ПАНЕЛЬ УПРАВЛЕНИЯ -->
        <div class="card control-panel">
          <div class="section-title">ИСТОЧНИК НАГРУЗКИ</div>
          
          <div class="tabs">
            <button 
              class="tab" 
              :class="{ active: config.loadMode === 'client' }"
              @click="!stats.isRunning && (config.loadMode = 'client')"
              :disabled="stats.isRunning"
            >
              <span class="icon">💻</span> Браузер
            </button>
            <button 
              class="tab" 
              :class="{ active: config.loadMode === 'server' }"
              @click="!stats.isRunning && (config.loadMode = 'server')"
              :disabled="stats.isRunning"
            >
              <span class="icon">⚡</span> Сервер
            </button>
          </div>

          <div class="divider"></div>

          <div class="section-title">РЕЖИМ РАБОТЫ БЭКЕНДА</div>
          <div 
            class="turbo-switch" 
            @click="!stats.isRunning && (config.isTurbo = !config.isTurbo)" 
            :class="{ disabled: stats.isRunning, active: config.isTurbo }"
          >
            <div class="switch-content">
              <span class="switch-label">Turbo Mode</span>
              <span class="switch-status">{{ config.isTurbo ? 'КЭШ (MEMORY)' : 'БАЗА (SQL)' }}</span>
            </div>
            <div class="toggle-pill"></div>
          </div>

          <div class="divider"></div>

          <div class="inputs-grid">
            <div class="input-wrap" :class="{ dimmed: stats.isRunning }">
              <label>Кол-во запросов</label>
              <input type="number" v-model="config.requestCount" :disabled="stats.isRunning" min="1">
            </div>
            <div class="input-wrap" :class="{ dimmed: stats.isRunning }"> 
              <label>Параллельные потоки</label>
              <input type="number" v-model="config.concurrency" :disabled="stats.isRunning" min="1" max="1000"> 
            </div>
            <div class="input-wrap" :class="{ dimmed: stats.isRunning }">
              <label>Задержка (мс)</label>
              <input type="number" v-model="config.delay" :disabled="stats.isRunning" min="0">
            </div>
          </div>

          <button class="btn-action" @click="toggleTest" :class="{ stop: stats.isRunning }">
            {{ stats.isRunning ? 'СТОП' : 'Старт' }}
          </button>
        </div>

        <!-- МОНИТОРИНГ -->
        <div class="right-column">
          
          <!-- Карточки метрик -->
          <div class="metrics-grid">
            <div class="metric-card">
                <div class="metric-title">ОТПРАВЛЕНО</div>
                <div class="metric-val">{{ stats.sent }}</div>
            </div>
            <div class="metric-card success-card">
                <div class="metric-title">УСПЕШНО</div>
                <div class="metric-val">{{ stats.success }}</div>
            </div>
            <div class="metric-card error-card">
                <div class="metric-title">ОШИБКИ</div>
                <div class="metric-val">{{ stats.errors }}</div>
            </div>
            <div class="metric-card timer-card">
                <div class="metric-title">ВРЕМЯ</div>
                <div class="metric-val">{{ timerDisplay }}<span class="small">s</span></div>
            </div>
          </div>

          <!-- Прогресс бар и консоль -->
          <div class="card monitor-card">
            <div class="monitor-header">
              <span>Лог операций</span>
              <span class="percent">{{ progressPercent.toFixed(0) }}%</span>
            </div>
            
            <div class="progress-track">
              <div class="progress-fill" :style="{ width: progressPercent + '%' }">
                <div class="glow"></div>
              </div>
            </div>

            <div class="console-window">
              <div v-for="(log, i) in stats.logs" :key="i" class="console-line">
                <span class="prompt">></span> {{ log }}
              </div>
              <div v-if="stats.logs.length === 0" class="console-placeholder">Ожидание запуска...</div>
            </div>
          </div>
        </div>
      </div>

      <!-- ТАБЛИЦА ИСТОРИИ -->
      <div class="card history-section" v-if="history.length">
        <h3>История тестов</h3>
        <div class="table-responsive">
          <table>
            <thead>
              <tr>
                <th>Время</th>
                <th>Источник</th>
                <th>Режим</th>
                <th>Запросов</th>
                <th>Длит.</th>
                <th>RPS</th>
                <th>Fail</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in history" :key="item.id">
                <td class="muted">{{ item.time }}</td>
                <td><span class="badge" :class="item.mode === 'Браузер' ? 'blue' : 'purple'">{{ item.mode }}</span></td>
                <td><span class="badge" :class="item.turbo ? 'green' : 'gray'">{{ item.turbo ? 'Cache' : 'DB' }}</span></td>
                <td>{{ item.requests }}</td>
                <td>{{ item.duration }}s</td>
                <td class="rps-val">{{ item.rps.toLocaleString() }}</td>
                <td :class="{ 'text-red': item.errors > 0 }">{{ item.errors }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

    </div>
  </div>
</template>

<style>
:root {
  --bg-dark: #0f172a;
  --bg-card: #1e293b;
  --primary: #3b82f6;
  --accent: #8b5cf6;
  --success: #10b981;
  --danger: #ef4444;
  --text: #f1f5f9;
  --text-muted: #94a3b8;
}
body {
  margin: 0;
  background-color: var(--bg-dark);
  font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  color: var(--text);
  -webkit-font-smoothing: antialiased;
}
</style>

<style scoped>
.app-bg {
  min-height: 100vh;
  padding: 40px 20px;
  box-sizing: border-box;
  background: radial-gradient(circle at top center, #1e293b 0%, #0f172a 60%);
}

.wrapper {
  max-width: 1100px;
  margin: 0 auto;
}

/* HEADER */
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 32px;
}
h1 {
  margin: 0;
  font-size: 2rem;
  font-weight: 800;
  letter-spacing: -0.5px;
}
.gradient-text {
  background: linear-gradient(to right, var(--primary), var(--accent));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}
.subtitle {
  color: var(--text-muted);
  font-size: 0.9rem;
  margin-top: 4px;
}

.status-badge {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  background: rgba(255,255,255,0.03);
  border-radius: 20px;
  font-size: 0.75rem;
  font-weight: 700;
  border: 1px solid rgba(255,255,255,0.08);
  color: var(--text-muted);
}
.status-badge.running {
  color: var(--primary);
  border-color: rgba(59, 130, 246, 0.3);
  background: rgba(59, 130, 246, 0.1);
}
.dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--text-muted);
}
.status-badge.running .dot {
  background: var(--primary);
  box-shadow: 0 0 8px var(--primary);
  animation: pulse 1.5s infinite;
}

/* LAYOUT */
.main-grid {
  display: grid;
  grid-template-columns: 340px 1fr;
  gap: 24px;
  margin-bottom: 24px;
}

@media (max-width: 900px) {
  .main-grid { grid-template-columns: 1fr; }
}

.card {
  background: var(--bg-card);
  border: 1px solid rgba(255,255,255,0.05);
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.2);
}

/* LEFT PANEL */
.section-title {
  font-size: 0.7rem;
  font-weight: 700;
  color: var(--text-muted);
  margin-bottom: 10px;
  letter-spacing: 0.5px;
  text-transform: uppercase;
}

.tabs {
  display: flex;
  background: #0f172a;
  padding: 4px;
  border-radius: 10px;
  gap: 4px;
}
.tab {
  flex: 1;
  border: none;
  background: transparent;
  color: var(--text-muted);
  padding: 8px;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}
.tab:hover:not(:disabled) { color: var(--text); }
.tab.active {
  background: var(--bg-card);
  color: var(--text);
  box-shadow: 0 2px 5px rgba(0,0,0,0.2);
}

.divider {
  height: 1px;
  background: rgba(255,255,255,0.05);
  margin: 20px 0;
}

/* TURBO SWITCH */
.turbo-switch {
  background: #0f172a;
  padding: 14px;
  border-radius: 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
  border: 1px solid transparent;
  transition: all 0.2s;
}
.turbo-switch:hover:not(.disabled) { border-color: rgba(255,255,255,0.1); }
.turbo-switch.active {
  background: rgba(16, 185, 129, 0.1);
  border-color: rgba(16, 185, 129, 0.3);
}
.turbo-switch.disabled { opacity: 0.6; cursor: not-allowed; }

.switch-label { display: block; font-weight: 700; font-size: 0.9rem; }
.switch-status { font-size: 0.7rem; color: var(--text-muted); font-weight: 600; }
.turbo-switch.active .switch-status { color: var(--success); }

.toggle-pill {
  width: 40px;
  height: 22px;
  background: #334155;
  border-radius: 20px;
  position: relative;
  transition: 0.3s;
}
.toggle-pill::after {
  content: '';
  position: absolute;
  top: 2px; left: 2px;
  width: 18px; height: 18px;
  background: white;
  border-radius: 50%;
  transition: 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
.turbo-switch.active .toggle-pill { background: var(--success); }
.turbo-switch.active .toggle-pill::after { transform: translateX(18px); }

/* INPUTS */
.inputs-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 24px; }
.input-wrap label { display: block; font-size: 0.75rem; color: var(--text-muted); margin-bottom: 6px; }
.input-wrap input {
  width: 100%;
  background: #0f172a;
  border: 1px solid #334155;
  padding: 10px;
  border-radius: 8px;
  color: white;
  font-family: 'Courier New', monospace;
  font-weight: 700;
  box-sizing: border-box;
  transition: 0.2s;
}
.input-wrap input:focus { outline: none; border-color: var(--primary); }
.input-wrap.dimmed { opacity: 0.5; pointer-events: none; }

.btn-action {
  width: 100%;
  padding: 16px;
  border: none;
  border-radius: 10px;
  font-weight: 800;
  font-size: 0.95rem;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  cursor: pointer;
  background: linear-gradient(135deg, var(--primary), var(--accent));
  color: white;
  box-shadow: 0 4px 15px rgba(59, 130, 246, 0.3);
  transition: all 0.2s;
}
.btn-action:hover { transform: translateY(-1px); box-shadow: 0 6px 20px rgba(59, 130, 246, 0.4); }
.btn-action:active { transform: translateY(0); }
.btn-action.stop {
  background: linear-gradient(135deg, #ef4444, #b91c1c);
  box-shadow: 0 4px 15px rgba(239, 68, 68, 0.3);
}

/* METRICS */
.metrics-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: 24px;
}
@media (max-width: 600px) { .metrics-grid { grid-template-columns: 1fr 1fr; } }

.metric-card {
  background: var(--bg-card);
  border: 1px solid rgba(255,255,255,0.05);
  padding: 16px;
  border-radius: 12px;
  text-align: center;
}
.metric-title { font-size: 0.7rem; color: var(--text-muted); margin-bottom: 8px; font-weight: 700; }
.metric-val { font-size: 1.4rem; font-weight: 700; font-family: 'Courier New', monospace; }

.success-card .metric-val { color: var(--success); }
.error-card .metric-val { color: var(--danger); }
.timer-card .metric-val { color: var(--primary); }
.small { font-size: 0.8rem; opacity: 0.7; }

/* LOGS */
.monitor-card { display: flex; flex-direction: column; gap: 16px; }
.monitor-header { display: flex; justify-content: space-between; font-size: 0.85rem; color: var(--text-muted); font-weight: 600; }
.percent { color: var(--text); }

.progress-track {
  height: 6px;
  background: #0f172a;
  border-radius: 3px;
  overflow: hidden;
}
.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--primary), var(--accent));
  width: 0%;
  transition: width 0.2s linear;
  position: relative;
}
.glow {
  position: absolute;
  top: 0; right: 0; bottom: 0;
  width: 10px;
  background: white;
  filter: blur(4px);
  opacity: 0.5;
}

.console-window {
  background: #0b1120;
  border-radius: 8px;
  padding: 12px;
  height: 180px;
  overflow-y: auto;
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 0.8rem;
  color: #34d399;
  border: 1px solid #1e293b;
  display: flex;
  flex-direction: column;
}
.console-line { margin-bottom: 4px; border-bottom: 1px solid rgba(255,255,255,0.03); padding-bottom: 2px; word-break: break-all; }
.prompt { color: #64748b; margin-right: 8px; user-select: none; }
.console-placeholder { color: #475569; text-align: center; margin: auto; font-style: italic; }

/* HISTORY */
.history-section h3 { margin: 0 0 16px 0; font-size: 1.1rem; font-weight: 700; }
.table-responsive { overflow-x: auto; }
table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
th { text-align: left; padding: 12px; color: var(--text-muted); border-bottom: 1px solid rgba(255,255,255,0.1); font-weight: 600; }
td { padding: 12px; border-bottom: 1px solid rgba(255,255,255,0.05); vertical-align: middle; }
.badge { padding: 4px 8px; border-radius: 6px; font-size: 0.7rem; font-weight: 700; display: inline-block; }
.badge.blue { background: rgba(59, 130, 246, 0.2); color: var(--primary); }
.badge.purple { background: rgba(139, 92, 246, 0.2); color: var(--accent); }
.badge.green { background: rgba(16, 185, 129, 0.2); color: var(--success); }
.badge.gray { background: rgba(148, 163, 184, 0.2); color: var(--text-muted); }
.rps-val { font-weight: 700; color: #fbbf24; font-family: monospace; }
.text-red { color: var(--danger); font-weight: bold; }
.muted { color: var(--text-muted); font-size: 0.75rem; }

/* Scrollbar */
::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: #0f172a; }
::-webkit-scrollbar-thumb { background: #334155; border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: #475569; }

@keyframes pulse {
  0% { opacity: 1; }
  50% { opacity: 0.5; }
  100% { opacity: 1; }
}
</style>