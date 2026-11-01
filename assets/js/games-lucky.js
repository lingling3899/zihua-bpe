/* 抽獎遊戲：輪盤／乒乓球／翻牌 — 純前端示意；獎品以攤位當日為準 */
(function () {
  "use strict";

  var WHEEL = [
    { id: "grand", label: "大獎", weight: 1, color: "#f5c542" },
    { id: "9off", label: "9折", weight: 8, color: "#9b6bd6" },
    { id: "coaster", label: "杯墊", weight: 12, color: "#c4a3e8" },
    { id: "again", label: "下次再來", weight: 18, color: "#7c4dbd" },
    { id: "pen", label: "原子筆", weight: 14, color: "#a67ce0" },
    { id: "95off", label: "95折", weight: 10, color: "#8e5cc9" },
    { id: "mystery", label: "神秘禮品", weight: 6, color: "#b58eef" },
    { id: "minus10", label: "再買減$10", weight: 12, color: "#6f3fb0" },
    { id: "m200", label: "滿200減20", weight: 9, color: "#d4b6f5" }
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
  var flipState = null;

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
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
          '" data-lucky-tab="' + t.id + '">' + esc(t.label) + "</button>";
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
      return '<span class="wheel-label" style="--a:' + mid + 'deg">' + esc(w.label) + "</span>";
    }).join("");
    return (
      '<div class="wheel-wrap">' +
        '<div class="wheel-pointer" aria-hidden="true">▼</div>' +
        '<div class="wheel" id="luckyWheel" style="background: conic-gradient(' + grad + '); transform: rotate(' + wheelAngle + 'deg)">' +
          '<div class="wheel-center">紫花油</div>' +
          '<div class="wheel-labels">' + labels + "</div>" +
        "</div>" +
        '<button type="button" class="primary lucky-spin" id="btnSpinWheel"' + (spinning ? " disabled" : "") + ">轉一次</button>" +
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
        '<button type="button" class="primary" id="btnDropBall">放下乒乓球</button>' +
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
          '" data-flip="' + i + '"' + (flipState.matched[i] ? " disabled" : "") + ">" +
          '<span class="flip-back">紫花油</span>' +
          '<span class="flip-front">' + f + "</span>" +
        "</button>"
      );
    }).join("");
    return (
      '<div class="flip-wrap">' +
        '<div class="flip-stats">' +
          '<span>⏱ ' + flipElapsed() + " 秒 · 翻咗 " + flipState.moves + " 次</span>" +
          '<button type="button" class="btn-ghost" id="btnFlipReset">重新開始</button>' +
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
    // pointer at top; wheel rotates clockwise; center of segment index under pointer
    var target = 360 - (pick.index * seg + seg / 2);
    var extra = 360 * (4 + Math.floor(Math.random() * 3));
    wheelAngle = (wheelAngle % 360) + extra + target;
    render();
    var wheel = document.getElementById("luckyWheel");
    if (wheel) {
      wheel.style.transition = "transform 4s cubic-bezier(.15,.85,.25,1)";
      wheel.style.transform = "rotate(" + wheelAngle + "deg)";
    }
    setTimeout(function () {
      spinning = false;
      record("wheel", pick.item.label);
      var el = document.getElementById("wheelResult");
      if (el) el.textContent = "結果：" + pick.item.label + "（示意）";
      var btn = document.getElementById("btnSpinWheel");
      if (btn) btn.disabled = false;
    }, 4100);
  }

  function dropPlinko() {
    var ball = document.getElementById("plinkoBall");
    var board = document.getElementById("plinkoBoard");
    if (!ball || !board) return;
    ball.hidden = false;
    ball.classList.remove("drop");
    void ball.offsetWidth;
    var slot = Math.floor(Math.random() * PLINKO.length);
    // bias slightly away from grand (index 4)
    if (slot === 4 && Math.random() > 0.15) slot = Math.floor(Math.random() * 4);
    var leftPct = 10 + slot * 18 + (Math.random() * 6 - 3);
    ball.style.setProperty("--end-left", leftPct + "%");
    ball.classList.add("drop");
    setTimeout(function () {
      var prize = PLINKO[slot];
      record("plinko", prize.label);
      var el = document.getElementById("plinkoResult");
      if (el) el.textContent = "落入第 " + (slot + 1) + " 格：" + prize.label + "（示意）";
      document.querySelectorAll(".plinko-slot").forEach(function (s, i) {
        s.classList.toggle("hit", i === slot);
      });
    }, 1600);
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
      }, 700);
    }
  }

  function bind() {
    var root = document.getElementById("luckyGamesRoot");
    if (!root || root._luckyBound) return;
    root._luckyBound = true;
    root.addEventListener("click", function (e) {
      var tab = e.target.closest("[data-lucky-tab]");
      if (tab) {
        activeTab = tab.getAttribute("data-lucky-tab");
        render();
        return;
      }
      if (e.target.closest("#btnSpinWheel")) { spinWheel(); return; }
      if (e.target.closest("#btnDropBall")) { dropPlinko(); return; }
      if (e.target.closest("#btnFlipReset")) {
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
