// api/register.js — تسجيل مستخدم برقم واتساب
const {
  sbGet, sbInsert, generateRefCode, cleanPhone, isValidPhone,
  isValidRefCodeFormat, json, readBody,
} = require('../lib/core');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return json(res, 405, { error: 'method' });
  try {
    const body = await readBody(req);
    const phone = cleanPhone(body.phone);
    const lang = body.lang === 'fr' ? 'fr' : 'ar';
    let referrerCode = (body.ref_code || '').trim().toUpperCase();

    // تحقق الرقم
    if (!isValidPhone(phone)) {
      return json(res, 400, { error: 'invalid_phone' });
    }

    // موجود مسبقاً؟ → تسجيل دخول (نُرجع بياناته)
    const existing = await sbGet('users', `phone=eq.${phone}&select=*`);
    if (existing) {
      return json(res, 200, { ok: true, existing: true, user: publicUser(existing) });
    }

    // تحقق كود الإحالة (إن وُجد)
    let validReferrer = null;
    if (referrerCode) {
      if (!isValidRefCodeFormat(referrerCode)) {
        return json(res, 400, { error: 'invalid_ref_format' });
      }
      const refUser = await sbGet('users', `ref_code=eq.${referrerCode}&select=phone,ref_code`);
      if (!refUser) {
        return json(res, 400, { error: 'ref_not_found' }); // رمز الإحالة غير صحيح
      }
      validReferrer = refUser.ref_code;
    }

    // أنشئ كود إحالة فريد للمستخدم الجديد
    const myCode = generateRefCode(phone);

    const newUser = await sbInsert('users', {
      phone, lang, ref_code: myCode,
      referrer_code: validReferrer,
    });
    const user = Array.isArray(newUser) ? newUser[0] : newUser;

    // سجّل الإحالة (المكافأة تُمنح فقط عند التفعيل)
    if (validReferrer) {
      const refUser = await sbGet('users', `ref_code=eq.${validReferrer}&select=phone`);
      if (refUser) {
        await sbInsert('referrals', {
          referrer_phone: refUser.phone,
          referred_phone: phone,
        }).catch(() => {});
      }
    }

    return json(res, 200, { ok: true, existing: false, user: publicUser(user) });
  } catch (e) {
    console.error('register error', e);
    return json(res, 500, { error: 'server' });
  }
};

function publicUser(u) {
  return {
    phone: u.phone, lang: u.lang, name: u.name, game_id: u.game_id,
    verified: u.verified, balance_um: u.balance_um, ref_code: u.ref_code,
    pending_gid: u.pending_gid, currency: u.currency,
  };
}
