/* 庫存：總預＝未到場計劃量（上限）；補貨＝已到場；售出＝結算累積；剩餘＝補貨−售出（真正到場先可賣）；試機模式剩餘＝總預−售出（唔寫假補貨）；補貨不可超過總預；qtyUnknown 未填剩餘唔擋結算 */
(function () {
  "use strict";

  var LS_KEY = "zihua_bpe_stock_remaining_v1";
  var LS_EXTRA = "zihua_bpe_stock_extra_v1";
  var LS_ISSUED = "zihua_bpe_stock_issued_v1";
  var LS_RESTOCK = "zihua_bpe_stock_restock_v1";
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
    return isAdmin();
  }

  function isTrialOn() {
    return !!(window.BPE_TrialMode && window.BPE_TrialMode.isOn && window.BPE_TrialMode.isOn());
  }

  /** Effective arrived qty used for remaining. Trial: known 總預 counts as arrived (does not write restock). */
  function arrivedBase(code) {
    if (isQtyUnknownItem(code)) return null;
    if (isTrialOn()) {
      var seedQ = getSeedQty(code);
      if (seedQ != null) return Math.max(0, seedQ);
    }
    return getRestock(code);
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


  function loadIssued() {
    try {
      var raw = localStorage.getItem(LS_ISSUED);
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

  function saveIssued(map) {
    try {
      localStorage.setItem(LS_ISSUED, JSON.stringify(map || {}));
    } catch (e) { /* private mode */ }
  }

  function loadRestock() {
    try {
      var raw = localStorage.getItem(LS_RESTOCK);
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

  function saveRestock(map) {
    try {
      localStorage.setItem(LS_RESTOCK, JSON.stringify(map || {}));
    } catch (e) { /* private mode */ }
  }

  function getRestock(code) {
    var c = canonicalCode(code);
    if (!c) return 0;
    var map = loadRestock();
    var keys = relatedKeys(c);
    var n = 0;
    for (var i = 0; i < keys.length; i++) {
      if (map[keys[i]] != null) n = Math.max(n, Math.floor(Number(map[keys[i]]) || 0));
    }
    return n;
  }

  function isQtyUnknownItem(code) {
    var c = canonicalCode(code);
    if (!c) return false;
    var items = seed().items || [];
    for (var i = 0; i < items.length; i++) {
      if (items[i] && items[i].code === c && items[i].qtyUnknown) return true;
    }
    return false;
  }

  function hasRemainingOverride(code) {
    var c = canonicalCode(code);
    if (!c) return false;
    var ov = loadOverrides();
    var keys = relatedKeys(c);
    for (var i = 0; i < keys.length; i++) {
      if (Object.prototype.hasOwnProperty.call(ov, keys[i])) return true;
    }
    return false;
  }

  function peekRemainingOverride(code) {
    var c = canonicalCode(code);
    if (!c) return null;
    var ov = loadOverrides();
    var keys = relatedKeys(c);
    for (var i = 0; i < keys.length; i++) {
      if (Object.prototype.hasOwnProperty.call(ov, keys[i])) {
        return Math.max(0, Math.floor(Number(ov[keys[i]]) || 0));
      }
    }
    return null;
  }

  function writeRestockTotal(code, total) {
    var c = canonicalCode(code);
    if (!c) return;
    var map = loadRestock();
    var keys = relatedKeys(c);
    keys.forEach(function (k) {
      if (k !== c) delete map[k];
    });
    var n = Math.max(0, Math.floor(Number(total) || 0));
    if (n <= 0) delete map[c];
    else map[c] = n;
    saveRestock(map);
  }

  function clearRestockFor(code) {
    writeRestockTotal(code, 0);
  }

  /**
   * Set absolute arrived restock total.
   * Caps at 總預 (except qtyUnknown). Cannot go below already-sold.
   * returns { ok, error, restock, left }
   */
  function setRestockTotal(code, nextTotal) {
    var c = canonicalCode(code);
    if (!c) return { ok: false, error: "無效代號" };
    var next = Math.max(0, Math.floor(Number(nextTotal) || 0));
    var cur = getRestock(c);
    var sold = getIssued(c);
    var unknown = isQtyUnknownItem(c);
    var seedQ = getSeedQty(c);

    if (next < sold) {
      return {
        ok: false,
        error: "補貨唔可以少過已售出（已售 " + sold + "；而家補貨 " + cur + "）",
        restock: cur,
        left: seedQ == null ? null : Math.max(0, seedQ - cur)
      };
    }

    if (!unknown) {
      if (seedQ == null || seedQ <= 0) {
        return {
          ok: false,
          error: "已冇得補貨（未有總預數量／總預為 0）",
          restock: cur,
          left: 0
        };
      }
      if (next > seedQ) {
        var left0 = Math.max(0, seedQ - cur);
        return {
          ok: false,
          error: left0 <= 0
            ? ("已冇得補貨（已補齊總預 " + seedQ + "）")
            : ("已冇得補貨。仲可到場 " + left0 + "（總預 " + seedQ + " − 已補 " + cur + "）"),
          restock: cur,
          left: left0
        };
      }
    }

    var delta = next - cur;
    writeRestockTotal(c, next);

    // Keep manual remaining override in sync when bumping/cutting arrived stock
    var curOv = peekRemainingOverride(c);
    if (curOv != null && delta !== 0) {
      setQty(c, Math.max(0, curOv + delta));
    }
    return {
      ok: true,
      restock: next,
      left: seedQ == null ? null : Math.max(0, seedQ - next)
    };
  }

  /** Cumulative restock += N (N may be negative to undo a mistaken entry). */
  function addRestockAmount(code, delta) {
    var c = canonicalCode(code);
    if (!c) return { ok: false, error: "無效代號" };
    var d = Math.floor(Number(delta) || 0);
    if (!d) return { ok: true, restock: getRestock(c) };
    return setRestockTotal(c, getRestock(c) + d);
  }

  function getIssued(code) {
    var c = canonicalCode(code);
    if (!c) return 0;
    var map = loadIssued();
    var keys = relatedKeys(c);
    var n = 0;
    for (var i = 0; i < keys.length; i++) {
      if (map[keys[i]] != null) n = Math.max(n, Math.floor(Number(map[keys[i]]) || 0));
    }
    return n;
  }

  function addIssued(code, delta) {
    var c = canonicalCode(code);
    if (!c) return;
    var d = Math.floor(Number(delta) || 0);
    if (!d) return;
    var map = loadIssued();
    var keys = relatedKeys(c);
    keys.forEach(function (k) {
      if (k !== c) delete map[k];
    });
    var next = (Math.floor(Number(map[c]) || 0)) + d;
    if (next <= 0) delete map[c];
    else map[c] = next;
    saveIssued(map);
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
        qty: it.qtyUnknown ? 0 : Math.max(0, Math.floor(Number(it.qty) || 0)),
        qtyUnknown: !!it.qtyUnknown,
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
      // qtyUnknown：唔寫入數字，getQty 無職員覆寫時回 null（唔擋結算）
      if (it.qtyUnknown) return;
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
    // qtyUnknown with no staff remaining: 未填 — 唔擋結算、唔因補貨發明數字
    if (isQtyUnknownItem(c)) return null;
    // 正式：剩餘 = 補貨 − 售出。試機：有總預時剩餘 = 總預 − 售出（唔寫入補貨紀錄）
    var arrived = arrivedBase(c);
    var sold = getIssued(c);
    return Math.max(0, (arrived == null ? 0 : arrived) - sold);
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
    var keys = relatedKeys(c);
    keys.forEach(function (k) {
      if (k !== c) delete ov[k];
    });
    // Baseline on-hand = 到場 − 售出（試機用總預當到場；qtyUnknown 無基線，填咗就要寫覆寫）
    var base = arrivedBase(c);
    var baseline = base == null
      ? null
      : Math.max(0, base - getIssued(c));
    if (baseline != null && qty === baseline) {
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

  /** Deduct quantities; returns { ok, shorts } — does nothing if short.
   *  getQty == null（未知／qtyUnknown 未填剩餘）：唔擋、唔發明數字，只記已送出。
   *  職員已填剩餘：照扣；唔夠就 canFulfill 擋。
   */
  function deduct(demandMap) {
    var check = canFulfill(demandMap);
    if (!check.ok) return check;
    var map = demandMap || {};
    Object.keys(map).forEach(function (code) {
      var need = Math.max(0, Math.floor(Number(map[code]) || 0));
      if (need <= 0) return;
      var have = getQty(code);
      if (have == null) {
        // qtyUnknown 未填：只記已送出，唔發明剩餘
        addIssued(code, need);
        return;
      }
      var hadOv = hasRemainingOverride(code);
      addIssued(code, need);
      // 無覆寫：剩餘自動 = 到場 − 售出（試機用總預）。有人手「改剩餘」先同步覆寫。
      if (hadOv) {
        setQty(code, Math.max(0, have - need));
      }
    });
    return { ok: true, shorts: [] };
  }

  /** Restore deducted stock (void). Issued never goes below 0. If a remaining override was adjusted on deduct, reverse it too. */
  function restore(demandMap) {
    var map = demandMap || {};
    Object.keys(map).forEach(function (code) {
      var need = Math.max(0, Math.floor(Number(map[code]) || 0));
      if (need <= 0) return;
      var have = getQty(code);
      var hadOv = hasRemainingOverride(code);
      addIssued(code, -need);
      if (hadOv) {
        var cur = have == null ? 0 : have;
        setQty(code, cur + need);
      }
    });
    return { ok: true };
  }

  function resetToSeed() {
    try { localStorage.removeItem(LS_KEY); } catch (e) {}
    // 只清人手「改剩餘」覆寫；剩餘改返跟 到場−售出（試機用總預）。補貨／已售／職員加貨保留。
  }

  function clearIssued() {
    try { localStorage.removeItem(LS_ISSUED); } catch (e) {}
  }

  function listAll() {
    return allItems().map(function (it) {
      var unknown = !!it.qtyUnknown;
      var seedQ = unknown ? null : Math.max(0, Math.floor(Number(it.qty) || 0));
      var restock = getRestock(it.code);
      var issued = getIssued(it.code);
      var sold = issued;
      var remaining = getQty(it.code); // null = qtyUnknown 未填
      var notArrived = seedQ == null ? null : Math.max(0, seedQ - restock);
      return {
        code: it.code,
        wfCode: it.wfCode || "",
        xCode: it.xCode || xCodeOf(it) || it.code,
        name: it.name || "",
        category: it.category || "",
        unit: it.unit || "件",
        seed: seedQ,
        restock: restock,
        notArrived: notArrived,
        remaining: remaining,
        sold: sold,
        issued: issued,
        qtyUnknown: unknown,
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
    // 總預只係計劃上限；到場要再「補貨」先有得賣
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
    clearRestockFor(c);
    return true;
  }

  function stockBadgeHtml(code) {
    var q = getQty(code);
    if (q == null) return "";
    var badgeTitle = isTrialOn() ? "試機註：剩餘=總預−售出" : "到場剩餘（補貨−售出）";
    if (q <= 0) {
      return '<span class="stock-badge stock-out" title="' + badgeTitle + '">暫無貨</span>';
    }
    var cls = q <= 12 ? " stock-low" : "";
    return '<span class="stock-badge' + cls + '" title="' + badgeTitle + '">庫存 ' + esc(String(q)) + "</span>";
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
    var lines = ["code,xCode,wfCode,category,name,unit,seed_first_drop,restock,sold,remaining,custom"];
    rows.forEach(function (r) {
      function csv(v) {
        var t = String(v == null ? "" : v).replace(/"/g, '""');
        return '"' + t + '"';
      }
      lines.push([r.code, r.xCode, r.wfCode, r.category, r.name, r.unit, r.seed, r.restock || 0, r.sold, r.remaining, r.custom ? "1" : "0"].map(csv).join(","));
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
    if (window.BPE_TrialMode && window.BPE_TrialMode.maybeDailyReset) {
      window.BPE_TrialMode.maybeDailyReset();
    }
    ensureDrawer();
    var root = $("stockRoot");
    if (!root) return;
    if (!canOperate()) {
      root.innerHTML = '<p class="muted">請先職員登入後先可以睇／改存貨表／庫存。</p>';
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
    var trialOn = isTrialOn();
    var html =
      (window.BPE_TrialMode && window.BPE_TrialMode.bannerHtml ? window.BPE_TrialMode.bannerHtml() : "") +
      '<p class="stock-meta"><strong>喺呢度更新存貨表</strong>：' +
      (trialOn
        ? "試機模式：有總預嘅貨剩餘＝總預−售出（當已到場，唔會寫假補貨）。補貨欄顯示實際已登記數量，唔當賣貨庫存。補貨仍然不可超過總預。禮品（總預未填）剩餘未填＝「未填」、唔擋結算；填剩餘後先會擋／扣數。人手「改剩餘」仍然有效。"
        : "總預＝未到場計劃量（上限）；補貨＝已到場貨，可＋／−／刪（入錯可改）；售出只由真正補貨扣；剩餘＝補貨−售出。補貨不可超過總預，超過會提示「已冇得補貨」。撳「加產品」可加新款（總預）。禮品（如杯墊）剩餘未填＝「未填」、唔擋結算；填剩餘後先會擋／扣數。") +
      "</p>" +
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
          '<button type="button" class="btn-ghost" id="btnStockReset">重設剩餘覆寫</button>' +
        "</div>" +
      "</div>";
    if (showAddForm) {
      html +=
        '<form class="stock-add-form" id="stockAddForm">' +
          '<p class="stock-add-title">加新產品到存貨表</p>' +
          '<div class="stock-add-grid">' +
            '<label class="field">入機代號<input id="stockAddCode" name="code" type="text" required placeholder="例如 NEW01" autocomplete="off" /></label>' +
            '<label class="field">產品名稱<input id="stockAddName" name="name" type="text" required placeholder="產品中文名" /></label>' +
            '<label class="field">總預（未到場計劃）<input id="stockAddQty" name="qty" type="number" min="0" step="1" inputmode="numeric" value="0" required /></label>' +
            '<label class="field">分類<input id="stockAddCat" name="category" type="text" placeholder="職員加貨" value="職員加貨" /></label>' +
            '<label class="field">單位<input id="stockAddUnit" name="unit" type="text" placeholder="件" value="件" /></label>' +
            '<label class="field">售價（選填）<input id="stockAddPrice" name="price" type="number" min="0" step="0.1" inputmode="decimal" placeholder="出現喺產品計數" /></label>' +
          "</div>" +
          '<p class="muted stock-add-hint">' +
            (trialOn
              ? "加咗會存本機（總預＝計劃上限）。試機模式有總預即可賣（剩餘＝總預−售出），唔使先補貨；正式開賣後就要再「補貨」登記到場。有填售價會出現喺「產品計數 → 職員加貨」。"
              : "加咗會存本機（總預＝計劃上限）；要賣先要再「補貨」登記到場。有填售價會出現喺「產品計數 → 職員加貨」。未寫入 seed 檔前，清瀏覽器資料會冇。") +
          "</p>" +
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
            "<th>產品</th><th>總預</th><th>補貨</th><th>已售</th><th>剩餘</th><th>改剩餘</th>" +
          "</tr></thead>" +
          "<tbody>";
    if (!rows.length) {
      html += '<tr><td colspan="7" class="muted">搵唔到</td></tr>';
    } else {
      rows.forEach(function (r) {
        var remNull = r.remaining == null;
        var low = remNull ? "" : (r.remaining <= 0 ? " stock-row-out" : (r.remaining <= 12 ? " stock-row-low" : ""));
        var seedTxt = remNull && r.qtyUnknown ? "未填" : (r.seed == null ? "—" : String(r.seed));
        var remTxt = remNull ? "未填" : String(r.remaining);
        var soldTxt = String(r.sold == null ? 0 : r.sold);
        if (r.qtyUnknown && (r.issued || 0) > 0) {
          soldTxt = String(r.issued) + "（已送）";
        }
        html +=
          '<tr class="stock-row' + low + (r.custom ? " stock-row-custom" : "") + (r.qtyUnknown ? " stock-row-gift" : "") + '" data-code="' + esc(r.code) + '">' +
            "<td><code title=\"X＝入機代號\">" + esc(r.xCode || r.code) + "</code>" +
              (r.code && r.xCode && r.code !== r.xCode
                ? '<div class="stock-wf muted">app ' + esc(r.code) + "</div>"
                : "") +
              (r.custom ? '<div class="stock-custom-tag">職員加</div>' : "") +
              (r.qtyUnknown ? '<div class="stock-custom-tag">禮品</div>' : "") +
            "</td>" +
            "<td><strong>" + esc(r.name) + "</strong>" +
              '<div class="muted stock-cat">' + esc(r.category) + " · " + esc(r.unit) +
              (r.price != null ? (" · $" + esc(String(r.price))) : "") +
              (r.qtyUnknown ? " · 總預未填，填剩餘後先擋結算" : "") +
              "</div>" +
              (r.custom
                ? ('<button type="button" class="stock-del" data-del-code="' + esc(r.code) + '">刪除加貨</button>')
                : "") +
            "</td>" +
            '<td class="num" title="未到場計劃量／總預上限">' + esc(seedTxt) +
              (trialOn && !r.qtyUnknown && r.seed != null
                ? '<div class="muted stock-not-arrived" title="試機當已到場">試機當已到場</div>'
                : (r.notArrived != null
                ? ('<div class="muted stock-not-arrived" title="總預−補貨">未到場 ' + esc(String(r.notArrived)) + "</div>")
                : "")) +
            "</td>" +
            '<td class="stock-restock-cell">' +
              '<div class="num" title="' + (trialOn ? "實際已登記補貨（試機賣貨唔跟呢欄）" : "已到場補貨") + '">' + esc(String(r.restock || 0)) + "</div>" +
              '<div class="stock-restock-add">' +
                '<input class="stock-restock-input" type="number" min="1" step="1" inputmode="numeric" ' +
                  'data-code="' + esc(r.code) + '" placeholder="數量" aria-label="補貨數量 ' + esc(r.name) + '" />' +
                '<button type="button" class="stock-restock-btn" data-restock-code="' + esc(r.code) + '" data-restock-dir="1" title="新增補貨">＋</button>' +
                '<button type="button" class="stock-restock-btn stock-restock-btn-minus" data-restock-code="' + esc(r.code) + '" data-restock-dir="-1" title="減少補貨（入錯）">−</button>' +
                ((r.restock || 0) > 0
                  ? ('<button type="button" class="stock-restock-del" data-restock-del="' + esc(r.code) + '" title="刪除入錯嘅補貨（降至已售）">刪</button>')
                  : "") +
              "</div>" +
            "</td>" +
            '<td class="num" title="售出">' + esc(soldTxt) + "</td>" +
            '<td class="num stock-rem" title="' + (trialOn && !r.qtyUnknown ? "試機註：剩餘=總預−售出" : "到場剩餘（補貨−售出）") + '">' + esc(remTxt) + "</td>" +
            '<td><input class="stock-edit" type="number" min="0" step="1" inputmode="numeric" ' +
              'data-code="' + esc(r.code) + '" data-qty-unknown="' + (r.qtyUnknown ? "1" : "0") + '" ' +
              'value="' + (remNull ? "" : esc(String(r.remaining))) + '" placeholder="未填" aria-label="剩餘庫存 ' + esc(r.name) + '" /></td>' +
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
        if (!confirm(isTrialOn()
          ? "清除人手改過嘅「剩餘」覆寫，改返跟「總預−售出」（試機）？補貨同已售會保留；職員加貨產品會保留。"
          : "清除人手改過嘅「剩餘」覆寫，改返跟「補貨−售出」？補貨同已售會保留；職員加貨產品會保留。")) return;
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
        var raw = String(inp.value == null ? "" : inp.value).trim();
        if (raw === "" && inp.getAttribute("data-qty-unknown") === "1") {
          // 清空＝回到「未填剩餘」（唔擋結算）
          var ov = loadOverrides();
          relatedKeys(code).forEach(function (k) { delete ov[k]; });
          delete ov[canonicalCode(code)];
          saveOverrides(ov);
        } else {
          setQty(code, raw === "" ? 0 : raw);
        }
        renderPanel();
        refreshOrderUi();
      });
    });
    function flashRestockInput(inp) {
      if (!inp) return;
      inp.focus();
      inp.classList.add("stock-restock-input-bad");
      setTimeout(function () { inp.classList.remove("stock-restock-input-bad"); }, 900);
    }

    root.querySelectorAll(".stock-restock-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var code = btn.getAttribute("data-restock-code");
        if (!code) return;
        var dir = Number(btn.getAttribute("data-restock-dir") || "1");
        var row = btn.closest("tr");
        var inp = row ? row.querySelector(".stock-restock-input") : null;
        var raw = inp ? String(inp.value == null ? "" : inp.value).trim() : "";
        var n = Math.floor(Number(raw) || 0);
        if (!n || n < 1) {
          flashRestockInput(inp);
          return;
        }
        var res = addRestockAmount(code, dir < 0 ? -n : n);
        if (!res || !res.ok) {
          alert((res && res.error) || "已冇得補貨");
          flashRestockInput(inp);
          return;
        }
        if (inp) inp.value = "";
        renderPanel();
        refreshOrderUi();
      });
    });
    root.querySelectorAll(".stock-restock-del").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var code = btn.getAttribute("data-restock-del");
        if (!code) return;
        var sold = getIssued(code);
        var cur = getRestock(code);
        var msg = sold > 0
          ? ("刪除入錯補貨「" + code + "」？會將補貨由 " + cur + " 降至已售 " + sold + "（剩餘變 0）。")
          : ("刪除入錯補貨「" + code + "」？會將補貨由 " + cur + " 清為 0。");
        if (!confirm(msg)) return;
        var res = setRestockTotal(code, sold);
        if (!res || !res.ok) {
          alert((res && res.error) || "唔可以刪呢筆補貨");
          return;
        }
        renderPanel();
        refreshOrderUi();
      });
    });
    root.querySelectorAll(".stock-restock-input").forEach(function (inp) {
      inp.addEventListener("keydown", function (e) {
        if (e.key === "Enter") {
          e.preventDefault();
          var row = inp.closest("tr");
          var btn = row ? row.querySelector('.stock-restock-btn[data-restock-dir="1"]') : null;
          if (btn) btn.click();
        }
      });
    });
  }

  function openPanel() {
    if (!canOperate()) {
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
    getRestock: getRestock,
    setRestockTotal: setRestockTotal,
    setQty: setQty,
    addQty: addQty,
    addRestockAmount: addRestockAmount,
    deduct: deduct,
    restore: restore,
    canFulfill: canFulfill,
    resetToSeed: resetToSeed,
    listAll: listAll,
    listOrderExtras: listOrderExtras,
    addProduct: addProduct,
    removeProduct: removeProduct,
    stockBadgeHtml: stockBadgeHtml,
    getIssued: getIssued,
    clearIssued: clearIssued,
    openPanel: openPanel,
    closePanel: closePanel,
    renderPanel: renderPanel,
    canonicalCode: canonicalCode,
    xCodeOf: xCodeOf
  };
})();
