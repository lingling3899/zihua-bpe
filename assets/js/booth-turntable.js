/* 2026 紫花油工展會 — Three.js 展位（貼近 Lovable：櫃枱／柱／頂牌／網格地板＋自動轉＋拖轉） */
import * as THREE from "three";

(function () {
  "use strict";

  var V = "20261101f";
  var TEX = {
    cupal: "assets/img/booth/tex-cupal.jpg?v=" + V,
    zihua: "assets/img/booth/tex-zihua-fascia.jpg?v=" + V,
    counter: "assets/img/booth/tex-counter.jpg?v=" + V,
    pillar: "assets/img/booth/tex-pillar.jpg?v=" + V,
    interior: "assets/img/booth/tex-interior.jpg?v=" + V,
    awning: "assets/img/booth/tex-awning.jpg?v=" + V,
    side: "assets/img/booth/tex-side.jpg?v=" + V,
    topper: "assets/img/booth/tex-topper.png?v=" + V,
    floor: "assets/img/booth/tex-floor.jpg?v=" + V
  };

  var AUTO_RAD_PER_SEC = 0.28;
  var RESUME_MS = 1800;
  var DRAG_GAIN = 0.0055;

  var stage, canvas, renderer, scene, camera, booth, pivot;
  var playing = true;
  var dragging = false;
  var drag = null;
  var resumeTimer = null;
  var rafId = null;
  var lastTs = 0;
  var visible = false;
  var overlaysBuilt = false;
  var texCache = {};

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
    dragging = true;
    var p = pointerXY(e);
    drag = { lastX: p.x, lastY: p.y };
    if (stage) stage.classList.add("is-dragging");
    if (e.type === "mousedown") e.preventDefault();
  }

  function onMove(e) {
    if (!drag || !pivot) return;
    var p = pointerXY(e);
    var dx = p.x - drag.lastX;
    var dy = p.y - drag.lastY;
    drag.lastX = p.x;
    drag.lastY = p.y;
    pivot.rotation.y += dx * DRAG_GAIN;
    // 輕微仰俯，但限制範圍，保持似截圖嘅展位視角
    camera.position.y = THREE.MathUtils.clamp(camera.position.y - dy * 0.012, 1.6, 4.2);
    camera.lookAt(0, 1.15, 0);
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

  function std(opts) {
    return new THREE.MeshStandardMaterial(
      Object.assign({ roughness: 0.78, metalness: 0.06 }, opts || {})
    );
  }

  function loadOne(loader, key, url) {
    return new Promise(function (resolve) {
      loader.load(
        url,
        function (tex) {
          tex.colorSpace = THREE.SRGBColorSpace;
          tex.anisotropy = 8;
          texCache[key] = tex;
          resolve(tex);
        },
        undefined,
        function () {
          texCache[key] = null;
          resolve(null);
        }
      );
    });
  }

  function loadTextures() {
    var loader = new THREE.TextureLoader();
    return Promise.all(
      Object.keys(TEX).map(function (k) {
        return loadOne(loader, k, TEX[k]);
      })
    ).then(function () {
      return texCache;
    });
  }

  function box(w, h, d, mat, x, y, z, cast, receive) {
    var mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.position.set(x || 0, y || 0, z || 0);
    mesh.castShadow = cast !== false;
    mesh.receiveShadow = !!receive;
    return mesh;
  }

  function faceMats(mapFront, solid, mapSide) {
    var solidMat = typeof solid === "number" ? std({ color: solid }) : solid;
    var front = mapFront
      ? std({ map: mapFront, roughness: 0.82 })
      : solidMat;
    var side = mapSide
      ? std({ map: mapSide, roughness: 0.85 })
      : solidMat;
    // +x -x +y -y +z -z
    return [side, side, solidMat, solidMat, front, solidMat];
  }

  function buildBoothModel(tex) {
    var g = new THREE.Group();
    var purple = 0x6b3fa0;
    var purpleDeep = 0x4a2a73;
    var white = 0xf7f4fb;
    var cream = 0xf3eef8;

    var mPurple = std({ color: purple, roughness: 0.55, metalness: 0.12 });
    var mPurpleDeep = std({ color: purpleDeep, roughness: 0.6 });
    var mWhite = std({ color: white, roughness: 0.55 });
    var mCream = std({ color: cream, roughness: 0.7 });
    var mGrey = std({ color: 0xd5dbe3, roughness: 0.95 });

    // —— 地台 ——
    var plinth = box(4.6, 0.08, 3.6, mWhite, 0, 0.04, 0, true, true);
    g.add(plinth);

    // —— 後牆（L：後＋右） ——
    var backWall = box(
      4.2,
      1.55,
      0.12,
      faceMats(tex.interior, purpleDeep),
      0,
      0.85,
      -1.55,
      true,
      true
    );
    g.add(backWall);

    var rightWall = box(
      0.12,
      1.55,
      2.8,
      faceMats(tex.side, purple, tex.side),
      2.05,
      0.85,
      -0.2,
      true,
      true
    );
    g.add(rightWall);

    // 左內牆（半封）
    var leftInner = box(0.1, 1.45, 1.8, mCream, -1.95, 0.8, -0.55, true, true);
    g.add(leftInner);

    // —— 前櫃枱（U／L：前橫＋右短＋左短）——
    var counterH = 0.92;
    var counterY = counterH / 2 + 0.08;
    var counterFront = new THREE.Mesh(
      new THREE.BoxGeometry(3.05, counterH, 0.55),
      [
        mWhite,
        mWhite,
        mWhite,
        mPurpleDeep,
        std({ map: tex.counter || null, color: tex.counter ? 0xffffff : 0xdcc8ef, roughness: 0.8 }),
        mPurple
      ]
    );
    counterFront.position.set(-0.15, counterY, 1.15);
    counterFront.castShadow = true;
    counterFront.receiveShadow = true;
    g.add(counterFront);

    var counterRight = box(0.55, counterH, 1.35, mWhite, 1.55, counterY, 0.55, true, true);
    g.add(counterRight);
    var counterLeft = box(0.5, counterH, 1.05, mWhite, -1.75, counterY, 0.7, true, true);
    g.add(counterLeft);

    // 櫃面厚板
    var topMat = std({ color: 0xffffff, roughness: 0.32, metalness: 0.08 });
    g.add(box(3.2, 0.06, 0.68, topMat, -0.15, counterH + 0.08, 1.15));
    g.add(box(0.68, 0.06, 1.45, topMat, 1.55, counterH + 0.08, 0.55));
    g.add(box(0.62, 0.06, 1.15, topMat, -1.75, counterH + 0.08, 0.7));

    // 櫃內工作枱
    g.add(box(2.2, 0.05, 0.7, mCream, 0.1, 0.78, 0.15));

    // POS／顯示器
    var monitorStand = box(0.08, 0.28, 0.08, std({ color: 0x334155 }), 0.85, 1.12, 0.35);
    g.add(monitorStand);
    var monitor = box(
      0.42,
      0.3,
      0.04,
      std({ color: 0x1e3a8a, emissive: 0x1d4ed8, emissiveIntensity: 0.25, roughness: 0.4 }),
      0.85,
      1.35,
      0.32
    );
    monitor.rotation.x = -0.12;
    g.add(monitor);

    // —— 右角紫色直立柱（紫花油直字）——
    var pillarMat = [
      mPurple,
      mPurple,
      mPurpleDeep,
      mPurpleDeep,
      std({ map: tex.pillar || null, color: purple, roughness: 0.5, metalness: 0.1 }),
      mPurple
    ];
    var pillar = new THREE.Mesh(new THREE.BoxGeometry(0.42, 2.35, 0.42), pillarMat);
    pillar.position.set(1.95, 1.25, 1.15);
    pillar.castShadow = true;
    g.add(pillar);
    // 柱頂帽
    g.add(box(0.5, 0.08, 0.5, mWhite, 1.95, 2.46, 1.15));

    // 左前支撐柱（較細）
    var leftPillar = box(0.28, 2.15, 0.28, mPurple, -1.95, 1.15, 1.15, true, true);
    g.add(leftPillar);
    g.add(box(0.34, 0.07, 0.34, mWhite, -1.95, 2.26, 1.15));

    // —— 中段紫色簷篷／飾條 ——
    var awningMat = std({ map: tex.awning || null, color: purple, roughness: 0.55 });
    var awningFront = box(4.15, 0.16, 0.38, awningMat, 0, 2.05, 1.25);
    g.add(awningFront);
    g.add(box(0.38, 0.16, 2.9, mPurple, 2.05, 2.05, -0.15));
    g.add(box(0.38, 0.16, 2.4, mPurple, -2.05, 2.05, 0.05));
    // 簷下燈帶
    var lightStrip = box(
      3.6,
      0.03,
      0.12,
      std({ color: 0xfff7e8, emissive: 0xffe4a3, emissiveIntensity: 0.65, roughness: 1 }),
      0,
      1.95,
      1.1
    );
    g.add(lightStrip);

    // —— 頂部招牌牆（左 CUPAL／右 紫花油）——
    var fasciaH = 1.15;
    var fasciaY = 2.7;

    var fasciaLeft = new THREE.Mesh(
      new THREE.BoxGeometry(2.15, fasciaH, 0.22),
      [
        mPurple,
        mPurple,
        mPurpleDeep,
        mPurpleDeep,
        std({ map: tex.cupal || null, color: 0x1e4b8c, roughness: 0.75 }),
        mPurpleDeep
      ]
    );
    fasciaLeft.position.set(-1.05, fasciaY, 1.18);
    fasciaLeft.castShadow = true;
    g.add(fasciaLeft);

    var fasciaRight = new THREE.Mesh(
      new THREE.BoxGeometry(2.05, fasciaH, 0.22),
      [
        mPurple,
        mPurple,
        mPurpleDeep,
        mPurpleDeep,
        std({ map: tex.zihua || null, color: 0x8b5cf6, roughness: 0.75 }),
        mPurpleDeep
      ]
    );
    fasciaRight.position.set(1.05, fasciaY, 1.18);
    fasciaRight.castShadow = true;
    g.add(fasciaRight);

    // 頂板／封頂
    g.add(box(4.25, 0.1, 2.9, mPurple, 0, 3.28, -0.1));
    // 後上牆
    g.add(
      box(
        4.2,
        1.15,
        0.12,
        faceMats(tex.zihua, purpleDeep),
        0,
        fasciaY,
        -1.55,
        true,
        true
      )
    );
    // 右側上牆
    g.add(
      box(
        0.12,
        1.15,
        2.7,
        faceMats(tex.side, purple),
        2.05,
        fasciaY,
        -0.25,
        true,
        true
      )
    );

    // —— 瓶形／薰衣草頂牌（alpha）——
    if (tex.topper) {
      var topperMat = new THREE.MeshStandardMaterial({
        map: tex.topper,
        transparent: true,
        alphaTest: 0.2,
        roughness: 0.7,
        metalness: 0.05,
        side: THREE.DoubleSide
      });
      var topper = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 1.1), topperMat);
      topper.position.set(1.45, 3.62, 1.30);
      topper.castShadow = true;
      g.add(topper);
      // 厚度感：後層實心剪影
      var topperBack = box(1.35, 0.85, 0.1, mPurple, 1.45, 3.52, 1.22);
      g.add(topperBack);
    } else {
      g.add(box(1.4, 0.7, 0.12, mPurple, 1.4, 3.45, 1.1));
    }

    // 內背 lightbox 邊框
    g.add(box(2.4, 1.15, 0.06, mWhite, 0, 1.55, -1.45));

    // 小貨架／展示格
    g.add(box(0.9, 0.5, 0.35, mCream, -1.1, 1.35, -0.9));
    g.add(box(0.08, 0.45, 0.32, mPurple, -1.45, 1.35, -0.9));
    g.add(box(0.08, 0.45, 0.32, mPurple, -0.75, 1.35, -0.9));

    // 地板紫色標記（似截圖）
    function floorTag(x, z, rot) {
      var tag = box(
        0.55,
        0.02,
        0.28,
        std({ color: purple, roughness: 0.5, metalness: 0.1 }),
        x,
        0.09,
        z
      );
      tag.rotation.y = rot || 0;
      g.add(tag);
    }
    floorTag(-1.2, 1.85, 0.15);
    floorTag(0.3, 1.95, -0.1);
    floorTag(1.6, 1.7, 0.35);

    g.position.y = 0;
    return g;
  }

  function buildScene(tex) {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xd8e7f5);
    scene.fog = new THREE.Fog(0xd8e7f5, 14, 28);

    camera = new THREE.PerspectiveCamera(38, 1, 0.1, 80);
    camera.position.set(3.9, 2.55, 5.8);
    camera.lookAt(0, 1.35, 0);

    var hemi = new THREE.HemisphereLight(0xffffff, 0xb7a8c9, 0.95);
    scene.add(hemi);

    var key = new THREE.DirectionalLight(0xffffff, 1.25);
    key.position.set(6, 10, 5);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.near = 1;
    key.shadow.camera.far = 30;
    key.shadow.camera.left = -8;
    key.shadow.camera.right = 8;
    key.shadow.camera.top = 8;
    key.shadow.camera.bottom = -8;
    key.shadow.bias = -0.0002;
    scene.add(key);

    var fill = new THREE.DirectionalLight(0xd4c4ff, 0.4);
    fill.position.set(-5, 4, -3);
    scene.add(fill);

    var rim = new THREE.DirectionalLight(0xffffff, 0.25);
    rim.position.set(-2, 3, 6);
    scene.add(rim);

    // 灰地板＋網格貼圖
    var floorMat = std({
      map: tex.floor || null,
      color: tex.floor ? 0xffffff : 0xc8d0d8,
      roughness: 1,
      metalness: 0
    });
    if (tex.floor) {
      tex.floor.wrapS = tex.floor.wrapT = THREE.RepeatWrapping;
      tex.floor.repeat.set(6, 6);
    }
    var ground = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), floorMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = 0;
    ground.receiveShadow = true;
    scene.add(ground);

    // 輔助透視線（似截圖）
    var grid = new THREE.GridHelper(24, 24, 0xffffff, 0xe8eef3);
    grid.position.y = 0.01;
    grid.material.transparent = true;
    grid.material.opacity = 0.45;
    scene.add(grid);

    pivot = new THREE.Group();
    booth = buildBoothModel(tex);
    pivot.add(booth);
    pivot.rotation.y = -0.38;
    scene.add(pivot);
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
    if (pivot && playing && !dragging) {
      pivot.rotation.y += AUTO_RAD_PER_SEC * dt;
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

    var old = stage.querySelector("canvas.booth3d-canvas");
    if (old) old.remove();

    return loadTextures().then(function (tex) {
      buildScene(tex);

      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.05;

      canvas = renderer.domElement;
      canvas.className = "booth3d-canvas";
      canvas.setAttribute("aria-hidden", "true");
      stage.insertBefore(canvas, stage.firstChild);

      ensureOverlays();
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
      pivot = null;
      initRenderer().then(function () {
        if (visible) startLoop();
      });
    }
  };

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
