// api/verify.js — Vérification du 1xBet ID (récupération réelle des données)
// التحقق من 1xBet ID — يستخرج البيانات الفعلية من 1xBet
const {
  sbGet, isValidGameId, cleanGameId, xbetSearchPlayer, json, readBody,
} = require('../lib/core');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return json(res, 405, { error: 'method' });
  try {
    const body = await readBody(req);
    const gid = cleanGameId(body.game_id);

    if (!isValidGameId(gid)) return json(res, 200, { status: 'invalid' });

    // Bloqué ?
    const banned = await sbGet('banned_ids', `game_id=eq.${gid}&select=game_id`);
    if (banned) return json(res, 200, { status: 'banned' });

    // Déjà rattaché à un compte existant → connexion
    const existing = await sbGet('accounts', `game_id=eq.${gid}&select=status,name,has_pin:pin_hash`);
    if (existing) {
      return json(res, 200, {
        status: 'existing',
        account_status: existing.status,
        name: existing.name,
        has_pin: !!existing.has_pin,
      });
    }

    // Récupération réelle depuis 1xBet
    const r = await xbetSearchPlayer(gid);
    if (!r.found) return json(res, 200, { status: 'not_found' });

    return json(res, 200, {
      status: 'found',
      game_id: gid,
      name: r.name,
      currency: r.currency || 'MRU',
    });
  } catch (e) {
    console.error('verify error', e);
    return json(res, 500, { error: 'server' });
  }
};
