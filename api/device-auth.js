// api/device-auth.js — Demande d'autorisation d'un nouvel appareil (via support)
// طلب تفعيل جهاز جديد — يمر عبر الدعم
const {
  sbGet, sbInsert, readSession, hashFingerprint, json, readBody,
} = require('../lib/core');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return json(res, 405, { error: 'method' });
  try {
    const body = await readBody(req);
    const sess = readSession(body.session);
    if (!sess) return json(res, 401, { error: 'no_session' });

    const gid = sess.gid;
    const fp = hashFingerprint(body.fingerprint);

    // Enregistrer l'appareil comme non-confiance s'il n'existe pas encore
    const dev = await sbGet('devices', `game_id=eq.${gid}&fingerprint=eq.${fp}&select=trusted`);
    if (!dev) {
      await sbInsert('devices', {
        game_id: gid, fingerprint: fp, trusted: false,
        user_agent: String(body.user_agent || '').slice(0, 180),
      }).catch(() => {});
    }

    // Renvoyer un identifiant de demande court pour le message de support
    const ticket = `DV-${gid.slice(-4)}-${fp.slice(0, 4).toUpperCase()}`;
    return json(res, 200, { ok: true, ticket });
  } catch (e) {
    console.error('device-auth error', e);
    return json(res, 500, { error: 'server' });
  }
};
