// api/admin.js — Panneau d'administration (protégé par mot de passe)
// لوحة الإدارة — محمية بكلمة مرور
const {
  sb, sbGet, sbInsert, sbUpdate, sbDelete, json, readBody, pushNotify,
  WELCOME_BONUS, REFERRAL_COMMISSION, REFERRAL_PERCENT,
  MIN_DEPOSIT_USD, USD_TO_UM, DEPOSIT_DEADLINE_DAYS, PENDING_TTL_HOURS, ADMIN_PASSWORD,
} = require('../lib/core');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return json(res, 405, { error: 'method' });
  try {
    const body = await readBody(req);
    if (!ADMIN_PASSWORD || body.password !== ADMIN_PASSWORD) return json(res, 401, { error: 'unauthorized' });
    const action = body.action;

    if (action === 'dashboard') {
      const accs = await sb('accounts?select=status,balance_um,created_at');
      const wd = await sb('withdrawals?status=eq.pending&select=amount_um');
      const refs = await sb('referrals?paid=eq.true&select=commission_um');
      return json(res, 200, {
        total: accs.length,
        active: accs.filter((a) => a.status === 'active').length,
        pending: accs.filter((a) => a.status === 'pending').length,
        pending_wd: wd.length,
        pending_wd_amount: wd.reduce((s, w) => s + w.amount_um, 0),
        total_commissions: refs.reduce((s, r) => s + r.commission_um, 0),
      });
    }

    if (action === 'accounts') {
      const accs = await sb('accounts?select=*&order=created_at.desc&limit=300');
      return json(res, 200, { accounts: accs });
    }

    if (action === 'withdrawals') {
      const wd = await sb('withdrawals?status=eq.pending&select=*&order=requested_at.asc');
      return json(res, 200, { withdrawals: wd });
    }

    if (action === 'process_wd') {
      const wid = body.id, approve = body.approve;
      const wd = await sbGet('withdrawals', `id=eq.${wid}&select=*`);
      if (!wd || wd.status !== 'pending') return json(res, 400, { error: 'not_found' });
      if (approve) {
        await sbUpdate('withdrawals', `id=eq.${wid}`, { status: 'approved', processed_at: new Date().toISOString() });
        await pushNotify(wd.game_id, 'OussoCash', `Retrait traité · تم السحب · ${wd.amount_um} UM`);
      } else {
        const a = await sbGet('accounts', `game_id=eq.${wd.game_id}&select=balance_um`);
        await sbUpdate('accounts', `game_id=eq.${wd.game_id}`, { balance_um: (a.balance_um || 0) + wd.amount_um });
        await sbUpdate('withdrawals', `id=eq.${wid}`, { status: 'rejected', processed_at: new Date().toISOString() });
      }
      return json(res, 200, { ok: true });
    }

    if (action === 'trust_device') {
      // Autoriser un appareil après vérification support
      await sbUpdate('devices', `game_id=eq.${body.game_id}&fingerprint=eq.${body.fingerprint}`, { trusted: true }).catch(() => {});
      await pushNotify(body.game_id, 'OussoCash', 'Appareil de confiance ajouté · تمت إضافة جهاز موثوق');
      return json(res, 200, { ok: true });
    }

    if (action === 'devices') {
      const devs = await sb(`devices?game_id=eq.${body.game_id}&select=fingerprint,trusted,user_agent,created_at,last_seen_at&order=created_at.desc`);
      return json(res, 200, { devices: devs });
    }

    if (action === 'ban_id') {
      await sbInsert('banned_ids', { game_id: String(body.game_id), reason: body.reason || 'manual_admin' }).catch(() => {});
      await sbUpdate('accounts', `game_id=eq.${body.game_id}`, { status: 'banned' }).catch(() => {});
      return json(res, 200, { ok: true });
    }

    if (action === 'get_settings') {
      const s = await sb('settings?select=*'); const map = {};
      s.forEach((r) => (map[r.key] = r.value));
      return json(res, 200, { settings: map });
    }
    if (action === 'set_setting') {
      await sbUpdate('settings', `key=eq.${body.key}`, { value: body.value, updated_at: new Date().toISOString() });
      return json(res, 200, { ok: true });
    }

    // Nettoyage : comptes en attente expirés (> 24h sans dépôt + suppression CSV)
    if (action === 'cleanup_pending') {
      const cutoff = new Date(Date.now() - PENDING_TTL_HOURS * 36e5).toISOString();
      const stale = await sb(`accounts?status=eq.pending&created_at=lt.${cutoff}&deposit_done=eq.false&select=game_id`);
      for (const a of stale) await sbDelete('accounts', `game_id=eq.${a.game_id}`).catch(() => {});
      return json(res, 200, { ok: true, removed: stale.length });
    }

    if (action === 'process_csv') {
      return json(res, 200, await processCSV(body.csv || '', body.filename || 'upload.csv'));
    }

    return json(res, 400, { error: 'bad_action' });
  } catch (e) {
    console.error('admin error', e);
    return json(res, 500, { error: 'server', detail: String(e).slice(0, 200) });
  }
};

