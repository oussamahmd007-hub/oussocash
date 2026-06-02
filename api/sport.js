// api/sport.js — قسم الرياضة الاحترافي عبر BSD API (sports.bzzoiro.com)
// مجاني بالكامل لكرة القدم · المفتاح في Vercel: BSD_API_TOKEN
// يعرض: مباريات (مباشر/اليوم/غداً/أمس) · دوريات · ترتيب · توقعات · قسيمة اليوم
const { json, readBody } = require('../lib/core');

const TOKEN = process.env.BSD_API_TOKEN || process.env.FOOTBALL_API_KEY || '';
const BASE = 'https://sports.bzzoiro.com/api/v2';

// كاش بالذاكرة لتقليل الطلبات
const cache = {};
function getCache(k, ttl) { const e = cache[k]; return e && Date.now() - e.t < ttl ? e.v : null; }
function setCache(k, v) { cache[k] = { v, t: Date.now() }; return v; }

async function bsd(path) {
  const url = BASE + path;
  const r = await fetch(url, {
    headers: { Authorization: 'Token ' + TOKEN, Accept: 'application/json' },
    signal: AbortSignal.timeout(9000),
  });
  if (!r.ok) throw new Error('bsd_' + r.status);
  return r.json();
}

// استخراج مصفوفة من أي شكل استجابة (results / data / array مباشرة)
function arr(d) {
  if (Array.isArray(d)) return d;
  if (d && Array.isArray(d.results)) return d.results;
  if (d && Array.isArray(d.data)) return d.data;
  if (d && Array.isArray(d.matches)) return d.matches;
  if (d && Array.isArray(d.fixtures)) return d.fixtures;
  return [];
}
function pick(o, keys, def = '') {
  for (const k of keys) {
    const parts = k.split('.'); let v = o;
    for (const p of parts) { v = v && typeof v === 'object' ? v[p] : undefined; }
    if (v !== undefined && v !== null && v !== '') return v;
  }
  return def;
}

// تبسيط مباراة لأي شكل بيانات قادم من BSD
function simplifyMatch(m) {
  const home = pick(m, ['home_team.name', 'home.name', 'homeTeam.name', 'home_name', 'home', 'teams.home.name'], '');
  const away = pick(m, ['away_team.name', 'away.name', 'awayTeam.name', 'away_name', 'away', 'teams.away.name'], '');
  return {
    id: pick(m, ['id', 'match_id', 'fixture_id'], ''),
    league: pick(m, ['league.name', 'competition.name', 'league_name', 'tournament.name'], ''),
    league_logo: pick(m, ['league.logo', 'competition.logo', 'league.image', 'tournament.logo'], ''),
    date: pick(m, ['date', 'start_time', 'datetime', 'utcDate', 'kickoff', 'scheduled'], ''),
    status: String(pick(m, ['status', 'state', 'status.type', 'status.long'], 'SCHEDULED')).toUpperCase(),
    home,
    away,
    home_logo: pick(m, ['home_team.logo', 'home.logo', 'homeTeam.crest', 'home_logo', 'teams.home.logo'], ''),
    away_logo: pick(m, ['away_team.logo', 'away.logo', 'awayTeam.crest', 'away_logo', 'teams.away.logo'], ''),
    score_home: pick(m, ['home_score', 'score.home', 'goals.home', 'home_goals', 'scores.home'], null),
    score_away: pick(m, ['away_score', 'score.away', 'goals.away', 'away_goals', 'scores.away'], null),
    minute: pick(m, ['minute', 'time.elapsed', 'clock', 'live_minute'], null),
  };
}

function isLive(s) { return /LIVE|IN_PLAY|PLAYING|1ST|2ND|HALF|ET|PEN/.test(s); }
function isFinished(s) { return /FINISH|FT|ENDED|COMPLETE|AET|FULL/.test(s); }

// قسيمة اليوم: أفضل التوقعات موثوقية (الفريق + التوقع + نسبة الثقة)
function buildCoupon(predictions) {
  return (predictions || [])
    .filter((p) => p.confidence >= 60)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 5);
}

