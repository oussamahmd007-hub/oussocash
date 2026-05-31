// api/support.js — الدعم الذكي (مطابقة نوايا محلية + شخصنة من بيانات المستخدم)
// المنطق: تطبيع النص → TF-IDF → تشابه جيب التمام → أعلى نية فوق العتبة
const {
  sb, sbGet, readSession, json, readBody,
  REFERRAL_COMMISSION, REFERRAL_PERCENT, WELCOME_BONUS, MIN_WITHDRAW, MIN_DEPOSIT_USD, USD_TO_UM,
} = require('../lib/core');
const KB = require('../lib/support-kb');

const REG_LINK = 'https://reffpa.com/L?tag=d_3649166m_1599c_OUSSO&site=3649166&ad=1599&r=en/registration';
const CONF_THRESHOLD = 0.12;

// ── تطبيع النص (عربي/فرنسي) ──
function normalize(t, lang) {
  if (!t) return '';
  t = t.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, ' ');
  t = t.replace(/[.,;:!؟،؛?"'()\[\]{}\-_+=*&^%$#@~`|\\/<>]/g, ' ');
  if (lang === 'fr') {
    t = t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  } else {
    t = t.replace(/[\u064B-\u065F\u0670\u0610-\u061A]/g, '');
    t = t.replace(/[إأآا]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/ؤ/g, 'و');
  }
  return t.replace(/\s+/g, ' ').trim();
}
function detectLang(t) {
  return /[\u0600-\u06FF]/.test(t) ? 'ar' : 'fr';
}
function tokenize(t, lang) { return normalize(t, lang).split(' ').filter((w) => w.length > 1); }

// ── بناء فهرس TF-IDF من الـ KB ──
let INDEX = null;
function buildIndex() {
  if (INDEX) return INDEX;
  const docs = [];
  for (const [iid, data] of Object.entries(KB)) {
    for (const lang of ['ar', 'fr']) {
      (data[lang] || []).forEach((phrase) => {
        docs.push({ iid, lang, toks: tokenize(phrase, lang) });
      });
    }
  }
  // IDF
  const df = {};
  docs.forEach((d) => { new Set(d.toks).forEach((w) => { df[w] = (df[w] || 0) + 1; }); });
  const N = docs.length;
  const idf = {};
  for (const w in df) idf[w] = Math.log((N + 1) / (df[w] + 1)) + 1;
  INDEX = { docs, idf };
  return INDEX;
}
function vec(toks, idf) {
  const tf = {}; toks.forEach((w) => { tf[w] = (tf[w] || 0) + 1; });
  const v = {}; let norm = 0;
  for (const w in tf) { const x = (tf[w] / toks.length) * (idf[w] || 1); v[w] = x; norm += x * x; }
  norm = Math.sqrt(norm) || 1;
  for (const w in v) v[w] /= norm;
  return v;
}
function cosine(a, b) { let s = 0; for (const w in a) if (b[w]) s += a[w] * b[w]; return s; }

function classify(query, lang) {
  const { docs, idf } = buildIndex();
  const qv = vec(tokenize(query, lang), idf);
  const scores = {};
  docs.forEach((d) => {
    const sc = cosine(qv, vec(d.toks, idf));
    if (sc > (scores[d.iid] || 0)) scores[d.iid] = sc;
  });
  let best = null, bestScore = 0;
  for (const iid in scores) if (scores[iid] > bestScore) { bestScore = scores[iid]; best = iid; }
  return { intent: best, score: bestScore };
}

// ── اختيار وتعبئة الرد ──
function fill(tpl, ctx) {
  return tpl.replace(/\{(\w+)\}/g, (_, k) => (ctx[k] !== undefined ? ctx[k] : ''));
}
function pickResponse(intent, ctx, lang) {
  const block = KB[intent] && KB[intent].r;
  if (!block) return null;
  let arr = null;
  // معرفة حالة التفعيل للأرصدة/الإحالات
  const verified = ctx._verified;
  const cand = verified
    ? [`${lang}_verified`, `${lang}`, 'ar_verified', 'ar']
    : [`${lang}_not_verified`, `${lang}`, 'ar_not_verified', 'ar'];
  for (const key of cand) if (block[key] && block[key].length) { arr = block[key]; break; }
  if (!arr) { const ks = Object.keys(block); arr = ks.length ? block[ks[0]] : null; }
  if (!arr) return null;
  return fill(arr[Math.floor(Math.random() * arr.length)], ctx);
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return json(res, 405, { error: 'method' });
  try {
    const body = await readBody(req);
    const text = String(body.text || '').slice(0, 500);
    const lang = body.lang === 'fr' ? 'fr' : (detectLang(text) || 'ar');
    if (!text.trim()) return json(res, 200, { reply: lang === 'fr' ? 'Posez votre question.' : 'تفضل اسأل سؤالك.' });

    // بناء سياق المستخدم (شخصنة) إن وُجدت جلسة
    const ctx = {
      name: lang === 'fr' ? 'cher client' : 'عزيزي',
      balance: 0, earned: 0, l1: 0, l2: 0, _verified: false,
      ref_link: REG_LINK, ref_link_agency: REG_LINK, video: REG_LINK,
      channel: 'https://whatsapp.com/channel/0029Vb7TGP52phHUrKJ13u1p',
      welcome: WELCOME_BONUS, r1: REFERRAL_COMMISSION, r2: REFERRAL_PERCENT + '%',
      min_w: MIN_WITHDRAW, min_d: Math.round(MIN_DEPOSIT_USD * USD_TO_UM),
      game_id: '', pending_gid: '',
    };
    const sess = readSession(body.session);
    if (sess) {
      const a = await sbGet('accounts', `game_id=eq.${sess.gid}&select=*`);
      if (a) {
        ctx.name = (a.name || '').trim().split(/\s+/)[0] || ctx.name;
        ctx.balance = a.balance_um || 0;
        ctx.game_id = a.game_id;
        ctx._verified = a.status === 'active';
        if (a.ref_code) ctx.ref_link = `https://oussocash.vercel.app/r/${a.ref_code}`;
        const refs = await sb(`referrals?referrer_gid=eq.${sess.gid}&select=activated_at,commission_um`);
        ctx.l1 = refs.filter((r) => r.activated_at).length;
        ctx.earned = refs.reduce((s, r) => s + (r.commission_um || 0), 0);
      }
    }

    const { intent, score } = classify(text, lang);

    if (intent && score >= CONF_THRESHOLD) {
      const reply = pickResponse(intent, ctx, lang);
      if (reply) return json(res, 200, { reply, intent, score: +score.toFixed(3) });
    }

    // لم يُفهم السؤال → رد احترافي + اقتراح الدعم المباشر
    const fallback = lang === 'fr'
      ? 'Reformulez votre question plus clairement pour que je puisse vous aider précisément. Pour une aide directe, contactez notre support.'
      : 'رجاءً أعد صياغة سؤالك بشكل أوضح حتى أتمكن من مساعدتك بدقة. وللمساعدة المباشرة، يمكنك التواصل مع الدعم.';
    return json(res, 200, { reply: fallback, intent: null, score: +score.toFixed(3), suggest_human: true });
  } catch (e) {
    console.error('support error', e);
    return json(res, 500, { error: 'server' });
  }
};
