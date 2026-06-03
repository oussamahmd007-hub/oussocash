// api/feedback.js — اقتراحات المستخدمين (ساهم في تطوير OussoCash)
// يُرسل الاقتراح فقط إلى قناة تلجرام. لا يُخزَّن أي شيء في أي مكان آخر.
// ملف مستقل تماماً (لا يعتمد على lib/core) لتفادي أي مشكلة في القراءة أو الإعداد.

const TG_TOKEN = (process.env.TELEGRAM_BOT_TOKEN || '').trim();
const TG_CHAT  = (process.env.TELEGRAM_CHAT_ID  || '').trim();

// ── ردّ JSON موحّد ──
function json(res, status, obj) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(obj));
}

// ── قراءة جسم الطلب بشكل آمن (سواء حلّله Vercel مسبقاً أو لا) ──
async function readBody(req) {
  // إن كان Vercel قد حلّل الجسم مسبقاً
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string' && req.body.length) {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  // قراءة يدوية من التدفّق
  const raw = await new Promise((resolve) => {
    let data = '';
    req.on('data', (c) => { data += c; });
    req.on('end', () => resolve(data));
    req.on('error', () => resolve(''));
  });
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { return {}; }
}

// ── إرسال رسالة إلى تلجرام وإرجاع نتيجة واضحة ──
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
      console.error('telegram_send_failed', r.status, data.description || data);
      return { sent: false, reason: 'telegram_error', status: r.status, detail: data.description || '' };
    }
    return { sent: true };
  } catch (e) {
    console.error('telegram_fetch_error', String((e && e.message) || e));
    return { sent: false, reason: 'fetch_error', detail: String((e && e.message) || e) };
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

    // معرّف اختياري إن أُرسل مباشرةً من الواجهة (بدون أي قاعدة بيانات)
    const gid = String(body.gid || '').slice(0, 60);

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

    // الإرسال إلى قناة تلجرام فقط — لا تخزين في أي مكان آخر
    const tg = await sendTelegram(msg);

    // المستخدم يرى نجاحاً (استُلم اقتراحه)، ونُرجع حالة تلجرام بهدوء
    return json(res, 200, { ok: true, telegram: tg.sent });
  } catch (e) {
    console.error('feedback error', e);
    return json(res, 500, { error: 'server' });
  }
};
