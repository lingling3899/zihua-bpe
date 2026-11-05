/* 每日營業目標：職員後台可改；產品計數顯示今日實付進度（HK 日曆＋累計桶） */
(function () {
  "use strict";

  var LS_TARGET = "zihua_bpe_daily_target_v1";
  var LS_SALES = "zihua_bpe_daily_sales_v1";
  var LS_PREORDERS = "zihua_bpe_preorders_v1";

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

  /** Asia/Hong_Kong calendar date as YYYY-MM-DD */
  function hkDateKey(d) {
    var date = d instanceof Date ? d : new Date();
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

  function round2(n) {
    return Math.round(Number(n) * 100) / 100;
  }

  function loadTarget() {
    try {
      var raw = localStorage.getItem(LS_TARGET);
      if (!raw) return null;
      var o = JSON.parse(raw);
      if (!o || typeof o !== "object") return null;
      var amt = Number(o.amount);
      if (isNaN(amt) || amt < 0) return null;
      return { amount: round2(amt), updatedAt: o.updatedAt || "" };
    } catch (e) {
      return null;
    }
  }

  function saveTarget(amount) {
    if (!isAdmin()) return { ok: false, error: "請先職員登入" };
    var n = Number(amount);
    if (isNaN(n) || n < 0) return { ok: false, error: "請輸入 ≥ 0 嘅金額" };
    n = round2(n);
    var payload = { amount: n, updatedAt: new Date().toISOString() };
    try {
      localStorage.setItem(LS_TARGET, JSON.stringify(payload));
      return { ok: true, target: payload };
    } catch (e) {
      return { ok: false, error: "無法儲存（瀏覽器可能限制本機儲存）" };
    }
  }

  function loadSalesMap() {
    try {
      var raw = localStorage.getItem(LS_SALES);
      if (!raw) return {};
      var o = JSON.parse(raw);
      if (!o || typeof o !== "object") return {};
      return o;
    } catch (e) {
      return {};
    }
  }

  function saveSalesMap(map) {
    try {
      localStorage.setItem(LS_SALES, JSON.stringify(map || {}));
    } catch (e) { /* private mode */ }
  }

  function orderHkDate(order) {
    if (!order || !order.t) return "";
    var d = new Date(order.t);
    if (isNaN(d.getTime())) return "";
    return hkDateKey(d);
  }

  /** Fallback: sum payable of today's orders still in the 50-item preorder list */
  function sumTodayFromPreorders(dateKey) {
    var key = dateKey || hkDateKey();
    var total = 0;
    var count = 0;
    try {
      var raw = localStorage.getItem(LS_PREORDERS);
      var list = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(list)) return { total: 0, count: 0 };
      list.forEach(function (o) {
        if (!o) return;
        if (orderHkDate(o) !== key) return;
        var p = Number(o.payable);
        if (isNaN(p)) return;
        total += p;
        count += 1;
      });
    } catch (e) {}
    return { total: round2(total), count: count };
  }

  function getTodayBucket(dateKey) {
    var key = dateKey || hkDateKey();
    var map = loadSalesMap();
    var b = map[key];
    if (b && typeof b === "object" && !isNaN(Number(b.total))) {
      return {
        total: round2(Number(b.total) || 0),
        count: Math.max(0, Math.floor(Number(b.count) || 0)),
        fromAccumulator: true
      };
    }
    var fb = sumTodayFromPreorders(key);
    return { total: fb.total, count: fb.count, fromAccumulator: false };
  }

  function addSale(payable, when) {
    var amt = Number(payable);
    if (isNaN(amt)) return getTodayBucket();
    amt = round2(amt);
    var key = hkDateKey(when instanceof Date ? when : (when ? new Date(when) : new Date()));
    var map = loadSalesMap();
    var cur = map[key];
    if (!cur || typeof cur !== "object") {
      // Seed from residual preorders so we don't undercount if bucket was missing
      var seed = sumTodayFromPreorders(key);
      cur = { total: seed.total, count: seed.count };
    }
    cur.total = round2((Number(cur.total) || 0) + amt);
    cur.count = Math.max(0, Math.floor(Number(cur.count) || 0) + 1);
    map[key] = cur;
    saveSalesMap(map);
    return { total: cur.total, count: cur.count, fromAccumulator: true, dateKey: key };
  }

  function progressPct(sold, target) {
    if (!target || target <= 0) return 0;
    var p = (sold / target) * 100;
    if (p < 0) p = 0;
    return Math.min(100, Math.round(p * 10) / 10);
  }

  function renderProgressHtml() {
    if (!isAdmin()) return "";
    var tgt = loadTarget();
    var bucket = getTodayBucket();
    var sold = bucket.total;
    if (!tgt) {
      return (
        '<div class="pc-sales-target admin-only" id="pcSalesTarget">' +
          '<div class="pc-st-head"><strong>今日營業</strong><span class="pc-st-amt">$' + esc(money(sold)) + "</span></div>" +
          '<p class="pc-st-hint muted">尚未設定今日目標 · 職員選單 → 營業目標</p>' +
        "</div>"
      );
    }
    var pct = progressPct(sold, tgt.amount);
    var hit = sold >= tgt.amount && tgt.amount > 0;
    return (
      '<div class="pc-sales-target admin-only" id="pcSalesTarget">' +
        '<div class="pc-st-head">' +
          "<strong>今日營業</strong>" +
          '<span class="pc-st-amt">$' + esc(money(sold)) + " / 目標 $" + esc(money(tgt.amount)) + "</span>" +
        "</div>" +
        '<div class="pc-st-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + esc(String(pct)) + '">' +
          '<div class="pc-st-fill" style="width:' + esc(String(pct)) + '%"></div>' +
        "</div>" +
        '<p class="pc-st-meta">' +
          (hit ? '<span class="pc-st-hit">已達標</span> · ' : "") +
          "進度 " + esc(String(pct)) + "%" +
          (bucket.count ? (" · " + esc(String(bucket.count)) + " 單") : "") +
        "</p>" +
      "</div>"
    );
  }

  function ensureDrawer() {
    var el = $("targetDrawer");
    if (el) return el;
    el = document.createElement("div");
    el.id = "targetDrawer";
    el.className = "drawer hidden";
    el.setAttribute("role", "dialog");
    el.setAttribute("aria-modal", "true");
    el.innerHTML =
      '<div class="drawer-panel target-panel">' +
        '<div class="drawer-head">' +
          "<h3>每日營業目標</h3>" +
          '<button type="button" class="btn-ghost" id="btnCloseTarget">關閉</button>' +
        "</div>" +
        '<div id="targetRoot"></div>' +
      "</div>";
    document.body.appendChild(el);
    el.addEventListener("click", function (e) {
      if (e.target === el) closePanel();
    });
    return el;
  }

  function refreshOrderUi() {
    if (window.BPE_DimsumOrderUI && window.BPE_DimsumOrderUI.render) {
      window.BPE_DimsumOrderUI.render();
    }
  }

  function renderPanel(statusText) {
    ensureDrawer();
    var root = $("targetRoot");
    if (!root) return;
    if (!isAdmin()) {
      root.innerHTML = '<p class="muted">請先職員登入後先可以改營業目標。</p>';
      return;
    }
    var tgt = loadTarget();
    var bucket = getTodayBucket();
    var sold = bucket.total;
    var amountVal = tgt ? String(tgt.amount) : "";
    var recap;
    if (!tgt) {
      recap = "今日已做 $" + money(sold) + " · 尚未設定目標";
    } else {
      var pct = progressPct(sold, tgt.amount);
      recap =
        "今日已做 $" + money(sold) +
        " · 目標 $" + money(tgt.amount) +
        " · 進度 " + pct + "%" +
        (sold >= tgt.amount && tgt.amount > 0 ? " · 已達標" : "");
    }
    root.innerHTML =
      '<p class="target-note muted">以本機已結算實付合計。同一部機嘅 POS1／POS2 會一齊計入今日額。</p>' +
      '<label class="field" for="targetAmountInput">今日目標金額（$）' +
        '<input type="number" id="targetAmountInput" min="0" step="0.01" inputmode="decimal" placeholder="未設定" value="' + esc(amountVal) + '" />' +
      "</label>" +
      '<div class="btn-row">' +
        '<button type="button" class="admin-btn" id="btnSaveTarget">儲存</button>' +
      "</div>" +
      (statusText ? ('<p class="admin-msg" id="targetStatus" role="status">' + esc(statusText) + "</p>") : '<p class="admin-msg hidden" id="targetStatus" role="status"></p>') +
      '<div class="target-recap">' +
        "<h4>今日進度</h4>" +
        "<p>" + esc(recap) + "</p>" +
        '<p class="muted target-date">日期（香港）' + esc(hkDateKey()) + "</p>" +
      "</div>";

    var saveBtn = $("btnSaveTarget");
    if (saveBtn) {
      saveBtn.addEventListener("click", function () {
        var inp = $("targetAmountInput");
        var raw = inp ? String(inp.value || "").trim() : "";
        if (raw === "") {
          renderPanel("請輸入目標金額（可填 0）");
          return;
        }
        var res = saveTarget(raw);
        if (!res.ok) {
          renderPanel(res.error || "儲存失敗");
          return;
        }
        renderPanel("已儲存今日目標 $" + money(res.target.amount));
        refreshOrderUi();
      });
    }
  }

  function openPanel() {
    if (!isAdmin()) {
      if (window.BPE_Shell && window.BPE_Shell.openLogin) window.BPE_Shell.openLogin();
      return;
    }
    var d = ensureDrawer();
    d.classList.remove("hidden");
    renderPanel("");
  }

  function closePanel() {
    var d = $("targetDrawer");
    if (d) d.classList.add("hidden");
  }

  function bindOnce() {
    if (document._salesTargetBound) return;
    document._salesTargetBound = true;
    document.addEventListener("click", function (e) {
      if (e.target && e.target.id === "btnCloseTarget") {
        closePanel();
      }
    });
  }

  bindOnce();

  window.BPE_SalesTarget = {
    hkDateKey: hkDateKey,
    loadTarget: loadTarget,
    saveTarget: saveTarget,
    getTodayBucket: getTodayBucket,
    addSale: addSale,
    renderProgressHtml: renderProgressHtml,
    openPanel: openPanel,
    closePanel: closePanel,
    renderPanel: renderPanel
  };
})();
