// public/app.js — منطق الواجهة الاحترافية
const REG_LINK = 'https://reffpa.com/L?tag=d_3649166m_1599c_OUSSO&site=3649166&ad=1599&r=en/registration';
const VIDEO_REGISTER = 'https://player.cloudinary.com/embed/?cloud_name=djkqimryk&public_id=lv_0_%D9%A2%D9%A0%D9%A2%D9%A6%D9%A0%D9%A4%D9%A1%D9%A0%D9%A1%D9%A4%D9%A1%D9%A1%D9%A3%D9%A2_ylopqt';
const VIDEO_AGENCY = VIDEO_REGISTER;
let SUPPORT_WA = '22249002902';
let CHANNEL = 'https://whatsapp.com/channel/0029Vb7TGP52phHUrKJ13u1p';

const App = {
  lang: 'ar',
  user: null,
  stats: null,

  t(key) { return (window.TEXTS[this.lang] || {})[key] || key; },

  applyLang() {
    const T = window.TEXTS[this.lang];
    document.documentElement.lang = this.lang;
    document.documentElement.dir = T.dir;
    document.getElementById('langBtn').textContent = T.langBtn;
    document.querySelectorAll('[id^="t-"]').forEach((el) => {
      const key = el.id.slice(2);
      if (T[key] !== undefined) {
        const span = el.querySelector('span');
        if (span) { el.childNodes[0].nodeValue = T[key]; }
        else el.textContent = T[key];
      }
    });
    document.querySelectorAll('[id^="s-"]').forEach((el) => {
      const key = el.id.slice(2);
      if (T[key] !== undefined) el.textContent = T[key];
    });
    document.getElementById('bannerWelcome').src = `/images/welcome_${this.lang}.jpg`;
    document.getElementById('bannerReferral').src = `/images/referral_${this.lang}.jpg`;
    document.getElementById('bannerAgency').src = `/images/agency_${this.lang}.jpg`;
  },

  toggleLang() {
    this.lang = this.lang === 'ar' ? 'fr' : 'ar';
    this.applyLang();
    if (!document.getElementById('view-account').classList.contains('hidden')) this.renderAccount();
  },

  scrollTo(id) { document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }); },

  toast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg; t.classList.add('show');
    clearTimeout(this._tt);
    this._tt = setTimeout(() => t.classList.remove('show'), 3600);
  },

  async api(endpoint, data) {
    try {
      const res = await fetch(`/api/${endpoint}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      return res.json();
    } catch (e) { return { error: 'network' }; }
  },

  getRefFromUrl() {
    const m = location.pathname.match(/\/r\/([A-Za-z0-9]{1,5})/);
    if (m) return m[1].toUpperCase();
    const q = new URLSearchParams(location.search).get('r');
    return q ? q.toUpperCase() : '';
  },

  openModal(html) {
    document.getElementById('modalBox').innerHTML = '<div class="modal-grip"></div>' + html;
    document.getElementById('modal').classList.add('open');
  },
  closeModal() { document.getElementById('modal').classList.remove('open'); },

  openVideo(which) {
    document.getElementById('vFrame').src = which === 'agency' ? VIDEO_AGENCY : VIDEO_REGISTER;
    document.getElementById('videoModal').classList.add('open');
  },
  closeVideo() {
    document.getElementById('videoModal').classList.remove('open');
    document.getElementById('vFrame').src = '';
  },

  openChannel() { window.open(CHANNEL, '_blank'); },
  openRegLink() { window.open(REG_LINK, '_blank'); },
  openWhatsApp() { window.open(`https://wa.me/${SUPPORT_WA}`, '_blank'); },

  // ═══ REGISTER (phone +222, first digit 4/3/2, link-only referrals) ═══
  openRegister() {
    this.pendingRef = this.getRefFromUrl();
    this.openModal(`
      <div class="modal-head"><h3>${this.t('reg_title')}</h3><button class="modal-close" onclick="App.closeModal()">&times;</button></div>
      <div class="modal-intro">${this.t('reg_intro')}</div>
      <div class="field">
        <label>${this.t('reg_phone')}</label>
        <div class="phone-wrap" id="phoneWrap">
          <div class="phone-prefix">+222</div>
          <input id="regPhone" type="tel" inputmode="numeric" maxlength="8" placeholder="XXXXXXXX" oninput="App.onPhoneInput(this)">
        </div>
        <div class="note">${this.t('reg_phone_note')}</div>
        <div class="err-msg" id="regPhoneErr">${this.t('reg_err_phone')}</div>
      </div>
      <button class="btn btn-primary" onclick="App.doRegister()" id="regSubmit">${this.t('reg_submit')}</button>
      <div class="mini-steps">
        <div class="mst">${this.t('reg_steps_title')}</div>
        <div class="mini-step"><div class="msn">1</div><div>${this.t('reg_s1')}</div></div>
        <div class="mini-step"><div class="msn">2</div><div>${this.t('reg_s2')}</div></div>
        <div class="mini-step"><div class="msn">3</div><div>${this.t('reg_s3')}</div></div>
        <div class="mini-step"><div class="msn">4</div><div>${this.t('reg_s4')}</div></div>
      </div>
      <button class="btn btn-outline" onclick="App.openRegLink()">${this.t('reg_link_btn')}</button>
    `);
  },

  onPhoneInput(el) {
    let v = el.value.replace(/\D/g, '');
    if (v.length === 1 && !['4', '3', '2'].includes(v[0])) v = '';
    el.value = v.slice(0, 8);
    document.getElementById('phoneWrap').classList.remove('error');
    document.getElementById('regPhoneErr').classList.remove('show');
  },

  validPhone(local) {
    return /^[432]\d{7}$/.test(local);
  },

  async doRegister() {
    const local = document.getElementById('regPhone').value.trim();
    const wrap = document.getElementById('phoneWrap');
    const err = document.getElementById('regPhoneErr');
    if (!this.validPhone(local)) {
      wrap.classList.add('error'); err.classList.add('show'); return;
    }
    const phone = '222' + local;
    const btn = document.getElementById('regSubmit');
    btn.disabled = true; btn.innerHTML = '<span class="spinner-sm"></span>';

    const r = await this.api('register', { phone, ref_code: this.pendingRef || '', lang: this.lang });
    btn.disabled = false; btn.textContent = this.t('reg_submit');

    if (r.error === 'invalid_phone') { wrap.classList.add('error'); err.classList.add('show'); return; }
    if (r.error) { this.toast(this.lang === 'ar' ? 'حدث خطأ، حاول مجدداً' : 'Erreur, réessayez'); return; }

    this.user = r.user;
    localStorage.setItem('ousso_phone', r.user.phone);
    this.closeModal();
    this.toast(this.lang === 'ar' ? 'تم إنشاء حسابك بنجاح' : 'Compte créé avec succès');
    this.openAccount();
  },

  // ═══ ACCOUNT ═══
  async openAccount() {
    const phone = this.user?.phone || localStorage.getItem('ousso_phone');
    if (!phone) { this.openLogin(); return; }
    const r = await this.api('me', { phone });
    if (r.error) { localStorage.removeItem('ousso_phone'); this.openLogin(); return; }
    this.user = r.user; this.stats = r.stats;
    if (r.notifications && r.notifications.length) {
      r.notifications.forEach((n, i) => setTimeout(() => this.toast(n.title + (n.body ? ': ' + n.body : '')), 500 + i * 3800));
    }
    this.renderAccount();
  },

  openLogin() {
    this.openModal(`
      <div class="modal-head"><h3>${this.t('btn_account')}</h3><button class="modal-close" onclick="App.closeModal()">&times;</button></div>
      <div class="modal-intro">${this.t('reg_intro')}</div>
      <div class="field">
        <label>${this.t('reg_phone')}</label>
        <div class="phone-wrap" id="phoneWrap">
          <div class="phone-prefix">+222</div>
          <input id="loginPhone" type="tel" inputmode="numeric" maxlength="8" placeholder="XXXXXXXX" oninput="App.onPhoneInput2(this)">
        </div>
        <div class="err-msg" id="loginErr">${this.t('reg_err_phone')}</div>
      </div>
      <button class="btn btn-primary" onclick="App.doLogin()" id="loginBtn">${this.t('btn_account')}</button>
    `);
  },
  onPhoneInput2(el) {
    let v = el.value.replace(/\D/g, '');
    if (v.length === 1 && !['4', '3', '2'].includes(v[0])) v = '';
    el.value = v.slice(0, 8);
    document.getElementById('phoneWrap').classList.remove('error');
    document.getElementById('loginErr').classList.remove('show');
  },
  async doLogin() {
    const local = document.getElementById('loginPhone').value.trim();
    if (!this.validPhone(local)) {
      document.getElementById('phoneWrap').classList.add('error');
      document.getElementById('loginErr').classList.add('show'); return;
    }
    const btn = document.getElementById('loginBtn');
    btn.disabled = true; btn.innerHTML = '<span class="spinner-sm"></span>';
    const r = await this.api('me', { phone: '222' + local });
    btn.disabled = false; btn.textContent = this.t('btn_account');
    if (r.error) {
      document.getElementById('loginErr').textContent = this.lang === 'ar' ? 'لا يوجد حساب بهذا الرقم. سجّل أولاً.' : 'Aucun compte. Inscrivez-vous d\'abord.';
      document.getElementById('loginErr').classList.add('show');
      document.getElementById('phoneWrap').classList.add('error'); return;
    }
    this.user = r.user; this.stats = r.stats;
    localStorage.setItem('ousso_phone', r.user.phone);
    this.closeModal(); this.renderAccount();
  },

  renderAccount() {
    const u = this.user, s = this.stats || { activated: 0, earned: 0 };
    const refLink = `${location.origin}/r/${u.ref_code}`;
    let badge, cls;
    if (u.verified) { badge = this.t('status_verified'); cls = 'status-verified'; }
    else if (u.pending_gid) { badge = this.t('status_pending'); cls = 'status-pending'; }
    else { badge = this.t('status_new'); cls = 'status-new'; }

    document.getElementById('view-home').classList.add('hidden');
    const v = document.getElementById('view-account');
    v.classList.remove('hidden');
    v.innerHTML = `
      <div class="acc-head">
        <h2>${this.t('acc_title')}</h2>
        <button class="lang-btn" onclick="App.logout()">${this.t('acc_logout')}</button>
      </div>
      <div class="acc-grid">
        <div class="acc-card"><div class="lbl">${this.t('acc_balance')}</div><div class="val">${u.balance_um} UM</div></div>
        <div class="acc-card alt"><div class="lbl">${this.t('acc_status')}</div><span class="status-badge ${cls}">${badge}</span></div>
        <div class="acc-card alt"><div class="lbl">${this.t('acc_refs')}</div><div class="val" style="color:var(--blue-700)">${s.activated}</div></div>
        <div class="acc-card alt"><div class="lbl">${this.t('acc_earned')}</div><div class="val" style="color:var(--blue-700)">${s.earned} UM</div></div>
        ${u.game_id ? `<div class="acc-card alt full"><div class="lbl">${this.t('acc_gameid')}</div><div class="val" style="color:var(--blue-700);font-size:19px">${u.game_id}</div></div>` : ''}
      </div>

      <div class="ref-box">
        <div class="rl">${this.t('acc_myref')}</div>
        <div class="rn">${this.t('acc_myref_note')}</div>
        <div class="rcode">${refLink}</div>
        <div class="ref-actions">
          <button class="btn-primary" style="color:#fff;background:linear-gradient(135deg,var(--blue-600),var(--blue-700))" onclick="App.copyRef('${refLink}')">${this.t('acc_copy')}</button>
          <button class="btn-wa" style="color:#04210f;background:linear-gradient(135deg,#25d366,#1faa52)" onclick="App.shareRef('${refLink}')">${this.t('acc_share')}</button>
        </div>
      </div>

      ${!u.verified && !u.pending_gid ? `<button class="btn btn-primary" onclick="App.openVerify()" style="margin-bottom:11px">${this.t('acc_verify_btn')}</button>` : ''}
      ${u.verified ? `<button class="btn btn-primary" onclick="App.openWithdraw()" style="margin-bottom:11px">${this.t('acc_withdraw_btn')}</button>` : ''}
      <button class="btn btn-wa" onclick="App.openSupportChat()" style="margin-bottom:11px">
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 00-8.5 15.3L2 22l4.8-1.5A10 10 0 1012 2z"/></svg>${this.t('btn_chat')}
      </button>
      <button class="btn btn-ghost" onclick="App.goHome()">${this.t('acc_home')}</button>
    `;
    window.scrollTo(0, 0);
  },

  goHome() {
    document.getElementById('view-account').classList.add('hidden');
    document.getElementById('view-home').classList.remove('hidden');
  },
  logout() { localStorage.removeItem('ousso_phone'); this.user = null; this.goHome(); },

  copyRef(link) { navigator.clipboard?.writeText(link); this.toast(this.t('acc_copied')); },
  shareRef(link) {
    const txt = this.lang === 'ar'
      ? `انضم إلى وكالة OussoCash المعتمدة واربح 100 UM مكافأة ترحيب:\n${link}`
      : `Rejoignez l'agence OussoCash et gagnez 100 UM de bienvenue:\n${link}`;
    if (navigator.share) navigator.share({ text: txt }).catch(() => {});
    else { navigator.clipboard?.writeText(txt); this.toast(this.t('acc_copied')); }
  },

  // ═══ VERIFY ID ═══
  openVerify() {
    this.openModal(`
      <div class="modal-head"><h3>${this.t('vid_title')}</h3><button class="modal-close" onclick="App.closeModal()">&times;</button></div>
      <div class="modal-intro">${this.t('vid_intro')}</div>
      <div class="field">
        <label>${this.t('vid_enter')}</label>
        <input id="gidInput" type="tel" inputmode="numeric" placeholder="123456789">
      </div>
      <ul class="confirm-list">
        ${['confirm_l1','confirm_l2','confirm_l3','confirm_l4','confirm_l5'].map(k=>`<li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M5 13l4 4L19 7"/></svg>${this.t(k)}</li>`).join('')}
      </ul>
      <button class="btn btn-primary" onclick="App.checkId()" id="checkBtn">${this.t('vid_check')}</button>
      <div class="id-result" id="idResult"></div>
    `);
  },

  async checkId() {
    const gid = document.getElementById('gidInput').value.replace(/\D/g, '');
    const btn = document.getElementById('checkBtn');
    const box = document.getElementById('idResult');
    if (gid.length < 9) { this.toast(this.lang === 'ar' ? 'أدخل Game ID صحيحاً' : 'Entrez un Game ID valide'); return; }
    btn.disabled = true; btn.innerHTML = `<span class="spinner-sm"></span> ${this.t('vid_checking')}`;
    box.classList.remove('show', 'ok', 'bad');

    const r = await this.api('verify-id', { phone: this.user.phone, action: 'check', game_id: gid });
    btn.disabled = false; btn.textContent = this.t('vid_check');

    const check = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M5 13l4 4L19 7"/></svg>`;
    const cross = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M18 6L6 18M6 6l12 12"/></svg>`;

    if (r.status === 'found') {
      box.classList.add('show', 'ok');
      box.innerHTML = `
        <div class="ir-title">${check}${this.t('vid_found')}</div>
        <div class="ir-row"><span>${this.t('vid_name')}</span><b>${r.name || '-'}</b></div>
        <div class="ir-row"><span>${this.t('vid_id')}</span><b>${this.pendingGid = gid}</b></div>
        <div class="ir-row"><span>${this.t('vid_currency')}</span><b>${r.currency || 'MRU'}</b></div>
        <div class="ir-note">${this.t('vid_found_note')}</div>
      `;
      this.pendingGid = gid; this.pendingName = r.name; this.pendingCurrency = r.currency;
      setTimeout(() => this.showConfirm(), 1400);
    } else {
      box.classList.add('show', 'bad');
      let msg = this.t('vid_notfound');
      if (r.status === 'taken') msg = this.t('vid_taken');
      else if (r.status === 'banned') msg = this.t('vid_banned');
      box.innerHTML = `<div class="ir-title">${cross}${msg}</div>`;
    }
  },

  showConfirm() {
    this.openModal(`
      <div class="modal-head"><h3>${this.t('confirm_title')}</h3></div>
      <div class="modal-intro">${this.t('confirm_desc')}</div>
      <ul class="confirm-list">
        ${['confirm_l1','confirm_l2','confirm_l3','confirm_l4','confirm_l5'].map(k=>`<li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M5 13l4 4L19 7"/></svg>${this.t(k)}</li>`).join('')}
      </ul>
      <button class="btn btn-primary" onclick="App.confirmId()" id="confirmBtn" style="margin-bottom:10px">${this.t('confirm_yes')}</button>
      <button class="btn btn-ghost" onclick="App.openVerify()">${this.t('confirm_no')}</button>
    `);
  },

  async confirmId() {
    const btn = document.getElementById('confirmBtn');
    btn.disabled = true; btn.innerHTML = '<span class="spinner-sm"></span>';
    const r = await this.api('verify-id', { phone: this.user.phone, action: 'confirm', game_id: this.pendingGid });
    if (r.status === 'pending') {
      this.closeModal();
      this.toast(this.t('vid_sent'));
      this.user.pending_gid = this.pendingGid;
      this.maybeAskNotifications();
      setTimeout(() => this.openAccount(), 2000);
    } else {
      btn.disabled = false; btn.textContent = this.t('confirm_yes');
      this.toast(this.lang === 'ar' ? 'حدث خطأ' : 'Erreur');
    }
  },

  // ═══ NOTIFICATIONS ═══
  maybeAskNotifications() {
    if (!('Notification' in window) || Notification.permission === 'granted') return;
    setTimeout(() => {
      this.openModal(`
        <div class="modal-head"><h3>${this.t('notif_title')}</h3><button class="modal-close" onclick="App.closeModal()">&times;</button></div>
        <div class="modal-intro">${this.t('notif_enable')}</div>
        <button class="btn btn-primary" onclick="App.enableNotifications()">${this.t('notif_btn')}</button>
      `);
    }, 2400);
  },
  async enableNotifications() {
    try { await Notification.requestPermission(); } catch {}
    this.closeModal();
  },

  // ═══ WITHDRAW ═══
  openWithdraw() {
    const bal = this.user.balance_um;
    const can = bal >= 300;
    this.openModal(`
      <div class="modal-head"><h3>${this.t('wd_title')}</h3><button class="modal-close" onclick="App.closeModal()">&times;</button></div>
      <div class="acc-card full" style="margin-bottom:16px"><div class="lbl">${this.t('wd_balance')}</div><div class="val">${bal} UM</div></div>
      ${!can ? `<div class="id-result show bad"><div class="ir-title"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M12 8v5M12 16h.01M10.3 3.9L2 18a2 2 0 001.7 3h16.6a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z"/></svg>${this.t('wd_min')}</div><div style="color:var(--muted);font-size:13px;line-height:1.6;margin-top:8px">${this.t('wd_insufficient')}</div></div>` : `
        <label style="display:block;font-weight:800;margin-bottom:8px;font-size:14px">${this.t('wd_choose')}</label>
        <div class="method-select">
          <div class="method-opt" onclick="App.selectMethod(this,'Bankily')"><img src="/logos/bankily.jpg"><div class="mn">Bankily</div></div>
          <div class="method-opt" onclick="App.selectMethod(this,'Masrvi')"><img src="/logos/masrvi.jpg"><div class="mn">Masrvi</div></div>
          <div class="method-opt" onclick="App.selectMethod(this,'Sedad')"><img src="/logos/sedad.jpg"><div class="mn">Sedad</div></div>
        </div>
        <div class="field" style="margin-top:14px">
          <label>${this.t('wd_account')}</label>
          <input id="wdAccount" type="tel" inputmode="numeric" placeholder="${this.t('wd_account_ph')}">
          <div class="note">${this.t('wd_confirm_note')}</div>
        </div>
        <button class="btn btn-primary" onclick="App.confirmWithdraw()" id="wdBtn">${this.t('wd_confirm')}</button>
      `}
    `);
    this.wdMethod = null;
  },
  selectMethod(el, m) {
    document.querySelectorAll('.method-opt').forEach((x) => x.classList.remove('active'));
    el.classList.add('active'); this.wdMethod = m;
  },
  async confirmWithdraw() {
    const account = document.getElementById('wdAccount').value.trim();
    if (!this.wdMethod) { this.toast(this.t('wd_choose')); return; }
    if (account.length < 6) { this.toast(this.t('wd_account')); return; }
    const btn = document.getElementById('wdBtn');
    btn.disabled = true; btn.innerHTML = '<span class="spinner-sm"></span>';
    const r = await this.api('withdraw', { phone: this.user.phone, method: this.wdMethod, account_number: account });
    if (r.ok) {
      this.closeModal(); this.toast(this.t('wd_sent'));
      this.user.balance_um = 0; setTimeout(() => this.openAccount(), 1400);
    } else {
      btn.disabled = false; btn.textContent = this.t('wd_confirm');
      if (r.error === 'pending_exists') this.toast(this.t('wd_pending'));
      else if (r.error === 'insufficient') this.toast(this.t('wd_insufficient'));
      else this.toast(this.lang === 'ar' ? 'حدث خطأ' : 'Erreur');
    }
  },

  // ═══ SMART SUPPORT ═══
  openSupportChat() {
    this.openModal(`
      <div class="modal-head"><h3>${this.t('support_chat_title')}</h3><button class="modal-close" onclick="App.closeModal()">&times;</button></div>
      <div class="chat-msgs" id="chatMsgs">
        <div class="chat-msg bot">${this.t('support_chat_greet')}</div>
      </div>
      <div class="chat-input">
        <input id="chatInput" type="text" placeholder="${this.t('support_chat_ph')}" onkeydown="if(event.key==='Enter')App.sendChat()">
        <button onclick="App.sendChat()"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M2 21l21-9L2 3v7l15 2-15 2z"/></svg></button>
      </div>
      <button class="btn btn-wa" onclick="App.openWhatsApp()" style="margin-top:12px">
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 00-8.5 15.3L2 22l4.8-1.5A10 10 0 1012 2z"/></svg>${this.t('support_human')}
      </button>
    `);
  },
  async sendChat() {
    const input = document.getElementById('chatInput');
    const msg = input.value.trim();
    if (!msg) return;
    const box = document.getElementById('chatMsgs');
    box.innerHTML += `<div class="chat-msg user">${this.escape(msg)}</div>`;
    input.value = ''; box.scrollTop = box.scrollHeight;

    const r = await this.api('support', { message: msg, lang: this.lang });
    const ans = r.found ? r.answer : (this.lang === 'ar'
      ? 'لم أفهم سؤالك تماماً. يمكنك إعادة صياغته، أو التواصل مع الدعم المباشر عبر واتساب أسفل المحادثة لمساعدتك فوراً.'
      : 'Je n\'ai pas bien compris. Reformulez, ou contactez le support direct via WhatsApp ci-dessous.');
    box.innerHTML += `<div class="chat-msg bot">${this.escape(ans)}</div>`;
    box.scrollTop = box.scrollHeight;
  },
  escape(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; },

  // ═══ INIT ═══
  async loadConfig() {
    const c = await this.api('config', {});
    if (c && c.support_whatsapp) SUPPORT_WA = c.support_whatsapp;
    if (c && c.channel_url) CHANNEL = c.channel_url;
  },
  init() {
    if ((navigator.language || 'ar').slice(0, 2).toLowerCase() === 'fr') this.lang = 'fr';
    this.applyLang();
    this.loadConfig();
    document.getElementById('modal').addEventListener('click', (e) => { if (e.target.id === 'modal') this.closeModal(); });
    document.getElementById('videoModal').addEventListener('click', (e) => { if (e.target.id === 'videoModal') this.closeVideo(); });
    setTimeout(() => { document.getElementById('splash').classList.add('hide'); }, 2000);
    const saved = localStorage.getItem('ousso_phone');
    if (this.getRefFromUrl() && !saved) setTimeout(() => this.openRegister(), 2300);
  },
};

window.addEventListener('DOMContentLoaded', () => App.init());
