/* 日常補貨表：職員填套／件、箱頭；本機草稿＋CSV／列印 */
(function () {
  "use strict";

  var LS_KEY = "zihua_bpe_restock_draft_v1";
  var searchQ = "";
  var statusMsg = "";

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
  function seed() {
    return window.BPE_RESTOCK_SEED || { version: "", items: [], sections: [], title: "日常補貨表" };
  }
  function isAdmin() {
    var a = window.ZihuaAdminAuth;
    return !!(a && a.isLoggedIn && a.isLoggedIn());
  }
  function todayStr() {
    var d = new Date();
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, "0");
    var day = String(d.getDate()).padStart(2, "0");
    return y + "-" + m + "-" + day;
  }

  function emptyDraft() {
    return { date: todayStr(), handler: "", qty: {}, cartons: {}, notes: {} };
  }

  function loadDraft() {
    try {
      var raw = localStorage.getItem(LS_KEY);
      if (!raw) return emptyDraft();
      var o = JSON.parse(raw);
      if (!o || typeof o !== "object") return emptyDraft();
      return {
        date: typeof o.date === "string" && o.date ? o.date : todayStr(),
        handler: typeof o.handler === "string" ? o.handler : "",
        qty: o.qty && typeof o.qty === "object" ? o.qty : {},
        cartons: o.cartons && typeof o.cartons === "object" ? o.cartons : {},
        notes: o.notes && typeof o.notes === "object" ? o.notes : {}
      };
    } catch (e) {
      return emptyDraft();
    }
  }

  function saveDraft(draft) {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(draft || emptyDraft()));
      return true;
    } catch (e) {
      return false;
    }
  }

  function parseNum(v) {
    if (v == null || v === "") return "";
    var n = Number(v);
    if (isNaN(n) || n < 0) return "";
    return Math.floor(n);
  }

  function readFormIntoDraft() {
    var draft = loadDraft();
    var dateEl = $("restockDate");
    var handlerEl = $("restockHandler");
    if (dateEl) draft.date = dateEl.value || todayStr();
    if (handlerEl) draft.handler = handlerEl.value.trim();
    var root = $("restockRoot");
    if (root) {
      root.querySelectorAll(".restock-qty").forEach(function (inp) {
        var code = inp.getAttribute("data-code");
        var n = parseNum(inp.value);
        if (n === "" || n === 0) delete draft.qty[code];
        else draft.qty[code] = n;
      });
      root.querySelectorAll(".restock-ctn").forEach(function (inp) {
        var code = inp.getAttribute("data-code");
        var n = parseNum(inp.value);
        if (n === "" || n === 0) delete draft.cartons[code];
        else draft.cartons[code] = n;
      });
      root.querySelectorAll(".restock-note").forEach(function (inp) {
        var code = inp.getAttribute("data-code");
        var t = String(inp.value || "").trim();
        if (!t) delete draft.notes[code];
        else draft.notes[code] = t;
      });
    }
    return draft;
  }

  function requireHeader(draft) {
    if (!draft.date) {
      statusMsg = "請填日期";
      return false;
    }
    if (!String(draft.handler || "").trim()) {
      statusMsg = "請填經手人，先可以儲存／匯出／列印";
      return false;
    }
    return true;
  }

  function computedPieces(packSize, cartons) {
    var p = Number(packSize);
    var c = Number(cartons);
    if (!p || isNaN(p) || !c || isNaN(c) || c <= 0) return null;
    return Math.floor(p) * Math.floor(c);
  }

  function ensureDrawer() {
    var el = $("restockDrawer");
    if (el) return el;
    el = document.createElement("div");
    el.id = "restockDrawer";
    el.className = "drawer hidden";
    el.setAttribute("role", "dialog");
    el.setAttribute("aria-modal", "true");
    el.innerHTML =
      '<div class="drawer-panel restock-panel">' +
        '<div class="drawer-head">' +
          "<h3>📋 日常補貨表</h3>" +
          '<button type="button" class="btn-ghost" id="btnCloseRestock">關閉</button>' +
        "</div>" +
        '<div id="restockRoot"></div>' +
      "</div>";
    document.body.appendChild(el);
    el.addEventListener("click", function (e) {
      if (e.target === el) closePanel();
    });
    return el;
  }

  function filteredItems() {
    var items = seed().items || [];
    if (!searchQ) return items;
    var q = searchQ.toLowerCase();
    return items.filter(function (it) {
      return (
        String(it.wfCode).toLowerCase().indexOf(q) >= 0 ||
        String(it.appCode || "").toLowerCase().indexOf(q) >= 0 ||
        String(it.name).toLowerCase().indexOf(q) >= 0 ||
        String(it.category).toLowerCase().indexOf(q) >= 0 ||
        String(it.no).indexOf(q) >= 0
      );
    });
  }

  function exportCsv() {
    var draft = readFormIntoDraft();
    if (!requireHeader(draft)) {
      renderPanel();
      return;
    }
    saveDraft(draft);
    var lines = ["no,wfCode,appCode,category,name,packSize,qty_sets_pcs,cartons,computed_pcs,note"];
    function csv(v) {
      var t = String(v == null ? "" : v).replace(/"/g, '""');
      return '"' + t + '"';
    }
    (seed().items || []).forEach(function (it) {
      var code = it.wfCode;
      var q = draft.qty[code];
      var c = draft.cartons[code];
      var note = draft.notes[code] || "";
      var comp = computedPieces(it.packSize, c);
      if (q == null && c == null && !note) {
        /* still export all rows so form is complete */
      }
      lines.push([
        it.no,
        it.wfCode,
        it.appCode || "",
        it.category,
        it.name,
        it.packSize == null ? "" : it.packSize,
        q == null ? "" : q,
        c == null ? "" : c,
        comp == null ? "" : comp,
        note
      ].map(csv).join(","));
    });
    var blob = new Blob(["\ufeff" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    var safeHandler = String(draft.handler).replace(/[\\/:*?"<>|]+/g, "_").trim() || "staff";
    a.download = draft.date + "_" + safeHandler + "_restock.csv";
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
    statusMsg = "已匯出 CSV";
    renderPanel();
  }

  function openPrint() {
    var draft = readFormIntoDraft();
    if (!requireHeader(draft)) {
      renderPanel();
      return;
    }
    saveDraft(draft);
    var s = seed();
    var rowsHtml = "";
    var lastCat = "";
    (s.items || []).forEach(function (it) {
      if (it.category !== lastCat) {
        lastCat = it.category;
        rowsHtml +=
          '<tr class="restock-print-sec"><td colspan="7"><strong>' +
          esc(lastCat) +
          "</strong></td></tr>";
      }
      var code = it.wfCode;
      var q = draft.qty[code];
      var c = draft.cartons[code];
      var note = draft.notes[code] || "";
      var pack = it.packSize == null ? "—" : String(it.packSize);
      rowsHtml +=
        "<tr>" +
          "<td>" + esc(String(it.no)) + "</td>" +
          "<td>" + esc(it.wfCode) + "</td>" +
          "<td>" + esc(it.name) + (note ? '<div class="muted">註：' + esc(note) + "</div>" : "") + "</td>" +
          "<td class='num'>" + esc(pack) + "</td>" +
          "<td class='num'>" + esc(q == null ? "" : String(q)) + "</td>" +
          "<td class='num'>" + esc(c == null ? "" : String(c)) + "</td>" +
          "<td></td>" +
        "</tr>";
    });
    var w = window.open("", "_blank");
    if (!w) {
      statusMsg = "瀏覽器阻擋咗列印視窗，請允許彈出";
      renderPanel();
      return;
    }
    w.document.write(
      "<!DOCTYPE html><html lang='zh-Hant-HK'><head><meta charset='utf-8' />" +
      "<title>" + esc(s.title || "日常補貨表") + "</title>" +
      "<style>" +
      "body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans TC',sans-serif;padding:16px;color:#222;}" +
      "h1{font-size:1.2rem;margin:0 0 4px;} .sub{color:#555;margin:0 0 12px;font-size:.9rem;}" +
      ".meta{margin-bottom:14px;font-size:.95rem;} .meta span{margin-right:18px;}" +
      "table{width:100%;border-collapse:collapse;font-size:11px;}" +
      "th,td{border:1px solid #ccc;padding:4px 6px;vertical-align:top;}" +
      "th{background:#f3e8ff;text-align:left;}" +
      "td.num{text-align:right;font-variant-numeric:tabular-nums;}" +
      ".restock-print-sec td{background:#f7f2ff;border-top:2px solid #7b3fa0;}" +
      ".muted{color:#666;font-size:10px;margin-top:2px;}" +
      "@media print{body{padding:0;} .noprint{display:none;}}" +
      "</style></head><body>" +
      "<h1>" + esc(s.title || "日常補貨表") + "</h1>" +
      "<p class='sub'>" + esc(s.subtitle || "") + "</p>" +
      "<div class='meta'><span><strong>日期：</strong>" + esc(draft.date) +
      "</span><span><strong>經手人：</strong>" + esc(draft.handler) +
      "</span></div>" +
      "<p class='noprint'><button onclick='window.print()'>列印</button> " +
      "<button onclick='window.close()'>關閉</button></p>" +
      "<table><thead><tr>" +
      "<th>No.</th><th>WF Code</th><th>產品</th><th>Pack</th><th>套／件</th><th>箱頭</th><th>簽收</th>" +
      "</tr></thead><tbody>" + rowsHtml + "</tbody></table>" +
      "</body></html>"
    );
    w.document.close();
    statusMsg = "已開列印預覽";
    renderPanel();
  }

  function fillPiecesFromCartons() {
    var draft = readFormIntoDraft();
    var n = 0;
    (seed().items || []).forEach(function (it) {
      var c = draft.cartons[it.wfCode];
      var pcs = computedPieces(it.packSize, c);
      if (pcs != null) {
        draft.qty[it.wfCode] = pcs;
        n++;
      }
    });
    saveDraft(draft);
    statusMsg = n ? ("已用箱數填咗 " + n + " 款件數") : "未有箱頭可換算";
    renderPanel();
  }

  function clearQtys() {
    if (!confirm("清空今日全部補貨數量（套／件、箱頭、備註）？日期同經手人會保留。")) return;
    var draft = readFormIntoDraft();
    draft.qty = {};
    draft.cartons = {};
    draft.notes = {};
    saveDraft(draft);
    statusMsg = "已清空今日數量";
    renderPanel();
  }

  function resetHeader() {
    if (!confirm("重設表頭日期為今日，並清空經手人？數量唔會改。")) return;
    var draft = readFormIntoDraft();
    draft.date = todayStr();
    draft.handler = "";
    saveDraft(draft);
    statusMsg = "已重設表頭";
    renderPanel();
  }

  function persistSoft() {
    var draft = readFormIntoDraft();
    saveDraft(draft);
  }

  function renderPanel() {
    ensureDrawer();
    var root = $("restockRoot");
    if (!root) return;
    if (!isAdmin()) {
      root.innerHTML = '<p class="muted">請先職員登入後先可以填補貨表。</p>';
      return;
    }
    var s = seed();
    var draft = loadDraft();
    var items = filteredItems();
    var html =
      '<p class="restock-title"><strong>' + esc(s.title || "日常補貨表") + "</strong>" +
      '<span class="muted"> · ' + esc(s.subtitle || "") + "</span></p>" +
      '<p class="stock-meta muted">版本 ' + esc(s.version || "") +
      " · 共 " + esc(String((s.items || []).length)) + " 款 · 草稿存本機</p>" +
      '<div class="restock-header-fields">' +
        '<label class="field">日期' +
          '<input type="date" id="restockDate" value="' + esc(draft.date) + '" required />' +
        "</label>" +
        '<label class="field">經手人' +
          '<input type="text" id="restockHandler" value="' + esc(draft.handler) + '" placeholder="姓名／工號" required autocomplete="name" />' +
        "</label>" +
      "</div>" +
      '<div class="stock-toolbar">' +
        '<label class="pc-search stock-search">' +
          '<span class="pc-search-ico" aria-hidden="true">🔍</span>' +
          '<input type="search" id="restockSearch" placeholder="搜編號／名稱／分類" value="' + esc(searchQ) + '" />' +
        "</label>" +
        '<div class="btn-row stock-actions restock-actions">' +
          '<button type="button" class="primary" id="btnRestockSave">儲存本機</button>' +
          '<button type="button" class="btn-ghost" id="btnRestockExport">匯出 CSV</button>' +
          '<button type="button" class="btn-ghost" id="btnRestockPrint">列印／預覽</button>' +
          '<button type="button" class="btn-ghost" id="btnRestockFillPcs">用箱數填件數</button>' +
          '<button type="button" class="btn-ghost" id="btnRestockClear">清空今日數量</button>' +
          '<button type="button" class="btn-ghost" id="btnRestockResetHead">重設表頭</button>' +
        "</div>" +
      "</div>" +
      (statusMsg ? '<p class="restock-status" role="status">' + esc(statusMsg) + "</p>" : "") +
      '<div class="restock-ref muted">' +
        '紙本參考：' +
        '<a href="assets/img/restock/restock-p1.jpg?v=20261105d" target="_blank" rel="noopener">P1</a> · ' +
        '<a href="assets/img/restock/restock-p2.jpg?v=20261105d" target="_blank" rel="noopener">P2</a> · ' +
        '<a href="assets/img/restock/restock-p3.jpg?v=20261105d" target="_blank" rel="noopener">P3</a>' +
      "</div>" +
      '<div class="stock-table-wrap restock-table-wrap">' +
        '<table class="stock-table restock-table">' +
          "<thead><tr>" +
            "<th>No.</th><th>WF／產品</th><th>Pack</th><th>套／件</th><th>箱頭</th>" +
          "</tr></thead><tbody>";

    if (!items.length) {
      html += '<tr><td colspan="5" class="muted">搵唔到</td></tr>';
    } else {
      var lastCat = null;
      items.forEach(function (it) {
        if (it.category !== lastCat) {
          lastCat = it.category;
          html +=
            '<tr class="restock-sec"><td colspan="5"><strong>' +
            esc(lastCat) +
            "</strong></td></tr>";
        }
        var code = it.wfCode;
        var q = draft.qty[code];
        var c = draft.cartons[code];
        var note = draft.notes[code] || "";
        var pack = it.packSize == null ? "—" : String(it.packSize);
        var comp = computedPieces(it.packSize, c);
        html +=
          '<tr class="restock-row" data-code="' + esc(code) + '">' +
            '<td class="num">' + esc(String(it.no)) + "</td>" +
            "<td><code>" + esc(code) + "</code>" +
              (it.appCode ? '<span class="stock-wf muted"> → ' + esc(it.appCode) + "</span>" : "") +
              "<div><strong>" + esc(it.name) + "</strong></div>" +
              (it.needsNote
                ? '<input class="restock-note" type="text" data-code="' + esc(code) +
                  '" placeholder="請註明" value="' + esc(note) + '" />'
                : "") +
              (comp != null
                ? '<div class="restock-hint muted">箱×Pack ≈ ' + esc(String(comp)) + " 件</div>"
                : "") +
            "</td>" +
            '<td class="num">' + esc(pack) + "</td>" +
            '<td><input class="restock-qty stock-edit" type="number" min="0" step="1" inputmode="numeric" ' +
              'data-code="' + esc(code) + '" value="' + esc(q == null ? "" : String(q)) +
              '" aria-label="補貨套或件" /></td>' +
            '<td><input class="restock-ctn stock-edit" type="number" min="0" step="1" inputmode="numeric" ' +
              'data-code="' + esc(code) + '" value="' + esc(c == null ? "" : String(c)) +
              '" aria-label="補貨箱頭" /></td>' +
          "</tr>";
      });
    }
    html += "</tbody></table></div>";
    root.innerHTML = html;

    var search = $("restockSearch");
    if (search) {
      search.addEventListener("input", function () {
        persistSoft();
        searchQ = search.value.trim();
        var pos = search.selectionStart;
        statusMsg = "";
        renderPanel();
        var again = $("restockSearch");
        if (again) {
          again.focus();
          try { again.setSelectionRange(pos, pos); } catch (e) {}
        }
      });
    }

    ["restockDate", "restockHandler"].forEach(function (id) {
      var el = $(id);
      if (!el) return;
      el.addEventListener("change", function () {
        persistSoft();
      });
      el.addEventListener("blur", function () {
        persistSoft();
      });
    });

    root.querySelectorAll(".restock-qty, .restock-ctn, .restock-note").forEach(function (inp) {
      inp.addEventListener("change", function () {
        persistSoft();
        if (inp.classList.contains("restock-ctn")) {
          statusMsg = "";
          renderPanel();
          var again = root.querySelector('.restock-ctn[data-code="' + inp.getAttribute("data-code") + '"]');
          if (again) again.focus();
        }
      });
    });

    var btnSave = $("btnRestockSave");
    if (btnSave) {
      btnSave.addEventListener("click", function () {
        var draft = readFormIntoDraft();
        if (!requireHeader(draft)) {
          renderPanel();
          return;
        }
        if (saveDraft(draft)) statusMsg = "已儲存本機草稿";
        else statusMsg = "儲存失敗（可能係私人模式）";
        renderPanel();
      });
    }
    var btnExport = $("btnRestockExport");
    if (btnExport) btnExport.addEventListener("click", exportCsv);
    var btnPrint = $("btnRestockPrint");
    if (btnPrint) btnPrint.addEventListener("click", openPrint);
    var btnFill = $("btnRestockFillPcs");
    if (btnFill) btnFill.addEventListener("click", fillPiecesFromCartons);
    var btnClear = $("btnRestockClear");
    if (btnClear) btnClear.addEventListener("click", clearQtys);
    var btnReset = $("btnRestockResetHead");
    if (btnReset) btnReset.addEventListener("click", resetHeader);
  }

  function openPanel() {
    if (!isAdmin()) {
      if (window.BPE_Shell && window.BPE_Shell.openLogin) window.BPE_Shell.openLogin();
      return;
    }
    statusMsg = "";
    var d = ensureDrawer();
    d.classList.remove("hidden");
    renderPanel();
  }

  function closePanel() {
    try { persistSoft(); } catch (e) {}
    var d = $("restockDrawer");
    if (d) d.classList.add("hidden");
  }

  function bindOnce() {
    if (document._restockUiBound) return;
    document._restockUiBound = true;
    document.addEventListener("click", function (e) {
      if (e.target && e.target.id === "btnCloseRestock") closePanel();
    });
  }

  bindOnce();

  window.BPE_Restock = {
    openPanel: openPanel,
    closePanel: closePanel,
    renderPanel: renderPanel,
    loadDraft: loadDraft,
    saveDraft: saveDraft
  };
})();
