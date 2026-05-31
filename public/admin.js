// OussoCash Admin — logique
const Admin = {
  pwd: '', csvContent: '', csvName: '',

  async api(action, data){
    const res = await fetch('/api/admin', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ password:this.pwd, action, ...(data||{}) }),
    });
    return res.json().catch(()=>({error:'parse'}));
  },

  toast(m){ const t=document.getElementById('toast'); t.textContent=m; t.classList.add('show');
    clearTimeout(this._t); this._t=setTimeout(()=>t.classList.remove('show'),3200); },

  async login(){
    this.pwd = document.getElementById('pwd').value;
    const err = document.getElementById('loginErr'); err.textContent='';
    const r = await this.api('dashboard');
    if(r.error==='unauthorized'){ err.textContent='كلمة المرور غير صحيحة'; this.pwd=''; return; }
    if(r.error){ err.textContent='خطأ في الاتصال'; return; }
    try{ sessionStorage.setItem('oc_admin', this.pwd); }catch{}
    document.getElementById('login').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
    this.renderDash(r);
  },
  logout(){ this.pwd=''; try{ sessionStorage.removeItem('oc_admin'); }catch{}
    document.getElementById('app').classList.add('hidden');
    document.getElementById('login').classList.remove('hidden');
    document.getElementById('pwd').value=''; },

  go(tab){
    document.querySelectorAll('.tab').forEach(t=>t.classList.add('hidden'));
    document.getElementById('tab-'+tab).classList.remove('hidden');
    document.querySelectorAll('.anav').forEach(n=>n.classList.toggle('on', n.dataset.tab===tab));
    if(tab==='dashboard') this.loadDash();
    if(tab==='withdrawals') this.loadWithdrawals();
    if(tab==='contests') this.loadContests();
    if(tab==='search') this.loadAccounts('all');
    window.scrollTo(0,0);
  },

  // ─── ACCOUNTS LIST (كل المعرّفات) ───
  async loadAccounts(filter){
    document.querySelectorAll('.acc-filter').forEach(b=>b.classList.toggle('on', b.dataset.f===filter));
    const box=document.getElementById('accList');
    box.innerHTML=`<div class="empty">…</div>`;
    const r=await this.api('accounts',{ filter });
    if(!r.accounts||!r.accounts.length){ box.innerHTML=`<div class="empty">لا توجد حسابات</div>`; return; }
    box.innerHTML=`<div class="acc-count">${r.accounts.length} حساب</div>`+r.accounts.map(a=>`
      <div class="acc-row" onclick="document.getElementById('searchId').value='${a.game_id}';Admin.searchUser()">
        <div class="acc-main">
          <div class="acc-name">${this.esc(a.name||'—')}</div>
          <div class="acc-id">${a.game_id}</div>
        </div>
        <div class="acc-meta">
          <span class="uc-status us-${a.status}">${this.statusTxt(a.status)}</span>
          <span class="acc-bal">${(a.balance_um||0).toLocaleString()} UM</span>
        </div>
      </div>`).join('');
  },

  // ─── DASHBOARD ───
  async loadDash(){ const r=await this.api('dashboard'); if(!r.error) this.renderDash(r); },
  renderDash(d){
    document.getElementById('dashCards').innerHTML=`
      <div class="scard accent"><div class="v">${d.total||0}</div><div class="l">إجمالي الحسابات</div></div>
      <div class="scard"><div class="v">${d.active||0}</div><div class="l">مُفعّل</div></div>
      <div class="scard"><div class="v">${d.pending||0}</div><div class="l">قيد المراجعة</div></div>
      <div class="scard"><div class="v">${d.incomplete||0}</div><div class="l">إيداع ناقص</div></div>
      <div class="scard"><div class="v">${d.pending_wd||0}</div><div class="l">سحوبات معلّقة</div></div>
      <div class="scard"><div class="v">${(d.balance_total||0).toLocaleString()}</div><div class="l">إجمالي الأرصدة UM</div></div>`;
  },

  // ─── CSV UPLOAD ───
  fileChosen(e){
    const f=e.target.files[0]; if(!f) return;
    this.csvName=f.name;
    const rd=new FileReader();
    rd.onload=()=>{ this.csvContent=rd.result;
      document.getElementById('dzFile').textContent='✓ '+f.name;
      document.getElementById('uploadBtn').disabled=false; };
    rd.readAsText(f,'utf-8');
  },
  async processCsv(){
    if(!this.csvContent){ this.toast('اختر ملفاً أولاً'); return; }
    const btn=document.getElementById('uploadBtn'); btn.disabled=true; btn.textContent='جاري المعالجة...';
    const r=await this.api('process_csv',{ csv:this.csvContent, filename:this.csvName });
    btn.textContent='معالجة التقرير'; btn.disabled=false;
    const box=document.getElementById('csvResult');
    if(r.error){ box.innerHTML=`<div class="empty" style="color:var(--danger)">${r.message||r.error}</div>`; return; }
    const s=r.stats;
    box.innerHTML=`<div class="result-grid">
      <div class="rcell ok"><div class="n">${s.activated}</div><div class="t">تم تفعيلها</div></div>
      <div class="rcell"><div class="n">${s.deposit_incomplete}</div><div class="t">إيداع ناقص</div></div>
      <div class="rcell"><div class="n">${s.no_sub}</div><div class="t">بدون OUSSO (حُذفت)</div></div>
      <div class="rcell"><div class="n">${s.not_in_csv}</div><div class="t">غير موجودة (حُذفت)</div></div>
    </div>`;
    this.toast(`تمت معالجة ${s.total} حساب`);
  },

  // ─── SEARCH ───
  async searchUser(){
    const gid=document.getElementById('searchId').value.replace(/\D/g,'');
    if(!gid){ this.toast('أدخل معرّفاً'); return; }
    const box=document.getElementById('searchResult');
    box.innerHTML=`<div class="empty">…</div>`;
    const r=await this.api('search_user',{ game_id:gid });
    if(!r.found){
      box.innerHTML=`<div class="user-card"><div class="empty">لا يوجد حساب بهذا المعرّف${r.banned?' (محظور)':''}</div>
        ${r.banned?`<button class="btn" style="background:var(--surface-2);border:1px solid var(--line-2)" onclick="Admin.unban('${gid}')">رفع الحظر</button>`:''}</div>`;
      return;
    }
    const a=r.account, ref=r.referrals, by=r.referred_by;
    const initial=(a.name||'O').trim().charAt(0).toUpperCase()||'O';
    box.innerHTML=`<div class="user-card">
      <div class="uc-head">
        <div class="uc-avatar">${initial}</div>
        <div><div class="uc-name">${this.esc(a.name||'—')}</div>
        <div class="uc-id">${a.game_id}</div>
        <span class="uc-status us-${a.status}">${this.statusTxt(a.status)}</span></div>
      </div>
      <div class="uc-rows">
        <div class="uc-row"><span class="k">الرصيد</span><span class="v">${(a.balance_um||0).toLocaleString()} UM</span></div>
        <div class="uc-row"><span class="k">البلد</span><span class="v">${this.esc(a.country||'—')}</span></div>
        <div class="uc-row"><span class="k">مجموع الإيداعات</span><span class="v">${a.total_deposit||0} USD</span></div>
        <div class="uc-row"><span class="k">تاريخ التسجيل (1xBet)</span><span class="v">${this.esc(a.xbet_reg_date||'—')}</span></div>
        <div class="uc-row"><span class="k">كود الإحالة</span><span class="v">${a.ref_code}</span></div>
        <div class="uc-row"><span class="k">أحاله</span><span class="v">${by?this.esc(by.name||by.game_id):'—'}</span></div>
        <div class="uc-row"><span class="k">إحالاته المُفعّلة</span><span class="v">${ref.count} / ${ref.total}</span></div>
        <div class="uc-row"><span class="k">أرباح إحالاته</span><span class="v">${ref.earned} UM</span></div>
        <div class="uc-row"><span class="k">الأجهزة</span><span class="v">${r.devices.length} (${r.devices.filter(d=>d.trusted).length} موثوق)</span></div>
        ${a.deposit_needed?`<div class="uc-row"><span class="k">المبلغ الناقص</span><span class="v" style="color:var(--danger)">${a.deposit_needed} UM</span></div>`:''}
      </div>
      <div class="uc-actions">
        ${r.devices.filter(d=>!d.trusted).map(d=>`<button class="trust" onclick="Admin.trustDevice('${a.game_id}','${d.fingerprint}')">توثيق جهاز ••${d.fingerprint.slice(0,4)}</button>`).join('')}
        ${a.status==='banned'?`<button onclick="Admin.unban('${a.game_id}')">رفع الحظر</button>`:`<button class="ban" onclick="Admin.ban('${a.game_id}')">حظر المعرّف</button>`}
      </div>
    </div>`;
  },
  async ban(gid){ if(!confirm('حظر المعرّف '+gid+'؟'))return; await this.api('ban_id',{game_id:gid}); this.toast('تم الحظر'); this.searchUser(); },
  async unban(gid){ await this.api('unban_id',{game_id:gid}); this.toast('تم رفع الحظر'); this.searchUser(); },
  async trustDevice(gid,fp){ await this.api('trust_device',{game_id:gid,fingerprint:fp}); this.toast('تم توثيق الجهاز'); this.searchUser(); },

  // ─── WITHDRAWALS ───
  async loadWithdrawals(){
    const r=await this.api('withdrawals');
    const box=document.getElementById('wdList');
    if(!r.withdrawals||!r.withdrawals.length){ box.innerHTML=`<div class="empty">لا توجد طلبات سحب معلّقة</div>`; return; }
    box.innerHTML=r.withdrawals.map(w=>`
      <div class="wd-card">
        <div class="wd-top"><div class="wd-amt">${w.amount_um.toLocaleString()} UM</div><div class="wd-method">${w.method}</div></div>
        <div class="wd-info">المعرّف: <span>${w.game_id}</span> · رقم الاستلام: <span>${this.esc(w.account_number)}</span></div>
        <div class="wd-btns">
          <button class="wd-approve" onclick="Admin.processWd(${w.id},true)">قبول</button>
          <button class="wd-reject" onclick="Admin.processWd(${w.id},false)">رفض (إرجاع الرصيد)</button>
        </div>
      </div>`).join('');
  },
  async processWd(id,approve){ await this.api('process_wd',{id,approve}); this.toast(approve?'تم القبول':'تم الرفض وإرجاع الرصيد'); this.loadWithdrawals(); },

  // ─── BROADCAST ───
  async broadcast(){
    const title=document.getElementById('bcTitle').value.trim()||'OussoCash';
    const body=document.getElementById('bcBody').value.trim();
    if(!body){ this.toast('اكتب نص الرسالة'); return; }
    const r=await this.api('broadcast',{ title, body });
    if(r.ok){ this.toast('تم الإرسال للجميع'); document.getElementById('bcBody').value=''; document.getElementById('bcTitle').value=''; }
    else this.toast('خطأ في الإرسال');
  },

  // ─── CONTESTS ───
  async loadContests(){
    const r=await this.api('contests');
    const box=document.getElementById('contestList');
    if(!r.contests||!r.contests.length){ box.innerHTML=`<div class="empty">لا توجد مسابقات</div>`; return; }
    box.innerHTML=r.contests.map(c=>{
      const live=c.active && new Date(c.ends_at)>new Date();
      return `<div class="ct-item">
        <div class="ct-item-top"><b>${this.esc(c.title)}</b><span class="ct-prize">${c.prize_um.toLocaleString()} UM</span></div>
        <div class="ct-meta">الإحالات المطلوبة: ${c.required_refs} · تنتهي: ${new Date(c.ends_at).toLocaleDateString('ar')}
          <span class="ct-badge ${live?'ct-live':'ct-ended'}">${live?'جارية':'منتهية'}</span></div>
        ${live?`<button class="ct-end-btn" onclick="Admin.endContest(${c.id})">إنهاء المسابقة</button>`:''}
      </div>`;
    }).join('');
  },
  async createContest(){
    const title=document.getElementById('ctTitle').value.trim();
    const ends=document.getElementById('ctEnds').value;
    if(!title||!ends){ this.toast('أكمل العنوان وتاريخ الانتهاء'); return; }
    const r=await this.api('create_contest',{
      title, title_fr:document.getElementById('ctTitleFr').value.trim(),
      prize_um:document.getElementById('ctPrize').value,
      required_refs:document.getElementById('ctRequired').value,
      ends_at:new Date(ends).toISOString(),
    });
    if(r.ok){ this.toast('تم إنشاء المسابقة وإشعار الجميع');
      ['ctTitle','ctTitleFr','ctPrize','ctRequired','ctEnds'].forEach(id=>document.getElementById(id).value='');
      this.loadContests(); }
    else this.toast('خطأ');
  },
  async endContest(id){ if(!confirm('إنهاء هذه المسابقة؟'))return; await this.api('end_contest',{id}); this.toast('تم الإنهاء'); this.loadContests(); },

  statusTxt(s){ return {active:'مُفعّل',pending:'قيد المراجعة',deposit_incomplete:'إيداع ناقص',banned:'محظور'}[s]||s; },
  esc(s){ return String(s||'').replace(/[<>&"]/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[c])); },

  boot(){
    let saved; try{ saved=sessionStorage.getItem('oc_admin'); }catch{}
    if(saved){ this.pwd=saved; this.api('dashboard').then(r=>{
      if(!r.error){ document.getElementById('login').classList.add('hidden');
        document.getElementById('app').classList.remove('hidden'); this.renderDash(r); }
    }); }
    // drag & drop
    const dz=document.getElementById('dropzone');
    if(dz){
      ['dragover','dragenter'].forEach(ev=>dz.addEventListener(ev,e=>{e.preventDefault();dz.classList.add('drag');}));
      ['dragleave','drop'].forEach(ev=>dz.addEventListener(ev,e=>{e.preventDefault();dz.classList.remove('drag');}));
      dz.addEventListener('drop',e=>{ const f=e.dataTransfer.files[0]; if(f){ document.getElementById('csvFile').files=e.dataTransfer.files; this.fileChosen({target:{files:[f]}}); } });
    }
  },
};
document.addEventListener('DOMContentLoaded',()=>Admin.boot());
