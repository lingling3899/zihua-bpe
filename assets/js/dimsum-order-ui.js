/* 產品計數 · 結算 — 必揀付款；先減優惠券，再銀髮 95 折 */
(function () {
  "use strict";

  var LS_KEY = "zihua_bpe_dimsum_order_v1";
  var activeSheet = "zihua";
  var searchQ = "";
  var floatExpanded = false;

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

  var COUPON_CHIPS = [0, 50, 100];

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
  function payLabel(id) {
    for (var i = 0; i < PAY_METHODS.length; i++) {
      if (PAY_METHODS[i].id === id) return PAY_METHODS[i].label;
    }
    return id || "";
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
          senior: !!o.senior,
          paymentMethod: o.paymentMethod || "",
          couponAmount: Math.max(0, Number(o.couponAmount) || 0)
        };
      }
    } catch (e) {}
    return { items: {}, sets: {}, overrides: {}, senior: false, paymentMethod: "", couponAmount: 0 };
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

  /** 合計 → 減優惠券（唔低過 0）→ 銀髮 95 折 */
  function pricing(st, calc) {
    var subtotal = Math.max(0, Math.round((Number(calc.total) || 0) * 100) / 100);
    var couponRaw = Math.max(0, Number(st.couponAmount) || 0);
    var couponAmount = Math.min(couponRaw, subtotal);
    couponAmount = Math.round(couponAmount * 100) / 100;
    var afterCoupon = Math.round((subtotal - couponAmount) * 100) / 100;
    var payable = afterCoupon;
    if (st.senior) payable = Math.round(afterCoupon * 0.95 * 100) / 100;
    return {
      subtotal: subtotal,
      couponAmount: couponAmount,
      afterCoupon: afterCoupon,
      payable: payable,
      senior: !!st.senior,
      paymentMethod: st.paymentMethod || ""
    };
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
        "<h2>產品計數 · 結算</h2>" +
        (window.BPE_Gifts && window.BPE_Gifts.renderGiftCardsHtml
          ? window.BPE_Gifts.renderGiftCardsHtml()
          : "") +
        '<p class="pc-hero-note">套裝價自動計算 · 花香套／5 支花香油送杯墊 · 任何消費送 2027 年曆卡 · 滿額贈品以最高一級計 · 先減優惠券，再銀髮 95 折，以最終實付計禮遇 · 送完即止</p>' +
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
      var stockBadge = (window.BPE_Stock && window.BPE_Stock.stockBadgeHtml)
        ? window.BPE_Stock.stockBadgeHtml(it.code) : "";
      html +=
        '<div class="pc-card">' +
          '<div class="pc-thumb" aria-hidden="true">🧴</div>' +
          '<div class="pc-card-body">' +
            "<strong>" + esc(it.name) + "</strong>" +
            '<div class="pc-meta"><code>' + esc(it.code) + '</code> · <span class="pc-price">' + esc(priceTxt) + '</span> ' + orig +
              (stockBadge ? (" · " + stockBadge) : "") + '</div>' +
          "</div>" +
          qtyCtrl("item", it.code, q) +
        "</div>";
    });

    html += "</div>";
    return html;
  }

  function renderBreakdown(pr) {
    var rows =
      '<div class="pc-break-row"><span>合計</span><strong>$' + money(pr.subtotal) + "</strong></div>" +
      '<div class="pc-break-row"><span>減優惠券</span><strong' +
        (pr.couponAmount > 0 ? ' class="pc-break-minus"' : "") +
        ">−$" + money(pr.couponAmount) + "</strong></div>" +
      '<div class="pc-break-row"><span>折前／券後</span><strong>$' + money(pr.afterCoupon) + "</strong></div>";
    if (pr.senior) {
      rows +=
        '<div class="pc-break-row"><span>銀髮 95 折</span><strong>$' + money(pr.payable) + "</strong></div>";
    }
    rows +=
      '<div class="pc-break-row pc-break-pay"><span>實付</span><strong>$' + money(pr.payable) + "</strong></div>";
    return '<div class="pc-breakdown" aria-label="金額明細">' + rows + "</div>";
  }

  function renderFloat(st, calc, pr) {
    var progress = "";
    if (window.BPE_Gifts && window.BPE_Gifts.evaluate) {
      var ev = window.BPE_Gifts.evaluate(calc.total, st);
      progress = window.BPE_Gifts.progressLine(ev);
    }
    if (!progress) {
      progress = "共 " + calc.count + " 件";
    } else {
      progress = "共 " + calc.count + " 件 · " + progress;
    }

    var hasPay = !!st.paymentMethod;
    var settleCls = "pc-preorder" + (hasPay ? "" : " pc-settle-need-pay");
    var settleLabel = hasPay
      ? ("💳 結算 $" + money(pr.payable))
      : "請先揀付款方式";

    return (
      '<div class="pc-float" id="pcFloat">' +
        '<button type="button" class="pc-float-progress" id="btnPcExpand" aria-expanded="' + (floatExpanded ? "true" : "false") + '">' +
          esc(progress) + ' <span aria-hidden="true">▾</span>' +
        "</button>" +
        '<div class="pc-float-total">$' + money(pr.payable) +
          (pr.senior ? '<span class="pc-senior-tag">銀髮價</span>' : "") +
          (pr.couponAmount > 0 ? '<span class="pc-coupon-tag">已減券</span>' : "") +
        "</div>" +
        renderBreakdown(pr) +
        '<div class="pc-coupon-row">' +
          '<label class="pc-coupon-label" for="pcCoupon">優惠券（先減券）</label>' +
          '<div class="pc-coupon-chips">' +
            COUPON_CHIPS.map(function (n) {
              var on = Number(st.couponAmount) === n ? " active" : "";
              return (
                '<button type="button" class="pc-coupon-chip' + on + '" data-coupon="' + n + '">$' + n + "</button>"
              );
            }).join("") +
            '<button type="button" class="pc-coupon-chip' +
              (COUPON_CHIPS.indexOf(Number(st.couponAmount)) < 0 && Number(st.couponAmount) > 0 ? " active" : "") +
              '" data-coupon="custom">自訂</button>' +
          "</div>" +
          '<input type="number" id="pcCoupon" class="pc-coupon-input" min="0" step="1" inputmode="decimal" ' +
            'placeholder="0" value="' + esc(String(st.couponAmount || 0)) + '" aria-label="優惠券金額" />' +
        "</div>" +
        '<label class="pc-senior-toggle">' +
          '<span>銀髮優惠 95折（減券後）</span>' +
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
          '<button type="button" class="' + settleCls + '" id="btnPcSettle">' + esc(settleLabel) + "</button>" +
        "</div>" +
      "</div>"
    );
  }

  function renderPayment(st) {
    var chips = PAY_METHODS.map(function (m) {
      var on = st.paymentMethod === m.id ? " active" : "";
      return (
        '<button type="button" class="pay-chip' + on + '" data-pay="' + esc(m.id) + '" aria-pressed="' +
          (st.paymentMethod === m.id ? "true" : "false") + '">' + esc(m.label) + "</button>"
      );
    }).join("");
    return (
      '<section class="panel pay-panel pc-pay" aria-labelledby="pcPayTitle">' +
        '<h3 id="pcPayTitle">💳 付款方式</h3>' +
        '<p class="pay-note">請揀一種付款方式先可以結算。凡購物可用：八達通、現金港幣、Alipay、WeChat Pay、PayMe、VISA、Mastercard、銀聯</p>' +
        '<a class="pay-open" href="assets/img/payment/payment-methods.jpg?v=20261105e" target="_blank" rel="noopener" title="開大圖">' +
          '<img class="pay-img" src="assets/img/payment/payment-methods.jpg?v=20261105e" width="1079" height="728" loading="lazy" decoding="async" alt="付款方式：凡購物可使用八達通、港幣現金、Alipay 支付寶、微信支付、PayMe、VISA、Mastercard、銀聯 UnionPay" />' +
        "</a>" +
        '<div class="pay-chips" role="group" aria-label="揀付款方式">' + chips + "</div>" +
        (st.paymentMethod
          ? ('<p class="pay-selected">已揀：<strong>' + esc(payLabel(st.paymentMethod)) + "</strong></p>")
          : '<p class="pay-selected pay-need">尚未揀付款方式</p>') +
      "</section>"
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
    var pr = pricing(st, calc);

    var html = renderHero();
    html += renderSearchChips(st);
    html += '<div class="pc-list" id="pcList">';
    if (sheet) {
      (sheet.sections || []).forEach(function (sec) {
        html += renderSection(sec, st);
      });
    }
    html += "</div>";
    html += renderPayment(st);
    html += renderFloat(st, calc, pr);
    root.innerHTML = html;

    var search = $("pcSearch");
    if (search) {
      search.addEventListener("input", function () {
        searchQ = search.value.trim();
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
    var pr = pricing(st, calc);
    var lines = ["2026 工展會 · 產品計數結算", "———"];
    calc.lines.forEach(function (L) {
      if (L.amount == null) lines.push(L.label);
      else lines.push(L.label + "　$" + money(L.amount));
    });
    lines.push("———");
    lines.push("合計　$" + money(pr.subtotal));
    lines.push("減優惠券　−$" + money(pr.couponAmount));
    lines.push("折前／券後　$" + money(pr.afterCoupon));
    if (pr.senior) lines.push("銀髮 95 折實付　$" + money(pr.payable));
    else lines.push("實付　$" + money(pr.payable));
    if (pr.paymentMethod) lines.push("付款方式　" + payLabel(pr.paymentMethod));
    if (window.BPE_Gifts && window.BPE_Gifts.evaluate) {
      var gev = window.BPE_Gifts.evaluate(calc.total, st);
      if (gev.reached && gev.reached.length) {
        lines.push("可享禮遇：" + gev.reached.map(function (t) { return t.title; }).join("；"));
      }
    }
    lines.push("（參考用途，以攤位當日為準；送完即止）");
    return lines.join("\n");
  }

  function saveSettle() {
    var st = loadState();
    var calc = calcTotals(st);
    var pr = pricing(st, calc);
    var giftTitles = [];
    if (window.BPE_Gifts && window.BPE_Gifts.evaluate) {
      giftTitles = window.BPE_Gifts.evaluate(calc.total, st).reached.map(function (t) { return t.title; });
    }
    var order = {
      id: "po-" + Date.now(),
      t: new Date().toISOString(),
      count: calc.count,
      subtotal: pr.subtotal,
      total: pr.subtotal,
      couponAmount: pr.couponAmount,
      afterCoupon: pr.afterCoupon,
      payable: pr.payable,
      senior: !!pr.senior,
      paymentMethod: pr.paymentMethod,
      paymentLabel: payLabel(pr.paymentMethod),
      lines: calc.lines,
      gifts: giftTitles
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
      var payBtn = e.target.closest("[data-pay]");
      if (payBtn) {
        var stPay = loadState();
        var pid = payBtn.getAttribute("data-pay");
        stPay.paymentMethod = stPay.paymentMethod === pid ? "" : pid;
        saveState(stPay);
        render();
        return;
      }
      var couponChip = e.target.closest("[data-coupon]");
      if (couponChip) {
        var stC = loadState();
        var cv = couponChip.getAttribute("data-coupon");
        if (cv === "custom") {
          var inp = $("pcCoupon");
          if (inp) {
            inp.focus();
            inp.select();
          }
          return;
        }
        stC.couponAmount = Math.max(0, Number(cv) || 0);
        saveState(stC);
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
        saveState({
          items: {},
          sets: {},
          overrides: st.overrides,
          senior: st.senior,
          paymentMethod: st.paymentMethod,
          couponAmount: st.couponAmount
        });
        render();
        return;
      }
      if (e.target.closest("#btnPcExport")) {
        var text = exportText();
        var blob = new Blob([text], { type: "text/plain;charset=utf-8" });
        var a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "bpe-settle.txt";
        a.click();
        setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
        return;
      }
      if (e.target.closest("#btnPcSettle") || e.target.closest("#btnPcPreorder")) {
        var stS = loadState();
        if (!stS.paymentMethod) {
          alert("請先揀付款方式");
          var panel = root.querySelector(".pc-pay");
          if (panel && panel.scrollIntoView) {
            panel.scrollIntoView({ behavior: "smooth", block: "center" });
          }
          return;
        }
        var calcS = calcTotals(stS);
        if (calcS.count <= 0) {
          alert("未有產品，請先加數量。");
          return;
        }
        var order = saveSettle();
        var giftLine = (order.gifts && order.gifts.length) ? ("\n可享：" + order.gifts.join("；")) : "";
        alert(
          "已結算（本機）\n" +
          "付款：" + order.paymentLabel + "\n" +
          "共 " + order.count + " 件\n" +
          "合計 $" + money(order.subtotal) + "\n" +
          "減優惠券 −$" + money(order.couponAmount) + "\n" +
          "折前／券後 $" + money(order.afterCoupon) + "\n" +
          (order.senior ? ("銀髮 95 折\n") : "") +
          "實付 $" + money(order.payable) +
          giftLine +
          "\n\n請向攤位職員確認庫存同付款。"
        );
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
    root.addEventListener("input", function (e) {
      if (e.target && e.target.id === "pcCoupon") {
        var st = loadState();
        var v = Number(e.target.value);
        if (isNaN(v) || v < 0) v = 0;
        st.couponAmount = Math.round(v * 100) / 100;
        saveState(st);
        // soft refresh of totals without stealing focus: update float numbers via re-render
        // keep cursor in coupon field
        var pos = e.target.selectionStart;
        render();
        var again = $("pcCoupon");
        if (again) {
          again.focus();
          try { again.setSelectionRange(pos, pos); } catch (err) {}
        }
      }
    });
  }

  window.BPE_DimsumOrderUI = {
    render: function () { bindRoot(); render(); },
    clear: function () {
      saveState({ items: {}, sets: {}, overrides: {}, senior: false, paymentMethod: "", couponAmount: 0 });
      render();
    },
    pricing: function () {
      var st = loadState();
      return pricing(st, calcTotals(st));
    }
  };
})();
