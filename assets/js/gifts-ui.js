/* 會場購物禮遇 — 最高滿額一級＋年曆卡＋杯墊條件＋券／滿115／關節85／銀髮實付（未計膠袋） */
(function () {
  "use strict";

  var LS_CFG = "zihua_bpe_gifts_v4";

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
  function isAdmin() {
    if (window.ZihuaStaffAuth && window.ZihuaStaffAuth.isAdmin) {
      return !!window.ZihuaStaffAuth.isAdmin();
    }
    var a = window.ZihuaAdminAuth;
    return !!(a && a.isLoggedIn && a.isLoggedIn());
  }
  function deepClone(o) { return JSON.parse(JSON.stringify(o)); }

  function seed() {
    return window.BPE_GIFTS_SEED || {
      title: "會場購物禮遇", subtitle: "", disclaimer: "送完即止。",
      enabled: true, coasterSetCodes: ["Z0007A","Z0007B","Z0007C"],
      coasterScentCodes: ["ZE05","ZE06","ZE07"], coasterScentMin: 5,
      spendTierIds: ["magnet168","umbrella328","bag488"], tiers: []
    };
  }

  function normalize(cfg) {
    var base = seed();
    if (!cfg || typeof cfg !== "object") cfg = {};
    var tiersIn = Array.isArray(cfg.tiers) ? cfg.tiers : base.tiers;
    var byId = {};
    (base.tiers || []).forEach(function (t) { byId[t.id] = t; });
    return {
      title: cfg.title != null ? String(cfg.title) : base.title,
      subtitle: cfg.subtitle != null ? String(cfg.subtitle) : base.subtitle,
      disclaimer: cfg.disclaimer != null ? String(cfg.disclaimer) : base.disclaimer,
      enabled: cfg.enabled !== false,
      coasterSetCodes: Array.isArray(cfg.coasterSetCodes) ? cfg.coasterSetCodes.slice() : (base.coasterSetCodes || []).slice(),
      coasterScentCodes: Array.isArray(cfg.coasterScentCodes) ? cfg.coasterScentCodes.slice() : (base.coasterScentCodes || []).slice(),
      coasterScentMin: Number(cfg.coasterScentMin != null ? cfg.coasterScentMin : base.coasterScentMin) || 5,
      spendTierIds: Array.isArray(cfg.spendTierIds) ? cfg.spendTierIds.slice() : (base.spendTierIds || []).slice(),
      tiers: (tiersIn || []).map(function (t) {
        var sb = byId[t.id] || {};
        return {
          id: t.id || sb.id || ("t" + (t.amount || 0)),
          amount: Number(t.amount != null ? t.amount : sb.amount) || 0,
          kind: t.kind || sb.kind || "total",
          title: t.title != null ? String(t.title) : (sb.title || ""),
          desc: t.desc != null ? String(t.desc) : (sb.desc || ""),
          emoji: t.emoji != null ? String(t.emoji) : (sb.emoji || "🎁"),
          img: (t.img != null && String(t.img).trim() !== "") ? String(t.img) : (sb.img || ""),
          applyNote: t.applyNote != null ? String(t.applyNote) : (sb.applyNote || ""),
          cardLabel: t.cardLabel != null ? String(t.cardLabel) : (sb.cardLabel || ""),
          sku: (t.sku != null && String(t.sku).trim() !== "") ? String(t.sku).trim() : (sb.sku || ""),
          soldOut: !!t.soldOut,
          paused: !!t.paused
        };
      })
    };
  }

  function getConfig() {
    try {
      var raw = localStorage.getItem(LS_CFG);
      if (raw) return normalize(JSON.parse(raw));
      var oldRaw = localStorage.getItem("zihua_bpe_gifts_v3");
      if (oldRaw) {
        var oldCfg = JSON.parse(oldRaw);
        var cfg = normalize(deepClone(seed()));
        var sold = {};
        (oldCfg.tiers || []).forEach(function (t) {
          if (t && t.id) sold[t.id] = !!t.soldOut;
        });
        cfg.tiers.forEach(function (t) {
          if (sold[t.id]) t.soldOut = true;
        });
        return cfg;
      }
    } catch (e) { /* ignore */ }
    return normalize(deepClone(seed()));
  }
  function saveConfig(cfg) {
    try { localStorage.setItem(LS_CFG, JSON.stringify(normalize(cfg))); } catch (e) { /* ignore */ }
  }
  function resetConfig() {
    try { localStorage.removeItem(LS_CFG); } catch (e) {}
    try { localStorage.removeItem("zihua_bpe_gifts_v3"); } catch (e2) {}
    try { localStorage.removeItem("zihua_bpe_gifts_v2"); } catch (e3) {}
    try { localStorage.removeItem("zihua_bpe_gifts_v1"); } catch (e4) {}
  }

  function loadOrderState() {
    try {
      var raw = localStorage.getItem("zihua_bpe_dimsum_order_v1");
      if (raw) {
        var o = JSON.parse(raw);
        return {
          items: o.items || {},
          sets: o.sets || {},
          setPicks: o.setPicks || {},
          overrides: o.overrides || {},
          senior: !!o.senior,
          promo115: !!o.promo115,
          cupal85: !!o.cupal85,
          angong80: !!o.angong80,
          cupal9: !!o.cupal9,
          plasticBag: !!o.plasticBag,
          nmnGift: !!o.nmnGift,
          paymentMethod: o.paymentMethod || "",
          couponAmount: Math.max(0, Number(o.couponAmount) || 0)
        };
      }
    } catch (e) {}
    return { items: {}, sets: {}, setPicks: {}, overrides: {}, senior: false, promo115: false, cupal85: false, angong80: false, cupal9: false, plasticBag: false, nmnGift: false, paymentMethod: "", couponAmount: 0 };
  }

  function qtyOf(map, codes) {
    var n = 0;
    (codes || []).forEach(function (c) {
      n += Math.max(0, Math.floor(Number(map[c] || 0)));
    });
    return n;
  }

  /** 花香套裝數量，或花香油單支 ≥ coasterScentMin */
  function qualifiesCoaster(cfg, orderSt) {
    var items = (orderSt && orderSt.items) || {};
    if (qtyOf(items, cfg.coasterSetCodes) > 0) return true;
    if (qtyOf(items, cfg.coasterScentCodes) >= (cfg.coasterScentMin || 5)) return true;
    return false;
  }

  /** 合計 → 減券 → 滿$115減$15 → 安宮減$80 → 關節85折 → 銀髮95折；滿額禮遇用實付（未計袋） */
  function payableTotal(gross, orderSt) {
    var st = orderSt || {};
    if (window.BPE_DimsumOrderUI && typeof window.BPE_DimsumOrderUI.pricingFrom === "function") {
      return window.BPE_DimsumOrderUI.pricingFrom(st, { total: gross });
    }
    var t = Math.max(0, Number(gross) || 0);
    var c = Math.max(0, Number(st.couponAmount) || 0);
    if (c > t) c = t;
    c = Math.round(c * 100) / 100;
    var afterCoupon = Math.round((t - c) * 100) / 100;
    var afterPromo = afterCoupon;
    var promo115Applied = !!st.promo115 && afterCoupon >= 115;
    if (promo115Applied) afterPromo = Math.round((afterCoupon - 15) * 100) / 100;
    var afterCupal = afterPromo;
    // fallback：無 dimsum API 時，cupal85 以整單合計 ≥1200 作門檻（正式路徑用 pricingFrom）
    var cupal85Applied = !!st.cupal85 && afterCoupon >= 1200;
    if (cupal85Applied) afterCupal = Math.round(afterPromo * 0.85 * 100) / 100;
    var payableBeforeBag = afterCupal;
    if (st.senior) payableBeforeBag = Math.round(afterCupal * 0.95 * 100) / 100;
    var bagFee = st.plasticBag ? 1 : 0;
    var payable = Math.round((payableBeforeBag + bagFee) * 100) / 100;
    return {
      subtotal: t,
      couponAmount: c,
      afterCoupon: afterCoupon,
      promo115Applied: promo115Applied,
      promo115Amount: promo115Applied ? 15 : 0,
      cupal85Applied: cupal85Applied,
      afterCupal85: afterCupal,
      senior: !!st.senior,
      plasticBag: !!st.plasticBag,
      bagFee: bagFee,
      payableBeforeBag: payableBeforeBag,
      payable: payable
    };
  }

  function evaluate(grossTotal, orderSt) {
    var cfg = getConfig();
    var st = orderSt || loadOrderState();
    var senior = !!(st && st.senior);
    var coupon = Math.max(0, Number(st && st.couponAmount) || 0);
    var gross = Math.max(0, Number(grossTotal) || 0);
    if (coupon > gross) coupon = gross;
    coupon = Math.round(coupon * 100) / 100;
    var pr = payableTotal(gross, st);
    var afterCoupon = pr.afterCoupon;
    var payable = pr.payableBeforeBag != null ? pr.payableBeforeBag : pr.payable;
    var active = (cfg.tiers || []).filter(function (x) { return !x.paused; });

    var calendar = null, coaster = null;
    var spendReached = [];
    active.forEach(function (tier) {
      if (tier.kind === "any") {
        if (payable > 0) calendar = tier;
      } else if (tier.kind === "coaster" || tier.kind === "set70") {
        if (qualifiesCoaster(cfg, st)) coaster = tier;
      } else if (tier.kind === "total") {
        if (payable >= Number(tier.amount || 0)) spendReached.push(tier);
      }
    });
    spendReached.sort(function (a, b) { return Number(a.amount) - Number(b.amount); });
    var highestSpend = spendReached.length ? spendReached[spendReached.length - 1] : null;

    var nextSpend = null;
    active.forEach(function (tier) {
      if (tier.kind !== "total" || tier.paused) return;
      var gap = Math.round((tier.amount - payable) * 100) / 100;
      if (gap <= 0) return;
      if (!nextSpend || gap < nextSpend.gap) nextSpend = { tier: tier, gap: gap };
    });

    var reached = [];
    if (calendar) reached.push(calendar);
    if (coaster) reached.push(coaster);
    if (highestSpend) reached.push(highestSpend);

    return {
      enabled: cfg.enabled !== false,
      cfg: cfg,
      gross: gross,
      couponAmount: coupon,
      afterCoupon: afterCoupon,
      payable: payable,
      senior: senior,
      promo115Applied: !!pr.promo115Applied,
      cupal85Applied: !!pr.cupal85Applied,
      angong80Applied: !!pr.angong80Applied,
      cupal9Applied: !!pr.cupal9Applied,
      plasticBag: !!pr.plasticBag,
      payableBeforeBag: payable,
      nmnGiftApplied: !!pr.nmnGiftApplied,
      reached: reached,
      highestSpend: highestSpend,
      calendar: calendar,
      coaster: coaster,
      next: nextSpend,
      hasCoasterSet: qualifiesCoaster(cfg, st)
    };
  }

  function progressLine(ev) {
    if (!ev.enabled) return "";
    if (ev.payable <= 0) return "落單後顯示可享禮遇（任何消費送年曆卡）";
    if (ev.next) {
      return "再買 $" + money(ev.next.gap) + " 送" + ev.next.tier.title;
    }
    if (ev.highestSpend) return "已達最高階：" + ev.highestSpend.title;
    if (ev.calendar) return "可享：" + ev.calendar.title;
    return "";
  }

  function renderProgressHtml(grossTotal, orderSt) {
    var ev = evaluate(grossTotal, orderSt);
    if (!ev.enabled) return "";
    var parts = [];
    parts.push('<div class="gift-progress" id="dimsumGiftProgress">');
    if (ev.payable <= 0) {
      parts.push('<p class="gift-progress-line muted">落單後顯示可享禮遇</p>');
    } else {
      var names = ev.reached.map(function (t) {
        return t.emoji + " " + t.title + (t.soldOut ? "（已送完）" : "");
      });
      parts.push('<p class="gift-progress-line"><strong>目前可享：</strong>' + esc(names.join("；") || "—") + "</p>");
      if (ev.couponAmount > 0 || ev.promo115Applied || ev.cupal85Applied || ev.angong80Applied || ev.cupal9Applied || ev.senior) {
        var bits = [];
        if (ev.couponAmount > 0) bits.push("減券 $" + money(ev.couponAmount));
        if (ev.promo115Applied) bits.push("滿$115減$15");
        if (ev.angong80Applied) bits.push("安宮減$80");
        if (ev.cupal85Applied) bits.push("關節 85折");
        if (ev.cupal9Applied) bits.push("正價 9折");
        if (ev.senior) bits.push("銀髮 95 折");
        parts.push('<p class="gift-progress-line muted">' + bits.join(" → ") + "後實付 $" + money(ev.payable) + "（未計膠袋，以此計贈品）</p>");
      }
      if (ev.next) {
        parts.push('<p class="gift-progress-line">再買 <strong>$' + money(ev.next.gap) + "</strong> 送" + esc(ev.next.tier.title) + "</p>");
      }
    }
    parts.push("</div>");
    return parts.join("");
  }

  function renderGiftCardsHtml() {
    var cfg = getConfig();
    var spend = (cfg.tiers || []).filter(function (t) { return t.kind === "total"; });
    return (
      '<div class="gift-tier-cards" aria-label="滿額贈品">' +
      spend.map(function (t) {
        var fallbackImg = ({ magnet168: "assets/img/gifts/magnet.jpg", umbrella328: "assets/img/gifts/umbrella.jpg", bag488: "assets/img/gifts/bag.jpg" })[t.id] || "";
        var imgSrc = (t.img && String(t.img).trim()) || fallbackImg;
        var icon = imgSrc
          ? '<img class="gift-tier-img" src="' + esc(imgSrc) + '?v=20261110b" width="128" height="128" alt="" loading="lazy" decoding="async" />'
          : '<div class="gift-tier-emoji" aria-hidden="true">' + esc(t.emoji) + "</div>";
        return (
          '<div class="gift-tier-card' + (t.soldOut ? " sold" : "") + '">' +
            icon +
            '<div class="gift-tier-text">' + esc(t.cardLabel || ("滿 $" + t.amount + " " + t.title)) + "</div>" +
            (t.sku ? '<div class="gift-tier-sku"><code>' + esc(t.sku) + "</code></div>" : "") +
            (t.soldOut ? '<span class="gift-tag sold">已送完</span>' : "") +
          "</div>"
        );
      }).join("") +
      "</div>"
    );
  }

  function renderRulesHtml() {
    var cfg = getConfig();
    return (
      '<ul class="gift-rules">' +
        "<li>套裝價自動計算</li>" +
        "<li>花香套裝或任選 5 支花香油送陶瓷杯墊</li>" +
        "<li>任何消費送 2027 年曆卡</li>" +
        "<li>滿額贈品（磁石／雨傘／手提袋）以最高一級計</li>" +
        "<li>先減優惠券，再滿$115減$15／安宮減$80／關節85折／銀髮95折，以最終實付（未計膠購物袋）計贈品資格</li>" +
        "<li>送完即止；以攤位當日為準</li>" +
      "</ul>" +
      '<p class="claim-safe">' + esc(cfg.disclaimer) + "</p>"
    );
  }

  function render() {
    var root = document.getElementById("giftsRoot");
    if (!root) return;
    var cfg = getConfig();
    var html = "";
    html += "<h3>" + esc(cfg.title) + ' <span class="badge">送完即止</span></h3>';
    html += '<p class="muted">' + esc(cfg.subtitle) + "</p>";
    html += renderGiftCardsHtml();
    html += renderRulesHtml();
    if (isAdmin()) {
      html += '<div class="admin-only gift-admin" style="margin-top:12px;">';
      html += "<h4>職員：標示已送完</h4>";
      (cfg.tiers || []).forEach(function (t) {
        html +=
          '<label class="gift-sold-row"><input type="checkbox" data-gift-sold="' + esc(t.id) + '"' +
          (t.soldOut ? " checked" : "") + " /> " + esc(t.emoji + " " + t.title) + "</label>";
      });
      html += '<div class="btn-row"><button type="button" class="admin-btn" id="btnSaveGiftSold">儲存</button>' +
        '<button type="button" class="btn-ghost" id="btnResetGifts">還原 seed</button></div></div>';
    }
    root.innerHTML = html;
  }

  function bind() {
    var root = document.getElementById("giftsRoot");
    if (!root || root._giftsBound) return;
    root._giftsBound = true;
    root.addEventListener("click", function (e) {
      if (e.target.closest("#btnSaveGiftSold")) {
        var cfg = getConfig();
        root.querySelectorAll("[data-gift-sold]").forEach(function (inp) {
          var id = inp.getAttribute("data-gift-sold");
          cfg.tiers.forEach(function (t) {
            if (t.id === id) t.soldOut = !!inp.checked;
          });
        });
        saveConfig(cfg);
        render();
        return;
      }
      if (e.target.closest("#btnResetGifts")) {
        if (!confirm("還原禮遇 seed？")) return;
        resetConfig();
        render();
      }
    });
  }

  window.BPE_Gifts = {
    getConfig: getConfig,
    saveConfig: saveConfig,
    resetConfig: resetConfig,
    evaluate: evaluate,
    payableTotal: payableTotal,
    progressLine: progressLine,
    renderProgressHtml: renderProgressHtml,
    renderGiftCardsHtml: renderGiftCardsHtml,
    renderRulesHtml: renderRulesHtml,
    render: function () { bind(); render(); },
    qualifiesCoaster: qualifiesCoaster
  };
})();
