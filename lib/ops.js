'use strict';
const crypto = require('node:crypto');
const { rpc, DbError } = require('./supabase');
const T = require('./telegram');
const { cached, bust } = require('./cache');
const I18N = require('../public/i18n.js');
const { settings, overrides, notifyAdmins, dmUser, dmKey, purgeSeen, userChatUrl, displayName } = require('./notify');

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
  cannot_demote_self: ['Kendi yöneticiliğini kaldıramazsın.', 400],
  last_admin: ['Son yöneticinin yetkisi alınamaz.', 400],
  invalid_name: ['Ürün adı boş olamaz (en fazla 80 karakter).', 400],
  invalid_image_url: ['Görsel adresi https:// ile başlamalı.', 400],
  invalid_price: ['Fiyat 0\'dan büyük olmalı.', 400],
  invalid_label: ['Tarife adı boş olamaz.', 400],
  product_required: ['Ürün seçilmedi.', 400],
  product_not_found: ['Ürün bulunamadı.', 404],
  tariff_not_found_admin: ['Tarife bulunamadı.', 404],
  invalid_code: ['Kod 3-32 karakter olmalı (A-Z, 0-9, _ ve -).', 400],
  invalid_kind: ['Geçersiz indirim türü.', 400],
  invalid_value: ['Değer geçersiz.', 400],
  invalid_max_uses: ['Toplam kullanım en az 1 olmalı.', 400],
  invalid_per_user_limit: ['Kişi başı limit en az 1 olmalı.', 400],
  invalid_setting: ['Ayar değeri geçersiz (en az tutar, en çok tutardan büyük olamaz).', 400],
  invalid_lang: ['Geçersiz dil.', 400],
  invalid_key: ['Anahtar yalnızca harf, rakam, nokta, _ ve - içerebilir (en fazla 80).', 400],
  invalid_table: ['Bu tablo yönetilemez.', 400],
  invalid_column: ['Geçersiz alan.', 400],
  invalid_data: ['Geçersiz veri.', 400],
  row_not_found: ['Kayıt bulunamadı.', 404],
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
    if (/violates foreign key/i.test(e.message)) return new OpError('in_use', 'Bu kayıt başka kayıtlarla ilişkili, silinemez.', 409);
    if (/duplicate key/i.test(e.message)) return new OpError('duplicate', 'Bu kayıt zaten var.', 409);
    if (/violates (check|not-null)/i.test(e.message)) return new OpError('invalid_data', 'Girilen değer geçersiz veya eksik.', 400);
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
const md5 = (x) => crypto.createHash('md5').update(JSON.stringify(x == null ? null : x)).digest('hex').slice(0, 12);

