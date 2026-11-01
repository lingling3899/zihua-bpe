/* 會場購物禮遇 — 最高滿額一級＋年曆卡＋杯墊條件＋銀髮實付 */
(function () {
  "use strict";

  var LS_CFG = "zihua_bpe_gifts_v3";

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
          applyNote: t.applyNote != null ? String(t.applyNote) : (sb.applyNote || ""),
          cardLabel: t.cardLabel != null ? String(t.cardLabel) : (sb.cardLabel || ""),
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
    } catch (e) { /* ignore */ }
    return normalize(deepClone(seed()));
  }
  function saveConfig(cfg) {
    try { localStorage.setItem(LS_CFG, JSON.stringify(normalize(cfg))); } catch (e) { /* ignore */ }
  }
  function resetConfig() {
    try { localStorage.removeItem(LS_CFG); } catch (e) {}
    try { localStorage.removeItem("zihua_bpe_gifts_v2"); } catch (e2) {}
    try { localStorage.removeItem("zihua_bpe_gifts_v1"); } catch (e3) {}
  }

  function loadOrderState() {
    try {
      var raw = localStorage.getItem("zihua_bpe_dimsum_order_v1");
      if (raw) {
        var o = JSON.parse(raw);
        return { items: o.items || {}, sets: o.sets || {}, overrides: o.overrides || {}, senior: !!o.senior };
      }
    } catch (e) {}
    return { items: {}, sets: {}, overrides: {}, senior: false };
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

  function payableTotal(gross, senior) {
    var t = Math.max(0, Number(gross) || 0);
    if (senior) t = Math.round(t * 0.95 * 100) / 100;
    return t;
  }

  function evaluate(grossTotal, orderSt) {
    var cfg = getConfig();
    var st = orderSt || loadOrderState();
    var senior = !!(st && st.senior);
    var payable = payableTotal(grossTotal, senior);
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
      gross: Math.max(0, Number(grossTotal) || 0),
      payable: payable,
      senior: senior,
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
      if (ev.senior) {
        parts.push('<p class="gift-progress-line muted">銀髮 95 折後實付 $' + money(ev.payable) + "（以此計贈品）</p>");
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
        return (
          '<div class="gift-tier-card' + (t.soldOut ? " sold" : "") + '">' +
            '<div class="gift-tier-emoji" aria-hidden="true">' + esc(t.emoji) + "</div>" +
            '<div class="gift-tier-text">' + esc(t.cardLabel || ("滿 $" + t.amount + " " + t.title)) + "</div>" +
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
        "<li>銀髮 95 折後以實付金額計贈品資格</li>" +
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
