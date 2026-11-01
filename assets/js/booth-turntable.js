/* 2026 紫花油工展會 — Three.js 立體展位（同一座模型繞 Y 慢轉＋拖轉） */
import * as THREE from "three";

(function () {
  "use strict";

  var TEX = [
    "assets/img/booth/booth-1.jpg?v=20261101e",
    "assets/img/booth/booth-2.jpg?v=20261101e",
    "assets/img/booth/booth-3.jpg?v=20261101e",
    "assets/img/booth/booth-4.jpg?v=20261101e"
  ];
  var AUTO_RAD_PER_SEC = 0.35;
  var RESUME_MS = 2000;
  var DRAG_GAIN = 0.005;

  var stage, canvas, renderer, scene, camera, booth;
  var playing = true;
  var dragging = false;
  var drag = null;
  var resumeTimer = null;
  var rafId = null;
  var lastTs = 0;
  var visible = false;
  var overlaysBuilt = false;
  var texLoader = null;
  var textures = [];

  function $(id) {
    return document.getElementById(id);
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
    if (playing) lastTs = 0;
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
    if (!drag || !booth) return;
    var x = pointerX(e);
    var dx = x - drag.last;
    drag.last = x;
    booth.rotation.y += dx * DRAG_GAIN;
    if (e.cancelable) e.preventDefault();
  }

  function onUp() {
    if (!drag) return;
    drag = null;
    if (stage) stage.classList.remove("is-dragging");
    if (playing) scheduleResume();
    else dragging = false;
  }

  function sizeRenderer() {
    if (!stage || !renderer || !camera) return;
    var w = stage.clientWidth || 320;
    var h = stage.clientHeight || 440;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  function matColor(hex, extras) {
    return new THREE.MeshStandardMaterial(
      Object.assign({ color: hex, roughness: 0.72, metalness: 0.08 }, extras || {})
    );
  }

  function matMap(tex, extras) {
    return new THREE.MeshStandardMaterial(
      Object.assign(
        {
          map: tex,
          roughness: 0.85,
          metalness: 0.05
        },
        extras || {}
      )
    );
  }

  function loadTextures() {
    return new Promise(function (resolve) {
      texLoader = new THREE.TextureLoader();
      var pending = TEX.length;
      textures = new Array(TEX.length);
      TEX.forEach(function (url, i) {
        texLoader.load(
          url,
          function (tex) {
            tex.colorSpace = THREE.SRGBColorSpace;
            tex.anisotropy = 4;
            textures[i] = tex;
            pending -= 1;
            if (pending <= 0) resolve(textures);
          },
          undefined,
          function () {
            // fallback solid
            textures[i] = null;
            pending -= 1;
            if (pending <= 0) resolve(textures);
          }
        );
      });
    });
  }

  function buildBoothModel(texs) {
    var group = new THREE.Group();
    var purple = 0x6b3fa0;
    var purpleDark = 0x4a2a73;
    var white = 0xf7f2fb;

    var t0 = texs[0];
    var t1 = texs[1] || texs[0];
    var t2 = texs[2] || texs[0];
    var t3 = texs[3] || texs[1] || texs[0];

    // 地台
    var floor = new THREE.Mesh(
      new THREE.BoxGeometry(5.2, 0.08, 4.2),
      matColor(0xd8dee6)
    );
    floor.position.y = -0.04;
    floor.receiveShadow = true;
    group.add(floor);

    // 主箱體（四面貼圖）— 有厚度嘅展位殼
    // materials order: +x, -x, +y, -y, +z, -z
    var shellMats = [
      matMap(t3 || t0), // right
      matMap(t2 || t0), // left
      matColor(purpleDark), // top
      matColor(0xb8c0c8), // bottom
      matMap(t0), // front
      matMap(t1) // back
    ];
    var shell = new THREE.Mesh(new THREE.BoxGeometry(3.4, 2.1, 2.6), shellMats);
    shell.position.y = 1.05;
    shell.castShadow = true;
    shell.receiveShadow = true;
    group.add(shell);

    // 頂部招牌板（加厚頂牌）
    var fasciaMats = [
      matColor(purple),
      matColor(purple),
      matMap(t1 || t0),
      matColor(purpleDark),
      matMap(t0),
      matMap(t1 || t0)
    ];
    var fascia = new THREE.Mesh(new THREE.BoxGeometry(3.7, 0.85, 0.22), fasciaMats);
    fascia.position.set(0, 2.45, 1.25);
    fascia.castShadow = true;
    group.add(fascia);

    // 頂牌側翼（令頂部有體積）
    var fasciaTop = new THREE.Mesh(
      new THREE.BoxGeometry(3.7, 0.08, 2.8),
      matColor(purple)
    );
    fasciaTop.position.y = 2.2;
    group.add(fasciaTop);

    // 前柱（左右）
    function pillar(x) {
      var p = new THREE.Mesh(
        new THREE.CylinderGeometry(0.16, 0.18, 2.15, 20),
        matColor(purple, { roughness: 0.45, metalness: 0.15 })
      );
      p.position.set(x, 1.07, 1.35);
      p.castShadow = true;
      group.add(p);
      var cap = new THREE.Mesh(
        new THREE.CylinderGeometry(0.2, 0.2, 0.08, 20),
        matColor(0xffffff)
      );
      cap.position.set(x, 2.18, 1.35);
      group.add(cap);
    }
    pillar(-1.45);
    pillar(1.45);

    // 櫃枱（前方有厚度）
    var counter = new THREE.Mesh(
      new THREE.BoxGeometry(2.4, 0.95, 0.7),
      [
        matColor(white),
        matColor(white),
        matColor(0xffffff),
        matColor(purpleDark),
        matMap(t2 || t0),
        matColor(purple)
      ]
    );
    counter.position.set(0, 0.48, 1.55);
    counter.castShadow = true;
    group.add(counter);

    // 櫃枱面加一層薄板
    var counterTop = new THREE.Mesh(
      new THREE.BoxGeometry(2.5, 0.05, 0.78),
      matColor(0xffffff, { roughness: 0.35 })
    );
    counterTop.position.set(0, 0.98, 1.55);
    group.add(counterTop);

    // 內背板（加強深度）
    var inner = new THREE.Mesh(
      new THREE.BoxGeometry(3.1, 1.8, 0.08),
      matMap(t1 || t0)
    );
    inner.position.set(0, 1.1, -0.9);
    group.add(inner);

    group.rotation.y = -0.4;
    return group;
  }

  function buildScene() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xd9e8f4);

    camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    camera.position.set(4.2, 2.6, 5.2);
    camera.lookAt(0, 1.1, 0);

    var hemi = new THREE.HemisphereLight(0xffffff, 0xb0a0c0, 1.05);
    scene.add(hemi);
    var dir = new THREE.DirectionalLight(0xffffff, 1.15);
    dir.position.set(5, 8, 4);
    dir.castShadow = true;
    dir.shadow.mapSize.set(1024, 1024);
    scene.add(dir);
    var fill = new THREE.DirectionalLight(0xc4b0ff, 0.35);
    fill.position.set(-4, 3, -2);
    scene.add(fill);

    // 地面陰影接收
    var ground = new THREE.Mesh(
      new THREE.CircleGeometry(6, 48),
      new THREE.MeshStandardMaterial({
        color: 0xcfd6de,
        roughness: 1,
        metalness: 0
      })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = 0;
    ground.receiveShadow = true;
    scene.add(ground);
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
    window.addEventListener("resize", sizeRenderer);

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

  function tick(ts) {
    rafId = requestAnimationFrame(tick);
    if (!visible || !renderer || !scene || !camera) return;
    if (!lastTs) lastTs = ts;
    var dt = Math.min(0.05, (ts - lastTs) / 1000);
    lastTs = ts;
    if (booth && playing && !dragging) {
      booth.rotation.y += AUTO_RAD_PER_SEC * dt;
    }
    renderer.render(scene, camera);
  }

  function startLoop() {
    if (rafId) return;
    lastTs = 0;
    rafId = requestAnimationFrame(tick);
  }

  function initRenderer() {
    stage = $("boothStage");
    if (!stage) return Promise.resolve();

    // clear previous canvas only
    var old = stage.querySelector("canvas.booth3d-canvas");
    if (old) old.remove();

    buildScene();

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    canvas = renderer.domElement;
    canvas.className = "booth3d-canvas";
    canvas.setAttribute("aria-hidden", "true");
    stage.insertBefore(canvas, stage.firstChild);

    ensureOverlays();
    sizeRenderer();

    return loadTextures().then(function (texs) {
      if (booth) scene.remove(booth);
      booth = buildBoothModel(texs);
      scene.add(booth);
      sizeRenderer();
    });
  }

  function onShow() {
    visible = true;
    var ready = renderer ? Promise.resolve() : initRenderer();
    ready.then(function () {
      sizeRenderer();
      startLoop();
    });
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
      if (renderer) {
        renderer.dispose();
        renderer = null;
      }
      scene = null;
      camera = null;
      booth = null;
      initRenderer().then(function () {
        if (visible) startLoop();
      });
    }
  };

  // 預載：DOM ready 時建好，切頁即轉
  function boot() {
    stage = $("boothStage");
    if (!stage) return;
    initRenderer();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
