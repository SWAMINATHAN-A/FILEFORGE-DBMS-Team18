// FILEFORGE — Quiz Lab
// Replaces the 5-question quiz with a configurable one:
//   • number of questions, difficulty, topic + exam-style tags
//   • 3 sources: Question Bank (50 tagged), Live (built from the simulator's
//     current N and block size), AI (optional — your own API key)
//   • results with topic breakdown, review of wrong answers, retry-wrong
// Self-contained. Needs questions.js (window.FF_QUESTIONS). Safe if the old
// quiz code is still loaded: it overrides renderQuiz() so nothing crashes.
(function () {
    "use strict";

    var HIST_KEY = "fileforgeQuizHistory";
    var root = null;
    var S = { cfg: null, qs: [], i: 0, answers: [], answered: false, view: "setup" };

    function $(id) { return document.getElementById(id); }
    function esc(t) { var d = document.createElement("div"); d.textContent = String(t); return d.innerHTML; }
    function say(m, t) { if (typeof window.toast === "function") window.toast(m, t || "info"); }
    function shuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var x = a[i]; a[i] = a[j]; a[j] = x; } return a; }
    function rnd(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }
    function bank() { return window.FF_QUESTIONS || []; }
    function uniq(list) { return list.filter(function (v, i) { return list.indexOf(v) === i; }); }

    // shuffle options but remember which is right
    function shuffleOpts(q) {
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

    // ---------------- AI generation (optional) ----------------
    function aiPrompt(cfg) {
        var topics = cfg.topics.length ? cfg.topics.join(", ") : "heap files, sequential files, blocking factor, indexing, B+ trees, hashing, disk storage";
        return "Write " + cfg.count + " multiple-choice questions for a university DBMS course (GATE / CSE exam style). " +
            "Topics: " + topics + ". Difficulty: " + (cfg.diff === "mixed" ? "a mix of easy, medium and hard" : cfg.diff) + ". " +
            "Each question has exactly 4 options and exactly one correct answer, with numeric answers worked out carefully. " +
            "Return ONLY a JSON array, no markdown fences. Each item: " +
            '{"q": string, "opts": [4 strings], "a": index 0-3 of the correct option, "topic": string, "diff": "easy"|"medium"|"hard", "exp": short worked explanation}.';
    }
    function aiGenerate(cfg) {
        var key = (cfg.apiKey || "").trim();
        if (!key) return Promise.reject(new Error("No API key"));
        return fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
                "content-type": "application/json",
                "x-api-key": key,
                "anthropic-version": "2023-06-01",
                "anthropic-dangerous-direct-browser-access": "true"
            },
            body: JSON.stringify({
                model: cfg.model || "claude-sonnet-5-5",
                max_tokens: 4000,
                messages: [{ role: "user", content: aiPrompt(cfg) }]
            })
        }).then(function (r) {
            if (!r.ok) throw new Error("API error " + r.status);
            return r.json();
        }).then(function (data) {
            var text = (data.content || []).map(function (c) { return c.text || ""; }).join("");
            text = text.replace(/```json|```/g, "").trim();
            var arr = JSON.parse(text);
            return arr.filter(function (q) {
                return q && q.q && Array.isArray(q.opts) && q.opts.length === 4 && q.a >= 0 && q.a < 4;
            }).map(function (q, i) {
                return { id: "AI" + i, topic: q.topic || "AI", diff: q.diff || cfg.diff, src: "AI", q: q.q, opts: q.opts.map(String), a: q.a, exp: q.exp || "" };
            });
        });
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
    function buildSet(cfg) {
        if (cfg.source === "live") return Promise.resolve(pickLive(cfg));
        if (cfg.source === "ai") {
            return aiGenerate(cfg).then(function (qs) {
                if (!qs.length) throw new Error("AI returned no usable questions");
                return qs.slice(0, cfg.count);
            });
        }
        if (cfg.source === "mixed") {
            var half = Math.ceil(cfg.count / 2);
            var a = pickFromBank(Object.assign({}, cfg, { count: half }));
            var b = pickLive(Object.assign({}, cfg, { count: cfg.count - half }));
            return Promise.resolve(shuffle(a.concat(b)));
        }
        return Promise.resolve(pickFromBank(cfg));
    }

    // ---------------- Views ----------------
    function chips(name, values, checked) {
        return values.map(function (v) {
            return '<label class="ql-chip"><input type="checkbox" name="' + name + '" value="' + esc(v) + '"' +
                (checked ? " checked" : "") + '><span>' + esc(v) + '</span></label>';
        }).join("");
    }
    function history() { try { return JSON.parse(localStorage.getItem(HIST_KEY) || "[]"); } catch (e) { return []; } }

    function setupView() {
        var topics = uniq(bank().map(function (q) { return q.topic; }));
        var srcs = uniq(bank().map(function (q) { return q.src; }));
        var h = history();
        var best = h.length ? Math.max.apply(null, h.map(function (x) { return Math.round(100 * x.score / x.total); })) : null;

        root.innerHTML =
            '<div class="page-intro"><span class="eyebrow">KNOWLEDGE CHECK</span><h2>Quiz Lab</h2>' +
            '<p>Pick how many questions, how hard, and where they come from. ' + bank().length + ' tagged questions are built in.' +
            (best !== null ? ' Best score so far: <b>' + best + '%</b> over ' + h.length + ' attempt(s).' : '') + '</p></div>' +
            '<div class="panel ql-panel">' +
              '<div class="ql-row"><div class="ql-field"><label>NUMBER OF QUESTIONS: <b id="qlCountLabel">10</b></label>' +
                '<input type="range" id="qlCount" min="3" max="50" value="10"></div>' +
              '<div class="ql-field"><label>DIFFICULTY</label><div class="ql-seg" id="qlDiff">' +
                ["easy", "medium", "hard", "mixed"].map(function (d) { return '<button type="button" data-v="' + d + '"' + (d === "mixed" ? ' class="on"' : "") + ">" + d + "</button>"; }).join("") +
              '</div></div></div>' +
              '<div class="ql-field"><label>QUESTION SOURCE</label><div class="ql-seg" id="qlSource">' +
                [["bank", "Question bank"], ["live", "Live (your simulator data)"], ["mixed", "Bank + Live"], ["ai", "✨ AI generated"]].map(function (s, i) {
                    return '<button type="button" data-v="' + s[0] + '"' + (i === 0 ? ' class="on"' : "") + ">" + s[1] + "</button>"; }).join("") +
              '</div><small id="qlSourceHint" class="ql-hint"></small></div>' +
              '<div id="qlBankFilters">' +
                '<div class="ql-field"><label>TOPICS (none ticked = all)</label><div class="ql-chips" id="qlTopics">' + chips("topic", topics, false) + '</div></div>' +
                '<div class="ql-field"><label>EXAM STYLE TAG</label><div class="ql-chips" id="qlSrcs">' + chips("src", srcs, false) + '</div></div>' +
              '</div>' +
              '<div id="qlAiBox" class="ql-aibox" hidden>' +
                '<div class="ql-field"><label>API KEY (kept only in this tab; never saved)</label><input type="password" id="qlKey" placeholder="sk-ant-…" autocomplete="off"></div>' +
                '<div class="ql-field"><label>MODEL</label><input type="text" id="qlModel" value="claude-sonnet-5-5"></div>' +
                '<small class="ql-hint">Calls the Anthropic API straight from your browser. Fine for a demo on your own machine; do not deploy a page that contains a real key. If the call fails the quiz falls back to the question bank.</small>' +
              '</div>' +
              '<div class="ql-actions"><button class="primary-btn" id="qlStart">Start quiz <span>→</span></button><small id="qlAvail" class="ql-hint"></small></div>' +
            '</div>';

        var cfg = { diff: "mixed", source: "bank" };
        function seg(id, key, after) {
            $(id).addEventListener("click", function (e) {
                var b = e.target.closest("button"); if (!b) return;
                [].forEach.call($(id).children, function (c) { c.classList.remove("on"); });
                b.classList.add("on"); cfg[key] = b.getAttribute("data-v"); refresh(); if (after) after();
            });
        }
        function refresh() {
            var src = cfg.source;
            $("qlBankFilters").hidden = !(src === "bank" || src === "mixed");
            $("qlAiBox").hidden = src !== "ai";
            $("qlSourceHint").textContent = {
                bank: "Original GATE/CSE-style questions with worked explanations.",
                live: "Numbers are generated from your current record count and block size.",
                mixed: "Half from the bank, half generated from your live data.",
                ai: "Asks an AI model to write fresh questions for your chosen topics/difficulty."
            }[src];
            var sel = readSel();
            var n = pickPoolSize(sel);
            $("qlAvail").textContent = (src === "bank" || src === "mixed") ? n + " matching questions in the bank" : "";
        }
        function readSel() {
            function vals(name) { return [].map.call(root.querySelectorAll('input[name="' + name + '"]:checked'), function (i) { return i.value; }); }
            return { topics: vals("topic"), srcs: vals("src") };
        }
        function pickPoolSize(sel) {
            return bank().filter(function (q) {
                return (cfg.diff === "mixed" || q.diff === cfg.diff) && (!sel.topics.length || sel.topics.indexOf(q.topic) >= 0) && (!sel.srcs.length || sel.srcs.indexOf(q.src) >= 0);
            }).length;
        }
        seg("qlDiff", "diff"); seg("qlSource", "source");
        $("qlCount").addEventListener("input", function () { $("qlCountLabel").textContent = $("qlCount").value; });
        $("qlBankFilters").addEventListener("change", refresh);
        refresh();

        $("qlStart").addEventListener("click", function () {
            var sel = readSel();
            var c = {
                count: parseInt($("qlCount").value, 10), diff: cfg.diff, source: cfg.source,
                topics: sel.topics, srcs: sel.srcs,
                apiKey: $("qlKey") ? $("qlKey").value : "", model: $("qlModel") ? $("qlModel").value : ""
            };
            var btn = $("qlStart"); btn.disabled = true; btn.textContent = c.source === "ai" ? "Asking AI…" : "Building…";
            buildSet(c).catch(function (err) {
                if (c.source === "ai") { say("AI unavailable (" + err.message + "). Using the question bank instead.", "error"); return pickFromBank(c); }
                throw err;
            }).then(function (qs) {
                if (!qs.length) { say("No questions match those filters — loosen them.", "error"); btn.disabled = false; btn.innerHTML = "Start quiz <span>→</span>"; return; }
                if (qs.length < c.count && c.source !== "ai") say("Only " + qs.length + " questions match; starting with those.", "info");
                S.cfg = c; S.qs = qs; S.i = 0; S.answers = []; S.answered = false; S.view = "run"; render();
            });
        });
    }

    function runView() {
        var q = S.qs[S.i], n = S.qs.length;
        var chosen = S.answers[S.i];
        root.innerHTML =
            '<div class="panel quiz-container ql-run">' +
              '<div class="quiz-progress"><span>Question ' + (S.i + 1) + ' of ' + n + '</span><div><i style="width:' + (((S.i + 1) / n) * 100) + '%"></i></div></div>' +
              '<div class="ql-tags"><span class="ql-tag t-' + q.diff + '">' + q.diff + '</span><span class="ql-tag">' + esc(q.topic) + '</span><span class="ql-tag">' + esc(q.src) + '</span></div>' +
              '<h3>' + esc(q.q) + '</h3>' +
              '<div class="quiz-options" id="qlOpts">' + q.opts.map(function (o, i) {
                  var cls = "quiz-option";
                  if (chosen !== undefined) { if (i === q.a) cls += " correct"; else if (i === chosen) cls += " wrong"; }
                  return '<button class="' + cls + '" data-i="' + i + '"' + (chosen !== undefined ? " disabled" : "") + '>' + esc(o) + '</button>';
              }).join("") + '</div>' +
              '<div class="ql-exp" id="qlExp"' + (chosen === undefined ? " hidden" : "") + '>' + (chosen !== undefined ? '<b>' + (chosen === q.a ? "Correct. " : "Not quite. ") + '</b>' + esc(q.exp || "") : "") + '</div>' +
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
                return '<div class="ql-rev-item"><p><b>' + esc(q.q) + '</b></p><p class="ql-bad">Your answer: ' + (S.answers[i] === undefined ? "—" : esc(q.opts[S.answers[i]])) + '</p><p class="ql-good">Correct: ' + esc(q.opts[q.a]) + '</p><p>' + esc(q.exp || "") + '</p></div>';
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
        if (!root) return;
        // neutralise the legacy 5-question quiz so its handlers can't crash
        window.renderQuiz = function () { if (S.view === "setup") render(); };
        window.nextQuizQuestion = function () {};
        window.answerQuiz = function () {};
        render();
    }
    document.addEventListener("DOMContentLoaded", install);
    window.FFQuizLab = { render: render };
})();
