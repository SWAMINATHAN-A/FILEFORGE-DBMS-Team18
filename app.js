// FILEFORGE - Heap vs Sequential File Organization Simulator
// Interactive educational laboratory for database file structures

// Main simulation state
let heap = [];
let sequential = [];
let operations = 0;

let stats = {
    heapComparisons: 0,
    seqComparisons: 0,
    heapBlocks: 0,
    seqBlocks: 0
};

let activity = [];
let savedHistory = JSON.parse(localStorage.getItem("fileforgeHistory") || "[]");

// Playback animation controller state
let playback = {
    active: false,
    running: false,
    target: null,
    steps: [],
    current: -1,
    timer: null
};

// Quiz state
let quiz = {
    index: 0,
    score: 0,
    answered: false
};

// DOM selector shorthand
const $ = id => document.getElementById(id);

// Utility pause helper for animations
function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Formatted current time string for log entries
function timestamp() {
    return new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
    });
}

// Show toast alert notification (info, success, error)
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

// Switch between app tabs/pages (Dashboard, Simulator, Analytics, etc.)
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
        learn: "Learn",
        quiz: "Quiz",
        about: "About"
    };

    $("pageTitle").textContent = titles[page] || page;
    $("breadcrumbPage").textContent = page.toUpperCase();

    if (page === "history") renderHistory();
    if (page === "analytics") updateStats();
    if (page === "quiz") renderQuiz();

    window.scrollTo({ top: 0, behavior: "smooth" });
}

// Attach navigation click listeners
document.querySelectorAll(".nav-btn").forEach(button => {
    button.addEventListener("click", () => navigate(button.dataset.page));
});

// Read and validate record form inputs
function getRecord() {
    const id = Number($("recordId").value);
    const name = $("recordName").value.trim();
    const dept = $("recordDept").value.trim();
    const marks = Number($("recordMarks").value);

    if (!id || !name || !dept || isNaN(marks)) {
        toast("Please enter all record details (ID, Name, Dept, Marks).", "error");
        return null;
    }

    if (marks < 0 || marks > 100) {
        toast("Marks must be between 0 and 100.", "error");
        return null;
    }

    return { id, name, dept, marks };
}

// Clear record form fields
function clearInputs() {
    $("recordId").value = "";
    $("recordName").value = "";
    $("recordDept").value = "";
    $("recordMarks").value = "";
}

// Get current disk block capacity from slider
function getBlockSize() {
    return Number($("blockSize").value);
}

// Divide records into fixed disk blocks
function splitBlocks(data) {
    const size = getBlockSize();
    const blocks = [];
    for (let i = 0; i < data.length; i += size) {
        blocks.push(data.slice(i, i + size));
    }
    return blocks;
}

// Render both Heap and Sequential files
function renderFiles() {
    renderFile(heap, $("heapBlocksView"));
    renderFile(sequential, $("seqBlocksView"));
    updateStats();
}

// Render a single file's blocks and internal fragmentation slots
function renderFile(data, container) {
    container.innerHTML = "";

    if (!data.length) {
        container.innerHTML = `<div class="empty-file">No records in this file.</div>`;
        return;
    }

    const blocks = splitBlocks(data);
    const bCapacity = getBlockSize();

    blocks.forEach((records, index) => {
        const isFull = records.length === bCapacity;
        const block = document.createElement("div");
        block.className = `block ${isFull ? "block-full" : "block-partial"}`;
        block.dataset.block = index;

        block.innerHTML = `
            <div class="block-header">
                <span>BLOCK ${String(index).padStart(2, "0")}</span>
                <div style="display:flex;align-items:center;gap:6px;">
                    <span class="block-tag ${isFull ? 'full' : 'partial'}">${isFull ? 'FULL' : 'PARTIAL'}</span>
                    <span class="block-cap">${records.length}/${bCapacity}</span>
                </div>
            </div>
        `;

        // Render filled records
        records.forEach(record => {
            const item = document.createElement("div");
            item.className = "record";
            item.dataset.id = record.id;
            item.innerHTML = `
                <strong>${record.id}</strong>
                <small>${escapeHTML(record.name)} · ${escapeHTML(record.dept)}</small>
                <small>Marks: ${record.marks}</small>
            `;
            block.appendChild(item);
        });

        // Render empty slots (visualizing internal fragmentation)
        for (let emptyIdx = records.length; emptyIdx < bCapacity; emptyIdx++) {
            const emptySlot = document.createElement("div");
            emptySlot.className = "record empty-slot";
            emptySlot.innerHTML = `
                <strong>⬚ Slot ${emptyIdx + 1} (Empty)</strong>
                <small>Internal Fragmentation</small>
            `;
            block.appendChild(emptySlot);
        }

        container.appendChild(block);
    });
}

