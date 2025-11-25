<script setup lang="ts">

</script>

<template>
  <div class="info-grid">
    
    <!-- О проекте -->
    <div class="card full-width">
      <h2>🎯 Цель проекта</h2>
      <p>
        Демонстрация оптимизации высоконагруженных систем на стеке 
        <span class="highlight">NestJS + Vue 3 + PostgreSQL</span>. 
        Проект показывает разницу между прямой работой с БД и использованием 
        <span class="highlight">In-Memory кэширования (RAM)</span> под нагрузкой.
      </p>
    </div>

    <!-- Архитектура -->
    <div class="card">
      <h3>🛠 Технологический стек</h3>
      <ul class="tech-list">
        <li>
          <span class="icon">🟢</span> 
          <div>
            <strong>Node.js / NestJS</strong>
            <span class="desc">Backend API, Cache Manager (Memory)</span>
          </div>
        </li>
        <li>
          <span class="icon">🔵</span>
          <div>
            <strong>PostgreSQL + TypeORM</strong>
            <span class="desc">Persistent Storage (50k items)</span>
          </div>
        </li>
        <li>
          <span class="icon">⚡</span>
          <div>
            <strong>Vue 3 + Vite</strong>
            <span class="desc">Composition API, Optimization</span>
          </div>
        </li>
        <li>
          <span class="icon">🐳</span>
          <div>
            <strong>Docker</strong>
            <span class="desc">Containerization, Nginx</span>
          </div>
        </li>
      </ul>
    </div>

    <!-- Как работают режимы -->
    <div class="card">
      <h3>🧪 Режимы тестирования</h3>
      <div class="mode-item">
        <div class="mode-header">
          <span class="badge blue">Client Load</span>
          <span>Браузер (Axios)</span>
        </div>
        <p>Симуляция реальных пользователей. Упирается в ограничения браузера (макс. 6 соединений) и latency сети.</p>
      </div>
      <div class="mode-item">
        <div class="mode-header">
          <span class="badge purple">Server Benchmark</span>
          <span>Internal Stress Test</span>
        </div>
        <p>Бэкенд генерирует нагрузку сам на себя (loopback). Исключает сетевые задержки, показывая чистую производительность алгоритмов.</p>
      </div>
    </div>

    <!--  Оптимизация -->
    <div class="card full-width">
      <h3>🚀 Стратегия оптимизации "Hot Data"</h3>
      <div class="comparison">
        <div class="comp-col">
          <h4>🐌 Cold Mode (DB)</h4>
          <p>Запросы идут напрямую в PostgreSQL.</p>
          <div class="stat-box red">
            ~330 RPS
            <span>(Disk I/O Bound)</span>
          </div>
          <small>Чтение с диска, парсинг SQL</small>
        </div>
        
        <div class="arrow">➜</div>

        <div class="comp-col">
          <h4>🔥 Turbo Mode (Cache)</h4>
          <p>Популярные запросы (Top-10 pages) хранятся в RAM.</p>
          <div class="stat-box green">
            ~290 000 RPS
            <span>(Zero I/O Latency)</span>
          </div>
          <small>Мгновенная отдача из Node.js Heap</small>
        </div>
      </div>
    </div>

  </div>
</template>

<style scoped>
.info-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  animation: fadeIn 0.5s ease-out;
}
@media (max-width: 768px) {
  .info-grid { grid-template-columns: 1fr; }
}

.full-width { grid-column: 1 / -1; }

.card {
  background: #1e293b;
  border: 1px solid rgba(255,255,255,0.05);
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.2);
  color: #f1f5f9;
}

h2, h3, h4 { margin-top: 0; color: #f1f5f9; }
h2 { font-size: 1.5rem; margin-bottom: 10px; }
h3 { font-size: 1.1rem; color: #94a3b8; margin-bottom: 20px; text-transform: uppercase; letter-spacing: 1px; }
p { line-height: 1.6; color: #cbd5e1; font-size: 0.95rem; }

.highlight { color: #3b82f6; font-weight: bold; }

/* Tech List */
.tech-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 15px; }
.tech-list li { display: flex; gap: 12px; align-items: center; }
.icon { font-size: 1.2rem; }
.desc { display: block; font-size: 0.8rem; color: #64748b; }

/* Modes */
.mode-item { margin-bottom: 20px; padding-bottom: 20px; border-bottom: 1px solid rgba(255,255,255,0.05); }
.mode-item:last-child { border-bottom: none; margin-bottom: 0; padding-bottom: 0; }
.mode-header { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; font-weight: bold; }

.badge { padding: 4px 8px; border-radius: 6px; font-size: 0.7rem; font-weight: 700; text-transform: uppercase; }
.badge.blue { background: rgba(59, 130, 246, 0.2); color: #3b82f6; }
.badge.purple { background: rgba(139, 92, 246, 0.2); color: #8b5cf6; }

/* Comparison */
.comparison { display: flex; align-items: center; gap: 20px; text-align: center; margin-top: 20px; }
.comp-col { flex: 1; background: rgba(0,0,0,0.2); padding: 15px; border-radius: 12px; }
.arrow { font-size: 2rem; color: #64748b; }
@media (max-width: 600px) { .comparison { flex-direction: column; } .arrow { transform: rotate(90deg); } }

.stat-box { 
  font-family: 'Courier New', monospace; 
  font-size: 1.4rem; 
  font-weight: bold; 
  margin: 10px 0; 
  padding: 10px; 
  border-radius: 8px; 
  background: rgba(255,255,255,0.05);
}
.stat-box span { display: block; font-size: 0.7rem; opacity: 0.7; font-family: sans-serif; margin-top: 4px; }
.stat-box.red { color: #ef4444; border: 1px solid rgba(239,68,68,0.3); }
.stat-box.green { color: #10b981; border: 1px solid rgba(16,185,129,0.3); }

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>