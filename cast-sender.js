const CAST_APP_ID    = 'BAEFEE39';
const CAST_NAMESPACE = 'urn:x-cast:energy-dashboard';

class CastSender {
  constructor() {
    this._session  = null;
    this._ready    = false;
    this._config   = null;
  }

  // Called once cast-sender.js finishes loading
  init() {
    // SDK may have already fired __onGCastApiAvailable before this script loaded
    if (window.__castApiReady !== undefined) this._apiReady(window.__castApiReady);
  }

  // Called by __onGCastApiAvailable (defined in index.html before SDK loads)
  _apiReady(isAvailable) {
    this._ready = isAvailable;
    if (!isAvailable) return;
    const ctx = cast.framework.CastContext.getInstance();
    ctx.setOptions({
      receiverApplicationId: CAST_APP_ID,
      autoJoinPolicy: chrome.cast.AutoJoinPolicy.ORIGIN_SCOPED,
    });
    ctx.addEventListener(
      cast.framework.CastContextEventType.SESSION_STATE_CHANGED,
      (e) => this._onSessionState(e)
    );
  }

  _onSessionState(event) {
    const S = cast.framework.SessionState;
    switch (event.sessionState) {
      case S.SESSION_STARTED:
      case S.SESSION_RESUMED:
        this._session = cast.framework.CastContext.getInstance().getCurrentSession();
        this._sendInit();
        this._updateBtn(true);
        break;
      case S.SESSION_ENDED:
        this._session = null;
        this._updateBtn(false);
        break;
    }
  }

  _sendInit() {
    if (!this._session || !this._config) return;
    this._session.sendMessage(CAST_NAMESPACE, {
      type: 'INIT',
      hassUrl:      this._config.hassUrl,
      token:        this._config.token,
      entityConfig: this._config.entityConfig,
    }).catch((e) => console.warn('[Cast] sendMessage:', e));
  }

  setConfig(config) {
    this._config = config;
    if (this._session) this._sendInit();
  }

  requestSession() {
    if (!this._ready) {
      alert('Google Cast stöds bara i Chrome-webbläsaren.');
      return;
    }
    cast.framework.CastContext.getInstance()
      .requestSession()
      .catch((e) => { if (e !== chrome.cast.ErrorCode.CANCEL) console.warn('[Cast]', e); });
  }

  endSession() {
    cast.framework.CastContext.getInstance().endCurrentSession(true);
  }

  _updateBtn(active) {
    const card = document.querySelector('energy-dashboard-card');
    const btn  = card?.shadowRoot?.getElementById('cast-btn');
    if (!btn) return;
    btn.style.color = active ? '#4A9EFF' : '';
    btn.title       = active ? 'Avsluta cast' : 'Casta till Nest Hub';
    // Keep using the shadow DOM host pattern — just update color/title; onclick stays as _castRequest()
    // Override onclick only for endSession since that runs from outside
    if (active) btn.onclick = () => this.endSession();
    else btn.onclick = null; // fall back to inline onclick -> _castRequest()
  }

  get isCasting() { return !!this._session; }
}

window.castSender = new CastSender();

// Pick up config if startConnection ran before this script loaded
if (window.__castPendingConfig) {
  window.castSender.setConfig(window.__castPendingConfig);
  delete window.__castPendingConfig;
}
