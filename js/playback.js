// Visual playback controller, stepper, and pointer badges

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
