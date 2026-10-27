// FILEFORGE — Role-based data entry ("professional profiles")
// Students keep the classic record: ID | Name | Department | Marks.
// Working professionals get a record that matches their job (e.g. a network
// admin enters Device ID | Hostname | Zone | Latency instead of Marks).
//
// Self-contained add-on, same style as session.js / charts.js:
//   - reads the session that session.js saves (localStorage "fileforgeSession")
//   - relabels the Input Record form + the Help text
//   - swaps the validation rule (Marks 0-100 -> the profile's own range)
//   - re-skins generated / experiment / imported records and the record cards
// Internally every record is still { id, name, dept, marks }, so searching,
// binary search, blocks, packing factor etc. are untouched.
(function () {
    "use strict";

    var SESSION_KEY = "fileforgeSession";
    var STUDENT_DEPTS = ["CSE", "ECE", "IT", "AIML", "ME"];

    // ---- Profiles -----------------------------------------------------------
    // idLabel / nameLabel / catLabel / valueLabel : text shown above the inputs
    // short + prefix + suffix                      : how the value shows on a record card
    // min / max / step                             : allowed range for the 4th field
    // cats / names                                 : used to re-skin sample data
    var PROFILES = {
        banking: {
            idLabel: "ACCOUNT NO.", nameLabel: "ACCOUNT HOLDER", catLabel: "BRANCH", valueLabel: "BALANCE (₹)",
            namePh: "Rahul", catPh: "Chennai", valuePh: "42500",
            short: "Balance", prefix: "₹", suffix: "",
            min: 0, max: 500000, step: 500,
            cats: ["Chennai", "Mumbai", "Delhi", "Pune", "Kolkata"],
            help: "Account No., Account Holder, Branch, Balance in ₹"
        },
        network: {
            idLabel: "DEVICE ID", nameLabel: "HOSTNAME", catLabel: "NETWORK ZONE", valueLabel: "LATENCY (ms)",
            namePh: "core-sw-01", catPh: "DMZ", valuePh: "24",
            short: "Latency", prefix: "", suffix: " ms",
            min: 0, max: 200, step: 1,
            cats: ["Core", "Edge", "DMZ", "Access", "WAN"],
            names: ["core-sw-01", "edge-rtr-02", "dmz-fw-01", "acc-sw-07", "wan-rtr-03", "vpn-gw-01", "ap-lobby-04", "core-sw-02"],
            help: "Device ID, Hostname, Network Zone, Latency 0–200 ms"
        },
        cyber: {
            idLabel: "EVENT ID", nameLabel: "SOURCE HOST", catLabel: "THREAT TYPE", valueLabel: "SEVERITY (1–10)",
            namePh: "web-srv-03", catPh: "Phishing", valuePh: "7",
            short: "Severity", prefix: "", suffix: "/10",
            min: 1, max: 10, step: 1,
            cats: ["Malware", "Phishing", "Brute-force", "Recon", "Policy"],
            names: ["web-srv-03", "hr-laptop-12", "db-prod-01", "vpn-gw-01", "mail-relay-02", "dev-vm-09", "fin-ws-05", "guest-ap-02"],
            help: "Event ID, Source Host, Threat Type, Severity 1–10"
        },
        teacher: {
            idLabel: "ROLL NO.", nameLabel: "STUDENT NAME", catLabel: "CLASS / SECTION", valueLabel: "MARKS (0–100)",
            namePh: "Rahul", catPh: "10-A", valuePh: "85",
            short: "Marks", prefix: "", suffix: "",
            min: 0, max: 100, step: 1,
            cats: ["10-A", "10-B", "11-A", "11-B", "12-A"],
            help: "Roll No., Student Name, Class / Section, Marks 0–100"
        },
        dba: {
            idLabel: "ROW ID", nameLabel: "TABLE NAME", catLabel: "SCHEMA", valueLabel: "SIZE (MB)",
            namePh: "orders", catPh: "sales", valuePh: "128",
            short: "Size", prefix: "", suffix: " MB",
            min: 0, max: 500, step: 1,
            cats: ["sales", "hr", "finance", "audit", "inventory"],
            names: ["orders", "customers", "invoices", "payments", "employees", "products", "shipments", "audit_log"],
            help: "Row ID, Table Name, Schema, Size 0–500 MB"
        },
        backend: {
            idLabel: "REQUEST ID", nameLabel: "ENDPOINT", catLabel: "SERVICE", valueLabel: "RESPONSE TIME (ms)",
            namePh: "/api/orders", catPh: "payments", valuePh: "120",
            short: "Response", prefix: "", suffix: " ms",
            min: 0, max: 300, step: 1,
            cats: ["auth", "payments", "orders", "search", "notify"],
            names: ["/api/login", "/api/orders", "/api/pay", "/api/search", "/api/cart", "/api/users", "/api/notify", "/api/items"],
            help: "Request ID, Endpoint, Service, Response Time 0–300 ms"
        },
        support: {
            idLabel: "TICKET ID", nameLabel: "REQUESTED BY", catLabel: "CATEGORY", valueLabel: "PRIORITY (1–5)",
            namePh: "Rahul", catPh: "Network", valuePh: "2",
            short: "Priority", prefix: "P", suffix: "",
            min: 1, max: 5, step: 1,
            cats: ["Hardware", "Software", "Network", "Access", "Email"],
            help: "Ticket ID, Requested By, Category, Priority 1–5"
        },
        // Fallback for "Other" / a typed-in role
        general: {
            idLabel: "RECORD ID", nameLabel: "NAME", catLabel: "DEPARTMENT", valueLabel: "VALUE (0–100)",
            namePh: "Rahul", catPh: "Operations", valuePh: "85",
            short: "Value", prefix: "", suffix: "",
            min: 0, max: 100, step: 1,
            cats: ["Operations", "Finance", "HR", "IT", "Sales"],
            help: "Record ID, Name, Department, Value 0–100"
        }
    };

    // Keys are the exact strings offered in session.js (PROFESSIONAL_ROLES)
    var ROLE_TO_KEY = {
        "Banking & Financial Systems": "banking",
        "Network Administrator / Engineer": "network",
        "Cybersecurity / Security Analyst": "cyber",
        "School / College Teacher": "teacher",
        "Database Administrator (DBA)": "dba",
        "Software / Backend Engineer": "backend",
        "IT Support / Sysadmin": "support"
    };

    var FIELD_IDS = ["recordId", "recordName", "recordDept", "recordMarks"];
    var activeKey = null;   // null = student / explorer (classic fields)
    var defaults = null;    // original labels + placeholders, captured once

    function $(id) { return document.getElementById(id); }

    function loadSession() {
        try { return JSON.parse(localStorage.getItem(SESSION_KEY) || "null"); }
        catch (e) { return null; }
    }

    function profileKeyFor(session) {
        if (!session || session.role !== "employee") return null;
        return ROLE_TO_KEY[session.course] || "general";
    }

    function fmt(p, value) {
        return p.prefix + Number(value).toLocaleString("en-IN") + p.suffix;
    }

    function hash(text) {
        var h = 0, s = String(text);
        for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
        return h;
    }

    // ---- Form labels / placeholders / help text -----------------------------
    function labelOf(inputId) {
        var input = $(inputId);
        return input ? input.previousElementSibling : null;
    }

    function captureDefaults() {
        if (defaults) return;
        defaults = { fields: {}, help: "" };
        FIELD_IDS.forEach(function (id) {
            var input = $(id);
            var label = labelOf(id);
            if (!input) return;
            defaults.fields[id] = {
                label: label ? label.textContent : "",
                ph: input.getAttribute("placeholder"),
                min: input.getAttribute("min"),
                max: input.getAttribute("max"),
                step: input.getAttribute("step")
            };
        });
        var help = $("helpFieldList");
        defaults.help = help ? help.textContent : "";
    }

    function setAttr(el, name, value) {
        if (value === null || value === undefined) el.removeAttribute(name);
        else el.setAttribute(name, value);
    }

    function applyLabels(key) {
        captureDefaults();
        var p = key ? PROFILES[key] : null;

        FIELD_IDS.forEach(function (id) {
            var input = $(id);
            var label = labelOf(id);
            var d = defaults.fields[id];
            if (!input || !d) return;

            var text = d.label, ph = d.ph, min = d.min, max = d.max, step = d.step;
            if (p) {
                if (id === "recordId")   { text = p.idLabel; }
                if (id === "recordName") { text = p.nameLabel; ph = p.namePh; }
                if (id === "recordDept") { text = p.catLabel;  ph = p.catPh; }
                if (id === "recordMarks") {
                    text = p.valueLabel; ph = p.valuePh;
                    min = p.min; max = p.max; step = p.step;
                }
            }
            if (label) label.textContent = text;
            setAttr(input, "placeholder", ph);
            setAttr(input, "min", min);
            setAttr(input, "max", max);
            setAttr(input, "step", step);
        });

        var help = $("helpFieldList");
        if (help) help.textContent = p ? p.help : defaults.help;
    }

    // ---- Re-skinning records between profiles -------------------------------
    // A record remembers which profile it was written in (_p) and its original
    // student-style name (_n). Converting keeps its *relative* value (e.g. "85%
    // of the range"), so sample data still looks sensible for every role, and
    // switching role mid-demo converts what is already on screen.
    function convertRecord(r, key) {
        var from = r._p && PROFILES[r._p] ? r._p : null;
        if (from === key) return;

        var src = from ? PROFILES[from] : null;
        var dst = key ? PROFILES[key] : null;

        var lo = src ? src.min : 0;
        var hi = src ? src.max : 100;
        var f = hi > lo ? (Number(r.marks) - lo) / (hi - lo) : 0;
        f = isNaN(f) ? 0 : Math.min(1, Math.max(0, f));

        var srcCats = src ? src.cats : STUDENT_DEPTS;
        var dstCats = dst ? dst.cats : STUDENT_DEPTS;
        var ci = srcCats.indexOf(r.dept);
        if (ci < 0) ci = hash(r.dept);
        r.dept = dstCats[ci % dstCats.length];

        if (!src && r._n === undefined) r._n = r.name;
        if (dst && dst.names) {
            r.name = dst.names[hash(r._n !== undefined ? r._n : r.name) % dst.names.length];
        } else if (r._n !== undefined) {
            r.name = r._n;
        }

        if (dst) {
            r.marks = dst.min + Math.round(f * (dst.max - dst.min) / dst.step) * dst.step;
            r._p = key;
        } else {
            r.marks = Math.round(f * 100);
            delete r._p;
            delete r._n;
        }
    }

    function syncRecords() {
        var lists = [];
        try { if (typeof heap !== "undefined" && Array.isArray(heap)) lists.push(heap); } catch (e) { /* not defined */ }
        try { if (typeof sequential !== "undefined" && Array.isArray(sequential)) lists.push(sequential); } catch (e) { /* not defined */ }
        lists.forEach(function (list) {
            list.forEach(function (r) { if (r && typeof r === "object") convertRecord(r, activeKey); });
        });
    }

    // Record cards are drawn by renderFiles() as "Marks: 85" — relabel them
    function patchCards() {
        if (!activeKey) return;
        var p = PROFILES[activeKey];
        var nodes = document.querySelectorAll(".record:not(.empty-slot) small");
        for (var i = 0; i < nodes.length; i++) {
            var m = /^Marks:\s*(-?[\d.]+)$/.exec(nodes[i].textContent.trim());
            if (m) nodes[i].textContent = p.short + ": " + fmt(p, Number(m[1]));
        }
    }

    function notify(message) {
        if (typeof window.toast === "function") window.toast(message, "error");
    }

    // ---- Hooks into the simulator (by function name) ------------------------
    function installHooks() {
        if (typeof window.getRecord === "function") {
            var origGetRecord = window.getRecord;
            window.getRecord = function () {
                if (!activeKey) return origGetRecord.apply(this, arguments);

                var p = PROFILES[activeKey];
                var id = Number($("recordId").value);
                var name = $("recordName").value.trim();
                var dept = $("recordDept").value.trim();
                var raw = $("recordMarks").value.trim();
                var value = Number(raw);

                if (!id || !name || !dept || raw === "" || isNaN(value)) {
                    notify("Please enter all record details (" + p.help.split(",").slice(0, 3).join(",").trim() +
                        ", " + p.short + ").");
                    return null;
                }
                if (value < p.min || value > p.max) {
                    notify(p.short + " must be between " + fmt(p, p.min) + " and " + fmt(p, p.max) + ".");
                    return null;
                }
                return { id: id, name: name, dept: dept, marks: value, _p: activeKey };
            };
        } else {
            console.warn("[profile.js] getRecord() not found — form validation left unchanged.");
        }

        if (typeof window.renderFiles === "function") {
            var origRender = window.renderFiles;
            window.renderFiles = function () {
                syncRecords();
                var out = origRender.apply(this, arguments);
                patchCards();
                return out;
            };
        } else {
            console.warn("[profile.js] renderFiles() not found — record cards left unchanged.");
        }
    }

    function setSession(session) {
        var key = profileKeyFor(session);
        var changed = key !== activeKey;
        activeKey = key;
        applyLabels(key);
        if (changed && typeof window.renderFiles === "function") window.renderFiles();
        else patchCards();
    }

    installHooks();
    setSession(loadSession());

    // session.js fires this when the visitor presses "Enter Lab"
    document.addEventListener("fileforge:session", function (event) {
        setSession(event.detail);
    });
})();
