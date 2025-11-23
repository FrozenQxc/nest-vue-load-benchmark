<script setup lang="ts">
import { reactive, onUnmounted, ref } from 'vue';
import axios from 'axios';

// Типы
interface HistoryItem {
  id: number;
  time: string;
  total: number;
  concurrency: number;
  duration: string;
  rps: string;
  success: number;
  errors: number;
}

const config = reactive({
  requestCount: 2000,
  concurrency: 50,
  delay: 0,
});

const stats = reactive({
  sent: 0,
  success: 0,
  errors: 0,
  isRunning: false,
  startTime: 0,
  endTime: 0,
  logs: [] as string[],
});

const history = ref<HistoryItem[]>([]);
const timerDisplay = ref('0.00');
let timerInterval: any = null;
let abortController: AbortController | null = null; 

// === ГЛАВНАЯ КНОПКА (TOGGLE) ===
const toggleTest = () => {
  if (stats.isRunning) {
    userStop(); // Если запущено -> Останавливаем
  } else {
    startTest(); // Если стоит -> Запускаем
  }
};

const startTest = async () => {
  // Сброс и старт
  stats.isRunning = true;
  stats.sent = 0;
  stats.success = 0;
  stats.errors = 0;
  stats.startTime = Date.now();
  stats.endTime = 0;
  stats.logs = [];
  
  abortController = new AbortController();

  clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    const now = Date.now();
    timerDisplay.value = ((now - stats.startTime) / 1000).toFixed(2);
  }, 50);

  addLog('🚀 Тест запущен...');

  let activePromises: Promise<void>[] = [];

  for (let i = 0; i < config.requestCount; i++) {
    if (!stats.isRunning) break; // Проверка флага остановки

    const randomOffset = Math.floor(Math.random() * 1000); 
    
    const p = sendRequest(randomOffset).then(() => {
      const idx = activePromises.indexOf(p);
      if (idx > -1) activePromises.splice(idx, 1);
    });

    activePromises.push(p);
    stats.sent++;

    if (activePromises.length >= config.concurrency) {
      try {
        await Promise.race(activePromises);
      } catch (e) { break; }
    }

    if (config.delay > 0) {
      await new Promise(r => setTimeout(r, config.delay));
    }
  }

  await Promise.allSettled(activePromises);
  
  // Если тест не был остановлен аварийно или вручную раньше времени
  if (stats.isRunning) {
     finishTest();
  }
};

// Остановка пользователем (кнопка СТОП)
const userStop = () => {
  if (!stats.isRunning) return;
  
  stats.isRunning = false;
  if (abortController) abortController.abort(); // Обрываем запросы
  
  finishTest(); // Финализируем метрики
  addLog('Тест остановлен пользователем.');
};

const sendRequest = async (offset: number) => {
  if (!stats.isRunning) return;

  try {
    await axios.get(`http://localhost:3000/items?limit=50&offset=${offset}`, {
      signal: abortController?.signal 
    });
    stats.success++;
  } catch (e: any) {
    if (axios.isCancel(e)) return; // Игнорируем отмену
    stats.errors++;
    if (e.code === 'ERR_NETWORK' || e.message === 'Network Error') {
      emergencyStop();
    }
  }
};

const emergencyStop = () => {
  if (!stats.isRunning) return;
  stats.isRunning = false;
  if (abortController) abortController.abort(); 
  finishTest();
  addLog('🛑 КРИТИЧЕСКАЯ ОШИБКА: Сервер не отвечает!');
};

const finishTest = () => {
  // Убеждаемся, что статус false
  stats.isRunning = false;
  clearInterval(timerInterval);
  
  if (stats.endTime === 0) stats.endTime = Date.now();
  const durationStr = ((stats.endTime - stats.startTime) / 1000).toFixed(2);
  timerDisplay.value = durationStr;

  if (stats.sent > 0) {
    saveToHistory(durationStr);
  }
  
  // Если последнее сообщение не об ошибке/остановке, добавляем "Завершено"
  const lastLog = stats.logs[0] || '';
  if (!lastLog.includes('ОШИБКА') && !lastLog.includes('остановлен')) {
     addLog(`🏁 Тест завершен! Итого: ${durationStr}с`);
  }
};

