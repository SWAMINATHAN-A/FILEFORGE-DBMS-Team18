// FILEFORGE — Expanded Learn tab
// Replaces the 9 static cards with: Concepts (expandable, with progress and
// "try it" shortcuts), Formula Lab (live calculator), Worked Examples,
// Compare table, and Glossary — all searchable. Self-contained.
(function () {
    "use strict";

    var PROG_KEY = "fileforgeLearnProgress";
    var root, state = { tab: "concepts", q: "" };

    function $(id) { return document.getElementById(id); }
    function esc(t) { var d = document.createElement("div"); d.textContent = String(t); return d.innerHTML; }
    function go(page) {
        if (typeof window.navigate === "function") return window.navigate(page);
        var btn = document.querySelector('.nav-btn[data-page="' + page + '"]'); if (btn) btn.click();
    }
    function prog() { try { return JSON.parse(localStorage.getItem(PROG_KEY) || "{}"); } catch (e) { return {}; } }
    function saveProg(p) { try { localStorage.setItem(PROG_KEY, JSON.stringify(p)); } catch (e) {} }

    // ---------------- Content ----------------
    var CONCEPTS = [
        { id: "fo", n: "01", t: "File Organization", s: "How records are laid out on disk",
          body: "<p>File organization is the way records are arranged in blocks of secondary storage. The choice decides how cheap inserts, lookups, deletes and range scans are.</p><ul><li><b>Heap</b> — records in arrival order.</li><li><b>Sequential</b> — records sorted by a key.</li><li><b>Hashed</b> — position computed from the key.</li><li><b>Indexed</b> — a separate structure points into the data.</li></ul>", tryit: "simulator" },
        { id: "heap", n: "02", t: "Heap Files", s: "Fast writes, slow lookups",
          body: "<p>New records are appended to the last block, so insertion costs <b>2 I/Os</b> (read last block, write it back). Finding a record means scanning: <b>b/2</b> blocks on average, <b>b</b> if absent.</p><p><b>Use when:</b> logging, audit trails, bulk loading, full-table scans.</p>", tryit: "simulator" },
        { id: "seq", n: "03", t: "Sequential Files", s: "Sorted by key, binary-searchable",
          body: "<p>Records are kept in key order. Search can use binary search: <b>⌊log₂N⌋ + 1</b> comparisons and <b>⌈log₂ b⌉</b> block accesses. Inserts must keep order, so later records shift: about <b>b</b> I/Os.</p><p><b>Use when:</b> read-heavy workloads, ordered reports, range queries.</p>", tryit: "simulator" },
        { id: "blk", n: "04", t: "Disk Blocks & Blocking Factor", s: "The unit of transfer",
          body: "<p>The disk moves whole blocks. Blocking factor <b>bf = ⌊block size / record size⌋</b>; blocks needed <b>b = ⌈N / bf⌉</b>. The slider in the Simulator sets records per block directly.</p>", tryit: "simulator" },
        { id: "frag", n: "05", t: "Internal Fragmentation", s: "Wasted space inside blocks",
          body: "<p>Empty slots in allocated blocks are wasted. <b>Wasted = b×B − N</b>. <b>Packing factor = N / (b×B) × 100%</b>. Example: 10 records, B = 4 → 3 blocks, 2 wasted slots, 83.3%.</p>", tryit: "simulator" },
        { id: "search", n: "06", t: "Searching", s: "Linear vs binary",
          body: "<p>Linear scan checks records one by one (O(N)). Binary search compares the middle record and discards half each time (O(log₂N)). It only works when records are sorted <i>and</i> you can jump to the middle.</p>", tryit: "simulator" },
        { id: "ins", n: "07", t: "Insertion", s: "O(1) vs O(N)",
          body: "<p>Heap: append, constant cost. Sequential: find the spot, shift later records. Databases soften this with overflow areas and periodic merge/reorganization.</p>", tryit: "simulator" },
        { id: "del", n: "08", t: "Deletion", s: "Tombstones and compaction",
          body: "<p>Deleting means finding the record first (b/2 for heap), then either marking a <b>tombstone</b> or moving the last record into the hole. Sequential files must close the gap to stay contiguous.</p>", tryit: "simulator" },
        { id: "idx", n: "09", t: "Indexes (next step)", s: "Getting the best of both",
          body: "<p>A <b>sparse primary index</b> on a sorted file has one entry per block; a <b>dense secondary index</b> has one per record. A <b>B+ tree</b> is a dynamic multi-level index with linked leaves for range scans. Real systems layer these on top of heap or sequential storage.</p>" },
        { id: "real", n: "10", t: "Real Applications", s: "Where each one shows up",
          body: "<ul><li><b>Heap-like:</b> transaction logs, event streams, audit tables.</li><li><b>Sequential-like:</b> ordered ledgers, batch master files, sorted exports.</li><li><b>Mixed:</b> most RDBMS tables = heap + B+ tree indexes.</li></ul>", tryit: "dashboard" }
    ];

    var EXAMPLES = [
        { t: "Blocks and fragmentation", steps: ["N = 10 records, B = 4 per block.", "b = ⌈10/4⌉ = 3 blocks.", "Total slots = 3 × 4 = 12, wasted = 12 − 10 = 2.", "Packing factor = 10/12 = 83.3%."] },
        { t: "Binary search on N = 12", steps: ["Comparisons ≤ ⌊log₂12⌋ + 1 = 3 + 1 = 4.", "Sorted keys: 101 103 105 106 108 109 114 115 118 120 122 128. Search 115.", "low=0, high=11 → mid=5 (109) < 115 → low=6.", "low=6, high=11 → mid=8 (118) > 115 → high=7.", "low=6, high=7 → mid=6 (114) < 115 → low=7.", "low=7, high=7 → mid=7 (115) found. 4 probes."] },
        { t: "Heap vs sequential I/O at b = 3000", steps: ["Heap search average = b/2 = 1500 blocks.", "Sequential binary search = ⌈log₂3000⌉ = 12 blocks.", "Heap insert = 2 I/Os; sequential insert ≈ b = 3000 I/Os.", "Read-heavy → sequential wins by ~125×; write-heavy → heap wins by ~1500×."] },
        { t: "Index size", steps: ["Entry = 15 B, block = 1024 B → 68 entries per block.", "Sparse index over 3000 data blocks → ⌈3000/68⌉ = 45 index blocks.", "Binary search the index: ⌈log₂45⌉ = 6, +1 data block = 7 accesses.", "Two-level index: 45 entries fit in 1 block → 2 index levels + 1 data = 3 accesses."] }
    ];

    var COMPARE = [
        ["Insert", "O(1), 2 block I/Os", "O(N), ≈ b I/Os (shift)"],
        ["Search by key", "O(N), b/2 avg blocks", "O(log₂N), ⌈log₂b⌉ blocks"],
        ["Search, key absent", "all b blocks", "⌈log₂b⌉ blocks"],
        ["Delete", "b/2 + 1 (tombstone)", "search + shift ≈ b"],
        ["Range query", "full scan", "locate start, then contiguous blocks"],
        ["Ordered output", "needs a sort", "already sorted"],
        ["Space use", "gaps after deletes until compaction", "dense if reorganized"],
        ["Best for", "logging, bulk load, full scans", "lookups, ranges, reports"]
    ];

    var GLOSSARY = [
        ["Block / page", "Smallest unit moved between disk and memory."],
        ["Blocking factor (bf, B)", "Records that fit in one block."],
        ["Primary key", "Unique attribute; the ordering field in a sequential file."],
        ["Heap (pile) file", "Unordered file; new records go at the end."],
        ["Sequential file", "File kept sorted on the ordering key."],
        ["Binary search", "Halve the sorted range each probe: ⌊log₂N⌋+1 comparisons."],
        ["Internal fragmentation", "Unused slots inside allocated blocks."],
        ["Packing factor", "Used slots ÷ allocated slots."],
        ["Tombstone", "Marker that a record was deleted without moving data."],
        ["Overflow area", "Side file for inserts, merged later."],
        ["Dense index", "One index entry per record."],
        ["Sparse index", "One index entry per block."],
        ["Clustering index", "Index on the field the file is physically ordered by."],
        ["B+ tree", "Balanced multi-level index; data pointers only in linked leaves."],
        ["Seek time", "Time to move the disk arm to the right track."],
        ["Rotational latency", "Wait for the sector to spin under the head (avg = ½ rotation)."],
        ["Spanned record", "Record allowed to cross a block boundary."],
        ["I/O cost", "Block transfers performed; the main metric in DBMS."]
    ];

    // ---------------- Views ----------------
    function matches(text) { return !state.q || text.toLowerCase().indexOf(state.q.toLowerCase()) >= 0; }

    function conceptsView() {
        var p = prog();
        var list = CONCEPTS.filter(function (c) { return matches(c.t + " " + c.s + " " + c.body.replace(/<[^>]+>/g, " ")); });
        if (!list.length) return '<p class="ln-empty">No concept matches “' + esc(state.q) + '”.</p>';
        return '<div class="ln-list">' + list.map(function (c) {
            return '<details class="panel ln-card" data-id="' + c.id + '"><summary><span class="ln-num">' + c.n + '</span><div><h3>' + c.t + '</h3><small>' + c.s + '</small></div>' +
                (p[c.id] ? '<span class="ln-done">✓ understood</span>' : "") + '</summary><div class="ln-body">' + c.body +
                '<div class="ln-actions"><button class="secondary-btn" data-done="' + c.id + '">' + (p[c.id] ? "Unmark" : "Mark as understood") + '</button>' +
                (c.tryit ? '<button class="top-btn" data-go="' + c.tryit + '">Try it in ' + (c.tryit === "simulator" ? "the Simulator" : "the Dashboard") + ' →</button>' : "") +
                '</div></div></details>';
        }).join("") + '</div>';
    }

    function formulaView() {
        return '<div class="panel ln-lab"><span class="eyebrow">FORMULA LAB</span><h3>Type N and B, see every cost</h3>' +
            '<div class="ln-inputs"><label>Records N <input type="number" id="lnN" min="1" value="12"></label>' +
            '<label>Records per block B <input type="number" id="lnB" min="1" value="3"></label></div>' +
            '<div class="ln-results" id="lnRes"></div>' +
            '<small class="ln-note">Uses the same cost model as the Simulator (average heap = b/2 blocks, binary search = ⌈log₂b⌉, sequential insert ≈ b).</small></div>';
    }
    function calc() {
        var N = Math.max(1, parseInt($("lnN").value, 10) || 1), B = Math.max(1, parseInt($("lnB").value, 10) || 1);
        var b = Math.ceil(N / B), tot = b * B;
        var rows = [
            ["Blocks b = ⌈N/B⌉", b],
            ["Allocated slots b×B", tot],
            ["Wasted slots (fragmentation)", tot - N],
            ["Packing factor", (100 * N / tot).toFixed(1) + "%"],
            ["Heap search, avg comparisons N/2", (N / 2).toFixed(1)],
            ["Binary search, max comparisons ⌊log₂N⌋+1", Math.floor(Math.log2(N)) + 1],
            ["Heap search, avg blocks b/2", (b / 2).toFixed(1)],
            ["Binary search, blocks ⌈log₂b⌉ (min 1)", Math.max(1, Math.ceil(Math.log2(b)))],
            ["Heap insert I/Os", 2],
            ["Sequential insert I/Os ≈ b", b]
        ];
        $("lnRes").innerHTML = rows.map(function (r) { return '<div class="ln-res"><span>' + r[0] + '</span><b>' + r[1] + '</b></div>'; }).join("");
    }

    function examplesView() {
        var list = EXAMPLES.filter(function (e) { return matches(e.t + " " + e.steps.join(" ")); });
        if (!list.length) return '<p class="ln-empty">No example matches.</p>';
        return '<div class="ln-list">' + list.map(function (e) {
            return '<div class="panel ln-card static"><h3>' + e.t + '</h3><ol class="help-steps">' + e.steps.map(function (s) { return "<li>" + esc(s) + "</li>"; }).join("") + '</ol></div>';
        }).join("") + '</div>';
    }

    function compareView() {
        return '<div class="panel"><table class="complexity-table help-table"><thead><tr><th>Operation</th><th>Heap file</th><th>Sequential file</th></tr></thead><tbody>' +
            COMPARE.filter(function (r) { return matches(r.join(" ")); }).map(function (r) { return "<tr><td>" + r[0] + "</td><td>" + r[1] + "</td><td>" + r[2] + "</td></tr>"; }).join("") +
            '</tbody></table></div>';
    }

    function glossaryView() {
        var list = GLOSSARY.filter(function (g) { return matches(g.join(" ")); });
        if (!list.length) return '<p class="ln-empty">No term matches.</p>';
        return '<div class="ln-gloss">' + list.map(function (g) { return '<div class="panel"><b>' + g[0] + '</b><p>' + g[1] + '</p></div>'; }).join("") + '</div>';
    }

    var TABS = [["concepts", "Concepts"], ["formulas", "Formula Lab"], ["examples", "Worked Examples"], ["compare", "Compare"], ["glossary", "Glossary"]];

    function render() {
        var p = prog(), done = CONCEPTS.filter(function (c) { return p[c.id]; }).length;
        var body = { concepts: conceptsView, formulas: formulaView, examples: examplesView, compare: compareView, glossary: glossaryView }[state.tab]();
        root.innerHTML =
            '<div class="learn-header"><span class="status-badge">DBMS CONCEPT LAB</span><h2>Learn the storage model</h2>' +
            '<p>Concepts, formulas, worked examples and a glossary — then try it in the Simulator or test yourself in Quiz Lab.</p></div>' +
            '<div class="ln-top"><div class="ln-tabs">' + TABS.map(function (t) { return '<button type="button" data-tab="' + t[0] + '"' + (t[0] === state.tab ? ' class="on"' : "") + ">" + t[1] + "</button>"; }).join("") + '</div>' +
            (state.tab !== "formulas" ? '<input type="search" id="lnSearch" placeholder="Search…" value="' + esc(state.q) + '">' : "") + '</div>' +
            '<div class="ln-progress"><div><i style="width:' + (100 * done / CONCEPTS.length) + '%"></i></div><small>' + done + ' of ' + CONCEPTS.length + ' concepts marked understood</small></div>' +
            body +
            '<div class="ln-cta panel"><div><b>Ready to test yourself?</b><small>Pick the number of questions and difficulty.</small></div><button class="primary-btn" data-go="quiz">Open Quiz Lab →</button></div>';

        if (state.tab === "formulas") { calc(); $("lnN").oninput = calc; $("lnB").oninput = calc; }
        var s = $("lnSearch");
        if (s) s.addEventListener("input", function () { state.q = s.value; var pos = s.selectionStart; render(); var s2 = $("lnSearch"); s2.focus(); s2.setSelectionRange(pos, pos); });
    }

    function install() {
        root = $("learn"); if (!root) return;
        root.addEventListener("click", function (e) {
            var t = e.target.closest("[data-tab]");
            if (t) { state.tab = t.getAttribute("data-tab"); state.q = ""; render(); return; }
            var g = e.target.closest("[data-go]"); if (g) { go(g.getAttribute("data-go")); return; }
            var d = e.target.closest("[data-done]");
            if (d) {
                e.preventDefault();
                var open = [].map.call(root.querySelectorAll("details[open]"), function (x) { return x.getAttribute("data-id"); });
                var p = prog(), id = d.getAttribute("data-done"); p[id] = !p[id]; saveProg(p); render();
                open.forEach(function (i) { var el = root.querySelector('details[data-id="' + i + '"]'); if (el) el.open = true; });
            }
        });
        render();
    }
    document.addEventListener("DOMContentLoaded", install);
})();
