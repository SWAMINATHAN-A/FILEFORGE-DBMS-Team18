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
                <small>${item.date} Â· ${item.records} records Â· Block size: ${item.blockSize}</small>
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
