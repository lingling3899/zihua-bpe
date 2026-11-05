/* 2026 紫花油工展會 — 8 幀 360° 展位轉盤（拖轉／連續慢轉） */
(function () {
  "use strict";

  var V = "20261105i";
  var FRAME_COUNT = 8;
  var FRAMES = [];
  for (var fi = 0; fi < FRAME_COUNT; fi++) {
    var pad = fi < 10 ? "0" + fi : String(fi);
    var alts = {
      0: "紫花油展位 · CUPAL／宅配計劃角度（官方）",
      4: "紫花油展位 · 安宮牛黃丸／精明點醒你角度（官方）"
    };
    FRAMES.push({
      src: "assets/img/booth/orbit/" + pad + ".jpg?v=" + V,
      alt: alts[fi] || "紫花油展位 · 角度 " + (fi + 1) + "／8"
    });
  }

  var AUTO_MS = 150;
  var RESUME_MS = 1800;
  var PX_PER_FRAME = 48;

  var stage = null;
  var frameImg = null;
  var angleHint = null;
  var dots = null;
  var index = 0;
  var playing = true;
  var dragging = false;
  var drag = null;
  var autoTimer = null;
  var resumeTimer = null;
  var visible = false;
  var overlaysBuilt = false;
  var preloaded = false;
  var accumDx = 0;

  function $(id) {
    return document.getElementById(id);
  }

  function clearResume() {
    if (resumeTimer) {
      clearTimeout(resumeTimer);
      resumeTimer = null;
    }
  }

  function clearAuto() {
    if (autoTimer) {
      clearTimeout(autoTimer);
      autoTimer = null;
    }
  }

  function scheduleResume() {
    clearResume();
    if (!playing || !visible) return;
    resumeTimer = setTimeout(function () {
      dragging = false;
      scheduleAuto();
    }, RESUME_MS);
  }

  function scheduleAuto() {
    clearAuto();
    if (!playing || !visible || dragging) return;
    autoTimer = setTimeout(function () {
      goTo(index + 1, "auto");
      scheduleAuto();
    }, AUTO_MS);
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
      scheduleAuto();
    } else {
      clearAuto();
      clearResume();
    }
  }

  function updateChrome() {
    if (angleHint) {
      angleHint.textContent = "角度 " + (index + 1) + "／" + FRAME_COUNT;
    }
    if (dots) {
      var buttons = dots.querySelectorAll("button");
      for (var i = 0; i < buttons.length; i++) {
        var on = i === index;
        buttons[i].classList.toggle("is-active", on);
        buttons[i].setAttribute("aria-current", on ? "true" : "false");
        buttons[i].setAttribute("aria-label", "角度 " + (i + 1) + (on ? "（目前）" : ""));
      }
    }
    if (stage) {
      stage.setAttribute(
        "aria-label",
        "紫花油展位 360° 圖，角度 " + (index + 1) + "／" + FRAME_COUNT + "，可拖轉或自動旋轉"
      );
    }
  }

  function goTo(next, reason) {
    if (!frameImg) return;
    var n = ((next % FRAME_COUNT) + FRAME_COUNT) % FRAME_COUNT;
    if (n === index && reason !== "init") return;
    index = n;
    var frame = FRAMES[index];
    if (frameImg.getAttribute("src") !== frame.src) {
      frameImg.src = frame.src;
    }
    frameImg.alt = frame.alt;
    updateChrome();
  }

  function preloadAll() {
    if (preloaded) return;
    preloaded = true;
    for (var i = 0; i < FRAMES.length; i++) {
      var img = new Image();
      img.decoding = "async";
      img.src = FRAMES[i].src;
    }
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
    clearAuto();
    clearResume();
    dragging = true;
    accumDx = 0;
    var p = pointerXY(e);
    drag = { startX: p.x, startY: p.y, lastX: p.x };
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

    if (Math.abs(totalDx) > Math.abs(totalDy) * 0.85 || Math.abs(accumDx) > 0) {
      accumDx += dx;
      while (accumDx <= -PX_PER_FRAME) {
        goTo(index + 1, "drag");
        accumDx += PX_PER_FRAME;
      }
      while (accumDx >= PX_PER_FRAME) {
        goTo(index - 1, "drag");
        accumDx -= PX_PER_FRAME;
      }
      if (e.cancelable) e.preventDefault();
    }
  }

  function onUp() {
    if (!drag) return;
    drag = null;
    accumDx = 0;
    if (stage) stage.classList.remove("is-dragging");
    if (playing) scheduleResume();
    else dragging = false;
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
    angleHint.textContent = "角度 1／" + FRAME_COUNT;
    stage.appendChild(angleHint);

    dots = document.createElement("div");
    dots.className = "booth3d-dots booth3d-dots--orbit";
    dots.setAttribute("role", "tablist");
    dots.setAttribute("aria-label", "展位角度");
    for (var i = 0; i < FRAME_COUNT; i++) {
      (function (idx) {
        var b = document.createElement("button");
        b.type = "button";
        b.className = "booth3d-dot";
        b.setAttribute("aria-label", "角度 " + (idx + 1));
        b.addEventListener("click", function (e) {
          e.stopPropagation();
          clearAuto();
          clearResume();
          goTo(idx, "dot");
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

  function buildViewer() {
    stage = $("boothStage");
    if (!stage) return;

    var oldCanvas = stage.querySelector("canvas.booth3d-canvas");
    if (oldCanvas) oldCanvas.remove();
    var oldViewer = stage.querySelector(".booth3d-photo-viewer");
    if (oldViewer) oldViewer.remove();

    var viewer = document.createElement("div");
    viewer.className = "booth3d-photo-viewer booth3d-orbit-viewer";

    frameImg = document.createElement("img");
    frameImg.className = "booth3d-orbit-img";
    frameImg.src = FRAMES[0].src;
    frameImg.alt = FRAMES[0].alt;
    frameImg.decoding = "async";
    frameImg.loading = "eager";
    frameImg.draggable = false;
    viewer.appendChild(frameImg);

    stage.insertBefore(viewer, stage.firstChild);

    ensureOverlays();
    preloadAll();
    goTo(0, "init");
  }

  function onShow() {
    visible = true;
    if (!frameImg) buildViewer();
    preloadAll();
    if (playing) scheduleAuto();
  }

  function onHide() {
    visible = false;
    dragging = false;
    drag = null;
    accumDx = 0;
    clearAuto();
    clearResume();
    if (stage) stage.classList.remove("is-dragging");
  }

  window.BPE_Booth3D = {
    show: onShow,
    hide: onHide,
    rebuild: function () {
      clearAuto();
      clearResume();
      overlaysBuilt = false;
      dots = null;
      angleHint = null;
      frameImg = null;
      if (stage) {
        var leftovers = stage.querySelectorAll(
          ".booth3d-photo-viewer, .booth3d-controls, .booth3d-floor-hint, .booth3d-dots, .booth3d-angle-hint, canvas.booth3d-canvas"
        );
        for (var i = 0; i < leftovers.length; i++) leftovers[i].remove();
      }
      buildViewer();
      if (visible && playing) scheduleAuto();
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
