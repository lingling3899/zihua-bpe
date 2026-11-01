/* 推廣員更表 — 按日期／按人；重用 schedule-seed；可職員編輯 */
(function () {
  "use strict";

  var LS = "zihua_bpe_shifts_v1";
  var LS_DEMO = "zihua_bpe_roster_demo_applied_v1";
  var mode = "date"; // date | person
  var selectedDate = "2026-12-12";

  var ROLE_GROUPS = [
    {
      id: "zihua",
      title: "紫花油推廣員",
      roles: ["Senior Promoter", "Promoter", "紫花油推廣員"],
      shifts: [
        { key: "am", label: "早更", start: "10:45", end: "19:45" },
        { key: "pm", label: "晏更", start: "12:00", end: "21:00" }
      ]
    },
    {
      id: "cupal",
      title: "CUPAL 推廣員",
      roles: ["CUPAL", "CUPAL 推廣員"],
      shifts: [
        { key: "11", label: "11點更", start: "11:00", end: "20:00" },
        { key: "12", label: "12點更", start: "12:00", end: "20:00" },
        { key: "13", label: "1點更", start: "13:00", end: "21:00" }
      ]
    },
    {
      id: "cashier",
      title: "收銀",
      roles: ["Cashier", "收銀"],
      shifts: [
        { key: "am", label: "早更", start: "11:00", end: "15:00" },
        { key: "pm", label: "晏更", start: "15:00", end: "21:00" }
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

  /* 截圖示例人名 — 標待確認，職員可改 */
  var DEMO = [
    { date: "2026-12-12", start: "10:45", end: "19:45", role: "紫花油推廣員", name: "Candy", note: "待確認／可改", tag: "" },
    { date: "2026-12-12", start: "10:45", end: "19:45", role: "紫花油推廣員", name: "Sophia", note: "待確認／可改", tag: "" },
    { date: "2026-12-12", start: "10:45", end: "19:45", role: "紫花油推廣員", name: "Kato", note: "待確認／可改", tag: "" },
    { date: "2026-12-12", start: "12:00", end: "21:00", role: "紫花油推廣員", name: "Neko", note: "待確認／可改", tag: "" },
    { date: "2026-12-12", start: "12:00", end: "21:00", role: "紫花油推廣員", name: "Connie", note: "待確認／可改", tag: "" },
    { date: "2026-12-12", start: "11:00", end: "20:00", role: "CUPAL 推廣員", name: "秋姐", note: "待確認／可改", tag: "長工" },
    { date: "2026-12-12", start: "13:00", end: "21:00", role: "CUPAL 推廣員", name: "Ken", note: "待確認／可改", tag: "" },
    { date: "2026-12-12", start: "11:00", end: "15:00", role: "Cashier", name: "Ching", note: "待確認／可改", tag: "" },
    { date: "2026-12-12", start: "15:00", end: "21:00", role: "Cashier", name: "Cathy", note: "待確認／可改", tag: "" },
    { date: "2026-12-12", start: "12:00", end: "20:00", role: "宅配會員招募助理", name: "Janice", note: "待確認／可改", tag: "" }
  ];

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
  function isAdmin() {
    var a = window.ZihuaAdminAuth;
    return !!(a && a.isLoggedIn && a.isLoggedIn());
  }
  function uid() { return "sh-" + Date.now() + "-" + Math.floor(Math.random() * 999); }

  function fairDates() {
    var out = [];
    var d = new Date(2026, 11, 12);
    var end = new Date(2027, 0, 4);
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

  function getShifts() {
    try {
      var raw = localStorage.getItem(LS);
      if (raw) {
        var o = JSON.parse(raw);
        if (Array.isArray(o)) return o;
        if (o && Array.isArray(o.shifts)) return o.shifts;
      }
    } catch (e) {}
    var seed = window.BPE_SCHEDULE_SEED;
    return seed && Array.isArray(seed.shifts) ? seed.shifts.slice() : [];
  }
  function setShifts(list) {
    try { localStorage.setItem(LS, JSON.stringify(list)); } catch (e) {}
  }

  function ensureDemo() {
    try {
      if (localStorage.getItem(LS_DEMO) === "1") return;
      var list = getShifts().filter(function (s) {
        return !(s.date === "2026-12-12" && (s.name === "待填" || !s.name));
      });
      DEMO.forEach(function (d) {
        list.push({
          id: uid(),
          date: d.date,
          start: d.start,
          end: d.end,
          role: d.role,
          name: d.name,
          note: d.note,
          tag: d.tag || ""
        });
      });
      setShifts(list);
      localStorage.setItem(LS_DEMO, "1");
    } catch (e) {}
  }

  function matchGroupRole(group, role) {
    return (group.roles || []).indexOf(role) >= 0;
  }

  function classifyShift(s, group) {
    // match by start time proximity to group shift defs
    var best = null, bestDiff = 99;
    (group.shifts || []).forEach(function (def) {
      var a = parseInt(String(s.start || "0").replace(":", ""), 10);
      var b = parseInt(String(def.start || "0").replace(":", ""), 10);
      var diff = Math.abs(a - b);
      if (diff < bestDiff) { bestDiff = diff; best = def; }
    });
    return best;
  }

  function peopleOnDate(date) {
    return getShifts().filter(function (s) {
      return s.date === date && s.name && s.name !== "待填";
    });
  }

  function renderDateMode() {
    var dates = fairDates().slice(0, 14);
    if (dates.indexOf(selectedDate) < 0) selectedDate = dates[0];
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
          if (!matchGroupRole(g, s.role) && !(g.id === "zihua" && (s.role === "Promoter" || s.role === "Senior Promoter"))) return false;
          // for zihua also accept Promoter roles
          var c = classifyShift(s, g);
          return c && c.key === def.key;
        });
        // fallback: if role matches group but time unmatched, show under first shift? skip
        if (g.id === "zihua") {
          members = people.filter(function (s) {
            var roleOk = matchGroupRole(g, s.role) || s.role === "Promoter" || s.role === "Senior Promoter";
            if (!roleOk) return false;
            var c = classifyShift(s, g);
            return c && c.key === def.key;
          });
        }
        var pills = members.length
          ? members.map(function (m) {
              var letter = (m.name || "?").charAt(0);
              var tag = m.tag ? '<span class="pill-tag">' + esc(m.tag) + "</span>" : "";
              var rm = isAdmin()
                ? '<button type="button" class="pill-x" data-del="' + esc(m.id) + '" aria-label="移除">×</button>'
                : "";
              return '<span class="name-pill"><span class="pill-av">' + esc(letter) + "</span>" +
                esc(m.name) + tag + rm + "</span>";
            }).join("")
          : '<span class="muted">未有人返呢更</span>';
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
      return '<section class="roster-card"><h3>' + esc(g.title) + "</h3>" + blocks + "</section>";
    }).join("");

    return (
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
      var am = 0, pm = 0, full = 0;
      var chips = list.slice().sort(function (a, b) {
        return String(a.date).localeCompare(b.date) || String(a.start).localeCompare(b.start);
      }).map(function (s) {
        var label = s.date.slice(5).replace("-", "/") + " ";
        var hh = parseInt(String(s.start).split(":")[0], 10);
        if (hh < 12) { am++; label += "早"; }
        else { pm++; label += (hh === 11 ? "11點" : hh === 12 ? "12點" : hh === 13 ? "1點" : "晏"); }
        var cls = hh < 12 ? "chip-am" : "chip-pm";
        return '<span class="shift-chip ' + cls + '">' + esc(label) + "</span>";
      }).join("");
      var tag = list[0].tag ? '<span class="pill-tag">' + esc(list[0].tag) + "</span>" : "";
      if (list[0].note && list[0].note.indexOf("替假") >= 0) tag += '<span class="pill-tag">替假</span>';
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

    var body = Object.keys(sections).map(function (id) {
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
    var lines = ["📅 " + weekdayLabel(selectedDate) + " 推廣員更表", "（待確認／可改）", ""];
    ROLE_GROUPS.forEach(function (g) {
      var mem = people.filter(function (s) {
        return matchGroupRole(g, s.role) ||
          (g.id === "zihua" && (s.role === "Promoter" || s.role === "Senior Promoter"));
      });
      if (!mem.length) return;
      lines.push("【" + g.title + "】");
      mem.forEach(function (m) {
        lines.push("· " + m.name + " " + m.start + "-" + m.end + (m.tag ? "（" + m.tag + "）" : ""));
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

  function render() {
    var root = document.getElementById("rosterRoot");
    if (!root) return;
    ensureDemo();
    var body = mode === "date" ? renderDateMode() : renderPersonMode();
    root.innerHTML =
      '<header class="roster-hero">' +
        '<div class="roster-hero-top">' +
          "<div><p class=\"pc-hero-kicker\">2026 工展會</p><h2>推廣員更表</h2></div>" +
          '<div class="roster-hero-actions">' +
            '<button type="button" class="btn-ghost" id="btnRosterLogin">🔒 職員登入</button>' +
          "</div>" +
        "</div>" +
        '<div class="mode-toggle">' +
          '<button type="button" class="mode-btn' + (mode === "date" ? " active" : "") + '" data-mode="date">📅 按日期</button>' +
          '<button type="button" class="mode-btn' + (mode === "person" ? " active" : "") + '" data-mode="person">👤 按人</button>' +
        "</div>" +
      "</header>" +
      '<div class="roster-body">' + body + "</div>" +
      (isAdmin()
        ? '<div class="btn-row" style="margin:12px 0"><button type="button" class="btn-ghost" id="btnResetRoster">還原範本＋示例</button></div>'
        : "") +
      '<p class="claim-safe">示例人名標「待確認／可改」；真名時間表請職員登入後更新。</p>';
  }

  function bind() {
    var root = document.getElementById("rosterRoot");
    if (!root || root._rosterBound) return;
    root._rosterBound = true;
    root.addEventListener("click", function (e) {
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
        if (!confirm("還原更表（清本機改動，再套示例）？")) return;
        localStorage.removeItem(LS);
        localStorage.removeItem(LS_DEMO);
        ensureDemo();
        render();
      }
    });
  }

  window.BPE_Roster = {
    render: function () { bind(); render(); },
    getShifts: getShifts
  };
})();
