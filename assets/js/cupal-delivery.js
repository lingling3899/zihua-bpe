/* CUPAL Health 宅配訂購表格 — 本機 localStorage */
(function () {
  "use strict";

  var LS_ORDERS = "zihua_bpe_cupal_delivery_v1";
  var PLANS = [
    { months: 2, discount: 0.9, label: "2 Months", tag: "9折" },
    { months: 3, discount: 0.85, label: "3 Months", tag: "85折" },
    { months: 6, discount: 0.7, label: "6 Months", tag: "7折" },
    { months: 9, discount: 0.6, label: "9 Months", tag: "6折" },
    { months: 12, discount: 0.5, label: "12 Months", tag: "5折" }
  ];
  var PRODUCTS = [
    { id: "cmpl", name: "古寶補適貼（大）10片", code: "CMPL", price: 67 },
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
  function calcTotal() {
    var plan = planOf();
    var sum = 0;
    PRODUCTS.forEach(function (p) {
      var q = Math.max(0, Math.floor(Number(state.qty[p.id] || 0)));
      if (q > 0) sum += p.price * q * plan.months * plan.discount;
    });
    return Math.round(sum * 100) / 100;
  }

  function render() {
    var root = document.getElementById("cupalDeliveryRoot");
    if (!root) return;
    var plan = planOf();
    var total = calcTotal();
    var years = [];
    for (var y = 2010; y >= 1930; y--) years.push(y);

    var planBtns = PLANS.map(function (p) {
      return '<button type="button" class="plan-chip' + (state.plan === p.months ? " active" : "") +
        '" data-plan="' + p.months + '">' + esc(p.label) + "（" + esc(p.tag) + "）</button>";
    }).join("");

    var products = PRODUCTS.map(function (p) {
      var q = Math.max(0, Math.floor(Number(state.qty[p.id] || 0)));
      return (
        '<div class="pc-card cupal-prod">' +
          '<div class="pc-thumb blue" aria-hidden="true">💊</div>' +
          '<div class="pc-card-body">' +
            "<strong>" + esc(p.name) + "</strong>" +
            '<div class="pc-meta"><code>' + esc(p.code) + '</code> · 原價 $' + money(p.price) + "</div>" +
          "</div>" +
          '<div class="qty-ctrl" data-cupal="' + esc(p.id) + '">' +
            '<button type="button" class="qty-btn" data-delta="-1">−</button>' +
            '<span class="qty-val">' + q + "</span>" +
            '<button type="button" class="qty-btn qty-plus" data-delta="1">＋</button>' +
          "</div>" +
        "</div>"
      );
    }).join("");

    var f = state.form;
    root.innerHTML =
      '<header class="cupal-hero">' +
        "<p>2026 HKBPE 宅配計劃</p>" +
        "<h2>CUPAL Health 肌肉關節專家 宅配訂購表格</h2>" +
        "<p class=" + '"cupal-lead">揀訂購月數同每月盒數，填資料提交；資料只存本機，職員可匯出跟進。</p>' +
      "</header>" +
      '<section class="panel cupal-panel">' +
        "<h3>1. 請選擇您的訂購方案</h3>" +
        '<div class="plan-chips">' + planBtns + "</div>" +
      "</section>" +
      '<section class="panel cupal-panel">' +
        "<h3>2. 揀產品 · 每月盒數</h3>" +
        '<p class="muted">合計＝原價 × 每月盒數 × 月數 × 折扣（而家：' + plan.months + " 個月 · " + plan.tag + "）</p>" +
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
        "<ul class=\"muted\"><li>送貨週期以確認單為準。</li><li>查詢電話：5409 8204（示意）。</li><li>本表只存本機，唔係正式電子商務結帳。</li></ul>" +
        '<label class="agree-row"><input type="checkbox" id="cdAgree"' + (f.agree ? " checked" : "") + ' /> 我已閱讀並同意以上條款</label>' +
      "</section>" +
      '<div class="cupal-float">' +
        '<div><span class="muted">' + (total > 0 ? ("方案 " + plan.months + " 個月 · " + plan.tag) : "請揀產品及每月盒數") +
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
    if (total <= 0) { alert("請先揀產品同每月盒數。"); return; }
    if (!state.form.name.trim() || !state.form.phone.trim()) { alert("請填姓名同電話。"); return; }
    if (!state.form.agree) { alert("請先同意條款。"); return; }
    var plan = planOf();
    var items = PRODUCTS.filter(function (p) { return (state.qty[p.id] || 0) > 0; }).map(function (p) {
      return { id: p.id, name: p.name, code: p.code, price: p.price, qty: state.qty[p.id] };
    });
    var order = {
      id: "cd-" + Date.now(),
      t: new Date().toISOString(),
      plan: plan,
      items: items,
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
    alert("已提交（本機保存）\n合計 $" + money(total) + "\n職員可稍後匯出跟進。");
  }

  function exportCsv() {
    try {
      var raw = localStorage.getItem(LS_ORDERS);
      var list = raw ? JSON.parse(raw) : [];
      if (!list.length) { alert("未有宅配訂單。"); return; }
      var rows = [["時間","姓名","電話","電郵","方案月數","折扣","合計","地址","推廣員"].join(",")];
      list.forEach(function (o) {
        var f = o.form || {};
        var addr = [f.region, f.estate, f.block, f.floor, f.flat].filter(Boolean).join(" ");
        rows.push([o.t, f.name, f.phone, f.email, (o.plan && o.plan.months) || "", (o.plan && o.plan.tag) || "", o.total, addr, f.promoter]
          .map(function (x) { return '"' + String(x == null ? "" : x).replace(/"/g, '""') + '"'; }).join(","));
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
      var qb = e.target.closest(".qty-btn");
      if (qb) {
        var wrap = qb.closest("[data-cupal]");
        if (!wrap) return;
        readForm();
        var id = wrap.getAttribute("data-cupal");
        var cur = Math.max(0, Math.floor(Number(state.qty[id] || 0)));
        var next = cur + Number(qb.getAttribute("data-delta"));
        if (next <= 0) delete state.qty[id];
        else state.qty[id] = next;
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
