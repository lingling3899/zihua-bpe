/* 產品計數 · 結算 — 必揀付款；線金額（可含正價9折）→合計→減券→滿$115減$15→安宮滿$600減$80→關節滿$1200享85折→銀髮95折→膠袋$1；買6支散裝26ml送12ml／買5支散裝10ml送杯墊達標先自動開結算並扣庫存 */
(function () {
  "use strict";

  var LS_KEY = "zihua_bpe_dimsum_order_v1";
  var LS_PREORDERS = "zihua_bpe_preorders_v1";
  var LS_WIPE_FLAG = "zihua_bpe_test_orders_wiped_20261106h";
  var activeSheet = "zihua";
  var searchQ = "";
  var floatOpen = false;

  var PAY_METHODS = [
    { id: "octopus", label: "八達通" },
    { id: "cash", label: "現金港幣" },
    { id: "alipay", label: "Alipay" },
    { id: "wechat", label: "WeChat Pay" },
    { id: "payme", label: "PayMe" },
    { id: "visa", label: "VISA" },
    { id: "mastercard", label: "Mastercard" },
    { id: "unionpay", label: "銀聯" }
  ];

  var COUPON_CHIPS = [0, 15, 20, 50];

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
  function payLabel(id) {
    for (var i = 0; i < PAY_METHODS.length; i++) {
      if (PAY_METHODS[i].id === id) return PAY_METHODS[i].label;
    }
    return id || "";
  }
  function normalizeState(o) {
    o = o || {};
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
  function loadState() {
    try {
      var raw = localStorage.getItem(LS_KEY);
      if (raw) return normalizeState(JSON.parse(raw));
    } catch (e) {}
    return normalizeState({});
  }
  function saveState(st) {
    try { localStorage.setItem(LS_KEY, JSON.stringify(st)); } catch (e) {}
  }
  function data() { return window.BPE_DIMSUM_ORDER || { sheets: [] }; }
  function unitPrice(item, st) {
    if (st.overrides && st.overrides[item.code] != null && st.overrides[item.code] !== "") {
      var ov = Number(st.overrides[item.code]);
      if (!isNaN(ov)) return ov;
    }
    if (item.special != null && item.special !== "") return Number(item.special);
    if (item.orig != null && item.orig !== "") return Number(item.orig);
    return null;
  }
  function itemQty(st, code) {
    var q = Number(st.items[code] || 0);
    return q > 0 ? q : 0;
  }
  function setQty(st, id) {
    var q = Number(st.sets[id] || 0);
    return q > 0 ? q : 0;
  }

  function normCode(c) {
    return String(c == null ? "" : c).trim().toUpperCase();
  }

  function round2(n) {
    return Math.round((Number(n) || 0) * 100) / 100;
  }

  var REDEEM_STOCK = { R0001: "CMPS", R0002: "CPW021A", R0003: "ZE10", R0004: "ZA155S1" };
  var SET_SECTION_IDS = { "z-oil-set": 1, "z-pack": 1, "z-ointment-set": 1, "cp-set": 1, "cp-pack": 1 };
  var SET_SKU_CODES = {
    Z0001A: 1, Z0005: 1, Z0007A: 1, Z0007B: 1, Z0007C: 1,
    Z0004: 1, Z0004B: 1, Z0004C: 1, Z0008A: 1, Z0008B: 1,
    J0002: 1, L0024: 1
  };
  var JOINT_CODES = {
    CMPS: 1, CMPL: 1, ZA164: 1, ZA177: 1, CU51: 1,
    J0002: 1, L0024: 1, ZA119A: 1, ZA172: 1, CPW020B: 1, ZA124: 1, ZA141: 1
  };
  var JOINT_BUNDLE_IDS = { "cp-mix-3": 1 };
  var ORAL_CODES = {
    CU001: 1, ZA153: 1, ZA155: 1, ZA169: 1, CP52: 1, CPW014: 1,
    ZA119A: 1, ZA172: 1, CPW020B: 1, ZA141: 1,
    CPW003: 1, CPW010: 1, CPW011: 1, CPW015: 1, CPW016: 1, CPW017: 1, CPW026: 1,
    VTM04: 1, ZA002: 1, CPW007: 1, CPW019A: 1, ZA166: 1, CU30C: 1,
    CPW005: 1, CPW006: 1, CPW004: 1, CU22: 1,
    SWC05: 1, ZA075: 1, ZA118A: 1, ZA081: 1, ZA094: 1, ZA100A: 1, BIF02: 1,
    ZA154: 1, ZA156A: 1, ZA157: 1, ZA158: 1, ZA165: 1, ZA160: 1,
    C0004: 1, C0005: 1, C0006: 1
  };
  var ORAL_BUNDLE_IDS = {
    "an-cu001-3": 1, "an-za153-2": 1, "an-za155-3": 1, "an-za169-3": 1, "ch-lingzhi-2": 1
  };
  var TOPICAL_CODES = { CMPS: 1, CMPL: 1, ZA164: 1, ZA177: 1, CU51: 1, ZA124: 1, J0002: 1, L0024: 1 };

  function isRedeemCode(code) {
    return !!REDEEM_STOCK[normCode(code)];
  }
  function redeemStockCode(code) {
    var c = normCode(code);
    return REDEEM_STOCK[c] || c;
  }
  function isSetSku(code, sec) {
    var c = normCode(code);
    if (SET_SKU_CODES[c]) return true;
    if (sec && SET_SECTION_IDS[sec.id]) return true;
    return false;
  }
  function isCupalBrandSheet(sheet) {
    var id = String((sheet && sheet.id) || "");
    return id === "cupal-patch" || id === "cupal-health" || id === "angong-nmn";
  }
  function isCupalBrandItem(it, sheet) {
    if (!it || isRedeemCode(it.code)) return false;
    if (isCupalBrandSheet(sheet)) return true;
    return /古寶|CUPAL|Cupal/i.test(String((it.name || "") + " " + (it.code || "")));
  }
  function isListPriceItem(it, st) {
    if (!it) return false;
    if (st && st.overrides && st.overrides[it.code] != null && st.overrides[it.code] !== "") return false;
    if (it.special == null || it.special === "") return true;
    if (it.orig == null || it.orig === "") return false;
    return Number(it.special) === Number(it.orig);
  }
  function cupal9Applies(it, st, sheet, sec) {
    if (!st || !st.cupal9) return false;
    if (!it || it.displayOnly) return false;
    if (isRedeemCode(it.code)) return false;
    if (isSetSku(it.code, sec)) return false;
    if (!isCupalBrandItem(it, sheet)) return false;
    if (!isListPriceItem(it, st)) return false;
    return true;
  }
  function isJointCode(code) {
    return !!JOINT_CODES[normCode(code)];
  }
  function isOralCode(code, name) {
    var c = normCode(code);
    if (!c || TOPICAL_CODES[c] || isRedeemCode(c)) return false;
    if (ORAL_CODES[c]) return true;
    return /調理個/.test(String(name || ""));
  }

  function getSetPicks(st, id) {
    var arr = st.setPicks && st.setPicks[id];
    return Array.isArray(arr) ? arr : [];
  }

  function findBundleContext(bundleId) {
    var sheets = allSheets();
    for (var si = 0; si < sheets.length; si++) {
      var sheet = sheets[si];
      var secs = sheet.sections || [];
      for (var i = 0; i < secs.length; i++) {
        var sec = secs[i];
        var bundles = sec.bundles || [];
        for (var j = 0; j < bundles.length; j++) {
          if (bundles[j].id === bundleId) {
            return { sheet: sheet, section: sec, bundle: bundles[j] };
          }
        }
      }
    }
    return null;
  }

  /** 本區可揀貨號（含 displayOnly，方便職員睇選項） */
  function eligiblePickItems(sec) {
    return (sec.items || []).filter(function (it) {
      return it && it.code;
    });
  }

  function isPickAnyBundle(bundle, sec) {
    if (!bundle || !(Number(bundle.setSize) >= 2)) return false;
    return eligiblePickItems(sec).length >= 2;
  }

  function isPickAnyId(bundleId) {
    var ctx = findBundleContext(bundleId);
    return !!(ctx && isPickAnyBundle(ctx.bundle, ctx.section));
  }

  function aggregateCodes(codes) {
    var map = {};
    var order = [];
    (codes || []).forEach(function (c) {
      var k = normCode(c);
      if (!k) return;
      if (!map[k]) {
        map[k] = 0;
        order.push(k);
      }
      map[k] += 1;
    });
    return order.map(function (k) {
      return map[k] > 1 ? (k + "×" + map[k]) : k;
    }).join("、");
  }

  function flattenPicks(picks) {
    var out = [];
    (picks || []).forEach(function (set) {
      (set || []).forEach(function (c) { out.push(normCode(c)); });
    });
    return out;
  }

  function formatPicksForLine(picks) {
    if (!picks || !picks.length) return "";
    if (picks.length === 1) {
      return (picks[0] || []).map(normCode).filter(Boolean).join("、");
    }
    return picks.map(function (set, i) {
      return "①②③④⑤⑥⑦⑧⑨⑩".charAt(i) + " " + (set || []).map(normCode).filter(Boolean).join("、");
    }).join("　");
  }

  function picksSummaryHtml(st, bundleId, qty) {
    var picks = getSetPicks(st, bundleId);
    if (qty <= 0) return "";
    if (!picks.length) {
      return '<button type="button" class="pc-picks-summary pc-picks-missing" data-edit-picks="' +
        esc(bundleId) + '">未入實際貨號</button>';
    }
    var flat = flattenPicks(picks);
    var agg = aggregateCodes(flat);
    var miss = qty - picks.length;
    var extra = miss > 0 ? (' · 尚欠 ' + miss + ' 套') : "";
    return (
      '<button type="button" class="pc-picks-summary" data-edit-picks="' + esc(bundleId) + '">' +
        "已選：" + esc(agg) + esc(extra) +
      "</button>"
    );
  }

  function adjustItemQtys(st, codes, deltaSign) {
    (codes || []).forEach(function (c) {
      var k = normCode(c);
      if (!k) return;
      var cur = Math.max(0, Math.floor(Number(st.items[k] || 0)));
      var next = cur + (deltaSign > 0 ? 1 : -1);
      if (next <= 0) delete st.items[k];
      else st.items[k] = next;
    });
  }

  function incompletePickAnyBundles(st) {
    var bad = [];
    var sheets = allSheets();
    sheets.forEach(function (sheet) {
      (sheet.sections || []).forEach(function (sec) {
        (sec.bundles || []).forEach(function (b) {
          if (!isPickAnyBundle(b, sec)) return;
          var q = setQty(st, b.id);
          if (q <= 0) return;
          var picks = getSetPicks(st, b.id);
          if (picks.length !== q) {
            bad.push(b.label || b.id);
          }
        });
      });
    });
    return bad;
  }

  var pickModalState = null;

  function ensurePickModal() {
    var el = $("pickAnyModal");
    if (el) return el;
    el = document.createElement("div");
    el.id = "pickAnyModal";
    el.className = "modal-backdrop hidden";
    el.setAttribute("role", "dialog");
    el.setAttribute("aria-modal", "true");
    el.setAttribute("aria-labelledby", "pickAnyTitle");
    el.innerHTML =
      '<div class="modal pick-any-modal">' +
        '<div class="pick-any-head">' +
          '<h3 id="pickAnyTitle">任選</h3>' +
          '<button type="button" class="pick-any-x" id="pickAnyClose" aria-label="關閉">✕</button>' +
        "</div>" +
        '<p class="pick-any-sub" id="pickAnySub"></p>' +
        '<div class="pick-any-slots" id="pickAnySlots"></div>' +
        '<label class="pick-any-filter-wrap">' +
          '<span class="sr-only">篩選</span>' +
          '<input type="search" id="pickAnyFilter" class="pick-any-filter" placeholder="篩選貨號／名稱" autocomplete="off" />' +
        "</label>" +
        '<div class="pick-any-chips" id="pickAnyChips"></div>' +
        '<p class="pick-any-err" id="pickAnyErr" role="status"></p>' +
        '<div class="btn-row pick-any-actions">' +
          '<button type="button" class="btn-ghost" id="pickAnyCancel">取消</button>' +
          '<button type="button" class="primary" id="pickAnyConfirm" disabled>確認</button>' +
        "</div>" +
      "</div>";
    document.body.appendChild(el);
    el.addEventListener("click", function (e) {
      if (e.target === el) closePickModal();
    });
    el.querySelector("#pickAnyClose").addEventListener("click", closePickModal);
    el.querySelector("#pickAnyCancel").addEventListener("click", closePickModal);
    el.querySelector("#pickAnyConfirm").addEventListener("click", confirmPickModal);
    el.querySelector("#pickAnyFilter").addEventListener("input", function () {
      if (!pickModalState) return;
      pickModalState.filter = el.querySelector("#pickAnyFilter").value || "";
      renderPickChips();
    });
    el.querySelector("#pickAnySlots").addEventListener("input", function (e) {
      var t = e.target;
      if (!t || !t.classList.contains("pick-any-slot")) return;
      var idx = Number(t.getAttribute("data-slot"));
      if (!pickModalState || isNaN(idx)) return;
      pickModalState.slots[idx] = t.value;
      validatePickSlots(false);
    });
    el.querySelector("#pickAnyChips").addEventListener("click", function (e) {
      var chip = e.target.closest("[data-pick-code]");
      if (!chip || !pickModalState) return;
      var code = chip.getAttribute("data-pick-code");
      var slots = pickModalState.slots;
      var filled = -1;
      for (var i = 0; i < slots.length; i++) {
        if (!normCode(slots[i])) { filled = i; break; }
      }
      if (filled < 0) return;
      pickModalState.slots[filled] = code;
      syncPickSlotInputs();
      validatePickSlots(false);
    });
    return el;
  }

  function closePickModal() {
    var el = $("pickAnyModal");
    if (el) el.classList.add("hidden");
    pickModalState = null;
  }

  function syncPickSlotInputs() {
    var wrap = $("pickAnySlots");
    if (!wrap || !pickModalState) return;
    var inputs = wrap.querySelectorAll(".pick-any-slot");
    for (var i = 0; i < inputs.length; i++) {
      inputs[i].value = pickModalState.slots[i] || "";
    }
  }

  function renderPickChips() {
    var box = $("pickAnyChips");
    if (!box || !pickModalState) return;
    var q = String(pickModalState.filter || "").trim().toLowerCase();
    var html = pickModalState.eligible.map(function (it) {
      var hay = (it.code + " " + (it.name || "")).toLowerCase();
      if (q && hay.indexOf(q) < 0) return "";
      return (
        '<button type="button" class="pick-any-chip" data-pick-code="' + esc(it.code) + '">' +
          "<strong>" + esc(it.code) + "</strong>" +
          "<span>" + esc(it.name || "") + "</span>" +
        "</button>"
      );
    }).join("");
    box.innerHTML = html || '<p class="muted">冇符合篩選嘅貨號</p>';
  }

  function validatePickSlots(showErr) {
    if (!pickModalState) return false;
    var allowed = {};
    pickModalState.eligible.forEach(function (it) { allowed[normCode(it.code)] = true; });
    var ok = true;
    var err = "";
    var normalized = [];
    for (var i = 0; i < pickModalState.slots.length; i++) {
      var c = normCode(pickModalState.slots[i]);
      if (!c) {
        ok = false;
        break;
      }
      if (!allowed[c]) {
        ok = false;
        err = "貨號「" + c + "」唔喺呢套可揀清單";
        break;
      }
      normalized.push(c);
    }
    var btn = $("pickAnyConfirm");
    if (btn) btn.disabled = !ok;
    var errEl = $("pickAnyErr");
    if (errEl) errEl.textContent = (showErr || err) ? err : "";
    if (ok) pickModalState._normalized = normalized;
    else pickModalState._normalized = null;
    return ok;
  }

  function openPickModal(bundleId, opts) {
    opts = opts || {};
    var ctx = findBundleContext(bundleId);
    if (!ctx || !isPickAnyBundle(ctx.bundle, ctx.section)) return;
    var size = Math.max(2, Math.floor(Number(ctx.bundle.setSize) || 2));
    var eligible = eligiblePickItems(ctx.section).map(function (it) {
      return { code: normCode(it.code), name: it.name || "" };
    });
    var seed = opts.seed || [];
    var slots = [];
    for (var i = 0; i < size; i++) slots.push(seed[i] ? normCode(seed[i]) : "");
    pickModalState = {
      bundleId: bundleId,
      label: ctx.bundle.label || bundleId,
      setSize: size,
      eligible: eligible,
      mode: opts.mode || "add",
      editIndex: opts.editIndex == null ? null : opts.editIndex,
      slots: slots,
      filter: "",
      useItemPrices: !!ctx.bundle.useItemPrices
    };
    var el = ensurePickModal();
    $("pickAnyTitle").textContent = pickModalState.label;
    $("pickAnySub").textContent = "請入實際要哪 " + size + " 款貨號";
    $("pickAnyFilter").value = "";
    var filterWrap = el.querySelector(".pick-any-filter-wrap");
    if (filterWrap) filterWrap.style.display = eligible.length > 8 ? "" : "none";
    var slotsHtml = "";
    for (var s = 0; s < size; s++) {
      slotsHtml +=
        '<label class="pick-any-slot-wrap">' +
          '<span class="pick-any-slot-n">' + (s + 1) + "</span>" +
          '<input type="text" class="pick-any-slot" data-slot="' + s +
            '" inputmode="text" autocomplete="off" autocapitalize="characters" ' +
            'spellcheck="false" placeholder="入機代號" value="' + esc(slots[s]) + '" />' +
        "</label>";
    }
    $("pickAnySlots").innerHTML = slotsHtml;
    $("pickAnyErr").textContent = "";
    var chipsEl = $("pickAnyChips");
    if (chipsEl) chipsEl.onclick = null;
    renderPickChips();
    validatePickSlots(false);
    el.classList.remove("hidden");
    var first = $("pickAnySlots").querySelector(".pick-any-slot");
    if (first) {
      try { first.focus(); first.select(); } catch (e) {}
    }
  }

  function confirmPickModal() {
    if (!validatePickSlots(true) || !pickModalState || !pickModalState._normalized) return;
    var codes = pickModalState._normalized.slice();
    var id = pickModalState.bundleId;
    var mode = pickModalState.mode;
    var editIndex = pickModalState.editIndex;
    var useItemPrices = pickModalState.useItemPrices;
    var st = loadState();
    if (!st.setPicks) st.setPicks = {};
    var picks = getSetPicks(st, id).slice();

    if (mode === "edit" && editIndex != null && editIndex >= 0 && editIndex < picks.length) {
      var old = picks[editIndex] || [];
      if (useItemPrices) {
        adjustItemQtys(st, old, -1);
        adjustItemQtys(st, codes, 1);
      }
      picks[editIndex] = codes;
      st.setPicks[id] = picks;
      saveState(st);
      closePickModal();
      render();
      return;
    }

    if (mode === "fill") {
      // 舊車／尚欠：只補 setPicks，唔再加套數
      var qFill = setQty(st, id);
      if (picks.length >= qFill) {
        closePickModal();
        render();
        return;
      }
      picks.push(codes);
      st.setPicks[id] = picks;
      if (useItemPrices) adjustItemQtys(st, codes, 1);
      saveState(st);
      closePickModal();
      render();
      // 若仲欠，自動再開下一套
      if (picks.length < qFill) {
        setTimeout(function () { openPickModal(id, { mode: "fill" }); }, 0);
      }
      return;
    }

    // add：追加一套並 +1 set qty
    picks.push(codes);
    st.setPicks[id] = picks;
    st.sets[id] = (Number(st.sets[id]) || 0) + 1;
    if (useItemPrices) adjustItemQtys(st, codes, 1);
    saveState(st);
    closePickModal();
    // 任選唔自動開結算
    render();
  }

  function decrementPickAny(bundleId) {
    var ctx = findBundleContext(bundleId);
    if (!ctx) return;
    var st = loadState();
    var q = setQty(st, bundleId);
    if (q <= 0) return;
    var picks = getSetPicks(st, bundleId).slice();
    var popped = picks.length ? picks.pop() : null;
    if (ctx.bundle.useItemPrices && popped) adjustItemQtys(st, popped, -1);
    var n = q - 1;
    if (n <= 0) {
      delete st.sets[bundleId];
      if (st.setPicks) delete st.setPicks[bundleId];
    } else {
      st.sets[bundleId] = n;
      if (st.setPicks) {
        if (picks.length) st.setPicks[bundleId] = picks;
        else delete st.setPicks[bundleId];
      }
    }
    saveState(st);
    render();
  }

  function openEditPicksFlow(bundleId) {
    var ctx = findBundleContext(bundleId);
    if (!ctx || !isPickAnyBundle(ctx.bundle, ctx.section)) return;
    var st = loadState();
    var q = setQty(st, bundleId);
    if (q <= 0) {
      openPickModal(bundleId, { mode: "add" });
      return;
    }
    var picks = getSetPicks(st, bundleId);
    if (picks.length < q) {
      openPickModal(bundleId, { mode: "fill" });
      return;
    }
    if (picks.length === 1) {
      openPickModal(bundleId, { mode: "edit", editIndex: 0, seed: picks[0] });
      return;
    }
    // 多套：簡易清單揀邊套改
    openPickSetsList(bundleId, picks);
  }

  function openPickSetsList(bundleId, picks) {
    var ctx = findBundleContext(bundleId);
    if (!ctx) return;
    var el = ensurePickModal();
    pickModalState = { bundleId: bundleId, mode: "list" };
    $("pickAnyTitle").textContent = ctx.bundle.label || bundleId;
    $("pickAnySub").textContent = "揀一套改實際貨號（套數不變）";
    $("pickAnySlots").innerHTML = "";
    var filterWrap = el.querySelector(".pick-any-filter-wrap");
    if (filterWrap) filterWrap.style.display = "none";
    $("pickAnyFilter").value = "";
    var chips = $("pickAnyChips");
    chips.innerHTML = (picks || []).map(function (set, i) {
      return (
        '<button type="button" class="pick-any-set-row" data-edit-set="' + i + '">' +
          "<strong>第 " + (i + 1) + " 套</strong>" +
          "<span>" + esc((set || []).map(normCode).join("、")) + "</span>" +
          '<em>改</em>' +
        "</button>"
      );
    }).join("");
    $("pickAnyErr").textContent = "";
    var btn = $("pickAnyConfirm");
    if (btn) btn.disabled = true;
    chips.onclick = function (e) {
      var row = e.target.closest("[data-edit-set]");
      if (!row) return;
      var idx = Number(row.getAttribute("data-edit-set"));
      var st2 = loadState();
      var p2 = getSetPicks(st2, bundleId);
      openPickModal(bundleId, { mode: "edit", editIndex: idx, seed: p2[idx] || [] });
    };
    el.classList.remove("hidden");
  }

  function isAdmin() {
    if (window.ZihuaStaffAuth && window.ZihuaStaffAuth.isAdmin) {
      return !!window.ZihuaStaffAuth.isAdmin();
    }
    var a = window.ZihuaAdminAuth;
    return !!(a && a.isLoggedIn && a.isLoggedIn());
  }
  function canOperate() {
    if (window.ZihuaStaffAuth && window.ZihuaStaffAuth.canOperate) {
      return !!window.ZihuaStaffAuth.canOperate();
    }
    return isAdmin();
  }
  var POS_LS = "zihua_bpe_pos_station_v1";
  var ORDER_SEQ_LS = "zihua_bpe_order_seq_v1";
  function getPosStation() {
    try {
      var n = Math.floor(Number(localStorage.getItem(POS_LS)) || 1);
      if (n !== 1 && n !== 2) n = 1;
      return n;
    } catch (e) {
      return 1;
    }
  }
  function setPosStation(n) {
    var v = Math.floor(Number(n) || 1);
    if (v !== 1 && v !== 2) v = 1;
    try { localStorage.setItem(POS_LS, String(v)); } catch (e) {}
    return v;
  }
  function cyclePosStation() {
    return setPosStation(getPosStation() === 1 ? 2 : 1);
  }
  function hkYmd() {
    try {
      var s = new Date().toLocaleString("en-CA", {
        timeZone: "Asia/Hong_Kong",
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
      });
      return String(s).slice(0, 10).replace(/-/g, "");
    } catch (e) {
      var d = new Date();
      var y = d.getFullYear();
      var m = String(d.getMonth() + 1).padStart(2, "0");
      var day = String(d.getDate()).padStart(2, "0");
      return "" + y + m + day;
    }
  }
  function nextOrderNo(posN) {
    var date = hkYmd();
    var state = { date: date, seq: 9000 };
    try {
      var raw = localStorage.getItem(ORDER_SEQ_LS);
      if (raw) {
        var o = JSON.parse(raw);
        if (o && o.date === date && typeof o.seq === "number" && o.seq >= 0) {
          state = { date: date, seq: o.seq };
          if (state.seq < 9000) state.seq = 9000;
        }
      }
    } catch (e) {}
    state.seq = (Number(state.seq) || 9000) + 1;
    if (state.seq < 9001) state.seq = 9001;
    state.date = date;
    try {
      localStorage.setItem(ORDER_SEQ_LS, JSON.stringify(state));
    } catch (e2) {}
    var n = posN === 2 ? 2 : 1;
    return "PRE" + n + "-" + date + "-" + String(state.seq);
  }
  function loadAllOrders() {
    try {
      var raw = localStorage.getItem(LS_PREORDERS);
      var list = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(list)) return [];
      return list;
    } catch (e) {
      return [];
    }
  }

  function loadRecentOrders(limit) {
    var list = loadAllOrders();
    if (limit == null || limit <= 0) return list;
    return list.slice(0, limit);
  }

  function findOrderById(id) {
    var want = String(id || "");
    if (!want) return null;
    var list = loadAllOrders();
    for (var i = 0; i < list.length; i++) {
      if (list[i] && String(list[i].id) === want) return list[i];
    }
    return null;
  }

  function formatHkTime(iso) {
    if (!iso) return "—";
    var d = new Date(iso);
    if (isNaN(d.getTime())) return String(iso);
    try {
      return d.toLocaleString("zh-HK", {
        timeZone: "Asia/Hong_Kong",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false
      });
    } catch (e) {
      return d.toISOString();
    }
  }

  /** Clear test orders + sold + remaining overrides + daily sales. Keep restock / 總預 / daily target. */
  function clearTestOrdersData() {
    try { localStorage.removeItem(LS_PREORDERS); } catch (e) {}
    if (window.BPE_Stock) {
      if (window.BPE_Stock.clearIssued) {
        try { window.BPE_Stock.clearIssued(); } catch (e2) {}
      }
      if (window.BPE_Stock.resetToSeed) {
        try { window.BPE_Stock.resetToSeed(); } catch (e3) {}
      }
    }
    if (window.BPE_SalesTarget && window.BPE_SalesTarget.clearSales) {
      try { window.BPE_SalesTarget.clearSales(); } catch (e4) {}
    }
  }

  function maybeWipeTestOrdersOnce() {
    try {
      if (localStorage.getItem(LS_WIPE_FLAG)) return;
      clearTestOrdersData();
      localStorage.setItem(LS_WIPE_FLAG, "1");
    } catch (e) { /* private mode */ }
  }
  function bogoDiscount(prices) {
    if (!prices.length) return 0;
    var sorted = prices.slice().sort(function (a, b) { return a - b; });
    var free = Math.floor(sorted.length / 4);
    var disc = 0;
    for (var i = 0; i < free; i++) disc += sorted[i];
    return disc;
  }


  /** 買 6 支 ZE01（26ml）送 1 支 CO99（12ml） */
  function countFreeCo99(st) {
    return Math.floor(itemQty(st, "ZE01") / 6);
  }

  /**
   * 陶瓷杯墊贈品數（可疊加，唔重複計同一支）：
   * - floor((ZE05+ZE06+ZE07)/5) 單支 10ml
   * - 每個 z-scent-5 任選 5 支 bundle＝1
   * - 每個 Z0007A／B／C 花香套＝1
   */
  function countFreeCoasterParts(st) {
    var singles = itemQty(st, "ZE05") + itemQty(st, "ZE06") + itemQty(st, "ZE07");
    var fromSingles = Math.floor(singles / 5);
    var fromBundle = setQty(st, "z-scent-5");
    var fromSets = itemQty(st, "Z0007A") + itemQty(st, "Z0007B") + itemQty(st, "Z0007C");
    return {
      singles: singles,
      fromSingles: fromSingles,
      fromBundle: fromBundle,
      fromSets: fromSets,
      freeCoaster: fromSingles + fromBundle + fromSets
    };
  }

  function countFreeCoaster(st) {
    return countFreeCoasterParts(st).freeCoaster;
  }

  function coasterGiftLabel(parts) {
    var bits = [];
    if (parts.fromSingles > 0) {
      bits.push("10ml × " + parts.singles + " 送杯墊 × " + parts.fromSingles);
    }
    if (parts.fromBundle > 0) {
      if (parts.fromBundle === 1) bits.push("10ml × 5 送杯墊 × 1");
      else bits.push("10ml × 5 送杯墊 × 1 × " + parts.fromBundle + "套");
    }
    if (parts.fromSets > 0) {
      bits.push("花香套 × " + parts.fromSets + " 送杯墊 × " + parts.fromSets);
    }
    return bits.length ? bits.join("＋") : ("送杯墊 × " + parts.freeCoaster);
  }

  function z4cGiftLabel(z4cQty) {
    var n = Math.max(0, Math.floor(Number(z4cQty) || 0));
    if (n <= 0) return "";
    if (n === 1) return "一套 6支26ml 送 1支12ml";
    return n + "套（每套6支26ml）送 " + n + "支12ml";
  }

  function freeCo99GiftLabel(freeCo99) {
    var n = Math.max(0, Math.floor(Number(freeCo99) || 0));
    if (n <= 0) return "";
    if (n === 1) return "一套 6支26ml 送 1支12ml";
    return n + "套（每套6支26ml）送 " + n + "支12ml";
  }

  function calcTotals(st) {
    var sheets = allSheets();
    var total = 0;
    var lines = [];
    var pieceCount = 0;
    var promo115Qual = 0;
    var jointQual = 0;
    var angongQual = 0;
    var oralQual = 0;
    var redeemCount = 0;
    var nonRedeemCount = 0;
    var cupal9Saved = 0;

    function addQualifiers(amt, flags) {
      var a = round2(amt);
      if (!flags) return;
      if (flags.c1) promo115Qual = round2(promo115Qual + a);
      if (flags.joint) jointQual = round2(jointQual + a);
      if (flags.angong) angongQual = round2(angongQual + a);
      if (flags.oral) oralQual = round2(oralQual + a);
    }

    sheets.forEach(function (sheet) {
      (sheet.sections || []).forEach(function (sec) {
        var hasBogo = (sec.bundles || []).some(function (b) { return b.useItemPrices; });
        (sec.bundles || []).forEach(function (b) {
          var q = setQty(st, b.id);
          if (q <= 0) return;
          pieceCount += q;
          nonRedeemCount += q;
          var picksTxt = "";
          if (isPickAnyBundle(b, sec)) {
            picksTxt = formatPicksForLine(getSetPicks(st, b.id));
          }
          if (b.useItemPrices) {
            lines.push({
              kind: "set-note",
              label: sec.title + " · " + b.label + " × " + q + (picksTxt ? ("　" + picksTxt) : ""),
              amount: null
            });
            return;
          }
          if (b.setPrice == null) return;
          var amt = round2(q * Number(b.setPrice));
          total += amt;
          var isJointSet = !!JOINT_BUNDLE_IDS[b.id];
          var isOralSet = !!ORAL_BUNDLE_IDS[b.id];
          addQualifiers(amt, { c1: false, joint: isJointSet, angong: false, oral: isOralSet });
          lines.push({
            kind: "set",
            label: b.label + " × " + q + (picksTxt ? ("　" + picksTxt) : ""),
            amount: amt,
            isSet: true,
            isJoint: isJointSet,
            isOral: isOralSet
          });
        });

        var bogoEntries = [];
        (sec.items || []).forEach(function (it) {
          if (it.displayOnly) return;
          var q = itemQty(st, it.code);
          if (q <= 0) return;
          pieceCount += q;
          var redeem = isRedeemCode(it.code) || sec.id === "rd-redeem";
          if (redeem) redeemCount += q;
          else nonRedeemCount += q;
          var p = unitPrice(it, st);
          var apply9 = !redeem && cupal9Applies(it, st, sheet, sec);
          if (p == null) {
            lines.push({ kind: "item", label: it.code + " " + it.name + " × " + q, amount: null, code: it.code });
            return;
          }
          if (it.packQty && it.packPrice) {
            var packs = Math.floor(q / it.packQty);
            var rem = q % it.packQty;
            var remGross = rem * p;
            var remAmt = apply9 ? round2(remGross * 0.9) : remGross;
            if (apply9) cupal9Saved = round2(cupal9Saved + (remGross - remAmt));
            var packAmt = packs * Number(it.packPrice);
            var amt = round2(packAmt + remAmt);
            total += amt;
            var joint = isJointCode(it.code);
            var oral = isOralCode(it.code, it.name);
            var angong = normCode(it.code) === "CU001";
            addQualifiers(packAmt, { c1: false, joint: joint, angong: false, oral: oral });
            addQualifiers(remAmt, { c1: !redeem && !isSetSku(it.code, sec), joint: joint, angong: angong, oral: oral });
            lines.push({ kind: "item", label: it.code + " " + it.name + " × " + q, amount: amt, code: it.code, cupal9: apply9 && rem > 0 });
            return;
          }
          var gross = q * p;
          var lineAmt = apply9 ? round2(gross * 0.9) : round2(gross);
          if (apply9) cupal9Saved = round2(cupal9Saved + (gross - lineAmt));
          var flags = {
            redeem: redeem,
            c1: !redeem && !isSetSku(it.code, sec),
            joint: !redeem && isJointCode(it.code),
            angong: !redeem && normCode(it.code) === "CU001",
            oral: !redeem && isOralCode(it.code, it.name),
            apply9: apply9
          };
          if (hasBogo) {
            for (var i = 0; i < q; i++) bogoEntries.push({ price: apply9 ? round2(p * 0.9) : p });
            bogoEntries[bogoEntries.length - 1]._meta = true;
            bogoEntries._items = bogoEntries._items || [];
            bogoEntries._items.push({ it: it, q: q, lineAmt: lineAmt, flags: flags });
            return;
          }
          total += lineAmt;
          addQualifiers(lineAmt, flags);
          lines.push({
            kind: "item",
            label: it.code + " " + it.name + " × " + q,
            amount: lineAmt,
            code: it.code,
            cupal9: apply9,
            isRedeem: redeem
          });
        });
        if (hasBogo && bogoEntries._items && bogoEntries._items.length) {
          var bogoPrices = [];
          bogoEntries.forEach(function (e) {
            if (e && e.price != null) bogoPrices.push(e.price);
          });
          var items = bogoEntries._items;
          var grossBogo = 0;
          items.forEach(function (e) { grossBogo = round2(grossBogo + e.lineAmt); });
          var disc = bogoDiscount(bogoPrices);
          disc = round2(disc);
          items.forEach(function (e) {
            total += e.lineAmt;
            lines.push({
              kind: "item",
              label: e.it.code + " " + e.it.name + " × " + e.q,
              amount: e.lineAmt,
              code: e.it.code,
              cupal9: e.flags.apply9
            });
          });
          if (disc > 0) {
            total -= disc;
            lines.push({ kind: "discount", label: sec.title + " · 買3送1", amount: -disc, isSet: true });
            items.forEach(function (e) {
              var share = grossBogo > 0 ? (e.lineAmt / grossBogo) * (grossBogo - disc) : 0;
              var f = {
                c1: false,
                joint: e.flags.joint,
                angong: e.flags.angong,
                oral: e.flags.oral
              };
              addQualifiers(share, f);
            });
          } else {
            items.forEach(function (e) { addQualifiers(e.lineAmt, e.flags); });
          }
        }
      });
    });
    // 買 6 支 ZE01（26ml）送 1 支 CO99（12ml）— 贈品 $0，結算要扣庫存
    var ze01Qty = itemQty(st, "ZE01");
    var z4cQty = itemQty(st, "Z0004C");
    var freeCo99 = countFreeCo99(st);
    if (freeCo99 > 0) {
      lines.push({
        kind: "gift",
        label: "買6送1：" + freeCo99GiftLabel(freeCo99),
        amount: 0,
        code: "CO99",
        giftQty: freeCo99
      });
    }
    if (z4cQty > 0) {
      lines.push({
        kind: "gift",
        label: "套裝已含：" + z4cGiftLabel(z4cQty),
        amount: null,
        code: "Z0004C",
        giftQty: z4cQty
      });
    }
    // 買 5 支 10ml／任選5支／花香套 → 陶瓷杯墊 CUPAL-B088
    var coasterParts = countFreeCoasterParts(st);
    var freeCoaster = coasterParts.freeCoaster;
    if (freeCoaster > 0) {
      lines.push({
        kind: "gift",
        label: coasterGiftLabel(coasterParts),
        amount: 0,
        code: "CUPAL-B088",
        giftQty: freeCoaster
      });
    }
    var nmnGiftApplied = !!st.nmnGift && oralQual >= 1200;
    if (nmnGiftApplied) {
      lines.push({
        kind: "gift",
        label: "口服保健滿$1200送 ZA155S1 CUPAL PQQ NMN Ex 10粒試食裝",
        amount: 0,
        code: "ZA155S1",
        giftQty: 1
      });
    }
    return {
      total: round2(total),
      lines: lines,
      count: pieceCount,
      freeCo99: freeCo99,
      ze01Qty: ze01Qty,
      z4cQty: z4cQty,
      freeCoaster: freeCoaster,
      coasterParts: coasterParts,
      promo115Qual: round2(promo115Qual),
      jointQual: round2(jointQual),
      angongQual: round2(angongQual),
      oralQual: round2(oralQual),
      redeemCount: redeemCount,
      nonRedeemCount: nonRedeemCount,
      nmnGiftApplied: nmnGiftApplied,
      cupal9Saved: round2(cupal9Saved)
    };
  }

  /** 結算扣庫存需求：購物車各碼＋買6送1 免費 CO99＋買5送杯墊 CUPAL-B088 */
  function buildStockDemand(st) {
    var demand = {};
    function add(code, n) {
      var c = String(code || "").trim();
      var q = Math.max(0, Math.floor(Number(n) || 0));
      if (!c || q <= 0) return;
      demand[c] = (demand[c] || 0) + q;
    }
    var sheets = allSheets();
    sheets.forEach(function (sheet) {
      (sheet.sections || []).forEach(function (sec) {
        (sec.items || []).forEach(function (it) {
          if (it.displayOnly) return;
          var code = it.code;
          if (isRedeemCode(code)) code = redeemStockCode(code);
          add(code, itemQty(st, it.code));
        });
        (sec.bundles || []).forEach(function (b) {
          if (!isPickAnyBundle(b, sec)) return;
          // useItemPrices：庫存已由 st.items 計；有價任選先由 setPicks 扣實際貨號
          if (b.useItemPrices) return;
          flattenPicks(getSetPicks(st, b.id)).forEach(function (c) { add(c, 1); });
        });
      });
    });
    var ze01 = demand.ZE01 || 0;
    var freeN = Math.floor(ze01 / 6);
    if (freeN > 0) add("CO99", freeN);
    // Z0004C 以套裝 SKU 扣；唔另外扣 ZE01／CO99（套裝已喺總預貨量獨立列）
    var freeCoaster = countFreeCoaster(st);
    if (freeCoaster > 0) add("CUPAL-B088", freeCoaster);
    var calcDemand = calcTotals(st);
    if (calcDemand.nmnGiftApplied) add("ZA155S1", 1);
    if (window.BPE_Gifts && typeof window.BPE_Gifts.evaluate === "function") {
      try {
        var evGift = window.BPE_Gifts.evaluate(calcDemand.total, st);
        if (evGift && evGift.highestSpend && evGift.highestSpend.sku) {
          add(evGift.highestSpend.sku, 1);
        }
      } catch (eGift) {}
    }
    return demand;
  }

  function formatStockShorts(shorts) {
    return (shorts || []).map(function (s) {
      var name = s.name ? (" " + s.name) : "";
      return "庫存唔夠：" + s.code + name + " 淨餘 " + s.have + "，訂單要 " + s.need;
    }).join("\n");
  }

  function cupalQualifyingSubtotal(st) {
    return calcTotals(st).jointQual || 0;
  }

  /** 線金額（可含 D9 9折）→ 合計 → 減券 → C1 −15 → C3 −80 → C2 關節小計 85折 → 銀髮 95折 → ＋袋$1 */
  function pricing(st, calc) {
    var computed = calcTotals(st);
    var merged = Object.assign({}, computed);
    if (calc) {
      Object.keys(calc).forEach(function (k) {
        if (calc[k] != null) merged[k] = calc[k];
      });
    }
    calc = merged;
    var subtotal = Math.max(0, round2(Number(calc.total) || 0));
    var couponRaw = Math.max(0, Number(st.couponAmount) || 0);
    var couponAmount = Math.min(couponRaw, subtotal);
    couponAmount = round2(couponAmount);
    var afterCoupon = round2(subtotal - couponAmount);

    var promo115Qual = calc.promo115Qual != null ? calc.promo115Qual : 0;
    var promo115 = !!st.promo115;
    var promo115Applied = promo115 && promo115Qual >= 115;
    var promo115Amount = promo115Applied ? 15 : 0;
    var afterPromo115 = round2(Math.max(0, afterCoupon - promo115Amount));

    var angongQual = calc.angongQual != null ? calc.angongQual : 0;
    var angong80 = !!st.angong80;
    var angong80Applied = angong80 && angongQual >= 600;
    var angong80Amount = angong80Applied ? 80 : 0;
    var afterAngong80 = round2(Math.max(0, afterPromo115 - angong80Amount));

    var jointQual = calc.jointQual != null ? calc.jointQual : 0;
    var cupal85 = !!st.cupal85;
    var cupal85Applied = cupal85 && jointQual >= 1200;
    var cupal85Amount = 0;
    var afterCupal85 = afterAngong80;
    if (cupal85Applied) {
      cupal85Amount = round2(jointQual * 0.15);
      if (cupal85Amount > afterAngong80) cupal85Amount = afterAngong80;
      afterCupal85 = round2(afterAngong80 - cupal85Amount);
    }

    var senior = !!st.senior;
    var payableBeforeBag = afterCupal85;
    if (senior) payableBeforeBag = round2(afterCupal85 * 0.95);

    var plasticBag = !!st.plasticBag;
    var bagFee = plasticBag ? 1 : 0;
    var payable = round2(payableBeforeBag + bagFee);
    var nmnGiftApplied = !!calc.nmnGiftApplied;

    return {
      subtotal: subtotal,
      couponAmount: couponAmount,
      afterCoupon: afterCoupon,
      promo115: promo115,
      promo115Qual: promo115Qual,
      promo115Applied: promo115Applied,
      promo115Amount: promo115Amount,
      afterPromo115: afterPromo115,
      angong80: angong80,
      angongQual: angongQual,
      angong80Applied: angong80Applied,
      angong80Amount: angong80Amount,
      afterAngong80: afterAngong80,
      cupal85: cupal85,
      cupalQualifying: jointQual,
      jointQual: jointQual,
      cupal85Applied: cupal85Applied,
      cupal85Amount: cupal85Amount,
      afterCupal85: afterCupal85,
      cupal9: !!st.cupal9,
      cupal9Applied: !!st.cupal9 && (calc.cupal9Saved || 0) > 0,
      cupal9Saved: calc.cupal9Saved || 0,
      senior: senior,
      plasticBag: plasticBag,
      bagFee: bagFee,
      payableBeforeBag: payableBeforeBag,
      payable: payable,
      nmnGift: !!st.nmnGift,
      nmnGiftApplied: nmnGiftApplied,
      oralQual: calc.oralQual || 0,
      paymentMethod: st.paymentMethod || ""
    };
  }

  function sheetCount(st, sheet) {
    var n = 0;
    (sheet.sections || []).forEach(function (sec) {
      (sec.bundles || []).forEach(function (b) { n += setQty(st, b.id); });
      (sec.items || []).forEach(function (it) {
        if (!it.displayOnly) n += itemQty(st, it.code);
      });
    });
    return n;
  }

  function matchQ(text) {
    if (!searchQ) return true;
    return String(text || "").toLowerCase().indexOf(searchQ.toLowerCase()) >= 0;
  }

  function qtyCtrl(kind, id, val) {
    return (
      '<div class="qty-ctrl" data-kind="' + esc(kind) + '" data-id="' + esc(id) + '">' +
        '<button type="button" class="qty-btn" data-delta="-1" aria-label="減">−</button>' +
        '<span class="qty-val" aria-label="數量">' + esc(String(val || 0)) + "</span>" +
        '<button type="button" class="qty-btn qty-plus" data-delta="1" aria-label="加">＋</button>' +
      "</div>"
    );
  }

  function renderRecentOrdersHtml() {
    if (!isAdmin()) return "";
    var list = loadRecentOrders(50);
    var head =
      '<div class="pc-recent-orders admin-only">' +
        '<div class="pc-recent-head">' +
          "<h4>最近單據</h4>" +
          '<button type="button" class="btn-ghost pc-orders-clear" id="btnClearTestOrders">清除全部測試訂單</button>' +
        "</div>";
    if (!list.length) {
      return head + '<p class="muted">未有本機結算紀錄。</p></div>';
    }
    var rows = list.map(function (o) {
      var no = o.orderNo || o.id || "—";
      var pay = o.paymentLabel || o.paymentMethod || "";
      var amt = o.payable != null ? ("$" + money(o.payable)) : "";
      var when = formatHkTime(o.t);
      return (
        '<li>' +
          '<button type="button" class="pc-order-row" data-order-id="' + esc(o.id || "") + '" aria-label="睇單據 ' + esc(no) + '">' +
            '<span class="pc-order-row-main">' +
              '<strong class="pc-order-no">' + esc(no) + "</strong>" +
              '<span class="pc-order-meta">' + esc(pay) + (amt ? " · " + esc(amt) : "") + "</span>" +
            "</span>" +
            '<span class="pc-order-row-sub muted">' + esc(when) +
              (o.pos ? (" · POS" + esc(String(o.pos))) : "") +
              ' · 撳入去睇詳情／印單</span>' +
          "</button>" +
        "</li>"
      );
    }).join("");
    return head + '<ul class="pc-recent-list">' + rows + "</ul></div>";
  }

  function ensureOrderDrawer() {
    var el = $("orderDetailDrawer");
    if (el) return el;
    el = document.createElement("div");
    el.id = "orderDetailDrawer";
    el.className = "drawer hidden";
    el.setAttribute("role", "dialog");
    el.setAttribute("aria-modal", "true");
    el.setAttribute("aria-label", "單據詳情");
    el.innerHTML =
      '<div class="drawer-panel order-detail-panel">' +
        '<div class="drawer-head">' +
          "<h3>單據詳情</h3>" +
          '<button type="button" class="btn-ghost" id="btnCloseOrderDetail">關閉</button>' +
        "</div>" +
        '<div id="orderDetailRoot"></div>' +
      "</div>";
    document.body.appendChild(el);
    el.addEventListener("click", function (e) {
      if (e.target === el) closeOrderDetail();
    });
    return el;
  }

  function closeOrderDetail() {
    var d = $("orderDetailDrawer");
    if (d) d.classList.add("hidden");
  }

  function orderLinesHtml(order) {
    var lines = (order && order.lines) || [];
    if (!lines.length) return '<p class="muted">未有產品明細</p>';
    var rows = lines.map(function (ln) {
      var label = (ln && ln.label) != null ? ln.label : "—";
      var amt = ln && ln.amount != null && ln.amount !== "" && !isNaN(ln.amount)
        ? ("$" + money(ln.amount))
        : "—";
      return (
        '<li class="order-line">' +
          '<span class="order-line-label">' + esc(label) + "</span>" +
          '<span class="order-line-amt">' + esc(amt) + "</span>" +
        "</li>"
      );
    }).join("");
    return '<ul class="order-lines">' + rows + "</ul>";
  }

  function renderOrderDetail(order) {
    if (!order) {
      return '<p class="muted">搵唔到呢張單。</p>';
    }
    var gifts = (order.gifts && order.gifts.length)
      ? ('<p class="order-detail-gifts"><strong>禮遇</strong>：' + esc(order.gifts.join("；")) + "</p>")
      : "";
    return (
      '<div class="order-detail">' +
        '<p class="order-detail-no"><strong class="pc-order-no">' + esc(order.orderNo || order.id || "—") + "</strong></p>" +
        '<p class="order-detail-meta">POS ' + esc(String(order.pos != null ? order.pos : "—")) +
          " · " + esc(formatHkTime(order.t)) + "</p>" +
        '<p class="order-detail-pay"><strong>付款</strong>：' + esc(order.paymentLabel || order.paymentMethod || "—") + "</p>" +
        '<h4 class="order-detail-h">產品</h4>' +
        orderLinesHtml(order) +
        '<div class="order-detail-totals">' +
          '<div><span>合計</span><strong>$' + esc(money(order.subtotal != null ? order.subtotal : order.total)) + "</strong></div>" +
          '<div><span>優惠券</span><strong>−$' + esc(money(order.couponAmount || 0)) + "</strong></div>" +
          '<div><span>券後</span><strong>$' + esc(money(order.afterCoupon)) + "</strong></div>" +
          (order.cupal9Applied ? '<div><span>CUPAL 正價單件 9折</span><strong>已計入合計</strong></div>' : "") +
          (order.promo115Applied ? '<div><span>滿$115減$15</span><strong>−$' + esc(money(order.promo115Amount || 15)) + "</strong></div>" : "") +
          (order.angong80Applied ? '<div><span>古寶安宮滿$600減$80</span><strong>−$' + esc(money(order.angong80Amount || 80)) + "</strong></div>" : "") +
          (order.cupal85Applied ? '<div><span>古寶肌肉關節 85折</span><strong>−$' + esc(money(order.cupal85Amount || 0)) + "</strong></div>" : "") +
          (order.senior ? '<div><span>銀髮 95 折</span><strong>已套用</strong></div>' : "") +
          (order.plasticBag ? '<div><span>膠購物袋 $1</span><strong>+$' + esc(money(order.bagFee || 1)) + "</strong></div>" : "") +
          (order.nmnGiftApplied ? '<div><span>送 NMN 試用裝</span><strong>ZA155S1 × 1</strong></div>' : "") +
          '<div class="order-detail-payable"><span>實付</span><strong>$' + esc(money(order.payable)) + "</strong></div>" +
        "</div>" +
        gifts +
        '<div class="btn-row order-detail-actions">' +
          '<button type="button" class="primary" id="btnPrintOrder" data-order-id="' + esc(order.id || "") + '">印單</button>' +
          '<button type="button" class="btn-ghost" id="btnCloseOrderDetail2">關閉</button>' +
        "</div>" +
        '<p class="muted order-detail-note">本機結算單據；以支付為準</p>' +
      "</div>"
    );
  }

  function openOrderDetail(id) {
    var order = findOrderById(id);
    var d = ensureOrderDrawer();
    var root = $("orderDetailRoot");
    if (!root) return;
    root.innerHTML = renderOrderDetail(order);
    d.classList.remove("hidden");
    var close1 = $("btnCloseOrderDetail");
    if (close1) close1.onclick = closeOrderDetail;
    var close2 = $("btnCloseOrderDetail2");
    if (close2) close2.onclick = closeOrderDetail;
    var printBtn = $("btnPrintOrder");
    if (printBtn) {
      printBtn.onclick = function () {
        printOrderReceipt(findOrderById(printBtn.getAttribute("data-order-id")));
      };
    }
  }

  function printOrderReceipt(order) {
    if (!order) {
      alert("搵唔到呢張單");
      return;
    }
    var linesHtml = "";
    ((order.lines) || []).forEach(function (ln) {
      var label = (ln && ln.label) != null ? ln.label : "—";
      var amt = ln && ln.amount != null && ln.amount !== "" && !isNaN(ln.amount)
        ? ("$" + money(ln.amount))
        : "—";
      linesHtml +=
        "<tr><td>" + esc(label) + '</td><td class="num">' + esc(amt) + "</td></tr>";
    });
    if (!linesHtml) {
      linesHtml = '<tr><td colspan="2" class="muted">未有產品明細</td></tr>';
    }
    var gifts = (order.gifts && order.gifts.length) ? order.gifts.join("；") : "—";
    var w = window.open("", "_blank");
    if (!w) {
      alert("瀏覽器阻擋咗列印視窗，請允許彈出");
      return;
    }
    w.document.write(
      "<!DOCTYPE html><html lang='zh-Hant-HK'><head><meta charset='utf-8' />" +
      "<meta name='viewport' content='width=device-width, initial-scale=1' />" +
      "<title>單據 " + esc(order.orderNo || "") + "</title>" +
      "<style>" +
      "body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans TC',sans-serif;padding:16px;color:#222;}" +
      "h1{font-size:1.25rem;margin:0 0 4px;} .sub{color:#555;margin:0 0 12px;font-size:.9rem;}" +
      ".meta{margin-bottom:12px;font-size:1rem;line-height:1.5;} .meta div{margin:2px 0;}" +
      "table{width:100%;border-collapse:collapse;font-size:14px;margin:10px 0;}" +
      "th,td{border-bottom:1px solid #ddd;padding:8px 4px;vertical-align:top;}" +
      "th{text-align:left;background:#f3e8ff;} td.num{text-align:right;font-variant-numeric:tabular-nums;}" +
      ".totals{margin-top:10px;font-size:1rem;} .totals div{display:flex;justify-content:space-between;padding:4px 0;}" +
      ".pay{font-size:1.15rem;font-weight:800;margin-top:8px;} .note{color:#666;font-size:.85rem;margin-top:16px;}" +
      ".noprint{margin:12px 0;} @media print{body{padding:0;} .noprint{display:none;}}" +
      "</style></head><body>" +
      "<h1>紫花油工展會</h1>" +
      "<p class='sub'>ZIHUA · 本機結算單據</p>" +
      "<div class='meta'>" +
        "<div><strong>單號：</strong>" + esc(order.orderNo || order.id || "—") + "</div>" +
        "<div><strong>時間：</strong>" + esc(formatHkTime(order.t)) + "（香港）</div>" +
        "<div><strong>POS：</strong>" + esc(String(order.pos != null ? order.pos : "—")) + "</div>" +
        "<div><strong>付款：</strong>" + esc(order.paymentLabel || order.paymentMethod || "—") + "</div>" +
      "</div>" +
      "<p class='noprint'><button onclick='window.print()'>列印</button> " +
      "<button onclick='window.close()'>關閉</button></p>" +
      "<table><thead><tr><th>項目</th><th>金額</th></tr></thead><tbody>" +
      linesHtml +
      "</tbody></table>" +
      "<div class='totals'>" +
        "<div><span>合計</span><span>$" + esc(money(order.subtotal != null ? order.subtotal : order.total)) + "</span></div>" +
        "<div><span>優惠券</span><span>−$" + esc(money(order.couponAmount || 0)) + "</span></div>" +
        "<div><span>券後</span><span>$" + esc(money(order.afterCoupon)) + "</span></div>" +
        (order.cupal9Applied ? "<div><span>CUPAL 正價單件 9折</span><span>已計入合計</span></div>" : "") +
        (order.promo115Applied ? "<div><span>滿$115減$15</span><span>−$" + esc(money(order.promo115Amount || 15)) + "</span></div>" : "") +
        (order.angong80Applied ? "<div><span>古寶安宮滿$600減$80</span><span>−$" + esc(money(order.angong80Amount || 80)) + "</span></div>" : "") +
        (order.cupal85Applied ? "<div><span>古寶肌肉關節 85折</span><span>−$" + esc(money(order.cupal85Amount || 0)) + "</span></div>" : "") +
        (order.senior ? "<div><span>銀髮 95 折</span><span>已套用</span></div>" : "") +
        (order.plasticBag ? "<div><span>膠購物袋 $1</span><span>+$" + esc(money(order.bagFee || 1)) + "</span></div>" : "") +
        (order.nmnGiftApplied ? "<div><span>送 NMN 試用裝</span><span>ZA155S1 × 1</span></div>" : "") +
        "<div class='pay'><span>實付</span><span>$" + esc(money(order.payable)) + "</span></div>" +
      "</div>" +
      "<p><strong>禮遇：</strong>" + esc(gifts) + "</p>" +
      "<p class='note'>本機結算単據；以支付為準</p>" +
      "</body></html>"
    );
    w.document.close();
  }

  function renderHero() {
    var pos = getPosStation();
    return (
      '<div class="pc-topbar">' +
        '<button type="button" class="pc-pos-btn" id="btnPcPos" aria-label="切換 POS1 或 POS2" title="撳一下切換 POS1／POS2">' +
          "[ POS " + esc(String(pos)) + " ]" +
        "</button>" +
        '<div class="pc-logo-wrap">' +
          '<img class="pc-logo" src="assets/img/zihua-logo.png?v=20261105n" width="200" height="84" alt="紫花油 ZIHUA EMBROCATION" decoding="async" />' +
        "</div>" +
        '<button type="button" class="pc-gear-btn" id="btnPcGear" aria-label="職員設定" aria-haspopup="true">' +
          '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">' +
            '<path fill="currentColor" d="M19.14 12.94c.04-.31.06-.63.06-.94s-.02-.63-.06-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.05 7.05 0 0 0-1.63-.94l-.36-2.54A.5.5 0 0 0 13.9 2h-3.8a.5.5 0 0 0-.49.42l-.36 2.54c-.59.24-1.13.55-1.63.94l-2.39-.96a.5.5 0 0 0-.6.22L2.71 8.84a.5.5 0 0 0 .12.64l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94L2.83 14.52a.5.5 0 0 0-.12.64l1.92 3.32c.14.24.43.34.68.22l2.39-.96c.5.39 1.04.71 1.63.94l.36 2.54c.05.24.26.42.49.42h3.8c.24 0 .44-.18.49-.42l.36-2.54c.59-.24 1.13-.55 1.63-.94l2.39.96c.25.12.54.02.68-.22l1.92-3.32a.5.5 0 0 0-.12-.64l-2.03-1.58zM12 15.5A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7z"/>' +
          "</svg>" +
        "</button>" +
      "</div>" +
      '<p class="pc-pos-note">撳左上 POS 掣喺 <strong>POS1／POS2</strong> 之間切換（預設 POS1）。同一部機切換 POS1／POS2 共用當日流水號；兩部實體機暫時各自計（之後可加雲端同步）。</p>' +
      '<header class="pc-hero">' +
        '<p class="pc-hero-kicker">2026 工展會 · 會場購物禮遇</p>' +
        "<h2>產品計數 · 預訂</h2>" +
        (window.BPE_Gifts && window.BPE_Gifts.renderGiftCardsHtml
          ? window.BPE_Gifts.renderGiftCardsHtml()
          : "") +
        '<p class="pc-hero-note">套裝價自動計算 · 散支加到 6 支 26ml 或 5 支 10ml 先自動打開結算 · 送 12ml 及杯墊於結算扣庫存 · 花香套／任選 5 支亦送杯墊（唔自動跳結算） · 任何消費送 2027 年曆卡 · 滿額贈品以最高一級計 · 先減優惠券，再滿$115減$15／安宮減$80／關節85折／銀髮95折，膠袋$1唔計入滿額門檻 · 以最終實付（未計袋）計禮遇 · 送完即止</p>' +
        (window.BPE_SalesTarget && window.BPE_SalesTarget.renderProgressHtml
          ? window.BPE_SalesTarget.renderProgressHtml()
          : "") +
        renderRecentOrdersHtml() +
      "</header>"
    );
  }

  function staffExtraSheet() {
    var items = (window.BPE_Stock && window.BPE_Stock.listOrderExtras)
      ? window.BPE_Stock.listOrderExtras() : [];
    if (!items.length) return null;
    return {
      id: "staff-extra",
      title: "職員加貨",
      short: "職員加貨",
      sections: [{
        id: "staff-extra-sec",
        title: "職員加貨（本機存貨表）",
        note: "喺職員選單「庫存／存貨表」加嘅產品；售價未填會顯示待填。",
        items: items
      }]
    };
  }

  function allSheets() {
    var sheets = (data().sheets || []).slice();
    var extra = staffExtraSheet();
    if (extra) sheets.push(extra);
    return sheets;
  }

  function renderSearchChips(st) {
    var sheets = allSheets();
    var chips = sheets.map(function (s) {
      var c = sheetCount(st, s);
      var on = s.id === activeSheet ? " active" : "";
      var badge = c > 0 ? '<span class="chip-badge">' + c + "</span>" : "";
      return (
        '<button type="button" class="cat-chip' + on + '" data-sheet="' + esc(s.id) + '">' +
          esc(s.short || s.title) + badge +
        "</button>"
      );
    }).join("");
    return (
      '<div class="pc-search-wrap">' +
        '<label class="pc-search">' +
          '<span class="pc-search-ico" aria-hidden="true">🔍</span>' +
          '<input type="search" id="pcSearch" placeholder="搜尋產品名稱或編號" value="' + esc(searchQ) + '" />' +
        "</label>" +
        '<div class="cat-chips" role="tablist">' + chips + "</div>" +
      "</div>"
    );
  }

  function renderSection(sec, st) {
    var html = '<div class="pc-section">';
    html += '<h3 class="pc-sec-title">' + esc(sec.title) + "</h3>";
    if (sec.note) html += '<p class="pc-sec-note">' + esc(sec.note) + "</p>";
    if (sec.id === "z-oil-set") {
      html += '<p class="pc-sec-note">芳香紅薇／淡花甜香／馥郁白木 set 每套送紫花油陶瓷杯墊</p>';
    }

    (sec.bundles || []).forEach(function (b) {
      if (searchQ && !matchQ(b.label) && !matchQ(b.id)) return;
      var q = setQty(st, b.id);
      var priceLabel = b.useItemPrices ? "按單品／買3送1" : ("$" + money(b.setPrice) + "／套");
      var picksLine = isPickAnyBundle(b, sec) ? picksSummaryHtml(st, b.id, q) : "";
      html +=
        '<div class="pc-card">' +
          '<div class="pc-thumb" aria-hidden="true">📦</div>' +
          '<div class="pc-card-body">' +
            "<strong>" + esc(b.label) + "</strong>" +
            '<div class="pc-meta"><span title="X＝入機代號">入機代號 <code>' + esc(b.id) + "</code></span> · " + esc(priceLabel) + "</div>" +
            picksLine +
          "</div>" +
          qtyCtrl("set", b.id, q) +
        "</div>";
    });

    (sec.items || []).forEach(function (it) {
      if (it.displayOnly) return;
      if (searchQ && !matchQ(it.name) && !matchQ(it.code)) return;
      var q = itemQty(st, it.code);
      var p = unitPrice(it, st);
      var priceTxt = p == null ? "待填" : ("$" + money(p) + "／" + (it.unit || "件"));
      var orig = it.orig != null ? ('<span class="pc-orig">原價 $' + money(it.orig) + "</span>") : "";
      var stockBadge = (window.BPE_Stock && window.BPE_Stock.stockBadgeHtml)
        ? window.BPE_Stock.stockBadgeHtml(it.code) : "";
      html +=
        '<div class="pc-card">' +
          '<div class="pc-thumb" aria-hidden="true">🧴</div>' +
          '<div class="pc-card-body">' +
            "<strong>" + esc(it.name) + "</strong>" +
            '<div class="pc-meta"><span class="pc-xcode" title="X＝入機代號">入機代號 <code>' + esc(it.code) + '</code></span> · <span class="pc-price">' + esc(priceTxt) + '</span> ' + orig +
              (stockBadge ? (" · " + stockBadge) : "") + '</div>' +
          "</div>" +
          qtyCtrl("item", it.code, q) +
        "</div>";
    });

    html += "</div>";
    return html;
  }

  function renderBreakdown(pr, calc) {
    var giftNote = "";
    if (calc && calc.freeCo99 > 0) {
      giftNote =
        '<div class="pc-break-row pc-break-gift"><span>買6送1</span><strong>' +
        freeCo99GiftLabel(calc.freeCo99) + "</strong></div>";
    }
    if (calc && calc.z4cQty > 0) {
      giftNote +=
        '<div class="pc-break-row pc-break-gift"><span>套裝已含</span><strong>' +
        z4cGiftLabel(calc.z4cQty) + "</strong></div>";
    }
    if (calc && calc.freeCoaster > 0) {
      var cParts = calc.coasterParts || { singles: 0, fromSingles: 0, fromBundle: 0, fromSets: 0, freeCoaster: calc.freeCoaster };
      giftNote +=
        '<div class="pc-break-row pc-break-gift"><span>送杯墊</span><strong>' +
        coasterGiftLabel(cParts) + "</strong></div>";
    }
    var rows =
      giftNote +
      '<div class="pc-break-row"><span>合計</span><strong>$' + money(pr.subtotal) + "</strong></div>" +
      '<div class="pc-break-row"><span>減優惠券</span><strong' +
        (pr.couponAmount > 0 ? ' class="pc-break-minus"' : "") +
        ">−$" + money(pr.couponAmount) + "</strong></div>" +
      '<div class="pc-break-row"><span>折前／券後</span><strong>$' + money(pr.afterCoupon) + "</strong></div>";
    if (pr.cupal9Applied) {
      rows +=
        '<div class="pc-break-row"><span>CUPAL 正價單件 9折</span><strong class="pc-break-minus">−$' +
        money(pr.cupal9Saved) + "</strong></div>";
    }
    if (pr.promo115Applied) {
      rows +=
        '<div class="pc-break-row"><span>滿$115減$15</span><strong class="pc-break-minus">−$' +
        money(pr.promo115Amount) + "</strong></div>";
    }
    if (pr.angong80Applied) {
      rows +=
        '<div class="pc-break-row"><span>古寶安宮滿$600減$80</span><strong class="pc-break-minus">−$' +
        money(pr.angong80Amount) + "</strong></div>";
    }
    if (pr.cupal85Applied) {
      rows +=
        '<div class="pc-break-row"><span>古寶肌肉關節 85折</span><strong class="pc-break-minus">−$' +
        money(pr.cupal85Amount) + "</strong></div>";
    }
    if (pr.senior) {
      rows +=
        '<div class="pc-break-row"><span>銀髮 95 折</span><strong>$' + money(pr.payableBeforeBag) + "</strong></div>";
    }
    if (pr.plasticBag) {
      rows +=
        '<div class="pc-break-row"><span>膠購物袋 $1</span><strong>+$' + money(pr.bagFee || 1) + "</strong></div>";
    }
    if (pr.nmnGiftApplied) {
      rows +=
        '<div class="pc-break-row pc-break-gift"><span>送 NMN 試用裝</span><strong>ZA155S1 × 1</strong></div>';
    }
    rows +=
      '<div class="pc-break-row pc-break-pay"><span>實付</span><strong>$' + money(pr.payable) + "</strong></div>";
    return '<div class="pc-breakdown" aria-label="金額明細">' + rows + "</div>";
  }

  function renderFloat(st, calc, pr) {
    var progress = "";
    if (window.BPE_Gifts && window.BPE_Gifts.evaluate) {
      var ev = window.BPE_Gifts.evaluate(calc.total, st);
      progress = window.BPE_Gifts.progressLine(ev);
    }
    if (!progress) {
      progress = "共 " + calc.count + " 件";
    } else {
      progress = "共 " + calc.count + " 件 · " + progress;
    }

    var hasPay = !!st.paymentMethod;
    var settleCls = "pc-preorder" + (hasPay ? "" : " pc-settle-need-pay");
    var settleLabel = hasPay
      ? ("💳 結算 $" + money(pr.payable))
      : "請先揀付款方式";
    var hasItems = calc.count > 0;
    var collapsedSummary = "$" + money(pr.payable) + " · 共 " + calc.count + " 件";

    if (!floatOpen) {
      return (
        '<div class="pc-float is-collapsed' + (hasItems ? " has-items" : "") + '" id="pcFloat">' +
          '<button type="button" class="pc-float-bar" id="btnPcExpand" aria-expanded="false" aria-controls="pcFloatBody">' +
            '<span class="pc-float-bar-sum">' + esc(collapsedSummary) + "</span>" +
            '<span class="pc-float-bar-cta">展開 <span aria-hidden="true">▴</span></span>' +
          "</button>" +
        "</div>"
      );
    }

    return (
      '<div class="pc-float is-open' + (hasItems ? " has-items" : "") + '" id="pcFloat">' +
        '<div class="pc-float-head">' +
          '<button type="button" class="pc-float-progress" id="btnPcExpandHint" aria-expanded="true">' +
            esc(progress) +
          "</button>" +
          '<button type="button" class="pc-float-close" id="btnPcCollapse" aria-label="收起結算">' +
            '<span aria-hidden="true">✕</span> 收起' +
          "</button>" +
        "</div>" +
        '<div class="pc-float-body" id="pcFloatBody">' +
          '<div class="pc-float-total">$' + money(pr.payable) +
            (pr.promo115Applied ? '<span class="pc-senior-tag">滿115減15</span>' : "") +
            (pr.cupal85Applied ? '<span class="pc-senior-tag">關節85折</span>' : "") +
            (pr.angong80Applied ? '<span class="pc-senior-tag">安宮減80</span>' : "") +
            (pr.cupal9Applied ? '<span class="pc-senior-tag">正價9折</span>' : "") +
            (pr.senior ? '<span class="pc-senior-tag">銀髮價</span>' : "") +
            (pr.plasticBag ? '<span class="pc-senior-tag">膠袋$1</span>' : "") +
            (pr.nmnGiftApplied ? '<span class="pc-senior-tag">送NMN試用</span>' : "") +
            (pr.couponAmount > 0 ? '<span class="pc-coupon-tag">已減券</span>' : "") +
          "</div>" +
          renderBreakdown(pr, calc) +
          '<div class="pc-coupon-row">' +
            '<label class="pc-coupon-label" for="pcCoupon">優惠券（先減券）</label>' +
            '<div class="pc-coupon-chips">' +
              COUPON_CHIPS.map(function (n) {
                var on = Number(st.couponAmount) === n ? " active" : "";
                return (
                  '<button type="button" class="pc-coupon-chip' + on + '" data-coupon="' + n + '">$' + n + "</button>"
                );
              }).join("") +
              '<button type="button" class="pc-coupon-chip' +
                (COUPON_CHIPS.indexOf(Number(st.couponAmount)) < 0 && Number(st.couponAmount) > 0 ? " active" : "") +
                '" data-coupon="custom">自訂</button>' +
            "</div>" +
            '<input type="number" id="pcCoupon" class="pc-coupon-input" min="0" step="1" inputmode="decimal" ' +
              'placeholder="0" value="' + esc(String(st.couponAmount || 0)) + '" aria-label="優惠券金額" />' +
          "</div>" +
          '<label class="pc-senior-toggle">' +
            '<span>滿$115減$15</span>' +
            '<input type="checkbox" id="pcPromo115" ' + (st.promo115 ? "checked" : "") + ' />' +
            '<span class="pc-switch" aria-hidden="true"></span>' +
          "</label>" +
          (st.promo115 && !pr.promo115Applied
            ? '<p class="muted pc-promo-hint">合資格折實 $' + money(pr.promo115Qual) + "（套裝／換購唔計），未滿 $115，暫未套用減 $15</p>"
            : "") +
          '<label class="pc-senior-toggle">' +
            '<span>古寶肌肉關節滿$1200，享85折</span>' +
            '<input type="checkbox" id="pcCupal85" ' + (st.cupal85 ? "checked" : "") + ' />' +
            '<span class="pc-switch" aria-hidden="true"></span>' +
          "</label>" +
          (st.cupal85 && !pr.cupal85Applied
            ? '<p class="muted pc-promo-hint">古寶肌肉關節合計 $' + money(pr.jointQual || pr.cupalQualifying) + "，未滿 $1200，暫未套用 85 折（只折關節系列）</p>"
            : "") +
          '<label class="pc-senior-toggle">' +
            '<span>古寶安宮一粒裝滿$600減$80</span>' +
            '<input type="checkbox" id="pcAngong80" ' + (st.angong80 ? "checked" : "") + ' />' +
            '<span class="pc-switch" aria-hidden="true"></span>' +
          "</label>" +
          (st.angong80 && !pr.angong80Applied
            ? '<p class="muted pc-promo-hint">安宮單件合計 $' + money(pr.angongQual) + "，未滿 $600，暫未套用減 $80（$996／3盒套裝唔計）</p>"
            : "") +
          '<label class="pc-senior-toggle">' +
            '<span>CUPAL 正價單件 9折</span>' +
            '<input type="checkbox" id="pcCupal9" ' + (st.cupal9 ? "checked" : "") + ' />' +
            '<span class="pc-switch" aria-hidden="true"></span>' +
          "</label>" +
          '<label class="pc-senior-toggle">' +
            '<span>銀髮優惠 95折（減券後）</span>' +
            '<input type="checkbox" id="pcSenior" ' + (st.senior ? "checked" : "") + ' />' +
            '<span class="pc-switch" aria-hidden="true"></span>' +
          "</label>" +
          '<label class="pc-senior-toggle">' +
            '<span>膠購物袋 $1</span>' +
            '<input type="checkbox" id="pcPlasticBag" ' + (st.plasticBag ? "checked" : "") + ' />' +
            '<span class="pc-switch" aria-hidden="true"></span>' +
          "</label>" +
          '<label class="pc-senior-toggle">' +
            '<span>口服保健滿$1200送 NMN 試用裝</span>' +
            '<input type="checkbox" id="pcNmnGift" ' + (st.nmnGift ? "checked" : "") + ' />' +
            '<span class="pc-switch" aria-hidden="true"></span>' +
          "</label>" +
          (st.nmnGift && !pr.nmnGiftApplied
            ? '<p class="muted pc-promo-hint">口服保健合計 $' + money(pr.oralQual) + "，未滿 $1200，暫未送 ZA155S1（貼／膏／噴霧唔計）</p>"
            : "") +
          '<div class="pc-float-extra">' +
            (window.BPE_Gifts && window.BPE_Gifts.renderProgressHtml
              ? window.BPE_Gifts.renderProgressHtml(calc.total, st) : "") +
            (isAdmin()
              ? '<button type="button" class="btn-ghost" id="btnPcExport">匯出訂單</button>'
              : "") +
          "</div>" +
          '<div class="pc-float-actions">' +
            '<button type="button" class="pc-clear" id="btnPcClear" aria-label="清除"><span aria-hidden="true">↺</span> 清除</button>' +
            '<button type="button" class="' + settleCls + '" id="btnPcSettle">' + esc(settleLabel) + "</button>" +
          "</div>" +
        "</div>" +
      "</div>"
    );
  }

  function renderPayment(st) {
    var chips = PAY_METHODS.map(function (m) {
      var on = st.paymentMethod === m.id ? " active" : "";
      return (
        '<button type="button" class="pay-chip' + on + '" data-pay="' + esc(m.id) + '" aria-pressed="' +
          (st.paymentMethod === m.id ? "true" : "false") + '">' + esc(m.label) + "</button>"
      );
    }).join("");
    return (
      '<section class="panel pay-panel pc-pay" aria-labelledby="pcPayTitle">' +
        '<h3 id="pcPayTitle">💳 付款方式</h3>' +
        '<p class="pay-note">請揀一種付款方式先可以結算。凡購物可用：八達通、現金港幣、Alipay、WeChat Pay、PayMe、VISA、Mastercard、銀聯</p>' +
        '<a class="pay-open" href="assets/img/payment/payment-methods.jpg?v=20261108a" target="_blank" rel="noopener" title="開大圖">' +
          '<img class="pay-img" src="assets/img/payment/payment-methods.jpg?v=20261108a" width="1079" height="728" loading="lazy" decoding="async" alt="付款方式：凡購物可使用八達通、港幣現金、Alipay 支付寶、微信支付、PayMe、VISA、Mastercard、銀聯 UnionPay" />' +
        "</a>" +
        '<div class="pay-chips" role="group" aria-label="揀付款方式">' + chips + "</div>" +
        (st.paymentMethod
          ? ('<p class="pay-selected">已揀：<strong>' + esc(payLabel(st.paymentMethod)) + "</strong></p>")
          : '<p class="pay-selected pay-need">尚未揀付款方式</p>') +
      "</section>"
    );
  }

  function render() {
    var root = $("dimsumOrderRoot");
    if (!root) return;
    var st = loadState();
    var sheets = allSheets();
    var sheet = sheets.filter(function (s) { return s.id === activeSheet; })[0] || sheets[0];
    if (sheet) activeSheet = sheet.id;
    var calc = calcTotals(st);
    var pr = pricing(st, calc);

    var html = renderHero();
    html += renderSearchChips(st);
    html += '<div class="pc-list" id="pcList">';
    if (sheet) {
      (sheet.sections || []).forEach(function (sec) {
        html += renderSection(sec, st);
      });
    }
    html += "</div>";
    html += renderPayment(st);
    html += renderFloat(st, calc, pr);
    root.innerHTML = html;
    root.classList.toggle("is-float-open", !!floatOpen);

    var search = $("pcSearch");
    if (search) {
      search.addEventListener("input", function () {
        searchQ = search.value.trim();
        var pos = search.selectionStart;
        render();
        var again = $("pcSearch");
        if (again) {
          again.focus();
          try { again.setSelectionRange(pos, pos); } catch (e) {}
        }
      });
    }
  }

  function setQtyValue(kind, id, val) {
    var st = loadState();
    var n = Math.max(0, Math.floor(Number(val) || 0));
    if (kind === "item" && isRedeemCode(id) && n > 1) {
      n = 1;
      alert("換購每款每張單限換 1 件");
    }
    // 只喺散支 26ml／10ml 跨越買送門檻先自動開結算；套裝／任選5支唔跳
    var shouldOpen = false;
    if (kind === "item" && id === "ZE01") {
      var oldZe01 = itemQty(st, "ZE01");
      if (Math.floor(n / 6) > Math.floor(oldZe01 / 6)) shouldOpen = true;
    } else if (kind === "item" && (id === "ZE05" || id === "ZE06" || id === "ZE07")) {
      var beforeSingles = itemQty(st, "ZE05") + itemQty(st, "ZE06") + itemQty(st, "ZE07");
      var afterSingles = beforeSingles - itemQty(st, id) + n;
      if (Math.floor(afterSingles / 5) > Math.floor(beforeSingles / 5)) shouldOpen = true;
    }
    if (kind === "set") {
      if (n <= 0) {
        delete st.sets[id];
        if (st.setPicks) delete st.setPicks[id];
      } else st.sets[id] = n;
    } else {
      if (n <= 0) delete st.items[id];
      else st.items[id] = n;
    }
    saveState(st);
    if (shouldOpen) floatOpen = true;
    render();
  }

  function exportText() {
    var st = loadState();
    var calc = calcTotals(st);
    var pr = pricing(st, calc);
    var lines = ["2026 工展會 · 產品計數結算", "———"];
    calc.lines.forEach(function (L) {
      if (L.kind === "gift") lines.push("贈　" + L.label);
      else if (L.amount == null) lines.push(L.label);
      else lines.push(L.label + "　$" + money(L.amount));
    });
    lines.push("———");
    lines.push("合計　$" + money(pr.subtotal));
    lines.push("減優惠券　−$" + money(pr.couponAmount));
    lines.push("折前／券後　$" + money(pr.afterCoupon));
    if (pr.cupal9Applied) lines.push("CUPAL 正價單件 9折　−$" + money(pr.cupal9Saved) + "（已計入合計）");
    if (pr.promo115Applied) lines.push("滿$115減$15　−$" + money(pr.promo115Amount));
    if (pr.angong80Applied) lines.push("古寶安宮滿$600減$80　−$" + money(pr.angong80Amount));
    if (pr.cupal85Applied) lines.push("古寶肌肉關節 85折　−$" + money(pr.cupal85Amount));
    if (pr.senior) lines.push("銀髮 95 折　$" + money(pr.payableBeforeBag));
    if (pr.plasticBag) lines.push("膠購物袋　+$" + money(pr.bagFee || 1));
    if (pr.nmnGiftApplied) lines.push("口服保健滿$1200送 NMN 試用裝　ZA155S1 × 1");
    lines.push("實付　$" + money(pr.payable));
    if (pr.paymentMethod) lines.push("付款方式　" + payLabel(pr.paymentMethod));
    if (window.BPE_Gifts && window.BPE_Gifts.evaluate) {
      var gev = window.BPE_Gifts.evaluate(calc.total, st);
      if (gev.reached && gev.reached.length) {
        lines.push("可享禮遇：" + gev.reached.map(function (t) { return t.title; }).join("；"));
      }
    }
    lines.push("（參考用途，以攤位當日為準；送完即止）");
    return lines.join("\n");
  }

  function saveSettle() {
    var st = loadState();
    var calc = calcTotals(st);
    var pr = pricing(st, calc);
    var giftTitles = [];
    if (window.BPE_Gifts && window.BPE_Gifts.evaluate) {
      giftTitles = window.BPE_Gifts.evaluate(calc.total, st).reached.map(function (t) { return t.title; });
    }
    if (calc.nmnGiftApplied) {
      giftTitles = giftTitles.concat(["ZA155S1 CUPAL PQQ NMN Ex 10粒試食裝"]);
    }
    var pos = getPosStation();
    var orderNo = nextOrderNo(pos);
    var handler = "";
    var staffId = "";
    var staffLabel = "";
    if (window.ZihuaStaffAuth && window.ZihuaStaffAuth.getStaff) {
      var stf = window.ZihuaStaffAuth.getStaff();
      if (stf) {
        staffId = stf.id || "";
        staffLabel = stf.label || "";
        handler = staffLabel;
      }
    }
    if (!handler && window.ZihuaAdminAuth && window.ZihuaAdminAuth.isLoggedIn && window.ZihuaAdminAuth.isLoggedIn()) {
      handler = (window.ZihuaAdminAuth.getSessionEmail && window.ZihuaAdminAuth.getSessionEmail()) || "管理員";
    }
    var order = {
      id: "po-" + Date.now(),
      orderNo: orderNo,
      pos: pos,
      t: new Date().toISOString(),
      count: calc.count,
      subtotal: pr.subtotal,
      total: pr.subtotal,
      couponAmount: pr.couponAmount,
      afterCoupon: pr.afterCoupon,
      promo115: !!pr.promo115,
      promo115Applied: !!pr.promo115Applied,
      promo115Amount: pr.promo115Amount || 0,
      promo115Qual: pr.promo115Qual || 0,
      cupal85: !!pr.cupal85,
      cupal85Applied: !!pr.cupal85Applied,
      cupal85Amount: pr.cupal85Amount || 0,
      cupalQualifying: pr.cupalQualifying || 0,
      jointQual: pr.jointQual || 0,
      afterPromo115: pr.afterPromo115,
      afterCupal85: pr.afterCupal85,
      angong80: !!pr.angong80,
      angong80Applied: !!pr.angong80Applied,
      angong80Amount: pr.angong80Amount || 0,
      angongQual: pr.angongQual || 0,
      afterAngong80: pr.afterAngong80,
      cupal9: !!pr.cupal9,
      cupal9Applied: !!pr.cupal9Applied,
      cupal9Saved: pr.cupal9Saved || 0,
      plasticBag: !!pr.plasticBag,
      bagFee: pr.bagFee || 0,
      payableBeforeBag: pr.payableBeforeBag,
      payable: pr.payable,
      senior: !!pr.senior,
      nmnGift: !!pr.nmnGift,
      nmnGiftApplied: !!pr.nmnGiftApplied,
      oralQual: pr.oralQual || 0,
      paymentMethod: pr.paymentMethod,
      paymentLabel: payLabel(pr.paymentMethod),
      lines: calc.lines,
      gifts: giftTitles,
      handler: handler,
      staffId: staffId,
      staffLabel: staffLabel
    };
    try {
      var raw = localStorage.getItem(LS_PREORDERS);
      var list = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(list)) list = [];
      list.unshift(order);
      localStorage.setItem(LS_PREORDERS, JSON.stringify(list.slice(0, 50)));
    } catch (e) {}
    if (window.BPE_SalesTarget && window.BPE_SalesTarget.addSale) {
      try { window.BPE_SalesTarget.addSale(order.payable, order.t); } catch (e2) {}
    }
    return order;
  }

  function bindRoot() {
    var root = $("dimsumOrderRoot");
    if (!root || root._pcBound) return;
    root._pcBound = true;
    root.addEventListener("click", function (e) {
      if (e.target.closest("#btnClearTestOrders")) {
        if (!isAdmin()) return;
        if (!confirm("清除全部測試訂單？售出會歸零，今日營業額進度亦會清走。補貨同總預會保留。")) return;
        clearTestOrdersData();
        closeOrderDetail();
        render();
        return;
      }
      var orderBtn = e.target.closest("[data-order-id].pc-order-row");
      if (orderBtn) {
        openOrderDetail(orderBtn.getAttribute("data-order-id"));
        return;
      }
      if (e.target.closest("#btnPcPos")) {
        cyclePosStation();
        render();
        return;
      }
      if (e.target.closest("#btnPcGear")) {
        if (window.BPE_Shell && window.BPE_Shell.toggleStaffMenu) {
          window.BPE_Shell.toggleStaffMenu($("btnPcGear"));
        } else if (window.BPE_Shell && window.BPE_Shell.openLogin) {
          window.BPE_Shell.openLogin();
        }
        return;
      }
      var tab = e.target.closest("[data-sheet]");
      if (tab) {
        activeSheet = tab.getAttribute("data-sheet");
        render();
        return;
      }
      var payBtn = e.target.closest("[data-pay]");
      if (payBtn) {
        var stPay = loadState();
        var pid = payBtn.getAttribute("data-pay");
        stPay.paymentMethod = stPay.paymentMethod === pid ? "" : pid;
        saveState(stPay);
        render();
        return;
      }
      var couponChip = e.target.closest("[data-coupon]");
      if (couponChip) {
        var stC = loadState();
        var cv = couponChip.getAttribute("data-coupon");
        if (cv === "custom") {
          var inp = $("pcCoupon");
          if (inp) {
            inp.focus();
            inp.select();
          }
          return;
        }
        stC.couponAmount = Math.max(0, Number(cv) || 0);
        saveState(stC);
        render();
        return;
      }
      var editPicksBtn = e.target.closest("[data-edit-picks]");
      if (editPicksBtn) {
        openEditPicksFlow(editPicksBtn.getAttribute("data-edit-picks"));
        return;
      }
      var btn = e.target.closest(".qty-btn");
      if (btn) {
        var wrap = btn.closest(".qty-ctrl");
        if (!wrap) return;
        var kind = wrap.getAttribute("data-kind");
        var id = wrap.getAttribute("data-id");
        var delta = Number(btn.getAttribute("data-delta"));
        var cur = Math.max(0, Math.floor(Number((wrap.querySelector(".qty-val") || {}).textContent) || 0));
        if (kind === "set" && isPickAnyId(id)) {
          if (delta > 0) openPickModal(id, { mode: "add" });
          else decrementPickAny(id);
          return;
        }
        setQtyValue(kind, id, cur + delta);
        return;
      }
      if (e.target.closest("#btnPcExpand") || e.target.closest("#btnPcExpandHint")) {
        floatOpen = true;
        render();
        return;
      }
      if (e.target.closest("#btnPcCollapse")) {
        floatOpen = false;
        render();
        return;
      }
      if (e.target.closest("#btnPcClear")) {
        if (!confirm("清除全部數量？")) return;
        var st = loadState();
        saveState(normalizeState({
          items: {},
          sets: {},
          setPicks: {},
          overrides: st.overrides,
          senior: st.senior,
          paymentMethod: st.paymentMethod,
          couponAmount: st.couponAmount
        }));
        render();
        return;
      }
      if (e.target.closest("#btnPcExport")) {
        var text = exportText();
        var blob = new Blob([text], { type: "text/plain;charset=utf-8" });
        var a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "bpe-settle.txt";
        a.click();
        setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
        return;
      }
      if (e.target.closest("#btnPcSettle") || e.target.closest("#btnPcPreorder")) {
        var stS = loadState();
        if (!stS.paymentMethod) {
          alert("請先揀付款方式");
          var panel = root.querySelector(".pc-pay");
          if (panel && panel.scrollIntoView) {
            panel.scrollIntoView({ behavior: "smooth", block: "center" });
          }
          return;
        }
        var calcS = calcTotals(stS);
        if (calcS.count <= 0) {
          alert("未有產品，請先加數量。");
          return;
        }
        var stCap = loadState();
        var redeemOver = false;
        Object.keys(stCap.items || {}).forEach(function (code) {
          if (isRedeemCode(code) && itemQty(stCap, code) > 1) {
            stCap.items[code] = 1;
            redeemOver = true;
          }
        });
        if (redeemOver) {
          saveState(stCap);
          alert("換購每款每張單限換 1 件，已幫你改返 1 件，請再核對數目後結算。");
          render();
          return;
        }
        if ((calcS.redeemCount || 0) > 0 && (calcS.nonRedeemCount || 0) <= 0) {
          alert("換購須同時購買其他產品。");
          return;
        }
        var incomplete = incompletePickAnyBundles(stS);
        if (incomplete.length) {
          alert(
            "以下任選尚未入齊全部實際貨號（仍可結算；只會扣已入嘅貨號庫存）：\n\n" +
            incomplete.join("\n")
          );
        }
        var demand = buildStockDemand(stS);
        if (window.BPE_Stock && window.BPE_Stock.canFulfill) {
          var stockCheck = window.BPE_Stock.canFulfill(demand);
          if (!stockCheck.ok) {
            alert(
              "庫存唔夠，未能結算。請改數量或職員補貨後再試。\n\n" +
              formatStockShorts(stockCheck.shorts)
            );
            return;
          }
        }
        var order = saveSettle();
        if (window.BPE_Stock && window.BPE_Stock.deduct) {
          var ded = window.BPE_Stock.deduct(demand);
          if (!ded.ok) {
            alert("扣庫存失敗：\n" + formatStockShorts(ded.shorts));
          }
        }
        var giftLine = (order.gifts && order.gifts.length) ? ("\n可享：" + order.gifts.join("；")) : "";
        if (calcS.freeCo99 > 0) {
          giftLine += "\n買6送1：" + freeCo99GiftLabel(calcS.freeCo99) + "（已扣庫存）";
        }
        if (calcS.z4cQty > 0) {
          giftLine += "\n套裝 Z0004C：" + z4cGiftLabel(calcS.z4cQty) + "（已扣套裝庫存）";
        }
        if (calcS.freeCoaster > 0) {
          giftLine += "\n" + coasterGiftLabel(calcS.coasterParts || countFreeCoasterParts(stS)) + "（已扣庫存／減數）";
        }
        alert(
          "已結算（本機）\n\n" +
          "單號\n" + (order.orderNo || "") + "\n\n" +
          "POS " + (order.pos || getPosStation()) + "\n" +
          "付款：" + order.paymentLabel + "\n" +
          "共 " + order.count + " 件\n" +
          "合計 $" + money(order.subtotal) + "\n" +
          "減優惠券 −$" + money(order.couponAmount) + "\n" +
          "折前／券後 $" + money(order.afterCoupon) + "\n" +
          (order.promo115Applied ? ("滿$115減$15 −$" + money(order.promo115Amount || 15) + "\n") : "") +
          (order.angong80Applied ? ("古寶安宮滿$600減$80 −$" + money(order.angong80Amount || 80) + "\n") : "") +
          (order.cupal85Applied ? ("古寶肌肉關節 85折 −$" + money(order.cupal85Amount || 0) + "\n") : "") +
          (order.cupal9Applied ? ("CUPAL 正價單件 9折\n") : "") +
          (order.senior ? ("銀髮 95 折\n") : "") +
          (order.plasticBag ? ("膠購物袋 +$" + money(order.bagFee || 1) + "\n") : "") +
          "實付 $" + money(order.payable) +
          giftLine +
          "\n\n庫存已按售出扣減；請向攤位職員確認付款。"
        );
        render();
        return;
      }
    });
    root.addEventListener("change", function (e) {
      if (!e.target) return;
      if (e.target.id === "pcSenior" || e.target.id === "pcPromo115" || e.target.id === "pcCupal85" ||
          e.target.id === "pcAngong80" || e.target.id === "pcCupal9" || e.target.id === "pcPlasticBag" ||
          e.target.id === "pcNmnGift") {
        var st = loadState();
        if (e.target.id === "pcSenior") st.senior = !!e.target.checked;
        if (e.target.id === "pcPromo115") st.promo115 = !!e.target.checked;
        if (e.target.id === "pcCupal85") st.cupal85 = !!e.target.checked;
        if (e.target.id === "pcAngong80") st.angong80 = !!e.target.checked;
        if (e.target.id === "pcCupal9") st.cupal9 = !!e.target.checked;
        if (e.target.id === "pcPlasticBag") st.plasticBag = !!e.target.checked;
        if (e.target.id === "pcNmnGift") st.nmnGift = !!e.target.checked;
        saveState(st);
        render();
      }
    });
    root.addEventListener("input", function (e) {
      if (e.target && e.target.id === "pcCoupon") {
        var st = loadState();
        var v = Number(e.target.value);
        if (isNaN(v) || v < 0) v = 0;
        st.couponAmount = Math.round(v * 100) / 100;
        saveState(st);
        // soft refresh of totals without stealing focus: update float numbers via re-render
        // keep cursor in coupon field
        var pos = e.target.selectionStart;
        render();
        var again = $("pcCoupon");
        if (again) {
          again.focus();
          try { again.setSelectionRange(pos, pos); } catch (err) {}
        }
      }
    });
  }

  maybeWipeTestOrdersOnce();

  if (!document._orderDetailBound) {
    document._orderDetailBound = true;
    document.addEventListener("click", function (e) {
      if (e.target && (e.target.id === "btnCloseOrderDetail" || e.target.id === "btnCloseOrderDetail2")) {
        closeOrderDetail();
      }
    });
  }

  window.BPE_DimsumOrderUI = {
    render: function () { bindRoot(); render(); },
    clearTestOrdersData: clearTestOrdersData,
    getPosStation: getPosStation,
    openOrderDetail: openOrderDetail,
    clear: function () {
      saveState(normalizeState({}));
      render();
    },
    pricing: function () {
      var st = loadState();
      return pricing(st, calcTotals(st));
    },
    pricingFrom: function (st, calcLike) {
      return pricing(st || loadState(), calcLike);
    },
    cupalQualifyingSubtotal: cupalQualifyingSubtotal
  };
})();
