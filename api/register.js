// api/register.js — إنشاء حساب pending (القبول النهائي يتم عبر CSV من الأدمن)
// أمان: جهاز واحد = حساب واحد · ID لا يتكرر · لا إضافة ID جديد بعد امتلاك حساب
const {
  sb, sbGet, sbInsert, sbUpdate, isValidGameId, cleanGameId,
  isValidRefCode, generateRefCode, xbetSearchPlayer,
  hashFingerprint, hashPin, makeSession, publicAccount,
  json, readBody, DEPOSIT_DEADLINE_DAYS,
} = require('../lib/core');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return json(res, 405, { error: 'method' });
  try {
    const body  = await readBody(req);
    const gid   = cleanGameId(body.game_id);
    const lang  = body.lang === 'fr' ? 'fr' : 'ar';
    const ua    = String(body.user_agent || '').slice(0, 180);
    const pin   = String(body.pin || '').replace(/\D/g, '').slice(0, 4);
    let refCode = String(body.ref_code || '').trim().toUpperCase();

    if (!isValidGameId(gid)) return json(res, 400, { error: 'invalid_id' });
    if (!body.fingerprint)   return json(res, 400, { error: 'no_device' });
    const fp = hashFingerprint(body.fingerprint);

    // ── محظور؟ ──
    const banned = await sbGet('banned_ids', `game_id=eq.${gid}&select=game_id`);
    if (banned) return json(res, 200, { status: 'banned' });

    // ── هل الجهاز يملك حساباً؟ ──
    const owned = await sbGet('accounts', `owner_device=eq.${fp}&select=game_id`);

    // ── حساب موجود بنفس الـ ID؟ ──
    const existing = await sbGet('accounts', `game_id=eq.${gid}&select=*`);
    if (existing) {
      // نفس الجهاز هو المالك → دخول
      if (existing.owner_device === fp) {
        await attachDevice(existing, fp, ua);
        return json(res, 200, {
          ok: true, existing: true, device: 'trusted',
          account: publicAccount(existing), session: makeSession(gid, fp),
        });
      }
      return json(res, 200, { status: 'id_taken' }); // مستخدم من جهاز آخر
    }

    // إذا الجهاز يملك حساباً مختلفاً ولا يطابق الـ ID المطلوب → رفض إضافة ID جديد
    if (owned && owned.game_id !== gid) return json(res, 200, { status: 'device_has_account' });

    // ── حساب جديد — تأكيد وجوده في 1xBet ──
    const r = await xbetSearchPlayer(gid);
    if (!r.found) return json(res, 200, { status: 'not_found' });

    // كود المُحيل (إن وُجد وصالح ولا يساوي نفسه)
    let validReferrer = null;
    if (refCode && isValidRefCode(refCode)) {
      const ref = await sbGet('accounts', `ref_code=eq.${refCode}&select=game_id,ref_code`);
      if (ref && ref.game_id !== gid) validReferrer = ref.ref_code;
    }

    const myCode = generateRefCode(gid);
    const deadline = new Date(Date.now() + DEPOSIT_DEADLINE_DAYS * 864e5).toISOString();

    let created;
    try {
      created = await sbInsert('accounts', {
        game_id: gid, name: r.name, currency: r.currency || 'MRU', lang,
        status: 'pending', ref_code: myCode, referrer_code: validReferrer,
        owner_device: fp, pin_hash: pin.length === 4 ? hashPin(gid, pin) : null,
        deadline_at: deadline,
      });
    } catch {
      // سباق إدخال متزامن على نفس الـ ID → مرفوض
      return json(res, 200, { status: 'id_taken' });
    }
    const account = Array.isArray(created) ? created[0] : created;

    // الجهاز الأول = موثوق تلقائياً
    await sbInsert('devices', { game_id: gid, fingerprint: fp, trusted: true, user_agent: ua }).catch(() => {});

    // تسجيل الإحالة (العمولة تُدفع عند التفعيل عبر CSV)
    if (validReferrer) {
      const ref = await sbGet('accounts', `ref_code=eq.${validReferrer}&select=game_id`);
      if (ref) await sbInsert('referrals', { referrer_gid: ref.game_id, referred_gid: gid }).catch(() => {});
    }

    return json(res, 200, {
      ok: true, existing: false, device: 'trusted',
      account: publicAccount(account), session: makeSession(gid, fp),
    });
  } catch (e) {
    console.error('register error', e);
    return json(res, 500, { error: 'server' });
  }
};

async function attachDevice(account, fp, ua) {
  const gid = account.game_id;
  const dev = await sbGet('devices', `game_id=eq.${gid}&fingerprint=eq.${fp}&select=trusted`);
  if (dev) {
    await sbUpdate('devices', `game_id=eq.${gid}&fingerprint=eq.${fp}`, { last_seen_at: new Date().toISOString() }).catch(() => {});
    return { device: dev.trusted ? 'trusted' : 'new' };
  }
  await sbInsert('devices', { game_id: gid, fingerprint: fp, trusted: false, user_agent: ua }).catch(() => {});
  return { device: 'new' };
}
