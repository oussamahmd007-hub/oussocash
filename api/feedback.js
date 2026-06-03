// api/feedback.js — اقتراحات المستخدمين (ساهم في تطوير OussoCash)
// يُخزّن الاقتراح ويُرسله للإدارة عبر Telegram (دون أن يرى المستخدم أي تفاصيل تقنية)
const { sbInsert, readSession, json, readBody } = require('../lib/core');

const TG_TOKEN = (process.env.TELEGRAM_BOT_TOKEN || '').trim();
const TG_CHAT  = (process.env.TELEGRAM_CHAT_ID || '').trim();

// إرسال رسالة إلى Telegram وإرجاع نتيجة واضحة (للسجلّات)
async function sendTelegram(text) {
  if (!TG_TOKEN || !TG_CHAT) {
    return { sent: false, reason: 'not_configured' };
  }
  try {
    const r = await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: TG_CHAT,
        text,
        disable_web_page_preview: true,
      }),
      signal: AbortSignal.timeout(8000),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok || data.ok === false) {
      // Telegram يرجع description واضحة عند الفشل (مثلاً chat not found)
      console.error('telegram_send_failed', r.status, data.description || data);
      return { sent: false, reason: 'telegram_error', status: r.status, detail: data.description || '' };
    }
    return { sent: true };
  } catch (e) {
    console.error('telegram_fetch_error', String(e && e.message || e));
    return { sent: false, reason: 'fetch_error', detail: String(e && e.message || e) };
  }
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return json(res, 405, { error: 'method' });
  try {
    const body = await readBody(req);

    // ── وضع التشخيص: للتأكد أن تلجرام يعمل ──
    // POST { diag: true }  →  يرسل رسالة اختبار ويُرجع النتيجة الحقيقية
    if (body.diag === true) {
      const result = await sendTelegram('✅ اختبار OussoCash — إعداد تلجرام يعمل بنجاح.');
      return json(res, 200, {
        configured: !!(TG_TOKEN && TG_CHAT),
        has_token: !!TG_TOKEN,
        has_chat: !!TG_CHAT,
        result,
      });
    }

    const kind  = String(body.kind || 'idea').slice(0, 40);
    const title = String(body.title || '').slice(0, 120);
    const text  = String(body.body || '').trim().slice(0, 1500);
    if (text.length < 5) return json(res, 200, { error: 'too_short' });

    let gid = '';
    const sess = readSession(body.session);
    if (sess) gid = sess.gid;

    // 1) تخزين في قاعدة البيانات (لا يتأثر بفشل تلجرام)
    await sbInsert('feedback', { game_id: gid, kind, title, body: text }).catch((e) => {
      console.error('feedback_db_insert_failed', String(e && e.message || e));
    });

    // 2) إرسال للإدارة عبر Telegram
    const labelMap = {
      feature: 'ميزة جديدة', ui: 'تحسين الواجهة', sport: 'قسم التوقعات',
      ref: 'الإحالات', bug: 'مشكلة / خطأ', other: 'أخرى', idea: 'فكرة',
    };
    const kindLabel = labelMap[kind] || kind;
    const when = new Date().toLocaleString('ar', { timeZone: 'Africa/Nouakchott' });
    const msg =
      `💡 اقتراح جديد · OussoCash\n\n` +
      `النوع: ${kindLabel}\n` +
      (title ? `العنوان: ${title}\n` : '') +
      (gid ? `معرّف المستخدم: ${gid}\n` : 'مستخدم غير مسجّل دخول\n') +
      `الوقت: ${when}\n` +
      `————————————\n${text}`;

    const tg = await sendTelegram(msg);

    // المستخدم يرى دائماً نجاحاً (تم استلام اقتراحه وتخزينه)، لكن نُرجع حالة تلجرام بهدوء
    return json(res, 200, { ok: true, telegram: tg.sent });
  } catch (e) {
    console.error('feedback error', e);
    return json(res, 500, { error: 'server' });
  }
};
