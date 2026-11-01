/* 2026 紫花油工展會 — 3D 展位：單圖連續 yaw（rAF），唔跳幀 */
(function () {
  "use strict";

  // 主視角：最清楚室外渲染；背面用同一圖（鏡像）保持「一幅圖」連貫
  var MAIN_SRC = "assets/img/booth/booth-2.jpg?v=20261101d";
  var DEG_PER_PX = 0.35;
  var AUTO_DEG_PER_SEC = 22;
  var RESUME_MS = 2000;
  var TILT_X = 8;

  var stage, platter;
  var angle = -18;
  var playing = true;
  var dragging = false;
  var resumeTimer = null;
  var rafId = null;
  var lastTs = 0;
  var drag = null;
  var built = false;
  var visible = false;

  function $(id) { return document.getElementById(id); }

  function applyTransform() {
    if (!platter) return;
    platter.style.transform =
      "rotateX(" + TILT_X + "deg) rotateY(" + angle + "deg)";
  }

  function clearResume() {
    if (resumeTimer) {
      clearTimeout(resumeTimer);
      resumeTimer = null;
    }
  }

  function stopLoop() {
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    lastTs = 0;
  }

  function tick(ts) {
    rafId = requestAnimationFrame(tick);
    if (!visible) return;
    if (!lastTs) lastTs = ts;
    var dt = Math.min(0.05, (ts - lastTs) / 1000);
    lastTs = ts;
    if (playing && !dragging) {
      angle += AUTO_DEG_PER_SEC * dt;
      if (angle > 360 || angle < -360) angle = angle % 360;
      applyTransform();
    }
  }

  function startLoop() {
    if (rafId) return;
    lastTs = 0;
    rafId = requestAnimationFrame(tick);
  }

  function scheduleResume() {
    clearResume();
    if (!playing) return;
    resumeTimer = setTimeout(function () {
      dragging = false;
      lastTs = 0;
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
    if (playing) {
      lastTs = 0;
      startLoop();
    }
  }

  function pointerX(e) {
    if (e.touches && e.touches.length) return e.touches[0].clientX;
    if (e.changedTouches && e.changedTouches.length) return e.changedTouches[0].clientX;
    return e.clientX;
  }

  function onDown(e) {
    if (e.type === "mousedown" && e.button !== 0) return;
    clearResume();
    dragging = true;
    drag = { last: pointerX(e) };
    if (stage) stage.classList.add("is-dragging");
    if (e.type === "mousedown") e.preventDefault();
  }

  function onMove(e) {
    if (!drag) return;
    var x = pointerX(e);
    var dx = x - drag.last;
    drag.last = x;
    // 拖右 → 展位向右轉（角度減少）
    angle -= dx * DEG_PER_PX;
    applyTransform();
    if (e.cancelable) e.preventDefault();
  }

  function onUp() {
    if (!drag) return;
    drag = null;
    if (stage) stage.classList.remove("is-dragging");
    if (playing) scheduleResume();
    else dragging = false;
  }

  function build() {
    stage = $("boothStage");
    if (!stage) return;

    stage.innerHTML = "";

    var scene = document.createElement("div");
    scene.className = "booth3d-scene";

    platter = document.createElement("div");
    platter.className = "booth3d-platter";

    var shadow = document.createElement("div");
    shadow.className = "booth3d-shadow";
    shadow.setAttribute("aria-hidden", "true");
    platter.appendChild(shadow);

    var card = document.createElement("div");
    card.className = "booth3d-card";

    function makeFace(cls) {
      var face = document.createElement("div");
      face.className = "booth3d-face " + cls;
      var img = document.createElement("img");
      img.src = MAIN_SRC;
      img.alt = "紫花油展位";
      img.draggable = false;
      face.appendChild(img);
      return face;
    }
    card.appendChild(makeFace("booth3d-face-front"));
    card.appendChild(makeFace("booth3d-face-back"));
    platter.appendChild(card);
    scene.appendChild(platter);
    stage.appendChild(scene);

    var mtr = document.createElement("div");
    mtr.className = "booth3d-floor-hint hint-mtr";
    mtr.innerHTML = "銅鑼灣<small>港鐵銅鑼灣站 E 出口</small>";
    stage.appendChild(mtr);

    var stg = document.createElement("div");
    stg.className = "booth3d-floor-hint hint-stage";
    stg.innerHTML = "舞台<small>主舞台方向</small>";
    stage.appendChild(stg);

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

    if (!built) {
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
      built = true;
    }

    applyTransform();
  }

  function onShow() {
    visible = true;
    if (!platter) build();
    applyTransform();
    startLoop();
  }

  function onHide() {
    visible = false;
    dragging = false;
    drag = null;
    clearResume();
    stopLoop();
  }

  window.BPE_Booth3D = {
    show: onShow,
    hide: onHide,
    rebuild: function () {
      stopLoop();
      clearResume();
      built = false;
      platter = null;
      build();
      if (visible) startLoop();
    }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", build);
  } else {
    build();
  }
})();
