/* 產品計數 · 預訂 — Lovable 風格；數量／銀髮存 localStorage */
(function () {
  "use strict";

  var LS_KEY = "zihua_bpe_dimsum_order_v1";
  var activeSheet = "zihua";
  var searchQ = "";
  var floatExpanded = false;

  function $(id) { return document.getElementById(id); }
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
  function loadState() {
    try {
      var raw = localStorage.getItem(LS_KEY);
      if (raw) {
        var o = JSON.parse(raw);
        return {
          items: o.items || {},
          sets: o.sets || {},
          overrides: o.overrides || {},
          senior: !!o.senior
        };
      }
    } catch (e) {}
    return { items: {}, sets: {}, overrides: {}, senior: false };
  }
  function saveState(st) {
    try { localStorage.setItem(LS_KEY, JSON.stringify(st)); } catch (e) {}
  }
  function data() { return window.BPE_DIMSUM_ORDER || { sheets: [] }; }
  function unitPrice(item, st) {
    if (st.overrides && st.overrides[item.code] != null && st.overrides[item.code] !== "") {
      var ov = Number(st.overrides[item.code]);
      if (!isNaN(ov)) return ov;
    }
    if (item.special != null && item.special !== "") return Number(item.special);
    if (item.orig != null && item.orig !== "") return Number(item.orig);
    return null;
  }
  function itemQty(st, code) {
    var q = Number(st.items[code] || 0);
    return q > 0 ? q : 0;
  }
  function setQty(st, id) {
    var q = Number(st.sets[id] || 0);
    return q > 0 ? q : 0;
  }
  function isAdmin() {
    var a = window.ZihuaAdminAuth;
    return !!(a && a.isLoggedIn && a.isLoggedIn());
  }
  function bogoDiscount(prices) {
    if (!prices.length) return 0;
    var sorted = prices.slice().sort(function (a, b) { return a - b; });
    var free = Math.floor(sorted.length / 4);
    var disc = 0;
    for (var i = 0; i < free; i++) disc += sorted[i];
    return disc;
  }

  function calcTotals(st) {
    var sheets = data().sheets || [];
    var total = 0;
    var lines = [];
    var pieceCount = 0;

    sheets.forEach(function (sheet) {
      (sheet.sections || []).forEach(function (sec) {
        var hasBogo = (sec.bundles || []).some(function (b) { return b.useItemPrices; });
        (sec.bundles || []).forEach(function (b) {
          var q = setQty(st, b.id);
          if (q <= 0) return;
          pieceCount += q;
          if (b.useItemPrices) {
            lines.push({ kind: "set-note", label: sec.title + " · " + b.label + " × " + q, amount: null });
            return;
          }
          if (b.setPrice == null) return;
          var amt = q * Number(b.setPrice);
          total += amt;
          lines.push({ kind: "set", label: b.label + " × " + q, amount: amt });
        });
        var bogoPrices = [];
        (sec.items || []).forEach(function (it) {
          if (it.displayOnly) return;
          var q = itemQty(st, it.code);
          if (q <= 0) return;
          pieceCount += q;
          var p = unitPrice(it, st);
          if (p == null) {
            lines.push({ kind: "item", label: it.code + " " + it.name + " × " + q, amount: null });
            return;
          }
          if (it.packQty && it.packPrice) {
            var packs = Math.floor(q / it.packQty);
            var rem = q % it.packQty;
            var amt = packs * Number(it.packPrice) + rem * p;
            total += amt;
            lines.push({ kind: "item", label: it.code + " " + it.name + " × " + q, amount: amt });
            return;
          }
          var lineAmt = q * p;
          if (hasBogo) for (var i = 0; i < q; i++) bogoPrices.push(p);
          total += lineAmt;
          lines.push({ kind: "item", label: it.code + " " + it.name + " × " + q, amount: lineAmt, code: it.code });
        });
        if (hasBogo && bogoPrices.length) {
          var disc = bogoDiscount(bogoPrices);
          if (disc > 0) {
            total -= disc;
            lines.push({ kind: "discount", label: sec.title + " · 買3送1", amount: -disc });
          }
        }
      });
    });
    return { total: total, lines: lines, count: pieceCount };
  }

  function sheetCount(st, sheet) {
    var n = 0;
    (sheet.sections || []).forEach(function (sec) {
      (sec.bundles || []).forEach(function (b) { n += setQty(st, b.id); });
      (sec.items || []).forEach(function (it) {
        if (!it.displayOnly) n += itemQty(st, it.code);
      });
    });
    return n;
  }

  function matchQ(text) {
    if (!searchQ) return true;
    return String(text || "").toLowerCase().indexOf(searchQ.toLowerCase()) >= 0;
  }

  function qtyCtrl(kind, id, val) {
    return (
      '<div class="qty-ctrl" data-kind="' + esc(kind) + '" data-id="' + esc(id) + '">' +
        '<button type="button" class="qty-btn" data-delta="-1" aria-label="減">−</button>' +
        '<span class="qty-val" aria-label="數量">' + esc(String(val || 0)) + "</span>" +
        '<button type="button" class="qty-btn qty-plus" data-delta="1" aria-label="加">＋</button>' +
      "</div>"
    );
  }

  function renderHero() {
    return (
      '<header class="pc-hero">' +
        '<p class="pc-hero-kicker">2026 工展會 · 會場購物禮遇</p>' +
        "<h2>產品計數 · 預訂</h2>" +
        (window.BPE_Gifts && window.BPE_Gifts.renderGiftCardsHtml
          ? window.BPE_Gifts.renderGiftCardsHtml()
          : "") +
        '<p class="pc-hero-note">套裝價自動計算 · 花香套／5 支花香油送杯墊 · 任何消費送 2027 年曆卡 · 滿額贈品以最高一級計 · 銀髮 95 折後以實付計 · 送完即止</p>' +
      "</header>"
    );
  }

  function renderSearchChips(st) {
    var sheets = data().sheets || [];
    var chips = sheets.map(function (s) {
      var c = sheetCount(st, s);
      var on = s.id === activeSheet ? " active" : "";
      var badge = c > 0 ? '<span class="chip-badge">' + c + "</span>" : "";
      return (
        '<button type="button" class="cat-chip' + on + '" data-sheet="' + esc(s.id) + '">' +
          esc(s.short || s.title) + badge +
        "</button>"
      );
    }).join("");
    return (
      '<div class="pc-search-wrap">' +
        '<label class="pc-search">' +
          '<span class="pc-search-ico" aria-hidden="true">🔍</span>' +
          '<input type="search" id="pcSearch" placeholder="搜尋產品名稱或編號" value="' + esc(searchQ) + '" />' +
        "</label>" +
        '<div class="cat-chips" role="tablist">' + chips + "</div>" +
      "</div>"
    );
  }

  function renderSection(sec, st) {
    var html = '<div class="pc-section">';
    html += '<h3 class="pc-sec-title">' + esc(sec.title) + "</h3>";
    if (sec.note) html += '<p class="pc-sec-note">' + esc(sec.note) + "</p>";
    // scent promo line for oil sets
    if (sec.id === "z-oil-set") {
      html += '<p class="pc-sec-note">芳香紅薇／淡花甜香／馥郁白木 set 每套送紫花油陶瓷杯墊</p>';
    }

    (sec.bundles || []).forEach(function (b) {
      if (searchQ && !matchQ(b.label) && !matchQ(b.id)) return;
      var q = setQty(st, b.id);
      var priceLabel = b.useItemPrices ? "按單品／買3送1" : ("$" + money(b.setPrice) + "／套");
      html +=
        '<div class="pc-card">' +
          '<div class="pc-thumb" aria-hidden="true">📦</div>' +
          '<div class="pc-card-body">' +
            "<strong>" + esc(b.label) + "</strong>" +
            '<div class="pc-meta"><code>' + esc(b.id) + "</code> · " + esc(priceLabel) + "</div>" +
          "</div>" +
          qtyCtrl("set", b.id, q) +
        "</div>";
    });

    (sec.items || []).forEach(function (it) {
      if (it.displayOnly) return;
      if (searchQ && !matchQ(it.name) && !matchQ(it.code)) return;
      var q = itemQty(st, it.code);
      var p = unitPrice(it, st);
      var priceTxt = p == null ? "待填" : ("$" + money(p) + "／" + (it.unit || "件"));
      var orig = it.orig != null ? ('<span class="pc-orig">原價 $' + money(it.orig) + "</span>") : "";
      html +=
        '<div class="pc-card">' +
          '<div class="pc-thumb" aria-hidden="true">🧴</div>' +
          '<div class="pc-card-body">' +
            "<strong>" + esc(it.name) + "</strong>" +
            '<div class="pc-meta"><code>' + esc(it.code) + '</code> · <span class="pc-price">' + esc(priceTxt) + '</span> ' + orig + '</div>' +
          "</div>" +
          qtyCtrl("item", it.code, q) +
        "</div>";
    });

    html += "</div>";
    return html;
  }

  function renderFloat(st, calc) {
    var payable = calc.total;
    if (st.senior) payable = Math.round(payable * 0.95 * 100) / 100;
    var progress = "";
    if (window.BPE_Gifts && window.BPE_Gifts.progressLine) {
      progress = window.BPE_Gifts.progressLine(window.BPE_Gifts.evaluate(calc.total, st));
    } else if (window.BPE_Gifts && window.BPE_Gifts.evaluate) {
      var ev = window.BPE_Gifts.evaluate(calc.total, st);
      progress = window.BPE_Gifts.progressLine(ev);
    }
    if (!progress) {
      progress = "共 " + calc.count + " 件";
    } else {
      progress = "共 " + calc.count + " 件 · " + progress;
    }

    return (
      '<div class="pc-float" id="pcFloat">' +
        '<button type="button" class="pc-float-progress" id="btnPcExpand" aria-expanded="' + (floatExpanded ? "true" : "false") + '">' +
          esc(progress) + ' <span aria-hidden="true">▾</span>' +
        "</button>" +
        '<div class="pc-float-total">$' + money(payable) + (st.senior ? '<span class="pc-senior-tag">銀髮價</span>' : "") + "</div>" +
        '<label class="pc-senior-toggle">' +
          '<span>銀髮優惠 95折</span>' +
          '<input type="checkbox" id="pcSenior" ' + (st.senior ? "checked" : "") + ' />' +
          '<span class="pc-switch" aria-hidden="true"></span>' +
        "</label>" +
        (floatExpanded
          ? ('<div class="pc-float-extra">' +
              (window.BPE_Gifts && window.BPE_Gifts.renderProgressHtml
                ? window.BPE_Gifts.renderProgressHtml(calc.total, st) : "") +
              (isAdmin()
                ? '<button type="button" class="btn-ghost" id="btnPcExport">匯出訂單</button>'
                : "") +
            "</div>")
          : "") +
        '<div class="pc-float-actions">' +
          '<button type="button" class="pc-clear" id="btnPcClear" aria-label="清除"><span aria-hidden="true">↺</span> 清除</button>' +
          '<button type="button" class="pc-preorder" id="btnPcPreorder">📋 預訂 $' + money(payable) + "</button>" +
        "</div>" +
      "</div>"
    );
  }

  function render() {
    var root = $("dimsumOrderRoot");
    if (!root) return;
    var st = loadState();
    var sheets = data().sheets || [];
    var sheet = sheets.filter(function (s) { return s.id === activeSheet; })[0] || sheets[0];
    if (sheet) activeSheet = sheet.id;
    var calc = calcTotals(st);

    var html = renderHero();
    html += renderSearchChips(st);
    html += '<div class="pc-list" id="pcList">';
    if (sheet) {
      (sheet.sections || []).forEach(function (sec) {
        html += renderSection(sec, st);
      });
    }
    html += "</div>";
    html += renderFloat(st, calc);
    root.innerHTML = html;

    var search = $("pcSearch");
    if (search) {
      search.addEventListener("input", function () {
        searchQ = search.value.trim();
        // re-render list only would be nicer; full render ok for MVP
        var pos = search.selectionStart;
        render();
        var again = $("pcSearch");
        if (again) {
          again.focus();
          try { again.setSelectionRange(pos, pos); } catch (e) {}
        }
      });
    }
  }

  function setQtyValue(kind, id, val) {
    var st = loadState();
    var n = Math.max(0, Math.floor(Number(val) || 0));
    if (kind === "set") {
      if (n <= 0) delete st.sets[id];
      else st.sets[id] = n;
    } else {
      if (n <= 0) delete st.items[id];
      else st.items[id] = n;
    }
    saveState(st);
    render();
  }

  function exportText() {
    var st = loadState();
    var calc = calcTotals(st);
    var payable = st.senior ? Math.round(calc.total * 0.95 * 100) / 100 : calc.total;
    var lines = ["2026 工展會 · 產品計數預訂", "———"];
    calc.lines.forEach(function (L) {
      if (L.amount == null) lines.push(L.label);
      else lines.push(L.label + "　$" + money(L.amount));
    });
    lines.push("———");
    lines.push("合計　$" + money(calc.total));
    if (st.senior) lines.push("銀髮 95 折實付　$" + money(payable));
    if (window.BPE_Gifts && window.BPE_Gifts.evaluate) {
      var gev = window.BPE_Gifts.evaluate(calc.total, st);
      if (gev.reached && gev.reached.length) {
        lines.push("可享禮遇：" + gev.reached.map(function (t) { return t.title; }).join("；"));
      }
    }
    lines.push("（參考用途，以攤位當日為準；送完即止）");
    return lines.join("\n");
  }

  function savePreorder() {
    var st = loadState();
    var calc = calcTotals(st);
    var payable = st.senior ? Math.round(calc.total * 0.95 * 100) / 100 : calc.total;
    var order = {
      id: "po-" + Date.now(),
      t: new Date().toISOString(),
      count: calc.count,
      total: calc.total,
      payable: payable,
      senior: !!st.senior,
      lines: calc.lines,
      gifts: (window.BPE_Gifts && window.BPE_Gifts.evaluate)
        ? window.BPE_Gifts.evaluate(calc.total, st).reached.map(function (t) { return t.title; })
        : []
    };
    try {
      var raw = localStorage.getItem("zihua_bpe_preorders_v1");
      var list = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(list)) list = [];
      list.unshift(order);
      localStorage.setItem("zihua_bpe_preorders_v1", JSON.stringify(list.slice(0, 50)));
    } catch (e) {}
    return order;
  }

  function bindRoot() {
    var root = $("dimsumOrderRoot");
    if (!root || root._pcBound) return;
    root._pcBound = true;
    root.addEventListener("click", function (e) {
      var tab = e.target.closest("[data-sheet]");
      if (tab) {
        activeSheet = tab.getAttribute("data-sheet");
        render();
        return;
      }
      var btn = e.target.closest(".qty-btn");
      if (btn) {
        var wrap = btn.closest(".qty-ctrl");
        if (!wrap) return;
        var cur = Math.max(0, Math.floor(Number((wrap.querySelector(".qty-val") || {}).textContent) || 0));
        setQtyValue(wrap.getAttribute("data-kind"), wrap.getAttribute("data-id"), cur + Number(btn.getAttribute("data-delta")));
        return;
      }
      if (e.target.closest("#btnPcExpand")) {
        floatExpanded = !floatExpanded;
        render();
        return;
      }
      if (e.target.closest("#btnPcClear")) {
        if (!confirm("清除全部數量？")) return;
        var st = loadState();
        saveState({ items: {}, sets: {}, overrides: st.overrides, senior: st.senior });
        render();
        return;
      }
      if (e.target.closest("#btnPcExport")) {
        var text = exportText();
        var blob = new Blob([text], { type: "text/plain;charset=utf-8" });
        var a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "bpe-preorder.txt";
        a.click();
        setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
        return;
      }
      if (e.target.closest("#btnPcPreorder")) {
        var order = savePreorder();
        var giftLine = (order.gifts && order.gifts.length) ? ("\n可享：" + order.gifts.join("；")) : "";
        alert("已預訂（本機）\n共 " + order.count + " 件\n實付 $" + money(order.payable) + giftLine + "\n\n請向攤位職員確認庫存同付款。");
        return;
      }
    });
    root.addEventListener("change", function (e) {
      if (e.target && e.target.id === "pcSenior") {
        var st = loadState();
        st.senior = !!e.target.checked;
        saveState(st);
        render();
      }
    });
  }

  window.BPE_DimsumOrderUI = {
    render: function () { bindRoot(); render(); },
    clear: function () {
      saveState({ items: {}, sets: {}, overrides: {}, senior: false });
      render();
    }
  };
})();
