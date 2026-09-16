// Core DBMS file operations: Insert, Search, and Delete

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
