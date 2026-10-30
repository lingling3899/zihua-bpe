(function () {
  "use strict";

  var CREDS_KEY = "zihua_bpe_admin_creds_v1";
  var SESSION_KEY = "zihua_bpe_admin_session";
  var DEFAULT_USER = "zihua";
  // SHA-256 hex of "office2026"
  var DEFAULT_PASS_HASH =
    "5278374f8a2f6c0bcbb4da91e38acadef155ac20964dad6f4d3f6edede34e74e";

  function toHex(buffer) {
    var bytes = new Uint8Array(buffer);
    var out = "";
    for (var i = 0; i < bytes.length; i++) {
      out += bytes[i].toString(16).padStart(2, "0");
    }
    return out;
  }

  async function sha256Hex(str) {
    var data = new TextEncoder().encode(String(str));
    var digest = await crypto.subtle.digest("SHA-256", data);
    return toHex(digest);
  }

  function getCreds() {
    try {
      var raw = localStorage.getItem(CREDS_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (
          parsed &&
          typeof parsed.user === "string" &&
          typeof parsed.passHash === "string" &&
          parsed.user &&
          parsed.passHash
        ) {
          return { user: parsed.user, passHash: parsed.passHash };
        }
      }
    } catch (e) {
      /* ignore */
    }
    return { user: DEFAULT_USER, passHash: DEFAULT_PASS_HASH };
  }

  function setCreds(user, passHash) {
    localStorage.setItem(
      CREDS_KEY,
      JSON.stringify({ user: String(user), passHash: String(passHash) })
    );
  }

  function isLoggedIn() {
    try {
      return sessionStorage.getItem(SESSION_KEY) === "1";
    } catch (e) {
      return false;
    }
  }

  function setSession(on) {
    try {
      if (on) sessionStorage.setItem(SESSION_KEY, "1");
      else sessionStorage.removeItem(SESSION_KEY);
    } catch (e) {
      /* private mode */
    }
  }

  async function verifyLogin(user, pass) {
    var creds = getCreds();
    if (String(user) !== creds.user) return false;
    var hash = await sha256Hex(pass);
    return hash === creds.passHash;
  }

  async function login(user, pass) {
    var ok = await verifyLogin(user, pass);
    if (ok) setSession(true);
    return ok;
  }

  function logout() {
    setSession(false);
  }

  async function changeCredentials(currentPass, newUser, newPass) {
    var creds = getCreds();
    var curHash = await sha256Hex(currentPass);
    if (curHash !== creds.passHash) {
      return { ok: false, error: "而家密碼唔正確" };
    }
    var nu = String(newUser || "").trim();
    var np = String(newPass || "");
    if (!nu) return { ok: false, error: "請填新帳號" };
    if (np.length < 4) return { ok: false, error: "新密碼至少 4 個字" };
    var newHash = await sha256Hex(np);
    setCreds(nu, newHash);
    return { ok: true };
  }

  window.ZihuaAdminAuth = {
    sha256Hex: sha256Hex,
    getCreds: getCreds,
    setCreds: setCreds,
    isLoggedIn: isLoggedIn,
    verifyLogin: verifyLogin,
    login: login,
    logout: logout,
    changeCredentials: changeCredentials
  };
})();
