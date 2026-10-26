// FILEFORGE — Improved Help page
// Keeps your existing manual and adds on top of it:
//   • live search that filters the help panels
//   • "Take the tour" — a guided spotlight walkthrough of the app
//   • FAQ accordion, keyboard-shortcut table, "which page do I need?" finder
// Self-contained; reads the DOM that index.html already has.
(function () {
    "use strict";

    var FAQ = [
        ["Why does a heap search take so many more steps than binary search?", "A heap file has no order, so the only option is to look at records one by one (about N/2 on average). A sequential file is sorted, so each probe throws away half the remaining records: at most ⌊log₂N⌋ + 1 comparisons."],
        ["Then why would anyone use a heap file?", "Writes. Appending is 2 block I/Os no matter how big the file is, while keeping a sequential file sorted costs about b I/Os per insert. Logs and bulk loads favour heaps."],
        ["What does Dual Race Mode show?", "Both searches run in lock-step, one probe each per tick, so you can see the binary search finish while the heap scan is still near the start. A winner summary is printed at the end."],
        ["What are the [L], [MID], [R] badges?", "They are binary search's low, middle and high pointers. Records outside [low..high] are dimmed because they have been ruled out."],
        ["What changes when I move the block-capacity slider?", "Records per block. Fewer per block means more blocks (more I/O, less waste); more per block means fewer blocks and often more empty slots in the last block."],
        ["What is the packing factor?", "Used slots ÷ allocated slots × 100%. Ten records in blocks of four fill 10 of 12 slots: 83.3%."],
        ["My search finished instantly with no animation.", "Open the playback bar and press ▶ or ›. The search arms itself first; you drive it."],
        ["Can I use my own data?", "Yes: Import a JSON file with heap, sequential and blockSize keys, or generate a dataset. Professional sessions rename the fields (e.g. Device ID / Latency) but the file logic is identical."],
        ["Where is my data stored?", "Only in your browser's localStorage. Nothing is uploaded anywhere."],
        ["How do I change from Student to Professional?", "Click the ✎ pencil in the sidebar session badge and pick a different role."]
    ];

    var SHORTCUTS = [
        ["Enter (in a record field)", "Insert the record once all four fields are filled"],
        ["Space", "Play / pause the current search"],
        ["›  /  ‹ buttons", "Step forward / backward one probe"],
        ["◐ Toggle Theme", "Switch dark / light mode"],
        ["✎ in sidebar", "Change your session role or course"]
    ];

    var FINDER = [
        ["I want to try operations on records", "simulator", "Simulator"],
        ["I want charts of comparisons and I/O", "analytics", "Analytics"],
        ["I want to revisit what I ran earlier", "history", "History"],
        ["I need the theory or formulas", "learn", "Learn"],
        ["I want videos and articles", "teach", "Teach"],
        ["I want to test myself", "quiz", "Quiz Lab"],
        ["I want to watch a live write/read workload", "live", "Live Stream"]
    ];

    var TOUR = [
        { page: "dashboard", sel: '.nav-btn[data-page="dashboard"]', t: "Dashboard", d: "Start here: headline metrics and the animated Heap vs Sequential growth chart." },
        { page: "simulator", sel: '.nav-btn[data-page="simulator"]', t: "Simulator", d: "Insert, search and delete records. Pick a strategy, press Search, then drive the playback bar." },
        { page: "analytics", sel: '.nav-btn[data-page="analytics"]', t: "Analytics", d: "Charts of comparisons and block accesses for what you have run." },
        { page: "learn", sel: '.nav-btn[data-page="learn"]', t: "Learn", d: "Concepts, a formula calculator, worked examples and a glossary." },
        { page: "quiz", sel: '.nav-btn[data-page="quiz"]', t: "Quiz Lab", d: "Choose question count and difficulty; get a topic breakdown and review." },
        { page: "help", sel: '#themeBtn', t: "Theme & session", d: "Toggle dark/light here. The pencil under it changes your role and course." },
        { page: "help", sel: null, t: "You're set", d: "Open the Simulator and press ⟳ Generate Dataset to begin." }
    ];

    function $(id) { return document.getElementById(id); }
    function esc(t) { var d = document.createElement("div"); d.textContent = String(t); return d.innerHTML; }
    function go(page) {
        if (typeof window.navigate === "function") return window.navigate(page);
        var b = document.querySelector('.nav-btn[data-page="' + page + '"]'); if (b) b.click();
    }

    // ---------------- Tour ----------------
    var tour = { i: 0, el: null, tip: null };
    function endTour() {
        if (tour.el) tour.el.remove(); if (tour.tip) tour.tip.remove();
        document.querySelectorAll(".hp-spot").forEach(function (n) { n.classList.remove("hp-spot"); });
        tour.el = tour.tip = null;
    }
    function showStep() {
        var s = TOUR[tour.i];
        document.querySelectorAll(".hp-spot").forEach(function (n) { n.classList.remove("hp-spot"); });
        if (s.page && s.page !== "help") go(s.page);
        var target = s.sel ? document.querySelector(s.sel) : null;
        if (target) target.classList.add("hp-spot");
        var last = tour.i === TOUR.length - 1;
        tour.tip.innerHTML = '<small>STEP ' + (tour.i + 1) + ' / ' + TOUR.length + '</small><h4>' + esc(s.t) + '</h4><p>' + esc(s.d) + '</p>' +
            '<div class="hp-tour-btns"><button class="secondary-btn" id="hpSkip">' + (last ? "Close" : "Skip") + '</button>' +
            (tour.i > 0 ? '<button class="secondary-btn" id="hpPrev">Back</button>' : "") +
            (last ? "" : '<button class="primary-btn" id="hpNext">Next →</button>') + '</div>';
        var r = target ? target.getBoundingClientRect() : null;
        tour.tip.style.top = r ? Math.max(12, Math.min(window.innerHeight - 220, r.top)) + "px" : "30%";
        tour.tip.style.left = r ? Math.min(window.innerWidth - 340, r.right + 16) + "px" : "calc(50% - 160px)";
        $("hpSkip").onclick = endTour;
        if ($("hpPrev")) $("hpPrev").onclick = function () { tour.i--; showStep(); };
        if ($("hpNext")) $("hpNext").onclick = function () { tour.i++; showStep(); };
    }
    function startTour() {
        endTour();
        tour.i = 0;
        tour.el = document.createElement("div"); tour.el.className = "hp-tour-dim";
        tour.tip = document.createElement("div"); tour.tip.className = "hp-tour-tip panel";
        document.body.appendChild(tour.el); document.body.appendChild(tour.tip);
        tour.el.addEventListener("click", endTour);
        showStep();
    }

    // ---------------- Page enhancement ----------------
    function install() {
        var help = $("help"); if (!help) return;

        // 1. search + tour header, inserted after the existing page title block
        var head = help.querySelector(".learn-header");
        var bar = document.createElement("div");
        bar.className = "hp-bar";
        bar.innerHTML = '<input type="search" id="hpSearch" placeholder="Search the manual (e.g. “block”, “race”, “import”)…">' +
            '<button class="primary-btn" id="hpTourBtn">▶ Take the tour</button>';
        if (head && head.nextSibling) head.parentNode.insertBefore(bar, head.nextSibling); else help.insertBefore(bar, help.firstChild);

        // 2. finder + FAQ + shortcuts appended
        var extra = document.createElement("div");
        extra.innerHTML =
            '<div class="panel help-panel hp-find"><span class="eyebrow">WHICH PAGE DO I NEED?</span><h3>Jump straight there</h3><div class="hp-find-grid">' +
            FINDER.map(function (f) { return '<button type="button" class="hp-find-btn" data-go="' + f[1] + '"><span>' + esc(f[0]) + '</span><b>' + esc(f[2]) + ' →</b></button>'; }).join("") + '</div></div>' +
            '<div class="panel help-panel"><span class="eyebrow">KEYBOARD &amp; CONTROLS</span><h3>Shortcuts</h3><table class="complexity-table help-table"><thead><tr><th>Control</th><th>What it does</th></tr></thead><tbody>' +
            SHORTCUTS.map(function (s) { return "<tr><td>" + esc(s[0]) + "</td><td>" + esc(s[1]) + "</td></tr>"; }).join("") + '</tbody></table></div>' +
            '<div class="panel help-panel hp-faq"><span class="eyebrow">FAQ</span><h3>Frequently asked questions</h3>' +
            FAQ.map(function (f) { return '<details><summary>' + esc(f[0]) + '</summary><p>' + esc(f[1]) + '</p></details>'; }).join("") + '</div>' +
            '<p class="hp-empty" id="hpEmpty" hidden>Nothing in the manual matches that search.</p>';
        help.appendChild(extra);

        help.addEventListener("click", function (e) {
            var g = e.target.closest("[data-go]"); if (g) go(g.getAttribute("data-go"));
        });
        $("hpTourBtn").addEventListener("click", startTour);

        // 3. search filter over panels
        $("hpSearch").addEventListener("input", function () {
            var q = this.value.trim().toLowerCase(), shown = 0;
            var blocks = help.querySelectorAll(".help-panel, .dashboard-columns");
            blocks.forEach(function (b) {
                if (b.classList.contains("dashboard-columns")) return;
                var hit = !q || b.textContent.toLowerCase().indexOf(q) >= 0;
                b.style.display = hit ? "" : "none"; if (hit) shown++;
                if (q && hit) b.querySelectorAll("details").forEach(function (d) { d.open = d.textContent.toLowerCase().indexOf(q) >= 0; });
            });
            help.querySelectorAll(".dashboard-columns").forEach(function (c) {
                var any = [].some.call(c.children, function (k) { return k.style.display !== "none"; });
                c.style.display = any ? "" : "none";
            });
            $("hpEmpty").hidden = !(q && shown === 0);
        });

        // 4. fix the stale "Quiz" line in the manual
        help.querySelectorAll(".help-list li").forEach(function (li) {
            if (/^\s*Quiz\b/.test(li.textContent)) li.innerHTML = "<b>Quiz Lab</b> — choose question count, difficulty and source (bank, live data or AI); get a topic breakdown and review.";
            if (/^\s*Learn\b/.test(li.textContent)) li.innerHTML = "<b>Learn</b> — concepts, formula calculator, worked examples, compare table and glossary.";
        });
    }
    document.addEventListener("DOMContentLoaded", install);
})();
