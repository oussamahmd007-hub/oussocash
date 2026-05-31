// api/verify.js — التحقق الأول من 1xBet API
// المنطق الجديد: الدخول من أي جهاز بمجرد معرفة الـ ID (السحب مرتبط بحساب 1xBet)
//   - معرّف موجود في نظامنا  → existing (دخول مباشر، أي جهاز)
//   - معرّف محظور            → banned
//   - معرّف غير موجود بنظامنا لكن موجود في 1xBet → found (يبدأ الإجراءات)
//   - معرّف غير موجود في 1xBet → not_found (رسالة حمراء)
const {
  sb, sbGet, isValidGameId, cleanGameId, xbetSearchPlayer,
  hashFingerprint, json, readBody,
} = require('../lib/core');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return json(res, 405, { error: 'method' });
  try {
    const body = await readBody(req);
    const gid = cleanGameId(body.game_id);

    if (!isValidGameId(gid)) return json(res, 200, { status: 'invalid' });

    // محظور؟
    const banned = await sbGet('banned_ids', `game_id=eq.${gid}&select=game_id`);
    if (banned) return json(res, 200, { status: 'banned' });

    // موجود في نظامنا؟ → دخول مباشر من أي جهاز
    const existing = await sbGet('accounts', `game_id=eq.${gid}&select=status`);
    if (existing) {
      return json(res, 200, { status: 'existing', account_status: existing.status });
    }

    // جديد → تأكيد وجوده فعلاً في 1xBet (مكافحة الحسابات الوهمية)
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
