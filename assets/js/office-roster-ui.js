/* Office 同事更表 + 補鐘統計 — 暫定 roster，內部參考 */
(function () {
  "use strict";

  var LS_OVERRIDES = "zihua_bpe_office_roster_overrides_v1";
  var LS_PHOTO = "zihua_bpe_office_roster_photo_v1";
  var OFFICIAL_SHEET = "assets/img/office/roster-official-20261128.jpg?v=20261128a";
  var FULL_SHIFT_EPS = 0.05;

  var officeMode = "date"; // date | person
  var selectedDate = "";
  var sheetOpen = false;
  var photoOpen = false;

  function seed() {
    return window.BPE_OFFICE_ROSTER_SEED || null;
  }

  function isStaff() {
    /* 此處 isStaff＝管理員可見備註／補鐘（PIN 職員唔見） */
    if (window.ZihuaStaffAuth && window.ZihuaStaffAuth.isAdmin) {
      return !!window.ZihuaStaffAuth.isAdmin();
    }
    var a = window.ZihuaAdminAuth;
    return !!(a && a.isLoggedIn && a.isLoggedIn());
  }

  function canOperate() {
    if (window.ZihuaStaffAuth && window.ZihuaStaffAuth.canOperate) {
      return !!window.ZihuaStaffAuth.canOperate();
    }
    return isStaff();
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
    else if (dayType === "Set Up") cls = "badge-setup";
    return '<span class="day-type-badge ' + cls + '">' + esc(dayType) + "</span>";
  }

  function fmtHours(n) {
    if (n == null || n === "") return "—";
    var x = Number(n);
    if (!isFinite(x)) return "—";
    if (Math.abs(x - Math.round(x)) < 1e-9) return String(Math.round(x));
    var one = Math.round(x * 10) / 10;
    if (Math.abs(x - one) < 1e-9) return String(one);
    return String(Math.round(x * 100) / 100);
  }

  function parseMinutes(t) {
    var p = String(t || "").split(":");
    var h = Number(p[0]);
    var m = Number(p[1] || 0);
    if (!isFinite(h) || !isFinite(m)) return null;
    return h * 60 + m;
  }

  function hoursBetween(start, end) {
    var a = parseMinutes(start);
    var b = parseMinutes(end);
    if (a == null || b == null) return 0;
    return (b - a) / 60;
  }

  function hasClockTime(t) {
    return !!String(t || "").trim();
  }

  function splitBuchong(hours) {
    var h = Number(hours) || 0;
    var whole = Math.floor((h + 1e-9) / 9);
    var rem = Math.round((h - whole * 9) * 100) / 100;
    if (Math.abs(rem) < 1e-9) rem = 0;
    return { wholeDays: whole, remainHours: rem, buchongDays: Math.round((h / 9) * 1000) / 1000 };
  }

  function computeBuchong(day, start, end, workedHours) {
    if (!day || day.countInBuchong === false) {
      return { worked: 0, fair: 0, official: 0, buchong: 0, daysCredit: 0 };
    }
    var fair = Number(day.fairHours);
    if (!fair) fair = hoursBetween(day.callStart, day.callEnd);
    var official = Number(day.onDutyHour);
    if (!isFinite(official)) official = 0;
    var worked;
    if (workedHours != null && isFinite(Number(workedHours)) && !(hasClockTime(start) && hasClockTime(end))) {
      worked = Number(workedHours);
    } else {
      worked = hoursBetween(start || day.callStart, end || day.callEnd);
    }
    if (worked < 0) worked = 0;
    var full = Math.abs(worked - fair) < FULL_SHIFT_EPS;
    var buchong = full ? official : Math.round(official * (worked / (fair || 1)) * 10) / 10;
    var daysCredit = Math.round((worked / (fair || 1)) * 10) / 10;
    return { worked: worked, fair: fair, official: official, buchong: buchong, daysCredit: daysCredit };
  }

  function officialSheetSrc() {
    var s = seed();
    var path = (s && s.officialSheet) || "assets/img/office/roster-official-20261128.jpg";
    if (path.indexOf("?") === -1) path += "?v=20261128a";
    return path;
  }

  function getOverrides() {
    try {
      var raw = localStorage.getItem(LS_OVERRIDES);
      if (!raw) return {};
      var data = JSON.parse(raw);
      return data && typeof data === "object" && !Array.isArray(data) ? data : {};
    } catch (e) {
      return {};
    }
  }

  function setOverrides(obj) {
    localStorage.setItem(LS_OVERRIDES, JSON.stringify(obj));
  }

  function getPhoto() {
    try {
      var raw = localStorage.getItem(LS_PHOTO);
      if (!raw) return null;
      var data = JSON.parse(raw);
      if (data && data.dataUrl) return data;
      return null;
    } catch (e) {
      return null;
    }
  }

  function setPhoto(obj) {
    localStorage.setItem(LS_PHOTO, JSON.stringify(obj));
  }

  function clearPhoto() {
    localStorage.removeItem(LS_PHOTO);
  }

  function daysList() {
    var s = seed();
    return s && Array.isArray(s.days) ? s.days : [];
  }

  function setupList() {
    var s = seed();
    return s && Array.isArray(s.setupUncertain) ? s.setupUncertain : [];
  }

  function peopleList() {
    var s = seed();
    return s && Array.isArray(s.people) ? s.people.slice() : [];
  }

  function dayByDate(date) {
    var days = daysList();
    for (var i = 0; i < days.length; i++) {
      if (days[i].date === date) return days[i];
    }
    return null;
  }

  function setupByDate(date) {
    var setup = setupList();
    for (var i = 0; i < setup.length; i++) {
      if (setup[i].date === date) return setup[i];
    }
    return null;
  }

  function seedRawForDate(date) {
    var s = seed();
    var day = dayByDate(date);
    var list = [];
    if (s && Array.isArray(s.assignments)) {
      list = s.assignments.filter(function (a) { return a.date === date; }).map(function (a) {
        var workedH = (a.workedHours != null && isFinite(Number(a.workedHours))) ? Number(a.workedHours) : null;
        var useHoursOnly = workedH != null && !(hasClockTime(a.start) && hasClockTime(a.end));
        return {
          name: a.name,
          start: useHoursOnly ? (a.start || "") : (a.start || a.callStart || (day && day.callStart) || ""),
          end: useHoursOnly ? (a.end || "") : (a.end || a.callEnd || (day && day.callEnd) || ""),
          notes: a.notes || "",
          workedHours: workedH
        };
      });
    }
    if (!list.length && day && Array.isArray(day.onDuty)) {
      list = day.onDuty.map(function (name) {
        return {
          name: name,
          start: day.callStart,
          end: day.callEnd,
          notes: day.notes || ""
        };
      });
    }
    return list;
  }

  function hasOverride(date) {
    var ov = getOverrides();
    return Object.prototype.hasOwnProperty.call(ov, date);
  }

  function enrichAssignment(day, raw) {
    var workedH = (raw.workedHours != null && isFinite(Number(raw.workedHours))) ? Number(raw.workedHours) : null;
    var hasClock = hasClockTime(raw.start) && hasClockTime(raw.end);
    var start, end;
    if (hasClock) {
      start = raw.start;
      end = raw.end;
    } else if (workedH != null) {
      start = raw.start || "";
      end = raw.end || "";
    } else {
      start = raw.start || (day && day.callStart) || "";
      end = raw.end || (day && day.callEnd) || "";
    }
    var r = computeBuchong(day, start, end, hasClock ? null : workedH);
    return {
      name: raw.name,
      date: day ? day.date : raw.date,
      weekday: day ? day.weekday : raw.weekday,
      dayType: day ? day.dayType : raw.dayType,
      timeStart: day ? day.timeStart : raw.timeStart,
      timeEnd: day ? day.timeEnd : raw.timeEnd,
      callStart: day ? day.callStart : raw.callStart,
      callEnd: day ? day.callEnd : raw.callEnd,
      start: start,
      end: end,
      workedHours: hasClock ? null : workedH,
      fairHours: day ? day.fairHours : raw.fairHours,
      onDutyHour: day ? day.onDutyHour : raw.onDutyHour,
      buchongHours: r.buchong,
      daysCredit: r.daysCredit,
      notes: raw.notes || (day && day.notes) || ""
    };
  }

  function assignmentsFor(date) {
    var day = dayByDate(date);
    if (!day) return [];
    var raw;
    var ov = getOverrides();
    if (Object.prototype.hasOwnProperty.call(ov, date)) {
      raw = Array.isArray(ov[date]) ? ov[date] : [];
    } else {
      raw = seedRawForDate(date);
    }
    return raw.map(function (a) { return enrichAssignment(day, a); });
  }

  function allEffectiveAssignments() {
    var days = daysList();
    var out = [];
    days.forEach(function (d) {
      Array.prototype.push.apply(out, assignmentsFor(d.date));
    });
    return out;
  }

  function assignmentsForPerson(name) {
    return allEffectiveAssignments().filter(function (a) { return a.name === name; })
      .slice().sort(function (a, b) { return String(a.date).localeCompare(b.date); });
  }

  function computeSummary() {
    var people = peopleList();
    var byName = {};
    people.forEach(function (name) {
      byName[name] = {
        name: name,
        days: 0,
        weekdayDays: 0,
        holidayWeekendDays: 0,
        totalFairHours: 0,
        buchongHours: 0
      };
    });
    allEffectiveAssignments().forEach(function (a) {
      var day = dayByDate(a.date);
      if (!day || day.countInBuchong === false) return;
      var s = byName[a.name];
      if (!s) {
        s = {
          name: a.name,
          days: 0,
          weekdayDays: 0,
          holidayWeekendDays: 0,
          totalFairHours: 0,
          buchongHours: 0
        };
        byName[a.name] = s;
        people.push(a.name);
      }
      s.days += Number(a.daysCredit) || 0;
      if (a.dayType === "平日") s.weekdayDays += Number(a.daysCredit) || 0;
      else s.holidayWeekendDays += Number(a.daysCredit) || 0;
      s.totalFairHours += Number(a.fairHours) || 0;
      s.buchongHours += Number(a.buchongHours) || 0;
    });
    return people.map(function (name) {
      var s = byName[name];
      var split = splitBuchong(s.buchongHours);
      return {
        name: s.name,
        days: Math.round(s.days * 10) / 10,
        weekdayDays: Math.round(s.weekdayDays * 10) / 10,
        holidayWeekendDays: Math.round(s.holidayWeekendDays * 10) / 10,
        totalFairHours: Math.round(s.totalFairHours * 100) / 100,
        buchongHours: Math.round(s.buchongHours * 100) / 100,
        buchongDays: split.buchongDays,
        buchongWholeDays: split.wholeDays,
        buchongRemainHours: split.remainHours
      };
    });
  }

  function writeDateOverride(date, list) {
    var ov = getOverrides();
    ov[date] = list.map(function (a) {
      var row = { name: a.name, start: a.start, end: a.end, notes: a.notes || "" };
      if (a.workedHours != null && isFinite(Number(a.workedHours)) && !(hasClockTime(a.start) && hasClockTime(a.end))) {
        row.workedHours = Number(a.workedHours);
      }
      return row;
    });
    setOverrides(ov);
  }

  function currentRawForEdit(date) {
    var ov = getOverrides();
    if (Object.prototype.hasOwnProperty.call(ov, date)) {
      return (ov[date] || []).map(function (a) {
        return { name: a.name, start: a.start, end: a.end, notes: a.notes || "", workedHours: a.workedHours };
      });
    }
    return seedRawForDate(date);
  }

  function addPersonToDate(date, name) {
    var day = dayByDate(date);
    if (!day || !name) return false;
    var list = currentRawForEdit(date);
    if (list.some(function (a) { return a.name === name; })) return false;
    list.push({
      name: name,
      start: day.callStart,
      end: day.callEnd,
      notes: ""
    });
    writeDateOverride(date, list);
    return true;
  }

  function removePersonFromDate(date, name) {
    var list = currentRawForEdit(date).filter(function (a) { return a.name !== name; });
    writeDateOverride(date, list);
  }

  function updatePersonTime(date, name, field, value) {
    var list = currentRawForEdit(date);
    var found = false;
    list.forEach(function (a) {
      if (a.name === name) {
        a[field] = value;
        found = true;
      }
    });
    if (!found) return false;
    writeDateOverride(date, list);
    return true;
  }

  function restoreOfficialDay(date) {
    var ov = getOverrides();
    if (Object.prototype.hasOwnProperty.call(ov, date)) {
      delete ov[date];
      setOverrides(ov);
    }
  }

  function allSelectableDates() {
    var setup = setupList();
    var days = daysList();
    var out = [];
    setup.forEach(function (u) {
      out.push({
        date: u.date,
        weekday: u.weekday,
        dayType: "Set Up",
        label: u.label,
        setup: true,
        count: 0
      });
    });
    days.forEach(function (d) {
      out.push({
        date: d.date,
        weekday: d.weekday,
        dayType: d.dayType,
        label: d.dayType,
        setup: false,
        count: assignmentsFor(d.date).length
      });
    });
    return out;
  }

  function ensureSelectedDate() {
    var all = allSelectableDates();
    if (!all.length) return;
    if (!selectedDate || !all.some(function (d) { return d.date === selectedDate; })) {
      var firstFair = all.filter(function (d) { return !d.setup; })[0];
      selectedDate = (firstFair || all[0]).date;
    }
  }

  function openLogin() {
    if (window.BPE_Shell && window.BPE_Shell.openLogin) window.BPE_Shell.openLogin();
  }

  function requestRender() {
    if (window.BPE_Roster && window.BPE_Roster.render) window.BPE_Roster.render();
  }

  function datePickHtml(all) {
    var opts = all.map(function (d) {
      var extra = d.setup ? ("Set Up · 不計補鐘") : (d.count + "人 · " + d.dayType);
      return '<option value="' + esc(d.date) + '"' + (d.date === selectedDate ? " selected" : "") + ">" +
        esc(fmtDateChip(d.date, d.weekday)) + " · " + esc(extra) + "</option>";
    }).join("");
    return (
      '<div class="roster-date-pick">' +
        '<label for="officeDateSelect">選擇日子</label>' +
        '<select id="officeDateSelect" data-office-date-select>' + opts + "</select>" +
      "</div>"
    );
  }

  function dateChipsHtml(all) {
    return '<div class="date-chips">' + all.map(function (d) {
      var sub = d.setup ? (esc(d.label) + " · 不計補鐘") : (d.count + "人 · " + esc(d.dayType));
      return '<button type="button" class="date-chip' +
        (d.date === selectedDate ? " active" : "") +
        (d.setup ? " date-chip-setup" : "") +
        '" data-office-date="' + esc(d.date) + '">' +
        esc(fmtDateChip(d.date, d.weekday)) +
        '<span class="date-chip-n">' + sub + "</span></button>";
    }).join("") + "</div>";
  }

  function timeLabel(start, end, hours) {
    if (hasClockTime(start) && hasClockTime(end)) return start + "–" + end;
    if (hours != null && hours !== "" && isFinite(Number(hours))) return fmtHours(hours) + "小時";
    return "";
  }

  function renderSetupCard(u) {
    return (
      '<section class="roster-card">' +
        "<h3>" + esc(u.label || "Set Up") + dayTypeBadge("Set Up") + "</h3>" +
        '<p class="office-setup-staff">' + esc(u.staffNotes || "") + "</p>" +
        '<p class="office-footnote">' + esc(u.note || "不計入補鐘合計") + "</p>" +
      "</section>"
    );
  }

  function renderAssignBlock(day, rows, staff, operate) {
    var html = rows.map(function (a) {
      var letter = (a.name || "?").charAt(0);
      var times = timeLabel(a.start, a.end, a.workedHours);
      var tags = "";
      if (times) tags += '<span class="pill-tag pill-tag-time">' + esc(times) + "</span>";
      if ((a.notes || "").indexOf("拍野") !== -1) tags += '<span class="pill-tag">拍野</span>';
      if (staff) {
        if (a.notes) {
          var short = a.notes.split("；")[0].trim();
          if (short && short.indexOf(a.name) === -1) {
            tags += '<span class="pill-tag">' + esc(short) + "</span>";
          }
        }
        tags += '<span class="pill-tag">補 ' + esc(fmtHours(a.buchongHours)) + "h</span>";
      }
      var head =
        '<div class="office-assign-head">' +
          '<span class="name-pill"><span class="pill-av">' + esc(letter) + "</span>" +
          esc(a.name) + tags + "</span>" +
          (operate
            ? '<button type="button" class="office-rm-btn" data-office-remove="' + esc(a.name) + '">移走</button>'
            : "") +
        "</div>";
      var editors = "";
      if (operate) {
        editors =
          '<div class="office-time-editors">' +
            '<label>由<input type="time" data-office-time-start="' + esc(a.name) + '" value="' + esc(a.start) + '"></label>' +
            '<label>至<input type="time" data-office-time-end="' + esc(a.name) + '" value="' + esc(a.end) + '"></label>' +
          "</div>";
      }
      return '<div class="office-assign-row">' + head + editors + "</div>";
    }).join("");

    if (!html) html = '<p class="muted">未有人</p>';

    var addRow = "";
    if (operate) {
      var onNames = {};
      rows.forEach(function (a) { onNames[a.name] = true; });
      var options = peopleList().filter(function (n) { return !onNames[n]; }).map(function (n) {
        return '<option value="' + esc(n) + '">' + esc(n) + "</option>";
      }).join("");
      var dirty = hasOverride(day.date);
      addRow =
        '<div class="office-edit-row">' +
          '<label class="office-add-label">加入同事' +
            '<select data-office-add-select>' +
              '<option value="">揀人加入…</option>' + options +
            "</select>" +
          "</label>" +
          '<button type="button" class="btn-ghost office-restore-btn" data-office-restore-day' +
            (dirty ? "" : " disabled") + ">還原呢日官方更表</button>" +
        "</div>" +
        (dirty ? '<p class="office-footnote">已改呢日本機更表。</p>' : "") +
        '<p class="office-footnote">加減同時間只儲喺呢部機，兩部機唔會同步。</p>';
    }

    return html + addRow;
  }

  function renderOfficeDate(staff, operate) {
    ensureSelectedDate();
    var all = allSelectableDates();
    var pick = datePickHtml(all);
    var chips = dateChipsHtml(all);

    var setup = setupByDate(selectedDate);
    if (setup) {
      return pick + chips + renderSetupCard(setup);
    }

    var day = dayByDate(selectedDate);
    if (!day) return pick + chips + '<p class="muted">呢日未有 Office 同事</p>';

    var rows = assignmentsFor(selectedDate);
    var callLabel = (day.callStart || "") + " – " + (day.callEnd || "");
    var boothLabel = (day.timeStart && day.timeEnd) ? (day.timeStart + " – " + day.timeEnd) : "";
    var shiftMeta = "Call Time " + esc(callLabel);
    if (boothLabel) shiftMeta = "展位 Time " + esc(boothLabel) + " · " + shiftMeta;
    if (staff) {
      shiftMeta += " · 全日補鐘 " + esc(fmtHours(day.onDutyHour)) + "h";
    }

    var card =
      '<section class="roster-card">' +
        "<h3>Office 同事 " + dayTypeBadge(day.dayType) + "</h3>" +
        '<div class="roster-shift">' +
          "<h4>" + shiftMeta + "</h4>" +
          '<div class="office-assign-list">' + renderAssignBlock(day, rows, staff, operate) + "</div>" +
        "</div>" +
      "</section>";

    return pick + chips + card;
  }

  function renderOfficePerson(staff) {
    var summary = computeSummary();
    var totalBuchong = 0;
    var totalDays = 0;
    summary.forEach(function (s) {
      totalBuchong += Number(s.buchongHours) || 0;
      totalDays += Number(s.days) || 0;
    });
    totalDays = Math.round(totalDays * 10) / 10;
    totalBuchong = Math.round(totalBuchong * 100) / 100;

    var cards = summary.map(function (s) {
      var list = assignmentsForPerson(s.name);
      var chips = list.map(function (a) {
        var times = timeLabel(a.start, a.end, a.workedHours);
        var label = a.date.slice(5).replace("-", "/");
        if (times) label += " " + times;
        if ((a.notes || "").indexOf("拍野") !== -1 && (!times || times.indexOf("拍野") === -1)) label += " 拍野";
        var cls = "chip-pm";
        if (a.dayType === "平日") cls = "chip-am";
        else if (a.dayType === "公眾假期") cls = "chip-holiday";
        else cls = "chip-weekend";
        if (staff) {
          label += " 補" + fmtHours(a.buchongHours) + "h";
        }
        return '<span class="shift-chip ' + cls + '">' + esc(label) + "</span>";
      }).join("");
      var split = splitBuchong(s.buchongHours);
      var headRight = staff
        ? ('<div class="person-count">' + esc(fmtHours(s.buchongHours)) + "h<br><span class=\"muted\">應補 " +
            split.wholeDays + " 日 · 剩 " + esc(fmtHours(split.remainHours)) + "h</span></div>")
        : ('<div class="person-count">' + s.days + " 日</div>");
      var sub = staff
        ? ("平日 " + s.weekdayDays + " · 週末／假 " + s.holidayWeekendDays + " · 共 " + s.days + " 日")
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
        "</div>"
      );

    return (
      stats +
      '<section class="roster-card"><h3>' + (staff ? "按人 · 暫定 roster（跟有效更表即時計）" : "按人") + "</h3>" + cards + "</section>"
    );
  }

  function renderSheetBlock(operate) {
    if (!operate) return "";
    var photo = getPhoto();
    var src = photo && photo.dataUrl ? photo.dataUrl : officialSheetSrc();
    var isUpload = !!(photo && photo.dataUrl);
    var caption = isUpload ? "已上傳本機參考圖" : "官方更表圖（內部參考，含補鐘／CL）";
    var deleteBtn = isUpload
      ? '<button type="button" class="btn-ghost" data-office-photo-delete>刪除上傳，用回官方圖</button>'
      : "";
    return (
      '<section class="roster-card office-sheet-card">' +
        '<details class="office-sheet-details"' + (sheetOpen ? " open" : "") + " data-office-sheet-details>" +
          "<summary>官方／參考更表圖（只供登入職員）</summary>" +
          '<p class="office-footnote">拍最新更表圖作參考，再用加減改當日出勤；只儲喺呢部機。</p>' +
          '<button type="button" class="office-sheet-thumb" data-office-photo-open title="放大">' +
            '<img src="' + esc(src) + '" alt="' + esc(caption) + '">' +
          "</button>" +
          '<p class="office-footnote">' + esc(caption) + (isUpload && photo.ts
            ? (" · " + new Date(photo.ts).toLocaleString("zh-HK", { hour12: false }))
            : "") + "</p>" +
          '<div class="btn-row office-photo-actions">' +
            '<label class="primary office-photo-upload">拍照／上傳更表' +
              '<input type="file" accept="image/*" capture="environment" data-office-photo-input>' +
            "</label>" +
            deleteBtn +
          "</div>" +
        "</details>" +
      "</section>"
    );
  }

  function renderPhotoLightbox() {
    if (!photoOpen) return "";
    var photo = getPhoto();
    var src = photo && photo.dataUrl ? photo.dataUrl : officialSheetSrc();
    return (
      '<div class="office-photo-lightbox" data-office-photo-close role="dialog" aria-label="更表圖放大">' +
        '<button type="button" class="office-photo-close" data-office-photo-close>關閉</button>' +
        '<img src="' + esc(src) + '" alt="Office 更表參考圖">' +
      "</div>"
    );
  }

  function renderBuchongLock() {
    return (
      '<section class="roster-card office-buchong-lock">' +
        "<h3>補鐘統計 · 職員專用</h3>" +
        '<p class="muted">請管理員登入後查看。</p>' +
        '<div class="btn-row" style="margin-top:12px">' +
          '<button type="button" class="btn-primary primary" data-office-login="1">🔒 職員登入</button>' +
        "</div>" +
      "</section>"
    );
  }

  function renderBuchong() {
    if (!isStaff()) return renderBuchongLock();

    var summary = computeSummary();
    var s = seed();
    var rules = (s && s.rulesNote) || [];
    var setup = setupList();

    var rows = summary.map(function (r) {
      var split = splitBuchong(r.buchongHours);
      return (
        "<tr>" +
          "<td><strong>" + esc(r.name) + "</strong></td>" +
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
        '<p class="office-footnote">※ 應補日數＝floor(補鐘÷9)；剩返小時＝餘數（可再補／湊日）。跟有效更表（官方種子＋本機加減）即時計算。唔係正式 claim 金額。</p>' +
      "</section>" +
      '<section class="roster-card">' +
        "<h3>計法說明</h3>" +
        '<ul class="office-rules">' + rulesHtml + "</ul>" +
      "</section>" +
      '<section class="roster-card">' +
        "<h3>Set Up／不計入合計</h3>" +
        (setupHtml || '<p class="muted">無</p>') +
      "</section>"
    );
  }

  function renderBody(kind) {
    var staff = isStaff();
    var operate = canOperate();
    if (kind === "buchong") return renderBuchong();
    if (kind === "office") {
      return (
        '<div class="mode-toggle office-submode">' +
          '<button type="button" class="mode-btn' + (officeMode === "date" ? " active" : "") +
            '" data-office-mode="date">📅 按日期</button>' +
          '<button type="button" class="mode-btn' + (officeMode === "person" ? " active" : "") +
            '" data-office-mode="person">👤 按人</button>' +
        "</div>" +
        renderSheetBlock(operate) +
        (officeMode === "date" ? renderOfficeDate(staff, operate) : renderOfficePerson(staff)) +
        renderPhotoLightbox()
      );
    }
    return "";
  }

  function handleClick(e) {
    var details = e.target.closest("[data-office-sheet-details]");
    if (details && (e.target.tagName === "SUMMARY" || (e.target.closest && e.target.closest("summary")))) {
      /* toggle 完先更新狀態，等下一次 render 跟住 */
      setTimeout(function () {
        var el = document.querySelector("[data-office-sheet-details]");
        sheetOpen = !!(el && el.open);
      }, 0);
    }

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

    var closeLb = e.target.closest("[data-office-photo-close]");
    if (closeLb) {
      photoOpen = false;
      return true;
    }
    var openLb = e.target.closest("[data-office-photo-open]");
    if (openLb) {
      photoOpen = true;
      return true;
    }
    var delPhoto = e.target.closest("[data-office-photo-delete]");
    if (delPhoto) {
      if (!canOperate()) return true;
      if (!confirm("刪除呢部機上嘅上傳更表圖，改回用官方圖？")) return true;
      clearPhoto();
      return true;
    }

    var restore = e.target.closest("[data-office-restore-day]");
    if (restore) {
      if (!canOperate() || restore.disabled) return true;
      if (!selectedDate) return true;
      if (!confirm("還原呢日官方更表（清呢日本機改動）？")) return true;
      restoreOfficialDay(selectedDate);
      return true;
    }

    var rm = e.target.closest("[data-office-remove]");
    if (rm) {
      if (!canOperate()) return true;
      var name = rm.getAttribute("data-office-remove");
      if (!name || !selectedDate) return true;
      var md = selectedDate.slice(5).replace("-", "/");
      if (!confirm("移走 " + name + " " + md + " 嘅更？")) return true;
      removePersonFromDate(selectedDate, name);
      return true;
    }

    return false;
  }

  function compressImageFile(file, cb) {
    var reader = new FileReader();
    reader.onload = function () {
      var img = new Image();
      img.onload = function () {
        try {
          var max = 1600;
          var w = img.width || 0;
          var h = img.height || 0;
          if (!w || !h) { cb(new Error("讀唔到圖片")); return; }
          if (w >= h && w > max) { h = Math.round(h * max / w); w = max; }
          else if (h > w && h > max) { w = Math.round(w * max / h); h = max; }
          var canvas = document.createElement("canvas");
          canvas.width = w;
          canvas.height = h;
          var ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, w, h);
          var quality = 0.7;
          var dataUrl = canvas.toDataURL("image/jpeg", quality);
          var i = 0;
          while (dataUrl.length > 1800000 && quality > 0.4 && i < 4) {
            quality -= 0.1;
            dataUrl = canvas.toDataURL("image/jpeg", quality);
            i += 1;
          }
          cb(null, { dataUrl: dataUrl, ts: Date.now(), name: file.name || "", quality: quality, width: w, height: h });
        } catch (err) {
          cb(err || new Error("壓縮失敗"));
        }
      };
      img.onerror = function () { cb(new Error("讀唔到圖片")); };
      img.src = reader.result;
    };
    reader.onerror = function () { cb(new Error("讀唔到檔案")); };
    reader.readAsDataURL(file);
  }

  function handleChange(e) {
    var t = e.target;
    if (!t) return false;

    if (t.getAttribute && t.getAttribute("data-office-photo-input") != null) {
      if (!canOperate()) return false;
      var file = t.files && t.files[0];
      if (!file) return false;
      compressImageFile(file, function (err, data) {
        if (err) {
          alert("上傳失敗：" + (err.message || "請再試"));
          return;
        }
        try {
          setPhoto(data);
        } catch (ex) {
          alert("圖片太大，儲唔入呢部機。請再影遠啲或者揀細啲嘅圖。");
          return;
        }
        sheetOpen = true;
        requestRender();
      });
      return false; /* 唔好即時 render，等壓縮完先 */
    }

    if (t.id === "officeDateSelect" || (t.getAttribute && t.getAttribute("data-office-date-select") != null)) {
      if (t.value) {
        selectedDate = t.value;
        return true;
      }
    }

    if (!canOperate()) return false;

    if (t.getAttribute && t.getAttribute("data-office-add-select") != null) {
      var addName = t.value;
      if (!addName || !selectedDate) return false;
      addPersonToDate(selectedDate, addName);
      return true;
    }

    var startName = t.getAttribute && t.getAttribute("data-office-time-start");
    if (startName) {
      if (t.value) updatePersonTime(selectedDate, startName, "start", t.value);
      return true;
    }
    var endName = t.getAttribute && t.getAttribute("data-office-time-end");
    if (endName) {
      if (t.value) updatePersonTime(selectedDate, endName, "end", t.value);
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
    /* 訪客只顯示簡潔標題；暫定／內部參考 remark 留俾職員 */
    if (!isStaff() && kind === "office") return "2026 工展會 · Office";
    return "暫定 roster · 內部參考 · 非正式 claim";
  }

  window.BPE_OfficeRoster = {
    renderBody: renderBody,
    handleClick: handleClick,
    handleChange: handleChange,
    heroTitle: heroTitle,
    heroKicker: heroKicker,
    getOfficeMode: function () { return officeMode; },
    setOfficeMode: function (m) { officeMode = m; },
    isStaff: isStaff,
    canOperate: canOperate,
    computeSummary: computeSummary
  };
})();
