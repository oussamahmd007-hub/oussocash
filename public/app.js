// public/app.js — منطق الواجهة
const REG_LINK = 'https://reffpa.com/L?tag=d_3649166m_1599c_OUSSO&site=3649166&ad=1599&r=en/registration';
const VIDEO_REGISTER = 'https://player.cloudinary.com/embed/?cloud_name=djkqimryk&public_id=lv_0_%D9%A2%D9%A0%D9%A2%D9%A6%D9%A0%D9%A4%D9%A1%D9%A0%D9%A1%D9%A4%D9%A1%D9%A1%D9%A3%D9%A2_ylopqt';
const VIDEO_AGENCY = VIDEO_REGISTER;
let SUPPORT_WA = '22249002902';
let CHANNEL = 'https://whatsapp.com/channel/0029Vb7TGP52phHUrKJ13u1p';

const App = {
  lang: 'ar',
  user: null,

  t(key) { return (window.TEXTS[this.lang] || {})[key] || key; },

  applyLang() {
    const T = window.TEXTS[this.lang];
    document.documentElement.lang = this.lang;
    document.documentElement.dir = T.dir;
    document.getElementById('langBtn').textContent = T.langBtn;
    // كل العناصر t-*
    document.querySelectorAll('[id^="t-"]').forEach((el) => {
      const key = el.id.slice(2);
      if (T[key] !== undefined) {
        // احتفظ بالـ span الداخلي إن وُجد
        const span = el.querySelector('span');
        if (span) { el.childNodes[0].nodeValue = T[key]; }
        else el.textContent = T[key];
      }
    });
    // الصور حسب اللغة
    document.getElementById('bannerWelcome').src = `/images/welcome_${this.lang}.jpg`;
    document.getElementById('bannerReferral').src = `/images/referral_${this.lang}.jpg`;
    document.getElementById('bannerAgency').src = `/images/agency_${this.lang}.jpg`;
  },

  toggleLang() { this.lang = this.lang === 'ar' ? 'fr' : 'ar'; this.applyLang(); if (!document.getElementById('view-account').classList.contains('hidden')) this.renderAccount(); },

  scrollTo(id) { document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }); },

  toast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg; t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 3200);
  },

  async api(endpoint, data) {
    const res = await fetch(`/api/${endpoint}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  // ─── refcode from URL ───
  getRefFromUrl() {
    const m = location.pathname.match(/\/r\/([A-Za-z0-9]{1,5})/);
    if (m) return m[1].toUpperCase();
    const q = new URLSearchParams(location.search).get('r');
    return q ? q.toUpperCase() : '';
  },

  openModal(html) {
    document.getElementById('modalBox').innerHTML = html;
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
  openWhatsApp() { window.open(`https://wa.me/${SUPPORT_WA}`, '_blank'); },

  // ═══ REGISTER ═══
  openRegister() {
    const ref = this.getRefFromUrl();
    this.openModal(`
      <div class="modal-head"><h3>${this.t('reg_title')}</h3><button class="modal-close" onclick="App.closeModal()">&times;</button></div>
      <div class="field">
        <label>${this.t('reg_phone')}</label>
        <input id="regPhone" type="tel" inputmode="numeric" placeholder="${this.t('reg_phone_ph')}">
        <div class="note">${this.t('reg_phone_note')}</div>
        <div class="err-msg" id="regPhoneErr">${this.t('reg_err_phone')}</div>
      </div>
      <div class="field">
        <label>${this.t('reg_refcode')}</label>
        <input id="regRef" type="text" maxlength="5" placeholder="${this.t('reg_refcode_ph')}" value="${ref}" style="text-transform:uppercase">
        <div class="err-msg" id="regRefErr">${this.t('reg_err_ref')}</div>
      </div>
      <button class="btn btn-primary" onclick="App.doRegister()" id="regSubmit">${this.t('reg_submit')}</button>
      <div style="margin-top:18px;padding-top:18px;border-top:1px solid var(--line)">
        <div style="font-weight:800;color:var(--blue-900);margin-bottom:4px">${this.t('reg_link_title')}</div>
        <div style="font-size:13px;color:var(--muted);margin-bottom:12px">${this.t('reg_link_desc')}</div>
        <button class="btn btn-outline" onclick="window.open('${REG_LINK}','_blank')">${this.t('reg_link_btn')}</button>
      </div>
    `);
  },

  async doRegister() {
    const phone = document.getElementById('regPhone').value.trim();
    const ref = document.getElementById('regRef').value.trim().toUpperCase();
    const pErr = document.getElementById('regPhoneErr');
    const rErr = document.getElementById('regRefErr');
    const pIn = document.getElementById('regPhone');
    const rIn = document.getElementById('regRef');
    pErr.classList.remove('show'); rErr.classList.remove('show');
    pIn.classList.remove('error'); rIn.classList.remove('error');

    const btn = document.getElementById('regSubmit');
    btn.disabled = true; btn.innerHTML = '<span class="spinner-sm"></span>';

    const r = await this.api('register', { phone, ref_code: ref, lang: this.lang });

    btn.disabled = false; btn.textContent = this.t('reg_submit');

    if (r.error === 'invalid_phone') { pIn.classList.add('error'); pErr.classList.add('show'); return; }
    if (r.error === 'ref_not_found' || r.error === 'invalid_ref_format') { rIn.classList.add('error'); rErr.classList.add('show'); return; }
    if (r.error) { this.toast('خطأ، حاول مرة أخرى'); return; }

    // نجح
    this.user = r.user;
    localStorage.setItem('ousso_phone', r.user.phone);
    this.closeModal();
    this.toast(this.lang === 'ar' ? 'تم التسجيل بنجاح' : 'Inscription réussie');
    this.openAccount();
  },

  // ═══ ACCOUNT ═══
  async openAccount() {
    const phone = this.user?.phone || localStorage.getItem('ousso_phone');
    if (!phone) { this.openLogin(); return; }
    const r = await this.api('me', { phone });
    if (r.error) { localStorage.removeItem('ousso_phone'); this.openLogin(); return; }
    this.user = r.user; this.stats = r.stats;
    // إشعارات
    if (r.notifications && r.notifications.length) {
      r.notifications.forEach((n) => setTimeout(() => this.toast(n.title + ': ' + n.body), 400));
    }
    this.renderAccount();
  },

  openLogin() {
    this.openModal(`
      <div class="modal-head"><h3>${this.t('btn_account')}</h3><button class="modal-close" onclick="App.closeModal()">&times;</button></div>
      <div class="field">
        <label>${this.t('reg_phone')}</label>
        <input id="loginPhone" type="tel" inputmode="numeric" placeholder="${this.t('reg_phone_ph')}">
        <div class="err-msg" id="loginErr">${this.t('reg_err_phone')}</div>
      </div>
      <button class="btn btn-primary" onclick="App.doLogin()" id="loginBtn">${this.t('btn_account')}</button>
    `);
  },
  async doLogin() {
    const phone = document.getElementById('loginPhone').value.trim();
    const btn = document.getElementById('loginBtn');
    btn.disabled = true; btn.innerHTML = '<span class="spinner-sm"></span>';
    const r = await this.api('me', { phone: phone.replace(/\D/g, '') });
    btn.disabled = false; btn.textContent = this.t('btn_account');
    if (r.error) { document.getElementById('loginErr').classList.add('show'); document.getElementById('loginPhone').classList.add('error'); return; }
    this.user = r.user; this.stats = r.stats;
    localStorage.setItem('ousso_phone', r.user.phone);
    this.closeModal(); this.renderAccount();
  },

  renderAccount() {
    const u = this.user, s = this.stats || { activated: 0, earned: 0 };
    const refLink = `${location.origin}/r/${u.ref_code}`;
    let statusBadge, statusClass;
    if (u.verified) { statusBadge = this.t('status_verified'); statusClass = 'status-verified'; }
    else if (u.pending_gid) { statusBadge = this.t('status_pending'); statusClass = 'status-pending'; }
    else { statusBadge = this.t('status_new'); statusClass = 'status-new'; }

    document.getElementById('view-home').classList.add('hidden');
    const v = document.getElementById('view-account');
    v.classList.remove('hidden');
    v.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin:18px 0">
        <h2 style="font-family:'Tajawal';font-size:22px;color:var(--blue-900)">${this.t('nav_account')}</h2>
        <button class="lang-btn" onclick="App.logout()">${this.t('acc_logout')}</button>
      </div>
      <div class="acc-grid">
        <div class="acc-card"><div class="lbl">${this.t('acc_balance')}</div><div class="val">${u.balance_um} UM</div></div>
        <div class="acc-card alt"><div class="lbl">${this.t('acc_status')}</div><span class="status-badge ${statusClass}">${statusBadge}</span></div>
        <div class="acc-card alt"><div class="lbl">${this.t('acc_refs')}</div><div class="val" style="color:var(--blue-700)">${s.activated}</div></div>
        <div class="acc-card alt"><div class="lbl">${this.t('acc_earned')}</div><div class="val" style="color:var(--blue-700)">${s.earned} UM</div></div>
      </div>
      ${u.game_id ? `<div class="acc-card alt" style="margin-bottom:16px"><div class="lbl">${this.t('acc_gameid')}</div><div style="font-family:'Tajawal';font-size:18px;font-weight:700;margin-top:4px">${u.game_id}</div></div>` : ''}

      <div class="ref-box">
        <div class="rl">${this.t('acc_myref')}</div>
        <div class="rcode" id="refLinkText">${refLink}</div>
        <div class="ref-actions">
          <button class="btn-primary" style="color:#fff" onclick="App.copyRef('${refLink}')">${this.t('acc_copy')}</button>
          <button class="btn-wa" style="color:#04210f" onclick="App.shareRef('${refLink}')">${this.t('acc_share')}</button>
        </div>
      </div>

      ${!u.verified && !u.pending_gid ? `<button class="btn btn-primary" onclick="App.openVerify()" style="margin-bottom:12px">${this.t('acc_verify_btn')}</button>` : ''}
      ${u.verified ? `<button class="btn btn-primary" onclick="App.openWithdraw()" style="margin-bottom:12px">${this.t('acc_withdraw_btn')}</button>` : ''}
      <button class="btn btn-ghost" onclick="App.goHome()">${this.t('nav_home')}</button>
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
    const txt = this.lang === 'ar' ? `انضم إلى OussoCash واربح 100 UM ترحيب:\n${link}` : `Rejoignez OussoCash et gagnez 100 UM:\n${link}`;
    if (navigator.share) navigator.share({ text: txt });
    else { navigator.clipboard?.writeText(txt); this.toast(this.t('acc_copied')); }
  },

  // ═══ VERIFY ID ═══
  openVerify() {
    this.openModal(`
      <div class="modal-head"><h3>${this.t('vid_title')}</h3><button class="modal-close" onclick="App.closeModal()">&times;</button></div>
      <div class="field">
        <label>${this.t('vid_enter')}</label>
        <input id="gidInput" type="tel" inputmode="numeric" placeholder="123456789">
      </div>
      <button class="btn btn-primary" onclick="App.checkId()" id="checkBtn">${this.t('vid_check')}</button>
      <div class="id-result" id="idResult"></div>
    `);
  },

  async checkId() {
    const gid = document.getElementById('gidInput').value.replace(/\D/g, '');
    const btn = document.getElementById('checkBtn');
    const box = document.getElementById('idResult');
    if (gid.length < 9) { this.toast(this.lang==='ar'?'ID غير صحيح':'ID invalide'); return; }
    btn.disabled = true; btn.innerHTML = `<span class="spinner-sm"></span> ${this.t('vid_checking')}`;
    box.classList.remove('show', 'ok', 'bad');

    const r = await this.api('verify-id', { phone: this.user.phone, action: 'check', game_id: gid });
    btn.disabled = false; btn.textContent = this.t('vid_check');

    if (r.status === 'found') {
      box.classList.add('show', 'ok');
      box.innerHTML = `
        <div style="color:var(--green);font-weight:800;margin-bottom:10px">${this.t('vid_found')}</div>
        <div class="ir-row"><span>${this.t('vid_name')}</span><b>${r.name || '-'}</b></div>
        <div class="ir-row"><span>${this.t('vid_currency')}</span><b>${r.currency || '-'}</b></div>
      `;
      this.pendingGid = gid; this.pendingName = r.name; this.pendingCurrency = r.currency;
      setTimeout(() => this.showConfirm(), 600);
    } else if (r.status === 'taken') {
      box.classList.add('show', 'bad'); box.innerHTML = `<div style="color:var(--red);font-weight:800">${this.t('vid_taken')}</div>`;
    } else if (r.status === 'banned') {
      box.classList.add('show', 'bad'); box.innerHTML = `<div style="color:var(--red);font-weight:800">${this.t('vid_banned')}</div>`;
    } else {
      box.classList.add('show', 'bad'); box.innerHTML = `<div style="color:var(--red);font-weight:800">${this.t('vid_notfound')}</div>`;
    }
  },

  showConfirm() {
    this.openModal(`
      <div class="modal-head"><h3>${this.t('confirm_title')}</h3></div>
      <p style="color:var(--muted);font-size:14px">${this.t('confirm_desc')}</p>
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
      setTimeout(() => this.openAccount(), 1500);
    } else {
      btn.disabled = false; btn.textContent = this.t('confirm_yes');
      this.toast(this.lang==='ar'?'حدث خطأ':'Erreur');
    }
  },

  // ═══ NOTIFICATIONS (Web Push - بدون Firebase) ═══
  maybeAskNotifications() {
    if (!('Notification' in window) || Notification.permission === 'granted') return;
    setTimeout(() => {
      this.openModal(`
        <div class="modal-head"><h3>${this.t('notif_btn')}</h3><button class="modal-close" onclick="App.closeModal()">&times;</button></div>
        <p style="color:var(--muted);font-size:14.5px;line-height:1.7;margin-bottom:18px">${this.t('notif_enable')}</p>
        <button class="btn btn-primary" onclick="App.enableNotifications()">${this.t('notif_btn')}</button>
      `);
    }, 1800);
  },
  async enableNotifications() {
    try { await Notification.requestPermission(); } catch {}
    this.closeModal();
  },

  // ═══ WITHDRAW ═══
  openWithdraw() {
    const bal = this.user.balance_um;
    const canWithdraw = bal >= 300;
    this.openModal(`
      <div class="modal-head"><h3>${this.t('wd_title')}</h3><button class="modal-close" onclick="App.closeModal()">&times;</button></div>
      <div class="acc-card" style="margin-bottom:16px"><div class="lbl">${this.t('wd_balance')}</div><div class="val">${bal} UM</div></div>
      ${!canWithdraw ? `<div class="id-result show bad" style="margin-top:0"><div style="color:var(--red);font-weight:700">${this.t('wd_insufficient')}</div></div>` : `
        <label style="display:block;font-weight:700;margin-bottom:8px">${this.t('wd_choose')}</label>
        <div class="method-select" id="wdMethods">
          <div class="method-opt" onclick="App.selectMethod(this,'Bankily')"><img src="/logos/bankily.jpg"><div class="mn">Bankily</div></div>
          <div class="method-opt" onclick="App.selectMethod(this,'Masrvi')"><img src="/logos/masrvi.jpg"><div class="mn">Masrvi</div></div>
          <div class="method-opt" onclick="App.selectMethod(this,'Sedad')"><img src="/logos/sedad.jpg"><div class="mn">Sedad</div></div>
        </div>
        <div class="field" style="margin-top:14px">
          <label>${this.t('wd_account')}</label>
          <input id="wdAccount" type="tel" inputmode="numeric" placeholder="${this.t('wd_account_ph')}">
        </div>
        <button class="btn btn-primary" onclick="App.confirmWithdraw()" id="wdBtn">${this.t('wd_confirm')}</button>
      `}
    `);
    this.wdMethod = null;
  },
  selectMethod(el, method) {
    document.querySelectorAll('.method-opt').forEach(m => m.classList.remove('active'));
    el.classList.add('active'); this.wdMethod = method;
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
      this.user.balance_um = 0; setTimeout(() => this.openAccount(), 1200);
    } else if (r.error === 'pending_exists') {
      btn.disabled = false; btn.textContent = this.t('wd_confirm'); this.toast(this.t('wd_pending'));
    } else if (r.error === 'insufficient') {
      btn.disabled = false; btn.textContent = this.t('wd_confirm'); this.toast(this.t('wd_insufficient'));
    } else { btn.disabled = false; btn.textContent = this.t('wd_confirm'); this.toast('خطأ'); }
  },

  // ═══ SMART SUPPORT CHAT ═══
  openSupportChat() {
    this.openModal(`
      <div class="modal-head"><h3>${this.t('support_chat_title')}</h3><button class="modal-close" onclick="App.closeModal()">&times;</button></div>
      <div class="chat-msgs" id="chatMsgs">
        <div class="chat-msg bot">${this.lang==='ar'?'مرحبا! أنا المساعد الذكي لـ OussoCash. كيف يمكنني مساعدتك؟':'Bonjour! Je suis votre assistant OussoCash. Comment puis-je vous aider?'}</div>
      </div>
      <div class="chat-input">
        <input id="chatInput" type="text" placeholder="${this.t('support_chat_ph')}" onkeydown="if(event.key==='Enter')App.sendChat()">
        <button onclick="App.sendChat()"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M2 21l21-9L2 3v7l15 2-15 2z"/></svg></button>
      </div>
      <button class="btn btn-wa" onclick="App.openWhatsApp()" style="margin-top:12px">
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 00-8.5 15.3L2 22l4.8-1.5A10 10 0 1012 2z"/></svg>
        ${this.t('support_human')}
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
    const answer = r.found ? r.answer : (this.lang==='ar'
      ? 'لم أفهم سؤالك تماماً. يمكنك التواصل مع الدعم المباشر عبر واتساب أسفل المحادثة.'
      : 'Je n\'ai pas compris. Contactez le support direct via WhatsApp ci-dessous.');
    box.innerHTML += `<div class="chat-msg bot">${this.escape(answer)}</div>`;
    box.scrollTop = box.scrollHeight;
  },
  escape(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; },

  // ─── init ───
  init() {
    if ((navigator.language || 'ar').slice(0, 2).toLowerCase() === 'fr') this.lang = 'fr';
    this.applyLang();
    // modal close on backdrop
    document.getElementById('modal').addEventListener('click', (e) => { if (e.target.id === 'modal') this.closeModal(); });
    document.getElementById('videoModal').addEventListener('click', (e) => { if (e.target.id === 'videoModal') this.closeVideo(); });
    // loader
    setTimeout(() => {
      const l = document.getElementById('loader');
      l.style.opacity = '0'; setTimeout(() => l.style.display = 'none', 500);
    }, 500);
    // auto-open account if logged in & has ref in url -> register
    const saved = localStorage.getItem('ousso_phone');
    if (this.getRefFromUrl() && !saved) { setTimeout(() => this.openRegister(), 900); }
  },
};

window.addEventListener('DOMContentLoaded', () => App.init());
