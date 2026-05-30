// ═══════════════════════════════════════════════════════════════════
//  lib/core.js — مكتبة مشتركة (تعمل على الخادم فقط)
//  كل المفاتيح السرية تبقى هنا — لا تصل للمتصفح أبداً
// ═══════════════════════════════════════════════════════════════════

const crypto = require('crypto');

// ─── إعدادات (من متغيرات البيئة في Vercel فقط — لا أسرار في الكود) ───
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const REFERRAL_SECRET = process.env.REFERRAL_SECRET;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

// ─── 1xBet API (من متغيرات البيئة) ───
const XBET_API_URL = process.env.XBET_API_URL;
const XBET_HASH = process.env.XBET_HASH;
const XBET_CASHIERPASS = process.env.XBET_CASHIERPASS;
const XBET_CASHDESKID = process.env.XBET_CASHDESKID;

// ─── الجوائز ───
const WELCOME_BONUS = 100;
const REFERRAL_COMMISSION = 20;
const MIN_WITHDRAW = 300;
const MIN_DEPOSIT_USD = 4.0;
const USD_TO_UM = 50;

// ═══════════════════════════════════════════════════════════════════
//  Supabase REST helper (بدون مكتبات — fetch مباشر للأمان والخفة)
// ═══════════════════════════════════════════════════════════════════

async function sb(path, options = {}) {
  const url = `${SUPABASE_URL}/rest/v1/${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': options.prefer || 'return=representation',
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase ${res.status}: ${text}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

// جلب صف واحد
async function sbGet(table, query) {
  const rows = await sb(`${table}?${query}`);
  return rows && rows.length ? rows[0] : null;
}

// إدراج
async function sbInsert(table, data) {
  return sb(table, { method: 'POST', body: JSON.stringify(data) });
}

// تحديث
async function sbUpdate(table, query, data) {
  return sb(`${table}?${query}`, { method: 'PATCH', body: JSON.stringify(data) });
}

// ═══════════════════════════════════════════════════════════════════
//  كود الإحالة (5 أحرف، حروف وأرقام، فريد، HMAC)
// ═══════════════════════════════════════════════════════════════════

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // بدون أحرف ملتبسة (O,0,I,1)

function generateRefCode(phone) {
  // كود ثابت 5 أحرف مشتق من الرقم + السر
  const h = crypto.createHmac('sha256', REFERRAL_SECRET).update(phone).digest('hex');
  let num = parseInt(h.slice(0, 12), 16);
  let code = '';
  for (let i = 0; i < 5; i++) {
    code += ALPHABET[num % ALPHABET.length];
    num = Math.floor(num / ALPHABET.length);
  }
  return code;
}

function isValidRefCodeFormat(code) {
  return /^[A-Z0-9]{1,5}$/i.test(code);
}

// ═══════════════════════════════════════════════════════════════════
//  تنظيف رقم الهاتف
// ═══════════════════════════════════════════════════════════════════

function cleanPhone(phone) {
  if (!phone) return '';
  let p = String(phone).replace(/[^\d]/g, '');
  // موريتانيا: 8 أرقام محلية، نضيف 222
  if (p.length === 8) p = '222' + p;
  return p;
}

function isValidPhone(phone) {
  const p = cleanPhone(phone);
  return p.length === 11 && p.startsWith('222');
}

function maskPhone(phone) {
  const p = cleanPhone(phone);
  if (p.length < 8) return '+222 ****';
  const local = p.slice(3);
  return `+222 ${local.slice(0, 4)} ${local.slice(4, 6)}**`;
}

// ═══════════════════════════════════════════════════════════════════
//  1xBet — التحقق من اللاعب
// ═══════════════════════════════════════════════════════════════════

async function xbetSearchPlayer(gameId) {
  const uid = String(gameId).trim();
  if (!/^\d+$/.test(uid)) return { found: false, error: 'invalid_format' };

  const md5 = (t) => crypto.createHash('md5').update(t, 'utf8').digest('hex');
  const sha256 = (t) => crypto.createHash('sha256').update(t, 'utf8').digest('hex');

  // confirm = MD5(userId:hash)
  const confirm = md5(`${uid}:${XBET_HASH}`);

  // 3 صيغ مختلفة للتوقيع (نفس منطق البوت العامل)
  const variants = [
    () => {
      const a = sha256(`hash=${XBET_HASH}&userid=${uid}&cashdeskid=${XBET_CASHDESKID}`);
      const b = md5(`userid=${uid}&cashierpass=${XBET_CASHIERPASS}&hash=${XBET_HASH}`);
      return sha256(a + b);
    },
    () => {
      const a = sha256(`hash=${XBET_HASH}&userId=${uid}&cashdeskId=${XBET_CASHDESKID}`);
      const b = md5(`userId=${uid}&cashierpass=${XBET_CASHIERPASS}&hash=${XBET_HASH}`);
      return sha256(a + b);
    },
    () => {
      const a = sha256(`hash=${XBET_HASH}&userId=${uid}&cashdeskid=${XBET_CASHDESKID}`);
      const b = md5(`userId=${uid}&cashierpass=${XBET_CASHIERPASS}&hash=${XBET_HASH}`);
      return sha256(a + b);
    },
  ];

  const url = `${XBET_API_URL}/Users/${uid}?confirm=${confirm}&cashdeskId=${XBET_CASHDESKID}`;

  for (const makeSign of variants) {
    try {
      const sign = makeSign();
      const res = await fetch(url, {
        method: 'GET',
        headers: { 'sign': sign, 'Accept': 'application/json', 'User-Agent': 'OussoCash/1.0' },
        signal: AbortSignal.timeout(15000),
      });
      if (res.status !== 200) continue;
      let data;
      try { data = await res.json(); } catch { continue; }
      if (data && (data.UserId || data.Name || data.Id)) {
        let cur = String(data.CurrencyId || data.Currency || '');
        if (data.CurrencyId === 255 || data.CurrencyId === 929) cur = 'MRU';
        return {
          found: true,
          name: data.Name || data.UserName || '',
          currency: cur || 'MRU',
          userId: data.UserId || data.Id || uid,
        };
      }
    } catch (e) {
      // جرّب الصيغة التالية
    }
  }
  return { found: false };
}

// ═══════════════════════════════════════════════════════════════════
//  استجابة موحّدة
// ═══════════════════════════════════════════════════════════════════

function json(res, status, data) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
}

async function readBody(req) {
  if (req.body) return typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  return new Promise((resolve) => {
    let b = '';
    req.on('data', (c) => (b += c));
    req.on('end', () => {
      try { resolve(JSON.parse(b || '{}')); } catch { resolve({}); }
    });
  });
}

module.exports = {
  sb, sbGet, sbInsert, sbUpdate,
  generateRefCode, isValidRefCodeFormat,
  cleanPhone, isValidPhone, maskPhone,
  xbetSearchPlayer,
  json, readBody,
  WELCOME_BONUS, REFERRAL_COMMISSION, MIN_WITHDRAW, MIN_DEPOSIT_USD, USD_TO_UM,
  ADMIN_PASSWORD,
};