const saveToHistory = (durationStr: string) => {
  const duration = parseFloat(durationStr);
  const rps = duration > 0 ? (stats.success / duration).toFixed(0) : '0';

  history.value.unshift({
    id: Date.now(),
    time: new Date().toLocaleTimeString(),
    total: config.requestCount,
    concurrency: config.concurrency,
    duration: durationStr,
    rps: rps,
    success: stats.success,
    errors: stats.errors
  });
};

const addLog = (msg: string) => {
  const time = new Date().toLocaleTimeString('ru-RU');
  stats.logs.unshift(`[${time}] ${msg}`);
  if (stats.logs.length > 50) stats.logs.pop();
};

onUnmounted(() => {
  clearInterval(timerInterval);
  if (abortController) abortController.abort();
});
</script>

<template>
  <div class="dashboard-container">
    <div class="dashboard">
      <!-- Левая колонка -->
      <div class="card config-card">
        <div class="card-header">
          <h2>⚙️ Настройки</h2>
        </div>
        
        <div class="input-group">
          <label>Кол-во запросов</label>
          <input type="number" v-model="config.requestCount" :disabled="stats.isRunning">
        </div>
        <div class="input-group">
          <label>Потоки (Concurrency)</label>
          <input type="number" v-model="config.concurrency" :disabled="stats.isRunning">
        </div>
        <div class="input-group">
          <label>Задержка (мс)</label>
          <input type="number" v-model="config.delay" :disabled="stats.isRunning">
        </div>

        <!-- ОБНОВЛЕННАЯ КНОПКА -->
        <button 
          @click="toggleTest" 
          class="btn-main" 
          :class="{ 'btn-stop': stats.isRunning }"
        >
          {{ stats.isRunning ? 'СТОП' : '🔥 ЗАПУСТИТЬ' }}
        </button>
      </div>

      <!-- Правая колонка -->
      <div class="card stats-card">
        <div class="card-header">
          <h2>📊 Метрики</h2>
          <span class="timer">{{ timerDisplay }} s</span>
        </div>

        <div class="stats-grid">
          <div class="stat-box">
            <span class="label">Отправлено</span>
            <span class="value primary">{{ stats.sent }}</span>
          </div>
          <div class="stat-box">
            <span class="label">Успешно</span>
            <span class="value success">{{ stats.success }}</span>
          </div>
          <div class="stat-box">
            <span class="label">Ошибки</span>
            <span class="value error">{{ stats.errors }}</span>
          </div>
        </div>

        <div class="progress-container">
          <div class="progress-bar-bg">
            <div 
              class="progress-bar-fill" 
              :style="{ width: (config.requestCount > 0 ? (stats.sent / config.requestCount * 100) : 0) + '%' }"
              :class="{ 'finished': !stats.isRunning && stats.sent > 0 }"
            ></div>
          </div>
        </div>

        <div class="logs-window">
          <div v-for="(log, i) in stats.logs" :key="i" class="log-line">
            <span class="log-arrow">></span> {{ log }}
          </div>
          <div v-if="stats.logs.length === 0" class="log-placeholder">Ожидание запуска...</div>
        </div>
      </div>
    </div>

    <!-- История -->
    <div class="card history-card" v-if="history.length > 0">
      <div class="card-header">
        <h2>📜 История запусков</h2>
      </div>
      <div class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Время</th>
              <th>Запросов</th>
              <th>Потоки</th>
              <th>Длительность</th>
              <th>RPS 🚀</th>
              <th>Ошибки</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in history" :key="item.id">
              <td>{{ item.time }}</td>
              <td>{{ item.total }}</td>
              <td>{{ item.concurrency }}</td>
              <td>{{ item.duration }} s</td>
              <td class="rps-cell">{{ item.rps }}</td>
              <td :class="{ 'has-errors': item.errors > 0 }">{{ item.errors }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

  </div>
</template>

<style scoped>
/* Стили те же, но добавили стили для красной кнопки */

.dashboard-container { display: flex; flex-direction: column; gap: 24px; }
.dashboard { display: grid; grid-template-columns: 300px 1fr; gap: 24px; }
@media (max-width: 768px) { .dashboard { grid-template-columns: 1fr; } }

.card { background: var(--bg-card); border-radius: 16px; padding: 24px; box-shadow: 0 10px 30px rgba(0,0,0,0.3); border: 1px solid var(--border-color); display: flex; flex-direction: column; }
.card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
.card-header h2 { margin: 0; font-size: 1.2rem; color: var(--text-main); }

.input-group { margin-bottom: 16px; }
.input-group label { display: block; font-size: 0.85rem; color: var(--text-muted); margin-bottom: 6px; font-weight: 500; }
.input-group input { width: 100%; background: #0f172a; border: 1px solid #334155; color: white; padding: 12px; border-radius: 8px; font-size: 1rem; box-sizing: border-box; }
.input-group input:focus { outline: none; border-color: var(--color-primary); }

/* === КНОПКА === */
.btn-main { 
  margin-top: auto; 
  width: 100%; 
  padding: 16px; 
  background: linear-gradient(135deg, var(--color-primary), var(--color-accent)); 
  color: white; 
  border: none; 
  border-radius: 12px; 
  font-size: 1.1rem; 
  font-weight: 700; 
  cursor: pointer; 
  transition: all 0.2s ease; 
  text-transform: uppercase; 
  box-shadow: 0 4px 15px rgba(59, 130, 246, 0.4);
}

.btn-main:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(59, 130, 246, 0.6); }

/* СТИЛЬ ДЛЯ СТОПА */
.btn-stop {
  background: linear-gradient(135deg, #ef4444, #b91c1c) !important; /* Красный градиент */
  box-shadow: 0 4px 15px rgba(239, 68, 68, 0.4) !important;
}
.btn-stop:hover {
  box-shadow: 0 6px 20px rgba(239, 68, 68, 0.6) !important;
}
.btn-stop:active { transform: translateY(0); }

/* Stats */
.stats-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 24px; }
.stat-box { background: rgba(255,255,255,0.03); padding: 16px; border-radius: 12px; text-align: center; border: 1px solid var(--border-color); }
.stat-box .label { display: block; font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; }
.stat-box .value { font-size: 2rem; font-weight: 700; font-family: 'Courier New', monospace; }
.value.primary { color: var(--color-primary); }
.value.success { color: var(--color-success); }
.value.error { color: var(--color-error); }
.timer { font-family: 'Courier New', monospace; font-size: 1.5rem; color: var(--color-primary); background: rgba(0,0,0,0.2); padding: 4px 12px; border-radius: 6px; border: 1px solid var(--border-color); }

.progress-container { margin-bottom: 24px; }
.progress-bar-bg { height: 12px; background: #0f172a; border-radius: 6px; overflow: hidden; border: 1px solid #334155; }
.progress-bar-fill { height: 100%; background: linear-gradient(90deg, var(--color-primary), var(--color-accent)); width: 0; transition: width 0.1s linear; }
.progress-bar-fill.finished { background: var(--color-success); }

.logs-window { background: #0f172a; border: 1px solid #334155; border-radius: 8px; padding: 16px; height: 150px; overflow-y: auto; font-family: 'Courier New', monospace; font-size: 0.85rem; color: var(--color-success); flex-grow: 1; }
.log-line { margin-bottom: 4px; border-bottom: 1px solid var(--border-color); padding-bottom: 2px; }
.log-arrow { color: var(--color-accent); margin-right: 5px; }
.log-placeholder { color: #475569; text-align: center; margin-top: 60px; font-style: italic; }

.table-wrapper { overflow-x: auto; }
table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
th { text-align: left; padding: 12px; color: var(--text-muted); border-bottom: 1px solid var(--border-color); }
td { padding: 12px; border-bottom: 1px solid rgba(255,255,255,0.05); }
tr:last-child td { border-bottom: none; }
.rps-cell { color: var(--color-accent); font-weight: bold; font-family: 'Courier New', monospace; }
.has-errors { color: var(--color-error); font-weight: bold; }
</style>