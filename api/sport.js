// api/sport.js — قسم الرياضة العالمي عبر BSD API v2 (sports.bzzoiro.com/api/v2)
// مجاني لكرة القدم · التوكن في Vercel: BSD_API_TOKEN
// المصادقة: ترويسة Authorization: Token <token> فقط (لا يقبل ?token=)
const { json, readBody } = require('../lib/core');

const TOKEN = process.env.BSD_API_TOKEN || process.env.FOOTBALL_API_KEY || '';
const BASE = 'https://sports.bzzoiro.com/api/v2';
const IMG = 'https://sports.bzzoiro.com/img';

// كاش بالذاكرة
const cache = {};
function getCache(k, ttl) { const e = cache[k]; return e && Date.now() - e.t < ttl ? e.v : null; }
function setCache(k, v) { cache[k] = { v, t: Date.now() }; return v; }

async function bsd(path) {
  const r = await fetch(BASE + path, {
    headers: { Authorization: 'Token ' + TOKEN, Accept: 'application/json' },
    signal: AbortSignal.timeout(9000),
  });
  if (!r.ok) throw new Error('bsd_' + r.status);
  return r.json();
}

function ymd(d) { return d.toISOString().slice(0, 10); }

// شعارات مجانية من BSD (بدون مصادقة)
const teamImg = (id) => (id ? `${IMG}/team/${id}/` : '');
const leagueImg = (id) => (id ? `${IMG}/league/${id}/` : '');

// ── تبسيط مباراة من /events/ أو /events/live/ ──
function simplifyMatch(m) {
  const status = String(m.status || 'notstarted');
  return {
    id: m.id,
    league: m.league_name || '',
    league_id: m.league_id || null,
    league_logo: leagueImg(m.league_id),
    date: m.event_date || '',
    status, // notstarted | inprogress | penalties | finished
    period: m.period || null,
    minute: m.current_minute || null,
    home: m.home_team || '',
    away: m.away_team || '',
    home_logo: teamImg(m.home_team_id),
    away_logo: teamImg(m.away_team_id),
    score_home: (m.home_score != null ? m.home_score : null),
    score_away: (m.away_score != null ? m.away_score : null),
  };
}

const isLive = (s) => /inprogress|penalties|1st|2nd|halftime|extra/i.test(s);
const isFinished = (s) => /finished|ft/i.test(s);

// ── تبسيط توقع من /predictions/ (نموذج CatBoost ML) ──
function simplifyPrediction(p) {
  const ev = p.event || {};
  const mr = (p.markets && p.markets.match_result) || {};
  const rec = p.recommendations || {};
  const score = (p.markets && p.markets.score) || {};
  const ou = (p.markets && p.markets.over_under) || {};
  const btts = (p.markets && p.markets.btts) || {};
  // الفائز المتوقع
  const fav = mr.predicted || rec.favorite || null; // H | D | A
  const home = ev.home_team || '';
  const away = ev.away_team || '';
  let tipName = '';
  if (fav === 'H') tipName = home; else if (fav === 'A') tipName = away; else if (fav === 'D') tipName = 'تعادل';
  // نسبة الثقة: أعلى احتمال في نتيجة المباراة
  let confidence = Math.round(Math.max(mr.prob_home || 0, mr.prob_draw || 0, mr.prob_away || 0));
  return {
    id: p.id,
    event_id: ev.id,
    home, away,
    home_logo: teamImg(ev.home_team_id),
    away_logo: teamImg(ev.away_team_id),
    league: ev.league_name || '',
    league_logo: leagueImg(ev.league_id),
    date: ev.event_date || '',
    tip: tipName,
    fav,
    confidence,
    prob_home: Math.round(mr.prob_home || 0),
    prob_draw: Math.round(mr.prob_draw || 0),
    prob_away: Math.round(mr.prob_away || 0),
    score: score.most_likely || '',
    over25: ou.prob_over_25 != null ? Math.round(ou.prob_over_25) : null,
    btts_yes: btts.prob_yes != null ? Math.round(btts.prob_yes) : null,
    model_conf: p.model && p.model.confidence != null ? Math.round(p.model.confidence * 100) : confidence,
    recommended: !!(rec.winner || rec.bet_favorite),
  };
}

