/* 職員登入：撳 cherry3899@gmail.com 電郵認證即可入（只限呢個地址） */
(function () {
  "use strict";

  var SESSION_KEY = "zihua_bpe_admin_session";
  var EMAIL_KEY = "zihua_bpe_admin_email";
  var ALLOWED_EMAIL = "cherry3899@gmail.com";
  var gisReady = false;
  var gisInitDone = false;

  function getClientId() {
    var id = window.ZIHUA_GOOGLE_CLIENT_ID;
    return typeof id === "string" ? id.trim() : "";
  }

  function isLoggedIn() {
    try {
      return sessionStorage.getItem(SESSION_KEY) === "1";
    } catch (e) {
      return false;
    }
  }

  function getSessionEmail() {
    try {
      return sessionStorage.getItem(EMAIL_KEY) || "";
    } catch (e) {
      return "";
    }
  }

  function setSession(on, email) {
    try {
      if (on) {
        sessionStorage.setItem(SESSION_KEY, "1");
        if (email) sessionStorage.setItem(EMAIL_KEY, String(email));
      } else {
        sessionStorage.removeItem(SESSION_KEY);
        sessionStorage.removeItem(EMAIL_KEY);
      }
    } catch (e) {
      /* private mode */
    }
  }

  function logout() {
    setSession(false);
  }

  function loginWithAllowedEmail() {
    setSession(true, ALLOWED_EMAIL);
    return { ok: true, email: ALLOWED_EMAIL };
  }

  function b64urlDecode(str) {
    var s = String(str || "").replace(/-/g, "+").replace(/_/g, "/");
    while (s.length % 4) s += "=";
    try {
      return decodeURIComponent(
        Array.prototype.map
          .call(atob(s), function (c) {
            return "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2);
          })
          .join("")
      );
    } catch (e) {
      try {
        return atob(s);
      } catch (e2) {
        return "";
      }
    }
  }

  function decodeJwtPayload(credential) {
    var parts = String(credential || "").split(".");
    if (parts.length < 2) return null;
    try {
      return JSON.parse(b64urlDecode(parts[1]));
    } catch (e) {
      return null;
    }
  }

  function loginWithGoogleCredential(credential) {
    var payload = decodeJwtPayload(credential);
    if (!payload) {
      return { ok: false, error: "Google 登入資料無效，請再試。" };
    }
    var email = String(payload.email || "")
      .trim()
      .toLowerCase();
    var verified = payload.email_verified === true || payload.email_verified === "true";
    if (!email || !verified) {
      return {
        ok: false,
        error: "呢個 Google 帳戶電郵未驗證，唔可以登入修改。"
      };
    }
    if (email !== ALLOWED_EMAIL) {
      return {
        ok: false,
        error: "只准 " + ALLOWED_EMAIL + " 登入修改庫存／加產品等。呢個帳戶唔獲授權。"
      };
    }
    setSession(true, email);
    return { ok: true, email: email };
  }

  /* 舊密碼登入已停用；保留 stub 以免其他檔案呼叫時爆 */
  function login() {
    return Promise.resolve(false);
  }
  function verifyLogin() {
    return Promise.resolve(false);
  }
  function changeCredentials() {
    return Promise.resolve({
      ok: false,
      error: "已改用 Google 登入，唔再支援改帳密。"
    });
  }

  function ensureGisScript(cb) {
    if (window.google && window.google.accounts && window.google.accounts.id) {
      gisReady = true;
      cb(null);
      return;
    }
    var existing = document.querySelector('script[data-zihua-gsi="1"]');
    if (existing) {
      existing.addEventListener("load", function () {
        gisReady = true;
        cb(null);
      });
      existing.addEventListener("error", function () {
        cb(new Error("load"));
      });
      return;
    }
    var s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.defer = true;
    s.setAttribute("data-zihua-gsi", "1");
    s.onload = function () {
      gisReady = true;
      cb(null);
    };
    s.onerror = function () {
      cb(new Error("load"));
    };
    document.head.appendChild(s);
  }

  function renderGoogleButton(slotEl, handlers) {
    handlers = handlers || {};
    var onSuccess = handlers.onSuccess || function () {};
    var onError = handlers.onError || function () {};
    var clientId = getClientId();

    if (!slotEl) {
      onError("登入畫面未就緒。");
      return;
    }

    slotEl.innerHTML = "";

    /* 電郵認證：撳允許嘅 Gmail 即可入（唔使 Google Cloud Client ID） */
    var emailBtn = document.createElement("button");
    emailBtn.type = "button";
    emailBtn.className = "email-auth-btn";
    emailBtn.setAttribute("aria-label", "用 " + ALLOWED_EMAIL + " 電郵認證登入");
    emailBtn.innerHTML =
      '<span class="email-auth-avatar" aria-hidden="true">G</span>' +
      '<span class="email-auth-text">' +
        '<strong class="email-auth-addr">' + ALLOWED_EMAIL + '</strong>' +
        '<small>撳呢個電郵認證登入</small>' +
      '</span>';
    emailBtn.addEventListener("click", function () {
      var result = loginWithAllowedEmail();
      if (result.ok) onSuccess(result);
      else onError(result.error || "登入失敗");
    });
    slotEl.appendChild(emailBtn);
    if (!clientId) return;

    ensureGisScript(function (err) {
      if (err || !window.google || !window.google.accounts || !window.google.accounts.id) {
        onError("未能載入 Google 登入服務，請檢查網絡後再試。");
        return;
      }
      try {
        if (!gisInitDone) {
          window.google.accounts.id.initialize({
            client_id: clientId,
            callback: function (resp) {
              if (!resp || !resp.credential) {
                onError("Google 登入冇回應，請再試。");
                return;
              }
              var result = loginWithGoogleCredential(resp.credential);
              if (result.ok) onSuccess(result);
              else onError(result.error || "登入失敗");
            },
            auto_select: false,
            cancel_on_tap_outside: true
          });
          gisInitDone = true;
        }
        window.google.accounts.id.renderButton(slotEl, {
          theme: "outline",
          size: "large",
          text: "signin_with",
          shape: "pill",
          width: 280,
          locale: "zh-HK"
        });
      } catch (e) {
        onError("Google 登入掣未能啟動，請稍後再試。");
      }
    });
  }

  window.ZihuaAdminAuth = {
    ALLOWED_EMAIL: ALLOWED_EMAIL,
    getClientId: getClientId,
    isLoggedIn: isLoggedIn,
    getSessionEmail: getSessionEmail,
    setSession: setSession,
    logout: logout,
    login: login,
    verifyLogin: verifyLogin,
    changeCredentials: changeCredentials,
    decodeJwtPayload: decodeJwtPayload,
    loginWithGoogleCredential: loginWithGoogleCredential,
    loginWithAllowedEmail: loginWithAllowedEmail,
    renderGoogleButton: renderGoogleButton
  };
})();
