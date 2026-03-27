/* ============================================================
   js/router.js  –  Client-side page router
                    Injects page HTML into #mainContent and
                    wires up page-specific controls
   ============================================================ */

const Router = (() => {

  let _currentPage = null;

  // ── Page templates ───────────────────────────────────────────

  const pages = {

    // ── DASHBOARD ──────────────────────────────────────────────
    dashboard: () => `
      <div class="animate-in">
        <div class="page-header">
          <div>
            <div class="page-title">⬡ Dashboard</div>
            <div class="page-sub">Real-Time Synchronization Overview</div>
          </div>
        </div>

        <!-- Controls -->
        <div class="controls-bar">
          <button class="btn btn-green"   onclick="Engine.resume(); UI.toast('Engine started','ok')">▶ START</button>
          <button class="btn btn-orange"  onclick="Engine.pause();  UI.toast('Engine paused','info')">⏸ PAUSE</button>
          <button class="btn btn-cyan"    onclick="Engine.addNode()">+ NODE</button>
          <button class="btn btn-purple"  onclick="Engine.triggerPartition()">⚡ PARTITION</button>
          <button class="btn btn-red"     onclick="Engine.clearConflicts(); UI.update()">✕ CLEAR</button>
          <div class="speed-control">
            <label>SPEED</label>
            <input type="range" min="1" max="10" value="${AppState.speed}"
              oninput="Engine.setSpeed(+this.value); document.getElementById('speedVal').textContent=this.value+'x'">
            <span id="speedVal">${AppState.speed}x</span>
          </div>
        </div>

        <!-- KPI strip -->
        <div class="kpi-strip">
          <div class="kpi-card" id="kpiCardEvents">
            <div class="kpi-val text-accent"  id="kpiTotalEvents">0</div>
            <div class="kpi-lbl">Total Events</div>
          </div>
          <div class="kpi-card" id="kpiCardEPS">
            <div class="kpi-val text-orange" id="kpiEPS">0/s</div>
            <div class="kpi-lbl">Events / Sec</div>
          </div>
          <div class="kpi-card" id="kpiCardConflicts">
            <div class="kpi-val text-danger" id="kpiConflicts">0</div>
            <div class="kpi-lbl">Conflicts</div>
          </div>
          <div class="kpi-card" id="kpiCardSync">
            <div class="kpi-val text-green"  id="kpiSyncPct">100%</div>
            <div class="kpi-lbl">Sync Rate</div>
          </div>
        </div>

        <div class="grid-2">
          <!-- Topology -->
          <div class="panel">
            <div class="panel-header">
              <span class="panel-title">⬡ Network Topology</span>
              <span class="panel-meta" id="topoMeta">5 NODES · MESH</span>
            </div>
            <div class="topo-wrap">
              <canvas id="topoCanvas"></canvas>
            </div>
          </div>

          <!-- Metrics panel -->
          <div class="panel">
            <div class="panel-header">
              <span class="panel-title">◈ Live Metrics</span>
              <span class="panel-meta" id="uptime">UP 00:00:00</span>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:12px">
              <div class="kpi-card"><div class="kpi-val text-orange" style="font-size:20px" id="kpiAvgLatency">0ms</div><div class="kpi-lbl">Avg Latency</div></div>
              <div class="kpi-card"><div class="kpi-val text-accent"  style="font-size:20px" id="kpiThroughput">0</div><div class="kpi-lbl">Events/sec</div></div>
              <div class="kpi-card"><div class="kpi-val text-green"   style="font-size:20px" id="kpiSyncRate">100%</div><div class="kpi-lbl">Sync %</div></div>
              <div class="kpi-card"><div class="kpi-val text-purple"  style="font-size:20px" id="kpiQueueSize">0</div><div class="kpi-lbl">Queue</div></div>
            </div>
            <canvas id="throughputChart"></canvas>
          </div>
        </div>

        <!-- Node grid -->
        <div class="panel">
          <div class="panel-header">
            <span class="panel-title">◎ Node Status</span>
            <span class="panel-meta" id="nodesMeta">ALL ONLINE</span>
          </div>
          <div class="node-grid" id="nodeGrid"></div>
        </div>

        <!-- Vector clocks + Event log -->
        <div class="grid-2">
          <div class="panel">
            <div class="panel-header">
              <span class="panel-title">⧖ Vector Clocks</span>
              <span class="panel-meta">LAMPORT TIMESTAMPS</span>
            </div>
            <div class="vclock-grid" id="vclockGrid"></div>
          </div>
          <div class="panel">
            <div class="panel-header">
              <span class="panel-title">⚠ Conflict Resolution</span>
              <span class="panel-meta" id="conflictMeta">LWW STRATEGY</span>
            </div>
            <div class="conflict-list" id="conflictList"></div>
          </div>
        </div>
      </div>
    `,

    // ── NODES ───────────────────────────────────────────────────
    nodes: () => `
      <div class="animate-in">
        <div class="page-header">
          <div><div class="page-title">◎ Nodes</div>
          <div class="page-sub">Cluster Node Management</div></div>
          <div style="display:flex;gap:8px">
            <button class="btn btn-cyan" onclick="Engine.addNode();UI.update()">+ ADD NODE</button>
            <button class="btn btn-purple" onclick="Engine.triggerPartition()">⚡ PARTITION</button>
          </div>
        </div>
        <div class="panel">
          <div class="panel-header">
            <span class="panel-title">Node Details</span>
            <span class="panel-meta" id="nodesMeta">ALL ONLINE</span>
          </div>
          <div class="node-grid" id="nodeGrid"></div>
        </div>
        <div class="panel" style="margin-top:12px">
          <div class="panel-header">
            <span class="panel-title">⧖ Vector Clocks</span>
            <span class="panel-meta">LAMPORT TIMESTAMPS</span>
          </div>
          <div class="vclock-grid" id="vclockGrid"></div>
        </div>
      </div>
    `,

    // ── DATABASE ────────────────────────────────────────────────
    database: () => `
      <div class="animate-in">
        <div class="page-header">
          <div><div class="page-title">⊞ Database</div>
          <div class="page-sub">Live KV Store – Last-Write-Wins</div></div>
        </div>
        <div class="panel">
          <div class="panel-header">
            <span class="panel-title">Records</span>
            <span class="panel-meta" id="dbMeta">0 RECORDS</span>
          </div>
          <div class="db-wrap">
            <table class="db-table">
              <thead>
                <tr>
                  <th>KEY</th><th>VALUE</th><th>VERSION</th><th>NODE</th><th>AGE</th>
                </tr>
              </thead>
              <tbody id="dbBody"></tbody>
            </table>
          </div>
        </div>
      </div>
    `,

    // ── EVENT LOG ───────────────────────────────────────────────
    events: () => `
      <div class="animate-in">
        <div class="page-header">
          <div><div class="page-title">≡ Event Log</div>
          <div class="page-sub">All distributed events in real-time</div></div>
        </div>
        <div class="panel">
          <div class="panel-header">
            <span class="panel-title">Log Stream</span>
            <span class="panel-meta" id="logCount">0 ENTRIES</span>
          </div>
          <div class="log-list" id="logList" style="height:500px"></div>
        </div>
      </div>
    `,

    // ── QUERY LAB ───────────────────────────────────────────────
    query: () => `
      <div class="animate-in">
        <div class="page-header">
          <div><div class="page-title">⌨ Query Lab</div>
          <div class="page-sub">Interactive SQL / KV Query Interface</div></div>
        </div>
        <div class="panel">
          <div class="panel-header">
            <span class="panel-title">Query Simulator</span>
            <span class="panel-meta">SQL / KV INTERFACE</span>
          </div>
          <div class="query-section">
            <div class="query-row">
              <input class="query-input" id="queryInput" placeholder="Type HELP to see available commands…" />
              <button class="btn btn-cyan" id="btnRunQuery">RUN ▶</button>
            </div>
            <div class="query-output" id="queryOutput">-- Query results appear here --</div>
            <div class="query-hints" id="queryHints">
              ${[
                "SELECT * FROM events",
                "SELECT * FROM events WHERE node='N1'",
                "SELECT * FROM events WHERE type='WRITE'",
                "SELECT * FROM db",
                "SELECT * FROM nodes",
                "SELECT COUNT(*)",
                "GET user:alice",
                "SHOW conflicts",
                "SHOW clocks",
              ].map(q => `<div class="hint-chip" onclick="document.getElementById('queryInput').value='${q}'">${q}</div>`).join('')}
            </div>
          </div>
        </div>
      </div>
    `,

    // ── CONFLICTS ───────────────────────────────────────────────
    conflicts: () => `
      <div class="animate-in">
        <div class="page-header">
          <div><div class="page-title">⚠ Conflicts</div>
          <div class="page-sub">Conflict Detection &amp; Resolution Log</div></div>
          <button class="btn btn-red" onclick="Engine.clearConflicts();UI.update()">✕ CLEAR ALL</button>
        </div>
        <div class="panel">
          <div class="panel-header">
            <span class="panel-title">Conflict Log</span>
            <span class="panel-meta" id="conflictMeta">LWW STRATEGY</span>
          </div>
          <div class="conflict-list" id="conflictList" style="max-height:500px"></div>
        </div>
        <div class="panel" style="margin-top:12px">
          <div class="panel-header">
            <span class="panel-title">Resolution Strategy</span>
          </div>
          <div style="padding:16px;font-family:var(--font-mono);font-size:12px;line-height:2;color:var(--muted)">
            <div><span class="text-accent">Strategy:</span>  Last-Write-Wins (LWW)</div>
            <div><span class="text-accent">Criteria:</span>  Highest version number wins</div>
            <div><span class="text-accent">Fallback:</span>  Node ID lexicographic order on tie</div>
            <div><span class="text-accent">Vector Clocks:</span>  Lamport timestamps per node</div>
            <div><span class="text-accent">CAP theorem:</span>  AP system — prefers Availability + Partition Tolerance</div>
          </div>
        </div>
      </div>
    `,


    // ── LIVE CHAT ─────────────────────────────────────────────────
    chat: () => `
      <div class="animate-in">
        <div class="page-header" style="margin-bottom:12px">
          <div>
            <div class="page-title">&#x1F4AC; Live Chat</div>
            <div class="page-sub">Real-Time Message Sync Across Browser Tabs</div>
          </div>
          <div style="display:flex;align-items:center;gap:12px">
            <div style="font-family:var(--font-mono);font-size:11px;color:var(--muted)">
              YOUR NODE: <span id="myNodeLabel" style="color:var(--accent);font-size:13px"></span>
            </div>
            <div style="padding:5px 12px;border:1px solid var(--accent3);color:var(--accent3);font-family:var(--font-mono);font-size:11px;display:flex;align-items:center;gap:6px">
              <span style="width:7px;height:7px;border-radius:50%;background:var(--accent3);box-shadow:0 0 6px var(--accent3);animation:blink 1s infinite;display:inline-block"></span>
              <span id="activeTabCount">1 TAB ONLINE</span>
            </div>
          </div>
        </div>
        <div class="chat-layout">
          <div class="panel chat-window">
            <div class="panel-header">
              <span class="panel-title">&#x1F4AC; Message Stream</span>
              <span class="panel-meta" style="color:var(--accent3)">LIVE &middot; SYNCING ACROSS TABS</span>
            </div>
            <div id="chatMessages">
              <div class="chat-empty">
                <div class="chat-empty-icon">&#x1F4AC;</div>
                <div>Open this project in <strong style="color:var(--accent)">another browser tab</strong></div>
                <div>and start typing &mdash; messages sync instantly!</div>
              </div>
            </div>
            <div id="typingIndicator">
              <div class="typing-dots"><span></span><span></span><span></span></div>
              <span></span>
            </div>
            <div class="chat-input-bar">
              <input class="chat-name-input" id="chatName" placeholder="Your name" maxlength="20" value="User" />
              <textarea class="chat-text-input" id="chatInput" placeholder="Type a message... (Enter to send)" rows="1"></textarea>
              <button class="chat-send-btn" id="chatSendBtn">SEND</button>
            </div>
          </div>
          <div class="chat-sidebar">
            <div class="panel">
              <div class="panel-header">
                <span class="panel-title">&#x25CE; Active Tabs</span>
                <span class="panel-meta">CONNECTED</span>
              </div>
              <div id="activeUsers"><div style="padding:8px;color:var(--muted);font-family:var(--font-mono);font-size:11px">Loading...</div></div>
            </div>
            <div class="panel">
              <div class="panel-header"><span class="panel-title">&#x26A1; How It Works</span></div>
              <div class="chat-info-box">
                <div class="info-row"><span>Protocol</span><span class="info-val">BroadcastChannel</span></div>
                <div class="info-row"><span>Scope</span><span class="info-val">Same Browser</span></div>
                <div class="info-row"><span>Latency</span><span class="info-val">&lt; 5ms</span></div>
                <div class="info-row"><span>Server</span><span class="info-val">None</span></div>
              </div>
            </div>
            <div class="panel">
              <div class="panel-header">
                <span class="panel-title">&#x2B21; Node Map</span>
                <span class="panel-meta" id="topoMeta">MESH</span>
              </div>
              <div class="topo-wrap" style="height:160px"><canvas id="topoCanvas"></canvas></div>
            </div>
            <div class="panel">
              <div class="panel-header"><span class="panel-title">&#x25C8; Stats</span></div>
              <div class="chat-info-box">
                <div class="info-row"><span>Messages</span><span class="info-val" id="statMsgCount">0</span></div>
                <div class="info-row"><span>My Node</span><span class="info-val" id="statMyNode">-</span></div>
                <div class="info-row"><span>Tabs</span><span class="info-val" id="statTabs">1</span></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `,

  };

  // ── Navigation ───────────────────────────────────────────────

  function navigate(pageId) {
    if (!pages[pageId]) return;
    _currentPage = pageId;

    // Update nav active state
    document.querySelectorAll('.nav-item').forEach(el => {
      el.classList.toggle('active', el.dataset.page === pageId);
    });

    // Render page
    const main = document.getElementById('mainContent');
    main.innerHTML = pages[pageId]();

    // Page-specific init
    _afterRender(pageId);
  }

  function _afterRender(pageId) {
    // Topology canvas
    const topoCanvas = document.getElementById('topoCanvas');
    if (topoCanvas) {
      Topology.init(topoCanvas);
      Topology.layout();
    }

    // Throughput chart
    const chartCanvas = document.getElementById('throughputChart');
    if (chartCanvas) UI.initChart(chartCanvas);

    // Query lab
    const btnQuery = document.getElementById('btnRunQuery');
    if (btnQuery) {
      btnQuery.addEventListener('click', _runQuery);
      document.getElementById('queryInput').addEventListener('keydown', e => {
        if (e.key === 'Enter') _runQuery();
      });
    }

    // Live chat wiring
    if (pageId === 'chat') {
      _initChatPage();
    }

    // Initial render
    UI.update();
  }

  function _initChatPage() {
    // Show my node label
    const nodeLabel = document.getElementById('myNodeLabel');
    if (nodeLabel) nodeLabel.textContent = LiveChat.getMyNodeId();
    const statNode = document.getElementById('statMyNode');
    if (statNode) statNode.textContent = LiveChat.getMyNodeId();

    // Render existing messages
    LiveChat.renderAll();

    // Send button
    const sendBtn = document.getElementById('chatSendBtn');
    const input   = document.getElementById('chatInput');
    const nameEl  = document.getElementById('chatName');

    function doSend() {
      const text = input.value.trim();
      if (!text) return;
      LiveChat.send(text, nameEl.value.trim() || 'Anonymous');
      input.value = '';
      input.style.height = 'auto';
      // Update stats
      const sc = document.getElementById('statMsgCount');
      if (sc && AppState.chat) sc.textContent = AppState.chat.messages.length;
    }

    if (sendBtn) sendBtn.addEventListener('click', doSend);

    if (input) {
      // Auto-resize textarea
      input.addEventListener('input', () => {
        LiveChat.onTyping(nameEl ? nameEl.value : 'User');
        input.style.height = 'auto';
        input.style.height = Math.min(input.scrollHeight, 120) + 'px';
        // Update stats
        const sc = document.getElementById('statMsgCount');
        if (sc && AppState.chat) sc.textContent = AppState.chat.messages.length;
      });

      input.addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          doSend();
        }
      });
    }

    // Poll to update stats and active users every second
    if (!window._chatPollInterval) {
      window._chatPollInterval = setInterval(() => {
        if (document.getElementById('chatMessages')) {
          const sc = document.getElementById('statMsgCount');
          const st = document.getElementById('statTabs');
          if (AppState.chat) {
            if (sc) sc.textContent = AppState.chat.messages.length;
            if (st) st.textContent = Object.keys(AppState.chat.activeTabs || {}).length + 1;
          }
        } else {
          clearInterval(window._chatPollInterval);
          window._chatPollInterval = null;
        }
      }, 1000);
    }
  }

  function _runQuery() {
    const input  = document.getElementById('queryInput');
    const output = document.getElementById('queryOutput');
    if (!input || !output) return;
    output.textContent = DB.query(input.value);
  }

  // ── Bootstrap ────────────────────────────────────────────────

  function init() {
    document.querySelectorAll('.nav-item').forEach(el => {
      el.addEventListener('click', () => navigate(el.dataset.page));
    });
    navigate('dashboard');
  }

  return { init, navigate };

})();
