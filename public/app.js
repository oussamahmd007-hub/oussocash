// ═══════════════════════════════════════════════════════════════════
//  OussoCash — Frontend (premium fintech app)
//  واجهة احترافية · تحقق صادق · هوية عبر 1xBet ID
// ═══════════════════════════════════════════════════════════════════
const REG_LINK = 'https://reffpa.com/L?tag=d_3649166m_1599c_OUSSO&site=3649166&ad=1599&r=en/registration';
const VIDEO_REGISTER = 'https://player.cloudinary.com/embed/?cloud_name=djkqimryk&public_id=lv_0_%D9%A2%D9%A0%D9%A2%D9%A6%D9%A0%D9%A4%D9%A1%D9%A0%D9%A1%D9%A4%D9%A1%D9%A1%D9%A3%D9%A2_ylopqt';
let SUPPORT_WA = '22232230404';
let CHANNEL    = 'https://whatsapp.com/channel/0029Vb7TGP52phHUrKJ13u1p';
let OS_APP_ID  = '';

// ── ثوابت مكتوبة في الكود (لا تُقرأ من قاعدة البيانات) ──
const OFFICIAL_CHANNEL = 'https://whatsapp.com/channel/0029Vb7TGP52phHUrKJ13u1p'; // قناة OussoCash الرسمية
const SUPPORT_PHONE    = '22249002902'; // رقم الدعم المباشر (واتساب)

const Store = {
  get s()  { try { return localStorage.getItem('oc_session'); } catch { return null; } },
  set s(v) { try { v ? localStorage.setItem('oc_session', v) : localStorage.removeItem('oc_session'); } catch {} },
  get lang(){ try { return localStorage.getItem('oc_lang') || 'ar'; } catch { return 'ar'; } },
  set lang(v){ try { localStorage.setItem('oc_lang', v); } catch {} },
};

