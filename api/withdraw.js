// api/withdraw.js — طلب سحب (Bankily/Masrvi/Sedad)
const {
  sbGet, sbInsert, sbUpdate, cleanPhone, json, readBody, MIN_WITHDRAW,
} = require('../lib/core');

const METHODS = ['Bankily', 'Masrvi', 'Sedad'];

module.exports = async (req, res) => {
  if (req.method !== 'POST') return json(res, 405, { error: 'method' });
  try {
    const body = await readBody(req);
    const phone = cleanPhone(body.phone);
    const method = body.method;
    const account = String(body.account_number || '').trim();

    const user = await sbGet('users', `phone=eq.${phone}&select=*`);
    if (!user) return json(res, 400, { error: 'no_user' });
    if (!user.verified) return json(res, 400, { error: 'not_verified' });
    if (!METHODS.includes(method)) return json(res, 400, { error: 'bad_method' });
    if (account.length < 6) return json(res, 400, { error: 'bad_account' });

    // الرصيد كافٍ؟
    if (user.balance_um < MIN_WITHDRAW) {
      return json(res, 400, { error: 'insufficient', balance: user.balance_um, min: MIN_WITHDRAW });
    }

    // طلب معلّق موجود؟ (منع طلبين)
    const pending = await sbGet('withdrawals', `phone=eq.${phone}&status=eq.pending&select=id`);
    if (pending) return json(res, 400, { error: 'pending_exists' });

    const amount = user.balance_um; // المبلغ كامل

    await sbInsert('withdrawals', {
      phone, amount_um: amount, method, account_number: account, status: 'pending',
    });
    // خصم مؤقت
    await sbUpdate('users', `phone=eq.${phone}`, { balance_um: 0 });

    return json(res, 200, { ok: true, amount, method, account });
  } catch (e) {
    console.error('withdraw error', e);
    return json(res, 500, { error: 'server' });
  }
};
