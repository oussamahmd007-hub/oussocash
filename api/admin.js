// api/admin.js — لوحة الإدارة (محمية بكلمة مرور)
// الإجراءات: dashboard · search_user · accounts · withdrawals · process_wd
//            devices · trust_device · ban_id · unban_id · broadcast
//            contests · create_contest · end_contest · settings · cleanup · process_csv
const {
  sb, sbGet, sbInsert, sbUpdate, sbDelete, json, readBody, pushNotify, pushBroadcast,
  WELCOME_BONUS, REFERRAL_COMMISSION, MIN_DEPOSIT_USD, USD_TO_UM,
  DEPOSIT_DEADLINE_DAYS, PENDING_TTL_HOURS, ADMIN_PASSWORD,
} = require('../lib/core');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return json(res, 405, { error: 'method' });
  try {
    const body = await readBody(req);
    if (!ADMIN_PASSWORD || body.password !== ADMIN_PASSWORD) return json(res, 401, { error: 'unauthorized' });
    const action = body.action;

    // ─── لوحة المعلومات ───
    if (action === 'dashboard') {
      const accs = await sb('accounts?select=status,balance_um');
      const wd = await sb('withdrawals?status=eq.pending&select=amount_um');
      const refs = await sb('referrals?paid=eq.true&select=commission_um');
      return json(res, 200, {
        total: accs.length,
        active: accs.filter((a) => a.status === 'active').length,
        pending: accs.filter((a) => a.status === 'pending').length,
        incomplete: accs.filter((a) => a.status === 'deposit_incomplete').length,
        pending_wd: wd.length,
        pending_wd_amount: wd.reduce((s, w) => s + w.amount_um, 0),
        total_commissions: refs.reduce((s, r) => s + r.commission_um, 0),
        balance_total: accs.reduce((s, a) => s + (a.balance_um || 0), 0),
      });
    }

    // ─── البحث عن مستخدم بالـ ID (بياناته كاملة) ───
    if (action === 'search_user') {
      const gid = String(body.game_id || '').replace(/\D/g, '');
      if (!gid) return json(res, 200, { found: false });
      const a = await sbGet('accounts', `game_id=eq.${gid}&select=*`);
      if (!a) {
        const banned = await sbGet('banned_ids', `game_id=eq.${gid}&select=*`);
        return json(res, 200, { found: false, banned: banned || null });
      }
      const refs = await sb(`referrals?referrer_gid=eq.${gid}&select=referred_gid,activated_at,commission_um`);
      const devs = await sb(`devices?game_id=eq.${gid}&select=fingerprint,trusted,user_agent,last_seen_at`);
      const wds = await sb(`withdrawals?game_id=eq.${gid}&select=*&order=requested_at.desc&limit=10`);
      const referredBy = a.referrer_code
        ? await sbGet('accounts', `ref_code=eq.${a.referrer_code}&select=game_id,name`) : null;
      return json(res, 200, {
        found: true, account: a,
        referrals: { count: refs.filter((r) => r.activated_at).length, total: refs.length,
          earned: refs.reduce((s, r) => s + (r.commission_um || 0), 0) },
        referred_by: referredBy,
        devices: devs, withdrawals: wds,
      });
    }

    // ─── قائمة الحسابات (مع فلتر اختياري) ───
    if (action === 'accounts') {
      const f = body.filter && body.filter !== 'all' ? `status=eq.${body.filter}&` : '';
      const accs = await sb(`accounts?${f}select=game_id,name,status,balance_um,country,total_deposit,created_at,referrer_code&order=created_at.desc&limit=300`);
      return json(res, 200, { accounts: accs });
    }

    // ─── السحوبات المعلّقة ───
    if (action === 'withdrawals') {
      const wd = await sb('withdrawals?status=eq.pending&select=*&order=requested_at.asc');
      return json(res, 200, { withdrawals: wd });
    }
    if (action === 'process_wd') {
      const wid = body.id, approve = body.approve;
      const wd = await sbGet('withdrawals', `id=eq.${wid}&select=*`);
      if (!wd || wd.status !== 'pending') return json(res, 400, { error: 'not_found' });
      if (approve) {
        await sbUpdate('withdrawals', `id=eq.${wid}`, { status: 'approved', processed_at: new Date().toISOString() });
        await pushNotify(wd.game_id, 'OussoCash', `تم تنفيذ السحب · Retrait effectué · ${wd.amount_um} UM`);
      } else {
        const a = await sbGet('accounts', `game_id=eq.${wd.game_id}&select=balance_um`);
        await sbUpdate('accounts', `game_id=eq.${wd.game_id}`, { balance_um: (a.balance_um || 0) + wd.amount_um });
        await sbUpdate('withdrawals', `id=eq.${wid}`, { status: 'rejected', processed_at: new Date().toISOString() });
      }
      return json(res, 200, { ok: true });
    }

    // ─── الأجهزة ───
    if (action === 'devices') {
      const devs = await sb(`devices?game_id=eq.${body.game_id}&select=*&order=created_at.desc`);
      return json(res, 200, { devices: devs });
    }
    if (action === 'trust_device') {
      await sbUpdate('devices', `game_id=eq.${body.game_id}&fingerprint=eq.${body.fingerprint}`, { trusted: true }).catch(() => {});
      await pushNotify(body.game_id, 'OussoCash', 'تمت إضافة جهاز موثوق · Appareil de confiance ajouté');
      return json(res, 200, { ok: true });
    }

    // ─── الحظر / رفع الحظر ───
    if (action === 'ban_id') {
      await sbInsert('banned_ids', { game_id: String(body.game_id), reason: body.reason || 'manual_admin' }).catch(() => {});
      await sbUpdate('accounts', `game_id=eq.${body.game_id}`, { status: 'banned' }).catch(() => {});
      return json(res, 200, { ok: true });
    }
    if (action === 'unban_id') {
      await sbDelete('banned_ids', `game_id=eq.${body.game_id}`).catch(() => {});
      return json(res, 200, { ok: true });
    }

    // ─── رسالة جماعية لكل المستخدمين ───
    if (action === 'broadcast') {
      const title = String(body.title || 'OussoCash').slice(0, 80);
      const msg = String(body.body || '').slice(0, 300);
      if (!msg) return json(res, 400, { error: 'empty' });
      await pushBroadcast(title, msg);
      return json(res, 200, { ok: true });
    }

    // ─── المسابقات ───
    if (action === 'contests') {
      const cs = await sb('contests?select=*&order=created_at.desc&limit=20');
      return json(res, 200, { contests: cs });
    }
    if (action === 'create_contest') {
      const created = await sbInsert('contests', {
        title: String(body.title || 'مسابقة الإحالات').slice(0, 100),
        title_fr: String(body.title_fr || '').slice(0, 100),
        prize_um: parseInt(body.prize_um) || 0,
        required_refs: parseInt(body.required_refs) || 0,
        starts_at: body.starts_at || new Date().toISOString(),
        ends_at: body.ends_at,
        active: true,
      });
      const c = Array.isArray(created) ? created[0] : created;
      // إشعار جماعي ببدء المسابقة
      await pushBroadcast(
        'مسابقة جديدة · Nouveau concours',
        `${c.title} · الجائزة ${c.prize_um} UM · ادعُ أصدقاءك واربح!`
      );
      return json(res, 200, { ok: true, contest: c });
    }
    if (action === 'end_contest') {
      await sbUpdate('contests', `id=eq.${body.id}`, { active: false });
      return json(res, 200, { ok: true });
    }

    // ─── الإعدادات ───
    if (action === 'get_settings') {
      const s = await sb('settings?select=*'); const map = {};
      s.forEach((r) => (map[r.key] = r.value));
      return json(res, 200, { settings: map });
    }
    if (action === 'set_setting') {
      await sbUpdate('settings', `key=eq.${body.key}`, { value: body.value, updated_at: new Date().toISOString() });
      return json(res, 200, { ok: true });
    }

    // ─── تنظيف الحسابات المعلّقة منتهية المدة ───
    if (action === 'cleanup_pending') {
      const cutoff = new Date(Date.now() - PENDING_TTL_HOURS * 36e5).toISOString();
      const stale = await sb(`accounts?status=eq.pending&created_at=lt.${cutoff}&deposit_done=eq.false&select=game_id`);
      for (const a of stale) await sbDelete('accounts', `game_id=eq.${a.game_id}`).catch(() => {});
      return json(res, 200, { ok: true, removed: stale.length });
    }

    // ─── معالجة تقرير CSV (القبول النهائي للـ ID) ───
    if (action === 'process_csv') {
      return json(res, 200, await processCSV(body.csv || '', body.filename || 'report.csv'));
    }

    return json(res, 400, { error: 'bad_action' });
  } catch (e) {
    console.error('admin error', e);
    return json(res, 500, { error: 'server', detail: String(e).slice(0, 200) });
  }
};

