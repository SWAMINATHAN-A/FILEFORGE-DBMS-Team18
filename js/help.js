// FILEFORGE — Help page
// Keeps the hand-written manual in index.html and adds on top of it:
//   • live search that filters the help panels
//   • "Take the tour" — a guided spotlight walkthrough of the app
//   • a getting-started checklist (saved in the browser)
//   • FAQ accordion, keyboard-shortcut table, "which page do I need?" finder
//   • a feedback / bug-report link
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
        ["Where is my data stored?", "Only in your browser's localStorage. Nothing is uploaded anywhere — uploaded PDFs are read inside the browser too."],
        ["Does the AI quiz need an API key?", "No. Quiz Lab → ✨ AI generated asks a free, key-less AI service (Pollinations) to write questions for the count and difficulty you pick. Every question is format-checked before it's shown. If the service is busy or you're offline, the quiz starts with questions from the built-in bank instead."],
        ["Are the GATE questions real?", "Yes — 50 GATE CSE questions from 1994 to 2026 (file structures & indexing, normalization, transactions). They're re-worded for the app but keep the original numbers, so the official answer holds. Each one shows its paper and marks and links to the original."],
        ["Can I be quizzed on my own notes?", "Yes. Quiz Lab → 📄 From your PDF / DOC. Upload a PDF, DOCX or TXT (up to 25 MB); fill-in-the-blank and true/false questions are built from its sentences, with page numbers in the explanations. Scanned PDFs (images only) can't be read."],
        ["Can I upload a question paper with an answer key?", "Yes. If the file has numbered questions with A–D options and an answer key at the end (\"1. B\", \"2. C\" …) or \"Answer: B\" under each question, Quiz Lab asks those exact questions and marks them with your key. Questions with no answer or duplicate options are skipped and counted. Try the sample question paper button in Quiz Lab."],
        ["Why didn't the AI quiz give me 30 questions?", "AI quizzes are capped at 20 questions per request so they come back quickly and complete. Run another quiz for more."],
        ["Does it work offline?", "Everything except the AI quiz and reading PDF/DOCX files (those load a small library from the internet the first time) works offline — just open index.html."],
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
        ["I want real GATE previous-year questions", "quiz:pyq", "GATE questions"],
        ["I want a quiz from my own notes / PDF", "quiz:doc", "Quiz from a PDF"],
        ["I want formulas and a GATE calculator", "learn", "Learn → Formula Lab"],
        ["I want to watch a live write/read workload", "live", "Live Stream"],
        ["Who built this?", "about", "Developed By"]
    ];

    var TOUR = [
        { page: "dashboard", sel: '.nav-btn[data-page="dashboard"]', t: "Dashboard", d: "Start here: headline metrics and the animated Heap vs Sequential growth chart." },
        { page: "simulator", sel: '.nav-btn[data-page="simulator"]', t: "Simulator", d: "Insert, search and delete records. Pick a strategy, press Search, then drive the playback bar." },
        { page: "analytics", sel: '.nav-btn[data-page="analytics"]', t: "Analytics", d: "Charts of comparisons and block accesses for what you have run." },
        { page: "live", sel: '.nav-btn[data-page="live"]', t: "Live Stream", d: "A real-time records desk: enrolments, look-ups and withdrawals stream in and you watch block I/O add up for both files." },
        { page: "learn", sel: '.nav-btn[data-page="learn"]', t: "Learn", d: "Concepts with quick checks, a search visualizer, GATE calculators, solved examples and a printable cheat sheet." },
        { page: "quiz", sel: '.nav-btn[data-page="quiz"]', t: "Quiz Lab", d: "Question bank, 50 real GATE questions, AI-written quizzes (no key needed) or a quiz from your own PDF. Pick count and difficulty." },
        { page: "about", sel: '.nav-btn[data-page="about"]', t: "Developed By", d: "The team behind FILEFORGE and the course details." },
        { page: "help", sel: '#themeBtn', t: "Theme & session", d: "Toggle dark/light here. The pencil under it changes your role and course." },
        { page: "help", sel: null, t: "You're set", d: "Open the Simulator and press ⟳ Generate Dataset to begin." }
    ];

    function $(id) { return document.getElementById(id); }
    function esc(t) { var d = document.createElement("div"); d.textContent = String(t); return d.innerHTML; }
    var CHECK_KEY = "fileforgeHelpChecklist";
    var CHECKLIST = [
        ["sim", "Generate a dataset and run a Binary Search", "simulator"],
        ["race", "Watch Dual Race Mode (Simulator → Search strategy)", "simulator"],
        ["live", "Start the Live Stream on “Results day”", "live"],
        ["learn", "Open Learn → Visualize and step through a search", "learn"],
        ["gate", "Answer a GATE previous-year quiz", "quiz:pyq"],
        ["ai", "Try an AI-generated quiz", "quiz:ai"]
    ];
    function checks() { try { return JSON.parse(localStorage.getItem(CHECK_KEY) || "{}"); } catch (e) { return {}; } }
    function go(page) {
        var m = /^quiz:(\w+)$/.exec(page);
        if (m) { if (window.FFQuizLab && window.FFQuizLab.preset) window.FFQuizLab.preset({ source: m[1] }); page = "quiz"; }
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
        var start = document.createElement("div");
        start.className = "panel help-panel hp-check";
        function paintChecks() {
            var c = checks(), done = CHECKLIST.filter(function (x) { return c[x[0]]; }).length;
            start.innerHTML = '<div class="hp-check-head"><div><span class="eyebrow">GETTING STARTED</span><h3>Six things to try (' + done + '/' + CHECKLIST.length + ')</h3></div>' +
                '<div class="ln-progress hp-check-bar"><div><i style="width:' + (100 * done / CHECKLIST.length) + '%"></i></div></div></div><ul class="hp-check-list">' +
                CHECKLIST.map(function (x) {
                    return '<li class="' + (c[x[0]] ? "done" : "") + '"><label><input type="checkbox" data-check="' + x[0] + '"' + (c[x[0]] ? " checked" : "") + '> ' + esc(x[1]) + '</label><button type="button" class="text-btn" data-go="' + x[2] + '" data-mark="' + x[0] + '">Go →</button></li>';
                }).join("") + '</ul>';
        }
        start.addEventListener("change", function (e) {
            var k = e.target.getAttribute("data-check"); if (!k) return;
            var c = checks(); c[k] = e.target.checked; try { localStorage.setItem(CHECK_KEY, JSON.stringify(c)); } catch (x) {} paintChecks();
        });
        paintChecks();
        if (bar.nextSibling) help.insertBefore(start, bar.nextSibling); else help.appendChild(start);

        var extra = document.createElement("div");
        extra.innerHTML =
            '<div class="panel help-panel hp-find"><span class="eyebrow">WHICH PAGE DO I NEED?</span><h3>Jump straight there</h3><div class="hp-find-grid">' +
            FINDER.map(function (f) { return '<button type="button" class="hp-find-btn" data-go="' + f[1] + '"><span>' + esc(f[0]) + '</span><b>' + esc(f[2]) + ' →</b></button>'; }).join("") + '</div></div>' +
            '<div class="panel help-panel"><span class="eyebrow">KEYBOARD &amp; CONTROLS</span><h3>Shortcuts</h3><table class="complexity-table help-table"><thead><tr><th>Control</th><th>What it does</th></tr></thead><tbody>' +
            SHORTCUTS.map(function (s) { return "<tr><td>" + esc(s[0]) + "</td><td>" + esc(s[1]) + "</td></tr>"; }).join("") + '</tbody></table></div>' +
            '<div class="panel help-panel hp-faq"><span class="eyebrow">FAQ</span><h3>Frequently asked questions</h3>' +
            FAQ.map(function (f) { return '<details><summary>' + esc(f[0]) + '</summary><p>' + esc(f[1]) + '</p></details>'; }).join("") + '</div>' +
            '<div class="panel help-panel hp-feedback"><span class="eyebrow">FEEDBACK</span><h3>Found a bug or have an idea?</h3>' +
            '<p>Open an issue on the project\'s GitHub page — include what you clicked and what you expected to happen.</p>' +
            '<a class="primary-btn" href="https://github.com/dnvdevx/DBMS_Project/issues" target="_blank" rel="noopener">Report on GitHub ↗</a></div>' +
            '<p class="hp-empty" id="hpEmpty" hidden>Nothing in the manual matches that search.</p>';
        help.appendChild(extra);

        help.addEventListener("click", function (e) {
            var g = e.target.closest("[data-go]"); if (!g) return;
            var mk = g.getAttribute("data-mark");
            if (mk) { var c = checks(); c[mk] = true; try { localStorage.setItem(CHECK_KEY, JSON.stringify(c)); } catch (x) {} paintChecks(); }
            go(g.getAttribute("data-go"));
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

    }
    document.addEventListener("DOMContentLoaded", install);
})();
