// FILEFORGE — Live Stream (small real-time data simulation)
// Adds a "Live Stream" page: a simulated student-records desk where
// enrolments (insert), look-ups (search) and withdrawals (delete) arrive on a
// timer. Each operation is applied to a private Heap file and Sequential file;
// the block each one touched flashes, cumulative block I/O is plotted live and
// a per-operation breakdown shows *why* one file wins for the current mix.
// Independent of the main simulator state.
// Cost model (same as Learn/Formula Lab):
//   Heap:  insert = 2 | search = position/B + 1 (hit) or b (miss) | delete = search + 1
//   Seq :  insert = ⌈log₂b⌉ + 2·(blocks shifted) | search = ⌈log₂b⌉ (min 1) | delete = search + 2·(blocks shifted)
(function () {
    "use strict";

    var KEY_MAX = 999;
    var NAMES = ["Aarav", "Diya", "Rohan", "Ananya", "Vikram", "Meera", "Karthik", "Sneha", "Arjun", "Priya", "Rahul", "Divya", "Siddharth", "Kavya", "Aditya", "Lakshmi", "Nikhil", "Pooja", "Harish", "Nandini"];
    var DEPTS = ["CSE", "ECE", "MECH", "EEE", "CIVIL", "IT", "AIDS"];
    var SCENARIOS = {
        rush:    { p: [85, 10, 5],  name: "Registration rush", why: "Mostly inserts: the heap just appends (2 I/Os) while the sequential file keeps shifting records to stay sorted." },
        results: { p: [10, 85, 5],  name: "Results day",       why: "Mostly look-ups: binary search reads ⌈log₂ b⌉ blocks while the heap scans half the file on average." },
        cleanup: { p: [25, 30, 45], name: "Semester cleanup",  why: "Deletes need a search first, then the sequential file closes the gap — both files pay." },
        balanced:{ p: [40, 40, 20], name: "Balanced",          why: "A mixed day. Watch which line pulls ahead as the file grows — search costs grow with b, heap inserts don't." }
    };
    var M = null;            // model
    var timer = null;
    var root, svg;

    function $(id) { return document.getElementById(id); }
    function rnd(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }
    function lg(b) { return Math.max(1, Math.ceil(Math.log2(Math.max(b, 1)))); }
    function blocks(n, B) { return Math.max(1, Math.ceil(n / B)); }

    function fresh() {
        return { heap: [], seq: [], info: {}, hIO: 0, sIO: 0, ops: 0, series: [{ t: 0, h: 0, s: 0 }], log: [], tick: 0,
                 counts: { ins: 0, sea: 0, del: 0, miss: 0 }, cost: { ins: [0, 0], sea: [0, 0], del: [0, 0] }, touch: null };
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

    function step(quiet) {
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
            M.info[k] = NAMES[rnd(0, NAMES.length - 1)] + " · " + DEPTS[rnd(0, DEPTS.length - 1)];
            M.touch = { h: Math.floor((M.heap.length - 1) / c.B), s: Math.floor(pos / c.B), sTo: blocks(M.seq.length, c.B) - 1 };
            msg = "ENROL #" + k + " — " + M.info[k];
        } else if (kind === "sea") {
            var hit = Math.random() < 0.8;
            var key = hit ? M.heap[rnd(0, M.heap.length - 1)] : rnd(1, KEY_MAX);
            var idx = M.heap.indexOf(key);
            var bH = blocks(M.heap.length, c.B);
            h = idx >= 0 ? Math.floor(idx / c.B) + 1 : bH;
            s = lg(blocks(M.seq.length, c.B));
            M.touch = { h: idx >= 0 ? Math.floor(idx / c.B) : -1, s: idx >= 0 ? Math.floor(bsearchPos(M.seq, key) / c.B) : -1 };
            msg = "LOOK-UP #" + key + (idx >= 0 ? " — " + M.info[key] : " — not enrolled");
            if (idx < 0) M.counts.miss++;
        } else {
            var dk = M.heap[rnd(0, M.heap.length - 1)];
            var hi = M.heap.indexOf(dk), pi = bsearchPos(M.seq, dk);
            var bS = blocks(M.seq.length, c.B), sh = Math.max(0, bS - 1 - Math.floor(pi / c.B));
            h = Math.floor(hi / c.B) + 1 + 1;
            s = lg(bS) + 2 * sh;
            M.touch = { h: Math.floor(hi / c.B), s: Math.floor(pi / c.B), sTo: bS - 1 };
            msg = "WITHDRAW #" + dk + " — " + M.info[dk];
            M.heap.splice(hi, 1); M.seq.splice(pi, 1); delete M.info[dk];
        }
        M.counts[kind]++; M.cost[kind][0] += h; M.cost[kind][1] += s;
        M.hIO += h; M.sIO += s; M.ops++; M.tick++;
        M.series.push({ t: M.tick, h: M.hIO, s: M.sIO });
        if (M.series.length > 120) M.series.shift();
        M.log.unshift({ msg: msg, h: h, s: s, kind: kind });
        if (M.log.length > 12) M.log.pop();
        if (!quiet) paint();
    }

    // ---------------- Painting ----------------
    function strip(arr, B, cls, hot, hotTo) {
        var out = "", nb = Math.min(blocks(arr.length, B), 14);
        for (var i = 0; i < nb; i++) {
            var cnt = Math.min(B, Math.max(0, arr.length - i * B));
            var cells = "", keys = arr.slice(i * B, i * B + cnt);
            for (var j = 0; j < B; j++) cells += '<i class="' + (j < cnt ? "f " + cls : "e") + '"></i>';
            var isHot = hot >= 0 && i >= hot && i <= (hotTo === undefined ? hot : hotTo);
            out += '<div class="rt-blk' + (isHot ? " hot" : "") + '" title="Block ' + i + (keys.length ? ": " + keys.join(", ") : " (empty)") + '">' + cells + '</div>';
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
        var t = M.touch || { h: -1, s: -1 };
        $("rtHeapStrip").innerHTML = strip(M.heap, c.B, "h", t.h);
        $("rtSeqStrip").innerHTML = strip(M.seq, c.B, "s", t.s, t.sTo);
        $("rtAvg").innerHTML = M.ops ? "avg per op — heap <b>" + (M.hIO / M.ops).toFixed(1) + "</b> · sequential <b>" + (M.sIO / M.ops).toFixed(1) + "</b>" : "";
        $("rtBreak").innerHTML = [["ins", "Enrol (insert)"], ["sea", "Look-up (search)"], ["del", "Withdraw (delete)"]].map(function (k) {
            var n = M.counts[k[0]], hv = n ? M.cost[k[0]][0] / n : 0, sv = n ? M.cost[k[0]][1] / n : 0;
            var w = n ? (hv < sv ? "heap" : sv < hv ? "seq" : "") : "";
            return "<tr><td>" + k[1] + "</td><td>" + n + "</td><td" + (w === "heap" ? ' class="win"' : "") + ">" + (n ? hv.toFixed(1) : "—") + "</td><td" + (w === "seq" ? ' class="win"' : "") + ">" + (n ? sv.toFixed(1) : "—") + "</td></tr>";
        }).join("");
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

    function preset(key) {
        var sc = SCENARIOS[key];
        $("rtIns").value = sc.p[0]; $("rtSea").value = sc.p[1]; $("rtDel").value = sc.p[2]; labels();
        [].forEach.call(document.querySelectorAll(".rt-presets button"), function (b) { b.classList.toggle("on", b.getAttribute("data-s") === key); });
        $("rtWhy").textContent = sc.why;
    }

    function install() {
        // new page + nav button
        var main = document.querySelector(".main"); if (!main) return;
        var sec = document.createElement("section"); sec.className = "page"; sec.id = "live";
        sec.innerHTML =
            '<div class="page-intro"><span class="eyebrow">REAL-TIME SIMULATION</span><h2>Live Stream</h2>' +
            '<p>A simulated student-records desk: enrolments, look-ups and withdrawals arrive in real time and hit a Heap file and a Sequential file at once. Pick a scenario, press start, and watch which file does less disk work.</p></div>' +
            '<div class="rt-grid">' +
              '<div class="panel rt-controls"><span class="eyebrow">STREAM CONTROLS</span>' +
                '<div class="rt-btns"><button class="primary-btn" id="rtToggle">▶ Start stream</button><button class="secondary-btn" id="rtStep">Step once</button><button class="secondary-btn" id="rtBurst" title="Apply 20 operations instantly">⚡ Burst ×20</button><button class="secondary-btn" id="rtReset">Reset</button></div>' +
                '<label>Speed <b id="rtRateL"></b><input type="range" id="rtRate" min="1" max="20" value="4"></label>' +
                '<label>Records per block <b id="rtBL"></b><input type="range" id="rtB" min="2" max="8" value="4"></label>' +
                '<span class="eyebrow">SCENARIO</span><div class="rt-presets">' + Object.keys(SCENARIOS).map(function (k) { return '<button type="button" data-s="' + k + '">' + SCENARIOS[k].name + '</button>'; }).join("") + '</div>' +
                '<p class="rt-why" id="rtWhy"></p>' +
                '<label>Insert weight <b id="rtInsL"></b><input type="range" id="rtIns" min="0" max="100" value="40"></label>' +
                '<label>Search weight <b id="rtSeaL"></b><input type="range" id="rtSea" min="0" max="100" value="40"></label>' +
                '<label>Delete weight <b id="rtDelL"></b><input type="range" id="rtDel" min="0" max="100" value="20"></label>' +
              '</div>' +
              '<div class="rt-main">' +
                '<div class="rt-stats"><div class="panel"><small>HEAP I/O</small><b id="rtHIO" class="h">0</b></div><div class="panel"><small>SEQUENTIAL I/O</small><b id="rtSIO" class="s">0</b></div><div class="panel"><small>OPERATIONS</small><b id="rtOps">0</b></div><div class="panel"><small>N / BLOCKS</small><b><span id="rtN">0</span> / <span id="rtb">0</span></b></div></div>' +
                '<div class="panel"><div class="rt-head"><span class="eyebrow">CUMULATIVE BLOCK I/O</span><span id="rtVerdict" class="rt-verdict"></span></div>' +
                  '<svg id="rtChart" viewBox="0 0 600 220" class="rt-svg"></svg>' +
                  '<div class="rt-legend"><span><i class="h"></i> Heap</span><span><i class="s"></i> Sequential</span><small id="rtMix"></small></div><p class="rt-avg" id="rtAvg"></p></div>' +
                '<div class="panel"><span class="eyebrow">AVERAGE BLOCK I/O BY OPERATION</span><div class="ln-scroll"><table class="complexity-table rt-break"><thead><tr><th>Operation</th><th>Count</th><th>Heap</th><th>Sequential</th></tr></thead><tbody id="rtBreak"></tbody></table></div><small class="ln-note">Green = cheaper file for that operation. Hover a block below to see the keys it holds; the block each operation touched is highlighted.</small></div>' +
                '<div class="rt-two"><div class="panel"><span class="eyebrow">HEAP FILE BLOCKS</span><div class="rt-strip" id="rtHeapStrip"></div></div>' +
                '<div class="panel"><span class="eyebrow">SEQUENTIAL FILE BLOCKS</span><div class="rt-strip" id="rtSeqStrip"></div></div></div>' +
                '<div class="panel"><span class="eyebrow">LIVE FEED (block I/Os: H = heap, S = sequential)</span><ul class="rt-log" id="rtLog"></ul></div>' +
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
        $("rtBurst").addEventListener("click", function () { for (var i = 0; i < 20; i++) step(true); paint(); });
        document.addEventListener("visibilitychange", function () { if (document.hidden && timer) setRunning(false); });
        $("rtReset").addEventListener("click", function () { setRunning(false); M = fresh(); paint(); });
        $("rtRate").addEventListener("input", function () { labels(); if (timer) setRunning(true); });
        $("rtB").addEventListener("input", function () { labels(); paint(); });
        ["rtIns", "rtSea", "rtDel"].forEach(function (id) { $(id).addEventListener("input", function () {
            labels(); [].forEach.call(sec.querySelectorAll(".rt-presets button"), function (b) { b.classList.remove("on"); });
            $("rtWhy").textContent = "Custom mix — set your own weights.";
        }); });
        sec.querySelector(".rt-presets").addEventListener("click", function (e) {
            var b = e.target.closest("button[data-s]"); if (b) preset(b.getAttribute("data-s"));
        });
        preset("balanced");
    }
    document.addEventListener("DOMContentLoaded", install);
})();
