// ═══════════════════════════════════════════════════════════════════
//  lib/core.js — Bibliothèque partagée (serveur uniquement)
//  مكتبة مشتركة (تعمل على الخادم فقط) — كل المفاتيح السرية تبقى هنا
// ═══════════════════════════════════════════════════════════════════

const crypto = require('crypto');

// ─── Variables d'environnement (Vercel) — aucun secret dans le code ───
const SUPABASE_URL         = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const REFERRAL_SECRET      = process.env.REFERRAL_SECRET;
const SESSION_SECRET       = process.env.SESSION_SECRET || REFERRAL_SECRET;
const ADMIN_PASSWORD       = process.env.ADMIN_PASSWORD;

// ─── 1xBet API ───
const XBET_API_URL      = process.env.XBET_API_URL;
const XBET_HASH         = process.env.XBET_HASH;
const XBET_CASHIERPASS  = process.env.XBET_CASHIERPASS;
const XBET_CASHDESKID   = process.env.XBET_CASHDESKID;

// ─── OneSignal (notifications push) ───
const ONESIGNAL_APP_ID  = process.env.ONESIGNAL_APP_ID;
const ONESIGNAL_API_KEY = process.env.ONESIGNAL_API_KEY;

// ─── Règles métier ───
const WELCOME_BONUS       = 100;   // UM — bonus de bienvenue (parrainage)
const REFERRAL_COMMISSION = 20;    // UM — par parrainage activé
const REFERRAL_PERCENT    = 25;    // % des gains du filleul
const MIN_WITHDRAW        = 300;   // UM
const MIN_DEPOSIT_USD     = 4.0;   // ≈ 200 UM
const USD_TO_UM           = 50;
const DEPOSIT_DEADLINE_DAYS = 3;   // jours pour compléter le dépôt
const PENDING_TTL_HOURS   = 24;    // conservation des comptes en attente

// ═══════════════════════════════════════════════════════════════════
//  Supabase REST (fetch direct — léger et sûr)
// ═══════════════════════════════════════════════════════════════════
async function sb(path, options = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: options.prefer || 'return=representation',
      ...(options.headers || {}),
    },
  });
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`);
  if (res.status === 204) return null;
  return res.json();
}
async function sbGet(table, query)        { const r = await sb(`${table}?${query}`); return r && r.length ? r[0] : null; }
async function sbInsert(table, data)      { return sb(table, { method: 'POST', body: JSON.stringify(data) }); }
async function sbUpdate(table, q, data)   { return sb(`${table}?${q}`, { method: 'PATCH', body: JSON.stringify(data) }); }
async function sbDelete(table, q)         { return sb(`${table}?${q}`, { method: 'DELETE', prefer: 'return=minimal' }); }

// ═══════════════════════════════════════════════════════════════════
//  Hachage / Identité
// ═══════════════════════════════════════════════════════════════════
const md5    = (t) => crypto.createHash('md5').update(t, 'utf8').digest('hex');
const sha256 = (t) => crypto.createHash('sha256').update(t, 'utf8').digest('hex');

// Empreinte d'appareil hachée (jamais stockée en clair)
function hashFingerprint(fp) {
  return sha256(`${String(fp || '')}::${SESSION_SECRET}`).slice(0, 32);
}

// PIN haché
function hashPin(gid, pin) {
  return sha256(`${gid}:${String(pin)}:${SESSION_SECRET}`);
}

// Code de parrainage : 6 caractères, déterministe, sans ambiguïté
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // pas de O,0,I,1
function generateRefCode(gameId) {
  const h = crypto.createHmac('sha256', REFERRAL_SECRET).update(String(gameId)).digest('hex');
  let num = parseInt(h.slice(0, 14), 16);
  let code = '';
  for (let i = 0; i < 6; i++) { code += ALPHABET[num % ALPHABET.length]; num = Math.floor(num / ALPHABET.length); }
  return code;
}
function isValidRefCode(code) { return /^[A-Z0-9]{4,8}$/i.test(code); }

// Jeton de session signé (game_id + fingerprint) — léger, sans DB
function makeSession(gid, fpHash) {
  const payload = `${gid}.${fpHash}.${Date.now()}`;
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('hex').slice(0, 24);
  return Buffer.from(`${payload}.${sig}`).toString('base64url');
}
function readSession(token) {
  try {
    const raw = Buffer.from(String(token), 'base64url').toString('utf8');
    const parts = raw.split('.');
    if (parts.length !== 4) return null;
    const [gid, fpHash, ts, sig] = parts;
    const expect = crypto.createHmac('sha256', SESSION_SECRET).update(`${gid}.${fpHash}.${ts}`).digest('hex').slice(0, 24);
    if (sig !== expect) return null;
    return { gid, fpHash, ts: Number(ts) };
  } catch { return null; }
}

// ═══════════════════════════════════════════════════════════════════
//  Validation 1xBet ID
// ═══════════════════════════════════════════════════════════════════
function cleanGameId(v) { return String(v || '').replace(/[\s\-_]/g, ''); }
function isValidGameId(v) { return /^\d{6,13}$/.test(cleanGameId(v)); }

// ═══════════════════════════════════════════════════════════════════
//  1xBet — Vérification du joueur (récupération réelle des données)
// ═══════════════════════════════════════════════════════════════════
async function xbetSearchPlayer(gameId) {
  const uid = cleanGameId(gameId);
  if (!/^\d+$/.test(uid)) return { found: false, error: 'invalid_format' };

  const confirm = md5(`${uid}:${XBET_HASH}`);
  const variants = [
    () => sha256(sha256(`hash=${XBET_HASH}&userid=${uid}&cashdeskid=${XBET_CASHDESKID}`) + md5(`userid=${uid}&cashierpass=${XBET_CASHIERPASS}&hash=${XBET_HASH}`)),
    () => sha256(sha256(`hash=${XBET_HASH}&userId=${uid}&cashdeskId=${XBET_CASHDESKID}`) + md5(`userId=${uid}&cashierpass=${XBET_CASHIERPASS}&hash=${XBET_HASH}`)),
    () => sha256(sha256(`hash=${XBET_HASH}&userId=${uid}&cashdeskid=${XBET_CASHDESKID}`) + md5(`userId=${uid}&cashierpass=${XBET_CASHIERPASS}&hash=${XBET_HASH}`)),
  ];
  const url = `${XBET_API_URL}/Users/${uid}?confirm=${confirm}&cashdeskId=${XBET_CASHDESKID}`;

  for (const makeSign of variants) {
    try {
      const res = await fetch(url, {
        method: 'GET',
        headers: { sign: makeSign(), Accept: 'application/json', 'User-Agent': 'OussoCash/2.0' },
        signal: AbortSignal.timeout(15000),
      });
      if (res.status !== 200) continue;
      let data; try { data = await res.json(); } catch { continue; }
      if (data && (data.UserId || data.Name || data.Id)) {
        let cur = String(data.CurrencyId || data.Currency || '');
        if (data.CurrencyId === 255 || data.CurrencyId === 929) cur = 'MRU';
        return { found: true, name: data.Name || data.UserName || '', currency: cur || 'MRU', userId: data.UserId || data.Id || uid };
      }
    } catch { /* essayer la variante suivante */ }
  }
  return { found: false };
}

// ═══════════════════════════════════════════════════════════════════
//  OneSignal — envoi de notification push (court et professionnel)
// ═══════════════════════════════════════════════════════════════════
async function pushNotify(gameId, title, body) {
  // Notification interne (toujours) — livrée à l'ouverture
  await sbInsert('notifications', { game_id: gameId, title, body }).catch(() => {});
  // Push OneSignal (si configuré) — ciblé par external_id = game_id
  if (!ONESIGNAL_APP_ID || !ONESIGNAL_API_KEY) return;
  try {
    await fetch('https://api.onesignal.com/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Key ${ONESIGNAL_API_KEY}` },
      body: JSON.stringify({
        app_id: ONESIGNAL_APP_ID,
        include_aliases: { external_id: [String(gameId)] },
        target_channel: 'push',
        headings: { en: title, ar: title, fr: title },
        contents: { en: body, ar: body, fr: body },
      }),
      signal: AbortSignal.timeout(8000),
    });
  } catch { /* le push échoue silencieusement — la notif interne reste */ }
}

