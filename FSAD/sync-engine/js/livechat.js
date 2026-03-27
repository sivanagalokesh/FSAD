/* ============================================================
   js/livechat.js  –  Real-Time Live Chat & Message Sync
   
   Uses BroadcastChannel API to sync messages across all open
   browser tabs/windows in real time.
   
   Flow:
     User types → sends → stored in AppState.messages
     → BroadcastChannel broadcasts to ALL other open tabs
     → Message "propagates" through nodes with animation
     → Every tab's chat panel updates instantly
   ============================================================ */

const LiveChat = (() => {

  const CHANNEL_NAME = 'sync-engine-chat';
  let _channel       = null;
  let _myTabId       = null;
  let _myNodeId      = null;
  let _typing        = false;
  let _typingTimer   = null;
  let _typingUsers   = {};   // tabId → { name, nodeId, timer }

  // ── Init ────────────────────────────────────────────────────

  function init() {
    // Assign this tab a unique ID and a "home node"
    _myTabId  = `tab_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    _myNodeId = AppState.nodes[Math.floor(Math.random() * AppState.nodes.length)].id;

    // Open broadcast channel
    _channel = new BroadcastChannel(CHANNEL_NAME);
    _channel.onmessage = _onReceive;

    // Announce this tab joined
    _broadcast({ type: 'JOIN', tabId: _myTabId, nodeId: _myNodeId });

    // On tab close — announce leave
    window.addEventListener('beforeunload', () => {
      _broadcast({ type: 'LEAVE', tabId: _myTabId, nodeId: _myNodeId });
      _channel.close();
    });

    // Store init info
    AppState.chat = AppState.chat || {
      messages: [],
      activeTabs: {},
      myTabId: _myTabId,
      myNodeId: _myNodeId,
      unread: 0,
    };
    AppState.chat.myTabId  = _myTabId;
    AppState.chat.myNodeId = _myNodeId;

    console.log(`[LiveChat] Initialised — Tab: ${_myTabId}  Node: ${_myNodeId}`);
  }

  // ── Send a message ───────────────────────────────────────────

  function send(text, senderName) {
    text = text.trim();
    if (!text) return;

    const msg = {
      id:         `msg_${Date.now()}_${Math.random().toString(36).slice(2,6)}`,
      text,
      sender:     senderName || 'Anonymous',
      tabId:      _myTabId,
      nodeId:     _myNodeId,
      ts:         Date.now(),
      syncedTo:   [_myNodeId],    // tracks which nodes have this message
      isMine:     true,
    };

    // Store locally
    _storeMessage(msg);

    // Broadcast to other tabs
    _broadcast({ type: 'MESSAGE', msg });

    // Animate propagation through nodes
    _propagateThroughNodes(msg);

    // Log to engine event stream
    UI.log(_myNodeId, 'WRITE', `CHAT MSG from ${senderName}: "${text.slice(0, 40)}${text.length > 40 ? '…' : ''}"`);

    // Stop typing indicator
    _sendTyping(false);

    return msg;
  }

  // ── Typing indicator ────────────────────────────────────────

  function onTyping(senderName) {
    if (!_typing) {
      _typing = true;
      _broadcast({ type: 'TYPING', tabId: _myTabId, nodeId: _myNodeId, sender: senderName, isTyping: true });
    }
    clearTimeout(_typingTimer);
    _typingTimer = setTimeout(() => _sendTyping(false, senderName), 2000);
  }

  function _sendTyping(isTyping, senderName) {
    _typing = isTyping;
    _broadcast({ type: 'TYPING', tabId: _myTabId, nodeId: _myNodeId, sender: senderName || '', isTyping });
  }

  // ── Receive from other tabs ──────────────────────────────────

  function _onReceive(event) {
    const data = event.data;
    if (!data || !data.type) return;

    switch (data.type) {

      case 'JOIN':
        AppState.chat.activeTabs[data.tabId] = { nodeId: data.nodeId, joinedAt: Date.now() };
        _renderActiveUsers();
        _broadcast({ type: 'ACK', tabId: _myTabId, nodeId: _myNodeId }); // let them know we exist
        UI.toast(`New tab connected on node ${data.nodeId}`, 'info');
        break;

      case 'ACK':
        AppState.chat.activeTabs[data.tabId] = { nodeId: data.nodeId, joinedAt: Date.now() };
        _renderActiveUsers();
        break;

      case 'LEAVE':
        delete AppState.chat.activeTabs[data.tabId];
        delete _typingUsers[data.tabId];
        _renderActiveUsers();
        _renderTyping();
        break;

      case 'MESSAGE':
        // Mark as not mine
        const incoming = { ...data.msg, isMine: false };
        _storeMessage(incoming);
        _propagateThroughNodes(incoming);
        UI.log(incoming.nodeId, 'SYNC', `CHAT SYNC: "${incoming.text.slice(0,40)}" from ${incoming.sender}`);

        // Increment unread if chat page not open
        if (!document.getElementById('chatMessages')) {
          AppState.chat.unread++;
          _updateNavBadge();
        }
        break;

      case 'TYPING':
        if (data.isTyping) {
          _typingUsers[data.tabId] = { sender: data.sender, nodeId: data.nodeId };
        } else {
          delete _typingUsers[data.tabId];
        }
        _renderTyping();
        break;
    }
  }

  // ── Propagate message through nodes with animation ───────────

  function _propagateThroughNodes(msg) {
    const originNode = AppState.nodes.find(n => n.id === msg.nodeId);
    if (!originNode) return;

    const peers = AppState.nodes.filter(n => n.id !== msg.nodeId && n.status !== 'offline');
    peers.forEach((peer, idx) => {
      setTimeout(() => {
        // Animate packet
        Topology.spawnPacket(msg.nodeId, peer.id, originNode.color);

        // Update sync list
        if (!msg.syncedTo.includes(peer.id)) msg.syncedTo.push(peer.id);

        // Flash peer node
        peer.status = 'syncing';
        setTimeout(() => { if (peer.status === 'syncing') peer.status = 'online'; }, 400);

        // Update sync badges in chat UI
        _updateMsgSyncBadge(msg.id, msg.syncedTo);

      }, (idx + 1) * (100 + Math.random() * 150));
    });
  }

  // ── Store message ────────────────────────────────────────────

  function _storeMessage(msg) {
    if (!AppState.chat) return;
    // Deduplicate
    if (AppState.chat.messages.find(m => m.id === msg.id)) return;
    AppState.chat.messages.push(msg);
    if (AppState.chat.messages.length > 200) AppState.chat.messages.shift();
    _renderMessages();
  }

  // ── Broadcast helper ─────────────────────────────────────────

  function _broadcast(data) {
    if (_channel) _channel.postMessage(data);
  }

  // ── Render helpers ───────────────────────────────────────────

  function _renderMessages() {
    const container = document.getElementById('chatMessages');
    if (!container) return;

    const msgs = AppState.chat.messages;
    if (!msgs.length) {
      container.innerHTML = `
        <div class="chat-empty">
          <div class="chat-empty-icon">💬</div>
          <div>No messages yet. Open this project in another tab and start chatting!</div>
        </div>`;
      return;
    }

    container.innerHTML = msgs.map(m => {
      const time  = new Date(m.ts).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit', second:'2-digit' });
      const mine  = m.tabId === _myTabId;
      const color = _nodeColor(m.nodeId);
      const syncCount = m.syncedTo ? m.syncedTo.length : 1;
      const totalNodes = AppState.nodes.length;

      return `
        <div class="chat-msg ${mine ? 'chat-msg-mine' : 'chat-msg-theirs'}" id="msg-${m.id}">
          <div class="chat-bubble" style="${mine ? `border-color:${color}` : `border-color:${color}`}">
            <div class="chat-meta">
              <span class="chat-sender" style="color:${color}">${m.sender}</span>
              <span class="chat-node" style="color:${color}">@${m.nodeId}</span>
              <span class="chat-time">${time}</span>
            </div>
            <div class="chat-text">${_escapeHtml(m.text)}</div>
            <div class="chat-sync-bar">
              <span class="sync-icon">⟳</span>
              <div class="sync-nodes" id="sync-${m.id}">
                ${AppState.nodes.map(n => `
                  <span class="sync-node-dot ${m.syncedTo && m.syncedTo.includes(n.id) ? 'synced' : 'pending'}"
                        style="${m.syncedTo && m.syncedTo.includes(n.id) ? `background:${_nodeColor(n.id)};box-shadow:0 0 5px ${_nodeColor(n.id)}` : ''}"
                        title="${n.id}">
                  </span>`).join('')}
              </div>
              <span class="sync-label">${syncCount}/${totalNodes} nodes</span>
            </div>
          </div>
        </div>`;
    }).join('');

    // Auto scroll to bottom
    container.scrollTop = container.scrollHeight;

    // Reset unread
    AppState.chat.unread = 0;
    _updateNavBadge();
  }

  function _updateMsgSyncBadge(msgId, syncedTo) {
    const el = document.getElementById(`sync-${msgId}`);
    if (!el) return;
    AppState.nodes.forEach(n => {
      const dot = el.querySelector(`[title="${n.id}"]`);
      if (!dot) return;
      if (syncedTo.includes(n.id)) {
        dot.classList.remove('pending');
        dot.classList.add('synced');
        const c = _nodeColor(n.id);
        dot.style.background   = c;
        dot.style.boxShadow    = `0 0 5px ${c}`;
      }
    });
    // Update label
    const lbl = el.parentElement.querySelector('.sync-label');
    if (lbl) lbl.textContent = `${syncedTo.length}/${AppState.nodes.length} nodes`;
  }

  function _renderActiveUsers() {
    const el = document.getElementById('activeUsers');
    if (!el) return;
    const tabs = Object.entries(AppState.chat.activeTabs || {});
    el.innerHTML = `
      <div class="au-me">
        <span class="au-dot" style="background:${_nodeColor(_myNodeId)};box-shadow:0 0 5px ${_nodeColor(_myNodeId)}"></span>
        <span style="color:${_nodeColor(_myNodeId)}">You @${_myNodeId}</span>
        <span class="au-tag">THIS TAB</span>
      </div>
      ${tabs.map(([id, t]) => `
        <div class="au-user">
          <span class="au-dot" style="background:${_nodeColor(t.nodeId)};box-shadow:0 0 5px ${_nodeColor(t.nodeId)}"></span>
          <span style="color:${_nodeColor(t.nodeId)}">Tab @${t.nodeId}</span>
          <span class="au-tag au-tag-online">ONLINE</span>
        </div>`).join('')}
    `;
    // Update count
    const countEl = document.getElementById('activeTabCount');
    if (countEl) countEl.textContent = `${tabs.length + 1} TAB${tabs.length !== 0 ? 'S' : ''} ONLINE`;
  }

  function _renderTyping() {
    const el = document.getElementById('typingIndicator');
    if (!el) return;
    const users = Object.values(_typingUsers);
    if (!users.length) { el.style.display = 'none'; return; }
    el.style.display = 'flex';
    el.innerHTML = `
      <div class="typing-dots"><span></span><span></span><span></span></div>
      <span>${users.map(u => u.sender || `@${u.nodeId}`).join(', ')} ${users.length > 1 ? 'are' : 'is'} typing…</span>
    `;
  }

  function _updateNavBadge() {
    const badge = document.getElementById('chatNavBadge');
    if (!badge) return;
    const count = AppState.chat.unread || 0;
    badge.textContent  = count > 0 ? count : '';
    badge.style.display = count > 0 ? 'inline-block' : 'none';
  }

  // ── Helpers ──────────────────────────────────────────────────

  function _nodeColor(nodeId) {
    const n = AppState.nodes.find(n => n.id === nodeId);
    return n ? n.color : '#00e5ff';
  }

  function _escapeHtml(str) {
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
              .replace(/"/g,'&quot;').replace(/'/g,'&#039;');
  }

  function getMyNodeId()  { return _myNodeId; }
  function getMyTabId()   { return _myTabId; }
  function renderAll()    { _renderMessages(); _renderActiveUsers(); _renderTyping(); }

  return { init, send, onTyping, renderAll, getMyNodeId, getMyTabId };

})();
