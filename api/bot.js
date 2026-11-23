'use strict';
const { rpc, DbError } = require('../lib/supabase');
const T = require('../lib/telegram');
const { notifyAdmins, dmKey, purgeSeen, isMaintenance, settings, displayName } = require('../lib/notify');
const I18N = require('../public/i18n.js');

const esc = T.escapeHtml;
const stars = (n) => Number(n).toLocaleString('tr-TR') + ' ⭐';

function send(res, status, obj) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(obj));
}

async function readBody(req) {
  if (req.body !== undefined && req.body !== null) {
    if (typeof req.body === 'string') {
      try { return JSON.parse(req.body); } catch (e) { return null; }
    }
    if (Buffer.isBuffer(req.body)) {
      try { return JSON.parse(req.body.toString('utf8')); } catch (e) { return null; }
    }
    return req.body;
  }
  const chunks = [];
  let size = 0;
  for await (const c of req) {
    size += c.length;
    if (size > 1024 * 1024) return null;
    chunks.push(c);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch (e) { return null; }
}

const webhookSecret = () => (process.env.WEBHOOK_SECRET || '').trim();

// ---------- Kurulum: GET /api/bot?setup=1&key=<WEBHOOK_SECRET> ----------
async function setup(req, res) {
  const url = new URL(req.url || '/', 'http://localhost');
  if (!url.searchParams.get('setup')) return send(res, 200, { ok: true, service: 'easycheats-bot' });

  const secret = webhookSecret();
  if (!secret) return send(res, 500, { ok: false, error: 'WEBHOOK_SECRET ortam değişkeni tanımlı değil.' });
  if (!T.safeEqualStr(url.searchParams.get('key') || '', secret)) return send(res, 401, { ok: false, error: 'Anahtar hatalı.' });
  if (!/^[A-Za-z0-9_-]{1,256}$/.test(secret)) {
    return send(res, 400, { ok: false, error: 'WEBHOOK_SECRET yalnızca harf, rakam, _ ve - içermeli.' });
  }
  const base = T.baseUrl(req);
  if (!base) return send(res, 400, { ok: false, error: 'Site adresi belirlenemedi (APP_URL tanımla).' });

  try {
    await T.tg('setWebhook', {
      url: base + '/api/bot',
      secret_token: secret,
      allowed_updates: ['message', 'pre_checkout_query'],
    });
    await T.tg('setChatMenuButton', { menu_button: { type: 'web_app', text: 'EasyCheats', web_app: { url: base + '/' } } });
    await T.tg('setMyCommands', { commands: [{ command: 'start', description: I18N.format('en', 'bot.cmd') }] });
    for (const l of ['tr', 'ru']) {
      await T.tg('setMyCommands', { commands: [{ command: 'start', description: I18N.format(l, 'bot.cmd') }], language_code: l });
    }
    const info = await T.tg('getWebhookInfo', {});
    const me = await T.getMe();
    return send(res, 200, {
      ok: true,
      bot: '@' + me.username,
      app_url: base,
      webhook_url: info.url,
      pending_updates: info.pending_update_count,
      last_error: info.last_error_message || null,
      next: 'Telegram\'da botu aç, /start yaz ve «Mağazayı aç» düğmesine dokun.',
    });
  } catch (e) {
    return send(res, 500, { ok: false, error: e.message });
  }
}

// ---------- Güncellemeler ----------
async function preCheckout(q) {
  let ok = false;
  let msg = 'Ödeme şu an alınamıyor, lütfen tekrar dene.';
  try {
    if (q.currency === 'XTR' && q.from && q.from.id) {
      const r = await rpc('precheck_deposit', { p_payload: q.invoice_payload, p_user_id: q.from.id, p_amount: q.total_amount });
      if (r && r.ok) ok = true;
      else msg = 'Bu ödeme geçerli değil veya daha önce kullanılmış.';
    }
  } catch (e) {
    console.error('[precheck]', e.message);
  }
  try {
    await T.answerPreCheckout(q.id, ok, msg);
  } catch (e) {
    console.error('[answerPreCheckout]', e.message);
  }
}

async function successfulPayment(m) {
  const sp = m.successful_payment;
  const from = m.from || {};
  if (!sp || sp.currency !== 'XTR' || !from.id) return;

  let r;
  try {
    r = await rpc('credit_deposit', {
      p_payload: sp.invoice_payload,
      p_user_id: from.id,
      p_amount: sp.total_amount,
      p_charge_id: sp.telegram_payment_charge_id,
      p_provider_charge_id: sp.provider_payment_charge_id || null,
    });
  } catch (e) {
    if (e instanceof DbError && (e.message === 'deposit_not_found' || e.message === 'deposit_mismatch')) {
      // Para alındı ama eşleşen kayıt yok: yönetici elle ilgilenmeli.
      await notifyAdmins('⚠️ <b>Eşleşmeyen ödeme</b>\n👤 <code>' + from.id + '</code> · ' + stars(sp.total_amount) +
        '\nCharge: <code>' + esc(sp.telegram_payment_charge_id) + '</code>\nPayload: <code>' + esc(sp.invoice_payload) + '</code>');
      return;
    }
    const err = new Error('credit_failed: ' + e.message);
    err.retry = true; // Telegram aynı güncellemeyi tekrar göndersin
    throw err;
  }

  if (r && r.credited) {
    const name = displayName(from);
    await Promise.all([
      dmKey(from.id, 'dm.deposit_ok', { amt: stars(r.amount), bal: stars(r.balance) }),
      notifyAdmins('💰 <b>Yeni yükleme</b>\n👤 ' + esc(name) + (from.username ? ' (@' + esc(from.username) + ')' : '') + ' · <code>' + from.id + '</code>\n⭐ ' + stars(r.amount)),
    ]);
  }
}

async function onText(m, req) {
  const mm = /^\/start(?:@\w+)?(?:\s+(\S+))?/.exec(String(m.text || '').trim());
  let ref = null;
  if (mm && mm[1]) {
    const r = /^ref_(EASY-[A-Za-z0-9]{6})$/.exec(mm[1]);
    if (r) ref = r[1].toUpperCase();
  }
  let support = 'easycheatsupport';
  let maint = false;
  try {
    const s = await settings();
    if (s && s.support_username) support = s.support_username;
    maint = s && s.maintenance === true;
  } catch (e) { /* varsayılan */ }

  // Kullanıcı bota yazdı = bildirimleri gördü: görüldü işaretle, süresi dolanları sil
  try { await rpc('mark_bot_seen', { p_user_id: m.from.id }); await purgeSeen(m.from.id); } catch (e) { /* yoksay */ }

  const lang = I18N.pick(m.from && m.from.language_code) || 'en';
  const base = T.baseUrl(req);
  if (maint) {
    // Bakım modu: mağaza düğmesi yok, "Bize Ulaş" var
    await T.sendMessage(m.chat.id, I18N.format(lang, 'bot.maint', { support: esc(support) }), {
      reply_markup: { inline_keyboard: [[{ text: I18N.format(lang, 'bot.support'), url: 'https://t.me/' + support }]] },
    });
    return;
  }
  const text = I18N.format(lang, 'bot.welcome', { support: esc(support) });
  const extra = base
    ? { reply_markup: { inline_keyboard: [[{ text: I18N.format(lang, 'bot.open'), web_app: { url: base + '/' + (ref ? '?ref=' + encodeURIComponent(ref) : '') } }]] } }
    : {};
  await T.sendMessage(m.chat.id, text, extra);
}

async function handleUpdate(u, req) {
  if (!u || typeof u !== 'object') return;
  if (u.pre_checkout_query) return preCheckout(u.pre_checkout_query);
  const m = u.message;
  if (!m) return;
  if (m.successful_payment) return successfulPayment(m);
  if (m.text && m.chat && m.chat.type === 'private') return onText(m, req);
}

module.exports = async function handler(req, res) {
  if (req.method === 'GET') return setup(req, res);
  if (req.method !== 'POST') return send(res, 405, { ok: false });

  const secret = webhookSecret();
  if (!secret) return send(res, 500, { ok: false, error: 'WEBHOOK_SECRET tanımlı değil' });
  const got = req.headers['x-telegram-bot-api-secret-token'];
  if (!got || !T.safeEqualStr(got, secret)) return send(res, 401, { ok: false });

  const update = await readBody(req);
  try {
    await handleUpdate(update, req);
    return send(res, 200, { ok: true });
  } catch (e) {
    console.error('[bot]', e && e.message);
    if (e && e.retry) return send(res, 500, { ok: false });
    return send(res, 200, { ok: true });
  }
};

module.exports._handleUpdate = handleUpdate;
