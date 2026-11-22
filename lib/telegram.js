'use strict';
const crypto = require('node:crypto');

// ---------- Telegram Mini App initData doğrulaması ----------
class AuthError extends Error {
  constructor(code, message) {
    super(message || code);
    this.name = 'AuthError';
    this.code = code;
  }
}

function safeEqualHex(a, b) {
  try {
    const x = Buffer.from(String(a), 'hex');
    const y = Buffer.from(String(b), 'hex');
    return x.length === y.length && x.length > 0 && crypto.timingSafeEqual(x, y);
  } catch (e) {
    return false;
  }
}

function safeEqualStr(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

/**
 * initData'yı bot token'ı ile doğrular.
 * opts.maxAgeSec: izin verilen en büyük yaş (varsayılan 24 saat)
 * opts.now: test için "şimdi" (saniye)
 */
function validateInitData(raw, botToken, opts) {
  const o = opts || {};
  const maxAge = o.maxAgeSec == null ? 86400 : o.maxAgeSec;
  const now = o.now == null ? Math.floor(Date.now() / 1000) : o.now;

  if (!botToken) throw new AuthError('server_not_configured');
  if (!raw || typeof raw !== 'string' || raw.length > 8192) throw new AuthError('bad_init_data');

  const params = new URLSearchParams(raw);
  const hash = params.get('hash');
  if (!hash) throw new AuthError('bad_init_data');

  const pairs = [];
  params.forEach((v, k) => { if (k !== 'hash') pairs.push([k, v]); });
  pairs.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));

  const build = (withoutSignature) =>
    pairs.filter((p) => !(withoutSignature && p[0] === 'signature')).map((p) => p[0] + '=' + p[1]).join('\n');

  const secret = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const calc = (s) => crypto.createHmac('sha256', secret).update(s).digest('hex');
  // Telegram'ın "signature" alanı eklendi; hangi biçimde imzalandığından bağımsız çalışsın diye ikisi de denenir.
  const ok = safeEqualHex(calc(build(false)), hash) || safeEqualHex(calc(build(true)), hash);
  if (!ok) throw new AuthError('bad_signature');

  const authDate = parseInt(params.get('auth_date'), 10);
  if (!authDate || authDate - now > 300) throw new AuthError('bad_init_data');
  if (now - authDate > maxAge) throw new AuthError('session_expired');

  let user = null;
  try { user = JSON.parse(params.get('user') || 'null'); } catch (e) { user = null; }
  if (!user || typeof user.id !== 'number' || !Number.isSafeInteger(user.id) || user.id <= 0) {
    throw new AuthError('bad_init_data');
  }
  return { user, authDate, startParam: params.get('start_param') || null };
}

// ---------- Bot API ----------
function token() {
  return (process.env.BOT_TOKEN || '').trim();
}

async function tg(method, payload) {
  const t = token();
  if (!t) {
    const e = new Error('bot_not_configured');
    e.code = 'bot_not_configured';
    throw e;
  }
  let res;
  try {
    res = await fetch('https://api.telegram.org/bot' + t + '/' + method, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload || {}),
      signal: AbortSignal.timeout(9000),
    });
  } catch (err) {
    const e = new Error('telegram_unreachable');
    e.code = 'telegram_unreachable';
    throw e;
  }
  let data = null;
  try { data = await res.json(); } catch (err) { data = null; }
  if (!data || !data.ok) {
    const e = new Error((data && data.description) || 'telegram_' + res.status);
    e.code = 'telegram_error';
    e.tgCode = data && data.error_code;
    throw e;
  }
  return data.result;
}

function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

let meCache = null;
async function getMe() {
  if (meCache) return meCache;
  meCache = await tg('getMe', {});
  return meCache;
}

function sendMessage(chatId, text, extra) {
  return tg('sendMessage', Object.assign({
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
    disable_web_page_preview: true,
  }, extra || {}));
}

function createStarsInvoice(opts) {
  return tg('createInvoiceLink', {
    title: opts.title,
    description: opts.description,
    payload: opts.payload,
    currency: 'XTR',
    prices: [{ label: opts.label || opts.title, amount: opts.amount }],
  });
}

function answerPreCheckout(id, ok, errorMessage) {
  const body = { pre_checkout_query_id: id, ok: !!ok };
  if (!ok) body.error_message = errorMessage || 'Ödeme şu an alınamıyor, lütfen tekrar dene.';
  return tg('answerPreCheckoutQuery', body);
}

function refundStarPayment(userId, chargeId) {
  return tg('refundStarPayment', { user_id: userId, telegram_payment_charge_id: chargeId });
}

function baseUrl(req) {
  const env = (process.env.APP_URL || '').trim().replace(/\/+$/, '');
  if (env) return env;
  const h = (req && req.headers) || {};
  const host = h['x-forwarded-host'] || h.host || '';
  return host ? 'https://' + String(host).split(',')[0].trim() : '';
}

module.exports = {
  AuthError, validateInitData, safeEqualStr, tg, getMe, sendMessage, createStarsInvoice,
  answerPreCheckout, refundStarPayment, escapeHtml, baseUrl, token,
  _resetMeCache() { meCache = null; },
};
