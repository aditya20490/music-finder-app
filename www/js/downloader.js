/* www/js/downloader.js — drives the native Incognito plugin. */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var linkEl = $('link');
  var dlBtn = $('dlBtn');
  var statusEl = $('status');
  var filesEl = $('files');
  var capBox = $('captchaBox');
  var capImg = $('captchaImg');
  var capInput = $('captchaInput');
  var capGo = $('captchaGo');

  var plugin = null;
  var listener = null;
  var meta = null;
  var busy = false;

  function log(text, kind) {
    var row = document.createElement('div');
    row.className = 'log' + (kind ? ' ' + kind : '');
    row.textContent = text;
    statusEl.appendChild(row);
    statusEl.scrollTop = statusEl.scrollHeight;
  }

  function setBusy(v) {
    busy = v;
    dlBtn.disabled = v;
    dlBtn.textContent = v ? 'Working…' : 'Download';
  }

  function reset() {
    statusEl.innerHTML = '';
    capBox.hidden = true;
    capInput.value = '';
    meta = null;
  }

  function stop() {
    capBox.hidden = true;
    setBusy(false);
    if (plugin) { plugin.cancel().catch(function () {}); }
  }

  function fail(message) {
    log(message, 'bad');
    stop();
  }

  function normalise(raw) {
    var v = (raw || '').trim();
    if (!v) { return null; }
    if (!/^https?:\/\//i.test(v)) { v = 'https://' + v; }
    if (!/music\.apple\.com\/[a-z]{2}\/song\//i.test(v)) { return null; }
    return v;
  }

  function safeName(track, artist) {
    var base = (artist ? artist + ' - ' : '') + (track || 'track');
    return base.replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, ' ').trim().slice(0, 110) + '.m4a';
  }

  function onMessage(raw) {
    var m;
    try { m = JSON.parse(raw); } catch (e) { return; }

    switch (m.type) {
      case 'stage':
        if (m.stage === 'searching') { log('Reading the link…'); }
        else if (m.stage === 'song') {
          meta = { track: m.track, artist: m.artist };
          log('Found: ' + m.artist + ' — ' + m.track);
        }
        else if (m.stage === 'generating') { log('Requesting the download link…'); }
        else if (m.stage === 'fetching') { log('Fetching the original m4a…'); }
        else if (m.stage === 'done') { handleDownload(m.url); }
        else if (m.stage === 'limit') { fail('Daily limit reached on the site (3 songs). Try again tomorrow.'); }
        else if (m.stage === 'album') { fail('That is an album or playlist link. Paste a single song link.'); }
        else if (m.stage === 'error') { fail(m.message || 'Something went wrong.'); }
        break;

      case 'captcha':
        capImg.src = m.img;
        capBox.hidden = false;
        log('Captcha required — solve it below.');
        capInput.focus();
        break;

      case 'captcha-ok':
        capBox.hidden = true;
        capInput.value = '';
        log('Captcha accepted.');
        break;

      case 'captcha-wrong':
        log('Wrong answer, try again.', 'bad');
        capInput.value = '';
        capInput.focus();
        break;

      case 'download':
        handleDownload(m.url);
        break;

      case 'error':
        fail(m.message || 'Something went wrong.');
        break;
    }
  }

  async function handleDownload(url) {
    if (!meta) { return fail('Download link arrived without track data.'); }
    var name = safeName(meta.track, meta.artist);
    log('Handing to the download manager…');

    try {
      await plugin.save({ url: url, name: name });
      log('Queued: ' + name, 'good');

      var li = document.createElement('li');
      li.textContent = name;
      filesEl.prepend(li);

      var Cap = window.Capacitor;
      if (Cap && Cap.Plugins && Cap.Plugins.Share) {
        var share = document.createElement('button');
        share.textContent = 'Share';
        share.onclick = function () {
          Cap.Plugins.Share.share({
            title: name,
            url: 'file:///storage/emulated/0/Music/' + encodeURIComponent(name)
          }).catch(function () {});
        };
        li.appendChild(share);
      }
      stop();
    } catch (e) {
      fail('Could not start the download: ' + (e.message || e));
    }
  }

  async function start() {
    if (busy) { return; }

    var link = normalise(linkEl.value);
    if (!link) {
      log('That is not a valid Apple Music song link.', 'bad');
      return;
    }

    plugin = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Incognito;
    if (!plugin) {
      log('The Incognito plugin is not registered in MainActivity.', 'bad');
      return;
    }

    reset();
    setBusy(true);
    log('Opening the site…');

    if (listener) { listener.remove(); }
    listener = await plugin.addListener('message', function (e) { onMessage(e.raw); });

    try {
      await plugin.start({ link: link });
    } catch (e) {
      fail('Could not start: ' + (e.message || e));
    }
  }

  dlBtn.addEventListener('click', start);

  capGo.addEventListener('click', function () {
    var answer = parseInt(capInput.value, 10);
    if (isNaN(answer) || !plugin) { capInput.focus(); return; }
    capGo.disabled = true;
    plugin.answerCaptcha({ answer: answer }).catch(function () {});
    setTimeout(function () { capGo.disabled = false; }, 800);
  });

  $('pasteBtn').addEventListener('click', async function () {
    try { linkEl.value = await navigator.clipboard.readText(); }
    catch (e) { log('Clipboard blocked — paste manually.', 'bad'); }
  });

  $('clearBtn').addEventListener('click', function () {
    linkEl.value = '';
    statusEl.innerHTML = '';
    capBox.hidden = true;
  });

  $('back').addEventListener('click', function () { location.href = 'index.html'; });
})();
