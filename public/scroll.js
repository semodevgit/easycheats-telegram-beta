/* EasyCheats — PC için akıcı (ataletli) kaydırma + beyaz, kalın, animasyonlu kaydırma çubuğu.
   Yalnızca fare olan geniş ekranlarda (≥1024px, hover + pointer:fine) çalışır; telefon ve tablette hiçbir şey yapmaz.
   JS çalışmazsa sistem kaydırma çubuğu olduğu gibi kalır. */
(function () {
  'use strict';
  if (!window.matchMedia) return;
  var mq = window.matchMedia('(min-width:1024px) and (hover:hover) and (pointer:fine)');
  var rm = window.matchMedia('(prefers-reduced-motion: reduce)');
  var html = document.documentElement, body = document.body;
  var PAD = 12;           // çubuğun alt/üst boşluğu (css ile aynı)
  var EASE = 0.12;        // her 16 ms karede hedefe yaklaşma oranı (küçük = daha yumuşak)

  var bar = document.createElement('div');
  bar.id = 'sb'; bar.setAttribute('aria-hidden', 'true');
  bar.innerHTML = '<div class="sb-thumb"></div>';
  var thumb = bar.firstChild;
  body.appendChild(bar);

  var active = false, cur = 0, target = 0, lastSet = 0, raf = 0, last = 0, idleT = 0, drag = null;

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function y() { return window.pageYOffset || html.scrollTop || 0; }
  function maxScroll() { return Math.max(0, html.scrollHeight - window.innerHeight); }
  function smooth() { return !rm.matches; }
  function stop() { if (raf) { cancelAnimationFrame(raf); raf = 0; } }

  /* ---------- çubuk ---------- */
  function layout() {
    if (!active) return;
    var max = maxScroll(), track = window.innerHeight - PAD * 2;
    if (max < 2 || track < 80) { bar.classList.remove('on'); return; }
    var h = Math.max(48, Math.round(track * window.innerHeight / html.scrollHeight));
    var pos = (y() / max) * (track - h);
    thumb.style.height = h + 'px';
    thumb.style.transform = 'translate3d(0,' + pos.toFixed(1) + 'px,0)';
    bar.classList.add('on');
  }
  function pulse() {
    bar.classList.add('act');
    clearTimeout(idleT);
    idleT = setTimeout(function () { bar.classList.remove('act'); }, 900);
  }

  /* ---------- akıcı kaydırma ---------- */
  function step(t) {
    raf = 0;
    var dt = Math.min(64, Math.max(1, t - last)); last = t;
    var k = 1 - Math.pow(1 - EASE, dt / 16.667);
    var d = target - cur;
    cur = Math.abs(d) < 0.5 ? target : cur + d * k;
    lastSet = Math.round(cur);
    window.scrollTo(0, lastSet);
    if (cur !== target) raf = requestAnimationFrame(step);
  }
  function kick() {
    if (raf) return;
    last = performance.now();
    raf = requestAnimationFrame(step);
  }
  function go(to) {
    if (!raf) { cur = y(); }
    target = clamp(to, 0, maxScroll());
    kick();
  }

  // Kendi içinde kaydırılabilen bir kutunun (textarea, modal vb.) üstündeysek sayfayı çalmayız
  function innerScroll(el, dy) {
    while (el && el !== body && el !== html && el.nodeType === 1) {
      var oy = getComputedStyle(el).overflowY;
      if ((oy === 'auto' || oy === 'scroll') && el.scrollHeight > el.clientHeight + 4) {
        if ((dy < 0 && el.scrollTop > 0) || (dy > 0 && el.scrollTop + el.clientHeight < el.scrollHeight - 1)) return true;
      }
      el = el.parentNode;
    }
    return false;
  }

  function onWheel(e) {
    if (!active || !smooth() || e.defaultPrevented || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (body.classList.contains('locked')) return;
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
    if (innerScroll(e.target, e.deltaY)) return;
    if (maxScroll() < 1) return;
    e.preventDefault();
    var dy = e.deltaY * (e.deltaMode === 1 ? 36 : e.deltaMode === 2 ? window.innerHeight : 1);
    dy = clamp(dy, -420, 420);
    if (!raf) { cur = target = y(); }
    go(target + dy);
  }

  var INTERACTIVE = 'button,a,input,textarea,select,[role="button"],[contenteditable="true"]';
  function onKey(e) {
    if (!active || !smooth() || e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
    if (body.classList.contains('locked')) return;
    var t = e.target;
    if (t && t.closest && t.closest(INTERACTIVE)) return;
    var k = e.key, base = raf ? target : y(), to = null, vh = window.innerHeight;
    if (k === 'ArrowDown') to = base + 110;
    else if (k === 'ArrowUp') to = base - 110;
    else if (k === 'PageDown' || (k === ' ' && !e.shiftKey)) to = base + vh * 0.86;
    else if (k === 'PageUp' || (k === ' ' && e.shiftKey)) to = base - vh * 0.86;
    else if (k === 'Home') to = 0;
    else if (k === 'End') to = maxScroll();
    if (to == null) return;
    e.preventDefault();
    if (!raf) cur = y();
    go(to);
  }

  // Sayfa dışarıdan kaydırıldıysa (bağlantı, Telegram, rota değişimi) hedefi eşitle
  function onScroll() {
    if (!active) return;
    var s = y();
    if (Math.abs(s - lastSet) > 2) { stop(); cur = target = lastSet = s; }
    layout(); pulse();
  }

  /* ---------- çubuğu sürükle / rayına tıkla ---------- */
  function onThumbDown(e) {
    if (e.button !== 0) return;
    e.preventDefault(); e.stopPropagation();
    stop();
    var max = maxScroll(), track = window.innerHeight - PAD * 2, h = thumb.offsetHeight;
    drag = { y0: e.clientY, s0: y(), k: max / Math.max(1, track - h) };
    cur = target = lastSet = y();
    try { thumb.setPointerCapture(e.pointerId); } catch (err) {}
    bar.classList.add('drag'); body.classList.add('sb-drag');
  }
  function onThumbMove(e) {
    if (!drag) return;
    var v = clamp(drag.s0 + (e.clientY - drag.y0) * drag.k, 0, maxScroll());
    cur = target = v; lastSet = Math.round(v);
    window.scrollTo(0, lastSet);
  }
  function onThumbUp() {
    if (!drag) return;
    drag = null;
    bar.classList.remove('drag'); body.classList.remove('sb-drag');
  }
  function onTrackDown(e) {
    if (e.target === thumb || e.button !== 0) return;
    var track = window.innerHeight - PAD * 2, h = thumb.offsetHeight;
    var p = clamp((e.clientY - PAD - h / 2) / Math.max(1, track - h), 0, 1);
    stop(); cur = y();
    go(p * maxScroll());
  }

  /* ---------- aç / kapat ---------- */
  var ro = window.ResizeObserver ? new ResizeObserver(layout) : null;
  function enable() {
    if (active) return;
    active = true;
    html.classList.add('has-sb');
    cur = target = lastSet = y();
    window.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', layout);
    if (ro) ro.observe(body);
    layout();
  }
  function disable() {
    if (!active) return;
    active = false; stop(); drag = null;
    html.classList.remove('has-sb');
    bar.classList.remove('on', 'act', 'drag');
    body.classList.remove('sb-drag');
    window.removeEventListener('wheel', onWheel, { passive: false });
    window.removeEventListener('keydown', onKey);
    window.removeEventListener('scroll', onScroll, { passive: true });
    window.removeEventListener('resize', layout);
    if (ro) ro.disconnect();
  }
  function sync() { if (mq.matches) enable(); else disable(); }

  thumb.addEventListener('pointerdown', onThumbDown);
  thumb.addEventListener('pointermove', onThumbMove);
  thumb.addEventListener('pointerup', onThumbUp);
  thumb.addEventListener('pointercancel', onThumbUp);
  thumb.addEventListener('lostpointercapture', onThumbUp);
  bar.addEventListener('pointerdown', onTrackDown);

  if (mq.addEventListener) mq.addEventListener('change', sync); else if (mq.addListener) mq.addListener(sync);
  sync();
})();