// ═══════════════════════════════════════════════════════════════════
//  معالجة تقرير 1xBet CSV — استخراج: معرف اللاعب · SubId · الإيداعات · البلد · تاريخ التسجيل
//  بنية حقيقية: كتلة معلومات أعلى الملف ثم صف ترويسة يحوي "معرف اللاعب"
// ═══════════════════════════════════════════════════════════════════
async function processCSV(content, filename) {
  const lines = content.split('\n');
  let hIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('معرف اللاعب') || /Player\s*Id/i.test(lines[i])) { hIdx = i; break; }
  }
  if (hIdx < 0) return { error: 'no_header', message: 'عمود معرف اللاعب غير موجود' };

  const header = lines[hIdx].split(';');
  const col = { id: -1, sub: -1, dep: -1, country: -1, reg: -1 };
  header.forEach((h, i) => {
    const hc = h.trim();
    if (hc.includes('معرف اللاعب') || /Player\s*Id/i.test(hc)) col.id = i;
    else if (/SubId/i.test(hc)) col.sub = i;
    else if (hc.includes('مجموع الإيداعات') || /Deposits?\s*sum/i.test(hc)) col.dep = i;
    else if (hc.includes('البلد') || /Country/i.test(hc)) col.country = i;
    else if (hc.includes('تاريخ التسجيل') || /Registration\s*date/i.test(hc)) col.reg = i;
  });
  if (col.id < 0) return { error: 'no_id_col', message: 'تعذّر تحديد عمود معرف اللاعب' };

  const csv = {};
  for (let i = hIdx + 1; i < lines.length; i++) {
    const row = lines[i].split(';');
    const gid = (row[col.id] || '').trim();
    if (!/^\d{6,13}$/.test(gid)) continue;
    csv[gid] = {
      sub: col.sub >= 0 ? (row[col.sub] || '').trim().toUpperCase() : '',
      dep: col.dep >= 0 ? (row[col.dep] || '0').trim() : '0',
      country: col.country >= 0 ? (row[col.country] || '').trim() : '',
      reg: col.reg >= 0 ? (row[col.reg] || '').trim() : '',
    };
  }

  const pending = await sb('accounts?select=*&status=in.(pending,deposit_incomplete)');
  const stats = { activated: 0, no_sub: 0, deposit_incomplete: 0, not_in_csv: 0, total: pending.length };
  const now = new Date().toISOString();

  for (const a of pending) {
    const gid = a.game_id;

    if (!csv[gid]) { // غير موجود في التقرير → حذف
      stats.not_in_csv++;
      await sbDelete('accounts', `game_id=eq.${gid}`).catch(() => {});
      continue;
    }

    const r = csv[gid];
    const depUsd = parseFloat(r.dep.replace(',', '.')) || 0;
    const depUm = Math.round(depUsd * USD_TO_UM);
    const minUm = Math.round(MIN_DEPOSIT_USD * USD_TO_UM);
    const extracted = { country: r.country, xbet_reg_date: r.reg, total_deposit: depUsd };

    if (!r.sub.includes('OUSSO')) { // ليس عبر وكالتنا → حظر + حذف
      stats.no_sub++;
      await sbInsert('banned_ids', { game_id: gid, reason: 'no_ousso_subid' }).catch(() => {});
      await sbDelete('accounts', `game_id=eq.${gid}`).catch(() => {});
      continue;
    }

    if (depUsd < MIN_DEPOSIT_USD) { // إيداع غير كافٍ
      stats.deposit_incomplete++;
      const needed = Math.max(0, minUm - depUm);
      if (a.deadline_at && new Date(a.deadline_at) < new Date()) { // انتهت المهلة → حظر
        await sbInsert('banned_ids', { game_id: gid, reason: 'deposit_deadline_passed' }).catch(() => {});
        await sbDelete('accounts', `game_id=eq.${gid}`).catch(() => {});
        await pushNotify(gid, 'OussoCash', 'تم حذف المعرّف لعدم إكمال الإيداع · ID supprimé');
      } else {
        const deadline = a.deadline_at || new Date(Date.now() + DEPOSIT_DEADLINE_DAYS * 864e5).toISOString();
        await sbUpdate('accounts', `game_id=eq.${gid}`, { ...extracted, status: 'deposit_incomplete', deposit_needed: needed, deadline_at: deadline });
        await pushNotify(gid, 'OussoCash', `أكمل إيداعك: ينقصك ${needed} UM خلال 3 أيام · Complétez ${needed} UM`);
      }
      continue;
    }

    // ✅ تفعيل
    await sbUpdate('accounts', `game_id=eq.${gid}`, {
      ...extracted, status: 'active', deposit_done: true, deposit_needed: 0,
      balance_um: (a.balance_um || 0) + (a.referrer_code ? WELCOME_BONUS : 0),
      activated_at: now,
    });
    stats.activated++;
    await pushNotify(gid, 'OussoCash', a.referrer_code
      ? `تم تفعيل حسابك · Compte activé · +${WELCOME_BONUS} UM`
      : 'تم تفعيل حسابك · Compte activé');

    if (a.referrer_code) { // عمولة الإحالة
      const ref = await sbGet('accounts', `ref_code=eq.${a.referrer_code}&select=game_id,balance_um`);
      if (ref) {
        await sbUpdate('accounts', `game_id=eq.${ref.game_id}`, { balance_um: (ref.balance_um || 0) + REFERRAL_COMMISSION });
        await sbUpdate('referrals', `referred_gid=eq.${gid}`, { commission_um: REFERRAL_COMMISSION, paid: true, activated_at: now });
        await pushNotify(ref.game_id, 'OussoCash', `إحالة جديدة مُفعّلة · Parrainage activé · +${REFERRAL_COMMISSION} UM`);
      }
    }
  }

  await sbInsert('csv_uploads', { filename, rows_total: stats.total, rows_activated: stats.activated }).catch(() => {});
  return { ok: true, stats, columns_found: col };
}
