'use strict';
const { rpc, DbError } = require('./supabase');
const T = require('./telegram');
const { notifyAdmins, dmUser, userChatUrl, displayName } = require('./notify');

// ---------- Hatalar ----------
class OpError extends Error {
  constructor(code, message, status) {
    super(message || code);
    this.name = 'OpError';
    this.code = code;
    this.status = status || 400;
  }
}

// Veritabanındaki `raise exception '<kod>'` değerleri -> kullanıcıya gösterilecek mesaj
const DB_MESSAGES = {
  insufficient_balance: ['Bakiyen yetersiz.', 402],
  user_banned: ['Hesabın kısıtlanmış. Destek ile iletişime geç.', 403],
  user_not_found: ['Kullanıcı bulunamadı.', 404],
  tariff_not_found: ['Bu tarife artık mevcut değil.', 404],
  promo_invalid: ['Promosyon kodu geçersiz veya süresi dolmuş.', 400],
  promo_used: ['Bu kodu zaten kullandın.', 400],
  invalid_amount: ['Geçersiz tutar.', 400],
  too_many_requests: ['Çok fazla deneme yaptın, biraz bekleyip tekrar dene.', 429],
  order_not_found: ['Sipariş bulunamadı.', 404],
  order_not_pending: ['Bu sipariş artık bekleyen durumda değil.', 409],
  order_already_refunded: ['Bu sipariş zaten iade edilmiş.', 409],
  deposit_not_found: ['Yükleme kaydı bulunamadı.', 404],
  deposit_not_refundable: ['Bu yükleme iade edilemez.', 409],
  cannot_ban_admin: ['Yöneticiler engellenemez.', 400],
  invalid_name: ['Ürün adı boş olamaz (en fazla 80 karakter).', 400],
  invalid_image_url: ['Görsel adresi https:// ile başlamalı.', 400],
  invalid_price: ['Fiyat 0\'dan büyük olmalı.', 400],
  invalid_label: ['Tarife adı boş olamaz.', 400],
  product_required: ['Ürün seçilmedi.', 400],
  product_not_found: ['Ürün bulunamadı.', 404],
  tariff_not_found_admin: ['Tarife bulunamadı.', 404],
  invalid_code: ['Kod 3-32 karakter olmalı (A-Z, 0-9, _ ve -).', 400],
  invalid_kind: ['Geçersiz indirim türü.', 400],
  invalid_value: ['İndirim değeri geçersiz (yüzde için 1-100).', 400],
  invalid_max_uses: ['Toplam kullanım en az 1 olmalı.', 400],
  invalid_per_user_limit: ['Kişi başı limit en az 1 olmalı.', 400],
  invalid_setting: ['Ayar değeri geçersiz (en az tutar, en çok tutardan büyük olamaz).', 400],
};

const AUTH_MESSAGES = {
  bad_init_data: ['Oturum doğrulanamadı. Uygulamayı Telegram içinden yeniden aç.', 401],
  bad_signature: ['Oturum doğrulanamadı. Uygulamayı Telegram içinden yeniden aç.', 401],
  session_expired: ['Oturum süresi doldu. Uygulamayı kapatıp yeniden aç.', 401],
  server_not_configured: ['Sunucu ayarları eksik (BOT_TOKEN).', 500],
};

function mapError(e) {
  if (e instanceof OpError) return e;
  if (e instanceof T.AuthError) {
    const m = AUTH_MESSAGES[e.code] || AUTH_MESSAGES.bad_init_data;
    return new OpError(e.code, m[0], m[1]);
  }
  if (e instanceof DbError) {
    if (e.code === 'config' || e.message === 'server_not_configured') {
      return new OpError('server_not_configured', 'Sunucu ayarları eksik (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).', 500);
    }
    const m = DB_MESSAGES[e.message];
    if (m) return new OpError(e.message, m[0], m[1]);
    console.error('[db]', e.status, e.code, e.message);
    return new OpError('db_error', 'Veritabanı hatası, lütfen tekrar dene.', 502);
  }
  console.error('[unexpected]', e);
  return new OpError('internal', 'Beklenmeyen bir hata oluştu.', 500);
}

