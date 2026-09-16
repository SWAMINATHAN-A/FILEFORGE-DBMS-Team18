// Disk block storage, fragmentation, and visual block rendering

// Get records per block from slider
function getBlockSize() {
    return Number($("blockSize").value);
}

// Partition an array of records into fixed-size disk blocks
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

// Render a single file container with blocks and empty slots
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

        // Render populated records
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

        // Render empty slots for internal fragmentation
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

// Update dashboard metrics, charts, and storage utilization counters
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

    // Storage architecture and internal fragmentation metrics
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

    // Relative comparison bar widths
    const max = Math.max(stats.heapComparisons, stats.seqComparisons, 1);
    $("heapBar").style.width = `${(stats.heapComparisons / max) * 100}%`;
    $("seqBar").style.width = `${(stats.seqComparisons / max) * 100}%`;
    $("heapBarValue").textContent = stats.heapComparisons;
    $("seqBarValue").textContent = stats.seqComparisons;
}
