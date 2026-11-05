/* 庫存：總預貨量 seed（第一次落貨）+ localStorage 剩餘；職員可改剩餘／加產品；結算扣數／重設／匯出 */
(function () {
  "use strict";

  var LS_KEY = "zihua_bpe_stock_remaining_v1";
  var LS_EXTRA = "zihua_bpe_stock_extra_v1";
  var searchQ = "";
  var showAddForm = false;

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

  function loadExtras() {
    try {
      var raw = localStorage.getItem(LS_EXTRA);
      if (!raw) return [];
      var o = JSON.parse(raw);
      if (!o || !Array.isArray(o.items)) return [];
      return o.items.filter(function (it) {
        return it && it.code && String(it.code).trim();
      }).map(function (it) {
        var code = String(it.code).trim().toUpperCase();
        var qty = Math.max(0, Math.floor(Number(it.qty) || 0));
        var price = it.price == null || it.price === "" ? null : Number(it.price);
        if (price != null && isNaN(price)) price = null;
        return {
          code: code,
          wfCode: it.wfCode ? String(it.wfCode).trim() : "",
          xCode: it.xCode ? String(it.xCode).trim() : (it.wfCode ? String(it.wfCode).trim() : code),
          name: String(it.name || code).trim() || code,
          category: String(it.category || "職員加貨").trim() || "職員加貨",
          unit: String(it.unit || "件").trim() || "件",
          qty: qty,
          price: price,
          custom: true
        };
      });
    } catch (e) {
      return [];
    }
  }

  function saveExtras(items) {
    try {
      localStorage.setItem(LS_EXTRA, JSON.stringify({ items: items || [] }));
    } catch (e) { /* private mode */ }
  }

  function allItems() {
    var base = (seed().items || []).map(function (it) {
      return {
        code: it.code,
        wfCode: it.wfCode || "",
        xCode: xCodeOf(it),
        name: it.name || "",
        category: it.category || "",
        unit: it.unit || "件",
        qty: Math.max(0, Math.floor(Number(it.qty) || 0)),
        price: null,
        custom: false
      };
    });
    var extras = loadExtras();
    var seen = {};
    base.forEach(function (it) { seen[it.code] = true; });
    extras.forEach(function (it) {
      if (!seen[it.code]) {
        base.push(it);
        seen[it.code] = true;
      }
    });
    return base;
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
    loadExtras().forEach(function (it) {
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

  function canonicalCode(code) {
    var c = String(code || "").trim();
    if (!c) return "";
    var aliases = seed().aliases || {};
    if (aliases[c]) return aliases[c];
    var items = seed().items || [];
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      if (it.code === c) return it.code;
      if (it.wfCode && it.wfCode === c) return it.code;
      if (it.xCode && it.xCode === c) return it.code;
    }
    var extras = loadExtras();
    var cu = c.toUpperCase();
    for (var j = 0; j < extras.length; j++) {
      var ex = extras[j];
      if (ex.code === cu || ex.code === c) return ex.code;
      if (ex.wfCode && (ex.wfCode === c || ex.wfCode === cu)) return ex.code;
      if (ex.xCode && (ex.xCode === c || ex.xCode === cu)) return ex.code;
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
    loadExtras().forEach(function (it) {
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
        allItems().forEach(function (it) {
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
    // 職員加貨（extra）保留；只清剩餘覆寫。加貨本身嘅總預以 extra.qty 為準。
  }

  function listAll() {
    return allItems().map(function (it) {
      var rem = getQty(it.code);
      var seedQ = Math.max(0, Math.floor(Number(it.qty) || 0));
      var remaining = rem == null ? 0 : rem;
      return {
        code: it.code,
        wfCode: it.wfCode || "",
        xCode: it.xCode || xCodeOf(it) || it.code,
        name: it.name || "",
        category: it.category || "",
        unit: it.unit || "件",
        seed: seedQ,
        remaining: remaining,
        sold: Math.max(0, seedQ - remaining),
        custom: !!it.custom,
        price: it.price
      };
    });
  }

  function listOrderExtras() {
    return loadExtras().map(function (it) {
      return {
        code: it.code,
        name: it.name,
        unit: it.unit || "件",
        special: it.price,
        orig: it.price,
        custom: true
      };
    });
  }

  function addProduct(fields) {
    var code = String((fields && fields.code) || "").trim().toUpperCase();
    var name = String((fields && fields.name) || "").trim();
    var qty = Math.max(0, Math.floor(Number((fields && fields.qty) != null ? fields.qty : 0) || 0));
    var category = String((fields && fields.category) || "職員加貨").trim() || "職員加貨";
    var unit = String((fields && fields.unit) || "件").trim() || "件";
    var xCode = String((fields && fields.xCode) || code).trim() || code;
    var priceRaw = fields && fields.price;
    var price = priceRaw == null || priceRaw === "" ? null : Number(priceRaw);
    if (price != null && (isNaN(price) || price < 0)) price = null;
    if (!code) return { ok: false, error: "請填入機代號" };
    if (!/^[A-Z0-9][A-Z0-9\-_]{0,24}$/.test(code)) {
      return { ok: false, error: "代號只可用英數、短劃、底線（最多 25 字）" };
    }
    if (!name) return { ok: false, error: "請填產品名稱" };
    var exists = false;
    allItems().forEach(function (it) {
      if (String(it.code).toUpperCase() === code) exists = true;
      if (it.xCode && String(it.xCode).toUpperCase() === code) exists = true;
      if (it.wfCode && String(it.wfCode).toUpperCase() === code) exists = true;
    });
    if (exists) return { ok: false, error: "代號已存在：" + code };
    var list = loadExtras();
    list.push({
      code: code,
      xCode: xCode,
      wfCode: xCode !== code ? xCode : "",
      name: name,
      category: category,
      unit: unit,
      qty: qty,
      price: price,
      custom: true
    });
    saveExtras(list);
    setQty(code, qty);
    return { ok: true, code: code };
  }

  function removeProduct(code) {
    var c = String(code || "").trim().toUpperCase();
    if (!c) return false;
    var list = loadExtras().filter(function (it) { return it.code !== c; });
    saveExtras(list);
    var ov = loadOverrides();
    relatedKeys(c).forEach(function (k) { delete ov[k]; });
    delete ov[c];
    saveOverrides(ov);
    return true;
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
          "<h3>📦 存貨表 · 庫存</h3>" +
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
    var lines = ["code,xCode,wfCode,category,name,unit,seed_first_drop,sold,remaining,custom"];
    rows.forEach(function (r) {
      function csv(v) {
        var t = String(v == null ? "" : v).replace(/"/g, '""');
        return '"' + t + '"';
      }
      lines.push([r.code, r.xCode, r.wfCode, r.category, r.name, r.unit, r.seed, r.sold, r.remaining, r.custom ? "1" : "0"].map(csv).join(","));
    });
    var blob = new Blob(["\ufeff" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "zihua-bpe-stock-" + (seed().asOf || "export") + ".csv";
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
  }

  function refreshOrderUi() {
    if (window.BPE_DimsumOrderUI && window.BPE_DimsumOrderUI.render) {
      window.BPE_DimsumOrderUI.render();
    }
  }

  function renderPanel() {
    ensureDrawer();
    var root = $("stockRoot");
    if (!root) return;
    if (!isAdmin()) {
      root.innerHTML = '<p class="muted">請先職員登入後先可以改存貨表／庫存。</p>';
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
    var extraCount = loadExtras().length;
    var html =
      '<p class="stock-meta"><strong>喺呢度更新存貨表</strong>：改「剩餘」即改現場庫存；撳「加產品」可加新款。總預＝第一次落貨／加貨量；剩餘存本機；結算會減售出。</p>' +
      '<p class="stock-meta muted">來源：' + esc(s.source || "") +
      " · 版本 " + esc(s.version || "") +
      " · 截至 " + esc(s.asOf || "") +
      " · 共 " + esc(String(rows.length)) + " 款顯示" +
      (extraCount ? ("（含職員加貨 " + extraCount + "）") : "") +
      "</p>" +
      '<div class="stock-toolbar">' +
        '<label class="pc-search stock-search">' +
          '<span class="pc-search-ico" aria-hidden="true">🔍</span>' +
          '<input type="search" id="stockSearch" placeholder="搜入機代號／名稱／分類" value="' + esc(searchQ) + '" />' +
        "</label>" +
        '<div class="btn-row stock-actions">' +
          '<button type="button" class="primary" id="btnStockAddToggle">' +
            (showAddForm ? "收起加產品" : "＋ 加產品") +
          "</button>" +
          '<button type="button" class="btn-ghost" id="btnStockExport">匯出 CSV</button>' +
          '<button type="button" class="btn-ghost" id="btnStockReset">重設剩餘為總預</button>' +
        "</div>" +
      "</div>";
    if (showAddForm) {
      html +=
        '<form class="stock-add-form" id="stockAddForm">' +
          '<p class="stock-add-title">加新產品到存貨表</p>' +
          '<div class="stock-add-grid">' +
            '<label class="field">入機代號<input id="stockAddCode" name="code" type="text" required placeholder="例如 NEW01" autocomplete="off" /></label>' +
            '<label class="field">產品名稱<input id="stockAddName" name="name" type="text" required placeholder="產品中文名" /></label>' +
            '<label class="field">總預／數量<input id="stockAddQty" name="qty" type="number" min="0" step="1" inputmode="numeric" value="0" required /></label>' +
            '<label class="field">分類<input id="stockAddCat" name="category" type="text" placeholder="職員加貨" value="職員加貨" /></label>' +
            '<label class="field">單位<input id="stockAddUnit" name="unit" type="text" placeholder="件" value="件" /></label>' +
            '<label class="field">售價（選填）<input id="stockAddPrice" name="price" type="number" min="0" step="0.1" inputmode="decimal" placeholder="出現喺產品計數" /></label>' +
          "</div>" +
          '<p class="muted stock-add-hint">加咗會存本機；有填售價會出現喺「產品計數 → 職員加貨」。未寫入 seed 檔前，清瀏覽器資料會冇。</p>' +
          '<div class="btn-row">' +
            '<button type="submit" class="primary">確認加貨</button>' +
            '<button type="button" class="btn-ghost" id="btnStockAddCancel">取消</button>' +
          "</div>" +
          '<p id="stockAddMsg" class="admin-msg hidden" role="status"></p>' +
        "</form>";
    }
    html +=
      '<div class="stock-table-wrap">' +
        '<table class="stock-table">' +
          '<thead><tr>' +
            '<th title="X＝入機代號">X／入機代號</th>' +
            "<th>產品</th><th>總預</th><th>已售</th><th>剩餘</th><th>改剩餘</th>" +
          "</tr></thead>" +
          "<tbody>";
    if (!rows.length) {
      html += '<tr><td colspan="6" class="muted">搵唔到</td></tr>';
    } else {
      rows.forEach(function (r) {
        var low = r.remaining <= 0 ? " stock-row-out" : (r.remaining <= 12 ? " stock-row-low" : "");
        html +=
          '<tr class="stock-row' + low + (r.custom ? " stock-row-custom" : "") + '" data-code="' + esc(r.code) + '">' +
            "<td><code title=\"X＝入機代號\">" + esc(r.xCode || r.code) + "</code>" +
              (r.code && r.xCode && r.code !== r.xCode
                ? '<div class="stock-wf muted">app ' + esc(r.code) + "</div>"
                : "") +
              (r.custom ? '<div class="stock-custom-tag">職員加</div>' : "") +
            "</td>" +
            "<td><strong>" + esc(r.name) + "</strong>" +
              '<div class="muted stock-cat">' + esc(r.category) + " · " + esc(r.unit) +
              (r.price != null ? (" · $" + esc(String(r.price))) : "") +
              "</div>" +
              (r.custom
                ? ('<button type="button" class="stock-del" data-del-code="' + esc(r.code) + '">刪除加貨</button>')
                : "") +
            "</td>" +
            '<td class="num" title="第一次落貨／總預貨">' + esc(String(r.seed)) + "</td>" +
            '<td class="num">' + esc(String(r.sold)) + "</td>" +
            '<td class="num stock-rem">' + esc(String(r.remaining)) + "</td>" +
            '<td><input class="stock-edit" type="number" min="0" step="1" inputmode="numeric" ' +
              'data-code="' + esc(r.code) + '" value="' + esc(String(r.remaining)) + '" aria-label="剩餘庫存 ' + esc(r.name) + '" /></td>' +
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
        if (!confirm("將全部剩餘重設為總預貨量（第一次落貨／加貨量）？本機剩餘改動會清除；職員加貨產品會保留。")) return;
        resetToSeed();
        renderPanel();
        refreshOrderUi();
      });
    }
    var btnAddToggle = $("btnStockAddToggle");
    if (btnAddToggle) {
      btnAddToggle.addEventListener("click", function () {
        showAddForm = !showAddForm;
        renderPanel();
        if (showAddForm) {
          var codeInp = $("stockAddCode");
          if (codeInp) codeInp.focus();
        }
      });
    }
    var btnAddCancel = $("btnStockAddCancel");
    if (btnAddCancel) {
      btnAddCancel.addEventListener("click", function () {
        showAddForm = false;
        renderPanel();
      });
    }
    var addForm = $("stockAddForm");
    if (addForm) {
      addForm.addEventListener("submit", function (e) {
        e.preventDefault();
        var msg = $("stockAddMsg");
        var res = addProduct({
          code: ($("stockAddCode") || {}).value,
          name: ($("stockAddName") || {}).value,
          qty: ($("stockAddQty") || {}).value,
          category: ($("stockAddCat") || {}).value,
          unit: ($("stockAddUnit") || {}).value,
          price: ($("stockAddPrice") || {}).value
        });
        if (!res.ok) {
          if (msg) {
            msg.textContent = res.error || "加貨失敗";
            msg.classList.remove("hidden");
          }
          return;
        }
        showAddForm = false;
        searchQ = res.code || "";
        renderPanel();
        refreshOrderUi();
      });
    }
    root.querySelectorAll(".stock-del").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var code = btn.getAttribute("data-del-code");
        if (!code) return;
        if (!confirm("刪除職員加貨「" + code + "」？剩餘覆寫一併清除。")) return;
        removeProduct(code);
        renderPanel();
        refreshOrderUi();
      });
    });
    root.querySelectorAll(".stock-edit").forEach(function (inp) {
      inp.addEventListener("change", function () {
        var code = inp.getAttribute("data-code");
        setQty(code, inp.value);
        renderPanel();
        refreshOrderUi();
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
    listOrderExtras: listOrderExtras,
    addProduct: addProduct,
    removeProduct: removeProduct,
    stockBadgeHtml: stockBadgeHtml,
    openPanel: openPanel,
    closePanel: closePanel,
    renderPanel: renderPanel,
    canonicalCode: canonicalCode,
    xCodeOf: xCodeOf
  };
})();
