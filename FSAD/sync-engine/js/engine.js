/* ============================================================
   js/engine.js  –  Simulation / event engine
                    Drives random distributed events across nodes
   ============================================================ */

const Engine = (() => {

  const EVENT_TYPES = ['WRITE', 'READ', 'SYNC', 'DELETE'];
  let _interval = null;

  // ── Helpers ─────────────────────────────────────────────────

  function onlineNodes() {
    return AppState.nodes.filter(n => n.status !== 'offline');
  }

  function randomFrom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  // ── Core tick ────────────────────────────────────────────────

  function tick() {
    if (!AppState.running) return;

    AppState.tick++;
    AppState.totalEvents++;
    AppState.eventsSinceLastSec++;

    const online = onlineNodes();
    if (!online.length) return;

    const node = randomFrom(online);
    const type = randomFrom(EVENT_TYPES);
    const key  = randomFrom(AppState.DATA_KEYS);
    const val  = `val_${randomInt(100, 999)}`;
    const ver  = (AppState.database[key] ? AppState.database[key].version : 0)
                 + randomInt(0, 2);

    // Advance vector clock
    node.vectorClock++;

    switch (type) {
      case 'WRITE':
        _handleWrite(node, key, val, ver);
        break;
      case 'READ':
        _handleRead(node, key);
        break;
      case 'SYNC':
        _handleSync(node);
        break;
      case 'DELETE':
        _handleDelete(node, key);
        break;
    }

    // Latency drift
    node.latency = Math.max(2, node.latency + randomInt(-3, 3));
    // Sync progress
    node.syncPct = Math.min(100, Math.max(55, node.syncPct + randomInt(-2, 3)));

    // Partition countdown
    if (AppState.partition) {
      AppState.partitionTimer--;
      if (AppState.partitionTimer <= 0) {
        _healPartition();
      }
    }

    // EPS counter
    const now = Date.now();
    if (now - AppState.lastSecTime >= 1000) {
      AppState.currentEPS         = AppState.eventsSinceLastSec;
      AppState.eventsSinceLastSec = 0;
      AppState.lastSecTime        = now;
      AppState.throughputHistory.push(AppState.currentEPS);
      if (AppState.throughputHistory.length > AppState.MAX_THROUGHPUT_HIST) {
        AppState.throughputHistory.shift();
      }
    }

    // Trigger UI refresh
    UI.update();
  }

  // ── Event handlers ──────────────────────────────────────────

  function _handleWrite(node, key, val, ver) {
    node.status = 'syncing';
    const ok = DB.write(key, val, node.id, ver);
    setTimeout(() => { if (node.status === 'syncing') node.status = 'online'; }, 350);

    if (ok) {
      // Propagate to peers
      AppState.nodes
        .filter(n => n.id !== node.id && n.status !== 'offline')
        .forEach((peer, idx) => {
          const isPartitioned = AppState.partition && (node.id === 'N1' || peer.id === 'N1');
          if (isPartitioned) return;

          setTimeout(() => {
            peer.syncs++;
            peer.status = 'syncing';
            UI.log(peer.id, 'SYNC', `Received ${key}="${val}" from ${node.id}`);
            Topology.spawnPacket(node.id, peer.id, node.color);
            setTimeout(() => { if (peer.status === 'syncing') peer.status = 'online'; }, 300);
          }, (idx + 1) * randomInt(40, 120));
        });
    }
  }

  function _handleRead(node, key) {
    node.reads++;
    DB.read(key, node.id);
  }

  function _handleSync(node) {
    node.syncs++;
    const target = AppState.nodes.find(n => n.id !== node.id && n.status !== 'offline');
    UI.log(node.id, 'SYNC', `Heartbeat  vc=${node.vectorClock}`);
    if (target) Topology.spawnPacket(node.id, target.id, '#bf5af2');
  }

  function _handleDelete(node, key) {
    node.deletes = (node.deletes || 0) + 1;
    DB.del(key, node.id);
  }

  function _healPartition() {
    AppState.partition = false;
    AppState.nodes.forEach(n => { if (n.status === 'offline') n.status = 'online'; });
    UI.toast('Network partition healed — nodes reconnected', 'ok');
    UI.log('SYS', 'SYNC', 'Partition healed — resuming full mesh sync');
  }

  // ── Public controls ─────────────────────────────────────────

  function start() {
    clearInterval(_interval);
    const delay = Math.max(60, 800 / AppState.speed);
    _interval = setInterval(tick, delay);
    AppState.running = true;
  }

  function pause() {
    AppState.running = false;
    clearInterval(_interval);
  }

  function resume() {
    AppState.running = true;
    start();
  }

  function setSpeed(val) {
    AppState.speed = val;
    if (AppState.running) start();
  }

  function addNode() {
    if (AppState.nodes.length >= 7) {
      UI.toast('Maximum of 7 nodes reached', 'warn');
      return;
    }
    const num  = AppState.nodes.length + 1;
    const node = AppState.createNode(num);
    AppState.nodes.push(node);
    Topology.layout();
    UI.toast(`Node ${node.id} joined the cluster`, 'ok');
  }

  function triggerPartition() {
    if (AppState.partition) { UI.toast('Partition already active', 'warn'); return; }
    AppState.partition = true;
    AppState.partitionTimer = 40;
    const target = AppState.nodes[0];
    target.status = 'offline';
    UI.log(target.id, 'OFFLINE', 'Network partition — node isolated');
    UI.toast(`Partition: ${target.id} isolated for 40 events`, 'error');
  }

  function clearConflicts() {
    AppState.conflicts     = [];
    AppState.totalConflicts = 0;
    UI.toast('Conflict log cleared', 'info');
  }

  function snapshot() {
    return {
      timestamp:  new Date().toISOString(),
      nodes:      AppState.nodes.length,
      online:     AppState.nodes.filter(n => n.status !== 'offline').length,
      dbRecords:  Object.keys(AppState.database).length,
      totalEvents: AppState.totalEvents,
      conflicts:  AppState.totalConflicts,
      throughput: AppState.currentEPS,
    };
  }

  return { start, pause, resume, setSpeed, addNode, triggerPartition, clearConflicts, snapshot };

})();
