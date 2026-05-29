// ═══════════════════════════════════════════════════════════════════
//  api/webhook.js — Vercel Serverless Webhook Proxy
//
//  هذا الملف يستقبل webhooks من WhatAuto ويُحوّلها لبوتك على JustRunMy
//  
//  المميزات:
//  - تلقائي 100% بمجرد ضبط BOT_URL في Vercel
//  - يدعم timeout (25 ثانية)
//  - يدعم CORS
//  - error handling احترافي
// ═══════════════════════════════════════════════════════════════════

export default async function handler(req, res) {
  // ─── CORS ─────────────────────────────────────────────────────
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // ─── GET: Status check ─────────────────────────────────────────
  if (req.method === 'GET') {
    return res.status(200).json({
      service: 'OussoCash Webhook',
      status: 'live',
      version: '1.0',
      bot_configured: !!process.env.BOT_URL,
      message: 'Send POST from WhatAuto to this URL'
    });
  }

  // ─── POST: Webhook from WhatAuto ────────────────────────────────
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const data = req.body || {};
    const BOT_URL = process.env.BOT_URL;

    if (!BOT_URL) {
      console.error('BOT_URL not configured');
      return res.status(200).json({
        reply: 'النظام قيد الإعداد. حاول بعد قليل.'
      });
    }

    // Build the bot webhook URL
    const cleanBotUrl = BOT_URL.replace(/\/$/, '');
    const botEndpoint = `${cleanBotUrl}/whatauto-webhook`;

    console.log(`Forwarding to ${botEndpoint}`);

    // Timeout via AbortController
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000);

    const botResponse = await fetch(botEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!botResponse.ok) {
      console.error(`Bot returned ${botResponse.status}`);
      return res.status(200).json({
        reply: 'الخادم مشغول. جرّب مرة أخرى.'
      });
    }

    const botResult = await botResponse.json();
    
    return res.status(200).json({
      reply: botResult.reply || ''
    });

  } catch (err) {
    console.error('Webhook error:', err.message);
    
    return res.status(200).json({
      reply: 'حدث خطأ مؤقت. حاول بعد لحظات.'
    });
  }
}
