/* 2026 紫花油工展會 — 底欄六頁殼＋登入 */
(function () {
  "use strict";

  var VIEWS = ["booth3d", "map", "order", "games", "delivery", "roster"];

  function $(id) { return document.getElementById(id); }
  function qsa(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function isAdmin() {
    return !!(window.ZihuaAdminAuth && window.ZihuaAdminAuth.isLoggedIn && window.ZihuaAdminAuth.isLoggedIn());
  }

  function setAdminVisible(on) {
    qsa(".admin-only").forEach(function (el) {
      el.classList.toggle("hidden", !on);
    });
    var btn = $("headerLoginBtn");
    if (btn) {
      btn.classList.toggle("is-in", on);
      var out = btn.querySelector(".hdr-icon-out");
      var inn = btn.querySelector(".hdr-icon-in");
      var dot = btn.querySelector(".hdr-login-dot");
      if (out) out.classList.toggle("hidden", on);
      if (inn) inn.classList.toggle("hidden", !on);
      if (dot) dot.classList.toggle("hidden", !on);
    }
  }

  function showView(name) {
    if (VIEWS.indexOf(name) < 0) name = "order";
    VIEWS.forEach(function (v) {
      var el = $("view-" + v);
      if (el) el.classList.toggle("hidden", v !== name);
    });
    qsa(".bottom-nav [data-view]").forEach(function (b) {
      b.classList.toggle("active", b.getAttribute("data-view") === name);
    });
    try { history.replaceState(null, "", "#" + name); } catch (e) {}

    if (name === "order" && window.BPE_DimsumOrderUI) window.BPE_DimsumOrderUI.render();
    if (name === "games" && window.BPE_LuckyGames) window.BPE_LuckyGames.render();
    if (name === "delivery" && window.BPE_CupalDelivery) window.BPE_CupalDelivery.render();
    if (name === "roster" && window.BPE_Roster) window.BPE_Roster.render();
  }

  function openLogin() {
    var modal = $("loginModal");
    if (modal) modal.classList.remove("hidden");
    var msg = $("loginMsg");
    if (msg) { msg.classList.add("hidden"); msg.textContent = ""; }
  }
  function closeLogin() {
    var modal = $("loginModal");
    if (modal) modal.classList.add("hidden");
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
        if (isAdmin()) {
          var dd = $("loginDropdown");
          if (dd) {
            dd.classList.toggle("hidden");
            loginBtn.setAttribute("aria-expanded", dd.classList.contains("hidden") ? "false" : "true");
          }
        } else {
          openLogin();
        }
      });
    }
    document.addEventListener("click", function (e) {
      if (!e.target.closest(".header-login-wrap")) {
        var dd = $("loginDropdown");
        if (dd) dd.classList.add("hidden");
      }
    });
    qsa("#loginDropdown [data-dd-action]").forEach(function (b) {
      b.addEventListener("click", function () {
        var act = b.getAttribute("data-dd-action");
        $("loginDropdown").classList.add("hidden");
        if (act === "logout" && window.ZihuaAdminAuth) {
          window.ZihuaAdminAuth.logout();
          setAdminVisible(false);
          showView("order");
        }
        if (act === "export-cupal" && window.BPE_CupalDelivery) {
          window.BPE_CupalDelivery.exportCsv();
        }
        if (act === "gifts") {
          var gr = $("giftsDrawer");
          if (gr) gr.classList.remove("hidden");
          if (window.BPE_Gifts) window.BPE_Gifts.render();
        }
      });
    });

    var loginForm = $("loginForm");
    if (loginForm) {
      loginForm.addEventListener("submit", function (e) {
        e.preventDefault();
        var user = ($("loginUser") || {}).value || "";
        var pass = ($("loginPass") || {}).value || "";
        var msg = $("loginMsg");
        if (!window.ZihuaAdminAuth) return;
        window.ZihuaAdminAuth.login(user, pass).then(function (ok) {
          if (ok) {
            closeLogin();
            setAdminVisible(true);
            showView("roster");
          } else if (msg) {
            msg.textContent = "帳號或密碼唔正確";
            msg.classList.remove("hidden");
          }
        });
      });
    }
    var cancel = $("btnCancelLogin");
    if (cancel) cancel.addEventListener("click", closeLogin);

    qsa("[data-toggle-pass]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var id = btn.getAttribute("data-toggle-pass");
        var inp = $(id);
        if (!inp) return;
        inp.type = inp.type === "password" ? "text" : "password";
      });
    });

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
    setAdminVisible(isAdmin());
    var hash = (location.hash || "").replace(/^#/, "");
    showView(VIEWS.indexOf(hash) >= 0 ? hash : "order");
  }

  window.BPE_Shell = {
    showView: showView,
    openLogin: openLogin,
    isAdmin: isAdmin,
    refreshAdmin: function () { setAdminVisible(isAdmin()); }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
