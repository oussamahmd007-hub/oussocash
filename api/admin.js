// api/admin.js — لوحة الأدمن (محمية بكلمة مرور)
const {
  sb, sbGet, sbInsert, sbUpdate, json, readBody,
  WELCOME_BONUS, REFERRAL_COMMISSION, MIN_DEPOSIT_USD, USD_TO_UM, ADMIN_PASSWORD, maskPhone,
} = require('../lib/core');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return json(res, 405, { error: 'method' });
  try {
    const body = await readBody(req);
    if (body.password !== ADMIN_PASSWORD) return json(res, 401, { error: 'unauthorized' });

    const action = body.action;

    // ─── إحصائيات اللوحة ───
    if (action === 'dashboard') {
      const users = await sb('users?select=verified,balance_um,created_at');
      const wd = await sb('withdrawals?status=eq.pending&select=amount_um');
      const refs = await sb('referrals?paid=eq.true&select=commission_um');
      return json(res, 200, {
        total_users: users.length,
        verified: users.filter((u) => u.verified).length,
        pending_wd: wd.length,
        pending_wd_amount: wd.reduce((s, w) => s + w.amount_um, 0),
        total_commissions: refs.reduce((s, r) => s + r.commission_um, 0),
      });
    }

    // ─── قائمة المستخدمين ───
    if (action === 'users') {
      const users = await sb('users?select=*&order=created_at.desc&limit=200');
      return json(res, 200, { users });
    }

    // ─── السحوبات المعلّقة ───
    if (action === 'withdrawals') {
      const wd = await sb('withdrawals?status=eq.pending&select=*&order=requested_at.asc');
      return json(res, 200, { withdrawals: wd });
    }

    // ─── معالجة سحب ───
    if (action === 'process_wd') {
      const wid = body.id;
      const approve = body.approve;
      const wd = await sbGet('withdrawals', `id=eq.${wid}&select=*`);
      if (!wd || wd.status !== 'pending') return json(res, 400, { error: 'not_found' });
      if (approve) {
        await sbUpdate('withdrawals', `id=eq.${wid}`, { status: 'approved', processed_at: new Date().toISOString() });
        await sbInsert('notifications', { phone: wd.phone, title: 'تم السحب', body: `تم ارسال ${wd.amount_um} UM عبر ${wd.method}` }).catch(() => {});
      } else {
        // إرجاع الرصيد
        const u = await sbGet('users', `phone=eq.${wd.phone}&select=balance_um`);
        await sbUpdate('users', `phone=eq.${wd.phone}`, { balance_um: (u.balance_um || 0) + wd.amount_um });
        await sbUpdate('withdrawals', `id=eq.${wid}`, { status: 'rejected', processed_at: new Date().toISOString() });
      }
      return json(res, 200, { ok: true });
    }

    // ─── الإعدادات ───
    if (action === 'get_settings') {
      const s = await sb('settings?select=*');
      const map = {};
      s.forEach((r) => (map[r.key] = r.value));
      return json(res, 200, { settings: map });
    }
    if (action === 'set_setting') {
      await sbUpdate('settings', `key=eq.${body.key}`, { value: body.value, updated_at: new Date().toISOString() });
      return json(res, 200, { ok: true });
    }

    // ─── حظر ID ───
    if (action === 'ban_id') {
      await sbInsert('banned_ids', { game_id: String(body.game_id), reason: 'manual_admin' }).catch(() => {});
      return json(res, 200, { ok: true });
    }

    // ─── معالجة CSV (نص الملف يُرسل من المتصفح) ───
    if (action === 'process_csv') {
      const content = body.csv || '';
      const result = await processCSV(content, body.filename || 'upload.csv');
      return json(res, 200, result);
    }

    return json(res, 400, { error: 'bad_action' });
  } catch (e) {
    console.error('admin error', e);
    return json(res, 500, { error: 'server', detail: String(e).slice(0, 200) });
  }
};

