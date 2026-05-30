// api/me.js — جلب بيانات المستخدم + إحصائياته + إشعاراته
const { sbGet, sb, sbUpdate, cleanPhone, json, readBody } = require('../lib/core');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return json(res, 405, { error: 'method' });
  try {
    const body = await readBody(req);
    const phone = cleanPhone(body.phone);
    const user = await sbGet('users', `phone=eq.${phone}&select=*`);
    if (!user) return json(res, 404, { error: 'no_user' });

    // إحصائيات الإحالة
    const refs = await sb(`referrals?referrer_phone=eq.${phone}&select=activated_at,commission_um`);
    const activated = refs.filter((r) => r.activated_at).length;
    const earned = refs.reduce((s, r) => s + (r.commission_um || 0), 0);

    // الإشعارات غير المرئية
    const notifs = await sb(`notifications?phone=eq.${phone}&seen=eq.false&select=id,title,body,created_at&order=created_at.desc&limit=10`);
    if (notifs.length) {
      const ids = notifs.map((n) => n.id).join(',');
      await sbUpdate('notifications', `id=in.(${ids})`, { seen: true }).catch(() => {});
    }

    return json(res, 200, {
      ok: true,
      user: {
        phone: user.phone, lang: user.lang, name: user.name,
        game_id: user.game_id, verified: user.verified,
        balance_um: user.balance_um, ref_code: user.ref_code,
        pending_gid: user.pending_gid, currency: user.currency,
      },
      stats: { activated, earned },
      notifications: notifs,
    });
  } catch (e) {
    console.error('me error', e);
    return json(res, 500, { error: 'server' });
  }
};
