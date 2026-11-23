'use strict';
const { rpc } = require('./supabase');
const T = require('./telegram');
const { cached } = require('./cache');
const I18N = require('../public/i18n.js');

// ---------- Paylaşılan, kısa süreli önbellekli okumalar ----------
const settings = () => cached('settings', 3000, () => rpc('public_settings').then((s) => s || {}));
const overrides = () => cached('i18n', 5000, () => rpc('public_translations').then((x) => x || {}));

async function isMaintenance() {
  try { return (await settings()).maintenance === true; } catch (e) { return false; }
}

// Kullanıcı satırından (ya da dil kodundan) bot mesajı dili
function langOf(u) {
  return I18N.pick(u && u.lang) || I18N.pick(u && u.language_code) || 'en';
}

async function langById(id) {
  try {
    const l = await cached('ulang:' + id, 30000, () => rpc('user_lang', { p_user_id: id }));
    return I18N.pick(l) || 'en';
  } catch (e) {
    return 'en';
  }
}

// ---------- Tek bildirim ----------
// Her kullanıcının sohbetinde (botla) aynı anda en fazla 1 bildirim mesajı durur:
// yenisi gelince öncekiler silinir. Kullanıcı mini uygulamayı açınca (görüldü) 15 sn sonra silinir.
async function sendNotice(chatId, html, extra) {
  const [takeR, sendR] = await Promise.allSettled([
    rpc('bot_msg_take', { p_chat: chatId, p_kind: 'notice' }),
    T.sendMessage(chatId, html, extra || {}),
  ]);
  const old = takeR.status === 'fulfilled' && Array.isArray(takeR.value) ? takeR.value : [];
  await Promise.all(old.map((id) => T.deleteMessage(chatId, id).catch(() => {})));
  if (sendR.status === 'rejected') throw sendR.reason;
  const mid = sendR.value && sendR.value.message_id;
  if (mid) { try { await rpc('bot_msg_add', { p_chat: chatId, p_msg: mid, p_kind: 'notice' }); } catch (e) { /* yoksay */ } }
  return sendR.value;
}

// Tüm adminlere bildirim (hata verirse sessizce yutar; ana işlemi bozmaz).
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
      await sendNotice(id, html, buttons ? { reply_markup: { inline_keyboard: buttons } } : {});
      sent++;
    } catch (e) {
      try {
        // Bazı düğmeler (ör. gizlilik kısıtlı tg://user linki) reddedilebilir; düğmesiz tekrar dene.
        await sendNotice(id, html);
        sent++;
      } catch (e2) { /* admin botu başlatmamış olabilir */ }
    }
  }));
  return sent;
}

// Kullanıcıya bot mesajı.
//   opts.force: bakım modunda da gönder (yönetici kendi isteğiyle yazıyorsa)
//   opts.keep : tek-bildirim kuralına girmesin, kendiliğinden silinmesin (yönetici mesajı / duyuru)
async function dmUser(userId, html, opts) {
  const o = opts || {};
  if (!o.force && await isMaintenance()) return false; // bakım modunda bildirim yok
  try {
    if (o.keep) await T.sendMessage(userId, html);
    else await sendNotice(userId, html);
    return true;
  } catch (e) {
    return false;
  }
}

// Kullanıcının dilinde sözlükten mesaj gönder. who: kullanıcı satırı (lang/language_code taşıyan) ya da id.
async function dmKey(who, key, params, opts) {
  const id = typeof who === 'object' && who ? who.id : who;
  const lang = typeof who === 'object' && who ? langOf(who) : await langById(who);
  let ov = {};
  try { ov = await overrides(); } catch (e) { /* varsayılanlar */ }
  return dmUser(id, I18N.format(lang, key, params, ov), opts);
}

// Görüldü işaretlenmiş bildirimleri (bot mesajı + uygulama içi) sil; 15 sn dolmamışlara dokunmaz.
async function purgeSeen(userId) {
  const r = await rpc('purge_seen', { p_user_id: userId });
  const ids = (r && r.messages) || [];
  await Promise.all(ids.map((id) => T.deleteMessage(userId, id).catch(() => {})));
  return ids.length;
}

function userChatUrl(u) {
  if (u && u.username) return 'https://t.me/' + u.username;
  return 'tg://user?id=' + (u && u.id);
}

function displayName(u) {
  const n = [u.first_name, u.last_name].filter(Boolean).join(' ').trim();
  return n || (u.username ? '@' + u.username : String(u.id));
}

module.exports = {
  settings, overrides, isMaintenance, langOf, notifyAdmins, dmUser, dmKey, purgeSeen, userChatUrl, displayName,
};
