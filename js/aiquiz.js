// FILEFORGE — AI-generated quiz questions, no API key needed
// Uses Pollinations' free, key-less text endpoint straight from the browser.
// Every question the model returns is validated (4 distinct options, a valid
// answer) before it is shown. If the service is busy or unreachable, Quiz Lab
// falls back to the built-in question bank, so a quiz always starts.
// Exposes window.FFAiQuiz = { MAX, generate(cfg) -> Promise<questions[]> }.
(function () {
    "use strict";

    // Swap these if the provider changes; both are key-less.
    var ENDPOINTS = {
        chat: "https://text.pollinations.ai/openai",   // OpenAI-style JSON response
        plain: "https://text.pollinations.ai/"         // same body, plain-text response
    };
    var MAX = 20;           // questions per request (keeps responses fast and complete)
    var TIMEOUT = 45000;    // ms per attempt

    var DEFAULT_TOPICS = "heap and sequential file organization, blocking factor and block I/O, primary/secondary/clustering indexes, " +
        "B and B+ trees, hashing, functional dependencies and normalization (1NF–BCNF), transactions, ACID, serializability, locking and recovery, SQL and relational algebra";

    var DIFF_TEXT = {
        easy: "easy (definitions and direct recall)",
        medium: "medium (apply one concept or do a short calculation)",
        hard: "hard (GATE 2-mark level: multi-step calculations or subtle conceptual traps)",
        mixed: "a mix: roughly one third easy, one third medium, one third hard"
    };

    function prompt(cfg) {
        var topics = (cfg.aiTopic && cfg.aiTopic.trim()) || (cfg.topics && cfg.topics.length ? cfg.topics.join(", ") : DEFAULT_TOPICS);
        return [
            {
                role: "system",
                content: "You are a DBMS professor writing exam questions for Indian B.Tech CSE students preparing for GATE. " +
                         "You only reply with valid JSON. Every question has exactly one correct option. Work every calculation out step by step before choosing the answer."
            },
            {
                role: "user",
                content: "Write " + cfg.count + " multiple-choice questions on: " + topics + ".\n" +
                    "Difficulty: " + DIFF_TEXT[cfg.diff || "mixed"] + ".\n" +
                    "Rules: exactly 4 short, distinct options per question; no 'all of the above' or 'none of the above'; " +
                    "numeric answers must be correct; vary the position of the correct option; no duplicate questions.\n" +
                    "Reply with ONLY this JSON (no markdown):\n" +
                    '{"questions":[{"q":"question text","opts":["A","B","C","D"],"a":0,"topic":"short topic name","diff":"easy|medium|hard","exp":"1-2 sentence worked explanation"}]}\n' +
                    '"a" is the 0-based index of the correct option. Random seed: ' + Math.floor(Math.random() * 1e6) + "."
            }
        ];
    }

    function withTimeout(url, opts) {
        var ctl = typeof AbortController !== "undefined" ? new AbortController() : null;
        var t = ctl ? setTimeout(function () { ctl.abort(); }, TIMEOUT) : null;
        if (ctl) opts.signal = ctl.signal;
        return fetch(url, opts).then(function (r) {
            if (t) clearTimeout(t);
            if (!r.ok) throw new Error("AI service returned " + r.status);
            return r.text();
        }, function (e) {
            if (t) clearTimeout(t);
            throw new Error(e && e.name === "AbortError" ? "AI service timed out" : "AI service unreachable");
        });
    }

    function body(cfg) {
        return JSON.stringify({ model: "openai", messages: prompt(cfg), seed: Math.floor(Math.random() * 1e9),
                                jsonMode: true, response_format: { type: "json_object" }, referrer: "fileforge" });
    }

    function askChat(cfg) {
        return withTimeout(ENDPOINTS.chat, { method: "POST", headers: { "Content-Type": "application/json" }, body: body(cfg) })
            .then(function (text) {
                try { var j = JSON.parse(text); if (j && j.choices) return j.choices[0].message.content; } catch (e) {}
                return text;
            });
    }
    function askPlain(cfg) {
        return withTimeout(ENDPOINTS.plain, { method: "POST", headers: { "Content-Type": "application/json" }, body: body(cfg) });
    }

    // ---- parse + validate whatever came back ----
    function extractJSON(text) {
        text = String(text || "").replace(/```(?:json)?/gi, "").trim();
        try { return JSON.parse(text); } catch (e) {}
        var a = text.indexOf("{"), b = text.lastIndexOf("}");
        if (a >= 0 && b > a) { try { return JSON.parse(text.slice(a, b + 1)); } catch (e) {} }
        a = text.indexOf("["); b = text.lastIndexOf("]");
        if (a >= 0 && b > a) { try { return JSON.parse(text.slice(a, b + 1)); } catch (e) {} }
        throw new Error("AI reply wasn't valid JSON");
    }

    function clean(s) { return String(s == null ? "" : s).replace(/^\s*(?:[A-Da-d][).:]|\([A-Da-d]\))\s+/, "").trim(); }

    function normalise(list, cfg) {
        var seen = {}, out = [];
        (Array.isArray(list) ? list : []).forEach(function (x) {
            if (!x || typeof x !== "object") return;
            var q = String(x.q || x.question || "").trim();
            var opts = (x.opts || x.options || x.choices || []).map(clean);
            if (q.length < 12 || opts.length !== 4) return;
            if (opts.some(function (o) { return !o || o.length > 220; })) return;
            if (opts.filter(function (o, i) { return opts.map(function (p) { return p.toLowerCase(); }).indexOf(o.toLowerCase()) === i; }).length !== 4) return;

            var a = x.a !== undefined ? x.a : x.answer !== undefined ? x.answer : x.correct;
            if (typeof a === "string") {
                var s = a.trim();
                if (/^[A-Da-d]$/.test(s)) a = "abcd".indexOf(s.toLowerCase());
                else if (/^\d$/.test(s)) a = parseInt(s, 10);
                else a = opts.map(function (o) { return o.toLowerCase(); }).indexOf(clean(s).toLowerCase());
            }
            if (typeof a !== "number" || a < 0 || a > 3 || a % 1) return;

            var key = q.toLowerCase().replace(/\W+/g, " ");
            if (seen[key]) return; seen[key] = 1;
            var diff = /^(easy|medium|hard)$/.test(x.diff) ? x.diff : (cfg.diff === "mixed" ? "medium" : cfg.diff);
            out.push({ id: "AI" + out.length, src: "AI", q: q, opts: opts, a: a, diff: diff,
                       topic: String(x.topic || "AI").slice(0, 32), exp: String(x.exp || x.explanation || "").trim(), ai: true });
        });
        return out;
    }

    function generate(cfg) {
        var c = Object.assign({}, cfg, { count: Math.min(cfg.count || 10, MAX) });
        function parse(text) {
            var j = extractJSON(text);
            var qs = normalise(Array.isArray(j) ? j : (j.questions || j.quiz || j.items || []), c);
            if (!qs.length) throw new Error("AI reply had no usable questions");
            return qs.slice(0, c.count);
        }
        return askChat(c).then(parse).catch(function () { return askPlain(c).then(parse); });
    }

    window.FFAiQuiz = { MAX: MAX, generate: generate, _normalise: normalise, _extract: extractJSON };
})();
