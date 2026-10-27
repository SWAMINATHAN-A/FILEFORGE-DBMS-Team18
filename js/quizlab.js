// FILEFORGE — Quiz Lab
// Configurable quiz:
//   • number of questions, difficulty, topic / exam / year tags
//   • sources: Question bank (50 originals + 50 GATE PYQs), GATE PYQs only,
//     Live (built from the simulator's current N and block size), Bank + Live,
//     AI generated (key-less, see aiquiz.js) and Your Document (PDF / DOCX / TXT,
//     see docquiz.js)
//   • results with topic breakdown, review of wrong answers, retry-wrong
// Needs questions.js, pyq.js, aiquiz.js and docquiz.js.
(function () {
    "use strict";

    var HIST_KEY = "fileforgeQuizHistory";
    var root = null;
    var S = {
        cfg: null, qs: [], i: 0, answers: [], view: "setup",
        ui: { diff: "mixed", source: "bank" },   // remembered between quizzes
        docs: []                                 // uploaded documents: {name, kind, pages, words} or {name, loading} / {name, error}
    };

    function $(id) { return document.getElementById(id); }
    function esc(t) { var d = document.createElement("div"); d.textContent = String(t); return d.innerHTML; }
    function say(m, t) { if (typeof window.toast === "function") window.toast(m, t || "info"); }
    function shuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var x = a[i]; a[i] = a[j]; a[j] = x; } return a; }
    function rnd(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }
    function bank() { return (window.FF_QUESTIONS || []).concat(window.FF_PYQ || []); }
    function pyqs() { return window.FF_PYQ || []; }
    var ERAS = [["2016–2026", 2016, 2026], ["2006–2015", 2006, 2015], ["1994–2005", 1994, 2005]];
    function inEra(q, eras) { return !eras.length || ERAS.some(function (e) { return eras.indexOf(e[0]) >= 0 && q.year >= e[1] && q.year <= e[2]; }); }
    function uniq(list) { return list.filter(function (v, i) { return list.indexOf(v) === i; }); }

    // shuffle options but remember which is right
    function shuffleOpts(q) {
        if (q.tf) return q;   // keep True / False in that order
        var order = shuffle(q.opts.map(function (_, i) { return i; }));
        return Object.assign({}, q, {
            opts: order.map(function (i) { return q.opts[i]; }),
            a: order.indexOf(q.a)
        });
    }

    // ---------------- Live (parametric) questions ----------------
    function liveState() {
        var N = 12, B = 3;
        try { if (typeof heap !== "undefined" && heap.length) N = heap.length; } catch (e) {}
        try { if (typeof getBlockSize === "function") B = getBlockSize(); } catch (e) {}
        return { N: N, B: B };
    }
    function numOpts(correct, spread) {
        var set = [correct];
        var guard = 0;
        while (set.length < 4 && guard++ < 60) {
            var c = correct + rnd(-spread, spread);
            if (c > 0 && set.indexOf(c) < 0) set.push(c);
        }
        while (set.length < 4) set.push(correct + set.length * 7);
        return shuffle(set);
    }
    function mk(topic, diff, q, correct, exp, spread) {
        var opts = numOpts(correct, spread || 4);
        return { id: "L" + Math.random().toString(36).slice(2, 7), topic: topic, diff: diff, src: "Live", q: q,
                 opts: opts.map(String), a: opts.indexOf(correct), exp: exp };
    }
    function liveQuestion(diff) {
        var st = liveState();
        var N = Math.max(st.N, 4) + (Math.random() < 0.5 ? 0 : rnd(0, 40));
        var B = st.B;
        if (diff !== "easy") B = Math.random() < 0.5 ? B : rnd(2, 8);
        var b = Math.ceil(N / B);
        var kinds = {
            easy: [
                function () { return mk("Blocking & I/O", "easy", "N = " + N + " records, block capacity B = " + B + ". How many blocks does the file use?", b, "b = ⌈N/B⌉ = ⌈" + N + "/" + B + "⌉ = " + b + ".", 3); },
                function () { var f = b * B - N; return mk("Blocking & I/O", "easy", "N = " + N + ", B = " + B + ". How many empty slots (internal fragmentation) exist?", f, "b×B − N = " + b + "×" + B + " − " + N + " = " + f + ".", 3); }
            ],
            medium: [
                function () { var c = Math.floor(Math.log2(N)) + 1; return mk("File Organization", "medium", "A sorted file has N = " + N + " records. Maximum comparisons for binary search?", c, "⌊log₂ " + N + "⌋ + 1 = " + c + ".", 3); },
                function () { var c = Math.max(1, Math.ceil(Math.log2(b))); return mk("File Organization", "medium", "N = " + N + ", B = " + B + " (b = " + b + " blocks). Worst-case block accesses for binary search on the sequential file?", c, "⌈log₂ " + b + "⌉ = " + c + " (minimum 1).", 3); },
                function () { var c = Math.round(N / 2); return mk("File Organization", "medium", "Average record comparisons for a successful linear scan of a heap file with N = " + N + "? (use N/2, rounded)", c, "Average = N/2 = " + c + ".", 5); }
            ],
            hard: [
                function () { var c = 2 * Math.ceil(b / 2); return mk("File Organization", "hard", "A sequential file of b = " + b + " blocks gets an insert that shifts about half the file. Using read+write per shifted block, roughly how many I/Os? (2 × ⌈b/2⌉)", c, "⌈" + b + "/2⌉ = " + Math.ceil(b / 2) + " blocks, each read and written → " + c + " I/Os. A heap insert would cost just 2.", 4); },
                function () { var h = Math.ceil(b / 2), s = Math.max(1, Math.ceil(Math.log2(b))); return mk("File Organization", "hard", "b = " + b + ". How many MORE block accesses does an average heap search (⌈b/2⌉) take than a worst-case binary search (⌈log₂ b⌉, min 1)?", Math.max(h - s, 1), "⌈b/2⌉ − ⌈log₂ b⌉ = " + h + " − " + s + " = " + (h - s) + ".", 4); }
            ]
        };
        var pool = kinds[diff] || kinds.medium;
        return pool[rnd(0, pool.length - 1)]();
    }

    // ---------------- Uploaded documents ----------------
    function readyDocs() { return S.docs.filter(function (d) { return d.pages; }); }

    function addFiles(files, done) {
        [].forEach.call(files, function (file) {
            if (S.docs.some(function (d) { return d.name === file.name; })) { say(file.name + " is already added.", "info"); return; }
            var entry = { name: file.name, loading: true };
            S.docs.push(entry);
            done();
            window.FFDocQuiz.extract(file).then(function (doc) {
                Object.assign(entry, doc, { loading: false });
                say(doc.mcq ? "Found " + doc.mcq.questions.length + " questions and their answers in " + file.name + "." : "Read " + file.name + " — " + doc.words.toLocaleString() + " words.", "success");
            }).catch(function (err) {
                entry.loading = false; entry.error = err.message;
                say(file.name + ": " + err.message, "error");
            }).then(done);
        });
    }

    function docListHTML() {
        if (!S.docs.length) return "";
        return S.docs.map(function (d, i) {
            var info = d.loading ? "Reading…"
                     : d.error ? '<span class="ql-bad">' + esc(d.error) + "</span>"
                     : (d.kind === "pdf" ? d.pages.length + " page" + (d.pages.length === 1 ? "" : "s") + " · " : "") + d.words.toLocaleString() + " words" +
                       (d.mcq ? ' · <b class="ql-good">question paper: ' + d.mcq.questions.length + ' questions with answers imported</b>' +
                                (d.mcq.skipped ? ' <span class="ql-bad">(' + d.mcq.skipped + ' skipped — no answer in the key or duplicate options)</span>' : "") : "");
            return '<div class="ql-doc' + (d.error ? " is-error" : "") + '"><span class="ql-doc-icon">' + (d.loading ? "…" : d.error ? "!" : "✓") + '</span>' +
                   '<div class="ql-doc-meta"><b>' + esc(d.name) + '</b><small>' + info + '</small></div>' +
                   '<button type="button" class="ql-doc-x" data-i="' + i + '" title="Remove"' + (d.loading ? " disabled" : "") + '>×</button></div>';
        }).join("");
    }

    // ---------------- Build the question set ----------------
    function pickFromBank(cfg) {
        var pool = bank().filter(function (q) {
            return (cfg.diff === "mixed" || q.diff === cfg.diff) &&
                   (!cfg.topics.length || cfg.topics.indexOf(q.topic) >= 0) &&
                   (!cfg.srcs.length || cfg.srcs.indexOf(q.src) >= 0);
        });
        return shuffle(pool).slice(0, cfg.count).map(shuffleOpts);
    }
    function pickLive(cfg) {
        var out = [];
        for (var i = 0; i < cfg.count; i++) {
            var d = cfg.diff === "mixed" ? ["easy", "medium", "hard"][i % 3] : cfg.diff;
            out.push(liveQuestion(d));
        }
        return out;
    }
    function pickPyq(cfg) {
        var pool = pyqs().filter(function (q) {
            return (cfg.diff === "mixed" || q.diff === cfg.diff) &&
                   (!cfg.topics.length || cfg.topics.indexOf(q.topic) >= 0) &&
                   inEra(q, cfg.eras) && (!cfg.marks.length || cfg.marks.indexOf(q.marks + "") >= 0);
        });
        return shuffle(pool).slice(0, cfg.count).map(shuffleOpts);
    }
    function buildSet(cfg) {
        if (cfg.source === "live") return Promise.resolve(pickLive(cfg));
        if (cfg.source === "pyq") return Promise.resolve(pickPyq(cfg));
        if (cfg.source === "ai") {
            return window.FFAiQuiz.generate(cfg).then(function (qs) { return qs.map(shuffleOpts); }).catch(function (err) {
                say(err.message + " — using the built-in question bank instead.", "error");
                return pickFromBank(Object.assign({}, cfg, { srcs: [] }));
            });
        }
        if (cfg.source === "doc") return Promise.resolve(window.FFDocQuiz.generate(readyDocs(), cfg));
        if (cfg.source === "mixed") {
            var half = Math.ceil(cfg.count / 2);
            var a = pickFromBank(Object.assign({}, cfg, { count: half }));
            var b = pickLive(Object.assign({}, cfg, { count: cfg.count - half }));
            return Promise.resolve(shuffle(a.concat(b)));
        }
        return Promise.resolve(pickFromBank(cfg));
    }

    // ---------------- Views ----------------
    function chips(name, values, checked, labels) {
        return values.map(function (v, i) {
            var on = checked === true || (Array.isArray(checked) && checked.indexOf(v) >= 0);
            return '<label class="ql-chip"><input type="checkbox" name="' + name + '" value="' + esc(v) + '"' +
                (on ? " checked" : "") + '><span>' + esc(labels ? labels[i] : v) + '</span></label>';
        }).join("");
    }
    function history() { try { return JSON.parse(localStorage.getItem(HIST_KEY) || "[]"); } catch (e) { return []; } }

    function setupView() {
        var topics = uniq(bank().map(function (q) { return q.topic; }));
        var srcs = uniq(bank().map(function (q) { return q.src; }));
        var ptopics = uniq(pyqs().map(function (q) { return q.topic; }));
        var h = history();
        var best = h.length ? Math.max.apply(null, h.map(function (x) { return Math.round(100 * x.score / x.total); })) : null;
        var cfg = S.ui;

        root.innerHTML =
            '<div class="page-intro"><span class="eyebrow">KNOWLEDGE CHECK</span><h2>Quiz Lab</h2>' +
            '<p>Pick how many questions, how hard, and where they come from: ' + bank().length + ' tagged questions are built in (including ' + pyqs().length + ' GATE previous-year questions), or let AI write fresh ones, or upload your own notes.' +
            (best !== null ? ' Best score so far: <b>' + best + '%</b> over ' + h.length + ' attempt(s).' : '') + '</p></div>' +
            '<div class="panel ql-panel">' +
              '<div class="ql-row"><div class="ql-field"><label>NUMBER OF QUESTIONS: <b id="qlCountLabel">10</b></label>' +
                '<input type="range" id="qlCount" min="3" max="50" value="10"></div>' +
              '<div class="ql-field"><label>DIFFICULTY</label><div class="ql-seg" id="qlDiff">' +
                ["easy", "medium", "hard", "mixed"].map(function (d) { return '<button type="button" data-v="' + d + '"' + (d === cfg.diff ? ' class="on"' : "") + ">" + d + "</button>"; }).join("") +
              '</div></div></div>' +
              '<div class="ql-field"><label>QUESTION SOURCE</label><div class="ql-seg" id="qlSource">' +
                [["bank", "Question bank"], ["pyq", "📜 GATE previous years"], ["ai", "✨ AI generated"], ["live", "Live (your simulator data)"], ["mixed", "Bank + Live"], ["doc", "📄 From your PDF / DOC"]].map(function (s) {
                    return '<button type="button" data-v="' + s[0] + '"' + (s[0] === cfg.source ? ' class="on"' : "") + ">" + s[1] + "</button>"; }).join("") +
              '</div><small id="qlSourceHint" class="ql-hint"></small></div>' +
              '<div id="qlBankFilters">' +
                '<div class="ql-field"><label>TOPICS (none ticked = all)</label><div class="ql-chips" id="qlTopics">' + chips("topic", topics, false) + '</div></div>' +
                '<div class="ql-field"><label>EXAM STYLE TAG</label><div class="ql-chips" id="qlSrcs">' + chips("src", srcs, false) + '</div></div>' +
              '</div>' +
              '<div id="qlPyqFilters" hidden>' +
                '<div class="ql-field"><label>TOPICS (none ticked = all)</label><div class="ql-chips">' + chips("ptopic", ptopics, S.preTopic ? [S.preTopic] : false) + '</div></div>' +
                '<div class="ql-row"><div class="ql-field"><label>PAPER YEARS (none ticked = all)</label><div class="ql-chips">' + chips("era", ERAS.map(function (e) { return e[0]; }), false) + '</div></div>' +
                '<div class="ql-field"><label>MARKS</label><div class="ql-chips">' + chips("marks", ["1", "2"], false, ["1 mark", "2 marks"]) + '</div></div></div>' +
              '</div>' +
              '<div id="qlAiBox" hidden>' +
                '<div class="ql-field"><label>WHAT SHOULD THE AI ASK ABOUT? (optional)</label><input type="text" id="qlAiTopic" maxlength="160" placeholder="e.g. B+ tree order calculations, deadlocks, BCNF — leave empty for all DBMS topics"></div>' +
                '<small class="ql-hint">No API key or sign-up. A free AI service (Pollinations) writes the questions live and each one is format-checked before you see it — up to ' + window.FFAiQuiz.MAX + ' per quiz, usually ready in 10–30 seconds. AI can occasionally be wrong; the bank and GATE questions are verified.</small>' +
              '</div>' +
              '<div id="qlDocBox" class="ql-docbox" hidden>' +
                '<label class="ql-drop" id="qlDrop"><input type="file" id="qlFile" accept="' + window.FFDocQuiz.ACCEPT + '" multiple hidden>' +
                  '<span class="ql-drop-icon">⇪</span><b>Upload a PDF or Word document</b>' +
                  '<small>Drop files here or click to browse · PDF, DOCX, TXT · up to 25 MB</small></label>' +
                '<div id="qlDocs" class="ql-docs"></div>' +
                '<small class="ql-hint">Two kinds of document work: <b>notes</b> (questions are built from your sentences) and <b>question papers</b> — numbered questions with A–D options and an answer key or "Answer: B" lines are asked exactly as written. ' +
                '<button type="button" class="ql-chip-btn" id="qlSample">Try the sample question paper</button></small>' +
                '<small class="ql-hint">Files are read inside your browser — nothing is uploaded to a server. Scanned PDFs (images only) can\'t be read.</small>' +
              '</div>' +
              '<div class="ql-actions"><button class="primary-btn" id="qlStart">Start quiz <span>→</span></button><small id="qlAvail" class="ql-hint"></small></div>' +
            '</div>';

        function seg(id, key) {
            $(id).addEventListener("click", function (e) {
                var b = e.target.closest("button"); if (!b) return;
                [].forEach.call($(id).children, function (c) { c.classList.remove("on"); });
                b.classList.add("on"); cfg[key] = b.getAttribute("data-v"); refresh();
            });
        }
        function refresh() {
            var src = cfg.source;
            $("qlBankFilters").hidden = !(src === "bank" || src === "mixed");
            $("qlPyqFilters").hidden = src !== "pyq";
            $("qlAiBox").hidden = src !== "ai";
            $("qlDocBox").hidden = src !== "doc";
            $("qlSourceHint").textContent = {
                bank: "50 original GATE/CSE-style questions plus 50 real GATE CSE previous-year questions, all with worked explanations.",
                pyq: "Real GATE CSE questions (1994–2026) on file structures, indexing, normalization and transactions — tagged by paper and marks.",
                ai: "Fresh questions every time, at the difficulty you pick.",
                live: "Numbers are generated from your current record count and block size.",
                mixed: "Half from the bank, half generated from your live data.",
                doc: "Upload your notes or a textbook chapter — fill-in-the-blank and true/false questions are built from its sentences."
            }[src];
            $("qlDocs").innerHTML = docListHTML();
            var busy = S.docs.some(function (d) { return d.loading; });
            if (src === "doc") {
                var n = readyDocs().length;
                $("qlAvail").textContent = busy ? "Reading your file…" : n ? n + " document" + (n > 1 ? "s" : "") + " ready" : "Upload a document to start";
                $("qlStart").disabled = busy || !n;
            } else {
                $("qlStart").disabled = false;
                var sel = readSel();
                $("qlAvail").textContent = (src === "bank" || src === "mixed") ? pickPoolSize(sel) + " matching questions in the bank"
                    : src === "pyq" ? pickPyq({ diff: cfg.diff, topics: sel.ptopics, eras: sel.eras, marks: sel.marks, count: 999 }).length + " matching GATE questions"
                    : src === "ai" && parseInt($("qlCount").value, 10) > window.FFAiQuiz.MAX ? "AI writes up to " + window.FFAiQuiz.MAX + " questions per quiz" : "";
            }
        }
        function readSel() {
            function vals(name) { return [].map.call(root.querySelectorAll('input[name="' + name + '"]:checked'), function (i) { return i.value; }); }
            return { topics: vals("topic"), srcs: vals("src"), ptopics: vals("ptopic"), eras: vals("era"), marks: vals("marks") };
        }
        function pickPoolSize(sel) {
            return bank().filter(function (q) {
                return (cfg.diff === "mixed" || q.diff === cfg.diff) && (!sel.topics.length || sel.topics.indexOf(q.topic) >= 0) && (!sel.srcs.length || sel.srcs.indexOf(q.src) >= 0);
            }).length;
        }
        seg("qlDiff", "diff"); seg("qlSource", "source");
        $("qlCount").addEventListener("input", function () { $("qlCountLabel").textContent = $("qlCount").value; });
        $("qlBankFilters").addEventListener("change", refresh);
        $("qlPyqFilters").addEventListener("change", refresh);
        $("qlCount").addEventListener("change", refresh);

        // document upload: click, or drag & drop
        $("qlFile").addEventListener("change", function () { addFiles(this.files, refresh); this.value = ""; });
        var drop = $("qlDrop");
        ["dragenter", "dragover"].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add("over"); }); });
        ["dragleave", "drop"].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove("over"); }); });
        drop.addEventListener("drop", function (e) { if (e.dataTransfer && e.dataTransfer.files.length) addFiles(e.dataTransfer.files, refresh); });
        $("qlSample").addEventListener("click", function () {
            var url = "samples/GATE_CSE_Heap_and_Linear_Search_50_Questions.docx";
            fetch(url).then(function (r) { if (!r.ok) throw new Error(); return r.blob(); }).then(function (b) {
                addFiles([new File([b], url.split("/").pop())], refresh);
            }).catch(function () { say("The sample loads only when the site is served online (or via a local server). Download it from the samples folder and upload it instead.", "error"); });
        });
        $("qlDocs").addEventListener("click", function (e) {
            var x = e.target.closest(".ql-doc-x"); if (!x) return;
            S.docs.splice(parseInt(x.getAttribute("data-i"), 10), 1); refresh();
        });
        refresh();

        $("qlStart").addEventListener("click", function () {
            var sel = readSel();
            var c = { count: parseInt($("qlCount").value, 10), diff: cfg.diff, source: cfg.source,
                      topics: cfg.source === "pyq" ? sel.ptopics : sel.topics, srcs: sel.srcs, eras: sel.eras, marks: sel.marks,
                      aiTopic: $("qlAiTopic").value };
            var btn = $("qlStart"); btn.disabled = true; btn.textContent = c.source === "ai" ? "AI is writing your questions…" : "Building…";
            buildSet(c).then(function (qs) {
                if (!qs.length) {
                    say(c.source === "doc" ? "Couldn't find enough complete sentences in that document to make questions." : "No questions match those filters — loosen them.", "error");
                    btn.disabled = false; btn.innerHTML = "Start quiz <span>→</span>"; return;
                }
                if (qs.length < c.count) say("Only " + qs.length + " questions " + (c.source === "doc" ? "could be made from your document" : c.source === "ai" ? "came back from the AI" : "match") + "; starting with those.", "info");
                S.cfg = c; S.qs = qs; S.i = 0; S.answers = []; S.view = "run"; render();
            });
        });
    }

    function runView() {
        var q = S.qs[S.i], n = S.qs.length;
        var chosen = S.answers[S.i];
        root.innerHTML =
            '<div class="panel quiz-container ql-run">' +
              '<div class="quiz-progress"><span>Question ' + (S.i + 1) + ' of ' + n + '</span><div><i style="width:' + (((S.i + 1) / n) * 100) + '%"></i></div></div>' +
              '<div class="ql-tags"><span class="ql-tag t-' + q.diff + '">' + (q.diff === "imported" ? "from your file" : q.diff) + '</span><span class="ql-tag">' + esc(q.topic) + '</span>' +
                (q.exam ? '<span class="ql-tag ql-tag-exam">' + esc(q.exam) + ' · ' + q.marks + ' mark' + (q.marks > 1 ? "s" : "") + '</span>'
                        : q.tag ? '<span class="ql-tag ql-tag-exam">' + esc(q.tag) + '</span>' : '<span class="ql-tag">' + esc(q.src) + '</span>') + '</div>' +
              '<h3>' + esc(q.q) + '</h3>' +
              '<div class="quiz-options" id="qlOpts">' + q.opts.map(function (o, i) {
                  var cls = "quiz-option";
                  if (chosen !== undefined) { if (i === q.a) cls += " correct"; else if (i === chosen) cls += " wrong"; }
                  return '<button class="' + cls + '" data-i="' + i + '"' + (chosen !== undefined ? " disabled" : "") + '>' + esc(o) + '</button>';
              }).join("") + '</div>' +
              '<div class="ql-exp" id="qlExp"' + (chosen === undefined ? " hidden" : "") + '>' + (chosen !== undefined ? '<b>' + (chosen === q.a ? "Correct. " : "Not quite. ") + '</b>' + esc(q.exp || "") + srcLink(q) : "") + '</div>' +
              '<div class="quiz-footer"><span>Score: ' + score() + '</span><div><button class="secondary-btn" id="qlQuit">End quiz</button> <button class="primary-btn" id="qlNext">' + (S.i === n - 1 ? "Finish" : "Next →") + '</button></div></div>' +
            '</div>';

        $("qlOpts").addEventListener("click", function (e) {
            var b = e.target.closest(".quiz-option"); if (!b || S.answers[S.i] !== undefined) return;
            S.answers[S.i] = parseInt(b.getAttribute("data-i"), 10);
            runView();
        });
        $("qlNext").addEventListener("click", function () {
            if (S.answers[S.i] === undefined) { say("Choose an answer first.", "info"); return; }
            if (S.i >= S.qs.length - 1) { finish(); } else { S.i++; runView(); }
        });
        $("qlQuit").addEventListener("click", function () { if (confirm("End the quiz now? Unanswered questions count as wrong.")) finish(); });
    }
    function srcLink(q) {
        if (q.ref) return ' <a class="ql-src" href="' + esc(q.ref) + '" target="_blank" rel="noopener">See the ' + esc(q.exam) + ' original ↗</a>';
        if (q.ai) return ' <span class="ql-src">AI-written — double-check anything that looks off.</span>';
        return "";
    }
    function score() { return S.qs.reduce(function (s, q, i) { return s + (S.answers[i] === q.a ? 1 : 0); }, 0); }

    function finish() {
        var sc = score(), n = S.qs.length;
        var h = history(); h.push({ ts: Date.now(), score: sc, total: n, diff: S.cfg.diff, source: S.cfg.source });
        try { localStorage.setItem(HIST_KEY, JSON.stringify(h.slice(-30))); } catch (e) {}
        S.view = "result"; render();
    }

    function resultView() {
        var n = S.qs.length, sc = score(), pct = Math.round(100 * sc / n);
        var byTopic = {};
        S.qs.forEach(function (q, i) {
            var t = byTopic[q.topic] = byTopic[q.topic] || { ok: 0, all: 0 };
            t.all++; if (S.answers[i] === q.a) t.ok++;
        });
        var wrong = S.qs.map(function (q, i) { return i; }).filter(function (i) { return S.answers[i] !== S.qs[i].a; });
        var verdict = pct >= 80 ? "Excellent — exam ready on this material." : pct >= 50 ? "Decent. Review the misses below." : "Keep going — use the Learn tab, then retry.";

        root.innerHTML =
            '<div class="panel ql-result"><span class="eyebrow">RESULT</span>' +
            '<div class="ql-big">' + sc + ' / ' + n + ' <small>(' + pct + '%)</small></div><p>' + verdict + '</p>' +
            '<div class="ql-topics">' + Object.keys(byTopic).map(function (t) {
                var v = byTopic[t], p = Math.round(100 * v.ok / v.all);
                return '<div class="ql-topic-row"><span>' + esc(t) + '</span><div class="ql-bar"><i style="width:' + p + '%"></i></div><b>' + v.ok + '/' + v.all + '</b></div>';
            }).join("") + '</div>' +
            '<div class="ql-actions">' +
              (wrong.length ? '<button class="primary-btn" id="qlRetry">Retry ' + wrong.length + ' missed</button>' : "") +
              '<button class="secondary-btn" id="qlAgain">New quiz</button></div></div>' +
            (wrong.length ? '<div class="panel ql-review"><span class="eyebrow">REVIEW MISSED QUESTIONS</span>' + wrong.map(function (i) {
                var q = S.qs[i];
                return '<div class="ql-rev-item"><p><b>' + esc(q.q) + '</b></p><p class="ql-bad">Your answer: ' + (S.answers[i] === undefined ? "—" : esc(q.opts[S.answers[i]])) + '</p><p class="ql-good">Correct: ' + esc(q.opts[q.a]) + '</p><p>' + esc(q.exp || "") + srcLink(q) + '</p></div>';
            }).join("") + '</div>' : "");

        if ($("qlRetry")) $("qlRetry").addEventListener("click", function () {
            S.qs = wrong.map(function (i) { return shuffleOpts(S.qs[i]); }); S.i = 0; S.answers = []; S.view = "run"; render();
        });
        $("qlAgain").addEventListener("click", function () { S.view = "setup"; render(); });
    }

    function render() {
        if (!root) return;
        if (S.view === "run") runView(); else if (S.view === "result") resultView(); else setupView();
    }

    // ---------------- Install ----------------
    function install() {
        root = $("quiz");
        if (root) render();
    }
    document.addEventListener("DOMContentLoaded", install);
    // refresh(): called when the Quiz page is opened; re-renders only the setup
    // screen so an in-progress quiz isn't lost.
    // preset({source, ptopic}): open the setup screen with a source/topic chosen (used by Learn)
    function preset(o) { S.ui.source = o.source || S.ui.source; S.preTopic = o.ptopic || null; S.view = "setup"; render(); }
    window.FFQuizLab = { render: render, preset: preset, refresh: function () { if (S.view === "setup") render(); } };
})();