// ---------- Basit hız sınırı (örnek başına) ----------
const buckets = new Map();
function rateLimit(userId, isAdmin) {
  const now = Date.now();
  const limit = isAdmin ? 400 : 120;
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

const catalog = () => cached('catalog', 3000, () => rpc('app_catalog'));

async function assertOpen(user) {
  if (user.is_admin) return;
  const s = await settings();
  if (s.maintenance === true) throw new OpError('maintenance', 'Mağaza bakımda, kısa süre sonra tekrar dene.', 503);
}

// ---------- Kullanıcı işlemleri ----------
const USER_OPS = {
  async boot(ctx) {
    if (ctx.user.is_banned) return { banned: true, reason: ctx.user.ban_reason || null };
    // Veritabanı ve bot bilgisi aynı anda
    const [data, bot] = await Promise.all([rpc('app_boot', { p_user_id: ctx.user.id }), botInfo()]);
    return Object.assign({}, data, {
      bot: { username: bot.username },
      invite_link: inviteLink(bot, ctx.user.referral_code),
      ch: md5(data.catalog),
      ih: md5(data.i18n),
    });
  },

  // 3 sn'de bir çağrılır: bakiye/sipariş/bildirim + ayarlar; katalog ve çeviriler yalnızca değiştiyse gelir.
  async refresh(ctx) {
    const [me, s, cat, tr] = await Promise.all([
      rpc('me_bundle', { p_user_id: ctx.user.id }), settings(), catalog(), overrides(),
    ]);
    const ch = md5(cat), ih = md5(tr);
    const out = { me, settings: s, ch, ih };
    if (ctx.body.ch !== ch) out.catalog = cat;
    if (ctx.body.ih !== ih) out.i18n = tr;
    return out;
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
    if (base) buttons.push([{ text: '⚙️ Yönetici Sayfası', web_app: { url: base + '/#admin' } }]);
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
      dmKey(ctx.user, 'dm.order_received', {
        id: order.id, product: esc(order.product_name), tariff: esc(order.tariff_label), notice: notice ? '\n\n' + esc(notice) : '',
      }),
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
        title: 'EasyCheats · ' + I18N.format(require('./notify').langOf(ctx.user), 'p.stars'),
        description: amount + ' ⭐',
        payload: d.invoice_payload,
        label: 'Stars',
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

  // Kullanıcı uygulamayı (tekrar) açtı/öne getirdi: bot sohbetindeki bildirimler "görüldü" sayılır.
  async seen(ctx) {
    await rpc('mark_bot_seen', { p_user_id: ctx.user.id });
    return { ok: true, purge_in: 15 };
  },

  // Görüldü işaretlenenlerden 15 sn'yi dolduranları sil (bot mesajı + uygulama içi bildirim).
  async purge(ctx) {
    return { removed: await purgeSeen(ctx.user.id) };
  },

  async set_lang(ctx) {
    const l = ctx.body.lang === '' || ctx.body.lang == null ? '' : toStr(ctx.body.lang, 'lang', 5, true);
    if (l && I18N.SUPPORTED.indexOf(l) < 0) throw invalid('lang');
    await rpc('set_user_lang', { p_user_id: ctx.user.id, p_lang: l });
    ucache.delete(ctx.user.id);
    bust('ulang:' + ctx.user.id);
    return { lang: l || null };
  },
};

// ---------- Yönetici: basit veritabanı yönetimi (beyaz liste) ----------
const LANG_OPTS = [['tr', 'Türkçe'], ['en', 'English'], ['ru', 'Русский']];
const ACTIVE = [['true', 'Aktif'], ['false', 'Gizli']];
const BIG = Number.MAX_SAFE_INTEGER;

// Para ile ilgili kayıtlar (bakiye, sipariş, yükleme, hareket) burada YOK: onlara özel, güvenli sekmeler var.
const DB = {
  app_users: {
    label: 'Kullanıcılar', icon: 'fa-users', color: '#3fd68f', pk: ['id'], order: ['created_at', true],
    search: ['id', 'username', 'first_name', 'last_name'], main: ['first_name', 'username'], insert: false, del: false,
    fields: [
      { k: 'id', l: 'ID', t: 'int', ro: true, pk: true, list: true },
      { k: 'first_name', l: 'İsim', t: 'text', max: 128, nullable: true, list: true },
      { k: 'last_name', l: 'Soyisim', t: 'text', max: 128, nullable: true },
      { k: 'username', l: 'Kullanıcı adı', t: 'text', max: 64, nullable: true, list: true },
      { k: 'is_admin', l: 'Rol', t: 'bool', opts: [['false', 'Kullanıcı'], ['true', 'Yönetici']], list: true },
      { k: 'is_banned', l: 'Durum', t: 'bool', opts: [['false', 'Aktif'], ['true', 'Engelli']] },
      { k: 'ban_reason', l: 'Engel sebebi', t: 'text', max: 200, nullable: true },
      { k: 'lang', l: 'Uygulama dili', t: 'select', opts: [['', 'Otomatik (Telegram)']].concat(LANG_OPTS), nullable: true },
      { k: 'balance', l: 'Bakiye (⭐) — «Bakiye düzelt» ile değişir', t: 'int', ro: true, list: true },
      { k: 'total_deposited', l: 'Toplam yükleme', t: 'int', ro: true },
      { k: 'total_spent', l: 'Toplam harcama', t: 'int', ro: true },
      { k: 'referral_code', l: 'Davet kodu', t: 'text', ro: true },
      { k: 'created_at', l: 'Katılım', t: 'date', ro: true },
      { k: 'last_seen_at', l: 'Son görülme', t: 'date', ro: true },
    ],
  },
  products: {
    label: 'Ürünler', icon: 'fa-box-open', color: '#a78bfa', pk: ['id'], order: ['sort_order', false],
    search: ['name', 'game', 'description'], main: ['name', 'game'], insert: false, del: false,
    fields: [
      { k: 'id', l: 'ID', t: 'uuid', ro: true, pk: true },
      { k: 'name', l: 'İsim', t: 'text', max: 80, req: true, list: true },
      { k: 'description', l: 'Açıklama', t: 'textarea', max: 600 },
      { k: 'image_url', l: 'Görsel adresi (https://)', t: 'text', max: 500, nullable: true },
      { k: 'game', l: 'Oyun / kategori', t: 'text', max: 80, nullable: true, list: true },
      { k: 'is_active', l: 'Durum', t: 'bool', opts: ACTIVE, list: true },
      { k: 'sort_order', l: 'Sıra (küçük önce)', t: 'int', min: -1000, max: 1000 },
    ],
  },
  tariffs: {
    label: 'Tarifeler', icon: 'fa-tags', color: '#f6c244', pk: ['id'], order: ['sort_order', false],
    search: ['label', 'tag'], main: ['label', 'tag'], insert: false, del: false,
    fields: [
      { k: 'id', l: 'ID', t: 'uuid', ro: true, pk: true },
      { k: 'label', l: 'Tarife adı', t: 'text', max: 40, req: true, list: true },
      { k: 'days', l: 'Süre (gün, boş = sınırsız)', t: 'int', min: 1, max: 36500, nullable: true, list: true },
      { k: 'price', l: 'Fiyat (⭐)', t: 'int', min: 1, max: 10000000, list: true },
      { k: 'tag', l: 'Etiket', t: 'text', max: 20, nullable: true },
      { k: 'is_active', l: 'Durum', t: 'bool', opts: ACTIVE },
      { k: 'sort_order', l: 'Sıra (küçük önce)', t: 'int', min: -1000, max: 1000 },
    ],
  },
  promo_codes: {
    label: 'Promosyon kodları', icon: 'fa-ticket', color: '#ff6fa8', pk: ['code'], order: ['created_at', true],
    search: ['code'], main: ['code'], insert: false, del: false,
    fields: [
      { k: 'code', l: 'Kod', t: 'text', ro: true, pk: true, list: true },
      { k: 'kind', l: 'Tür', t: 'select', opts: [['percent', 'Yüzde (%)'], ['fixed', 'Sabit (yıldız)']], list: true },
      { k: 'value', l: 'Değer', t: 'int', min: 1, max: 10000000, list: true },
      { k: 'max_uses', l: 'Toplam kullanım (boş = sınırsız)', t: 'int', min: 1, max: 10000000, nullable: true },
      { k: 'used_count', l: 'Kullanılan', t: 'int', ro: true },
      { k: 'per_user_limit', l: 'Kişi başı limit', t: 'int', min: 1, max: 1000 },
      { k: 'is_active', l: 'Durum', t: 'bool', opts: [['true', 'Aktif'], ['false', 'Kapalı']] },
      { k: 'expires_at', l: 'Bitiş', t: 'date', ro: true },
    ],
  },
  notifications: {
    label: 'Bildirimler', icon: 'fa-bell', color: '#ff9f43', pk: ['id'], order: ['id', true],
    search: ['title', 'body', 'user_id'], main: ['title'], insert: true, del: true,
    fields: [
      { k: 'id', l: 'No', t: 'int', ro: true, pk: true },
      { k: 'user_id', l: 'Kullanıcı ID', t: 'int', ins: true, list: true },
      { k: 'title', l: 'Başlık', t: 'text', max: 120, req: true, list: true },
      { k: 'body', l: 'Metin', t: 'textarea', max: 500, nullable: true },
      { k: 'is_read', l: 'Okundu', t: 'bool', opts: [['false', 'Hayır'], ['true', 'Evet']], list: true },
      { k: 'created_at', l: 'Tarih', t: 'date', ro: true },
    ],
  },
  translations: {
    label: 'Çeviriler', icon: 'fa-language', color: '#38bdf8', pk: ['lang', 'key'], order: ['key', false],
    search: ['key', 'value'], main: ['key'], insert: true, del: true,
    fields: [
      { k: 'lang', l: 'Dil', t: 'select', opts: LANG_OPTS, ins: true, pk: true, list: true },
      { k: 'key', l: 'Anahtar', t: 'text', max: 80, req: true, ins: true, pk: true, list: true },
      { k: 'value', l: 'Çeviri', t: 'textarea', max: 2000, req: true, list: true },
      { k: 'custom', l: 'Durum', t: 'bool', ro: true, opts: [['false', 'Varsayılan'], ['true', 'Düzenlenmiş']], list: true },
    ],
  },
};
Object.keys(DB).forEach((id) => { DB[id].id = id; });

function dbCfg(id) {
  if (typeof id !== 'string' || !has(DB, id)) throw new OpError('invalid_table', DB_MESSAGES.invalid_table[0], 400);
  return DB[id];
}

function conv(f, v) {
  switch (f.t) {
    case 'int':
      if (v === null || v === '' || v === undefined) { if (f.nullable) return null; throw invalid(f.k); }
      return toInt(v, f.k, f.min == null ? -BIG : f.min, f.max == null ? BIG : f.max);
    case 'uuid': return toUuid(v, f.k);
    case 'bool':
      if (v === true || v === 'true') return true;
      if (v === false || v === 'false') return false;
      throw invalid(f.k);
    case 'select': {
      const s = v == null ? '' : String(v);
      if (!f.opts.some((o) => o[0] === s)) throw invalid(f.k);
      return s === '' && f.nullable ? null : s;
    }
    default: {
      const s = toStr(v, f.k, f.max || 500, f.req);
      return s === '' && f.nullable ? null : s;
    }
  }
}

function pickDb(cfg, data, isInsert) {
  const out = {};
  for (const f of cfg.fields) {
    if (!has(data, f.k) || f.ro) continue;
    if (f.pk && !f.ins) continue;
    if (f.ins && !isInsert) continue;
    out[f.k] = conv(f, data[f.k]);
  }
  if (isInsert) {
    for (const f of cfg.fields) if ((f.ins || f.req) && !f.ro && !has(out, f.k)) throw invalid(f.k);
  }
  return out;
}

function pkOf(cfg, pk) {
  const o = {};
  for (const k of cfg.pk) {
    const f = cfg.fields.find((x) => x.k === k);
    if (!pk || typeof pk !== 'object' || !has(pk, k)) throw invalid('pk');
    o[k] = f.t === 'select' || f.t === 'text' ? toStr(String(pk[k]), k, 80, true) : conv(f, pk[k]);
  }
  return o;
}

function dbMeta() {
  return {
    tables: Object.keys(DB).map((id) => {
      const c = DB[id];
      return {
        id, label: c.label, icon: c.icon, color: c.color, pk: c.pk, main: c.main, insert: c.insert, del: c.del,
        fields: c.fields.map((f) => ({ k: f.k, l: f.l, t: f.t, ro: !!f.ro, ins: !!f.ins, pk: !!f.pk, list: !!f.list, opts: f.opts || null, max: f.max || null, nullable: !!f.nullable, req: !!f.req })),
      };
    }),
  };
}

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
const LIMIT = (b, def) => (b.limit == null ? (def || 20) : toInt(b.limit, 'limit', 1, 100));
const FILTER = (v, allowed) => (typeof v === 'string' && allowed.includes(v) ? v : null);

// "Çeviriler" tablosu: veritabanında yalnızca yöneticinin düzenledikleri durur (boş olabilir).
// Liste, koddaki varsayılan metinlerle (tr/en/ru) bu düzenlemelerin birleşimidir; böylece tüm çeviriler görünür.
async function translationsList(body) {
  const ov = (await rpc('public_translations')) || {};
  const q = toStr(body.q, 'q', 60, false).toLowerCase();
  const rows = [];
  I18N.SUPPORTED.forEach((lang) => {
    const def = I18N.DICT[lang] || {};
    const o = (ov && ov[lang]) || {};
    Object.keys(def).forEach((key) => {
      const custom = typeof o[key] === 'string' && o[key] !== '';
      rows.push({ lang, key, value: custom ? o[key] : def[key], custom });
    });
    Object.keys(o).forEach((key) => {
      if (!has(def, key) && typeof o[key] === 'string' && o[key] !== '') rows.push({ lang, key, value: o[key], custom: true });
    });
  });
  rows.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : I18N.SUPPORTED.indexOf(a.lang) - I18N.SUPPORTED.indexOf(b.lang)));
  const list = q ? rows.filter((r) => r.key.toLowerCase().includes(q) || String(r.value).toLowerCase().includes(q) || r.lang === q) : rows;
  const off = OFFSET(body);
  return { total: list.length, items: list.slice(off, off + LIMIT(body)) };
}

