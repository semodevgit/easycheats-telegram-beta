'use strict';
const { rpc } = require('./supabase');
const T = require('./telegram');

// Tüm adminlere bot mesajı gönderir (hata verirse sessizce yutar; ana işlemi bozmaz).
async function notifyAdmins(html, buttons) {
  let ids = [];
  try {
    ids = await rpc('admin_ids');
  } catch (e) {
    return 0;
  }
  if (!Array.isArray(ids)) return 0;
  let sent = 0;
  await Promise.all(ids.map(async (id) => {
    try {
      await T.sendMessage(id, html, buttons ? { reply_markup: { inline_keyboard: buttons } } : {});
      sent++;
    } catch (e) {
      try {
        // Bazı düğmeler (ör. gizlilik kısıtlı tg://user linki) reddedilebilir; düğmesiz tekrar dene.
        await T.sendMessage(id, html);
        sent++;
      } catch (e2) { /* admin botu başlatmamış olabilir */ }
    }
  }));
  return sent;
}

// Kullanıcıya bot üzerinden mesaj (kullanıcı botu hiç başlatmadıysa başarısız olabilir).
async function dmUser(userId, html) {
  try {
    await T.sendMessage(userId, html);
    return true;
  } catch (e) {
    return false;
  }
}

function userChatUrl(u) {
  if (u && u.username) return 'https://t.me/' + u.username;
  return 'tg://user?id=' + (u && u.id);
}

function displayName(u) {
  const n = [u.first_name, u.last_name].filter(Boolean).join(' ').trim();
  return n || (u.username ? '@' + u.username : String(u.id));
}

module.exports = { notifyAdmins, dmUser, userChatUrl, displayName };
