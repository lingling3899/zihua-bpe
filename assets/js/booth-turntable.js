/* 2026 紫花油工展會 — 3D 展位 image turntable（自動轉＋拖轉） */
(function () {
  "use strict";

  var FRAMES = [
    "assets/img/booth/booth-1.jpg",
    "assets/img/booth/booth-2.jpg",
    "assets/img/booth/booth-3.jpg",
    "assets/img/booth/booth-4.jpg"
  ];
  var AUTO_MS = 1100;
  var RESUME_MS = 2000;
  var DRAG_PX = 36;

  var root, stage, imgs = [], dots = [], idx = 0;
  var autoTimer = null, resumeTimer = null, playing = true;
  var drag = null;

  function $(id) { return document.getElementById(id); }

  function setFrame(n, instant) {
    var len = FRAMES.length;
    if (!len) return;
    idx = ((n % len) + len) % len;
    imgs.forEach(function (img, i) {
      if (instant) img.style.transition = "none";
      img.classList.toggle("is-active", i === idx);
      if (instant) {
        // force reflow then restore transition
        void img.offsetWidth;
        img.style.transition = "";
      }
    });
    dots.forEach(function (d, i) {
      d.classList.toggle("is-on", i === idx);
    });
  }

  function next(dir) {
    setFrame(idx + (dir || 1));
  }

  function stopAuto() {
    if (autoTimer) {
      clearInterval(autoTimer);
      autoTimer = null;
    }
  }

  function clearResume() {
    if (resumeTimer) {
      clearTimeout(resumeTimer);
      resumeTimer = null;
    }
  }

  function startAuto() {
    stopAuto();
    if (!playing) return;
    autoTimer = setInterval(function () {
      next(1);
    }, AUTO_MS);
  }

  function pauseForDrag() {
    stopAuto();
    clearResume();
  }

  function scheduleResume() {
    clearResume();
    if (!playing) return;
    resumeTimer = setTimeout(function () {
      startAuto();
    }, RESUME_MS);
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
    if (playing) startAuto();
    else {
      stopAuto();
      clearResume();
    }
  }

  function pointerX(e) {
    if (e.touches && e.touches.length) return e.touches[0].clientX;
    if (e.changedTouches && e.changedTouches.length) return e.changedTouches[0].clientX;
    return e.clientX;
  }

  function onDown(e) {
    if (e.type === "mousedown" && e.button !== 0) return;
    pauseForDrag();
    drag = { x: pointerX(e), moved: 0, last: pointerX(e) };
    if (stage) stage.classList.add("is-dragging");
    if (e.type === "mousedown") {
      e.preventDefault();
    }
  }

  function onMove(e) {
    if (!drag) return;
    var x = pointerX(e);
    var dx = x - drag.last;
    drag.moved += dx;
    drag.last = x;
    while (Math.abs(drag.moved) >= DRAG_PX) {
      if (drag.moved > 0) {
        next(-1); // drag right → previous (rotate opposite)
        drag.moved -= DRAG_PX;
      } else {
        next(1);
        drag.moved += DRAG_PX;
      }
    }
    if (e.cancelable) e.preventDefault();
  }

  function onUp() {
    if (!drag) return;
    drag = null;
    if (stage) stage.classList.remove("is-dragging");
    scheduleResume();
  }

  function build() {
    root = $("view-booth3d");
    stage = $("boothStage");
    if (!root || !stage) return;

    stage.innerHTML = "";
    imgs = [];
    FRAMES.forEach(function (src, i) {
      var img = document.createElement("img");
      img.className = "booth-frame" + (i === 0 ? " is-active" : "");
      img.src = src + "?v=20261101c";
      img.alt = "紫花油展位角度 " + (i + 1);
      img.draggable = false;
      stage.appendChild(img);
      imgs.push(img);
    });

    var mtr = document.createElement("div");
    mtr.className = "booth3d-floor-hint hint-mtr";
    mtr.innerHTML = "銅鑼灣<small>港鐵銅鑼灣站 E 出口</small>";
    stage.appendChild(mtr);

    var stg = document.createElement("div");
    stg.className = "booth3d-floor-hint hint-stage";
    stg.innerHTML = "舞台<small>主舞台方向</small>";
    stage.appendChild(stg);

    var dotsWrap = document.createElement("div");
    dotsWrap.className = "booth3d-dots";
    dotsWrap.setAttribute("aria-hidden", "true");
    dots = [];
    FRAMES.forEach(function (_, i) {
      var s = document.createElement("span");
      if (i === 0) s.className = "is-on";
      dotsWrap.appendChild(s);
      dots.push(s);
    });
    stage.appendChild(dotsWrap);

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
    if (login) {
      login.addEventListener("click", function () {
        if (window.BPE_Shell && window.BPE_Shell.openLogin) {
          window.BPE_Shell.openLogin();
        }
      });
    }

    setFrame(0, true);
  }

  function onShow() {
    if (!stage) build();
    if (playing) startAuto();
  }

  function onHide() {
    stopAuto();
    clearResume();
  }

  window.BPE_Booth3D = {
    show: onShow,
    hide: onHide,
    rebuild: function () {
      stopAuto();
      clearResume();
      build();
      if (playing) startAuto();
    }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", build);
  } else {
    build();
  }
})();
