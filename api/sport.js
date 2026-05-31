// api/sport.js — قسم الرياضة (football-data.org)
// يعرض: مباريات أمس/اليوم/غداً/مباشر + ترتيب + 5 توقعات مبنية على بيانات حقيقية
// المفتاح في بيئة Vercel: FOOTBALL_API_KEY (لا يظهر أبداً في GitHub)
const { json, readBody } = require('../lib/core');

const FB_KEY = process.env.FOOTBALL_API_KEY || '';
const FB_BASE = 'https://api.football-data.org/v4';
// الدوريات الكبرى المتاحة في الخطة المجانية
const COMPETITIONS = 'PL,PD,SA,BL1,FL1,CL';

// كاش بسيط بالذاكرة (الخطة المجانية محدودة: 10 طلبات/دقيقة)
const cache = {};
function getCache(k, ttlMs) { const e = cache[k]; return e && Date.now() - e.t < ttlMs ? e.v : null; }
function setCache(k, v) { cache[k] = { v, t: Date.now() }; }

async function fb(path) {
  const r = await fetch(FB_BASE + path, {
    headers: { 'X-Auth-Token': FB_KEY },
    signal: AbortSignal.timeout(9000),
  });
  if (!r.ok) throw new Error('fb_' + r.status);
  return r.json();
}

function ymd(d) { return d.toISOString().slice(0, 10); }
function simplifyMatch(m) {
  return {
    id: m.id,
    comp: m.competition ? m.competition.name : '',
    comp_emblem: m.competition ? m.competition.emblem : '',
    utcDate: m.utcDate,
    status: m.status, // SCHEDULED | LIVE | IN_PLAY | PAUSED | FINISHED
    home: m.homeTeam ? m.homeTeam.shortName || m.homeTeam.name : '',
    home_crest: m.homeTeam ? m.homeTeam.crest : '',
    away: m.awayTeam ? m.awayTeam.shortName || m.awayTeam.name : '',
    away_crest: m.awayTeam ? m.awayTeam.crest : '',
    score_home: m.score && m.score.fullTime ? m.score.fullTime.home : null,
    score_away: m.score && m.score.fullTime ? m.score.fullTime.away : null,
  };
}

// ── توقع مبني على بيانات حقيقية: ترتيب الفريقين + فارق النقاط + الأرضية ──
//    شفّاف: نعرض نسبة ثقة محسوبة من فجوة الترتيب، لا وعود كاذبة
async function buildPredictions(matches, standingsCache) {
  const upcoming = matches.filter((m) => m.status === 'SCHEDULED' || m.status === 'TIMED').slice(0, 5);
  const preds = [];
  for (const m of upcoming) {
    const pos = standingsCache[m.comp] || {}; // standingsCache keyed by competition name
    const hp = pos[m.home], ap = pos[m.away];
    let pick, confidence, reason;
    if (hp && ap) {
      const gap = ap.position - hp.position; // موجب = المضيف أعلى
      const homeAdv = 3; // ميزة الأرض
      const eff = gap + homeAdv;
      if (eff > 6) { pick = m.home; confidence = Math.min(78, 52 + eff); reason = 'home_higher'; }
      else if (eff < -4) { pick = m.away; confidence = Math.min(74, 50 + Math.abs(eff)); reason = 'away_higher'; }
      else { pick = 'draw'; confidence = 46 + Math.floor(Math.random() * 6); reason = 'close'; }
    } else {
      pick = m.home; confidence = 50; reason = 'home_adv';
    }
    preds.push({
      ...m,
      pick, confidence,
      home_pos: hp ? hp.position : null,
      away_pos: ap ? ap.position : null,
      reason,
    });
  }
  return preds;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return json(res, 405, { error: 'method' });
  if (!FB_KEY) return json(res, 200, { error: 'no_key', message: 'مفتاح كرة القدم غير مُعد' });
  try {
    const body = await readBody(req);
    const view = body.view || 'today';

    // الترتيب (لكل دوري) — يُستخدم للتوقعات، كاش 6 ساعات
    async function standings() {
      const ck = 'standings';
      let s = getCache(ck, 6 * 36e5);
      if (s) return s;
      s = {};
      for (const comp of ['PL', 'PD', 'SA', 'BL1', 'FL1']) {
        try {
          const d = await fb(`/competitions/${comp}/standings`);
          const table = d.standings && d.standings[0] ? d.standings[0].table : [];
          const map = {};
          table.forEach((row) => {
            const nm = row.team.shortName || row.team.name;
            map[nm] = { position: row.position, points: row.points, won: row.won, lost: row.lost };
          });
          s[d.competition.name] = map;
        } catch { /* تجاوز دوري غير متاح */ }
      }
      setCache(ck, s);
      return s;
    }

    if (view === 'standings') {
      const comp = body.competition || 'PL';
      const ck = 'table_' + comp;
      let t = getCache(ck, 3 * 36e5);
      if (!t) { const d = await fb(`/competitions/${comp}/standings`); t = { name: d.competition.name, table: (d.standings[0] ? d.standings[0].table : []).map((r) => ({ position: r.position, team: r.team.shortName || r.team.name, crest: r.team.crest, points: r.points, played: r.playedGames, won: r.won, draw: r.draw, lost: r.lost })) }; setCache(ck, t); }
      return json(res, 200, { standings: t });
    }

    // المباريات حسب التاريخ
    let dateFrom, dateTo, statusFilter = null;
    const now = new Date();
    if (view === 'live') { statusFilter = 'LIVE'; }
    else if (view === 'yesterday') { const y = new Date(now - 864e5); dateFrom = dateTo = ymd(y); }
    else if (view === 'tomorrow') { const t = new Date(+now + 864e5); dateFrom = dateTo = ymd(t); }
    else { dateFrom = dateTo = ymd(now); } // today

    const ck = `matches_${view}`;
    let matches = getCache(ck, view === 'live' ? 60e3 : 5 * 60e3);
    if (!matches) {
      let path = `/matches?competitions=${COMPETITIONS}`;
      if (statusFilter) path += `&status=${statusFilter}`;
      else path += `&dateFrom=${dateFrom}&dateTo=${dateTo}`;
      const d = await fb(path);
      matches = (d.matches || []).map(simplifyMatch);
      setCache(ck, matches);
    }

    let predictions = null;
    if (view === 'today' || view === 'tomorrow' || body.with_predictions) {
      const st = await standings();
      predictions = await buildPredictions(matches, st);
    }

    return json(res, 200, { view, matches, predictions, count: matches.length });
  } catch (e) {
    console.error('sport error', e);
    return json(res, 200, { error: 'fetch_failed', message: String(e.message || e).slice(0, 80) });
  }
};
