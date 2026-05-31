// api/me.js — بيانات المستخدم (يقرأ بياناته فقط) + إحصائيات + إشعارات + مسابقة
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

    // تطابق الجهاز مع الجلسة → حالة الثقة
    let deviceTrusted = false;
    if (body.fingerprint) {
      const fp = hashFingerprint(body.fingerprint);
      const dev = await sbGet('devices', `game_id=eq.${gid}&fingerprint=eq.${fp}&select=trusted`);
      deviceTrusted = !!(dev && dev.trusted);
    }

    await sbUpdate('accounts', `game_id=eq.${gid}`, { last_seen_at: new Date().toISOString() }).catch(() => {});

    // إحصائيات الإحالة (الخاصة بهذا المستخدم فقط)
    const refs = await sb(`referrals?referrer_gid=eq.${gid}&select=activated_at,commission_um`);
    const activated = refs.filter((r) => r.activated_at).length;
    const earned = refs.reduce((s, r) => s + (r.commission_um || 0), 0);

    // الإشعارات غير المقروءة (الخاصة + الجماعية '*')
    const notifs = await sb(`notifications?or=(game_id.eq.${gid},game_id.eq.*)&seen=eq.false&select=id,title,body,created_at&order=created_at.desc&limit=15`);
    if (notifs.length) {
      const own = notifs.filter((n) => n.game_id !== '*').map((n) => n.id);
      if (own.length) await sbUpdate('notifications', `id=in.(${own.join(',')})`, { seen: true }).catch(() => {});
    }

    // المسابقة النشطة + ترتيب هذا المستخدم
    let contest = null;
    const c = await sbGet('contests', `active=eq.true&ends_at=gt.${new Date().toISOString()}&select=*&order=ends_at.asc`);
    if (c) {
      const myRefs = refs.filter((r) => r.activated_at && new Date(r.activated_at) >= new Date(c.starts_at)).length;
      contest = {
        id: c.id, title: c.title, title_fr: c.title_fr, prize_um: c.prize_um,
        required_refs: c.required_refs, ends_at: c.ends_at, my_refs: myRefs,
      };
    }

    return json(res, 200, {
      ok: true,
      account: publicAccount(account),
      device_trusted: deviceTrusted,
      stats: { activated, earned, percent: REFERRAL_PERCENT, min_withdraw: MIN_WITHDRAW },
      notifications: notifs,
      contest,
    });
  } catch (e) {
    console.error('me error', e);
    return json(res, 500, { error: 'server' });
  }
};
