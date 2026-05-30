// api/config.js — إعدادات عامة للواجهة (رقم الدعم، القناة) — لا أسرار
const { sb, json } = require('../lib/core');

module.exports = async (req, res) => {
  try {
    const rows = await sb('settings?select=key,value&key=in.(support_whatsapp,channel_url)');
    const map = {};
    (rows || []).forEach((r) => (map[r.key] = r.value));
    return json(res, 200, {
      support_whatsapp: map.support_whatsapp || '22249002902',
      channel_url: map.channel_url || '',
    });
  } catch (e) {
    return json(res, 200, { support_whatsapp: '22249002902', channel_url: '' });
  }
};