const App = {
  lang: 'ar', account: null, stats: null, current: 'landing',
  _verifyData: null, _wdMethod: null, _pin: '', _pendingFp: null,

  t(k){ return (window.TEXTS[this.lang] || {})[k] ?? k; },

  // ── i18n ──
  applyLang(){
    const T = window.TEXTS[this.lang];
    document.documentElement.lang = this.lang;
    document.documentElement.dir  = T.dir;
    document.getElementById('langBtn').textContent = T.lang_btn;
    document.querySelectorAll('[id^="t-"]').forEach(el=>{
      const k = el.id.slice(2).replace(/2$/,''); // allow t-foo2 duplicates
      if (T[k] !== undefined) el.textContent = T[k];
    });
    document.querySelectorAll('[id^="s-"]').forEach(el=>{
      const k = el.id.slice(2); if (T[k]!==undefined) el.textContent = T[k];
    });
    document.getElementById('gidInput').placeholder = T.verify_ph;
    document.getElementById('verifyBtn').textContent = T.verify_btn;
    // reward labels
    document.getElementById('rwLbl1').textContent = this.lang==='ar' ? 'مكافأة ترحيب' : 'Bienvenue';
    document.getElementById('rwLbl2').textContent = this.lang==='ar' ? 'لكل إحالة' : 'Par parrain';
    document.getElementById('rwLbl3').textContent = this.lang==='ar' ? 'من الأرباح' : 'Des gains';
    if (this.account) this.renderDash();
  },
  toggleLang(){ this.lang = this.lang==='ar'?'fr':'ar'; Store.lang=this.lang; this.applyLang(); },

  // ── device fingerprint (stable, privacy-light) ──
  async fingerprint(){
    if (this._fp) return this._fp;
    let saved; try { saved = localStorage.getItem('oc_fp'); } catch {}
    if (saved) return (this._fp = saved);
    const parts = [navigator.userAgent, navigator.language, screen.width+'x'+screen.height,
      screen.colorDepth, new Date().getTimezoneOffset(), navigator.hardwareConcurrency||0,
      navigator.platform||''].join('|');
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(parts + '|' + (Math.random().toString(36)+Date.now())));
    const fp = Array.from(new Uint8Array(buf)).slice(0,16).map(b=>b.toString(16).padStart(2,'0')).join('');
    try { localStorage.setItem('oc_fp', fp); } catch {}
    return (this._fp = fp);
  },

  // ── API ──
  async api(path, data){
    const res = await fetch(`/api/${path}`, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify(data||{}),
    });
    return res.json().catch(()=>({error:'parse'}));
  },

  // ── views ──
  show(view){
    ['landing','regsteps','verify','present','pending','dash','ref','contest','sport','support','agency'].forEach(v=>{
      const el=document.getElementById('view-'+v); if(el) el.classList.toggle('hidden', v!==view);
    });
    this.current = view;
    document.getElementById('scroll').scrollTop = 0;
    // القائمة السفلية تظهر فقط بعد التفعيل (داخل لوحة التحكم)
    const loggedIn = ['dash','ref','contest','sport','support','agency'].includes(view);
    const active = this.account && this.account.status==='active';
    document.getElementById('bottomnav').classList.toggle('hidden', !active || !loggedIn);
    if (this.account){
      document.querySelectorAll('.nav-item').forEach(n=>n.classList.toggle('on', n.dataset.nav===view));
    }
    // قسيمة الرهان تظهر فقط داخل قسم التوقعات
    if(view!=='sport'){ this.closeSlip(); const f=document.getElementById('slipFab'); if(f) f.classList.add('hidden'); }
    else { this.updateSlipFab(); }
  },
  nav(v){
    if (v==='dash'||v==='ref') this.show(v);
    else if(v==='contest'){ this.show('contest'); this.loadContest(); }
    else if(v==='sport'){ this.show('sport'); this.sportView(this._sportView||'predictions'); }
    else if(v==='support'){ this.show('support'); this.initChat(); }
    else if(v==='agency'){ this.show('agency'); this.renderPayStrip(); }
  },

  // ═══ نقطتا الدخول: تسجيل جديد / لدي حساب ═══
  startRegister(){ this.show('regsteps'); },
  openLogin(){ this._verifyMode='login'; this.openVerify('login'); },
  openVerify(mode){
    this._verifyMode = mode || this._verifyMode || 'register';
    const T=window.TEXTS[this.lang];
    document.getElementById('verifyTitle').textContent = this._verifyMode==='login'?T.verify_title_login:T.verify_title_reg;
    document.getElementById('verifySub').textContent = this._verifyMode==='login'?T.verify_sub_login:T.verify_sub_reg;
    document.getElementById('verifyBtn').textContent = this._verifyMode==='login'?T.cta_have_account:T.cta_verify||T.rs_have_deposited;
    document.getElementById('verifyErr').textContent=''; document.getElementById('verifyErr').classList.remove('show');
    document.getElementById('gidInput').value='';
    this.show('verify');
    setTimeout(()=>document.getElementById('gidInput').focus(),300);
  },

  // ── toast ──
  toast(msg){
    const t=document.getElementById('toast'); t.textContent=msg; t.classList.add('show');
    clearTimeout(this._tt); this._tt=setTimeout(()=>t.classList.remove('show'),3400);
  },

  // ── sheets ──
  openSheet(html){
    document.getElementById('sheet').innerHTML = `<div class="sheet-grip"></div>${html}`;
    document.getElementById('sheetBg').classList.add('show');
  },
  closeSheet(){ document.getElementById('sheetBg').classList.remove('show'); },
  closeSheetBg(e){ if (e.target.id==='sheetBg') this.closeSheet(); },

  // ═══ VERIFY FLOW ═══
  async doVerify(){
    const raw = document.getElementById('gidInput').value;
    const gid = raw.replace(/[\s\-_]/g,'');
    const err = document.getElementById('verifyErr');
    err.textContent=''; err.classList.remove('show');
    if (!/^\d{6,13}$/.test(gid)){ this.showVerifyErr(this.t('verify_invalid')); return; }

    const btn=document.getElementById('verifyBtn'); btn.style.opacity='.6'; btn.disabled=true;
    const fp=await this.fingerprint();
    const seqPromise = this.runSequence();
    const r = await this.api('verify',{ game_id: gid, fingerprint: fp });
    await seqPromise;
    btn.style.opacity='1'; btn.disabled=false;

    if (r.status==='invalid'){ this.endSequence(false); this.showVerifyErr(this.t('verify_invalid')); return; }
    if (r.status==='banned'){ this.endSequence(false); this.showVerifyErr(this.t('verify_banned')); return; }

    const mode = this._verifyMode || 'register';

    if (r.status==='existing'){
      // حساب موجود في نظامنا
      await this.endSequence(true);
      if (r.account_status==='active'){ return this.login(gid); }
      // قيد المراجعة → الدخول لكن يبقى في شاشة الانتظار
      return this.login(gid);
    }

    // معرّف غير موجود في نظامنا
    if (mode==='login'){
      // وضع "لدي حساب" يقبل فقط المعتمدين
      this.endSequence(false);
      this.showVerifyErr(r.status==='not_found' ? this.t('verify_notfound') : this.t('login_not_found'));
      return;
    }

    // وضع التسجيل: المعرّف يجب أن يكون موجوداً في 1xBet
    if (r.status==='not_found'){ this.endSequence(false); this.showVerifyErr(this.t('verify_notfound')); return; }

    // معرّف جديد موجود في 1xBet → عرض بطاقة الهوية ثم بدء التسجيل (pending)
    this._verifyData = { game_id: gid, name: r.name, currency: r.currency };
    await this.endSequence(true);
    this.renderPresent();
  },
  showVerifyErr(msg){
    const err=document.getElementById('verifyErr');
    err.textContent=msg; err.classList.add('show');
  },

  // honest multi-stage sequence — advances while real call is in flight
  runSequence(){
    const seq=document.getElementById('seq');
    const T=window.TEXTS[this.lang];
    const steps=['seq1','seq2','seq3','seq4'];
    const box=document.getElementById('seqSteps');
    box.innerHTML = steps.map((k,i)=>`<div class="seq-step" data-i="${i}"><div class="seq-tick"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M5 13l4 4L19 7"/></svg></div><span>${T[k]}</span></div>`).join('');
    document.getElementById('seqLoader').style.display='flex';
    document.getElementById('seqSuccess').classList.remove('show');
    seq.classList.add('show');
    return new Promise(resolve=>{
      let i=0;
      const els=[...box.querySelectorAll('.seq-step')];
      els[0].classList.add('active');
      this._seqTimer=setInterval(()=>{
        if (i<els.length){ els[i].classList.remove('active'); els[i].classList.add('done'); }
        i++;
        if (i<els.length) els[i].classList.add('active');
        else { clearInterval(this._seqTimer); resolve(); }
      },560);
    });
  },
  async endSequence(success){
    clearInterval(this._seqTimer);
    const seq=document.getElementById('seq');
    if (!success){ seq.classList.remove('show'); return; }
    document.getElementById('seqLoader').style.display='none';
    document.getElementById('seqDoneTxt').textContent=this.t('seq_done');
    document.getElementById('seqSuccess').classList.add('show');
    await new Promise(r=>setTimeout(r,1100));
    seq.classList.remove('show');
  },

  // ═══ ACCOUNT PRESENTATION ═══
  renderPresent(){
    const d=this._verifyData, T=window.TEXTS[this.lang];
    const initial=(d.name||'O').trim().charAt(0).toUpperCase()||'O';
    document.getElementById('identityCard').innerHTML=`
      <div class="id-top">
        <div class="id-avatar">${initial}</div>
        <div><div class="id-name">${this.esc(d.name||'—')}</div>
        <div class="verified-badge"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 2l8 4v6c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6z"/><path d="M9 12l2 2 4-4"/></svg>${T.present_verified}</div></div>
      </div>
      <div class="id-rows">
        <div class="id-row"><span class="k">${T.present_id}</span><span class="v mono">${this.esc(d.game_id)}</span></div>
        <div class="id-row"><span class="k">${T.present_currency}</span><span class="v">${this.esc(d.currency)}</span></div>
        <div class="id-row"><span class="k">${T.present_status}</span><span class="v" style="color:var(--accent)">${T.present_verified}</span></div>
      </div>
      <div class="protect-banner">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l8 4v6c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6z"/><path d="M9 12l2 2 4-4"/></svg>
        <span>${T.banner_protect}</span>
      </div>`;
    this.show('present');
  },

  // ═══ IDENTITY PROTECTION NOTICE ═══
  openNotice(){
    const T=window.TEXTS[this.lang];
    const ck=`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M5 13l4 4L19 7"/></svg>`;
    this.openSheet(`
      <h3>${T.notice_title}</h3>
      <div class="notice-list">
        <div class="notice-item">${this.iShield()}<span>${T.notice_1}</span></div>
        <div class="notice-item">${this.iShield()}<span>${T.notice_2}</span></div>
        <div class="notice-item">${this.iShield()}<span>${T.notice_3}</span></div>
      </div>
      <div class="check-row" id="noticeCheck" onclick="App.toggleCheck()">
        <div class="check-box">${ck}</div><span>${T.notice_check}</span>
      </div>
      <button class="btn btn-primary" id="noticeBtn" style="opacity:.5;pointer-events:none" onclick="App.openPin()">${T.notice_btn}</button>
    `);
  },
  toggleCheck(){
    const c=document.getElementById('noticeCheck'); c.classList.toggle('on');
    const b=document.getElementById('noticeBtn');
    const on=c.classList.contains('on');
    b.style.opacity=on?'1':'.5'; b.style.pointerEvents=on?'auto':'none';
  },

  // ═══ PIN (optional) ═══
  openPin(){
    const T=window.TEXTS[this.lang]; this._pin='';
    const keys=[1,2,3,4,5,6,7,8,9,'skip',0,'del'];
    this.openSheet(`
      <h3>${T.pin_title}</h3><div class="sub">${T.pin_sub}</div>
      <div class="pin-display" id="pinDisplay">${'<div class="pin-dot"></div>'.repeat(4)}</div>
      <div class="keypad">${keys.map(k=>{
        if(k==='skip') return `<button class="key fn" onclick="App.finishActivation()">${T.pin_skip}</button>`;
        if(k==='del') return `<button class="key fn" onclick="App.pinDel()">⌫</button>`;
        return `<button class="key" onclick="App.pinAdd(${k})">${k}</button>`;
      }).join('')}</div>
    `);
  },
  pinAdd(n){ if(this._pin.length>=4)return; this._pin+=n; this.renderPin();
    if(this._pin.length===4) setTimeout(()=>this.finishActivation(),200); },
  pinDel(){ this._pin=this._pin.slice(0,-1); this.renderPin(); },
  renderPin(){ document.querySelectorAll('#pinDisplay .pin-dot').forEach((d,i)=>d.classList.toggle('on',i<this._pin.length)); },

  // ═══ ACTIVATION: register account + trust device ═══
  async finishActivation(){
    const T=window.TEXTS[this.lang];
    const ck=`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M5 13l4 4L19 7"/></svg>`;
    // device-init visual
    this.openSheet(`
      <h3>${T.dev_init}</h3>
      <div class="dev-steps" id="devSteps">
        <div class="dev-row" data-d="0"><div class="d">${ck}</div><span>${T.dev_secured}</span></div>
        <div class="dev-row" data-d="1"><div class="d">${ck}</div><span>${T.dev_session}</span></div>
        <div class="dev-row" data-d="2"><div class="d">${ck}</div><span>${T.dev_access}</span></div>
      </div>
    `);
    const rows=[...document.querySelectorAll('#devSteps .dev-row')];

    const fp=await this.fingerprint();
    const payload={
      game_id:this._verifyData.game_id, lang:this.lang, fingerprint:fp,
      user_agent:navigator.userAgent, ref_code:this.getRefFromUrl(),
      pin: this._pin.length===4 ? this._pin : '',
    };
    const reqP=this.api('register',payload);

    // animate device steps
    for(let i=0;i<rows.length;i++){ await new Promise(r=>setTimeout(r,480)); rows[i].classList.add('done'); }
    const r=await reqP;

    if(r.status==='banned'){ this.closeSheet(); this.toast(T.verify_banned); return; }
    if(r.status==='not_found'){ this.closeSheet(); this.showVerifyErr(T.verify_notfound); this.show('verify'); return; }
    if(!r.ok){ this.closeSheet(); this.toast('Error'); return; }

    Store.s=r.session; this.account=r.account; this.stats=null;
    await new Promise(r=>setTimeout(r,400));
    this.closeSheet();
    await this.initOneSignal(this.account.game_id);
    this.loadAndShowDash();
  },

  // ═══ LOGIN (existing account) ═══
  async login(gid){
    const fp=await this.fingerprint();
    const r=await this.api('register',{ game_id:gid, lang:this.lang, fingerprint:fp, user_agent:navigator.userAgent });
    if(!r.ok){ this.toast('Error'); return; }
    Store.s=r.session; this.account=r.account;
    await this.initOneSignal(gid);
    this.toast(this.t('welcome_back'));
    this.loadAndShowDash();
  },

  // ═══ DASHBOARD ═══
  async loadAndShowDash(){
    const fp=await this.fingerprint();
    const r=await this.api('me',{ session:Store.s, fingerprint:fp });
    if(r.error==='no_session'||r.error==='banned'){ this.logout(); return; }
    if(r.ok){ this.account=r.account; this.stats=r.stats; this._deviceTrusted=r.device_trusted; this.contest=r.contest;
      (r.notifications||[]).forEach(n=>this.toast(n.body||n.title)); }
    // حجب لوحة التحكم حتى التفعيل
    if(!this.account || this.account.status!=='active'){ this.showPending(); return; }
    this.show('dash'); this.renderDash();
  },

  // ═══ شاشة الانتظار (تحجب الرئيسية حتى التفعيل) ═══
  showPending(){
    const gid = this.account ? this.account.game_id : '';
    const el=document.getElementById('pendingIdVal'); if(el) el.textContent=gid;
    // إظهار لافتة الإشعارات إن لم يُمنح الإذن بعد
    this.refreshNotifBanner();
    this.show('pending');
  },
  refreshNotifBanner(){
    let granted=false;
    try{ granted=(typeof Notification!=='undefined' && Notification.permission==='granted'); }catch{}
    const banner=document.getElementById('notifBanner');
    if(banner) banner.style.display = granted ? 'none' : 'flex';
    const dot=document.getElementById('notifDot');
    if(dot) dot.classList.toggle('hidden', granted);
  },
  async askNotif(){
    if(!window.OneSignalDeferred){ return; }
    window.OneSignalDeferred.push(async (OneSignal)=>{
      try{ await OneSignal.Notifications.requestPermission(); }catch{}
      try{ localStorage.setItem('oc_notif_asked','1'); }catch{}
      this.refreshNotifBanner();
    });
  },

  // ═══ نافذة الإشعارات المنبثقة (عند الدخول) ═══
  maybeShowNotifModal(){
    let granted=false, asked=false;
    try{ granted=(typeof Notification!=='undefined' && Notification.permission==='granted'); }catch{}
    try{ asked=localStorage.getItem('oc_notif_modal')==='1'; }catch{}
    // أظهر النافذة مرة واحدة إن لم يُمنح الإذن بعد
    if(granted || asked) return;
    setTimeout(()=>{
      const m=document.getElementById('notifModal');
      if(m){ m.classList.remove('hidden'); requestAnimationFrame(()=>m.classList.add('show')); }
    }, 1200);
  },
  async acceptNotif(){
    try{ localStorage.setItem('oc_notif_modal','1'); }catch{}
    this.closeNotifModal();
    // طلب الإذن الحقيقي (ضمن إيماءة المستخدم = موثوق)
    if(window.OneSignalDeferred){
      window.OneSignalDeferred.push(async (OneSignal)=>{
        try{ await OneSignal.Notifications.requestPermission(); }catch{}
        try{ localStorage.setItem('oc_notif_asked','1'); }catch{}
        this.refreshNotifBanner();
      });
    }
  },
  dismissNotif(){ try{ localStorage.setItem('oc_notif_modal','1'); }catch{} this.closeNotifModal(); },
  closeNotifModal(){
    const m=document.getElementById('notifModal');
    if(m){ m.classList.remove('show'); setTimeout(()=>m.classList.add('hidden'),250); }
  },
  async checkActivation(){
    const fp=await this.fingerprint();
    const r=await this.api('me',{ session:Store.s, fingerprint:fp });
    if(r.ok){ this.account=r.account; this.stats=r.stats; this.contest=r.contest; }
    if(this.account && this.account.status==='active'){
      this.toast(this.t('welcome_back'));
      this.show('dash'); this.renderDash();
    } else {
      this.toast(this.t('pending_not_yet'));
    }
  },

  renderDash(){
    if(!this.account) return;
    const a=this.account, T=window.TEXTS[this.lang], s=this.stats||{activated:0,earned:0};
    const initial=(a.name||'O').trim().charAt(0).toUpperCase()||'O';
    document.getElementById('dashAvatar').textContent=initial;
    document.getElementById('dashName').textContent=a.name||a.game_id;
    document.getElementById('balAmt').textContent=(a.balance_um||0).toLocaleString();
    document.getElementById('statRefs').textContent=s.activated||0;
    document.getElementById('statEarned').textContent=(s.earned||0)+' UM';

    // status pill
    const map={active:'st_active',pending:'st_pending',deposit_incomplete:'st_deposit',banned:'st_banned'};
    const cls={active:'st-active',pending:'st-pending',deposit_incomplete:'st-deposit',banned:'st-deposit'};
    const st=a.status||'pending';
    document.getElementById('statStatus').innerHTML=`<span class="status-pill ${cls[st]}"><span class="d"></span>${T[map[st]]}</span>`;

    // deposit-incomplete: show exact needed amount + deadline
    const dw=document.getElementById('depositWarn');
    if(st==='deposit_incomplete'){
      dw.classList.remove('hidden');
      const need=a.deposit_needed||0;
      dw.querySelector('span').innerHTML=`${T.deposit_needed_msg} <b style="color:var(--accent)">${need} UM</b><br>${T.deposit_deadline_msg}`;
    } else dw.classList.add('hidden');

    // contest banner on dashboard
    this.renderContestBanner();

    // timeline
    const acts=[
      {ic:this.iShield(),b:T.act_verified},
      {ic:this.iDevice(),b:T.act_device},
      {ic:this.iLock(),b:T.act_protect},
    ];
    document.getElementById('timeline').innerHTML=acts.map(x=>`
      <div class="tl-item"><div class="tl-dot"><div class="tl-ic">${x.ic}</div></div>
      <div class="tl-txt"><b>${x.b}</b><span>${a.game_id}</span></div></div>`).join('');

    // referral mirror
    this.renderRef();
  },

  renderContestBanner(){
    let el=document.getElementById('contestBanner');
    if(!this.contest){ if(el) el.remove(); return; }
    const T=window.TEXTS[this.lang];
    if(!el){
      el=document.createElement('div'); el.id='contestBanner'; el.className='contest-banner';
      el.onclick=()=>this.nav('contest');
      const dw=document.getElementById('depositWarn');
      dw.parentNode.insertBefore(el, dw.nextSibling);
    }
    el.innerHTML=`<div class="cb-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 21h8M12 17v4M7 4h10v4a5 5 0 01-10 0z"/></svg></div>
      <div class="cb-txt"><b>${T.contest_banner}</b><span>${this.contest.prize_um} UM · ${this.contest.my_refs||0} ${T.contest_refs_label}</span></div>
      <svg class="cb-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>`;
  },

  // ═══ REFERRAL ═══
  renderRef(){
    if(!this.account) return;
    const link=`${location.origin}/?ref=${this.account.ref_code}`;
    document.getElementById('refLink').textContent=link;
    const s=this.stats||{activated:0,earned:0};
    document.getElementById('refStatRefs').textContent=s.activated||0;
    document.getElementById('refStatEarned').textContent=(s.earned||0)+' UM';
    // mirror nav labels
    const T=window.TEXTS[this.lang];
    const setTxt=(id,txt)=>{ const el=document.getElementById(id); if(el) el.textContent=txt; };
    setTxt('t-ref_title2', T.ref_title);
    setTxt('t-dash_refs2', T.dash_refs);
    setTxt('t-dash_earned2', T.dash_earned);
  },
  copyRef(){
    const link=`${location.origin}/?ref=${this.account.ref_code}`;
    navigator.clipboard?.writeText(link).then(()=>this.toast(this.t('ref_copied')))
      .catch(()=>{ const t=document.createElement('textarea'); t.value=link; document.body.appendChild(t); t.select(); document.execCommand('copy'); t.remove(); this.toast(this.t('ref_copied')); });
  },
  async shareRef(){
    const link=`${location.origin}/?ref=${this.account.ref_code}`;
    const text=`${this.t('ref_share_msg')} ${link}`;
    if(navigator.share){ try{ await navigator.share({title:'OussoCash',text,url:link}); return; }catch{} }
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`,'_blank');
  },
  getRefFromUrl(){
    // 1) من المسار /r/CODE
    const m=location.pathname.match(/^\/r\/([A-Za-z0-9]{4,8})/);
    let code = m ? m[1].toUpperCase() : '';
    // 2) من ?ref=CODE
    if(!code){ const p=new URLSearchParams(location.search).get('ref'); if(p) code=p.toUpperCase(); }
    // 3) خزّنها لتبقى بعد التنقل
    if(code){ try{ localStorage.setItem('oc_ref', code); }catch{} return code; }
    // 4) المخزّنة سابقاً
    try{ return localStorage.getItem('oc_ref')||''; }catch{ return ''; }
  },

  // ═══ WITHDRAW ═══
  openWithdraw(){
    const T=window.TEXTS[this.lang], a=this.account;
    if((a.balance_um||0)<300){
      this.openSheet(`<h3>${T.wd_title}</h3><div class="warn-box" style="margin-top:8px"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 9v4M12 17h.01"/><circle cx="12" cy="12" r="10"/></svg><span>${T.wd_insufficient}</span></div><button class="btn btn-ghost" style="margin-top:16px" onclick="App.closeSheet();App.nav('ref')">${T.ref_share}</button>`);
      return;
    }
    // السحب يذهب إلى حساب 1xBet المرتبط (لا تطبيقات بنكية)
    this.openSheet(`
      <h3>${T.wd_title}</h3>
      <div class="sub">${T.wd_balance}: <b style="color:var(--accent)">${(a.balance_um).toLocaleString()} UM</b></div>
      <div class="wd-target">
        <div class="wd-target-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 7v10M8 9h6a2 2 0 010 4H8m0 0h6"/></svg></div>
        <div><span>${T.wd_to_1xbet}</span><b>${a.game_id}</b></div>
      </div>
      <p class="field-note" style="margin:14px 0">${T.wd_note_1xbet}</p>
      <button class="btn btn-primary" id="wdBtn" onclick="App.submitWithdraw()">${T.wd_confirm}</button>
    `);
  },
  async submitWithdraw(){
    const T=window.TEXTS[this.lang];
    const fp=await this.fingerprint();
    const btn=document.getElementById('wdBtn'); if(btn){ btn.disabled=true; btn.style.opacity='.6'; }
    // السحب يذهب إلى حساب 1xBet المرتبط
    const r=await this.api('withdraw',{ session:Store.s, fingerprint:fp, method:'1xbet', account_number:this.account.game_id });
    if(r.error==='pending_exists'){ this.toast(T.wd_pending); if(btn){btn.disabled=false;btn.style.opacity='1';} return; }
    if(r.error==='insufficient'){ this.toast(T.wd_insufficient); if(btn){btn.disabled=false;btn.style.opacity='1';} return; }
    if(!r.ok){ this.toast('Error'); if(btn){btn.disabled=false;btn.style.opacity='1';} return; }
    this.account.balance_um=0;
    this.closeSheet(); this.renderDash(); this.toast(T.wd_sent);
  },

  // ═══ SUPPORT ═══
  openSupport(){
    const T=window.TEXTS[this.lang];
    const items=[[T.support_verify,this.iShield()],[T.support_device,this.iDevice()],[T.support_wd,this.iCash()],[T.support_review,this.iSearch()]];
    const phoneDisp='+222 '+SUPPORT_PHONE.replace(/^222/,'').replace(/(\d{2})(\d{2})(\d{2})(\d{2})/,'$1 $2 $3 $4');
    this.openSheet(`
      <h3>${T.support_title}</h3><div class="sub">${T.support_sub}</div>
      <div class="support-grid">${items.map(i=>`<div class="sup-item">${i[1]}<span>${i[0]}</span></div>`).join('')}</div>
      <button class="btn btn-primary" onclick="App.openWhatsapp()">${T.support_open}</button>
      <button class="btn btn-ghost" style="margin-top:10px" onclick="App.openSupportPhone()">${T.support_phone_btn} · ${phoneDisp}</button>
      <button class="btn btn-ghost" style="margin-top:10px" onclick="window.open('${OFFICIAL_CHANNEL}','_blank')">${T.support_channel}</button>
    `);
  },
  openSupportPhone(){
    const id=this.account?this.account.game_id:'';
    const msg=this.lang==='ar'?`دعم OussoCash · المعرّف: ${id}`:`Support OussoCash · ID: ${id}`;
    window.open(`https://wa.me/${SUPPORT_PHONE}?text=${encodeURIComponent(msg)}`,'_blank');
  },
  openWhatsapp(){
    const id=this.account?this.account.game_id:'';
    const msg=this.lang==='ar'?`دعم OussoCash · المعرّف: ${id}`:`Support OussoCash · ID: ${id}`;
    window.open(`https://wa.me/${SUPPORT_WA}?text=${encodeURIComponent(msg)}`,'_blank');
  },

  // ═══ OneSignal ═══
  async initOneSignal(gid){
    if(!OS_APP_ID || !window.OneSignalDeferred) return;
    window.OneSignalDeferred.push(async (OneSignal)=>{
      try{
        if(!this._osInit){
          await OneSignal.init({
            appId:OS_APP_ID,
            allowLocalhostAsSecureOrigin:true,
            autoResubscribe:true,
            notifyButton:{ enable:false },
          });
          this._osInit=true;
        }
        await OneSignal.login(String(gid));
        // طلب الإذن بلطف بعد ثانيتين من الدخول (مرة واحدة)
        const asked = (()=>{ try{ return localStorage.getItem('oc_notif_asked'); }catch{ return null; } })();
        if(!asked){
          setTimeout(async()=>{
            try{ await OneSignal.Notifications.requestPermission(); }catch{}
            try{ localStorage.setItem('oc_notif_asked','1'); }catch{}
          }, 2500);
        }
      }catch{}
    });
  },

  // ═══ PWA INSTALL ═══
  renderLeagues(){
    const box=document.getElementById('leaguesGrid');
    if(!box) return;
    const C='https://crests.football-data.org/';
    const leagues=[
      {n:'Premier League',      img:C+'PL.png'},
      {n:'La Liga',             img:C+'PD.png'},
      {n:'Serie A',             img:C+'SA.png'},
      {n:'Bundesliga',          img:C+'BL1.png'},
      {n:'Ligue 1',             img:C+'FL1.png'},
      {n:'Champions League',    img:C+'CL.png'},
      {n:'Europa League',       img:C+'EL.png'},
      {n:'Conf. League',        img:C+'UECL.png'},
      {n:'Eredivisie',          img:C+'DED.png'},
      {n:'Primeira Liga',       img:C+'PPL.png'},
      {n:'Championship',        img:C+'ELC.png'},
      {n:'Brasileirão',         img:C+'BSA.png'},
      {n:'Copa Libertadores',   img:C+'CLI.png'},
      {n:'Süper Lig',           img:C+'TL1.png'},
      {n:'MLS',                 img:C+'MLS.png'},
      {n:'World Cup',           img:C+'WC.png'},
      {n:'Saudi Pro League',    img:''},
      {n:'Serie A (BRA)',       img:C+'BSA.png'},
      {n:'Scottish Prem.',      img:''},
      {n:'Ekstraklasa',         img:''},
      {n:'AFCON',               img:''},
      {n:'CAF Champions',       img:''},
    ];
    box.innerHTML=leagues.map(l=>`
      <div class="league-chip">
        ${l.img?`<img src="${l.img}" onerror="this.style.display='none'" alt="">`:
          `<span class="league-chip-ic">⚽</span>`}
        <span>${l.n}</span>
      </div>`).join('');
  },
  renderPayStrip(){
    const track=document.getElementById('payTrack');
    if(!track || track.dataset.done) return;
    // أسماء ملفات الصور فقط (تُعرض اللوجوهات بدون أسماء)
    const pays=['bankily','masrivi','sedad','click','moov_money','amanty','Bim_bank',
      'Bamis_digital','Picy_pay','Rassidy','Gaza_pay','Attijari_apay','baridcash','gimtel'];
    // مضاعفة للحركة السلسة (loop)
    const items=[...pays,...pays].map(f=>
      `<div class="pay-chip"><img src="/pay/${f}.jpg" onerror="this.parentElement.style.display='none'" alt=""></div>`
    ).join('');
    track.innerHTML=items;
    track.dataset.done='1';
  },
  setupPWA(){
    // تسجيل service worker للتثبيت
    if('serviceWorker' in navigator){
      navigator.serviceWorker.register('/sw.js').catch(()=>{});
    }
    // التقاط حدث التثبيت (Android/Chrome)
    window.addEventListener('beforeinstallprompt',(e)=>{
      e.preventDefault();
      this._deferredPrompt=e;
      document.getElementById('installBtn')?.classList.remove('hidden');
    });
    window.addEventListener('appinstalled',()=>{
      document.getElementById('installBtn')?.classList.add('hidden');
      this._deferredPrompt=null;
      this.toast(this.lang==='fr'?'Application installée !':'تم تثبيت التطبيق!');
    });
    // iOS لا يدعم beforeinstallprompt → أظهر الزر يدوياً إن لم يكن مثبّتاً
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    if(isIOS && !isStandalone){
      document.getElementById('installBtn')?.classList.remove('hidden');
      this._iosInstall=true;
    }
  },
  async installApp(){
    if(this._iosInstall){ this.toast(this.t('install_ios')); return; }
    if(!this._deferredPrompt){ this.toast(this.t('install_ios')); return; }
    this._deferredPrompt.prompt();
    await this._deferredPrompt.userChoice.catch(()=>{});
    this._deferredPrompt=null;
    document.getElementById('installBtn')?.classList.add('hidden');
  },

  logout(){ Store.s=null; this.account=null; this.stats=null; this._chatInit=false; document.getElementById('chatMsgs')&&(document.getElementById('chatMsgs').innerHTML=''); this.show('landing'); document.getElementById('bottomnav').classList.add('hidden'); },

  // ═══ FEEDBACK (ساهم في تطوير) ═══
  openFeedback(){
    const T=window.TEXTS[this.lang];
    const kinds=[['feature',T.fb_kind_feature],['ui',T.fb_kind_ui],['sport',T.fb_kind_sport],['ref',T.fb_kind_ref],['bug',T.fb_kind_bug],['other',T.fb_kind_other]];
    this.openSheet(`
      <h3>${T.fb_title}</h3>
      <div class="sub">${T.fb_sub}</div>
      <label class="fb-label">${T.fb_kind}</label>
      <select id="fbKind" class="fb-select">${kinds.map(k=>`<option value="${k[0]}">${k[1]}</option>`).join('')}</select>
      <div class="field" style="margin-top:12px"><input id="fbTitle" placeholder="${T.fb_title_ph}" maxlength="120"></div>
      <textarea id="fbBody" class="fb-textarea" placeholder="${T.fb_body_ph}" maxlength="1500" rows="4"></textarea>
      <button class="btn btn-primary" style="margin-top:14px" onclick="App.sendFeedback()">${T.fb_send}</button>
    `);
  },
  async sendFeedback(){
    const T=window.TEXTS[this.lang];
    const kind=document.getElementById('fbKind').value;
    const title=document.getElementById('fbTitle').value.trim();
    const bodyTxt=document.getElementById('fbBody').value.trim();
    if(bodyTxt.length<5){ this.toast(T.fb_short); return; }
    const r=await this.api('feedback',{ session:Store.s, kind, title, body:bodyTxt });
    this.closeSheet();
    this.toast(T.fb_thanks);
  },

  // ═══ AGENCY ═══
  openRegLink(){ window.open(REG_LINK,'_blank'); },
  copyPromo(){
    navigator.clipboard?.writeText('OUSSO').then(()=>this.toast(this.t('agency_promo_copied')))
      .catch(()=>this.toast(this.t('agency_promo_copied')));
  },
  openVideo(){
    this.openSheet(`
      <h3>${this.t('agency_video_btn')}</h3>
      <iframe class="video-frame" src="${VIDEO_REGISTER}" allow="autoplay; fullscreen; encrypted-media" allowfullscreen></iframe>
      <button class="btn btn-primary" style="margin-top:14px" onclick="App.openRegLink()">${this.t('agency_reg_btn')}</button>
    `);
  },

  // ═══ CONTEST ═══
  // بانر القناة الرسمية (يظهر أعلى قسم المسابقة) — الرابط ثابت في الكود
  channelBannerHtml(){
    const T=window.TEXTS[this.lang];
    return `<a class="channel-banner" href="${OFFICIAL_CHANNEL}" target="_blank" rel="noopener">
      <div class="channel-banner-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 11l18-7-7 18-2.5-7.5z"/><path d="M11.5 13.5L21 4"/></svg></div>
      <div class="channel-banner-txt"><b>${T.channel_banner_t}</b><span>${T.channel_banner_d}</span></div>
      <svg class="channel-banner-go" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 6l6 6-6 6"/></svg>
    </a>`;
  },
  async loadContest(){
    const T=window.TEXTS[this.lang];
    const body=document.getElementById('contestBody');
    body.innerHTML=`<div class="card" style="text-align:center;color:var(--txt-3);padding:40px 20px">…</div>`;
    const r=await this.api('contest',{ session:Store.s });
    if(!r.contest){
      body.innerHTML=this.channelBannerHtml()+`<div class="card" style="text-align:center;padding:40px 22px">
        <div class="contest-empty-ic">${this.iTrophy()}</div>
        <p style="color:var(--txt-2);font-size:14px;margin-top:14px">${T.contest_none}</p></div>`;
      return;
    }
    const c=r.contest, lb=r.leaderboard||[], me=r.me||{};
    const title=this.lang==='fr'&&c.title_fr?c.title_fr:c.title;
    const ends=this.countdown(c.ends_at);
    const medal=['①','②','③'];
    body.innerHTML=`
      ${this.channelBannerHtml()}
      <div class="contest-hero">
        <div class="contest-trophy">${this.iTrophy()}</div>
        <div class="contest-prize-val">${c.prize_um.toLocaleString()} <small>UM</small></div>
        <div class="contest-prize-lbl">${title}</div>
        <div class="contest-meta">
          <div><span>${T.contest_ends}</span><b>${ends}</b></div>
          <div><span>${T.contest_required}</span><b>${c.required_refs}</b></div>
        </div>
      </div>
      <div class="contest-me">
        <div><span>${T.contest_your_rank}</span><b>${me.rank?'#'+me.rank:'—'}</b></div>
        <div><span>${T.contest_your_refs}</span><b>${me.refs||0}</b></div>
      </div>
      <button class="btn btn-primary" style="margin-top:14px" onclick="App.nav('ref')">${T.contest_join}</button>
      <div class="section-h" id="">${T.contest_leaderboard}</div>
      <div class="card" style="padding:8px 16px">
        ${lb.length?lb.map(x=>`
          <div class="lb-row ${me.rank===x.rank?'lb-me':''}">
            <div class="lb-rank ${x.rank<=3?'lb-top':''}">${x.rank<=3?medal[x.rank-1]:x.rank}</div>
            <div class="lb-name">${this.esc(x.name)}</div>
            <div class="lb-refs">${x.refs} <small>${T.contest_refs_label}</small></div>
          </div>`).join(''):`<div style="text-align:center;color:var(--txt-3);padding:24px;font-size:13px">—</div>`}
      </div>`;
  },
  countdown(iso){
    const T=window.TEXTS[this.lang];
    const ms=new Date(iso)-new Date();
    if(ms<=0) return '—';
    const d=Math.floor(ms/864e5), h=Math.floor((ms%864e5)/36e5);
    return d>0?`${d} ${T.contest_days} ${h} ${T.contest_hours}`:`${h} ${T.contest_hours}`;
  },

  // ═══ SPORT ═══
  async sportView(v){
    this._sportView=v;
    document.querySelectorAll('.sport-tab').forEach(t=>t.classList.toggle('on', t.dataset.sv===v));
    const body=document.getElementById('sportBody');
    const T=window.TEXTS[this.lang];
    // تاريخ الرأس
    const dateEl=document.getElementById('sportDate');
    if(dateEl){
      const now=new Date();
      let d=now;
      if(v==='tomorrow') d=new Date(+now+864e5);
      else if(v==='yesterday') d=new Date(+now-864e5);
      try{ dateEl.textContent=d.toLocaleDateString(this.lang==='fr'?'fr-FR':'ar',{weekday:'long',day:'numeric',month:'long'}); }catch{}
      dateEl.style.display=(v==='standings'||v==='predictions')?'none':'block';
    }
    body.innerHTML=this.sportSkeleton(v);
    if(v==='standings'){ await this.renderStandingsHub(); this.updateSlipFab(); return; }
    const r=await this.api('sport',{ view:v, lang:this.lang });
    if(r.error){ body.innerHTML=`<div class="sport-empty">${this.sportEmptyIcon()}<span>${T.sport_unavailable}</span></div>`; this.updateSlipFab(); return; }

    if(v==='predictions'){
      // تجهيز قسيمة الرهان
      this._slip=r.slip||[];
      if(!this._slipSel){ this._slipSel=new Set(this._slip.slice(0,3).map(x=>x.event_id)); }
      this.updateSlipFab();
      let html='';
      // أفضل توقع منفرد (بطاقة بطل)
      if(r.top_pick){ html+=this.heroPick(r.top_pick); }
      // قسيمة اليوم — أفضل التوقعات موثوقية
      if(r.coupon && r.coupon.length){
        html+=`<div class="coupon-card">
          <div class="coupon-card-head">
            <div class="coupon-card-title"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16v5a2 2 0 000 6v5H4v-5a2 2 0 000-6z"/><path d="M9 9l6 6M15 9l-6 6"/></svg><b>${T.sport_coupon}</b></div>
            <span class="coupon-card-sub">${T.sport_coupon_sub}</span>
          </div>
          <div class="coupon-list">${r.coupon.map((p,i)=>this.couponRow(p,i+1)).join('')}</div>
        </div>`;
      }
      if(r.predictions && r.predictions.length){
        html+=`<div class="sport-sec-title">${T.sport_all_preds||T.sport_predictions} <small>${T.sport_tap_hint||''}</small></div>`;
        html+=`<div class="pred-grid">${r.predictions.map(p=>this.predCard(p)).join('')}</div>`;
        html+=`<div class="sport-disclaimer">${T.sport_disclaimer}</div>`;
      }
      if(!html) html=`<div class="sport-empty">${this.sportEmptyIcon()}<span>${T.sport_no_matches}</span></div>`;
      body.innerHTML=html;
      return;
    }

    // المباريات — مجمّعة حسب الدوري (طراز FotMob)
    if(r.matches && r.matches.length){
      const groups={};
      r.matches.forEach(m=>{ const k=m.league||'—'; (groups[k]=groups[k]||{league:m.league,logo:m.league_logo,items:[]}).items.push(m); });
      let html='';
      Object.values(groups).forEach(g=>{
        html+=`<div class="lg-group">
          <div class="lg-group-head"><img src="${g.logo||''}" onerror="this.style.display='none'"><span>${this.esc(g.league)}</span></div>
          <div class="lg-group-body">${g.items.map(m=>this.matchCard(m)).join('')}</div>
        </div>`;
      });
      body.innerHTML=html;
    } else {
      body.innerHTML=`<div class="sport-empty">${this.sportEmptyIcon()}<span>${T.sport_no_matches}</span></div>`;
    }
    this.updateSlipFab();
  },
  sportEmptyIcon(){
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:48px;height:48px;opacity:.3"><circle cx="12" cy="12" r="10"/><path d="M12 2a15 15 0 010 20M12 2a15 15 0 000 20M2 12h20"/></svg>`;
  },
  couponRow(p,rank){
    const conf=p.confidence||0;
    const cc=conf>=70?'high':conf>=60?'mid':'low';
    return `<div class="coupon-row" onclick="App.openMatch(${p.event_id||0})">
      <div class="coupon-rank">${rank||''}</div>
      <div class="coupon-mid">
        <div class="coupon-teams">${this.esc(p.home)} <em>—</em> ${this.esc(p.away)}</div>
        <div class="coupon-pick"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.2l-3.5-3.5L4 14.2 9 19l11-11-1.5-1.4z"/></svg>${this.esc(p.tip)}</div>
      </div>
      <div class="coupon-conf ${cc}"><b>${conf}%</b><span>${this.lang==='fr'?'conf.':'ثقة'}</span></div>
    </div>`;
  },
  // حلقة الثقة (دائرية SVG)
  confRing(conf,cls){
    const c=2*Math.PI*20, off=c*(1-(conf/100));
    return `<div class="conf-ring ${cls}"><svg viewBox="0 0 48 48"><circle class="cr-bg" cx="24" cy="24" r="20"/><circle class="cr-fg" cx="24" cy="24" r="20" stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${off.toFixed(1)}"/></svg><b>${conf}<small>%</small></b></div>`;
  },
  // بطاقة "أفضل توقع" البطل
  heroPick(p){
    const T=window.TEXTS[this.lang];
    const conf=p.confidence||50;
    const cc=conf>=70?'high':conf>=60?'mid':'low';
    let chips='';
    if(p.score) chips+=`<span class="hp-chip"><i>${T.sport_score}</i><b>${this.esc(p.score)}</b></span>`;
    if(p.over25!=null) chips+=`<span class="hp-chip"><i>+2.5</i><b>${p.over25}%</b></span>`;
    if(p.btts_yes!=null) chips+=`<span class="hp-chip"><i>BTTS</i><b>${p.btts_yes}%</b></span>`;
    if(p.dc_key) chips+=`<span class="hp-chip"><i>${T.sport_dc}</i><b>${p.dc_key} · ${p.dc_prob}%</b></span>`;
    return `<div class="hero-pick" onclick="App.openMatch(${p.event_id||0})">
      <div class="hp-head">
        <span class="hp-badge"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11z"/></svg>${T.sport_top_pick}</span>
        <span class="hp-league"><img src="${p.league_logo||''}" onerror="this.style.display='none'">${this.esc(p.league)}</span>
      </div>
      <div class="hp-body">
        <div class="hp-teams">
          <div class="hp-team"><img src="${p.home_logo||''}" onerror="this.style.visibility='hidden'"><span>${this.esc(p.home)}</span></div>
          <div class="hp-mid">${this.confRing(conf,cc)}<small>${T.sport_confidence}</small></div>
          <div class="hp-team"><img src="${p.away_logo||''}" onerror="this.style.visibility='hidden'"><span>${this.esc(p.away)}</span></div>
        </div>
        <div class="hp-pick"><span>${T.sport_pick}</span><b>${this.esc(p.tip)}</b></div>
        ${chips?`<div class="hp-chips">${chips}</div>`:''}
      </div>
    </div>`;
  },
  predCard(p){
    const T=window.TEXTS[this.lang];
    const conf=p.confidence||50;
    const cc=conf>=70?'high':conf>=60?'mid':'low';
    const probBar=`<div class="pred-probs">
      <div class="pp"><span>1</span><div class="pp-bar"><i style="width:${p.prob_home}%"></i></div><em>${p.prob_home}%</em></div>
      <div class="pp"><span>X</span><div class="pp-bar draw"><i style="width:${p.prob_draw}%"></i></div><em>${p.prob_draw}%</em></div>
      <div class="pp"><span>2</span><div class="pp-bar"><i style="width:${p.prob_away}%"></i></div><em>${p.prob_away}%</em></div>
    </div>`;
    // كل البيانات الإضافية المتاحة من الـ API
    let extra='';
    if(p.score)       extra+=`<div class="pred-chip"><span>${T.sport_score}</span><b>${this.esc(p.score)}</b></div>`;
    if(p.dc_key)      extra+=`<div class="pred-chip accent"><span>${T.sport_dc||'DC'}</span><b>${p.dc_key} · ${p.dc_prob}%</b></div>`;
    if(p.over15!=null)extra+=`<div class="pred-chip"><span>+1.5</span><b>${p.over15}%</b></div>`;
    if(p.over25!=null)extra+=`<div class="pred-chip"><span>+2.5</span><b>${p.over25}%</b></div>`;
    if(p.over35!=null)extra+=`<div class="pred-chip"><span>+3.5</span><b>${p.over35}%</b></div>`;
    if(p.btts_yes!=null)extra+=`<div class="pred-chip"><span>BTTS</span><b>${p.btts_yes}%</b></div>`;
    if(p.eg_home!=null&&p.eg_away!=null)extra+=`<div class="pred-chip"><span>xG</span><b>${p.eg_home.toFixed(1)}-${p.eg_away.toFixed(1)}</b></div>`;
    // حساسب معامل ضمني من نسبة الثقة (مرجعي)
    const implOdd=(c)=>Math.max(1.02,+((100/Math.max(2,Math.min(97,c||0)))*0.94).toFixed(2));
    const oddVal=implOdd(conf);
    let when='';
    try{ when=p.date?new Date(p.date).toLocaleString(this.lang==='fr'?'fr':'ar-u-nu-latn',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}):''; }catch{}
    return `<div class="pred-card${p.recommended?' pred-card-rec':''}" onclick="App.openMatch(${p.event_id||0})">
      <div class="pred-comp">
        <img src="${p.league_logo||''}" onerror="this.style.display='none'">
        <span>${this.esc(p.league)}</span>
        ${when?`<em class="pred-when">${when}</em>`:''}
        ${p.recommended?`<span class="pred-rec">★ ${T.sport_top_pick||'توقع مميز'}</span>`:''}
      </div>
      <div class="pred-teams">
        <div class="pred-team"><img src="${p.home_logo||''}" onerror="this.style.visibility='hidden'"><span>${this.esc(p.home)}</span></div>
        <div class="pred-vs">${T.sport_vs}</div>
        <div class="pred-team"><img src="${p.away_logo||''}" onerror="this.style.visibility='hidden'"><span>${this.esc(p.away)}</span></div>
      </div>
      ${probBar}
      <div class="pred-foot">
        <div class="pred-pick-wrap">
          <div class="pred-pick"><span>${T.sport_pick}</span><b>${this.esc(p.tip)}</b></div>
          <div class="pred-odd-badge">× ${oddVal}</div>
        </div>
        <div class="pred-conf ${cc}"><div class="conf-bar"><i style="width:${conf}%"></i></div><span>${conf}%</span></div>
      </div>
      ${extra?`<div class="pred-extra">${extra}</div>`:''}
    </div>`;
  },
  matchCard(m){
    const T=window.TEXTS[this.lang];
    const live=/inprogress|penalties|1st|2nd|halftime|extra/i.test(m.status);
    const done=/finished|ft/i.test(m.status);
    let when='';
    try{ when=m.date?new Date(m.date).toLocaleTimeString(this.lang==='fr'?'fr':'ar-u-nu-latn',{hour:'2-digit',minute:'2-digit'}):''; }catch{}
    const hasScore=(m.score_home!=null && m.score_home!=='');
    const liveLabel=m.minute?m.minute+"'":(m.period==='halftime'?(T.sport_ht||'HT'):T.sport_live);
    // عمود الحالة: مباشر بالدقيقة / النتيجة / وقت البدء
    let statusCol;
    if(live) statusCol=`<div class="mc-status live">${liveLabel}</div>`;
    else if(done) statusCol=`<div class="mc-status">${T.sport_ft||'انتهت'}</div>`;
    else statusCol=`<div class="mc-status time">${when}</div>`;
    const sH=hasScore?m.score_home:'';
    const sA=hasScore?m.score_away:'';
    return `<div class="mc" onclick="App.openMatch(${m.id})">
      <div class="mc-status-wrap">${statusCol}</div>
      <div class="mc-teams">
        <div class="mc-team"><img src="${m.home_logo||''}" onerror="this.style.visibility='hidden'"><span>${this.esc(m.home)}</span><b class="${live?'live':''}">${sH}</b></div>
        <div class="mc-team"><img src="${m.away_logo||''}" onerror="this.style.visibility='hidden'"><span>${this.esc(m.away)}</span><b class="${live?'live':''}">${sA}</b></div>
      </div>
      ${live?'<div class="mc-livebar"></div>':''}
    </div>`;
  },
  // ═══ تفاصيل المباراة (نافذة كاملة بتبويبات) ═══
  async openMatch(id){
    if(!id) return;
    const T=window.TEXTS[this.lang];
    this.openSheet(`<div class="ms-load">${this.spinner()}</div>`);
    const r=await this.api('sport',{ view:'match', event_id:id, lang:this.lang });
    const sheet=document.getElementById('sheet');
    if(!r || r.error || !r.match || !r.match.core){
      sheet.innerHTML=`<div class="sheet-grip"></div><div class="sport-empty">${this.sportEmptyIcon()}<span>${T.sport_unavailable}</span></div>`;
      return;
    }
    this._matchData=r.match;
    // التبويب الافتراضي بحسب توفر البيانات
    const tabs=this.matchTabs(r.match);
    this._mTab=tabs.includes('overview')?'overview':(tabs[0]||'overview');
    sheet.innerHTML=`<div class="sheet-grip"></div>`+this.matchSheet(r.match,tabs);
    this.matchTab(this._mTab);
  },
  matchTabs(m){
    const T=window.TEXTS[this.lang];
    const t=[];
    if(m.prediction||m.referee||m.venue||m.core) t.push('overview');
    if(m.stats&&m.stats.length) t.push('stats');
    if(m.incidents&&m.incidents.length) t.push('timeline');
    if(m.lineups&&(m.lineups.home||m.lineups.away)) t.push('lineups');
    if(m.odds) t.push('odds');
    if((m.facts&&m.facts.length)||m.preview) t.push('facts');
    return t;
  },
  matchTabLabel(k){
    const T=window.TEXTS[this.lang];
    return {overview:T.m_overview,stats:T.m_stats,timeline:T.m_timeline,lineups:T.m_lineups,odds:T.m_odds,facts:T.m_facts}[k]||k;
  },
  matchStatusLine(c){
    const T=window.TEXTS[this.lang];
    const live=/inprogress|penalties|1st|2nd|halftime|extra/i.test(c.status);
    const done=/finished|ft/i.test(c.status);
    if(live){ const lbl=c.minute?c.minute+"'":(c.period==='halftime'?(T.sport_ht||'HT'):T.sport_live); return `<span class="ms-live">● ${lbl}</span>`; }
    if(done) return `<span class="ms-done">${T.sport_ft||'انتهت'}</span>`;
    let when=''; try{ when=c.date?new Date(c.date).toLocaleString(this.lang==='fr'?'fr':'ar-u-nu-latn',{weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}):''; }catch{}
    return `<span class="ms-time">${when}</span>`;
  },
  matchSheet(m,tabs){
    const c=m.core, T=window.TEXTS[this.lang];
    const hasScore=(c.score_home!=null);
    const live=/inprogress|penalties|1st|2nd|halftime|extra/i.test(c.status);
    const center=hasScore
      ? `<div class="ms-score ${live?'live':''}">${c.score_home}<em>-</em>${c.score_away}</div>${(c.score_home_ht!=null)?`<div class="ms-ht">(${c.score_home_ht}-${c.score_away_ht})</div>`:''}`
      : `<div class="ms-vs">${T.sport_vs}</div>`;
    return `<div class="ms">
      <div class="ms-top">
        <div class="ms-league"><img src="${c.league_logo||''}" onerror="this.style.display='none'"><span>${this.esc(c.league)}</span>${c.round!=null?`<em>· ${T.m_round} ${c.round}</em>`:''}</div>
        <div class="ms-hero">
          <div class="ms-team"><img src="${c.home_logo||''}" onerror="this.style.visibility='hidden'"><span>${this.esc(c.home)}</span></div>
          <div class="ms-center">${center}<div class="ms-status">${this.matchStatusLine(c)}</div></div>
          <div class="ms-team"><img src="${c.away_logo||''}" onerror="this.style.visibility='hidden'"><span>${this.esc(c.away)}</span></div>
        </div>
        ${c.derby||c.neutral||c.live_ws?`<div class="ms-tags">${c.derby?`<span class="ms-tag derby">${T.m_derby}</span>`:''}${c.neutral?`<span class="ms-tag">${T.m_neutral}</span>`:''}${c.live_ws&&!hasScore?`<span class="ms-tag ws">${T.m_live_ws}</span>`:''}</div>`:''}
      </div>
      <div class="ms-tabs">${tabs.map(t=>`<button class="ms-tab ${t===this._mTab?'on':''}" data-mt="${t}" onclick="App.matchTab('${t}')">${this.matchTabLabel(t)}</button>`).join('')}</div>
      <div class="ms-body" id="msBody"></div>
    </div>`;
  },
  matchTab(name){
    this._mTab=name;
    document.querySelectorAll('.ms-tab').forEach(t=>t.classList.toggle('on',t.dataset.mt===name));
    const box=document.getElementById('msBody'); if(!box) return;
    const m=this._matchData; if(!m){ box.innerHTML=''; return; }
    let html='';
    if(name==='overview') html=this.mOverview(m);
    else if(name==='stats') html=this.mStats(m);
    else if(name==='timeline') html=this.mTimeline(m);
    else if(name==='lineups') html=this.mLineups(m);
    else if(name==='odds') html=this.mOdds(m);
    else if(name==='facts') html=this.mFacts(m);
    box.innerHTML=html||`<div class="ms-empty">${window.TEXTS[this.lang].m_no_data}</div>`;
  },
  // ── نظرة عامة: التوقع + معلومات المباراة ──
  mOverview(m){
    const T=window.TEXTS[this.lang]; const c=m.core; const p=m.prediction;
    let html='';
    if(p){
      const conf=p.confidence||50, cc=conf>=70?'high':conf>=60?'mid':'low';
      html+=`<div class="mo-pred">
        <div class="mo-pred-head"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3v18h18"/><path d="M7 14l4-4 3 3 5-6"/></svg><b>${T.m_ai_pred}</b>${p.model_version?`<em>${this.esc(p.model_version)}</em>`:''}</div>
        <div class="mo-prob">
          <div class="pp"><span>1</span><div class="pp-bar"><i style="width:${p.prob_home}%"></i></div><em>${p.prob_home}%</em></div>
          <div class="pp"><span>X</span><div class="pp-bar draw"><i style="width:${p.prob_draw}%"></i></div><em>${p.prob_draw}%</em></div>
          <div class="pp"><span>2</span><div class="pp-bar"><i style="width:${p.prob_away}%"></i></div><em>${p.prob_away}%</em></div>
        </div>
        <div class="mo-pick"><div><span>${T.sport_pick}</span><b>${this.esc(p.tip)}</b></div><div class="mo-conf ${cc}">${conf}%</div></div>
        <div class="mo-markets">
          ${p.score?`<div class="mo-mk"><span>${T.sport_score}</span><b>${this.esc(p.score)}</b></div>`:''}
          ${p.eg_home!=null?`<div class="mo-mk"><span>xG</span><b>${p.eg_home.toFixed(1)} - ${p.eg_away.toFixed(1)}</b></div>`:''}
          ${p.over15!=null?`<div class="mo-mk"><span>+1.5</span><b>${p.over15}%</b></div>`:''}
          ${p.over25!=null?`<div class="mo-mk"><span>+2.5</span><b>${p.over25}%</b></div>`:''}
          ${p.over35!=null?`<div class="mo-mk"><span>+3.5</span><b>${p.over35}%</b></div>`:''}
          ${p.btts_yes!=null?`<div class="mo-mk"><span>BTTS</span><b>${p.btts_yes}%</b></div>`:''}
          ${p.dc_key?`<div class="mo-mk"><span>${T.sport_dc}</span><b>${p.dc_key} · ${p.dc_prob}%</b></div>`:''}
        </div>
      </div>`;
    }
    // شريحة معلومات
    const info=[];
    if(m.venue&&m.venue.name) info.push([T.m_venue,`${this.esc(m.venue.name)}${m.venue.city?' · '+this.esc(m.venue.city):''}`,'pin']);
    if(m.venue&&m.venue.capacity) info.push([T.m_capacity,Number(m.venue.capacity).toLocaleString(),'seat']);
    if(m.referee&&m.referee.name){ const ry=m.referee.avg_yellow!=null?` · ${m.referee.avg_yellow} ${T.m_yc_pm}`:''; info.push([T.m_referee,this.esc(m.referee.name)+ry,'whistle']); }
    if(c.weather) info.push([T.m_weather,this.esc(c.weather.desc)+(c.weather.temp!=null?` · ${c.weather.temp}°`:''),'cloud']);
    if(c.attendance) info.push([T.m_attendance,Number(c.attendance).toLocaleString(),'people']);
    if(c.travel_km) info.push([T.m_travel,`${c.travel_km} ${T.m_km}`,'route']);
    if(info.length){
      html+=`<div class="mo-info">${info.map(x=>`<div class="mo-info-row"><span class="mo-ik">${x[0]}</span><span class="mo-iv">${x[1]}</span></div>`).join('')}</div>`;
    }
    if(m.facts&&m.facts.length){
      html+=`<div class="mo-fact"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg><span>${this.esc(m.facts[0])}</span></div>`;
    }
    return html;
  },
  // ── الإحصائيات: أشرطة مقارنة ──
  mStats(m){
    const T=window.TEXTS[this.lang];
    let html='';
    if(m.xg){
      const t=(m.xg.home+m.xg.away)||1, hp=Math.round(m.xg.home/t*100);
      html+=`<div class="mst-row mst-xg">
        <div class="mst-v">${m.xg.home.toFixed(2)}</div>
        <div class="mst-mid"><span>xG</span><div class="mst-bar"><i class="h" style="width:${hp}%"></i><i class="a" style="width:${100-hp}%"></i></div></div>
        <div class="mst-v">${m.xg.away.toFixed(2)}</div>
      </div>`;
    }
    html+=m.stats.map(s=>{
      const t=(s.hn+s.an)||1, hp=Math.round(s.hn/t*100);
      return `<div class="mst-row">
        <div class="mst-v">${this.esc(String(s.home))}</div>
        <div class="mst-mid"><span>${T[s.label]||s.label}</span><div class="mst-bar"><i class="h" style="width:${hp}%"></i><i class="a" style="width:${100-hp}%"></i></div></div>
        <div class="mst-v">${this.esc(String(s.away))}</div>
      </div>`;
    }).join('');
    return html;
  },
  // ── الأحداث: الخط الزمني ──
  mTimeline(m){
    const T=window.TEXTS[this.lang];
    const ico={
      goal:`<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 7l1.5 3 3 .2-2.3 2 .8 3-3-1.8-3 1.8.8-3-2.3-2 3-.2z"/></svg>`,
      substitution:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 3l4 4-4 4M20 7H9M8 21l-4-4 4-4M4 17h11"/></svg>`,
      varDecision:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="6" width="18" height="12" rx="2"/><path d="M8 10l2 2 6-4"/></svg>`,
    };
    return `<div class="mtl">${m.incidents.map(i=>{
      const side=i.is_home===false?'away':'home';
      let icon, label;
      if(i.type==='card'){ const red=/red/i.test(i.card_type); icon=`<span class="mtl-card ${red?'red':'yellow'}"></span>`; label=this.esc(i.player); }
      else if(i.type==='substitution'){ icon=ico.substitution; label=`${this.esc(i.player)} <em>↔ ${this.esc(i.player_out)}</em>`; }
      else if(i.type==='goal'){ icon=ico.goal; label=`<b>${this.esc(i.player)}</b>`; }
      else { icon=ico.varDecision; label=this.esc(i.detail||'VAR'); }
      return `<div class="mtl-row ${side}">
        <div class="mtl-min">${i.minute!=null?i.minute+"'":''}</div>
        <div class="mtl-dot ${i.type}">${icon}</div>
        <div class="mtl-txt">${label}</div>
      </div>`;
    }).join('')}</div>`;
  },
  // ── التشكيلات ──
  mLineups(m){
    const T=window.TEXTS[this.lang]; const L=m.lineups;
    let badge='';
    if(L.status==='confirmed') badge=`<span class="lu-badge ok">${T.m_lineup_confirmed}</span>`;
    else if(L.status==='predicted') badge=`<span class="lu-badge pred">${T.m_lineup_predicted}${L.beta?' · beta':''}</span>`;
    else return `<div class="ms-empty">${T.m_lineup_unavailable}</div>`;
    const col=(s)=>{
      if(!s) return '';
      return `<div class="lu-col">
        <div class="lu-team">${this.esc(s.team)}</div>
        ${s.formation?`<div class="lu-form">${this.esc(s.formation)}${s.confidence!=null?` · ${s.confidence}%`:''}</div>`:''}
        <div class="lu-players">${s.players.map(pl=>`<div class="lu-p"><span class="lu-num">${pl.jersey!=null?pl.jersey:''}</span><span class="lu-name">${this.esc(pl.name)}</span>${pl.ai!=null?`<span class="lu-ai">${pl.ai}%</span>`:''}</div>`).join('')}</div>
        ${s.subs&&s.subs.length?`<div class="lu-sub-h">${T.m_subs}</div><div class="lu-players sub">${s.subs.slice(0,9).map(pl=>`<div class="lu-p"><span class="lu-num">${pl.jersey!=null?pl.jersey:''}</span><span class="lu-name">${this.esc(pl.name)}</span></div>`).join('')}</div>`:''}
      </div>`;
    };
    let inj='';
    if(L.injuries&&(L.injuries.home&&L.injuries.home.length||L.injuries.away&&L.injuries.away.length)){
      const row=(arr)=>(arr||[]).map(x=>`<div class="lu-inj"><span>${this.esc(x.name)}</span><em>${this.esc(x.reason||x.status||'')}</em></div>`).join('');
      inj=`<div class="lu-injuries"><div class="lu-inj-h">${T.m_injuries}</div><div class="lu-inj-cols"><div>${row(L.injuries.home)}</div><div>${row(L.injuries.away)}</div></div></div>`;
    }
    return `<div class="lu-top">${badge}</div><div class="lu-cols">${col(L.home)}${col(L.away)}</div>${inj}`;
  },
  // ── الاحتمالات (Odds) ──
  mOdds(m){
    const T=window.TEXTS[this.lang]; const o=m.odds; if(!o) return '';
    const fmt=(v)=>v!=null?Number(v).toFixed(2):'—';
    const grp=(title,items)=>`<div class="od-grp"><div class="od-h">${title}</div><div class="od-row">${items.map(it=>`<div class="od-cell"><span>${it[0]}</span><b>${fmt(it[1])}</b></div>`).join('')}</div></div>`;
    let html='';
    html+=grp('1X2',[['1',o.home_win],['X',o.draw],['2',o.away_win]]);
    html+=grp(T.m_over_under+' 2.5',[[T.m_over,o.over_25_goals],[T.m_under,o.under_25_goals]]);
    html+=grp(T.m_over_under+' 1.5',[[T.m_over,o.over_15_goals],[T.m_under,o.under_15_goals]]);
    html+=grp(T.m_over_under+' 3.5',[[T.m_over,o.over_35_goals],[T.m_under,o.under_35_goals]]);
    html+=grp('BTTS',[[T.m_yes,o.btts_yes],[T.m_no,o.btts_no]]);
    return `<div class="od-wrap">${html}</div><div class="od-note">${T.m_odds_note}</div>`;
  },
  // ── الحقائق + المعاينة ──
  mFacts(m){
    const T=window.TEXTS[this.lang];
    let html='';
    if(m.facts&&m.facts.length){
      html+=`<div class="mf-list">${m.facts.map(f=>`<div class="mf-item"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg><span>${this.esc(f)}</span></div>`).join('')}</div>`;
    }
    if(m.preview){
      const txt=String(m.preview).replace(/[#*_>`]/g,'').trim();
      html+=`<div class="mf-preview"><div class="mf-pv-h">${T.m_preview}</div><p>${this.esc(txt)}</p></div>`;
    }
    return html;
  },

  // ═══ قسيمة الرهان (خانة جانبية) ═══
  riskClass(conf){ return conf>=75?'low':conf>=60?'mid':'high'; },
  riskLabel(conf){ const T=window.TEXTS[this.lang]; return conf>=75?T.slip_risk_low:conf>=60?T.slip_risk_mid:T.slip_risk_high; },
  slipMarketLabel(mk,pick){
    const T=window.TEXTS[this.lang];
    return {'1x2':T.slip_mk_winner,'dc':T.sport_dc,'ou15':T.slip_mk_over+' 1.5','ou25':T.slip_mk_over+' 2.5','ou35':T.slip_mk_over+' 3.5','btts':'BTTS'}[mk]||'';
  },
  updateSlipFab(){
    const fab=document.getElementById('slipFab'); if(!fab) return;
    const show=this.current==='sport' && this._slip && this._slip.length;
    fab.classList.toggle('hidden', !show);
    const c=document.getElementById('slipFabCount');
    if(c && this._slipSel) c.textContent=this._slipSel.size;
  },
  openSlip(){
    if(!this._slip || !this._slip.length){ this.toast(window.TEXTS[this.lang].slip_empty); return; }
    this.renderSlip();
    document.getElementById('slipDrawerBg').classList.add('show');
  },
  closeSlip(){ document.getElementById('slipDrawerBg').classList.remove('show'); },
  closeSlipBg(e){ if(e.target.id==='slipDrawerBg') this.closeSlip(); },
  toggleSlipPick(id){
    if(!this._slipSel) this._slipSel=new Set();
    if(this._slipSel.has(id)) this._slipSel.delete(id); else this._slipSel.add(id);
    this.renderSlip(); this.updateSlipFab();
  },
  computeSlip(){
    let odds=1, n=0;
    (this._slip||[]).forEach(r=>{ if(this._slipSel && this._slipSel.has(r.event_id)){ odds*=Number(r.odd)||1; n++; } });
    return { odds: n?odds:0, n };
  },
  renderSlip(){
    const T=window.TEXTS[this.lang];
    const list=document.getElementById('slipList'); if(!list) return;
    const rows=this._slip||[];
    if(!rows.length){ list.innerHTML=`<div class="slip-empty">${T.slip_empty}</div>`; }
    else {
      list.innerHTML=rows.map(r=>{
        const sel=this._slipSel && this._slipSel.has(r.event_id);
        const rc=this.riskClass(r.conf);
        let when=''; try{ when=r.date?new Date(r.date).toLocaleString(this.lang==='fr'?'fr':'ar-u-nu-latn',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}):''; }catch{}
        return `<div class="slip-row ${sel?'on':''}" onclick="App.toggleSlipPick(${r.event_id||0})">
          <div class="slip-check ${sel?'on':''}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M5 12l5 5L20 6"/></svg></div>
          <div class="slip-row-main">
            <div class="slip-row-teams">
              <img src="${r.home_logo||''}" onerror="this.style.visibility='hidden'">
              <span>${this.esc(r.home)} <em>${T.sport_vs}</em> ${this.esc(r.away)}</span>
              <img src="${r.away_logo||''}" onerror="this.style.visibility='hidden'">
            </div>
            <div class="slip-row-meta">
              <span class="slip-mk">${this.slipMarketLabel(r.mk,r.pick)}</span>
              <span class="slip-pick">${this.esc(r.pick)}</span>
              <span class="slip-when">${when}</span>
            </div>
          </div>
          <div class="slip-row-end">
            <div class="slip-odd">${Number(r.odd).toFixed(2)}</div>
            <div class="slip-risk ${rc}">${r.conf}%</div>
          </div>
        </div>`;
      }).join('');
    }
    this.slipStakeInput();
  },
  slipStakeInput(){
    const inp=document.getElementById('slipStake'); if(!inp) return;
    let v=inp.value.replace(/[^\d]/g,''); if(v!==inp.value) inp.value=v;
    const stake=parseInt(v||'0',10)||0;
    const { odds, n }=this.computeSlip();
    const ret=odds>0?Math.round(stake*odds):0;
    const po=document.getElementById('slipPicks'); if(po) po.textContent=n;
    const oo=document.getElementById('slipOdds'); if(oo) oo.textContent=odds>0?odds.toFixed(2):'1.00';
    const ro=document.getElementById('slipReturn'); if(ro) ro.textContent=ret.toLocaleString(this.lang==='fr'?'fr':'ar-u-nu-latn');
  },

  // ═══ Skeleton loading ═══
  sportSkeleton(v){
    const card=`<div class="sk-card"><div class="sk-line w40"></div><div class="sk-teams"><div class="sk-av"></div><div class="sk-bar"></div><div class="sk-av"></div></div><div class="sk-line w70"></div><div class="sk-line w55"></div></div>`;
    const row=`<div class="sk-row"><div class="sk-mini"></div><div style="flex:1"><div class="sk-line w60"></div><div class="sk-line w35"></div></div></div>`;
    if(v==='standings') return `<div class="sk-wrap">${Array(8).fill(row).join('')}</div>`;
    if(v==='predictions') return `<div class="sk-wrap">${card}${card}${card}</div>`;
    return `<div class="sk-wrap">${Array(6).fill(row).join('')}</div>`;
  },
  // ═══ الترتيب: جميع الدوريات (أكورديون) ═══
  async renderStandingsHub(){
    const body=document.getElementById('sportBody');
    const T=window.TEXTS[this.lang];
    let lr=this._leaguesList;
    if(!lr){ const r=await this.api('sport',{ view:'leagues', lang:this.lang }); lr=(r&&r.leagues)?r.leagues:[]; this._leaguesList=lr; }
    if(!lr.length){ body.innerHTML=`<div class="sport-empty">${this.sportEmptyIcon()}<span>${T.sport_unavailable}</span></div>`; return; }
    body.innerHTML=`<div class="std-hub">${lr.map((l,i)=>`
      <div class="lg-acc${i===0?' open':''}" data-lg="${l.id}">
        <button class="lg-acc-head" onclick="App.toggleLeague(${l.id})">
          <img class="lg-acc-logo" src="${l.logo||''}" onerror="this.style.visibility='hidden'" alt="">
          <div class="lg-acc-info"><b>${this.esc(l.name)}</b>${l.country?`<span>${this.esc(l.country)}</span>`:''}</div>
          <svg class="lg-acc-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M6 9l6 6 6-6"/></svg>
        </button>
        <div class="lg-acc-body" id="lgBody-${l.id}"></div>
      </div>`).join('')}</div>`;
    if(lr[0]) this.loadLeagueTable(lr[0].id);
  },
  toggleLeague(id){
    const acc=document.querySelector(`.lg-acc[data-lg="${id}"]`); if(!acc) return;
    const willOpen=!acc.classList.contains('open');
    acc.classList.toggle('open', willOpen);
    if(willOpen) this.loadLeagueTable(id);
  },
  async loadLeagueTable(id){
    const box=document.getElementById('lgBody-'+id); if(!box || box.dataset.loaded==='1') return;
    const T=window.TEXTS[this.lang];
    box.innerHTML=`<div class="lg-acc-load">${this.spinner()}</div>`;
    const r=await this.api('sport',{ view:'standings', league_id:id, lang:this.lang });
    box.dataset.loaded='1';
    const table=(r&&r.standings&&r.standings.table)?r.standings.table:[];
    box.innerHTML=table.length?this.standingsTable(table):`<div class="lg-acc-empty">${T.sport_no_matches}</div>`;
  },
  standingsTable(table){
    const T=window.TEXTS[this.lang];
    const formDots=(f)=>{ if(!f) return ''; return `<div class="std-form">${String(f).slice(-5).split('').map(ch=>{const c=/w/i.test(ch)?'w':/l/i.test(ch)?'l':'d';return `<i class="${c}"></i>`;}).join('')}</div>`; };
    return `<div class="std-scroll"><div class="std-tbl">
      <div class="std-row std-header">
        <div class="std-pos">#</div><div class="std-team">${T.sport_team||'الفريق'}</div>
        <div class="std-c">${T.sport_pl_short||'ل'}</div><div class="std-c">${T.sport_w||'ف'}</div><div class="std-c">${T.sport_d||'ت'}</div><div class="std-c">${T.sport_l||'خ'}</div>
        <div class="std-c gd">+/-</div><div class="std-c pts">${T.sport_pts||'نقاط'}</div>
      </div>
      ${table.slice(0,30).map(r=>`<div class="std-row">
        <div class="std-pos ${r.position<=4?'top':r.position>=18?'rel':''}">${r.position}</div>
        <div class="std-team"><img src="${r.crest||''}" onerror="this.style.visibility='hidden'"><div class="std-tn"><span>${this.esc(r.team)}</span>${formDots(r.form)}</div></div>
        <div class="std-c">${r.played}</div><div class="std-c">${r.won}</div><div class="std-c">${r.drawn}</div><div class="std-c">${r.lost}</div>
        <div class="std-c gd">${r.gd>0?'+':''}${r.gd}</div><div class="std-c pts">${r.points}</div>
      </div>`).join('')}
    </div></div>`;
  },

  // ═══ SMART SUPPORT CHAT ═══
  initChat(){
    if(this._chatInit) return;
    this._chatInit=true;
    const T=window.TEXTS[this.lang];
    document.getElementById('chatInput').placeholder=T.support_placeholder;
    this.addMsg('bot', T.support_greeting);
  },
  addMsg(who, text, suggestHuman){
    const box=document.getElementById('chatMsgs');
    const div=document.createElement('div');
    div.className='chat-msg '+(who==='me'?'me':'bot');
    let showSport=false;
    if(who==='bot'){
      let t=String(text||'');
      showSport=/<!--SHOW_SPORT-->/.test(t);
      t=t.replace(/<!--[^>]*-->/g,'').trim();          // إزالة العلامات الداخلية
      let h=this.esc(t).replace(/\n/g,'<br>');
      // إعادة تفعيل الوسوم الآمنة القادمة من قاعدة المعرفة فقط
      h=h.replace(/&lt;code&gt;/g,'<code>').replace(/&lt;\/code&gt;/g,'</code>')
         .replace(/&lt;u&gt;/g,'<u>').replace(/&lt;\/u&gt;/g,'</u>');
      div.innerHTML=`<div class="bubble">${h}</div>`;
    }else{
      div.innerHTML=`<div class="bubble">${this.esc(text).replace(/\n/g,'<br>')}</div>`;
    }
    box.appendChild(div);
    if(showSport){
      const T=window.TEXTS[this.lang];
      const b=document.createElement('button');
      b.className='chat-action-btn'; b.textContent=T.chat_open_sport;
      b.onclick=()=>this.nav('sport');
      box.appendChild(b);
    }
    if(suggestHuman){
      const T=window.TEXTS[this.lang];
      const b=document.createElement('button');
      b.className='chat-human-btn'; b.textContent=T.support_human;
      b.onclick=()=>this.openSupport();
      box.appendChild(b);
    }
    box.scrollTop=box.scrollHeight;
  },
  async sendChat(){
    const inp=document.getElementById('chatInput');
    const text=inp.value.trim();
    if(!text) return;
    inp.value='';
    this.addMsg('me', text);
    // typing indicator
    const box=document.getElementById('chatMsgs');
    const typing=document.createElement('div');
    typing.className='chat-msg bot'; typing.id='typingInd';
    typing.innerHTML=`<div class="bubble typing"><span></span><span></span><span></span></div>`;
    box.appendChild(typing); box.scrollTop=box.scrollHeight;

    const r=await this.api('support',{ text, lang:this.lang, session:Store.s });
    document.getElementById('typingInd')?.remove();
    this.addMsg('bot', r.reply||'…', r.suggest_human);
  },
  iShield(){ return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l8 4v6c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6z"/><path d="M9 12l2 2 4-4"/></svg>`; },
  iDevice(){ return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="2" width="14" height="20" rx="3"/><path d="M11 18h2"/></svg>`; },
  iLock(){ return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 018 0v3"/></svg>`; },
  iCash(){ return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>`; },
  iSearch(){ return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4"/></svg>`; },
  iTrophy(){ return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 21h8M12 17v4M7 4h10v4a5 5 0 01-10 0z"/><path d="M17 5h3v2a3 3 0 01-3 3M7 5H4v2a3 3 0 003 3"/></svg>`; },
  esc(s){ return String(s||'').replace(/[<>&"]/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[c])); },
  spinner(){ return `<div class="spin"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 2a10 10 0 0110 10" stroke-linecap="round"/></svg></div>`; },

  // ═══ BOOT ═══
  async boot(){
    this.lang=Store.lang; this.applyLang();
    this.setupPWA();
    this.renderLeagues();
    this.refreshNotifBanner();
    this.maybeShowNotifModal();
    // load config
    try{ const c=await this.api('config'); SUPPORT_WA=c.support_whatsapp||SUPPORT_WA; CHANNEL=c.channel_url||CHANNEL; OS_APP_ID=c.onesignal_app_id||''; }catch{}
    // عرض رقم الوكالة بشكل منسّق
    const ph=document.getElementById('agencyPhone');
    if(ph){ const n=SUPPORT_WA.replace(/^222/,''); ph.textContent='+222 '+n.replace(/(\d{2})(\d{2})(\d{2})(\d{2})/,'$1 $2 $3 $4'); }
    // hide splash
    setTimeout(()=>document.getElementById('splash').classList.add('gone'),1500);
    // session restore — تذكّر المستخدم في كل دخول
    if(Store.s){
      const fp=await this.fingerprint();
      const r=await this.api('me',{ session:Store.s, fingerprint:fp });
      if(r.ok){ this.account=r.account; this.stats=r.stats; this._deviceTrusted=r.device_trusted; this.contest=r.contest;
        await this.initOneSignal(this.account.game_id);
        // حجب لوحة التحكم حتى التفعيل
        if(this.account.status==='active'){ this.show('dash'); this.renderDash(); }
        else { this.showPending(); }
        (r.notifications||[]).forEach(n=>setTimeout(()=>this.toast(n.body||n.title),2000));
        return;
      } else { Store.s=null; }
    }
    // referral landing → straight to verify
    if(this.getRefFromUrl()){ this.show('landing'); }
    else this.show('landing');
  },
};

document.addEventListener('DOMContentLoaded',()=>App.boot());
