/* 試機模式：存貨當已到場；每日（香港日期）自動重新開始，直至再通知。唔會喺某個日子自動關。 */
(function () {
  "use strict";

  var TRIAL_UNTIL_FURTHER_NOTICE = true;
  var LS_TRIAL_OFF = "zihua_bpe_trial_mode_off_v1";
  var LS_RESET_DATE = "zihua_bpe_trial_reset_date_v1";
  var LS_CART = "zihua_bpe_dimsum_order_v1";
  var LS_PREORDERS = "zihua_bpe_preorders_v1";

  var midnightTimer = null;
  var resetting = false;
  var watchersBound = false;

  function hkDate(d) {
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

  function isCodeEnabled() {
    return !!TRIAL_UNTIL_FURTHER_NOTICE;
  }

  function isOn() {
    if (!TRIAL_UNTIL_FURTHER_NOTICE) return false;
    try {
      if (localStorage.getItem(LS_TRIAL_OFF) === "1") return false;
    } catch (e) {}
    return true;
  }

  function setOn(on) {
    try {
      if (on) localStorage.removeItem(LS_TRIAL_OFF);
      else localStorage.setItem(LS_TRIAL_OFF, "1");
    } catch (e) { /* private mode */ }
  }

  function noticeText() {
    return "而家係試機模式：存貨當已到場；每日（香港日期）會自動清訂單、售出同今日營業額，直至再通知。";
  }

  function bannerHtml() {
    if (!isOn()) return "";
    return '<p class="trial-banner" role="status">' + noticeText() + "</p>";
  }

  function runReset() {
    if (window.BPE_DimsumOrderUI && window.BPE_DimsumOrderUI.clearTestOrdersData) {
      window.BPE_DimsumOrderUI.clearTestOrdersData();
      return;
    }
    try { localStorage.removeItem(LS_PREORDERS); } catch (e) {}
    try { localStorage.removeItem(LS_CART); } catch (e2) {}
    if (window.BPE_Stock) {
      if (window.BPE_Stock.clearIssued) {
        try { window.BPE_Stock.clearIssued(); } catch (e3) {}
      }
      if (window.BPE_Stock.resetToSeed) {
        try { window.BPE_Stock.resetToSeed(); } catch (e4) {}
      }
    }
    if (window.BPE_SalesTarget && window.BPE_SalesTarget.clearSales) {
      try { window.BPE_SalesTarget.clearSales(); } catch (e5) {}
    }
  }

  /**
   * If trial is on and the HK calendar date changed since the last reset,
   * clear orders / cart / sold / remaining overrides / today's sales.
   * First run with no stored date only stamps today (does not wipe mid-deploy).
   * Returns true if a reset actually ran.
   */
  function maybeDailyReset() {
    if (!isOn()) return false;
    var today = hkDate();
    var last = "";
    try { last = localStorage.getItem(LS_RESET_DATE) || ""; } catch (e) {}
    if (last === today) return false;
    var didReset = false;
    if (last) {
      if (resetting) return false;
      resetting = true;
      try {
        runReset();
        didReset = true;
      } finally {
        resetting = false;
      }
    }
    try { localStorage.setItem(LS_RESET_DATE, today); } catch (e2) {}
    return didReset;
  }

  function refreshAfterReset() {
    if (window.BPE_DimsumOrderUI && window.BPE_DimsumOrderUI.render) {
      try { window.BPE_DimsumOrderUI.render(); } catch (e) {}
    }
    if (window.BPE_Stock && window.BPE_Stock.renderPanel) {
      var d = document.getElementById("stockDrawer");
      if (d && !d.classList.contains("hidden")) {
        try { window.BPE_Stock.renderPanel(); } catch (e2) {}
      }
    }
  }

  function scheduleMidnightCheck() {
    if (midnightTimer) {
      clearTimeout(midnightTimer);
      midnightTimer = null;
    }
    if (!isOn()) return;
    var today = hkDate();
    var nextMs = Date.parse(today + "T00:00:00+08:00") + 24 * 60 * 60 * 1000 + 400;
    if (isNaN(nextMs)) return;
    var wait = Math.max(1000, nextMs - Date.now());
    midnightTimer = setTimeout(function () {
      midnightTimer = null;
      if (maybeDailyReset()) refreshAfterReset();
      scheduleMidnightCheck();
    }, wait);
  }

  function bindWatchers() {
    if (watchersBound) return;
    watchersBound = true;
    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState !== "visible") return;
      if (maybeDailyReset()) refreshAfterReset();
    });
    window.addEventListener("focus", function () {
      if (maybeDailyReset()) refreshAfterReset();
    });
    scheduleMidnightCheck();
  }

  window.BPE_TrialMode = {
    TRIAL_UNTIL_FURTHER_NOTICE: TRIAL_UNTIL_FURTHER_NOTICE,
    isCodeEnabled: isCodeEnabled,
    isOn: isOn,
    setOn: setOn,
    hkDate: hkDate,
    noticeText: noticeText,
    bannerHtml: bannerHtml,
    maybeDailyReset: maybeDailyReset,
    bindWatchers: bindWatchers,
    refreshAfterReset: refreshAfterReset,
    scheduleMidnightCheck: scheduleMidnightCheck
  };
})();
