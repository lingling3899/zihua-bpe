/* 2026 紫花油工展會 — 單圖 strip 慢轉 360°（連續／可拖） */
(function () {
  "use strict";

  var V = "20261106b";
  var FRAME_COUNT = 8;
  var STRIP_W = 12800;
  var STRIP_H = 900;
  var FRAME_W = STRIP_W / FRAME_COUNT;
  var STRIP_SRC = "assets/img/booth/orbit-strip.jpg?v=" + V;

  var DEG_PER_SEC = 30; /* 360° ≈ 12s */
  var DEG_PER_PX = 1.75;
  var RESUME_MS = 2000;

  var stage = null;
  var viewer = null;
  var layer0 = null;
  var layer1 = null;
  var strip0 = null;
  var strip1 = null;
  var angleHint = null;
  var dots = null;

  var angle = 0; /* degrees [0, 360) */
  var playing = true;
  var dragging = false;
  var drag = null;
  var visible = false;
  var overlaysBuilt = false;
  var stripReady = false;
  var rafId = 0;
  var lastTs = 0;
  var resumeTimer = null;
  var layoutPending = false;

  function $(id) {
    return document.getElementById(id);
  }

  function wrapAngle(a) {
    a = a % 360;
    if (a < 0) a += 360;
    return a;
  }

  function clearResume() {
    if (resumeTimer) {
      clearTimeout(resumeTimer);
      resumeTimer = null;
    }
  }

  function scheduleResume() {
    clearResume();
    if (!playing || !visible) return;
    resumeTimer = setTimeout(function () {
      dragging = false;
      lastTs = 0;
      startLoop();
    }, RESUME_MS);
  }

  function stopLoop() {
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = 0;
    }
    lastTs = 0;
  }

  function startLoop() {
    if (rafId || !visible) return;
    lastTs = 0;
    rafId = requestAnimationFrame(tick);
  }

  function tick(ts) {
    rafId = 0;
    if (!visible) return;
    if (playing && !dragging) {
      if (!lastTs) lastTs = ts;
      var dt = Math.min(0.05, (ts - lastTs) / 1000);
      lastTs = ts;
      angle = wrapAngle(angle + DEG_PER_SEC * dt);
      paint();
    } else {
      lastTs = 0;
    }
    if (visible && playing && !dragging) {
      rafId = requestAnimationFrame(tick);
    }
  }

  function setPlaying(on) {
    playing = !!on;
    var btn = $("boothPlayBtn");
    if (btn) {
      btn.setAttribute("aria-pressed", playing ? "true" : "false");
      btn.setAttribute("aria-label", playing ? "暫停自動旋轉" : "播放自動旋轉");
      btn.textContent = playing ? "⏸" : "▶";
      btn.title = playing ? "暫停" : "播放";
    }
    if (playing) {
      if (!dragging) startLoop();
    } else {
      stopLoop();
      clearResume();
    }
  }

  function nearestFrame() {
    var frac = (angle / 360) * FRAME_COUNT;
    return Math.round(frac) % FRAME_COUNT;
  }

  function updateChrome() {
    if (angleHint) {
      angleHint.textContent = "慢轉 360° · 可拖動";
    }
    if (dots) {
      var idx = nearestFrame();
      var buttons = dots.querySelectorAll("button");
      for (var i = 0; i < buttons.length; i++) {
        var on = i === idx;
        buttons[i].classList.toggle("is-active", on);
        buttons[i].setAttribute("aria-current", on ? "true" : "false");
        buttons[i].setAttribute("aria-label", "角度 " + (i + 1) + (on ? "（目前）" : ""));
      }
    }
    if (stage) {
      stage.setAttribute(
        "aria-label",
        "紫花油展位 360° 圖，可慢轉或手拖；目前約 " + Math.round(angle) + " 度"
      );
    }
  }

  function layoutLayers() {
    if (!viewer || !strip0 || !strip1 || !stripReady) return;
    var vw = viewer.clientWidth;
    var vh = viewer.clientHeight;
    if (vw < 2 || vh < 2) return;

    /* contain: show full 16:9 frame (no crop); modest letterbox OK */
    var padX = 6;
    var padY = 6;
    var scale = Math.min((vw - padX * 2) / FRAME_W, (vh - padY * 2) / STRIP_H);
    if (scale <= 0) return;
    var dw = FRAME_W * scale;
    var dh = STRIP_H * scale;
    var stripCssW = dw * FRAME_COUNT;
    var ox = (vw - dw) / 2;
    var oy = (vh - dh) / 2;

    function place(img, frameIndex) {
      img.style.width = stripCssW + "px";
      img.style.height = dh + "px";
      img.style.transform =
        "translate(" + (ox - frameIndex * dw) + "px," + oy + "px)";
    }

    var frac = (angle / 360) * FRAME_COUNT;
    var i0 = Math.floor(frac) % FRAME_COUNT;
    if (i0 < 0) i0 += FRAME_COUNT;
    var i1 = (i0 + 1) % FRAME_COUNT;
    place(strip0, i0);
    place(strip1, i1);
  }

  function paint() {
    if (!layer0 || !layer1) return;
    var frac = (angle / 360) * FRAME_COUNT;
    var i0 = Math.floor(frac) % FRAME_COUNT;
    if (i0 < 0) i0 += FRAME_COUNT;
    var t = frac - Math.floor(frac);
    if (t < 0) t += 1;

    layoutLayers();
    layer0.style.opacity = String(1 - t);
    layer1.style.opacity = String(t);
    updateChrome();
  }

  function goToFrame(idx, reason) {
    var n = ((idx % FRAME_COUNT) + FRAME_COUNT) % FRAME_COUNT;
    angle = (n / FRAME_COUNT) * 360;
    paint();
  }

  function pointerXY(e) {
    var t =
      e.touches && e.touches.length
        ? e.touches[0]
        : e.changedTouches && e.changedTouches.length
          ? e.changedTouches[0]
          : e;
    return { x: t.clientX, y: t.clientY };
  }

  function onDown(e) {
    if (e.type === "mousedown" && e.button !== 0) return;
    clearResume();
    stopLoop();
    dragging = true;
    var p = pointerXY(e);
    drag = { lastX: p.x, startX: p.x, startY: p.y };
    if (stage) stage.classList.add("is-dragging");
    if (e.type === "mousedown") e.preventDefault();
  }

  function onMove(e) {
    if (!drag) return;
    var p = pointerXY(e);
    var dx = p.x - drag.lastX;
    var totalDx = p.x - drag.startX;
    var totalDy = p.y - drag.startY;
    drag.lastX = p.x;

    if (Math.abs(totalDx) > Math.abs(totalDy) * 0.7 || Math.abs(totalDx) > 4) {
      /* drag right → decrease angle (same sense as old frame advance on left drag) */
      angle = wrapAngle(angle - dx * DEG_PER_PX);
      paint();
      if (e.cancelable) e.preventDefault();
    }
  }

  function onUp() {
    if (!drag) return;
    drag = null;
    if (stage) stage.classList.remove("is-dragging");
    if (playing) scheduleResume();
    else dragging = false;
  }

  function onResize() {
    if (!visible) {
      layoutPending = true;
      return;
    }
    paint();
  }

  function ensureOverlays() {
    if (!stage || overlaysBuilt) return;

    var mtr = document.createElement("div");
    mtr.className = "booth3d-floor-hint hint-mtr";
    mtr.innerHTML = "銅鑼灣<small>港鐵銅鑼灣站 E 出口</small>";
    stage.appendChild(mtr);

    var stg = document.createElement("div");
    stg.className = "booth3d-floor-hint hint-stage";
    stg.innerHTML = "舞台<small>主舞台方向</small>";
    stage.appendChild(stg);

    angleHint = document.createElement("div");
    angleHint.className = "booth3d-angle-hint";
    angleHint.setAttribute("aria-live", "polite");
    angleHint.textContent = "慢轉 360° · 可拖動";
    stage.appendChild(angleHint);

    dots = document.createElement("div");
    dots.className = "booth3d-dots booth3d-dots--orbit";
    dots.setAttribute("role", "tablist");
    dots.setAttribute("aria-label", "展位角度標記");
    for (var i = 0; i < FRAME_COUNT; i++) {
      (function (idx) {
        var b = document.createElement("button");
        b.type = "button";
        b.className = "booth3d-dot";
        b.setAttribute("aria-label", "角度 " + (idx + 1));
        b.addEventListener("click", function (e) {
          e.stopPropagation();
          clearResume();
          stopLoop();
          goToFrame(idx, "dot");
          if (playing) scheduleResume();
        });
        dots.appendChild(b);
      })(i);
    }
    stage.appendChild(dots);

    var ctrls = document.createElement("div");
    ctrls.className = "booth3d-controls";
    var play = document.createElement("button");
    play.type = "button";
    play.id = "boothPlayBtn";
    play.className = "booth3d-ctrl";
    play.setAttribute("aria-pressed", "true");
    play.setAttribute("aria-label", "暫停自動旋轉");
    play.title = "暫停";
    play.textContent = "⏸";
    play.addEventListener("click", function (e) {
      e.stopPropagation();
      setPlaying(!playing);
    });
    ctrls.appendChild(play);
    stage.appendChild(ctrls);

    stage.addEventListener("mousedown", onDown);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    stage.addEventListener("touchstart", onDown, { passive: false });
    stage.addEventListener("touchmove", onMove, { passive: false });
    stage.addEventListener("touchend", onUp);
    stage.addEventListener("touchcancel", onUp);
    window.addEventListener("resize", onResize);

    var login = $("boothStaffLogin");
    if (login && !login.getAttribute("data-bound")) {
      login.setAttribute("data-bound", "1");
      login.addEventListener("click", function () {
        if (window.BPE_Shell && window.BPE_Shell.openLogin) {
          window.BPE_Shell.openLogin();
        }
      });
    }

    overlaysBuilt = true;
  }

  function makeStripImg() {
    var img = document.createElement("img");
    img.className = "booth3d-orbit-strip";
    img.src = STRIP_SRC;
    img.alt = "";
    img.decoding = "async";
    img.draggable = false;
    img.setAttribute("aria-hidden", "true");
    return img;
  }

  function buildViewer() {
    stage = $("boothStage");
    if (!stage) return;

    var oldCanvas = stage.querySelector("canvas.booth3d-canvas");
    if (oldCanvas) oldCanvas.remove();
    var oldViewer = stage.querySelector(".booth3d-photo-viewer");
    if (oldViewer) oldViewer.remove();

    viewer = document.createElement("div");
    viewer.className = "booth3d-photo-viewer booth3d-orbit-viewer";

    layer0 = document.createElement("div");
    layer0.className = "booth3d-orbit-layer";
    strip0 = makeStripImg();
    layer0.appendChild(strip0);

    layer1 = document.createElement("div");
    layer1.className = "booth3d-orbit-layer";
    strip1 = makeStripImg();
    layer1.appendChild(strip1);

    viewer.appendChild(layer0);
    viewer.appendChild(layer1);
    stage.insertBefore(viewer, stage.firstChild);

    function onStripLoad() {
      stripReady = true;
      paint();
    }
    if (strip0.complete && strip0.naturalWidth) onStripLoad();
    else strip0.addEventListener("load", onStripLoad);

    ensureOverlays();
    paint();
  }

  function onShow() {
    visible = true;
    if (!viewer) buildViewer();
    paint();
    if (playing && !dragging) startLoop();
  }

  function onHide() {
    visible = false;
    dragging = false;
    drag = null;
    stopLoop();
    clearResume();
    if (stage) stage.classList.remove("is-dragging");
  }

  window.BPE_Booth3D = {
    show: onShow,
    hide: onHide,
    rebuild: function () {
      stopLoop();
      clearResume();
      overlaysBuilt = false;
      stripReady = false;
      dots = null;
      angleHint = null;
      viewer = null;
      layer0 = null;
      layer1 = null;
      strip0 = null;
      strip1 = null;
      if (stage) {
        var leftovers = stage.querySelectorAll(
          ".booth3d-photo-viewer, .booth3d-controls, .booth3d-floor-hint, .booth3d-dots, .booth3d-angle-hint, canvas.booth3d-canvas"
        );
        for (var i = 0; i < leftovers.length; i++) leftovers[i].remove();
      }
      buildViewer();
      if (visible && playing && !dragging) startLoop();
    }
  };

  function boot() {
    stage = $("boothStage");
    if (!stage) return;
    buildViewer();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
