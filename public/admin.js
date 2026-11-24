(function () {
  'use strict';
  var EC, root, mod = 'dash', timer = null, tick = 0, busy = false;

  /* ---------- sayfa listesi: [id, ad, ikon, renk] ---------- */
  var TABS = [
    ['dash', 'Özet', 'fa-solid fa-chart-pie', '#5ea1ff'],
    ['orders', 'Siparişler', 'fa-solid fa-receipt', '#ff9f43'],
    ['users', 'Kullanıcılar', 'fa-solid fa-users', '#3fd68f'],
    ['deposits', 'Yüklemeler', 'fa-solid fa-wallet', '#f6c244'],
    ['products', 'Ürünler', 'fa-solid fa-box-open', '#a78bfa'],
    ['promos', 'Kodlar', 'fa-solid fa-ticket', '#ff6fa8'],
    ['bcast', 'Duyuru', 'fa-solid fa-bullhorn', '#ff6b6b'],
    ['i18n', 'Çeviriler', 'fa-solid fa-language', '#38bdf8'],
    ['db', 'Veritabanı', 'fa-solid fa-database', '#2dd4bf'],
    ['settings', 'Ayarlar', 'fa-solid fa-gear', '#94a3b8'],
    ['audit', 'Kayıt', 'fa-solid fa-clock-rotate-left', '#8b9bb4']
  ];
  var S = {
    dash: { data: null, sig: '' },
    orders: { status: 'pending', q: '', items: [], total: 0, sig: '', loaded: false },
    users: { q: '', items: [], total: 0, sig: '', loaded: false },
    deposits: { status: '', q: '', items: [], total: 0, sig: '', loaded: false },
    audit: { items: [], total: 0, sig: '', loaded: false },
    products: { items: [], sig: '', loaded: false },
    promos: { items: [], sig: '', loaded: false },
    settings: { data: null },
    i18n: { data: null, lang: 'tr', q: '' },
    db: { meta: null, table: 'app_users', q: '', items: [], total: 0, sig: '', loaded: false, ctlDirty: false },
    badge: 0
  };
  var AUDIT = {
    order_completed: 'Sipariş tamamlandı', order_refunded: 'Sipariş iade edildi', balance_adjusted: 'Bakiye düzeltildi',
    user_banned: 'Kullanıcı engellendi', user_unbanned: 'Engel kaldırıldı', product_created: 'Ürün eklendi', product_updated: 'Ürün güncellendi',
    tariff_created: 'Tarife eklendi', tariff_updated: 'Tarife güncellendi', promo_saved: 'Kod kaydedildi', settings_saved: 'Ayarlar kaydedildi',
    deposit_refunded: 'Yükleme iade edildi', deposit_refund_reverted: 'Yükleme iadesi geri alındı', message_sent: 'Mesaj gönderildi',
    broadcast: 'Toplu duyuru', admin_bound: 'Yönetici bağlandı', role_changed: 'Rol değiştirildi', db_saved: 'Veritabanı kaydı düzenlendi', db_deleted: 'Veritabanı kaydı silindi'
  };

  /* Not: yönetici sayfasının CSS'i artık ui.css içinde (önbellekli, geç yüklenip kalıp bozmaz, telefonda stil enjeksiyonu yok). */

  var esc = function (s) { return EC.esc(s); };
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
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
  function sheetOf(title, html, icon) { EC.sheet(title, html, null, icon || ['fa-solid fa-pen', 'blue']); }
  function skel() { return '<div class="sk row-sk"></div><div class="sk row-sk"></div><div class="sk row-sk"></div>'; }
  function errHtml(msg) { return '<div class="empty"><h3>Yüklenemedi</h3><p>' + esc(msg) + '</p><button class="btn-ghost" data-action="adm:reload">Tekrar dene</button></div>'; }
  function chips(list, cur, action) {
    return '<div class="chips" style="margin-top:14px">' + list.map(function (c) {
      return '<button class="chip" data-action="adm:' + action + '" data-arg="' + c[0] + '" aria-pressed="' + (cur === c[0]) + '">' + c[1] + '</button>';
    }).join('') + '</div>';
  }
  function searchBox(val, ph) {
    return '<div class="promo a-q"><input id="adm-q" type="text" value="' + esc(val) + '" placeholder="' + esc(ph) + '" autocomplete="off" spellcheck="false" aria-label="Ara"><button data-action="adm:search">Ara</button></div>';
  }
  function moreBtn(s) { return s.items.length < s.total ? '<button class="btn-ghost a-more" data-action="adm:more">Daha fazla (' + (s.total - s.items.length) + ')</button>' : ''; }

  /* ---------- veri katmanı: önbellek + sessiz yenileme ---------- */
  // Liste modülleri: 'reset' (ilk sayfa), 'more' (devamı), 'silent' (yüklü kadarını arka planda yenile)
  function listLoad(s, op, extra, mode) {
    var body = {};
    Object.keys(extra || {}).forEach(function (k) { if (extra[k]) body[k] = extra[k]; });
    body.offset = mode === 'more' ? s.items.length : 0;
    body.limit = mode === 'silent' ? Math.min(100, Math.max(20, s.items.length)) : 20;
    s.req = (s.req || 0) + 1;
    var my = s.req;
    return EC.api(op, body).then(function (r) {
      if (my !== s.req) return false;
      var items = mode === 'more' ? s.items.concat(r.items) : r.items;
      var sig = JSON.stringify([r.total, items]);
      var changed = sig !== s.sig || !s.loaded;
      s.items = items; s.total = r.total; s.sig = sig; s.loaded = true;
      return changed;
    });
  }
  function plainLoad(s, fn) {
    return fn().then(function (val) {
      var sig = JSON.stringify(val), changed = sig !== s.sig || !s.loaded;
      s.sig = sig; s.loaded = true;
      return { changed: changed, val: val };
    });
  }

  var M = {
    dash: {
      poll: true, ctl: function () { return ''; }, has: function () { return !!S.dash.data; },
      view: function () { return dash(S.dash.data); },
      load: function () {
        return EC.api('admin.stats').then(function (d) {
          setBadge(d.pending_orders);
          var sig = JSON.stringify(d), changed = sig !== S.dash.sig;
          S.dash.sig = sig; S.dash.data = d; return changed;
        });
      }
    },
    orders: {
      poll: true, has: function () { return S.orders.loaded; },
      ctl: function () {
        var s = S.orders;
        return chips([['pending', 'Bekleyen'], ['completed', 'Tamamlanan'], ['refunded', 'İade'], ['all', 'Hepsi']], s.status || 'all', 'filter') + searchBox(s.q, 'Sipariş no, kullanıcı adı veya ID');
      },
      view: function () {
        var s = S.orders;
        return '<p class="a-sec">' + s.total + ' sipariş</p>' +
          (s.items.length ? '<div class="a-grid">' + s.items.map(orderCard).join('') + '</div>' : '<div class="empty"><h3>Sipariş yok</h3><p>Bu filtrede sipariş bulunamadı.</p></div>') + moreBtn(s);
      },
      load: function (mode) { return listLoad(S.orders, 'admin.orders', { status: S.orders.status, q: S.orders.q }, mode); }
    },
    users: {
      poll: true, has: function () { return S.users.loaded; },
      ctl: function () { return searchBox(S.users.q, 'Ad, kullanıcı adı veya ID'); },
      view: function () {
        var s = S.users;
        return '<p class="a-sec">' + s.total + ' kullanıcı</p>' +
          (s.items.length ? '<div class="txl">' + s.items.map(function (u) {
            return '<div class="tx a-act" data-action="adm:user" data-arg="' + u.id + '" role="button" tabindex="0"><span class="ti" style="' + (u.is_admin ? 'color:#a78bfa' : '') + '">' + EC.ico(u.is_admin ? 'fa-solid fa-user-shield' : 'i-shield') + '</span>' +
              '<div class="tt"><strong>' + esc(uname(u)) + (u.is_admin ? ' · Yönetici' : '') + (u.is_banned ? ' · Engelli' : '') + '</strong><span>' + (u.username ? '@' + esc(u.username) + ' · ' : '') + u.id + ' · ' + u.orders_count + ' sipariş</span></div>' +
              '<span class="ta">' + EC.st(u.balance) + '</span></div>';
          }).join('') + '</div>' : '<div class="empty"><h3>Kullanıcı yok</h3></div>') + moreBtn(s);
      },
      load: function (mode) { return listLoad(S.users, 'admin.users', { q: S.users.q }, mode); }
    },
    deposits: {
      poll: true, has: function () { return S.deposits.loaded; },
      ctl: function () { return chips([['', 'Hepsi'], ['paid', 'Ödendi'], ['refunded', 'İade'], ['created', 'Açık']], S.deposits.status, 'filter') + searchBox(S.deposits.q, 'Kullanıcı adı, ID veya charge no'); },
      view: function () {
        var s = S.deposits;
        return '<p class="a-sec">' + s.total + ' yükleme</p>' +
          (s.items.length ? '<div class="txl">' + s.items.map(function (d) {
            return '<div class="tx a-act ' + (d.status === 'paid' ? 'in' : '') + '" data-action="adm:dep" data-arg="' + d.id + '" role="button" tabindex="0"><span class="ti">' + EC.ico('i-in') + '</span>' +
              '<div class="tt"><strong>' + esc(uname(d.user)) + '</strong><span>' + EC.dateTime(d.created_at) + ' · ' + ({ paid: 'Ödendi', refunded: 'İade edildi', created: 'Ödeme bekleniyor', failed: 'Başarısız' })[d.status] + '</span></div><span class="ta">' + EC.st(d.amount) + '</span></div>';
          }).join('') + '</div>' : '<div class="empty"><h3>Yükleme yok</h3></div>') + moreBtn(s);
      },
      load: function (mode) { return listLoad(S.deposits, 'admin.deposits', { status: S.deposits.status, q: S.deposits.q }, mode); }
    },
    audit: {
      poll: true, has: function () { return S.audit.loaded; }, ctl: function () { return ''; },
      view: function () { return drawAudit(); },
      load: function (mode) { return listLoad(S.audit, 'admin.audit', {}, mode); }
    },
    products: {
      poll: true, has: function () { return S.products.loaded; }, ctl: function () { return '<div class="a-row" style="margin-top:14px">' + btn('Yeni ürün', 'prod-new', null, 'pri') + '</div>'; },
      view: function () { return drawProducts(); },
      load: function () { return plainLoad(S.products, function () { return EC.api('admin.products'); }).then(function (r) { S.products.items = r.val; return r.changed; }); }
    },
    promos: {
      poll: true, has: function () { return S.promos.loaded; }, ctl: function () { return '<div class="a-row" style="margin-top:14px">' + btn('Yeni kod', 'promo-new', null, 'pri') + '</div>'; },
      view: function () { return drawPromos(); },
      load: function () {
        return plainLoad(S.promos, function () { return Promise.all([EC.api('admin.promos'), EC.api('admin.products')]); }).then(function (r) {
          S.promos.items = r.val[0]; S.products.items = r.val[1]; S.products.loaded = true; return r.changed;
        });
      }
    },
    bcast: { poll: false, has: function () { return true; }, ctl: function () { return ''; }, view: function () { return drawBcast(); }, load: function () { return Promise.resolve(false); } },
    settings: {
      poll: false, has: function () { return !!S.settings.data; }, ctl: function () { return ''; }, view: function () { return drawSettings(S.settings.data); },
      load: function () { return EC.api('admin.settings').then(function (d) { S.settings.data = d; return true; }); }
    },
    i18n: {
      poll: false, has: function () { return !!S.i18n.data; },
      ctl: function () {
        return chips(EC.I18N.SUPPORTED.map(function (l) { return [l, EC.I18N.NAMES[l]]; }), S.i18n.lang, 'i18n-lang') + searchBox(S.i18n.q, 'Anahtar veya metin ara');
      },
      view: function () { return drawI18n(); },
      load: function () { return EC.api('admin.i18n').then(function (d) { S.i18n.data = d; return true; }); }
    },
    db: {
      poll: true, has: function () { return !!(S.db.meta && S.db.loaded); },
      ctl: function () {
        if (!S.db.meta) return '';
        return '<div class="a-tbl">' + S.db.meta.tables.map(function (t) {
          return '<button class="chip" data-action="adm:db-table" data-arg="' + t.id + '" aria-pressed="' + (S.db.table === t.id) + '">' + EC.tile(t.icon.indexOf('fa-') === 0 ? 'fa-solid ' + t.icon : t.icon, t.color) + t.label + '</button>';
        }).join('') + '</div>' + searchBox(S.db.q, 'Ara');
      },
      view: function () { return drawDb(); },
      load: function (mode) {
        if (!S.db.meta) {
          return EC.api('admin.db_meta').then(function (m) { S.db.meta = m; S.db.ctlDirty = true; return M.db.load('reset'); });
        }
        return listLoad(S.db, 'admin.db_list', { table: S.db.table, q: S.db.q }, mode);
      }
    }
  };

  function setBadge(n) {
    S.badge = n || 0;
    var b = $('#abadge'); if (!b) return;
    b.textContent = S.badge > 99 ? '99+' : String(S.badge);
    b.hidden = !S.badge;
  }

  /* ---------- iskelet ---------- */
  function navHtml() {
    return TABS.map(function (t) {
      return '<button class="atab" data-action="adm:tab" data-arg="' + t[0] + '" aria-pressed="false" aria-label="' + t[1] + '" style="--c:' + t[3] + '">' +
        '<span class="ai"><i class="' + t[2] + '"></i></span><span class="al">' + t[1] + '</span>' + (t[0] === 'orders' ? '<i class="abadge" id="abadge" hidden>0</i>' : '') + '</button>';
    }).join('');
  }
  function syncNav(scroll) {
    // Elemanlar yeniden yazılmaz, yalnızca aria-pressed değişir: sağa doğru genişleme animasyonu böyle çalışır
    $$('.atab', root).forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-arg') === mod)); });
    setBadge(S.badge);
    if (scroll) followTab();
  }
  // Seçili sekme genişlerken sekme çubuğu onu her karede yumuşakça takip eder (smooth scrollIntoView + büyüyen öğe = telefonda takılma yapardı)
  var followRaf = 0;
  function followTab() {
    var nav = $('#adm-tabs', root);
    if (!nav || nav.scrollWidth <= nav.clientWidth + 2) return;      // bilgisayarda sekmeler sarılır, kaydırma yok
    cancelAnimationFrame(followRaf);
    var t0 = performance.now();
    (function step(t) {
      var b = $('.atab[aria-pressed="true"]', nav); if (!b) return;
      var nr = nav.getBoundingClientRect(), br = b.getBoundingClientRect();
      var want = nav.scrollLeft + (br.left - nr.left) - (nav.clientWidth - br.width) / 2;
      want = Math.max(0, Math.min(want, nav.scrollWidth - nav.clientWidth));
      if (t - t0 < 520) { nav.scrollLeft += (want - nav.scrollLeft) * 0.24; followRaf = requestAnimationFrame(step); }
      else nav.scrollLeft = want;
    })(t0);
  }
  function mount(viewEl, ec) {
    EC = ec; root = viewEl;
    if (!root.__adm) {
      root.__adm = true;
      root.addEventListener('keydown', function (e) { if (e.key === 'Enter' && e.target.id === 'adm-q') { e.preventDefault(); act('adm:search'); } });
    }
    root.innerHTML = '<div class="whead"><button class="icon-btn" data-action="nav" data-arg="profile" aria-label="Geri">' + EC.ico('i-back') + '</button>' +
      EC.ptitle('fa-solid fa-user-shield', 'purple', EC.L('row.admin'), 'in-whead') + '</div>' +
      '<nav class="anav" id="adm-tabs" aria-label="Yönetici sayfaları">' + navHtml() + '</nav><div id="adm-ctl"></div><div id="adm-list"></div>';
    syncNav(true);
    show();
    EC.animIn(root.children);
    start();
  }
  // Önceden yükleme: panel açılmadan veriler hazır olsun
  function prefetch(ec) {
    EC = ec;
    EC.api('admin.stats').then(function (d) { S.dash.data = d; S.dash.sig = JSON.stringify(d); S.badge = d.pending_orders || 0; }, quiet);
    listLoad(S.orders, 'admin.orders', { status: S.orders.status, q: S.orders.q }, 'reset').then(quiet, quiet);
  }
  function listEl() { return $('#adm-list'); }
  function show() {
    var m = M[mod], c = $('#adm-ctl'), l = listEl();
    if (!c || !l) return;
    c.innerHTML = m.ctl();
    if (m.has()) { l.innerHTML = m.view(); refreshCur(m.poll || mod === 'settings' || mod === 'i18n' ? 'silent' : 'reset', true); }
    else { l.innerHTML = skel(); refreshCur('reset'); }
  }
  // Veriyi getir; değiştiyse yalnızca liste alanını yeniden çiz (arama kutusu/odak bozulmaz)
  function refreshCur(mode, quietDraw) {
    var m = mod;
    return M[m].load(mode).then(function (changed) {
      if (mod !== m) return;
      var l = listEl(); if (!l) return;
      if (m === 'db' && S.db.ctlDirty) { S.db.ctlDirty = false; $('#adm-ctl').innerHTML = M.db.ctl(); changed = true; }
      if (changed || (!quietDraw && mode !== 'silent')) l.innerHTML = M[m].view();
    }, function (e) {
      if (mode === 'silent' || mod !== m) return;
      var l = listEl(); if (l) l.innerHTML = errHtml(e.message);
    });
  }
  function reload() { return refreshCur(M[mod].has() ? 'silent' : 'reset'); }

  /* ---------- canlı yenileme: 2,5 sn ---------- */
  function start() { stop(); timer = setInterval(poll, 4000); }
  function stop() { if (timer) { clearInterval(timer); timer = null; } }
  function poll() {
    if (!root || EC.state.view !== 'admin') { stop(); return; }
    if (document.hidden || busy || EC.state.sheet) return;
    var ae = document.activeElement;
    if (ae && /^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName) && root.contains(ae)) return; // yazarken bozma
    tick++;
    busy = true;
    var jobs = [];
    if (M[mod].poll) jobs.push(refreshCur('silent'));
    if (mod !== 'dash' && tick % 3 === 0) jobs.push(EC.api('admin.stats').then(function (d) { setBadge(d.pending_orders); S.dash.data = d; S.dash.sig = JSON.stringify(d); }, quiet));
    Promise.all(jobs).then(function () { busy = false; }, function () { busy = false; });
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
    sheetOf('Siparişi tamamla',
      '<p class="muted">#' + o.id + ' · ' + esc(o.product_name) + ' · ' + esc(o.tariff_label) + ' · ' + esc(uname(o.user)) + '</p>' +
      F('Lisans anahtarı (isteğe bağlı)', inp('adm-key', '', 'Kullanıcıya gösterilecek anahtar'), 'adm-key') +
      F('Kullanıcıya not (isteğe bağlı)', txa('adm-note', '', 'Kullanıcı bunu satın alımlarında görür'), 'adm-note') +
      '<div class="a-row a-gap">' + btn('Tamamlandı yap', 'do-complete', id, 'pri') + '</div>' +
      '<p class="legal">Kullanıcıya bot üzerinden de bildirim gider (bakım modunda gitmez).</p>', ['fa-solid fa-circle-check', 'green']);
  }
  function openRefund(id) {
    var o = findOrder(id); if (!o) return;
    sheetOf('Siparişi iade et',
      '<p class="muted">#' + o.id + ' · ' + esc(o.product_name) + ' · ' + esc(o.tariff_label) + '<br>' + esc(uname(o.user)) + ' hesabına ' + EC.st(o.price) + ' geri yüklenecek.</p>' +
      F('Kullanıcıya not (isteğe bağlı)', txa('adm-note', '', 'Örn: stok yok'), 'adm-note') +
      '<div class="a-row a-gap">' + btn('İade et', 'do-refund', id, 'dan') + '</div>', ['fa-solid fa-rotate-left', 'red']);
  }

  /* ---------- kullanıcılar ---------- */
  function showUser(id) {
    EC.api('admin.user', { id: +id }).then(function (r) {
      var u = r.user;
      var kv = function (k, val) { return '<dt>' + k + '</dt><dd>' + val + '</dd>'; };
      var html = '<dl class="a-kv">' + kv('ID', u.id) + kv('Kullanıcı adı', u.username ? '@' + esc(u.username) : '—') + kv('Rol', u.is_admin ? 'Yönetici' : 'Kullanıcı') + kv('Bakiye', EC.st(u.balance)) +
        kv('Toplam yükleme', EC.st(u.total_deposited)) + kv('Toplam harcama', EC.st(u.total_spent)) + kv('Katılım', EC.dateTime(u.created_at)) + kv('Son görülme', EC.dateTime(u.last_seen_at)) +
        kv('Davet eden', r.referrer ? esc(uname(r.referrer)) : '—') + kv('Davet ettikleri', r.referral.count + ' kişi · ' + EC.st(r.referral.earned)) +
        kv('Durum', u.is_banned ? 'Engelli' + (u.ban_reason ? ' (' + esc(u.ban_reason) + ')' : '') : 'Aktif') + '</dl>' +
        '<div class="a-row a-gap">' + btn('Telegram’da yaz', 'chat', u.id + '|' + (u.username || '')) + btn('Mesaj gönder', 'msg', u.id) + '</div>' +
        '<div class="a-row a-gap">' + btn('Bakiye düzelt', 'adjust', u.id) + (u.is_admin ? '' : btn(u.is_banned ? 'Engeli kaldır' : 'Engelle', 'ban', u.id + '|' + (u.is_banned ? 0 : 1), u.is_banned ? '' : 'dan')) + '</div>' +
        '<div class="a-row a-gap">' + btn(u.is_admin ? '<i class="fa-solid fa-user-minus"></i> Yöneticiliği al' : '<i class="fa-solid fa-user-shield"></i> Yönetici yap', 'role', u.id + '|' + (u.is_admin ? 0 : 1), u.is_admin ? 'dan' : 'pri') + '</div>' +
        '<p class="a-sec">Son siparişler</p><div class="txl">' + (r.orders.length ? r.orders.map(function (o) {
          return '<div class="tx"><span class="ti">' + EC.ico('i-receipt') + '</span><div class="tt"><strong>#' + o.id + ' · ' + esc(o.product_name) + ' · ' + esc(o.tariff_label) + '</strong><span>' + EC.dateTime(o.created_at) + ' · ' + ({ pending: 'Bekliyor', completed: 'Tamamlandı', refunded: 'İade' })[o.status] + '</span></div><span class="ta">' + EC.st(o.price) + '</span></div>';
        }).join('') : '<p class="muted">Sipariş yok.</p>') + '</div>' +
        '<p class="a-sec">Son hareketler</p><div class="txl">' + (r.transactions.length ? r.transactions.map(function (t) {
          return '<div class="tx ' + (t.amount > 0 ? 'in' : '') + '"><span class="ti">' + EC.ico(t.amount > 0 ? 'i-in' : 'i-out') + '</span><div class="tt"><strong>' + esc(t.title) + '</strong><span>' + EC.dateTime(t.created_at) + '</span></div><span class="ta">' + (t.amount > 0 ? '+' : '−') + EC.st(Math.abs(t.amount)) + '</span></div>';
        }).join('') : '<p class="muted">Hareket yok.</p>') + '</div>';
      sheetOf(esc(uname(u)), html, [u.is_admin ? 'fa-solid fa-user-shield' : 'fa-solid fa-user', u.is_admin ? 'purple' : 'green']);
    }).catch(function (e) { EC.toast(e.message); });
  }

  /* ---------- yüklemeler ---------- */
  function showDeposit(id) {
    var d = S.deposits.items.filter(function (x) { return x.id === id; })[0]; if (!d) return;
    var kv = function (k, val) { return '<dt>' + k + '</dt><dd>' + val + '</dd>'; };
    sheetOf('Yükleme', '<dl class="a-kv">' + kv('Tutar', EC.st(d.amount)) + kv('Durum', pill(d.status)) + kv('Kullanıcı', ustr(d.user)) + kv('Oluşturma', EC.dateTime(d.created_at)) +
      kv('Ödeme', d.paid_at ? EC.dateTime(d.paid_at) : '—') + kv('Charge no', d.charge_id ? '<span data-action="copy" data-arg="' + esc(d.charge_id) + '" style="cursor:pointer">' + esc(d.charge_id) + '</span>' : '—') + '</dl>' +
      (d.status === 'paid' ? '<div class="a-row a-gap">' + btn('Yıldızları iade et', 'do-dep-refund', d.id, 'dan') + '</div><p class="legal">Kullanıcının bakiyesi yetersizse iade yapılamaz. İade Telegram hesabına geri gönderilir.</p>' : ''), ['fa-solid fa-wallet', 'gold']);
  }

  /* ---------- ürünler / tarifeler ---------- */
  function drawProducts() {
    var items = S.products.items;
    return items.length ? '<div class="a-grid" style="margin-top:14px">' + items.map(function (p) {
      return '<section class="info"><div><h4>' + esc(p.name) + ' ' + (p.is_active ? '' : '<span class="muted">(gizli)</span>') + '</h4><p>' + esc(p.game || '—') + ' · sıra ' + p.sort_order + '</p></div>' +
        '<div class="txl" style="margin:0">' + (p.tariffs.length ? p.tariffs.map(function (t) {
          return '<div class="tx a-act" data-action="adm:tar-edit" data-arg="' + t.id + '" role="button" tabindex="0"><span class="ti">' + EC.ico('i-star') + '</span><div class="tt"><strong>' + esc(t.label) + (t.tag ? ' · ' + esc(t.tag) : '') + '</strong><span>' + (t.days ? t.days + ' gün' : 'Sınırsız') + (t.is_active ? '' : ' · gizli') + '</span></div><span class="ta">' + EC.st(t.price) + '</span></div>';
        }).join('') : '<p class="muted">Tarife yok.</p>') + '</div>' +
        '<div class="a-row">' + btn('Düzenle', 'prod-edit', p.id) + btn('Tarife ekle', 'tar-new', p.id) + btn(p.is_active ? 'Gizle' : 'Göster', 'prod-toggle', p.id) + '</div></section>';
    }).join('') + '</div>' : '<div class="empty"><h3>Ürün yok</h3></div>';
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
    sheetOf(p.id ? 'Ürünü düzenle' : 'Yeni ürün',
      F('Ürün adı', inp('adm-name', p.name, 'Örn: Cry4me', 'text', 'maxlength="80"'), 'adm-name') +
      F('Açıklama', txa('adm-desc', p.description, 'Ürün açıklaması', 600), 'adm-desc') +
      F('Görsel adresi (https://)', inp('adm-img', p.image_url, 'https://…', 'url'), 'adm-img') +
      F('Oyun / kategori', inp('adm-game', p.game, 'Örn: Oxide Survival Island'), 'adm-game') +
      F('Sıra (küçük önce)', inp('adm-sort', p.sort_order == null ? 0 : p.sort_order, '0', 'number'), 'adm-sort') +
      F('Durum', sel('adm-active', [['1', 'Aktif'], ['0', 'Gizli']], p.is_active === false ? '0' : '1'), 'adm-active') +
      '<div class="a-row a-gap">' + btn('Kaydet', 'do-prod', p.id || '', 'pri') + '</div>', ['fa-solid fa-box-open', 'purple']);
  }
  function tariffForm(t, productId) {
    t = t || {};
    sheetOf(t.id ? 'Tarifeyi düzenle' : 'Yeni tarife',
      F('Tarife adı', inp('adm-label', t.label, 'Örn: 30 gün', 'text', 'maxlength="40"'), 'adm-label') +
      F('Süre (gün, boş = sınırsız)', inp('adm-days', t.days, 'Örn: 30', 'number'), 'adm-days') +
      F('Fiyat (yıldız)', inp('adm-price', t.price, 'Örn: 1450', 'number'), 'adm-price') +
      F('Etiket (isteğe bağlı)', inp('adm-tag', t.tag, 'Örn: Popüler', 'text', 'maxlength="20"'), 'adm-tag') +
      F('Sıra (küçük önce)', inp('adm-sort', t.sort_order == null ? 0 : t.sort_order, '0', 'number'), 'adm-sort') +
      F('Durum', sel('adm-active', [['1', 'Aktif'], ['0', 'Gizli']], t.is_active === false ? '0' : '1'), 'adm-active') +
      '<div class="a-row a-gap">' + btn('Kaydet', 'do-tar', (t.id || '') + '|' + (productId || ''), 'pri') + '</div>' +
      '<p class="legal">Fiyat değişikliği hemen yansır; verilmiş siparişleri etkilemez.</p>', ['fa-solid fa-tags', 'gold']);
  }

  /* ---------- promosyon kodları ---------- */
  function drawPromos() {
    var items = S.promos.items;
    return items.length ? '<div class="txl" style="margin-top:14px">' + items.map(function (c) {
      return '<div class="tx a-act ' + (c.is_active ? 'in' : '') + '" data-action="adm:promo-edit" data-arg="' + esc(c.code) + '" role="button" tabindex="0"><span class="ti">' + EC.ico('fa-solid fa-ticket') + '</span>' +
        '<div class="tt"><strong>' + esc(c.code) + (c.is_active ? '' : ' · kapalı') + '</strong><span>' + (c.kind === 'percent' ? '%' + c.value : c.value + ' yıldız') + ' · ' + c.used_count + (c.max_uses ? '/' + c.max_uses : '') + ' kullanım' + (c.product_name ? ' · ' + esc(c.product_name) : '') + (c.expires_at ? ' · ' + EC.dateStr(c.expires_at) + '’e kadar' : '') + '</span></div></div>';
    }).join('') + '</div>' : '<div class="empty"><h3>Kod yok</h3><p>«Yeni kod» ile ilk promosyon kodunu oluştur.</p></div>';
  }
  function promoForm(c) {
    c = c || {};
    var exp = c.expires_at ? new Date(c.expires_at).toLocaleDateString('sv-SE', { timeZone: 'Europe/Istanbul' }) : '';
    var prods = [['', 'Tüm ürünler']].concat(S.products.items.map(function (p) { return [p.id, p.name]; }));
    sheetOf(c.code ? 'Kodu düzenle' : 'Yeni kod',
      F('Kod', inp('adm-code', c.code, 'Örn: YAZ10', 'text', 'maxlength="32" autocapitalize="characters"' + (c.code ? ' readonly' : '')), 'adm-code') +
      F('Tür', sel('adm-kind', [['percent', 'Yüzde (%)'], ['fixed', 'Sabit (yıldız)']], c.kind || 'percent'), 'adm-kind') +
      F('Değer', inp('adm-val', c.value, 'Örn: 10', 'number'), 'adm-val') +
      F('Toplam kullanım (boş = sınırsız)', inp('adm-max', c.max_uses, 'Örn: 100', 'number'), 'adm-max') +
      F('Kişi başı kullanım', inp('adm-per', c.per_user_limit || 1, '1', 'number'), 'adm-per') +
      F('Son tarih (boş = süresiz)', inp('adm-exp', exp, '', 'date'), 'adm-exp') +
      F('Ürün', sel('adm-prod', prods, c.product_id || ''), 'adm-prod') +
      F('Durum', sel('adm-active', [['1', 'Aktif'], ['0', 'Kapalı']], c.is_active === false ? '0' : '1'), 'adm-active') +
      '<div class="a-row a-gap">' + btn('Kaydet', 'do-promo', '', 'pri') + '</div>', ['fa-solid fa-ticket', 'pink']);
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
    return '<section class="info"><div><h4>Toplu duyuru</h4><p>Mesaj, botu başlatmış tüm kullanıcılara Telegram üzerinden gönderilir. Engelli kullanıcılara gönderilmez. Duyurular kendiliğinden silinmez.</p></div>' +
      F('Mesaj', txa('adm-text', '', 'Duyuru metni (en fazla 1000 karakter)', 1000), 'adm-text') +
      '<div class="a-row">' + btn('Herkese gönder', 'do-bcast', '', 'pri') + '</div><p class="pmsg" id="adm-prog"></p></section>';
  }
  function drawSettings(s) {
    return '<section class="info" style="margin-top:14px">' +
      F('Mağaza durumu', sel('adm-maint', [['0', 'Açık'], ['1', 'Bakım modu (sipariş/yükleme kapalı, bildirimler durur)']], s.maintenance ? '1' : '0'), 'adm-maint') +
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
    return '<p class="a-sec">' + s.total + ' kayıt</p>' + (s.items.length ? '<div class="txl">' + s.items.map(function (a) {
      var det = a.details ? Object.keys(a.details).filter(function (k) { return a.details[k] != null && a.details[k] !== ''; }).map(function (k) { return k + ': ' + (typeof a.details[k] === 'object' ? JSON.stringify(a.details[k]) : a.details[k]); }).join(' · ') : '';
      return '<div class="tx"><span class="ti">' + EC.ico('i-shield') + '</span><div class="tt"><strong>' + esc(AUDIT[a.action] || a.action) + '</strong><span>' + esc((a.actor && a.actor.username ? '@' + a.actor.username : a.actor && a.actor.first_name) || '—') + (a.target_type ? ' · ' + esc(a.target_type) + (a.target_id ? ' ' + esc(String(a.target_id).slice(0, 12)) : '') : '') + ' · ' + EC.dateTime(a.created_at) + '</span>' + (det ? '<span>' + esc(det.slice(0, 140)) + '</span>' : '') + '</div></div>';
    }).join('') + '</div>' : '<div class="empty"><h3>Kayıt yok</h3></div>') + moreBtn(s);
  }

  /* ---------- çeviriler ---------- */
  function i18nEffective(lang, key) {
    var o = S.i18n.data && S.i18n.data[lang] && S.i18n.data[lang][key];
    return o != null ? o : EC.I18N.DICT[lang][key];
  }
  function drawI18n() {
    var lang = S.i18n.lang, q = S.i18n.q.toLowerCase(), D = EC.I18N.DICT, ov = (S.i18n.data && S.i18n.data[lang]) || {};
    var keys = EC.I18N.keys().filter(function (k) {
      if (!q) return true;
      return k.toLowerCase().indexOf(q) > -1 || String(i18nEffective(lang, k) || '').toLowerCase().indexOf(q) > -1;
    });
    var changedAll = {};
    EC.I18N.SUPPORTED.forEach(function (l) { Object.keys((S.i18n.data && S.i18n.data[l]) || {}).forEach(function (k) { changedAll[k] = true; }); });
    return '<p class="a-hint">Bir satıra dokun: üç dildeki metni düzenle. Boş bırakıp kaydedersen varsayılana döner. <b>{parametreleri}</b> ve bot mesajlarındaki <b>&lt;b&gt;</b> gibi etiketleri bozma.</p>' +
      '<p class="a-sec">' + keys.length + ' metin · ' + Object.keys(ov).length + ' düzenlenmiş (' + EC.I18N.NAMES[lang] + ')</p>' +
      (keys.length ? '<div class="txl">' + keys.map(function (k) {
        var txt = String(i18nEffective(lang, k) || '').replace(/<[^>]+>/g, '').replace(/\n/g, ' ');
        return '<div class="tx a-act ' + (changedAll[k] ? 'in' : '') + '" data-action="adm:i18n-edit" data-arg="' + esc(k) + '" role="button" tabindex="0"><span class="ti">' + EC.ico(changedAll[k] ? 'i-check' : 'i-lang') + '</span>' +
          '<div class="tt"><strong>' + esc(k) + '</strong><span>' + esc(txt.length > 110 ? txt.slice(0, 110) + '…' : txt) + '</span></div></div>';
      }).join('') + '</div>' : '<div class="empty"><h3>Sonuç yok</h3></div>');
  }
  function openI18n(key) {
    var langs = EC.I18N.SUPPORTED;
    var fields = langs.map(function (l) {
      return F(EC.I18N.NAMES[l], txa('i18n-' + l, i18nEffective(l, key), EC.I18N.DICT[l][key] || '', 2000), 'i18n-' + l);
    }).join('');
    sheetOf(esc(key), fields + '<div class="a-row a-gap">' + btn('Kaydet', 'do-i18n', key, 'pri') + btn('Varsayılana dön', 'reset-i18n', key, 'dan') + '</div>', ['fa-solid fa-language', 'cyan']);
  }

  /* ---------- basit veritabanı ---------- */
  function dbCfg() { return S.db.meta.tables.filter(function (t) { return t.id === S.db.table; })[0]; }
  function fval(f, val) {
    if (val == null || val === '') return '—';
    if (f.opts) { var o = f.opts.filter(function (x) { return String(x[0]) === String(val); })[0]; return o ? o[1] : String(val); }
    if (f.t === 'date') return EC.dateTime(val);
    return String(val);
  }
  function drawDb() {
    if (!S.db.meta) return skel();
    var cfg = dbCfg(), s = S.db;
    var head = '<p class="a-sec">' + s.total + ' kayıt · ' + esc(cfg.label) + (cfg.insert ? '' : ' · yeni kayıt eklenemez') + '</p>' +
      (cfg.insert ? '<div class="a-row" style="margin-bottom:10px">' + btn('Yeni kayıt', 'db-new', null, 'pri') + '</div>' : '');
    return head + (s.items.length ? '<div class="txl">' + s.items.map(function (row, i) {
      var title = cfg.main.map(function (k) { return row[k]; }).filter(function (x) { return x != null && x !== ''; }).join(' · ') || '—';
      var sub = cfg.fields.filter(function (f) { return f.list && cfg.main.indexOf(f.k) < 0; }).map(function (f) {
        var s = String(fval(f, row[f.k]));
        return f.l.split(' —')[0] + ': ' + (s.length > 90 ? s.slice(0, 90) + '…' : s);
      }).join(' · ');
      return '<div class="tx a-act" data-action="adm:db-edit" data-arg="' + i + '" role="button" tabindex="0"><span class="ti" style="color:' + cfg.color + '">' + EC.ico('fa-solid fa-pen') + '</span>' +
        '<div class="tt"><strong>' + esc(title) + '</strong><span>' + esc(sub) + '</span></div></div>';
    }).join('') + '</div>' : '<div class="empty"><h3>Kayıt yok</h3></div>') + moreBtn(s);
  }
  function dbForm(row) {
    var cfg = dbCfg(), editing = !!row, ro = '', form = '';
    row = row || {};
    cfg.fields.forEach(function (f) {
      var locked = f.ro || (editing && (f.pk || f.ins));
      if (locked) { if (editing) ro += '<dt>' + esc(f.l.split(' —')[0]) + '</dt><dd>' + esc(fval(f, row[f.k])) + '</dd>'; return; }
      var id = 'db-' + f.k, cur = row[f.k];
      var ctl;
      if (f.opts) ctl = sel(id, f.opts, cur == null ? '' : cur);
      else if (f.t === 'textarea') ctl = txa(id, cur, '', f.max || 500);
      else ctl = inp(id, cur, '', f.t === 'int' ? 'number' : 'text', f.max ? 'maxlength="' + f.max + '"' : '');
      form += F(esc(f.l), ctl, id);
    });
    var idx = editing ? S.db.items.indexOf(row) : -1;
    sheetOf(esc(editing ? cfg.label + ' · düzenle' : cfg.label + ' · yeni kayıt'),
      (ro ? '<dl class="a-kv a-ro">' + ro + '</dl>' : '') + form +
      '<div class="a-row a-gap">' + btn('Kaydet', 'do-db', idx, 'pri') + (editing && cfg.del ? btn(cfg.id === 'translations' ? 'Varsayılana dön' : 'Sil', 'do-db-del', idx, 'dan') : '') + '</div>' +
      (cfg.id === 'app_users' ? '<p class="legal">Rol ve engel değişiklikleri korumalı işlemlerle yapılır (son yönetici ve kendi yöneticiliğin alınamaz).</p>' : ''),
      [cfg.icon.indexOf('fa-') === 0 ? 'fa-solid ' + cfg.icon : cfg.icon, cfg.color]);
  }
  function dbPk(cfg, row) { var pk = {}; cfg.pk.forEach(function (k) { pk[k] = row[k]; }); return pk; }
  function dbCollect(cfg, row) {
    var data = {};
    cfg.fields.forEach(function (f) {
      var editing = !!row, locked = f.ro || (editing && (f.pk || f.ins));
      if (locked) return;
      var val = v('db-' + f.k);
      if (editing) { if (String(row[f.k] == null ? '' : row[f.k]) !== val) data[f.k] = val; }
      else if (val !== '' || f.ins) data[f.k] = val;
    });
    return data;
  }

  /* ---------- eylemler ---------- */
  function done(msg, after) { EC.toast(msg); EC.haptic('success'); EC.closeSheet(); if (after) after(); else reload(); }
  function resetList(s) { s.items = []; s.sig = ''; s.loaded = false; }
  function act(name, arg, el) {
    var n = name.slice(4);
    switch (n) {
      case 'tab': if (arg !== mod) { mod = arg; syncNav(true); show(); window.scrollTo(0, 0); } break;
      case 'reload': refreshCur('reset'); break;
      case 'goto-pending': S.orders.status = 'pending'; resetList(S.orders); mod = 'orders'; syncNav(true); show(); break;
      case 'filter':
        if (mod === 'orders') { S.orders.status = arg === 'all' ? '' : arg; resetList(S.orders); } else { S.deposits.status = arg; resetList(S.deposits); }
        show(); break;
      case 'search': var q = v('adm-q').trim(); if (mod === 'i18n') { S.i18n.q = q; listEl().innerHTML = drawI18n(); break; } if (S[mod]) { S[mod].q = q; resetList(S[mod]); } show(); break;
      case 'more': refreshCur('more'); break;
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
        sheetOf('Bakiye düzelt',
          F('Tutar (+ ekler, − düşer)', inp('adm-amt', '', 'Örn: 500 veya -200', 'number'), 'adm-amt') +
          F('Sebep (isteğe bağlı)', inp('adm-reason', '', 'Örn: Hediye'), 'adm-reason') +
          '<div class="a-row a-gap">' + btn('Uygula', 'do-adjust', uid, 'pri') + '</div>', ['fa-solid fa-coins', 'gold']);
        break;
      case 'do-adjust':
        var amt = num('adm-amt');
        if (!amt) { EC.toast('Tutar gir'); break; }
        run(el, EC.api('admin.user_adjust', { id: +arg, amount: amt, reason: v('adm-reason') })).then(function (r) { done('Yeni bakiye: ' + EC.fmt(r.balance) + ' ⭐', function () { resetList(S.users); showUser(arg); }); }).catch(quiet);
        break;
      case 'role':
        var rp = String(arg).split('|'), makeAdmin = rp[1] === '1';
        EC.confirm(makeAdmin ? 'Bu kişi yönetici yapılsın mı? Tüm yönetim paneline erişir.' : 'Bu kişinin yöneticiliği alınsın mı?', function () {
          run(el, EC.api('admin.user_role', { id: +rp[0], admin: makeAdmin })).then(function () {
            EC.toast(makeAdmin ? 'Yönetici yapıldı' : 'Yöneticilik alındı'); EC.haptic('success'); resetList(S.users); showUser(rp[0]);
          }).catch(quiet);
        });
        break;
      case 'msg':
        sheetOf('Mesaj gönder', F('Mesaj', txa('adm-text', '', 'Kullanıcıya bot üzerinden gidecek mesaj', 1000), 'adm-text') + '<div class="a-row a-gap">' + btn('Gönder', 'do-msg', arg, 'pri') + '</div>', ['fa-solid fa-paper-plane', 'cyan']);
        break;
      case 'do-msg':
        run(el, EC.api('admin.message', { user_id: +arg, text: v('adm-text') })).then(function () { done('Mesaj gönderildi', function () { showUser(arg); }); }).catch(quiet);
        break;
      case 'ban':
        var bp = String(arg).split('|'), banning = bp[1] === '1';
        if (banning) {
          sheetOf('Kullanıcıyı engelle', F('Sebep (isteğe bağlı)', inp('adm-reason', '', 'Örn: Dolandırıcılık'), 'adm-reason') + '<div class="a-row a-gap">' + btn('Engelle', 'do-ban', bp[0] + '|1', 'dan') + '</div>', ['fa-solid fa-ban', 'red']);
        } else {
          run(el, EC.api('admin.user_ban', { id: +bp[0], banned: false })).then(function () { EC.toast('Engel kaldırıldı'); resetList(S.users); showUser(bp[0]); }).catch(quiet);
        }
        break;
      case 'do-ban':
        var dp = String(arg).split('|');
        run(el, EC.api('admin.user_ban', { id: +dp[0], banned: true, reason: v('adm-reason') })).then(function () { done('Kullanıcı engellendi', function () { resetList(S.users); showUser(dp[0]); }); }).catch(quiet);
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
        run(el, EC.api('admin.product_save', { product: { id: pp.id, is_active: !pp.is_active } })).then(function () { EC.toast(pp.is_active ? 'Ürün gizlendi' : 'Ürün yayında'); reload(); }).catch(quiet);
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
          S.settings.data = r;
          Object.keys(r).forEach(function (k) { EC.state.settings[k] = r[k]; });
          EC.toast(r.maintenance ? 'Bakım modu AÇIK' : 'Ayarlar kaydedildi'); EC.haptic('success');
        }).catch(quiet);
        break;
      case 'do-bcast':
        var text = v('adm-text').trim();
        if (!text) { EC.toast('Mesaj yaz'); break; }
        EC.confirm('Bu mesaj tüm kullanıcılara gönderilsin mi?', function () { broadcast(text, el); });
        break;
      /* çeviriler */
      case 'i18n-lang': S.i18n.lang = arg; $('#adm-ctl').innerHTML = M.i18n.ctl(); listEl().innerHTML = drawI18n(); break;
      case 'i18n-edit': openI18n(arg); break;
      case 'do-i18n':
        var items = [];
        EC.I18N.SUPPORTED.forEach(function (l) {
          var val = v('i18n-' + l), def = EC.I18N.DICT[l][arg], cur = (S.i18n.data && S.i18n.data[l] && S.i18n.data[l][arg]) || null;
          if (val.trim() === '' || val === def) { if (cur != null) items.push({ lang: l, key: arg, value: '' }); }
          else if (val !== (cur != null ? cur : def)) items.push({ lang: l, key: arg, value: val });
        });
        if (!items.length) { EC.toast('Değişiklik yok'); break; }
        saveI18n(items, el);
        break;
      case 'reset-i18n':
        var ri = [];
        EC.I18N.SUPPORTED.forEach(function (l) { if (S.i18n.data && S.i18n.data[l] && S.i18n.data[l][arg] != null) ri.push({ lang: l, key: arg, value: '' }); });
        if (!ri.length) { EC.toast('Zaten varsayılan'); break; }
        saveI18n(ri, el);
        break;
      /* veritabanı */
      case 'db-table': S.db.table = arg; S.db.q = ''; resetList(S.db); S.db.ctlDirty = false; show(); break;
      case 'db-edit': var rw = S.db.items[+arg]; if (rw) dbForm(rw); break;
      case 'db-new': dbForm(null); break;
      case 'do-db':
        var cfg = dbCfg(), row0 = +arg >= 0 && arg !== '' && arg != null ? S.db.items[+arg] : null;
        var data = dbCollect(cfg, row0);
        if (row0 && !Object.keys(data).length) { EC.toast('Değişiklik yok'); break; }
        run(el, EC.api('admin.db_save', { table: cfg.id, pk: row0 ? dbPk(cfg, row0) : undefined, data: data })).then(function () {
          done('Kaydedildi', function () { resetList(S.db); reloadHard(); });
        }).catch(quiet);
        break;
      case 'do-db-del':
        var cfg2 = dbCfg(), row2 = S.db.items[+arg];
        if (!row2) break;
        EC.confirm(cfg2.id === 'translations' ? 'Bu çeviri varsayılan metne döndürülsün mü?' : 'Bu kayıt silinsin mi? Geri alınamaz.', function () {
          run(el, EC.api('admin.db_delete', { table: cfg2.id, pk: dbPk(cfg2, row2) })).then(function () { done('Silindi', function () { resetList(S.db); reloadHard(); }); }).catch(quiet);
        });
        break;
    }
  }
  function reloadHard() { refreshCur('reset'); }
  function saveI18n(items, el) {
    run(el, EC.api('admin.i18n_save', { items: items })).then(function () {
      var d = S.i18n.data || {};
      items.forEach(function (it) {
        d[it.lang] = d[it.lang] || {};
        if (it.value) d[it.lang][it.key] = it.value; else delete d[it.lang][it.key];
      });
      S.i18n.data = d;
      EC.I18N.setOverrides(d);
      EC.toast('Çeviri kaydedildi — kullanıcılara birkaç saniyede yansır'); EC.haptic('success'); EC.closeSheet();
      var l = listEl(); if (l && mod === 'i18n') l.innerHTML = drawI18n();
    }).catch(quiet);
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

  window.EasyAdmin = { mount: mount, act: act, prefetch: prefetch };
})();
