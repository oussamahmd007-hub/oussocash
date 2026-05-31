// api/contest.js — لوحة المسابقة العامة (أفضل 10 إحالات بعد بدء المسابقة)
const { sb, sbGet, readSession, json, readBody } = require('../lib/core');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return json(res, 405, { error: 'method' });
  try {
    const body = await readBody(req);
    const c = await sbGet('contests', `active=eq.true&ends_at=gt.${new Date().toISOString()}&select=*&order=ends_at.asc`);
    if (!c) return json(res, 200, { contest: null });

    // كل الإحالات المُفعّلة بعد بدء المسابقة فقط
    const refs = await sb(`referrals?activated_at=gte.${c.starts_at}&select=referrer_gid`);
    const counts = {};
    refs.forEach((r) => { counts[r.referrer_gid] = (counts[r.referrer_gid] || 0) + 1; });

    const ranked = Object.entries(counts)
      .map(([gid, n]) => ({ gid, n }))
      .sort((a, b) => b.n - a.n)
      .slice(0, 10);

    // أسماء مختصرة (خصوصية: الاسم الأول + آخر رقمين من الـ ID)
    const names = {};
    for (const r of ranked) {
      const a = await sbGet('accounts', `game_id=eq.${r.gid}&select=name`);
      const first = (a && a.name ? a.name.trim().split(/\s+/)[0] : '') || 'لاعب';
      names[r.gid] = `${first} ••${r.gid.slice(-2)}`;
    }

    // ترتيب المستخدم الحالي (إن وُجدت جلسة)
    let myRank = null, myRefs = 0;
    const sess = readSession(body.session);
    if (sess) {
      myRefs = counts[sess.gid] || 0;
      const all = Object.entries(counts).map(([g, n]) => ({ g, n })).sort((a, b) => b.n - a.n);
      const idx = all.findIndex((x) => x.g === sess.gid);
      myRank = idx >= 0 ? idx + 1 : null;
    }

    return json(res, 200, {
      contest: {
        id: c.id, title: c.title, title_fr: c.title_fr, prize_um: c.prize_um,
        required_refs: c.required_refs, starts_at: c.starts_at, ends_at: c.ends_at,
      },
      leaderboard: ranked.map((r, i) => ({ rank: i + 1, name: names[r.gid], refs: r.n })),
      me: { rank: myRank, refs: myRefs },
    });
  } catch (e) {
    console.error('contest error', e);
    return json(res, 500, { error: 'server' });
  }
};