// ═══════════════════════════════════════════════════════════════════
//  Traitement du rapport CSV 1xBet (séparateur ;, en-tête AR/EN)
//  معالجة تقرير 1xBet — استخراج: معرف اللاعب، SubId، الإيداعات، البلد، تاريخ التسجيل
//  Structure réelle: bloc méta en haut, puis ligne d'en-tête contenant "معرف اللاعب"
// ═══════════════════════════════════════════════════════════════════
async function processCSV(content, filename) {
  const lines = content.split('\n');

  // Trouver la ligne d'en-tête du tableau (contient "معرف اللاعب" ou "Player Id")
  let hIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('معرف اللاعب') || /Player\s*Id/i.test(lines[i])) { hIdx = i; break; }
  }
  if (hIdx < 0) return { error: 'no_header', message: 'عمود معرف اللاعب غير موجود · colonne Player Id introuvable' };

  // Détecter les colonnes par nom (robuste à l'ordre)
  const header = lines[hIdx].split(';');
  const col = { id: -1, sub: -1, dep: -1, country: -1, reg: -1 };
  header.forEach((h, i) => {
    const hc = h.trim();
    if (hc.includes('معرف اللاعب') || /Player\s*Id/i.test(hc)) col.id = i;
    else if (/SubId/i.test(hc)) col.sub = i;
    else if (hc.includes('مجموع الإيداعات') || /Deposits?\s*sum/i.test(hc)) col.dep = i;
    else if (hc.includes('البلد') || /Country/i.test(hc)) col.country = i;
    else if (hc.includes('تاريخ التسجيل') || /Registration\s*date/i.test(hc)) col.reg = i;
  });
  if (col.id < 0) return { error: 'no_id_col', message: 'تعذّر تحديد عمود معرف اللاعب' };

  // Lire les données réelles du fichier
  const csv = {};
  for (let i = hIdx + 1; i < lines.length; i++) {
    const row = lines[i].split(';');
    const gid = (row[col.id] || '').trim();
    if (!/^\d{6,13}$/.test(gid)) continue; // ignorer les lignes vides/non-joueur
    csv[gid] = {
      sub: col.sub >= 0 ? (row[col.sub] || '').trim().toUpperCase() : '',
      dep: col.dep >= 0 ? (row[col.dep] || '0').trim() : '0',
      country: col.country >= 0 ? (row[col.country] || '').trim() : '',
      reg: col.reg >= 0 ? (row[col.reg] || '').trim() : '',
    };
  }

  // Tous les comptes en attente / dépôt incomplet
  const pending = await sb('accounts?select=*&status=in.(pending,deposit_incomplete)');
  const stats = { activated: 0, no_sub: 0, deposit_incomplete: 0, not_in_csv: 0, total: pending.length };
  const now = new Date().toISOString();

  for (const a of pending) {
    const gid = a.game_id;

    // ID absent du rapport → le joueur n'existe pas / non rattaché → suppression
    if (!csv[gid]) {
      stats.not_in_csv++;
      await sbDelete('accounts', `game_id=eq.${gid}`).catch(() => {});
      continue;
    }

    const r = csv[gid];
    const depUsd = parseFloat(r.dep.replace(',', '.')) || 0;
    const depUm = Math.round(depUsd * USD_TO_UM);

    // Enregistrer les données extraites (pays, date d'inscription, dépôt total)
    const extracted = { country: r.country, xbet_reg_date: r.reg, total_deposit: depUsd };

    // SubId doit contenir OUSSO (promo de l'agence)
    if (!r.sub.includes('OUSSO')) {
      stats.no_sub++;
      await sbInsert('banned_ids', { game_id: gid, reason: 'no_ousso_subid' }).catch(() => {});
      await sbDelete('accounts', `game_id=eq.${gid}`).catch(() => {});
      continue;
    }

    // Dépôt incomplet (< 200 UM ≈ 4 USD)
    if (depUsd < MIN_DEPOSIT_USD) {
      stats.deposit_incomplete++;
      if (a.deadline_at && new Date(a.deadline_at) < new Date()) {
        // Délai dépassé → bannir et supprimer
        await sbInsert('banned_ids', { game_id: gid, reason: 'deposit_deadline_passed' }).catch(() => {});
        await sbDelete('accounts', `game_id=eq.${gid}`).catch(() => {});
        await pushNotify(gid, 'OussoCash', 'ID supprimé · تم حذف المعرّف لعدم إكمال الإيداع');
      } else {
        const deadline = a.deadline_at || new Date(Date.now() + DEPOSIT_DEADLINE_DAYS * 864e5).toISOString();
        await sbUpdate('accounts', `game_id=eq.${gid}`, { ...extracted, status: 'deposit_incomplete', deadline_at: deadline });
        await pushNotify(gid, 'OussoCash', `Dépôt incomplet · إيداع غير مكتمل · أكمله خلال ${DEPOSIT_DEADLINE_DAYS} أيام`);
      }
      continue;
    }

    // ✅ Activation : SubId OUSSO + dépôt suffisant
    await sbUpdate('accounts', `game_id=eq.${gid}`, {
      ...extracted, status: 'active', deposit_done: true,
      balance_um: (a.balance_um || 0) + (a.referrer_code ? WELCOME_BONUS : 0),
      activated_at: now,
    });
    stats.activated++;
    await pushNotify(gid, 'OussoCash', a.referrer_code
      ? `Compte activé · تم التفعيل · +${WELCOME_BONUS} UM`
      : 'Compte activé · تم تفعيل حسابك');

    // Commission de parrainage
    if (a.referrer_code) {
      const ref = await sbGet('accounts', `ref_code=eq.${a.referrer_code}&select=game_id,balance_um`);
      if (ref) {
        await sbUpdate('accounts', `game_id=eq.${ref.game_id}`, { balance_um: (ref.balance_um || 0) + REFERRAL_COMMISSION });
        await sbUpdate('referrals', `referred_gid=eq.${gid}`, {
          commission_um: REFERRAL_COMMISSION, paid: true, activated_at: now,
        });
        await pushNotify(ref.game_id, 'OussoCash', `Parrainage activé · إحالة جديدة · +${REFERRAL_COMMISSION} UM`);
      }
    }
  }

  await sbInsert('csv_uploads', { filename, rows_total: stats.total, rows_activated: stats.activated }).catch(() => {});
  return { ok: true, stats, columns_found: col };
}
