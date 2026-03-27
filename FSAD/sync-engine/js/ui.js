/* ============================================================
   js/ui.js  –  DOM rendering, toasts, log, charts
   ============================================================ */

const UI = (() => {

  const MAX_LOG = 150;
  let _chartCanvas = null;
  let _chartCtx    = null;
  let _startTime   = Date.now();

  // ── Toast ────────────────────────────────────────────────────

  function toast(msg, type = 'info') {
    let container = document.getElementById('toastContainer');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toastContainer';
      document.body.appendChild(container);
    }
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.textContent = msg;
    container.appendChild(el);
    setTimeout(() => el.remove(), 3000);
  }

  // ── Log ──────────────────────────────────────────────────────

  function log(nodeId, type, msg) {
    const now = new Date();
    const ts  = `${pad(now.getMinutes())}:${pad(now.getSeconds())}.${String(now.getMilliseconds()).slice(0,2)}`;
    AppState.events.unshift({ ts, node: nodeId, type, msg });
    if (AppState.events.length > MAX_LOG) AppState.events.pop();
  }

  function pad(n) { return String(n).padStart(2, '0'); }

  function nodeColor(id) {
    const n = AppState.nodes.find(n => n.id === id);
    return n ? n.color : '#cce8f4';
  }

  // ── Full UI update (called each engine tick) ─────────────────

  function update() {
    _renderKPIs();
    _renderLog();
    _renderNodeCards();
    _renderVectorClocks();
    _renderConflicts();
    _renderDBTable();
    _renderThroughputChart();
    _renderUptime();
  }

  // ── KPI Strip ────────────────────────────────────────────────

  function _renderKPIs() {
    _setText('kpiTotalEvents',  AppState.totalEvents);
    _setText('kpiEPS',          `${AppState.currentEPS}/s`);
    _setText('kpiConflicts',    AppState.totalConflicts);
    const onlineCount = AppState.nodes.filter(n => n.status !== 'offline').length;
    const syncPct = AppState.nodes.length
      ? Math.round((onlineCount / AppState.nodes.length) * 100) : 0;
    _setText('kpiSyncPct', `${syncPct}%`);

    // Average latency
    const avgLat = Math.round(AppState.nodes.reduce((s, n) => s + n.latency, 0) / AppState.nodes.length);
    _setText('kpiAvgLatency', `${avgLat}ms`);
    _setText('kpiThroughput',  AppState.currentEPS);
    _setText('kpiSyncRate',    `${syncPct}%`);

    // Pulse animation
    ['kpiCardEvents','kpiCardEPS','kpiCardConflicts','kpiCardSync'].forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      el.classList.remove('flash');
      void el.offsetWidth;
      el.classList.add('flash');
    });
  }

  // ── Node Cards ───────────────────────────────────────────────

  function _renderNodeCards() {
    const grid = document.getElementById('nodeGrid');
    if (!grid) return;
    grid.innerHTML = AppState.nodes.map(n => `
      <div class="node-card state-${n.status}">
        <div class="node-top">
          <span class="node-id mono" style="color:${n.color}">${n.id}</span>
          <span class="status-dot dot-${n.status === 'online' ? 'online' : n.status}"></span>
        </div>
        <div class="node-stat"><span class="ns-lbl">Writes</span>  <span class="ns-val">${n.writes}</span></div>
        <div class="node-stat"><span class="ns-lbl">Reads</span>   <span class="ns-val">${n.reads}</span></div>
        <div class="node-stat"><span class="ns-lbl">Syncs</span>   <span class="ns-val">${n.syncs}</span></div>
        <div class="node-stat"><span class="ns-lbl">Sync%</span>   <span class="ns-val">${n.syncPct}%</span></div>
        <div class="node-bar"><div class="node-bar-fill" style="width:${n.syncPct}%"></div></div>
        <div class="node-latency">⏱ ${n.latency}ms &nbsp;·&nbsp; VC: ${n.vectorClock}</div>
      </div>
    `).join('');

    const offlineCount = AppState.nodes.filter(n => n.status === 'offline').length;
    _setText('nodesMeta', offlineCount ? `${offlineCount} OFFLINE` : 'ALL ONLINE');
    _setText('topoMeta',  `${AppState.nodes.length} NODES · MESH`);
  }

  // ── Vector Clocks ────────────────────────────────────────────

  function _renderVectorClocks() {
    const grid = document.getElementById('vclockGrid');
    if (!grid) return;
    grid.innerHTML = AppState.nodes.map(n => `
      <div class="vclock-item">
        <div class="vc-node">${n.id}</div>
        <div class="vc-val" style="color:${n.color}">${n.vectorClock}</div>
      </div>
    `).join('');
  }

  // ── Event Log ────────────────────────────────────────────────

  function _renderLog() {
    const list = document.getElementById('logList');
    if (!list) return;
    list.innerHTML = AppState.events.slice(0, 60).map(e => `
      <div class="log-row row-${e.type.toLowerCase()}">
        <span class="log-time">${e.ts}</span>
        <span class="log-node" style="color:${nodeColor(e.node)}">${e.node}</span>
        <span class="log-type" style="color:${_typeColor(e.type)}">${e.type}</span>
        <span class="log-msg">${e.msg}</span>
      </div>
    `).join('');
    _setText('logCount', `${AppState.events.length} ENTRIES`);
  }

  function _typeColor(type) {
    return { WRITE:'#39ff14', READ:'#bf5af2', SYNC:'#00e5ff',
             CONFLICT:'#ff3a3a', DELETE:'#ff6b35', OFFLINE:'#3a6070', ONLINE:'#39ff14' }[type] || '#cce8f4';
  }

  // ── DB Table ─────────────────────────────────────────────────

  function _renderDBTable() {
    const body = document.getElementById('dbBody');
    if (!body) return;
    const keys = Object.keys(AppState.database);
    _setText('dbMeta', `${keys.length} RECORDS`);
    body.innerHTML = keys.map(k => {
      const r   = AppState.database[k];
      const age = Math.floor((Date.now() - r.ts) / 1000);
      return `
        <tr data-db-key="${k}">
          <td class="text-purple">${k}</td>
          <td class="text-green">${r.value}</td>
          <td class="text-accent">${r.version}</td>
          <td style="color:${nodeColor(r.node)}">${r.node}</td>
          <td class="muted">${age}s</td>
        </tr>`;
    }).join('');
  }

  // ── Conflict List ────────────────────────────────────────────

  function _renderConflicts() {
    const list = document.getElementById('conflictList');
    if (!list) return;
    if (!AppState.conflicts.length) {
      list.innerHTML = '<div class="muted mono" style="padding:8px;font-size:11px;">No conflicts detected.</div>';
      _setText('conflictMeta', 'LWW STRATEGY');
      _setText('conflictCount', '0');
      return;
    }
    list.innerHTML = AppState.conflicts.map(c => `
      <div class="conflict-item">
        <span class="ci-key">${c.key}</span>
        <span class="ci-detail">${c.node1} ↔ ${c.node2}</span>
        <span class="ci-res">LWW ✓</span>
      </div>
    `).join('');
    _setText('conflictMeta',  `${AppState.conflicts.length} RESOLVED`);
    _setText('conflictCount', AppState.totalConflicts);
  }

  // ── Throughput Chart ─────────────────────────────────────────

  function initChart(canvasEl) {
    _chartCanvas = canvasEl;
    _chartCtx    = canvasEl.getContext('2d');
    _resizeChart();
    window.addEventListener('resize', _resizeChart);
  }

  function _resizeChart() {
    if (!_chartCanvas) return;
    _chartCanvas.width  = _chartCanvas.parentElement.clientWidth;
    _chartCanvas.height = 70;
  }

  function _renderThroughputChart() {
    if (!_chartCtx) return;
    const hist = AppState.throughputHistory;
    const w = _chartCanvas.width, h = _chartCanvas.height;
    _chartCtx.clearRect(0, 0, w, h);
    if (hist.length < 2) return;

    const max  = Math.max(...hist, 1);
    const step = w / (AppState.MAX_THROUGHPUT_HIST - 1);

    // Fill
    _chartCtx.beginPath();
    _chartCtx.moveTo(0, h);
    hist.forEach((v, i) => _chartCtx.lineTo(i * step, h - (v / max) * (h - 6)));
    _chartCtx.lineTo((hist.length - 1) * step, h);
    _chartCtx.closePath();
    _chartCtx.fillStyle = 'rgba(0,229,255,0.07)';
    _chartCtx.fill();

    // Line
    _chartCtx.beginPath();
    hist.forEach((v, i) => {
      const x = i * step, y = h - (v / max) * (h - 6);
      i === 0 ? _chartCtx.moveTo(x, y) : _chartCtx.lineTo(x, y);
    });
    _chartCtx.strokeStyle = '#00e5ff';
    _chartCtx.lineWidth   = 1.5;
    _chartCtx.shadowColor = '#00e5ff';
    _chartCtx.shadowBlur  = 5;
    _chartCtx.stroke();
    _chartCtx.shadowBlur  = 0;
  }

  // ── Uptime ───────────────────────────────────────────────────

  function _renderUptime() {
    const sec = Math.floor((Date.now() - AppState.startTime) / 1000);
    const h = Math.floor(sec / 3600),
          m = Math.floor((sec % 3600) / 60),
          s = sec % 60;
    _setText('uptime', `UP ${pad(h)}:${pad(m)}:${pad(s)}`);
  }

  // ── Utility ──────────────────────────────────────────────────

  function _setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  return { toast, log, update, nodeColor, initChart };

})();
