// api/register.js — Activation de l'identité (création de compte par 1xBet ID)
// تفعيل الهوية — إنشاء الحساب عبر 1xBet ID + ربط الجهاز + الإحالة
const {
  sb, sbGet, sbInsert, sbUpdate, isValidGameId, cleanGameId,
  isValidRefCode, generateRefCode, xbetSearchPlayer,
  hashFingerprint, hashPin, makeSession, publicAccount,
  json, readBody, DEPOSIT_DEADLINE_DAYS,
} = require('../lib/core');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return json(res, 405, { error: 'method' });
  try {
    const body  = await readBody(req);
    const gid   = cleanGameId(body.game_id);
    const lang  = body.lang === 'fr' ? 'fr' : 'ar';
    const fp    = hashFingerprint(body.fingerprint);
    const ua    = String(body.user_agent || '').slice(0, 180);
    const pin   = String(body.pin || '').replace(/\D/g, '').slice(0, 4);
    let refCode = String(body.ref_code || '').trim().toUpperCase();

    if (!isValidGameId(gid)) return json(res, 400, { error: 'invalid_id' });
    if (!body.fingerprint)   return json(res, 400, { error: 'no_device' });

    const banned = await sbGet('banned_ids', `game_id=eq.${gid}&select=game_id`);
    if (banned) return json(res, 200, { status: 'banned' });

    // Compte déjà existant → connexion (rattacher l'appareil)
    const existing = await sbGet('accounts', `game_id=eq.${gid}&select=*`);
    if (existing) {
      const result = await attachDevice(existing, fp, ua);
      return json(res, 200, {
        ok: true, existing: true,
        device: result.device,                 // 'trusted' | 'new'
        account: publicAccount(existing),
        session: makeSession(gid, fp),
      });
    }

    // Nouveau compte — confirmer l'existence réelle du joueur
    const r = await xbetSearchPlayer(gid);
    if (!r.found) return json(res, 200, { status: 'not_found' });

    // Code de parrainage du parrain (si fourni)
    let validReferrer = null;
    if (refCode && isValidRefCode(refCode)) {
      const ref = await sbGet('accounts', `ref_code=eq.${refCode}&select=game_id,ref_code`);
      if (ref && ref.game_id !== gid) validReferrer = ref.ref_code;
    }

    const myCode = generateRefCode(gid);
    const deadline = new Date(Date.now() + DEPOSIT_DEADLINE_DAYS * 864e5).toISOString();

    const created = await sbInsert('accounts', {
      game_id: gid, name: r.name, currency: r.currency || 'MRU', lang,
      status: 'pending', ref_code: myCode, referrer_code: validReferrer,
      pin_hash: pin.length === 4 ? hashPin(gid, pin) : null,
      deadline_at: deadline,
    });
    const account = Array.isArray(created) ? created[0] : created;

    // Premier appareil = de confiance automatiquement
    await sbInsert('devices', { game_id: gid, fingerprint: fp, trusted: true, user_agent: ua }).catch(() => {});

    // Enregistrer le parrainage (commission versée à l'activation)
    if (validReferrer) {
      const ref = await sbGet('accounts', `ref_code=eq.${validReferrer}&select=game_id`);
      if (ref) await sbInsert('referrals', { referrer_gid: ref.game_id, referred_gid: gid }).catch(() => {});
    }

    return json(res, 200, {
      ok: true, existing: false, device: 'trusted',
      account: publicAccount(account),
      session: makeSession(gid, fp),
    });
  } catch (e) {
    console.error('register error', e);
    return json(res, 500, { error: 'server' });
  }
};

// Rattache l'appareil au compte. Renvoie 'trusted' si déjà connu, sinon 'new'.
async function attachDevice(account, fp, ua) {
  const gid = account.game_id;
  const dev = await sbGet('devices', `game_id=eq.${gid}&fingerprint=eq.${fp}&select=trusted`);
  if (dev) {
    await sbUpdate('devices', `game_id=eq.${gid}&fingerprint=eq.${fp}`, { last_seen_at: new Date().toISOString() }).catch(() => {});
    return { device: dev.trusted ? 'trusted' : 'new' };
  }
  // Nouvel appareil — enregistré mais NON de confiance (autorisation via support)
  await sbInsert('devices', { game_id: gid, fingerprint: fp, trusted: false, user_agent: ua }).catch(() => {});
  return { device: 'new' };
}
