/* ============================================================
   js/db.js  –  Database query and mutation layer
                Implements KV store with versioning + LWW conflict resolution
   ============================================================ */

const DB = (() => {

  // ── Internal helpers ────────────────────────────────────────

  function flashTableRow(key) {
    const row = document.querySelector(`[data-db-key="${key}"]`);
    if (!row) return;
    row.classList.remove('row-flash');
    void row.offsetWidth;
    row.classList.add('row-flash');
    setTimeout(() => row.classList.remove('row-flash'), 400);
  }

  // ── Public API ───────────────────────────────────────────────

  /**
   * Write a key-value pair from a given node.
   * Uses Last-Write-Wins (LWW): higher version wins.
   * Returns true on success, false if conflict (stale write).
   */
  function write(key, value, nodeId, version) {
    const existing = AppState.database[key];

    if (existing && existing.version > version) {
      // ── CONFLICT: incoming version is stale ──────────────
      AppState.totalConflicts++;
      AppState.conflicts.unshift({
        key, node1: nodeId, node2: existing.node,
        val1: value, val2: existing.value,
        incomingVer: version, storedVer: existing.version,
        ts: Date.now(),
      });
      if (AppState.conflicts.length > 30) AppState.conflicts.pop();

      UI.log(nodeId, 'CONFLICT',
        `${key} stale v${version} < v${existing.version} → discarded (LWW)`);
      UI.toast(`Conflict on ${key}: ${nodeId} vs ${existing.node}`, 'warn');
      return false;
    }

    const isNew = !existing;
    AppState.database[key] = { value, version, node: nodeId, ts: Date.now() };
    AppState.totalWrites++;

    if (isNew) {
      UI.log(nodeId, 'WRITE', `INSERT ${key} = "${value}"  v${version}`);
    } else {
      UI.log(nodeId, 'WRITE', `UPDATE ${key} = "${value}"  v${version}`);
    }
    flashTableRow(key);
    return true;
  }

  /**
   * Read a key from the store on behalf of a node.
   */
  function read(key, nodeId) {
    const rec = AppState.database[key];
    AppState.totalReads++;
    if (rec) {
      UI.log(nodeId, 'READ', `GET ${key} → "${rec.value}"  v${rec.version}`);
      return { ...rec };
    }
    UI.log(nodeId, 'READ', `GET ${key} → (not found)`);
    return null;
  }

  /**
   * Delete a key on behalf of a node.
   */
  function del(key, nodeId) {
    if (AppState.database[key]) {
      delete AppState.database[key];
      UI.log(nodeId, 'DELETE', `DEL ${key}`);
      return true;
    }
    return false;
  }

  /**
   * Execute a user-submitted query string.
   * Supported syntax:
   *   SELECT * FROM events [WHERE node='N1'] [WHERE type='WRITE']
   *   SELECT * FROM db
   *   SELECT * FROM nodes
   *   SELECT COUNT(*)
   *   GET <key>
   *   SHOW CONFLICTS
   *   SHOW CLOCKS
   */
  function query(raw) {
    const q = raw.trim().toUpperCase();

    if (q.startsWith('SELECT * FROM EVENTS')) {
      const nodeMatch = raw.match(/node\s*=\s*['"]([^'"]+)['"]/i);
      const typeMatch = raw.match(/type\s*=\s*['"]([^'"]+)['"]/i);
      let rows = [...AppState.events];
      if (nodeMatch) rows = rows.filter(e => e.node.toUpperCase() === nodeMatch[1].toUpperCase());
      if (typeMatch) rows = rows.filter(e => e.type.toUpperCase() === typeMatch[1].toUpperCase());
      if (!rows.length) return '-- No records match that filter --';
      return rows.slice(0, 20)
        .map(e => `[${e.ts}]  ${e.node.padEnd(4)}  ${e.type.padEnd(10)}  ${e.msg}`)
        .join('\n');
    }

    if (q.startsWith('SELECT * FROM DB') || q.startsWith('SELECT * FROM DATABASE')) {
      const keys = Object.keys(AppState.database);
      if (!keys.length) return '-- Database is empty --';
      return ['KEY                  VALUE          VER   NODE   AGE',
              '─'.repeat(55),
        ...keys.map(k => {
          const r = AppState.database[k];
          const age = Math.floor((Date.now() - r.ts) / 1000) + 's';
          return `${k.padEnd(21)} ${String(r.value).padEnd(15)} ${String(r.version).padEnd(6)} ${r.node.padEnd(7)} ${age}`;
        })].join('\n');
    }

    if (q.startsWith('SELECT * FROM NODES')) {
      return ['ID    STATUS    VC    LAT    WRITES  READS  SYNCS',
              '─'.repeat(50),
        ...AppState.nodes.map(n =>
          `${n.id.padEnd(6)} ${n.status.padEnd(10)} ${String(n.vectorClock).padEnd(6)} ${(n.latency+'ms').padEnd(7)} ${String(n.writes).padEnd(8)} ${String(n.reads).padEnd(7)} ${n.syncs}`
        )].join('\n');
    }

    if (q.startsWith('SELECT COUNT')) {
      return [
        `total_events:    ${AppState.totalEvents}`,
        `total_writes:    ${AppState.totalWrites}`,
        `total_reads:     ${AppState.totalReads}`,
        `total_conflicts: ${AppState.totalConflicts}`,
        `db_records:      ${Object.keys(AppState.database).length}`,
        `nodes_online:    ${AppState.nodes.filter(n => n.status !== 'offline').length}/${AppState.nodes.length}`,
      ].join('\n');
    }

    if (q.startsWith('GET ')) {
      const key = raw.slice(4).trim();
      const r   = AppState.database[key];
      if (!r) return `-- Key not found: ${key} --`;
      return [
        `KEY:     ${key}`,
        `VALUE:   ${r.value}`,
        `VERSION: ${r.version}`,
        `NODE:    ${r.node}`,
        `AGE:     ${Math.floor((Date.now() - r.ts) / 1000)}s`,
      ].join('\n');
    }

    if (q.startsWith('SHOW CONFLICTS')) {
      if (!AppState.conflicts.length) return '-- No conflicts recorded --';
      return ['KEY                  NODE1   NODE2   IN_VER  STORED_VER  STRATEGY',
              '─'.repeat(65),
        ...AppState.conflicts.map(c =>
          `${c.key.padEnd(21)} ${c.node1.padEnd(8)} ${c.node2.padEnd(8)} ${String(c.incomingVer).padEnd(8)} ${String(c.storedVer).padEnd(12)} LWW`
        )].join('\n');
    }

    if (q.startsWith('SHOW CLOCKS')) {
      return AppState.nodes.map(n => `${n.id}: ${n.vectorClock}`).join('\n');
    }

    if (q === 'HELP') {
      return [
        'Available queries:',
        '  SELECT * FROM events',
        '  SELECT * FROM events WHERE node=\'N1\'',
        '  SELECT * FROM events WHERE type=\'WRITE\'',
        '  SELECT * FROM db',
        '  SELECT * FROM nodes',
        '  SELECT COUNT(*)',
        '  GET <key>           e.g. GET user:alice',
        '  SHOW conflicts',
        '  SHOW clocks',
        '  HELP',
      ].join('\n');
    }

    return `-- Unknown query. Type HELP for available commands --`;
  }

  return { write, read, del, query };

})();
