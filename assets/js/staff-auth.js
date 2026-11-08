/* 職員 PIN 限權登入：賣貨／補貨／睇存貨；PIN 清單只管理員可見 */
(function () {
  "use strict";

  var STAFF_KEY = "zihua_bpe_staff_session_v1";

  function $(id) { return document.getElementById(id); }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function accounts() {
    var list = window.BPE_STAFF_ACCOUNTS;
    return Array.isArray(list) ? list : [];
  }

  function findAccount(id) {
    var want = String(id || "");
    for (var i = 0; i < accounts().length; i++) {
      if (accounts()[i].id === want) return accounts()[i];
    }
    return null;
  }

  function isGoogleAdmin() {
    var a = window.ZihuaAdminAuth;
    return !!(a && a.isLoggedIn && a.isLoggedIn());
  }

  function getStaff() {
    try {
      var raw = sessionStorage.getItem(STAFF_KEY);
      if (!raw) return null;
      var o = JSON.parse(raw);
      if (!o || !o.id || !o.label) return null;
      return {
        id: String(o.id),
        role: String(o.role || ""),
        label: String(o.label),
        at: o.at || ""
      };
    } catch (e) {
      return null;
    }
  }

  function setStaffSession(acc) {
    try {
      sessionStorage.setItem(
        STAFF_KEY,
        JSON.stringify({
          id: acc.id,
          role: acc.role,
          label: acc.label,
          at: new Date().toISOString()
        })
      );
    } catch (e) {
      /* private mode */
    }
  }

  function logoutStaff() {
    try {
      sessionStorage.removeItem(STAFF_KEY);
    } catch (e) {}
  }

  function isStaff() {
    return !!getStaff();
  }

  /* 完整管理員權限／UI：Google 已登入，且未切換到職員經手模式 */
  function isAdmin() {
    return isGoogleAdmin() && !isStaff();
  }

  function canOperate() {
    return isGoogleAdmin() || isStaff();
  }

  function loginStaff(id, pin) {
    var acc = findAccount(id);
    if (!acc) {
      return { ok: false, error: "請選擇職員編號。" };
    }
    var entered = String(pin == null ? "" : pin).trim();
    if (!entered) {
      return { ok: false, error: "請輸入 PIN。" };
    }
    if (entered !== String(acc.pin)) {
      return { ok: false, error: "PIN 不正確，請再試。" };
    }
    setStaffSession(acc);
    return { ok: true, staff: getStaff() };
  }

  function getPosLabel() {
    var n = 1;
    try {
      if (window.BPE_DimsumOrderUI && window.BPE_DimsumOrderUI.getPosStation) {
        n = window.BPE_DimsumOrderUI.getPosStation();
      } else {
        n = Math.floor(Number(localStorage.getItem("zihua_bpe_pos_station_v1")) || 1);
      }
    } catch (e) {
      n = 1;
    }
    if (n !== 1 && n !== 2) n = 1;
    return "POS" + n;
  }

  function refreshShell() {
    if (window.BPE_Shell && window.BPE_Shell.refreshAuth) {
      window.BPE_Shell.refreshAuth();
    } else if (window.BPE_Shell && window.BPE_Shell.refreshAdmin) {
      window.BPE_Shell.refreshAdmin();
    }
    if (window.BPE_DimsumOrderUI && window.BPE_DimsumOrderUI.render) {
      try { window.BPE_DimsumOrderUI.render(); } catch (e) {}
    }
    if (window.BPE_Roster && window.BPE_Roster.render) {
      try { window.BPE_Roster.render(); } catch (e2) {}
    }
  }

  function showStaffMsg(text, isError) {
    var msg = $("staffSwitchMsg");
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

  function fillStaffSelect() {
    var sel = $("staffSwitchId");
    if (!sel) return;
    var cur = getStaff();
    var curId = cur ? cur.id : "";
    var opts = '<option value="">請選擇職員</option>';
    accounts().forEach(function (a) {
      opts +=
        '<option value="' + esc(a.id) + '"' +
        (a.id === curId ? " selected" : "") +
        ">" + esc(a.label) + "</option>";
    });
    sel.innerHTML = opts;
  }

  function openStaffSwitchModal() {
    var modal = $("staffSwitchModal");
    if (!modal) return;
    var title = $("staffSwitchTitle");
    if (title) title.textContent = "切換經手職員 · " + getPosLabel();
    fillStaffSelect();
    var pin = $("staffSwitchPin");
    if (pin) pin.value = "";
    showStaffMsg("");
    modal.classList.remove("hidden");
    setTimeout(function () {
      var sel = $("staffSwitchId");
      if (sel) {
        try { sel.focus(); } catch (e) {}
      }
    }, 40);
  }

  function closeStaffSwitchModal() {
    var modal = $("staffSwitchModal");
    if (modal) modal.classList.add("hidden");
    showStaffMsg("");
  }

  function confirmStaffSwitch() {
    var sel = $("staffSwitchId");
    var pin = $("staffSwitchPin");
    var id = sel ? sel.value : "";
    var pinVal = pin ? pin.value : "";
    var result = loginStaff(id, pinVal);
    if (!result.ok) {
      showStaffMsg(result.error || "登入失敗", true);
      return;
    }
    closeStaffSwitchModal();
    refreshShell();
  }

  function openAdminLoginFromStaff() {
    closeStaffSwitchModal();
    logoutStaff();
    refreshShell();
    if (isGoogleAdmin()) {
      refreshShell();
      return;
    }
    if (window.BPE_Shell && window.BPE_Shell.openAdminLogin) {
      window.BPE_Shell.openAdminLogin();
    } else if (window.BPE_Shell && window.BPE_Shell.openLogin) {
      window.BPE_Shell.openLogin();
    }
  }

  function ensureRosterDrawer() {
    var d = $("staffRosterDrawer");
    if (d) return d;
    d = document.createElement("div");
    d.id = "staffRosterDrawer";
    d.className = "drawer hidden";
    d.setAttribute("role", "dialog");
    d.setAttribute("aria-modal", "true");
    d.innerHTML =
      '<div class="drawer-panel">' +
        '<div class="drawer-head">' +
          "<h3>職員帳號一覽</h3>" +
          '<button type="button" class="btn-ghost" id="btnCloseStaffRoster">關閉</button>' +
        "</div>" +
        '<p class="muted staff-roster-note">只限管理員（cherry3899）可見。切換經手職員後唔會顯示呢份清單。</p>' +
        '<div id="staffRosterRoot"></div>' +
      "</div>";
    document.body.appendChild(d);
    return d;
  }

  function renderRoster() {
    if (!isAdmin()) return;
    ensureRosterDrawer();
    var root = $("staffRosterRoot");
    if (!root) return;
    var rows = accounts()
      .map(function (a) {
        return (
          "<tr>" +
            "<td><code>" + esc(a.id) + "</code></td>" +
            "<td>" + esc(a.label) + "</td>" +
            "<td>" + esc(a.role) + "</td>" +
            "<td><code>" + esc(a.pin) + "</code></td>" +
          "</tr>"
        );
      })
      .join("");
    root.innerHTML =
      '<div class="stock-table-wrap">' +
        '<table class="stock-table staff-roster-table">' +
          "<thead><tr><th>編號</th><th>顯示名</th><th>角色</th><th>PIN</th></tr></thead>" +
          "<tbody>" +
          (rows || '<tr><td colspan="4" class="muted">未有帳號</td></tr>') +
          "</tbody>" +
        "</table>" +
      "</div>";
  }

  function openStaffRoster() {
    if (!isAdmin()) {
      if (window.BPE_Shell && window.BPE_Shell.openAdminLogin) {
        window.BPE_Shell.openAdminLogin();
      }
      return;
    }
    var d = ensureRosterDrawer();
    d.classList.remove("hidden");
    renderRoster();
  }

  function closeStaffRoster() {
    var d = $("staffRosterDrawer");
    if (d) d.classList.add("hidden");
  }

  function operatorLabel() {
    var s = getStaff();
    if (s) return s.label;
    if (isGoogleAdmin() && window.ZihuaAdminAuth && window.ZihuaAdminAuth.getSessionEmail) {
      return window.ZihuaAdminAuth.getSessionEmail() || "管理員";
    }
    return "";
  }

  function bindOnce() {
    if (document._staffAuthBound) return;
    document._staffAuthBound = true;

    var confirmBtn = $("btnConfirmStaffSwitch");
    if (confirmBtn) {
      confirmBtn.addEventListener("click", confirmStaffSwitch);
    }
    var cancelBtn = $("btnCancelStaffSwitch");
    if (cancelBtn) {
      cancelBtn.addEventListener("click", closeStaffSwitchModal);
    }
    var adminLink = $("btnStaffAdminRelogin");
    if (adminLink) {
      adminLink.addEventListener("click", function (e) {
        e.preventDefault();
        openAdminLoginFromStaff();
      });
    }
    var pin = $("staffSwitchPin");
    if (pin) {
      pin.addEventListener("keydown", function (e) {
        if (e.key === "Enter") {
          e.preventDefault();
          confirmStaffSwitch();
        }
      });
    }
    document.addEventListener("click", function (e) {
      if (e.target && e.target.id === "btnCloseStaffRoster") {
        closeStaffRoster();
      }
    });
  }

  window.ZihuaStaffAuth = {
    getStaff: getStaff,
    isStaff: isStaff,
    isAdmin: isAdmin,
    isGoogleAdmin: isGoogleAdmin,
    canOperate: canOperate,
    loginStaff: loginStaff,
    logoutStaff: logoutStaff,
    openStaffSwitchModal: openStaffSwitchModal,
    closeStaffSwitchModal: closeStaffSwitchModal,
    openStaffRoster: openStaffRoster,
    closeStaffRoster: closeStaffRoster,
    openAdminLoginFromStaff: openAdminLoginFromStaff,
    operatorLabel: operatorLabel,
    accounts: accounts
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bindOnce);
  } else {
    bindOnce();
  }
})();
