// FILEFORGE — Live Stream (small real-time data simulation)
// Adds a "Live Stream" page. Operations (insert / search / delete) arrive on a
// timer and are applied to a private Heap file and Sequential file; cumulative
// block I/O for each is plotted live. Independent of the main simulator state.
// Cost model (same as Learn/Formula Lab):
//   Heap:  insert = 2 | search = position/B + 1 (hit) or b (miss) | delete = search + 1
//   Seq :  insert = ⌈log₂b⌉ + 2·(blocks shifted) | search = ⌈log₂b⌉ (min 1) | delete = search + 2·(blocks shifted)
(function () {
    "use strict";

    var KEY_MAX = 999;
    var M = null;            // model
    var timer = null;
    var root, svg;

    function $(id) { return document.getElementById(id); }
    function rnd(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }
    function lg(b) { return Math.max(1, Math.ceil(Math.log2(Math.max(b, 1)))); }
    function blocks(n, B) { return Math.max(1, Math.ceil(n / B)); }

    function fresh() {
        return { heap: [], seq: [], hIO: 0, sIO: 0, ops: 0, series: [{ t: 0, h: 0, s: 0 }], log: [], tick: 0,
                 counts: { ins: 0, sea: 0, del: 0, miss: 0 } };
    }

    function cfg() {
        return {
            B: parseInt($("rtB").value, 10), rate: parseInt($("rtRate").value, 10),
            pIns: parseInt($("rtIns").value, 10), pSea: parseInt($("rtSea").value, 10), pDel: parseInt($("rtDel").value, 10)
        };
    }

    function bsearchPos(arr, k) {  // returns insertion/hit index
        var lo = 0, hi = arr.length - 1;
        while (lo <= hi) { var mid = (lo + hi) >> 1; if (arr[mid] === k) return mid; if (arr[mid] < k) lo = mid + 1; else hi = mid - 1; }
        return lo;
    }

    function step() {
        var c = cfg(), total = c.pIns + c.pSea + c.pDel || 1;
        var roll = Math.random() * total, kind = roll < c.pIns ? "ins" : roll < c.pIns + c.pSea ? "sea" : "del";
        if (kind === "del" && !M.heap.length) kind = "ins";
        if (kind === "sea" && !M.heap.length) kind = "ins";
        var h = 0, s = 0, msg = "";

        if (kind === "ins") {
            var k; var guard = 0;
            do { k = rnd(1, KEY_MAX); } while (M.heap.indexOf(k) >= 0 && guard++ < 50);
            if (M.heap.indexOf(k) >= 0) return;
            h = 2;
            var pos = bsearchPos(M.seq, k);
            var bSeq = blocks(M.seq.length + 1, c.B), shifted = Math.max(0, bSeq - 1 - Math.floor(pos / c.B));
            s = lg(bSeq) + 2 * shifted + (M.seq.length ? 0 : 1);
            M.heap.push(k); M.seq.splice(pos, 0, k);
            msg = "INSERT " + k;
        } else if (kind === "sea") {
            var hit = Math.random() < 0.8;
            var key = hit ? M.heap[rnd(0, M.heap.length - 1)] : rnd(1, KEY_MAX);
            var idx = M.heap.indexOf(key);
            var bH = blocks(M.heap.length, c.B);
            h = idx >= 0 ? Math.floor(idx / c.B) + 1 : bH;
            s = lg(blocks(M.seq.length, c.B));
            msg = "SEARCH " + key + (idx >= 0 ? "" : " (miss)");
            if (idx < 0) M.counts.miss++;
        } else {
            var dk = M.heap[rnd(0, M.heap.length - 1)];
            var hi = M.heap.indexOf(dk), pi = bsearchPos(M.seq, dk);
            var bS = blocks(M.seq.length, c.B), sh = Math.max(0, bS - 1 - Math.floor(pi / c.B));
            h = Math.floor(hi / c.B) + 1 + 1;
            s = lg(bS) + 2 * sh;
            M.heap.splice(hi, 1); M.seq.splice(pi, 1);
            msg = "DELETE " + dk;
        }
        M.counts[kind]++;
        M.hIO += h; M.sIO += s; M.ops++; M.tick++;
        M.series.push({ t: M.tick, h: M.hIO, s: M.sIO });
        if (M.series.length > 120) M.series.shift();
        M.log.unshift({ msg: msg, h: h, s: s, kind: kind });
        if (M.log.length > 12) M.log.pop();
        paint();
    }

    // ---------------- Painting ----------------
    function strip(arr, B, cls) {
        var out = "", nb = Math.min(blocks(arr.length, B), 14);
        for (var i = 0; i < nb; i++) {
            var cnt = Math.min(B, Math.max(0, arr.length - i * B));
            var cells = "";
            for (var j = 0; j < B; j++) cells += '<i class="' + (j < cnt ? "f " + cls : "e") + '"></i>';
            out += '<div class="rt-blk">' + cells + '</div>';
        }
        if (blocks(arr.length, B) > 14) out += '<span class="rt-more">+' + (blocks(arr.length, B) - 14) + ' blocks</span>';
        return out || '<span class="rt-more">empty</span>';
    }

    function chart() {
        var W = 600, H = 220, P = { l: 44, r: 12, t: 12, b: 22 }, d = M.series;
        var maxY = Math.max(10, d[d.length - 1].h, d[d.length - 1].s), x0 = d[0].t, x1 = Math.max(d[d.length - 1].t, x0 + 1);
        function X(t) { return P.l + (t - x0) / (x1 - x0) * (W - P.l - P.r); }
        function Y(v) { return H - P.b - v / maxY * (H - P.t - P.b); }
        function path(key) { return d.map(function (p, i) { return (i ? "L" : "M") + X(p.t).toFixed(1) + "," + Y(p[key]).toFixed(1); }).join(" "); }
        var grid = "";
        for (var g = 0; g <= 4; g++) { var v = Math.round(maxY * g / 4); grid += '<line x1="' + P.l + '" x2="' + (W - P.r) + '" y1="' + Y(v) + '" y2="' + Y(v) + '" class="chart-axis-line"/><text x="' + (P.l - 6) + '" y="' + (Y(v) + 4) + '" text-anchor="end" class="chart-axis-label">' + v + '</text>'; }
        svg.innerHTML = grid + '<path d="' + path("h") + '" class="chart-line heap-line"/><path d="' + path("s") + '" class="chart-line seq-line"/>' +
            '<text x="' + (W - P.r) + '" y="' + (H - 4) + '" text-anchor="end" class="chart-axis-label">operations →</text>';
    }

    function paint() {
        var c = cfg();
        $("rtHIO").textContent = M.hIO; $("rtSIO").textContent = M.sIO; $("rtOps").textContent = M.ops;
        $("rtN").textContent = M.heap.length; $("rtb").textContent = M.heap.length ? blocks(M.heap.length, c.B) : 0;
        var diff = M.hIO - M.sIO;
        $("rtVerdict").textContent = M.ops < 5 ? "Warming up…" : diff === 0 ? "Tied so far" : diff > 0 ? "Sequential is ahead by " + diff + " I/Os" : "Heap is ahead by " + (-diff) + " I/Os";
        $("rtMix").textContent = "ins " + M.counts.ins + " · search " + M.counts.sea + " (" + M.counts.miss + " miss) · del " + M.counts.del;
        $("rtHeapStrip").innerHTML = strip(M.heap, c.B, "h");
        $("rtSeqStrip").innerHTML = strip(M.seq, c.B, "s");
        $("rtLog").innerHTML = M.log.map(function (l) { return '<li class="k-' + l.kind + '"><span>' + l.msg + '</span><em>H ' + l.h + ' · S ' + l.s + '</em></li>'; }).join("");
        chart();
    }

    function setRunning(on) {
        clearInterval(timer); timer = null;
        $("rtToggle").textContent = on ? "❚❚ Pause" : "▶ Start stream";
        if (on) timer = setInterval(step, Math.round(1000 / cfg().rate));
    }

    function labels() {
        $("rtBL").textContent = $("rtB").value; $("rtRateL").textContent = $("rtRate").value + " ops/s";
        $("rtInsL").textContent = $("rtIns").value; $("rtSeaL").textContent = $("rtSea").value; $("rtDelL").textContent = $("rtDel").value;
    }

    function preset(a, b, c, name) {
        $("rtIns").value = a; $("rtSea").value = b; $("rtDel").value = c; labels();
        $("rtPresetName").textContent = name;
    }

    function install() {
        // new page + nav button
        var main = document.querySelector(".main"); if (!main) return;
        var sec = document.createElement("section"); sec.className = "page"; sec.id = "live";
        sec.innerHTML =
            '<div class="page-intro"><span class="eyebrow">REAL-TIME SIMULATION</span><h2>Live Stream</h2>' +
            '<p>Operations arrive continuously. Watch cumulative block I/O diverge as the workload mix changes — try a log-heavy stream, then a lookup-heavy one.</p></div>' +
            '<div class="rt-grid">' +
              '<div class="panel rt-controls"><span class="eyebrow">STREAM CONTROLS</span>' +
                '<div class="rt-btns"><button class="primary-btn" id="rtToggle">▶ Start stream</button><button class="secondary-btn" id="rtStep">Step once</button><button class="secondary-btn" id="rtReset">Reset</button></div>' +
                '<label>Speed <b id="rtRateL"></b><input type="range" id="rtRate" min="1" max="20" value="4"></label>' +
                '<label>Records per block <b id="rtBL"></b><input type="range" id="rtB" min="2" max="8" value="4"></label>' +
                '<div class="rt-presets"><button type="button" data-p="80,10,10">Logging</button><button type="button" data-p="15,75,10">Lookups</button><button type="button" data-p="40,40,20">Balanced</button><span id="rtPresetName">Balanced</span></div>' +
                '<label>Insert weight <b id="rtInsL"></b><input type="range" id="rtIns" min="0" max="100" value="40"></label>' +
                '<label>Search weight <b id="rtSeaL"></b><input type="range" id="rtSea" min="0" max="100" value="40"></label>' +
                '<label>Delete weight <b id="rtDelL"></b><input type="range" id="rtDel" min="0" max="100" value="20"></label>' +
              '</div>' +
              '<div class="rt-main">' +
                '<div class="rt-stats"><div class="panel"><small>HEAP I/O</small><b id="rtHIO" class="h">0</b></div><div class="panel"><small>SEQUENTIAL I/O</small><b id="rtSIO" class="s">0</b></div><div class="panel"><small>OPERATIONS</small><b id="rtOps">0</b></div><div class="panel"><small>N / BLOCKS</small><b><span id="rtN">0</span> / <span id="rtb">0</span></b></div></div>' +
                '<div class="panel"><div class="rt-head"><span class="eyebrow">CUMULATIVE BLOCK I/O</span><span id="rtVerdict" class="rt-verdict"></span></div>' +
                  '<svg id="rtChart" viewBox="0 0 600 220" class="rt-svg"></svg>' +
                  '<div class="rt-legend"><span><i class="h"></i> Heap</span><span><i class="s"></i> Sequential</span><small id="rtMix"></small></div></div>' +
                '<div class="rt-two"><div class="panel"><span class="eyebrow">HEAP FILE BLOCKS</span><div class="rt-strip" id="rtHeapStrip"></div></div>' +
                '<div class="panel"><span class="eyebrow">SEQUENTIAL FILE BLOCKS</span><div class="rt-strip" id="rtSeqStrip"></div></div></div>' +
                '<div class="panel"><span class="eyebrow">LATEST OPERATIONS (block I/Os)</span><ul class="rt-log" id="rtLog"></ul></div>' +
              '</div></div>';
        main.appendChild(sec);

        // nav button after History
        var hist = document.querySelector('.nav-btn[data-page="history"]');
        if (hist) {
            var nb = document.createElement("button"); nb.className = "nav-btn"; nb.setAttribute("data-page", "live");
            nb.innerHTML = "<span>≋</span> Live Stream"; hist.parentNode.appendChild(nb);
            nb.addEventListener("click", function () {
                if (typeof window.navigate === "function") window.navigate("live");
                else { document.querySelectorAll(".page,.nav-btn").forEach(function (n) { n.classList.remove("active"); }); sec.classList.add("active"); nb.classList.add("active"); }
                var t = $("pageTitle"), bc = $("breadcrumbPage"); if (t) t.textContent = "Live Stream"; if (bc) bc.textContent = "LIVE STREAM";
            });
        }
        // pause when leaving the page
        document.querySelectorAll(".nav-btn").forEach(function (b) {
            b.addEventListener("click", function () { if (b.getAttribute("data-page") !== "live" && timer) setRunning(false); });
        });

        svg = $("rtChart"); M = fresh(); labels(); paint();
        $("rtToggle").addEventListener("click", function () { setRunning(!timer); });
        $("rtStep").addEventListener("click", function () { if (timer) setRunning(false); step(); });
        $("rtReset").addEventListener("click", function () { setRunning(false); M = fresh(); paint(); });
        $("rtRate").addEventListener("input", function () { labels(); if (timer) setRunning(true); });
        $("rtB").addEventListener("input", function () { labels(); paint(); });
        ["rtIns", "rtSea", "rtDel"].forEach(function (id) { $(id).addEventListener("input", function () { labels(); $("rtPresetName").textContent = "Custom"; }); });
        sec.querySelector(".rt-presets").addEventListener("click", function (e) {
            var b = e.target.closest("button[data-p]"); if (!b) return;
            var p = b.getAttribute("data-p").split(",").map(Number); preset(p[0], p[1], p[2], b.textContent);
        });
    }
    document.addEventListener("DOMContentLoaded", install);
})();