// ---------- Doğrulama yardımcıları ----------
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function invalid(name) {
  return new OpError('invalid_' + name, 'Geçersiz değer: ' + name, 400);
}
function toInt(v, name, min, max) {
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v;
  if (typeof n !== 'number' || !Number.isInteger(n) || n < min || n > max) throw invalid(name);
  return n;
}
function toUuid(v, name) {
  if (typeof v !== 'string' || !UUID_RE.test(v)) throw invalid(name);
  return v.toLowerCase();
}
function toStr(v, name, max, required) {
  if (v == null) v = '';
  if (typeof v !== 'string') throw invalid(name);
  const s = v.trim();
  if (required && !s) throw invalid(name);
  if (s.length > max) throw invalid(name);
  return s;
}
function toBool(v, name) {
  if (typeof v !== 'boolean') throw invalid(name);
  return v;
}
const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const stars = (n) => Number(n).toLocaleString('tr-TR') + ' ⭐';
const esc = T.escapeHtml;

// ---------- Basit hız sınırı (örnek başına) ----------
const buckets = new Map();
function rateLimit(userId, isAdmin) {
  const now = Date.now();
  const limit = isAdmin ? 240 : 90;
  let b = buckets.get(userId);
  if (!b || now > b.reset) {
    b = { n: 0, reset: now + 60000 };
    buckets.set(userId, b);
    if (buckets.size > 5000) {
      for (const [k, v] of buckets) if (now > v.reset) buckets.delete(k);
    }
  }
  b.n++;
  if (b.n > limit) throw new OpError('rate_limited', 'Çok hızlı işlem yapıyorsun, biraz bekle.', 429);
}

// ---------- Ortak ----------
function adminUsername() {
  return (process.env.ADMIN_USERNAME || 'easycheatsupport').replace(/^@/, '');
}

let botCache = null;
async function botInfo() {
  if (botCache) return botCache;
  try {
    const me = await T.getMe();
    botCache = { username: me.username || null };
  } catch (e) {
    return { username: null };
  }
  return botCache;
}

function inviteLink(bot, code) {
  if (!bot || !bot.username) return null;
  const short = (process.env.TG_APP_SHORT || '').trim();
  if (short) return 'https://t.me/' + bot.username + '/' + short + '?startapp=ref_' + code;
  return 'https://t.me/' + bot.username + '?start=ref_' + code;
}

function cleanRef(v) {
  if (typeof v !== 'string') return null;
  const m = /^(?:ref_)?(EASY-[A-Z0-9]{6})$/i.exec(v.trim());
  return m ? m[1].toUpperCase() : null;
}

function cut(s, n) {
  return s == null ? null : String(s).slice(0, n);
}

async function settings() {
  return (await rpc('public_settings')) || {};
}

async function assertOpen(user) {
  if (user.is_admin) return;
  const s = await settings();
  if (s.maintenance === true) throw new OpError('maintenance', 'Mağaza bakımda, kısa süre sonra tekrar dene.', 503);
}

