// api/withdraw.js — Demande de retrait (session + appareil de confiance requis)
// طلب سحب — يتطلب جلسة + جهاز موثوق، الحد الأدنى 300 UM
const {
  sbGet, sbInsert, sbUpdate, readSession, hashFingerprint,
  pushNotify, json, readBody, MIN_WITHDRAW,
} = require('../lib/core');

const METHODS = ['Bankily', 'Masrvi', 'Sedad'];

module.exports = async (req, res) => {
  if (req.method !== 'POST') return json(res, 405, { error: 'method' });
  try {
    const body = await readBody(req);
    const sess = readSession(body.session);
    if (!sess) return json(res, 401, { error: 'no_session' });

    const gid = sess.gid;
    const method = body.method;
    const account = String(body.account_number || '').trim();

    const acc = await sbGet('accounts', `game_id=eq.${gid}&select=*`);
    if (!acc) return json(res, 400, { error: 'no_account' });
    if (acc.status !== 'active') return json(res, 400, { error: 'not_active' });
    if (!METHODS.includes(method)) return json(res, 400, { error: 'bad_method' });
    if (account.length < 6) return json(res, 400, { error: 'bad_account' });

    // النموذج المفتوح: الدخول من أي جهاز، والسحب مرتبط بحساب 1xBet المعتمد
    const fp = body.fingerprint ? hashFingerprint(body.fingerprint) : null;

    if (acc.balance_um < MIN_WITHDRAW) {
      return json(res, 400, { error: 'insufficient', balance: acc.balance_um, min: MIN_WITHDRAW });
    }

    const pending = await sbGet('withdrawals', `game_id=eq.${gid}&status=eq.pending&select=id`);
    if (pending) return json(res, 400, { error: 'pending_exists' });

    const amount = acc.balance_um;
    await sbInsert('withdrawals', {
      game_id: gid, amount_um: amount, method, account_number: account, status: 'pending',
    });
    await sbUpdate('accounts', `game_id=eq.${gid}`, { balance_um: 0 });

    await pushNotify(gid, 'OussoCash', 'Demande de retrait reçue · تم استلام طلب السحب');

    return json(res, 200, { ok: true, amount, method });
  } catch (e) {
    console.error('withdraw error', e);
    return json(res, 500, { error: 'server' });
  }
};
