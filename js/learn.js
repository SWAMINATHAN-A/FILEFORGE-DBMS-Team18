// FILEFORGE — Learn tab
// Tabs: Concepts (expandable, progress, quick-check question, GATE practice
// links), Visualize (linear vs binary search, step by step), Formula Lab
// (N/B calculator + GATE index & B+ tree calculator), Worked Examples (incl.
// solved GATE questions), Compare, Glossary and a printable Cheat Sheet.
// Self-contained; uses window.FFQuizLab.preset() to jump into practice.
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
    function pyqYears(topic) {
        var ys = (window.FF_PYQ || []).filter(function (q) { return q.topic === topic; }).map(function (q) { return q.year; });
        ys = ys.filter(function (y, i) { return ys.indexOf(y) === i; }).sort();
        return ys;
    }

    // ---------------- Content ----------------
    var CONCEPTS = [
        { id: "fo", n: "01", t: "File Organization", s: "How records are laid out on disk",
          body: "<p>File organization is the way records are arranged in blocks of secondary storage. The choice decides how cheap inserts, lookups, deletes and range scans are.</p><ul><li><b>Heap</b> — records in arrival order.</li><li><b>Sequential</b> — records sorted by a key.</li><li><b>Hashed</b> — position computed from the key.</li><li><b>Indexed</b> — a separate structure points into the data.</li></ul>",
          tryit: "simulator", pyq: "File Organization",
          check: { q: "Which organization computes a record's location directly from its key?", opts: ["Hashed", "Heap", "Sequential", "Clustered"], a: 0, exp: "A hash function maps the key to a bucket address." } },
        { id: "heap", n: "02", t: "Heap Files", s: "Fast writes, slow lookups",
          body: "<p>New records are appended to the last block, so insertion costs <b>2 I/Os</b> (read last block, write it back). Finding a record means scanning: <b>b/2</b> blocks on average, <b>b</b> if absent.</p><p><b>Use when:</b> logging, audit trails, bulk loading, full-table scans.</p>",
          tryit: "simulator",
          check: { q: "With space in the last block, a heap insert costs how many block I/Os?", opts: ["2", "1", "b/2", "⌈log₂ b⌉"], a: 0, exp: "Read the last block, add the record, write it back." } },
        { id: "seq", n: "03", t: "Sequential Files", s: "Sorted by key, binary-searchable",
          body: "<p>Records are kept in key order. Search can use binary search: <b>⌊log₂N⌋ + 1</b> comparisons and <b>⌈log₂ b⌉</b> block accesses. Inserts must keep order, so later records shift: about <b>b</b> I/Os.</p><p><b>Use when:</b> read-heavy workloads, ordered reports, range queries.</p>",
          tryit: "simulator",
          check: { q: "Binary search on a sequential file of b blocks reads about how many blocks?", opts: ["⌈log₂ b⌉", "b/2", "b", "1"], a: 0, exp: "Each probe halves the remaining blocks." } },
        { id: "blk", n: "04", t: "Disk Blocks & Blocking Factor", s: "The unit of transfer",
          body: "<p>The disk moves whole blocks. Blocking factor <b>bf = ⌊block size / record size⌋</b> (unspanned); blocks needed <b>b = ⌈N / bf⌉</b>. With <b>spanned</b> records a record may cross a block boundary, so no space is wasted but some records need two reads.</p>",
          tryit: "simulator", pyq: "Blocking & I/O",
          check: { q: "Block = 4096 B, record = 100 B, unspanned. What is the blocking factor?", opts: ["40", "41", "40.96", "39"], a: 0, exp: "⌊4096/100⌋ = 40 — always floor for unspanned records." } },
        { id: "frag", n: "05", t: "Internal Fragmentation", s: "Wasted space inside blocks",
          body: "<p>Empty slots in allocated blocks are wasted. <b>Wasted = b×B − N</b>. <b>Packing factor = N / (b×B) × 100%</b>. Example: 10 records, B = 4 → 3 blocks, 2 wasted slots, 83.3%.</p>",
          tryit: "simulator",
          check: { q: "N = 10 records, B = 4 per block. How many slots are wasted?", opts: ["2", "0", "4", "1"], a: 0, exp: "3 blocks × 4 = 12 slots − 10 records = 2." } },
        { id: "search", n: "06", t: "Searching", s: "Linear vs binary",
          body: "<p>Linear scan checks records one by one (O(N)). Binary search compares the middle record and discards half each time (O(log₂N)). It only works when records are sorted <i>and</i> you can jump to the middle. See it step by step in the <b>Visualize</b> tab.</p>",
          tryit: "simulator",
          check: { q: "Binary search requires that…", opts: ["records are sorted on the search key", "records are in insertion order", "a hash function exists", "the file has at least 1000 records"], a: 0, exp: "Without order you can't discard half the file after a comparison." } },
        { id: "ins", n: "07", t: "Insertion", s: "O(1) vs O(N)",
          body: "<p>Heap: append, constant cost. Sequential: find the spot, shift later records. Databases soften this with overflow areas and periodic merge/reorganization.</p>",
          tryit: "simulator",
          check: { q: "Why is insertion O(N) in a sequential file?", opts: ["Later records shift to keep key order", "The file must be rehashed", "Every block is read twice", "All indexes are rebuilt"], a: 0, exp: "Keeping order means moving everything after the insert point." } },
        { id: "del", n: "08", t: "Deletion", s: "Tombstones and compaction",
          body: "<p>Deleting means finding the record first (b/2 for heap), then either marking a <b>tombstone</b> or moving the last record into the hole. Sequential files must close the gap to stay contiguous.</p>",
          tryit: "simulator",
          check: { q: "A tombstone is…", opts: ["a marker that a slot's record was deleted", "the last record of the file", "an overflow block", "a sparse index entry"], a: 0, exp: "It lets you delete without moving other records; space is reclaimed later." } },
        { id: "idx", n: "09", t: "Index Types", s: "Primary, clustering, secondary",
          body: "<ul><li><b>Primary index</b> — on the ordering <i>key</i> field of a sorted file; one entry per block (<b>sparse</b>).</li><li><b>Clustering index</b> — on an ordering <i>non-key</i> field; one entry per distinct value.</li><li><b>Secondary index</b> — on a non-ordering field; one entry per record (<b>dense</b>).</li></ul><p>A file has at most one primary <i>or</i> clustering index (it can only be sorted one way) but any number of secondary indexes. Index entry = key + pointer.</p>",
          pyq: "Indexing",
          check: { q: "An index with one entry per data block of a file sorted on its key is a…", opts: ["Primary (sparse) index", "Dense secondary index", "Clustering index", "Hash index"], a: 0, exp: "The block's first key (anchor) is enough because the file is sorted on that key." } },
        { id: "ml", n: "10", t: "Multi-level Indexes", s: "Index the index",
          body: "<p>An index is itself a sorted file, so you can build a sparse index on it. With fan-out <b>fo = ⌊block / entry size⌋</b>, each level is <b>fo</b> times smaller. Levels ≈ <b>⌈log<sub>fo</sub>(entries)⌉</b>, and a lookup costs <b>levels + 1</b> block reads. Try the GATE calculator in <b>Formula Lab</b>.</p>",
          pyq: "Indexing",
          check: { q: "Fan-out 64 and 10,000 first-level index entries. How many index levels?", opts: ["3", "2", "4", "157"], a: 0, exp: "10,000/64 → 157 blocks, 157/64 → 3 blocks, 3/64 → 1 block: three levels." } },
        { id: "bpt", n: "11", t: "B+ Trees", s: "The index every RDBMS uses",
          body: "<p>A balanced, multi-level index that grows by splitting. Internal nodes hold keys and child pointers; <b>only leaves point to records</b>, and leaves are linked for range scans.</p><ul><li>Internal order p: <b>p·P<sub>block</sub> + (p−1)·K ≤ block size</b></li><li>Leaf order n: <b>n·(K + P<sub>record</sub>) + P<sub>block</sub> ≤ block size</b></li><li>Every node except the root is at least half full (≥ ⌈p/2⌉ children).</li><li>All leaves are at the same depth → equal root-to-leaf path length.</li></ul>",
          pyq: "B/B+ Trees",
          check: { q: "In a B+ tree, pointers to data records are stored in…", opts: ["leaf nodes only", "internal nodes only", "every node", "the root only"], a: 0, exp: "Internal nodes only route the search; that keeps fan-out high." } },
        { id: "hash", n: "12", t: "Hashing", s: "O(1) equality lookups",
          body: "<p><b>Static hashing</b> maps a key to one of M buckets with h(K). A full bucket overflows into a chain. <b>Extendible hashing</b> keeps a directory of 2<sup>global depth</sup> pointers and doubles it when a bucket with local depth = global depth splits. <b>Linear hashing</b> grows one bucket at a time, without a directory.</p><p>Great for <code>WHERE id = 42</code>; useless for ranges and ordered output.</p>",
          check: { q: "Hashing is a poor choice for…", opts: ["range queries (BETWEEN)", "equality search", "inserts", "point lookups by key"], a: 0, exp: "Hashing scatters neighbouring keys across buckets, so a range means scanning everything." } },
        { id: "real", n: "13", t: "Real Applications", s: "Where each one shows up",
          body: "<ul><li><b>Heap-like:</b> transaction logs, event streams, audit tables.</li><li><b>Sequential-like:</b> ordered ledgers, batch master files, sorted exports.</li><li><b>Mixed:</b> most RDBMS tables = heap storage + B+ tree indexes (PostgreSQL), or a clustered B+ tree (MySQL InnoDB).</li></ul>",
          tryit: "live",
          check: { q: "A system that mostly appends audit records and rarely reads them suits a…", opts: ["Heap file", "Sequential file", "Extendible hash file", "B+ tree on every column"], a: 0, exp: "Appends are cheapest in a heap; reads are rare, so slow search doesn't matter." } }
    ];

    var EXAMPLES = [
        { t: "Blocks and fragmentation", steps: ["N = 10 records, B = 4 per block.", "b = ⌈10/4⌉ = 3 blocks.", "Total slots = 3 × 4 = 12, wasted = 12 − 10 = 2.", "Packing factor = 10/12 = 83.3%."] },
        { t: "Binary search on N = 12", steps: ["Comparisons ≤ ⌊log₂12⌋ + 1 = 3 + 1 = 4.", "Sorted keys: 101 103 105 106 108 109 114 115 118 120 122 128. Search 115.", "low=0, high=11 → mid=5 (109) < 115 → low=6.", "low=6, high=11 → mid=8 (118) > 115 → high=7.", "low=6, high=7 → mid=6 (114) < 115 → low=7.", "low=7, high=7 → mid=7 (115) found. 4 probes."] },
        { t: "Heap vs sequential I/O at b = 3000", steps: ["Heap search average = b/2 = 1500 blocks.", "Sequential binary search = ⌈log₂3000⌉ = 12 blocks.", "Heap insert = 2 I/Os; sequential insert ≈ b = 3000 I/Os.", "Read-heavy → sequential wins by ~125×; write-heavy → heap wins by ~1500×."] },
        { t: "GATE CSE 2023 — searching a primary index", gate: true, steps: ["25,000 records × 100 B, block 1024 B → bf = 10 → b = 2500 data blocks.", "Primary index: one entry per data block → 2500 entries of 15 B key + 5 B pointer = 20 B.", "Index fan-out = ⌊1024/20⌋ = 51 → ⌈2500/51⌉ = 50 index blocks.", "Binary search over the index: ⌈log₂ 50⌉ = 6 block accesses to find the right data block."] },
        { t: "GATE CSE 2020 — how tall is the B+ tree?", gate: true, steps: ["Block 4096 B, key 12 B, pointer 8 B → internal order p: 8p + 12(p − 1) ≤ 4096 → p = 205.", "Leaf: n(12 + 8) + 8 ≤ 4096 → 204 keys per leaf → ⌈10⁶/204⌉ = 4902 leaves.", "Next level: ⌈4902/205⌉ = 24 nodes → then the root: 3 index levels.", "Fetching one record = 3 index reads + 1 data block = 4 disk accesses."] },
        { t: "GATE CSE 2008 — multi-level secondary index", gate: true, steps: ["16,384 records; secondary index ⇒ dense ⇒ 16,384 entries.", "Entry = 6 B key + 10 B pointer = 16 B → ⌊1024/16⌋ = 64 entries per block.", "Level 1: 16,384 / 64 = 256 blocks.", "Level 2 indexes those 256 blocks: 256 / 64 = 4 blocks (a level 3 of 1 block would sit on top)."] }
    ];

    var COMPARE = [
        ["Insert", "O(1), 2 block I/Os", "O(N), ≈ b I/Os (shift)", "O(1) avg, 2 I/Os"],
        ["Search by key", "O(N), b/2 avg blocks", "O(log₂N), ⌈log₂b⌉ blocks", "O(1) avg, ~1 block"],
        ["Search, key absent", "all b blocks", "⌈log₂b⌉ blocks", "1 bucket (+ overflow)"],
        ["Delete", "b/2 + 1 (tombstone)", "search + shift ≈ b", "1 bucket read + write"],
        ["Range query", "full scan", "locate start, then contiguous blocks", "full scan"],
        ["Ordered output", "needs a sort", "already sorted", "needs a sort"],
        ["Space use", "gaps after deletes until compaction", "dense if reorganized", "buckets kept partly empty"],
        ["Best for", "logging, bulk load, full scans", "lookups, ranges, reports", "exact-match lookups"]
    ];

    var GLOSSARY = [
        ["Block / page", "Smallest unit moved between disk and memory."],
        ["Blocking factor (bf, B)", "Records that fit in one block: ⌊block size / record size⌋."],
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
        ["Primary index", "Sparse index on the ordering key field of a sorted file."],
        ["Clustering index", "Index on a non-key field the file is physically ordered by."],
        ["Secondary index", "Dense index on a non-ordering field; a file can have many."],
        ["Clustered vs unclustered", "Clustered: index order matches record order on disk. Unclustered: it doesn't."],
        ["Fan-out", "Index entries (or child pointers) per block; the bigger, the shallower the index."],
        ["Multi-level index", "Sparse index built on top of an index, repeated until one block remains."],
        ["B+ tree", "Balanced multi-level index; data pointers only in linked leaves."],
        ["Order of a B+ tree", "Maximum child pointers in an internal node (p) or entries in a leaf."],
        ["Bucket", "Unit of storage a hash function points to, usually one block."],
        ["Extendible hashing", "Hashing with a doubling directory; global and local depth decide splits."],
        ["Seek time", "Time to move the disk arm to the right track."],
        ["Rotational latency", "Wait for the sector to spin under the head (avg = ½ rotation)."],
        ["Spanned record", "Record allowed to cross a block boundary."],
        ["I/O cost", "Block transfers performed; the main metric in DBMS."]
    ];

    var SHEET = [
        ["Blocking", ["bf = ⌊block / record⌋ (unspanned)", "b = ⌈N / bf⌉", "Wasted slots = b·bf − N", "Packing factor = N / (b·bf)"]],
        ["Search cost", ["Heap: b/2 avg (hit), b (miss)", "Sequential binary search: ⌈log₂ b⌉ blocks", "Comparisons: ⌊log₂ N⌋ + 1", "Heap insert: 2 I/Os · sequential insert ≈ b"]],
        ["Indexes", ["Entry = key + pointer", "Fan-out fo = ⌊block / entry⌋", "Primary (sparse): b entries · secondary (dense): N entries", "Single-level lookup: ⌈log₂ index blocks⌉ + 1", "Multi-level levels = ⌈log_fo(entries)⌉ · lookup = levels + 1"]],
        ["B+ tree", ["Internal: p·Pblock + (p−1)·K ≤ block", "Leaf: n·(K + Precord) + Pblock ≤ block", "B-tree node: p·Pblock + (p−1)(K + Pdata) ≤ block", "Min children (non-root) = ⌈p/2⌉ · min keys = ⌈p/2⌉ − 1", "Record fetch = height + 1"]],
        ["Hashing", ["Bucket = h(K) mod M", "Extendible: directory size = 2^global depth", "Split doubles the directory only if local depth = global depth", "Equality O(1) · range = full scan"]]
    ];

    // ---------------- Concepts ----------------
    function matches(text) { return !state.q || text.toLowerCase().indexOf(state.q.toLowerCase()) >= 0; }

    function checkHTML(c) {
        var k = c.check;
        return '<div class="ln-check" data-check="' + c.id + '"><span class="eyebrow">QUICK CHECK</span><p>' + esc(k.q) + '</p><div class="ln-check-opts">' +
            k.opts.map(function (o, i) { return '<button type="button" data-ans="' + i + '">' + esc(o) + '</button>'; }).join("") +
            '</div><p class="ln-check-exp" hidden></p></div>';
    }

    function conceptsView() {
        var p = prog();
        var list = CONCEPTS.filter(function (c) { return matches(c.t + " " + c.s + " " + c.body.replace(/<[^>]+>/g, " ")); });
        if (!list.length) return '<p class="ln-empty">No concept matches “' + esc(state.q) + '”.</p>';
        return '<div class="ln-list">' + list.map(function (c) {
            var years = c.pyq ? pyqYears(c.pyq) : [];
            return '<details class="panel ln-card" data-id="' + c.id + '"><summary><span class="ln-num">' + c.n + '</span><div><h3>' + c.t + '</h3><small>' + c.s + '</small></div>' +
                (years.length ? '<span class="ln-gate">GATE ×' + (window.FF_PYQ || []).filter(function (q) { return q.topic === c.pyq; }).length + '</span>' : "") +
                (p[c.id] ? '<span class="ln-done">✓ understood</span>' : "") + '</summary><div class="ln-body">' + c.body +
                (years.length ? '<p class="ln-asked">Asked in GATE CSE ' + years.join(", ") + '.</p>' : "") +
                (c.check ? checkHTML(c) : "") +
                '<div class="ln-actions"><button class="secondary-btn" data-done="' + c.id + '">' + (p[c.id] ? "Unmark" : "Mark as understood") + '</button>' +
                (c.tryit ? '<button class="top-btn" data-go="' + c.tryit + '">Try it in ' + ({ simulator: "the Simulator", dashboard: "the Dashboard", live: "Live Stream" })[c.tryit] + ' →</button>' : "") +
                (years.length ? '<button class="top-btn" data-practice="' + esc(c.pyq) + '">Practice GATE questions →</button>' : "") +
                '</div></div></details>';
        }).join("") + '</div>';
    }

    // ---------------- Visualize: linear vs binary search ----------------
    var V = null;
    function vNew(n) {
        var keys = [], used = {};
        while (keys.length < n) { var k = 100 + Math.floor(Math.random() * 900); if (!used[k]) { used[k] = 1; keys.push(k); } }
        var sorted = keys.slice().sort(function (a, b) { return a - b; });
        V = { heap: keys, seq: sorted, target: sorted[Math.floor(Math.random() * n)], hi: -1, lo: 0, hiB: n - 1, mid: -1, hDone: false, sDone: false, hSteps: 0, sSteps: 0, timer: null, sFound: false, hFound: false };
    }
    function vStep() {
        if (!V.hDone) {
            V.hi++; V.hSteps++;
            if (V.heap[V.hi] === V.target) { V.hDone = true; V.hFound = true; }
            else if (V.hi >= V.heap.length - 1) V.hDone = true;
        }
        if (!V.sDone) {
            if (V.lo > V.hiB) { V.sDone = true; }
            else {
                V.mid = (V.lo + V.hiB) >> 1; V.sSteps++;
                var m = V.seq[V.mid];
                if (m === V.target) { V.sDone = true; V.sFound = true; }
                else if (m < V.target) V.lo = V.mid + 1; else V.hiB = V.mid - 1;
                if (!V.sDone && V.lo > V.hiB) V.sDone = true;
            }
        }
        vPaint();
        if (V.hDone && V.sDone && V.timer) { clearInterval(V.timer); V.timer = null; vPaint(); }
    }
    function vCells(arr, kind) {
        return arr.map(function (k, i) {
            var cls = "ln-cell";
            if (kind === "h") {
                if (i < V.hi) cls += " seen";
                if (i === V.hi) cls += V.hFound ? " hit" : " probe";
            } else {
                if (V.sSteps && (i < V.lo || i > V.hiB) && !(V.sFound && i === V.mid)) cls += " out";
                if (i === V.mid) cls += V.sFound ? " hit" : " probe";
            }
            var tags = [];
            if (kind === "s" && V.sSteps && !V.sDone) { if (i === V.lo) tags.push("L"); if (i === V.mid) tags.push("M"); if (i === V.hiB) tags.push("R"); }
            return '<div class="' + cls + '"><b>' + k + '</b>' + (tags.length ? '<small>' + tags.join("/") + '</small>' : "") + '</div>';
        }).join("");
    }
    function vPaint() {
        var box = $("lnViz"); if (!box) return;
        var n = V.heap.length;
        box.innerHTML =
            '<div class="ln-viz-row"><div class="ln-viz-head"><span class="strategy-icon heap-icon">H</span><b>Heap file — linear scan</b><em>' + V.hSteps + ' comparison' + (V.hSteps === 1 ? "" : "s") + (V.hDone ? (V.hFound ? " · found" : " · not found") : "") + '</em></div><div class="ln-cells">' + vCells(V.heap, "h") + '</div></div>' +
            '<div class="ln-viz-row"><div class="ln-viz-head"><span class="strategy-icon seq-icon">S</span><b>Sequential file — binary search</b><em>' + V.sSteps + ' comparison' + (V.sSteps === 1 ? "" : "s") + (V.sDone ? (V.sFound ? " · found" : " · not found") : "") + '</em></div><div class="ln-cells">' + vCells(V.seq, "s") + '</div></div>' +
            '<p class="ln-note">Searching for <b>' + V.target + '</b> among ' + n + ' records. Worst case: linear ' + n + ' vs binary ' + (Math.floor(Math.log2(n)) + 1) + ' comparisons.' +
            (V.hDone && V.sDone ? ' <b>Binary search used ' + V.sSteps + ' vs ' + V.hSteps + '.</b>' : "") + '</p>';
        var pb = $("lnVPlay"); if (pb) pb.textContent = V.timer ? "❚❚ Pause" : "▶ Play";
    }
    function vizView() {
        return '<div class="panel ln-viz-panel"><span class="eyebrow">VISUALIZE</span><h3>Same keys, two files: who finds it first?</h3>' +
            '<div class="ln-viz-ctrl"><label>Records <input type="number" id="lnVN" min="5" max="40" value="' + (V ? V.heap.length : 20) + '"></label>' +
            '<label>Search key <input type="number" id="lnVT" value="' + (V ? V.target : "") + '"></label>' +
            '<button class="primary-btn" id="lnVPlay">▶ Play</button><button class="secondary-btn" id="lnVStep">Step ›</button><button class="secondary-btn" id="lnVNew">New keys</button></div>' +
            '<div id="lnViz"></div></div>';
    }
    function vizBind() {
        if (!V) vNew(20);
        vPaint();
        function resetSearch() { var t = V.target; var h = V.heap, s = V.seq; if (V.timer) clearInterval(V.timer); V = { heap: h, seq: s, target: t, hi: -1, lo: 0, hiB: h.length - 1, mid: -1, hDone: false, sDone: false, hSteps: 0, sSteps: 0, timer: null }; }
        $("lnVPlay").onclick = function () {
            if (V.hDone && V.sDone) resetSearch();
            if (V.timer) { clearInterval(V.timer); V.timer = null; vPaint(); return; }
            V.timer = setInterval(vStep, 650); vPaint();
        };
        $("lnVStep").onclick = function () { if (V.timer) { clearInterval(V.timer); V.timer = null; } if (V.hDone && V.sDone) resetSearch(); vStep(); };
        $("lnVNew").onclick = function () { if (V.timer) clearInterval(V.timer); vNew(Math.min(40, Math.max(5, parseInt($("lnVN").value, 10) || 20))); $("lnVT").value = V.target; vPaint(); };
        $("lnVN").onchange = $("lnVNew").onclick;
        $("lnVT").onchange = function () { var t = parseInt(this.value, 10); if (!isNaN(t)) { V.target = t; resetSearch(); vPaint(); } };
    }
    function vStop() { if (V && V.timer) { clearInterval(V.timer); V.timer = null; } }

    // ---------------- Formula Lab ----------------
    var GATE_PRESETS = {
        g2023: { r: 25000, R: 100, Bs: 1024, K: 15, Pb: 5, Pr: 5, label: "GATE 2023 (primary index)" },
        g2020: { r: 1000000, R: 4096, Bs: 4096, K: 12, Pb: 8, Pr: 8, label: "GATE 2020 (B+ tree height)" },
        g2015: { r: 100000, R: 200, Bs: 1024, K: 12, Pb: 8, Pr: 10, label: "GATE 2015 (B+ tree order)" }
    };
    function formulaView() {
        var f = function (id, label, v) { return '<label>' + label + ' <input type="number" id="' + id + '" min="1" value="' + v + '"></label>'; };
        return '<div class="panel ln-lab"><span class="eyebrow">FORMULA LAB · SIMULATOR MODEL</span><h3>Type N and B, see every cost</h3>' +
            '<div class="ln-inputs">' + f("lnN", "Records N", 12) + f("lnB", "Records per block B", 3) + '</div>' +
            '<div class="ln-results" id="lnRes"></div>' +
            '<small class="ln-note">Same cost model as the Simulator (average heap = b/2 blocks, binary search = ⌈log₂b⌉, sequential insert ≈ b).</small></div>' +
            '<div class="panel ln-lab"><span class="eyebrow">GATE CALCULATOR · INDEXES &amp; B+ TREES</span><h3>Solve index-size and B+ tree questions</h3>' +
            '<div class="ln-presets">Load: ' + Object.keys(GATE_PRESETS).map(function (k) { return '<button type="button" class="ql-chip-btn" data-preset="' + k + '">' + GATE_PRESETS[k].label + '</button>'; }).join("") + '</div>' +
            '<div class="ln-inputs">' + f("gR", "Records r", 25000) + f("gRS", "Record size (B)", 100) + f("gBs", "Block size (B)", 1024) + f("gK", "Key size (B)", 15) + f("gPb", "Block pointer (B)", 5) + f("gPr", "Record pointer (B)", 5) + '</div>' +
            '<div class="ln-results" id="gRes"></div>' +
            '<small class="ln-note">Unspanned records. Primary index = one entry per data block (sparse); secondary index = one entry per record (dense, with record pointers). Heights assume full nodes (minimum accesses).</small></div>';
    }
    function rows(target, list) { $(target).innerHTML = list.map(function (r) { return '<div class="ln-res' + (r[2] ? " key" : "") + '"><span>' + r[0] + '</span><b>' + r[1] + '</b></div>'; }).join(""); }
    function calc() {
        var N = Math.max(1, parseInt($("lnN").value, 10) || 1), B = Math.max(1, parseInt($("lnB").value, 10) || 1);
        var b = Math.ceil(N / B), tot = b * B;
        rows("lnRes", [
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
        ]);
    }
    function levels(entries, fo) { var l = 0; do { entries = Math.ceil(entries / fo); l++; } while (entries > 1); return l; }
    function gcalc() {
        var g = function (id) { return Math.max(1, parseInt($(id).value, 10) || 1); };
        var r = g("gR"), R = g("gRS"), Bs = g("gBs"), K = g("gK"), Pb = g("gPb"), Pr = g("gPr");
        if (R > Bs) { rows("gRes", [["Record is larger than a block", "use spanned records"]]); return; }
        var bf = Math.floor(Bs / R), b = Math.ceil(r / bf);
        var foP = Math.floor(Bs / (K + Pb)), foS = Math.floor(Bs / (K + Pr));
        var pIdx = Math.ceil(b / foP), sIdx = Math.ceil(r / foS);
        var p = Math.floor((Bs + K) / (Pb + K));                 // p·Pb + (p−1)K ≤ Bs
        var leaf = Math.floor((Bs - Pb) / (K + Pr));             // n(K+Pr) + Pb ≤ Bs
        var h = 0, nodes = Math.ceil(r / Math.max(1, leaf)); h = 1; while (nodes > 1) { nodes = Math.ceil(nodes / Math.max(2, p)); h++; }
        var bt = Math.floor((Bs + K + Pr) / (Pb + K + Pr));      // B-tree: p·Pb + (p−1)(K+Pr) ≤ Bs
        rows("gRes", [
            ["Blocking factor ⌊block/record⌋", bf],
            ["Data blocks b", b.toLocaleString()],
            ["Index fan-out ⌊block/(K+Pblock)⌋", foP],
            ["Primary (sparse) index blocks", pIdx.toLocaleString(), true],
            ["…binary search on it + 1 data block", Math.max(1, Math.ceil(Math.log2(pIdx))) + " + 1 = " + (Math.max(1, Math.ceil(Math.log2(pIdx))) + 1)],
            ["…as a multi-level index: levels / accesses", levels(b, foP) + " / " + (levels(b, foP) + 1)],
            ["Secondary (dense) index blocks", sIdx.toLocaleString(), true],
            ["…multi-level levels / accesses", levels(r, foS) + " / " + (levels(r, foS) + 1)],
            ["B+ tree internal order p (max children)", p + "  (max keys " + (p - 1) + ")", true],
            ["B+ tree leaf order (max keys per leaf)", leaf],
            ["B+ tree height for r records / record fetch", h + " / " + (h + 1) + " accesses", true],
            ["B-tree order (keys carry data pointers)", bt],
            ["Min children of a non-root internal node ⌈p/2⌉", Math.ceil(p / 2)]
        ]);
    }

    // ---------------- Other views ----------------
    function examplesView() {
        var list = EXAMPLES.filter(function (e) { return matches(e.t + " " + e.steps.join(" ")); });
        if (!list.length) return '<p class="ln-empty">No example matches.</p>';
        return '<div class="ln-list">' + list.map(function (e) {
            return '<div class="panel ln-card static">' + (e.gate ? '<span class="ln-gate">SOLVED GATE QUESTION</span>' : "") + '<h3>' + e.t + '</h3><ol class="help-steps">' + e.steps.map(function (s) { return "<li>" + esc(s) + "</li>"; }).join("") + '</ol></div>';
        }).join("") + '</div>';
    }
    function compareView() {
        return '<div class="panel ln-scroll"><table class="complexity-table help-table"><thead><tr><th>Operation</th><th>Heap file</th><th>Sequential file</th><th>Hashed file</th></tr></thead><tbody>' +
            COMPARE.filter(function (r) { return matches(r.join(" ")); }).map(function (r) { return "<tr><td>" + r[0] + "</td><td>" + r[1] + "</td><td>" + r[2] + "</td><td>" + r[3] + "</td></tr>"; }).join("") +
            '</tbody></table></div>';
    }
    function glossaryView() {
        var list = GLOSSARY.filter(function (g) { return matches(g.join(" ")); });
        if (!list.length) return '<p class="ln-empty">No term matches.</p>';
        return '<div class="ln-gloss">' + list.map(function (g) { return '<div class="panel"><b>' + g[0] + '</b><p>' + g[1] + '</p></div>'; }).join("") + '</div>';
    }
    function sheetView() {
        return '<div class="panel ln-sheet"><div class="ln-sheet-head"><div><span class="eyebrow">CHEAT SHEET</span><h3>File organization &amp; indexing formulas</h3></div>' +
            '<button class="primary-btn" id="lnPrint">⎙ Print / save as PDF</button></div><div class="ln-sheet-grid">' +
            SHEET.filter(function (s) { return matches(s[0] + " " + s[1].join(" ")); }).map(function (s) {
                return '<div><h4>' + s[0] + '</h4><ul>' + s[1].map(function (l) { return "<li>" + esc(l) + "</li>"; }).join("") + '</ul></div>';
            }).join("") + '</div></div>';
    }

    var TABS = [["concepts", "Concepts"], ["visualize", "Visualize"], ["formulas", "Formula Lab"], ["examples", "Worked Examples"], ["compare", "Compare"], ["glossary", "Glossary"], ["sheet", "Cheat Sheet"]];
    var SEARCHABLE = { concepts: 1, examples: 1, compare: 1, glossary: 1, sheet: 1 };

    function render() {
        vStop();
        var p = prog(), done = CONCEPTS.filter(function (c) { return p[c.id]; }).length;
        var body = { concepts: conceptsView, visualize: vizView, formulas: formulaView, examples: examplesView, compare: compareView, glossary: glossaryView, sheet: sheetView }[state.tab]();
        root.innerHTML =
            '<div class="learn-header"><span class="status-badge">DBMS CONCEPT LAB</span><h2>Learn the storage model</h2>' +
            '<p>Concepts with quick checks, a search visualizer, GATE calculators, solved examples and a printable cheat sheet — then try it in the Simulator or test yourself in Quiz Lab.</p></div>' +
            '<div class="ln-top"><div class="ln-tabs" role="tablist">' + TABS.map(function (t) { return '<button type="button" role="tab" aria-selected="' + (t[0] === state.tab) + '" data-tab="' + t[0] + '"' + (t[0] === state.tab ? ' class="on"' : "") + ">" + t[1] + "</button>"; }).join("") + '</div>' +
            (SEARCHABLE[state.tab] ? '<input type="search" id="lnSearch" placeholder="Search…" aria-label="Search Learn" value="' + esc(state.q) + '">' : "") + '</div>' +
            '<div class="ln-progress"><div><i style="width:' + (100 * done / CONCEPTS.length) + '%"></i></div><small>' + done + ' of ' + CONCEPTS.length + ' concepts marked understood</small></div>' +
            body +
            '<div class="ln-cta panel"><div><b>Ready to test yourself?</b><small>Bank, real GATE questions, AI-written quizzes or your own notes.</small></div><button class="primary-btn" data-go="quiz">Open Quiz Lab →</button></div>';

        if (state.tab === "formulas") {
            calc(); gcalc();
            ["lnN", "lnB"].forEach(function (id) { $(id).oninput = calc; });
            ["gR", "gRS", "gBs", "gK", "gPb", "gPr"].forEach(function (id) { $(id).oninput = gcalc; });
        }
        if (state.tab === "visualize") vizBind();
        if ($("lnPrint")) $("lnPrint").onclick = function () { document.body.classList.add("print-sheet"); window.print(); setTimeout(function () { document.body.classList.remove("print-sheet"); }, 500); };
        var s = $("lnSearch");
        if (s) s.addEventListener("input", function () { state.q = s.value; var pos = s.selectionStart; render(); var s2 = $("lnSearch"); s2.focus(); s2.setSelectionRange(pos, pos); });
    }

    function install() {
        root = $("learn"); if (!root) return;
        root.addEventListener("click", function (e) {
            var t = e.target.closest("[data-tab]");
            if (t) { state.tab = t.getAttribute("data-tab"); state.q = ""; render(); return; }
            var g = e.target.closest("[data-go]"); if (g) { vStop(); go(g.getAttribute("data-go")); return; }
            var pr = e.target.closest("[data-practice]");
            if (pr) { if (window.FFQuizLab && window.FFQuizLab.preset) window.FFQuizLab.preset({ source: "pyq", ptopic: pr.getAttribute("data-practice") }); go("quiz"); return; }
            var ps = e.target.closest("[data-preset]");
            if (ps) { var v = GATE_PRESETS[ps.getAttribute("data-preset")]; $("gR").value = v.r; $("gRS").value = v.R; $("gBs").value = v.Bs; $("gK").value = v.K; $("gPb").value = v.Pb; $("gPr").value = v.Pr; gcalc(); return; }
            var ans = e.target.closest("[data-ans]");
            if (ans) {
                var box = ans.closest("[data-check]"), c = CONCEPTS.filter(function (x) { return x.id === box.getAttribute("data-check"); })[0];
                var i = parseInt(ans.getAttribute("data-ans"), 10), ok = i === c.check.a;
                [].forEach.call(box.querySelectorAll("[data-ans]"), function (b, j) { b.disabled = true; if (j === c.check.a) b.classList.add("ok"); else if (j === i) b.classList.add("bad"); });
                var ex = box.querySelector(".ln-check-exp"); ex.hidden = false; ex.innerHTML = "<b>" + (ok ? "Correct." : "Not quite.") + "</b> " + esc(c.check.exp);
                return;
            }
            var d = e.target.closest("[data-done]");
            if (d) {
                e.preventDefault();
                var open = [].map.call(root.querySelectorAll("details[open]"), function (x) { return x.getAttribute("data-id"); });
                var p = prog(), id = d.getAttribute("data-done"); p[id] = !p[id]; saveProg(p); render();
                open.forEach(function (i) { var el = root.querySelector('details[data-id="' + i + '"]'); if (el) el.open = true; });
            }
        });
        document.querySelectorAll(".nav-btn").forEach(function (b) { b.addEventListener("click", vStop); });
        render();
    }
    document.addEventListener("DOMContentLoaded", install);
})();
