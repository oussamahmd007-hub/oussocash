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
// طلب آمن لا يرمي (للجلب المتوازي للموارد الفرعية)
async function bsdSafe(path) { try { return await bsd(path); } catch { return null; } }

function ymd(d) { return d.toISOString().slice(0, 10); }

// تطبيع التاريخ: يضمن أن الوقت يُقرأ كـ UTC في المتصفح
function normalizeDate(s) {
  if (!s) return '';
  const t = String(s).trim().replace(' ', 'T'); // "2024-01-15 15:00" → "2024-01-15T15:00"
  if (/Z$|[+\-]\d{2}:\d{2}$/.test(t)) return t; // مزود بـ timezone مسبقاً
  return t + 'Z'; // أضف Z لضمان التفسير كـ UTC
}

// إزالة المكررات بالـ key المحدد
function dedupBy(arr, key) {
  const seen = new Set();
  return arr.filter(item => {
    const k = item[key];
    if (!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

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
    date: normalizeDate(m.event_date),
    status, // notstarted | inprogress | penalties | finished
    period: m.period || null,
    minute: m.current_minute || null,
    home: m.home_team || '',
    away: m.away_team || '',
    home_id: m.home_team_id || null,
    away_id: m.away_team_id || null,
    home_logo: teamImg(m.home_team_id),
    away_logo: teamImg(m.away_team_id),
    score_home: (m.home_score != null ? m.home_score : null),
    score_away: (m.away_score != null ? m.away_score : null),
    score_home_ht: (m.home_score_ht != null ? m.home_score_ht : null),
    score_away_ht: (m.away_score_ht != null ? m.away_score_ht : null),
    live_ws: !!m.live_websocket,
  };
}

const isLive = (s) => /inprogress|penalties|1st|2nd|halftime|extra/i.test(s);
const isFinished = (s) => /finished|ft/i.test(s);

// ── تبسيط توقع من /predictions/ (نموذج CatBoost ML) — مُثرى ──
function simplifyPrediction(p) {
  const ev = p.event || {};
  const M = p.markets || {};
  const mr = M.match_result || {};
  const eg = M.expected_goals || {};
  const ou = M.over_under || {};
  const btts = M.btts || {};
  const score = M.score || {};
  const corners = M.corners || M.corner_kicks || {};
  const cards   = M.yellow_cards || M.cards || {};
  const rec = p.recommendations || {};
  const mdl = p.model || {};
  const fav = mr.predicted || rec.favorite || null; // H | D | A
  const home = ev.home_team || '';
  const away = ev.away_team || '';
  let tipName = '';
  if (fav === 'H') tipName = home; else if (fav === 'A') tipName = away; else if (fav === 'D') tipName = 'تعادل';
  const pH = Math.round(mr.prob_home || 0), pD = Math.round(mr.prob_draw || 0), pA = Math.round(mr.prob_away || 0);
  const confidence = Math.max(pH, pD, pA);
  const dc = [
    { key: '1X', prob: pH + pD },
    { key: 'X2', prob: pD + pA },
    { key: '12', prob: pH + pA },
  ].sort((a, b) => b.prob - a.prob)[0];
  return {
    id: p.id,
    event_id: ev.id,
    home, away,
    home_id: ev.home_team_id || null,
    away_id: ev.away_team_id || null,
    home_logo: teamImg(ev.home_team_id),
    away_logo: teamImg(ev.away_team_id),
    league: ev.league_name || '',
    league_id: ev.league_id || null,
    league_logo: leagueImg(ev.league_id),
    date: normalizeDate(ev.event_date),
    status: ev.status || 'notstarted',
    tip: tipName,
    fav,
    confidence,
    prob_home: pH, prob_draw: pD, prob_away: pA,
    score: score.most_likely || '',
    eg_home: eg.home != null ? Number(eg.home) : null,
    eg_away: eg.away != null ? Number(eg.away) : null,
    over15: ou.prob_over_15 != null ? Math.round(ou.prob_over_15) : null,
    over25: ou.prob_over_25 != null ? Math.round(ou.prob_over_25) : null,
    over35: ou.prob_over_35 != null ? Math.round(ou.prob_over_35) : null,
    btts_yes: btts.prob_yes != null ? Math.round(btts.prob_yes) : null,
    corners_over85: corners.prob_over_8_5 != null ? Math.round(corners.prob_over_8_5) : null,
    corners_over95: corners.prob_over_9_5 != null ? Math.round(corners.prob_over_9_5) : null,
    corners_over105:corners.prob_over_10_5!= null ? Math.round(corners.prob_over_10_5): null,
    cards_over25:   cards.prob_over_2_5   != null ? Math.round(cards.prob_over_2_5)   : null,
    cards_over35:   cards.prob_over_3_5   != null ? Math.round(cards.prob_over_3_5)   : null,
    dc_key: dc.key, dc_prob: Math.round(dc.prob),
    model_conf: mdl.confidence != null ? Math.round(mdl.confidence * 100) : confidence,
    model_version: mdl.version || '',
    recommended: !!(rec.winner || rec.bet_favorite),
    rec: {
      winner: !!rec.winner, favorite: !!rec.bet_favorite,
      over15: !!rec.over_15, over25: !!rec.over_25, over35: !!rec.over_35, btts: !!rec.btts,
    },
  };
}

// قسيمة اليوم: أفضل التوقعات عبر جميع الأسواق (الأعلى % من أي سوق)
function buildCoupon(preds, n) {
  return preds
    .map((p) => { const b = bestSlipPick(p); return b ? { ...p, _best: b } : null; })
    .filter(Boolean)
    .filter((p) => p._best.conf >= 62)          // حد أدنى للثقة 62%
    .sort((a, b) => b._best.conf - a._best.conf)
    .slice(0, n || 5)
    .map(({ _best, ...p }) => ({ ...p, tip: _best.pick, confidence: _best.conf, _mk: _best.mk, _odd: _best.odd }));
}

// odd عشري ضمني من نسبة الثقة (هامش بسيط ~6%)
function impliedOdd(conf) {
  const c = Math.max(2, Math.min(97, conf || 0));
  return Math.max(1.02, +((100 / c) * 0.94).toFixed(2));
}
// أقوى توقع منفرد لكل مباراة — يشمل جميع الأسواق المتاحة ويختار الأعلى %
function bestSlipPick(p) {
  const c = [];
  // 1X2 — نحتفظ بـ fav لاستخدامه في التحقق من النتيجة لاحقاً
  if (p.tip && p.fav) c.push({ pick: p.tip, mk: '1x2', conf: p.confidence, fav: p.fav });
  // فرصة مزدوجة DC
  if (p.dc_key) c.push({ pick: p.dc_key, mk: 'dc', conf: p.dc_prob });
  // أهداف
  if (p.over15 != null) c.push({ pick: 'Over 1.5', mk: 'ou15', conf: p.over15 });
  if (p.over25 != null) c.push({ pick: 'Over 2.5', mk: 'ou25', conf: p.over25 });
  if (p.over35 != null) c.push({ pick: 'Over 3.5', mk: 'ou35', conf: p.over35 });
  // BTTS
  if (p.btts_yes != null) {
    const yes = p.btts_yes >= 50;
    c.push({ pick: yes ? 'BTTS: Yes' : 'BTTS: No', mk: 'btts', conf: yes ? p.btts_yes : (100 - p.btts_yes) });
  }
  // ركنيات
  if (p.corners_over85  != null) c.push({ pick: 'Corners +8.5',  mk: 'corners', conf: p.corners_over85 });
  if (p.corners_over95  != null) c.push({ pick: 'Corners +9.5',  mk: 'corners', conf: p.corners_over95 });
  if (p.corners_over105 != null) c.push({ pick: 'Corners +10.5', mk: 'corners', conf: p.corners_over105 });
  // بطاقات صفراء
  if (p.cards_over25 != null) {
    const yes25 = p.cards_over25 >= 50;
    c.push({ pick: yes25 ? 'Cards +2.5' : 'Cards -2.5', mk: 'cards', conf: yes25 ? p.cards_over25 : 100 - p.cards_over25 });
  }
  if (p.cards_over35 != null) {
    const yes35 = p.cards_over35 >= 50;
    c.push({ pick: yes35 ? 'Cards +3.5' : 'Cards -3.5', mk: 'cards', conf: yes35 ? p.cards_over35 : 100 - p.cards_over35 });
  }
  if (!c.length) return null;
  // الأعلى نسبة ثقة هو الفائز
  c.sort((a, b) => b.conf - a.conf);
  const b = c[0];
  return { pick: b.pick, mk: b.mk, conf: b.conf, odd: impliedOdd(b.conf), fav: b.fav || null };
}

// ── التحقق من صحة التوقع بعد انتهاء المباراة ──
// يُرجع: true=صحيح | false=خطأ | null=لا يمكن التحقق
function checkWin(best, actualResult, hs, as_) {
  if (!best) return null;
  const h = hs != null ? Number(hs) : null;
  const a = as_ != null ? Number(as_) : null;
  // اشتق النتيجة من الأهداف إذا لم تكن موجودة
  let res = actualResult;
  if (!res && h != null && a != null) res = h > a ? 'H' : a > h ? 'A' : 'D';
  switch (best.mk) {
    case '1x2': return res && best.fav ? res === best.fav : null;
    case 'dc': {
      if (!res) return null;
      const p = best.pick;
      if (p === '1X') return res === 'H' || res === 'D';
      if (p === 'X2') return res === 'D' || res === 'A';
      if (p === '12') return res === 'H' || res === 'A';
      return null;
    }
    case 'ou15': return (h != null && a != null) ? (h + a > 1.5) : null;
    case 'ou25': return (h != null && a != null) ? (h + a > 2.5) : null;
    case 'ou35': return (h != null && a != null) ? (h + a > 3.5) : null;
    case 'btts': {
      if (h == null || a == null) return null;
      const btts = h > 0 && a > 0;
      return best.pick.includes('Yes') ? btts : !btts;
    }
    default: return null; // ركنيات/بطاقات — لا تتوفر البيانات الفعلية
  }
}
function buildSlip(preds, todayStr) {
  let src = preds.filter((p) => String(p.date).slice(0, 10) === todayStr && p.status === 'notstarted');
  if (!src.length) src = preds.filter((p) => p.status !== 'finished'); // احتياط: المباريات القادمة
  return src.map((p) => {
    const b = bestSlipPick(p);
    if (!b) return null;
    return {
      event_id: p.event_id, home: p.home, away: p.away,
      home_logo: p.home_logo, away_logo: p.away_logo,
      league: p.league, league_logo: p.league_logo, date: p.date,
      pick: b.pick, mk: b.mk, conf: b.conf, odd: b.odd,
    };
  }).filter(Boolean).sort((a, b) => b.conf - a.conf);
}

// ── خرائط الإحصائيات للعرض المقارن ──
const STAT_DEFS = [
  ['ball_possession', 'st_possession', 'pct'],
  ['total_shots', 'st_shots', 'num'],
  ['shots_on_target', 'st_shots_on', 'num'],
  ['big_chances', 'st_big_chances', 'num'],
  ['corner_kicks', 'st_corners', 'num'],
  ['corners', 'st_corners', 'num'],
  ['fouls', 'st_fouls', 'num'],
  ['offsides', 'st_offsides', 'num'],
  ['yellow_cards', 'st_yellow', 'num'],
  ['red_cards', 'st_red', 'num'],
  ['saves', 'st_saves', 'num'],
  ['pass_accuracy_pct', 'st_pass_acc', 'pct'],
  ['crosses', 'st_crosses', 'ratio'],
  ['dribbles', 'st_dribbles', 'ratio'],
  ['long_balls', 'st_long_balls', 'ratio'],
  ['aerial_duels', 'st_aerial', 'ratio'],
  ['attack', 'st_attacks', 'num'],
  ['dangerous_attack', 'st_dangerous', 'num'],
];

function readStat(side, key) {
  if (!side) return null;
  const v = side[key];
  if (v == null) return null;
  if (typeof v === 'object') {
    const pct = v.pct != null ? v.pct : null;
    const value = v.value != null ? v.value : null;
    return { display: value != null ? `${value}/${v.total != null ? v.total : '?'}` : (pct != null ? pct + '%' : ''), num: value != null ? Number(value) : (pct || 0), pct };
  }
  return { display: String(v), num: Number(v) || 0 };
}

function buildStatsCompare(stats) {
  if (!stats) return { rows: [], xg: null };
  const h = stats.home || {}, a = stats.away || {};
  const seen = {};
  const rows = [];
  for (const [key, label, type] of STAT_DEFS) {
    if (seen[label]) continue;
    const rh = readStat(h, key), ra = readStat(a, key);
    if (!rh && !ra) continue;
    seen[label] = true;
    rows.push({
      label, type,
      home: rh ? rh.display : '0', away: ra ? ra.display : '0',
      hn: rh ? rh.num : 0, an: ra ? ra.num : 0,
    });
  }
  let xg = null;
  const xh = h.xg && (h.xg.actual != null) ? Number(h.xg.actual) : null;
  const xa = a.xg && (a.xg.actual != null) ? Number(a.xg.actual) : null;
  if (xh != null || xa != null) xg = { home: xh != null ? xh : 0, away: xa != null ? xa : 0 };
  return { rows, xg };
}

// ── تبسيط أحداث المباراة (timeline) ──
function simplifyIncidents(arr) {
  if (!Array.isArray(arr)) return [];
  const keep = { goal: 1, card: 1, substitution: 1, varDecision: 1, penalty: 1 };
  return arr.filter((i) => keep[i.type]).map((i) => ({
    type: i.type,
    minute: i.minute != null ? i.minute : null,
    is_home: i.is_home != null ? !!i.is_home : null,
    player: i.player || i.player_in || '',
    player_out: i.player_out || '',
    card_type: i.card_type || '',
    detail: i.detail || i.decision || '',
  }));
}

// ── تبسيط التشكيلة ──
function simplifyLineupSide(side) {
  if (!side) return null;
  const mapP = (p) => ({
    name: p.short_name || p.name || '',
    position: p.position || '',
    jersey: p.jersey_number != null ? p.jersey_number : null,
    ai: p.ai_score != null ? Math.round(p.ai_score * 100) : null,
  });
  return {
    team: side.team_name || '',
    formation: side.formation || '',
    confidence: side.confidence != null ? Math.round(side.confidence * 100) : null,
    players: (side.players || []).map(mapP),
    subs: (side.substitutes || []).map(mapP),
  };
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
          const d = await bsd('/leagues/?is_active=true&limit=80');
          lg = (d.results || []).map((l) => ({
            id: l.id, name: l.name, country: l.country, logo: leagueImg(l.id),
            season_id: l.current_season ? l.current_season.id : null,
          }));
          // ترتيب: أبرز البطولات أولاً ثم أبجدياً
          const PRIORITY = ['premier league', 'la liga', 'serie a', 'bundesliga', 'ligue 1',
            'champions league', 'europa league', 'primeira liga', 'eredivisie', 'saudi',
            'mls', 'liga mx', 'world cup', 'euro', 'copa', 'championship'];
          const rank = (n) => { const s = String(n || '').toLowerCase(); const i = PRIORITY.findIndex((p) => s.includes(p)); return i < 0 ? 999 : i; };
          lg.sort((a, b) => { const ra = rank(a.name), rb = rank(b.name); return ra !== rb ? ra - rb : String(a.name).localeCompare(String(b.name)); });
        } catch { lg = []; }
        setCache(ck, lg);
      }
      return json(res, 200, { view, leagues: lg });
    }

    // ── الترتيب (دوري محدد) ──
    if (view === 'standings') {
      const leagueId = body.league_id || 17;
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
              lost: r.lost, gf: r.gf, ga: r.ga, gd: r.gd, points: r.pts, form: r.form || '',
            })),
          };
        } catch { st = { league: '', table: [] }; }
        setCache(ck, st);
      }
      return json(res, 200, { view, standings: st });
    }

    // ── تفاصيل مباراة كاملة (كل شيء) ──
    if (view === 'match') {
      const id = body.event_id;
      if (!id) return json(res, 200, { view, error: 'no_id' });
      const ck = 'match_' + id;
      let data = getCache(ck, 45e3);
      if (!data) {
        const [detail, stats, incidents, odds, lineups, metadata, prediction] = await Promise.all([
          bsdSafe(`/events/${id}/`),
          bsdSafe(`/events/${id}/stats/`),
          bsdSafe(`/events/${id}/incidents/`),
          bsdSafe(`/events/${id}/odds/`),
          bsdSafe(`/events/${id}/lineups/`),
          bsdSafe(`/events/${id}/metadata/`),
          bsdSafe(`/events/${id}/prediction/`),
        ]);
        const d = detail || {};
        const [refRaw, venueRaw] = await Promise.all([
          d.referee_id ? bsdSafe(`/referees/${d.referee_id}/`) : Promise.resolve(null),
          d.venue_id ? bsdSafe(`/venues/${d.venue_id}/`) : Promise.resolve(null),
        ]);

        const sc = buildStatsCompare(stats && stats.stats);
        const lu = lineups || {};
        const pev = (prediction && prediction.event) ? prediction.event : {};
        data = {
          id,
          core: {
            league: d.league_name || pev.league_name || '',
            league_id: d.league_id || null,
            league_logo: leagueImg(d.league_id),
            home: d.home_team || pev.home_team || '',
            away: d.away_team || pev.away_team || '',
            home_id: d.home_team_id || null,
            away_id: d.away_team_id || null,
            home_logo: teamImg(d.home_team_id),
            away_logo: teamImg(d.away_team_id),
            date: d.event_date || pev.event_date || '',
            status: d.status || pev.status || 'notstarted',
            period: d.period || null,
            minute: d.current_minute != null ? d.current_minute : null,
            score_home: d.home_score != null ? d.home_score : null,
            score_away: d.away_score != null ? d.away_score : null,
            score_home_ht: d.home_score_ht != null ? d.home_score_ht : null,
            score_away_ht: d.away_score_ht != null ? d.away_score_ht : null,
            round: d.round_number != null ? d.round_number : null,
            derby: !!d.is_local_derby,
            neutral: !!d.is_neutral_ground,
            travel_km: d.travel_distance_km != null ? d.travel_distance_km : null,
            attendance: d.attendance != null ? d.attendance : null,
            weather: d.weather && d.weather.description ? {
              desc: d.weather.description,
              temp: d.weather.temperature_c != null ? d.weather.temperature_c : null,
              wind: d.weather.wind_speed != null ? d.weather.wind_speed : null,
            } : null,
            live_ws: !!d.live_websocket,
          },
          referee: refRaw ? {
            name: refRaw.name || '', country: refRaw.country || '',
            avg_yellow: refRaw.avg_yellow_per_match != null ? refRaw.avg_yellow_per_match : null,
            avg_red: refRaw.avg_red_per_match != null ? refRaw.avg_red_per_match : null,
            matches: refRaw.matches != null ? refRaw.matches : null,
          } : null,
          venue: venueRaw ? {
            name: venueRaw.name || '', city: venueRaw.city || '', country: venueRaw.country || '',
            capacity: venueRaw.capacity != null ? venueRaw.capacity : null,
            img: venueRaw.id ? `${IMG}/venue/${venueRaw.id}/` : '',
          } : null,
          prediction: (prediction && prediction.event) ? simplifyPrediction(prediction) : null,
          stats: sc.rows,
          xg: sc.xg,
          incidents: simplifyIncidents(incidents && incidents.incidents),
          odds: (odds && odds.odds) ? odds.odds : null,
          lineups: {
            status: lu.lineup_status || 'unavailable',
            beta: !!lu.beta,
            home: lu.lineups ? simplifyLineupSide(lu.lineups.home) : null,
            away: lu.lineups ? simplifyLineupSide(lu.lineups.away) : null,
            injuries: lu.unavailable_players || null,
          },
          facts: (metadata && Array.isArray(metadata.funfacts)) ? metadata.funfacts.map((f) => f.sentence).filter(Boolean) : [],
          preview: (metadata && metadata.ai_preview && metadata.ai_preview.text) ? metadata.ai_preview.text : '',
        };
        setCache(ck, data);
      }
      return json(res, 200, { view, match: data });
    }

    // ── التوقعات + قسيمة اليوم ──
    // ── قسائم 3 أيام (أمس/اليوم/غداً) مع النتائج ──
    if (view === 'slips') {
      const now          = new Date();
      const todayStr     = ymd(now);
      const tomorrowStr  = ymd(new Date(+now + 864e5));
      const yesterdayStr = ymd(new Date(+now - 864e5));

      const [yEvt, tEvt, mEvt, upPred, pastPred] = await Promise.all([
        bsdSafe(`/events/?date_from=${yesterdayStr}&date_to=${yesterdayStr}&limit=90`),
        bsdSafe(`/events/?date_from=${todayStr}&date_to=${todayStr}&limit=90`),
        bsdSafe(`/events/?date_from=${tomorrowStr}&date_to=${tomorrowStr}&limit=90`),
        bsdSafe('/predictions/?status=upcoming&limit=90'),
        bsdSafe('/predictions/?status=past&limit=90'),
      ]);

      // فهرس النتائج الحقيقية
      const eventMap = {};
      [...(yEvt?.results || []), ...(tEvt?.results || []), ...(mEvt?.results || [])].forEach(ev => {
        const hs  = ev.home_score ?? ev.ft_home ?? ev.home_goals ?? null;
        const as_ = ev.away_score ?? ev.ft_away ?? ev.away_goals ?? null;
        if (hs == null && as_ == null) return;
        const outcome = ev.result ?? ev.outcome ?? (hs > as_ ? 'H' : as_ > hs ? 'A' : 'D');
        eventMap[String(ev.id)] = { hs, as_, outcome };
      });

      const allPreds = dedupBy(
        [...(upPred?.results || []), ...(pastPred?.results || [])],
        p => String((p.event || {}).id || p.id || Math.random())
      );

      // تحويل كل التوقعات إلى صفوف قسيمة (مع النتائج إن وُجدت)
      const allRows = dedupBy(
        allPreds.map(p => {
          const pred = simplifyPrediction(p);
          if (!pred.home || !pred.away || !pred.date) return null;
          const best = bestSlipPick(pred);
          if (!best) return null;
          const actual = eventMap[String(pred.event_id)];
          const won = actual ? checkWin(best, actual.outcome, actual.hs, actual.as_) : null;
          return {
            event_id: pred.event_id, home: pred.home, away: pred.away,
            home_logo: pred.home_logo, away_logo: pred.away_logo,
            league: pred.league, league_logo: pred.league_logo, date: pred.date,
            pick: best.pick, mk: best.mk, conf: best.conf, odd: best.odd,
            home_score: actual ? actual.hs : null,
            away_score: actual ? actual.as_ : null,
            won,
          };
        }).filter(Boolean),
        'event_id'
      );
      const byDate = (a, b) => String(a.date).localeCompare(String(b.date));
      const byDay = (dayStr) => allRows.filter(r => r.date.slice(0, 10) === dayStr).sort(byDate);

      // قسيمة اليوم — كل مباريات اليوم (تبقى المنتهية)
      let slip = byDay(todayStr);
      // احتياط: إذا لا توجد مباريات اليوم، اعرض كل المباريات القادمة (غير المنتهية)
      if (!slip.length) {
        slip = allRows.filter(r => r.home_score == null).sort(byDate);
      }
      // إذا انتهت كل مباريات اليوم → قسيمة الغد
      const allDone = slip.length > 0 && slip.every(m => m.home_score != null && m.away_score != null);
      if (allDone) {
        const tom = byDay(tomorrowStr);
        if (tom.length) slip = tom;
      }

      return json(res, 200, { view: 'slips', slip });
    }

    // ── نتائج التوقعات: تقاطع التوقعات مع نتائج المباريات الحقيقية ──
    if (view === 'results') {
      const now          = new Date();
      const todayStr     = ymd(now);
      const yesterdayStr = ymd(new Date(+now - 864e5));

      // جلب كل شيء بالتوازي
      const [yEvt, tEvt, pastPred, upPred] = await Promise.all([
        bsdSafe(`/events/?date_from=${yesterdayStr}&date_to=${yesterdayStr}&limit=80`),
        bsdSafe(`/events/?date_from=${todayStr}&date_to=${todayStr}&limit=80`),
        bsdSafe('/predictions/?status=past&limit=60'),
        bsdSafe('/predictions/?status=upcoming&limit=60'),
      ]);

      // بناء فهرس النتائج الحقيقية من المباريات المنتهية
      const eventMap = {};
      [...(yEvt?.results || []), ...(tEvt?.results || [])].forEach(ev => {
        const hs  = ev.home_score ?? ev.ft_home ?? ev.home_goals ?? null;
        const as_ = ev.away_score ?? ev.ft_away ?? ev.away_goals ?? null;
        if (hs == null && as_ == null) return; // لم تنته بعد
        const outcome = ev.result ?? ev.outcome ??
          (hs > as_ ? 'H' : as_ > hs ? 'A' : 'D');
        eventMap[String(ev.id)] = { home_score: hs, away_score: as_, outcome };
      });

      // دمج التوقعات (ماضية + قادمة) — قد تظهر في أي منهما
      const rawPreds = dedupBy(
        [...(pastPred?.results || []), ...(upPred?.results || [])],
        p => String((p.event || {}).id || p.id || Math.random())
      );

      // تقاطع: توقع + نتيجة حقيقية
      const all = dedupBy(
        rawPreds.map(p => {
          const pred = simplifyPrediction(p);
          if (!pred.home || !pred.away || !pred.event_id) return null;
          if (!pred.date) return null;
          // فقط اليوم والأمس
          const day = pred.date.slice(0, 10);
          if (day !== todayStr && day !== yesterdayStr) return null;
          const actual = eventMap[String(pred.event_id)];
          if (!actual) return null; // لا نتيجة بعد
          const best = bestSlipPick(pred);
          if (!best) return null;
          const won = checkWin(best, actual.outcome, actual.home_score, actual.away_score);
          return {
            ...pred,
            tip: best.pick, confidence: best.conf, _mk: best.mk,
            home_score: actual.home_score,
            away_score: actual.away_score,
            won,
          };
        }).filter(Boolean),
        'event_id'
      );

      const todayRes     = all.filter(r => r.date && r.date.slice(0,10) === todayStr);
      const yesterdayRes = all.filter(r => r.date && r.date.slice(0,10) === yesterdayStr);
      const decided      = all.filter(r => r.won !== null);
      const wins         = decided.filter(r => r.won === true).length;
      const total        = decided.length;
      const rate         = total > 0 ? Math.round((wins / total) * 100) : null;

      return json(res, 200, {
        view: 'results',
        today_results: todayRes,
        yesterday_results: yesterdayRes,
        stats: { wins, total, rate },
      });
    }

    if (view === 'predictions') {
      const ck = 'predictions';
      let preds = getCache(ck, 5 * 60e3);
      if (!preds) {
        try {
          const d = await bsd('/predictions/?status=upcoming&limit=40');
          preds = dedupBy(
            (d.results || []).map(simplifyPrediction).filter((p) => p.home && p.away),
            'event_id'
          );
        } catch { preds = []; }
        setCache(ck, preds);
      }
      const coupon = buildCoupon(preds, 5);
      const featured = buildCoupon(preds, 3);
      const top_pick = featured[0] || null;
      const slip = buildSlip(preds, ymd(new Date()));
      return json(res, 200, { view, predictions: preds.slice(0, 18), coupon, featured, top_pick, slip });
    }

    // ── المباريات: اليوم / غداً / أمس / مباشر ──
    const ck = 'matches_' + view;
    let matches = getCache(ck, view === 'live' ? 30e3 : 3 * 60e3);
    if (!matches) {
      let all = [];
      try {
        if (view === 'live') {
          const d = await bsd('/events/live/');
          all = dedupBy((d.events || []).map(simplifyMatch), 'id');
        } else {
          const today = new Date();
          let day = today;
          if (view === 'tomorrow') day = new Date(+today + 864e5);
          else if (view === 'yesterday') day = new Date(+today - 864e5);
          const ds = ymd(day);
          const d = await bsd(`/events/?date_from=${ds}&date_to=${ds}&limit=120`);
          all = dedupBy((d.results || []).map(simplifyMatch), 'id');
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