// HTML entity escape helper
function escapeHTML(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

// Update dashboard, analytics, and storage utilization counters
function updateStats() {
    const bSize = getBlockSize();
    const heapBlockCount = Math.ceil(heap.length / bSize) || 0;
    const seqBlockCount = Math.ceil(sequential.length / bSize) || 0;

    // Simulator counters
    $("heapCount").textContent = heap.length;
    $("seqCount").textContent = sequential.length;
    $("heapBlocks").textContent = heapBlockCount;
    $("seqBlocks").textContent = seqBlockCount;

    // Dashboard counters
    $("dashRecords").textContent = heap.length;
    $("dashOperations").textContent = operations;
    $("dashHeapBlocks").textContent = heapBlockCount;
    $("dashSeqBlocks").textContent = seqBlockCount;

    // Analytics counters
    $("analyticsHeap").textContent = stats.heapComparisons;
    $("analyticsSeq").textContent = stats.seqComparisons;
    $("analyticsHeapBlocks").textContent = stats.heapBlocks;
    $("analyticsSeqBlocks").textContent = stats.seqBlocks;

    // Storage Utilization & Internal Fragmentation metrics
    const totalCapacity = heapBlockCount * bSize;
    const wastedSlots = Math.max(0, totalCapacity - heap.length);
    const packingFactor = totalCapacity > 0 ? Math.round((heap.length / totalCapacity) * 100) : 100;
    const fragPct = totalCapacity > 0 ? Math.round((wastedSlots / totalCapacity) * 100) : 0;
    const maxProbes = Math.ceil(Math.log2(Math.max(1, heap.length)));
    const maxIo = Math.ceil(Math.log2(Math.max(1, heapBlockCount)));

    if ($("packingFactor")) $("packingFactor").textContent = `${packingFactor}%`;
    if ($("totalCapacitySlots")) $("totalCapacitySlots").textContent = totalCapacity;
    if ($("activeRecordsCount")) $("activeRecordsCount").textContent = heap.length;
    if ($("wastedSlotsCount")) $("wastedSlotsCount").textContent = wastedSlots;
    if ($("allocatedBlocksSummary")) $("allocatedBlocksSummary").textContent = `${heapBlockCount} blocks × ${bSize} slot capacity`;
    if ($("fragmentationPct")) $("fragmentationPct").textContent = `${fragPct}% wasted disk space`;
    if ($("binaryCostEstimate")) $("binaryCostEstimate").textContent = `≤ ${maxProbes} Probes`;
    if ($("binaryIoFormula")) $("binaryIoFormula").textContent = `≤ ${maxIo} block I/Os (Binary Search)`;

    // Analytics comparison bar width
    const max = Math.max(stats.heapComparisons, stats.seqComparisons, 1);
    $("heapBar").style.width = `${(stats.heapComparisons / max) * 100}%`;
    $("seqBar").style.width = `${(stats.seqComparisons / max) * 100}%`;
    $("heapBarValue").textContent = stats.heapComparisons;
    $("seqBarValue").textContent = stats.seqComparisons;
}

// Add an entry to the system simulation log
function addLog(type, message) {
    activity.unshift({
        time: timestamp(),
        type,
        message
    });
    if (activity.length > 50) activity.pop();
    renderLog();
}

// Render system activity log entries
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

// Clear the activity log
function clearLog() {
    activity = [];
    renderLog();
    toast("Activity log cleared.", "info");
}

// Insert a record into Heap (append) and Sequential (sorted)
function insertRecord() {
    stopPlayback();
    const record = getRecord();
    if (!record) return;

    if (heap.some(item => item.id === record.id)) {
        toast(`Record ${record.id} already exists in database.`, "error");
        return;
    }

    // Heap File: append to end
    heap.push({ ...record });

    // Sequential File: insert and keep sorted by primary key
    sequential.push({ ...record });
    sequential.sort((a, b) => a.id - b.id);

    operations++;
    addLog("INSERT", `Record ${record.id} inserted into both files.`);

    showResult(true, `Record ${record.id} Inserted`, [
        ["Heap", "Appended to end of file"],
        ["Sequential", "Inserted in sorted Primary Key order"],
        ["Total Records", heap.length],
        ["Total Operations", operations]
    ]);

    explain("insert", record);
    clearInputs();
    renderFiles();
    toast(`Record ${record.id} inserted successfully.`, "success");
}

// Initialize and start a search simulation
function startSearch() {
    const id = Number($("recordId").value);
    if (!id) {
        toast("Enter a Record ID to search.", "error");
        return;
    }

    stopPlayback();
    const strategy = $("searchStrategy").value;

    playback.target = id;
    playback.active = true;
    playback.running = false;
    playback.current = -1;
    playback.steps = buildSearchSteps(id, strategy);

    $("playbackTitle").textContent = `Searching for Record ${id}`;
    $("playBtn").textContent = "▶";

    updatePlaybackUI();
    addLog("SEARCH", `Search simulation initialized for Record ${id} (${strategy}).`);
    toast("Search simulation ready. Press Play (▶) or Step (›).", "info");
}

// Build step-by-step probe sequence for Linear, Binary, or Race mode
function buildSearchSteps(id, strategy) {
    const steps = [];

    // 1. Heap Probes (Linear Scan)
    const heapProbes = [];
    let heapFound = false;

    for (let i = 0; i < heap.length; i++) {
        const r = heap[i];
        const isMatch = r.id === id;
        heapProbes.push({
            file: "heap",
            index: i,
            id: r.id,
            status: isMatch ? "found" : "checking",
            message: isMatch
                ? `Record ${r.id} FOUND in Heap at Block ${String(Math.floor(i / getBlockSize())).padStart(2, "0")} (Index ${i})`
                : `Checking Heap Record ${r.id} (Index ${i})...`
        });

        if (isMatch) {
            heapFound = true;
            break;
        }
    }

    if (!heapFound && heap.length > 0) {
        heapProbes.push({
            file: "heap",
            index: heap.length - 1,
            id: null,
            status: "not_found",
            message: `Record ${id} NOT found in Heap after scanning all ${heap.length} records.`
        });
    }

    // 2. Sequential Probes (Binary Search, Ordered Scan, or Linear Scan)
    const seqProbes = [];

    if (strategy === "binary" || strategy === "race") {
        // True Binary Search algorithm
        let low = 0;
        let high = sequential.length - 1;
        let seqFound = false;

        while (low <= high) {
            const mid = Math.floor((low + high) / 2);
            const r = sequential[mid];
            const isMatch = r.id === id;
            const bIndex = Math.floor(mid / getBlockSize());

            let msg = "";
            if (isMatch) {
                msg = `🎯 Record ${r.id} FOUND via Binary Search at Index ${mid} (Block ${String(bIndex).padStart(2, "0")})!`;
            } else if (r.id < id) {
                msg = `Binary Search: Probed ${r.id} < ${id} → Target in upper partition [${mid + 1}..${high}]`;
            } else {
                msg = `Binary Search: Probed ${r.id} > ${id} → Target in lower partition [${low}..${mid - 1}]`;
            }

            seqProbes.push({
                file: "seq",
                index: mid,
                id: r.id,
                low,
                high,
                mid,
                blockIndex: bIndex,
                strategy: "binary",
                status: isMatch ? "found" : "checking",
                message: msg
            });

            if (isMatch) {
                seqFound = true;
                break;
            } else if (r.id < id) {
                low = mid + 1;
            } else {
                high = mid - 1;
            }
        }

        if (!seqFound && sequential.length > 0) {
            seqProbes.push({
                file: "seq",
                index: -1,
                id: null,
                low,
                high,
                mid: -1,
                strategy: "binary",
                status: "not_found",
                message: `Record ${id} NOT found in Sequential file via Binary Search.`
            });
        }
    } else if (strategy === "ordered") {
        // Ordered Scan with early termination
        for (let i = 0; i < sequential.length; i++) {
            const r = sequential[i];
            const isMatch = r.id === id;

            if (isMatch) {
                seqProbes.push({
                    file: "seq",
                    index: i,
                    id: r.id,
                    status: "found",
                    message: `Record ${r.id} FOUND in Sequential file at Index ${i}!`
                });
                break;
            } else if (r.id > id) {
                seqProbes.push({
                    file: "seq",
                    index: i,
                    id: r.id,
                    status: "stop",
                    message: `Ordered Stop: Record ${r.id} > ${id}. Target does not exist!`
                });
                break;
            } else {
                seqProbes.push({
                    file: "seq",
                    index: i,
                    id: r.id,
                    status: "checking",
                    message: `Checking Sequential Record ${r.id} (Index ${i})...`
                });
            }
        }
    } else {
        // Standard Sequential Linear Scan
        for (let i = 0; i < sequential.length; i++) {
            const r = sequential[i];
            const isMatch = r.id === id;
            seqProbes.push({
                file: "seq",
                index: i,
                id: r.id,
                status: isMatch ? "found" : "checking",
                message: isMatch
                    ? `Record ${r.id} FOUND in Sequential file at Index ${i}!`
                    : `Checking Sequential Record ${r.id} (Index ${i})...`
            });
            if (isMatch) break;
        }
    }

    // 3. Assemble steps based on chosen mode
    if (strategy === "race") {
        // Dual Race Mode: lockstep simultaneous probing
        const maxRounds = Math.max(heapProbes.length, seqProbes.length);
        for (let r = 0; r < maxRounds; r++) {
            const hStep = r < heapProbes.length
                ? heapProbes[r]
                : { file: "heap", done: true, status: heapProbes[heapProbes.length - 1]?.status || "done", id: heapProbes[heapProbes.length - 1]?.id };

            const sStep = r < seqProbes.length
                ? seqProbes[r]
                : { file: "seq", done: true, status: seqProbes[seqProbes.length - 1]?.status || "done", id: seqProbes[seqProbes.length - 1]?.id };

            steps.push({
                isRace: true,
                round: r + 1,
                totalRounds: maxRounds,
                heapStep: hStep,
                seqStep: sStep,
                heapProbesCount: Math.min(r + 1, heapProbes.length),
                seqProbesCount: Math.min(r + 1, seqProbes.length)
            });
        }
    } else {
        // Phased mode: Heap scan steps first, then Sequential steps
        heapProbes.forEach(step => steps.push(step));
        seqProbes.forEach(step => steps.push(step));
    }

    return steps;
}

// Update visual playback highlights and floating pointer badges
function updatePlaybackUI() {
    const total = playback.steps.length;
    const current = playback.current + 1;

    $("stepLabel").textContent = `${Math.max(0, current)} / ${total}`;
    const percent = total ? Math.max(0, Math.min(100, (current / total) * 100)) : 0;
    $("progressBar").style.width = `${percent}%`;

    clearHighlights();
    if (playback.current < 0 || !playback.steps[playback.current]) return;

    const step = playback.steps[playback.current];

    if (step.isRace) {
        // Dual Race Mode visual rendering
        const h = step.heapStep;
        const s = step.seqStep;

        if (!h.done && h.index !== undefined) {
            const hRecords = $("heapBlocksView").querySelectorAll(".record");
            if (hRecords[h.index]) {
                hRecords[h.index].classList.add(h.status === "found" ? "found" : "checking");
                const blk = hRecords[h.index].closest(".block");
                if (blk) blk.classList.add("active");
            }
        }

        if (!s.done && s.index !== undefined && s.index >= 0) {
            const sRecords = $("seqBlocksView").querySelectorAll(".record");
            if (sRecords[s.index]) {
                sRecords[s.index].classList.add(s.status === "found" ? "found" : "mid-ptr");
                sRecords[s.index].classList.add(s.status === "found" ? "found" : "checking");
                const blk = sRecords[s.index].closest(".block");
                if (blk) blk.classList.add("active");
            }

            if (s.low !== undefined && s.high !== undefined) {
                if (sRecords[s.low]) {
                    sRecords[s.low].classList.add("low-ptr");
                    attachPtrBadge(sRecords[s.low], "L", "low");
                }
                if (sRecords[s.mid] && s.status !== "found") {
                    attachPtrBadge(sRecords[s.mid], "MID", "mid");
                }
                if (sRecords[s.high]) {
                    sRecords[s.high].classList.add("high-ptr");
                    attachPtrBadge(sRecords[s.high], "R", "high");
                }
                sRecords.forEach((rec, idx) => {
                    if (idx < s.low || idx > s.high) rec.classList.add("range-excluded");
                });
            }
        }

        let titleText = `🏁 Race Step ${step.round}/${step.totalRounds} — `;
        if (s.status === "found" && h.status !== "found") {
            titleText += `⚡ Sequential Binary Search WON! (Found in ${step.seqProbesCount} probes; Heap at probe ${step.heapProbesCount})`;
        } else if (h.status === "found" && s.status !== "found") {
            titleText += `Heap Linear Scan found first (Found in ${step.heapProbesCount} probes; Sequential at probe ${step.seqProbesCount})`;
        } else if (h.status === "found" && s.status === "found") {
            titleText += `Both finished! Heap: ${step.heapProbesCount} probes | Sequential: ${step.seqProbesCount} probes`;
        } else {
            titleText += `Heap Linear (Probe ${step.heapProbesCount}) vs Sequential Binary (Probe ${step.seqProbesCount})`;
        }
        $("playbackTitle").textContent = titleText;
    } else {
        // Standard Phased Playback visual rendering
        const container = step.file === "heap" ? $("heapBlocksView") : $("seqBlocksView");
        const records = container.querySelectorAll(".record");

        if (step.index !== undefined && step.index >= 0 && records[step.index]) {
            records[step.index].classList.add(
                step.status === "found" ? "found" : (step.status === "stop" ? "checking" : "checking")
            );
            const block = records[step.index].closest(".block");
            if (block) block.classList.add("active");
        }

        if (step.file === "seq" && step.strategy === "binary" && step.low !== undefined && step.high !== undefined) {
            if (records[step.low]) {
                records[step.low].classList.add("low-ptr");
                attachPtrBadge(records[step.low], "L", "low");
            }
            if (records[step.mid] && step.status !== "found") {
                records[step.mid].classList.add("mid-ptr");
                attachPtrBadge(records[step.mid], "MID", "mid");
            }
            if (records[step.high]) {
                records[step.high].classList.add("high-ptr");
                attachPtrBadge(records[step.high], "R", "high");
            }
            records.forEach((rec, idx) => {
                if (idx < step.low || idx > step.high) rec.classList.add("range-excluded");
            });
        }

        $("playbackTitle").textContent = step.message || (
            step.status === "found"
                ? `Record ${step.id} found in ${step.file === "heap" ? "Heap" : "Sequential"}`
                : step.status === "stop"
                    ? `Ordered search stopped at ${step.id}`
                    : `Checking ${step.file === "heap" ? "Heap" : "Sequential"} Record ${step.id}`
        );
    }
}

// Attach [L], [MID], [R] pointer badges to records
function attachPtrBadge(element, text, className) {
    const badge = document.createElement("span");
    badge.className = `ptr-badge ${className}`;
    badge.textContent = text;
    element.appendChild(badge);
}

// Remove all active highlights and pointer badges
function clearHighlights() {
    document.querySelectorAll(".record.checking, .record.found, .block.active, .record.low-ptr, .record.mid-ptr, .record.high-ptr, .record.range-excluded")
        .forEach(item => {
            item.classList.remove("checking", "found", "active", "low-ptr", "mid-ptr", "high-ptr", "range-excluded");
        });
    document.querySelectorAll(".ptr-badge").forEach(badge => badge.remove());
}

// Advance playback by one step
function nextStep() {
    if (!playback.active) {
        toast("Start a search first.", "info");
        return;
    }
    if (playback.current >= playback.steps.length - 1) {
        finishSearch();
        return;
    }
    playback.current++;
    updatePlaybackUI();
}

// Move playback back by one step
function previousStep() {
    if (!playback.active) return;
    if (playback.current > 0) playback.current--;
    updatePlaybackUI();
}

// Toggle automatic play / pause
function togglePlayback() {
    if (!playback.active) {
        toast("Start a search first.", "info");
        return;
    }
    if (playback.running) {
        stopPlayback();
        $("playBtn").textContent = "▶";
        return;
    }
    playback.running = true;
    $("playBtn").textContent = "Ⅱ";
    runPlayback();
}

// Main asynchronous animation loop
async function runPlayback() {
    while (playback.running && playback.active && playback.current < playback.steps.length - 1) {
        playback.current++;
        updatePlaybackUI();
        await wait(Number($("speed").value));
    }
    if (playback.active && playback.current >= playback.steps.length - 1) {
        await wait(Number($("speed").value));
        finishSearch();
    }
}

// Stop running playback animation
function stopPlayback() {
    playback.running = false;
    if (playback.timer) clearTimeout(playback.timer);
    $("playBtn").textContent = "▶";
}

// Finalize search, calculate metrics, and display results
function finishSearch() {
    playback.running = false;
    $("playBtn").textContent = "▶";
    if (!playback.active) return;

    const id = playback.target;
    const strategy = $("searchStrategy").value;
    const heapIndex = heap.findIndex(r => r.id === id);
    const seqIndex = sequential.findIndex(r => r.id === id);

    const heapComparisons = heapIndex === -1 ? heap.length : heapIndex + 1;
    let seqComparisons = 0;
    let seqAccess = 0;

    if (strategy === "binary" || strategy === "race") {
        // Binary search probe and block I/O calculation
        let low = 0, high = sequential.length - 1;
        let probes = 0;
        const accessedBlocks = new Set();
        const bSize = getBlockSize();

        while (low <= high) {
            probes++;
            const mid = Math.floor((low + high) / 2);
            accessedBlocks.add(Math.floor(mid / bSize));
            if (sequential[mid].id === id) {
                break;
            } else if (sequential[mid].id < id) {
                low = mid + 1;
            } else {
                high = mid - 1;
            }
        }
        seqComparisons = probes;
        seqAccess = sequential.length ? Math.max(1, accessedBlocks.size) : 0;
    } else if (strategy === "ordered") {
        if (seqIndex !== -1) {
            seqComparisons = seqIndex + 1;
        } else {
            const stopIdx = sequential.findIndex(r => r.id > id);
            seqComparisons = stopIdx !== -1 ? stopIdx + 1 : sequential.length;
        }
        seqAccess = sequential.length ? Math.max(1, Math.ceil(seqComparisons / getBlockSize())) : 0;
    } else {
        seqComparisons = seqIndex !== -1 ? seqIndex + 1 : sequential.length;
        seqAccess = sequential.length ? Math.max(1, Math.ceil(seqComparisons / getBlockSize())) : 0;
    }

    const heapAccess = Math.max(1, Math.ceil(heapComparisons / getBlockSize()));

    stats.heapComparisons += heapComparisons;
    stats.seqComparisons += seqComparisons;
    stats.heapBlocks += heap.length ? heapAccess : 0;
    stats.seqBlocks += sequential.length ? seqAccess : 0;
    operations++;

    const found = heapIndex !== -1 || seqIndex !== -1;
    const strategyLabels = {
        scan: "Sequential Scan (Linear)",
        ordered: "Ordered Scan (Early Stop)",
        binary: "Binary Search (O(log N))",
        race: "🏁 Dual Race Mode (Head-to-Head)"
    };

    const resultRows = [
        ["Target Key", id],
        ["Heap Comparisons", `${heapComparisons} (Linear Scan)`],
        ["Sequential Comparisons", `${seqComparisons} (${strategy === "binary" || strategy === "race" ? "Binary Search" : "Linear"})`],
        ["Heap Block I/Os", `${heapAccess} disk blocks`],
        ["Sequential Block I/Os", `${seqAccess} disk blocks`],
        ["Strategy", strategyLabels[strategy] || strategy]
    ];

    if (strategy === "race" || strategy === "binary") {
        const diff = heapComparisons - seqComparisons;
        const pct = heapComparisons > 0 ? Math.round((diff / heapComparisons) * 100) : 0;
        resultRows.push([
            "Efficiency Advantage",
            diff > 0
                ? `Sequential saved ${diff} comparison(s) (${pct}% reduction)`
                : (diff === 0 ? "Equal comparisons" : `Heap probed ${-diff} fewer record(s)`)
        ]);
    }

    showResult(found, found ? `Record ${id} Found` : `Record ${id} Not Found`, resultRows);
    explain("search", {
        id,
        found,
        heapComparisons,
        seqComparisons,
        heapAccess,
        seqAccess,
        strategy
    });

    addLog("SEARCH", `Record ${id}: ${found ? "FOUND" : "NOT FOUND"} (Heap: ${heapComparisons} probes, Seq: ${seqComparisons} probes)`);
    updateStats();
    toast(found ? `Record ${id} found successfully.` : `Record ${id} not found in database.`, found ? "success" : "error");

    playback.active = false;
}

// Reset playback state to idle
function resetPlayback() {
    stopPlayback();
    playback.active = false;
    playback.steps = [];
    playback.current = -1;
    playback.target = null;
    clearHighlights();
    $("playbackTitle").textContent = "No active simulation";
    $("stepLabel").textContent = "0 / 0";
    $("progressBar").style.width = "0%";
}

// Delete a record by ID from both files
function deleteRecord() {
    stopPlayback();
    const id = Number($("recordId").value);
    if (!id) {
        toast("Enter a Record ID to delete.", "error");
        return;
    }

    const exists = heap.some(r => r.id === id);
    if (!exists) {
        showResult(false, `Record ${id} does not exist`, []);
        toast("Record not found.", "error");
        return;
    }

    heap = heap.filter(r => r.id !== id);
    sequential = sequential.filter(r => r.id !== id);
    operations++;

    showResult(true, `Record ${id} deleted`, [
        ["Heap", "Record removed"],
        ["Sequential", "Record removed"],
        ["Remaining Records", heap.length]
    ]);

    explain("delete", { id });
    addLog("DELETE", `Record ${id} removed from both files.`);
    clearInputs();
    renderFiles();
    toast(`Record ${id} deleted successfully.`, "success");
}

// Render operation result statistics table
function showResult(success, title, rows) {
    $("operationStatus").textContent = success ? "SUCCESS" : "FAIL";
    $("operationStatus").className = `result-status ${success ? "success" : "fail"}`;

    let html = `
        <div class="result-header ${success ? "result-pass" : "result-fail"}">
            ${success ? "✓" : "×"} ${escapeHTML(title)}
        </div>
    `;

    rows.forEach(row => {
        html += `
            <div class="result-row">
                <span>${escapeHTML(row[0])}</span>
                <b>${escapeHTML(row[1])}</b>
            </div>
        `;
    });

    $("resultBox").innerHTML = html;
}

// Generate contextual technical explanation
function explain(type, data) {
    let html = "";

    if (type === "insert") {
        html = `
            <div class="explain-card">
                <div class="explain-badge">OPERATION: RECORD INSERTION</div>
                <p>
                    <strong>Heap File:</strong> Record ${data.id} was appended directly to the end of the file.
                    <em>I/O Cost:</em> <strong>O(1)</strong> (Reads last block, appends record, writes back = 2 block I/Os).
                </p>
                <p style="margin-top:10px">
                    <strong>Sequential File:</strong> Record ${data.id} was placed into ascending Primary Key order.
                    <em>I/O Cost:</em> <strong>O(n)</strong> (Requires locating block via binary search, then shifting subsequent records).
                </p>
            </div>
        `;
    }

    if (type === "search") {
        const diff = data.heapComparisons - data.seqComparisons;
        const pct = data.heapComparisons > 0 ? Math.round((diff / data.heapComparisons) * 100) : 0;
        const isBinary = data.strategy === "binary" || data.strategy === "race";

        html = `
            <div class="explain-card">
                <div class="explain-badge">OPERATION: SEARCH (TARGET KEY ${data.id})</div>
                <p><strong>Search Outcome:</strong> ${data.found ? "Record located successfully." : "Key not found in database."}</p>

                <div class="explain-metrics-grid">
                    <div class="explain-metric-box">
                        <span class="metric-label">HEAP FILE (LINEAR SCAN)</span>
                        <div class="metric-num purple">${data.heapComparisons} Probes</div>
                        <small>${data.heapAccess} disk block I/O(s)</small>
                    </div>
                    <div class="explain-metric-box">
                        <span class="metric-label">SEQUENTIAL (${isBinary ? "BINARY SEARCH" : "ORDERED SCAN"})</span>
                        <div class="metric-num cyan">${data.seqComparisons} Probes</div>
                        <small>${data.seqAccess} disk block I/O(s)</small>
                    </div>
                </div>

                ${isBinary ? `
                    <p style="margin-top:8px;">
                        <strong>Algorithmic Analysis:</strong> Sequential File utilized <strong>Binary Search (O(log₂ N))</strong>. By probing the midpoint of each partition, it discarded 50% of candidate records at every step.
                        ${diff > 0 ? `<br><span style="color:var(--green);font-weight:600;">⚡ Advantage: Sequential saved ${diff} comparison(s) (${pct}% reduction) over Heap linear scan!</span>` : ""}
                    </p>
                ` : `
                    <p style="margin-top:8px;">
                        <strong>Algorithmic Analysis:</strong> Sequential File utilized ${data.strategy === "ordered" ? "Ordered Scan (early termination upon reaching a key > target)" : "Sequential Linear Scan"}.
                    </p>
                `}
            </div>
        `;
    }

    if (type === "delete") {
        html = `
            <div class="explain-card">
                <div class="explain-badge">OPERATION: RECORD DELETION (KEY ${data.id})</div>
                <p>
                    <strong>Heap File:</strong> Located record via linear scan. In real database engines, deletion is handled via:
                    <br>1. <em>Tombstone / Deletion Bit:</em> Mark the record slot as deleted without shifting records (O(1) rewrite).
                    <br>2. <em>Compaction / Swap with Last:</em> Move the very last record in the heap file into this empty slot (O(1) I/O!).
                </p>
                <p style="margin-top:10px">
                    <strong>Sequential File:</strong> Located key via Binary Search O(log₂ n). To maintain sorted order, all subsequent records must be shifted backward (O(n) I/O cost).
                </p>
            </div>
        `;
    }

    $("explanation").innerHTML = html;
}

// AI Tutor pre-programmed knowledge base
const aiKnowledgeBase = {
    binary_vs_linear: {
        title: "Why Binary Search Outperforms Linear Scan in DBMS",
        answer: `
            <p><strong>Mathematical Principle:</strong></p>
            <ul>
                <li><strong>Linear Scan (Heap File):</strong> Searches sequentially from Block 0. In the average case, it probes <code>N/2</code> records and transfers <code>b/2</code> disk blocks into RAM. For 1,000,000 records, that is ~500,000 disk probes!</li>
                <li><strong>Binary Search (Sequential File):</strong> Leverages the sorted primary key order. At each probe step, it compares the target key against the midpoint <code>mid = ⌊(low + high) / 2⌋</code>. If the target is smaller, the entire upper half is discarded.</li>
                <li><strong>Complexity:</strong> The search space halves at every step: <code>N → N/2 → N/4 → ... → 1</code>, resulting in <code>⌊log₂ N⌋ + 1</code> comparisons and at most <code>⌈log₂ b⌉</code> block I/O transfers. For 1,000,000 records, Binary Search finishes in at most <strong>20 probes</strong>!</li>
            </ul>
        `
    },
    block_capacity: {
        title: "Impact of Block Capacity (Blocking Factor B)",
        answer: `
            <p><strong>Blocking Factor (B):</strong> The number of records stored per disk block.</p>
            <ul>
                <li><strong>Larger Block Capacity (e.g., 8 records/block):</strong>
                    <ul>
                        <li>Reduces total allocated blocks <code>b = ⌈N / B⌉</code>.</li>
                        <li>Fewer disk I/O transfers are needed because more records are read into RAM per page fetch.</li>
                        <li>However, internal fragmentation increases if the last block is only partially filled.</li>
                    </ul>
                </li>
                <li><strong>Smaller Block Capacity (e.g., 2 records/block):</strong>
                    <ul>
                        <li>Increases total disk block overhead and metadata pointers.</li>
                        <li>More block I/O operations are required during linear scans.</li>
                        <li>Minimizes wasted bytes on the final block.</li>
                    </ul>
                </li>
            </ul>
        `
    },
    heap_vs_seq: {
        title: "When to Choose Heap File vs Sequential File",
        answer: `
            <p><strong>Workload Trade-offs in Real Database Engines:</strong></p>
            <ul>
                <li><strong>Choose Heap Files when:</strong>
                    <ul>
                        <li><strong>Write-Heavy Workloads:</strong> High-speed logging, bulk data ingestion, IoT sensor streams, or audit trails where records are constantly appended at <code>O(1)</code> cost without sorting overhead.</li>
                        <li>Entire tables are scanned anyway (e.g., full table analytical aggregation <code>COUNT(*)</code> or <code>SUM()</code>).</li>
                    </ul>
                </li>
                <li><strong>Choose Sequential Files when:</strong>
                    <ul>
                        <li><strong>Read-Heavy Workloads:</strong> Frequent point lookups by primary key (utilizing <code>O(log₂ N)</code> Binary Search).</li>
                        <li><strong>Range Queries:</strong> Queries with <code>WHERE id BETWEEN 100 AND 200</code> can locate the start in <code>O(log₂ N)</code> and scan contiguous blocks sequentially.</li>
                    </ul>
                </li>
            </ul>
        `
    },
    fragmentation: {
        title: "Internal Fragmentation in Database Blocks",
        answer: `
            <p><strong>What is Internal Fragmentation?</strong></p>
            <ul>
                <li>Databases allocate secondary storage in fixed-size units called <strong>pages or disk blocks</strong> (commonly 4KB or 8KB).</li>
                <li>If a table contains records that do not completely fill the allocated block capacity, the unused space inside the block is called <strong>Internal Fragmentation</strong>.</li>
                <li><em>Packing Factor:</em> The ratio of useful record data to total block capacity: <code>(Active Records / Total Slot Capacity) × 100%</code>.</li>
                <li><strong>How DBMS minimizes it:</strong> By using slotted page architectures, overflow chains, or record compaction.</li>
            </ul>
        `
    },
    deletion: {
        title: "Record Deletion Strategies & Cost Comparison",
        answer: `
            <p><strong>Deletion Mechanisms in DBMS:</strong></p>
            <ul>
                <li><strong>In Heap Files:</strong>
                    <ul>
                        <li><strong>Tombstone / Deletion Bit:</strong> Sets a 1-bit flag indicating the record is deleted. The slot remains vacant until reused by future inserts.</li>
                        <li><strong>Compaction / Last Record Swap:</strong> The last record in the entire heap file is moved into the vacated slot. This maintains 100% packing factor without shifting other records (takes only <code>O(1)</code> I/O!).</li>
                    </ul>
                </li>
                <li><strong>In Sequential Files:</strong>
                    <ul>
                        <li>To maintain contiguous sorted primary key order, all records after the deleted record must be shifted backward by one slot.</li>
                        <li>This causes cascading disk writes across all subsequent blocks (<code>O(n)</code> I/O cost).</li>
                        <li>Modern DBMS mitigate this using <strong>overflow blocks and pointer chains</strong> to avoid immediate physical record shifting.</li>
                    </ul>
                </li>
            </ul>
        `
    }
};

// Handle clicks on AI Tutor quick question chips
function askAiTutor(topicKey) {
    const item = aiKnowledgeBase[topicKey];
    if (!item) return;

    const bSize = getBlockSize();
    const totalRecords = heap.length;
    const totalBlocks = Math.ceil(totalRecords / bSize) || 0;

    const dynamicContext = `
        <div style="margin-top:10px;padding:8px 10px;background:#0d1117;border-left:3px solid var(--cyan);border-radius:4px;font-size:9px;">
            <strong>Live Context from Current Lab:</strong> Current dataset has <code>${totalRecords}</code> records across <code>${totalBlocks}</code> blocks (Capacity = ${bSize} records/block).
        </div>
    `;

    $("aiTutorResponseText").innerHTML = `
        <h4>${item.title}</h4>
        ${item.answer}
        ${dynamicContext}
    `;

    $("aiTutorResponse").style.display = "block";
    $("aiTutorResponse").scrollIntoView({ behavior: "smooth", block: "nearest" });
}

// Process custom user questions in the AI Tutor input
function submitAiQuery() {
    const input = $("aiCustomQuery");
    const query = (input.value || "").trim().toLowerCase();

    if (!query) {
        toast("Please enter a question for the AI Tutor.", "info");
        return;
    }

    input.value = "";
    const bSize = getBlockSize();
    const totalRecords = heap.length;
    const totalBlocks = Math.ceil(totalRecords / bSize) || 0;

    let answerHtml = "";

    if (query.includes("binary") || query.includes("log") || query.includes("faster")) {
        answerHtml = aiKnowledgeBase.binary_vs_linear.answer;
    } else if (query.includes("capacity") || query.includes("block") || query.includes("size")) {
        answerHtml = aiKnowledgeBase.block_capacity.answer;
    } else if (query.includes("heap") && (query.includes("sequential") || query.includes("choose") || query.includes("difference") || query.includes("better"))) {
        answerHtml = aiKnowledgeBase.heap_vs_seq.answer;
    } else if (query.includes("fragment") || query.includes("waste") || query.includes("pack")) {
        answerHtml = aiKnowledgeBase.fragmentation.answer;
    } else if (query.includes("delete") || query.includes("remove") || query.includes("tombstone")) {
        answerHtml = aiKnowledgeBase.deletion.answer;
    } else if (query.includes("insert") || query.includes("append") || query.includes("shift")) {
        answerHtml = `
            <p><strong>Insertion Mechanics in DBMS:</strong></p>
            <ul>
                <li><strong>Heap File:</strong> Appends to the end of the file into the active block. Complexity is <code>O(1)</code>, requiring just 2 block I/Os (1 read + 1 write).</li>
                <li><strong>Sequential File:</strong> Inserts records in sorted key sequence. Shifting subsequent records requires <code>O(n)</code> block I/Os.</li>
            </ul>
        `;
    } else {
        answerHtml = `
            <p><strong>AI Tutor Guidance for: "${escapeHTML(query)}"</strong></p>
            <p>In Database Management Systems (DBMS), file organization defines how secondary storage blocks (HDD/SSD pages) map into memory buffers.</p>
            <ul>
                <li><strong>Heap Organization:</strong> Fast unordered append (<code>O(1)</code>), slow linear search (<code>O(n)</code>). Ideal for ingestion logs.</li>
                <li><strong>Sequential Organization:</strong> Sorted by primary key, fast Binary Search (<code>O(log₂ n)</code>) and range scans (<code>O(n)</code>), but costly record shifting during insertion/deletion (<code>O(n)</code>).</li>
                <li><strong>Disk Blocking:</strong> Transferring blocks rather than individual records minimizes mechanical disk seek time.</li>
            </ul>
        `;
    }

    $("aiTutorResponseText").innerHTML = `
        <h4>✦ Answer for: "${escapeHTML(query)}"</h4>
        ${answerHtml}
        <div style="margin-top:10px;padding:8px 10px;background:#0d1117;border-left:3px solid var(--purple);border-radius:4px;font-size:9px;">
            <strong>Live Simulation State:</strong> Dataset size: <code>${totalRecords}</code> records | Block capacity: <code>${bSize}</code> | Allocated Blocks: <code>${totalBlocks}</code>.
        </div>
    `;

    $("aiTutorResponse").style.display = "block";
    $("aiTutorResponse").scrollIntoView({ behavior: "smooth", block: "nearest" });
}

// Generate a 12-record random dataset
function generateDataset() {
    stopPlayback();
    heap = [];
    sequential = [];

    const names = ["Aarav", "Rahul", "Priya", "Ananya", "Karan", "Neha", "Arjun", "Riya", "Kabir", "Ishita", "Dev", "Meera", "Aditya", "Nisha"];
    const departments = ["CSE", "ECE", "IT", "AIML", "ME"];
    const used = new Set();

    while (heap.length < 12) {
        const id = Math.floor(Math.random() * 900) + 100;
        if (used.has(id)) continue;
        used.add(id);

        heap.push({
            id,
            name: names[Math.floor(Math.random() * names.length)],
            dept: departments[Math.floor(Math.random() * departments.length)],
            marks: Math.floor(Math.random() * 41) + 60
        });
    }

    sequential = [...heap].sort((a, b) => a.id - b.id);
    operations++;

    addLog("GENERATE", "Generated 12 random records.");
    explain("insert", { id: "random" });
    renderFiles();
    toast("Random dataset generated.", "success");
}

// Load guided sample experiments (1 to 4)
function loadExperiment(number) {
    stopPlayback();

    if (number === 1) {
        // Experiment 1: Search Comparison
        heap = [
            { id: 101, name: "Rahul", dept: "CSE", marks: 85 },
            { id: 108, name: "Aman", dept: "ECE", marks: 72 },
            { id: 103, name: "Priya", dept: "IT", marks: 91 },
            { id: 115, name: "Ananya", dept: "AIML", marks: 89 },
            { id: 105, name: "Rohan", dept: "ME", marks: 78 }
        ];
        sequential = [...heap].sort((a, b) => a.id - b.id);
        $("recordId").value = "105";
        toast("Loaded Experiment 1: Search Comparison", "info");
    } else if (number === 2) {
        // Experiment 2: Block Capacity
        heap = [
            { id: 110, name: "Karan", dept: "CSE", marks: 82 },
            { id: 102, name: "Sneha", dept: "ECE", marks: 76 },
            { id: 118, name: "Vikas", dept: "IT", marks: 88 },
            { id: 107, name: "Pooja", dept: "AIML", marks: 94 },
            { id: 125, name: "Arjun", dept: "ME", marks: 69 },
            { id: 112, name: "Divya", dept: "CSE", marks: 85 },
            { id: 130, name: "Manish", dept: "ECE", marks: 74 },
            { id: 104, name: "Nidhi", dept: "IT", marks: 90 }
        ];
        sequential = [...heap].sort((a, b) => a.id - b.id);
        $("blockSize").value = "3";
        $("blockValue").textContent = "3";
        toast("Loaded Experiment 2: Block Capacity (3 per block)", "info");
    } else if (number === 3) {
        // Experiment 3: Mixed Workload
        heap = [
            { id: 120, name: "Neha", dept: "AIML", marks: 88 },
            { id: 106, name: "Amit", dept: "CSE", marks: 80 },
            { id: 114, name: "Ritu", dept: "IT", marks: 86 },
            { id: 101, name: "Rahul", dept: "CSE", marks: 85 },
            { id: 128, name: "Suresh", dept: "ME", marks: 70 },
            { id: 109, name: "Kavita", dept: "ECE", marks: 92 }
        ];
        sequential = [...heap].sort((a, b) => a.id - b.id);
        toast("Loaded Experiment 3: Mixed Workload", "info");
    } else if (number === 4) {
        // Experiment 4: Ordered Search
        heap = [
            { id: 103, name: "Priya", dept: "IT", marks: 91 },
            { id: 115, name: "Ananya", dept: "AIML", marks: 89 },
            { id: 108, name: "Aman", dept: "ECE", marks: 72 },
            { id: 122, name: "Deepak", dept: "ME", marks: 68 },
            { id: 101, name: "Rahul", dept: "CSE", marks: 85 }
        ];
        sequential = [...heap].sort((a, b) => a.id - b.id);
        $("recordId").value = "106";
        $("searchStrategy").value = "ordered";
        toast("Loaded Experiment 4: Ordered Search", "info");
    }

    operations++;
    addLog("EXPERIMENT", `Loaded guided experiment ${number}.`);
    renderFiles();
    navigate("simulator");
}

// Run identical 8-query search benchmark workload
function runWorkload() {
    if (!heap.length) generateDataset();

    const targets = heap.slice(0, Math.min(8, heap.length));
    let heapComparisons = 0;
    let seqComparisons = 0;

    targets.forEach(target => {
        const h = heap.findIndex(r => r.id === target.id);
        const s = sequential.findIndex(r => r.id === target.id);
        heapComparisons += h + 1;
        seqComparisons += s + 1;
    });

    stats.heapComparisons += heapComparisons;
    stats.seqComparisons += seqComparisons;
    operations++;

    const lower = heapComparisons < seqComparisons ? "Heap" : (heapComparisons > seqComparisons ? "Sequential" : "Equal");

    $("workloadResult").innerHTML = `
        <div class="workload-grid">
            <div class="workload-stat">
                <span>WORKLOAD QUERIES</span>
                <b>${targets.length}</b>
            </div>
            <div class="workload-stat">
                <span>HEAP COMPARISONS</span>
                <b>${heapComparisons}</b>
            </div>
            <div class="workload-stat">
                <span>SEQUENTIAL COMPARISONS</span>
                <b>${seqComparisons}</b>
            </div>
            <div class="workload-stat">
                <span>LOWER COMPARISONS</span>
                <b>${lower}</b>
            </div>
        </div>
    `;

    addLog("BENCHMARK", `Executed ${targets.length} search benchmark operations.`);
    updateStats();
    toast("Benchmark completed.", "success");
}

// Save current simulation to localStorage
function saveSimulation() {
    if (!heap.length) {
        toast("No records to save.", "info");
        return;
    }

    const item = {
        name: `Simulation ${savedHistory.length + 1}`,
        date: new Date().toLocaleString(),
        records: heap.length,
        blockSize: getBlockSize(),
        operations,
        heap: [...heap],
        sequential: [...sequential],
        stats: { ...stats }
    };

    savedHistory.unshift(item);
    localStorage.setItem("fileforgeHistory", JSON.stringify(savedHistory));
    renderHistory();
    toast("Simulation saved to browser history.", "success");
}

// Render list of saved simulations in History tab
function renderHistory() {
    const list = $("historyList");
    if (!list) return;

    list.innerHTML = "";
    if (!savedHistory.length) {
        list.innerHTML = `<div class="empty-history">No saved simulations found.</div>`;
        return;
    }

    savedHistory.forEach((item, index) => {
        const div = document.createElement("div");
        div.className = "history-item";
        div.innerHTML = `
            <div>
                <strong>${escapeHTML(item.name)}</strong>
                <small>${item.date} · ${item.records} records · Block size: ${item.blockSize}</small>
            </div>
            <button class="secondary-btn" onclick="restoreHistory(${index})">Restore</button>
        `;
        list.appendChild(div);
    });
}

// Restore a previously saved simulation
function restoreHistory(index) {
    const item = savedHistory[index];
    if (!item) return;

    stopPlayback();
    heap = [...item.heap];
    sequential = [...item.sequential];
    operations = item.operations || 0;
    stats = { ...item.stats };

    $("blockSize").value = item.blockSize;
    $("blockValue").textContent = item.blockSize;

    renderFiles();
    navigate("simulator");
    toast(`Restored: ${item.name}`, "success");
}

// Trigger file input dialog for JSON import
function openImport() {
    $("importFile").click();
}

// Handle imported JSON file
$("importFile").addEventListener("change", event => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = e => {
        try {
            const data = JSON.parse(e.target.result);
            if (Array.isArray(data.heap)) {
                heap = data.heap;
                sequential = data.sequential || [...heap].sort((a, b) => a.id - b.id);
                if (data.blockSize) {
                    $("blockSize").value = data.blockSize;
                    $("blockValue").textContent = data.blockSize;
                }
                renderFiles();
                toast("Simulation imported successfully.", "success");
            } else {
                toast("Invalid file format.", "error");
            }
        } catch (err) {
            toast("Failed to parse JSON file.", "error");
        }
    };
    reader.readAsText(file);
});

