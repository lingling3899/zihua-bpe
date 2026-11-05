/* 抽獎遊戲：輪盤／乒乓球／翻牌 — 純前端示意；獎品以攤位當日為準 */
(function () {
  "use strict";

  var WHEEL = [
    { id: "grand", label: "大獎", weight: 1, color: "#D4A53C" },
    { id: "calendar", label: "年曆卡", weight: 8, color: "#5B21B6" },
    { id: "coaster", label: "杯墊", weight: 12, color: "#DDD4F4" },
    { id: "again", label: "下次再來", weight: 18, color: "#5B21B6" },
    { id: "pen", label: "原子筆", weight: 14, color: "#DDD4F4" },
    { id: "95off", label: "95折", weight: 10, color: "#5B21B6" },
    { id: "mystery", label: "神秘禮品", weight: 6, color: "#DDD4F4" },
    { id: "minus10", label: "再買減$10", weight: 12, color: "#5B21B6" },
    { id: "m200", label: "滿200減20", weight: 9, color: "#DDD4F4" }
  ];
  var PLINKO = [
    { id: "coaster", label: "杯墊" },
    { id: "pen", label: "原子筆" },
    { id: "mystery", label: "神秘禮品" },
    { id: "m200", label: "滿$200減$20" },
    { id: "grand", label: "大獎", highlight: true }
  ];
  var FLIP_FACES = ["🧲", "☂️", "🧴", "☕"];

  var activeTab = "wheel";
  var wheelAngle = 0;
  var spinning = false;
  var plinkoBusy = false;
  var flipState = null;
  var wheelRaf = 0;
  var plinkoRaf = 0;

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function sliceNeedsDarkText(hex) {
    var h = String(hex || "").replace("#", "");
    if (h.length === 3) h = h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
    if (h.length !== 6) return false;
    var r = parseInt(h.slice(0, 2), 16);
    var g = parseInt(h.slice(2, 4), 16);
    var b = parseInt(h.slice(4, 6), 16);
    // perceived luminance 0–1; light wedges need dark ink
    var lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return lum >= 0.62;
  }
  function easeOutQuart(t) {
    t = Math.max(0, Math.min(1, t));
    return 1 - Math.pow(1 - t, 4);
  }
  function easeInOutCubic(t) {
    t = Math.max(0, Math.min(1, t));
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }
  function pickWeighted(list) {
    var total = 0;
    list.forEach(function (x) { total += Number(x.weight) || 1; });
    var r = Math.random() * total;
    for (var i = 0; i < list.length; i++) {
      r -= Number(list[i].weight) || 1;
      if (r <= 0) return { item: list[i], index: i };
    }
    return { item: list[list.length - 1], index: list.length - 1 };
  }
  function record(game, prize) {
    try {
      var raw = localStorage.getItem("zihua_bpe_lucky_wins_v1");
      var list = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(list)) list = [];
      list.unshift({ t: new Date().toISOString(), game: game, prize: prize });
      localStorage.setItem("zihua_bpe_lucky_wins_v1", JSON.stringify(list.slice(0, 40)));
    } catch (e) {}
  }

  function tabsHtml() {
    var tabs = [
      { id: "wheel", label: "抽獎輪盤" },
      { id: "plinko", label: "乒乓球" },
      { id: "flip", label: "翻牌對對胡" }
    ];
    return (
      '<div class="lucky-tabs" role="tablist">' +
      tabs.map(function (t) {
        return '<button type="button" class="lucky-tab' + (activeTab === t.id ? " active" : "") +
          '" data-lucky-tab="' + t.id + '"' +
          ((spinning || plinkoBusy) && t.id !== activeTab ? " disabled" : "") +
          ">" + esc(t.label) + "</button>";
      }).join("") +
      "</div>"
    );
  }

  function wheelHtml() {
    var segs = WHEEL.length;
    var grad = WHEEL.map(function (w, i) {
      var a0 = (i / segs) * 360;
      var a1 = ((i + 1) / segs) * 360;
      return w.color + " " + a0 + "deg " + a1 + "deg";
    }).join(", ");
    var labels = WHEEL.map(function (w, i) {
      var mid = ((i + 0.5) / segs) * 360;
      var text = String(w.label);
      var len = Array.from(text).length;
      var flip = (mid > 90 && mid < 270) ? "180deg" : "0deg";
      var cls = "wheel-label";
      if (len <= 3) cls += " is-short";
      else if (len >= 6) cls += " is-long";
      if (sliceNeedsDarkText(w.color)) cls += " is-dark";
      return '<span class="' + cls + '" style="--a:' + mid + 'deg;--flip:' + flip + '">' + esc(text) + "</span>";
    }).join("");
    return (
      '<div class="wheel-wrap">' +
        '<div class="wheel-pointer" aria-hidden="true">▼</div>' +
        '<div class="wheel" id="luckyWheel" style="background: conic-gradient(' + grad + '); transform: rotate(' + wheelAngle + 'deg)">' +
          '<div class="wheel-center">紫花油</div>' +
          '<div class="wheel-labels">' + labels + "</div>" +
        "</div>" +
        '<button type="button" class="primary lucky-spin" id="btnSpinWheel"' + (spinning ? " disabled" : "") + ">" +
          (spinning ? "轉動中…" : "轉一次") +
        "</button>" +
        '<p class="lucky-result" id="wheelResult" aria-live="polite"></p>' +
      "</div>"
    );
  }

  function plinkoHtml() {
    var pegs = "";
    for (var r = 0; r < 8; r++) {
      pegs += '<div class="plinko-row">';
      for (var c = 0; c < r + 3; c++) pegs += '<span class="plinko-peg"></span>';
      pegs += "</div>";
    }
    var slots = PLINKO.map(function (s, i) {
      return '<div class="plinko-slot' + (s.highlight ? " gold" : "") + '" data-slot="' + i + '">' +
        '<span class="plinko-slot-n">' + (i + 1) + "</span>" +
        esc(s.label) + "</div>";
    }).join("");
    return (
      '<div class="plinko-wrap">' +
        '<div class="plinko-board" id="plinkoBoard">' +
          '<div class="plinko-ball" id="plinkoBall" hidden></div>' +
          pegs +
          '<div class="plinko-slots">' + slots + "</div>" +
        "</div>" +
        '<button type="button" class="primary" id="btnDropBall"' + (plinkoBusy ? " disabled" : "") + ">" +
          (plinkoBusy ? "落下中…" : "放下乒乓球") +
        "</button>" +
        '<p class="lucky-result" id="plinkoResult" aria-live="polite"></p>' +
      "</div>"
    );
  }

  function ensureFlip() {
    if (flipState) return;
    var faces = FLIP_FACES.concat(FLIP_FACES);
    for (var i = faces.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = faces[i]; faces[i] = faces[j]; faces[j] = tmp;
    }
    flipState = {
      faces: faces,
      flipped: [],
      matched: {},
      lock: false,
      moves: 0,
      start: null,
      done: false,
      timer: null
    };
  }

  function flipElapsed() {
    if (!flipState || !flipState.start) return 0;
    return Math.floor((Date.now() - flipState.start) / 1000);
  }

  function flipHtml() {
    ensureFlip();
    var cards = flipState.faces.map(function (f, i) {
      var open = flipState.flipped.indexOf(i) >= 0 || flipState.matched[i];
      return (
        '<button type="button" class="flip-card-v2' + (open ? " open" : "") + (flipState.matched[i] ? " matched" : "") +
          '" data-flip="' + i + '"' +
          (flipState.matched[i] || flipState.lock ? " disabled" : "") + ">" +
          '<span class="flip-inner">' +
            '<span class="flip-back">紫花油</span>' +
            '<span class="flip-front">' + f + "</span>" +
          "</span>" +
        "</button>"
      );
    }).join("");
    return (
      '<div class="flip-wrap">' +
        '<div class="flip-stats">' +
          '<span>⏱ ' + flipElapsed() + " 秒 · 翻咗 " + flipState.moves + " 次</span>" +
          '<button type="button" class="btn-ghost" id="btnFlipReset"' + (flipState.lock ? " disabled" : "") + ">重新開始</button>" +
        "</div>" +
        '<div class="flip-grid">' + cards + "</div>" +
        '<p class="lucky-result" id="flipResult" aria-live="polite">' +
          (flipState.done ? "完成！用時 " + flipElapsed() + " 秒" : "") +
        "</p>" +
      "</div>"
    );
  }

  function render() {
    var root = document.getElementById("luckyGamesRoot");
    if (!root) return;
    var body = "";
    if (activeTab === "wheel") body = wheelHtml();
    else if (activeTab === "plinko") body = plinkoHtml();
    else body = flipHtml();
    root.innerHTML =
      '<header class="lucky-hero">' +
        '<p class="pc-hero-kicker">2026 工展會 · 紫花油</p>' +
        "<h2>✨ 抽獎遊戲</h2>" +
        tabsHtml() +
      "</header>" +
      '<div class="lucky-body">' + body + "</div>" +
      '<p class="claim-safe">遊戲純娛樂示意；獎品以攤位當日供應為準，唔涉及產品療效聲稱。</p>';
  }

  function spinWheel() {
    if (spinning) return;
    spinning = true;
    var pick = pickWeighted(WHEEL);
    var segs = WHEEL.length;
    var seg = 360 / segs;
    var startAngle = ((wheelAngle % 360) + 360) % 360;
    // pointer at top; segment i center lands under pointer when rotate = 360 - (i*seg + seg/2)
    var targetMod = (360 - (pick.index * seg + seg / 2)) % 360;
    var extra = 360 * (5 + Math.floor(Math.random() * 3));
    var delta = ((targetMod - startAngle + 360) % 360) + extra;
    var duration = 2800 + Math.floor(Math.random() * 701); // 2.8–3.5s
    var t0 = performance.now();
    var btn = document.getElementById("btnSpinWheel");
    if (btn) {
      btn.disabled = true;
      btn.textContent = "轉動中…";
    }
    var resultEl = document.getElementById("wheelResult");
    if (resultEl) resultEl.textContent = "";
    if (wheelRaf) cancelAnimationFrame(wheelRaf);

    function frame(now) {
      var t = Math.min(1, (now - t0) / duration);
      var e = easeOutQuart(t);
      wheelAngle = startAngle + delta * e;
      var wheel = document.getElementById("luckyWheel");
      if (wheel) {
        wheel.style.transition = "none";
        wheel.style.transform = "rotate(" + wheelAngle + "deg)";
      }
      if (t < 1) {
        wheelRaf = requestAnimationFrame(frame);
      } else {
        wheelAngle = startAngle + delta;
        if (wheel) {
          wheel.style.transform = "rotate(" + wheelAngle + "deg)";
        }
        spinning = false;
        wheelRaf = 0;
        record("wheel", pick.item.label);
        var el = document.getElementById("wheelResult");
        if (el) el.textContent = "結果：" + pick.item.label + "（示意）";
        var b = document.getElementById("btnSpinWheel");
        if (b) {
          b.disabled = false;
          b.textContent = "轉一次";
        }
      }
    }
    wheelRaf = requestAnimationFrame(frame);
  }

  function dropPlinko() {
    if (plinkoBusy) return;
    var ball = document.getElementById("plinkoBall");
    var board = document.getElementById("plinkoBoard");
    if (!ball || !board) return;
    plinkoBusy = true;
    var btn = document.getElementById("btnDropBall");
    if (btn) {
      btn.disabled = true;
      btn.textContent = "落下中…";
    }
    var resultEl = document.getElementById("plinkoResult");
    if (resultEl) resultEl.textContent = "";
    document.querySelectorAll(".plinko-slot").forEach(function (s) {
      s.classList.remove("hit");
    });

    var slot = Math.floor(Math.random() * PLINKO.length);
    if (slot === 4 && Math.random() > 0.15) slot = Math.floor(Math.random() * 4);
    var endLeft = 10 + slot * 18 + (Math.random() * 4 - 2);
    var duration = 2000 + Math.floor(Math.random() * 400);
    var t0 = performance.now();
    var wiggles = [
      { t: 0.18, dx: 10 + Math.random() * 10 },
      { t: 0.36, dx: -(12 + Math.random() * 12) },
      { t: 0.55, dx: 8 + Math.random() * 10 },
      { t: 0.72, dx: -(6 + Math.random() * 8) }
    ];

    ball.hidden = false;
    ball.classList.remove("drop");
    ball.style.top = "8px";
    ball.style.left = "50%";
    ball.style.transition = "none";
    if (plinkoRaf) cancelAnimationFrame(plinkoRaf);

    function lerpWiggle(t) {
      var base = 50;
      var prev = 0;
      var prevDx = 0;
      for (var i = 0; i < wiggles.length; i++) {
        if (t < wiggles[i].t) {
          var u = (t - prev) / (wiggles[i].t - prev || 1);
          var dx = prevDx + (wiggles[i].dx - prevDx) * easeInOutCubic(u);
          return base + dx;
        }
        prev = wiggles[i].t;
        prevDx = wiggles[i].dx;
      }
      var u2 = (t - prev) / (1 - prev || 1);
      return base + prevDx + (endLeft - 50 - prevDx) * easeInOutCubic(u2);
    }

    function frame(now) {
      var t = Math.min(1, (now - t0) / duration);
      var e = easeInOutCubic(t);
      var topPct = 8 + e * 70; // 8px-ish → ~78%
      var leftPct = lerpWiggle(t);
      ball.style.top = topPct + "%";
      ball.style.left = leftPct + "%";
      if (t < 1) {
        plinkoRaf = requestAnimationFrame(frame);
      } else {
        ball.style.top = "78%";
        ball.style.left = endLeft + "%";
        plinkoBusy = false;
        plinkoRaf = 0;
        var prize = PLINKO[slot];
        record("plinko", prize.label);
        var el = document.getElementById("plinkoResult");
        if (el) el.textContent = "落入第 " + (slot + 1) + " 格：" + prize.label + "（示意）";
        document.querySelectorAll(".plinko-slot").forEach(function (s, i) {
          s.classList.toggle("hit", i === slot);
        });
        var b = document.getElementById("btnDropBall");
        if (b) {
          b.disabled = false;
          b.textContent = "放下乒乓球";
        }
      }
    }
    plinkoRaf = requestAnimationFrame(frame);
  }

  function onFlip(i) {
    ensureFlip();
    if (flipState.lock || flipState.matched[i] || flipState.flipped.indexOf(i) >= 0) return;
    if (!flipState.start) {
      flipState.start = Date.now();
      if (flipState.timer) clearInterval(flipState.timer);
      flipState.timer = setInterval(function () {
        if (activeTab === "flip" && !flipState.done) {
          var stats = document.querySelector(".flip-stats span");
          if (stats) stats.textContent = "⏱ " + flipElapsed() + " 秒 · 翻咗 " + flipState.moves + " 次";
        }
      }, 500);
    }
    flipState.flipped.push(i);
    flipState.moves += 1;
    render();
    if (flipState.flipped.length < 2) return;
    flipState.lock = true;
    var a = flipState.flipped[0], b = flipState.flipped[1];
    if (flipState.faces[a] === flipState.faces[b]) {
      flipState.matched[a] = true;
      flipState.matched[b] = true;
      flipState.flipped = [];
      flipState.lock = false;
      var left = flipState.faces.some(function (_, idx) { return !flipState.matched[idx]; });
      if (!left) {
        flipState.done = true;
        if (flipState.timer) clearInterval(flipState.timer);
        record("flip", "完成配對");
      }
      render();
    } else {
      setTimeout(function () {
        flipState.flipped = [];
        flipState.lock = false;
        render();
      }, 480);
    }
  }

  function bind() {
    var root = document.getElementById("luckyGamesRoot");
    if (!root || root._luckyBound) return;
    root._luckyBound = true;
    root.addEventListener("click", function (e) {
      var tab = e.target.closest("[data-lucky-tab]");
      if (tab) {
        if (spinning || plinkoBusy) return;
        activeTab = tab.getAttribute("data-lucky-tab");
        render();
        return;
      }
      if (e.target.closest("#btnSpinWheel")) { spinWheel(); return; }
      if (e.target.closest("#btnDropBall")) { dropPlinko(); return; }
      if (e.target.closest("#btnFlipReset")) {
        if (flipState && flipState.lock) return;
        if (flipState && flipState.timer) clearInterval(flipState.timer);
        flipState = null;
        render();
        return;
      }
      var card = e.target.closest("[data-flip]");
      if (card) onFlip(Number(card.getAttribute("data-flip")));
    });
  }

  window.BPE_LuckyGames = {
    render: function () { bind(); render(); }
  };
})();
