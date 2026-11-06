/* Office 同事更表 + 補鐘統計 — 暫定 roster，內部參考 */
(function () {
  "use strict";

  var officeMode = "date"; // date | person
  var selectedDate = "";

  function seed() {
    return window.BPE_OFFICE_ROSTER_SEED || null;
  }

  function isStaff() {
    var a = window.ZihuaAdminAuth;
    return !!(a && a.isLoggedIn && a.isLoggedIn());
  }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function fmtDateChip(iso, weekday) {
    var md = iso.slice(5).replace("-", "/");
    return "週" + weekday + " " + md;
  }

  function dayTypeBadge(dayType) {
    var cls = "badge-weekday";
    if (dayType === "週末") cls = "badge-weekend";
    else if (dayType === "公眾假期") cls = "badge-holiday";
    return '<span class="day-type-badge ' + cls + '">' + esc(dayType) + "</span>";
  }

  function fmtHours(n) {
    if (n == null || n === "") return "—";
    var x = Number(n);
    if (Math.abs(x - Math.round(x)) < 1e-9) return String(Math.round(x));
    return String(Math.round(x * 10) / 10);
  }


  function splitBuchong(hours) {
    var h = Number(hours) || 0;
    var whole = Math.floor(h / 9);
    var rem = Math.round((h - whole * 9) * 10) / 10;
    if (Math.abs(rem) < 1e-9) rem = 0;
    return { wholeDays: whole, remainHours: rem };
  }

  function daysList() {
    var s = seed();
    return s && Array.isArray(s.days) ? s.days : [];
  }

  function summaryList() {
    var s = seed();
    return s && Array.isArray(s.summary) ? s.summary : [];
  }

  function assignmentsFor(date) {
    var s = seed();
    if (!s || !Array.isArray(s.assignments)) return [];
    return s.assignments.filter(function (a) { return a.date === date; });
  }

  function assignmentsForPerson(name) {
    var s = seed();
    if (!s || !Array.isArray(s.assignments)) return [];
    return s.assignments.filter(function (a) { return a.name === name; })
      .slice().sort(function (a, b) { return String(a.date).localeCompare(b.date); });
  }

  function ensureSelectedDate() {
    var days = daysList();
    if (!days.length) return;
    if (!selectedDate || !days.some(function (d) { return d.date === selectedDate; })) {
      selectedDate = days[0].date;
    }
  }

  function openLogin() {
    if (window.BPE_Shell && window.BPE_Shell.openLogin) window.BPE_Shell.openLogin();
  }

  function renderOfficeDate(staff) {
    ensureSelectedDate();
    var days = daysList();
    var chips = days.map(function (d) {
      return '<button type="button" class="date-chip' + (d.date === selectedDate ? " active" : "") +
        '" data-office-date="' + esc(d.date) + '">' + esc(fmtDateChip(d.date, d.weekday)) +
        '<span class="date-chip-n">' + d.onDuty.length + "人 · " + esc(d.dayType) + "</span></button>";
    }).join("");

    var day = null;
    for (var i = 0; i < days.length; i++) {
      if (days[i].date === selectedDate) { day = days[i]; break; }
    }
    if (!day) return '<div class="date-chips">' + chips + '</div><p class="muted">呢日未有 Office 同事</p>';

    var rows = assignmentsFor(selectedDate);
    var pills;
    if (rows.length) {
      pills = rows.map(function (a) {
        var letter = (a.name || "?").charAt(0);
        var tag = "";
        if (staff) {
          if (a.notes) {
            var short = a.notes.split("；")[0].trim();
            if (short) tag = '<span class="pill-tag">' + esc(short) + "</span>";
          }
          tag += '<span class="pill-tag">補 ' + esc(fmtHours(a.buchongHours)) + "h</span>";
        }
        return '<span class="name-pill"><span class="pill-av">' + esc(letter) + "</span>" +
          esc(a.name) + tag + "</span>";
      }).join("");
    } else {
      // fallback to onDuty names (e.g. if assignment filtered)
      pills = (day.onDuty || []).map(function (name) {
        var letter = (name || "?").charAt(0);
        return '<span class="name-pill"><span class="pill-av">' + esc(letter) + "</span>" +
          esc(name) + "</span>";
      }).join("");
    }

    var callLabel = day.callStart + " – " + day.callEnd;
    var shiftMeta = staff
      ? ("Call Time " + esc(callLabel) + " · 工時 " + esc(fmtHours(day.fairHours)) + "h")
      : ("Call Time " + esc(callLabel));
    var card =
      '<section class="roster-card">' +
        "<h3>Office 同事 " + dayTypeBadge(day.dayType) + "</h3>" +
        '<div class="roster-shift">' +
          "<h4>" + shiftMeta + "</h4>" +
          '<div class="name-pills">' + (pills || '<span class="muted">未有人</span>') + "</div>" +
        "</div>" +
      "</section>";

    return '<div class="date-chips">' + chips + "</div>" + card;
  }

  function renderOfficePerson(staff) {
    var summary = summaryList();
    var totalBuchong = 0;
    var totalDays = 0;
    summary.forEach(function (s) {
      totalBuchong += Number(s.buchongHours) || 0;
      totalDays += Number(s.days) || 0;
    });

    var cards = summary.map(function (s) {
      var list = assignmentsForPerson(s.name);
      var chips = list.map(function (a) {
        var label = a.date.slice(5).replace("-", "/") + " ";
        var cls = "chip-pm";
        if (a.dayType === "平日") cls = "chip-am";
        else if (a.dayType === "公眾假期") cls = "chip-holiday";
        else cls = "chip-weekend";
        if (staff) {
          label += "補" + fmtHours(a.buchongHours) + "h";
        } else {
          label += a.dayType;
        }
        return '<span class="shift-chip ' + cls + '">' + esc(label) + "</span>";
      }).join("");
      var footnote = "";
      if (staff && s.name === "Ben") {
        footnote = '<p class="office-footnote">※ Ben 12/12 拍野暫不計入（工時未定）</p>';
      }
      var split = splitBuchong(s.buchongHours);
      var headRight = staff
        ? ('<div class="person-count">' + esc(fmtHours(s.buchongHours)) + "h<br><span class=\"muted\">應補 " +
            split.wholeDays + " 日 · 剩 " + esc(fmtHours(split.remainHours)) + "h</span></div>")
        : ('<div class="person-count">' + s.days + " 日</div>");
      var sub = staff
        ? ('平日 ' + s.weekdayDays + " · 週末／假 " + s.holidayWeekendDays + " · 共 " + s.days + " 日")
        : ("共 " + s.days + " 日 · 週末／假 " + s.holidayWeekendDays + " · 平日 " + s.weekdayDays);
      return (
        '<div class="person-card">' +
          '<div class="person-head">' +
            '<span class="pill-av">' + esc(s.name.charAt(0)) + "</span>" +
            "<div><strong>" + esc(s.name) + "</strong>" +
            '<div class="muted">' + sub + "</div></div>" +
            headRight +
          "</div>" +
          '<div class="shift-chips">' + chips + "</div>" +
          footnote +
        "</div>"
      );
    }).join("");

    var stats = staff
      ? (
        '<div class="roster-stats">' +
          "<div><strong>" + summary.length + "</strong><span>Office 同事</span></div>" +
          "<div><strong>" + totalDays + "</strong><span>全部人次</span></div>" +
          "<div><strong>" + esc(fmtHours(totalBuchong)) + "h</strong><span>補鐘合計</span></div>" +
        "</div>"
      )
      : (
        '<div class="roster-stats">' +
          "<div><strong>" + summary.length + "</strong><span>Office 同事</span></div>" +
          "<div><strong>" + totalDays + "</strong><span>全部人次</span></div>" +
          "<div><strong>邊個返</strong><span>訪客版</span></div>" +
        "</div>"
      );

    return (
      stats +
      '<section class="roster-card"><h3>按人 · 暫定 roster</h3>' + cards + "</section>"
    );
  }

  function renderBuchongLock() {
    return (
      '<section class="roster-card office-buchong-lock">' +
        "<h3>補鐘統計 · 職員專用</h3>" +
        '<p class="muted">補鐘時數只喺職員登入後先睇到。訪客版只顯示邊個返。</p>' +
        '<div class="btn-row" style="margin-top:12px">' +
          '<button type="button" class="btn-primary" data-office-login="1">🔒 職員登入</button>' +
        "</div>" +
      "</section>"
    );
  }

  function renderBuchong() {
    if (!isStaff()) return renderBuchongLock();

    var summary = summaryList();
    var s = seed();
    var rules = (s && s.rulesNote) || [];
    var setup = (s && s.setupUncertain) || [];

    var rows = summary.map(function (r) {
      var note = r.name === "Ben" ? ' <span class="pill-tag">12/12 唔計</span>' : "";
      var split = splitBuchong(r.buchongHours);
      return (
        "<tr>" +
          "<td><strong>" + esc(r.name) + "</strong>" + note + "</td>" +
          "<td>" + r.days + "</td>" +
          "<td>" + r.weekdayDays + "</td>" +
          "<td>" + r.holidayWeekendDays + "</td>" +
          "<td><strong>" + esc(fmtHours(r.buchongHours)) + "h</strong></td>" +
          "<td><strong>" + split.wholeDays + " 日</strong></td>" +
          "<td><strong>" + esc(fmtHours(split.remainHours)) + "h</strong></td>" +
          '<td class="muted">' + esc(Number(r.buchongDays).toFixed(3)) + "</td>" +
        "</tr>"
      );
    }).join("");

    var rulesHtml = rules.map(function (line) {
      return "<li>" + esc(line) + "</li>";
    }).join("");

    var setupHtml = setup.map(function (u) {
      return (
        '<div class="setup-uncertain-item">' +
          "<strong>" + esc(u.date.slice(5).replace("-", "/")) + " 週" + esc(u.weekday) +
          " · " + esc(u.label) + "</strong>" +
          "<div class=\"muted\">" + esc(u.staffNotes) + "</div>" +
          '<div class="muted">' + esc(u.note) + "</div>" +
        "</div>"
      );
    }).join("");

    return (
      '<div class="roster-stats">' +
        "<div><strong>" + summary.length + "</strong><span>同事</span></div>" +
        "<div><strong>1日＝9h</strong><span>應補日數</span></div>" +
        "<div><strong>暫定</strong><span>內部參考</span></div>" +
      "</div>" +
      '<section class="roster-card">' +
        "<h3>補鐘統計</h3>" +
        '<div class="buchong-table-wrap"><table class="buchong-table">' +
          "<thead><tr>" +
            "<th>同事</th><th>出勤日</th><th>平日</th><th>週末／假</th><th>補鐘時數</th><th>應補日數</th><th>剩返小時</th><th class=\"muted\">÷9</th>" +
          "</tr></thead>" +
          "<tbody>" + rows + "</tbody>" +
        "</table></div>" +
        '<p class="office-footnote">※ 應補日數＝floor(補鐘÷9)；剩返小時＝餘數（可再補／湊日）。Ben 12/12 拍野暫不計入。唔係正式 claim 金額。</p>' +
      "</section>" +
      '<section class="roster-card">' +
        "<h3>計法說明</h3>" +
        '<ul class="office-rules">' + rulesHtml + "</ul>" +
      "</section>" +
      '<section class="roster-card">' +
        "<h3>Set Up／工時不明（不計入合計）</h3>" +
        (setupHtml || '<p class="muted">無</p>') +
      "</section>"
    );
  }

  function renderBody(kind) {
    var staff = isStaff();
    if (kind === "buchong") return renderBuchong();
    if (kind === "office") {
      return (
        '<div class="mode-toggle office-submode">' +
          '<button type="button" class="mode-btn' + (officeMode === "date" ? " active" : "") +
            '" data-office-mode="date">📅 按日期</button>' +
          '<button type="button" class="mode-btn' + (officeMode === "person" ? " active" : "") +
            '" data-office-mode="person">👤 按人</button>' +
        "</div>" +
        (officeMode === "date" ? renderOfficeDate(staff) : renderOfficePerson(staff))
      );
    }
    return "";
  }

  function handleClick(e) {
    var loginBtn = e.target.closest("[data-office-login]");
    if (loginBtn) {
      openLogin();
      return true;
    }
    var om = e.target.closest("[data-office-mode]");
    if (om) {
      officeMode = om.getAttribute("data-office-mode");
      return true;
    }
    var od = e.target.closest("[data-office-date]");
    if (od) {
      selectedDate = od.getAttribute("data-office-date");
      return true;
    }
    return false;
  }

  function heroTitle(kind) {
    if (kind === "buchong") return "Office 補鐘統計";
    if (kind === "office") return "Office 同事更表";
    return "推廣員更表";
  }

  function heroKicker(kind) {
    if (kind === "promoter") return "2026 工展會 · 12/12–1/4";
    if (!isStaff() && kind === "office") return "暫定 roster · 顯示邊個返";
    return "暫定 roster · 內部參考 · 非正式 claim";
  }

  window.BPE_OfficeRoster = {
    renderBody: renderBody,
    handleClick: handleClick,
    heroTitle: heroTitle,
    heroKicker: heroKicker,
    getOfficeMode: function () { return officeMode; },
    setOfficeMode: function (m) { officeMode = m; },
    isStaff: isStaff
  };
})();