// Export current simulation to JSON file
function exportData() {
    const data = {
        name: "fileforge-simulation",
        date: new Date().toISOString(),
        blockSize: getBlockSize(),
        heap,
        sequential,
        stats
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "fileforge-simulation.json";
    link.click();
    URL.revokeObjectURL(url);
    toast("Simulation exported as JSON.", "success");
}

// Download printable text simulation report
function downloadReport() {
    const report = `FILEFORGE: Heap vs Sequential File Organization
DBMS Simulation Report
===================================================
Generated: ${new Date().toLocaleString()}
Block Capacity: ${getBlockSize()} records per block
Total Records: ${heap.length}
Total Operations: ${operations}

HEAP FILE STATISTICS
--------------------
Comparisons: ${stats.heapComparisons}
Block Accesses: ${stats.heapBlocks}
Total Blocks: ${Math.ceil(heap.length / getBlockSize())}

SEQUENTIAL FILE STATISTICS
--------------------------
Comparisons: ${stats.seqComparisons}
Block Accesses: ${stats.seqBlocks}
Total Blocks: ${Math.ceil(sequential.length / getBlockSize())}

HEAP RECORDS (INSERTION ORDER)
------------------------------
${heap.map(r => `${r.id} | ${r.name} | ${r.dept} | ${r.marks}`).join("\n")}

SEQUENTIAL RECORDS (SORTED PRIMARY KEY ORDER)
---------------------------------------------
${sequential.map(r => `${r.id} | ${r.name} | ${r.dept} | ${r.marks}`).join("\n")}

===================================================
FILEFORGE DBMS Virtual Lab
`;

    const blob = new Blob([report], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "fileforge-report.txt";
    link.click();
    URL.revokeObjectURL(url);
    toast("Simulation report generated and downloaded.", "success");
}

// Theme toggle (Dark Mode / Light Mode)
$("themeBtn").addEventListener("click", () => {
    document.body.classList.toggle("light-mode");
    localStorage.setItem(
        "fileforgeTheme",
        document.body.classList.contains("light-mode") ? "light" : "dark"
    );
});

// Restore saved theme
if (localStorage.getItem("fileforgeTheme") === "light") {
    document.body.classList.add("light-mode");
}

// Block size slider listener
$("blockSize").addEventListener("input", event => {
    $("blockValue").textContent = event.target.value;
    renderFiles();
});

// Top bar action button listeners
$("resetBtn").addEventListener("click", resetSimulation);
$("sampleBtn").addEventListener("click", () => loadExperiment(1));
$("exportBtn").addEventListener("click", exportData);

// Reset the entire simulation state to clean
function resetSimulation() {
    stopPlayback();
    heap = [];
    sequential = [];
    operations = 0;
    stats = {
        heapComparisons: 0,
        seqComparisons: 0,
        heapBlocks: 0,
        seqBlocks: 0
    };

    clearInputs();
    resetPlayback();

    $("resultBox").innerHTML = `
        <div class="empty-result">
            <div>⌁</div>
            <p>Run an operation to view detailed simulation statistics.</p>
        </div>
    `;

    $("operationStatus").textContent = "IDLE";
    $("operationStatus").className = "result-status";

    $("explanation").innerHTML = `
        <p>The explanation engine will describe each operation and why the two file organizations behave differently.</p>
    `;

    addLog("RESET", "Simulation state reset.");
    renderFiles();
    toast("Simulation reset to initial state.", "info");
}

// Multiple-choice quiz questions and answers
const questions = [
    {
        q: "Which file organization keeps records in insertion order without sorting?",
        options: ["Heap File", "Sequential File", "B+ Tree", "Hash File"],
        answer: 0
    },
    {
        q: "What is the defining characteristic of a sequential file?",
        options: [
            "Records are randomly placed",
            "Records are maintained according to an ordering key",
            "Records are always hashed",
            "Records cannot be deleted"
        ],
        answer: 1
    },
    {
        q: "What does FILEFORGE use blocks to represent?",
        options: [
            "CPU instructions",
            "Network packets",
            "Secondary storage disk pages/blocks",
            "SQL keywords"
        ],
        answer: 2
    },
    {
        q: "Which operation is typically fastest in a heap file when space is available?",
        options: [
            "Appending a new record O(1)",
            "Finding an arbitrary record",
            "Sorting all records",
            "Ordered traversal"
        ],
        answer: 0
    },
    {
        q: "Why can a search be performed in O(log₂ n) in a sequential file?",
        options: [
            "Because records are encrypted",
            "Because keys are maintained in sorted order (Binary Search)",
            "Because blocks are deleted",
            "Because heap files are sorted"
        ],
        answer: 1
    }
];

// Render current quiz question and option buttons
function renderQuiz() {
    const question = questions[quiz.index];
    $("quizNumber").textContent = `Question ${quiz.index + 1} of ${questions.length}`;
    $("quizProgress").style.width = `${((quiz.index + 1) / questions.length) * 100}%`;
    $("quizQuestion").textContent = question.q;
    $("quizScore").textContent = `Score: ${quiz.score}`;

    const box = $("quizOptions");
    box.innerHTML = "";

    question.options.forEach((option, index) => {
        const button = document.createElement("button");
        button.className = "quiz-option";
        button.textContent = option;
        button.onclick = () => answerQuiz(index, button);
        box.appendChild(button);
    });

    $("quizNextBtn").disabled = false;
    $("quizNextBtn").textContent = quiz.index === questions.length - 1 ? "Finish" : "Next →";
    quiz.answered = false;
}

// Check selected quiz answer and update score
function answerQuiz(answer, button) {
    if (quiz.answered) return;
    quiz.answered = true;

    const question = questions[quiz.index];
    const buttons = document.querySelectorAll(".quiz-option");

    buttons.forEach((item, index) => {
        item.disabled = true;
        if (index === question.answer) item.classList.add("correct");
    });

    if (answer === question.answer) {
        quiz.score++;
        button.classList.add("correct");
        toast("Correct answer!", "success");
    } else {
        button.classList.add("wrong");
        toast("Not quite. Review the highlighted answer.", "error");
    }

    $("quizScore").textContent = `Score: ${quiz.score}`;
}

// Advance to the next quiz question
function nextQuizQuestion() {
    if (!quiz.answered) {
        toast("Choose an answer first.", "info");
        return;
    }

    if (quiz.index >= questions.length - 1) {
        toast(`Quiz complete! Final Score: ${quiz.score}/${questions.length}`, "success");
        quiz.index = 0;
        quiz.score = 0;
    } else {
        quiz.index++;
    }

    renderQuiz();
}

// Keyboard shortcuts: Enter to insert, Space to pause/play
document.addEventListener("keydown", event => {
    if (event.key === "Enter" && document.activeElement.tagName === "INPUT") {
        if ($("recordId").value && $("recordName").value && $("recordDept").value && $("recordMarks").value) {
            insertRecord();
        }
    }

    if (event.key === " " && playback.active) {
        event.preventDefault();
        togglePlayback();
    }
});

// Initial startup rendering
renderFiles();
renderLog();
renderHistory();
renderQuiz();
addLog("SYSTEM", "FILEFORGE simulation engine initialized.");