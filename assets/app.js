/* Foodie Pop! GDD wiki - client side: search, theme, sidebar, table filter/sort, use-case toggles, lightbox. No network needed (file:// safe). */
(function () {
  "use strict";
  var root = window.SITE_ROOT || "";
  var strip = function (s) { return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase(); };

  // ---- theme toggle (persisted in localStorage when available) ----
  var tb = document.getElementById("themeBtn");
  if (tb) {
    tb.addEventListener("click", function () {
      var cur = document.documentElement.getAttribute("data-theme");
      var dark = cur ? cur === "dark" : window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
      var next = dark ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      try { localStorage.setItem("fp-theme", next); } catch (e) { /* ignore */ }
    });
  }

  // ---- sidebar (mobile) ----
  var mb = document.getElementById("menuBtn"), sb = document.getElementById("sidebar");
  if (mb && sb) { mb.addEventListener("click", function () { sb.classList.toggle("open"); }); }

  // ---- search: index is loaded lazily from assets/search-data.js (works on file://), fallback to assets/search.json ----
  var q = document.getElementById("q"), res = document.getElementById("results"), idx = null, loading = null, sel = -1;
  function loadIndex() {
    if (idx) { return Promise.resolve(idx); }
    if (loading) { return loading; }
    loading = new Promise(function (resolve) {
      if (window.FP_SEARCH) { idx = window.FP_SEARCH; resolve(idx); return; }
      var s = document.createElement("script");
      s.src = root + "assets/search-data.js";
      s.onload = function () { idx = window.FP_SEARCH || []; resolve(idx); };
      s.onerror = function () {
        if (!window.fetch) { idx = []; resolve(idx); return; }
        fetch(root + "assets/search.json").then(function (r) { return r.json(); })
          .then(function (j) { idx = j; resolve(idx); }).catch(function () { idx = []; resolve(idx); });
      };
      document.head.appendChild(s);
    });
    return loading;
  }
  function render(items) {
    res.textContent = "";
    if (!items.length) { res.hidden = true; return; }
    items.forEach(function (it, i) {
      var a = document.createElement("a");
      a.href = root + it.u;
      if (i === 0) { a.className = "sel"; }
      var d1 = document.createElement("div");
      d1.appendChild(document.createTextNode(it.t + " "));
      var sp = document.createElement("span"); sp.className = "r-c"; sp.textContent = "· " + it.c; d1.appendChild(sp);
      var d2 = document.createElement("div"); d2.className = "r-c"; d2.textContent = it.g || "";
      a.appendChild(d1); a.appendChild(d2); res.appendChild(a);
    });
    res.hidden = false; sel = 0;
  }
  if (q && res) {
    q.addEventListener("input", function () {
      var v = strip(q.value.trim());
      if (v.length < 2) { res.hidden = true; return; }
      loadIndex().then(function (ix) {
        var scored = ix.map(function (it) {
          var s = 0, t = strip(it.t), k = strip(it.k), g = strip(it.g);
          if (t.indexOf(v) === 0) { s += 10; }
          if (t.indexOf(v) >= 0) { s += 6; }
          if (g.indexOf(v) >= 0) { s += 3; }
          if (k.indexOf(v) >= 0) { s += 2; }
          return [s, it];
        }).filter(function (x) { return x[0] > 0; })
          .sort(function (a, b) { return b[0] - a[0]; }).slice(0, 14).map(function (x) { return x[1]; });
        render(scored);
      });
    });
    q.addEventListener("keydown", function (e) {
      var links = res.querySelectorAll("a");
      if (e.key === "Escape") { res.hidden = true; }
      if (!links.length || res.hidden) { return; }
      if (e.key === "ArrowDown") { sel = Math.min(sel + 1, links.length - 1); }
      else if (e.key === "ArrowUp") { sel = Math.max(sel - 1, 0); }
      else if (e.key === "Enter") { e.preventDefault(); links[Math.max(sel, 0)].click(); return; }
      else { return; }
      links.forEach(function (l, i) { l.classList.toggle("sel", i === sel); });
      e.preventDefault();
    });
    document.addEventListener("click", function (e) { if (!e.target.closest(".search")) { res.hidden = true; } });
    document.addEventListener("keydown", function (e) {
      if (e.key === "/" && document.activeElement !== q && !/INPUT|TEXTAREA/.test(document.activeElement.tagName)) { e.preventDefault(); q.focus(); }
    });
  }

  // ---- table filter: <input class="filter" data-for="table-id"> ----
  document.querySelectorAll("input.filter[data-for]").forEach(function (inp) {
    var table = document.getElementById(inp.dataset["for"]);
    if (!table) { return; }
    inp.addEventListener("input", function () {
      var v = strip(inp.value);
      table.querySelectorAll("tbody tr").forEach(function (tr) { tr.style.display = !v || strip(tr.textContent).indexOf(v) >= 0 ? "" : "none"; });
    });
  });

  // ---- sortable tables: click a header (numbers sort numerically, text by Vietnamese collation) ----
  function num(s) {
    var t = String(s).replace(/\s/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".");
    return /^[-+]?\d+(\.\d+)?%?$/.test(t) ? parseFloat(t) : NaN;
  }
  document.querySelectorAll("table.sortable").forEach(function (table) {
    var heads = table.querySelectorAll("thead th");
    heads.forEach(function (th, col) {
      th.addEventListener("click", function () {
        var asc = !th.classList.contains("asc");
        heads.forEach(function (h) { h.classList.remove("asc", "desc"); });
        th.classList.add(asc ? "asc" : "desc");
        var body = table.tBodies[0];
        var rows = Array.prototype.slice.call(body.rows).map(function (tr, i) { return { tr: tr, i: i, v: tr.cells[col] ? tr.cells[col].textContent.trim() : "" }; });
        rows.sort(function (a, b) {
          var na = num(a.v), nb = num(b.v), c;
          if (!isNaN(na) && !isNaN(nb)) { c = na - nb; } else { c = a.v.localeCompare(b.v, "vi", { numeric: true }); }
          return (asc ? c : -c) || a.i - b.i;
        });
        rows.forEach(function (r) { body.appendChild(r.tr); });
      });
    });
  });

  // ---- use cases: toggle all, open from hash ----
  document.querySelectorAll(".toggle-all").forEach(function (a) {
    a.addEventListener("click", function (e) {
      e.preventDefault();
      var ds = document.querySelectorAll("details.uc");
      var open = Array.prototype.some.call(ds, function (d) { return !d.open; });
      ds.forEach(function (d) { d.open = open; });
    });
  });
  function openHash() {
    if (!location.hash) { return; }
    var el = document.getElementById(decodeURIComponent(location.hash.slice(1)));
    for (var n = el; n; n = n.parentElement) { if (n.tagName === "DETAILS") { n.open = true; } }
    if (el) { el.scrollIntoView(); }
  }
  openHash();
  window.addEventListener("hashchange", openHash);

  // ---- lightbox for screenshots (a.lb) ----
  var links = Array.prototype.slice.call(document.querySelectorAll("a.lb"));
  if (links.length) {
    var box = null, cur = 0;
    var show = function (i) {
      cur = (i + links.length) % links.length;
      var a = links[cur];
      if (!box) {
        box = document.createElement("div"); box.className = "lbox";
        box.innerHTML = '<button class="x" aria-label="Đóng">✕</button><button class="prev" aria-label="Trước">‹</button><img alt=""><div class="cap"></div><button class="next" aria-label="Sau">›</button>';
        document.body.appendChild(box);
        box.addEventListener("click", function (e) {
          if (e.target.classList.contains("prev")) { show(cur - 1); }
          else if (e.target.classList.contains("next")) { show(cur + 1); }
          else if (e.target.tagName !== "IMG") { box.hidden = true; }
        });
      }
      box.querySelector("img").src = a.href;
      box.querySelector(".cap").textContent = a.dataset.cap || "";
      box.hidden = false;
    };
    links.forEach(function (a, i) { a.addEventListener("click", function (e) { e.preventDefault(); show(i); }); });
    document.addEventListener("keydown", function (e) {
      if (!box || box.hidden) { return; }
      if (e.key === "Escape") { box.hidden = true; }
      if (e.key === "ArrowLeft") { show(cur - 1); }
      if (e.key === "ArrowRight") { show(cur + 1); }
    });
  }
})();
