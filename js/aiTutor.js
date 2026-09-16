// Contextual AI Guidance and Interactive AI Tutor

// Generate contextual technical explanation of recent operation
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

// Pre-programmed DBMS knowledge base for AI Tutor
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
