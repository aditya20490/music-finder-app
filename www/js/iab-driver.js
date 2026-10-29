/* www/js/iab-driver.js
 * Injected into each aaplmusicdownloader.com page by the native plugin after load.
 * Talks to Java through the MFBridge javascript interface.
 * Expects window.__MF_LINK to be set before injection.
 */
(function () {
  'use strict';

  var path = location.pathname;

  function post(msg) {
    try {
      if (window.MFBridge && window.MFBridge.post) {
        window.MFBridge.post(JSON.stringify(msg));
      }
    } catch (e) {}
  }

  function stage(name, extra) {
    var m = { type: 'stage', stage: name };
    if (extra) { for (var k in extra) { m[k] = extra[k]; } }
    post(m);
  }

  function visible(el) {
    return !!el && el.offsetParent !== null &&
           getComputedStyle(el).display !== 'none';
  }

  function waitFor(fn, ms) {
    return new Promise(function (resolve) {
      var started = Date.now();
      (function tick() {
        var v = fn();
        if (v) { return resolve(v); }
        if (Date.now() - started > ms) { return resolve(null); }
        setTimeout(tick, 150);
      })();
    });
  }

  /* ---------- terminal pages ---------- */

  if (path.indexOf('/ffmpeg/saved/') > -1) {
    stage('done', { url: location.href });
    return;
  }
  if (path.indexOf('/users/register.php') > -1) {
    stage('limit');
    return;
  }
  if (path.indexOf('album.php') > -1) {
    stage('album');
    return;
  }

  /* ---------- captcha ---------- */

  var afterCaptcha = null;

  async function loadCaptcha() {
    try {
      var res = await fetch('/captcha.php?t=' + Date.now(), { cache: 'no-store' });
      var blob = await res.blob();
      var bmp = await createImageBitmap(blob);
      var c = document.createElement('canvas');
      c.width = bmp.width;
      c.height = bmp.height;
      c.getContext('2d').drawImage(bmp, 0, 0);
      post({ type: 'captcha', img: c.toDataURL('image/png') });
    } catch (e) {
      post({ type: 'error', message: 'Could not load the captcha image.' });
    }
  }

  window.__mfSubmitCaptcha = async function (answer) {
    try {
      var res = await fetch('/captchaVerify.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'captcha_response=' + parseInt(answer, 10)
      });
      var verdict = (await res.text()).trim();

      if (verdict === 'true') {
        post({ type: 'captcha-ok' });
        try { captcha_response = true; } catch (e) {}
        setTimeout(function () {
          var cont = afterCaptcha;
          afterCaptcha = null;
          if (cont) { cont(); }
        }, 1200);
      } else if (verdict === 'excess') {
        post({ type: 'error', message: 'Captcha limit hit. Come back in a few hours.' });
      } else {
        post({ type: 'captcha-wrong' });
        loadCaptcha();
      }
    } catch (e) {
      post({ type: 'error', message: 'Captcha verification failed.' });
    }
  };

  async function captchaGate(cont) {
    var form = await waitFor(function () {
      return visible(document.getElementById('captcha_form'));
    }, 8000);
    if (!form) { cont(); return; }
    afterCaptcha = cont;
    await loadCaptcha();
  }

  /* ---------- homepage ---------- */

  if (path === '/' || path === '/index.php') {
    if (window.__mfHome) { return; }
    window.__mfHome = true;

    (function fill() {
      var input = document.getElementById('id_url');
      if (!input) { return setTimeout(fill, 250); }

      input.value = window.__MF_LINK || '';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      stage('searching');

      setTimeout(function () {
        var proc = document.getElementById('process');
        if (proc && getComputedStyle(proc).display === 'block') { return; }
        var btn = document.getElementById('search');
        if (btn) { btn.click(); }
      }, 1200);

      captchaGate(function () {});
    })();
    return;
  }

  /* ---------- song page ---------- */

  if (path.indexOf('song.php') > -1) {
    if (window.__mfSong) { return; }
    window.__mfSong = true;

    (async function run() {
      var btn = await waitFor(function () {
        return document.querySelector('a#download_btn');
      }, 20000);

      if (!btn) {
        stage('error', { message: 'Song page did not render. The link may be invalid.' });
        return;
      }

      stage('song', {
        track: btn.getAttribute('track_name') || '',
        artist: btn.getAttribute('artist') || '',
        album: btn.getAttribute('album') || ''
      });

      window.open = function (u) {
        if (u) { post({ type: 'download', url: u }); }
        return null;
      };

      btn.style.display = '';
      stage('generating');
      btn.click();

      captchaGate(chooseQuality);
    })();
    return;
  }

  function chooseQuality() {
    var sel = document.getElementById('qquality');
    if (!sel) {
      stage('error', { message: 'Quality selector missing.' });
      return;
    }
    sel.value = 'm4a';
    stage('fetching');
    if (typeof qselectOne === 'function') {
      qselectOne();
    } else {
      sel.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }
})();