// قسيمة اليوم: أفضل التوقعات موثوقية
function buildCoupon(preds) {
  return preds
    .filter((p) => p.tip && p.tip !== 'تعادل' && p.confidence >= 55)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 5);
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return json(res, 405, { error: 'method' });
  try {
    if (!TOKEN) return json(res, 200, { error: 'no_key', view: 'today', matches: [], predictions: [], coupon: [] });
    const body = await readBody(req);
    const view = body.view || 'today';

    // ── تشخيص ──
    if (view === 'debug') {
      const ep = body.endpoint || '/leagues/';
      try {
        const raw = await bsd(ep);
        const sample = Array.isArray(raw) ? raw.slice(0, 2)
          : (raw && raw.results ? { count: raw.count, results: raw.results.slice(0, 2) }
          : (raw && raw.events ? { count: raw.count, events: raw.events.slice(0, 2) } : raw));
        return json(res, 200, { ok: true, endpoint: BASE + ep, sample });
      } catch (e) { return json(res, 200, { ok: false, endpoint: BASE + ep, error: String(e.message || e) }); }
    }

    // ── الدوريات ──
    if (view === 'leagues') {
      const ck = 'leagues';
      let lg = getCache(ck, 6 * 3600e3);
      if (!lg) {
        try {
          const d = await bsd('/leagues/?is_active=true&limit=60');
          lg = (d.results || []).map((l) => ({
            id: l.id, name: l.name, country: l.country, logo: leagueImg(l.id),
            season_id: l.current_season ? l.current_season.id : null,
          }));
        } catch { lg = []; }
        setCache(ck, lg);
      }
      return json(res, 200, { view, leagues: lg });
    }

    // ── الترتيب (دوري محدد) ──
    if (view === 'standings') {
      const leagueId = body.league_id || 17; // افتراضي: الدوري الإنجليزي
      const ck = 'standings_' + leagueId;
      let st = getCache(ck, 30 * 60e3);
      if (!st) {
        try {
          const d = await bsd(`/leagues/${leagueId}/standings/`);
          const rows = d.grouped ? Object.values(d.standings || {}).flat() : (d.standings || []);
          st = {
            league: d.season ? d.season.name : '',
            table: rows.map((r) => ({
              position: r.position, team: r.team_name, team_id: r.team_id,
              crest: teamImg(r.team_id), played: r.played, won: r.won, drawn: r.drawn,
              lost: r.lost, gd: r.gd, points: r.pts, form: r.form || '',
            })),
          };
        } catch { st = { league: '', table: [] }; }
        setCache(ck, st);
      }
      return json(res, 200, { view, standings: st });
    }

    // ── التوقعات + قسيمة اليوم ──
    if (view === 'predictions') {
      const ck = 'predictions';
      let preds = getCache(ck, 5 * 60e3);
      if (!preds) {
        try {
          const d = await bsd('/predictions/?status=upcoming&limit=40');
          preds = (d.results || []).map(simplifyPrediction).filter((p) => p.home && p.away);
        } catch { preds = []; }
        setCache(ck, preds);
      }
      const coupon = buildCoupon(preds);
      return json(res, 200, { view, predictions: preds.slice(0, 15), coupon });
    }

    // ── المباريات: اليوم / غداً / أمس / مباشر ──
    const ck = 'matches_' + view;
    let matches = getCache(ck, view === 'live' ? 30e3 : 3 * 60e3);
    if (!matches) {
      let all = [];
      try {
        if (view === 'live') {
          const d = await bsd('/events/live/');
          all = (d.events || []).map(simplifyMatch);
        } else {
          const today = new Date();
          let day = today;
          if (view === 'tomorrow') day = new Date(+today + 864e5);
          else if (view === 'yesterday') day = new Date(+today - 864e5);
          const ds = ymd(day);
          const d = await bsd(`/events/?date_from=${ds}&date_to=${ds}&limit=120`);
          all = (d.results || []).map(simplifyMatch);
          // ترتيب: المباشر أولاً ثم الأقرب وقتاً
          all.sort((a, b) => String(a.date).localeCompare(String(b.date)));
        }
      } catch { all = []; }
      matches = setCache(ck, all);
    }

    return json(res, 200, { view, matches, count: matches.length });
  } catch (e) {
    console.error('sport error', e);
    return json(res, 200, { error: 'unavailable', view: 'today', matches: [], predictions: [], coupon: [] });
  }
};
