/* ============================================================
   js/state.js  –  Shared reactive application state
   ============================================================ */

const AppState = (() => {

  const NODE_COLORS = ['#00e5ff','#ff6b35','#39ff14','#bf5af2','#ffcc00','#ff3a3a','#00bcd4'];

  const DATA_KEYS = [
    'user:alice','user:bob','user:carol','user:dave',
    'config:theme','config:lang','config:timezone',
    'session:101','session:102','session:103',
    'order:500','order:501','order:502',
    'product:X1','product:X2',
  ];

  function createNode(num) {
    return {
      id:           `N${num}`,
      color:        NODE_COLORS[(num - 1) % NODE_COLORS.length],
      status:       'online',   // online | syncing | offline | conflict
      writes:       0,
      reads:        0,
      syncs:        0,
      deletes:      0,
      syncPct:      100,
      latency:      Math.floor(Math.random() * 40) + 5,
      vectorClock:  0,
      pendingEvents: 0,
      x: 0, y: 0,   // canvas position — set by topology.js
    };
  }

  // ── Core state object ──────────────────────────────────────
  const state = {
    running:       true,
    speed:         4,
    tick:          0,
    startTime:     Date.now(),

    nodes:         [],         // Array<Node>
    database:      {},         // { [key]: { value, version, node, ts } }
    events:        [],         // Array<LogEntry>
    conflicts:     [],         // Array<Conflict>
    packets:       [],         // canvas animation packets

    totalEvents:    0,
    totalConflicts: 0,
    totalWrites:    0,
    totalReads:     0,

    partition:      false,
    partitionTimer: 0,

    currentEPS:         0,
    eventsSinceLastSec: 0,
    lastSecTime:        Date.now(),
    throughputHistory:  [],
    MAX_THROUGHPUT_HIST: 40,

    DATA_KEYS,
    NODE_COLORS,
    createNode,
  };

  // Initialise with 5 nodes
  for (let i = 1; i <= 5; i++) state.nodes.push(createNode(i));

  return state;

})();
