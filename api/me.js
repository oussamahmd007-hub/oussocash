// api/me.js — Données du compte + stats parrainage + notifications (session)
// بيانات الحساب + إحصائيات الإحالة + الإشعارات (عبر الجلسة)
const {
  sb, sbGet, sbUpdate, readSession, hashFingerprint,
  publicAccount, json, readBody, REFERRAL_PERCENT, MIN_WITHDRAW,
} = require('../lib/core');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return json(res, 405, { error: 'method' });
  try {
    const body = await readBody(req);
    const sess = readSession(body.session);
    if (!sess) return json(res, 401, { error: 'no_session' });

    const gid = sess.gid;
    const account = await sbGet('accounts', `game_id=eq.${gid}&select=*`);
    if (!account) return json(res, 404, { error: 'no_account' });
    if (account.status === 'banned') return json(res, 403, { error: 'banned' });

    // Confirmer que l'appareil correspond à la session
    let deviceTrusted = false;
    if (body.fingerprint) {
      const fp = hashFingerprint(body.fingerprint);
      const dev = await sbGet('devices', `game_id=eq.${gid}&fingerprint=eq.${fp}&select=trusted`);
      deviceTrusted = !!(dev && dev.trusted);
    }

    await sbUpdate('accounts', `game_id=eq.${gid}`, { last_seen_at: new Date().toISOString() }).catch(() => {});

    // Stats de parrainage
    const refs = await sb(`referrals?referrer_gid=eq.${gid}&select=activated_at,commission_um`);
    const activated = refs.filter((r) => r.activated_at).length;
    const earned = refs.reduce((s, r) => s + (r.commission_um || 0), 0);

    // Notifications non lues
    const notifs = await sb(`notifications?game_id=eq.${gid}&seen=eq.false&select=id,title,body,created_at&order=created_at.desc&limit=15`);
    if (notifs.length) {
      const ids = notifs.map((n) => n.id).join(',');
      await sbUpdate('notifications', `id=in.(${ids})`, { seen: true }).catch(() => {});
    }

    return json(res, 200, {
      ok: true,
      account: publicAccount(account),
      device_trusted: deviceTrusted,
      stats: { activated, earned, percent: REFERRAL_PERCENT, min_withdraw: MIN_WITHDRAW },
      notifications: notifs,
    });
  } catch (e) {
    console.error('me error', e);
    return json(res, 500, { error: 'server' });
  }
};
