/* 2026 紫花油工展會 — 官方展位圖雙角度轉盤（拖轉／自動切換） */
(function () {
  "use strict";

  var V = "20261105h";
  var FRAMES = [
    {
      src: "assets/img/booth/official-1.jpg?v=" + V,
      alt: "紫花油展位 · CUPAL／宅配計劃角度"
    },
    {
      src: "assets/img/booth/official-2.jpg?v=" + V,
      alt: "紫花油展位 · 安宮牛黃丸／精明點醒你角度"
    }
  ];
  var AUTO_MS = 3000;
  var RESUME_MS = 1900;
  var SWIPE_PX = 42;

  var stage = null;
  var track = null;
  var dots = null;
  var index = 0;
  var playing = true;
  var dragging = false;
  var drag = null;
  var autoTimer = null;
  var resumeTimer = null;
  var visible = false;
  var overlaysBuilt = false;
  var switchedThisDrag = false;

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
      goTo((index + 1) % FRAMES.length, "auto");
      scheduleAuto();
    }, AUTO_MS);
  }

  function setPlaying(on) {
    playing = !!on;
    var btn = $("boothPlayBtn");
    if (btn) {
      btn.setAttribute("aria-pressed", playing ? "true" : "false");
      btn.setAttribute("aria-label", playing ? "暫停自動切換角度" : "播放自動切換角度");
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

  function updateDots() {
    if (!dots) return;
    var buttons = dots.querySelectorAll("button");
    for (var i = 0; i < buttons.length; i++) {
      var on = i === index;
      buttons[i].classList.toggle("is-active", on);
      buttons[i].setAttribute("aria-current", on ? "true" : "false");
      buttons[i].setAttribute("aria-label", "角度 " + (i + 1) + (on ? "（目前）" : ""));
    }
  }

  function goTo(next, reason) {
    if (!track) return;
    var n = ((next % FRAMES.length) + FRAMES.length) % FRAMES.length;
    if (n === index && reason !== "init") return;
    index = n;
    track.style.transform = "translate3d(" + -index * 100 + "%, 0, 0)";
    track.setAttribute("data-angle", String(index + 1));
    if (stage) {
      stage.setAttribute(
        "aria-label",
        "紫花油展位官方 3D 圖，角度 " + (index + 1) + "／" + FRAMES.length + "，可拖轉或自動切換"
      );
    }
    updateDots();
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
    switchedThisDrag = false;
    var p = pointerXY(e);
    drag = { startX: p.x, startY: p.y, lastX: p.x };
    if (stage) stage.classList.add("is-dragging");
    if (e.type === "mousedown") e.preventDefault();
  }

  function onMove(e) {
    if (!drag) return;
    var p = pointerXY(e);
    var dx = p.x - drag.startX;
    var dy = p.y - drag.startY;
    drag.lastX = p.x;
    if (!switchedThisDrag && Math.abs(dx) >= SWIPE_PX && Math.abs(dx) > Math.abs(dy) * 1.15) {
      if (dx < 0) goTo(index + 1, "drag");
      else goTo(index - 1, "drag");
      switchedThisDrag = true;
      drag.startX = p.x;
    }
    if (e.cancelable && Math.abs(dx) > 8) e.preventDefault();
  }

  function onUp() {
    if (!drag) return;
    drag = null;
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

    dots = document.createElement("div");
    dots.className = "booth3d-dots";
    dots.setAttribute("role", "tablist");
    dots.setAttribute("aria-label", "展位角度");
    for (var i = 0; i < FRAMES.length; i++) {
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
    play.setAttribute("aria-label", "暫停自動切換角度");
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
    viewer.className = "booth3d-photo-viewer";

    track = document.createElement("div");
    track.className = "booth3d-photo-track";
    track.setAttribute("data-angle", "1");

    for (var i = 0; i < FRAMES.length; i++) {
      var slide = document.createElement("div");
      slide.className = "booth3d-photo-slide";
      var img = document.createElement("img");
      img.src = FRAMES[i].src;
      img.alt = FRAMES[i].alt;
      img.decoding = "async";
      img.draggable = false;
      if (i === 0) img.loading = "eager";
      else img.loading = "lazy";
      slide.appendChild(img);
      track.appendChild(slide);
    }

    viewer.appendChild(track);
    stage.insertBefore(viewer, stage.firstChild);

    ensureOverlays();
    goTo(0, "init");
  }

  function onShow() {
    visible = true;
    if (!track) buildViewer();
    if (playing) scheduleAuto();
  }

  function onHide() {
    visible = false;
    dragging = false;
    drag = null;
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
      track = null;
      if (stage) {
        var leftovers = stage.querySelectorAll(
          ".booth3d-photo-viewer, .booth3d-controls, .booth3d-floor-hint, .booth3d-dots, canvas.booth3d-canvas"
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
