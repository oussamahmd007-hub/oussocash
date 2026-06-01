// api/withdraw.js — طلب سحب إلى حساب 1xBet المرتبط (الحد الأدنى 300 UM)
// السحب محصور داخل حساب 1xBet — مسؤولية المستخدم، لا قيود على الجهاز
const {
  sbGet, sbInsert, sbUpdate, readSession,
  pushNotify, json, readBody, MIN_WITHDRAW,
} = require('../lib/core');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return json(res, 405, { error: 'method' });
  try {
    const body = await readBody(req);
    const sess = readSession(body.session);
    if (!sess) return json(res, 401, { error: 'no_session' });

    const gid = sess.gid;
    // السحب دائماً إلى معرّف 1xBet المرتبط بالحساب
    const method = '1xbet';
    const account = gid;

    const acc = await sbGet('accounts', `game_id=eq.${gid}&select=*`);
    if (!acc) return json(res, 400, { error: 'no_account' });
    if (acc.status !== 'active') return json(res, 400, { error: 'not_active' });

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

    await pushNotify(gid, 'OussoCash', `تم استلام طلب سحب ${amount} UM إلى حساب 1xBet · Demande de retrait reçue`);

    return json(res, 200, { ok: true, amount, method });
  } catch (e) {
    console.error('withdraw error', e);
    return json(res, 500, { error: 'server' });
  }
};
