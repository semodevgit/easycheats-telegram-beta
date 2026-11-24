(function () {
  'use strict';
  var TG = (window.Telegram && window.Telegram.WebApp) || null;
  var INIT = (TG && TG.initData) || '';
  var I = window.I18N;
  var L = I.t;                       // L('anahtar', {param: değer})
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
  var wide = function () { return !!(window.matchMedia && window.matchMedia('(min-width:1024px)').matches); };
  // Tablet + bilgisayar (≥720px): ürün açılır pencere yerine ayrı detay sayfasında açılır
  var detailPage = function () { return !!(window.matchMedia && window.matchMedia('(min-width:720px)').matches); };

  /* ---------- yumuşak, kalın, renkli ikon kutuları ---------- */
  var COL = { blue: '#5ea1ff', orange: '#ff9f43', green: '#3fd68f', gold: '#f6c244', purple: '#a78bfa', pink: '#ff6fa8', red: '#ff6b6b', teal: '#2dd4bf', cyan: '#38bdf8', slate: '#94a3b8' };
  function tile(fa, col, cls) { return '<span class="tile ' + (cls || '') + '" style="--c:' + (COL[col] || col) + '" aria-hidden="true"><i class="' + fa + '"></i></span>'; }
  function ptitle(fa, col, text, cls) { return '<div class="ptitle ' + (cls || '') + '">' + tile(fa, col, 'lg') + '<h1 class="h1">' + esc(text) + '</h1></div>'; }

  /* ---------- hareket yardımcıları (Web Animations API) ---------- */
  function play(el, frames, opts) {
    if (reduce || !el || !el.animate) return null;
    return el.animate(frames, opts);
  }
  function animIn(list) {
    if (reduce) return;
    Array.prototype.forEach.call(list, function (el, i) {
      if (i > 11 || !el.animate) return;   // uzun listelerde yalnızca ilk 12 öğe animasyonlanır (telefon takılmasın)
      el.animate(
        [{ opacity: 0, transform: 'translate3d(0,14px,0)' }, { opacity: 1, transform: 'translate3d(0,0,0)' }],
        { duration: 480, delay: Math.min(i, 6) * 40, easing: EASE, fill: 'backwards' }
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

  /* ---------- dil ---------- */
  var LOC = { tr: 'tr-TR', en: 'en-GB', ru: 'ru-RU' };
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function tgUserLang() {
    var u = TG && TG.initDataUnsafe && TG.initDataUnsafe.user;
    return u ? I.pick(u.language_code) : null;
  }
  // Önce kullanıcının elle seçtiği dil, yoksa Telegram dili. İkisi de yoksa null (seçtirilir).
  function resolveLang() { return I.pick(lsGet('eac-lang')) || tgUserLang(); }
  function applyStatic() {
    $$('[data-i18n]').forEach(function (el) { el.textContent = L(el.getAttribute('data-i18n')); });
    $$('[data-i18n-aria]').forEach(function (el) { el.setAttribute('aria-label', L(el.getAttribute('data-i18n-aria'))); });
  }
  function applyLang(l) {
    I.setLang(l);
    document.documentElement.lang = l;
    applyStatic();
  }
  function errText(code) {
    if (code === 'bad_init_data' || code === 'bad_signature') code = 'session';
    var k = 'err.' + code;
    return I.has(k) ? L(k) : L('err.generic');
  }

  /* ---------- tema ---------- */
  var THEMES = [
    { id: 'mono', bg: '#0a0a0a', s: '#272727', a: '#ffffff' },
    { id: 'purple', bg: '#0a0a0a', s: '#272727', a: '#8e7ee9' },
    { id: 'blue', bg: '#0a0a0a', s: '#272727', a: '#4d8ff0' },
    { id: 'green', bg: '#0a0a0a', s: '#272727', a: '#2bb57a' }
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
    sheet: null, paying: false, paid: null, need: null, depositing: false, booted: false, maint: false,
    me: null, admin: false, products: [], settings: {}, txs: [], purchases: [], notes: [], unread: 0,
    ref: { count: 0, earned: 0 }, invite: null, bot: null, custom: null
  };
  var view = $('#view'), sheet = $('#sheet'), scrim = $('#scrim'), toastEl = $('#toast');
  var catHash = '', i18nHash = '', dirtyView = false, langCb = null, tgDone = false;

  function applyTheme(id) {
    if (id === 'mono') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', id);
    state.theme = id;
    syncMeta(id);
    $$('.theme-opt', sheet).forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-arg') === id)); });
    lsSet('eac-theme', id);
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
        toast(ok ? L('copied') : L('copy_manual'));
      } catch (e) { toast(L('copy_manual')); }
    }
    try { navigator.clipboard.writeText(text).then(function () { toast(L('copied')); }, fallback); } catch (e) { fallback(); }
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
    return isNaN(d) ? '' : d.toLocaleDateString(LOC[I.getLang()], { day: 'numeric', month: 'short' });
  }
  function dateTime(iso) {
    var d = new Date(iso);
    return isNaN(d) ? '' : d.toLocaleString(LOC[I.getLang()], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  }
  function supportName() { return (state.settings && state.settings.support_username) || 'easycheatsupport'; }
  function fullName() {
    var u = state.me || {};
    var n = [u.first_name, u.last_name].filter(Boolean).join(' ').trim();
    return n || (u.username ? '@' + u.username : L('pro.user'));
  }
  function pct(n) { return L('pct', { n: n }); }

  /* ---------- profil fotoğrafı (Telegram) ---------- */
  function avatarUrl() {
    var tu = TG && TG.initDataUnsafe && TG.initDataUnsafe.user;
    return (tu && tu.photo_url) || (state.me && state.me.photo_url) || '';
  }
  function avatarHtml() {
    var url = avatarUrl();
    var ch = fullName().replace(/^@/, '').charAt(0) || '?';
    return '<div class="avatar"><span class="av-i">' + esc(ch) + '</span>' +
      (url ? '<img src="' + esc(url) + '" alt="" referrerpolicy="no-referrer" decoding="async" draggable="false" onerror="this.remove()">' : '') + '</div>';
  }

  /* ---------- API ---------- */
  function api(op, body) {
    var payload = {};
    Object.keys(body || {}).forEach(function (k) { payload[k] = body[k]; });
    payload.op = op;
    var isAdm = op.indexOf('admin.') === 0;
    return fetch('/api', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'tma ' + INIT },
      body: JSON.stringify(payload)
    }).then(function (r) {
      return r.json().then(function (j) { return { r: r, j: j }; }, function () { return { r: r, j: null }; });
    }, function () {
      var e = new Error(L('err.network')); e.code = 'network'; throw e;
    }).then(function (x) {
      if (x.j && x.j.ok) return x.j.data;
      var code = x.j && x.j.error;
      // Yönetici işlemlerinde sunucunun ayrıntılı (Türkçe) mesajı gösterilir; kullanıcıya kendi dilinde mesaj.
      var e = new Error(isAdm && x.j && x.j.message ? x.j.message : errText(code));
      e.code = code; e.status = x.r.status;
      if (x.r.status === 401 && state.booted) renderGate('error', e.message);
      if (code === 'user_banned' && (state.booted || state.maint)) { state.booted = false; state.maint = false; setTimeout(boot, 0); }
      throw e;
    });
  }

  /* ---------- sunucu verisi ---------- */
  var TXK = { deposit: 'tx.deposit', refund: 'tx.refund', referral: 'tx.referral', referral_reversal: 'tx.ref_rev', deposit_refund: 'tx.dep_refund' };
  function applyMe(me) {
    state.me = me.user; state.balance = me.user.balance; state.admin = !!me.user.is_admin;
    state.purchases = me.orders || [];
    state.txs = me.transactions || [];
    state.notes = me.notifications || []; state.unread = me.unread || 0;
    state.ref = me.referral || { count: 0, earned: 0 };
  }
  // Veritabanında Türkçe saklanan sistem bildirimlerini kullanıcının diline çevir.
  function noteView(n) {
    var b = n.body || '', m;
    if (n.title === 'Bakiye yüklendi' && (m = /^(\d+) /.exec(b))) return { t: L('nt.m.dep.t'), b: L('nt.m.dep.b', { n: fmt(+m[1]) }) };
    if (n.title === 'Davet kazancı' && (m = /^(\d+) /.exec(b))) return { t: L('nt.m.ref.t'), b: L('nt.m.ref.b', { n: fmt(+m[1]) }) };
    if (n.title === 'Siparişin tamamlandı' && (m = /^(.*) siparişin tamamlandı\.$/.exec(b))) return { t: L('nt.m.done.t'), b: L('nt.m.done.b', { p: m[1] }) };
    if (n.title === 'Siparişin iade edildi' && (m = /^(\d+) /.exec(b))) return { t: L('nt.m.rf.t'), b: L('nt.m.rf.b', { n: fmt(+m[1]) }) };
    return { t: n.title, b: b };
  }
  function txTitle(x) { return TXK[x.type] ? L(TXK[x.type]) : x.title; }

  function sigMe() { return JSON.stringify([state.purchases, state.balance, state.unread, state.txs.length, state.notes.length]); }
  var refreshing = false;
  function refreshMe() {
    if (refreshing || !INIT || (!state.booted && !state.maint)) return Promise.resolve();
    refreshing = true;
    var sig = sigMe();
    return api('refresh', { ch: catHash, ih: i18nHash }).then(function (r) {
      refreshing = false;
      applyMe(r.me);
      var relang = false, catChanged = false;
      if (r.i18n) { I.setOverrides(r.i18n); relang = true; }
      i18nHash = r.ih;
      if (r.catalog) { state.products = r.catalog.products || []; catChanged = true; rememberImages(); }
      catHash = r.ch;
      applySettings(r.settings || {});
      if (!state.booted) return;
      if (relang) {
        applyStatic();
        if (state.sheet) dirtyView = true;
        else if (state.view === 'admin') { /* yönetici sayfası yeniden kurulmaz: yazdığın form bozulmasın */ }
        else if (state.view === 'product') refreshProductPage();
        else mount();
      }
      else if (catChanged) {
        if (state.view === 'product') refreshProductPage();
        else if (state.sheet || state.view !== 'catalog') dirtyView = state.view === 'catalog';
        else mount();
      }
      else if (sig !== sigMe()) repaint();
    }, function () { refreshing = false; });
  }
  // Ayarlar canlı izlenir: bakım modu açılınca ekran anında değişir, kapanınca mağaza geri gelir.
  function applySettings(s) {
    var was = state.settings.maintenance === true, now = s.maintenance === true;
    state.settings = s;
    if (now && !state.admin && state.booted) { state.booted = false; state.maint = true; renderGate('maintenance'); }
    else if (!now && state.maint) { state.maint = false; boot(); }
    else if (state.booted && state.admin && was !== now && !state.sheet && (state.view === 'catalog' || state.view === 'profile')) mount();
  }
  function repaint() {
    var v = state.view;
    if (v === 'purchases') { var pl = $('#plist'); if (pl) pl.innerHTML = listHtml(); updateCounts(); }
    else if (v === 'profile') { var b = $('#bal-num'); if (b) b.textContent = fmt(state.balance); }
    else if (v === 'product') { updatePayState(); }
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

  /* ---------- bildirimler: görüldü → 15 sn sonra silinir ---------- */
  var purgeT;
  function schedulePurge() {
    clearTimeout(purgeT);
    if (!INIT) return;
    purgeT = setTimeout(function () { api('purge').then(function () { return refreshMe(); }, function () {}); }, 15500);
  }
  function markSeen() {
    if (!INIT || !state.booted) return;
    api('seen').then(schedulePurge, function () {});
  }

  /* ---------- ürün / fiyat ---------- */
  function product() { return state.products.filter(function (p) { return p.id === state.product; })[0] || null; }
  function tariff() { var p = product(); return p ? (p.tariffs.filter(function (x) { return x.id === state.tariff; })[0] || null) : null; }
  function defaultTariff(p) { return (p.tariffs.filter(function (x) { return x.tag === 'Popüler'; })[0] || p.tariffs[0]).id; }
  function minPrice(p) { return Math.min.apply(null, p.tariffs.map(function (x) { return x.price; })); }
  function priceNow() {
    var tr = tariff(); if (!tr) return 0;
    var q = state.quote;
    return (q && q.tariff_id === tr.id) ? q.final_price : tr.price;
  }

  /* ---------- katalog ---------- */
  function headerHtml(actions) {
    return '<header class="top"><div class="brand"><span class="brand-name" aria-label="EasyCheats"><b class="b1" aria-hidden="true">Easy</b><b class="b2" aria-hidden="true">Cheats</b></span></div>' +
      (actions ? '<div class="top-actions">' +
        '<button class="icon-btn" data-action="open-lang" aria-label="' + esc(L('hdr.lang')) + '">' + ico('i-lang') + '</button>' +
        '<button class="icon-btn" id="bell" data-action="open-notes" aria-label="' + esc(L('hdr.notes')) + '">' + ico('i-bell') + (state.unread > 0 ? '<i class="dot"></i>' : '') + '</button>' +
        '</div>' : '') + '</header>';
  }
  function maintBanner() {
    return state.admin && state.settings.maintenance === true ? '<div class="mt-banner">' + ico('fa-solid fa-screwdriver-wrench') + '<span>' + esc(L('mt.admin')) + '</span></div>' : '';
  }
  function productCard(p) {
    var mp = minPrice(p), pre = L('card.pre'), post = L('card.post');
    return '<article class="pcard cat-item" data-action="open-product" data-arg="' + esc(p.id) + '" tabindex="0" role="button" aria-label="' + esc(L('card.aria', { name: p.name, price: fmt(mp) })) + '">' +
      (p.image_url
        ? '<img class="pcard-img" src="' + esc(p.image_url) + '" alt="' + esc(p.name) + '" loading="eager" decoding="async" draggable="false">'
        : '<div class="pimg">' + artFlow(true) + '</div>') +
      '<div class="pcap"><strong>' + esc(p.name) + '</strong><span class="pcap-sub">' + (pre ? '<em>' + esc(pre) + '</em>' : '') + '<span class="pr">' + st(mp) + '</span>' + (post ? '<em>' + esc(post) + '</em>' : '') + '</span></div></article>';
  }
  function catalogView() {
    var c = L('cat.hero.c');
    return headerHtml(true) + maintBanner() +
      '<section class="hero cat-item">' +
      '<svg class="hero-stripes" viewBox="0 0 985 522" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="gStripe" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--stripe-a)"/><stop offset="1" style="stop-color:var(--stripe-b)"/></linearGradient></defs>' +
      '<polygon points="482,522 797,0 935,0 622,522" fill="url(#gStripe)"/><polygon points="962,0 985,0 985,522 649,522" fill="url(#gStripe)"/></svg>' +
      '<img class="hero-soldier" src="https://shop.cry4me.best/img/hero.webp" alt="" decoding="async" draggable="false">' +
      '<h2>' + esc(L('cat.hero.a')) + '<br><span class="accent">' + esc(L('cat.hero.b')) + '</span>' + (c ? ' ' + esc(c) : '') + '</h2><p>' + esc(L('cat.hero.sub')) + '</p></section>' +
      (state.products.length ? '<div class="pgrid">' + state.products.map(productCard).join('') + '</div>' :
        '<div class="empty cat-item">' + ico('i-star') + '<h3>' + esc(L('cat.empty.t')) + '</h3><p>' + esc(L('cat.empty.p')) + '</p></div>');
  }

  /* ---------- ürün görselleri (satın alımlarda gösterilir; gizlenen ürünler için cihazda hatırlanır) ---------- */
  var IMGK = 'eac-pimg';
  function imgMap() { try { return JSON.parse(lsGet(IMGK) || '{}') || {}; } catch (e) { return {}; } }
  function rememberImages() {
    var m = imgMap(), ch = false;
    state.products.forEach(function (p) { if (p.image_url && m[p.name] !== p.image_url) { m[p.name] = p.image_url; ch = true; } });
    if (ch) lsSet(IMGK, JSON.stringify(m));
  }
  function orderImg(o) {
    if (o.image_url) return o.image_url;
    var pr = state.products.filter(function (x) { return (o.product_id && x.id === o.product_id) || x.name === o.product_name; })[0];
    return (pr && pr.image_url) || imgMap()[o.product_name] || '';
  }
  function thumbHtml(o) {
    var u = orderImg(o);
    return '<div class="thumb"><i class="fa-solid fa-gamepad" aria-hidden="true"></i>' +
      (u ? '<img src="' + esc(u) + '" alt="" loading="lazy" decoding="async" draggable="false" onerror="this.remove()">' : '') + '</div>';
  }

  /* ---------- satın alımlar ---------- */
  function buyCard(p) {
    var pill = p.status === 'completed' ? '<span class="pill on">' + esc(L('st.active')) + '</span>'
      : p.status === 'pending' ? '<span class="pill wait">' + esc(L('st.pending')) + '</span>'
      : '<span class="pill" style="background:var(--surface-3);color:var(--muted)">' + esc(L('st.refunded')) + '</span>';
    var body;
    if (p.status === 'completed') {
      body = (p.license_key
        ? '<div class="key" data-action="copy" data-arg="' + esc(p.license_key) + '" role="button" tabindex="0" aria-label="' + esc(L('buy.copy_key')) + '" title="' + esc(L('buy.tap_copy')) + '"><code>' + esc(p.license_key) + '</code></div>' +
          (p.admin_note ? '<p class="muted">' + esc(p.admin_note) + '</p>' : '') +
          '<button class="btn-ghost" data-action="open-activate">' + esc(L('buy.howto')) + '</button>'
        : '<p class="muted">' + esc(p.admin_note || L('buy.done')) + '</p>');
    } else if (p.status === 'pending') {
      body = '<p class="muted">' + esc(L('buy.pending_text')) + '</p>' +
        '<button class="btn-ghost" data-action="check" data-arg="' + p.id + '">' + esc(L('buy.check')) + '</button>';
    } else {
      body = '<p class="muted">' + esc(L('buy.refunded_text')) + (p.admin_note ? ' ' + esc(p.admin_note) : '') + '</p>';
    }
    return '<article class="buy" data-id="' + p.id + '"><div class="buy-top">' + thumbHtml(p) +
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
      '<div class="empty">' + ico('i-receipt') + '<h3>' + esc(L('buy.empty.t')) + '</h3><p>' + esc(L('buy.empty.p')) + '</p><button class="btn-ghost" data-action="nav" data-arg="catalog">' + esc(L('buy.empty.btn')) + '</button></div>';
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
      return '<button role="tab" data-action="tab" data-arg="' + id + '" aria-selected="' + (state.tab === id) + '">' + esc(label) + '<span class="count" data-count="' + id + '">' + c[id] + '</span></button>';
    };
    var k = ['all', 'active', 'pending'].indexOf(state.tab);
    return ptitle('fa-solid fa-receipt', 'orange', L('buy.title')) +
      '<div class="seg" role="tablist" id="seg" style="--k:' + k + '"><span class="knob"></span>' + tab('all', L('tab.all')) + tab('active', L('tab.active')) + tab('pending', L('tab.pending')) + '</div>' +
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
  function rowBtn(action, arg, fa, col, label, sub) {
    return '<button class="row" data-action="' + action + '"' + (arg ? ' data-arg="' + arg + '"' : '') + '>' + tile(fa, col) +
      '<span class="grow">' + esc(label) + (sub ? '<small>' + esc(sub) + '</small>' : '') + '</span>' + ico('i-chev', 'chev') + '</button>';
  }
  function profileView() {
    var u = state.me || {};
    var adminRow = state.admin ? rowBtn('nav', 'admin', 'fa-solid fa-user-shield', 'purple', L('row.admin')) : '';
    return ptitle('fa-solid fa-user', 'blue', L('pro.title')) + maintBanner() +
      '<div class="pf"><div class="pf-a">' +
      '<section class="pro"><div class="pro-top">' + avatarHtml() + '<div style="min-width:0"><h2>' + esc(fullName()) + '</h2><p>' + (u.username ? '@' + esc(u.username) : 'ID: ' + esc(u.id)) + '</p></div></div>' +
      '<div class="pro-id"><div class="bal"><span class="bal-ico">' + STAR + '</span><div><strong id="bal-num">' + fmt(state.balance) + '</strong><span class="bal-lbl">' + esc(L('pro.balance')) + '</span></div></div>' +
      '<button class="chip-btn" data-action="nav" data-arg="wallet">' + ico('i-plus') + esc(L('pro.topup')) + '</button></div></section>' +
      '<section class="invite">' + artGift() + '<h2>' + esc(L('inv.h_a')) + '<em>' + esc(pct(refRate())) + '</em>' + esc(L('inv.h_b')) + '</h2><p>' + esc(L('inv.sub')) + '</p>' +
      '<button class="pill-btn" data-action="open-invite">' + esc(L('inv.btn')) + ' ' + ico('i-chev') + '</button></section></div>' +
      '<div class="pf-b"><div class="rows">' + adminRow +
      rowBtn('nav', 'wallet', 'fa-solid fa-wallet', 'gold', L('row.wallet')) +
      rowBtn('open-support', '', 'fa-solid fa-headset', 'cyan', L('row.support')) +
      rowBtn('open-activate', '', 'fa-solid fa-key', 'green', L('buy.howto')) +
      rowBtn('open-faq', '', 'fa-solid fa-circle-question', 'purple', L('row.faq')) +
      rowBtn('open-terms', '', 'fa-solid fa-file-contract', 'slate', L('row.terms')) +
      rowBtn('open-settings', '', 'fa-solid fa-gear', 'pink', L('row.settings')) + '</div></div></div>';
  }

  /* ---------- cüzdan ---------- */
  var amtCancel = null;
  function presets() { return (state.settings.deposit_presets && state.settings.deposit_presets.length) ? state.settings.deposit_presets : [100, 500, 1000, 2500, 5000]; }
  function needShort() { return state.need ? Math.max(0, state.need.price - state.balance) : 0; }
  function needHtml() {
    var n = state.need, short = needShort();
    if (short > 0) {
      return '<div class="need"><span class="ni">' + ico('i-alert') + '</span><div><h3>' + L('w.need.short', { label: esc(n.label), amt: st(short) }) + '</h3>' +
        '<p>' + esc(L('w.need.fill')) + '</p></div></div>';
    }
    return '<div class="need ok"><span class="ni">' + ico('i-check') + '</span><div><h3>' + esc(L('w.need.ok')) + '</h3>' +
      '<p>' + L('w.need.ok2', { label: esc(n.label), amt: st(n.price) }) + '</p></div></div>';
  }
  function txRow(x) {
    var inn = x.amount > 0;
    return '<div class="tx ' + (inn ? 'in' : 'out') + '"><span class="ti">' + ico(inn ? 'i-in' : 'i-out') + '</span>' +
      '<div class="tt"><strong>' + esc(txTitle(x)) + '</strong><span>' + dateStr(x.created_at) + '</span></div>' +
      '<span class="ta">' + (inn ? '+' : '−') + st(Math.abs(x.amount)) + '</span></div>';
  }
  function txListHtml() {
    return state.txs.length ? state.txs.map(txRow).join('') :
      '<div class="empty">' + ico('i-receipt') + '<h3>' + esc(L('w.moves.t')) + '</h3><p>' + esc(L('w.moves.p')) + '</p></div>';
  }
  function walletView() {
    var short = needShort();
    var chips = (short > 0 ? '<button class="chip need-chip" data-action="amt" data-arg="' + short + '" aria-pressed="false">' + st(short) + '<small>' + esc(L('w.short_chip')) + '</small></button>' : '') +
      presets().map(function (v) {
        return '<button class="chip" data-action="amt" data-arg="' + v + '" aria-pressed="false">' + st(v) + '</button>';
      }).join('');
    return '<div class="whead"><button class="icon-btn" data-action="nav" data-arg="profile" aria-label="' + esc(L('back')) + '">' + ico('i-back') + '</button>' + ptitle('fa-solid fa-wallet', 'gold', L('w.title'), 'in-whead') + '</div>' +
      '<div class="wg"><div class="wg-a">' +
      '<section class="wcard" id="wcard"><span class="w-lbl">' + esc(L('w.balance')) + '</span>' +
      '<div class="w-bal"><span class="bal-ico" id="w-star">' + STAR + '</span><strong id="w-bal">' + fmt(state.balance) + '</strong></div>' +
      '<p class="w-sub">' + esc(L('w.sub')) + '</p></section>' +
      '<div class="collapse' + (state.need ? ' open' : '') + '" id="need-wrap"><div class="inner" id="need-box">' + (state.need ? needHtml() : '') + '</div></div>' +
      '<div class="collapse" id="back-wrap" inert><div class="inner"><button class="btn-ghost back-buy" data-action="back-to-buy">' + esc(L('w.back_buy')) + '</button></div></div>' +
      '<section class="dep"><p class="dep-t">' + esc(L('w.dep.title')) + '</p>' +
      '<label class="amt" id="amt-card" for="w-amt"><input id="w-amt" type="text" inputmode="numeric" autocomplete="off" placeholder="0" maxlength="6" aria-label="' + esc(L('w.amt.aria')) + '">' + STAR + '</label>' +
      '<div class="chips wchips" role="group" aria-label="' + esc(L('w.quick')) + '">' + chips + '</div>' +
      '<div class="after"><span>' + esc(L('w.after')) + '</span><strong id="w-after">' + fmt(state.balance) + '</strong></div>' +
      '<button class="btn" id="w-dep" data-action="deposit"><span class="lbl" id="w-dep-lbl">' + esc(L('w.enter')) + '</span><span class="wait">' + ico('i-spin') + esc(L('w.processing')) + '</span></button>' +
      '<p class="legal" style="margin-top:12px">' + esc(L('w.legal')) + '</p></section></div>' +
      '<div class="wg-b"><p class="wlabel">' + esc(L('w.moves')) + '</p><div class="txl" id="tx-list">' + txListHtml() + '</div></div></div>';
  }
  function amtVal() { var i = $('#w-amt'); return i ? (parseInt(i.value, 10) || 0) : 0; }
  function syncAmount() {
    var a = amtVal(), lbl = $('#w-dep-lbl'), after = $('#w-after');
    if (!lbl) return;
    lbl.innerHTML = a ? esc(L('w.load')) + ' <span class="num">' + fmt(a) + '</span>' + STAR : esc(L('w.enter'));
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
    var p = product(), tr = tariff();
    if (!p || !tr) return;
    state.need = { label: p.name + ' · ' + tr.label, price: priceNow(), code: state.promoCode, productId: p.id, tariffId: tr.id };
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
    api('refresh', {}).then(function (r) {
      applyMe(r.me); depositDone(); haptic('success');
      toast(L('w.t_done', { n: fmt(dv) }));
      if (state.view !== 'wallet') return;
      var wb = $('#w-bal'), wc = $('#wcard');
      tween(from, state.balance, 900, function (v) { if (wb) wb.textContent = fmt(v); });
      if (wc) { wc.classList.remove('flash'); void wc.offsetWidth; wc.classList.add('flash'); }
      pop($('#w-star'));
      var tl = $('#tx-list'); if (tl) { tl.innerHTML = txListHtml(); animIn(tl.children); }
      setAmount(0, true);
      syncNeed();
    }, function () { depositDone(); toast(L('w.t_soon')); });
  }
  function waitDeposit(id, dv) {
    var tries = 0;
    (function poll() {
      api('deposit_status', { id: id }).then(function (r) {
        if (r.status === 'paid') { finishDeposit(dv); return; }
        if (++tries > 40) { depositDone(); toast(L('w.t_soon')); refreshMe(); return; }
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
      if (!TG || typeof TG.openInvoice !== 'function') throw new Error(L('w.t_noinv'));
      TG.openInvoice(d.url, function (status) {
        if (status === 'paid') waitDeposit(d.deposit_id, dv);
        else if (status === 'pending') { toast(L('w.t_pending')); waitDeposit(d.deposit_id, dv); }
        else { depositDone(); toast(status === 'cancelled' ? L('w.t_cancel') : L('w.t_fail')); }
      });
    }).catch(function (e) { depositDone(); toast(e.message); });
  }

  /* ---------- sayfa yükleme / yönlendirme ---------- */
  function setDock() {
    var cur = (state.view === 'wallet' || state.view === 'admin') ? 'profile' : state.view === 'product' ? 'catalog' : state.view;
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

  // "Yükleniyor…" yazısı yerine iskelet (skeleton) görünür: sayfa anında oturur.
  function skeletonHtml(kind) {
    if (kind === 'admin') return '<div class="sk row-sk" style="height:62px;margin-top:20px"></div><div class="sk row-sk"></div><div class="sk row-sk"></div><div class="sk row-sk"></div>';
    return headerHtml(false) + '<div class="sk hero-sk"></div><div class="sk card-sk"></div><div class="sk card-sk"></div>';
  }
  var adminPromise = null;
  function loadAdmin() {
    if (window.EasyAdmin) return Promise.resolve();
    if (!adminPromise) {
      adminPromise = new Promise(function (res, rej) {
        var s = document.createElement('script');
        s.src = '/admin.js?v=3'; s.onload = res; s.onerror = function () { adminPromise = null; rej(new Error('admin_load')); };
        document.head.appendChild(s);
      });
    }
    return adminPromise;
  }
  function mount() {
    var v = state.view;
    if (v === 'admin') {
      var go = function () { if (state.view === 'admin') window.EasyAdmin.mount(view, window.EC); };
      if (window.EasyAdmin) go();
      else {
        view.innerHTML = ptitle('fa-solid fa-user-shield', 'purple', L('row.admin')) + skeletonHtml('admin');
        loadAdmin().then(go, function () { toast(L('adm.fail')); location.hash = 'profile'; });
      }
      syncBack();
      return;
    }
    if (v === 'product') { mountProduct(); syncBack(); return; }
    view.innerHTML = v === 'purchases' ? purchasesView() : v === 'profile' ? profileView() : v === 'wallet' ? walletView() : catalogView();
    animIn(view.children);
    if (v === 'purchases') animIn($('#plist').children);
    watchArt(view);
    if (v === 'wallet') walletInit();
    fitBrand();
    syncBack();
    if (state.booted && v !== 'catalog') refreshMe();
  }
  function hashParts() {
    var p = location.hash.replace('#', '').split('/'), id = '';
    try { id = decodeURIComponent(p[1] || ''); } catch (e) {}
    return { v: p[0], id: id };
  }
  function route(first) {
    if (!state.booted) return;
    var hp = hashParts();
    var v = ['catalog', 'purchases', 'profile', 'wallet', 'admin', 'product'].indexOf(hp.v) > -1 ? hp.v : 'catalog';
    if (v === 'admin' && !state.admin) v = 'catalog';
    var pid = '';
    if (v === 'product') {
      var pr = state.products.filter(function (x) { return x.id === hp.id; })[0];
      // Ürün sayfası yalnızca tablet/PC'de var; telefonda ya da ürün kalmadıysa kataloğa dön
      if (pr && detailPage()) pid = pr.id;
      else { v = 'catalog'; try { history.replaceState(null, '', '#catalog'); } catch (e) {} }
    }
    var newProduct = v === 'product' && (state.view !== 'product' || state.product !== pid);
    if (state.view === 'product' && v !== 'product') { state.paid = null; state.paying = false; if (cancelTotal) cancelTotal(); }
    if (newProduct) enterProduct(pid);
    if (first) { state.view = v; setDock(); mount(); return; }
    if (v === state.view && !newProduct) { window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' }); return; }
    state.view = v; setDock();
    mount(); window.scrollTo(0, 0);
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
  function shortBtn() { return ico('i-wallet') + '<span>' + L('p.topup', { amt: st(shortAmt() || 1) }) + '</span>'; }
  function payNote() {
    var low = priceNow() > state.balance;
    return L(low ? 'p.bal_low' : 'p.bal', { amt: st(state.balance) });
  }
  function updatePayState() {
    var h = host();
    var c = $('#paycard', h); if (!c) return;
    var isLow = priceNow() > state.balance;
    c.classList.toggle('low', isLow);
    var tw = $('#topup-wrap', h);
    if (tw) { tw.classList.toggle('open', isLow); tw.inert = !isLow; }
    if (isLow) { var tb = $('#topup-btn', h); if (tb) tb.innerHTML = shortBtn(); }
    var pn = $('#paynote', h); if (pn) pn.innerHTML = payNote();
  }
  function updateTotal(animate) {
    var nums = $$('[data-num]', host());
    if (!nums.length) return;
    var to = priceNow(), from = shown;
    var set = function (v) { shown = v; var s = fmt(v); nums.forEach(function (n) { n.textContent = s; }); };
    if (cancelTotal) cancelTotal();
    cancelTotal = tween(from, to, animate ? 520 : 0, set);
    updatePayState();
  }
  function licHtml() {
    var tr = tariff(); if (!tr) return '';
    var title = tr.days ? L('p.lic.days', { n: tr.days }) : L('p.lic.unl');
    var sub = tr.days ? L('p.lic.days_s') : L('p.lic.unl_s');
    return '<h4>' + esc(title) + '</h4><p>' + esc(sub) + '</p>';
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
      if (state.tariff !== tid || !inProduct()) return;
      state.quote = q; state.promoCode = q.promo_code || '';
      setPmsg(true, L('p.promo.ok', { n: fmt(q.discount) }));
      updateTotal(true);
    }, function (e) {
      if (state.tariff !== tid || !inProduct()) return;
      state.quote = null; state.promoCode = '';
      setPmsg(false, e.message || L('p.promo.bad'));
      var pin = $('#promo-input'); if (pin) shake(pin);
      updateTotal(true);
    });
  }
  /* ---------- ürün detay sayfası (tablet + bilgisayar) — telefonda alt sayfa (sheet) kullanılır ---------- */
  // Ürün arayüzü ya alt sayfada ya da sayfa içinde durur; ortak mantık doğru kabı seçer.
  function host() { return state.sheet === 'product' ? sheet : view; }
  function inProduct() { return state.sheet === 'product' || state.view === 'product'; }
  function tariffButtons(p) {
    return p.tariffs.map(function (x) {
      return '<button class="tariff" data-action="tariff" data-arg="' + esc(x.id) + '" aria-pressed="' + (x.id === state.tariff) + '">' +
        (x.tag ? '<span class="tag">' + esc(x.tag) + '</span>' : '') + '<strong>' + esc(x.label) + '</strong><span class="price">' + st(x.price) + '</span></button>';
    }).join('');
  }
  // Ödeme yöntemi + bakiye + promosyon kodu + toplam + Öde düğmesi
  function payBlock() {
    var low = priceNow() > state.balance;
    return '<p class="label">' + esc(L('p.paywith')) + '</p>' +
      '<div class="paycard' + (low ? ' low' : '') + '" id="paycard"><span class="pc-ico">' + STAR + '</span>' +
      '<div class="pc-txt"><strong>' + esc(L('p.stars')) + '</strong><span id="paynote">' + payNote() + '</span></div>' +
      '<span class="pc-tick">' + ico('i-check') + '</span></div>' +
      '<div class="collapse' + (low ? ' open' : '') + '" id="topup-wrap"' + (low ? '' : ' inert') + '><div class="inner"><button class="btn-ghost topup-btn" id="topup-btn" data-action="to-wallet-need">' + shortBtn() + '</button></div></div>' +
      '<div class="collapse open" id="promo-link-wrap"><div class="inner"><button class="link" data-action="toggle-promo">' + esc(L('p.promo.q')) + '</button></div></div>' +
      '<div class="collapse" id="promo-wrap"><div class="inner"><div class="promo"><input id="promo-input" type="text" autocomplete="off" autocapitalize="characters" spellcheck="false" maxlength="32" placeholder="' + esc(L('p.promo.ph')) + '" aria-label="' + esc(L('p.promo.ph')) + '"><button data-action="apply-promo">' + esc(L('p.promo.apply')) + '</button></div><p class="pmsg" id="pmsg"></p></div></div>' +
      '<div class="total"><span>' + esc(L('p.total')) + '</span><strong><span class="num" data-num>0</span>' + STAR + '</strong></div>' +
      '<div class="paybar">' +
      '<div class="pay"><button class="btn" id="pay-btn" data-action="pay"><span class="lbl">' + esc(L('p.pay')) + ' <span class="num" data-num>0</span>' + STAR + '</span><span class="wait">' + ico('i-spin') + esc(L('w.processing')) + '</span></button></div></div>';
  }
  // Benzer yazılımlar: aynı kategori (game) varsa onlar, yoksa başka ne ürün varsa
  function similarProducts(p) {
    var g = String(p.game || '').trim().toLowerCase();
    var others = state.products.filter(function (x) { return x.id !== p.id; });
    var same = g ? others.filter(function (x) { return String(x.game || '').trim().toLowerCase() === g; }) : [];
    return same.length ? same : others;
  }
  function similarHtml(p) {
    var list = similarProducts(p);
    if (!list.length) return '';
    return '<section class="sim" id="sim"><div class="sim-head"><h2>' + esc(L('p.similar')) + '</h2><div class="sim-nav">' +
      '<button class="icon-btn" data-action="sim-prev" aria-label="' + esc(L('sim.prev')) + '">' + ico('i-back') + '</button>' +
      '<button class="icon-btn" data-action="sim-next" aria-label="' + esc(L('sim.next')) + '">' + ico('i-chev') + '</button></div></div>' +
      '<div class="sim-row" id="sim-row">' + list.map(productCard).join('') + '</div></section>';
  }
  function simState() {
    var r = $('#sim-row'); if (!r) return;
    var pv = $('[data-action="sim-prev"]'), nx = $('[data-action="sim-next"]'), nav = $('.sim-nav');
    if (pv) pv.disabled = r.scrollLeft <= 4;
    if (nx) nx.disabled = r.scrollLeft + r.clientWidth >= r.scrollWidth - 4;
    if (nav) nav.style.visibility = r.scrollWidth > r.clientWidth + 4 ? '' : 'hidden';
  }
  function initSim() {
    var r = $('#sim-row'); if (!r) return;
    r.addEventListener('scroll', simState, { passive: true });
    simState(); setTimeout(simState, 400);
  }
  function productPage() {
    var p = product();
    var bar = '<div class="pp-bar"><button class="icon-btn" data-action="nav" data-arg="catalog" aria-label="' + esc(L('back')) + '">' + ico('i-back') + '</button><span class="pp-crumb">' + esc(L('nav.catalog')) + '</span></div>';
    if (!p) return '<div class="pp">' + bar + '<div class="empty"><h3>' + esc(L('p.notfound')) + '</h3></div></div>';
    if (state.paid) {
      var o = state.paid, notice = state.settings.order_notice || L('p.paid.notice');
      return '<div class="pp">' + bar + '<div class="pp-done"><div class="done"><div class="ok">' + ico('i-check') + '</div><h3>' + esc(L('p.paid.h')) + '</h3>' +
        '<p>' + esc(notice) + '</p><p>#' + o.id + ' · ' + esc(o.product_name) + ' · ' + esc(o.tariff_label) + '</p>' +
        '<p>' + L('p.paid.left', { amt: st(state.balance) }) + '</p>' +
        '<button class="btn" data-action="goto-purchases"><span class="lbl">' + esc(L('p.paid.open')) + '</span></button></div></div></div>';
    }
    var pre = L('card.pre'), post = L('card.post');
    var meta = (p.game ? '<span class="pp-chip">' + ico('i-game') + esc(p.game) + '</span>' : '') +
      '<span class="pp-chip">' + (pre ? esc(pre) : '') + st(minPrice(p)) + (post ? ' ' + esc(post) : '') + '</span>';
    return '<div class="pp">' + bar +
      '<div class="pp-hero">' + (p.image_url ? '<img src="' + esc(p.image_url) + '" alt="' + esc(p.name) + '" decoding="async" draggable="false">' : artFlow(true)) + '</div>' +
      '<h1 class="pp-name">' + esc(p.name) + '</h1>' +
      '<div class="pp-meta">' + meta + '</div>' +
      (p.description ? '<p class="pp-desc">' + esc(p.description) + '</p>' : '') +
      '<p class="label">' + esc(L('p.plan')) + '</p><div class="tariffs">' + tariffButtons(p) + '</div>' +
      '<div class="info"><div><h4>' + esc(L('p.how.h')) + '</h4><p>' + esc(L('p.how.t')) + '</p></div><div id="lic">' + licHtml() + '</div></div>' +
      '<section class="pp-buy">' + payBlock() + '<p class="legal">' + esc(L('p.legal')) + '</p></section>' +
      similarHtml(p) + '</div>';
  }
  function mountProduct() {
    view.innerHTML = productPage();
    animIn($$('.pp > *', view));
    watchArt(view);
    if (state.paid) return;
    updateTotal(true);
    var rs = state.buyRestore; state.buyRestore = null;   // cüzdandan dönünce promosyon kodu geri gelir
    if (rs && rs.code) {
      var pl = $('#promo-link-wrap'), pw = $('#promo-wrap'), pin0 = $('#promo-input');
      if (pl) pl.classList.remove('open');
      if (pw) pw.classList.add('open');
      if (pin0) pin0.value = rs.code;
      applyPromo(rs.code);
    }
    initSim();
  }
  // Katalog (fiyat/tarife) değişince sayfayı baştan kurmadan yalnızca ilgili kısımları günceller
  function refreshProductPage() {
    if (state.view !== 'product' || state.paid) return;
    var p = product();
    if (!p) { location.hash = 'catalog'; return; }
    if (!p.tariffs.some(function (x) { return x.id === state.tariff; })) { state.tariff = defaultTariff(p); state.quote = null; }
    var t = $('.pp .tariffs', view); if (t) t.innerHTML = tariffButtons(p);
    var lic = $('#lic', view); if (lic) lic.innerHTML = licHtml();
    updateTotal(false);
    var simEl = $('#sim', view), sh = similarHtml(p);
    if (simEl) { if (sh) simEl.outerHTML = sh; else simEl.remove(); }
    else if (sh) { var pp = $('.pp', view); if (pp) pp.insertAdjacentHTML('beforeend', sh); }
    initSim();
  }
  function enterProduct(pid) {
    var p = state.products.filter(function (x) { return x.id === pid; })[0];
    var rs = state.buyRestore;
    state.product = pid;
    state.tariff = (rs && rs.productId === pid && p && p.tariffs.some(function (t) { return t.id === rs.tariffId; })) ? rs.tariffId : (p ? defaultTariff(p) : null);
    state.paid = null; state.paying = false; state.quote = null; state.promoCode = ''; shown = 0;
    if (cancelTotal) cancelTotal();
  }

  function productSheet() {
    var p = product();
    if (!p) return '<div class="grab"></div><div class="empty"><h3>' + esc(L('p.notfound')) + '</h3></div>';
    if (state.paid) {
      var o = state.paid;
      var notice = state.settings.order_notice || L('p.paid.notice');
      return '<div class="grab"></div><div class="done"><div class="ok">' + ico('i-check') + '</div><h3>' + esc(L('p.paid.h')) + '</h3>' +
        '<p>' + esc(notice) + '</p>' +
        '<p>#' + o.id + ' · ' + esc(o.product_name) + ' · ' + esc(o.tariff_label) + '</p>' +
        '<p>' + L('p.paid.left', { amt: st(state.balance) }) + '</p>' +
        '<button class="btn" data-action="goto-purchases"><span class="lbl">' + esc(L('p.paid.open')) + '</span></button></div>';
    }
    var tar = tariffButtons(p);
    return '<div class="grab"></div>' +
      '<div class="phero">' + (p.image_url ? '<img class="pcard-img" src="' + esc(p.image_url) + '" alt="' + esc(p.name) + '" decoding="async" draggable="false">' : artFlow(true)) + '</div>' +
      '<h2 class="sh-name">' + esc(p.name) + '</h2>' +
      '<p class="sh-desc">' + esc(p.description) + '</p>' +
      '<p class="label">' + esc(L('p.plan')) + '</p><div class="tariffs">' + tar + '</div>' +
      '<div class="info"><div><h4>' + esc(L('p.how.h')) + '</h4><p>' + esc(L('p.how.t')) + '</p></div><div id="lic">' + licHtml() + '</div></div>' +
      payBlock() +
      '<p class="legal">' + esc(L('p.legal')) + '</p>';
  }

  /* ---------- diğer alt sayfalar ---------- */
  function wrap(title, body, fa, col) {
    return '<div class="grab"></div><div class="sh-head">' + (fa ? tile(fa, col) : '') + '<h2 class="sh-title">' + title + '</h2></div>' + body;
  }
  function themeOptions() {
    return THEMES.map(function (th) {
      return '<button class="theme-opt" data-action="theme" data-arg="' + th.id + '" aria-pressed="' + (state.theme === th.id) + '" style="--p-bg:' + th.bg + ';--p-s:' + th.s + ';--p-a:' + th.a + '">' +
        '<span class="prev"><i class="pa"></i><i class="ps"></i><i class="ps s2"></i></span>' +
        '<span class="tn">' + esc(L('th.' + th.id)) + '</span><span class="tck">' + ico('i-check') + '</span></button>';
    }).join('');
  }
  function langOptions() {
    return '<div class="langs" role="group" aria-label="' + esc(L('set.lang')) + '">' + I.SUPPORTED.map(function (l) {
      return '<button class="lang-opt" data-action="pick-lang" data-arg="' + l + '" aria-pressed="' + (I.getLang() === l) + '">' +
        '<span class="tile" style="--c:' + COL.blue + ';font-size:15px;font-weight:900">' + l.toUpperCase() + '</span><span>' + esc(I.NAMES[l]) + '</span></button>';
    }).join('') + '</div>';
  }
  function notesHtml() {
    if (!state.notes.length) return '<div class="empty">' + ico('i-bell') + '<h3>' + esc(L('nt.empty.t')) + '</h3><p>' + esc(L('nt.empty.p')) + '</p></div>';
    return '<div class="txl">' + state.notes.map(function (n) {
      var v = noteView(n);
      return '<div class="tx' + (n.is_read ? '' : ' in') + '"><span class="ti">' + ico('i-bell') + '</span><div class="tt"><strong>' + esc(v.t) + '</strong>' +
        (v.b ? '<span>' + esc(v.b) + '</span>' : '') + '<span>' + dateTime(n.created_at) + '</span></div></div>';
    }).join('') + '</div><p class="legal">' + esc(L('nt.auto')) + '</p>';
  }
  function sheetBody() {
    switch (state.sheet) {
      case 'product': return productSheet();
      case 'custom':
        return state.custom ? wrap(state.custom.title, state.custom.html, state.custom.icon && state.custom.icon[0], state.custom.icon && state.custom.icon[1]) : '';
      case 'notes': return wrap(esc(L('nt.title')), notesHtml(), 'fa-solid fa-bell', 'orange');
      case 'lang': return wrap(esc(L('set.lang')), langOptions(), 'fa-solid fa-language', 'cyan');
      case 'support':
        return wrap(esc(L('sup.title')),
          '<div class="promo-card"><h3>' + esc(L('sup.h')) + '</h3>' +
          '<button class="btn" data-action="support-chat"><span>' + ico('i-send') + esc(L('sup.chat')) + '</span></button>' +
          '<div class="note">' + esc(L('sup.hours')) + '</div></div>' +
          '<div class="sub"><button class="row tight" data-action="open-faq">' + tile('fa-solid fa-circle-question', 'purple') + '<span class="grow">' + esc(L('row.faq')) + '<small>' + esc(L('sup.faq.s')) + '</small></span>' + ico('i-chev', 'chev') + '</button>' +
          '<button class="row tight" data-action="copy" data-arg="' + esc(state.me ? state.me.id : '') + '">' + tile('fa-regular fa-copy', 'teal') + '<span class="grow">' + esc(L('sup.id')) + '<small>' + esc(L('sup.id.s')) + '</small></span></button></div>',
          'fa-solid fa-headset', 'cyan');
      case 'faq':
        return wrap(esc(L('faq.title')), [1, 2, 3, 4, 5].map(function (i) {
          return '<div class="faq"><button class="faq-q" data-action="faq" data-arg="' + i + '" aria-expanded="false" aria-controls="faq-a' + i + '"><span>' + esc(L('faq.q' + i)) + '</span>' + ico('i-chev') + '</button>' +
            '<div class="faq-a" id="faq-a' + i + '" role="region"><div class="faq-in"><p>' + esc(L('faq.a' + i)) + '</p></div></div></div>';
        }).join(''), 'fa-solid fa-circle-question', 'purple');
      case 'activate':
        return wrap(esc(L('buy.howto')),
          '<ol class="steps">' + [1, 2, 3, 4, 5].map(function (i) { return '<li>' + esc(L('act.s' + i)) + '</li>'; }).join('') + '</ol>', 'fa-solid fa-key', 'green');
      case 'invite':
        var link = state.invite, r = pct(refRate());
        return wrap(esc(L('invs.title')),
          '<div class="info"><div><h4>' + esc(L('invs.h', { r: r })) + '</h4><p>' + esc(L('invs.p', { r: r })) + '</p></div></div>' +
          (link
            ? '<div class="key" style="margin-top:12px" data-action="copy" data-arg="' + esc(link) + '" role="button" tabindex="0" aria-label="' + esc(L('invs.link')) + '" title="' + esc(L('buy.tap_copy')) + '"><code>' + esc(link) + '</code></div>' +
              '<button class="btn" style="margin-top:12px" data-action="share-invite"><span>' + ico('i-send') + esc(L('invs.send')) + '</span></button>'
            : '<p class="legal" style="text-align:left">' + esc(L('invs.none')) + '</p>') +
          '<div class="info"><div><h4>' + esc(L('invs.mine')) + '</h4><p>' + L('invs.stat', { c: state.ref.count || 0, amt: st(state.ref.earned || 0) }) + '</p></div></div>',
          'fa-solid fa-gift', 'pink');
      case 'terms':
        return wrap(esc(L('terms.title')),
          '<div class="text-block"><h4>' + esc(L('terms.k')) + '</h4><p>' + esc(L('terms.kt')) + '</p><h4>' + esc(L('terms.s')) + '</h4><p>' + esc(L('terms.st')) + '</p><h4>' + esc(L('terms.r')) + '</h4><p>' + esc(L('terms.rt')) + '</p></div>',
          'fa-solid fa-file-contract', 'slate');
      case 'settings':
        return wrap(esc(L('set.title')),
          '<p class="label" style="margin-top:2px">' + esc(L('set.lang')) + '</p>' + langOptions() +
          '<p class="label">' + esc(L('set.theme')) + '</p><div class="themes" role="group" aria-label="' + esc(L('set.theme')) + '">' + themeOptions() + '</div>' +
          '<p class="legal">' + esc(L('set.theme.note')) + '</p>', 'fa-solid fa-gear', 'pink');
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
    if (dirtyView) { dirtyView = false; if (state.booted && state.view !== 'wallet' && state.view !== 'admin' && state.view !== 'product') mount(); }
  }

  /* ---------- yukarıdan aşağı çekerek kapatma (yalnızca telefon/tablet) ---------- */
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
    if (wide() || !sheet.classList.contains('show')) return;
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
    if (wide() || drag || pull || e.touches.length !== 1 || !sheet.classList.contains('show')) return;
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

  /* ---------- açılış / hata / bakım ekranları ---------- */
  function renderGate(kind, msg) {
    var dock = $('.dock'); if (dock) dock.hidden = true;
    closeSheet();
    if (kind === 'maintenance') {
      view.innerHTML = headerHtml(false) +
        '<section class="mt"><div class="mt-ico"><i class="fa-solid fa-screwdriver-wrench"></i></div>' +
        '<h2>' + esc(L('mt.title')) + '</h2><p>' + esc(L('mt.text')) + '</p>' +
        '<button class="btn" data-action="support-chat"><span><i class="fa-brands fa-telegram"></i>' + esc(L('mt.contact')) + '</span></button></section>';
      animIn(view.children); fitBrand();
      return;
    }
    var cfg = {
      telegram: ['i-send', L('gate.tg.t'), L('gate.tg.p'), state.bot && state.bot.username ? ['open-bot', L('gate.tg.btn')] : null],
      error: ['i-alert', L('gate.err.t'), msg || L('gate.err.p'), ['retry', L('retry')]],
      banned: ['i-alert', L('gate.ban.t'), msg ? L('gate.ban.p1', { r: msg }) : L('gate.ban.p2'), ['support-chat', L('gate.ban.btn')]]
    }[kind];
    view.innerHTML = headerHtml(false) + '<div class="empty">' + ico(cfg[0]) + '<h3>' + esc(cfg[1]) + '</h3><p>' + esc(cfg[2]) + '</p>' +
      (cfg[3] ? '<button class="btn-ghost" data-action="' + cfg[3][0] + '">' + esc(cfg[3][1]) + '</button>' : '') + '</div>';
    fitBrand();
  }
  function renderLangPick(cb) {
    langCb = cb;
    view.innerHTML = headerHtml(false) + '<section class="lp"><h2>Dil seç · Language · Язык</h2>' +
      '<p>Choose the app language.<br>Uygulama dilini seç.<br>Выберите язык приложения.</p>' +
      I.SUPPORTED.map(function (l) {
        return '<button class="lp-btn" data-action="pick-lang" data-arg="' + l + '"><span class="tile lg" style="--c:' + COL.blue + ';font-size:17px;font-weight:900">' + l.toUpperCase() + '</span>' + esc(I.NAMES[l]) + '</button>';
      }).join('') + '</section>';
    animIn(view.children); fitBrand();
  }
  function setLanguage(l) {
    if (I.SUPPORTED.indexOf(l) < 0) return;
    var changed = l !== I.getLang();
    lsSet('eac-lang', l);
    if (!changed) return;
    applyLang(l);
    if (INIT) api('set_lang', { lang: l }).then(function () {}, function () {});
    if (state.sheet === 'settings' || state.sheet === 'lang') renderSheet();
    if (state.booted) mount();
  }
  function refParam() {
    var sp = TG && TG.initDataUnsafe && TG.initDataUnsafe.start_param;
    if (sp) return sp;
    try { return new URLSearchParams(location.search).get('ref') || ''; } catch (e) { return ''; }
  }
  function tgInit() {
    if (!TG || tgDone) return;
    tgDone = true;
    try { TG.ready(); } catch (e) {}
    try { TG.expand(); } catch (e) {}
    try { if (TG.disableVerticalSwipes) TG.disableVerticalSwipes(); } catch (e) {}
    syncMeta(state.theme);
    try { if (TG.BackButton) TG.BackButton.onClick(onBack); } catch (e) {}
  }
  function boot() {
    var dock = $('.dock');
    dock.hidden = true;
    state.booted = false; state.maint = false;
    if (INIT) tgInit();
    var l = resolveLang() || (!INIT ? (I.pick(navigator.language) || 'en') : null);
    if (!l) {
      applyLang('en');
      renderLangPick(function (sel) { lsSet('eac-lang', sel); applyLang(sel); boot(); });
      return;
    }
    applyLang(l);
    if (!INIT) {
      renderGate('telegram');
      api('info').then(function (d) {
        state.bot = { username: d.bot_username };
        if (!state.booted) renderGate('telegram');
      }, function () {});
      return;
    }
    view.innerHTML = skeletonHtml();
    api('boot', { ref: refParam() }).then(function (d) {
      if (d.banned) { renderGate('banned', d.reason); return; }
      state.settings = d.settings || {};
      state.products = (d.catalog && d.catalog.products) || [];
      rememberImages();
      state.invite = d.invite_link || null; state.bot = d.bot || null;
      I.setOverrides(d.i18n); catHash = d.ch; i18nHash = d.ih;
      applyMe(d.me);
      // Elle seçilmiş dil sunucuda da tutulur (bot mesajları bu dilde gider)
      var manual = I.pick(lsGet('eac-lang'));
      if (manual && d.me.user.lang !== manual) api('set_lang', { lang: manual }).then(function () {}, function () {});
      if (state.settings.maintenance === true && !state.admin) { state.maint = true; renderGate('maintenance'); return; }
      state.booted = true;
      dock.hidden = false;
      route(true);
      schedulePurge();
      // Yönetici ise panel arka planda önceden yüklenir (sayfaya geçerken bekleme olmasın)
      if (state.admin) setTimeout(function () { loadAdmin().then(function () { if (window.EasyAdmin && window.EasyAdmin.prefetch) window.EasyAdmin.prefetch(window.EC); }, function () {}); }, 500);
    }).catch(function (e) { renderGate('error', e.message); });
  }

  /* ---------- eylemler ---------- */
  function act(name, arg, el) {
    switch (name) {
      case 'nav': if (arg === 'wallet') state.need = null; closeSheet(); if (location.hash.replace('#', '') === arg) route(); else location.hash = arg; break;
      case 'tab': setTab(arg); break;
      case 'pick-lang':
        if (langCb) { var cb = langCb; langCb = null; cb(arg); } else setLanguage(arg);
        break;
      case 'open-lang': openSheet('lang'); break;
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
        if (!dv) { toast(L('w.t_enter')); shake($('#amt-card')); var wi = $('#w-amt'); if (wi) wi.focus(); break; }
        if (dv < dmin) { toast(L('w.t_min', { n: fmt(dmin) })); shake($('#amt-card')); break; }
        if (dv > dmax) { toast(L('w.t_max', { n: fmt(dmax) })); shake($('#amt-card')); break; }
        startDeposit(dv);
        break;
      case 'back-to-buy':
        var keep = state.need;
        state.need = null;
        // Tablet/PC: ayrı ürün sayfasına dön (tarife + promosyon kodu geri gelir)
        if (detailPage() && keep) { state.buyRestore = keep; location.hash = 'product/' + keep.productId; break; }
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
        else { location.hash = 'catalog'; setTimeout(reopen, reduce ? 30 : 200); }
        break;
      case 'theme': setTheme(arg); break;
      case 'open-product':
        var pr = state.products.filter(function (x) { return x.id === arg; })[0];
        if (!pr) break;
        if (detailPage()) {
          // Tablet/PC: modal açılmaz, ürün kendi sayfasında açılır
          closeSheet();
          location.hash = 'product/' + pr.id;
          break;
        }
        state.product = pr.id; state.tariff = defaultTariff(pr);
        openSheet('product');
        break;
      case 'sim-prev':
      case 'sim-next':
        var srow = $('#sim-row');
        if (srow) srow.scrollBy({ left: (name === 'sim-prev' ? -1 : 1) * Math.round(srow.clientWidth * 0.8), behavior: reduce ? 'auto' : 'smooth' });
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
            schedulePurge();   // görülen bildirimler 15 sn sonra silinir
          }, function () {});
        }
        break;
      case 'tariff':
        state.tariff = arg; state.quote = null;
        $$('.tariff', host()).forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-arg') === arg)); });
        var lic = $('#lic', host()); if (lic) { lic.innerHTML = licHtml(); swap(lic); }
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
        if (!code) { setPmsg(false, L('p.promo.empty')); if (pin) shake(pin); break; }
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
          if (!inProduct()) { toast(L('p.t_ok')); repaint(); return; }
          state.paying = false; state.paid = r.order;
          if (state.sheet === 'product') {
            renderSheet();
            sheet.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
          } else {
            mountProduct();
            window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
          }
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
        el.disabled = true; el.textContent = L('buy.checking');
        api('refresh', {}).then(function (r) {
          applyMe(r.me);
          var it = state.purchases.filter(function (x) { return x.id === oid; })[0];
          if (state.view === 'purchases') { var pl = $('#plist'); pl.innerHTML = listHtml(); animIn(pl.children); updateCounts(); }
          toast(!it || it.status === 'pending' ? L('buy.t_pending') : it.status === 'completed' ? L('buy.t_done') : L('buy.t_refunded'));
        }, function (e) { el.disabled = false; el.textContent = L('buy.check'); toast(e.message); });
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
  // Uygulama öne gelince: hemen yenile + bildirimler "görüldü" say
  document.addEventListener('visibilitychange', function () { if (!document.hidden) { refreshMe(); markSeen(); } });
  // Canlı veri: 3 sn'de bir (yalnızca ekran açıkken) bakiye, sipariş, bildirim, ayar ve katalog yenilenir.
  // Yönetici sayfasında kendi yenilemesi var; burada 9 sn'de bir bakmak yeter (telefon takilmasin).
  var pollTick = 0;
  setInterval(function () {
    if (document.hidden) return;
    if (state.view === 'admin' && (++pollTick % 3)) return;
    refreshMe();
  }, 3000);
  // Telefonda klavye açılınca alt sayfadaki alan görünür kalsın
  document.addEventListener('focusin', function (e) {
    var t = e.target;
    if (!t || !t.tagName || wide() || !sheet.contains(t) || !/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
    setTimeout(function () { try { t.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' }); } catch (err) {} }, 320);
  });
  // Ekran boyutu telefon ↔ tablet/PC arası değişirse ürün doğru biçimde (sayfa / alt sayfa) açılsın
  var rzT;
  window.addEventListener('resize', function () {
    clearTimeout(rzT);
    rzT = setTimeout(function () {
      if (!state.booted) return;
      if (state.view === 'product' && !detailPage()) {
        var back = state.product;
        location.hash = 'catalog';
        setTimeout(function () { act('open-product', back); }, 150);
      } else if (state.sheet === 'product' && detailPage()) {
        var pid = state.product;
        closeSheet();
        location.hash = 'product/' + pid;
      }
      simState();
    }, 160);
  });
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
    dateStr: dateStr, dateTime: dateTime, refreshMe: refreshMe, tile: tile, ptitle: ptitle, COL: COL, I18N: I, L: L,
    sheet: function (title, html, mount, icon) { state.custom = { title: title, html: html, mount: mount, icon: icon }; openSheet('custom'); },
    resheet: function (html) {
      if (state.custom) {
        state.custom.html = html;
        var sb = $('.sb', sheet);
        if (sb) { sb.innerHTML = wrap(state.custom.title, html, state.custom.icon && state.custom.icon[0], state.custom.icon && state.custom.icon[1]); if (state.custom.mount) state.custom.mount(sheet); }
      }
    }
  };

  boot();
})();