const ADMIN_OPS = {
  'admin.stats': () => rpc('admin_stats'),

  'admin.orders': (c) => rpc('admin_orders', {
    p_status: FILTER(c.body.status, ['pending', 'completed', 'refunded']),
    p_search: toStr(c.body.q, 'q', 60, false) || null,
    p_limit: LIMIT(c.body),
    p_offset: OFFSET(c.body),
  }),

  async 'admin.order_complete'(c) {
    const id = toInt(c.body.id, 'id', 1, 2147483647);
    const note = toStr(c.body.note, 'note', 500, false);
    const key = toStr(c.body.license_key, 'license_key', 500, false);
    const o = await rpc('complete_order', { p_order_id: id, p_admin_id: c.user.id, p_note: note || null, p_license_key: key || null });
    const dm = await dmKey(o.user_id, 'dm.order_done', {
      id: o.id, product: esc(o.product_name), tariff: esc(o.tariff_label),
      key: o.license_key ? '\n\n🔑 <code>' + esc(o.license_key) + '</code>' : '',
      note: o.admin_note ? '\n\n' + esc(o.admin_note) : '',
    }, { force: true });
    return { order: o, dm };
  },

  async 'admin.order_refund'(c) {
    const id = toInt(c.body.id, 'id', 1, 2147483647);
    const reason = toStr(c.body.reason, 'reason', 500, false);
    const o = await rpc('refund_order', { p_order_id: id, p_admin_id: c.user.id, p_reason: reason || null });
    const dm = await dmKey(o.user_id, 'dm.order_refund', {
      id: o.id, product: esc(o.product_name), tariff: esc(o.tariff_label), amt: stars(o.price), reason: reason ? '\n\n' + esc(reason) : '',
    }, { force: true });
    return { order: o, dm };
  },

  'admin.users': (c) => rpc('admin_users', {
    p_search: toStr(c.body.q, 'q', 60, false) || null, p_limit: LIMIT(c.body), p_offset: OFFSET(c.body),
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
    ucache.delete(id);
    return { banned };
  },

  // Kişiyi yönetici yap / yöneticiliğini al
  async 'admin.user_role'(c) {
    const id = toInt(c.body.id, 'id', 1, Number.MAX_SAFE_INTEGER);
    const admin = toBool(c.body.admin, 'admin');
    const r = await rpc('admin_set_role', { p_user_id: id, p_admin: admin, p_actor: c.user.id });
    ucache.delete(id);
    if (admin && r && r.is_admin) {
      await dmUser(id, '⚙️ <b>Yönetici yetkisi verildi</b>\nArtık Profil sayfasından «Yönetici Sayfası»na girebilirsin.', { force: true, keep: true });
    }
    return r;
  },

  async 'admin.user_adjust'(c) {
    const id = toInt(c.body.id, 'id', 1, Number.MAX_SAFE_INTEGER);
    const amount = toInt(c.body.amount, 'amount', -10000000, 10000000);
    if (amount === 0) throw new OpError('invalid_amount', DB_MESSAGES.invalid_amount[0], 400);
    const reason = toStr(c.body.reason, 'reason', 200, false);
    const balance = await rpc('admin_adjust_balance', { p_user_id: id, p_amount: amount, p_admin_id: c.user.id, p_reason: reason || null });
    await dmKey(id, amount > 0 ? 'dm.bal_add' : 'dm.bal_sub', {
      amt: stars(Math.abs(amount)), reason: reason ? '\n' + esc(reason) : '', bal: stars(balance),
    }, { force: true });
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
    p_limit: LIMIT(c.body),
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
    await dmKey(dep.user_id, 'dm.deposit_refund', { amt: stars(dep.amount) }, { force: true });
    return { deposit: dep };
  },

  'admin.products': () => rpc('admin_products'),
  async 'admin.product_save'(c) { const r = await rpc('admin_save_product', { p: pickProduct(c.body.product), p_admin_id: c.user.id }); bust('catalog'); return r; },
  async 'admin.tariff_save'(c) { const r = await rpc('admin_save_tariff', { p: pickTariff(c.body.tariff), p_admin_id: c.user.id }); bust('catalog'); return r; },
  'admin.promos': () => rpc('admin_promos'),
  'admin.promo_save': (c) => rpc('admin_save_promo', { p: pickPromo(c.body.promo), p_admin_id: c.user.id }),
  'admin.settings': () => settings(),
  async 'admin.settings_save'(c) { const r = await rpc('admin_save_settings', { p: pickSettings(c.body.settings), p_admin_id: c.user.id }); bust('settings'); return r; },
  'admin.audit': (c) => rpc('admin_audit', { p_limit: LIMIT(c.body, 40), p_offset: OFFSET(c.body) }),

  // ----- Çeviriler -----
  'admin.i18n': () => rpc('public_translations'),
  async 'admin.i18n_save'(c) {
    const items = Array.isArray(c.body.items) ? c.body.items : [];
    if (!items.length || items.length > 12) throw invalid('items');
    for (const it of items) {
      const lang = toStr(it && it.lang, 'lang', 5, true);
      if (I18N.SUPPORTED.indexOf(lang) < 0) throw invalid('lang');
      await rpc('admin_save_translation', {
        p_lang: lang, p_key: toStr(it.key, 'key', 80, true), p_value: toStr(it.value, 'value', 2000, false), p_actor: c.user.id,
      });
    }
    bust('i18n');
    return { saved: items.length };
  },

  // ----- Basit veritabanı yönetimi -----
  'admin.db_meta': () => dbMeta(),

  async 'admin.db_list'(c) {
    const cfg = dbCfg(c.body.table);
    if (cfg.id === 'translations') return translationsList(c.body);
    const r = await rpc('admin_db_list', {
      p_table: cfg.id, p_search: toStr(c.body.q, 'q', 60, false) || null, p_search_cols: cfg.search,
      p_order: cfg.order[0], p_desc: cfg.order[1], p_limit: LIMIT(c.body), p_offset: OFFSET(c.body),
    });
    const keep = cfg.fields.map((f) => f.k);
    r.items = (r.items || []).map((row) => { const o = {}; keep.forEach((k) => { o[k] = row[k]; }); return o; });
    return r;
  },

  async 'admin.db_save'(c) {
    const cfg = dbCfg(c.body.table);
    const insert = !c.body.pk;
    if (insert && !cfg.insert) throw new OpError('forbidden', 'Bu tabloya kayıt eklenemez.', 403);
    const data = pickDb(cfg, c.body.data && typeof c.body.data === 'object' ? c.body.data : {}, insert);
    const pk = insert ? null : pkOf(cfg, c.body.pk);
    if (cfg.id === 'translations') {
      // Doğrudan tablo yerine Çeviriler sekmesinin kullandığı güvenli işlem kullanılır; varsayılanla aynıysa düzenleme kaldırılır.
      const lang = insert ? data.lang : pk.lang;
      const key = insert ? data.key : pk.key;
      if (I18N.SUPPORTED.indexOf(lang) < 0) throw invalid('lang');
      if (!/^[A-Za-z0-9._-]{1,80}$/.test(key)) throw new OpError('invalid_key', DB_MESSAGES.invalid_key[0], 400);
      if (!has(data, 'value')) throw new OpError('invalid_data', DB_MESSAGES.invalid_data[0], 400);
      const def = I18N.DICT[lang] && I18N.DICT[lang][key];
      await rpc('admin_save_translation', { p_lang: lang, p_key: key, p_value: data.value === def ? '' : data.value, p_actor: c.user.id });
      bust('i18n');
      return { saved: true, row: null };
    }
    let row = null;

    if (cfg.id === 'app_users' && pk) {
      // Rol, engel ve dil için özel (korumalı) işlemler kullanılır
      if (has(data, 'is_admin')) {
        await rpc('admin_set_role', { p_user_id: pk.id, p_admin: data.is_admin, p_actor: c.user.id });
        delete data.is_admin;
      }
      if (has(data, 'is_banned')) {
        await rpc('admin_set_ban', { p_user_id: pk.id, p_banned: data.is_banned, p_reason: data.is_banned ? (data.ban_reason || null) : null, p_admin_id: c.user.id });
        delete data.is_banned; delete data.ban_reason;
      }
      if (has(data, 'lang')) {
        await rpc('set_user_lang', { p_user_id: pk.id, p_lang: data.lang || '' });
        bust('ulang:' + pk.id);
        delete data.lang;
      }
      ucache.delete(pk.id);
    }
    if (Object.keys(data).length) {
      row = await rpc('admin_db_save', { p_table: cfg.id, p_pk: pk, p_data: data, p_actor: c.user.id });
    }
    if (cfg.id === 'translations') bust('i18n');
    if (cfg.id === 'products' || cfg.id === 'tariffs') bust('catalog');
    return { saved: true, row };
  },

  async 'admin.db_delete'(c) {
    const cfg = dbCfg(c.body.table);
    if (!cfg.del) throw new OpError('forbidden', 'Bu tablodan kayıt silinemez.', 403);
    if (cfg.id === 'translations') {
      const tpk = pkOf(cfg, c.body.pk);
      await rpc('admin_save_translation', { p_lang: tpk.lang, p_key: tpk.key, p_value: '', p_actor: c.user.id });
      bust('i18n');
      return { deleted: true };
    }
    await rpc('admin_db_delete', { p_table: cfg.id, p_pk: pkOf(cfg, c.body.pk), p_actor: c.user.id });
    if (cfg.id === 'translations') bust('i18n');
    return { deleted: true };
  },

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
      const results = await Promise.all(part.map((id) => dmUser(id, esc(text), { force: true, keep: true })));
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

// Kullanıcı satırı: yalnızca `boot` yazar (upsert); diğer isteklerde 5 sn'lik önbellek + salt-okunur sorgu.
const ucache = new Map();
function ucacheSet(id, u) {
  if (ucache.size > 3000) ucache.clear();
  ucache.set(id, { u, exp: Date.now() + 5000 });
}
function upsert(tu, ref) {
  return rpc('upsert_telegram_user', {
    p_id: tu.id,
    p_username: cut(tu.username, 64),
    p_first_name: cut(tu.first_name, 128),
    p_last_name: cut(tu.last_name, 128),
    p_photo_url: cut(tu.photo_url, 500),
    p_language_code: cut(tu.language_code, 16),
    p_ref_code: ref,
    p_admin_username: adminUsername(),
  });
}
async function loadUser(tu, op, v, body) {
  const hit = ucache.get(tu.id);
  if (op !== 'boot' && hit && hit.exp > Date.now()) return hit.u;
  let u;
  if (op === 'boot') {
    u = await upsert(tu, cleanRef(v.startParam) || cleanRef(body.ref));
  } else {
    u = await rpc('get_app_user', { p_id: tu.id });
    if (!u || !u.id) u = await upsert(tu, null);
  }
  if (u) ucacheSet(tu.id, u);
  return u;
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
  const user = await loadUser(v.user, op, v, body || {});
  if (!user) throw new OpError('internal', 'Beklenmeyen bir hata oluştu.', 500);

  rateLimit(user.id, user.is_admin);

  if (op.startsWith('admin.') && !user.is_admin) throw new OpError('forbidden', 'Bu işlem için yetkin yok.', 403);
  if (user.is_banned && op !== 'boot') throw new OpError('user_banned', DB_MESSAGES.user_banned[0], 403);

  return fn({ user, body: body || {}, req });
}

module.exports = {
  handle, mapError, OpError,
  _test: { cleanRef, inviteLink, buckets, pickPromo, pickSettings, pickTariff, pickProduct, pickDb, pkOf, dbMeta, resetBot() { botCache = null; } },
};
