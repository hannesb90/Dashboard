// HA WebSocket connection layer for standalone PWA
class HAConnection {
  constructor() {
    this._ws          = null;
    this._msgId       = 1;
    this._pending     = Object.create(null);
    this._states      = Object.create(null);
    this._card        = null;
    this._hassUrl     = '';
    this._token       = '';
    this._retryDelay  = 2000;
    this._destroyed   = false;
    this._online      = false;

    this.onAuthError  = null;
    this.onOffline    = null;
    this.onOnline     = null;
  }

  connect(hassUrl, token) {
    this._hassUrl    = hassUrl.replace(/\/$/, '');
    this._token      = token;
    this._destroyed  = false;
    this._retryDelay = 2000;
    this._open();
  }

  destroy() {
    this._destroyed = true;
    if (this._ws) {
      this._ws.onclose = null;
      this._ws.close();
      this._ws = null;
    }
  }

  setCard(card) {
    this._card = card;
    // Push cached states immediately so offline display works on load
    const raw = localStorage.getItem('ha_states_cache');
    if (raw) {
      try {
        this._states = JSON.parse(raw);
        this._pushHass();
      } catch {}
    }
  }

  _open() {
    if (this._destroyed) return;
    const wsUrl = this._hassUrl
      .replace(/^https:\/\//i, 'wss://')
      .replace(/^http:\/\//i,  'ws://')
      + '/api/websocket';

    try {
      this._ws = new WebSocket(wsUrl);
    } catch {
      this._scheduleReconnect();
      return;
    }

    this._ws.onmessage = e => { try { this._onMsg(JSON.parse(e.data)); } catch {} };
    this._ws.onerror   = ()  => {};
    this._ws.onclose   = ()  => { this._setOnline(false); this._scheduleReconnect(); };
  }

  _scheduleReconnect() {
    if (this._destroyed) return;
    setTimeout(() => this._open(), this._retryDelay);
    this._retryDelay = Math.min(this._retryDelay * 2, 30_000);
  }

  _onMsg(msg) {
    const { type, id } = msg;

    if (type === 'auth_required') {
      this._send({ type: 'auth', access_token: this._token });

    } else if (type === 'auth_ok') {
      this._retryDelay = 2000;
      this._onConnected();

    } else if (type === 'auth_invalid') {
      this.onAuthError?.();

    } else if (type === 'result') {
      const p = this._pending[id];
      if (p) {
        delete this._pending[id];
        msg.success ? p.resolve(msg.result) : p.reject(new Error(msg.error?.message ?? 'HA error'));
      }

    } else if (type === 'event') {
      this._onEvent(msg.event);
    }
  }

  async _onConnected() {
    try {
      const states = await this._call({ type: 'get_states' });
      this._states = Object.create(null);
      for (const s of states) this._states[s.entity_id] = s;
      this._persistStates();
    } catch {}

    // Subscribe to all state changes
    const subId = this._nextId();
    this._send({ id: subId, type: 'subscribe_events', event_type: 'state_changed' });

    this._setOnline(true);
    this._pushHass();
  }

  _onEvent(event) {
    if (event.event_type !== 'state_changed') return;
    const { entity_id, new_state } = event.data;
    if (new_state) this._states[entity_id] = new_state;
    else           delete this._states[entity_id];
    this._persistStates();
    this._pushHass();
  }

  _pushHass() {
    if (this._card) this._card.hass = this._buildHass();
  }

  _buildHass() {
    const self = this;
    return {
      states: self._states,
      auth: {
        data: {
          hassUrl:      self._hassUrl,
          access_token: self._token,
        }
      },
      callService(domain, service, serviceData = {}) {
        return self._call({ type: 'call_service', domain, service, service_data: serviceData });
      },
      callWS(msg) {
        return self._call(msg);
      },
      connection: {
        subscribeMessage(callback, msg) {
          return self._call(msg).then(r => { callback(r); return () => {}; });
        }
      }
    };
  }

  _call(msg) {
    const id = this._nextId();
    return new Promise((resolve, reject) => {
      this._pending[id] = { resolve, reject };
      this._send({ ...msg, id });
    });
  }

  _send(msg) {
    if (this._ws?.readyState === WebSocket.OPEN) {
      this._ws.send(JSON.stringify(msg));
    }
  }

  _nextId() { return this._msgId++; }

  _persistStates() {
    try { localStorage.setItem('ha_states_cache', JSON.stringify(this._states)); } catch {}
  }

  _setOnline(online) {
    if (this._online === online) return;
    this._online = online;
    online ? this.onOnline?.() : this.onOffline?.();
  }
}
