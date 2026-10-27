// FILEFORGE — Questions from your own documents
// Reads an uploaded PDF / DOCX / TXT in the browser and builds quiz questions
// from its text. Nothing is uploaded anywhere and no API key is needed:
//   • text extraction  — pdf.js (PDF) and mammoth (DOCX), loaded from a CDN on first use
//   • question building — key terms are found by frequency, then each good
//     sentence becomes a fill-in-the-blank MCQ (distractors are other real
//     terms from the same document) or a True/False statement.
//   • question papers — if the document already contains numbered questions
//     with A/B/C/D options and an answer key (or "Answer: B" lines), those
//     questions are imported exactly as written instead.
// Exposes window.FFDocQuiz = { ACCEPT, extract(file), generate(docs, cfg) }.
(function () {
    "use strict";

    var LIBS = {
        pdf: "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js",
        pdfWorker: "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js",
        docx: "https://cdn.jsdelivr.net/npm/mammoth@1.13.0/mammoth.browser.min.js"
    };
    var MAX_BYTES = 25 * 1024 * 1024;
    var ACCEPT = ".pdf,.docx,.txt,.md";

    // ------------------------------------------------------------------
    // Text extraction
    // ------------------------------------------------------------------
    var loaded = {};
    function loadScript(src) {
        if (loaded[src]) return loaded[src];
        loaded[src] = new Promise(function (resolve, reject) {
            var s = document.createElement("script");
            s.src = src;
            s.onload = resolve;
            s.onerror = function () {
                delete loaded[src];
                reject(new Error("Couldn't load the file reader — check your internet connection."));
            };
            document.head.appendChild(s);
        });
        return loaded[src];
    }

    function ext(name) { var m = /\.([a-z0-9]+)$/i.exec(name || ""); return m ? m[1].toLowerCase() : ""; }

    // Join pdf.js text items, inserting spaces from glyph positions and newlines at line ends.
    function pdfPageText(content) {
        var out = "", prev = null;
        content.items.forEach(function (it) {
            if (typeof it.str !== "string") return;
            if (prev && !prev.hasEOL && out && !/\s$/.test(out) && it.str && !/^\s/.test(it.str)) {
                var gap = it.transform[4] - (prev.transform[4] + (prev.width || 0));
                var size = Math.abs(it.transform[3]) || 10;
                var sameLine = Math.abs(it.transform[5] - prev.transform[5]) < size * 0.5;
                if (!sameLine) out += "\n";
                else if (gap > size * 0.15) out += " ";
            }
            out += it.str;
            if (it.hasEOL) out += "\n";
            prev = it;
        });
        return out;
    }

    function extractPdf(buf) {
        return loadScript(LIBS.pdf).then(function () {
            var lib = window.pdfjsLib;
            lib.GlobalWorkerOptions.workerSrc = LIBS.pdfWorker;
            return lib.getDocument({ data: buf }).promise;
        }).then(function (pdf) {
            var pages = [], chain = Promise.resolve();
            for (var n = 1; n <= pdf.numPages; n++) {
                (function (n) {
                    chain = chain.then(function () { return pdf.getPage(n); })
                        .then(function (p) { return p.getTextContent(); })
                        .then(function (c) { pages.push({ n: n, text: pdfPageText(c) }); });
                })(n);
            }
            return chain.then(function () { return pages; });
        });
    }

    function extractDocx(buf) {
        return loadScript(LIBS.docx).then(function () {
            return window.mammoth.extractRawText({ arrayBuffer: buf });
        }).then(function (r) { return [{ n: null, text: r.value || "" }]; });
    }

    // file -> Promise<{ name, kind, pages:[{n,text}], words }>
    function extract(file) {
        var kind = ext(file.name);
        if (kind === "doc") return Promise.reject(new Error("Old .doc files can't be read in the browser. Open it in Word and use Save As → .docx or PDF."));
        if (["pdf", "docx", "txt", "md"].indexOf(kind) < 0) return Promise.reject(new Error("Unsupported file type. Use PDF, DOCX or TXT."));
        if (file.size > MAX_BYTES) return Promise.reject(new Error("File is larger than 25 MB."));

        var job;
        if (kind === "txt" || kind === "md") {
            job = file.text().then(function (t) { return [{ n: null, text: t }]; });
        } else {
            job = file.arrayBuffer().then(function (buf) { return kind === "pdf" ? extractPdf(buf) : extractDocx(buf); });
        }
        return job.then(function (pages) {
            var words = pages.reduce(function (s, p) { return s + (p.text.match(/[A-Za-z]{2,}/g) || []).length; }, 0);
            if (words < 40) {
                throw new Error(kind === "pdf"
                    ? "No readable text found — this PDF is probably scanned images. Use a PDF with selectable text."
                    : "The document has too little text to build questions from.");
            }
            var doc = { name: file.name, kind: kind, pages: pages, words: words };
            doc.mcq = parseMCQ(doc);
            return doc;
        });
    }

    // ------------------------------------------------------------------
    // Question papers: numbered questions + A–D options + answer key
    // ------------------------------------------------------------------
    var Q_RE = /^\s*(?:Q(?:uestion)?\.?\s*)?(\d{1,3})\s*[.):]\s+(.+)$/i;
    var OPT_RE = /^\s*\(?([A-Fa-f])\s*[.)]\s+(.+)$/;
    var ANS_RE = /^\s*(?:ans(?:wer)?|correct\s+(?:answer|option)|key)\s*[:.\-–]\s*\(?([A-Fa-f])\)?(?:[.)\s]|$)/i;
    var EXP_RE = /^\s*(?:explanation|solution|reason)\s*[:.\-–]\s*(.+)$/i;
    var SEC_RE = /^\s*(?:section|part|unit)\s+[A-Z0-9]+\s*[—–:\-]\s*(.+?)\s*(?:\(\s*\d+\s*questions?\s*\))?\s*$/i;
    var KEY_HEAD = /^\s*(?:answer\s*key|answers|key\s*to\s*questions|solutions?)\s*:?\s*$/i;

    function parseMCQ(doc) {
        var lines = doc.pages.map(function (p) { return p.text; }).join("\n").replace(/\r/g, "").split("\n")
            .map(function (l) { return l.replace(/\s+/g, " ").trim(); }).filter(Boolean);
        // split off the answer key (last heading named "Answer Key" / "Answers")
        var keyAt = -1;
        lines.forEach(function (l, i) { if (KEY_HEAD.test(l)) keyAt = i; });
        var body = keyAt >= 0 ? lines.slice(0, keyAt) : lines, keyLines = keyAt >= 0 ? lines.slice(keyAt + 1) : [];
        var key = {};
        keyLines.forEach(function (l) {
            var m, re = /(?:^|[\s,;|])(\d{1,3})\s*[.):\-–]?\s*\(?([A-Fa-f])\)?(?=$|[\s,;|.])/g;
            while ((m = re.exec(l))) if (!key[m[1]]) key[m[1]] = m[2].toUpperCase();
        });

        var qs = [], cur = null, topic = null;
        function close() { if (cur) qs.push(cur); cur = null; }
        body.forEach(function (l) {
            var m;
            if ((m = SEC_RE.exec(l))) { close(); topic = m[1].replace(/\s*\(.*$/, ""); return; }
            if ((m = ANS_RE.exec(l)) && cur) { cur.ans = m[1].toUpperCase(); return; }
            if ((m = EXP_RE.exec(l)) && cur) { cur.exp = m[1]; return; }
            if ((m = OPT_RE.exec(l)) && cur) {
                var letter = m[1].toUpperCase();
                if (letter.charCodeAt(0) - 65 === cur.opts.length) { cur.opts.push(m[2]); return; }
            }
            if ((m = Q_RE.exec(l)) && (!cur || cur.opts.length >= 2 || !cur.opts.length)) {
                if (!cur || cur.opts.length) { close(); cur = { n: m[1], q: m[2], opts: [], topic: topic }; return; }
            }
            if (cur) { if (cur.opts.length) cur.opts[cur.opts.length - 1] += " " + l; else cur.q += " " + l; }
        });
        close();

        // options written on one line: "… A. x  B. y  C. z  D. w"
        qs.forEach(function (q) {
            if (q.opts.length >= 2) return;
            var parts = q.q.split(/\s\(?([A-D])[.)]\s/);
            if (parts.length >= 7 && parts[1] === "A") {
                q.q = parts[0]; q.opts = [];
                for (var i = 2; i < parts.length; i += 2) q.opts.push(parts[i].trim());
            }
        });

        var out = [], skipped = 0;
        qs.forEach(function (q) {
            var letter = q.ans || key[q.n];
            if (q.opts.length < 2 || !letter) { if (q.opts.length >= 2) skipped++; return; }
            var a = letter.charCodeAt(0) - 65;
            var low = q.opts.map(function (o) { return o.toLowerCase().replace(/\s+/g, " "); });
            if (a < 0 || a >= q.opts.length || low.some(function (o, i) { return low.indexOf(o) !== i; })) { skipped++; return; }
            var tag = null, text = q.q;
            var t = /^\[([^\]]{3,90})\]\s*/.exec(text);
            if (t) { tag = t[1]; text = text.slice(t[0].length); }
            out.push({ num: q.n, q: text, opts: q.opts, a: a, letter: letter, tag: tag, topic: q.topic, exp: q.exp || "" });
        });
        var numbered = qs.filter(function (q) { return q.opts.length >= 2; }).length;
        if (out.length < 3 || out.length < numbered * 0.5) return null;
        return { questions: out, skipped: skipped, total: numbered };
    }

    // ------------------------------------------------------------------
    // Sentences
    // ------------------------------------------------------------------
    var BULLET = /^\s*(?:[•●▪◦‣∙·\-–—*>]|\(?[0-9ivxIVX]{1,4}[.)]|\(?[a-hA-H][.)])\s+/;

    function sentencesOf(page) {
        var text = page.text
            .replace(/\r/g, "")
            .replace(/([A-Za-z])-\n([a-z])/g, "$1$2")          // re-join hyphenated line breaks
            .replace(/[ \t ]+/g, " ");
        // A block ends at a blank line, a bullet, or a short heading-like line.
        var lines = text.split("\n"), blocks = [], cur = "";
        lines.forEach(function (raw) {
            var line = raw.trim();
            if (!line) { if (cur) blocks.push(cur); cur = ""; return; }
            var isBullet = BULLET.test(line);
            var isHeading = line.split(" ").length <= 6 && !/[.,;:]$/.test(line);
            if (isBullet || isHeading) { if (cur) blocks.push(cur); cur = ""; }
            if (isHeading && !isBullet) { blocks.push(line); return; }
            cur = cur ? cur + " " + line.replace(BULLET, "") : line.replace(BULLET, "");
        });
        if (cur) blocks.push(cur);

        var out = [];
        blocks.forEach(function (b) {
            b.split(/(?<=[.!?])\s+(?=["“(]?[A-Z0-9])/).forEach(function (s) {
                s = s.trim().replace(/\s+/g, " ");
                var w = s.split(" ").length;
                if (w < 7 || w > 45) return;
                if (!/[.!?]["”)]?$/.test(s)) return;                 // keep complete sentences only
                var letters = (s.match(/[A-Za-z]/g) || []).length;
                if (letters / s.length < 0.65) return;               // skip formula / table debris
                if (/https?:\/\/|www\.|@\w+\./.test(s)) return;
                if (/^(figure|fig\.|table|source|copyright|page)\b/i.test(s)) return;
                out.push({ text: s, page: page.n });
            });
        });
        return out;
    }

    // ------------------------------------------------------------------
    // Key terms
    // ------------------------------------------------------------------
    var STOP = ("a about above after again against all also although always am among an and another any are aren't around as at " +
        "be because been before being below between both but by can cannot could did didn't do does doesn't doing done don't down during " +
        "each either else even ever every few first for from further get gets given gives go goes had has have having he her here hers him his how however " +
        "i if in into is isn't it it's its itself just last least less let like made make makes many may me might more most much must my " +
        "near need needs neither never next no nor not now of off often on once one only onto or other others otherwise our ours out over own " +
        "per perhaps rather really same second several shall she should since so some such than that the their theirs them themselves then there " +
        "therefore these they this those though three through thus to together too toward towards two under unless until up upon us use used uses using " +
        "usually very via was wasn't way ways we well were what whatever when where whereas whether which while who whom whose why will with within without " +
        "would yet you your yours also example examples e.g i.e etc figure fig table chapter section page pages shown show shows following follows called " +
        "known type types kind kinds different various number numbers part parts case cases thing things lot lots new old good bad high low large small " +
        "important main certain particular general specific simple common based within across along already able unit units refer refers referred " +
        "define defined defines definition means mean meaning include includes including included consist consists consisting provide provides provided " +
        "allow allows allowed called call calls term terms item items value values result results set sets order step steps time times").split(" ");
    var STOPSET = {}; STOP.forEach(function (w) { STOPSET[w] = 1; });
    var LEADS = { figure: 1, fig: 1, table: 1, page: 1, section: 1, chapter: 1, equation: 1, eq: 1, step: 1, version: 1, no: 1 };

    // Verb forms make poor answers ("index contains", "requires"); these are rejected as terms.
    var VERBS = ("contain overflow require provide store hold occur include specify determine guarantee ensure handle grow perform " +
        "remain consist allow support keep mean represent define describe return become give take make create follow depend refer apply " +
        "produce reduce increase improve move copy lead cause enable avoid prevent compute calculate show state involve indicate belong exist " +
        "appear build add remove compare reach wait execute implement maintain identify divide combine reflect persist fail serve tend " +
        "help try seem call work offer obtain").split(" ");
    var NOUNLIKE = { store: 1, copy: 1, support: 1, state: 1, "return": 1, work: 1, offer: 1, help: 1, call: 1, show: 1, move: 1, cause: 1, lead: 1, overflow: 1, increase: 1, wait: 1 };
    var VERBSET = {}; VERBS.forEach(function (v) { if (!NOUNLIKE[v]) VERBSET[v] = 1; });
    VERBS.forEach(function (v) { VERBSET[v + "s"] = 1; VERBSET[v + "es"] = 1; VERBSET[v.replace(/e$/, "") + "ed"] = 1; VERBSET[v.replace(/y$/, "i") + "es"] = 1; VERBSET[v.replace(/y$/, "i") + "ed"] = 1; });
    var FOLLOW = { a: 1, an: 1, the: 1, one: 1, only: 1, all: 1, each: 1, every: 1, how: 1, whether: 1, less: 1, more: 1, at: 1, up: 1, it: 1, them: 1, that: 1 };
    var verbish = {};   // per-document: "-s" words used like verbs ("index contains one…")
    function learnVerbs(sents) {
        verbish = {};
        sents.forEach(function (s) {
            var t = tokens(s.text);
            for (var k = 1; k < t.length - 1; k++) {
                var w = t[k].w.toLowerCase();
                if (/[^s]s$/.test(w) && !/(us|is)$/.test(w) && !isStop(t[k - 1].w) && FOLLOW[t[k + 1].w.toLowerCase()] &&
                    s.text.slice(t[k].end, t[k + 1].i) === " ") verbish[w] = 1;
            }
        });
    }
    function verbLike(w) { w = w.toLowerCase(); return VERBSET[w] === 1 || verbish[w] === 1 || (/ed$/.test(w) && w.length > 4); }

    var WORD = /[A-Za-z][A-Za-z0-9'’+#-]*[A-Za-z0-9+#]|[A-Za-z]/g;
    function isStop(w) { return STOPSET[w.toLowerCase()] === 1; }
    function isAcronym(w) { return /^[A-Z][A-Z0-9+#&]{1,6}s?$/.test(w) && /[A-Z].*[A-Z]|[A-Z][0-9]/.test(w); }
    function stem(w) { return w.toLowerCase().replace(/(ies|es|s|ing|ed|ly)$/, ""); }

    function tokens(s) {
        var out = [], m;
        WORD.lastIndex = 0;
        while ((m = WORD.exec(s))) out.push({ w: m[0], i: m.index, end: m.index + m[0].length });
        return out;
    }

    // Candidate terms (1 or 2 words) occurring in a sentence, with their exact surface text.
    function candidates(s) {
        var t = tokens(s), out = [];
        for (var k = 0; k < t.length; k++) {
            var a = t[k];
            var okA = !isStop(a.w) && (a.w.length >= 4 || isAcronym(a.w)) && !verbLike(a.w);
            var b = t[k + 1];
            var mod = !!(b && s.slice(a.end, b.i) === " " && !isStop(b.w));   // used as a modifier ("internal node")
            if (okA) out.push({ key: a.w.toLowerCase(), surface: a.w, i: a.i, end: a.end, words: 1, acr: isAcronym(a.w), first: k === 0, mod: mod });
            if (okA && b && s.slice(a.end, b.i) === " " && !isStop(b.w) && !verbLike(b.w) && (b.w.length >= 3 || isAcronym(b.w))) {
                out.push({ key: (a.w + " " + b.w).toLowerCase(), surface: a.w + " " + b.w, i: a.i, end: b.end, words: 2, acr: false, first: k === 0, mod: false });
            }
        }
        return out;
    }

    function buildTerms(sents) {
        var terms = {};
        sents.forEach(function (s, si) {
            var seen = {};
            candidates(s.text).forEach(function (c) {
                if (seen[c.key]) return; seen[c.key] = 1;
                var t = terms[c.key] || (terms[c.key] = { key: c.key, freq: 0, mods: 0, words: c.words, acr: c.acr, forms: {}, sents: [] });
                t.freq++;
                if (c.mod) t.mods++;
                t.sents.push(si);
                if (!c.first) t.forms[c.surface] = (t.forms[c.surface] || 0) + 1;   // casing as used mid-sentence
            });
        });
        var list = Object.keys(terms).map(function (k) { return terms[k]; }).filter(function (t) {
            if (t.words === 2) return t.freq >= 2;
            return t.freq >= 2 || t.acr;
        });
        list.forEach(function (t) {
            var best = null;
            Object.keys(t.forms).forEach(function (f) { if (!best || t.forms[f] > t.forms[best]) best = f; });
            t.display = best || t.key;
            t.score = t.freq * (t.words === 2 ? 1.8 : 1) * (t.acr ? 1.3 : 1) * Math.min(1.5, 0.7 + t.key.length / 12);
        });
        list.sort(function (a, b) { return b.score - a.score; });
        list.forEach(function (t, i) { t.rank = list.length > 1 ? i / (list.length - 1) : 0; });
        var map = {}; list.forEach(function (t) { map[t.key] = t; });
        return { list: list, map: map, vb: verbish };
    }

    // ------------------------------------------------------------------
    // Question building
    // ------------------------------------------------------------------
    function shuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var x = a[i]; a[i] = a[j]; a[j] = x; } return a; }
    function related(a, b) {
        var x = a.toLowerCase(), y = b.toLowerCase();
        if (x === y || x.indexOf(y) >= 0 || y.indexOf(x) >= 0) return true;
        var sx = x.split(" ").map(stem), sy = y.split(" ").map(stem);
        return sx.some(function (p) { return p.length > 2 && sy.indexOf(p) >= 0; });
    }
    function plural(key) { return /[^s'’]s$/i.test(key.split(" ").pop()) && !/(us|is|ss)$/i.test(key); }
    // "a" / "an" before a word that changes (blank or swapped term) would give the answer away
    function fixArticle(before, word) {
        var m = /(^|\s)(a|an|A|An)\s$/.exec(before);
        if (!m) return before;
        var art = word === null ? "a(n)" : (/^[aeiou]/i.test(word) && !/^(uni|use|eu|one)/i.test(word) ? "an" : "a");
        if (/^[A-Z]/.test(m[2])) art = art.charAt(0).toUpperCase() + art.slice(1);
        return before.slice(0, before.length - m[2].length - 1) + art + " ";
    }
    function matchCase(form, like) {
        if (/^[a-z]/.test(like) && /^[A-Z][a-z]/.test(form) && form.split(" ").every(function (w) { return !isAcronym(w); })) return form.toLowerCase();
        return form;
    }

    function pickDistractors(term, sentence, terms, diff, asMod) {
        var low = sentence.toLowerCase();
        var pool = terms.list.filter(function (t) {
            return t !== term && t.words === term.words && t.acr === term.acr &&
                   !related(t.key, term.key) && low.indexOf(t.key) < 0;
        });
        var sameNumber = pool.filter(function (t) { return plural(t.key) === plural(term.key); });
        if (sameNumber.length >= 3) pool = sameNumber;
        if (term.words === 1) {
            var sameRole = pool.filter(function (t) { return (t.mods / t.freq > 0.5) === asMod; });
            if (sameRole.length >= 3) pool = sameRole;
        }
        if (diff === "hard") {
            // most confusable: similar length, similar ending, similar importance
            pool.forEach(function (t) {
                t._sim = -Math.abs(t.key.length - term.key.length) * 0.4
                         - Math.abs(t.rank - term.rank) * 6
                         + (t.key.slice(-3) === term.key.slice(-3) ? 2 : 0)
                         + Math.random();
            });
            pool.sort(function (a, b) { return b._sim - a._sim; });
            pool = pool.slice(0, 8);
        } else if (diff === "medium") {
            pool = pool.slice(0, Math.max(12, Math.floor(pool.length / 2)));  // the doc's main terms
        }
        var picked = [];
        shuffle(pool).forEach(function (t) {
            if (picked.length < 3 && picked.every(function (p) { return !related(p.key, t.key); })) picked.push(t);
        });
        return picked.length === 3 ? picked : null;
    }

    function numberDistractors(n) {
        var isInt = /^\d+$/.test(n), v = parseFloat(n), set = {}, out = [];
        set[n] = 1;
        var year = isInt && v >= 1800 && v <= 2100;
        var steps = year ? [1, 2, 3, 5, 10, -1, -2, -3, -5, -10]
                  : isInt ? (v < 10 ? [1, 2, 3, -1, -2, 4] : [1, 2, -1, -2, Math.round(v * 0.5), -Math.round(v * 0.5), v, Math.round(v * 0.25)])
                  : [v * 0.1, -v * 0.1, v * 0.5, v];
        shuffle(steps).forEach(function (d) {
            if (out.length >= 3) return;
            var c = isInt ? String(Math.round(v + d)) : String(+(v + d).toFixed(n.split(".")[1].length));
            if (parseFloat(c) > 0 && !set[c]) { set[c] = 1; out.push(c); }
        });
        return out.length === 3 ? out : null;
    }

    function where(doc, s) { return doc.kind === "pdf" && s.page ? " (page " + s.page + ")" : ""; }
    function quote(s) { return "“" + s + "”"; }
    function blank(s, c) { return fixArticle(s.slice(0, c.i), null) + "______" + s.slice(c.end); }

    // Best term to blank in a sentence: a known, important term that isn't the very first word.
    function bestTerm(sentence, terms, used) {
        var best = null;
        candidates(sentence).forEach(function (c) {
            var t = terms.map[c.key];
            if (!t || used[t.key]) return;
            var sc = t.score * (c.first ? 0.5 : 1);
            if (!best || sc > best.sc) best = { t: t, c: c, sc: sc };
        });
        return best;
    }

    function definitional(s) { return /\b(is|are) (a|an|the|defined|called|known|used)\b|\brefers? to\b|\bconsists? of\b|\bis called\b|\bmeans\b/i.test(s); }

    // docs: [{name, kind, pages}], cfg: {count, diff}
    function generate(docs, cfg) {
        var want = cfg.count || 10, out = [], usedTerms = {};
        var all = [];

        // Documents that are question papers: use their own questions and answer key.
        var imported = [];
        docs.forEach(function (doc) {
            if (!doc.mcq) return;
            doc.mcq.questions.forEach(function (m) {
                imported.push({
                    id: "M" + imported.length, q: m.q, opts: m.opts.slice(), a: m.a, diff: "imported",
                    topic: m.topic || doc.name.replace(/\.[^.]+$/, ""), src: doc.kind.toUpperCase(), tag: m.tag,
                    exp: (m.exp ? m.exp + " " : "") + "Answer " + m.letter + " per the answer key in " + doc.name + " (question " + m.num + ")."
                });
            });
        });
        docs = docs.filter(function (d) { return !d.mcq; });
        if (!docs.length) return shuffle(imported).slice(0, want);
        if (imported.length) want = Math.max(0, want - Math.min(imported.length, Math.ceil(want / 2)));

        docs.forEach(function (doc) {
            var sents = [];
            doc.pages.forEach(function (p) { sents = sents.concat(sentencesOf(p)); });
            var seenText = {};
            sents = sents.filter(function (s) { var k = s.text.toLowerCase(); if (seenText[k]) return false; seenText[k] = 1; return true; });
            learnVerbs(sents);
            var terms = buildTerms(sents);
            sents.forEach(function (s, idx) { all.push({ doc: doc, s: s, idx: idx, terms: terms }); });
        });
        if (!all.length) return imported.length ? shuffle(imported).slice(0, cfg.count || 10) : [];

        // Rank sentences: definitions and sentences carrying the doc's key terms first; spread across the document.
        all.forEach(function (x) {
            verbish = x.terms.vb;
            var b = bestTerm(x.s.text, x.terms, {});
            x.weight = (b ? b.sc : 0) * (definitional(x.s.text) ? 1.6 : 1) + Math.random() * 0.8;
        });
        var ranked = all.slice().sort(function (a, b) { return b.weight - a.weight; });

        var chosenIdx = {};
        for (var r = 0; r < ranked.length && out.length < want; r++) {
            var x = ranked[r], s = x.s.text, key = x.doc.name + "#" + x.idx;
            if (chosenIdx[x.doc.name + "#" + (x.idx - 1)] || chosenIdx[x.doc.name + "#" + (x.idx + 1)]) continue;  // avoid back-to-back sentences
            var diff = cfg.diff === "mixed" ? ["easy", "medium", "hard"][out.length % 3] : cfg.diff;
            var q = null;

            var num = /(?:^|[\s(])(\d{1,4}(?:\.\d+)?)(?=[\s,.;:%)])/.exec(s);
            verbish = x.terms.vb;
            var b = bestTerm(s, x.terms, usedTerms);

            // occasionally make a numeric question when the sentence states a figure
            if (num && Math.random() < 0.35) {
                var before = s.slice(0, num.index + num[0].indexOf(num[1])).trim().split(" ").pop().toLowerCase().replace(/\W/g, "");
                var dn = !LEADS[before] && numberDistractors(num[1]);
                if (dn) {
                    var at = num.index + num[0].indexOf(num[1]);
                    var opts = shuffle([num[1]].concat(dn));
                    q = { q: "Fill in the blank: " + s.slice(0, at) + "______" + s.slice(at + num[1].length),
                          opts: opts, a: opts.indexOf(num[1]), diff: diff,
                          exp: "The document" + where(x.doc, x.s) + " states: " + quote(s) };
                }
            }

            if (!q && b) {
                var d = diff;
                var ans = b.c.first ? matchCase(b.t.display, "x") === b.t.display.toLowerCase() && !isAcronym(b.c.surface) ? b.t.display.toLowerCase() : b.t.display : b.c.surface;
                var tf = d === "easy" && Math.random() < 0.4;
                var ds = pickDistractors(b.t, s, x.terms, d, b.c.mod);
                if (ds && tf) {
                    var makeFalse = Math.random() < 0.5;
                    var swap = matchCase(ds[0].display, b.c.surface);
                    var stmt = makeFalse ? fixArticle(s.slice(0, b.c.i), swap) + swap + s.slice(b.c.end) : s;
                    q = { q: "True or false? " + quote(stmt), opts: ["True", "False"], a: makeFalse ? 1 : 0, tf: true, diff: "easy",
                          exp: (makeFalse ? "False — the document" + where(x.doc, x.s) + " says “" + b.c.surface + "”, not “" + swap + "”: "
                                          : "True — this is stated in the document" + where(x.doc, x.s) + ": ") + quote(s) };
                } else if (ds) {
                    var opts2 = shuffle([ans].concat(ds.map(function (t) { return matchCase(t.display, ans); })));
                    q = { q: "Fill in the blank: " + blank(s, b.c), opts: opts2, a: opts2.indexOf(ans), diff: d,
                          exp: "The document" + where(x.doc, x.s) + " states: " + quote(s) };
                }
                if (q) usedTerms[b.t.key] = 1;
            }

            if (!q) continue;
            chosenIdx[key] = 1;
            q.order = x.doc.name + "#" + String(x.idx).padStart(6, "0");
            q.topic = x.doc.name.replace(/\.[^.]+$/, "");
            q.src = x.doc.kind.toUpperCase();
            q.id = "D" + out.length;
            out.push(q);
        }
        // present in reading order
        out.sort(function (a, b) { return a.order < b.order ? -1 : 1; });
        if (imported.length) out = shuffle(imported).slice(0, (cfg.count || 10) - out.length).concat(out);
        return out;
    }

    window.FFDocQuiz = { ACCEPT: ACCEPT, extract: extract, generate: generate, _sentences: sentencesOf, _parseMCQ: parseMCQ };
})();
