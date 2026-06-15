// Google Cast Sender for Energy Dashboard
//
// SETUP: Register your receiver at https://cast.google.com/publish
//   1. Create a Custom Receiver application
//   2. Set the Receiver Application URL to: https://your-domain/receiver.html
//   3. Replace CAST_APP_ID below with your Application ID
//   4. Add your Nest Hub's serial number to the test devices during development

const CAST_APP_ID = 'BAEFEE39';
const CAST_NAMESPACE = 'urn:x-cast:energy-dashboard';

class CastSender {
  constructor() {
    this._session = null;
    this._castAvailable = false;
    this._config = null;
    this._onStatusChange = null;
  }

  init() {
    window['__onGCastApiAvailable'] = (isAvailable) => {
      this._castAvailable = isAvailable;
      if (!isAvailable) return;

      const context = cast.framework.CastContext.getInstance();
      context.setOptions({
        receiverApplicationId: CAST_APP_ID,
        autoJoinPolicy: chrome.cast.AutoJoinPolicy.ORIGIN_SCOPED,
      });

      context.addEventListener(
        cast.framework.CastContextEventType.SESSION_STATE_CHANGED,
        (e) => this._onSessionState(e)
      );
    };
  }

  _onSessionState(event) {
    const S = cast.framework.SessionState;
    switch (event.sessionState) {
      case S.SESSION_STARTED:
      case S.SESSION_RESUMED:
        this._session = cast.framework.CastContext.getInstance().getCurrentSession();
        this._sendInit();
        this._onStatusChange?.(true);
        this._updateCastBtn(true);
        break;
      case S.SESSION_ENDED:
        this._session = null;
        this._onStatusChange?.(false);
        this._updateCastBtn(false);
        break;
    }
  }

  _sendInit() {
    if (!this._session || !this._config) return;
    this._session.sendMessage(CAST_NAMESPACE, {
      type: 'INIT',
      hassUrl: this._config.hassUrl,
      token: this._config.token,
      entityConfig: this._config.entityConfig,
    }).catch((err) => console.warn('[Cast] sendMessage failed:', err));
  }

  setConfig(config) {
    this._config = config;
    if (this._session) this._sendInit();
  }

  requestSession() {
    if (!this._castAvailable) {
      console.warn('[Cast] API not available — register app at cast.google.com/publish and replace CAST_APP_ID.');
      return;
    }
    cast.framework.CastContext.getInstance()
      .requestSession()
      .catch((err) => {
        if (err !== chrome.cast.ErrorCode.CANCEL) console.warn('[Cast] Session error:', err);
      });
  }

  endSession() {
    cast.framework.CastContext.getInstance().endCurrentSession(true);
  }

  _updateCastBtn(active) {
    const card = document.querySelector('energy-dashboard-card');
    const btn = card?.shadowRoot?.getElementById('cast-btn');
    if (btn) {
      btn.style.color = active ? '#4A9EFF' : '';
      btn.title = active ? 'Avsluta cast' : 'Casta till Nest Hub';
      btn.onclick = active
        ? () => this.endSession()
        : () => this.requestSession();
    }
  }

  get isCasting() { return !!this._session; }
}

window.castSender = new CastSender();

// Pick up config if startConnection ran before this script loaded
if (window.__castPendingConfig) {
  window.castSender.setConfig(window.__castPendingConfig);
  delete window.__castPendingConfig;
}
