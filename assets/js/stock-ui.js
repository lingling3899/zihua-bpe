/* 庫存：總預貨量 seed（第一次落貨）+ localStorage 剩餘；結算扣數／職員可改／重設／匯出 */
(function () {
  "use strict";

  var LS_KEY = "zihua_bpe_stock_remaining_v1";
  var searchQ = "";

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
  function seed() {
    return window.BPE_STOCK_SEED || { version: "", aliases: {}, items: [] };
  }
  function isAdmin() {
    var a = window.ZihuaAdminAuth;
    return !!(a && a.isLoggedIn && a.isLoggedIn());
  }

  /** X／入機代號：優先 xCode，其次 wfCode，再係 app code */
  function xCodeOf(it) {
    if (!it) return "";
    if (it.xCode) return String(it.xCode);
    if (it.wfCode) return String(it.wfCode);
    return String(it.code || "");
  }

  function buildSeedQtyMap() {
    var s = seed();
    var map = {};
    (s.items || []).forEach(function (it) {
      if (!it || !it.code) return;
      var q = Math.max(0, Math.floor(Number(it.qty) || 0));
      map[it.code] = q;
      if (it.wfCode) map[it.wfCode] = q;
      if (it.xCode) map[it.xCode] = q;
    });
    var aliases = s.aliases || {};
    Object.keys(aliases).forEach(function (wf) {
      var app = aliases[wf];
      if (map[app] != null) map[wf] = map[app];
    });
    return map;
  }

  function loadOverrides() {
    try {
      var raw = localStorage.getItem(LS_KEY);
      if (!raw) return {};
      var o = JSON.parse(raw);
      if (!o || typeof o !== "object") return {};
      var out = {};
      Object.keys(o).forEach(function (k) {
        var n = Number(o[k]);
        if (!isNaN(n) && n >= 0) out[k] = Math.floor(n);
      });
      return out;
    } catch (e) {
      return {};
    }
  }

  function saveOverrides(map) {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(map || {}));
    } catch (e) { /* private mode */ }
  }

  function canonicalCode(code) {
    var c = String(code || "").trim();
    if (!c) return "";
    var aliases = seed().aliases || {};
    if (aliases[c]) return aliases[c];
    // match by xCode / wfCode
    var items = seed().items || [];
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      if (it.code === c) return it.code;
      if (it.wfCode && it.wfCode === c) return it.code;
      if (it.xCode && it.xCode === c) return it.code;
    }
    return c;
  }

  function relatedKeys(code) {
    var c = canonicalCode(code);
    var keys = [c];
    var aliases = seed().aliases || {};
    Object.keys(aliases).forEach(function (wf) {
      if (aliases[wf] === c) keys.push(wf);
    });
    (seed().items || []).forEach(function (it) {
      if (it.code === c) {
        if (it.wfCode) keys.push(it.wfCode);
        if (it.xCode) keys.push(it.xCode);
      }
    });
    var seen = {};
    return keys.filter(function (k) {
      if (!k || seen[k]) return false;
      seen[k] = true;
      return true;
    });
  }

  function getQty(code) {
    var c = canonicalCode(code);
    if (!c) return null;
    var ov = loadOverrides();
    var keys = relatedKeys(c);
    for (var i = 0; i < keys.length; i++) {
      if (Object.prototype.hasOwnProperty.call(ov, keys[i])) {
        return Math.max(0, Math.floor(Number(ov[keys[i]]) || 0));
      }
    }
    var seedMap = buildSeedQtyMap();
    for (var j = 0; j < keys.length; j++) {
      if (seedMap[keys[j]] != null) return seedMap[keys[j]];
    }
    if (seedMap[code] != null) return seedMap[code];
    return null;
  }

  function getSeedQty(code) {
    var c = canonicalCode(code);
    var seedMap = buildSeedQtyMap();
    var keys = relatedKeys(c);
    for (var j = 0; j < keys.length; j++) {
      if (seedMap[keys[j]] != null) return seedMap[keys[j]];
    }
    return seedMap[code] != null ? seedMap[code] : null;
  }

  function setQty(code, n) {
    var c = canonicalCode(code);
    if (!c) return false;
    var qty = Math.max(0, Math.floor(Number(n) || 0));
    var ov = loadOverrides();
    var seedMap = buildSeedQtyMap();
    var keys = relatedKeys(c);
    keys.forEach(function (k) {
      if (k !== c) delete ov[k];
    });
    var seedQ = seedMap[c];
    if (seedQ != null && qty === seedQ) {
      delete ov[c];
    } else {
      ov[c] = qty;
    }
    saveOverrides(ov);
    return true;
  }

  function addQty(code, delta) {
    var c = canonicalCode(code);
    if (!c) return false;
    var d = Math.floor(Number(delta) || 0);
    if (!d) return true;
    var cur = getQty(c);
    if (cur == null) cur = 0;
    return setQty(c, Math.max(0, cur + d));
  }

  /**
   * demandMap: { code: qtyNeeded }
   * returns { ok, shorts: [{code, need, have, name}] }
   */
  function canFulfill(demandMap) {
    var shorts = [];
    var map = demandMap || {};
    Object.keys(map).forEach(function (code) {
      var need = Math.max(0, Math.floor(Number(map[code]) || 0));
      if (need <= 0) return;
      var have = getQty(code);
      if (have == null) {
        // unknown SKU — allow but note as unlimited; skip block
        return;
      }
      if (have < need) {
        var name = "";
        (seed().items || []).forEach(function (it) {
          if (canonicalCode(it.code) === canonicalCode(code)) name = it.name || "";
        });
        shorts.push({
          code: canonicalCode(code) || code,
          need: need,
          have: have,
          name: name
        });
      }
    });
    return { ok: shorts.length === 0, shorts: shorts };
  }

  /** Deduct quantities; returns { ok, shorts } — does nothing if short */
  function deduct(demandMap) {
    var check = canFulfill(demandMap);
    if (!check.ok) return check;
    var map = demandMap || {};
    Object.keys(map).forEach(function (code) {
      var need = Math.max(0, Math.floor(Number(map[code]) || 0));
      if (need <= 0) return;
      var have = getQty(code);
      if (have == null) return;
      setQty(code, Math.max(0, have - need));
    });
    return { ok: true, shorts: [] };
  }

  function resetToSeed() {
    try { localStorage.removeItem(LS_KEY); } catch (e) {}
  }

  function listAll() {
    var s = seed();
    return (s.items || []).map(function (it) {
      var rem = getQty(it.code);
      var seedQ = Math.max(0, Math.floor(Number(it.qty) || 0));
      var remaining = rem == null ? 0 : rem;
      return {
        code: it.code,
        wfCode: it.wfCode || "",
        xCode: xCodeOf(it),
        name: it.name || "",
        category: it.category || "",
        unit: it.unit || "件",
        seed: seedQ,
        remaining: remaining,
        sold: Math.max(0, seedQ - remaining)
      };
    });
  }

  function stockBadgeHtml(code) {
    var q = getQty(code);
    if (q == null) return "";
    if (q <= 0) {
      return '<span class="stock-badge stock-out" title="總預貨量剩餘">暫無貨</span>';
    }
    var cls = q <= 12 ? " stock-low" : "";
    return '<span class="stock-badge' + cls + '" title="總預貨量剩餘">庫存 ' + esc(String(q)) + "</span>";
  }

  function ensureDrawer() {
    var el = $("stockDrawer");
    if (el) return el;
    el = document.createElement("div");
    el.id = "stockDrawer";
    el.className = "drawer hidden";
    el.setAttribute("role", "dialog");
    el.setAttribute("aria-modal", "true");
    el.innerHTML =
      '<div class="drawer-panel stock-panel">' +
        '<div class="drawer-head">' +
          "<h3>📦 庫存 · 總預貨量</h3>" +
          '<button type="button" class="btn-ghost" id="btnCloseStock">關閉</button>' +
        "</div>" +
        '<div id="stockRoot"></div>' +
      "</div>";
    document.body.appendChild(el);
    el.addEventListener("click", function (e) {
      if (e.target === el) closePanel();
    });
    return el;
  }

  function exportCsv() {
    var rows = listAll();
    var lines = ["code,xCode,wfCode,category,name,unit,seed_first_drop,sold,remaining"];
    rows.forEach(function (r) {
      function csv(v) {
        var t = String(v == null ? "" : v).replace(/"/g, '""');
        return '"' + t + '"';
      }
      lines.push([r.code, r.xCode, r.wfCode, r.category, r.name, r.unit, r.seed, r.sold, r.remaining].map(csv).join(","));
    });
    var blob = new Blob(["\ufeff" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "zihua-bpe-stock-" + (seed().asOf || "export") + ".csv";
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
  }

  function renderPanel() {
    ensureDrawer();
    var root = $("stockRoot");
    if (!root) return;
    if (!isAdmin()) {
      root.innerHTML = '<p class="muted">請先職員登入後先可以改庫存。</p>';
      return;
    }
    var s = seed();
    var rows = listAll().filter(function (r) {
      if (!searchQ) return true;
      var q = searchQ.toLowerCase();
      return (
        String(r.code).toLowerCase().indexOf(q) >= 0 ||
        String(r.xCode).toLowerCase().indexOf(q) >= 0 ||
        String(r.wfCode).toLowerCase().indexOf(q) >= 0 ||
        String(r.name).toLowerCase().indexOf(q) >= 0 ||
        String(r.category).toLowerCase().indexOf(q) >= 0
      );
    });
    var html =
      '<p class="stock-meta muted">來源：' + esc(s.source || "") +
      " · 版本 " + esc(s.version || "") +
      " · 截至 " + esc(s.asOf || "") +
      " · 共 " + esc(String((s.items || []).length)) + " 款" +
      " · 總預＝第一次落貨；剩餘存本機；結算會減售出</p>" +
      '<div class="stock-toolbar">' +
        '<label class="pc-search stock-search">' +
          '<span class="pc-search-ico" aria-hidden="true">🔍</span>' +
          '<input type="search" id="stockSearch" placeholder="搜入機代號／名稱／分類" value="' + esc(searchQ) + '" />' +
        "</label>" +
        '<div class="btn-row stock-actions">' +
          '<button type="button" class="btn-ghost" id="btnStockExport">匯出 CSV</button>' +
          '<button type="button" class="btn-ghost" id="btnStockReset">重設為總預貨量</button>' +
        "</div>" +
      "</div>" +
      '<div class="stock-table-wrap">' +
        '<table class="stock-table">' +
          '<thead><tr>' +
            '<th title="X＝入機代號">X／入機代號</th>' +
            "<th>產品</th><th>總預</th><th>已售</th><th>剩餘</th><th>改</th>" +
          "</tr></thead>" +
          "<tbody>";
    if (!rows.length) {
      html += '<tr><td colspan="6" class="muted">搵唔到</td></tr>';
    } else {
      rows.forEach(function (r) {
        var low = r.remaining <= 0 ? " stock-row-out" : (r.remaining <= 12 ? " stock-row-low" : "");
        html +=
          '<tr class="stock-row' + low + '" data-code="' + esc(r.code) + '">' +
            "<td><code title=\"X＝入機代號\">" + esc(r.xCode || r.code) + "</code>" +
              (r.code && r.xCode && r.code !== r.xCode
                ? '<div class="stock-wf muted">app ' + esc(r.code) + "</div>"
                : "") +
            "</td>" +
            "<td><strong>" + esc(r.name) + "</strong>" +
              '<div class="muted stock-cat">' + esc(r.category) + " · " + esc(r.unit) + "</div></td>" +
            '<td class="num" title="第一次落貨／總預貨">' + esc(String(r.seed)) + "</td>" +
            '<td class="num">' + esc(String(r.sold)) + "</td>" +
            '<td class="num stock-rem">' + esc(String(r.remaining)) + "</td>" +
            '<td><input class="stock-edit" type="number" min="0" step="1" inputmode="numeric" ' +
              'data-code="' + esc(r.code) + '" value="' + esc(String(r.remaining)) + '" aria-label="剩餘庫存" /></td>' +
          "</tr>";
      });
    }
    html += "</tbody></table></div>";
    root.innerHTML = html;

    var search = $("stockSearch");
    if (search) {
      search.addEventListener("input", function () {
        searchQ = search.value.trim();
        var pos = search.selectionStart;
        renderPanel();
        var again = $("stockSearch");
        if (again) {
          again.focus();
          try { again.setSelectionRange(pos, pos); } catch (e) {}
        }
      });
    }
    var btnExport = $("btnStockExport");
    if (btnExport) btnExport.addEventListener("click", exportCsv);
    var btnReset = $("btnStockReset");
    if (btnReset) {
      btnReset.addEventListener("click", function () {
        if (!confirm("將全部剩餘重設為總預貨量（第一次落貨）seed？本機改動會清除。")) return;
        resetToSeed();
        renderPanel();
        if (window.BPE_DimsumOrderUI && window.BPE_DimsumOrderUI.render) {
          window.BPE_DimsumOrderUI.render();
        }
      });
    }
    root.querySelectorAll(".stock-edit").forEach(function (inp) {
      inp.addEventListener("change", function () {
        var code = inp.getAttribute("data-code");
        setQty(code, inp.value);
        renderPanel();
        if (window.BPE_DimsumOrderUI && window.BPE_DimsumOrderUI.render) {
          window.BPE_DimsumOrderUI.render();
        }
      });
    });
  }

  function openPanel() {
    if (!isAdmin()) {
      if (window.BPE_Shell && window.BPE_Shell.openLogin) window.BPE_Shell.openLogin();
      return;
    }
    var d = ensureDrawer();
    d.classList.remove("hidden");
    renderPanel();
  }

  function closePanel() {
    var d = $("stockDrawer");
    if (d) d.classList.add("hidden");
  }

  function bindOnce() {
    if (document._stockUiBound) return;
    document._stockUiBound = true;
    document.addEventListener("click", function (e) {
      if (e.target && e.target.id === "btnCloseStock") {
        closePanel();
      }
    });
  }

  bindOnce();

  window.BPE_Stock = {
    getQty: getQty,
    getSeedQty: getSeedQty,
    setQty: setQty,
    addQty: addQty,
    deduct: deduct,
    canFulfill: canFulfill,
    resetToSeed: resetToSeed,
    listAll: listAll,
    stockBadgeHtml: stockBadgeHtml,
    openPanel: openPanel,
    closePanel: closePanel,
    renderPanel: renderPanel,
    canonicalCode: canonicalCode,
    xCodeOf: xCodeOf
  };
})();
