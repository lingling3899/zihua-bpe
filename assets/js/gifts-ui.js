/* 會場購物禮遇 — 新階梯；合計聯動；$70 套條件；職員可標已送完 */
(function () {
  "use strict";

  var LS_CFG = "zihua_bpe_gifts_v2";

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
  function isAdmin() {
    var a = window.ZihuaAdminAuth;
    return !!(a && a.isLoggedIn && a.isLoggedIn());
  }
  function deepClone(o) {
    return JSON.parse(JSON.stringify(o));
  }

  function seed() {
    return window.BPE_GIFTS_SEED || {
      title: "會場購物禮遇",
      subtitle: "",
      disclaimer: "送完即止。",
      enabled: true,
      coasterSetCodes: ["Z0007A", "Z0007B", "Z0007C"],
      coasterScentCodes: ["ZE05", "ZE06", "ZE07"],
      coasterOil6Codes: ["CO98"],
      tiers: []
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
      coasterOil6Codes: Array.isArray(cfg.coasterOil6Codes) ? cfg.coasterOil6Codes.slice() : (base.coasterOil6Codes || []).slice(),
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
    try { localStorage.removeItem(LS_CFG); } catch (e) { /* ignore */ }
    try { localStorage.removeItem("zihua_bpe_gifts_v1"); } catch (e2) { /* ignore */ }
    try { localStorage.removeItem("zihua_bpe_gift_choice_v1"); } catch (e3) { /* ignore */ }
  }

  function loadOrderState() {
    try {
      var raw = localStorage.getItem("zihua_bpe_dimsum_order_v1");
      if (raw) {
        var o = JSON.parse(raw);
        return { items: o.items || {}, sets: o.sets || {}, overrides: o.overrides || {} };
      }
    } catch (e) { /* ignore */ }
    return { items: {}, sets: {}, overrides: {} };
  }

  function qtyOf(map, codes) {
    var n = 0;
    (codes || []).forEach(function (c) {
      n += Math.max(0, Math.floor(Number(map[c] || 0)));
    });
    return n;
  }

  /** $70 杯墊：指定套裝數量，或以 1 花香＋2×6ml 組成 */
  function qualifiesCoaster(cfg, orderSt) {
    var items = (orderSt && orderSt.items) || {};
    if (qtyOf(items, cfg.coasterSetCodes) > 0) return true;
    var scent = qtyOf(items, cfg.coasterScentCodes);
    var oil6 = qtyOf(items, cfg.coasterOil6Codes);
    if (scent >= 1 && oil6 >= 2) return true;
    return false;
  }

  function tierReached(tier, total, cfg, orderSt) {
    if (tier.paused) return false;
    var t = Math.max(0, Number(total) || 0);
    if (tier.kind === "any") return t > 0;
    if (tier.kind === "set70") {
      return qualifiesCoaster(cfg, orderSt) && t >= Number(tier.amount || 70);
    }
    return t >= Number(tier.amount || 0);
  }

  /** 列出已達各層；下一階（合計類）差幾多；杯墊未達時另提示套條件 */
  function evaluate(total, orderSt) {
    var cfg = getConfig();
    var st = orderSt || loadOrderState();
    var t = Math.max(0, Number(total) || 0);
    var active = (cfg.tiers || []).filter(function (x) { return !x.paused; });
    var reached = [];
    var missed = [];
    active.forEach(function (tier) {
      if (tierReached(tier, t, cfg, st)) reached.push(tier);
      else missed.push(tier);
    });

    var nextTotal = null;
    missed.forEach(function (tier) {
      if (tier.kind !== "total") return;
      var gap = Math.round((tier.amount - t) * 100) / 100;
      if (gap <= 0) return;
      if (!nextTotal || gap < nextTotal.gap) {
        nextTotal = { tier: tier, gap: gap };
      }
    });

    var coasterPending = null;
    missed.forEach(function (tier) {
      if (tier.kind === "set70" && !qualifiesCoaster(cfg, st)) {
        coasterPending = tier;
      } else if (tier.kind === "set70" && qualifiesCoaster(cfg, st) && t < tier.amount) {
        coasterPending = { tier: tier, needSpend: true, gap: Math.round((tier.amount - t) * 100) / 100 };
      }
    });

    return {
      enabled: cfg.enabled !== false,
      cfg: cfg,
      total: t,
      reached: reached,
      missed: missed,
      next: nextTotal,
      coasterPending: coasterPending,
      hasCoasterSet: qualifiesCoaster(cfg, st)
    };
  }

  function tierStatusHtml(tier, reached) {
    if (tier.paused) return '<span class="gift-tag muted">暫停</span>';
    if (tier.soldOut) return '<span class="gift-tag sold">已送完</span>';
    if (reached) return '<span class="gift-tag ok">已達</span>';
    return '<span class="gift-tag todo">未達</span>';
  }

  function renderProgressHtml(total, orderSt) {
    var ev = evaluate(total, orderSt);
    if (!ev.enabled) return "";

    var parts = [];
    parts.push('<div class="gift-progress" id="dimsumGiftProgress">');
    parts.push('<div class="gift-progress-head">🎁 會場購物禮遇 <span class="muted">送完即止</span></div>');

    if (ev.total <= 0) {
      parts.push('<p class="gift-progress-line muted">落單後即顯示可享禮遇（任何消費送年曆卡）</p>');
    } else if (ev.reached.length) {
      var names = ev.reached.map(function (tier) {
        var name = tier.emoji + " " + tier.title;
        if (tier.soldOut) name += "（已送完）";
        return name;
      });
      parts.push('<p class="gift-progress-line"><strong>目前合計可享：</strong>' + esc(names.join("；")) + "</p>");
    } else {
      parts.push('<p class="gift-progress-line muted">暫未達任何禮遇階</p>');
    }

    if (ev.next) {
      parts.push(
        '<p class="gift-progress-next">再消費 <strong>$' + money(ev.next.gap) +
        "</strong> 可取：" + esc(ev.next.tier.emoji + " " + ev.next.tier.title) + "</p>"
      );
    } else if (ev.total > 0 && ev.reached.some(function (x) { return x.id === "bag488"; })) {
      parts.push('<p class="gift-progress-next ok-line">合計已達最高金額階 🎉</p>');
    }

    if (ev.coasterPending) {
      if (ev.coasterPending.needSpend) {
        parts.push(
          '<p class="gift-progress-hint">已有指定花香套條件，再消費 <strong>$' +
          money(ev.coasterPending.gap) + "</strong> 可取陶瓷杯墊</p>"
        );
      } else if (ev.coasterPending.title || (ev.coasterPending.emoji)) {
        var ct = ev.coasterPending.tier || ev.coasterPending;
        parts.push(
          '<p class="gift-progress-hint">陶瓷杯墊需「1枝花香＋2枝6ml」同款套（如芳香紅薇／淡花甜香／馥郁白木 set）' +
          (ct && ct.emoji ? " " + esc(ct.emoji) : "") + "</p>"
        );
      }
    }

    parts.push('<p class="gift-progress-disc muted">詳見「購物禮遇」分頁／攤位。送完即止。</p>');
    parts.push("</div>");
    return parts.join("");
  }

  function renderGiftsPage() {
    var root = $("giftsRoot");
    if (!root) return;
    var cfg = getConfig();
    var html = "";
    html += '<div class="gifts-hero">';
    html += "<h3>" + esc(cfg.title) + ' <span class="badge">送完即止</span></h3>';
    html += '<p class="muted">' + esc(cfg.subtitle) + "</p>";
    if (!cfg.enabled) {
      html += '<p class="admin-msg err" style="display:block;">禮遇暫暫停（職員已關閉展示）</p>';
    }
    html += "</div>";

    html += '<div class="gifts-tiers">';
    (cfg.tiers || []).forEach(function (t) {
      var inactive = t.paused || t.soldOut || !cfg.enabled;
      var thresh =
        t.kind === "any" ? "任何消費" :
        (t.kind === "set70" ? ("滿 $" + money(t.amount) + "／指定套") :
          ("滿 $" + money(t.amount)));
      html +=
        '<article class="gift-card' + (inactive ? " is-inactive" : "") + '" data-tier="' + esc(t.id) + '">' +
          '<div class="gift-card-emoji" aria-hidden="true">' + esc(t.emoji) + "</div>" +
          '<div class="gift-card-body">' +
            '<div class="gift-card-top">' +
              '<strong class="gift-amt">' + esc(thresh) + "</strong>" +
              tierStatusHtml(t, false) +
            "</div>" +
            "<h4>" + esc(t.title) + "</h4>" +
            '<p class="muted">' + esc(t.desc) + "</p>" +
            (t.applyNote ? '<p class="gift-apply">' + esc(t.applyNote) + "</p>" : "") +
          "</div>" +
        "</article>";
    });
    html += "</div>";

    html += '<p class="claim-safe">' + esc(cfg.disclaimer) + "</p>";
    html +=
      '<div class="btn-row">' +
        '<button type="button" class="btn-ghost" id="btnGiftsToOrder">去點心紙下單睇合計禮遇</button>' +
        '<button type="button" class="btn-ghost" id="btnGiftsToSocial">詳見社交</button>' +
      "</div>";

    if (isAdmin()) {
      html += '<div class="gifts-admin panel" style="margin-top:16px;box-shadow:none;">';
      html += '<h3 style="font-size:1rem;">職員編輯禮遇 <span class="badge">本機</span></h3>';
      html +=
        '<label class="field"><input type="checkbox" id="giftCfgEnabled"' +
        (cfg.enabled ? " checked" : "") + " /> 公開展示禮遇</label>";
      html += '<label class="field" for="giftCfgTitle">標題</label>';
      html += '<input type="text" id="giftCfgTitle" maxlength="80" value="' + esc(cfg.title) + '" />';
      html += '<label class="field" for="giftCfgSub">副標題</label>';
      html += '<input type="text" id="giftCfgSub" maxlength="160" value="' + esc(cfg.subtitle) + '" />';
      html += '<label class="field" for="giftCfgDisc">免責／送完即止文案</label>';
      html += '<textarea id="giftCfgDisc" maxlength="500" rows="2">' + esc(cfg.disclaimer) + "</textarea>";

      (cfg.tiers || []).forEach(function (t, idx) {
        html += '<div class="gift-admin-tier" data-idx="' + idx + '">';
        html += "<h4>" + esc(t.emoji + " " + t.title) + " <span class=\"muted\">(" + esc(t.id) + ")</span></h4>";
        html += '<label class="field">標題</label>';
        html += '<input type="text" class="gift-edit-title" maxlength="80" value="' + esc(t.title) + '" />';
        html += '<label class="field">說明</label>';
        html += '<input type="text" class="gift-edit-desc" maxlength="220" value="' + esc(t.desc) + '" />';
        html += '<label class="field">Emoji</label>';
        html += '<input type="text" class="gift-edit-emoji" maxlength="8" value="' + esc(t.emoji) + '" />';
        html +=
          '<label class="field"><input type="checkbox" class="gift-edit-sold"' +
          (t.soldOut ? " checked" : "") + " /> 已送完</label>";
        html +=
          '<label class="field"><input type="checkbox" class="gift-edit-paused"' +
          (t.paused ? " checked" : "") + " /> 暫停此層</label>";
        html += "</div>";
      });

      html +=
        '<div class="btn-row">' +
          '<button type="button" class="admin-btn" id="btnSaveGifts">儲存禮遇</button>' +
          '<button type="button" class="btn-ghost" id="btnResetGifts">還原 seed</button>' +
        "</div>";
      html += '<p id="giftsAdminMsg" class="admin-msg hidden" role="status"></p>';
      html += "</div>";
    }

    root.innerHTML = html;
  }

  function collectAdminForm() {
    var cfg = getConfig();
    var en = $("giftCfgEnabled");
    cfg.enabled = !!(en && en.checked);
    var title = $("giftCfgTitle");
    var sub = $("giftCfgSub");
    var disc = $("giftCfgDisc");
    if (title) cfg.title = title.value.trim() || cfg.title;
    if (sub) cfg.subtitle = sub.value.trim() || cfg.subtitle;
    if (disc) cfg.disclaimer = disc.value.trim() || cfg.disclaimer;
    var blocks = document.querySelectorAll(".gift-admin-tier");
    blocks.forEach(function (block, idx) {
      if (!cfg.tiers[idx]) return;
      var tEl = block.querySelector(".gift-edit-title");
      var dEl = block.querySelector(".gift-edit-desc");
      var eEl = block.querySelector(".gift-edit-emoji");
      var sEl = block.querySelector(".gift-edit-sold");
      var pEl = block.querySelector(".gift-edit-paused");
      if (tEl) cfg.tiers[idx].title = tEl.value.trim() || cfg.tiers[idx].title;
      if (dEl) cfg.tiers[idx].desc = dEl.value.trim() || cfg.tiers[idx].desc;
      if (eEl) cfg.tiers[idx].emoji = eEl.value.trim() || cfg.tiers[idx].emoji;
      cfg.tiers[idx].soldOut = !!(sEl && sEl.checked);
      cfg.tiers[idx].paused = !!(pEl && pEl.checked);
    });
    return cfg;
  }

  function flash(el, text, ok) {
    if (!el) return;
    el.textContent = text;
    el.classList.remove("hidden", "ok", "err");
    el.classList.add(ok ? "ok" : "err");
  }

  function bindPage() {
    var root = $("giftsRoot");
    if (!root || root._giftsBound) return;
    root._giftsBound = true;
    root.addEventListener("click", function (e) {
      if (e.target.closest("#btnGiftsToOrder")) {
        var btn = document.querySelector('.nav-tabs button[data-view="order"]');
        if (btn) btn.click();
        return;
      }
      if (e.target.closest("#btnGiftsToSocial")) {
        var s = document.querySelector('.nav-tabs button[data-view="social"]');
        if (s) s.click();
        return;
      }
      if (e.target.closest("#btnSaveGifts")) {
        saveConfig(collectAdminForm());
        flash($("giftsAdminMsg"), "禮遇已儲存（本機）", true);
        renderGiftsPage();
        return;
      }
      if (e.target.closest("#btnResetGifts")) {
        if (!confirm("還原公開 seed？會清掉本機禮遇改動。")) return;
        resetConfig();
        flash($("giftsAdminMsg"), "已還原 seed", true);
        renderGiftsPage();
      }
    });
  }

  window.BPE_Gifts = {
    getConfig: getConfig,
    saveConfig: saveConfig,
    resetConfig: resetConfig,
    evaluate: evaluate,
    qualifiesCoaster: qualifiesCoaster,
    renderProgressHtml: renderProgressHtml,
    render: function () {
      bindPage();
      renderGiftsPage();
    }
  };
})();