// ---------- Kullanıcı işlemleri ----------
const USER_OPS = {
  async boot(ctx) {
    if (ctx.user.is_banned) return { banned: true, reason: ctx.user.ban_reason || null };
    const data = await rpc('app_boot', { p_user_id: ctx.user.id });
    const bot = await botInfo();
    return Object.assign({}, data, {
      bot: { username: bot.username },
      invite_link: inviteLink(bot, ctx.user.referral_code),
    });
  },

  async refresh(ctx) {
    return { me: await rpc('me_bundle', { p_user_id: ctx.user.id }) };
  },

  async quote(ctx) {
    const tariffId = toUuid(ctx.body.tariff_id, 'tariff_id');
    const code = toStr(ctx.body.code, 'code', 32, false);
    return await rpc('quote_price', { p_user_id: ctx.user.id, p_tariff_id: tariffId, p_code: code || null });
  },

  async order(ctx) {
    await assertOpen(ctx.user);
    const tariffId = toUuid(ctx.body.tariff_id, 'tariff_id');
    const code = toStr(ctx.body.code, 'code', 32, false);
    const order = await rpc('create_order', { p_user_id: ctx.user.id, p_tariff_id: tariffId, p_code: code || null });
    const me = await rpc('me_bundle', { p_user_id: ctx.user.id });

    // Bildirimler (en iyi çaba — sipariş zaten kaydedildi)
    const base = T.baseUrl(ctx.req);
    const buttons = [[{ text: '💬 Kullanıcıya yaz', url: userChatUrl(ctx.user) }]];
    if (base) buttons.push([{ text: '⚙️ Yönetici paneli', web_app: { url: base + '/#admin' } }]);
    const lines = [
      '🛒 <b>Yeni sipariş #' + order.id + '</b>',
      esc(order.product_name) + ' · ' + esc(order.tariff_label),
      '💰 ' + stars(order.price) + (order.promo_code ? ' (kod: ' + esc(order.promo_code) + ')' : ''),
      '👤 ' + esc(displayName(ctx.user)) + (ctx.user.username ? ' (@' + esc(ctx.user.username) + ')' : '') + ' · <code>' + ctx.user.id + '</code>',
    ];
    let notice = '';
    try { notice = (await settings()).order_notice || ''; } catch (e) { /* yoksay */ }
    await Promise.all([
      notifyAdmins(lines.join('\n'), buttons),
      dmUser(ctx.user.id, '🛒 <b>Siparişin alındı</b>\n#' + order.id + ' · ' + esc(order.product_name) + ' · ' + esc(order.tariff_label) +
        (notice ? '\n\n' + esc(notice) : '')),
    ]);
    return { order, me };
  },

  async invoice(ctx) {
    await assertOpen(ctx.user);
    const amount = toInt(ctx.body.amount, 'amount', 1, 1000000);
    const d = await rpc('create_deposit', { p_user_id: ctx.user.id, p_amount: amount });
    let url;
    try {
      url = await T.createStarsInvoice({
        title: 'Bakiye yükleme',
        description: amount + ' yıldız bakiyene eklenecek.',
        payload: d.invoice_payload,
        label: 'Bakiye',
        amount,
      });
    } catch (e) {
      console.error('[invoice]', e.message);
      throw new OpError('invoice_failed', 'Ödeme bağlantısı oluşturulamadı, tekrar dene.', 502);
    }
    return { url, deposit_id: d.id, amount };
  },

  async deposit_status(ctx) {
    const id = toUuid(ctx.body.id, 'id');
    const r = await rpc('deposit_status', { p_user_id: ctx.user.id, p_deposit_id: id });
    if (!r) throw new OpError('deposit_not_found', DB_MESSAGES.deposit_not_found[0], 404);
    return r;
  },

  async notifications_read(ctx) {
    await rpc('mark_notifications_read', { p_user_id: ctx.user.id });
    return { ok: true };
  },
};

// ---------- Yönetici işlemleri ----------
function pickProduct(src) {
  if (!src || typeof src !== 'object') throw invalid('product');
  const o = {};
  if (has(src, 'id') && src.id) o.id = toUuid(src.id, 'id');
  if (has(src, 'name')) o.name = toStr(src.name, 'name', 80, !o.id);
  if (has(src, 'description')) o.description = toStr(src.description, 'description', 600, false);
  if (has(src, 'image_url')) o.image_url = toStr(src.image_url, 'image_url', 500, false) || null;
  if (has(src, 'game')) o.game = toStr(src.game, 'game', 80, false) || null;
  if (has(src, 'is_active')) o.is_active = toBool(src.is_active, 'is_active');
  if (has(src, 'sort_order')) o.sort_order = toInt(src.sort_order, 'sort_order', -1000, 1000);
  return o;
}

function pickTariff(src) {
  if (!src || typeof src !== 'object') throw invalid('tariff');
  const o = {};
  if (has(src, 'id') && src.id) o.id = toUuid(src.id, 'id');
  if (has(src, 'product_id') && src.product_id) o.product_id = toUuid(src.product_id, 'product_id');
  if (has(src, 'label')) o.label = toStr(src.label, 'label', 40, !o.id);
  if (has(src, 'days')) o.days = src.days === null || src.days === '' ? null : toInt(src.days, 'days', 1, 36500);
  if (has(src, 'price')) o.price = toInt(src.price, 'price', 1, 10000000);
  if (has(src, 'tag')) o.tag = toStr(src.tag, 'tag', 20, false) || null;
  if (has(src, 'is_active')) o.is_active = toBool(src.is_active, 'is_active');
  if (has(src, 'sort_order')) o.sort_order = toInt(src.sort_order, 'sort_order', -1000, 1000);
  return o;
}

