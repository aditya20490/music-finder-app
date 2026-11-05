/* www/js/downloader.js
 * Download button -> Task Automator engine.
 * The recorded steps live in task/apple-music.task.json; only the song link changes per run.
 */
(function () {
  'use strict';

  var TASK_FILE = 'task/apple-music.task.json';
  var TYPE_SELECTOR = '#id_url';          // the typing step whose text is replaced by the user's link

  var $ = function (id) { return document.getElementById(id); };
  var linkEl = $('dlLink');
  var btn = $('dlBtn');
  var logEl = $('dlLog');
  var capBox = $('dlCap');

  function plugin() {
    return window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.TaskAutomator;
  }

  function log(text, kind) {
    var row = document.createElement('div');
    if (kind) { row.className = kind; }
    row.textContent = text;
    logEl.appendChild(row);
  }

  function normalise(raw) {
    var v = (raw || '').trim();
    if (!v) { return null; }
    if (!/^https?:\/\//i.test(v)) { v = 'https://' + v; }
    if (!/music\.apple\.com\//i.test(v)) { return null; }
    if (!/\/song\//i.test(v) && !/[?&]i=\d+/.test(v)) { return null; }   // song link, or album link with ?i=
    return v;
  }

  async function start() {
    logEl.innerHTML = '';
    if (capBox) { capBox.hidden = true; }    // the real site page shows its own captcha, if any

    var link = normalise(linkEl.value);
    if (!link) {
      log('That is not an Apple Music song link.', 'bad');
      return;
    }

    var p = plugin();
    if (!p) {
      log('Task Automator is not available in this build.', 'bad');
      return;
    }

    btn.disabled = true;
    try {
      log('Loading the task…');
      var res = await fetch(TASK_FILE, { cache: 'no-store' });
      if (!res.ok) { throw new Error('task file missing'); }
      var template = await res.text();

      log('Starting — a browser screen opens and does the steps for you.');
      var out = await p.run({ template: template, link: link, selector: TYPE_SELECTOR });
      log('Running ' + out.steps + ' steps. The file lands in your Downloads folder.', 'good');
    } catch (e) {
      log('Could not start: ' + (e && e.message ? e.message : e), 'bad');
    } finally {
      setTimeout(function () { btn.disabled = false; }, 1500);
    }
  }

  btn.addEventListener('click', start);

  $('dlPaste').addEventListener('click', async function () {
    try { linkEl.value = await navigator.clipboard.readText(); }
    catch (e) { log('Clipboard blocked — paste it by hand.', 'bad'); }
  });

  $('dlClear').addEventListener('click', function () {
    linkEl.value = '';
    logEl.innerHTML = '';
  });

  /* bottom-nav "Automate" button */
  window.openAutomator = function () {
    var p = plugin();
    if (p) { p.openHome().catch(function () {}); }
  };
})();
