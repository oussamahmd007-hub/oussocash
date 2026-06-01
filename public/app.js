// ═══════════════════════════════════════════════════════════════════
//  OussoCash — Frontend (premium fintech app)
//  واجهة احترافية · تحقق صادق · هوية عبر 1xBet ID
// ═══════════════════════════════════════════════════════════════════
const REG_LINK = 'https://reffpa.com/L?tag=d_3649166m_1599c_OUSSO&site=3649166&ad=1599&r=en/registration';
const VIDEO_REGISTER = 'https://player.cloudinary.com/embed/?cloud_name=djkqimryk&public_id=lv_0_%D9%A2%D9%A0%D9%A2%D9%A6%D9%A0%D9%A4%D9%A1%D9%A0%D9%A1%D9%A4%D9%A1%D9%A1%D9%A3%D9%A2_ylopqt';
let SUPPORT_WA = '22249002902';
let CHANNEL    = 'https://whatsapp.com/channel/0029Vb7TGP52phHUrKJ13u1p';
let OS_APP_ID  = '';

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
  },
  nav(v){
    if (v==='dash'||v==='ref') this.show(v);
    else if(v==='contest'){ this.show('contest'); this.loadContest(); }
    else if(v==='sport'){ this.show('sport'); this.sportView(this._sportView||'today'); }
    else if(v==='support'){ this.show('support'); this.initChat(); }
    else if(v==='agency'){ this.show('agency'); }
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
    const banner=document.getElementById('notifBanner');
    if(!banner) return;
    let granted=false;
    try{ granted = (typeof Notification!=='undefined' && Notification.permission==='granted'); }catch{}
    banner.style.display = granted ? 'none' : 'flex';
  },
  async askNotif(){
    if(!window.OneSignalDeferred){ return; }
    window.OneSignalDeferred.push(async (OneSignal)=>{
      try{ await OneSignal.Notifications.requestPermission(); }catch{}
      try{ localStorage.setItem('oc_notif_asked','1'); }catch{}
      this.refreshNotifBanner();
    });
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
    this.openSheet(`
      <h3>${T.support_title}</h3><div class="sub">${T.support_sub}</div>
      <div class="support-grid">${items.map(i=>`<div class="sup-item">${i[1]}<span>${i[0]}</span></div>`).join('')}</div>
      <button class="btn btn-primary" onclick="App.openWhatsapp()">${T.support_open}</button>
      <button class="btn btn-ghost" style="margin-top:10px" onclick="window.open('${CHANNEL}','_blank')">${T.support_channel}</button>
    `);
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
    const leagues=[
      {n:'Premier League',c:'PL',img:'https://crests.football-data.org/PL.png'},
      {n:'La Liga',c:'PD',img:'https://crests.football-data.org/PD.png'},
      {n:'Serie A',c:'SA',img:'https://crests.football-data.org/SA.png'},
      {n:'Bundesliga',c:'BL1',img:'https://crests.football-data.org/BL1.png'},
      {n:'Ligue 1',c:'FL1',img:'https://crests.football-data.org/FL1.png'},
      {n:'Champions League',c:'CL',img:'https://crests.football-data.org/CL.png'},
    ];
    box.innerHTML=leagues.map(l=>`<div class="league-chip"><img src="${l.img}" onerror="this.style.display='none'" alt=""><span>${l.n}</span></div>`).join('');
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
  async loadContest(){
    const T=window.TEXTS[this.lang];
    const body=document.getElementById('contestBody');
    body.innerHTML=`<div class="card" style="text-align:center;color:var(--txt-3);padding:40px 20px">…</div>`;
    const r=await this.api('contest',{ session:Store.s });
    if(!r.contest){
      body.innerHTML=`<div class="card" style="text-align:center;padding:40px 22px">
        <div class="contest-empty-ic">${this.iTrophy()}</div>
        <p style="color:var(--txt-2);font-size:14px;margin-top:14px">${T.contest_none}</p></div>`;
      return;
    }
    const c=r.contest, lb=r.leaderboard||[], me=r.me||{};
    const title=this.lang==='fr'&&c.title_fr?c.title_fr:c.title;
    const ends=this.countdown(c.ends_at);
    const medal=['①','②','③'];
    body.innerHTML=`
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
    body.innerHTML=`<div class="sport-loading">${this.spinner()}</div>`;
    const r=await this.api('sport',{ view:v, lang:this.lang });
    if(r.error){ body.innerHTML=`<div class="sport-empty">${T.sport_unavailable}</div>`; return; }

    if(v==='standings'){ this.renderStandings(r.standings); return; }

    let html='';
    // predictions block (today/tomorrow)
    if(r.predictions && r.predictions.length){
      html+=`<div class="section-h" style="padding:0;margin:4px 0 2px">${T.sport_predictions}</div>
        <p class="sport-pred-sub">${T.sport_pred_sub}</p>`;
      html+=r.predictions.map(p=>this.predCard(p)).join('');
      html+=`<div class="sport-disclaimer">${T.sport_disclaimer}</div>`;
    }
    // matches list
    if(r.matches && r.matches.length){
      html+=`<div class="section-h" style="padding:0;margin:18px 0 6px">${v==='live'?T.sport_live:v==='yesterday'?T.sport_yesterday:v==='tomorrow'?T.sport_tomorrow:T.sport_today}</div>`;
      html+=r.matches.map(m=>this.matchCard(m)).join('');
    } else if(!r.predictions || !r.predictions.length){
      html+=`<div class="sport-empty">${T.sport_no_matches}</div>`;
    }
    body.innerHTML=html;
  },
  predCard(p){
    const T=window.TEXTS[this.lang];
    const pickTxt=p.pick==='draw'?T.sport_pick_draw:(p.pick===p.home?T.sport_pick_home:T.sport_pick_away);
    const pickName=p.pick==='draw'?T.sport_pick_draw:p.pick;
    const conf=p.confidence||50;
    const cc=conf>=65?'high':conf>=52?'mid':'low';
    return `<div class="pred-card">
      <div class="pred-comp">${this.esc(p.comp)}</div>
      <div class="pred-teams">
        <div class="pred-team"><img src="${p.home_crest||''}" onerror="this.style.visibility='hidden'"><span>${this.esc(p.home)}</span>${p.home_pos?`<em>#${p.home_pos}</em>`:''}</div>
        <div class="pred-vs">${T.sport_vs}</div>
        <div class="pred-team"><img src="${p.away_crest||''}" onerror="this.style.visibility='hidden'"><span>${this.esc(p.away)}</span>${p.away_pos?`<em>#${p.away_pos}</em>`:''}</div>
      </div>
      <div class="pred-foot">
        <div class="pred-pick"><span>${T.sport_pick}</span><b>${this.esc(pickName)}</b></div>
        <div class="pred-conf ${cc}"><div class="conf-bar"><i style="width:${conf}%"></i></div><span>${conf}%</span></div>
      </div>
    </div>`;
  },
  matchCard(m){
    const T=window.TEXTS[this.lang];
    const live=['LIVE','IN_PLAY','PAUSED'].includes(m.status);
    const done=m.status==='FINISHED';
    const time=new Date(m.utcDate).toLocaleTimeString(this.lang==='fr'?'fr':'ar',{hour:'2-digit',minute:'2-digit'});
    const score=(m.score_home!=null)?`${m.score_home} - ${m.score_away}`:time;
    return `<div class="match-card">
      <div class="match-comp"><img src="${m.comp_emblem||''}" onerror="this.style.display='none'"><span>${this.esc(m.comp)}</span>
        ${live?`<span class="live-dot">${T.sport_live}</span>`:done?`<span class="done-tag">${T.sport_finished}</span>`:''}</div>
      <div class="match-row">
        <div class="match-team"><img src="${m.home_crest||''}" onerror="this.style.visibility='hidden'"><span>${this.esc(m.home)}</span></div>
        <div class="match-score ${live?'live':''}">${score}</div>
        <div class="match-team away"><span>${this.esc(m.away)}</span><img src="${m.away_crest||''}" onerror="this.style.visibility='hidden'"></div>
      </div>
    </div>`;
  },
  renderStandings(s){
    const body=document.getElementById('sportBody');
    if(!s||!s.table){ body.innerHTML=`<div class="sport-empty">—</div>`; return; }
    body.innerHTML=`<div class="section-h" style="padding:0;margin:4px 0 8px">${this.esc(s.name)}</div>
      <div class="card" style="padding:6px 14px">
      ${s.table.map(r=>`<div class="std-row">
        <div class="std-pos ${r.position<=4?'top':r.position>=18?'rel':''}">${r.position}</div>
        <img class="std-crest" src="${r.crest||''}" onerror="this.style.visibility='hidden'">
        <div class="std-name">${this.esc(r.team)}</div>
        <div class="std-pl">${r.played}</div>
        <div class="std-pts">${r.points}</div>
      </div>`).join('')}
      </div>`;
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
    div.innerHTML=`<div class="bubble">${this.esc(text).replace(/\n/g,'<br>')}</div>`;
    box.appendChild(div);
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