function pickPromo(src) {
  if (!src || typeof src !== 'object') throw invalid('promo');
  const o = {
    code: toStr(src.code, 'code', 32, true).toUpperCase(),
    kind: src.kind === 'fixed' ? 'fixed' : 'percent',
    value: toInt(src.value, 'value', 1, 10000000),
    per_user_limit: src.per_user_limit == null || src.per_user_limit === '' ? 1 : toInt(src.per_user_limit, 'per_user_limit', 1, 1000),
    max_uses: src.max_uses == null || src.max_uses === '' ? null : toInt(src.max_uses, 'max_uses', 1, 10000000),
    expires_at: null,
    product_id: src.product_id ? toUuid(src.product_id, 'product_id') : null,
    is_active: has(src, 'is_active') ? toBool(src.is_active, 'is_active') : true,
  };
  if (src.expires_at) {
    const t = Date.parse(src.expires_at);
    if (!Number.isFinite(t)) throw invalid('expires_at');
    o.expires_at = new Date(t).toISOString();
  }
  return o;
}

function pickSettings(src) {
  if (!src || typeof src !== 'object') throw invalid('settings');
  const o = {};
  if (has(src, 'maintenance')) o.maintenance = toBool(src.maintenance, 'maintenance');
  if (has(src, 'deposit_min')) o.deposit_min = toInt(src.deposit_min, 'deposit_min', 1, 1000000);
  if (has(src, 'deposit_max')) o.deposit_max = toInt(src.deposit_max, 'deposit_max', 1, 1000000);
  if (has(src, 'referral_rate_percent')) o.referral_rate_percent = toInt(src.referral_rate_percent, 'referral_rate_percent', 0, 90);
  if (has(src, 'deposit_presets')) {
    if (!Array.isArray(src.deposit_presets) || src.deposit_presets.length < 1 || src.deposit_presets.length > 12) throw invalid('deposit_presets');
    o.deposit_presets = src.deposit_presets.map((n) => toInt(n, 'deposit_presets', 1, 1000000));
  }
  if (has(src, 'support_username')) o.support_username = toStr(src.support_username, 'support_username', 32, true).replace(/^@/, '');
  if (has(src, 'order_notice')) o.order_notice = toStr(src.order_notice, 'order_notice', 300, false);
  return o;
}

const OFFSET = (b) => (b.offset == null ? 0 : toInt(b.offset, 'offset', 0, 10000000));
const FILTER = (v, allowed) => (typeof v === 'string' && allowed.includes(v) ? v : null);