// تبسيط توقع
function simplifyPrediction(p) {
  const home = pick(p, ['home_team.name', 'home.name', 'match.home_team.name', 'home'], '');
  const away = pick(p, ['away_team.name', 'away.name', 'match.away_team.name', 'away'], '');
  // الفائز المتوقع + نسبة الثقة من الاحتمالات
  const pHome = parseFloat(pick(p, ['home_win', 'probabilities.home', 'prediction.home', 'percent.home'], 0)) || 0;
  const pDraw = parseFloat(pick(p, ['draw', 'probabilities.draw', 'prediction.draw', 'percent.draw'], 0)) || 0;
  const pAway = parseFloat(pick(p, ['away_win', 'probabilities.away', 'prediction.away', 'percent.away'], 0)) || 0;
  let tip = pick(p, ['advice', 'tip', 'prediction.advice', 'recommendation'], '');
  let confidence = Math.round(Math.max(pHome, pDraw, pAway));
  if (confidence > 0 && confidence <= 1) confidence = Math.round(confidence * 100); // لو كان 0-1
  if (!tip) {
    if (pHome >= pDraw && pHome >= pAway) tip = home;
    else if (pAway >= pHome && pAway >= pDraw) tip = away;
    else tip = 'تعادل';
  }
  return {
    home, away, tip, confidence,
    home_logo: pick(p, ['home_team.logo', 'home.logo'], ''),
    away_logo: pick(p, ['away_team.logo', 'away.logo'], ''),
    league: pick(p, ['league.name', 'competition.name'], ''),
    date: pick(p, ['date', 'match.date', 'start_time'], ''),
  };
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return json(res, 405, { error: 'method' });
  try {
    if (!TOKEN) return json(res, 200, { error: 'no_key', view: 'today', matches: [], predictions: [], coupon: [] });
    const body = await readBody(req);
    const view = body.view || 'today';

    // ── تشخيص: يعرض الاستجابة الخام من أي مسار (للتطوير فقط) ──
    if (view === 'debug') {
      const ep = body.endpoint || '/';
      try {
        const raw = await bsd(ep);
        const sample = Array.isArray(raw) ? raw.slice(0, 2) : (raw && raw.results ? { count: raw.count, results: raw.results.slice(0, 2) } : raw);
        return json(res, 200, { ok: true, endpoint: BASE + ep, sample });
      } catch (e) {
        return json(res, 200, { ok: false, endpoint: BASE + ep, error: String(e.message || e) });
      }
    }

    // ── الترتيب ──
    if (view === 'standings') {
      const ck = 'standings';
      let st = getCache(ck, 30 * 60e3);
      if (!st) {
        st = [];
        for (const ep of ['/standings/', '/leagues/standings/', '/tables/']) {
          try { const d = await bsd(ep); st = arr(d); if (st.length) break; } catch {}
        }
        setCache(ck, st);
      }
      return json(res, 200, { view, standings: st });
    }

    // ── التوقعات + قسيمة اليوم ──
    if (view === 'predictions') {
      const ck = 'predictions';
      let preds = getCache(ck, 30 * 60e3);
      if (!preds) {
        let raw = [];
        for (const ep of ['/odds/', '/predictions/', '/events/odds/']) {
          try { const d = await bsd(ep); raw = arr(d); if (raw.length) break; } catch {}
        }
        preds = raw.map(simplifyPrediction).filter((p) => p.home && p.away);
        setCache(ck, preds);
      }
      const coupon = buildCoupon(preds);
      return json(res, 200, { view, predictions: preds.slice(0, 12), coupon });
    }

    // ── المباريات (مباشر/اليوم/غداً/أمس) ──
    const ck = 'matches_' + view;
    let matches = getCache(ck, view === 'live' ? 45e3 : 4 * 60e3);
    if (!matches) {
      let raw = [];
      const eps = view === 'live'
        ? ['/events/live/', '/live/', '/matches/live/']
        : ['/matches/', '/events/', '/fixtures/'];
      for (const ep of eps) {
        try { const d = await bsd(ep); raw = arr(d); if (raw.length) break; } catch {}
      }
      let all = raw.map(simplifyMatch);

      // تصفية حسب التبويب بالتاريخ
      const today = new Date(); const ymd = (d) => d.toISOString().slice(0, 10);
      const todayStr = ymd(today);
      const tomStr = ymd(new Date(+today + 864e5));
      const yesStr = ymd(new Date(+today - 864e5));
      if (view === 'live') all = all.filter((m) => isLive(m.status));
      else if (view === 'today') all = all.filter((m) => String(m.date).slice(0, 10) === todayStr);
      else if (view === 'tomorrow') all = all.filter((m) => String(m.date).slice(0, 10) === tomStr);
      else if (view === 'yesterday') all = all.filter((m) => String(m.date).slice(0, 10) === yesStr);

      matches = setCache(ck, all);
    }

    return json(res, 200, { view, matches, count: matches.length });
  } catch (e) {
    console.error('sport error', e);
    return json(res, 200, { error: 'unavailable', view: 'today', matches: [], predictions: [], coupon: [] });
  }
};
