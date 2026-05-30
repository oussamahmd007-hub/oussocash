// api/verify-id.js — التحقق من Game ID عبر 1xBet + مكافحة الاحتيال
const {
  sbGet, sbInsert, sbUpdate, cleanPhone, xbetSearchPlayer, json, readBody,
} = require('../lib/core');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return json(res, 405, { error: 'method' });
  try {
    const body = await readBody(req);
    const phone = cleanPhone(body.phone);
    const action = body.action || 'check'; // check | confirm
    const gid = String(body.game_id || '').replace(/[\s\-_]/g, '');

    const user = await sbGet('users', `phone=eq.${phone}&select=*`);
    if (!user) return json(res, 400, { error: 'no_user' });

    // تحقق صيغة ID
    if (!/^\d{9,13}$/.test(gid)) {
      return json(res, 400, { error: 'invalid_id' });
    }

    // ─── مكافحة الاحتيال ───
    // 1. محظور؟
    const banned = await sbGet('banned_ids', `game_id=eq.${gid}&select=game_id`);
    if (banned) return json(res, 200, { status: 'banned' });

    // 2. مُستخدم مسبقاً (مُفعّل لآخر)؟
    const usedId = await sbGet('verified_ids', `game_id=eq.${gid}&select=phone`);
    if (usedId && usedId.phone !== phone) {
      return json(res, 200, { status: 'taken' });
    }

    // 3. قيد التحقق من شخص آخر؟ → حظر تلقائي
    const pendingOther = await sbGet('users', `pending_gid=eq.${gid}&phone=neq.${phone}&select=phone`);
    if (pendingOther) {
      await sbInsert('banned_ids', { game_id: gid, reason: 'duplicate_submission' }).catch(() => {});
      return json(res, 200, { status: 'banned' });
    }

    // ─── المرحلة 1: فحص API فقط (يظهر أخضر/أحمر) ───
    if (action === 'check') {
      const result = await xbetSearchPlayer(gid);
      if (!result.found) {
        return json(res, 200, { status: 'not_found' });
      }
      return json(res, 200, {
        status: 'found',
        name: result.name,
        currency: result.currency,
      });
    }

    // ─── المرحلة 2: تأكيد → حفظ كـ pending للمراجعة عبر CSV ───
    if (action === 'confirm') {
      const result = await xbetSearchPlayer(gid);
      if (!result.found) return json(res, 200, { status: 'not_found' });

      await sbUpdate('users', `phone=eq.${phone}`, {
        pending_gid: gid,
        pending_since: new Date().toISOString(),
        name: result.name,
        currency: result.currency,
        csv_attempts: 0,
      });
      return json(res, 200, { status: 'pending', name: result.name, currency: result.currency });
    }

    return json(res, 400, { error: 'bad_action' });
  } catch (e) {
    console.error('verify-id error', e);
    return json(res, 500, { error: 'server' });
  }
};