const ADMIN_OPS = {
  'admin.stats': () => rpc('admin_stats'),

  'admin.orders': (c) => rpc('admin_orders', {
    p_status: FILTER(c.body.status, ['pending', 'completed', 'refunded']),
    p_search: toStr(c.body.q, 'q', 60, false) || null,
    p_limit: 20,
    p_offset: OFFSET(c.body),
  }),

  async 'admin.order_complete'(c) {
    const id = toInt(c.body.id, 'id', 1, 2147483647);
    const note = toStr(c.body.note, 'note', 500, false);
    const key = toStr(c.body.license_key, 'license_key', 500, false);
    const o = await rpc('complete_order', { p_order_id: id, p_admin_id: c.user.id, p_note: note || null, p_license_key: key || null });
    const lines = ['✅ <b>Siparişin tamamlandı</b>', '#' + o.id + ' · ' + esc(o.product_name) + ' · ' + esc(o.tariff_label)];
    if (o.license_key) lines.push('', '🔑 <code>' + esc(o.license_key) + '</code>');
    if (o.admin_note) lines.push('', esc(o.admin_note));
    lines.push('', 'Detaylar için mağazadaki «Satın Alımlarım» bölümüne bak.');
    const dm = await dmUser(o.user_id, lines.join('\n'));
    return { order: o, dm };
  },

  async 'admin.order_refund'(c) {
    const id = toInt(c.body.id, 'id', 1, 2147483647);
    const reason = toStr(c.body.reason, 'reason', 500, false);
    const o = await rpc('refund_order', { p_order_id: id, p_admin_id: c.user.id, p_reason: reason || null });
    const lines = ['↩️ <b>Siparişin iade edildi</b>', '#' + o.id + ' · ' + esc(o.product_name) + ' · ' + esc(o.tariff_label),
      '💰 ' + stars(o.price) + ' bakiyene geri yüklendi.'];
    if (reason) lines.push('', esc(reason));
    const dm = await dmUser(o.user_id, lines.join('\n'));
    return { order: o, dm };
  },

  'admin.users': (c) => rpc('admin_users', {
    p_search: toStr(c.body.q, 'q', 60, false) || null, p_limit: 20, p_offset: OFFSET(c.body),
  }),

  async 'admin.user'(c) {
    const r = await rpc('admin_user_detail', { p_user_id: toInt(c.body.id, 'id', 1, Number.MAX_SAFE_INTEGER) });
    if (!r) throw new OpError('user_not_found', DB_MESSAGES.user_not_found[0], 404);
    return r;
  },

  async 'admin.user_ban'(c) {
    const id = toInt(c.body.id, 'id', 1, Number.MAX_SAFE_INTEGER);
    const banned = toBool(c.body.banned, 'banned');
    const reason = toStr(c.body.reason, 'reason', 200, false);
    await rpc('admin_set_ban', { p_user_id: id, p_banned: banned, p_reason: reason || null, p_admin_id: c.user.id });
    return { banned };
  },

  async 'admin.user_adjust'(c) {
    const id = toInt(c.body.id, 'id', 1, Number.MAX_SAFE_INTEGER);
    const amount = toInt(c.body.amount, 'amount', -10000000, 10000000);
    if (amount === 0) throw new OpError('invalid_amount', DB_MESSAGES.invalid_amount[0], 400);
    const reason = toStr(c.body.reason, 'reason', 200, false);
    const balance = await rpc('admin_adjust_balance', { p_user_id: id, p_amount: amount, p_admin_id: c.user.id, p_reason: reason || null });
    await dmUser(id, (amount > 0 ? '💰 Bakiyene <b>' + stars(amount) + '</b> eklendi.' : '💸 Bakiyenden <b>' + stars(-amount) + '</b> düşüldü.') +
      (reason ? '\n' + esc(reason) : '') + '\nYeni bakiyen: ' + stars(balance));
    return { balance };
  },

  async 'admin.message'(c) {
    const id = toInt(c.body.user_id, 'user_id', 1, Number.MAX_SAFE_INTEGER);
    const text = toStr(c.body.text, 'text', 1000, true);
    try {
      await T.sendMessage(id, esc(text));
    } catch (e) {
      throw new OpError('send_failed', 'Mesaj gönderilemedi (kullanıcı botu başlatmamış veya engellemiş olabilir).', 502);
    }
    await rpc('log_admin_action', { p_admin_id: c.user.id, p_action: 'message_sent', p_target_type: 'user', p_target_id: String(id), p_details: { length: text.length } });
    return { sent: true };
  },

  'admin.deposits': (c) => rpc('admin_deposits', {
    p_status: FILTER(c.body.status, ['created', 'paid', 'refunded', 'failed']),
    p_search: toStr(c.body.q, 'q', 80, false) || null,
    p_limit: 20,
    p_offset: OFFSET(c.body),
  }),

  async 'admin.deposit_refund'(c) {
    const id = toUuid(c.body.id, 'id');
    const dep = await rpc('mark_deposit_refunded', { p_deposit_id: id, p_admin_id: c.user.id });
    try {
      await T.refundStarPayment(dep.user_id, dep.telegram_payment_charge_id);
    } catch (e) {
      try {
        await rpc('revert_deposit_refund', { p_deposit_id: id, p_admin_id: c.user.id });
      } catch (e2) {
        console.error('[refund-revert-failed]', id, e2.message);
      }
      throw new OpError('refund_failed', 'Telegram iadeyi kabul etmedi: ' + cut(e.message, 120), 502);
    }
    await dmUser(dep.user_id, '↩️ <b>Yıldız yüklemen iade edildi</b>\n' + stars(dep.amount) + ' Telegram hesabına geri gönderildi.');
    return { deposit: dep };
  },

  'admin.products': () => rpc('admin_products'),
  'admin.product_save': (c) => rpc('admin_save_product', { p: pickProduct(c.body.product), p_admin_id: c.user.id }),
  'admin.tariff_save': (c) => rpc('admin_save_tariff', { p: pickTariff(c.body.tariff), p_admin_id: c.user.id }),
  'admin.promos': () => rpc('admin_promos'),
  'admin.promo_save': (c) => rpc('admin_save_promo', { p: pickPromo(c.body.promo), p_admin_id: c.user.id }),
  'admin.settings': () => settings(),
  'admin.settings_save': (c) => rpc('admin_save_settings', { p: pickSettings(c.body.settings), p_admin_id: c.user.id }),
  'admin.audit': (c) => rpc('admin_audit', { p_limit: 40, p_offset: OFFSET(c.body) }),

  // Toplu duyuru: istemci parça parça (offset ile) çağırır.
  async 'admin.broadcast'(c) {
    const text = toStr(c.body.text, 'text', 1000, true);
    const offset = OFFSET(c.body);
    const batch = await rpc('admin_broadcast_targets', { p_offset: offset, p_limit: 25 });
    const ids = (batch && batch.ids) || [];
    let sent = 0;
    let failed = 0;
    for (let i = 0; i < ids.length; i += 5) {
      const part = ids.slice(i, i + 5);
      const results = await Promise.all(part.map((id) => dmUser(id, esc(text))));
      results.forEach((ok) => (ok ? sent++ : failed++));
    }
    if (offset === 0) {
      await rpc('log_admin_action', { p_admin_id: c.user.id, p_action: 'broadcast', p_target_type: 'all', p_target_id: null, p_details: { length: text.length, total: batch.total } });
    }
    const next = offset + ids.length;
    return { sent, failed, total: batch.total, next_offset: next, done: ids.length === 0 || next >= batch.total };
  },
};

