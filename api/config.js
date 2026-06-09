// api/config.js — Paramètres publics pour le front (aucun secret)
// إعدادات عامة للواجهة — لا أسرار
const { sb, json, ONESIGNAL_APP_ID } = require('../lib/core');

module.exports = async (req, res) => {
  try {
    const rows = await sb('settings?select=key,value&key=in.(support_whatsapp,channel_url,coupon_today,coupon_tomorrow,coupon_yesterday)');
    const map = {};
    (rows || []).forEach((r) => (map[r.key] = r.value));
    return json(res, 200, {
      support_whatsapp: map.support_whatsapp || '22232230404',
      channel_url: map.channel_url || '',
      onesignal_app_id: ONESIGNAL_APP_ID || '',
      sport_enabled: !!process.env.FOOTBALL_API_KEY,
      coupons: {
        today: map.coupon_today || '',
        tomorrow: map.coupon_tomorrow || '',
        yesterday: map.coupon_yesterday || '',
      },
    });
  } catch {
    return json(res, 200, { support_whatsapp: '22232230404', channel_url: '', onesignal_app_id: ONESIGNAL_APP_ID || '', sport_enabled: !!process.env.FOOTBALL_API_KEY, coupons: { today:'', tomorrow:'', yesterday:'' } });
  }
};
