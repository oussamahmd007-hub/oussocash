// api/verify.js — التحقق الأول: من 1xBet API (مكافحة الحسابات الوهمية)
// القاعدة: لا يُقبل ID إلا إن كان موجوداً فعلاً في 1xBet، وغير مستخدم، والجهاز لا يملك حساباً.
const {
  sb, sbGet, isValidGameId, cleanGameId, xbetSearchPlayer,
  hashFingerprint, json, readBody,
} = require('../lib/core');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return json(res, 405, { error: 'method' });
  try {
    const body = await readBody(req);
    const gid = cleanGameId(body.game_id);
    const fp = body.fingerprint ? hashFingerprint(body.fingerprint) : null;

    if (!isValidGameId(gid)) return json(res, 200, { status: 'invalid' });

    // ── أمان 1: هل يملك هذا الجهاز حساباً بالفعل؟ (جهاز واحد = حساب واحد) ──
    if (fp) {
      const owned = await sbGet('accounts', `owner_device=eq.${fp}&select=game_id,status`);
      if (owned) {
        return json(res, 200, { status: 'device_has_account', account_status: owned.status });
      }
    }

    // ── أمان 2: محظور؟ ──
    const banned = await sbGet('banned_ids', `game_id=eq.${gid}&select=game_id`);
    if (banned) return json(res, 200, { status: 'banned' });

    // ── أمان 3: هل الـ ID مستخدم في حساب آخر؟ (لا يتكرر أبداً) ──
    const existing = await sbGet('accounts', `game_id=eq.${gid}&select=status,owner_device`);
    if (existing) {
      // إن كان نفس الجهاز هو المالك → دخول، غير ذلك → مرفوض (مستخدم من آخر)
      if (fp && existing.owner_device === fp) {
        return json(res, 200, { status: 'existing', account_status: existing.status });
      }
      return json(res, 200, { status: 'id_taken' });
    }

    // ── التحقق الفعلي من 1xBet (استخراج الاسم والعملة) ──
    const r = await xbetSearchPlayer(gid);
    if (!r.found) return json(res, 200, { status: 'not_found' });

    return json(res, 200, {
      status: 'found',
      game_id: gid,
      name: r.name,
      currency: r.currency || 'MRU',
    });
  } catch (e) {
    console.error('verify error', e);
    return json(res, 500, { error: 'server' });
  }
};
