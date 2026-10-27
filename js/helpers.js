// Helper functions and utilities

// DOM element selector
const $ = id => document.getElementById(id);

// Pause execution for animations
function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Current time string for activity logs
function timestamp() {
    return new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
    });
}

// Display toast notification popup
function toast(message, type = "info") {
    const container = $("toastContainer");
    const item = document.createElement("div");
    item.className = `toast ${type}`;
    item.textContent = message;
    container.appendChild(item);

    setTimeout(() => {
        item.style.opacity = "0";
        item.style.transform = "translateX(15px)";
        setTimeout(() => item.remove(), 250);
    }, 2800);
}

// Escape HTML special characters for safe rendering
function escapeHTML(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

// Record an event to the activity log
function addLog(type, message) {
    activity.unshift({
        time: timestamp(),
        type,
        message
    });
    if (activity.length > 50) activity.pop();
    renderLog();
}

// Render log entries in the activity panel
function renderLog() {
    const box = $("log");
    if (!box) return;

    box.innerHTML = "";
    if (!activity.length) {
        box.innerHTML = `<div class="empty-log">No activity recorded yet.</div>`;
        return;
    }

    activity.forEach(item => {
        const row = document.createElement("div");
        row.className = "log-row";
        row.innerHTML = `
            <span class="log-time">${item.time}</span>
            <span class="log-tag ${item.type.toLowerCase()}">${item.type}</span>
            <span class="log-message">${escapeHTML(item.message)}</span>
        `;
        box.appendChild(row);
    });
}

// Clear all logged activity
function clearLog() {
    activity = [];
    renderLog();
    toast("Activity log cleared.", "info");
}

// Switch active view page
function navigate(page) {
    document.querySelectorAll(".page").forEach(section => section.classList.remove("active"));
    document.querySelectorAll(".nav-btn").forEach(button => button.classList.remove("active"));

    const target = $(page);
    if (target) target.classList.add("active");

    const nav = document.querySelector(`.nav-btn[data-page="${page}"]`);
    if (nav) nav.classList.add("active");

    const titles = {
        dashboard: "Dashboard",
        simulator: "Simulator",
        analytics: "Analytics",
        history: "History",
        live: "Live Stream",
        learn: "Learn",
        teach: "Teach: Heap & Sequential",
        quiz: "Quiz",
        help: "Help & User Manual",
        about: "Developed By"
    };

    $("pageTitle").textContent = titles[page] || page;
    $("breadcrumbPage").textContent = ({ about: "DEVELOPED BY", live: "LIVE STREAM" })[page] || page.toUpperCase();

    if (page === "history") renderHistory();
    if (page === "analytics") updateStats();
    if (page === "quiz" && window.FFQuizLab) window.FFQuizLab.refresh();

    window.scrollTo({ top: 0, behavior: "smooth" });
}
