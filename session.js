// FILEFORGE — Intro boot animation + audience session setup
// Self-contained: builds its own overlay, reads/writes only its own
// localStorage key, and does not touch state.js / storage.js / any
// other module. Safe to drop in regardless of the rest of the app.
(function () {
    "use strict";

    var STORAGE_KEY = "fileforgeSession";
    var reducedMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Student picks a course/subject; working professionals pick the kind of
    // job this simulator is relevant to instead.
    var STUDENT_SUBJECTS = [
        "Database Management Systems",
        "Data Structures & Algorithms",
        "Operating Systems",
        "Computer Networks",
        "Other"
    ];

    var PROFESSIONAL_ROLES = [
        "Banking & Financial Systems",
        "Network Administrator / Engineer",
        "Cybersecurity / Security Analyst",
        "School / College Teacher",
        "Database Administrator (DBA)",
        "Software / Backend Engineer",
        "IT Support / Sysadmin",
        "Other"
    ];

    var DETAIL_LABEL = {
        student: "Subject / Course",
        employee: "Job Role / Domain"
    };

    var DETAIL_HINT = {
        student: "Used to tag this session — shown in the sidebar and About page.",
        employee: "Heap vs Sequential trade-offs map directly onto real systems: append-only audit logs and " +
            "transaction feeds behave like Heap files, while indexed customer or subscriber lookups behave like Sequential files. " +
            "The record fields in the simulator adapt to the role you pick."
    };

    var BOOT_MESSAGES = [
        "Booting simulation engine…",
        "Mounting heap blocks…",
        "Indexing sequential file…",
        "Calibrating block I/O costs…",
        "Ready."
    ];

    function $(id) { return document.getElementById(id); }

    function loadSession() {
        try {
            return JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
        } catch (e) {
            return null;
        }
    }

    function saveSession(data) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        } catch (e) {
            /* storage unavailable — session just won't persist across visits */
        }
    }

    function roleLabel(role) {
        if (role === "student") return "🎓 Student";
        if (role === "employee") return "💼 Working Professional";
        return "🧭 Exploring";
    }

    function optionsFor(role) {
        return role === "student" ? STUDENT_SUBJECTS : PROFESSIONAL_ROLES;
    }

    function buildOverlay(skipBoot) {
        var overlay = document.createElement("div");
        overlay.id = "introOverlay";
        overlay.className = "intro-overlay";
        overlay.setAttribute("role", "dialog");
        overlay.setAttribute("aria-modal", "true");
        overlay.setAttribute("aria-label", "FILEFORGE session setup");

        overlay.innerHTML =
            '<div class="intro-stage intro-boot" id="introBoot">' +
                '<button type="button" class="intro-skip" id="introSkip">Skip →</button>' +
                '<div class="intro-mark">◆</div>' +
                '<div class="intro-word">FILEFORGE</div>' +
                '<div class="intro-bar"><div class="intro-bar-fill" id="introBarFill"></div></div>' +
                '<div class="intro-status" id="introStatus">' + BOOT_MESSAGES[0] + '</div>' +
            '</div>' +
            '<div class="intro-stage intro-card" id="introCard" hidden>' +
                '<div class="status-badge intro-badge"><span></span> SESSION SETUP</div>' +
                '<h2 class="intro-title">Who’s exploring FILEFORGE?</h2>' +
                '<p class="intro-sub">This just tailors the lab a little — pick what fits best.</p>' +
                '<div class="intro-roles" id="introRoles">' +
                    '<button type="button" class="intro-role-btn" data-role="student">🎓<span>Student</span></button>' +
                    '<button type="button" class="intro-role-btn" data-role="employee">💼<span>Working Professional</span></button>' +
                    '<button type="button" class="intro-role-btn" data-role="explorer">🧭<span>Just Exploring</span></button>' +
                '</div>' +
                '<div class="intro-course-row" id="introCourseRow" hidden>' +
                    '<label for="introCourseSelect" id="introCourseLabel">Subject / Course</label>' +
                    '<select id="introCourseSelect"></select>' +
                    '<input type="text" id="introCourseCustom" placeholder="Type it in" hidden>' +
                    '<p class="intro-detail-hint" id="introDetailHint"></p>' +
                '</div>' +
                '<button type="button" class="primary-btn intro-enter-btn" id="introEnterBtn" disabled>Enter Lab <span>→</span></button>' +
            '</div>';

        document.body.appendChild(overlay);
        wireOverlay(skipBoot);
        return overlay;
    }

    function populateOptions(role) {
        var select = $("introCourseSelect");
        select.innerHTML = "";
        optionsFor(role).forEach(function (c) {
            var opt = document.createElement("option");
            opt.value = c;
            opt.textContent = c;
            select.appendChild(opt);
        });
    }

    function wireOverlay(skipBoot) {
        var existing = loadSession();
        var boot = $("introBoot");
        var card = $("introCard");
        var barFill = $("introBarFill");
        var statusEl = $("introStatus");
        var skipBtn = $("introSkip");
        var roleButtons = document.querySelectorAll(".intro-role-btn");
        var courseRow = $("introCourseRow");
        var courseLabel = $("introCourseLabel");
        var courseSelect = $("introCourseSelect");
        var courseCustom = $("introCourseCustom");
        var detailHint = $("introDetailHint");
        var enterBtn = $("introEnterBtn");

        var selectedRole = existing ? existing.role : null;

        function currentDetailValue() {
            if (courseSelect.value === "Other") return courseCustom.value.trim();
            return courseSelect.value;
        }

        function needsDetail(role) {
            return role === "student" || role === "employee";
        }

        function syncRoleUI() {
            roleButtons.forEach(function (btn) {
                btn.classList.toggle("active", btn.getAttribute("data-role") === selectedRole);
            });
            var showDetail = needsDetail(selectedRole);
            courseRow.hidden = !showDetail;
            if (showDetail) {
                courseLabel.textContent = DETAIL_LABEL[selectedRole];
                detailHint.textContent = DETAIL_HINT[selectedRole];
            }
            enterBtn.disabled = !selectedRole || (showDetail && !currentDetailValue());
        }

        roleButtons.forEach(function (btn) {
            btn.addEventListener("click", function () {
                var role = btn.getAttribute("data-role");
                var roleChanged = role !== selectedRole;
                selectedRole = role;
                if (roleChanged && needsDetail(role)) {
                    populateOptions(role);
                    courseCustom.hidden = true;
                    courseCustom.value = "";
                }
                syncRoleUI();
            });
        });

        courseSelect.addEventListener("change", function () {
            courseCustom.hidden = courseSelect.value !== "Other";
            if (courseSelect.value !== "Other") courseCustom.value = "";
            syncRoleUI();
        });

        courseCustom.addEventListener("input", syncRoleUI);

        if (existing && needsDetail(existing.role) && existing.course) {
            populateOptions(existing.role);
            var list = optionsFor(existing.role);
            var matched = list.indexOf(existing.course) !== -1 ? existing.course : "Other";
            courseSelect.value = matched;
            if (matched === "Other") {
                courseCustom.hidden = false;
                courseCustom.value = existing.course;
            }
        } else {
            populateOptions("student");
        }
        syncRoleUI();

        enterBtn.addEventListener("click", function () {
            var session = {
                role: selectedRole,
                course: needsDetail(selectedRole) ? currentDetailValue() : null,
                ts: Date.now()
            };
            saveSession(session);
            closeOverlay(session);
        });

        function goToCard() {
            boot.hidden = true;
            card.hidden = false;
            card.classList.add("intro-stage-in");
        }

        skipBtn.addEventListener("click", goToCard);

        if (skipBoot || reducedMotion) {
            goToCard();
            return;
        }

        var step = 0;
        var duration = existing ? 900 : 1800;
        var stepTime = duration / BOOT_MESSAGES.length;

        var msgTimer = setInterval(function () {
            step++;
            if (step < BOOT_MESSAGES.length) statusEl.textContent = BOOT_MESSAGES[step];
        }, stepTime);

        requestAnimationFrame(function () {
            barFill.style.transitionDuration = duration + "ms";
            barFill.style.width = "100%";
        });

        setTimeout(function () {
            clearInterval(msgTimer);
            goToCard();
        }, duration + 150);
    }

    function closeOverlay(session) {
        var overlay = $("introOverlay");
        if (!overlay) return;
        overlay.classList.add("intro-overlay-out");
        setTimeout(function () { overlay.remove(); }, 450);
        updateBadge(session);
        updateAboutTag(session);
        // Let profile.js swap the data-entry fields to match the chosen role
        document.dispatchEvent(new CustomEvent("fileforge:session", { detail: session }));
    }

    function updateBadge(session) {
        var badge = $("sessionBadge");
        if (!badge) return;
        if (!session || !session.role) {
            badge.style.display = "none";
            return;
        }
        $("sessionBadgeRole").textContent = roleLabel(session.role);
        $("sessionBadgeCourse").textContent =
            (session.role === "student" || session.role === "employee") && session.course
                ? session.course
                : "General access";
        badge.style.display = "flex";
    }

    function updateAboutTag(session) {
        var line = $("aboutSessionLine");
        if (!line) return;
        if (!session || !session.role) {
            line.style.display = "none";
            return;
        }
        var hasDetail = (session.role === "student" || session.role === "employee") && session.course;
        var text = roleLabel(session.role) + (hasDetail ? " · " + session.course : "");
        line.textContent = "Current session: " + text;
        line.style.display = "block";
    }

    function reopenOverlay() {
        if ($("introOverlay")) return;
        buildOverlay(true);
    }

    document.addEventListener("DOMContentLoaded", function () {
        buildOverlay(false);
        var existing = loadSession();
        updateBadge(existing);
        updateAboutTag(existing);

        var editBtn = $("sessionEditBtn");
        if (editBtn) editBtn.addEventListener("click", reopenOverlay);
    });
})();
