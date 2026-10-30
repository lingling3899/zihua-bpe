(function () {
  "use strict";

  var LS = {
    shifts: "zihua_bpe_shifts_v1",
    snacks: "zihua_bpe_snacks_v2",
    members: "zihua_bpe_members_v1",
    prizes: "zihua_bpe_prizes_v1",
    socials: "zihua_bpe_socials_v1",
    wins: "zihua_bpe_wins_v1",
    prices: "zihua_bpe_prices_v1"
  };

  var SNACK_MAX_PHOTOS = 6;
  var SNACK_MAX_DIM = 1200;
  var SNACK_JPEG_Q = 0.72;
  var SNACK_MAX_BYTES = 450000; /* ~450KB per photo after compress */

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
    ["fair", "schedule", "snack", "prices", "games", "social", "join", "admin"].forEach(function (v) {
      var el = $("view-" + v);
      if (el) el.classList.toggle("hidden", v !== name);
    });
    qsa(".nav-tabs button").forEach(function (b) {
      b.classList.toggle("active", b.getAttribute("data-view") === name);
    });
    if (name === "schedule") renderSchedule();
    if (name === "snack") renderSnackPage();
    if (name === "prices") renderPrices();
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

  function normalizeSnack(n) {
    if (!n || typeof n !== "object") return null;
    return {
      id: n.id || uid("note"),
      date: n.date || "",
      text: n.text || "",
      photos: Array.isArray(n.photos) ? n.photos : []
    };
  }

  function migrateSnacksFromV1() {
    try {
      var raw = localStorage.getItem("zihua_bpe_snacks_v1");
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return null;
      return parsed.map(normalizeSnack).filter(Boolean);
    } catch (e) {
      return null;
    }
  }

  function getSnacks() {
    var stored = loadJSON(LS.snacks, null);
    if (stored && Array.isArray(stored)) return stored.map(normalizeSnack).filter(Boolean);
    var migrated = migrateSnacksFromV1();
    if (migrated) {
      saveJSON(LS.snacks, migrated);
      return migrated;
    }
    var seed = window.BPE_SCHEDULE_SEED;
    var base = seed && seed.snackNotes ? seed.snackNotes.slice() : [];
    return base.map(normalizeSnack).filter(Boolean);
  }
  function setSnacks(list) { saveJSON(LS.snacks, list.map(normalizeSnack).filter(Boolean)); }

  function getSnackForDate(date) {
    var snacks = getSnacks();
    var sn = snacks.find(function (n) { return n.date === date; });
    if (sn) return sn;
    return { id: uid("note"), date: date, text: "", photos: [] };
  }

  function upsertSnack(snack) {
    var list = getSnacks();
    var found = false;
    list = list.map(function (n) {
      if (n.date === snack.date) { found = true; return normalizeSnack(snack); }
      return n;
    });
    if (!found) list.push(normalizeSnack(snack));
    setSnacks(list);
  }

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
    // snack teaser on schedule page
    var sn = getSnackForDate(date);
    var preview = sn.text ? sn.text : "（未有備註）";
    if (sn.photos && sn.photos.length) preview += "　📷 " + sn.photos.length + " 張相片";
    $("snackNoteText").textContent = preview;
  }

  function renderSnackPage() {
    var dateEl = $("snackDate");
    if (!dateEl) return;
    if (!dateEl.value) dateEl.value = ($("schedDate") && $("schedDate").value) || todayInFair();
    var date = dateEl.value;
    var sn = getSnackForDate(date);
    var textEl = $("snackPageText");
    if (textEl) textEl.textContent = sn.text ? sn.text : "（未有備註）";
    if ($("snackPageInput")) $("snackPageInput").value = sn.text || "";
    renderSnackPhotos(sn);
  }

  function renderSnackPhotos(sn) {
    var gal = $("snackPhotoGallery");
    if (!gal) return;
    var photos = (sn && sn.photos) || [];
    if (!photos.length) {
      gal.innerHTML = '<p class="empty-state">未有點心紙相片</p>';
      return;
    }
    gal.innerHTML = photos.map(function (ph) {
      var del = isAdmin()
        ? '<button type="button" class="photo-del" data-del-photo="' + esc(ph.id) + '" aria-label="刪除相片">×</button>'
        : "";
      return (
        '<figure class="snack-photo">' +
        '<img src="' + ph.dataUrl + '" alt="點心紙相片" data-lightbox="1" />' +
        del +
        "</figure>"
      );
    }).join("");
  }

  function compressImageFile(file) {
    return new Promise(function (resolve, reject) {
      if (!file || !/^image\//.test(file.type)) {
        reject(new Error("請揀圖片檔"));
        return;
      }
      var reader = new FileReader();
      reader.onerror = function () { reject(new Error("讀取失敗")); };
      reader.onload = function () {
        var img = new Image();
        img.onload = function () {
          var w = img.width;
          var h = img.height;
          var scale = Math.min(1, SNACK_MAX_DIM / Math.max(w, h));
          var cw = Math.max(1, Math.round(w * scale));
          var ch = Math.max(1, Math.round(h * scale));
          var canvas = document.createElement("canvas");
          canvas.width = cw;
          canvas.height = ch;
          var ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, cw, ch);
          var q = SNACK_JPEG_Q;
          var dataUrl = canvas.toDataURL("image/jpeg", q);
          // shrink quality if still huge
          while (dataUrl.length > SNACK_MAX_BYTES * 1.37 && q > 0.45) {
            q -= 0.08;
            dataUrl = canvas.toDataURL("image/jpeg", q);
          }
          if (dataUrl.length > SNACK_MAX_BYTES * 1.37) {
            reject(new Error("相片仍然太大，請改用較細解像度"));
            return;
          }
          resolve({
            id: uid("pic"),
            name: file.name || "photo.jpg",
            ts: new Date().toISOString(),
            dataUrl: dataUrl
          });
        };
        img.onerror = function () { reject(new Error("圖片無法解碼")); };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  function openLightbox(src) {
    var box = document.createElement("div");
    box.className = "lightbox";
    box.innerHTML = '<button type="button" aria-label="關閉">×</button><img alt="放大" />';
    box.querySelector("img").src = src;
    box.querySelector("button").onclick = function () { box.remove(); };
    box.addEventListener("click", function (e) {
      if (e.target === box) box.remove();
    });
    document.body.appendChild(box);
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


  /* ---------- Prices ---------- */
  function getPrices() {
    var stored = loadJSON(LS.prices, null);
    if (stored && Array.isArray(stored.items)) return stored.items;
    if (stored && Array.isArray(stored)) return stored;
    var seed = window.BPE_PRICES_SEED;
    return seed && seed.items ? seed.items.map(clonePrice) : [];
  }
  function setPrices(items) {
    saveJSON(LS.prices, { version: 1, items: items.map(clonePrice) });
  }
  function clonePrice(p) {
    return {
      id: p.id || uid("price"),
      brand: p.brand || "",
      name: p.name || "",
      spec: p.spec || "",
      price: p.price == null ? "" : String(p.price),
      note: p.note || ""
    };
  }
  function brandClass(brand) {
    if (brand === "日本叮叮") return "dd";
    if (brand === "古寶") return "cp";
    return "";
  }
  function formatPriceDisplay(price) {
    var s = String(price || "").trim();
    if (!s) return { text: "待填", pending: true };
    if (/^\$|HK\$|待填/i.test(s)) return { text: s, pending: /待填/.test(s) };
    if (/^\d/.test(s)) return { text: "HK$ " + s, pending: false };
    return { text: s, pending: false };
  }
  function renderPrices() {
    var list = getPrices();
    var brand = ($("priceBrand") && $("priceBrand").value) || "";
    var q = (($("priceSearch") && $("priceSearch").value) || "").trim().toLowerCase();
    var filled = ($("priceFilled") && $("priceFilled").value) || "all";
    list = list.filter(function (p) {
      if (brand && p.brand !== brand) return false;
      if (q && (p.name + " " + p.spec + " " + p.note).toLowerCase().indexOf(q) < 0) return false;
      var has = String(p.price || "").trim().length > 0;
      if (filled === "filled" && !has) return false;
      if (filled === "empty" && has) return false;
      return true;
    });
    list.sort(function (a, b) {
      var ba = a.brand.localeCompare(b.brand, "zh-Hant");
      if (ba) return ba;
      return a.name.localeCompare(b.name, "zh-Hant");
    });
    var box = $("priceList");
    if (!box) return;
    if (!list.length) {
      box.innerHTML = '<p class="empty-state">未有符合條件嘅產品。</p>';
      return;
    }
    box.innerHTML = list.map(function (p) {
      var disp = formatPriceDisplay(p.price);
      var admin = isAdmin()
        ? '<div class="btn-row price-actions">' +
          '<button type="button" class="btn-ghost" data-edit-price="' + esc(p.id) + '">編輯</button>' +
          '<button type="button" class="btn-danger" data-del-price="' + esc(p.id) + '">刪除</button></div>'
        : "";
      return (
        '<article class="price-card">' +
        '<span class="brand-tag ' + brandClass(p.brand) + '">' + esc(p.brand) + "</span>" +
        '<div class="pname">' + esc(p.name) + "</div>" +
        (p.spec ? '<div class="pspec">' + esc(p.spec) + "</div>" : "") +
        '<div class="pprice' + (disp.pending ? " pending" : "") + '">' + esc(disp.text) + "</div>" +
        (p.note ? '<div class="pnote">' + esc(p.note) + "</div>" : "") +
        admin +
        "</article>"
      );
    }).join("");
  }
  function openPriceModal(item) {
    $("priceModal").classList.remove("hidden");
    $("priceModalTitle").textContent = item ? "編輯售價" : "新增產品價";
    $("priceId").value = item ? item.id : "";
    $("priceBrandIn").value = item ? item.brand : "紫花油";
    $("priceNameIn").value = item ? item.name : "";
    $("priceSpecIn").value = item ? (item.spec || "") : "";
    $("priceValueIn").value = item ? (item.price || "") : "";
    $("priceNoteIn").value = item ? (item.note || "") : "";
  }
  function exportPricesCsv() {
    var list = getPrices();
    var header = ["品牌", "產品名", "規格", "工展會售價", "備註"];
    var rows = list.map(function (p) {
      return [p.brand, p.name, p.spec, p.price, p.note].map(function (c) {
        return '"' + String(c == null ? "" : c).replace(/"/g, '""') + '"';
      }).join(",");
    });
    var csv = "\uFEFF" + header.join(",") + "\n" + rows.join("\n");
    var blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "bpe-prices-" + todayInFair() + ".csv";
    a.click();
    URL.revokeObjectURL(a.href);
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
      setSnacks((seed.snackNotes || []).map(function (n) {
        return { id: n.id, date: n.date, text: n.text || "", photos: [] };
      }));
      renderSchedule();
      if ($("snackDate")) renderSnackPage();
    });
    if ($("btnGoSnack")) {
      $("btnGoSnack").addEventListener("click", function () {
        var d = $("schedDate") && $("schedDate").value;
        if ($("snackDate") && d) $("snackDate").value = d;
        showView("snack");
      });
    }
    if ($("snackDate")) {
      $("snackDate").addEventListener("change", renderSnackPage);
    }
    if ($("btnSaveSnackPage")) {
      $("btnSaveSnackPage").addEventListener("click", function () {
        var date = ($("snackDate") && $("snackDate").value) || todayInFair();
        var sn = getSnackForDate(date);
        sn.text = ($("snackPageInput") && $("snackPageInput").value.trim()) || "";
        upsertSnack(sn);
        renderSnackPage();
        if ($("schedDate") && $("schedDate").value === date) renderSchedule();
        flashMsg($("snackPhotoMsg"), "文字已儲存", true);
      });
    }
    if ($("snackPhotoInput")) {
      $("snackPhotoInput").addEventListener("change", async function () {
        var files = Array.prototype.slice.call(this.files || []);
        this.value = "";
        if (!files.length) return;
        var date = ($("snackDate") && $("snackDate").value) || todayInFair();
        var sn = getSnackForDate(date);
        sn.photos = sn.photos || [];
        var msg = $("snackPhotoMsg");
        for (var i = 0; i < files.length; i++) {
          if (sn.photos.length >= SNACK_MAX_PHOTOS) {
            flashMsg(msg, "每日最多 " + SNACK_MAX_PHOTOS + " 張相片", false);
            break;
          }
          try {
            var ph = await compressImageFile(files[i]);
            sn.photos.push(ph);
            flashMsg(msg, "已加入相片（已壓縮）", true);
          } catch (err) {
            flashMsg(msg, err.message || "上載失敗", false);
          }
        }
        upsertSnack(sn);
        renderSnackPage();
        if ($("schedDate") && $("schedDate").value === date) renderSchedule();
      });
    }
    if ($("btnClearSnackPhotos")) {
      $("btnClearSnackPhotos").addEventListener("click", function () {
        if (!confirm("清空當日全部點心紙相片？")) return;
        var date = ($("snackDate") && $("snackDate").value) || todayInFair();
        var sn = getSnackForDate(date);
        sn.photos = [];
        upsertSnack(sn);
        renderSnackPage();
        flashMsg($("snackPhotoMsg"), "已清空相片", true);
      });
    }
    if ($("snackPhotoGallery")) {
      $("snackPhotoGallery").addEventListener("click", function (e) {
        var img = e.target.closest("img[data-lightbox]");
        if (img) { openLightbox(img.src); return; }
        var del = e.target.closest("[data-del-photo]");
        if (del && isAdmin()) {
          var pid = del.getAttribute("data-del-photo");
          var date = ($("snackDate") && $("snackDate").value) || todayInFair();
          var sn = getSnackForDate(date);
          sn.photos = (sn.photos || []).filter(function (x) { return x.id !== pid; });
          upsertSnack(sn);
          renderSnackPage();
        }
      });
    }

    ["priceBrand", "priceSearch", "priceFilled"].forEach(function (id) {
      var el = $(id);
      if (!el) return;
      el.addEventListener(id === "priceSearch" ? "input" : "change", renderPrices);
    });
    if ($("btnAddPrice")) {
      $("btnAddPrice").addEventListener("click", function () { openPriceModal(null); });
    }
    if ($("btnCancelPrice")) {
      $("btnCancelPrice").addEventListener("click", function () {
        $("priceModal").classList.add("hidden");
      });
    }
    if ($("priceForm")) {
      $("priceForm").addEventListener("submit", function (e) {
        e.preventDefault();
        var id = $("priceId").value;
        var item = {
          id: id || uid("price"),
          brand: $("priceBrandIn").value,
          name: $("priceNameIn").value.trim(),
          spec: $("priceSpecIn").value.trim(),
          price: $("priceValueIn").value.trim(),
          note: $("priceNoteIn").value.trim()
        };
        if (!item.name) return;
        var list = getPrices();
        if (id) list = list.map(function (x) { return x.id === id ? item : x; });
        else list.push(item);
        setPrices(list);
        $("priceModal").classList.add("hidden");
        renderPrices();
      });
    }
    if ($("priceList")) {
      $("priceList").addEventListener("click", function (e) {
        var edit = e.target.closest("[data-edit-price]");
        var del = e.target.closest("[data-del-price]");
        if (edit) {
          var item = getPrices().find(function (x) { return x.id === edit.getAttribute("data-edit-price"); });
          if (item) openPriceModal(item);
        }
        if (del) {
          var did = del.getAttribute("data-del-price");
          if (confirm("刪除此產品價目？")) {
            setPrices(getPrices().filter(function (x) { return x.id !== did; }));
            renderPrices();
          }
        }
      });
    }
    if ($("btnExportPrices")) {
      $("btnExportPrices").addEventListener("click", exportPricesCsv);
    }
    if ($("btnAdminExportPrices")) {
      $("btnAdminExportPrices").addEventListener("click", exportPricesCsv);
    }
    if ($("btnAdminGoPrices")) {
      $("btnAdminGoPrices").addEventListener("click", function () { showView("prices"); });
    }
    if ($("btnResetPrices")) {
      $("btnResetPrices").addEventListener("click", function () {
        if (!confirm("還原產品名單並清空全部價錢？（會覆蓋本機改動）")) return;
        var seed = window.BPE_PRICES_SEED;
        setPrices(seed && seed.items ? seed.items.map(clonePrice) : []);
        renderPrices();
      });
    }

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
    if (!localStorage.getItem(LS.snacks) && !localStorage.getItem("zihua_bpe_snacks_v1") && window.BPE_SCHEDULE_SEED) {
      setSnacks((window.BPE_SCHEDULE_SEED.snackNotes || []).map(function (n) {
        return { id: n.id, date: n.date, text: n.text || "", photos: [] };
      }));
    }
    if (!localStorage.getItem(LS.prices) && window.BPE_PRICES_SEED) {
      setPrices(window.BPE_PRICES_SEED.items.map(clonePrice));
    }
    if ($("snackDate")) $("snackDate").value = todayInFair();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
