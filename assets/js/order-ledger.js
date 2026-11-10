/* 單據帳本：詳細出單、軟作廢、品牌／付款統計；本機 localStorage，上限約 3000 張 */
(function () {
  "use strict";

  var LS_PREORDERS = "zihua_bpe_preorders_v1";
  var ORDER_STORE_CAP = 3000;

  var PAY_METHODS = [
    { id: "octopus", label: "八達通" },
    { id: "cash", label: "現金港幣" },
    { id: "alipay", label: "Alipay" },
    { id: "wechat", label: "WeChat Pay" },
    { id: "payme", label: "PayMe" },
    { id: "visa", label: "VISA" },
    { id: "mastercard", label: "Mastercard" },
    { id: "unionpay", label: "銀聯" }
  ];

  var REDEEM_STOCK = { R0001: "CMPS", R0002: "CPW021A", R0003: "ZE10", R0004: "ZA155S1" };

  var BRAND_ORDER = ["紫花油", "日本叮叮", "真威龍", "古寶（CUPAL）", "調理個", "口罩（WeArmask）", "其他"];

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
  function money(n) {
    if (n == null || n === "" || isNaN(n)) return "—";
    var x = Math.round(Number(n) * 100) / 100;
    return (x % 1 === 0) ? String(x) : x.toFixed(2);
  }
  function round2(n) {
    return Math.round((Number(n) || 0) * 100) / 100;
  }
  function normCode(c) {
    return String(c == null ? "" : c).trim().toUpperCase();
  }
  function hkDateKey(d) {
    var date = d instanceof Date ? d : (d ? new Date(d) : new Date());
    if (isNaN(date.getTime())) date = new Date();
    try {
      return new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Hong_Kong",
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
      }).format(date);
    } catch (e) {
      var y = date.getFullYear();
      var m = String(date.getMonth() + 1).padStart(2, "0");
      var day = String(date.getDate()).padStart(2, "0");
      return y + "-" + m + "-" + day;
    }
  }
  function formatHkTime(iso) {
    if (!iso) return "—";
    var d = new Date(iso);
    if (isNaN(d.getTime())) return String(iso);
    try {
      return d.toLocaleString("zh-HK", {
        timeZone: "Asia/Hong_Kong",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false
      });
    } catch (e) {
      return d.toISOString();
    }
  }
  function payLabel(id) {
    for (var i = 0; i < PAY_METHODS.length; i++) {
      if (PAY_METHODS[i].id === id) return PAY_METHODS[i].label;
    }
    return id || "";
  }

  function loadAllOrders() {
    try {
      var raw = localStorage.getItem(LS_PREORDERS);
      var list = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(list)) return [];
      return list;
    } catch (e) {
      return [];
    }
  }

  function findOrderById(id) {
    var want = String(id || "");
    if (!want) return null;
    var list = loadAllOrders();
    for (var i = 0; i < list.length; i++) {
      if (list[i] && String(list[i].id) === want) return list[i];
    }
    return null;
  }

  function writeOrders(list, mustKeepId) {
    var arr = Array.isArray(list) ? list.slice() : [];
    var cap = Math.min(arr.length, ORDER_STORE_CAP);
    var started = arr.length;
    while (cap >= 1) {
      var slice = arr.slice(0, cap);
      if (mustKeepId && (!slice[0] || String(slice[0].id) !== String(mustKeepId))) {
        return { ok: false, error: "無法保留呢張新單。", count: 0 };
      }
      try {
        localStorage.setItem(LS_PREORDERS, JSON.stringify(slice));
        var dropped = started - slice.length;
        var warning = dropped > 0
          ? ("本機儲存空間有限，已保留最新 " + slice.length + " 張單，較舊 " + dropped + " 張已被刪減。請盡快匯出。")
          : "";
        return { ok: true, count: slice.length, truncated: dropped > 0, warning: warning };
      } catch (e) {
        if (cap <= 1) {
          return {
            ok: false,
            error: "本機儲存已滿，呢張單未能寫入。請先匯出或清除舊單後再試。",
            count: 0
          };
        }
        cap = Math.max(1, Math.floor(cap * 0.75));
      }
    }
    return { ok: false, error: "本機儲存已滿，呢張單未能寫入。", count: 0 };
  }

  function persistNewOrder(order) {
    if (!order || !order.id) {
      return { ok: false, error: "無效單據", order: order };
    }
    var list = loadAllOrders();
    list.unshift(order);
    var res = writeOrders(list, order.id);
    res.order = order;
    return res;
  }

  function replaceOrder(order) {
    if (!order || !order.id) return { ok: false, error: "無效單據" };
    var list = loadAllOrders();
    var found = false;
    for (var i = 0; i < list.length; i++) {
      if (list[i] && String(list[i].id) === String(order.id)) {
        list[i] = order;
        found = true;
        break;
      }
    }
    if (!found) return { ok: false, error: "搵唔到呢張單" };
    var res = writeOrders(list, null);
    res.order = order;
    return res;
  }

  var catalogCache = null;
  function catalogByCode() {
    if (catalogCache) return catalogCache;
    var map = {};
    function put(code, info) {
      var c = normCode(code);
      if (!c) return;
      if (!map[c]) map[c] = info;
      else {
        if (!map[c].name && info.name) map[c].name = info.name;
        if (!map[c].category && info.category) map[c].category = info.category;
        if (!map[c].brand && info.brand) map[c].brand = info.brand;
      }
    }
    var stock = window.BPE_STOCK_SEED || {};
    (stock.items || []).forEach(function (it) {
      if (!it) return;
      var info = { name: it.name || "", category: it.category || "", brand: "" };
      put(it.code, info);
      if (it.wfCode) put(it.wfCode, info);
      if (it.xCode) put(it.xCode, info);
    });
    if (window.BPE_Stock && window.BPE_Stock.listAll) {
      try {
        (window.BPE_Stock.listAll() || []).forEach(function (it) {
          put(it.code, { name: it.name || "", category: it.category || "", brand: "" });
        });
      } catch (e) {}
    }
    var dim = window.BPE_DIMSUM_ORDER || {};
    (dim.sheets || []).forEach(function (sheet) {
      (sheet.sections || []).forEach(function (sec) {
        (sec.items || []).forEach(function (it) {
          if (!it || !it.code) return;
          put(it.code, { name: it.name || "", category: "", brand: "", sheetId: sheet.id || "" });
        });
      });
    });
    catalogCache = map;
    return map;
  }

  function brandFromProductsSeed(name) {
    var want = String(name || "").replace(/\s+/g, "");
    if (!want) return "";
    var items = (window.BPE_PRODUCTS_SEED && window.BPE_PRODUCTS_SEED.items) || [];
    var i;
    for (i = 0; i < items.length; i++) {
      var n = String((items[i] && items[i].name) || "").replace(/\s+/g, "");
      if (n && n === want && items[i].brand) return String(items[i].brand);
    }
    var best = "";
    var bestLen = 0;
    for (i = 0; i < items.length; i++) {
      var pn = String((items[i] && items[i].name) || "").replace(/\s+/g, "");
      if (pn.length < 2 || !items[i].brand) continue;
      if (want.indexOf(pn) >= 0 || pn.indexOf(want) >= 0) {
        if (pn.length > bestLen) {
          bestLen = pn.length;
          best = String(items[i].brand);
        }
      }
    }
    return best;
  }

  function brandFromCategory(cat, name, code) {
    var c = String(cat || "");
    var nm = String(name || "");
    var cd = normCode(code);
    if (c === "真威龍") return "真威龍";
    if (c === "口罩") return "口罩（WeArmask）";
    if (c === "日本叮叮") return "日本叮叮";
    if (c === "紫花油散裝" || c === "紫花油套裝" || c === "紫花油禮品") return "紫花油";
    if (c === "禮品") {
      if (/ZA155|NMN/i.test(cd + nm) || /古寶|CUPAL Health/i.test(nm)) return "古寶（CUPAL）";
      if (/^調理/.test(nm)) return "調理個";
      return "紫花油";
    }
    if (c === "保健品" || c === "外用關節") {
      if (/^調理/.test(nm)) return "調理個";
      return "古寶（CUPAL）";
    }
    return "";
  }

  function normalizeBrandLabel(b) {
    var s = String(b || "").trim();
    if (!s) return "";
    if (s === "古寶" || s === "CUPAL" || s === "Cupal") return "古寶（CUPAL）";
    if (s === "叮叮") return "日本叮叮";
    return s;
  }

  function resolveBrand(code, name) {
    var c = normCode(code);
    var nm = String(name || "");
    if (REDEEM_STOCK[c]) {
      var stockCode = REDEEM_STOCK[c];
      var catMap = catalogByCode();
      var info = catMap[stockCode] || {};
      return resolveBrand(stockCode, info.name || nm);
    }
    var catInfo = catalogByCode()[c] || {};
    var cat = catInfo.category || "";
    var itemName = nm || catInfo.name || "";

    if (cat === "真威龍" || /^真威龍/.test(itemName)) return "真威龍";
    if (cat === "口罩" || /WeArmask|口罩/.test(itemName) && /^ZHMA/.test(c)) return "口罩（WeArmask）";
    if ((cat === "保健品" || cat === "外用關節") && /^調理/.test(itemName)) return "調理個";

    var seedBrand = normalizeBrandLabel(brandFromProductsSeed(itemName) || brandFromProductsSeed(catInfo.name));
    if (seedBrand === "古寶（CUPAL）") {
      if (/^調理/.test(itemName)) return "調理個";
      if (/真威龍/.test(itemName) || cat === "真威龍") return "真威龍";
      return "古寶（CUPAL）";
    }
    if (seedBrand) return seedBrand;

    var fromCat = brandFromCategory(cat, itemName, c);
    if (fromCat) return fromCat;

    if (/^調理/.test(itemName)) return "調理個";
    if (/真威龍/.test(itemName)) return "真威龍";
    if (/日本叮叮|叮叮/.test(itemName)) return "日本叮叮";
    if (/紫花油|紫花滴|紫花 C75|紫花C75/.test(itemName)) return "紫花油";
    if (/古寶|CUPAL/i.test(itemName)) return "古寶（CUPAL）";
    if (/WeArmask|口罩/.test(itemName)) return "口罩（WeArmask）";
    return "其他";
  }

  function parseLineLabel(ln) {
    var label = String((ln && ln.label) || "").trim();
    var code = normCode(ln && ln.code);
    var m = label.match(/^([A-Z0-9][A-Z0-9\-_]{0,24})\s+(.+?)\s+×\s+(\d+)(?:\s|$|　)/);
    if (m) {
      return { code: code || m[1], name: m[2], qty: parseInt(m[3], 10) };
    }
    var m2 = label.match(/^(.*?)\s+×\s+(\d+)(?:\s|$|　)/);
    if (m2) {
      return { code: code, name: m2[1], qty: parseInt(m2[2], 10) };
    }
    return {
      code: code,
      name: label || "",
      qty: ln && (ln.qty != null ? ln.qty : ln.giftQty)
    };
  }

  function isProductLine(ln) {
    if (!ln) return false;
    var k = ln.kind || "item";
    return k === "item" || k === "set";
  }

  function enrichLine(ln) {
    ln = ln || {};
    var parsed = parseLineLabel(ln);
    var code = normCode(ln.code) || normCode(parsed.code);
    var name = ln.name || parsed.name || "";
    var qty = ln.qty != null ? ln.qty : (ln.giftQty != null ? ln.giftQty : parsed.qty);
    if (qty != null) qty = Math.floor(Number(qty) || 0);
    var unitPrice = ln.unitPrice;
    if (unitPrice == null && ln.amount != null && !isNaN(ln.amount) && qty) {
      unitPrice = round2(Number(ln.amount) / qty);
    }
    var brand = ln.brand || (code || name ? resolveBrand(code, name) : "");
    if (!brand && ln.kind === "discount") brand = "其他";
    var out = {};
    Object.keys(ln).forEach(function (k) { out[k] = ln[k]; });
    out.code = code || ln.code || "";
    out.name = name;
    if (qty != null) out.qty = qty;
    if (unitPrice != null && !isNaN(unitPrice)) out.unitPrice = unitPrice;
    out.brand = brand || "其他";
    if (!out.label) {
      out.label = (out.code ? (out.code + " ") : "") + (out.name || "") + (out.qty != null ? (" × " + out.qty) : "");
    }
    return out;
  }

  function enrichLines(lines) {
    return (lines || []).map(enrichLine);
  }

  function demandFromLines(order) {
    var demand = {};
    function add(code, n) {
      var c = normCode(code);
      var q = Math.max(0, Math.floor(Number(n) || 0));
      if (!c || q <= 0) return;
      if (REDEEM_STOCK[c]) c = REDEEM_STOCK[c];
      demand[c] = (demand[c] || 0) + q;
    }
    var lines = enrichLines((order && order.lines) || []);
    lines.forEach(function (ln) {
      if (!ln) return;
      var k = ln.kind || "item";
      if (k === "discount" || k === "set-note") return;
      if (k === "gift") {
        add(ln.code, ln.giftQty != null ? ln.giftQty : ln.qty);
        return;
      }
      if (k === "set") return; // 套裝若只有 bundle 名，唔亂發明扣貨；新單應已存 demand
      add(ln.code, ln.qty);
    });
    return demand;
  }

  function currentHandlerLabel() {
    var handler = "";
    if (window.ZihuaStaffAuth && window.ZihuaStaffAuth.getStaff) {
      var stf = window.ZihuaStaffAuth.getStaff();
      if (stf) handler = stf.label || stf.id || "";
    }
    if (!handler && window.ZihuaAdminAuth && window.ZihuaAdminAuth.isLoggedIn && window.ZihuaAdminAuth.isLoggedIn()) {
      handler = (window.ZihuaAdminAuth.getSessionEmail && window.ZihuaAdminAuth.getSessionEmail()) || "管理員";
    }
    return handler || "職員";
  }

  function voidOrder(id) {
    var want = String(id || "");
    var list = loadAllOrders();
    var order = null;
    var idx = -1;
    for (var i = 0; i < list.length; i++) {
      if (list[i] && String(list[i].id) === want) {
        order = list[i];
        idx = i;
        break;
      }
    }
    if (!order) return { ok: false, error: "搵唔到呢張單" };
    if (order.voided) return { ok: false, error: "呢張單已經作廢，唔可以再作廢。" };
    var demand = order.demand;
    if (!demand || typeof demand !== "object" || !Object.keys(demand).length) {
      demand = demandFromLines(order);
    }
    if (window.BPE_Stock && window.BPE_Stock.restore) {
      try { window.BPE_Stock.restore(demand); } catch (e) {}
    }
    if (window.BPE_SalesTarget && window.BPE_SalesTarget.removeSale) {
      try { window.BPE_SalesTarget.removeSale(order.payable, order.t); } catch (e2) {}
    }
    order.voided = true;
    order.voidedAt = new Date().toISOString();
    order.voidedBy = currentHandlerLabel();
    list[idx] = order;
    var res = writeOrders(list, null);
    if (!res.ok) {
      return { ok: false, error: res.error || "作廢標記未能寫入本機", order: order };
    }
    res.order = order;
    return res;
  }

  function orderInRange(order, range, todayKey) {
    if (!order) return false;
    if (range === "all") return true;
    var key = todayKey || hkDateKey();
    return hkDateKey(order.t) === key;
  }

  function computeStats(range) {
    var today = hkDateKey();
    var list = loadAllOrders();
    var scoped = list.filter(function (o) { return orderInRange(o, range, today); });
    var live = [];
    var voided = [];
    scoped.forEach(function (o) {
      if (o && o.voided) voided.push(o);
      else if (o) live.push(o);
    });

    var payMap = {};
    PAY_METHODS.forEach(function (m) {
      payMap[m.id] = { id: m.id, label: m.label, count: 0, payable: 0 };
    });
    var payUnknown = {};
    var payTotal = { count: 0, payable: 0 };

    var brandMap = {};
    function brandRow(name) {
      if (!brandMap[name]) brandMap[name] = { brand: name, qty: 0, lineSum: 0, payable: 0 };
      return brandMap[name];
    }
    BRAND_ORDER.forEach(function (b) { brandRow(b); });

    live.forEach(function (o) {
      var pid = o.paymentMethod || "";
      var plabel = o.paymentLabel || payLabel(pid) || pid || "未填";
      var rec = payMap[pid];
      if (!rec) {
        if (!payUnknown[pid || plabel]) {
          payUnknown[pid || plabel] = { id: pid || "other", label: plabel, count: 0, payable: 0 };
        }
        rec = payUnknown[pid || plabel];
      }
      rec.count += 1;
      rec.payable = round2(rec.payable + (Number(o.payable) || 0));
      payTotal.count += 1;
      payTotal.payable = round2(payTotal.payable + (Number(o.payable) || 0));

      var lines = enrichLines(o.lines || []);
      var lineSums = {};
      var lineTotal = 0;
      lines.forEach(function (ln) {
        if (!ln || ln.kind === "set-note" || ln.kind === "gift") return;
        var b = ln.brand || "其他";
        var amt = Number(ln.amount);
        if (isNaN(amt)) return;
        lineSums[b] = round2((lineSums[b] || 0) + amt);
        lineTotal = round2(lineTotal + amt);
        if (isProductLine(ln)) {
          brandRow(b).qty += Math.max(0, Math.floor(Number(ln.qty) || 0));
        }
      });
      Object.keys(lineSums).forEach(function (b) {
        brandRow(b).lineSum = round2(brandRow(b).lineSum + lineSums[b]);
      });
      var bag = o.plasticBag ? (Number(o.bagFee) || 1) : 0;
      if (bag < 0 || isNaN(bag)) bag = 0;
      var payable = Number(o.payable) || 0;
      var allocable = round2(Math.max(0, payable - bag));
      if (lineTotal > 0) {
        var allocated = 0;
        var keys = Object.keys(lineSums);
        keys.forEach(function (b, idx) {
          var share;
          if (idx === keys.length - 1) share = round2(allocable - allocated);
          else share = round2(allocable * (lineSums[b] / lineTotal));
          if (share < 0) share = 0;
          allocated = round2(allocated + share);
          brandRow(b).payable = round2(brandRow(b).payable + share);
        });
      } else {
        brandRow("其他").payable = round2(brandRow("其他").payable + allocable);
      }
      if (bag) brandRow("其他").payable = round2(brandRow("其他").payable + bag);
    });

    var payRows = PAY_METHODS.map(function (m) { return payMap[m.id]; });
    Object.keys(payUnknown).forEach(function (k) { payRows.push(payUnknown[k]); });

    var brandRows = BRAND_ORDER.map(function (b) { return brandMap[b]; }).concat(
      Object.keys(brandMap).filter(function (b) { return BRAND_ORDER.indexOf(b) < 0; }).map(function (b) { return brandMap[b]; })
    );

    var voidPayable = 0;
    voided.forEach(function (o) { voidPayable = round2(voidPayable + (Number(o.payable) || 0)); });

    return {
      range: range === "all" ? "all" : "today",
      today: today,
      totalSaved: list.length,
      scopedCount: scoped.length,
      liveCount: live.length,
      livePayable: payTotal.payable,
      voidCount: voided.length,
      voidPayable: voidPayable,
      payments: payRows,
      payTotal: payTotal,
      brands: brandRows
    };
  }

  function csvCell(v) {
    var t = String(v == null ? "" : v).replace(/"/g, '""');
    return '"' + t + '"';
  }

  function exportStatsCsv(range) {
    var today = hkDateKey();
    var list = loadAllOrders();
    var scoped = list.filter(function (o) { return orderInRange(o, range, today); });
    var stats = computeStats(range);
    var lines = [];
    lines.push("2026 工展會 · 單據匯出");
    lines.push("範圍," + (range === "all" ? "全部已存單據" : ("今日（香港 " + today + "）")));
    lines.push("匯出時間（香港）," + formatHkTime(new Date().toISOString()));
    lines.push("");
    lines.push("單據清單");
    lines.push(["單號", "時間（香港）", "POS", "經手人", "付款方式", "件數", "合計", "實付", "狀態", "作廢時間", "作廢人"].map(csvCell).join(","));
    scoped.forEach(function (o) {
      lines.push([
        o.orderNo || o.id || "",
        formatHkTime(o.t),
        o.pos != null ? o.pos : "",
        o.handler || o.staffLabel || "",
        o.paymentLabel || payLabel(o.paymentMethod) || o.paymentMethod || "",
        o.count != null ? o.count : "",
        o.subtotal != null ? o.subtotal : "",
        o.payable != null ? o.payable : "",
        o.voided ? "已作廢" : "有效",
        o.voided ? formatHkTime(o.voidedAt) : "",
        o.voided ? (o.voidedBy || "") : ""
      ].map(csvCell).join(","));
    });
    lines.push("");
    lines.push("產品明細");
    lines.push(["單號", "狀態", "貨號", "品名", "品牌", "數量", "單價", "金額", "種類"].map(csvCell).join(","));
    scoped.forEach(function (o) {
      enrichLines(o.lines || []).forEach(function (ln) {
        if (!ln || ln.kind === "set-note") return;
        lines.push([
          o.orderNo || o.id || "",
          o.voided ? "已作廢" : "有效",
          ln.code || "",
          ln.name || ln.label || "",
          ln.brand || "",
          ln.qty != null ? ln.qty : "",
          ln.unitPrice != null ? ln.unitPrice : "",
          ln.amount != null ? ln.amount : "",
          ln.kind || ""
        ].map(csvCell).join(","));
      });
    });
    lines.push("");
    lines.push("付款方式統計（不含作廢）");
    lines.push(["付款方式", "張數", "實付"].map(csvCell).join(","));
    stats.payments.forEach(function (r) {
      lines.push([r.label, r.count, r.payable].map(csvCell).join(","));
    });
    lines.push(["合計", stats.payTotal.count, stats.payTotal.payable].map(csvCell).join(","));
    lines.push("");
    lines.push("品牌統計（不含作廢）");
    lines.push("註：線金額合計係優惠券／滿減／銀髮／膠袋之前嘅產品線合計（可含正價9折同買3送1）；實付按各品牌線合計比例分攤，膠袋 $1 計入「其他」。");
    lines.push(["品牌", "件數", "線合計", "分攤實付"].map(csvCell).join(","));
    stats.brands.forEach(function (r) {
      lines.push([r.brand, r.qty, r.lineSum, r.payable].map(csvCell).join(","));
    });
    lines.push("");
    lines.push(["作廢張數", stats.voidCount, "作廢實付", stats.voidPayable].map(csvCell).join(","));
    return "\ufeff" + lines.join("\n");
  }

  function downloadStatsCsv(range) {
    var text = exportStatsCsv(range);
    var blob = new Blob([text], { type: "text/csv;charset=utf-8" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    var tag = range === "all" ? "all" : hkDateKey();
    a.download = "zihua-bpe-orders-" + tag + ".csv";
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
  }

  window.BPE_OrderLedger = {
    ORDER_STORE_CAP: ORDER_STORE_CAP,
    PAY_METHODS: PAY_METHODS,
    BRAND_ORDER: BRAND_ORDER,
    loadAllOrders: loadAllOrders,
    findOrderById: findOrderById,
    persistNewOrder: persistNewOrder,
    replaceOrder: replaceOrder,
    writeOrders: writeOrders,
    resolveBrand: resolveBrand,
    enrichLine: enrichLine,
    enrichLines: enrichLines,
    demandFromLines: demandFromLines,
    voidOrder: voidOrder,
    computeStats: computeStats,
    exportStatsCsv: exportStatsCsv,
    downloadStatsCsv: downloadStatsCsv,
    currentHandlerLabel: currentHandlerLabel,
    hkDateKey: hkDateKey,
    formatHkTime: formatHkTime,
    payLabel: payLabel,
    money: money,
    esc: esc,
    invalidateCatalog: function () { catalogCache = null; }
  };
})();
