/* 推廣員更表 — 按日期／按人；重用 schedule-seed；可職員編輯 */
(function () {
  "use strict";

  var LS = "zihua_bpe_shifts_v1";
  var LS_DEMO = "zihua_bpe_roster_demo_applied_v1";
  var kind = "promoter"; // promoter | office | buchong
  var mode = "date"; // date | person (promoter)
  var selectedDate = "2026-12-12";

  var ROLE_GROUPS = [
    {
      id: "zihua",
      title: "紫花油推廣員",
      roles: ["Senior Promoter", "Promoter", "紫花油推廣員"],
      shifts: [
        { key: "am", label: "早更", start: "10:45", end: "19:45" },
        { key: "full", label: "全日 FULL", start: "11:00", end: "20:00" },
        { key: "pm", label: "晏更", start: "12:00", end: "21:00" }
      ]
    },
    {
      id: "cupal",
      title: "CUPAL 推廣員",
      roles: ["CUPAL", "CUPAL 推廣員"],
      shifts: [
        { key: "11v", label: "場時更", start: "11:00", end: "20:00" },
        { key: "12", label: "12點更", start: "12:00", end: "20:00" },
        { key: "13", label: "1點更", start: "13:00", end: "21:00" },
        { key: "14", label: "2點更", start: "14:00", end: "21:00" }
      ]
    },
    {
      id: "cashier",
      title: "收銀",
      roles: ["Cashier", "收銀"],
      shifts: [
        { key: "am", label: "早更", start: "10:45", end: "19:45" },
        { key: "full", label: "全日 FULL", start: "11:00", end: "20:00" },
        { key: "pm", label: "晏更", start: "12:00", end: "21:00" }
      ]
    },
    {
      id: "recruit",
      title: "宅配會員招募助理",
      roles: ["宅配會員招募助理"],
      shifts: [
        { key: "12", label: "12點更", start: "12:00", end: "20:00" }
      ]
    }
  ];

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
  function isAdmin() {
    if (window.ZihuaStaffAuth && window.ZihuaStaffAuth.isAdmin) {
      return !!window.ZihuaStaffAuth.isAdmin();
    }
    var a = window.ZihuaAdminAuth;
    return !!(a && a.isLoggedIn && a.isLoggedIn());
  }
  function uid() { return "sh-" + Date.now() + "-" + Math.floor(Math.random() * 999); }

  function seedObj() {
    return window.BPE_SCHEDULE_SEED || null;
  }
  function seedVersion() {
    var seed = seedObj();
    return seed && seed.version != null ? String(seed.version) : "0";
  }
  function seedShifts() {
    var seed = seedObj();
    return seed && Array.isArray(seed.shifts) ? seed.shifts.slice() : [];
  }

  function fairDates() {
    var out = [];
    var seed = seedObj();
    var startIso = (seed && seed.fairStart) || "2026-12-12";
    var endIso = (seed && seed.fairEnd) || "2027-01-04";
    var sp = startIso.split("-").map(Number);
    var ep = endIso.split("-").map(Number);
    var d = new Date(sp[0], sp[1] - 1, sp[2]);
    var end = new Date(ep[0], ep[1] - 1, ep[2]);
    while (d <= end) {
      var y = d.getFullYear();
      var m = String(d.getMonth() + 1).padStart(2, "0");
      var day = String(d.getDate()).padStart(2, "0");
      out.push(y + "-" + m + "-" + day);
      d.setDate(d.getDate() + 1);
    }
    return out;
  }

  function weekdayLabel(iso) {
    var d = new Date(iso + "T12:00:00");
    var map = ["日", "一", "二", "三", "四", "五", "六"];
    return "週" + map[d.getDay()] + " " + iso.slice(5).replace("-", "/");
  }

  function minutesOf(hhmm) {
    var p = String(hhmm || "0:0").split(":");
    return (parseInt(p[0], 10) || 0) * 60 + (parseInt(p[1], 10) || 0);
  }

  function getShifts() {
    try {
      var raw = localStorage.getItem(LS);
      if (raw) {
        var o = JSON.parse(raw);
        if (o && Array.isArray(o.shifts) && String(o.version) === seedVersion()) {
          return o.shifts;
        }
        // 舊版陣列／版本唔同 → 用新種子（職員之後改會帶新 version 存返）
      }
    } catch (e) {}
    return seedShifts();
  }

  function setShifts(list) {
    try {
      localStorage.setItem(LS, JSON.stringify({
        version: seedVersion(),
        shifts: list
      }));
    } catch (e) {}
  }

  function ensureSeedApplied() {
    try {
      // 清走舊 Dec-12 示例標記；唔再疊 DEMO 人名
      if (localStorage.getItem(LS_DEMO)) localStorage.removeItem(LS_DEMO);
      var raw = localStorage.getItem(LS);
      var ver = seedVersion();
      if (!raw) {
        setShifts(seedShifts());
        return;
      }
      var o = JSON.parse(raw);
      var outdated = Array.isArray(o) || !o || String(o.version) !== ver || !Array.isArray(o.shifts);
      if (outdated) setShifts(seedShifts());
    } catch (e) {
      try { setShifts(seedShifts()); } catch (e2) {}
    }
  }

  function matchGroupRole(group, role) {
    return (group.roles || []).indexOf(role) >= 0;
  }

  function classifyShift(s, group) {
    // Prefer exact start+end, then exact start, then nearest start
    var best = null, bestScore = 1e9;
    var sStart = minutesOf(s.start);
    var sEnd = minutesOf(s.end);
    (group.shifts || []).forEach(function (def) {
      var dStart = minutesOf(def.start);
      var dEnd = minutesOf(def.end);
      var score;
      if (dStart === sStart && dEnd === sEnd) score = 0;
      else if (dStart === sStart) score = 1 + Math.abs(dEnd - sEnd);
      else score = 1000 + Math.abs(dStart - sStart);
      if (score < bestScore) { bestScore = score; best = def; }
    });
    return best;
  }

  function peopleOnDate(date) {
    return getShifts().filter(function (s) {
      return s.date === date && s.name && s.name !== "待填";
    });
  }

  function renderDateMode() {
    var dates = fairDates();
    if (dates.indexOf(selectedDate) < 0) selectedDate = dates[0];
    var opts = dates.map(function (d) {
      var n = peopleOnDate(d).length;
      return '<option value="' + d + '"' + (d === selectedDate ? " selected" : "") + ">" +
        esc(weekdayLabel(d)) + " · " + n + "人</option>";
    }).join("");
    var pick =
      '<div class="roster-date-pick">' +
        '<label for="promoterDateSelect">選擇日子</label>' +
        '<select id="promoterDateSelect" data-promoter-date-select>' + opts + "</select>" +
      "</div>";
    var chips = dates.map(function (d) {
      var n = peopleOnDate(d).length;
      return '<button type="button" class="date-chip' + (d === selectedDate ? " active" : "") +
        '" data-date="' + d + '">' + esc(weekdayLabel(d)) +
        '<span class="date-chip-n">' + n + "人</span></button>";
    }).join("");

    var people = peopleOnDate(selectedDate);
    var groupsHtml = ROLE_GROUPS.map(function (g) {
      var blocks = (g.shifts || []).map(function (def) {
        var members = people.filter(function (s) {
          var roleOk = matchGroupRole(g, s.role) ||
            (g.id === "zihua" && (s.role === "Promoter" || s.role === "Senior Promoter"));
          if (!roleOk) return false;
          var c = classifyShift(s, g);
          return c && c.key === def.key;
        });
        if (!members.length) return "";
        var pills = members.map(function (m) {
          var letter = (m.name || "?").charAt(0);
          var tag = m.tag ? '<span class="pill-tag">' + esc(m.tag) + "</span>" : "";
          if (m.note && /後補|WS|FULL|Call Time/.test(m.note)) {
            tag += '<span class="pill-tag">' + esc(m.note.split("·")[0].trim()) + "</span>";
          }
          var rm = isAdmin()
            ? '<button type="button" class="pill-x" data-del="' + esc(m.id) + '" aria-label="移除">×</button>'
            : "";
          return '<span class="name-pill"><span class="pill-av">' + esc(letter) + "</span>" +
            esc(m.name) + tag + rm + "</span>";
        }).join("");
        var add = isAdmin()
          ? '<button type="button" class="btn-ghost btn-add-shift" data-add-role="' + esc(g.roles[0]) +
            '" data-add-start="' + esc(def.start) + '" data-add-end="' + esc(def.end) + '">＋ 加入</button>'
          : "";
        return (
          '<div class="roster-shift">' +
            "<h4>" + esc(def.label) + " " + esc(def.start) + " – " + esc(def.end) + "</h4>" +
            '<div class="name-pills">' + pills + add + "</div>" +
          "</div>"
        );
      }).join("");
      if (!blocks && isAdmin()) {
        // still show empty group with first shift add for staff
        var def0 = (g.shifts || [])[0];
        if (def0) {
          blocks =
            '<div class="roster-shift">' +
              "<h4>" + esc(def0.label) + " " + esc(def0.start) + " – " + esc(def0.end) + "</h4>" +
              '<div class="name-pills"><span class="muted">未有人返呢更</span>' +
              '<button type="button" class="btn-ghost btn-add-shift" data-add-role="' + esc(g.roles[0]) +
              '" data-add-start="' + esc(def0.start) + '" data-add-end="' + esc(def0.end) + '">＋ 加入</button></div>' +
            "</div>";
        }
      }
      if (!blocks) return "";
      return '<section class="roster-card"><h3>' + esc(g.title) + "</h3>" + blocks + "</section>";
    }).join("") || '<p class="muted">呢日未有排更</p>';

    return (
      pick +
      '<div class="date-chips">' + chips + "</div>" +
      groupsHtml +
      '<button type="button" class="btn-ghost roster-copy" id="btnCopyRoster">複製當日更表 (WhatsApp)</button>'
    );
  }

  function renderPersonMode() {
    var all = getShifts().filter(function (s) { return s.name && s.name !== "待填"; });
    var byName = {};
    all.forEach(function (s) {
      if (!byName[s.name]) byName[s.name] = [];
      byName[s.name].push(s);
    });
    var names = Object.keys(byName).sort();
    var days = {};
    all.forEach(function (s) { days[s.date] = 1; });
    var dayCount = Object.keys(days).length;
    var total = all.length;

    function groupFor(role) {
      for (var i = 0; i < ROLE_GROUPS.length; i++) {
        if (matchGroupRole(ROLE_GROUPS[i], role) ||
          (ROLE_GROUPS[i].id === "zihua" && (role === "Promoter" || role === "Senior Promoter"))) {
          return ROLE_GROUPS[i];
        }
      }
      return null;
    }

    var sections = {};
    names.forEach(function (name) {
      var list = byName[name];
      var g = groupFor(list[0].role) || { id: "other", title: "其他" };
      if (!sections[g.id]) sections[g.id] = { title: g.title, people: [] };
      var am = 0, pm = 0;
      var chips = list.slice().sort(function (a, b) {
        return String(a.date).localeCompare(b.date) || String(a.start).localeCompare(b.start);
      }).map(function (s) {
        var label = s.date.slice(5).replace("-", "/") + " ";
        var startM = minutesOf(s.start);
        var endM = minutesOf(s.end);
        var isFull = startM === 11 * 60 && endM === 20 * 60;
        if (isFull) { pm++; label += "FULL"; }
        else if (startM < 12 * 60) { am++; label += "早"; }
        else {
          pm++;
          var hh = Math.floor(startM / 60);
          label += (hh === 11 ? "場" : hh === 12 ? "12點" : hh === 13 ? "1點" : hh === 14 ? "2點" : "晏");
        }
        var cls = isFull ? "chip-pm" : (startM < 12 * 60 ? "chip-am" : "chip-pm");
        return '<span class="shift-chip ' + cls + '">' + esc(label) + "</span>";
      }).join("");
      var tag = list[0].tag ? '<span class="pill-tag">' + esc(list[0].tag) + "</span>" : "";
      if (list[0].note && list[0].note.indexOf("後補") >= 0) tag += '<span class="pill-tag">後補</span>';
      if (list[0].note && list[0].note.indexOf("WS") >= 0) tag += '<span class="pill-tag">WS</span>';
      sections[g.id].people.push(
        '<div class="person-card">' +
          '<div class="person-head">' +
            '<span class="pill-av">' + esc(name.charAt(0)) + "</span>" +
            "<div><strong>" + esc(name) + tag + "</strong>" +
            '<div class="muted">早 ' + am + " · 晏／其他 " + pm + " · 共 " + list.length + " 更</div></div>" +
            '<div class="person-count">' + list.length + " 更</div>" +
          "</div>" +
          '<div class="shift-chips">' + chips + "</div>" +
        "</div>"
      );
    });

    var order = ["zihua", "cupal", "cashier", "recruit", "other"];
    var body = order.filter(function (id) { return sections[id]; }).map(function (id) {
      var sec = sections[id];
      return '<section class="roster-card"><h3>' + esc(sec.title) + "</h3>" + sec.people.join("") + "</section>";
    }).join("") || '<p class="muted">未有更表資料</p>';

    return (
      '<div class="roster-stats">' +
        "<div><strong>" + dayCount + "</strong><span>日</span></div>" +
        "<div><strong>" + names.length + "</strong><span>推廣員</span></div>" +
        "<div><strong>" + total + "</strong><span>全部人次</span></div>" +
      "</div>" + body
    );
  }

  function copyWhatsApp() {
    var people = peopleOnDate(selectedDate);
    var lines = ["📅 " + weekdayLabel(selectedDate) + " 推廣員更表", ""];
    ROLE_GROUPS.forEach(function (g) {
      var mem = people.filter(function (s) {
        return matchGroupRole(g, s.role) ||
          (g.id === "zihua" && (s.role === "Promoter" || s.role === "Senior Promoter"));
      }).sort(function (a, b) {
        return String(a.start).localeCompare(b.start) || String(a.name).localeCompare(b.name);
      });
      if (!mem.length) return;
      lines.push("【" + g.title + "】");
      mem.forEach(function (m) {
        var extra = m.note ? "（" + m.note + "）" : (m.tag ? "（" + m.tag + "）" : "");
        lines.push("· " + m.name + " " + m.start + "-" + m.end + extra);
      });
      lines.push("");
    });
    var text = lines.join("\n");
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () {
        alert("已複製到剪貼簿，可貼去 WhatsApp。");
      }).catch(function () { prompt("請手動複製：", text); });
    } else {
      prompt("請手動複製：", text);
    }
  }

  function scrollActiveDateChip() {
    var root = document.getElementById("rosterRoot");
    if (!root) return;
    var active = root.querySelector(".date-chip.active");
    if (!active || !active.scrollIntoView) return;
    try {
      active.scrollIntoView({ inline: "center", block: "nearest" });
    } catch (e) {
      active.scrollIntoView(false);
    }
  }

  function render() {
    var root = document.getElementById("rosterRoot");
    if (!root) return;
    ensureSeedApplied();

    // 訪客唔顯示補鐘分頁；若仍停喺 buchong 就退返 Office
    if (!isAdmin() && kind === "buchong") kind = "office";

    var office = window.BPE_OfficeRoster;
    var title = office && office.heroTitle ? office.heroTitle(kind) : "推廣員更表";
    var kicker = office && office.heroKicker ? office.heroKicker(kind) : "2026 工展會 · 12/12–1/4";

    var body;
    if (kind === "promoter") {
      body = mode === "date" ? renderDateMode() : renderPersonMode();
    } else if (office && office.renderBody) {
      body = office.renderBody(kind);
    } else {
      body = '<p class="muted">Office 更表種子未載入</p>';
    }

    var subToggle = "";
    if (kind === "promoter") {
      subToggle =
        '<div class="mode-toggle">' +
          '<button type="button" class="mode-btn' + (mode === "date" ? " active" : "") + '" data-mode="date">📅 按日期</button>' +
          '<button type="button" class="mode-btn' + (mode === "person" ? " active" : "") + '" data-mode="person">👤 按人</button>' +
        "</div>";
    }

    var footerNote;
    if (kind === "promoter") {
      footerNote = '<p class="claim-safe">已按最新更表載入；職員登入後可加減／改更。本機改動會跟種子版本保存。</p>';
    } else if (isAdmin()) {
      footerNote = '<p class="claim-safe">暫定 Office roster · 內部參考 · 唔係正式 claim 金額。Set Up 12/10–11 不計入合計；Ben 12/12 拍野暫不計入（工時未定）。</p>';
    } else {
      /* 訪客唔顯示 Office 說明／remark；職員後台先有 */
      footerNote = "";
    }

    var adminReset = (kind === "promoter" && isAdmin())
      ? '<div class="btn-row" style="margin:12px 0"><button type="button" class="btn-ghost" id="btnResetRoster">還原官方更表</button></div>'
      : "";

    var buchongTab = isAdmin()
      ? ('<button type="button" class="mode-btn' + (kind === "buchong" ? " active" : "") + '" data-kind="buchong">⏱ 補鐘統計</button>')
      : "";

    root.innerHTML =
      '<header class="roster-hero">' +
        '<div class="roster-hero-top">' +
          "<div><p class=\"pc-hero-kicker\">" + kicker + "</p><h2>" + title + "</h2></div>" +
          '<div class="roster-hero-actions">' +
            '<button type="button" class="btn-ghost" id="btnRosterLogin">🔒 職員登入</button>' +
          "</div>" +
        "</div>" +
        '<div class="mode-toggle kind-toggle">' +
          '<button type="button" class="mode-btn' + (kind === "promoter" ? " active" : "") + '" data-kind="promoter">📣 推廣員</button>' +
          '<button type="button" class="mode-btn' + (kind === "office" ? " active" : "") + '" data-kind="office">🏢 Office</button>' +
          buchongTab +
        "</div>" +
        subToggle +
      "</header>" +
      '<div class="roster-body">' + body + "</div>" +
      adminReset +
      footerNote;

    // keep selected date chip visible after re-render (e.g. 18 號唔跳返 12 號)
    requestAnimationFrame(function () {
      scrollActiveDateChip();
    });
  }

  function bind() {
    var root = document.getElementById("rosterRoot");
    if (!root || root._rosterBound) return;
    root._rosterBound = true;
    root.addEventListener("change", function (e) {
      if (window.BPE_OfficeRoster && window.BPE_OfficeRoster.handleChange &&
          window.BPE_OfficeRoster.handleChange(e)) {
        render();
        return;
      }
      var t = e.target;
      if (t && (t.id === "promoterDateSelect" ||
          (t.getAttribute && t.getAttribute("data-promoter-date-select") != null))) {
        if (t.value) {
          selectedDate = t.value;
          render();
        }
      }
    });
    root.addEventListener("click", function (e) {
      var k = e.target.closest("[data-kind]");
      if (k) { kind = k.getAttribute("data-kind"); render(); return; }
      if (window.BPE_OfficeRoster && window.BPE_OfficeRoster.handleClick &&
          window.BPE_OfficeRoster.handleClick(e)) {
        render();
        return;
      }
      var m = e.target.closest("[data-mode]");
      if (m) { mode = m.getAttribute("data-mode"); render(); return; }
      var d = e.target.closest("[data-date]");
      if (d) { selectedDate = d.getAttribute("data-date"); render(); return; }
      if (e.target.closest("#btnCopyRoster")) { copyWhatsApp(); return; }
      if (e.target.closest("#btnRosterLogin")) {
        if (window.BPE_Shell && window.BPE_Shell.openLogin) window.BPE_Shell.openLogin();
        return;
      }
      var del = e.target.closest("[data-del]");
      if (del && isAdmin()) {
        var id = del.getAttribute("data-del");
        setShifts(getShifts().filter(function (s) { return s.id !== id; }));
        render();
        return;
      }
      var add = e.target.closest("[data-add-role]");
      if (add && isAdmin()) {
        var name = prompt("加入人名？");
        if (!name) return;
        var list = getShifts();
        list.push({
          id: uid(),
          date: selectedDate,
          start: add.getAttribute("data-add-start"),
          end: add.getAttribute("data-add-end"),
          role: add.getAttribute("data-add-role"),
          name: name.trim(),
          note: "職員新增",
          tag: ""
        });
        setShifts(list);
        render();
        return;
      }
      if (e.target.closest("#btnResetRoster") && isAdmin()) {
        if (!confirm("還原官方更表（清本機改動）？")) return;
        localStorage.removeItem(LS);
        localStorage.removeItem(LS_DEMO);
        ensureSeedApplied();
        render();
      }
    });
  }

  window.BPE_Roster = {
    render: function () { bind(); render(); },
    getShifts: getShifts,
    setKind: function (k) { kind = k || "promoter"; render(); },
    getKind: function () { return kind; }
  };
})();
