/* 點心紙下單介面 — 數量存 localStorage；參考用途，非醫療建議 */
(function () {
  "use strict";

  var LS_KEY = "zihua_bpe_dimsum_order_v1";
  var activeSheet = "zihua";
  var footerExpanded = false;

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
  function loadState() {
    try {
      var raw = localStorage.getItem(LS_KEY);
      if (raw) {
        var o = JSON.parse(raw);
        return {
          items: o.items || {},
          sets: o.sets || {},
          overrides: o.overrides || {}
        };
      }
    } catch (e) { /* ignore */ }
    return { items: {}, sets: {}, overrides: {} };
  }
  function saveState(st) {
    try { localStorage.setItem(LS_KEY, JSON.stringify(st)); } catch (e) { /* ignore */ }
  }

  function data() {
    return window.BPE_DIMSUM_ORDER || { sheets: [] };
  }

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

  function isAdmin() {
    var a = window.ZihuaAdminAuth;
    return !!(a && a.isLoggedIn && a.isLoggedIn());
  }

  /** 買3送1：每 4 盒免最平 1 盒 */
  function bogoDiscount(prices) {
    if (!prices.length) return 0;
    var sorted = prices.slice().sort(function (a, b) { return a - b; });
    var free = Math.floor(sorted.length / 4);
    var disc = 0;
    for (var i = 0; i < free; i++) disc += sorted[i];
    return disc;
  }

  function calcTotals(st) {
    var sheets = data().sheets || [];
    var total = 0;
    var lines = [];
    var bogoSectionCodes = {};

    sheets.forEach(function (sheet) {
      (sheet.sections || []).forEach(function (sec) {
        var hasBogo = (sec.bundles || []).some(function (b) { return b.useItemPrices; });
        if (hasBogo) {
          bogoSectionCodes[sec.id] = true;
        }
        (sec.bundles || []).forEach(function (b) {
          var q = setQty(st, b.id);
          if (q <= 0) return;
          if (b.useItemPrices) {
            lines.push({
              kind: "set-note",
              label: sec.title + " · " + b.label + " × " + q,
              amount: null,
              note: "請喺下面單品填數量；合計會自動計買3送1折扣"
            });
            return;
          }
          if (b.setPrice == null) return;
          var amt = q * Number(b.setPrice);
          total += amt;
          lines.push({
            kind: "set",
            label: b.label + " × " + q + " 套",
            amount: amt
          });
        });

        var bogoPrices = [];
        (sec.items || []).forEach(function (it) {
          if (it.displayOnly) return;
          var q = itemQty(st, it.code);
          if (q <= 0) return;
          var p = unitPrice(it, st);
          if (p == null) {
            lines.push({ kind: "item", label: it.code + " " + it.name + " × " + q, amount: null, note: "價錢空" });
            return;
          }
          // packQty special (e.g. $300/2盒)
          if (it.packQty && it.packPrice) {
            var packs = Math.floor(q / it.packQty);
            var rem = q % it.packQty;
            var amt = packs * Number(it.packPrice) + rem * p;
            // if rem and no fair single, still use p
            total += amt;
            lines.push({ kind: "item", label: it.code + " " + it.name + " × " + q, amount: amt });
            return;
          }
          var lineAmt = q * p;
          if (hasBogo) {
            for (var i = 0; i < q; i++) bogoPrices.push(p);
          }
          total += lineAmt;
          lines.push({ kind: "item", label: it.code + " " + it.name + " × " + q, amount: lineAmt, code: it.code, secId: sec.id });
        });

        if (hasBogo && bogoPrices.length) {
          var disc = bogoDiscount(bogoPrices);
          if (disc > 0) {
            total -= disc;
            lines.push({ kind: "discount", label: sec.title + " · 買3送1折扣", amount: -disc });
          }
        }
      });
    });

    return { total: total, lines: lines };
  }

  function qtyCtrl(kind, id, val) {
    var v = val > 0 ? String(val) : "";
    return (
      '<div class="qty-ctrl" data-kind="' + esc(kind) + '" data-id="' + esc(id) + '">' +
        '<button type="button" class="qty-btn" data-delta="-1" aria-label="減">−</button>' +
        '<input type="number" class="qty-input" min="0" step="1" inputmode="numeric" value="' + esc(v) + '" aria-label="數量" />' +
        '<button type="button" class="qty-btn" data-delta="1" aria-label="加">＋</button>' +
      "</div>"
    );
  }

  function renderSheetTabs(st) {
    var sheets = data().sheets || [];
    return (
      '<div class="dimsum-sheet-tabs" role="tablist">' +
      sheets.map(function (s) {
        var on = s.id === activeSheet ? " active" : "";
        return '<button type="button" role="tab" class="dimsum-sheet-tab' + on + '" data-sheet="' + esc(s.id) + '">' + esc(s.short || s.title) + "</button>";
      }).join("") +
      "</div>"
    );
  }

  function renderSection(sec, st) {
    var html = '<div class="dimsum-section" data-sec="' + esc(sec.id) + '">';
    html += "<h4>" + esc(sec.title) + "</h4>";
    if (sec.note) html += '<p class="dimsum-note">' + esc(sec.note) + "</p>";

    (sec.bundles || []).forEach(function (b) {
      var q = setQty(st, b.id);
      var priceLabel = b.useItemPrices
        ? "（按單品計／買3送1）"
        : ("$" + money(b.setPrice) + "／套");
      html +=
        '<div class="dimsum-bundle-row">' +
          '<div class="dimsum-bundle-info">' +
            '<strong class="dimsum-deal">' + esc(b.label) + "</strong>" +
            '<span class="muted">' + esc(priceLabel) + "</span>" +
          "</div>" +
          qtyCtrl("set", b.id, q) +
          '<div class="dimsum-unit">套</div>' +
          '<div class="dimsum-sub">' +
            (b.useItemPrices || b.setPrice == null
              ? "—"
              : ("$" + money(q * Number(b.setPrice)))) +
          "</div>" +
        "</div>";
    });

    html += '<div class="table-wrap"><table class="data dimsum-table"><thead><tr>' +
      "<th>編號</th><th>產品名稱</th><th>原價</th><th>特價</th><th>數量</th><th>單位</th><th>小計</th>" +
      (isAdmin() ? "<th>改價</th>" : "") +
      "</tr></thead><tbody>";

    (sec.items || []).forEach(function (it) {
      var q = it.displayOnly ? 0 : itemQty(st, it.code);
      var p = unitPrice(it, st);
      var sub = it.displayOnly || p == null || q <= 0 ? null : q * p;
      if (!it.displayOnly && it.packQty && it.packPrice && q > 0) {
        var packs = Math.floor(q / it.packQty);
        var rem = q % it.packQty;
        sub = packs * Number(it.packPrice) + rem * (p || 0);
      }
      var specialTxt = it.saleNote
        ? esc(it.saleNote)
        : (it.special == null ? "—" : ("$" + money(it.special)));
      var origTxt = it.orig == null ? "—" : ("$" + money(it.orig));
      html += "<tr" + (it.displayOnly ? ' class="dimsum-ref"' : "") + ">";
      html += "<td><code>" + esc(it.code) + "</code></td>";
      html += "<td>" + esc(it.name) + "</td>";
      html += '<td class="num">' + origTxt + "</td>";
      html += '<td class="num special">' + specialTxt + "</td>";
      if (it.displayOnly) {
        html += '<td colspan="1" class="muted">—</td>';
      } else {
        html += "<td>" + qtyCtrl("item", it.code, q) + "</td>";
      }
      html += "<td>" + esc(it.unit || "") + "</td>";
      html += '<td class="num dimsum-line-sub">' + (sub == null ? "—" : ("$" + money(sub))) + "</td>";
      if (isAdmin()) {
        if (it.displayOnly) {
          html += "<td></td>";
        } else {
          var ov = st.overrides[it.code];
          html +=
            '<td><input type="number" class="price-override" data-code="' + esc(it.code) +
            '" min="0" step="0.1" placeholder="特價" value="' +
            (ov != null && ov !== "" ? esc(ov) : "") +
            '" /></td>';
        }
      }
      html += "</tr>";
    });

    html += "</tbody></table></div></div>";
    return html;
  }

  function render() {
    var root = $("dimsumOrderRoot");
    if (!root) return;
    var st = loadState();
    var sheets = data().sheets || [];
    var sheet = sheets.filter(function (s) { return s.id === activeSheet; })[0] || sheets[0];
    if (sheet) activeSheet = sheet.id;

    var html = renderSheetTabs(st);
    html += '<div class="dimsum-list" id="dimsumList">';
    if (sheet) {
      html += '<div class="dimsum-sheet-head">';
      html += "<h3>" + esc(sheet.title) + ' <span class="badge">點心紙</span></h3>';
      if (sheet.image) {
        html +=
          '<details class="dimsum-ref-img"><summary>睇原圖參考</summary>' +
          '<a href="' + esc(sheet.image) + '" target="_blank" rel="noopener">' +
          '<img src="' + esc(sheet.image) + '" alt="' + esc(sheet.title) + ' 點心紙" loading="lazy" />' +
          "</a></details>";
      }
      html += "</div>";
      (sheet.sections || []).forEach(function (sec) {
        html += renderSection(sec, st);
      });
    }
    html += "</div>";

    var calc = calcTotals(st);
    var expClass = footerExpanded ? " is-expanded" : "";
    var toggleLabel = footerExpanded ? "收合" : "更多";
    var giftHtml = "";
    if (window.BPE_Gifts && window.BPE_Gifts.renderProgressHtml) {
      giftHtml = window.BPE_Gifts.renderProgressHtml(calc.total, st);
    }
    html +=
      '<div class="dimsum-footer' + expClass + '" id="dimsumFooter">' +
        '<div class="dimsum-footer-bar">' +
          '<div class="dimsum-total-line">' +
            '<span>合計</span>' +
            '<strong id="dimsumGrandTotal">$' + money(calc.total) + "</strong>" +
          "</div>" +
          '<button type="button" class="dimsum-footer-toggle" id="btnDimsumToggle" aria-expanded="' +
            (footerExpanded ? "true" : "false") + '">' + toggleLabel + "</button>" +
        "</div>" +
        giftHtml +
        '<div class="dimsum-footer-extra" id="dimsumFooterExtra"' +
          (footerExpanded ? "" : " hidden") + ">" +
          '<p class="muted dimsum-hint">套裝「套」數優先按套裝價計；單品數量另計。買3送1會自動扣最平件。職員可改價（登入後）。參考用途，以攤位當日為準。</p>' +
          '<div class="btn-row dimsum-footer-actions">' +
            '<button type="button" class="btn-danger" id="btnDimsumClear">清空</button>' +
            '<button type="button" class="btn-ghost" id="btnDimsumExport">匯出</button>' +
            '<button type="button" class="primary" id="btnDimsumPrint">列印</button>' +
          "</div>" +
        "</div>" +
      "</div>";

    root.innerHTML = html;
  }

  function setQtyValue(kind, id, val) {
    var st = loadState();
    var n = Math.max(0, Math.floor(Number(val) || 0));
    if (kind === "set") {
      if (n <= 0) delete st.sets[id];
      else st.sets[id] = n;
    } else {
      if (n <= 0) delete st.items[id];
      else st.items[id] = n;
    }
    saveState(st);
    render();
  }

  function exportText() {
    var st = loadState();
    var calc = calcTotals(st);
    var lines = ["紫花油工展會 · 點心紙訂單", "———"];
    calc.lines.forEach(function (L) {
      if (L.amount == null) lines.push(L.label + (L.note ? "（" + L.note + "）" : ""));
      else lines.push(L.label + "　$" + money(L.amount));
    });
    lines.push("———");
    lines.push("合計　$" + money(calc.total));
    if (window.BPE_Gifts && window.BPE_Gifts.evaluate) {
      var gev = window.BPE_Gifts.evaluate(calc.total, st);
      if (gev.enabled && gev.reached.length) {
        var gnames = gev.reached.map(function (t) {
          var n = t.title;
          if (t.soldOut) n += "（已送完）";
          return n;
        });
        lines.push("目前合計可享禮遇：" + gnames.join("；"));
      }
      if (gev.enabled && gev.next) {
        lines.push("再消費 $" + money(gev.next.gap) + " 可取：" + gev.next.tier.title);
      }
      lines.push("禮遇送完即止，以攤位當日為準");
    }
    lines.push("（參考用途，以攤位當日為準）");
    return lines.join("\n");
  }

  function bindRoot() {
    var root = $("dimsumOrderRoot");
    if (!root || root._dimsumBound) return;
    root._dimsumBound = true;
    root.addEventListener("click", function (e) {
      var tab = e.target.closest("[data-sheet]");
      if (tab) {
        activeSheet = tab.getAttribute("data-sheet");
        render();
        return;
      }
      var btn = e.target.closest(".qty-btn");
      if (btn) {
        var wrap = btn.closest(".qty-ctrl");
        if (!wrap) return;
        var input = wrap.querySelector(".qty-input");
        var cur = Math.max(0, Math.floor(Number(input.value) || 0));
        var next = cur + Number(btn.getAttribute("data-delta"));
        setQtyValue(wrap.getAttribute("data-kind"), wrap.getAttribute("data-id"), next);
        return;
      }
      var toggle = e.target.closest("#btnDimsumToggle");
      if (toggle) {
        footerExpanded = !footerExpanded;
        render();
        return;
      }
      if (e.target.closest("#btnDimsumClear")) {
        if (!confirm("清空全部數量同套裝？")) return;
        saveState({ items: {}, sets: {}, overrides: loadState().overrides });
        render();
        return;
      }
      if (e.target.closest("#btnDimsumExport")) {
        var text = exportText();
        var blob = new Blob([text], { type: "text/plain;charset=utf-8" });
        var a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "bpe-dimsum-order.txt";
        a.click();
        setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
        return;
      }
      if (e.target.closest("#btnDimsumPrint")) {
        var text2 = exportText();
        var w = window.open("", "_blank");
        if (w) {
          w.document.write("<pre style=\"font-family:sans-serif;font-size:14px;padding:16px;white-space:pre-wrap;\">" +
            esc(text2).replace(/\n/g, "<br>") + "</pre>");
          w.document.close();
          w.focus();
          w.print();
        }
      }
    });
    root.addEventListener("change", function (e) {
      var t = e.target;
      if (t.classList.contains("qty-input")) {
        var wrap = t.closest(".qty-ctrl");
        if (!wrap) return;
        setQtyValue(wrap.getAttribute("data-kind"), wrap.getAttribute("data-id"), t.value);
      }
      if (t.classList.contains("price-override")) {
        var st = loadState();
        var code = t.getAttribute("data-code");
        if (t.value === "") delete st.overrides[code];
        else st.overrides[code] = Number(t.value);
        saveState(st);
        render();
      }
    });
  }

  window.BPE_DimsumOrderUI = {
    render: function () {
      bindRoot();
      render();
    },
    clear: function () {
      saveState({ items: {}, sets: {}, overrides: {} });
      render();
    }
  };
})();
