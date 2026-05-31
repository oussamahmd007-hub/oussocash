// api/feedback.js — اقتراحات المستخدمين (ساهم في تطوير OussoCash)
// يُخزّن الاقتراح ويُرسله للإدارة عبر Telegram (دون أن يرى المستخدم أي تفاصيل تقنية)
const { sbInsert, readSession, json, readBody } = require('../lib/core');

const TG_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const TG_CHAT  = process.env.TELEGRAM_CHAT_ID || '';

module.exports = async (req, res) => {
  if (req.method !== 'POST') return json(res, 405, { error: 'method' });
  try {
    const body = await readBody(req);
    const kind  = String(body.kind || 'idea').slice(0, 40);
    const title = String(body.title || '').slice(0, 120);
    const text  = String(body.body || '').trim().slice(0, 1500);
    if (text.length < 5) return json(res, 200, { error: 'too_short' });

    let gid = '';
    const sess = readSession(body.session);
    if (sess) gid = sess.gid;

    // تخزين في قاعدة البيانات
    await sbInsert('feedback', { game_id: gid, kind, title, body: text }).catch(() => {});

    // إرسال للإدارة عبر Telegram (إن كان مُعدّاً)
    if (TG_TOKEN && TG_CHAT) {
      const msg = `💡 اقتراح جديد · OussoCash\n\nالنوع: ${kind}\n${title ? 'العنوان: ' + title + '\n' : ''}${gid ? 'المعرّف: ' + gid + '\n' : ''}\n${text}`;
      try {
        await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: TG_CHAT, text: msg }),
          signal: AbortSignal.timeout(8000),
        });
      } catch { /* التخزين تم، تجاهل فشل الإرسال */ }
    }

    return json(res, 200, { ok: true });
  } catch (e) {
    console.error('feedback error', e);
    return json(res, 500, { error: 'server' });
  }
};
