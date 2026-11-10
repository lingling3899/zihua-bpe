/* 2026 紫花油工展會 — 底欄六頁殼＋職員／管理員登入 */
(function () {
  "use strict";

  var VIEWS = ["booth3d", "map", "order", "games", "delivery", "roster"];

  function $(id) { return document.getElementById(id); }
  function qsa(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function staffAuth() {
    return window.ZihuaStaffAuth || null;
  }

  function isAdmin() {
    var s = staffAuth();
    if (s && s.isAdmin) return !!s.isAdmin();
    return !!(window.ZihuaAdminAuth && window.ZihuaAdminAuth.isLoggedIn && window.ZihuaAdminAuth.isLoggedIn());
  }

  function isStaff() {
    var s = staffAuth();
    return !!(s && s.isStaff && s.isStaff());
  }

  function canOperate() {
    var s = staffAuth();
    if (s && s.canOperate) return !!s.canOperate();
    return isAdmin();
  }

  function rebuildDropdown() {
    var dd = $("loginDropdown");
    if (!dd) return;
    var html = "";
    if (isAdmin()) {
      var trialItem = "";
      if (window.BPE_TrialMode && window.BPE_TrialMode.isCodeEnabled && window.BPE_TrialMode.isCodeEnabled()) {
        trialItem = window.BPE_TrialMode.isOn()
          ? '<button type="button" role="menuitem" data-dd-action="trial-toggle">🧪 試機模式：開</button>'
          : '<button type="button" role="menuitem" data-dd-action="trial-toggle">🧪 試機模式：關</button>';
      }
      html =
        trialItem +
        '<button type="button" role="menuitem" data-dd-action="order-stats">📊 單據統計</button>' +
        '<button type="button" role="menuitem" data-dd-action="gifts">🎁 禮遇設定</button>' +
        '<button type="button" role="menuitem" data-dd-action="stock">📦 庫存／存貨表</button>' +
        '<button type="button" role="menuitem" data-dd-action="restock">📋 補貨表</button>' +
        '<button type="button" role="menuitem" data-dd-action="target">🎯 營業目標</button>' +
        '<button type="button" role="menuitem" data-dd-action="export-cupal">⬇ 匯出宅配 CSV</button>' +
        '<button type="button" role="menuitem" data-dd-action="staff-roster">👥 職員帳號一覽</button>' +
        '<button type="button" role="menuitem" data-dd-action="staff-switch">🔄 切換經手職員</button>' +
        '<button type="button" role="menuitem" data-dd-action="logout" class="dd-logout">🚪 登出</button>';
    } else if (isStaff() || canOperate()) {
      html =
        '<button type="button" role="menuitem" data-dd-action="stock">📦 庫存／存貨表</button>' +
        '<button type="button" role="menuitem" data-dd-action="restock">📋 補貨表</button>' +
        '<button type="button" role="menuitem" data-dd-action="order-stats">📊 單據統計</button>' +
        '<button type="button" role="menuitem" data-dd-action="staff-switch">🔄 切換經手職員</button>' +
        '<button type="button" role="menuitem" data-dd-action="staff-logout" class="dd-logout">🚪 職員登出</button>';
    }
    dd.innerHTML = html;
    qsa("#loginDropdown [data-dd-action]").forEach(function (b) {
      b.addEventListener("click", onDropdownAction);
    });
  }

  function setAuthVisible() {
    var adminOn = isAdmin();
    var opOn = canOperate();
    qsa(".admin-only").forEach(function (el) {
      el.classList.toggle("hidden", !adminOn);
    });
    qsa(".staff-only").forEach(function (el) {
      el.classList.toggle("hidden", !opOn);
    });
    var btn = $("headerLoginBtn");
    if (btn) {
      btn.classList.toggle("is-in", opOn);
      var out = btn.querySelector(".hdr-icon-out");
      var inn = btn.querySelector(".hdr-icon-in");
      var dot = btn.querySelector(".hdr-login-dot");
      if (out) out.classList.toggle("hidden", opOn);
      if (inn) inn.classList.toggle("hidden", !opOn);
      if (dot) dot.classList.toggle("hidden", !opOn);
      var label = "職員登入";
      if (adminOn) label = "管理員選單";
      else if (isStaff()) {
        var st = staffAuth() && staffAuth().getStaff && staffAuth().getStaff();
        label = st && st.label ? ("經手：" + st.label) : "職員選單";
      }
      btn.setAttribute("aria-label", label);
    }
    rebuildDropdown();
  }

  function showView(name) {
    if (VIEWS.indexOf(name) < 0) name = "order";
    var prev = document.body.getAttribute("data-view") || "";
    VIEWS.forEach(function (v) {
      var el = $("view-" + v);
      if (el) el.classList.toggle("hidden", v !== name);
    });
    qsa(".bottom-nav [data-view]").forEach(function (b) {
      b.classList.toggle("active", b.getAttribute("data-view") === name);
    });
    document.body.setAttribute("data-view", name);
    document.body.classList.toggle("view-booth3d", name === "booth3d");
    try { history.replaceState(null, "", "#" + name); } catch (e) {}

    if (prev === "booth3d" && name !== "booth3d" && window.BPE_Booth3D) window.BPE_Booth3D.hide();
    if (name === "booth3d" && window.BPE_Booth3D) window.BPE_Booth3D.show();
    if (name === "order" && window.BPE_DimsumOrderUI) window.BPE_DimsumOrderUI.render();
    if (name === "games" && window.BPE_LuckyGames) window.BPE_LuckyGames.render();
    if (name === "delivery" && window.BPE_CupalDelivery) window.BPE_CupalDelivery.render();
    if (name === "roster" && window.BPE_Roster) window.BPE_Roster.render();
  }

  function showLoginMsg(text, isError) {
    var msg = $("loginMsg");
    if (!msg) return;
    if (!text) {
      msg.classList.add("hidden");
      msg.textContent = "";
      return;
    }
    msg.textContent = text;
    msg.classList.remove("hidden");
    msg.classList.toggle("login-msg-error", !!isError);
  }

  /* 訪客預設開職員 PIN 切換；連去管理員 Google 登入 */
  function openLogin() {
    if (staffAuth() && staffAuth().openStaffSwitchModal) {
      staffAuth().openStaffSwitchModal();
      return;
    }
    openAdminLogin();
  }

  function openAdminLogin() {
    var modal = $("loginModal");
    if (modal) modal.classList.remove("hidden");
    showLoginMsg("");
    var slot = $("googleSignInSlot");
    if (window.ZihuaAdminAuth && window.ZihuaAdminAuth.renderGoogleButton) {
      window.ZihuaAdminAuth.renderGoogleButton(slot, {
        onSuccess: function () {
          if (staffAuth() && staffAuth().logoutStaff) staffAuth().logoutStaff();
          closeLogin();
          setAuthVisible();
          if (window.BPE_DimsumOrderUI && window.BPE_DimsumOrderUI.render) {
            window.BPE_DimsumOrderUI.render();
          }
          if (window.BPE_Roster && window.BPE_Roster.render) {
            window.BPE_Roster.render();
          }
          showView(document.body.getAttribute("data-view") || "order");
        },
        onError: function (err) {
          showLoginMsg(err || "登入失敗", true);
        }
      });
    } else if (slot) {
      slot.innerHTML = "";
      showLoginMsg("登入模組未載入，請刷新頁面。", true);
    }
  }

  function closeLogin() {
    var modal = $("loginModal");
    if (modal) modal.classList.add("hidden");
  }

  function positionStaffDropdown(anchor) {
    var dd = $("loginDropdown");
    if (!dd) return;
    if (!anchor) {
      dd.style.position = "";
      dd.style.top = "";
      dd.style.right = "";
      dd.style.left = "";
      return;
    }
    var r = anchor.getBoundingClientRect();
    dd.style.position = "fixed";
    dd.style.top = Math.round(r.bottom + 8) + "px";
    dd.style.right = Math.round(Math.max(8, window.innerWidth - r.right)) + "px";
    dd.style.left = "auto";
    dd.style.zIndex = "80";
  }

  function toggleStaffMenu(anchor) {
    var loginBtn = $("headerLoginBtn");
    if (!canOperate()) {
      openLogin();
      return;
    }
    var dd = $("loginDropdown");
    if (!dd) return;
    rebuildDropdown();
    var opening = dd.classList.contains("hidden");
    if (opening) {
      dd.classList.remove("hidden");
      positionStaffDropdown(anchor || loginBtn);
      if (loginBtn) loginBtn.setAttribute("aria-expanded", "true");
    } else {
      dd.classList.add("hidden");
      positionStaffDropdown(null);
      if (loginBtn) loginBtn.setAttribute("aria-expanded", "false");
    }
  }

  function onDropdownAction(e) {
    var b = e.currentTarget;
    var act = b.getAttribute("data-dd-action");
    var dd = $("loginDropdown");
    if (dd) dd.classList.add("hidden");
    positionStaffDropdown(null);
    var loginBtn = $("headerLoginBtn");
    if (loginBtn) loginBtn.setAttribute("aria-expanded", "false");

    if (act === "logout") {
      if (staffAuth() && staffAuth().logoutStaff) staffAuth().logoutStaff();
      if (window.ZihuaAdminAuth) window.ZihuaAdminAuth.logout();
      setAuthVisible();
      showView("order");
      return;
    }
    if (act === "staff-logout") {
      if (staffAuth() && staffAuth().logoutStaff) staffAuth().logoutStaff();
      setAuthVisible();
      showView("order");
      return;
    }
    if (act === "export-cupal") {
      if (!isAdmin()) return;
      if (window.BPE_CupalDelivery) window.BPE_CupalDelivery.exportCsv();
      return;
    }
    if (act === "trial-toggle") {
      if (!isAdmin()) return;
      if (!window.BPE_TrialMode || !window.BPE_TrialMode.isCodeEnabled || !window.BPE_TrialMode.isCodeEnabled()) return;
      var on = !!window.BPE_TrialMode.isOn();
      if (on) {
        if (!confirm("關閉試機模式？之後賣貨會改返跟「補貨−售出」（未補貨就不能賣）。每日自動重新開始亦會停。除非再通知，建議保持開啟。")) return;
        window.BPE_TrialMode.setOn(false);
      } else {
        if (!confirm("重新開啟試機模式？存貨會當已到場（剩餘=總預−售出）；每日（香港日期）會自動清訂單、售出同今日營業額。")) return;
        window.BPE_TrialMode.setOn(true);
        if (window.BPE_TrialMode.maybeDailyReset) window.BPE_TrialMode.maybeDailyReset();
      }
      if (window.BPE_TrialMode.scheduleMidnightCheck) window.BPE_TrialMode.scheduleMidnightCheck();
      setAuthVisible();
      if (window.BPE_DimsumOrderUI && window.BPE_DimsumOrderUI.render) window.BPE_DimsumOrderUI.render();
      if (window.BPE_Stock && window.BPE_Stock.renderPanel) {
        var sd = $("stockDrawer");
        if (sd && !sd.classList.contains("hidden")) window.BPE_Stock.renderPanel();
      }
      return;
    }
    if (act === "gifts") {
      if (!isAdmin()) return;
      var gr = $("giftsDrawer");
      if (gr) gr.classList.remove("hidden");
      if (window.BPE_Gifts) window.BPE_Gifts.render();
      return;
    }
    if (act === "order-stats") {
      if (!canOperate()) {
        openLogin();
        return;
      }
      if (window.BPE_DimsumOrderUI && window.BPE_DimsumOrderUI.openOrderStats) {
        window.BPE_DimsumOrderUI.openOrderStats();
      }
      return;
    }
    if (act === "stock") {
      if (!canOperate()) {
        openLogin();
        return;
      }
      if (window.BPE_Stock && window.BPE_Stock.openPanel) window.BPE_Stock.openPanel();
      return;
    }
    if (act === "restock") {
      if (!canOperate()) {
        openLogin();
        return;
      }
      if (window.BPE_Restock && window.BPE_Restock.openPanel) window.BPE_Restock.openPanel();
      return;
    }
    if (act === "target") {
      if (!isAdmin()) return;
      if (window.BPE_SalesTarget && window.BPE_SalesTarget.openPanel) window.BPE_SalesTarget.openPanel();
      return;
    }
    if (act === "staff-switch") {
      if (staffAuth() && staffAuth().openStaffSwitchModal) staffAuth().openStaffSwitchModal();
      return;
    }
    if (act === "staff-roster") {
      if (!isAdmin()) return;
      if (staffAuth() && staffAuth().openStaffRoster) staffAuth().openStaffRoster();
    }
  }

  function bind() {
    qsa(".bottom-nav [data-view]").forEach(function (b) {
      b.addEventListener("click", function () {
        showView(b.getAttribute("data-view"));
      });
    });
    qsa("[data-jump-view]").forEach(function (b) {
      b.addEventListener("click", function () {
        showView(b.getAttribute("data-jump-view"));
      });
    });

    var loginBtn = $("headerLoginBtn");
    if (loginBtn) {
      loginBtn.addEventListener("click", function () {
        toggleStaffMenu(loginBtn);
      });
    }
    document.addEventListener("click", function (e) {
      if (
        !e.target.closest(".header-login-wrap") &&
        !e.target.closest("#btnPcGear") &&
        !e.target.closest("#loginDropdown")
      ) {
        var dd = $("loginDropdown");
        if (dd) {
          dd.classList.add("hidden");
          positionStaffDropdown(null);
        }
      }
    });

    var cancel = $("btnCancelLogin");
    if (cancel) cancel.addEventListener("click", closeLogin);

    var closeGifts = $("btnCloseGifts");
    if (closeGifts) {
      closeGifts.addEventListener("click", function () {
        var gr = $("giftsDrawer");
        if (gr) gr.classList.add("hidden");
      });
    }
  }

  function init() {
    bind();
    if (window.BPE_TrialMode && window.BPE_TrialMode.bindWatchers) {
      window.BPE_TrialMode.bindWatchers();
    }
    if (window.BPE_TrialMode && window.BPE_TrialMode.maybeDailyReset) {
      window.BPE_TrialMode.maybeDailyReset();
    }
    setAuthVisible();
    var hash = (location.hash || "").replace(/^#/, "");
    showView(VIEWS.indexOf(hash) >= 0 ? hash : "order");
  }

  window.BPE_Shell = {
    showView: showView,
    openLogin: openLogin,
    openAdminLogin: openAdminLogin,
    toggleStaffMenu: toggleStaffMenu,
    isAdmin: isAdmin,
    isStaff: isStaff,
    canOperate: canOperate,
    refreshAdmin: function () { setAuthVisible(); },
    refreshAuth: function () { setAuthVisible(); }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