// ═══════════════════════════════════════════════════════════════════
//  معالجة ملف 1xBet CSV (مفصول ;، ترويسة عربية)
// ═══════════════════════════════════════════════════════════════════
async function processCSV(content, filename) {
  const lines = content.split('\n');
  let headerIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('معرف اللاعب') || lines[i].includes('Player Id') || lines[i].includes('Player ID')) {
      headerIdx = i; break;
    }
  }
  if (headerIdx < 0) return { error: 'no_header', message: 'لم يتم العثور على عمود معرف اللاعب' };

  const header = lines[headerIdx].split(';');
  let cP = -1, cS = -1, cD = -1;
  header.forEach((h, i) => {
    const hc = h.trim();
    if (hc.includes('معرف اللاعب') || hc.includes('Player Id') || hc.includes('Player ID')) cP = i;
    else if (hc.includes('SubId')) cS = i;
    else if (hc.includes('مجموع الإيداعات') || hc.includes('Deposits sum')) cD = i;
  });

  // اقرأ بيانات الملف
  const csvData = {};
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const row = lines[i].split(';');
    if (row.length > cP && row[cP].trim()) {
      csvData[row[cP].trim()] = {
        sub: (cS >= 0 && row[cS] ? row[cS].trim().toUpperCase() : ''),
        dep: (cD >= 0 && row[cD] ? row[cD].trim() : '0'),
      };
    }
  }

  // كل الحسابات قيد التحقق (pending_gid غير فارغ)
  const allPending = await sb('users?select=phone,lang,referrer_code,pending_gid,csv_attempts&pending_gid=not.is.null');
  const pending = allPending.filter((u) => u.pending_gid && u.pending_gid.length > 0);
  const stats = { ok: 0, no_sub: 0, no_dep: 0, not_found: 0, taken: 0, total: pending.length };

  for (const u of pending) {
    const gid = u.pending_gid;
    if (!gid) continue;

    if (!csvData[gid]) {
      stats.not_found++;
      const att = (u.csv_attempts || 0) + 1;
      if (att >= 5) {
        await sbUpdate('users', `phone=eq.${u.phone}`, { pending_gid: '', pending_since: null, csv_attempts: 0 });
        await notify(u.phone, 'لم يتم العثور على حسابك', `تم حذف الـ ID ${gid} بعد 5 محاولات`);
      } else {
        await sbUpdate('users', `phone=eq.${u.phone}`, { csv_attempts: att });
      }
      continue;
    }

    const r = csvData[gid];
    const depUsd = parseFloat(r.dep.replace(',', '.')) || 0;
    const depUm = Math.round(depUsd * USD_TO_UM);

    if (!r.sub.includes('OUSSO')) {
      stats.no_sub++;
      await sbUpdate('users', `phone=eq.${u.phone}`, { pending_gid: '', pending_since: null });
      await notify(u.phone, 'تعذر قبول حسابك', `الحساب ${gid} غير مرتبط ببروموكود OUSSO`);
      continue;
    }
    if (depUsd < MIN_DEPOSIT_USD) {
      stats.no_dep++;
      await notify(u.phone, 'الايداع غير كافٍ', `ايداعك ${depUm} UM، المطلوب 200 UM`);
      continue;
    }
    const taken = await sbGet('verified_ids', `game_id=eq.${gid}&select=phone`);
    if (taken && taken.phone !== u.phone) {
      stats.taken++;
      await sbUpdate('users', `phone=eq.${u.phone}`, { pending_gid: '', pending_since: null });
      continue;
    }

    // ✅ تفعيل
    const cur = await sbGet('users', `phone=eq.${u.phone}&select=balance_um`);
    await sbUpdate('users', `phone=eq.${u.phone}`, {
      verified: true, game_id: gid, pending_gid: '',
      balance_um: (cur.balance_um || 0) + WELCOME_BONUS,
      activated_at: new Date().toISOString(),
    });
    await sbInsert('verified_ids', { game_id: gid, phone: u.phone }).catch(() => {});
    stats.ok++;
    await notify(u.phone, 'تم تفعيل حسابك', `مبروك! حصلت على ${WELCOME_BONUS} UM. شارك رابطك واربح المزيد`);

    // عمولة الإحالة
    if (u.referrer_code) {
      const ref = await sbGet('users', `ref_code=eq.${u.referrer_code}&select=phone,balance_um`);
      if (ref) {
        await sbUpdate('users', `phone=eq.${ref.phone}`, { balance_um: (ref.balance_um || 0) + REFERRAL_COMMISSION });
        await sbUpdate('referrals', `referred_phone=eq.${u.phone}`, {
          commission_um: REFERRAL_COMMISSION, paid: true, activated_at: new Date().toISOString(),
        });
        await notify(ref.phone, 'احالة جديدة فعلت', `ربحت ${REFERRAL_COMMISSION} UM من احالة ${maskPhone(u.phone)}`);
      }
    }
  }

  await sbInsert('csv_uploads', { filename, rows_total: stats.total, rows_activated: stats.ok }).catch(() => {});
  return { ok: true, stats };
}

async function notify(phone, title, bodyText) {
  await sbInsert('notifications', { phone, title, body: bodyText }).catch(() => {});
}
