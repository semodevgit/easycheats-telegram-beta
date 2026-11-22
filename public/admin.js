(function () {
  'use strict';
  var EC, root, mod = 'dash';
  var S = {
    orders: { status: 'pending', q: '', items: [], total: 0 },
    users: { q: '', items: [], total: 0 },
    deposits: { status: '', q: '', items: [], total: 0 },
    audit: { items: [], total: 0 },
    products: { items: [] }, promos: { items: [] }
  };
  var TABS = [['dash', 'Özet'], ['orders', 'Siparişler'], ['users', 'Kullanıcılar'], ['deposits', 'Yüklemeler'], ['products', 'Ürünler'], ['promos', 'Kodlar'], ['bcast', 'Duyuru'], ['settings', 'Ayarlar'], ['audit', 'Kayıt']];
  var AUDIT = {
    order_completed: 'Sipariş tamamlandı', order_refunded: 'Sipariş iade edildi', balance_adjusted: 'Bakiye düzeltildi',
    user_banned: 'Kullanıcı engellendi', user_unbanned: 'Engel kaldırıldı', product_created: 'Ürün eklendi', product_updated: 'Ürün güncellendi',
    tariff_created: 'Tarife eklendi', tariff_updated: 'Tarife güncellendi', promo_saved: 'Kod kaydedildi', settings_saved: 'Ayarlar kaydedildi',
    deposit_refunded: 'Yükleme iade edildi', deposit_refund_reverted: 'Yükleme iadesi geri alındı', message_sent: 'Mesaj gönderildi',
    broadcast: 'Toplu duyuru', admin_bound: 'Yönetici bağlandı'
  };

  var CSS = '.a-f{display:grid;gap:6px;margin-top:14px}.a-f>label{color:var(--muted);font-size:14px}' +
    '.a-f input,.a-f textarea,.a-f select{width:100%;min-height:50px;border-radius:16px;border:0;background:var(--surface-2);color:var(--fg);padding:0 16px;font:inherit;font-size:16px;font-weight:700}' +
    '.a-f textarea{padding:14px 16px;min-height:92px;resize:vertical;line-height:1.4}' +
    '.a-f input:focus,.a-f textarea:focus,.a-f select:focus{outline:none;background:var(--surface-3)}' +
    '.a-f select{-webkit-appearance:none;appearance:none}' +
    '.a-row{display:flex;gap:8px;flex-wrap:wrap}' +
    '.a-row>button{flex:1 1 110px;min-width:0;height:46px;border-radius:16px;border:0;background:var(--surface-2);font-size:15px}' +
    '.a-row>button:hover{background:var(--surface-3)}.a-row>button:disabled{opacity:.6;cursor:progress}' +
    '.a-row>button.pri{background:var(--accent-strong);color:var(--on-accent)}.a-row>button.dan{color:var(--bad)}' +
    '.a-tiles{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-top:14px}' +
    '.a-tile{border-radius:20px;background:var(--surface);padding:16px 14px;display:grid;gap:4px;min-width:0}' +
    '.a-tile strong{font-size:22px;letter-spacing:-.02em;font-variant-numeric:tabular-nums}.a-tile span{color:var(--muted);font-size:13px}' +
    '.a-bars{display:flex;align-items:flex-end;gap:6px;margin-top:14px}' +
    '.a-bar{flex:1;display:grid;gap:6px;justify-items:center;min-width:0}.a-bar .p{display:flex;align-items:flex-end;gap:2px;height:96px}' +
    '.a-bar i{display:block;width:8px;border-radius:4px 4px 2px 2px;background:var(--accent-strong);min-height:3px}.a-bar i.d{background:var(--good)}' +
    '.a-bar span{font-size:11px;color:var(--muted)}' +
    '.a-leg{display:flex;gap:16px;margin-top:10px;color:var(--muted);font-size:13px}.a-leg b{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:6px;background:var(--accent-strong)}.a-leg b.d{background:var(--good)}' +
    '.a-kv{display:grid;grid-template-columns:auto 1fr;gap:8px 16px;font-size:15px;margin:0}.a-kv dt{color:var(--muted)}.a-kv dd{margin:0;text-align:right;overflow-wrap:anywhere}' +
    '.a-sec{margin:22px 4px 8px;color:var(--muted);font-size:15px}.a-more{margin-top:12px}.a-gap{margin-top:12px}' +
    '.a-q{margin-top:14px}.a-q input{text-transform:none;letter-spacing:0}.a-act{cursor:pointer}';

  var esc = function (s) { return EC.esc(s); };
  var $ = function (s, r) { return (r || document).querySelector(s); };
  function v(id) { var e = document.getElementById(id); return e ? e.value : ''; }
  function num(id) { var t = v(id).trim(); return t === '' ? null : Number(t); }
  function F(label, inner, id) { return '<div class="a-f"><label' + (id ? ' for="' + id + '"' : '') + '>' + label + '</label>' + inner + '</div>'; }
  function inp(id, val, ph, type, extra) { return '<input id="' + id + '" type="' + (type || 'text') + '" value="' + esc(val == null ? '' : val) + '" placeholder="' + esc(ph || '') + '" autocomplete="off" ' + (extra || '') + '>'; }
  function txa(id, val, ph, max) { return '<textarea id="' + id + '" placeholder="' + esc(ph || '') + '" maxlength="' + (max || 500) + '">' + esc(val == null ? '' : val) + '</textarea>'; }
  function sel(id, opts, val) {
    return '<select id="' + id + '">' + opts.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (String(o[0]) === String(val) ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') + '</select>';
  }
  function btn(label, action, arg, cls) { return '<button class="' + (cls || '') + '" data-action="adm:' + action + '"' + (arg != null ? ' data-arg="' + esc(arg) + '"' : '') + '>' + label + '</button>'; }
  function uname(u) { return u.first_name || (u.username ? '@' + u.username : String(u.id)); }
  function ustr(u) { return esc(uname(u)) + (u.username && u.first_name ? ' · @' + esc(u.username) : '') + ' · ' + u.id; }
  function pill(status) {
    if (status === 'completed' || status === 'paid') return '<span class="pill on">' + (status === 'paid' ? 'Ödendi' : 'Tamamlandı') + '</span>';
    if (status === 'pending' || status === 'created') return '<span class="pill wait">' + (status === 'pending' ? 'Bekliyor' : 'Açık') + '</span>';
    return '<span class="pill" style="background:var(--surface-3);color:var(--muted)">' + (status === 'refunded' ? 'İade' : 'Başarısız') + '</span>';
  }
  function run(el, p) {
    if (el) el.disabled = true;
    return p.then(function (r) { if (el) el.disabled = false; return r; }, function (e) {
      if (el) el.disabled = false;
      EC.toast(e.message || 'İşlem başarısız'); EC.haptic('error');
      throw e;
    });
  }
  var quiet = function () {};
  function loadingHtml() { return '<p class="muted" style="text-align:center;margin:28px 0">Yükleniyor…</p>'; }
  function errHtml(msg) { return '<div class="empty"><h3>Yüklenemedi</h3><p>' + esc(msg) + '</p><button class="btn-ghost" data-action="adm:reload">Tekrar dene</button></div>'; }
  function body() { return $('#adm-body'); }
  function chips(list, cur, action) {
    return '<div class="chips" style="margin-top:14px">' + list.map(function (c) {
      return '<button class="chip" data-action="adm:' + action + '" data-arg="' + c[0] + '" aria-pressed="' + (cur === c[0]) + '">' + c[1] + '</button>';
    }).join('') + '</div>';
  }
  function searchBox(val, ph) {
    return '<div class="promo a-q"><input id="adm-q" type="text" value="' + esc(val) + '" placeholder="' + esc(ph) + '" autocomplete="off" spellcheck="false" aria-label="Ara"><button data-action="adm:search">Ara</button></div>';
  }
  function moreBtn(s) { return s.items.length < s.total ? '<button class="btn-ghost a-more" data-action="adm:more">Daha fazla (' + (s.total - s.items.length) + ')</button>' : ''; }

  /* ---------- iskelet ---------- */
  function mount(viewEl, ec) {
    EC = ec; root = viewEl;
    if (!document.getElementById('adm-css')) {
      var st = document.createElement('style'); st.id = 'adm-css'; st.textContent = CSS; document.head.appendChild(st);
    }
    if (!root.__adm) {
      root.__adm = true;
      root.addEventListener('keydown', function (e) { if (e.key === 'Enter' && e.target.id === 'adm-q') { e.preventDefault(); act('adm:search'); } });
    }
    root.innerHTML = '<div class="whead"><button class="icon-btn" data-action="nav" data-arg="profile" aria-label="Geri">' + EC.ico('i-back') + '</button><h1 class="h1">Yönetici</h1></div>' +
      '<div class="chips" id="adm-tabs"></div><div id="adm-body"></div>';
    tabs(); load(true);
    EC.animIn(root.children);
  }
  function tabs() {
    $('#adm-tabs').innerHTML = TABS.map(function (t) { return '<button class="chip" data-action="adm:tab" data-arg="' + t[0] + '" aria-pressed="' + (mod === t[0]) + '">' + t[1] + '</button>'; }).join('');
  }
  function setMod(m) { mod = m; tabs(); load(true); }
  function load(reset) {
    var b = body(); if (!b) return;
    if (reset || mod === 'dash') b.innerHTML = loadingHtml();
    var p;
    if (mod === 'dash') p = EC.api('admin.stats').then(function (d) { b.innerHTML = dash(d); });
    else if (mod === 'orders') p = list('orders', 'admin.orders', { status: S.orders.status, q: S.orders.q }, reset).then(drawOrders);
    else if (mod === 'users') p = list('users', 'admin.users', { q: S.users.q }, reset).then(drawUsers);
    else if (mod === 'deposits') p = list('deposits', 'admin.deposits', { status: S.deposits.status, q: S.deposits.q }, reset).then(drawDeposits);
    else if (mod === 'audit') p = list('audit', 'admin.audit', {}, reset).then(drawAudit);
    else if (mod === 'products') p = EC.api('admin.products').then(function (r) { S.products.items = r; drawProducts(); });
    else if (mod === 'promos') p = Promise.all([EC.api('admin.promos'), EC.api('admin.products')]).then(function (r) { S.promos.items = r[0]; S.products.items = r[1]; drawPromos(); });
    else if (mod === 'bcast') { drawBcast(); return; }
    else if (mod === 'settings') p = EC.api('admin.settings').then(drawSettings);
    p.catch(function (e) { var bb = body(); if (bb) bb.innerHTML = errHtml(e.message); });
  }
  function list(key, op, extra, reset) {
    var s = S[key], body = { offset: reset ? 0 : s.items.length };
    Object.keys(extra || {}).forEach(function (k) { if (extra[k]) body[k] = extra[k]; });
    return EC.api(op, body).then(function (r) { s.items = reset ? r.items : s.items.concat(r.items); s.total = r.total; });
  }

  /* ---------- özet ---------- */
  function dash(d) {
    var tile = function (label, o, sub) { return '<div class="a-tile"><strong>' + (o.amount != null ? EC.st(o.amount) : EC.fmt(o)) + '</strong><span>' + label + (o.count != null ? ' · ' + o.count + ' adet' : '') + (sub || '') + '</span></div>'; };
    var max = 1;
    d.daily.forEach(function (x) { max = Math.max(max, x.amount, x.deposits); });
    var bars = d.daily.map(function (x) {
      return '<div class="a-bar"><div class="p"><i style="height:' + Math.max(3, Math.round(x.amount / max * 90)) + 'px"></i><i class="d" style="height:' + Math.max(3, Math.round(x.deposits / max * 90)) + 'px"></i></div><span>' + esc(x.day) + '</span></div>';
    }).join('');
    return '<section class="wcard"><span class="w-lbl">Bekleyen sipariş</span><div class="w-bal"><strong>' + EC.fmt(d.pending_orders) + '</strong></div>' +
      '<p class="w-sub">Toplam ' + EC.st(d.pending_amount) + '</p>' +
      '<button class="btn-ghost" data-action="adm:goto-pending" style="margin-top:6px">Siparişleri aç</button></section>' +
      '<div class="a-tiles">' + tile('Bugün satış', d.sales_today) + tile('7 gün satış', d.sales_7d) + tile('30 gün satış', d.sales_30d) + tile('Toplam satış', d.sales_all) +
      tile('Bugün yükleme', d.deposits_today) + tile('30 gün yükleme', d.deposits_30d) + tile('Toplam yükleme', d.deposits_all) + tile('30 gün iade', d.refunds_30d) +
      '<div class="a-tile"><strong>' + EC.fmt(d.users_total) + '</strong><span>Kullanıcı · bugün +' + d.users_new_today + ' · 7 gün +' + d.users_new_7d + '</span></div>' +
      '<div class="a-tile"><strong>' + EC.st(d.balance_total) + '</strong><span>Kullanıcı bakiyeleri toplamı</span></div></div>' +
      '<div class="info"><div><h4>Son 7 gün</h4><div class="a-bars">' + bars + '</div><div class="a-leg"><span><b></b>Satış</span><span><b class="d"></b>Yükleme</span></div></div></div>';
  }

  /* ---------- siparişler ---------- */
  function drawOrders() {
    var s = S.orders, items = s.items;
    body().innerHTML = chips([['pending', 'Bekleyen'], ['completed', 'Tamamlanan'], ['refunded', 'İade'], ['all', 'Hepsi']], s.status || 'all', 'filter') +
      searchBox(s.q, 'Sipariş no, kullanıcı adı veya ID') +
      '<p class="a-sec">' + s.total + ' sipariş</p>' +
      (items.length ? items.map(orderCard).join('') : '<div class="empty"><h3>Sipariş yok</h3><p>Bu filtrede sipariş bulunamadı.</p></div>') + moreBtn(s);
  }
  function orderCard(o) {
    var acts = btn('Telegram’da yaz', 'chat', o.user.id + '|' + (o.user.username || ''));
    if (o.status === 'pending') acts += btn('Tamamla', 'complete', o.id, 'pri') + btn('İade et', 'refund', o.id, 'dan');
    else if (o.status === 'completed') acts += btn('İade et', 'refund', o.id, 'dan');
    return '<article class="buy"><div class="buy-top"><div class="buy-info"><h3>#' + o.id + ' · ' + esc(o.product_name) + '</h3>' +
      '<p><span>' + esc(o.tariff_label) + '</span><span>·</span>' + EC.st(o.price) + '<span>·</span><span>' + EC.dateTime(o.created_at) + '</span></p>' +
      '<p style="margin-top:4px">' + ustr(o.user) + '</p></div>' + pill(o.status) + '</div>' +
      (o.promo_code ? '<p class="muted">Kod: ' + esc(o.promo_code) + ' · indirim ' + EC.st(o.discount) + '</p>' : '') +
      (o.license_key ? '<div class="key" data-action="copy" data-arg="' + esc(o.license_key) + '" role="button" tabindex="0"><code>' + esc(o.license_key) + '</code></div>' : '') +
      (o.admin_note ? '<p class="muted">Not: ' + esc(o.admin_note) + '</p>' : '') +
      '<div class="a-row">' + acts + '</div></article>';
  }
  function findOrder(id) { return S.orders.items.filter(function (o) { return o.id === id; })[0]; }
  function openComplete(id) {
    var o = findOrder(id); if (!o) return;
    EC.sheet('Siparişi tamamla',
      '<p class="muted">#' + o.id + ' · ' + esc(o.product_name) + ' · ' + esc(o.tariff_label) + ' · ' + esc(uname(o.user)) + '</p>' +
      F('Lisans anahtarı (isteğe bağlı)', inp('adm-key', '', 'Kullanıcıya gösterilecek anahtar'), 'adm-key') +
      F('Kullanıcıya not (isteğe bağlı)', txa('adm-note', '', 'Kullanıcı bunu satın alımlarında görür'), 'adm-note') +
      '<div class="a-row a-gap">' + btn('Tamamlandı yap', 'do-complete', id, 'pri') + '</div>' +
      '<p class="legal">Kullanıcıya bot üzerinden de bildirim gider.</p>');
  }
  function openRefund(id) {
    var o = findOrder(id); if (!o) return;
    EC.sheet('Siparişi iade et',
      '<p class="muted">#' + o.id + ' · ' + esc(o.product_name) + ' · ' + esc(o.tariff_label) + '<br>' + esc(uname(o.user)) + ' hesabına ' + EC.st(o.price) + ' geri yüklenecek.</p>' +
      F('Kullanıcıya not (isteğe bağlı)', txa('adm-note', '', 'Örn: stok yok'), 'adm-note') +
      '<div class="a-row a-gap">' + btn('İade et', 'do-refund', id, 'dan') + '</div>');
  }

  /* ---------- kullanıcılar ---------- */
  function drawUsers() {
    var s = S.users;
    body().innerHTML = searchBox(s.q, 'Ad, kullanıcı adı veya ID') + '<p class="a-sec">' + s.total + ' kullanıcı</p>' +
      (s.items.length ? '<div class="txl">' + s.items.map(function (u) {
        return '<div class="tx a-act" data-action="adm:user" data-arg="' + u.id + '" role="button" tabindex="0"><span class="ti">' + EC.ico('i-shield') + '</span>' +
          '<div class="tt"><strong>' + esc(uname(u)) + (u.is_admin ? ' · Yönetici' : '') + (u.is_banned ? ' · Engelli' : '') + '</strong><span>' + (u.username ? '@' + esc(u.username) + ' · ' : '') + u.id + ' · ' + u.orders_count + ' sipariş</span></div>' +
          '<span class="ta">' + EC.st(u.balance) + '</span></div>';
      }).join('') + '</div>' : '<div class="empty"><h3>Kullanıcı yok</h3></div>') + moreBtn(s);
  }
  function showUser(id) {
    EC.api('admin.user', { id: +id }).then(function (r) {
      var u = r.user;
      var kv = function (k, val) { return '<dt>' + k + '</dt><dd>' + val + '</dd>'; };
      var html = '<dl class="a-kv">' + kv('ID', u.id) + kv('Kullanıcı adı', u.username ? '@' + esc(u.username) : '—') + kv('Bakiye', EC.st(u.balance)) +
        kv('Toplam yükleme', EC.st(u.total_deposited)) + kv('Toplam harcama', EC.st(u.total_spent)) + kv('Katılım', EC.dateTime(u.created_at)) + kv('Son görülme', EC.dateTime(u.last_seen_at)) +
        kv('Davet eden', r.referrer ? esc(uname(r.referrer)) : '—') + kv('Davet ettikleri', r.referral.count + ' kişi · ' + EC.st(r.referral.earned)) +
        kv('Durum', u.is_banned ? 'Engelli' + (u.ban_reason ? ' (' + esc(u.ban_reason) + ')' : '') : u.is_admin ? 'Yönetici' : 'Aktif') + '</dl>' +
        '<div class="a-row a-gap">' + btn('Telegram’da yaz', 'chat', u.id + '|' + (u.username || '')) + btn('Mesaj gönder', 'msg', u.id) + '</div>' +
        '<div class="a-row a-gap">' + btn('Bakiye düzelt', 'adjust', u.id) + (u.is_admin ? '' : btn(u.is_banned ? 'Engeli kaldır' : 'Engelle', 'ban', u.id + '|' + (u.is_banned ? 0 : 1), u.is_banned ? '' : 'dan')) + '</div>' +
        '<p class="a-sec">Son siparişler</p><div class="txl">' + (r.orders.length ? r.orders.map(function (o) {
          return '<div class="tx"><span class="ti">' + EC.ico('i-receipt') + '</span><div class="tt"><strong>#' + o.id + ' · ' + esc(o.product_name) + ' · ' + esc(o.tariff_label) + '</strong><span>' + EC.dateTime(o.created_at) + ' · ' + ({ pending: 'Bekliyor', completed: 'Tamamlandı', refunded: 'İade' })[o.status] + '</span></div><span class="ta">' + EC.st(o.price) + '</span></div>';
        }).join('') : '<p class="muted">Sipariş yok.</p>') + '</div>' +
        '<p class="a-sec">Son hareketler</p><div class="txl">' + (r.transactions.length ? r.transactions.map(function (t) {
          return '<div class="tx ' + (t.amount > 0 ? 'in' : '') + '"><span class="ti">' + EC.ico(t.amount > 0 ? 'i-in' : 'i-out') + '</span><div class="tt"><strong>' + esc(t.title) + '</strong><span>' + EC.dateTime(t.created_at) + '</span></div><span class="ta">' + (t.amount > 0 ? '+' : '−') + EC.st(Math.abs(t.amount)) + '</span></div>';
        }).join('') : '<p class="muted">Hareket yok.</p>') + '</div>';
      EC.sheet(esc(uname(u)), html);
    }).catch(function (e) { EC.toast(e.message); });
  }

  /* ---------- yüklemeler ---------- */
  function drawDeposits() {
    var s = S.deposits;
    body().innerHTML = chips([['', 'Hepsi'], ['paid', 'Ödendi'], ['refunded', 'İade'], ['created', 'Açık']], s.status, 'filter') +
      searchBox(s.q, 'Kullanıcı adı, ID veya charge no') + '<p class="a-sec">' + s.total + ' yükleme</p>' +
      (s.items.length ? '<div class="txl">' + s.items.map(function (d) {
        return '<div class="tx a-act ' + (d.status === 'paid' ? 'in' : '') + '" data-action="adm:dep" data-arg="' + d.id + '" role="button" tabindex="0"><span class="ti">' + EC.ico('i-in') + '</span>' +
          '<div class="tt"><strong>' + esc(uname(d.user)) + '</strong><span>' + EC.dateTime(d.created_at) + ' · ' + ({ paid: 'Ödendi', refunded: 'İade edildi', created: 'Ödeme bekleniyor', failed: 'Başarısız' })[d.status] + '</span></div><span class="ta">' + EC.st(d.amount) + '</span></div>';
      }).join('') + '</div>' : '<div class="empty"><h3>Yükleme yok</h3></div>') + moreBtn(s);
  }
  function showDeposit(id) {
    var d = S.deposits.items.filter(function (x) { return x.id === id; })[0]; if (!d) return;
    var kv = function (k, val) { return '<dt>' + k + '</dt><dd>' + val + '</dd>'; };
    EC.sheet('Yükleme', '<dl class="a-kv">' + kv('Tutar', EC.st(d.amount)) + kv('Durum', pill(d.status)) + kv('Kullanıcı', ustr(d.user)) + kv('Oluşturma', EC.dateTime(d.created_at)) +
      kv('Ödeme', d.paid_at ? EC.dateTime(d.paid_at) : '—') + kv('Charge no', d.charge_id ? '<span data-action="copy" data-arg="' + esc(d.charge_id) + '" style="cursor:pointer">' + esc(d.charge_id) + '</span>' : '—') + '</dl>' +
      (d.status === 'paid' ? '<div class="a-row a-gap">' + btn('Yıldızları iade et', 'do-dep-refund', d.id, 'dan') + '</div><p class="legal">Kullanıcının bakiyesi yetersizse iade yapılamaz. İade Telegram hesabına geri gönderilir.</p>' : ''));
  }

  /* ---------- ürünler / tarifeler ---------- */
  function drawProducts() {
    var items = S.products.items;
    body().innerHTML = '<div class="a-row" style="margin-top:14px">' + btn('Yeni ürün', 'prod-new', null, 'pri') + '</div>' +
      (items.length ? items.map(function (p) {
        return '<section class="info" style="margin-top:14px"><div><h4>' + esc(p.name) + ' ' + (p.is_active ? '' : '<span class="muted">(gizli)</span>') + '</h4><p>' + esc(p.game || '—') + ' · sıra ' + p.sort_order + '</p></div>' +
          '<div class="txl" style="margin:0">' + (p.tariffs.length ? p.tariffs.map(function (t) {
            return '<div class="tx a-act" data-action="adm:tar-edit" data-arg="' + t.id + '" role="button" tabindex="0"><span class="ti">' + EC.ico('i-star') + '</span><div class="tt"><strong>' + esc(t.label) + (t.tag ? ' · ' + esc(t.tag) : '') + '</strong><span>' + (t.days ? t.days + ' gün' : 'Sınırsız') + (t.is_active ? '' : ' · gizli') + '</span></div><span class="ta">' + EC.st(t.price) + '</span></div>';
          }).join('') : '<p class="muted">Tarife yok.</p>') + '</div>' +
          '<div class="a-row">' + btn('Düzenle', 'prod-edit', p.id) + btn('Tarife ekle', 'tar-new', p.id) + btn(p.is_active ? 'Gizle' : 'Göster', 'prod-toggle', p.id) + '</div></section>';
      }).join('') : '<div class="empty"><h3>Ürün yok</h3></div>');
  }
  function findProduct(id) { return S.products.items.filter(function (p) { return p.id === id; })[0]; }
  function findTariff(id) {
    for (var i = 0; i < S.products.items.length; i++) {
      var t = S.products.items[i].tariffs.filter(function (x) { return x.id === id; })[0];
      if (t) return t;
    }
    return null;
  }
  function productForm(p) {
    p = p || {};
    EC.sheet(p.id ? 'Ürünü düzenle' : 'Yeni ürün',
      F('Ürün adı', inp('adm-name', p.name, 'Örn: Cry4me', 'text', 'maxlength="80"'), 'adm-name') +
      F('Açıklama', txa('adm-desc', p.description, 'Ürün açıklaması', 600), 'adm-desc') +
      F('Görsel adresi (https://)', inp('adm-img', p.image_url, 'https://…', 'url'), 'adm-img') +
      F('Oyun / kategori', inp('adm-game', p.game, 'Örn: Oxide Survival Island'), 'adm-game') +
      F('Sıra (küçük önce)', inp('adm-sort', p.sort_order == null ? 0 : p.sort_order, '0', 'number'), 'adm-sort') +
      F('Durum', sel('adm-active', [['1', 'Aktif'], ['0', 'Gizli']], p.is_active === false ? '0' : '1'), 'adm-active') +
      '<div class="a-row a-gap">' + btn('Kaydet', 'do-prod', p.id || '', 'pri') + '</div>');
  }
  function tariffForm(t, productId) {
    t = t || {};
    EC.sheet(t.id ? 'Tarifeyi düzenle' : 'Yeni tarife',
      F('Tarife adı', inp('adm-label', t.label, 'Örn: 30 gün', 'text', 'maxlength="40"'), 'adm-label') +
      F('Süre (gün, boş = sınırsız)', inp('adm-days', t.days, 'Örn: 30', 'number'), 'adm-days') +
      F('Fiyat (yıldız)', inp('adm-price', t.price, 'Örn: 1450', 'number'), 'adm-price') +
      F('Etiket (isteğe bağlı)', inp('adm-tag', t.tag, 'Örn: Popüler', 'text', 'maxlength="20"'), 'adm-tag') +
      F('Sıra (küçük önce)', inp('adm-sort', t.sort_order == null ? 0 : t.sort_order, '0', 'number'), 'adm-sort') +
      F('Durum', sel('adm-active', [['1', 'Aktif'], ['0', 'Gizli']], t.is_active === false ? '0' : '1'), 'adm-active') +
      '<div class="a-row a-gap">' + btn('Kaydet', 'do-tar', (t.id || '') + '|' + (productId || ''), 'pri') + '</div>' +
      '<p class="legal">Fiyat değişikliği hemen yansır; verilmiş siparişleri etkilemez.</p>');
  }

  /* ---------- promosyon kodları ---------- */
  function drawPromos() {
    var items = S.promos.items;
    body().innerHTML = '<div class="a-row" style="margin-top:14px">' + btn('Yeni kod', 'promo-new', null, 'pri') + '</div>' +
      (items.length ? '<div class="txl" style="margin-top:14px">' + items.map(function (c) {
        return '<div class="tx a-act ' + (c.is_active ? 'in' : '') + '" data-action="adm:promo-edit" data-arg="' + esc(c.code) + '" role="button" tabindex="0"><span class="ti">' + EC.ico('i-star') + '</span>' +
          '<div class="tt"><strong>' + esc(c.code) + (c.is_active ? '' : ' · kapalı') + '</strong><span>' + (c.kind === 'percent' ? '%' + c.value : c.value + ' yıldız') + ' · ' + c.used_count + (c.max_uses ? '/' + c.max_uses : '') + ' kullanım' + (c.product_name ? ' · ' + esc(c.product_name) : '') + (c.expires_at ? ' · ' + EC.dateStr(c.expires_at) + '’e kadar' : '') + '</span></div></div>';
      }).join('') + '</div>' : '<div class="empty"><h3>Kod yok</h3><p>«Yeni kod» ile ilk promosyon kodunu oluştur.</p></div>');
  }
  function promoForm(c) {
    c = c || {};
    var exp = c.expires_at ? new Date(c.expires_at).toLocaleDateString('sv-SE', { timeZone: 'Europe/Istanbul' }) : '';
    var prods = [['', 'Tüm ürünler']].concat(S.products.items.map(function (p) { return [p.id, p.name]; }));
    EC.sheet(c.code ? 'Kodu düzenle' : 'Yeni kod',
      F('Kod', inp('adm-code', c.code, 'Örn: YAZ10', 'text', 'maxlength="32" autocapitalize="characters"' + (c.code ? ' readonly' : '')), 'adm-code') +
      F('Tür', sel('adm-kind', [['percent', 'Yüzde (%)'], ['fixed', 'Sabit (yıldız)']], c.kind || 'percent'), 'adm-kind') +
      F('Değer', inp('adm-val', c.value, 'Örn: 10', 'number'), 'adm-val') +
      F('Toplam kullanım (boş = sınırsız)', inp('adm-max', c.max_uses, 'Örn: 100', 'number'), 'adm-max') +
      F('Kişi başı kullanım', inp('adm-per', c.per_user_limit || 1, '1', 'number'), 'adm-per') +
      F('Son tarih (boş = süresiz)', inp('adm-exp', exp, '', 'date'), 'adm-exp') +
      F('Ürün', sel('adm-prod', prods, c.product_id || ''), 'adm-prod') +
      F('Durum', sel('adm-active', [['1', 'Aktif'], ['0', 'Kapalı']], c.is_active === false ? '0' : '1'), 'adm-active') +
      '<div class="a-row a-gap">' + btn('Kaydet', 'do-promo', '', 'pri') + '</div>');
  }
  function promoPayload() {
    var exp = v('adm-exp');
    return {
      code: v('adm-code').trim().toUpperCase(), kind: v('adm-kind'), value: num('adm-val'), max_uses: num('adm-max'),
      per_user_limit: num('adm-per') || 1, expires_at: exp ? exp + 'T23:59:59+03:00' : null, product_id: v('adm-prod') || null, is_active: v('adm-active') === '1'
    };
  }

  /* ---------- duyuru / ayarlar / kayıt ---------- */
  function drawBcast() {
    body().innerHTML = '<section class="info"><div><h4>Toplu duyuru</h4><p>Mesaj, botu başlatmış tüm kullanıcılara Telegram üzerinden gönderilir. Engelli kullanıcılara gönderilmez.</p></div>' +
      F('Mesaj', txa('adm-text', '', 'Duyuru metni (en fazla 1000 karakter)', 1000), 'adm-text') +
      '<div class="a-row">' + btn('Herkese gönder', 'do-bcast', '', 'pri') + '</div><p class="pmsg" id="adm-prog"></p></section>';
  }
  function drawSettings(s) {
    body().innerHTML = '<section class="info" style="margin-top:14px">' +
      F('Mağaza durumu', sel('adm-maint', [['0', 'Açık'], ['1', 'Bakım modu (sipariş ve yükleme kapalı)']], s.maintenance ? '1' : '0'), 'adm-maint') +
      F('En az yükleme (yıldız)', inp('adm-dmin', s.deposit_min, '10', 'number'), 'adm-dmin') +
      F('En çok yükleme (yıldız)', inp('adm-dmax', s.deposit_max, '10000', 'number'), 'adm-dmax') +
      F('Hızlı tutarlar (virgülle)', inp('adm-pre', (s.deposit_presets || []).join(', '), '100, 500, 1000'), 'adm-pre') +
      F('Davet kazancı (%)', inp('adm-ref', s.referral_rate_percent, '25', 'number'), 'adm-ref') +
      F('Destek kullanıcı adı', inp('adm-sup', s.support_username, 'easycheatsupport'), 'adm-sup') +
      F('Sipariş sonrası bilgi metni', txa('adm-notice', s.order_notice, '', 300), 'adm-notice') +
      '<div class="a-row a-gap">' + btn('Kaydet', 'do-settings', '', 'pri') + '</div></section>';
  }
  function drawAudit() {
    var s = S.audit;
    body().innerHTML = '<p class="a-sec">' + s.total + ' kayıt</p>' + (s.items.length ? '<div class="txl">' + s.items.map(function (a) {
      var det = a.details ? Object.keys(a.details).filter(function (k) { return a.details[k] != null && a.details[k] !== ''; }).map(function (k) { return k + ': ' + (typeof a.details[k] === 'object' ? JSON.stringify(a.details[k]) : a.details[k]); }).join(' · ') : '';
      return '<div class="tx"><span class="ti">' + EC.ico('i-shield') + '</span><div class="tt"><strong>' + esc(AUDIT[a.action] || a.action) + '</strong><span>' + esc((a.actor && a.actor.username ? '@' + a.actor.username : a.actor && a.actor.first_name) || '—') + (a.target_type ? ' · ' + esc(a.target_type) + (a.target_id ? ' ' + esc(String(a.target_id).slice(0, 12)) : '') : '') + ' · ' + EC.dateTime(a.created_at) + '</span>' + (det ? '<span>' + esc(det.slice(0, 140)) + '</span>' : '') + '</div></div>';
    }).join('') + '</div>' : '<div class="empty"><h3>Kayıt yok</h3></div>') + moreBtn(s);
  }

  /* ---------- eylemler ---------- */
  function done(msg, after) { EC.toast(msg); EC.haptic('success'); EC.closeSheet(); if (after) after(); else load(true); }
  function act(name, arg, el) {
    var n = name.slice(4);
    switch (n) {
      case 'tab': setMod(arg); break;
      case 'reload': load(true); break;
      case 'goto-pending': S.orders.status = 'pending'; setMod('orders'); break;
      case 'filter':
        if (mod === 'orders') S.orders.status = arg === 'all' ? '' : arg; else S.deposits.status = arg;
        load(true); break;
      case 'search': var q = v('adm-q').trim(); if (S[mod]) S[mod].q = q; load(true); break;
      case 'more': load(false); break;
      case 'chat':
        var pr = String(arg).split('|');
        if (pr[1]) EC.openTg('https://t.me/' + pr[1]);
        else { EC.copy(pr[0]); try { window.open('tg://user?id=' + pr[0], '_blank'); } catch (e) {} EC.toast('Kullanıcı adı yok, ID kopyalandı'); }
        break;
      case 'complete': openComplete(+arg); break;
      case 'do-complete':
        run(el, EC.api('admin.order_complete', { id: +arg, license_key: v('adm-key'), note: v('adm-note') })).then(function (r) { done(r.dm ? 'Sipariş tamamlandı, kullanıcıya haber verildi' : 'Sipariş tamamlandı (kullanıcıya bot mesajı gitmedi)'); }).catch(quiet);
        break;
      case 'refund': openRefund(+arg); break;
      case 'do-refund':
        EC.confirm('Sipariş iade edilsin mi? Tutar kullanıcının bakiyesine geri yüklenir.', function () {
          run(el, EC.api('admin.order_refund', { id: +arg, reason: v('adm-note') })).then(function () { done('Sipariş iade edildi'); }).catch(quiet);
        });
        break;
      case 'user': showUser(arg); break;
      case 'adjust':
        var uid = arg;
        EC.sheet('Bakiye düzelt',
          F('Tutar (+ ekler, − düşer)', inp('adm-amt', '', 'Örn: 500 veya -200', 'number'), 'adm-amt') +
          F('Sebep (isteğe bağlı)', inp('adm-reason', '', 'Örn: Hediye'), 'adm-reason') +
          '<div class="a-row a-gap">' + btn('Uygula', 'do-adjust', uid, 'pri') + '</div>');
        break;
      case 'do-adjust':
        var amt = num('adm-amt');
        if (!amt) { EC.toast('Tutar gir'); break; }
        run(el, EC.api('admin.user_adjust', { id: +arg, amount: amt, reason: v('adm-reason') })).then(function (r) { done('Yeni bakiye: ' + EC.fmt(r.balance) + ' ⭐', function () { showUser(arg); }); }).catch(quiet);
        break;
      case 'msg':
        EC.sheet('Mesaj gönder', F('Mesaj', txa('adm-text', '', 'Kullanıcıya bot üzerinden gidecek mesaj', 1000), 'adm-text') + '<div class="a-row a-gap">' + btn('Gönder', 'do-msg', arg, 'pri') + '</div>');
        break;
      case 'do-msg':
        run(el, EC.api('admin.message', { user_id: +arg, text: v('adm-text') })).then(function () { done('Mesaj gönderildi', function () { showUser(arg); }); }).catch(quiet);
        break;
      case 'ban':
        var bp = String(arg).split('|'), banning = bp[1] === '1';
        if (banning) {
          EC.sheet('Kullanıcıyı engelle', F('Sebep (isteğe bağlı)', inp('adm-reason', '', 'Örn: Dolandırıcılık'), 'adm-reason') + '<div class="a-row a-gap">' + btn('Engelle', 'do-ban', bp[0] + '|1', 'dan') + '</div>');
        } else {
          run(el, EC.api('admin.user_ban', { id: +bp[0], banned: false })).then(function () { EC.toast('Engel kaldırıldı'); showUser(bp[0]); }).catch(quiet);
        }
        break;
      case 'do-ban':
        var dp = String(arg).split('|');
        run(el, EC.api('admin.user_ban', { id: +dp[0], banned: true, reason: v('adm-reason') })).then(function () { done('Kullanıcı engellendi', function () { showUser(dp[0]); }); }).catch(quiet);
        break;
      case 'dep': showDeposit(arg); break;
      case 'do-dep-refund':
        EC.confirm('Yıldızlar kullanıcının Telegram hesabına iade edilsin ve bakiyesinden düşülsün mü?', function () {
          run(el, EC.api('admin.deposit_refund', { id: arg })).then(function () { done('Yükleme iade edildi'); }).catch(quiet);
        });
        break;
      case 'prod-new': productForm(); break;
      case 'prod-edit': productForm(findProduct(arg)); break;
      case 'prod-toggle':
        var pp = findProduct(arg); if (!pp) break;
        run(el, EC.api('admin.product_save', { product: { id: pp.id, is_active: !pp.is_active } })).then(function () { EC.toast(pp.is_active ? 'Ürün gizlendi' : 'Ürün yayında'); load(true); }).catch(quiet);
        break;
      case 'do-prod':
        var prod = { name: v('adm-name'), description: v('adm-desc'), image_url: v('adm-img'), game: v('adm-game'), sort_order: num('adm-sort') || 0, is_active: v('adm-active') === '1' };
        if (arg) prod.id = arg;
        run(el, EC.api('admin.product_save', { product: prod })).then(function () { done('Ürün kaydedildi'); }).catch(quiet);
        break;
      case 'tar-new': tariffForm(null, arg); break;
      case 'tar-edit': tariffForm(findTariff(arg)); break;
      case 'do-tar':
        var tp = String(arg).split('|');
        var tar = { label: v('adm-label'), days: num('adm-days'), price: num('adm-price'), tag: v('adm-tag'), sort_order: num('adm-sort') || 0, is_active: v('adm-active') === '1' };
        if (tp[0]) tar.id = tp[0]; else tar.product_id = tp[1];
        if (!tar.price || tar.price < 1) { EC.toast('Geçerli bir fiyat gir'); break; }
        run(el, EC.api('admin.tariff_save', { tariff: tar })).then(function () { done('Tarife kaydedildi'); }).catch(quiet);
        break;
      case 'promo-new': promoForm(); break;
      case 'promo-edit': promoForm(S.promos.items.filter(function (c) { return c.code === arg; })[0]); break;
      case 'do-promo':
        var pl = promoPayload();
        if (!pl.value) { EC.toast('Değer gir'); break; }
        run(el, EC.api('admin.promo_save', { promo: pl })).then(function () { done('Kod kaydedildi'); }).catch(quiet);
        break;
      case 'do-settings':
        var pres = v('adm-pre').split(',').map(function (x) { return parseInt(x, 10); }).filter(function (x) { return x > 0; });
        var set = {
          maintenance: v('adm-maint') === '1', deposit_min: num('adm-dmin'), deposit_max: num('adm-dmax'), deposit_presets: pres,
          referral_rate_percent: num('adm-ref'), support_username: v('adm-sup').trim(), order_notice: v('adm-notice').trim()
        };
        run(el, EC.api('admin.settings_save', { settings: set })).then(function (r) {
          Object.keys(r).forEach(function (k) { EC.state.settings[k] = r[k]; });
          EC.toast('Ayarlar kaydedildi'); EC.haptic('success');
        }).catch(quiet);
        break;
      case 'do-bcast':
        var text = v('adm-text').trim();
        if (!text) { EC.toast('Mesaj yaz'); break; }
        EC.confirm('Bu mesaj tüm kullanıcılara gönderilsin mi?', function () { broadcast(text, el); });
        break;
    }
  }
  function broadcast(text, el) {
    var off = 0, sent = 0, failed = 0, prog = $('#adm-prog');
    if (el) el.disabled = true;
    (function next() {
      EC.api('admin.broadcast', { text: text, offset: off }).then(function (r) {
        sent += r.sent; failed += r.failed; off = r.next_offset;
        if (prog) { prog.className = 'pmsg ok'; prog.textContent = 'Gönderiliyor… ' + Math.min(off, r.total) + '/' + r.total; }
        if (r.done) {
          if (prog) prog.textContent = 'Bitti: ' + sent + ' gönderildi, ' + failed + ' ulaşmadı.';
          if (el) el.disabled = false; EC.haptic('success');
        } else next();
      }, function (e) {
        if (prog) { prog.className = 'pmsg err'; prog.textContent = e.message + ' (' + sent + ' gönderildi)'; }
        if (el) el.disabled = false;
      });
    })();
  }

  window.EasyAdmin = { mount: mount, act: act };
})();