// ═══════════════════════════════════════════════════════════════════
//  OneSignal — رسالة جماعية لكل المستخدمين (broadcast)
// ═══════════════════════════════════════════════════════════════════
async function pushBroadcast(title, body) {
  // إشعار داخلي جماعي (يُسلَّم لكل من يفتح الموقع)
  await sbInsert('notifications', { game_id: '*', title, body }).catch(() => {});
  if (!ONESIGNAL_APP_ID || !ONESIGNAL_API_KEY) return;
  try {
    await fetch('https://api.onesignal.com/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Key ${ONESIGNAL_API_KEY}` },
      body: JSON.stringify({
        app_id: ONESIGNAL_APP_ID,
        included_segments: ['Total Subscriptions', 'Subscribed Users'],
        headings: { en: title, ar: title, fr: title },
        contents: { en: body, ar: body, fr: body },
      }),
      signal: AbortSignal.timeout(8000),
    });
  } catch { /* الإشعار الداخلي يبقى */ }
}


function json(res, status, data) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(data));
}
async function readBody(req) {
  if (req.body) return typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  return new Promise((resolve) => {
    let b = '';
    req.on('data', (c) => (b += c));
    req.on('end', () => { try { resolve(JSON.parse(b || '{}')); } catch { resolve({}); } });
  });
}

// Vue publique d'un compte (jamais d'infos sensibles)
function publicAccount(a) {
  return {
    game_id: a.game_id, name: a.name, currency: a.currency, lang: a.lang,
    country: a.country, status: a.status, balance_um: a.balance_um,
    ref_code: a.ref_code, deposit_done: a.deposit_done, deposit_needed: a.deposit_needed,
    deadline_at: a.deadline_at, has_pin: !!a.pin_hash,
    created_at: a.created_at, activated_at: a.activated_at,
  };
}

module.exports = {
  sb, sbGet, sbInsert, sbUpdate, sbDelete,
  md5, sha256, hashFingerprint, hashPin,
  generateRefCode, isValidRefCode,
  makeSession, readSession,
  cleanGameId, isValidGameId,
  xbetSearchPlayer, pushNotify, pushBroadcast,
  json, readBody, publicAccount,
  WELCOME_BONUS, REFERRAL_COMMISSION, REFERRAL_PERCENT,
  MIN_WITHDRAW, MIN_DEPOSIT_USD, USD_TO_UM,
  DEPOSIT_DEADLINE_DAYS, PENDING_TTL_HOURS,
  ADMIN_PASSWORD, ONESIGNAL_APP_ID,
};
