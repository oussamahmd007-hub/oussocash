// api/register.js — تسجيل/دخول فوري (نموذج متعدد الأجهزة، بدون تحقق CSV)
// المنطق: الشرط الوحيد هو معرّف 1xBet. التفعيل فوري عند نجاح التحقق من الـ API.
//   - حساب موجود  → دخول مباشر + جلسة (أي جهاز)
//   - حساب جديد   → إنشاء حساب مُفعَّل فوراً + مكافأة الترحيب + عمولة الإحالة
//   السحب مرتبط بحساب 1xBet ولا يمكن تغييره (مسؤولية المستخدم) + وسيلة استرجاع اختيارية (PIN).
const {
  sbGet, sbInsert, sbUpdate, isValidGameId, cleanGameId,
  isValidRefCode, generateRefCode, xbetSearchPlayer,
  hashFingerprint, hashPin, makeSession, publicAccount, pushNotify,
  json, readBody, WELCOME_BONUS, REFERRAL_COMMISSION,
} = require('../lib/core');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return json(res, 405, { error: 'method' });
  try {
    const body  = await readBody(req);
    const gid   = cleanGameId(body.game_id);
    const lang  = body.lang === 'fr' ? 'fr' : 'ar';
    const ua    = String(body.user_agent || '').slice(0, 180);
    const pin   = String(body.pin || '').trim();
    let refCode = String(body.ref_code || '').trim().toUpperCase();

    if (!isValidGameId(gid)) return json(res, 400, { error: 'invalid_id' });
    const fp = body.fingerprint ? hashFingerprint(body.fingerprint) : null;

    // محظور؟
    const banned = await sbGet('banned_ids', `game_id=eq.${gid}&select=game_id`);
    if (banned) return json(res, 200, { status: 'banned' });

    // حساب موجود → دخول مباشر من أي جهاز
    const existing = await sbGet('accounts', `game_id=eq.${gid}&select=*`);
    if (existing) {
      if (fp) {
        await sbInsert('devices', { game_id: gid, fingerprint: fp, trusted: true, user_agent: ua })
          .catch(() => sbUpdate('devices', `game_id=eq.${gid}&fingerprint=eq.${fp}`, { last_seen_at: new Date().toISOString() }).catch(() => {}));
      }
      return json(res, 200, {
        ok: true, existing: true, device: 'trusted',
        account: publicAccount(existing), session: makeSession(gid, fp || 'web'),
      });
    }

    // حساب جديد — الشرط الوحيد: التأكد من وجود المعرّف في 1xBet
    const r = await xbetSearchPlayer(gid);
    if (!r.found) return json(res, 200, { status: 'not_found' });

    // كود المُحيل (إن وُجد وصالح ولا يساوي نفسه)
    let validReferrer = null;
    if (refCode && isValidRefCode(refCode)) {
      const ref = await sbGet('accounts', `ref_code=eq.${refCode}&select=game_id,ref_code`);
      if (ref && ref.game_id !== gid) validReferrer = ref.ref_code;
    }

    const myCode  = generateRefCode(gid);
    const now     = new Date().toISOString();
    const welcome = validReferrer ? WELCOME_BONUS : 0; // مكافأة ترحيب للمُحالين

    let created;
    try {
      created = await sbInsert('accounts', {
        game_id: gid, name: r.name, currency: r.currency || 'MRU', lang,
        status: 'active', ref_code: myCode, referrer_code: validReferrer,
        owner_device: fp, balance_um: welcome,
        deposit_done: true, deposit_needed: 0,
        pin_hash: pin ? hashPin(gid, pin) : null,
        activated_at: now,
      });
    } catch {
      // سباق إدخال متزامن → اقرأ الموجود وادخل
      const again = await sbGet('accounts', `game_id=eq.${gid}&select=*`);
      if (again) return json(res, 200, { ok: true, existing: true, device: 'trusted', account: publicAccount(again), session: makeSession(gid, fp || 'web') });
      return json(res, 500, { error: 'race' });
    }
    const account = Array.isArray(created) ? created[0] : created;

    if (fp) await sbInsert('devices', { game_id: gid, fingerprint: fp, trusted: true, user_agent: ua }).catch(() => {});

    // الإحالة — تفعيل فوري + دفع العمولة (مرّة واحدة، 5 UM)
    if (validReferrer) {
      const ref = await sbGet('accounts', `ref_code=eq.${validReferrer}&select=game_id,balance_um`);
      if (ref && ref.game_id !== gid) {
        await sbInsert('referrals', {
          referrer_gid: ref.game_id, referred_gid: gid,
          commission_um: REFERRAL_COMMISSION, paid: true, activated_at: now,
        }).catch(() => {});
        await sbUpdate('accounts', `game_id=eq.${ref.game_id}`, { balance_um: (ref.balance_um || 0) + REFERRAL_COMMISSION }).catch(() => {});
        await pushNotify(ref.game_id, 'OussoCash', `إحالة جديدة مُفعّلة · Parrainage activé · +${REFERRAL_COMMISSION} UM`).catch(() => {});
      }
    }

    return json(res, 200, {
      ok: true, existing: false, device: 'trusted', new_account: true,
      account: publicAccount(account), session: makeSession(gid, fp || 'web'),
    });
  } catch (e) {
    console.error('register error', e);
    return json(res, 500, { error: 'server' });
  }
};
