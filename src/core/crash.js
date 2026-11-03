// Crash reporter. A classic (non-module) script with no imports, loaded BEFORE main.js, so it
// also catches failures that happen while the module graph itself is loading (missing file,
// wrong MIME type, syntax error in a module, three.js not loading).
//
// Sends uncaught errors, unhandled rejections, failed resource loads, boot failures and WebGL
// context loss to Sentry using the plain envelope HTTP API (no SDK download). Disabled on
// localhost and in the screenshot harness, capped per session, deduplicated.
//
//   ?nocrash      disable reporting for this page load
//   ?crashtest    send one test event after boot (to verify the pipeline end to end)
//
// This is the one deliberate exception to "no runtime network" in CONTRACT.md §0.
(function () {
  'use strict';
  var DSN = 'https://94e8b11f73db53a5f858a12bde5c49b7@o4512367977168896.ingest.us.sentry.io/4512369263771648';
  var MAX_EVENTS = 12;

  var q = location.search;
  var host = location.hostname;
  var local = host === 'localhost' || host === '127.0.0.1' || host === '' || host === '::1';
  var enabled = !/[?&](harness|nocrash)\b/.test(q) && (!local || /[?&]crashtest\b/.test(q));

  var m = /^https:\/\/([^@]+)@([^/]+)\/(\d+)$/.exec(DSN);
  var KEY = m[1], HOST = m[2], PROJECT = m[3];
  var URL_ = 'https://' + HOST + '/api/' + PROJECT + '/envelope/?sentry_key=' + KEY + '&sentry_version=7&sentry_client=dust2-crash%2F1.0';

  var sent = 0, seen = {}, crumbs = [], t0 = Date.now();
  var phase = 'loading';

  function uuid() {
    var s = '';
    for (var i = 0; i < 32; i++) s += Math.floor(Math.random() * 16).toString(16);
    return s;
  }

  function crumb(category, message, level) {
    crumbs.push({ timestamp: Date.now() / 1000, category: category, message: String(message).slice(0, 300), level: level || 'info' });
    if (crumbs.length > 40) crumbs.shift();
  }

  // Parse Chrome ("at fn (url:l:c)" / "at url:l:c") and Firefox/Safari ("fn@url:l:c") stacks.
  function frames(stack) {
    if (!stack) return undefined;
    var out = [];
    var lines = String(stack).split('\n');
    for (var i = 0; i < lines.length; i++) {
      var ln = lines[i].trim(), r;
      if ((r = /^at (?:(.+?) \()?(.+?):(\d+):(\d+)\)?$/.exec(ln))) out.push({ function: r[1] || '?', filename: r[2], lineno: +r[3], colno: +r[4] });
      else if ((r = /^(.*?)@(.+?):(\d+):(\d+)$/.exec(ln))) out.push({ function: r[1] || '?', filename: r[2], lineno: +r[3], colno: +r[4] });
    }
    if (!out.length) return undefined;
    for (var j = 0; j < out.length; j++) {
      var f = out[j];
      f.in_app = f.filename.indexOf('/dust2/') >= 0 && f.filename.indexOf('/vendor/') < 0;
      f.abs_path = f.filename;
      f.filename = f.filename.replace(/^https?:\/\/[^/]+/, '').replace(/\?.*$/, '');
    }
    return { frames: out.reverse() }; // Sentry wants oldest frame first
  }

  function gpuInfo() {
    try {
      var r = window.World && World.renderer && World.renderer.renderer;
      var gl = r && r.getContext ? r.getContext() : null;
      if (!gl) {
        var c = document.createElement('canvas');
        gl = c.getContext('webgl2') || c.getContext('webgl');
      }
      if (!gl) return { name: 'no-webgl' };
      var ext = gl.getExtension('WEBGL_debug_renderer_info');
      return {
        name: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
        vendor_name: ext ? gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR),
        version: gl.getParameter(gl.VERSION),
        webgl2: typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext,
        max_texture_size: gl.getParameter(gl.MAX_TEXTURE_SIZE),
      };
    } catch (e) { return { name: 'unknown', error: String(e) }; }
  }

  function browserInfo() {
    var ua = navigator.userAgent, b = { name: 'unknown', version: '' }, r;
    var brands = navigator.userAgentData && navigator.userAgentData.brands;
    if (brands) {
      var pick = brands.filter(function (x) { return !/Not.?A.?Brand|Chromium/i.test(x.brand); })[0] || brands[0];
      if (pick) b = { name: pick.brand, version: pick.version };
    }
    if (b.name === 'unknown') {
      if ((r = /Firefox\/([\d.]+)/.exec(ua))) b = { name: 'Firefox', version: r[1] };
      else if ((r = /Edg\/([\d.]+)/.exec(ua))) b = { name: 'Edge', version: r[1] };
      else if ((r = /Chrome\/([\d.]+)/.exec(ua))) b = { name: 'Chrome', version: r[1] };
      else if ((r = /Version\/([\d.]+).*Safari/.exec(ua))) b = { name: 'Safari', version: r[1] };
    }
    return b;
  }

  function send(type, value, stack, level, extra) {
    if (!enabled || sent >= MAX_EVENTS) return;
    var fp = type + ':' + String(value).slice(0, 160);
    if (seen[fp]) return;
    seen[fp] = 1;
    sent++;

    var W = window.World || {};
    var gpu = gpuInfo(), br = browserInfo();
    var id = uuid();
    var event = {
      event_id: id,
      timestamp: Date.now() / 1000,
      platform: 'javascript',
      level: level || 'error',
      logger: 'dust2',
      environment: local ? 'local' : 'production',
      exception: { values: [{ type: type, value: String(value).slice(0, 2000), stacktrace: frames(stack) }] },
      request: { url: location.href, headers: { 'User-Agent': navigator.userAgent } },
      tags: {
        phase: phase,
        browser_family: br.name,
        gpu: String(gpu.name || '').slice(0, 200),
        webgl2: String(!!gpu.webgl2),
        quality: String(W.quality || ''),
        mode: W.match ? 'match' : 'boot',
      },
      contexts: {
        browser: { name: br.name, version: br.version },
        gpu: gpu,
        device: {
          screen_resolution: screen.width + 'x' + screen.height,
          screen_density: window.devicePixelRatio,
          memory_size: navigator.deviceMemory ? navigator.deviceMemory * 1073741824 : undefined,
          processor_count: navigator.hardwareConcurrency,
        },
        app: { app_start_time: new Date(t0).toISOString(), app_name: 'dust2' },
      },
      extra: Object.assign({
        seconds_since_load: Math.round((Date.now() - t0) / 100) / 10,
        boot_failures: W.bootFailures || null,
        frame: W.frame || 0,
        viewport: innerWidth + 'x' + innerHeight,
      }, extra || {}),
      breadcrumbs: { values: crumbs.slice() },
    };
    var body = JSON.stringify({ event_id: id, sent_at: new Date().toISOString(), dsn: DSN }) + '\n' +
      JSON.stringify({ type: 'event' }) + '\n' + JSON.stringify(event);
    try {
      // text/plain keeps this a "simple" CORS request (no preflight); keepalive survives unload.
      fetch(URL_, { method: 'POST', body: body, keepalive: body.length < 60000, headers: { 'Content-Type': 'text/plain;charset=UTF-8' } })
        .catch(function () {});
    } catch (e) { /* reporting must never throw */ }
  }

  // ---- hooks -----------------------------------------------------------------------------
  addEventListener('error', function (e) {
    var t = e.target;
    if (t && t !== window && (t.src || t.href)) {
      // resource failed to load (script/module/link)
      send('ResourceLoadError', 'Failed to load ' + (t.src || t.href), null, 'error', { tag: t.tagName });
      return;
    }
    var err = e.error;
    send((err && err.name) || 'Error', (err && err.message) || e.message || 'unknown error',
      (err && err.stack) || (e.filename ? 'at ' + e.filename + ':' + e.lineno + ':' + e.colno : ''));
  }, true);

  addEventListener('unhandledrejection', function (e) {
    var r = e.reason;
    send((r && r.name) || 'UnhandledRejection', (r && r.message) || String(r), r && r.stack);
  });

  // console.error is how main.js reports guarded boot/module failures; keep them as breadcrumbs
  // and forward the ones that mean a subsystem failed.
  var origErr = console.error;
  console.error = function () {
    try {
      var parts = [], errObj = null;
      for (var i = 0; i < arguments.length; i++) {
        var a = arguments[i];
        if (a instanceof Error) errObj = a;
        parts.push(a instanceof Error ? a.message : typeof a === 'object' ? (function () { try { return JSON.stringify(a); } catch (x) { return String(a); } })() : String(a));
      }
      var msg = parts.join(' ');
      crumb('console', msg, 'error');
      if (/^\[(boot|World)\]/.test(msg) || errObj) {
        send(errObj ? errObj.name : 'ConsoleError', msg, errObj && errObj.stack, 'error');
      }
    } catch (x) { /* ignore */ }
    return origErr.apply(console, arguments);
  };
  var origWarn = console.warn;
  console.warn = function () {
    try { crumb('console', Array.prototype.join.call(arguments, ' '), 'warning'); } catch (x) {}
    return origWarn.apply(console, arguments);
  };

  function hookContextLoss() {
    var c = document.getElementById('game');
    if (!c) return;
    c.addEventListener('webglcontextlost', function () {
      send('WebGLContextLost', 'WebGL context lost (GPU reset, driver crash or out of memory)', null, 'fatal');
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', hookContextLoss);
  else hookContextLoss();

  // Boot completion / failure, surfaced by main.js via window flags.
  var poll = setInterval(function () {
    if (window.__BOOT_ERROR) {
      phase = 'boot_failed';
      send('BootError', String(window.__BOOT_ERROR).split('\n')[0], String(window.__BOOT_ERROR), 'fatal');
      clearInterval(poll);
    } else if (window.__READY) {
      phase = 'running';
      crumb('lifecycle', 'boot complete in ' + ((Date.now() - t0) / 1000).toFixed(1) + 's');
      clearInterval(poll);
      if (/[?&]crashtest\b/.test(q)) {
        send('CrashTest', 'Crash-report pipeline test from ' + location.host, new Error('crashtest').stack, 'info');
      }
    }
  }, 500);
  // A boot that never finishes is a crash too (stuck shader compile, infinite loop in a module).
  setTimeout(function () {
    if (!window.__READY && !window.__BOOT_ERROR) {
      var st = document.getElementById('boot-status');
      send('BootTimeout', 'Boot did not finish within 120 s (stuck at: ' + (st ? st.textContent : '?') + ')', null, 'fatal');
    }
  }, 120000);

  window.__crash = {
    report: function (err, extra) { send((err && err.name) || 'Error', (err && err.message) || String(err), err && err.stack, 'error', extra); },
    crumb: crumb,
    setPhase: function (p) { phase = p; },
    get enabled() { return enabled; },
  };
})();
