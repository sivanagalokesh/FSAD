/* ============================================================
   js/app.js  –  Application bootstrap & wiring
   ============================================================ */

window.addEventListener('DOMContentLoaded', () => {

  // 1. Boot router (renders dashboard page)
  Router.init();

  // 2. Seed initial DB records so the table isn't empty
  setTimeout(() => {
    AppState.DATA_KEYS.slice(0, 5).forEach((key, i) => {
      const node = AppState.nodes[i % AppState.nodes.length];
      DB.write(key, `init_${i + 1}`, node.id, 1);
    });
    UI.update();
  }, 150);

  // 3. Initialise Live Chat (BroadcastChannel)
  LiveChat.init();

  // 4. Start the simulation engine
  Engine.start();

  // 4. Log startup
  UI.log('SYS', 'SYNC', `Engine initialised · ${AppState.nodes.length} nodes · speed ${AppState.speed}x`);
  UI.toast('Sync Engine started', 'ok');
});
