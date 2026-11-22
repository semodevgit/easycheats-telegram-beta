(function () {
  'use strict';
  var TG = (window.Telegram && window.Telegram.WebApp) || null;
  var INIT = (TG && TG.initData) || '';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var fmt = function (n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); };
  var FA = {
    'i-chev': 'fa-solid fa-chevron-right', 'i-back': 'fa-solid fa-chevron-left', 'i-copy': 'fa-regular fa-copy',
    'i-star': 'fa-solid fa-star', 'i-star-o': 'fa-regular fa-star', 'i-receipt': 'fa-solid fa-receipt',
    'i-bell': 'fa-regular fa-bell', 'i-lang': 'fa-solid fa-language', 'i-game': 'fa-solid fa-gamepad',
    'i-check': 'fa-solid fa-check', 'i-send': 'fa-solid fa-paper-plane', 'i-help': 'fa-regular fa-circle-question',
    'i-spin': 'fa-solid fa-circle-notch fa-spin', 'i-plus': 'fa-solid fa-plus', 'i-wallet': 'fa-solid fa-wallet',
    'i-in': 'fa-solid fa-arrow-down', 'i-out': 'fa-solid fa-arrow-up', 'i-alert': 'fa-solid fa-circle-exclamation',
    'i-shield': 'fa-solid fa-shield-halved'
  };
  var ico = function (id, cls) { return '<i class="ico ' + (FA[id] || id) + ' ' + (cls || '') + '" aria-hidden="true"></i>'; };
  var STAR = ico('i-star', 'gold');
  var st = function (n) { return '<span class="stv"><span class="num">' + fmt(n) + '</span>' + STAR + '</span>'; };
  var logo = function (s) { return '<svg class="logo" width="' + s + '" height="' + s + '" viewBox="0 0 40 40" aria-hidden="true"><use href="#logo"/></svg>'; };
  var reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var EASE = 'cubic-bezier(.22,1,.36,1)';

  /* ---------- hareket yardımcıları (Web Animations API) ---------- */
  function play(el, frames, opts) {
    if (reduce || !el || !el.animate) return null;
    return el.animate(frames, opts);
  }
  function animIn(list) {
    if (reduce) return;
    Array.prototype.forEach.call(list, function (el, i) {
      if (!el.animate) return;
      el.animate(
        [{ opacity: 0, transform: 'translate3d(0,16px,0)' }, { opacity: 1, transform: 'translate3d(0,0,0)' }],
        { duration: 620, delay: Math.min(i, 8) * 50, easing: EASE, fill: 'backwards' }
      );
    });
  }
  function pop(el) { play(el, [{ transform: 'scale(.9)' }, { transform: 'scale(1.05)', offset: .55 }, { transform: 'scale(1)' }], { duration: 420, easing: EASE }); }
  function swap(el) { play(el, [{ opacity: 0, transform: 'translate3d(0,8px,0)' }, { opacity: 1, transform: 'none' }], { duration: 380, easing: EASE }); }
  function shake(el) {
    play(el, [{ transform: 'none' }, { transform: 'translateX(-7px)', offset: .2 }, { transform: 'translateX(6px)', offset: .4 }, { transform: 'translateX(-4px)', offset: .6 }, { transform: 'translateX(2px)', offset: .8 }, { transform: 'none' }], { duration: 420, easing: 'ease-out' });
  }
  function tween(from, to, dur, cb) {
    if (reduce || from === to || !dur) { cb(to); return function () {}; }
    var t0 = performance.now(), id = 0;
    (function step(t) {
      var k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 4);
      cb(from + (to - from) * e);
      if (k < 1) id = requestAnimationFrame(step);
    })(t0);
    return function () { cancelAnimationFrame(id); };
  }
  var io = ('IntersectionObserver' in window) ? new IntersectionObserver(function (es) {
    es.forEach(function (e) { e.target.classList.toggle('paused', !e.isIntersecting); });
  }, { rootMargin: '120px 0px' }) : null;
  function watchArt(root) {
    if (!io) return;
    $$('.flow:not(.still), .gift-art', root).forEach(function (el) { io.observe(el); });
  }

  /* ---------- sanat ---------- */
  function artFlow(still) {
    return '<svg class="art flow' + (still ? ' still' : '') + '" viewBox="0 0 320 220" preserveAspectRatio="xMidYMid slice" aria-hidden="true">' +
      '<rect width="320" height="220" fill="url(#gBg)"/><g fill="none" stroke="url(#gLine)" stroke-linecap="round">' +
      '<circle class="ring r1" cx="226" cy="96" r="70" stroke-width="2" stroke-dasharray="6 10" opacity=".6"/>' +
      '<circle class="ring r2" cx="226" cy="96" r="44" stroke-width="2.5" stroke-dasharray="40 14"/>' +
      '<circle class="core" cx="226" cy="96" r="6" stroke-width="3"/>' +
      '<path class="tick" d="M226 14v32M226 146v32M144 96h32M276 96h32" stroke-width="2.5"/>' +
      '<path class="w1" d="M-10 168C50 120 100 214 170 160S270 120 340 150" stroke-width="3" stroke-dasharray="14 12"/>' +
      '<path class="w2" d="M-10 188C60 146 110 232 180 182S280 146 340 172" stroke-width="2" stroke-dasharray="10 14" opacity=".55"/>' +
      '<path class="w3" d="M-10 148C40 104 96 190 160 138S262 98 340 128" stroke-width="2" stroke-dasharray="6 16" opacity=".4"/>' +
      '</g></svg>';
  }
  function artGift() {
    return '<svg class="gift-art" viewBox="0 0 200 180" aria-hidden="true"><g class="gift">' +
      '<rect class="gbox" x="92" y="70" width="92" height="104" rx="8"/><rect class="gtop" x="84" y="58" width="108" height="30" rx="8"/><rect class="grib" x="124" y="58" width="24" height="116"/>' +
      '<path class="gbow" d="M136 58c-34-34-62-24-46-6 10 12 34 8 46 6zM136 58c34-34 62-24 46-6-10 12-34 8-46 6z"/>' +
      '<g class="g2"><rect class="gbox" x="14" y="108" width="70" height="66" rx="7"/><rect class="gtop" x="8" y="98" width="82" height="22" rx="7"/><rect class="grib" x="38" y="98" width="18" height="76"/>' +
      '<path class="gbow" d="M47 98c-22-22-44-14-32 0 8 9 24 6 32 0zM47 98c22-22 44-14 32 0-8 9-24 6-32 0z"/></g></g></svg>';
  }

  /* ---------- tema ---------- */
  var THEMES = [
    { id: 'mono', name: 'Siyah Beyaz', bg: '#0a0a0a', s: '#272727', a: '#ffffff' },
    { id: 'purple', name: 'Siyah Mor', bg: '#0a0a0a', s: '#272727', a: '#8e7ee9' },
    { id: 'blue', name: 'Siyah Mavi', bg: '#0a0a0a', s: '#272727', a: '#4d8ff0' },
    { id: 'green', name: 'Siyah Yeşil', bg: '#0a0a0a', s: '#272727', a: '#2bb57a' }
  ];
  function themeById(id) { return THEMES.filter(function (t) { return t.id === id; })[0] || THEMES[0]; }
  function syncMeta(id) {
    var m = $('meta[name="theme-color"]'); if (m) m.setAttribute('content', themeById(id).bg);
    if (TG) { try { TG.setHeaderColor(themeById(id).bg); TG.setBackgroundColor(themeById(id).bg); } catch (e) {} }
  }

  /* ---------- durum ---------- */
  var state = {
    view: 'catalog', tab: 'all', product: null, tariff: null, quote: null, promoCode: '',
    balance: 0, theme: document.documentElement.getAttribute('data-theme') || 'mono',
    sheet: null, paying: false, paid: null, need: null, depositing: false, booted: false,
    me: null, admin: false, products: [], settings: {}, tx: [], purchases: [], notes: [], unread: 0,
    ref: { count: 0, earned: 0 }, invite: null, bot: null, custom: null
  };
  var view = $('#view'), sheet = $('#sheet'), scrim = $('#scrim'), toastEl = $('#toast');

  function applyTheme(id) {
    if (id === 'mono') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', id);
    state.theme = id;
    syncMeta(id);
    $$('.theme-opt', sheet).forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-arg') === id)); });
    try { localStorage.setItem('eac-theme', id); } catch (e) {}
  }
  function setTheme(id) {
    if (id === state.theme) return;
    if (document.startViewTransition && !reduce) {
      try { document.startViewTransition(function () { applyTheme(id); }); return; } catch (e) {}
    }
    applyTheme(id);
  }

  /* ---------- yardımcılar ---------- */
  var toastTimer;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('on'); }, 2600);
  }
  function copy(text) {
    function fallback() {
      try {
        var ta = document.createElement('textarea');
        ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.select();
        var ok = document.execCommand('copy');
        document.body.removeChild(ta);
        toast(ok ? 'Kopyalandı' : 'Seçip elle kopyala');
      } catch (e) { toast('Seçip elle kopyala'); }
    }
    try { navigator.clipboard.writeText(text).then(function () { toast('Kopyalandı'); }, fallback); } catch (e) { fallback(); }
  }
  function haptic(kind) {
    try {
      if (!TG || !TG.HapticFeedback) return;
      if (kind === 'light') TG.HapticFeedback.impactOccurred('light');
      else TG.HapticFeedback.notificationOccurred(kind);
    } catch (e) {}
  }
  function openTg(url) {
    try { if (TG && TG.openTelegramLink && /^https:\/\/t\.me\//.test(url)) { TG.openTelegramLink(url); return; } } catch (e) {}
    window.open(url, '_blank');
  }
  function askConfirm(msg, cb) {
    try { if (TG && TG.showConfirm) { TG.showConfirm(msg, function (ok) { if (ok) cb(); }); return; } } catch (e) {}
    if (window.confirm(msg)) cb();
  }
  function dateStr(iso) {
    var d = new Date(iso);
    return isNaN(d) ? '' : d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
  }
  function dateTime(iso) {
    var d = new Date(iso);
    return isNaN(d) ? '' : d.toLocaleString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  }
  function supportName() { return (state.settings && state.settings.support_username) || 'easycheatsupport'; }
  function fullName() {
    var u = state.me || {};
    var n = [u.first_name, u.last_name].filter(Boolean).join(' ').trim();
    return n || (u.username ? '@' + u.username : 'Kullanıcı');
  }

  /* ---------- API ---------- */
  function api(op, body) {
    var payload = {};
    Object.keys(body || {}).forEach(function (k) { payload[k] = body[k]; });
    payload.op = op;
    return fetch('/api', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'tma ' + INIT },
      body: JSON.stringify(payload)
    }).then(function (r) {
      return r.json().then(function (j) { return { r: r, j: j }; }, function () { return { r: r, j: null }; });
    }, function () {
      var e = new Error('İnternet bağlantını kontrol et.'); e.code = 'network'; throw e;
    }).then(function (x) {
      if (x.j && x.j.ok) return x.j.data;
      var e = new Error((x.j && x.j.message) || 'Bir sorun oluştu, tekrar dene.');
      e.code = x.j && x.j.error; e.status = x.r.status;
      if (x.r.status === 401 && state.booted) renderGate('error', e.message);
      throw e;
    });
  }

  function applyMe(me) {
    state.me = me.user; state.balance = me.user.balance; state.admin = !!me.user.is_admin;
    state.purchases = me.orders || [];
    state.tx = (me.transactions || []).map(function (t) {
      return { type: t.amount > 0 ? 'in' : 'out', title: t.title, amount: Math.abs(t.amount), date: dateStr(t.created_at) };
    });
    state.notes = me.notifications || []; state.unread = me.unread || 0;
    state.ref = me.referral || { count: 0, earned: 0 };
  }
  var refreshing = false;
  function refreshMe() {
    if (refreshing || !state.booted) return Promise.resolve();
    refreshing = true;
    var sig = JSON.stringify([state.purchases, state.balance, state.unread, state.tx.length]);
    return api('refresh').then(function (r) {
      refreshing = false; applyMe(r.me);
      if (sig !== JSON.stringify([state.purchases, state.balance, state.unread, state.tx.length])) repaint();
    }, function () { refreshing = false; });
  }
  function repaint() {
    var v = state.view;
    if (v === 'purchases') { var pl = $('#plist'); if (pl) pl.innerHTML = listHtml(); updateCounts(); }
    else if (v === 'profile') { var b = $('#bal-num'); if (b) b.textContent = fmt(state.balance); }
    else if (v === 'wallet') {
      var wb = $('#w-bal'); if (wb) wb.textContent = fmt(state.balance);
      var tl = $('#tx-list'); if (tl) tl.innerHTML = txListHtml();
      syncAmount();
    }
    var bell = $('#bell');
    if (bell) {
      var dot = $('.dot', bell);
      if (state.unread > 0 && !dot) bell.insertAdjacentHTML('beforeend', '<i class="dot"></i>');
      if (state.unread === 0 && dot) dot.remove();
    }
  }

  /* ---------- ürün / fiyat ---------- */
  function product() { return state.products.filter(function (p) { return p.id === state.product; })[0] || null; }
  function tariff() { var p = product(); return p ? (p.tariffs.filter(function (t) { return t.id === state.tariff; })[0] || null) : null; }
  function defaultTariff(p) { return (p.tariffs.filter(function (t) { return t.tag === 'Popüler'; })[0] || p.tariffs[0]).id; }
  function minPrice(p) { return Math.min.apply(null, p.tariffs.map(function (t) { return t.price; })); }
  function priceNow() {
    var t = tariff(); if (!t) return 0;
    var q = state.quote;
    return (q && q.tariff_id === t.id) ? q.final_price : t.price;
  }

  /* ---------- katalog ---------- */
  function headerHtml(actions) {
    return '<header class="top"><div class="brand"><span class="brand-name" aria-label="EasyCheats"><b class="b1" aria-hidden="true">Easy</b><b class="b2" aria-hidden="true">Cheats</b></span></div>' +
      (actions ? '<div class="top-actions">' +
        '<button class="icon-btn" data-action="toast" data-arg="Dil: Türkçe" aria-label="Dil">' + ico('i-lang') + '</button>' +
        '<button class="icon-btn" id="bell" data-action="open-notes" aria-label="Bildirimler">' + ico('i-bell') + (state.unread > 0 ? '<i class="dot"></i>' : '') + '</button>' +
        '</div>' : '') + '</header>';
  }
  function productCard(p) {
    var mp = minPrice(p);
    return '<article class="pcard cat-item" data-action="open-product" data-arg="' + esc(p.id) + '" tabindex="0" role="button" aria-label="' + esc(p.name) + ', ' + fmt(mp) + ' yıldızdan başlayan fiyatlarla. Tarifeleri aç">' +
      (p.image_url
        ? '<img class="pcard-img" src="' + esc(p.image_url) + '" alt="' + esc(p.name) + '" loading="eager" decoding="async" draggable="false">'
        : '<div class="pimg">' + artFlow(true) + '</div>') +
      '<div class="pcap"><strong>' + esc(p.name) + '</strong><span class="pcap-sub"><span class="pr">' + st(mp) + '</span><em>dan başlayan fiyatlarla</em></span></div></article>';
  }
  function catalogView() {
    return headerHtml(true) +
      '<section class="hero cat-item">' +
      '<svg class="hero-stripes" viewBox="0 0 985 522" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="gStripe" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--stripe-a)"/><stop offset="1" style="stop-color:var(--stripe-b)"/></linearGradient></defs>' +
      '<polygon points="482,522 797,0 935,0 622,522" fill="url(#gStripe)"/><polygon points="962,0 985,0 985,522 649,522" fill="url(#gStripe)"/></svg>' +
      '<img class="hero-soldier" src="https://shop.cry4me.best/img/hero.webp" alt="" decoding="async" draggable="false">' +
      '<h2>Kendi<br><span class="accent">tarifeni</span> seç</h2><p>Anahtar, sipariş onaylanınca görünür.</p></section>' +
      (state.products.length ? state.products.map(productCard).join('') :
        '<div class="empty cat-item">' + ico('i-star') + '<h3>Şu an ürün yok</h3><p>Yeni ürünler çok yakında burada olacak.</p></div>');
  }

  /* ---------- satın alımlar ---------- */
  function buyCard(p) {
    var pill = p.status === 'completed' ? '<span class="pill on">Aktif</span>'
      : p.status === 'pending' ? '<span class="pill wait">Bekliyor</span>'
      : '<span class="pill" style="background:var(--surface-3);color:var(--muted)">İade edildi</span>';
    var body;
    if (p.status === 'completed') {
      body = (p.license_key
        ? '<div class="key" data-action="copy" data-arg="' + esc(p.license_key) + '" role="button" tabindex="0" aria-label="Anahtarı kopyala" title="Kopyalamak için dokun"><code>' + esc(p.license_key) + '</code></div>' +
          (p.admin_note ? '<p class="muted">' + esc(p.admin_note) + '</p>' : '') +
          '<button class="btn-ghost" data-action="open-activate">Nasıl etkinleştirilir</button>'
        : '<p class="muted">' + esc(p.admin_note || 'Siparişin tamamlandı.') + '</p>');
    } else if (p.status === 'pending') {
      body = '<p class="muted">Siparişin alındı. Destek, Telegram üzerinden seninle iletişime geçecek.</p>' +
        '<button class="btn-ghost" data-action="check" data-arg="' + p.id + '">Durumu kontrol et</button>';
    } else {
      body = '<p class="muted">Tutar bakiyene iade edildi.' + (p.admin_note ? ' ' + esc(p.admin_note) : '') + '</p>';
    }
    return '<article class="buy" data-id="' + p.id + '"><div class="buy-top"><div class="thumb">' + artFlow(true) + '</div>' +
      '<div class="buy-info"><h3>' + esc(p.product_name) + '</h3><p><span>' + esc(p.tariff_label) + '</span><span>·</span>' + st(p.price) + '<span>·</span><span>' + dateStr(p.created_at) + '</span></p></div>' + pill + '</div>' + body + '</article>';
  }
  function filtered() {
    var all = state.purchases;
    if (state.tab === 'active') return all.filter(function (p) { return p.status === 'completed'; });
    if (state.tab === 'pending') return all.filter(function (p) { return p.status === 'pending'; });
    return all;
  }
  function listHtml() {
    var list = filtered();
    return list.length ? list.map(buyCard).join('') :
      '<div class="empty">' + ico('i-receipt') + '<h3>Burada henüz bir şey yok</h3><p>Katalogdan bir tarife seç, siparişin bu listede görünür.</p><button class="btn-ghost" data-action="nav" data-arg="catalog">Kataloğa git</button></div>';
  }
  function counts() {
    var all = state.purchases;
    return {
      all: all.length,
      active: all.filter(function (p) { return p.status === 'completed'; }).length,
      pending: all.filter(function (p) { return p.status === 'pending'; }).length
    };
  }
  function updateCounts() {
    var c = counts();
    $$('[data-count]').forEach(function (el) {
      var v = String(c[el.getAttribute('data-count')]);
      if (el.textContent !== v) { el.textContent = v; pop(el); }
    });
  }
  function purchasesView() {
    var c = counts();
    var tab = function (id, label) {
      return '<button role="tab" data-action="tab" data-arg="' + id + '" aria-selected="' + (state.tab === id) + '">' + label + '<span class="count" data-count="' + id + '">' + c[id] + '</span></button>';
    };
    var k = ['all', 'active', 'pending'].indexOf(state.tab);
    return '<h1 class="h1">Satın Alımlarım</h1>' +
      '<div class="seg" role="tablist" id="seg" style="--k:' + k + '"><span class="knob"></span>' + tab('all', 'Tümü') + tab('active', 'Aktif') + tab('pending', 'Bekleyen') + '</div>' +
      '<div class="list" id="plist">' + listHtml() + '</div>';
  }
  function setTab(id) {
    state.tab = id;
    $('#seg').style.setProperty('--k', ['all', 'active', 'pending'].indexOf(id));
    $$('#seg button').forEach(function (b) { b.setAttribute('aria-selected', String(b.getAttribute('data-arg') === id)); });
    var pl = $('#plist');
    pl.innerHTML = listHtml();
    animIn(pl.children);
  }

  /* ---------- profil ---------- */
  function refRate() { var r = state.settings.referral_rate_percent; return r == null ? 25 : r; }
  function profileView() {
    var u = state.me || {};
    var row = function (action, label) {
      return '<button class="row" data-action="' + (action === 'wallet' ? 'nav" data-arg="wallet' : action) + '"><span class="grow">' + label + '</span>' + ico('i-chev', 'chev') + '</button>';
    };
    var adminRow = state.admin
      ? '<button class="row" data-action="nav" data-arg="admin"><span class="grow">Yönetici paneli<small>Siparişler, kullanıcılar, ayarlar</small></span>' + ico('i-chev', 'chev') + '</button>' : '';
    return '<h1 class="h1">Profil</h1>' +
      '<section class="pro"><div class="pro-top"><div class="avatar">' + logo(60) + '</div><div style="min-width:0"><h2>' + esc(fullName()) + '</h2><p>' + (u.username ? '@' + esc(u.username) : 'ID: ' + esc(u.id)) + '</p></div></div>' +
      '<div class="pro-id"><div class="bal"><span class="bal-ico">' + STAR + '</span><div><strong id="bal-num">' + fmt(state.balance) + '</strong><span class="bal-lbl">Bakiye</span></div></div>' +
      '<button class="chip-btn" data-action="nav" data-arg="wallet">' + ico('i-plus') + 'Yükle</button></div></section>' +
      '<section class="invite">' + artGift() + '<h2>Arkadaşlarını davet et, <em>%' + refRate() + '</em> kazan</h2><p>Arkadaşının her alışverişinden</p>' +
      '<button class="pill-btn" data-action="open-invite">Arkadaş davet et ' + ico('i-chev') + '</button></section>' +
      '<div class="rows">' + adminRow + row('wallet', 'Cüzdan') + row('open-support', 'Destek') + row('open-activate', 'Nasıl etkinleştirilir') + row('open-faq', 'Sık sorulan sorular') + row('open-terms', 'Kullanıcı sözleşmesi') + row('open-settings', 'Ayarlar') + '</div>';
  }

  /* ---------- cüzdan ---------- */
  var amtCancel = null;
  function presets() { return (state.settings.deposit_presets && state.settings.deposit_presets.length) ? state.settings.deposit_presets : [100, 500, 1000, 2500, 5000]; }
  function needShort() { return state.need ? Math.max(0, state.need.price - state.balance) : 0; }
  function needHtml() {
    var n = state.need, short = needShort();
    if (short > 0) {
      return '<div class="need"><span class="ni">' + ico('i-alert') + '</span><div><h3>' + esc(n.label) + ' için ' + st(short) + ' eksik</h3>' +
        '<p>Tutarı senin için doldurduk. Yükle, sonra satın almaya dön.</p></div></div>';
    }
    return '<div class="need ok"><span class="ni">' + ico('i-check') + '</span><div><h3>Bakiyen yeterli</h3>' +
      '<p>' + esc(n.label) + ' için gereken ' + st(n.price) + ' hazır.</p></div></div>';
  }
  function txRow(t) {
    var inn = t.type === 'in';
    return '<div class="tx ' + t.type + '"><span class="ti">' + ico(inn ? 'i-in' : 'i-out') + '</span>' +
      '<div class="tt"><strong>' + esc(t.title) + '</strong><span>' + t.date + '</span></div>' +
      '<span class="ta">' + (inn ? '+' : '−') + st(t.amount) + '</span></div>';
  }
  function txListHtml() {
    return state.tx.length ? state.tx.map(txRow).join('') :
      '<div class="empty">' + ico('i-receipt') + '<h3>Henüz hareket yok</h3><p>Yüklemelerin ve harcamaların burada görünür.</p></div>';
  }
  function walletView() {
    var short = needShort();
    var chips = (short > 0 ? '<button class="chip need-chip" data-action="amt" data-arg="' + short + '" aria-pressed="false">' + st(short) + '<small>eksik</small></button>' : '') +
      presets().map(function (v) {
        return '<button class="chip" data-action="amt" data-arg="' + v + '" aria-pressed="false">' + st(v) + '</button>';
      }).join('');
    return '<div class="whead"><button class="icon-btn" data-action="nav" data-arg="profile" aria-label="Geri">' + ico('i-back') + '</button><h1 class="h1">Cüzdan</h1></div>' +
      '<section class="wcard" id="wcard"><span class="w-lbl">Bakiye</span>' +
      '<div class="w-bal"><span class="bal-ico" id="w-star">' + STAR + '</span><strong id="w-bal">' + fmt(state.balance) + '</strong></div>' +
      '<p class="w-sub">Telegram Stars · satın alımlarda kullanılır</p></section>' +
      '<div class="collapse' + (state.need ? ' open' : '') + '" id="need-wrap"><div class="inner" id="need-box">' + (state.need ? needHtml() : '') + '</div></div>' +
      '<div class="collapse" id="back-wrap" inert><div class="inner"><button class="btn-ghost back-buy" data-action="back-to-buy">Satın almaya dön</button></div></div>' +
      '<section class="dep"><p class="dep-t">Yıldız yükle</p>' +
      '<label class="amt" id="amt-card" for="w-amt"><input id="w-amt" type="text" inputmode="numeric" autocomplete="off" placeholder="0" maxlength="6" aria-label="Yüklenecek yıldız miktarı">' + STAR + '</label>' +
      '<div class="chips wchips" role="group" aria-label="Hızlı miktar">' + chips + '</div>' +
      '<div class="after"><span>Yeni bakiye</span><strong id="w-after">' + fmt(state.balance) + '</strong></div>' +
      '<button class="btn" id="w-dep" data-action="deposit"><span class="lbl" id="w-dep-lbl">Miktar gir</span><span class="wait">' + ico('i-spin') + 'İşleniyor…</span></button>' +
      '<p class="legal" style="margin-top:12px">Ödeme Telegram Stars ile alınır. Yıldızlar ödemeden hemen sonra bakiyene eklenir.</p></section>' +
      '<p class="wlabel">Hareketler</p><div class="txl" id="tx-list">' + txListHtml() + '</div>';
  }
  function amtVal() { var i = $('#w-amt'); return i ? (parseInt(i.value, 10) || 0) : 0; }
  function syncAmount() {
    var a = amtVal(), lbl = $('#w-dep-lbl'), after = $('#w-after');
    if (!lbl) return;
    lbl.innerHTML = a ? 'Yükle <span class="num">' + fmt(a) + '</span>' + STAR : 'Miktar gir';
    after.textContent = fmt(state.balance + a);
    $$('.wchips .chip').forEach(function (c) { c.setAttribute('aria-pressed', String(a > 0 && +c.getAttribute('data-arg') === a)); });
  }
  function setAmount(v, animate, done) {
    var inp = $('#w-amt'); if (!inp) return;
    if (amtCancel) amtCancel();
    amtCancel = tween(amtVal(), v, animate ? 800 : 0, function (x) {
      inp.value = Math.round(x) ? String(Math.round(x)) : '';
      syncAmount();
      if (x === v && done) done();
    });
    if (!animate) { inp.value = v ? String(v) : ''; syncAmount(); }
  }
  function syncNeed() {
    var nw = $('#need-wrap'), bw = $('#back-wrap'); if (!nw) return;
    if (!state.need) { nw.classList.remove('open'); bw.classList.remove('open'); bw.inert = true; return; }
    var box = $('#need-box'); box.innerHTML = needHtml(); swap(box);
    nw.classList.add('open');
    bw.classList.toggle('open', needShort() === 0); bw.inert = needShort() !== 0;
    $$('.need-chip').forEach(function (c) { c.style.display = needShort() === 0 ? 'none' : ''; });
  }
  function walletInit() {
    var short = needShort();
    if (state.need && short > 0) {
      setTimeout(function () {
        if (state.view !== 'wallet') return;
        setAmount(short, true, function () { var c = $('#amt-card'); if (c) pop(c); });
      }, reduce ? 0 : 500);
    } else {
      setAmount(0, false);
    }
    syncNeed();
  }
  function goWalletNeed() {
    var p = product(), t = tariff();
    if (!p || !t) return;
    state.need = { label: p.name + ' · ' + t.label, price: priceNow(), code: state.promoCode, productId: p.id, tariffId: t.id };
    closeSheet();
    if (location.hash.replace('#', '') === 'wallet') { state.view = ''; route(); } else location.hash = 'wallet';
  }

  /* Stars ile yükleme: fatura -> Telegram ödeme penceresi -> sunucu onayı bekle -> bakiye */
  function depositDone() {
    state.depositing = false;
    var b = $('#w-dep'); if (b) { b.classList.remove('busy'); b.disabled = false; }
  }
  function finishDeposit(dv) {
    var from = state.balance;
    api('refresh').then(function (r) {
      applyMe(r.me); depositDone(); haptic('success');
      toast(fmt(dv) + ' yıldız yüklendi');
      if (state.view !== 'wallet') return;
      var wb = $('#w-bal'), wc = $('#wcard');
      tween(from, state.balance, 900, function (v) { if (wb) wb.textContent = fmt(v); });
      if (wc) { wc.classList.remove('flash'); void wc.offsetWidth; wc.classList.add('flash'); }
      pop($('#w-star'));
      var tl = $('#tx-list'); if (tl) { tl.innerHTML = txListHtml(); animIn(tl.children); }
      setAmount(0, true);
      syncNeed();
    }, function () { depositDone(); toast('Ödeme alındı, bakiyen birazdan güncellenecek'); });
  }
  function waitDeposit(id, dv) {
    var tries = 0;
    (function poll() {
      api('deposit_status', { id: id }).then(function (r) {
        if (r.status === 'paid') { finishDeposit(dv); return; }
        if (++tries > 40) { depositDone(); toast('Ödeme alındı, bakiyen birazdan güncellenecek'); refreshMe(); return; }
        setTimeout(poll, 1500);
      }, function () {
        if (++tries > 40) { depositDone(); refreshMe(); return; }
        setTimeout(poll, 2000);
      });
    })();
  }
  function startDeposit(dv) {
    var dbtn = $('#w-dep');
    state.depositing = true; dbtn.classList.add('busy'); dbtn.disabled = true;
    api('invoice', { amount: dv }).then(function (d) {
      if (!TG || typeof TG.openInvoice !== 'function') throw new Error('Bu Telegram sürümü ödemeyi desteklemiyor. Telegram’ı güncelle.');
      TG.openInvoice(d.url, function (status) {
        if (status === 'paid') waitDeposit(d.deposit_id, dv);
        else if (status === 'pending') { toast('Ödeme işleniyor…'); waitDeposit(d.deposit_id, dv); }
        else { depositDone(); toast(status === 'cancelled' ? 'Ödeme iptal edildi' : 'Ödeme tamamlanamadı'); }
      });
    }).catch(function (e) { depositDone(); toast(e.message); });
  }

  /* ---------- sayfa yükleme / yönlendirme ---------- */
  function setDock() {
    var cur = (state.view === 'wallet' || state.view === 'admin') ? 'profile' : state.view;
    ['purchases', 'catalog', 'profile'].forEach(function (id) {
      var b = $('#tab-' + id);
      if (id === cur) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
  }
  function fitBrand() {
    var n = $('.brand-name'); if (!n) return;
    n.style.fontSize = '';
    var fs = parseFloat(getComputedStyle(n).fontSize);
    while (n.scrollWidth > n.clientWidth + 1 && fs > 11) { fs -= .5; n.style.fontSize = fs + 'px'; }
  }
  window.addEventListener('resize', fitBrand);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitBrand);
  if (document.fonts && document.fonts.load) document.fonts.load('400 30px "Dela Gothic One"').then(fitBrand, function () {});

  var loadingHtml = function () { return '<div class="empty" style="margin-top:40vh;transform:translateY(-50%)">' + logo(56) + '<h3>Yükleniyor…</h3></div>'; };
  var adminPromise = null;
  function loadAdmin() {
    if (window.EasyAdmin) return Promise.resolve();
    if (!adminPromise) {
      adminPromise = new Promise(function (res, rej) {
        var s = document.createElement('script');
        s.src = '/admin.js?v=1'; s.onload = res; s.onerror = function () { adminPromise = null; rej(new Error('admin_load')); };
        document.head.appendChild(s);
      });
    }
    return adminPromise;
  }
  function mount() {
    var v = state.view;
    if (v === 'admin') {
      view.innerHTML = loadingHtml();
      loadAdmin().then(function () {
        if (state.view === 'admin') window.EasyAdmin.mount(view, window.EC);
      }, function () { toast('Yönetici paneli yüklenemedi'); location.hash = 'profile'; });
      syncBack();
      return;
    }
    view.innerHTML = v === 'purchases' ? purchasesView() : v === 'profile' ? profileView() : v === 'wallet' ? walletView() : catalogView();
    animIn(view.children);
    if (v === 'purchases') animIn($('#plist').children);
    watchArt(view);
    if (v === 'wallet') walletInit();
    fitBrand();
    syncBack();
    if (state.booted && v !== 'catalog') refreshMe();
  }
  var navTimer;
  function route(first) {
    if (!state.booted) return;
    var h = location.hash.replace('#', '');
    var v = ['catalog', 'purchases', 'profile', 'wallet', 'admin'].indexOf(h) > -1 ? h : 'catalog';
    if (v === 'admin' && !state.admin) v = 'catalog';
    if (first) { state.view = v; setDock(); mount(); return; }
    if (v === state.view) { window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' }); return; }
    state.view = v; setDock();
    clearTimeout(navTimer);
    view.classList.add('leaving');
    navTimer = setTimeout(function () {
      mount(); window.scrollTo(0, 0);
      view.classList.remove('leaving');
    }, reduce ? 0 : 160);
  }

  /* Telegram geri tuşu */
  function syncBack() {
    if (!TG || !TG.BackButton) return;
    try {
      if (state.sheet || state.view !== 'catalog') TG.BackButton.show(); else TG.BackButton.hide();
    } catch (e) {}
  }
  function onBack() {
    if (state.sheet) { closeSheet(); return; }
    if (state.view === 'wallet' || state.view === 'admin') { location.hash = 'profile'; return; }
    location.hash = 'catalog';
  }

  /* ---------- ürün alt sayfası ---------- */
  var shown = 0, cancelTotal = null;
  function shortAmt() { return Math.max(0, priceNow() - state.balance); }
  function shortBtn() { return ico('i-wallet') + '<span>' + st(shortAmt() || 1) + ' yükle</span>'; }
  function payNote() {
    var low = priceNow() > state.balance;
    return (low ? 'Yetersiz bakiye · ' : 'Bakiye · ') + st(state.balance);
  }
  function updatePayState() {
    var c = $('#paycard', sheet); if (!c) return;
    var isLow = priceNow() > state.balance;
    c.classList.toggle('low', isLow);
    var tw = $('#topup-wrap', sheet);
    if (tw) { tw.classList.toggle('open', isLow); tw.inert = !isLow; }
    if (isLow) { var tb = $('#topup-btn', sheet); if (tb) tb.innerHTML = shortBtn(); }
    $('#paynote', sheet).innerHTML = payNote();
  }
  function updateTotal(animate) {
    var nums = $$('[data-num]', sheet);
    if (!nums.length) return;
    var to = priceNow(), from = shown;
    var set = function (v) { shown = v; var t = fmt(v); nums.forEach(function (n) { n.textContent = t; }); };
    if (cancelTotal) cancelTotal();
    cancelTotal = tween(from, to, animate ? 520 : 0, set);
    updatePayState();
  }
  function licHtml() {
    var t = tariff(); if (!t) return '';
    var title = t.days ? 'Lisans süresi — ' + t.days + ' gün' : 'Lisans — sınırsız';
    var sub = t.days ? 'Süre, anahtarın etkinleştirildiği andan başlar.' : 'Süre sınırı olmadan geçerlidir.';
    return '<h4>' + title + '</h4><p>' + sub + '</p>';
  }
  function setPmsg(ok, text) {
    var el = $('#pmsg'); if (!el) return;
    el.className = 'pmsg ' + (ok ? 'ok' : 'err');
    el.textContent = text;
    swap(el);
  }
  function applyPromo(code) {
    var tid = state.tariff;
    return api('quote', { tariff_id: tid, code: code }).then(function (q) {
      if (state.tariff !== tid || state.sheet !== 'product') return;
      state.quote = q; state.promoCode = q.promo_code || '';
      setPmsg(true, 'Kod uygulandı: −' + fmt(q.discount) + ' yıldız indirim');
      updateTotal(true);
    }, function (e) {
      if (state.tariff !== tid || state.sheet !== 'product') return;
      state.quote = null; state.promoCode = '';
      setPmsg(false, e.message || 'Kod geçersiz.');
      var pin = $('#promo-input'); if (pin) shake(pin);
      updateTotal(true);
    });
  }
  function productSheet() {
    var p = product();
    if (!p) return '<div class="grab"></div><div class="empty"><h3>Ürün bulunamadı</h3></div>';
    if (state.paid) {
      var o = state.paid;
      var notice = state.settings.order_notice || 'Siparişin onaylanması için destek seninle Telegram üzerinden iletişime geçecek.';
      return '<div class="grab"></div><div class="done"><div class="ok">' + ico('i-check') + '</div><h3>Sipariş alındı</h3>' +
        '<p>' + esc(notice) + '</p>' +
        '<p>#' + o.id + ' · ' + esc(o.product_name) + ' · ' + esc(o.tariff_label) + '</p>' +
        '<p>Kalan bakiye: ' + st(state.balance) + '</p>' +
        '<button class="btn" data-action="goto-purchases"><span class="lbl">Satın alımları aç</span></button></div>';
    }
    var tar = p.tariffs.map(function (x) {
      return '<button class="tariff" data-action="tariff" data-arg="' + esc(x.id) + '" aria-pressed="' + (x.id === state.tariff) + '">' +
        (x.tag ? '<span class="tag">' + esc(x.tag) + '</span>' : '') + '<strong>' + esc(x.label) + '</strong><span class="price">' + st(x.price) + '</span></button>';
    }).join('');
    var low = priceNow() > state.balance;
    return '<div class="grab"></div>' +
      '<div class="phero">' + (p.image_url ? '<img class="pcard-img" src="' + esc(p.image_url) + '" alt="' + esc(p.name) + '" decoding="async" draggable="false">' : artFlow(true)) + '</div>' +
      '<h2 class="sh-name">' + esc(p.name) + '</h2>' +
      '<p class="sh-desc">' + esc(p.description) + '</p>' +
      '<p class="label">Tarife</p><div class="tariffs">' + tar + '</div>' +
      '<div class="info"><div><h4>Nasıl teslim edilir?</h4><p>Sipariş verdikten sonra destek seninle Telegram’dan iletişime geçer. Sipariş tamamlanınca anahtarın «Satın Alımlarım» bölümünde görünür.</p></div><div id="lic">' + licHtml() + '</div></div>' +
      '<p class="label">Ödeme yöntemi</p>' +
      '<div class="paycard' + (low ? ' low' : '') + '" id="paycard"><span class="pc-ico">' + STAR + '</span>' +
      '<div class="pc-txt"><strong>Telegram Stars</strong><span id="paynote">' + payNote() + '</span></div>' +
      '<span class="pc-tick">' + ico('i-check') + '</span></div>' +
      '<div class="collapse' + (low ? ' open' : '') + '" id="topup-wrap"' + (low ? '' : ' inert') + '><div class="inner"><button class="btn-ghost topup-btn" id="topup-btn" data-action="to-wallet-need">' + shortBtn() + '</button></div></div>' +
      '<div class="collapse open" id="promo-link-wrap"><div class="inner"><button class="link" data-action="toggle-promo">Promosyon kodun var mı?</button></div></div>' +
      '<div class="collapse" id="promo-wrap"><div class="inner"><div class="promo"><input id="promo-input" type="text" autocomplete="off" autocapitalize="characters" spellcheck="false" maxlength="32" placeholder="Promosyon kodu" aria-label="Promosyon kodu"><button data-action="apply-promo">Uygula</button></div><p class="pmsg" id="pmsg"></p></div></div>' +
      '<div class="total"><span>Toplam</span><strong><span class="num" data-num>0</span>' + STAR + '</strong></div>' +
      '<div class="paybar">' +
      '<div class="pay"><button class="btn" id="pay-btn" data-action="pay"><span class="lbl">Öde <span class="num" data-num>0</span>' + STAR + '</span><span class="wait">' + ico('i-spin') + 'İşleniyor…</span></button></div></div>' +
      '<p class="legal">«Öde»ye dokunarak kullanıcı sözleşmesini kabul edersin. Siparişin onaylanması için destek seninle Telegram’dan iletişime geçer; tamamlanamayan siparişlerde tutar bakiyene iade edilir.</p>';
  }

  /* ---------- diğer alt sayfalar ---------- */
  var FAQ = [
    ['Anahtar ne kadar hızlı gelir?', 'Sipariş verdikten sonra destek seninle Telegram üzerinden iletişime geçer. Sipariş tamamlanınca anahtar «Satın Alımlarım» bölümünde görünür.'],
    ['Nasıl ödeme yapılır?', 'Tek ödeme yöntemi Telegram Stars’tır. Bakiyen Profil sayfasında görünür, gerekirse oradan yükleyebilirsin.'],
    ['Lisans süresi ne zaman başlar?', 'Satın alma anında değil, anahtarı etkinleştirdiğin anda başlar.'],
    ['Ödeme iade edilir mi?', 'Siparişin tamamlanamazsa tutar bakiyene iade edilir.'],
    ['Anahtar gelmedi, ne yapmalıyım?', 'Destek bölümünden ID’ni kopyala ve destek sohbetine gönder. ID ile siparişini daha hızlı buluruz.']
  ];
  function wrap(title, body) {
    return '<div class="grab"></div><div class="sh-head"><h2 class="sh-title">' + title + '</h2></div>' + body;
  }
  function themeOptions() {
    return THEMES.map(function (t) {
      return '<button class="theme-opt" data-action="theme" data-arg="' + t.id + '" aria-pressed="' + (state.theme === t.id) + '" style="--p-bg:' + t.bg + ';--p-s:' + t.s + ';--p-a:' + t.a + '">' +
        '<span class="prev"><i class="pa"></i><i class="ps"></i><i class="ps s2"></i></span>' +
        '<span class="tn">' + t.name + '</span><span class="tck">' + ico('i-check') + '</span></button>';
    }).join('');
  }
  function notesHtml() {
    if (!state.notes.length) return '<div class="empty">' + ico('i-bell') + '<h3>Bildirim yok</h3><p>Sipariş ve bakiye hareketlerin burada görünür.</p></div>';
    return '<div class="txl">' + state.notes.map(function (n) {
      return '<div class="tx' + (n.is_read ? '' : ' in') + '"><span class="ti">' + ico('i-bell') + '</span><div class="tt"><strong>' + esc(n.title) + '</strong>' +
        (n.body ? '<span>' + esc(n.body) + '</span>' : '') + '<span>' + dateTime(n.created_at) + '</span></div></div>';
    }).join('') + '</div>';
  }
  function sheetBody() {
    switch (state.sheet) {
      case 'product': return productSheet();
      case 'custom': return state.custom ? wrap(state.custom.title, state.custom.html) : '';
      case 'notes': return wrap('Bildirimler', notesHtml());
      case 'support':
        return wrap('Destek',
          '<div class="promo-card"><h3>Ödeme, anahtar ve etkinleştirmede yardımcı olalım</h3>' +
          '<button class="btn" data-action="support-chat"><span>' + ico('i-send') + 'Sohbete yaz</span></button>' +
          '<div class="note">Her gün 10:00–22:00 (MSK) yanıt veriyoruz</div></div>' +
          '<div class="sub"><button class="row tight" data-action="open-faq">' + ico('i-help') + '<span class="grow">Sık sorulan sorular<small>Ödeme, anahtarlar, etkinleştirme</small></span>' + ico('i-chev', 'chev') + '</button>' +
          '<button class="row tight" data-action="copy" data-arg="' + esc(state.me ? state.me.id : '') + '">' + ico('i-copy') + '<span class="grow">ID’mi kopyala<small>Sohbete gönder, siparişini daha hızlı bulalım</small></span></button></div>');
      case 'faq':
        return wrap('Sık sorulan sorular', FAQ.map(function (q, i) {
          return '<div class="faq"><button class="faq-q" data-action="faq" data-arg="' + i + '" aria-expanded="false" aria-controls="faq-a' + i + '"><span>' + q[0] + '</span>' + ico('i-chev') + '</button>' +
            '<div class="faq-a" id="faq-a' + i + '" role="region"><div class="faq-in"><p>' + q[1] + '</p></div></div></div>';
        }).join(''));
      case 'activate':
        return wrap('Nasıl etkinleştirilir',
          '<ol class="steps"><li>«Satın Alımlarım» bölümünü aç ve anahtarı kopyala.</li><li>Uygulamayı bilgisayarında çalıştır.</li><li>Anahtarı etkinleştirme alanına yapıştır ve «Etkinleştir»e bas.</li><li>Onayı bekle. Lisans süresi bu andan itibaren başlar.</li><li>Anahtar çalışmazsa desteğe yaz ve ID’ni ekle.</li></ol>');
      case 'invite':
        var link = state.invite, r = refRate();
        return wrap('Arkadaşlarını davet et',
          '<div class="info"><div><h4>Arkadaşının her alışverişinden %' + r + '</h4><p>Linkini arkadaşına gönder. Siparişi tamamlandığında tutarın %' + r + '’i sana bakiye olarak yazılır.</p></div></div>' +
          (link
            ? '<div class="key" style="margin-top:12px" data-action="copy" data-arg="' + esc(link) + '" role="button" tabindex="0" aria-label="Linki kopyala" title="Kopyalamak için dokun"><code>' + esc(link) + '</code></div>' +
              '<button class="btn" style="margin-top:12px" data-action="share-invite"><span>' + ico('i-send') + 'Arkadaşına gönder</span></button>'
            : '<p class="legal" style="text-align:left">Davet linki şu an hazır değil, biraz sonra tekrar dene.</p>') +
          '<div class="info"><div><h4>Davet ettiklerin</h4><p>' + (state.ref.count || 0) + ' kişi · kazancın ' + st(state.ref.earned || 0) + '</p></div></div>');
      case 'terms':
        return wrap('Sözleşme',
          '<div class="text-block"><h4>Anahtarlar</h4><p>Anahtar, siparişin destek tarafından onaylanmasının ardından teslim edilir ve seçilen tarife süresince geçerlidir.</p><h4>Süre</h4><p>Lisans süresi, anahtarın etkinleştirildiği andan itibaren sayılır.</p><h4>İade</h4><p>Tamamlanamayan siparişlerde tutar bakiyene iade edilir.</p></div>');
      case 'settings':
        return wrap('Ayarlar',
          '<p class="label" style="margin-top:2px">Tema</p><div class="themes" role="group" aria-label="Tema">' + themeOptions() + '</div>' +
          '<p class="legal">Seçimin bu cihazda saklanır.</p>');
    }
    return '';
  }
  var closeTimer, lastFocus = null;
  function renderSheet() {
    sheet.innerHTML = '<div class="sb">' + sheetBody() + '</div>';
    animIn(sheet.firstChild.children);
    watchArt(sheet);
    if (state.sheet === 'product' && !state.paid) updateTotal(true);
    if (state.sheet === 'custom' && state.custom && state.custom.mount) state.custom.mount(sheet);
  }
  function openSheet(kind) {
    clearTimeout(closeTimer);
    var isOpen = sheet.classList.contains('show');
    state.sheet = kind;
    if (kind === 'product') {
      state.paid = null; state.paying = false; state.quote = null; state.promoCode = ''; shown = 0;
      if (cancelTotal) cancelTotal();
    }
    if (!isOpen) lastFocus = document.activeElement;
    renderSheet();
    if (!isOpen) {
      sheet.hidden = false; scrim.hidden = false;
      void sheet.offsetWidth;
      sheet.classList.add('show'); scrim.classList.add('show');
      document.body.classList.add('locked');
      sheet.scrollTop = 0;
      sheet.focus({ preventScroll: true });
    } else {
      sheet.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
    }
    syncBack();
  }
  function closeSheet() {
    if (!sheet.classList.contains('show')) return;
    state.sheet = null; state.paying = false; state.paid = null; state.custom = null;
    if (cancelTotal) cancelTotal();
    sheet.classList.remove('show'); scrim.classList.remove('show');
    document.body.classList.remove('locked');
    clearTimeout(closeTimer);
    closeTimer = setTimeout(function () { sheet.hidden = true; scrim.hidden = true; sheet.innerHTML = ''; }, reduce ? 0 : 420);
    if (lastFocus && lastFocus.focus) { try { lastFocus.focus({ preventScroll: true }); } catch (e) {} }
    lastFocus = null;
    syncBack();
  }

  /* ---------- yalnızca yukarıdan aşağı çekerek kapatma ---------- */
  var drag = null, pull = null;
  function sheetMove(dy, h) {
    sheet.style.transform = 'translate3d(0,' + dy + 'px,0)';
    scrim.style.opacity = String(1 - Math.min(1, dy / h) * .9);
  }
  function sheetRelease(dy, t0) {
    var v = dy / Math.max(1, performance.now() - t0);
    sheet.style.transition = ''; scrim.style.transition = '';
    if (dy > 110 || (v > .55 && dy > 30)) closeSheet();
    sheet.style.transform = ''; scrim.style.opacity = '';
  }
  function dragStart(e) {
    if (!sheet.classList.contains('show')) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    var g = e.target.closest('.grab');
    if (!g) return;
    drag = { y: e.clientY, t: performance.now(), dy: 0, id: e.pointerId, h: Math.max(1, sheet.offsetHeight) };
    try { g.setPointerCapture(e.pointerId); } catch (err) {}
    sheet.style.transition = 'none'; scrim.style.transition = 'none';
  }
  function dragMove(e) {
    if (!drag || e.pointerId !== drag.id) return;
    drag.dy = Math.max(0, e.clientY - drag.y);
    sheetMove(drag.dy, drag.h);
  }
  function dragEnd(e) {
    if (!drag || (e && e.pointerId !== drag.id)) return;
    var d = drag; drag = null;
    sheetRelease(d.dy, d.t);
  }
  function pullStart(e) {
    if (drag || pull || e.touches.length !== 1 || !sheet.classList.contains('show')) return;
    if (e.target.closest('.grab')) return;
    pull = { y: e.touches[0].clientY, t: 0, dy: 0, on: false, h: 1 };
  }
  function pullMove(e) {
    if (!pull) return;
    var y = e.touches[0].clientY;
    if (!pull.on) {
      var d = y - pull.y;
      if (d < -6 || sheet.scrollTop > 0) { pull = null; return; }
      if (d < 8) return;
      pull.on = true; pull.y = y; pull.t = performance.now(); pull.h = Math.max(1, sheet.offsetHeight);
      sheet.style.transition = 'none'; scrim.style.transition = 'none';
    }
    if (e.cancelable) e.preventDefault();
    pull.dy = Math.max(0, y - pull.y);
    sheetMove(pull.dy, pull.h);
  }
  function pullEnd() {
    if (!pull) return;
    var q = pull; pull = null;
    if (q.on) sheetRelease(q.dy, q.t);
  }
  function followFaq(box) {
    var t0 = performance.now();
    (function step(t) {
      if (!sheet.contains(box)) return;
      var over = box.getBoundingClientRect().bottom - (sheet.getBoundingClientRect().bottom - 20);
      if (over > 0) sheet.scrollTop += over;
      if (t - t0 < 600) requestAnimationFrame(step);
    })(t0);
  }

  /* ---------- açılış / hata ekranları ---------- */
  function renderGate(kind, msg) {
    var dock = $('.dock'); if (dock) dock.hidden = true;
    closeSheet();
    var cfg = {
      telegram: ['i-send', 'Telegram içinde aç', 'EasyCheats yalnızca Telegram Mini App olarak çalışır. Botu Telegram’da açıp mağaza düğmesine dokun.', state.bot && state.bot.username ? ['open-bot', 'Telegram’da aç'] : null],
      error: ['i-alert', 'Bağlanılamadı', msg || 'Bir sorun oluştu.', ['retry', 'Tekrar dene']],
      banned: ['i-alert', 'Hesabın kısıtlandı', msg ? 'Sebep: ' + msg : 'Destek ile iletişime geç.', ['support-chat', 'Destek ile konuş']],
      maintenance: ['i-alert', 'Mağaza bakımda', 'Kısa süre sonra tekrar dene.', ['retry', 'Tekrar dene']]
    }[kind];
    view.innerHTML = headerHtml(false) + '<div class="empty">' + ico(cfg[0]) + '<h3>' + cfg[1] + '</h3><p>' + esc(cfg[2]) + '</p>' +
      (cfg[3] ? '<button class="btn-ghost" data-action="' + cfg[3][0] + '">' + cfg[3][1] + '</button>' : '') + '</div>';
    fitBrand();
  }
  function refParam() {
    var sp = TG && TG.initDataUnsafe && TG.initDataUnsafe.start_param;
    if (sp) return sp;
    try { return new URLSearchParams(location.search).get('ref') || ''; } catch (e) { return ''; }
  }
  function tgInit() {
    if (!TG) return;
    try { TG.ready(); } catch (e) {}
    try { TG.expand(); } catch (e) {}
    try { if (TG.disableVerticalSwipes) TG.disableVerticalSwipes(); } catch (e) {}
    syncMeta(state.theme);
    try { if (TG.BackButton) TG.BackButton.onClick(onBack); } catch (e) {}
  }
  function boot() {
    var dock = $('.dock');
    dock.hidden = true;
    if (!INIT) {
      renderGate('telegram');
      api('info').then(function (d) {
        state.bot = { username: d.bot_username };
        if (!state.booted) renderGate('telegram');
      }, function () {});
      return;
    }
    tgInit();
    view.innerHTML = loadingHtml();
    api('boot', { ref: refParam() }).then(function (d) {
      if (d.banned) { renderGate('banned', d.reason); return; }
      state.settings = d.settings || {};
      state.products = (d.catalog && d.catalog.products) || [];
      state.invite = d.invite_link || null; state.bot = d.bot || null;
      applyMe(d.me);
      if (state.settings.maintenance === true && !state.admin) { renderGate('maintenance'); return; }
      state.booted = true;
      dock.hidden = false;
      route(true);
    }).catch(function (e) { renderGate('error', e.message); });
  }

  /* ---------- eylemler ---------- */
  function act(name, arg, el) {
    switch (name) {
      case 'nav': if (arg === 'wallet') state.need = null; closeSheet(); if (location.hash.replace('#', '') === arg) route(); else location.hash = arg; break;
      case 'tab': setTab(arg); break;
      case 'toast': toast(arg); break;
      case 'copy':
        copy(arg); haptic('light');
        if (el && el.classList.contains('key')) {
          el.classList.add('copied'); pop(el);
          setTimeout(function () { el.classList.remove('copied'); }, 1400);
        } else if (el && el.classList.contains('icon-btn')) {
          var old = el.innerHTML;
          el.innerHTML = ico('i-check'); el.style.color = 'var(--good)'; pop(el);
          setTimeout(function () { el.innerHTML = old; el.style.color = ''; }, 1400);
        }
        break;
      case 'to-wallet-need': goWalletNeed(); break;
      case 'amt': setAmount(+arg, true); break;
      case 'deposit':
        if (state.depositing) break;
        var dv = amtVal(), S = state.settings, dmin = S.deposit_min || 1, dmax = S.deposit_max || 1000000;
        if (!dv) { toast('Yüklemek istediğin miktarı gir'); shake($('#amt-card')); var wi = $('#w-amt'); if (wi) wi.focus(); break; }
        if (dv < dmin) { toast('En az ' + fmt(dmin) + ' yıldız yükleyebilirsin'); shake($('#amt-card')); break; }
        if (dv > dmax) { toast('En fazla ' + fmt(dmax) + ' yıldız yükleyebilirsin'); shake($('#amt-card')); break; }
        startDeposit(dv);
        break;
      case 'back-to-buy':
        var keep = state.need;
        state.need = null;
        var reopen = function () {
          if (keep) { state.product = keep.productId; state.tariff = keep.tariffId; }
          openSheet('product');
          if (keep && keep.code) {
            $('#promo-link-wrap').classList.remove('open'); $('#promo-wrap').classList.add('open');
            var pi = $('#promo-input'); if (pi) pi.value = keep.code;
            applyPromo(keep.code);
          }
        };
        if (location.hash.replace('#', '') === 'catalog') reopen();
        else { location.hash = 'catalog'; setTimeout(reopen, reduce ? 30 : 320); }
        break;
      case 'theme': setTheme(arg); break;
      case 'open-product':
        var pr = state.products.filter(function (x) { return x.id === arg; })[0];
        if (!pr) break;
        state.product = pr.id; state.tariff = defaultTariff(pr);
        openSheet('product');
        break;
      case 'open-support': openSheet('support'); break;
      case 'support-chat': openTg('https://t.me/' + supportName()); break;
      case 'open-bot': if (state.bot && state.bot.username) openTg('https://t.me/' + state.bot.username); break;
      case 'retry': boot(); break;
      case 'open-faq': openSheet('faq'); break;
      case 'faq':
        var fbox = el.parentNode, fopen = !fbox.classList.contains('open');
        $$('.faq.open', sheet).forEach(function (o) {
          if (o === fbox) return;
          o.classList.remove('open');
          $('.faq-q', o).setAttribute('aria-expanded', 'false');
        });
        fbox.classList.toggle('open', fopen);
        el.setAttribute('aria-expanded', String(fopen));
        if (fopen) followFaq(fbox);
        break;
      case 'open-activate': openSheet('activate'); break;
      case 'open-invite': openSheet('invite'); break;
      case 'share-invite':
        if (state.invite) openTg('https://t.me/share/url?url=' + encodeURIComponent(state.invite) + '&text=' + encodeURIComponent('EasyCheats Store'));
        break;
      case 'open-terms': openSheet('terms'); break;
      case 'open-settings': openSheet('settings'); break;
      case 'open-notes':
        openSheet('notes');
        if (state.unread > 0) {
          api('notifications_read').then(function () {
            state.unread = 0;
            state.notes.forEach(function (n) { n.is_read = true; });
            var d = $('#bell .dot'); if (d) d.remove();
          }, function () {});
        }
        break;
      case 'tariff':
        state.tariff = arg; state.quote = null;
        $$('.tariff', sheet).forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-arg') === arg)); });
        var lic = $('#lic', sheet); lic.innerHTML = licHtml(); swap(lic);
        updateTotal(true);
        if (state.promoCode) applyPromo(state.promoCode);
        break;
      case 'toggle-promo':
        $('#promo-link-wrap').classList.remove('open');
        $('#promo-wrap').classList.add('open');
        setTimeout(function () { var pi = $('#promo-input'); if (pi) pi.focus({ preventScroll: true }); }, 380);
        break;
      case 'apply-promo':
        var pin = $('#promo-input');
        var code = pin ? pin.value.trim().toUpperCase() : '';
        if (!code) { setPmsg(false, 'Bir kod gir.'); if (pin) shake(pin); break; }
        applyPromo(code);
        break;
      case 'pay':
        if (state.paying) break;
        var cost = priceNow();
        if (cost > state.balance) { goWalletNeed(); break; }
        state.paying = true;
        var pb = $('#pay-btn'); pb.classList.add('busy'); pb.disabled = true;
        var body = { tariff_id: state.tariff };
        if (state.promoCode) body.code = state.promoCode;
        api('order', body).then(function (r) {
          applyMe(r.me); haptic('success');
          if (state.sheet !== 'product') { toast('Siparişin alındı'); repaint(); return; }
          state.paying = false; state.paid = r.order;
          renderSheet();
          sheet.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
        }, function (e) {
          state.paying = false;
          var b = $('#pay-btn'); if (b) { b.classList.remove('busy'); b.disabled = false; }
          haptic('error');
          toast(e.message);
          if (e.code === 'insufficient_balance') { refreshMe().then(function () { updateTotal(false); }); }
          if (e.code === 'promo_invalid' || e.code === 'promo_used') { state.quote = null; state.promoCode = ''; updateTotal(true); }
        });
        break;
      case 'goto-purchases':
        state.tab = 'all'; closeSheet();
        if (location.hash.replace('#', '') === 'purchases') { state.view = ''; route(); }
        else location.hash = 'purchases';
        break;
      case 'check':
        var oid = +arg;
        if (!el || el.disabled) break;
        el.disabled = true; el.textContent = 'Kontrol ediliyor…';
        api('refresh').then(function (r) {
          applyMe(r.me);
          var it = state.purchases.filter(function (x) { return x.id === oid; })[0];
          if (state.view === 'purchases') { var pl = $('#plist'); pl.innerHTML = listHtml(); animIn(pl.children); updateCounts(); }
          toast(!it || it.status === 'pending' ? 'Sipariş henüz onaylanmadı' : it.status === 'completed' ? 'Siparişin tamamlandı' : 'Sipariş iade edildi, tutar bakiyene döndü');
        }, function (e) { el.disabled = false; el.textContent = 'Durumu kontrol et'; toast(e.message); });
        break;
      default:
        if (name.indexOf('adm:') === 0 && window.EasyAdmin) window.EasyAdmin.act(name, arg, el);
    }
  }

  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-action]');
    if (!el || el.disabled) return;
    act(el.getAttribute('data-action'), el.getAttribute('data-arg'), el);
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && state.sheet) { closeSheet(); return; }
    if ((e.key === 'Enter' || e.key === ' ') && e.target.classList && e.target.classList.contains('pcard')) {
      e.preventDefault(); act('open-product', e.target.getAttribute('data-arg'), e.target);
    }
    if ((e.key === 'Enter' || e.key === ' ') && e.target.classList && e.target.classList.contains('key')) {
      e.preventDefault(); act('copy', e.target.getAttribute('data-arg'), e.target);
    }
    if (e.key === 'Enter' && e.target.id === 'w-amt') { e.preventDefault(); act('deposit'); }
    if (e.key === 'Enter' && e.target.id === 'promo-input') { e.preventDefault(); act('apply-promo'); }
  });
  document.addEventListener('input', function (e) {
    if (e.target.id !== 'w-amt') return;
    if (amtCancel) amtCancel();
    var v = e.target.value.replace(/\D/g, '').replace(/^0+/, '').slice(0, 6);
    if (e.target.value !== v) e.target.value = v;
    syncAmount();
  });
  document.addEventListener('visibilitychange', function () { if (!document.hidden) refreshMe(); });
  setInterval(function () {
    if (!document.hidden && state.booted && (state.view === 'purchases' || state.view === 'profile')) refreshMe();
  }, 30000);
  scrim.addEventListener('click', closeSheet);
  sheet.addEventListener('pointerdown', dragStart);
  sheet.addEventListener('pointermove', dragMove);
  sheet.addEventListener('pointerup', dragEnd);
  sheet.addEventListener('pointercancel', dragEnd);
  sheet.addEventListener('touchstart', pullStart, { passive: true });
  sheet.addEventListener('touchmove', pullMove, { passive: false });
  sheet.addEventListener('touchend', pullEnd);
  sheet.addEventListener('touchcancel', pullEnd);
  window.addEventListener('hashchange', function () { route(); });

  /* yönetici paneli (admin.js) için köprü */
  window.EC = {
    api: api, toast: toast, ico: ico, FA: FA, st: st, fmt: fmt, esc: esc, copy: copy, pop: pop, swap: swap, shake: shake,
    animIn: animIn, state: state, closeSheet: closeSheet, openTg: openTg, confirm: askConfirm, haptic: haptic,
    dateStr: dateStr, dateTime: dateTime, refreshMe: refreshMe,
    sheet: function (title, html, mount) { state.custom = { title: title, html: html, mount: mount }; openSheet('custom'); },
    resheet: function (html) { if (state.custom) { state.custom.html = html; var sb = $('.sb', sheet); if (sb) { sb.innerHTML = wrap(state.custom.title, html); if (state.custom.mount) state.custom.mount(sheet); } } }
  };

  boot();
})();
