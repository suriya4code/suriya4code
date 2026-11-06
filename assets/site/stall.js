/* ThumbStall, live on this page (GitHub Pages only; github.com never runs it).
 * Adds a control strip under the ThumbStall sheet:
 *   - "Take a pause" runs the real ThumbStall pause: a breathing countdown, then the
 *     5 / 10 / 15 min chips unlock. Closing is always one tap (button, Esc, backdrop).
 *   - "Arm the stall" makes the page itself watch for doomscrolling: a fast flick
 *     through the page triggers the pause. Repeat pauses this visit escalate exactly
 *     like core/PauseRules.kt: min(8 + 5 x repeats, 30) seconds.
 * Nothing is sent anywhere; state lives in this tab only.
 */
(function () {
  'use strict';
  var img = document.querySelector('img[src$="thumbstall.svg"]');
  if (!img) return;
  var anchor = img.closest('a') || img;
  var caption = anchor.parentElement && anchor.parentElement.nextElementSibling;
  var mount = caption && caption.querySelector('sub') ? caption : anchor.parentElement;

  var BASE = 8, STEP = 5, CAP = 30;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var opens = 0, armed = false, snoozeUntil = 0, open = false, timer = null, lastFocus = null;

  function pauseFor(repeats) { return Math.min(BASE + STEP * repeats, CAP); }
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }

  /* ---------- control strip ---------- */
  var strip = el('div', 'stall-strip');
  strip.innerHTML =
    '<span class="stall-tag">LIVE MODEL</span>' +
    '<button type="button" class="stall-btn" data-act="try">Take a pause</button>' +
    '<button type="button" class="stall-btn ghost" data-act="arm" aria-pressed="false">Arm the stall on this page</button>' +
    '<span class="stall-note" aria-live="polite">next pause: <b data-k="next">8 s</b></span>';
  mount.insertAdjacentElement('afterend', strip);
  var nextEl = strip.querySelector('[data-k="next"]');
  var armBtn = strip.querySelector('[data-act="arm"]');
  function refreshNext() { nextEl.textContent = pauseFor(opens) + ' s'; }

  /* ---------- overlay ---------- */
  var R = 56, C = 2 * Math.PI * R;
  var ov = el('div', 'stall-ov');
  ov.hidden = true;
  ov.innerHTML =
    '<div class="stall-card" role="dialog" aria-modal="true" aria-labelledby="stall-q">' +
      '<div class="stall-app"><span class="stall-ic">S</span><span><b>suriya4code.github.io</b><small data-k="nth"></small></span><em>ThumbStall</em></div>' +
      '<div class="stall-ring">' +
        '<svg viewBox="0 0 140 140" aria-hidden="true"><circle cx="70" cy="70" r="' + R + '" class="trk"/>' +
        '<circle cx="70" cy="70" r="' + R + '" class="prg" stroke-dasharray="' + C.toFixed(2) + '" transform="rotate(-90 70 70)"/></svg>' +
        '<div class="stall-disc"><span class="stall-n" data-k="n" aria-live="off"></span><small data-k="br">breathe in</small></div>' +
      '</div>' +
      '<h2 id="stall-q">Still want to scroll?</h2>' +
      '<p>Take one slow breath. If you keep going, pick how long first.</p>' +
      '<div class="stall-chips">' +
        '<button type="button" data-min="5" disabled>5 min</button><button type="button" data-min="10" disabled>10 min</button><button type="button" data-min="15" disabled>15 min</button>' +
      '</div>' +
      '<button type="button" class="stall-close" data-act="close">Close and look at the drawing</button>' +
      '<small class="stall-rule" data-k="rule"></small>' +
    '</div>';
  document.body.appendChild(ov);
  var q = function (k) { return ov.querySelector('[data-k="' + k + '"]'); };
  var prg = ov.querySelector('.prg'), chips = ov.querySelectorAll('[data-min]');

  function show() {
    if (open) return;
    open = true; lastFocus = document.activeElement;
    var secs = pauseFor(opens);
    opens += 1;
    q('nth').textContent = ordinal(opens) + ' pause this visit';
    q('rule').textContent = 'pause = min(8 s + 5 s × ' + (opens - 1) + ', 30 s) = ' + secs + ' s, the rule in core/PauseRules.kt';
    chips.forEach(function (b) { b.disabled = true; });
    ov.hidden = false;
    document.documentElement.classList.add('stall-lock');
    requestAnimationFrame(function () { ov.classList.add('on'); });
    ov.querySelector('.stall-close').focus();
    var t0 = performance.now(), total = secs * 1000;
    prg.style.strokeDashoffset = '0';
    (function tick(now) {
      if (!open) return;
      var left = Math.max(0, total - (now - t0));
      q('n').textContent = Math.ceil(left / 1000);
      prg.style.strokeDashoffset = (-(1 - left / total) * C).toFixed(2);
      q('br').textContent = reduce ? 'breathe' : (Math.floor((now - t0) / 4000) % 2 ? 'breathe out' : 'breathe in');
      if (left > 0) { timer = requestAnimationFrame(tick); return; }
      chips.forEach(function (b) { b.disabled = false; });
      q('br').textContent = 'your call';
    })(t0);
    refreshNext();
  }
  function hide() {
    if (!open) return;
    open = false; cancelAnimationFrame(timer);
    ov.classList.remove('on');
    document.documentElement.classList.remove('stall-lock');
    setTimeout(function () { if (!open) ov.hidden = true; }, reduce ? 0 : 220);
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  function ordinal(n) { var s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); }

  ov.addEventListener('click', function (e) {
    if (e.target === ov || e.target.closest('[data-act="close"]')) { hide(); return; }
    var chip = e.target.closest('[data-min]');
    if (chip && !chip.disabled) { snoozeUntil = Date.now() + (+chip.dataset.min) * 60000; hide(); }
  });
  document.addEventListener('keydown', function (e) {
    if (!open) return;
    if (e.key === 'Escape') { hide(); return; }
    if (e.key === 'Tab') { // keep focus inside the dialog
      var f = Array.prototype.filter.call(ov.querySelectorAll('button'), function (b) { return !b.disabled; });
      var i = f.indexOf(document.activeElement);
      if (e.shiftKey && i <= 0) { f[f.length - 1].focus(); e.preventDefault(); }
      else if (!e.shiftKey && i === f.length - 1) { f[0].focus(); e.preventDefault(); }
    }
  });

  strip.addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    if (b.dataset.act === 'try') show();
    if (b.dataset.act === 'arm') {
      armed = !armed;
      b.setAttribute('aria-pressed', String(armed));
      b.textContent = armed ? 'Stall armed: flick-scroll to trigger' : 'Arm the stall on this page';
      strip.classList.toggle('armed', armed);
    }
  });

  /* ---------- doomscroll detector (only when armed) ---------- */
  var lastY = window.scrollY, lastT = performance.now(), fast = 0;
  window.addEventListener('scroll', function () {
    var now = performance.now(), y = window.scrollY, dt = now - lastT;
    if (dt < 16) return;
    var v = Math.abs(y - lastY) / dt; // px per ms
    lastY = y; lastT = now;
    if (!armed || open || Date.now() < snoozeUntil) { fast = 0; return; }
    fast = v > 2.2 ? fast + dt : Math.max(0, fast - dt);
    if (fast > 450) { fast = 0; show(); }
  }, { passive: true });
})();
