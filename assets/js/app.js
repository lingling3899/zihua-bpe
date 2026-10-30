(function () {
  "use strict";

  var LS = {
    shifts: "zihua_bpe_shifts_v1",
    snacks: "zihua_bpe_snacks_v1",
    members: "zihua_bpe_members_v1",
    prizes: "zihua_bpe_prizes_v1",
    socials: "zihua_bpe_socials_v1",
    wins: "zihua_bpe_wins_v1"
  };

  var FAIR_START = "2026-12-12";
  var FAIR_END = "2027-01-04";

  function $(id) { return document.getElementById(id); }
  function qs(sel, root) { return (root || document).querySelector(sel); }
  function qsa(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function loadJSON(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      if (raw) return JSON.parse(raw);
    } catch (e) { /* ignore */ }
    return fallback;
  }
  function saveJSON(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) { /* ignore */ }
  }

  function uid(prefix) {
    return (prefix || "id") + "-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 7);
  }

  function todayInFair() {
    var now = new Date();
    var y = now.getFullYear();
    var m = String(now.getMonth() + 1).padStart(2, "0");
    var d = String(now.getDate()).padStart(2, "0");
    var iso = y + "-" + m + "-" + d;
    if (iso < FAIR_START) return FAIR_START;
    if (iso > FAIR_END) return FAIR_END;
    return iso;
  }

  function getAuth() {
    return window.ZihuaAdminAuth || null;
  }

  function isAdmin() {
    var a = getAuth();
    return !!(a && a.isLoggedIn && a.isLoggedIn());
  }

  /* ---------- Navigation ---------- */

  function showView(name) {
    ["fair", "schedule", "games", "social", "join", "admin"].forEach(function (v) {
      var el = $("view-" + v);
      if (el) el.classList.toggle("hidden", v !== name);
    });
    qsa(".nav-tabs button").forEach(function (b) {
      b.classList.toggle("active", b.getAttribute("data-view") === name);
    });
    if (name === "schedule") renderSchedule();
    if (name === "social") renderSocials();
    if (name === "games") renderWinLog();
    if (name === "admin") {
      setAdminVisible(isAdmin());
      if (isAdmin()) {
        renderMembers();
        renderPrizeEditor();
        renderSocialEditor();
      }
    }
    if (name === "join") fillProductSelects();
  }

  /* ---------- Schedule ---------- */
  function getShifts() {
    var seed = window.BPE_SCHEDULE_SEED;
    var stored = loadJSON(LS.shifts, null);
    if (stored && Array.isArray(stored)) return stored;
    return seed && seed.shifts ? seed.shifts.slice() : [];
  }
  function setShifts(list) { saveJSON(LS.shifts, list); }

  function getSnacks() {
    var seed = window.BPE_SCHEDULE_SEED;
    var stored = loadJSON(LS.snacks, null);
    if (stored && Array.isArray(stored)) return stored;
    return seed && seed.snackNotes ? seed.snackNotes.slice() : [];
  }
  function setSnacks(list) { saveJSON(LS.snacks, list); }

  function renderSchedule() {
    var dateEl = $("schedDate");
    var modeEl = $("schedMode");
    var roleEl = $("schedRole");
    if (!dateEl.value) dateEl.value = todayInFair();
    var date = dateEl.value;
    var mode = modeEl.value;
    var role = roleEl.value;
    var list = getShifts().filter(function (s) {
      if (mode === "day" && s.date !== date) return false;
      if (role && s.role !== role) return false;
      return true;
    });
    list.sort(function (a, b) {
      if (a.date !== b.date) return a.date < b.date ? -1 : 1;
      if (a.start !== b.start) return a.start < b.start ? -1 : 1;
      return String(a.role).localeCompare(String(b.role));
    });
    var box = $("shiftList");
    if (!list.length) {
      box.innerHTML = '<p class="empty-state">呢段時間未有班次。</p>';
    } else {
      box.innerHTML = list.map(function (s) {
        var empty = !s.name || s.name === "待填";
        var adminBtns = isAdmin()
          ? '<div class="btn-row"><button type="button" class="btn-ghost" data-edit-shift="' + s.id + '">編輯</button>' +
            '<button type="button" class="btn-danger" data-del-shift="' + s.id + '">刪除</button></div>'
          : "";
        return (
          '<article class="shift-card' + (empty ? " empty-name" : "") + '">' +
          '<div class="role"><span class="role-chip">' + esc(s.role) + "</span></div>" +
          '<div class="when">' + esc(s.date) + "　" + esc(s.start) + "–" + esc(s.end) + "</div>" +
          '<div class="who">' + esc(s.name || "待填") + "</div>" +
          (s.note ? '<div class="note">' + esc(s.note) + "</div>" : "") +
          adminBtns +
          "</article>"
        );
      }).join("");
    }
    // snack note
    var snacks = getSnacks();
    var sn = snacks.find(function (n) { return n.date === date; });
    $("snackNoteText").textContent = sn && sn.text ? sn.text : "（未有備註）";
    if ($("snackNoteInput")) $("snackNoteInput").value = sn && sn.text ? sn.text : "";
  }

  function openShiftModal(shift) {
    $("shiftModal").classList.remove("hidden");
    $("shiftModalTitle").textContent = shift ? "編輯班次" : "新增班次";
    $("shiftId").value = shift ? shift.id : "";
    $("shiftDate").value = shift ? shift.date : ($("schedDate").value || todayInFair());
    $("shiftStart").value = shift ? shift.start : "11:00";
    $("shiftEnd").value = shift ? shift.end : "15:00";
    $("shiftRoleSel").value = shift ? shift.role : "Promoter";
    $("shiftName").value = shift ? shift.name : "待填";
    $("shiftNote").value = shift ? (shift.note || "") : "";
  }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  /* ---------- Prizes ---------- */
  function getPrizes() {
    var stored = loadJSON(LS.prizes, null);
    if (stored && stored.prizes) return stored;
    return window.BPE_PRIZES_DEFAULT || { version: 1, prizes: [] };
  }
  function setPrizes(obj) { saveJSON(LS.prizes, obj); }

  function pickPrize() {
    var prizes = getPrizes().prizes || [];
    var total = 0;
    prizes.forEach(function (p) { total += Number(p.weight) || 0; });
    if (total <= 0) return { label: "謝謝惠顧", id: "none" };
    var r = Math.random() * total;
    var acc = 0;
    for (var i = 0; i < prizes.length; i++) {
      acc += Number(prizes[i].weight) || 0;
      if (r <= acc) {
        var p = prizes[i];
        if (p.variants && p.variants.length) {
          var v = p.variants[Math.floor(Math.random() * p.variants.length)];
          return { id: p.id, label: v };
        }
        return { id: p.id, label: p.label };
      }
    }
    return { id: prizes[0].id, label: prizes[0].label };
  }

  function recordWin(game, prize) {
    var wins = loadJSON(LS.wins, []);
    wins.unshift({
      t: new Date().toISOString(),
      game: game,
      prize: prize.label,
      prizeId: prize.id
    });
    if (wins.length > 100) wins = wins.slice(0, 100);
    saveJSON(LS.wins, wins);
    renderWinLog();
  }

  function renderWinLog() {
    var wins = loadJSON(LS.wins, []);
    var ul = $("winLog");
    if (!ul) return;
    if (!wins.length) {
      ul.innerHTML = "<li class='muted'>未有記錄</li>";
      return;
    }
    ul.innerHTML = wins.slice(0, 20).map(function (w) {
      var t = w.t ? w.t.replace("T", " ").slice(0, 16) : "";
      return "<li>" + esc(t) + " · " + esc(w.game) + " → <strong>" + esc(w.prize) + "</strong></li>";
    }).join("");
  }

  function showPrize(gameKey, gameLabel) {
    var prize = pickPrize();
    var banner = $("prizeBanner");
    banner.classList.remove("hidden");
    banner.innerHTML = "🎉 恭喜！獎品：<br>" + esc(prize.label);
    $("gameStatus").textContent = "完成！";
    recordWin(gameLabel, prize);
  }

  /* ---------- Games ---------- */
  var currentGame = null;
  var gameState = {};

  var GAME_META = {
    lottery: { title: "抽獎轉盤", hint: "撳大掣轉盤，停低就派獎。" },
    pot: { title: "投壺", hint: "連中 2 個壺口即贏。撳目標投！" },
    beanbag: { title: "豆袋", hint: "有 3 次機會，撳中目標即得分；攞夠 2 分就贏。" },
    flip: { title: "翻牌子", hint: "翻開配對兩張相同牌子。全部配對即贏。" },
    claw: { title: "夾東西", hint: "撳「左／右」移機，再撳「夾」試夾中間獎品。" },
    ring: { title: "拋圈圈", hint: "有 3 次機會，撳柱子拋圈；中 2 次即贏。" }
  };

  function openGame(key) {
    currentGame = key;
    var meta = GAME_META[key];
    $("gamePicker").classList.add("hidden");
    $("gameArena").classList.remove("hidden");
    $("gameTitle").textContent = meta.title;
    $("gameHint").textContent = meta.hint;
    $("prizeBanner").classList.add("hidden");
    $("gameStatus").textContent = "";
    gameState = {};
    var body = $("gameBody");
    body.innerHTML = "";
    if (key === "lottery") startLottery(body);
    else if (key === "pot") startTargets(body, "pot", 2, 3);
    else if (key === "beanbag") startTargets(body, "beanbag", 2, 3);
    else if (key === "flip") startFlip(body);
    else if (key === "claw") startClaw(body);
    else if (key === "ring") startRing(body);
  }

  function startLottery(body) {
    body.innerHTML =
      '<div class="wheel-wrap"><div class="wheel-pointer"></div><div class="wheel" id="wheel"></div>' +
      '<button type="button" class="big-tap" id="spinBtn">開始抽獎</button></div>';
    var spinning = false;
    $("spinBtn").onclick = function () {
      if (spinning) return;
      spinning = true;
      this.disabled = true;
      $("gameStatus").textContent = "轉緊…";
      var wheel = $("wheel");
      var extra = 4 + Math.floor(Math.random() * 4);
      var deg = extra * 360 + Math.floor(Math.random() * 360);
      wheel.style.transform = "rotate(" + deg + "deg)";
      setTimeout(function () {
        showPrize("lottery", "抽獎");
        spinning = false;
      }, 4200);
    };
  }

  function startTargets(body, gameKey, needHits, tries) {
    gameState.hits = 0;
    gameState.tries = tries;
    body.innerHTML =
      '<div class="targets">' +
      '<button type="button" class="target" data-i="0">①</button>' +
      '<button type="button" class="target" data-i="1">②</button>' +
      '<button type="button" class="target" data-i="2">③</button>' +
      "</div>" +
      '<p style="text-align:center;" class="muted">剩餘次數：<span id="triesLeft">' + tries + '</span>　命中：<span id="hitCount">0</span></p>';
    qsa(".target", body).forEach(function (t) {
      t.onclick = function () {
        if (gameState.done) return;
        if (gameState.tries <= 0) return;
        gameState.tries--;
        var hit = Math.random() < 0.55;
        if (hit) {
          this.classList.add("hit");
          gameState.hits++;
          $("gameStatus").textContent = "中！";
        } else {
          this.classList.add("miss");
          $("gameStatus").textContent = "差少少…";
          var self = this;
          setTimeout(function () { self.classList.remove("miss"); }, 400);
        }
        $("triesLeft").textContent = String(gameState.tries);
        $("hitCount").textContent = String(gameState.hits);
        if (gameState.hits >= needHits) {
          gameState.done = true;
          showPrize(gameKey, GAME_META[gameKey].title);
        } else if (gameState.tries <= 0) {
          gameState.done = true;
          $("gameStatus").textContent = "今次未過關，再試！";
        }
      };
    });
  }

  function startFlip(body) {
    var icons = ["🖊️", "📅", "🎁", "🎫", "🖊️", "📅", "🎁", "🎫"];
    for (var i = icons.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = icons[i]; icons[i] = icons[j]; icons[j] = tmp;
    }
    gameState.cards = icons;
    gameState.open = [];
    gameState.matched = 0;
    gameState.lock = false;
    var html = '<div class="flip-board">';
    for (var k = 0; k < 8; k++) {
      html += '<button type="button" class="flip-card" data-i="' + k + '">?</button>';
    }
    html += "</div>";
    body.innerHTML = html;
    qsa(".flip-card", body).forEach(function (btn) {
      btn.onclick = function () {
        if (gameState.lock || gameState.done) return;
        var i = Number(this.getAttribute("data-i"));
        if (this.classList.contains("open") || this.classList.contains("matched")) return;
        this.classList.add("open");
        this.textContent = gameState.cards[i];
        gameState.open.push(i);
        if (gameState.open.length === 2) {
          gameState.lock = true;
          var a = gameState.open[0], b = gameState.open[1];
          var same = gameState.cards[a] === gameState.cards[b];
          setTimeout(function () {
            var cards = qsa(".flip-card", body);
            if (same) {
              cards[a].classList.add("matched");
              cards[b].classList.add("matched");
              gameState.matched += 2;
              $("gameStatus").textContent = "配對成功！";
              if (gameState.matched >= 8) {
                gameState.done = true;
                showPrize("flip", "翻牌子");
              }
            } else {
              cards[a].classList.remove("open");
              cards[b].classList.remove("open");
              cards[a].textContent = "?";
              cards[b].textContent = "?";
              $("gameStatus").textContent = "唔中，再試";
            }
            gameState.open = [];
            gameState.lock = false;
          }, 550);
        }
      };
    });
  }

  function startClaw(body) {
    gameState.x = 50;
    gameState.tries = 3;
    body.innerHTML =
      '<div class="claw-area" id="clawArea">' +
      '<div class="claw" id="claw" style="left:50%"></div>' +
      '<div class="claw-item" id="clawItem" style="left:42%">🎁</div>' +
      "</div>" +
      '<div class="btn-row" style="justify-content:center;">' +
      '<button type="button" class="btn-big" id="clawLeft">◀ 左</button>' +
      '<button type="button" class="big-tap" id="clawDrop" style="max-width:140px;">夾！</button>' +
      '<button type="button" class="btn-big" id="clawRight">右 ▶</button>' +
      "</div>" +
      '<p style="text-align:center;" class="muted">剩餘：<span id="clawTries">3</span></p>';
    function move(dx) {
      gameState.x = Math.max(8, Math.min(92, gameState.x + dx));
      $("claw").style.left = gameState.x + "%";
    }
    $("clawLeft").onclick = function () { move(-8); };
    $("clawRight").onclick = function () { move(8); };
    $("clawDrop").onclick = function () {
      if (gameState.done || gameState.tries <= 0) return;
      var claw = $("claw");
      claw.style.top = "110px";
      setTimeout(function () {
        var itemLeft = 42;
        var hit = Math.abs(gameState.x - (itemLeft + 6)) < 12 && Math.random() < 0.7;
        gameState.tries--;
        $("clawTries").textContent = String(gameState.tries);
        if (hit) {
          $("clawItem").style.bottom = "80px";
          gameState.done = true;
          showPrize("claw", "夾東西");
        } else {
          $("gameStatus").textContent = "冇夾中…";
          if (gameState.tries <= 0) {
            gameState.done = true;
            $("gameStatus").textContent = "機會用晒，再玩啦！";
          }
        }
        claw.style.top = "0";
      }, 450);
    };
  }

  function startRing(body) {
    gameState.score = 0;
    gameState.tries = 3;
    body.innerHTML =
      '<div class="rings">' +
      '<button type="button" class="peg" data-i="0" aria-label="柱1"></button>' +
      '<button type="button" class="peg" data-i="1" aria-label="柱2"></button>' +
      '<button type="button" class="peg" data-i="2" aria-label="柱3"></button>' +
      "</div>" +
      '<p style="text-align:center;" class="muted">剩餘：<span id="ringTries">3</span>　入圈：<span id="ringScore">0</span></p>';
    qsa(".peg", body).forEach(function (peg) {
      peg.onclick = function () {
        if (gameState.done || gameState.tries <= 0) return;
        gameState.tries--;
        var hit = Math.random() < 0.5;
        if (hit) {
          this.classList.add("scored");
          gameState.score++;
          $("gameStatus").textContent = "入圈！";
        } else {
          $("gameStatus").textContent = "出界…";
        }
        $("ringTries").textContent = String(gameState.tries);
        $("ringScore").textContent = String(gameState.score);
        if (gameState.score >= 2) {
          gameState.done = true;
          showPrize("ring", "拋圈圈");
        } else if (gameState.tries <= 0) {
          gameState.done = true;
          $("gameStatus").textContent = "今次未過關，再試！";
        }
      };
    });
  }

  /* ---------- Socials ---------- */
  function getSocials() {
    var stored = loadJSON(LS.socials, null);
    if (stored && stored.brands) return stored;
    return window.BPE_SOCIALS_DEFAULT || { brands: [] };
  }
  function setSocials(obj) { saveJSON(LS.socials, obj); }

  function qrUrl(data) {
    var target = data || "https://www.hkzihua.com/";
    return "https://api.qrserver.com/v1/create-qr-code/?size=160x160&margin=8&data=" + encodeURIComponent(target);
  }

  function renderSocials() {
    var data = getSocials();
    var grid = $("socialGrid");
    grid.innerHTML = (data.brands || []).map(function (b) {
      var target = b.qrTarget || b.website || "https://www.hkzihua.com/";
      function linkOrPh(url, label) {
        if (url) return '<a href="' + esc(url) + '" target="_blank" rel="noopener">' + label + "</a>";
        return '<span class="placeholder">' + label + "（待補）</span>";
      }
      return (
        '<article class="social-card" style="border-top:4px solid ' + esc(b.color || "#6b3fa0") + '">' +
        "<h3>" + esc(b.name) + "</h3>" +
        '<div class="en">' + esc(b.nameEn || "") + "</div>" +
        '<div class="qr-box"><img alt="' + esc(b.name) + ' QR" src="' + qrUrl(target) + '" width="148" height="148" loading="lazy" /></div>' +
        '<div class="social-links">' +
        linkOrPh(b.website, "官網") +
        linkOrPh(b.facebook, "Facebook") +
        linkOrPh(b.instagram, "Instagram") +
        linkOrPh(b.xiaohongshu, "小紅書") +
        "</div></article>"
      );
    }).join("");
  }

  function renderSocialEditor() {
    var data = getSocials();
    var box = $("socialEditor");
    box.innerHTML = (data.brands || []).map(function (b, idx) {
      return (
        '<div class="panel" style="box-shadow:none;margin-top:8px;" data-social-idx="' + idx + '">' +
        "<strong>" + esc(b.name) + "</strong>" +
        '<label class="field">官網</label><input type="url" data-f="website" value="' + esc(b.website || "") + '" />' +
        '<label class="field">Facebook</label><input type="url" data-f="facebook" value="' + esc(b.facebook || "") + '" />' +
        '<label class="field">Instagram</label><input type="url" data-f="instagram" value="' + esc(b.instagram || "") + '" />' +
        '<label class="field">小紅書</label><input type="url" data-f="xiaohongshu" value="' + esc(b.xiaohongshu || "") + '" />' +
        '<label class="field">QR 目標網址</label><input type="url" data-f="qrTarget" value="' + esc(b.qrTarget || "") + '" />' +
        "</div>"
      );
    }).join("");
  }

  function renderPrizeEditor() {
    var data = getPrizes();
    var box = $("prizeWeights");
    box.innerHTML = (data.prizes || []).map(function (p, idx) {
      return (
        '<label class="field">' + esc(p.label) + '</label>' +
        '<input type="number" min="0" max="1000" data-prize-idx="' + idx + '" value="' + (Number(p.weight) || 0) + '" />'
      );
    }).join("");
  }

  /* ---------- Members ---------- */
  function getMembers() {
    return loadJSON(LS.members, []);
  }
  function setMembers(list) { saveJSON(LS.members, list); }

  function fillProductSelects() {
    var products = window.BPE_CUPAL_PRODUCTS || ["其他"];
    ["joinLike", "joinBought"].forEach(function (id) {
      var sel = $(id);
      if (!sel || sel.options.length > 1) return;
      sel.innerHTML = products.map(function (p) {
        return '<option value="' + esc(p) + '">' + esc(p) + "</option>";
      }).join("");
    });
  }

  function renderMembers() {
    var tbody = qs("#memberTable tbody");
    if (!tbody) return;
    var list = getMembers();
    if (!list.length) {
      tbody.innerHTML = '<tr><td colspan="9" class="muted">未有資料</td></tr>';
      return;
    }
    tbody.innerHTML = list.map(function (m) {
      var t = m.t ? m.t.replace("T", " ").slice(0, 16) : "";
      return "<tr>" +
        "<td>" + esc(t) + "</td>" +
        "<td>" + esc(m.name) + "</td>" +
        "<td>" + esc(m.phone) + "</td>" +
        "<td>" + esc(m.email) + "</td>" +
        "<td>" + esc(m.likeProduct) + "</td>" +
        "<td>" + esc(m.boughtProduct) + "</td>" +
        "<td>" + esc(m.isMember) + "</td>" +
        "<td>" + esc(m.willBuyAgain) + "</td>" +
        '<td><button type="button" class="btn-danger" data-del-member="' + esc(m.id) + '">刪</button></td>' +
        "</tr>";
    }).join("");
  }

  function exportMembersCsv() {
    var list = getMembers();
    var header = ["時間", "姓名", "電話", "Email", "喜歡產品", "已購產品", "是否會員", "會否再買"];
    var rows = list.map(function (m) {
      return [m.t, m.name, m.phone, m.email, m.likeProduct, m.boughtProduct, m.isMember, m.willBuyAgain]
        .map(function (c) {
          var s = String(c == null ? "" : c).replace(/"/g, '""');
          return '"' + s + '"';
        }).join(",");
    });
    var csv = "\uFEFF" + header.join(",") + "\n" + rows.join("\n");
    var blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "cupal-members-" + todayInFair() + ".csv";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function flashMsg(el, text, ok) {
    if (!el) return;
    el.textContent = text;
    el.classList.remove("hidden", "ok", "err");
    el.classList.add(ok ? "ok" : "err");
  }

  /* ---------- Wire events ---------- */
  function bind() {
    qsa(".nav-tabs button").forEach(function (b) {
      b.addEventListener("click", function () {
        showView(b.getAttribute("data-view"));
      });
    });

    var loginBtn = $("headerLoginBtn");
    var dd = $("loginDropdown");
    loginBtn.addEventListener("click", function () {
      if (isAdmin()) {
        dd.classList.toggle("hidden");
        loginBtn.setAttribute("aria-expanded", dd.classList.contains("hidden") ? "false" : "true");
      } else {
        $("loginModal").classList.remove("hidden");
        $("loginMsg").classList.add("hidden");
      }
    });
    document.addEventListener("click", function (e) {
      if (!loginBtn.contains(e.target) && !dd.contains(e.target)) {
        dd.classList.add("hidden");
      }
    });
    qsa("[data-dd-action]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var act = btn.getAttribute("data-dd-action");
        dd.classList.add("hidden");
        if (act === "logout") {
          var auth = getAuth();
          if (auth && auth.logout) auth.logout();
          setAdminVisible(false);
          showView("fair");
        } else if (act === "admin") {
          showView("admin");
        }
      });
    });

    $("btnCancelLogin").addEventListener("click", function () {
      $("loginModal").classList.add("hidden");
    });
    $("loginForm").addEventListener("submit", async function (e) {
      e.preventDefault();
      var auth = getAuth();
      if (!auth || !auth.login) {
        flashMsg($("loginMsg"), "登入模組未載入", false);
        return;
      }
      var ok = await auth.login($("loginUser").value, $("loginPass").value);
      if (ok) {
        $("loginModal").classList.add("hidden");
        setAdminVisible(true);
        showView("admin");
      } else {
        flashMsg($("loginMsg"), "帳號或密碼唔啱", false);
      }
    });
    qsa("[data-toggle-pass]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var inp = $(btn.getAttribute("data-toggle-pass"));
        if (!inp) return;
        inp.type = inp.type === "password" ? "text" : "password";
      });
    });

    ["schedDate", "schedMode", "schedRole"].forEach(function (id) {
      $(id).addEventListener("change", renderSchedule);
    });

    $("btnAddShift").addEventListener("click", function () { openShiftModal(null); });
    $("btnCancelShift").addEventListener("click", function () {
      $("shiftModal").classList.add("hidden");
    });
    $("shiftForm").addEventListener("submit", function (e) {
      e.preventDefault();
      var id = $("shiftId").value;
      var item = {
        id: id || uid("shift"),
        date: $("shiftDate").value,
        start: $("shiftStart").value,
        end: $("shiftEnd").value,
        role: $("shiftRoleSel").value,
        name: $("shiftName").value.trim() || "待填",
        note: $("shiftNote").value.trim()
      };
      var list = getShifts();
      if (id) {
        list = list.map(function (s) { return s.id === id ? item : s; });
      } else {
        list.push(item);
      }
      setShifts(list);
      $("shiftModal").classList.add("hidden");
      renderSchedule();
    });
    $("shiftList").addEventListener("click", function (e) {
      var edit = e.target.closest("[data-edit-shift]");
      var del = e.target.closest("[data-del-shift]");
      if (edit) {
        var id = edit.getAttribute("data-edit-shift");
        var s = getShifts().find(function (x) { return x.id === id; });
        if (s) openShiftModal(s);
      }
      if (del) {
        var did = del.getAttribute("data-del-shift");
        if (confirm("確定刪除此班次？")) {
          setShifts(getShifts().filter(function (x) { return x.id !== did; }));
          renderSchedule();
        }
      }
    });
    $("btnResetSchedule").addEventListener("click", function () {
      if (!confirm("還原為範本（全部變回「待填」）？本機修改會被覆蓋。")) return;
      var seed = window.BPE_SCHEDULE_SEED;
      setShifts(seed.shifts.slice());
      setSnacks(seed.snackNotes.slice());
      renderSchedule();
    });
    $("btnSaveSnack").addEventListener("click", function () {
      var date = $("schedDate").value || todayInFair();
      var text = $("snackNoteInput").value.trim();
      var snacks = getSnacks();
      var found = false;
      snacks = snacks.map(function (n) {
        if (n.date === date) { found = true; return { id: n.id, date: date, text: text }; }
        return n;
      });
      if (!found) snacks.push({ id: uid("note"), date: date, text: text });
      setSnacks(snacks);
      renderSchedule();
      flashMsg($("adminMsg"), "備註已儲存", true);
    });

    qsa("#gamePicker .game-card").forEach(function (c) {
      c.addEventListener("click", function () {
        openGame(c.getAttribute("data-game"));
      });
    });
    $("btnBackGames").addEventListener("click", function () {
      $("gameArena").classList.add("hidden");
      $("gamePicker").classList.remove("hidden");
      currentGame = null;
    });
    $("btnReplay").addEventListener("click", function () {
      if (currentGame) openGame(currentGame);
    });
    $("btnClearWins").addEventListener("click", function () {
      if (confirm("清空本機得獎記錄？")) {
        saveJSON(LS.wins, []);
        renderWinLog();
      }
    });

    fillProductSelects();
    $("joinForm").addEventListener("submit", function (e) {
      e.preventDefault();
      var m = {
        id: uid("mem"),
        t: new Date().toISOString(),
        name: $("joinName").value.trim(),
        phone: $("joinPhone").value.trim(),
        email: $("joinEmail").value.trim(),
        likeProduct: $("joinLike").value,
        boughtProduct: $("joinBought").value,
        isMember: $("joinMember").value,
        willBuyAgain: $("joinAgain").value
      };
      if (!m.name || !m.phone) {
        flashMsg($("joinMsg"), "請填姓名同電話", false);
        return;
      }
      var list = getMembers();
      list.unshift(m);
      setMembers(list);
      $("joinForm").reset();
      fillProductSelects();
      flashMsg($("joinMsg"), "已提交，多謝！職員可於後台匯出。", true);
    });

    $("btnExportMembers").addEventListener("click", exportMembersCsv);
    $("btnAddMember").addEventListener("click", function () {
      var name = prompt("姓名？");
      if (!name) return;
      var phone = prompt("電話？") || "";
      var list = getMembers();
      list.unshift({
        id: uid("mem"),
        t: new Date().toISOString(),
        name: name,
        phone: phone,
        email: "",
        likeProduct: "其他",
        boughtProduct: "其他",
        isMember: "否",
        willBuyAgain: "考慮中"
      });
      setMembers(list);
      renderMembers();
    });
    qs("#memberTable").addEventListener("click", function (e) {
      var btn = e.target.closest("[data-del-member]");
      if (!btn) return;
      var id = btn.getAttribute("data-del-member");
      if (confirm("刪除此筆？")) {
        setMembers(getMembers().filter(function (m) { return m.id !== id; }));
        renderMembers();
      }
    });

    $("btnSavePrizes").addEventListener("click", function () {
      var data = getPrizes();
      qsa("[data-prize-idx]").forEach(function (inp) {
        var i = Number(inp.getAttribute("data-prize-idx"));
        if (data.prizes[i]) data.prizes[i].weight = Number(inp.value) || 0;
      });
      setPrizes(data);
      flashMsg($("adminMsg"), "獎品權重已儲存", true);
    });
    $("btnSaveSocials").addEventListener("click", function () {
      var data = getSocials();
      qsa("[data-social-idx]").forEach(function (box) {
        var i = Number(box.getAttribute("data-social-idx"));
        if (!data.brands[i]) return;
        qsa("[data-f]", box).forEach(function (inp) {
          data.brands[i][inp.getAttribute("data-f")] = inp.value.trim();
        });
      });
      setSocials(data);
      flashMsg($("adminMsg"), "社交連結已儲存", true);
      renderSocials();
    });
  }

  function init() {
    bind();
    $("schedDate").value = todayInFair();
    setAdminVisible(isAdmin());
    showView("fair");
    // seed localStorage once if empty
    if (!localStorage.getItem(LS.shifts) && window.BPE_SCHEDULE_SEED) {
      setShifts(window.BPE_SCHEDULE_SEED.shifts.slice());
    }
    if (!localStorage.getItem(LS.snacks) && window.BPE_SCHEDULE_SEED) {
      setSnacks(window.BPE_SCHEDULE_SEED.snackNotes.slice());
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
