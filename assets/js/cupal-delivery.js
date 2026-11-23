/* CUPAL Health 宅配訂購表格 — 本機 localStorage */
(function () {
  "use strict";

  var LS_ORDERS = "zihua_bpe_cupal_delivery_v1";
  var PLANS = [
    { months: 2, discount: 0.9, label: "2個月Plan", tag: "9折", rule: "同款2件", mode: "same", pieces: 2, gifts: [] },
    { months: 3, discount: 0.85, label: "3個月Plan", tag: "85折", rule: "同款3件", mode: "same", pieces: 3, gifts: [] },
    { months: 6, discount: 0.7, label: "6個月Plan", tag: "7折", rule: "同款6件", mode: "same", pieces: 6, gifts: [
      { code: "CUPAL-G024", name: "古寶保溫杯" }
    ] },
    { months: 9, discount: 0.6, label: "9個月Plan", tag: "6折", rule: "同款9件", mode: "same", pieces: 9, gifts: [
      { code: "CUPAL-G024", name: "古寶保溫杯" },
      { code: "ZA177", name: "肌肉按摩膏50克" }
    ] },
    { months: 12, discount: 0.5, label: "12個月Plan", tag: "5折", rule: "可選2款共12件", mode: "mix2", pieces: 12, gifts: [
      { code: "CUPAL-G024", name: "古寶保溫杯" },
      { code: "VTM04", name: "液體鈣軟膠囊100粒" },
      { code: "ZA177", name: "肌肉按摩膏50克" }
    ] }
  ];
  var PRODUCTS = [
    { id: "cmpl", name: "古寶補適貼（大）10片", code: "CMPL/CMPLA", price: 67 },
    { id: "cmps", name: "古寶補適貼（細）10片", code: "CMPS", price: 48 },
    { id: "cpw020b", name: "古寶三合一關節靈 90粒（新裝）", code: "CPW020B", price: 288 },
    { id: "ucii", name: "UC II 關節修復 Active Joint 3-in-1", code: "UCII", price: 328 },
    { id: "cal", name: "液體鈣 PRO CALCIUM", code: "CAL", price: 198 },
    { id: "fortigel", name: "Fortigel 關骼健", code: "FG", price: 268 },
    { id: "msm", name: "三合一關節靈 MSM", code: "MSM", price: 218 },
    { id: "tendon", name: "強腱肌活靈 60粒", code: "TDN", price: 198 },
    { id: "oint", name: "關節靈軟膏 50g", code: "OINT", price: 88 },
    { id: "massage", name: "肌肉按摩膏 50g", code: "MSG", price: 88 }
  ];

  var state = {
    plan: 6,
    qty: {},
    form: {
      name: "", gender: "", birthY: "", birthM: "", phone: "", email: "",
      region: "香港", district: "", estate: "", block: "", floor: "", flat: "",
      promoter: "", remark: "", agree: false
    }
  };

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
  function money(n) {
    var x = Math.round(Number(n) * 100) / 100;
    return (x % 1 === 0) ? String(x) : x.toFixed(2);
  }
  function planOf() {
    return PLANS.filter(function (p) { return p.months === state.plan; })[0] || PLANS[2];
  }
  function giftText(plan) {
    var g = (plan && plan.gifts) || [];
    if (!g.length) return "";
    return g.map(function (x) { return x.name; }).join("＋");
  }
  function selectedIds() {
    return PRODUCTS.filter(function (p) {
      return Math.max(0, Math.floor(Number(state.qty[p.id] || 0))) > 0;
    }).map(function (p) { return p.id; });
  }
  function piecesSum() {
    var sum = 0;
    PRODUCTS.forEach(function (p) {
      sum += Math.max(0, Math.floor(Number(state.qty[p.id] || 0)));
    });
    return sum;
  }
  function mixKind(plan) {
    var n = selectedIds().length;
    if (plan.mode === "same") return "同款";
    if (n <= 1) return "同款";
    return "任選2款";
  }
  function selectionOk() {
    var plan = planOf();
    var n = selectedIds().length;
    var sum = piecesSum();
    if (sum !== plan.pieces) return false;
    if (plan.mode === "same") return n === 1;
    return n === 1 || n === 2;
  }
  function calcTotal() {
    var plan = planOf();
    var sum = 0;
    PRODUCTS.forEach(function (p) {
      var q = Math.max(0, Math.floor(Number(state.qty[p.id] || 0)));
      if (q > 0) sum += p.price * q * plan.discount;
    });
    return Math.round(sum * 100) / 100;
  }
  function itemLines() {
    return PRODUCTS.filter(function (p) {
      return Math.max(0, Math.floor(Number(state.qty[p.id] || 0))) > 0;
    }).map(function (p) {
      var q = Math.max(0, Math.floor(Number(state.qty[p.id] || 0)));
      return { id: p.id, name: p.name, code: p.code, price: p.price, qty: q };
    });
  }
  function normalizeQtyForPlan() {
    var plan = planOf();
    var ids = selectedIds();
    if (plan.mode === "same") {
      if (!ids.length) return;
      var keep = ids[0];
      state.qty = {};
      state.qty[keep] = plan.pieces;
      return;
    }
    if (ids.length > 2) {
      ids = ids.slice(0, 2);
      var slim = {};
      ids.forEach(function (id) { slim[id] = state.qty[id]; });
      state.qty = slim;
    }
    var sum = piecesSum();
    if (ids.length === 1 && sum !== plan.pieces) {
      state.qty[ids[0]] = plan.pieces;
    } else if (ids.length === 2 && sum !== plan.pieces) {
      var a = Math.floor(plan.pieces / 2);
      state.qty[ids[0]] = a;
      state.qty[ids[1]] = plan.pieces - a;
    }
  }
  function pickProduct(id) {
    var plan = planOf();
    var ids = selectedIds();
    if (plan.mode === "same") {
      state.qty = {};
      state.qty[id] = plan.pieces;
      return;
    }
    if ((state.qty[id] || 0) > 0) return;
    if (ids.length === 0) {
      state.qty[id] = plan.pieces;
      return;
    }
    if (ids.length === 1) {
      var other = ids[0];
      var half = Math.floor(plan.pieces / 2);
      state.qty[other] = half;
      state.qty[id] = plan.pieces - half;
      return;
    }
    alert("12個月計劃最多任選 2 款，共 12 件。請先取消其中一款再換。");
  }
  function unpickProduct(id) {
    var plan = planOf();
    delete state.qty[id];
    var ids = selectedIds();
    if (plan.mode === "mix2" && ids.length === 1) {
      state.qty[ids[0]] = plan.pieces;
    }
  }
  function changeQty(id, delta) {
    var plan = planOf();
    if (plan.mode !== "mix2") return;
    var ids = selectedIds();
    if (ids.indexOf(id) < 0) {
      if (delta > 0) pickProduct(id);
      return;
    }
    var cur = Math.max(0, Math.floor(Number(state.qty[id] || 0)));
    if (ids.length === 1) {
      var next1 = cur + delta;
      if (next1 <= 0) delete state.qty[id];
      else state.qty[id] = Math.min(plan.pieces, next1);
      return;
    }
    var other = ids[0] === id ? ids[1] : ids[0];
    var next = cur + delta;
    if (next <= 0) {
      unpickProduct(id);
      return;
    }
    var otherQ = Math.max(0, Math.floor(Number(state.qty[other] || 0)));
    var maxThis = plan.pieces - 1;
    if (next > maxThis) return;
    state.qty[id] = next;
    state.qty[other] = plan.pieces - next;
    if (state.qty[other] < 1) {
      state.qty[id] = cur;
      state.qty[other] = otherQ;
    }
  }
  function statusLine() {
    var plan = planOf();
    var n = selectedIds().length;
    var sum = piecesSum();
    if (sum === 0) {
      return plan.mode === "same"
        ? ("請揀 1 款產品，同款 " + plan.pieces + " 件")
        : "請揀 1 款（同款 12 件），或任選 2 款共 12 件";
    }
    if (selectionOk()) {
      return n === 1
        ? ("已選同款 " + plan.pieces + " 件 · " + plan.tag)
        : ("已選任選 2 款共 " + plan.pieces + " 件 · " + plan.tag);
    }
    if (plan.mode === "same") return "呢個方案只可揀 1 款，同款 " + plan.pieces + " 件";
    if (n > 2) return "最多任選 2 款";
    return "已選 " + n + " 款共 " + sum + " 件，需合共 " + plan.pieces + " 件";
  }

  function render() {
    var root = document.getElementById("cupalDeliveryRoot");
    if (!root) return;
    var plan = planOf();
    var total = calcTotal();
    var years = [];
    for (var y = 2010; y >= 1930; y--) years.push(y);
    var ok = selectionOk();
    var gifts = giftText(plan);

    var planBtns = PLANS.map(function (p) {
      var g = giftText(p);
      return (
        '<button type="button" class="plan-chip' + (state.plan === p.months ? " active" : "") +
        '" data-plan="' + p.months + '">' +
          "<strong>" + esc(p.label) + "</strong>" +
          '<span class="plan-chip-rule">' + esc(p.rule) + " · " + esc(p.tag) + "</span>" +
          (g ? '<span class="plan-chip-gift">送 ' + esc(g) + "</span>" : "") +
        "</button>"
      );
    }).join("");

    var products = PRODUCTS.map(function (p) {
      var q = Math.max(0, Math.floor(Number(state.qty[p.id] || 0)));
      var on = q > 0;
      var ctrl = "";
      if (plan.mode === "same") {
        ctrl = '<div class="cupal-pick-flag">' + (on ? ("已選 · 同款 " + plan.pieces + " 件") : "撳呢款（同款）") + "</div>";
      } else {
        ctrl =
          '<div class="qty-ctrl" data-cupal="' + esc(p.id) + '">' +
            '<button type="button" class="qty-btn" data-delta="-1">−</button>' +
            '<span class="qty-val">' + q + "</span>" +
            '<button type="button" class="qty-btn qty-plus" data-delta="1">＋</button>' +
          "</div>" +
          (on ? '<button type="button" class="btn-ghost cupal-unpick" data-cupal-unpick="' + esc(p.id) + '">取消</button>' : "");
      }
      return (
        '<div class="pc-card cupal-prod' + (on ? " selected" : "") + '" data-cupal-pick="' + esc(p.id) + '">' +
          '<div class="pc-thumb blue" aria-hidden="true">💊</div>' +
          '<div class="pc-card-body">' +
            "<strong>" + esc(p.name) + "</strong>" +
            '<div class="pc-meta"><code>' + esc(p.code) + '</code> · 原價 $' + money(p.price) +
            (on ? (" · 小計 $" + money(p.price * q * plan.discount)) : "") +
            "</div>" +
          "</div>" +
          ctrl +
        "</div>"
      );
    }).join("");

    var f = state.form;
    root.innerHTML =
      '<header class="cupal-hero">' +
        "<p>2026 HKBPE 宅配計劃</p>" +
        "<h2>CUPAL Health 肌肉關節專家 宅配訂購表格</h2>" +
        '<p class="cupal-lead">跟最新宣傳：2／3／6／9 個月為同款；12 個月可同款 12 件，或任選 2 款共 12 件。資料只存本機，職員可匯出跟進。</p>' +
      "</header>" +
      '<figure class="cupal-flyer">' +
        '<a href="assets/img/cupal/delivery-plans.jpg?v=20261123d" target="_blank" rel="noopener" title="開大圖">' +
          '<img src="assets/img/cupal/delivery-plans.jpg?v=20261123d" width="1600" height="800" loading="lazy" decoding="async" alt="古寶宅配計劃：2、3、6、9個月為同款；12個月可選2款共12件；6個月送古寶保溫杯，9個月加肌肉按摩膏50克，12個月再加液體鈣軟膠囊100粒。低至半價，定期送到府上。" />' +
        "</a>" +
      "</figure>" +
      '<section class="panel cupal-panel">' +
        "<h3>1. 請選擇您的訂購方案</h3>" +
        '<div class="plan-chips">' + planBtns + "</div>" +
      "</section>" +
      '<section class="panel cupal-panel">' +
        "<h3>2. 揀產品 · " + esc(plan.rule) + "</h3>" +
        '<p class="muted">合計＝各款原價 × 件數 × 折扣（而家：' + plan.months + " 個月 · " + plan.tag +
        (gifts ? " · 送 " + esc(gifts) : "") + "）</p>" +
        '<p class="cupal-status' + (ok ? " ok" : "") + '">' + esc(statusLine()) + "</p>" +
        products +
      "</section>" +
      '<section class="panel cupal-panel">' +
        "<h3>3. 客戶資料</h3>" +
        '<label class="field">姓名<input type="text" id="cdName" maxlength="80" value="' + esc(f.name) + '" /></label>' +
        '<div class="gender-row">' +
          '<button type="button" class="gender-btn' + (f.gender === "男" ? " active" : "") + '" data-gender="男">男</button>' +
          '<button type="button" class="gender-btn' + (f.gender === "女" ? " active" : "") + '" data-gender="女">女</button>' +
        "</div>" +
        '<div class="toolbar">' +
          '<label class="field">出生年份<select id="cdBirthY"><option value="">年</option>' +
            years.map(function (y) {
              return '<option value="' + y + '"' + (String(f.birthY) === String(y) ? " selected" : "") + ">" + y + "</option>";
            }).join("") +
          "</select></label>" +
          '<label class="field">月份<select id="cdBirthM"><option value="">月</option>' +
            [1,2,3,4,5,6,7,8,9,10,11,12].map(function (m) {
              return '<option value="' + m + '"' + (String(f.birthM) === String(m) ? " selected" : "") + ">" + m + "</option>";
            }).join("") +
          "</select></label>" +
        "</div>" +
        '<label class="field">聯絡電話<input type="tel" id="cdPhone" maxlength="20" value="' + esc(f.phone) + '" /></label>' +
        '<label class="field">電郵地址<input type="email" id="cdEmail" maxlength="120" value="' + esc(f.email) + '" /></label>' +
        '<p class="field" style="margin-bottom:6px;">送貨地址</p>' +
        '<div class="region-row">' +
          ["香港","九龍","新界"].map(function (r) {
            return '<button type="button" class="region-btn' + (f.region === r ? " active" : "") + '" data-region="' + r + '">' + r + "</button>";
          }).join("") +
        "</div>" +
        '<label class="field">分區／屋苑<input type="text" id="cdEstate" maxlength="120" placeholder="例如 銅鑼灣／太古城" value="' + esc(f.estate) + '" /></label>' +
        '<div class="toolbar">' +
          '<label class="field">座／大廈<input type="text" id="cdBlock" maxlength="40" value="' + esc(f.block) + '" /></label>' +
          '<label class="field">樓層<input type="text" id="cdFloor" maxlength="20" value="' + esc(f.floor) + '" /></label>' +
          '<label class="field">室<input type="text" id="cdFlat" maxlength="20" value="' + esc(f.flat) + '" /></label>' +
        "</div>" +
        '<label class="field">推廣員<input type="text" id="cdPromoter" maxlength="60" placeholder="可填職員名" value="' + esc(f.promoter) + '" /></label>' +
        '<label class="field">備註<input type="text" id="cdRemark" maxlength="200" value="' + esc(f.remark) + '" /></label>' +
      "</section>" +
      '<section class="panel cupal-panel">' +
        "<h3>訂購備註及條款</h3>" +
        "<ul class=\"muted\">" +
          "<li>2／3／6／9 個月計劃為同款，件數＝月數。</li>" +
          "<li>12 個月計劃可同款 12 件，或任選 2 款共 12 件。</li>" +
          "<li>6 個月送古寶保溫杯；9 個月加送肌肉按摩膏 50 克；12 個月再加液體鈣軟膠囊 100 粒。贈品送完即止，以確認單為準。</li>" +
          "<li>合計＝原價 × 件數 × 折扣。送貨週期以確認單為準。</li>" +
          "<li>查詢電話：5409 8204（示意）。</li>" +
          "<li>本表只存本機，唔係正式電子商務結帳。</li>" +
        "</ul>" +
        '<label class="agree-row"><input type="checkbox" id="cdAgree"' + (f.agree ? " checked" : "") + ' /> 我已閱讀並同意以上條款</label>' +
      "</section>" +
      '<div class="cupal-float">' +
        '<div><span class="muted">' + (ok ? (esc(plan.label) + " · " + mixKind(plan) + " · " + plan.tag + (gifts ? " · 送 " + esc(gifts) : "")) : esc(statusLine())) +
        '</span><strong class="cupal-total">$' + money(total) + "</strong></div>" +
        '<button type="button" class="primary" id="btnCupalSubmit">提交訂購</button>' +
      "</div>";
  }

  function readForm() {
    function v(id) { var el = document.getElementById(id); return el ? el.value : ""; }
    state.form.name = v("cdName");
    state.form.birthY = v("cdBirthY");
    state.form.birthM = v("cdBirthM");
    state.form.phone = v("cdPhone");
    state.form.email = v("cdEmail");
    state.form.estate = v("cdEstate");
    state.form.block = v("cdBlock");
    state.form.floor = v("cdFloor");
    state.form.flat = v("cdFlat");
    state.form.promoter = v("cdPromoter");
    state.form.remark = v("cdRemark");
    var ag = document.getElementById("cdAgree");
    state.form.agree = !!(ag && ag.checked);
  }

  function submit() {
    readForm();
    var total = calcTotal();
    var plan = planOf();
    if (!selectionOk() || total <= 0) {
      alert(plan.mode === "same"
        ? ("請揀 1 款產品，同款 " + plan.pieces + " 件。")
        : "請揀 1 款同款 12 件，或任選 2 款共 12 件。");
      return;
    }
    if (!state.form.name.trim() || !state.form.phone.trim()) { alert("請填姓名同電話。"); return; }
    if (!state.form.agree) { alert("請先同意條款。"); return; }
    var items = itemLines();
    var order = {
      id: "cd-" + Date.now(),
      t: new Date().toISOString(),
      plan: plan,
      mix: mixKind(plan),
      items: items,
      gifts: plan.gifts || [],
      total: total,
      form: JSON.parse(JSON.stringify(state.form))
    };
    try {
      var raw = localStorage.getItem(LS_ORDERS);
      var list = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(list)) list = [];
      list.unshift(order);
      localStorage.setItem(LS_ORDERS, JSON.stringify(list.slice(0, 100)));
    } catch (e) {}
    var giftLine = giftText(plan);
    alert("已提交（本機保存）\n" + plan.label + " · " + mixKind(plan) + " · " + plan.tag +
      "\n合計 $" + money(total) + (giftLine ? ("\n贈品：" + giftLine) : "") +
      "\n職員可稍後匯出跟進。");
  }

  function exportCsv() {
    try {
      var raw = localStorage.getItem(LS_ORDERS);
      var list = raw ? JSON.parse(raw) : [];
      if (!list.length) { alert("未有宅配訂單。"); return; }
      var rows = [["時間","姓名","電話","電郵","方案月數","折扣","揀法","產品明細","贈品","合計","地址","推廣員","備註"].join(",")];
      list.forEach(function (o) {
        var f = o.form || {};
        var addr = [f.region, f.estate, f.block, f.floor, f.flat].filter(Boolean).join(" ");
        var items = (o.items || []).map(function (it) {
          return (it.name || "") + "×" + (it.qty || "") + (it.code ? "(" + it.code + ")" : "");
        }).join("；");
        var gifts = (o.gifts || []).map(function (g) { return g.name || g; }).join("＋");
        rows.push([
          o.t, f.name, f.phone, f.email,
          (o.plan && o.plan.months) || "",
          (o.plan && o.plan.tag) || "",
          o.mix || "",
          items, gifts, o.total, addr, f.promoter, f.remark
        ].map(function (x) { return '"' + String(x == null ? "" : x).replace(/"/g, '""') + '"'; }).join(","));
      });
      var blob = new Blob(["\ufeff" + rows.join("\n")], { type: "text/csv;charset=utf-8" });
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "cupal-delivery.csv";
      a.click();
    } catch (e) { alert("匯出失敗"); }
  }

  function bind() {
    var root = document.getElementById("cupalDeliveryRoot");
    if (!root || root._cupalBound) return;
    root._cupalBound = true;
    root.addEventListener("click", function (e) {
      var plan = e.target.closest("[data-plan]");
      if (plan) {
        readForm();
        state.plan = Number(plan.getAttribute("data-plan"));
        normalizeQtyForPlan();
        render();
        return;
      }
      var g = e.target.closest("[data-gender]");
      if (g) {
        readForm();
        state.form.gender = g.getAttribute("data-gender");
        render();
        return;
      }
      var r = e.target.closest("[data-region]");
      if (r) {
        readForm();
        state.form.region = r.getAttribute("data-region");
        render();
        return;
      }
      var un = e.target.closest("[data-cupal-unpick]");
      if (un) {
        readForm();
        unpickProduct(un.getAttribute("data-cupal-unpick"));
        render();
        return;
      }
      var qb = e.target.closest(".qty-btn");
      if (qb) {
        var wrap = qb.closest("[data-cupal]");
        if (!wrap) return;
        readForm();
        changeQty(wrap.getAttribute("data-cupal"), Number(qb.getAttribute("data-delta")));
        render();
        return;
      }
      var pick = e.target.closest("[data-cupal-pick]");
      if (pick) {
        readForm();
        pickProduct(pick.getAttribute("data-cupal-pick"));
        render();
        return;
      }
      if (e.target.closest("#btnCupalSubmit")) { submit(); return; }
    });
  }

  window.BPE_CupalDelivery = {
    render: function () { bind(); render(); },
    exportCsv: exportCsv
  };
})();
