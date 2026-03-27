/* ============================================================
   js/topology.js  –  Canvas network topology visualisation
                      Draws nodes, edges, and animated packets
   ============================================================ */

const Topology = (() => {

  let _canvas = null;
  let _ctx    = null;
  let _raf    = null;

  // ── Initialise ───────────────────────────────────────────────

  function init(canvasEl) {
    _canvas = canvasEl;
    _ctx    = _canvas.getContext('2d');
    _resize();
    window.addEventListener('resize', _resize);
    _loop();
  }

  function _resize() {
    if (!_canvas) return;
    const wrap = _canvas.parentElement;
    _canvas.width  = wrap.clientWidth;
    _canvas.height = wrap.clientHeight;
    layout();
  }

  // ── Position nodes in a circle ──────────────────────────────

  function layout() {
    if (!_canvas) return;
    const cx = _canvas.width  / 2;
    const cy = _canvas.height / 2;
    const r  = Math.min(cx, cy) - 55;
    AppState.nodes.forEach((n, i) => {
      const angle = (i / AppState.nodes.length) * Math.PI * 2 - Math.PI / 2;
      n.x = cx + r * Math.cos(angle);
      n.y = cy + r * Math.sin(angle);
    });
  }

  // ── Animated packets ────────────────────────────────────────

  function spawnPacket(fromId, toId, color) {
    const p = { fromId, toId, color, progress: 0, speed: 0.07 + Math.random() * 0.04 };
    AppState.packets.push(p);
  }

  function _tickPackets() {
    AppState.packets = AppState.packets.filter(p => {
      p.progress += p.speed;
      return p.progress < 1;
    });
  }

  // ── Draw ────────────────────────────────────────────────────

  function _draw() {
    const w = _canvas.width, h = _canvas.height;
    _ctx.clearRect(0, 0, w, h);

    _drawEdges();
    _drawPackets();
    _drawNodes();
  }

  function _drawEdges() {
    const nodes = AppState.nodes;
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i], b = nodes[j];
        const partitioned = AppState.partition && (a.id === 'N1' || b.id === 'N1');

        _ctx.beginPath();
        _ctx.moveTo(a.x, a.y);
        _ctx.lineTo(b.x, b.y);
        _ctx.strokeStyle = partitioned ? 'rgba(255,58,58,0.25)' : 'rgba(13,34,53,0.9)';
        _ctx.lineWidth   = 1;
        if (partitioned) _ctx.setLineDash([4, 5]);
        _ctx.stroke();
        _ctx.setLineDash([]);
      }
    }
  }

  function _drawPackets() {
    AppState.packets.forEach(p => {
      const from = AppState.nodes.find(n => n.id === p.fromId);
      const to   = AppState.nodes.find(n => n.id === p.toId);
      if (!from || !to) return;

      const px = from.x + (to.x - from.x) * p.progress;
      const py = from.y + (to.y - from.y) * p.progress;

      _ctx.save();
      _ctx.beginPath();
      _ctx.arc(px, py, 4, 0, Math.PI * 2);
      _ctx.fillStyle   = p.color;
      _ctx.shadowColor = p.color;
      _ctx.shadowBlur  = 12;
      _ctx.fill();
      _ctx.restore();
    });
  }

  function _drawNodes() {
    const t = Date.now();

    AppState.nodes.forEach(n => {
      const offline  = n.status === 'offline';
      const color    = offline          ? '#3a6070'
                     : n.status === 'conflict' ? '#ff3a3a'
                     : n.status === 'syncing'  ? '#00e5ff'
                     : n.color;

      // Outer glow
      if (!offline) {
        const pulse = 0.12 + 0.08 * Math.sin(t / 700 + n.x);
        _ctx.save();
        _ctx.beginPath();
        _ctx.arc(n.x, n.y, 24, 0, Math.PI * 2);
        _ctx.strokeStyle = color;
        _ctx.globalAlpha = pulse;
        _ctx.lineWidth   = 9;
        _ctx.stroke();
        _ctx.restore();
      }

      // Node fill
      _ctx.beginPath();
      _ctx.arc(n.x, n.y, 18, 0, Math.PI * 2);
      _ctx.fillStyle   = '#080e15';
      _ctx.fill();
      _ctx.strokeStyle = color;
      _ctx.lineWidth   = 2;
      _ctx.stroke();

      // Label
      _ctx.fillStyle     = color;
      _ctx.font          = 'bold 12px Rajdhani, sans-serif';
      _ctx.textAlign     = 'center';
      _ctx.textBaseline  = 'middle';
      _ctx.fillText(n.id, n.x, n.y);

      // Status below
      _ctx.fillStyle    = '#3a6070';
      _ctx.font         = '9px Share Tech Mono, monospace';
      _ctx.fillText(n.status.toUpperCase(), n.x, n.y + 30);

      // Latency above
      if (!offline) {
        _ctx.fillStyle = '#ff6b35';
        _ctx.font      = '9px Share Tech Mono, monospace';
        _ctx.fillText(`${n.latency}ms`, n.x, n.y - 30);
      }
    });
  }

  // ── Animation loop ──────────────────────────────────────────

  function _loop() {
    _tickPackets();
    _draw();
    _raf = requestAnimationFrame(_loop);
  }

  function destroy() {
    cancelAnimationFrame(_raf);
    window.removeEventListener('resize', _resize);
  }

  return { init, layout, spawnPacket, destroy };

})();
