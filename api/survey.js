// api/survey.js — مركز ملاحظات OussoCash
// يرسل الاستبيان إلى قناة تلجرام مع زر "تمت الموافقة" + الصور.
// مستقل تماماً (لا يعتمد على lib/core).

const TG_TOKEN   = (process.env.TELEGRAM_BOT_TOKEN || '').trim();
// قناة الاستبيانات (يمكن تجاوزها عبر متغيّر بيئة)
const TG_CHAT    = (process.env.FEEDBACK_CHAT_ID || '-1003838267933').trim();

function json(res, status, obj) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(obj));
}

async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string' && req.body.length) {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  const raw = await new Promise((resolve) => {
    let data = ''; req.on('data', (c) => { data += c; });
    req.on('end', () => resolve(data)); req.on('error', () => resolve(''));
  });
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { return {}; }
}

// إرسال رسالة نصية + زر "تمت الموافقة"
async function sendMessage(text) {
  const r = await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: TG_CHAT,
      text,
      disable_web_page_preview: true,
      reply_markup: { inline_keyboard: [[{ text: '✅ تمت الموافقة', callback_data: 'approve' }]] },
    }),
    signal: AbortSignal.timeout(9000),
  });
  const d = await r.json().catch(() => ({}));
  return { ok: r.ok && d.ok !== false, message_id: d.result && d.result.message_id };
}

// إرسال صورة (base64) مرتبطة بالرسالة الأصلية
async function sendPhoto(base64, replyTo) {
  try {
    const m = /^data:(image\/\w+);base64,(.+)$/.exec(base64);
    if (!m) return;
    const buf = Buffer.from(m[2], 'base64');
    const form = new FormData();
    form.append('chat_id', TG_CHAT);
    if (replyTo) form.append('reply_to_message_id', String(replyTo));
    form.append('photo', new Blob([buf], { type: m[1] }), 'evidence.jpg');
    await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendPhoto`, {
      method: 'POST', body: form, signal: AbortSignal.timeout(15000),
    });
  } catch (e) { console.error('sendPhoto', String(e && e.message || e)); }
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return json(res, 405, { error: 'method' });
  try {
    const body = await readBody(req);

    // تشخيص
    if (body.diag === true) {
      const t = await sendMessage('✅ اختبار مركز الملاحظات — الإعداد يعمل.');
      return json(res, 200, { configured: !!(TG_TOKEN && TG_CHAT), result: t });
    }

    const phone  = String(body.phone || '').replace(/[^\d+]/g, '').slice(0, 20);
    const rating = String(body.rating || '').slice(0, 20);
    const reason = String(body.reason || '').slice(0, 60);
    const text   = String(body.text || '').trim().slice(0, 1500);
    const images = Array.isArray(body.images) ? body.images.slice(0, 3) : [];

    if (phone.length < 8) return json(res, 200, { error: 'bad_phone' });

    const when = new Date().toLocaleString('ar', { timeZone: 'Africa/Nouakchott' });
    const ratingLabel = rating === 'excellent' ? '⭐ ممتازة'
      : rating === 'good' ? '👍 جيدة'
      : rating === 'complaint' ? '⚠️ شكوى' : rating;

    let msg = `📋 استبيان جديد · OussoCash\n\n`;
    msg += `📱 واتساب: ${phone}\n`;
    msg += `التقييم: ${ratingLabel}\n`;
    if (reason) msg += `سبب الشكوى: ${reason}\n`;
    msg += `🕐 ${when}\n`;
    if (text) msg += `————————————\n${text}`;

    const sent = await sendMessage(msg);

    // إرسال الصور (للشكاوى)
    if (sent.ok && images.length) {
      for (const img of images) await sendPhoto(img, sent.message_id);
    }

    return json(res, 200, { ok: true });
  } catch (e) {
    console.error('survey error', e);
    return json(res, 200, { ok: true }); // لا نُفشل تجربة المستخدم
  }
};
