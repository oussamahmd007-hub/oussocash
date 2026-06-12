// api/feedback.js — نقطة موحّدة: اقتراحات + استبيان مركز الملاحظات + ويبهوك تلجرام
// تجمع 3 وظائف في دالة واحدة لتفادي تجاوز حد دوال Vercel.
// مستقلة تماماً (لا تعتمد على lib/core).

const TG_TOKEN     = (process.env.TELEGRAM_BOT_TOKEN || '').trim();
const TG_CHAT      = (process.env.TELEGRAM_CHAT_ID   || '').trim();
const FEEDBACK_CHAT= (process.env.FEEDBACK_CHAT_ID   || '-1003838267933').trim();

function json(res, status, obj) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(obj));
}
function okPlain(res) { res.statusCode = 200; res.setHeader('Content-Type', 'application/json'); res.end('{"ok":true}'); }

async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string' && req.body.length) { try { return JSON.parse(req.body); } catch { return {}; } }
  const raw = await new Promise((resolve) => {
    let d = ''; req.on('data', (c) => { d += c; });
    req.on('end', () => resolve(d)); req.on('error', () => resolve(''));
  });
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { return {}; }
}

async function tgCall(method, payload) {
  try {
    const r = await fetch(`https://api.telegram.org/bot${TG_TOKEN}/${method}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload), signal: AbortSignal.timeout(9000),
    });
    const d = await r.json().catch(() => ({}));
    return { ok: r.ok && d.ok !== false, message_id: d.result && d.result.message_id, detail: d.description };
  } catch (e) { return { ok: false, detail: String(e && e.message || e) }; }
}

async function sendMessage(chat, text, withApprove) {
  const payload = { chat_id: chat, text, disable_web_page_preview: true };
  if (withApprove) payload.reply_markup = { inline_keyboard: [[{ text: '✅ تمت الموافقة', callback_data: 'approve' }]] };
  return tgCall('sendMessage', payload);
}

async function sendPhoto(chat, base64, replyTo) {
  try {
    const m = /^data:(image\/\w+);base64,(.+)$/.exec(base64);
    if (!m) return;
    const buf = Buffer.from(m[2], 'base64');
    const form = new FormData();
    form.append('chat_id', String(chat));
    if (replyTo) form.append('reply_to_message_id', String(replyTo));
    form.append('photo', new Blob([buf], { type: m[1] }), 'evidence.jpg');
    await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendPhoto`, {
      method: 'POST', body: form, signal: AbortSignal.timeout(15000),
    });
  } catch (e) { console.error('sendPhoto', String(e && e.message || e)); }
}

module.exports = async (req, res) => {
  if (req.method === 'GET') {
    const isSetup = (req.url || '').includes('setup=1') || (req.query && req.query.setup);
    if (!isSetup) {
      return json(res, 200, { ok: true, service: 'feedback', hint: 'POST to submit · GET ?setup=1 to register webhook' });
    }
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const url = `https://${host}/api/feedback`;
    const d = await tgCall('setWebhook', { url, allowed_updates: ['callback_query'] });
    return json(res, 200, { webhook_url: url, telegram_ok: d.ok, detail: d.detail || '' });
  }

  if (req.method !== 'POST') return json(res, 200, { ok: true });

  try {
    const body = await readBody(req);

    if (body.callback_query) {
      const cq = body.callback_query;
      if (cq.data === 'approve') {
        const msg = cq.message || {};
        const who = cq.from ? (cq.from.first_name || cq.from.username || 'الإدارة') : 'الإدارة';
        const when = new Date().toLocaleString('ar', { timeZone: 'Africa/Nouakchott' });
        await tgCall('answerCallbackQuery', { callback_query_id: cq.id, text: '✅ تمت الموافقة' });
        const base = msg.text || msg.caption || '';
        const newText = `${base}\n\n✅ تمت الموافقة بواسطة ${who}\n🕐 ${when}`;
        const useText = !!msg.text;
        await tgCall(useText ? 'editMessageText' : 'editMessageCaption', {
          chat_id: msg.chat && msg.chat.id, message_id: msg.message_id,
          ...(useText ? { text: newText } : { caption: newText }),
          reply_markup: { inline_keyboard: [[{ text: '✅ تمت الموافقة', callback_data: 'done' }]] },
        });
      } else {
        await tgCall('answerCallbackQuery', { callback_query_id: cq.id });
      }
      return okPlain(res);
    }

    if (body.diag === true) {
      const t = await sendMessage(FEEDBACK_CHAT, '✅ اختبار مركز الملاحظات — الإعداد يعمل.', true);
      return json(res, 200, { configured: !!(TG_TOKEN && FEEDBACK_CHAT), result: t });
    }

    if (body.rating && body.phone) {
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

      const sent = await sendMessage(FEEDBACK_CHAT, msg, true);
      if (sent.ok && images.length) {
        for (const img of images) await sendPhoto(FEEDBACK_CHAT, img, sent.message_id);
      }
      return json(res, 200, { ok: true });
    }

    const kind  = String(body.kind || 'idea').slice(0, 40);
    const title = String(body.title || '').slice(0, 120);
    const text  = String(body.body || '').trim().slice(0, 1500);
    if (text.length < 5) return json(res, 200, { error: 'too_short' });
    const gid = String(body.gid || '').slice(0, 60);
    const labelMap = { feature:'ميزة جديدة', ui:'تحسين الواجهة', sport:'قسم التوقعات', ref:'الإحالات', bug:'مشكلة / خطأ', other:'أخرى', idea:'فكرة' };
    const when = new Date().toLocaleString('ar', { timeZone: 'Africa/Nouakchott' });
    const msg =
      `💡 اقتراح جديد · OussoCash\n\n` +
      `النوع: ${labelMap[kind] || kind}\n` +
      (title ? `العنوان: ${title}\n` : '') +
      (gid ? `معرّف المستخدم: ${gid}\n` : 'مستخدم غير مسجّل دخول\n') +
      `الوقت: ${when}\n————————————\n${text}`;
    const tg = await sendMessage(TG_CHAT || FEEDBACK_CHAT, msg, false);
    return json(res, 200, { ok: true, telegram: tg.ok });
  } catch (e) {
    console.error('feedback error', e);
    return json(res, 200, { ok: true });
  }
};
