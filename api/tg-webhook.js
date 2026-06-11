// api/tg-webhook.js — يستقبل ضغط زر "تمت الموافقة" من تلجرام
// عند الضغط: يعدّل الرسالة ليظهر أنها تمت الموافقة عليها + من وافق + الوقت.
// مستقل تماماً.

const TG_TOKEN = (process.env.TELEGRAM_BOT_TOKEN || '').trim();

function ok(res) { res.statusCode = 200; res.setHeader('Content-Type', 'application/json'); res.end('{"ok":true}'); }

async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  const raw = await new Promise((resolve) => {
    let d = ''; req.on('data', (c) => { d += c; });
    req.on('end', () => resolve(d)); req.on('error', () => resolve(''));
  });
  try { return JSON.parse(raw || '{}'); } catch { return {}; }
}

async function tg(method, payload) {
  try {
    await fetch(`https://api.telegram.org/bot${TG_TOKEN}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8000),
    });
  } catch (e) { console.error('tg', method, String(e && e.message || e)); }
}

module.exports = async (req, res) => {
  // إعداد الويبهوك: GET ?setup=1  → يسجّل العنوان تلقائياً
  if (req.method === 'GET') {
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const url = `https://${host}/api/tg-webhook`;
    try {
      const r = await fetch(`https://api.telegram.org/bot${TG_TOKEN}/setWebhook`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, allowed_updates: ['callback_query'] }),
      });
      const d = await r.json().catch(() => ({}));
      res.statusCode = 200; res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.end(JSON.stringify({ webhook_url: url, telegram: d }));
    } catch (e) {
      res.statusCode = 500; return res.end(JSON.stringify({ error: String(e && e.message || e) }));
    }
  }

  if (req.method !== 'POST') return ok(res);
  try {
    const update = await readBody(req);
    const cq = update.callback_query;
    if (cq && cq.data === 'approve') {
      const msg = cq.message || {};
      const chatId = msg.chat && msg.chat.id;
      const msgId = msg.message_id;
      const who = cq.from ? (cq.from.first_name || cq.from.username || 'الإدارة') : 'الإدارة';
      const when = new Date().toLocaleString('ar', { timeZone: 'Africa/Nouakchott' });

      // ردّ سريع للزر
      await tg('answerCallbackQuery', { callback_query_id: cq.id, text: '✅ تمت الموافقة' });

      // تعديل الرسالة: إضافة سطر الموافقة + تثبيت زر "تمت الموافقة"
      const baseText = msg.text || msg.caption || '';
      const newText = `${baseText}\n\n✅ تمت الموافقة بواسطة ${who}\n🕐 ${when}`;
      const method = msg.text ? 'editMessageText' : 'editMessageCaption';
      const payload = { chat_id: chatId, message_id: msgId };
      if (msg.text) payload.text = newText; else payload.caption = newText;
      payload.reply_markup = { inline_keyboard: [[{ text: '✅ تمت الموافقة', callback_data: 'done' }]] };
      await tg(method, payload);
    } else if (cq) {
      await tg('answerCallbackQuery', { callback_query_id: cq.id });
    }
    return ok(res);
  } catch (e) {
    console.error('webhook error', e);
    return ok(res);
  }
};