// ---------- Giriş noktası ----------
function bearer(req) {
  const h = (req.headers && (req.headers.authorization || req.headers.Authorization)) || '';
  const m = /^tma\s+(.+)$/i.exec(String(h));
  return m ? m[1] : null;
}

async function handle(op, body, req) {
  if (typeof op !== 'string') throw new OpError('unknown_op', 'Bilinmeyen istek.', 400);

  if (op === 'info') {
    const bot = await botInfo();
    return { bot_username: bot.username };
  }

  const fn = USER_OPS[op] || ADMIN_OPS[op];
  if (!fn) throw new OpError('unknown_op', 'Bilinmeyen istek.', 400);

  const v = T.validateInitData(bearer(req) || body.init, T.token());
  const tu = v.user;
  const ref = op === 'boot' ? cleanRef(v.startParam) || cleanRef(body.ref) : null;
  const user = await rpc('upsert_telegram_user', {
    p_id: tu.id,
    p_username: cut(tu.username, 64),
    p_first_name: cut(tu.first_name, 128),
    p_last_name: cut(tu.last_name, 128),
    p_photo_url: cut(tu.photo_url, 500),
    p_language_code: cut(tu.language_code, 16),
    p_ref_code: ref,
    p_admin_username: adminUsername(),
  });
  if (!user) throw new OpError('internal', 'Beklenmeyen bir hata oluştu.', 500);

  rateLimit(user.id, user.is_admin);

  if (op.startsWith('admin.') && !user.is_admin) throw new OpError('forbidden', 'Bu işlem için yetkin yok.', 403);
  if (user.is_banned && op !== 'boot') throw new OpError('user_banned', DB_MESSAGES.user_banned[0], 403);

  return fn({ user, body: body || {}, req });
}

module.exports = {
  handle, mapError, OpError,
  _test: { cleanRef, inviteLink, buckets, pickPromo, pickSettings, pickTariff, pickProduct, resetBot() { botCache = null; } },
};
