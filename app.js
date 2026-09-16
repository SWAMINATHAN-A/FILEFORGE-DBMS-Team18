/* =========================================================
   FILEFORGE
   Heap vs Sequential File Organization Simulator
========================================================= */


/* =========================================================
   STATE
========================================================= */

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

let savedHistory =
    JSON.parse(
        localStorage.getItem("fileforgeHistory") || "[]"
    );


let playback = {
    active: false,
    running: false,
    target: null,
    steps: [],
    current: -1,
    timer: null
};


let quiz = {
    index: 0,
    score: 0,
    answered: false
};


/* =========================================================
   HELPERS
========================================================= */

const $ = id =>
    document.getElementById(id);


function wait(ms){
    return new Promise(
        resolve => setTimeout(resolve, ms)
    );
}


function timestamp(){

    return new Date().toLocaleTimeString(
        [],
        {
            hour:"2-digit",
            minute:"2-digit",
            second:"2-digit"
        }
    );

}


/* =========================================================
   TOAST
========================================================= */

function toast(message,type="info"){

    const container =
        $("toastContainer");

    const item =
        document.createElement("div");

    item.className =
        `toast ${type}`;

    item.textContent = message;

    container.appendChild(item);

    setTimeout(() => {

        item.style.opacity = "0";
        item.style.transform =
            "translateX(15px)";

        setTimeout(
            () => item.remove(),
            250
        );

    },2800);

}


/* =========================================================
   NAVIGATION
========================================================= */

function navigate(page){

    document
        .querySelectorAll(".page")
        .forEach(section =>
            section.classList.remove("active")
        );

    document
        .querySelectorAll(".nav-btn")
        .forEach(button =>
            button.classList.remove("active")
        );

    const target =
        $(page);

    if(target)
        target.classList.add("active");

    const nav =
        document.querySelector(
            `.nav-btn[data-page="${page}"]`
        );

    if(nav)
        nav.classList.add("active");

    const titles = {

        dashboard:"Dashboard",
        simulator:"Simulator",
        analytics:"Analytics",
        history:"History",
        learn:"Learn",
        quiz:"Quiz",
        about:"About"

    };

    $("pageTitle").textContent =
        titles[page];

    $("breadcrumbPage").textContent =
        page.toUpperCase();

    if(page === "history")
        renderHistory();

    if(page === "analytics")
        updateStats();

    if(page === "quiz")
        renderQuiz();

    window.scrollTo({
        top:0,
        behavior:"smooth"
    });
}


document
    .querySelectorAll(".nav-btn")
    .forEach(button => {

        button.addEventListener(
            "click",
            () => navigate(button.dataset.page)
        );

    });


/* =========================================================
   INPUT
========================================================= */

function getRecord(){

    const id =
        Number($("recordId").value);

    const name =
        $("recordName").value.trim();

    const dept =
        $("recordDept").value.trim();

    const marks =
        Number($("recordMarks").value);


    if(
        !id ||
        !name ||
        !dept ||
        Number.isNaN(marks)
    ){

        toast(
            "Please enter all record details.",
            "error"
        );

        return null;
    }


    if(marks < 0 || marks > 100){

        toast(
            "Marks must be between 0 and 100.",
            "error"
        );

        return null;
    }


    return {
        id,
        name,
        dept,
        marks
    };

}


function clearInputs(){

    $("recordId").value = "";
    $("recordName").value = "";
    $("recordDept").value = "";
    $("recordMarks").value = "";

}


/* =========================================================
   BLOCK MODEL
========================================================= */

function getBlockSize(){

    return Number(
        $("blockSize").value
    );

}


function splitBlocks(data){

    const size =
        getBlockSize();

    const blocks = [];

    for(
        let i=0;
        i<data.length;
        i+=size
    ){

        blocks.push(
            data.slice(i,i+size)
        );

    }

    return blocks;

}


/* =========================================================
   RENDER FILES
========================================================= */

function renderFiles(){

    renderFile(
        heap,
        $("heapBlocksView")
    );

    renderFile(
        sequential,
        $("seqBlocksView")
    );

    updateStats();

}


function renderFile(data,container){

    container.innerHTML = "";

    if(!data.length){

        container.innerHTML =
            `<div class="empty-file">
                No records in this file.
            </div>`;

        return;
    }


    const blocks =
        splitBlocks(data);

    const bCapacity =
        getBlockSize();


    blocks.forEach(
        (records,index) => {

            const isFull = records.length === bCapacity;

            const block =
                document.createElement("div");

            block.className =
                `block ${isFull ? "block-full" : "block-partial"}`;

            block.dataset.block =
                index;


            block.innerHTML =
                `<div class="block-header">
                    <span>
                        BLOCK ${String(index).padStart(2,"0")}
                    </span>

                    <div style="display:flex;align-items:center;gap:6px;">
                        <span class="block-tag ${isFull ? 'full' : 'partial'}">
                            ${isFull ? 'FULL' : 'PARTIAL'}
                        </span>
                        <span class="block-cap">
                            ${records.length}/${bCapacity}
                        </span>
                    </div>
                </div>`;


            records.forEach(record => {

                const item =
                    document.createElement("div");

                item.className =
                    "record";

                item.dataset.id =
                    record.id;

                item.innerHTML =
                    `<strong>${record.id}</strong>
                    <small>
                        ${escapeHTML(record.name)}
                        ·
                        ${escapeHTML(record.dept)}
                    </small>
                    <small>
                        Marks: ${record.marks}
                    </small>`;

                block.appendChild(item);

            });


            /* RENDER EMPTY SLOTS (INTERNAL FRAGMENTATION) */
            for(let emptyIdx = records.length; emptyIdx < bCapacity; emptyIdx++){

                const emptySlot =
                    document.createElement("div");

                emptySlot.className =
                    "record empty-slot";

                emptySlot.innerHTML =
                    `<strong>⬚ Slot ${emptyIdx + 1} (Empty)</strong>
                    <small>Internal Fragmentation</small>`;

                block.appendChild(emptySlot);

            }


            container.appendChild(block);

        }
    );

}


function escapeHTML(value){

    return String(value)
        .replaceAll("&","&amp;")
        .replaceAll("<","&lt;")
        .replaceAll(">","&gt;")
        .replaceAll('"',"&quot;")
        .replaceAll("'","&#039;");

}


/* =========================================================
   STATS & STORAGE UTILIZATION
========================================================= */

function updateStats(){

    const bSize = getBlockSize();

    const heapBlockCount =
        Math.ceil(
            heap.length / bSize
        ) || 0;

    const seqBlockCount =
        Math.ceil(
            sequential.length / bSize
        ) || 0;


    $("heapCount").textContent =
        heap.length;

    $("seqCount").textContent =
        sequential.length;

    $("heapBlocks").textContent =
        heapBlockCount;

    $("seqBlocks").textContent =
        seqBlockCount;


    $("dashRecords").textContent =
        heap.length;

    $("dashOperations").textContent =
        operations;

    $("dashHeapBlocks").textContent =
        heapBlockCount;

    $("dashSeqBlocks").textContent =
        seqBlockCount;


    $("analyticsHeap").textContent =
        stats.heapComparisons;

    $("analyticsSeq").textContent =
        stats.seqComparisons;

    $("analyticsHeapBlocks").textContent =
        stats.heapBlocks;

    $("analyticsSeqBlocks").textContent =
        stats.seqBlocks;


    /* STORAGE UTILIZATION & INTERNAL FRAGMENTATION METRICS */
    const totalCapacity =
        heapBlockCount * bSize;

    const wastedSlots =
        Math.max(0, totalCapacity - heap.length);

    const packingFactor =
        totalCapacity > 0
            ? Math.round((heap.length / totalCapacity) * 100)
            : 100;

    const fragPct =
        totalCapacity > 0
            ? Math.round((wastedSlots / totalCapacity) * 100)
            : 0;

    const maxProbes =
        Math.ceil(Math.log2(Math.max(1, heap.length)));

    const maxIo =
        Math.ceil(Math.log2(Math.max(1, heapBlockCount)));


    if($("packingFactor")){
        $("packingFactor").textContent = `${packingFactor}%`;
    }

    if($("totalCapacitySlots")){
        $("totalCapacitySlots").textContent = totalCapacity;
    }

    if($("activeRecordsCount")){
        $("activeRecordsCount").textContent = heap.length;
    }

    if($("wastedSlotsCount")){
        $("wastedSlotsCount").textContent = wastedSlots;
    }

    if($("allocatedBlocksSummary")){
        $("allocatedBlocksSummary").textContent =
            `${heapBlockCount} blocks × ${bSize} slot capacity`;
    }

    if($("fragmentationPct")){
        $("fragmentationPct").textContent =
            `${fragPct}% wasted disk space`;
    }

    if($("binaryCostEstimate")){
        $("binaryCostEstimate").textContent =
            `≤ ${maxProbes} Probes`;
    }

    if($("binaryIoFormula")){
        $("binaryIoFormula").textContent =
            `≤ ${maxIo} block I/Os (Binary Search)`;
    }


    const max =
        Math.max(
            stats.heapComparisons,
            stats.seqComparisons,
            1
        );


    $("heapBar").style.width =
        `${stats.heapComparisons/max*100}%`;

    $("seqBar").style.width =
        `${stats.seqComparisons/max*100}%`;

    $("heapBarValue").textContent =
        stats.heapComparisons;

    $("seqBarValue").textContent =
        stats.seqComparisons;

}


/* =========================================================
   LOG
========================================================= */

function addLog(type,message){

    activity.unshift({

        time:timestamp(),
        type,
        message

    });

    activity =
        activity.slice(0,100);

    renderLog();

}


function renderLog(){

    const box =
        $("log");

    if(!activity.length){

        box.innerHTML =
            `<div class="history-empty">
                No activity yet.
            </div>`;

        return;
    }


    box.innerHTML =
        activity
            .map(item =>
                `<div class="log-entry">

                    <span class="log-time">
                        ${item.time}
                    </span>

                    <strong class="log-type">
                        ${item.type}
                    </strong>

                    <span class="log-message">
                        ${escapeHTML(item.message)}
                    </span>

                </div>`
            )
            .join("");

}


function clearLog(){

    activity = [];

    renderLog();

    toast(
        "Activity log cleared.",
        "info"
    );

}


/* =========================================================
   INSERT
========================================================= */

function insertRecord(){

    stopPlayback();

    const record =
        getRecord();

    if(!record)
        return;


    if(
        heap.some(
            item => item.id === record.id
        )
    ){

        toast(
            `Record ${record.id} already exists.`,
            "error"
        );

        return;
    }


    /* HEAP */

    heap.push({
        ...record
    });


    /* SEQUENTIAL */

    sequential.push({
        ...record
    });

    sequential.sort(
        (a,b) => a.id - b.id
    );


    operations++;


    addLog(
        "INSERT",
        `Record ${record.id} inserted into both files.`
    );


    showResult(
        true,
        `Record ${record.id} inserted`,
        [
            ["Heap", "Appended to file"],
            ["Sequential", "Placed in key order"],
            ["Records", heap.length],
            ["Operations", operations]
        ]
    );


    explain(
        "insert",
        record
    );


    clearInputs();

    renderFiles();

    toast(
        `Record ${record.id} inserted successfully.`,
        "success"
    );

}


/* =========================================================
   SEARCH SETUP
========================================================= */

function startSearch(){

    const id =
        Number($("recordId").value);

    if(!id){

        toast(
            "Enter a Record ID to search.",
            "error"
        );

        return;
    }


    stopPlayback();


    const strategy =
        $("searchStrategy").value;


    playback.target =
        id;

    playback.active =
        true;

    playback.running =
        false;

    playback.current =
        -1;


    playback.steps =
        buildSearchSteps(
            id,
            strategy
        );


    $("playbackTitle").textContent =
        `Searching for Record ${id}`;

    $("playBtn").textContent =
        "▶";


    updatePlaybackUI();


    addLog(
        "SEARCH",
        `Search simulation initialized for Record ${id}.`
    );


    toast(
        "Search simulation ready. Press Play.",
        "info"
    );

}


function buildSearchSteps(id,strategy){

    const steps = [];

    /* HEAP PROBES (Linear Scan) */
    const heapProbes = [];
    let heapFound = false;

    for(let i = 0; i < heap.length; i++){
        const r = heap[i];
        const isMatch = r.id === id;
        heapProbes.push({
            file: "heap",
            index: i,
            id: r.id,
            status: isMatch ? "found" : "checking",
            message: isMatch
                ? `Record ${r.id} FOUND in Heap at Block ${String(Math.floor(i / getBlockSize())).padStart(2,"0")} (Index ${i})`
                : `Checking Heap Record ${r.id} (Index ${i})...`
        });

        if(isMatch){
            heapFound = true;
            break;
        }
    }

    if(!heapFound && heap.length > 0){
        heapProbes.push({
            file: "heap",
            index: heap.length - 1,
            id: null,
            status: "not_found",
            message: `Record ${id} NOT found in Heap after scanning all ${heap.length} records.`
        });
    }


    /* SEQUENTIAL PROBES */
    const seqProbes = [];

    if(strategy === "binary" || strategy === "race"){

        let low = 0;
        let high = sequential.length - 1;
        let seqFound = false;

        while(low <= high){
            const mid = Math.floor((low + high) / 2);
            const r = sequential[mid];
            const isMatch = r.id === id;
            const bIndex = Math.floor(mid / getBlockSize());

            let msg = "";
            if(isMatch){
                msg = `🎯 Record ${r.id} FOUND via Binary Search at Index ${mid} (Block ${String(bIndex).padStart(2,"0")})!`;
            } else if(r.id < id){
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

            if(isMatch){
                seqFound = true;
                break;
            } else if(r.id < id){
                low = mid + 1;
            } else {
                high = mid - 1;
            }
        }

        if(!seqFound && sequential.length > 0){
            seqProbes.push({
                file: "seq",
                index: -1,
                id: null,
                low,
                high,
                mid: -1,
                strategy: "binary",
                status: "not_found",
                message: `Record ${id} NOT found in Sequential file via Binary Search (Search space exhausted).`
            });
        }

    } else if(strategy === "ordered"){

        let seqFound = false;
        for(let i = 0; i < sequential.length; i++){
            const r = sequential[i];
            const isMatch = r.id === id;

            if(isMatch){
                seqProbes.push({
                    file: "seq",
                    index: i,
                    id: r.id,
                    status: "found",
                    message: `Record ${r.id} FOUND in Sequential file at Index ${i}!`
                });
                seqFound = true;
                break;
            } else if(r.id > id){
                seqProbes.push({
                    file: "seq",
                    index: i,
                    id: r.id,
                    status: "stop",
                    message: `Ordered Stop: Record ${r.id} > ${id}. Target does not exist!`
                });
                seqFound = false;
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

        /* Sequential Scan */
        for(let i = 0; i < sequential.length; i++){
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
            if(isMatch) break;
        }

    }


    /* STRATEGY ROUTING */
    if(strategy === "race"){

        const maxRounds = Math.max(heapProbes.length, seqProbes.length);
        for(let r = 0; r < maxRounds; r++){
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

        /* Phased Playback: Heap phase first, then Sequential phase */
        heapProbes.forEach(step => steps.push(step));
        seqProbes.forEach(step => steps.push(step));

    }

    return steps;
}


/* =========================================================
   PLAYBACK
========================================================= */

function updatePlaybackUI(){

    const total =
        playback.steps.length;

    const current =
        playback.current + 1;

    $("stepLabel").textContent =
        `${Math.max(0,current)} / ${total}`;

    const percent =
        total
            ? Math.max(
                0,
                Math.min(
                    100,
                    (current / total) * 100
                )
            )
            : 0;

    $("progressBar").style.width =
        `${percent}%`;

    clearHighlights();

    if(
        playback.current < 0 ||
        !playback.steps[playback.current]
    ){
        return;
    }

    const step =
        playback.steps[playback.current];

    if(step.isRace){

        /* RACE MODE PLAYBACK */
        const h = step.heapStep;
        const s = step.seqStep;

        if(!h.done && h.index !== undefined){
            const hRecords =
                $("heapBlocksView").querySelectorAll(".record");

            if(hRecords[h.index]){
                hRecords[h.index].classList.add(
                    h.status === "found" ? "found" : "checking"
                );
                const blk = hRecords[h.index].closest(".block");
                if(blk) blk.classList.add("active");
            }
        }

        if(!s.done && s.index !== undefined && s.index >= 0){
            const sRecords =
                $("seqBlocksView").querySelectorAll(".record");

            if(sRecords[s.index]){
                sRecords[s.index].classList.add(
                    s.status === "found" ? "found" : "mid-ptr"
                );
                sRecords[s.index].classList.add(
                    s.status === "found" ? "found" : "checking"
                );
                const blk = sRecords[s.index].closest(".block");
                if(blk) blk.classList.add("active");
            }

            if(s.low !== undefined && s.high !== undefined){
                if(sRecords[s.low]){
                    sRecords[s.low].classList.add("low-ptr");
                    attachPtrBadge(sRecords[s.low], "L", "low");
                }
                if(sRecords[s.mid] && s.status !== "found"){
                    attachPtrBadge(sRecords[s.mid], "MID", "mid");
                }
                if(sRecords[s.high]){
                    sRecords[s.high].classList.add("high-ptr");
                    attachPtrBadge(sRecords[s.high], "R", "high");
                }
                sRecords.forEach((rec, idx) => {
                    if(idx < s.low || idx > s.high){
                        rec.classList.add("range-excluded");
                    }
                });
            }
        }

        let titleText = `🏁 Race Step ${step.round}/${step.totalRounds} — `;
        if(s.status === "found" && h.status !== "found"){
            titleText += `⚡ Sequential Binary Search WON! (Found in ${step.seqProbesCount} probes; Heap at probe ${step.heapProbesCount})`;
        } else if(h.status === "found" && s.status !== "found"){
            titleText += `Heap Linear Scan found first (Found in ${step.heapProbesCount} probes; Sequential at probe ${step.seqProbesCount})`;
        } else if(h.status === "found" && s.status === "found"){
            titleText += `Both finished! Heap: ${step.heapProbesCount} probes | Sequential: ${step.seqProbesCount} probes`;
        } else {
            titleText += `Heap Linear (Probe ${step.heapProbesCount}) vs Sequential Binary (Probe ${step.seqProbesCount})`;
        }
        $("playbackTitle").textContent = titleText;

    } else {

        /* PHASED PLAYBACK */
        const container =
            step.file === "heap"
                ? $("heapBlocksView")
                : $("seqBlocksView");

        const records =
            container.querySelectorAll(".record");

        if(step.index !== undefined && step.index >= 0 && records[step.index]){
            records[step.index].classList.add(
                step.status === "found"
                    ? "found"
                    : (step.status === "stop" ? "checking" : "checking")
            );

            const block =
                records[step.index].closest(".block");

            if(block) block.classList.add("active");
        }

        if(step.file === "seq" && step.strategy === "binary"){
            if(step.low !== undefined && step.high !== undefined){
                if(records[step.low]){
                    records[step.low].classList.add("low-ptr");
                    attachPtrBadge(records[step.low], "L", "low");
                }
                if(records[step.mid] && step.status !== "found"){
                    records[step.mid].classList.add("mid-ptr");
                    attachPtrBadge(records[step.mid], "MID", "mid");
                }
                if(records[step.high]){
                    records[step.high].classList.add("high-ptr");
                    attachPtrBadge(records[step.high], "R", "high");
                }
                records.forEach((rec, idx) => {
                    if(idx < step.low || idx > step.high){
                        rec.classList.add("range-excluded");
                    }
                });
            }
        }

        $("playbackTitle").textContent =
            step.message || (
                step.status === "found"
                    ? `Record ${step.id} found in ${step.file === "heap" ? "Heap" : "Sequential"}`
                    : step.status === "stop"
                        ? `Ordered search stopped at ${step.id}`
                        : `Checking ${step.file === "heap" ? "Heap" : "Sequential"} Record ${step.id}`
            );

    }

}


function attachPtrBadge(element, text, className){
    const badge = document.createElement("span");
    badge.className = `ptr-badge ${className}`;
    badge.textContent = text;
    element.appendChild(badge);
}


function clearHighlights(){

    document
        .querySelectorAll(
            ".record.checking, .record.found, .block.active, .record.low-ptr, .record.mid-ptr, .record.high-ptr, .record.range-excluded"
        )
        .forEach(item => {
            item.classList.remove(
                "checking",
                "found",
                "active",
                "low-ptr",
                "mid-ptr",
                "high-ptr",
                "range-excluded"
            );
        });

    document
        .querySelectorAll(".ptr-badge")
        .forEach(badge => badge.remove());

}


function nextStep(){

    if(!playback.active){
        toast("Start a search first.", "info");
        return;
    }

    if(playback.current >= playback.steps.length - 1){
        finishSearch();
        return;
    }

    playback.current++;
    updatePlaybackUI();

}


function previousStep(){

    if(!playback.active)
        return;

    if(playback.current > 0)
        playback.current--;

    updatePlaybackUI();

}


function togglePlayback(){

    if(!playback.active){
        toast("Start a search first.", "info");
        return;
    }

    if(playback.running){
        stopPlayback();
        $("playBtn").textContent = "▶";
        return;
    }

    playback.running = true;
    $("playBtn").textContent = "Ⅱ";

    runPlayback();

}


async function runPlayback(){

    while(
        playback.running &&
        playback.active &&
        playback.current < playback.steps.length - 1
    ){
        playback.current++;
        updatePlaybackUI();

        await wait(
            Number($("speed").value)
        );
    }

    if(playback.active && playback.current >= playback.steps.length - 1){
        await wait(Number($("speed").value));
        finishSearch();
    }

}


function stopPlayback(){

    playback.running = false;

    if(playback.timer)
        clearTimeout(playback.timer);

    $("playBtn").textContent = "▶";

}


function finishSearch(){

    playback.running = false;
    $("playBtn").textContent = "▶";

    if(!playback.active)
        return;

    const id = playback.target;
    const strategy = $("searchStrategy").value;

    const heapIndex = heap.findIndex(r => r.id === id);
    const seqIndex = sequential.findIndex(r => r.id === id);

    const heapComparisons = heapIndex === -1 ? heap.length : heapIndex + 1;
    let seqComparisons = 0;
    let seqAccess = 0;

    if(strategy === "binary" || strategy === "race"){

        let low = 0, high = sequential.length - 1;
        let probes = 0;
        const accessedBlocks = new Set();
        const bSize = getBlockSize();

        while(low <= high){
            probes++;
            const mid = Math.floor((low + high) / 2);
            accessedBlocks.add(Math.floor(mid / bSize));
            if(sequential[mid].id === id){
                break;
            } else if(sequential[mid].id < id){
                low = mid + 1;
            } else {
                high = mid - 1;
            }
        }
        seqComparisons = probes;
        seqAccess = sequential.length ? Math.max(1, accessedBlocks.size) : 0;

    } else if(strategy === "ordered"){

        if(seqIndex !== -1){
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

    if(strategy === "race" || strategy === "binary"){
        const diff = heapComparisons - seqComparisons;
        const pct = heapComparisons > 0 ? Math.round((diff / heapComparisons) * 100) : 0;
        resultRows.push([
            "Efficiency Advantage",
            diff > 0
                ? `Sequential saved ${diff} comparison(s) (${pct}% reduction)`
                : (diff === 0 ? "Equal comparisons" : `Heap probed ${-diff} fewer record(s)`)
        ]);
    }

    showResult(
        found,
        found ? `Record ${id} Found` : `Record ${id} Not Found`,
        resultRows
    );

    explain(
        "search",
        {
            id,
            found,
            heapComparisons,
            seqComparisons,
            heapAccess,
            seqAccess,
            strategy
        }
    );

    addLog(
        "SEARCH",
        `Record ${id}: ${found ? "FOUND" : "NOT FOUND"} (Heap: ${heapComparisons} probes, Seq: ${seqComparisons} probes)`
    );

    updateStats();


    toast(
        found
            ? `Record ${id} found.`
            : `Record ${id} not found.`,
        found
            ? "success"
            : "error"
    );


    playback.active =
        false;

}


function resetPlayback(){

    stopPlayback();

    playback.active =
        false;

    playback.steps = [];

    playback.current = -1;

    playback.target = null;

    clearHighlights();

    $("playbackTitle").textContent =
        "No active simulation";

    $("stepLabel").textContent =
        "0 / 0";

    $("progressBar").style.width =
        "0%";

}


/* =========================================================
   DELETE
========================================================= */

function deleteRecord(){

    stopPlayback();

    const id =
        Number($("recordId").value);

    if(!id){

        toast(
            "Enter a Record ID to delete.",
            "error"
        );

        return;
    }


    const exists =
        heap.some(
            r => r.id === id
        );


    if(!exists){

        showResult(
            false,
            `Record ${id} does not exist`,
            []
        );

        toast(
            "Record not found.",
            "error"
        );

        return;
    }


    heap =
        heap.filter(
            r => r.id !== id
        );


    sequential =
        sequential.filter(
            r => r.id !== id
        );


    operations++;


    showResult(
        true,
        `Record ${id} deleted`,
        [
            ["Heap","Record removed"],
            ["Sequential","Record removed"],
            ["Remaining",heap.length]
        ]
    );


    explain(
        "delete",
        {id}
    );


    addLog(
        "DELETE",
        `Record ${id} removed from both files.`
    );


    clearInputs();

    renderFiles();


    toast(
        `Record ${id} deleted.`,
        "success"
    );

}


/* =========================================================
   RESULT
========================================================= */

function showResult(success,title,rows){

    const status =
        $("operationStatus");


    status.textContent =
        success
            ? "SUCCESS"
            : "NOT FOUND";


    status.className =
        "result-status " +
        (
            success
                ? "success"
                : "fail"
        );


    let html =
        `<div class="result-title ${
            success
                ? "result-success"
                : "result-fail"
        }">
            ${title}
        </div>`;


    rows.forEach(
        row => {

            html +=
                `<div class="result-row">

                    <span>
                        ${row[0]}
                    </span>

                    <b>
                        ${row[1]}
                    </b>

                </div>`;

        }
    );


    $("resultBox").innerHTML =
        html;

}


/* =========================================================
   EXPLANATION ENGINE
========================================================= */

function explain(type,data){

    let html = "";

    if(type === "insert"){
        html = `
            <div class="explain-card">
                <div class="explain-badge">OPERATION: RECORD INSERTION</div>
                <p>
                    <strong>Heap File:</strong>
                    Record ${data.id} was appended directly to the end of the file into the active storage block.
                    <em>I/O Cost:</em> <strong>O(1)</strong> (Reads the last block, appends record, and writes it back = 2 block I/Os).
                </p>
                <p style="margin-top:10px">
                    <strong>Sequential File:</strong>
                    Record ${data.id} was placed into ascending Primary Key order.
                    <em>I/O Cost:</em> <strong>O(n)</strong> (Requires locating the target block via binary search, followed by shifting subsequent records across blocks to create an insertion slot).
                </p>
            </div>
        `;
    }


    if(type === "search"){
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


    if(type === "delete"){
        html = `
            <div class="explain-card">
                <div class="explain-badge">OPERATION: RECORD DELETION (KEY ${data.id})</div>
                <p>
                    <strong>Heap File:</strong> Located record via linear scan. In real database engines, deletion is handled via:
                    <br>1. <em>Tombstone / Deletion Bit:</em> Mark the record slot as deleted without shifting records (O(1) rewrite).
                    <br>2. <em>Compaction / Swap with Last:</em> Move the very last record in the heap file into this empty slot to prevent fragmentation (O(1) I/O!).
                </p>
                <p style="margin-top:10px">
                    <strong>Sequential File:</strong> Located key via Binary Search O(log₂ n). To maintain sorted order, all subsequent records in the file must be shifted backward, requiring multiple block reads and writes (O(n) I/O cost).
                </p>
            </div>
        `;
    }

    $("explanation").innerHTML = html;

}


/* =========================================================
   INTERACTIVE AI TUTOR KNOWLEDGE BASE & ENGINE
========================================================= */

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
                        <li>However, CPU processing per block increases and internal fragmentation is higher if blocks are partially filled.</li>
                    </ul>
                </li>
                <li><strong>Smaller Block Capacity (e.g., 2 records/block):</strong>
                    <ul>
                        <li>Increases total disk block overhead and metadata pointers.</li>
                        <li>More block I/O operations are required during linear scans.</li>
                        <li>Reduces internal fragmentation wasted bytes on the final block.</li>
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
                        <li><strong>Range Queries:</strong> Queries with <code>WHERE id BETWEEN 100 AND 200</code> can locate the start in <code>O(log₂ N)</code> and then scan contiguous blocks sequentially without jumping.</li>
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
                <li><strong>How DBMS minimizes it:</strong> By using variable-length slotted page architectures, overflow chains, or record compaction.</li>
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

function askAiTutor(topicKey){

    const item = aiKnowledgeBase[topicKey];
    if(!item) return;

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

function submitAiQuery(){

    const input = $("aiCustomQuery");
    const query = (input.value || "").trim().toLowerCase();

    if(!query){
        toast("Please enter a question for the AI Tutor.", "info");
        return;
    }

    input.value = "";
    const bSize = getBlockSize();
    const totalRecords = heap.length;
    const totalBlocks = Math.ceil(totalRecords / bSize) || 0;

    let answerHtml = "";

    if(query.includes("binary") || query.includes("log") || query.includes("faster")){
        answerHtml = aiKnowledgeBase.binary_vs_linear.answer;
    } else if(query.includes("capacity") || query.includes("block") || query.includes("size")){
        answerHtml = aiKnowledgeBase.block_capacity.answer;
    } else if(query.includes("heap") && (query.includes("sequential") || query.includes("choose") || query.includes("difference") || query.includes("better"))){
        answerHtml = aiKnowledgeBase.heap_vs_seq.answer;
    } else if(query.includes("fragment") || query.includes("waste") || query.includes("pack")){
        answerHtml = aiKnowledgeBase.fragmentation.answer;
    } else if(query.includes("delete") || query.includes("remove") || query.includes("tombstone")){
        answerHtml = aiKnowledgeBase.deletion.answer;
    } else if(query.includes("insert") || query.includes("append") || query.includes("shift")){
        answerHtml = `
            <p><strong>Insertion Mechanics in DBMS:</strong></p>
            <ul>
                <li><strong>Heap File:</strong> Always appends to the last block with space (or allocates a new block). Time complexity is <code>O(1)</code>, requiring just 2 block I/Os (1 read + 1 write).</li>
                <li><strong>Sequential File:</strong> Must insert records in sorted key sequence. If inserting into the middle of a full block, all subsequent records must be shifted or an overflow block allocated. Cost is <code>O(n)</code> I/Os.</li>
            </ul>
        `;
    } else {
        answerHtml = `
            <p><strong>AI Tutor Guidance for: "${escapeHTML(query)}"</strong></p>
            <p>In Database Management Systems (DBMS), the physical file organization dictates how data blocks on secondary storage (HDD/SSD) are transferred into buffer memory in RAM.</p>
            <ul>
                <li><strong>Heap Organization:</strong> Fast unordered append (<code>O(1)</code>), slow linear search (<code>O(n)</code>). Best for audit logs and high-throughput ingestion.</li>
                <li><strong>Sequential Organization:</strong> Sorted by search key, fast Binary Search (<code>O(log₂ n)</code>) and ordered range scans (<code>O(n)</code>), but costly record shifting during insertion/deletion (<code>O(n)</code>).</li>
                <li><strong>Disk Blocking:</strong> Transferring blocks rather than individual records reduces mechanical disk seek and rotational latency.</li>
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


/* =========================================================
   RANDOM DATASET
========================================================= */

function generateDataset(){

    stopPlayback();

    heap = [];
    sequential = [];


    const names = [
        "Aarav",
        "Rahul",
        "Priya",
        "Ananya",
        "Karan",
        "Neha",
        "Arjun",
        "Riya",
        "Kabir",
        "Ishita",
        "Dev",
        "Meera",
        "Aditya",
        "Nisha"
    ];


    const departments = [
        "CSE",
        "ECE",
        "IT",
        "AIML",
        "ME"
    ];


    const used = new Set();


    while(heap.length < 12){

        const id =
            Math.floor(
                Math.random()*900
            ) + 100;


        if(used.has(id))
            continue;


        used.add(id);


        heap.push({

            id,

            name:
                names[
                    Math.floor(
                        Math.random() *
                        names.length
                    )
                ],

            dept:
                departments[
                    Math.floor(
                        Math.random() *
                        departments.length
                    )
                ],

            marks:
                Math.floor(
                    Math.random()*41
                ) + 60

        });

    }


    sequential =
        [...heap].sort(
            (a,b) =>
                a.id - b.id
        );


    operations++;


    addLog(
        "GENERATE",
        "Generated 12 random records."
    );


    explain(
        "insert",
        {
            id:"random"
        }
    );


    renderFiles();


    toast(
        "Random dataset generated.",
        "success"
    );

}


/* =========================================================
   SAMPLE EXPERIMENTS
========================================================= */

function loadExperiment(number){

    stopPlayback();


    if(number === 1){

        heap = [

            {
                id:101,
                name:"Rahul",
                dept:"CSE",
                marks:85
            },

            {
                id:108,
                name:"Aman",
                dept:"ECE",
                marks:72
            },

            {
                id:103,
                name:"Priya",
                dept:"IT",
                marks:91
            },

            {
                id:115,
                name:"Karan",
                dept:"CSE",
                marks:67
            },

            {
                id:110,
                name:"Neha",
                dept:"AIML",
                marks:88
            }

        ];

        sequential =
            [...heap].sort(
                (a,b) =>
                    a.id-b.id
            );

        navigate("simulator");

        addLog(
            "EXPERIMENT",
            "Loaded Search Comparison."
        );

        toast(
            "Experiment 01 loaded.",
            "success"
        );

    }


    if(number === 2){

        $("blockSize").value = 2;

        $("blockValue").textContent = 2;

        generateDataset();

        navigate("simulator");

        addLog(
            "EXPERIMENT",
            "Block capacity set to 2."
        );

    }


    if(number === 3){

        generateDataset();

        navigate("analytics");

        toast(
            "Workload experiment loaded.",
            "success"
        );

    }


    if(number === 4){

        heap = [

            {id:120,name:"Neha",dept:"AIML",marks:88},
            {id:105,name:"Rahul",dept:"CSE",marks:85},
            {id:150,name:"Karan",dept:"IT",marks:72},
            {id:110,name:"Priya",dept:"ECE",marks:91},
            {id:135,name:"Aman",dept:"CSE",marks:79},
            {id:170,name:"Riya",dept:"IT",marks:84}

        ];

        sequential =
            [...heap].sort(
                (a,b) =>
                    a.id-b.id
            );

        $("searchStrategy").value =
            "ordered";

        navigate("simulator");

        addLog(
            "EXPERIMENT",
            "Ordered search experiment loaded."
        );

        toast(
            "Experiment 04 loaded.",
            "success"
        );

    }


    renderFiles();

}


/* =========================================================
   WORKLOAD BENCHMARK
========================================================= */

function runWorkload(){

    if(!heap.length){

        generateDataset();
    }


    const targets =
        heap
            .slice(
                0,
                Math.min(
                    8,
                    heap.length
                )
            );


    let heapComparisons = 0;
    let seqComparisons = 0;


    targets.forEach(
        target => {

            const h =
                heap.findIndex(
                    r =>
                        r.id === target.id
                );

            const s =
                sequential.findIndex(
                    r =>
                        r.id === target.id
                );


            heapComparisons +=
                h + 1;

            seqComparisons +=
                s + 1;

        }
    );


    stats.heapComparisons +=
        heapComparisons;

    stats.seqComparisons +=
        seqComparisons;


    operations++;


    const lower =
        heapComparisons <
        seqComparisons
            ? "Heap"
            : heapComparisons >
              seqComparisons
                ? "Sequential"
                : "Equal";


    $("workloadResult").innerHTML =
        `<div class="workload-grid">

            <div class="workload-stat">
                <span>WORKLOAD</span>
                <b>${targets.length}</b>
            </div>

            <div class="workload-stat">
                <span>HEAP</span>
                <b>${heapComparisons}</b>
            </div>

            <div class="workload-stat">
                <span>SEQUENTIAL</span>
                <b>${seqComparisons}</b>
            </div>

            <div class="workload-stat">
                <span>LOWER COMPARISONS</span>
                <b>${lower}</b>
            </div>

        </div>`;


    addLog(
        "BENCHMARK",
        `Executed ${targets.length} search operations.`
    );


    updateStats();


    toast(
        "Benchmark completed.",
        "success"
    );

}


/* =========================================================
   HISTORY
========================================================= */

function saveSimulation(){

    const snapshot = {

        date:
            new Date().toLocaleString(),

        heap:
            JSON.parse(
                JSON.stringify(heap)
            ),

        sequential:
            JSON.parse(
                JSON.stringify(sequential)
            ),

        operations,

        stats:
            {...stats}

    };


    savedHistory.unshift(
        snapshot
    );


    savedHistory =
        savedHistory.slice(
            0,
            10
        );


    localStorage.setItem(
        "fileforgeHistory",
        JSON.stringify(
            savedHistory
        )
    );


    renderHistory();


    toast(
        "Simulation saved to history.",
        "success"
    );

}


function renderHistory(){

    const box =
        $("historyList");


    if(!savedHistory.length){

        box.innerHTML =
            `<div class="history-empty">
                No saved simulations yet.
            </div>`;

        return;
    }


    box.innerHTML =
        savedHistory
            .map(
                (item,index) =>

                `<div class="history-item">

                    <div class="history-info">

                        <strong>
                            Simulation ${savedHistory.length-index}
                        </strong>

                        <small>
                            ${item.date}
                            ·
                            ${item.heap.length} records
                            ·
                            ${item.operations} operations
                        </small>

                    </div>

                    <div class="history-actions">

                        <button
                            class="secondary-btn"
                            onclick="restoreHistory(${index})">
                            Restore
                        </button>

                    </div>

                </div>`
            )
            .join("");

}


function restoreHistory(index){

    const item =
        savedHistory[index];


    heap =
        JSON.parse(
            JSON.stringify(item.heap)
        );

    sequential =
        JSON.parse(
            JSON.stringify(item.sequential)
        );

    operations =
        item.operations;

    stats =
        {...item.stats};


    renderFiles();

    navigate("simulator");


    addLog(
        "RESTORE",
        "Previous simulation restored."
    );


    toast(
        "Simulation restored.",
        "success"
    );

}


/* =========================================================
   IMPORT / EXPORT
========================================================= */

function openImport(){

    $("importFile").click();

}


$("importFile")
    .addEventListener(
        "change",
        event => {

            const file =
                event.target.files[0];

            if(!file)
                return;


            const reader =
                new FileReader();


            reader.onload =
                e => {

                    try{

                        const data =
                            JSON.parse(
                                e.target.result
                            );


                        if(
                            !Array.isArray(
                                data.heap
                            )
                        )
                            throw new Error();


                        heap =
                            data.heap;

                        sequential =
                            Array.isArray(
                                data.sequential
                            )
                                ? data.sequential
                                : [...heap].sort(
                                    (a,b) =>
                                        a.id-b.id
                                );


                        operations =
                            data.operations || 0;

                        stats =
                            data.stats || {
                                heapComparisons:0,
                                seqComparisons:0,
                                heapBlocks:0,
                                seqBlocks:0
                            };


                        renderFiles();

                        addLog(
                            "IMPORT",
                            "Dataset imported successfully."
                        );


                        toast(
                            "JSON dataset imported.",
                            "success"
                        );

                    }catch{

                        toast(
                            "Invalid FILEFORGE JSON file.",
                            "error"
                        );

                    }

                };


            reader.readAsText(file);

            event.target.value = "";

        }
    );


function exportData(){

    const data = {

        app:"FILEFORGE",

        version:"1.0",

        exportedAt:
            new Date().toISOString(),

        blockSize:
            getBlockSize(),

        heap,

        sequential,

        operations,

        stats

    };


    const blob =
        new Blob(
            [
                JSON.stringify(
                    data,
                    null,
                    2
                )
            ],
            {
                type:"application/json"
            }
        );


    const url =
        URL.createObjectURL(
            blob
        );


    const link =
        document.createElement("a");

    link.href = url;

    link.download =
        "fileforge-simulation.json";

    link.click();


    URL.revokeObjectURL(url);


    toast(
        "Simulation exported.",
        "success"
    );

}


function downloadReport(){

    const report =

`FILEFORGE
Heap vs Sequential File Organization
Simulation Report
=====================================

Generated:
${new Date().toLocaleString()}

Block Capacity:
${getBlockSize()} records

Records:
${heap.length}

Operations:
${operations}

HEAP STATISTICS
---------------
Comparisons: ${stats.heapComparisons}
Block Accesses: ${stats.heapBlocks}
Blocks: ${Math.ceil(heap.length/getBlockSize())}

SEQUENTIAL STATISTICS
---------------------
Comparisons: ${stats.seqComparisons}
Block Accesses: ${stats.seqBlocks}
Blocks: ${Math.ceil(sequential.length/getBlockSize())}

HEAP RECORDS
------------
${heap.map(
    r =>
    `${r.id} | ${r.name} | ${r.dept} | ${r.marks}`
).join("\n")}

SEQUENTIAL RECORDS
------------------
${sequential.map(
    r =>
    `${r.id} | ${r.name} | ${r.dept} | ${r.marks}`
).join("\n")}

=====================================
FILEFORGE DBMS Virtual Lab
`;


    const blob =
        new Blob(
            [report],
            {
                type:"text/plain"
            }
        );


    const url =
        URL.createObjectURL(
            blob
        );


    const link =
        document.createElement("a");

    link.href = url;

    link.download =
        "fileforge-report.txt";

    link.click();


    URL.revokeObjectURL(url);


    toast(
        "Simulation report generated.",
        "success"
    );

}


/* =========================================================
   THEME
========================================================= */

$("themeBtn")
    .addEventListener(
        "click",
        () => {

            document.body
                .classList.toggle(
                    "light-mode"
                );


            localStorage.setItem(
                "fileforgeTheme",
                document.body
                    .classList.contains(
                        "light-mode"
                    )
                    ? "light"
                    : "dark"
            );

        }
    );


if(
    localStorage.getItem(
        "fileforgeTheme"
    ) === "light"
){

    document.body
        .classList.add(
            "light-mode"
        );

}


/* =========================================================
   CONTROLS
========================================================= */

$("blockSize")
    .addEventListener(
        "input",
        event => {

            $("blockValue").textContent =
                event.target.value;

            renderFiles();

        }
    );


$("resetBtn")
    .addEventListener(
        "click",
        resetSimulation
    );


$("sampleBtn")
    .addEventListener(
        "click",
        () => loadExperiment(1)
    );


$("exportBtn")
    .addEventListener(
        "click",
        exportData
    );


/* =========================================================
   RESET
========================================================= */

function resetSimulation(){

    stopPlayback();

    heap = [];

    sequential = [];

    operations = 0;

    stats = {

        heapComparisons:0,
        seqComparisons:0,
        heapBlocks:0,
        seqBlocks:0

    };


    clearInputs();

    resetPlayback();

    $("resultBox").innerHTML =
        `<div class="empty-result">
            <div>⌁</div>
            <p>
                Run an operation to view detailed
                simulation statistics.
            </p>
        </div>`;


    $("operationStatus").textContent =
        "IDLE";

    $("operationStatus").className =
        "result-status";


    $("explanation").innerHTML =
        `<p>
            The explanation engine will describe each
            operation and why the two file organizations
            behave differently.
        </p>`;


    addLog(
        "RESET",
        "Simulation state reset."
    );


    renderFiles();


    toast(
        "Simulation reset.",
        "info"
    );

}


/* =========================================================
   QUIZ
========================================================= */

const questions = [

    {
        q:
            "Which file organization keeps records in insertion order?",
        options:[
            "Heap File",
            "Sequential File",
            "B+ Tree",
            "Hash File"
        ],
        answer:0
    },

    {
        q:
            "What is the defining characteristic of a sequential file?",
        options:[
            "Records are randomly placed",
            "Records are maintained according to an ordering key",
            "Records are always hashed",
            "Records cannot be deleted"
        ],
        answer:1
    },

    {
        q:
            "What does FILEFORGE use blocks to represent?",
        options:[
            "CPU instructions",
            "Network packets",
            "Groups of stored records",
            "SQL keywords"
        ],
        answer:2
    },

    {
        q:
            "Which operation is typically fastest in a heap file when space is available?",
        options:[
            "Appending a new record",
            "Finding an arbitrary record",
            "Sorting all records",
            "Ordered traversal"
        ],
        answer:0
    },

    {
        q:
            "Why can an ordered search stop early in a sequential file?",
        options:[
            "Because records are encrypted",
            "Because keys are maintained in order",
            "Because blocks are deleted",
            "Because heap files are sorted"
        ],
        answer:1
    }

];


function renderQuiz(){

    const question =
        questions[
            quiz.index
        ];


    $("quizNumber").textContent =
        `Question ${quiz.index+1} of ${questions.length}`;


    $("quizProgress").style.width =
        `${(quiz.index+1)/
          questions.length*100}%`;


    $("quizQuestion").textContent =
        question.q;


    $("quizScore").textContent =
        `Score: ${quiz.score}`;


    const box =
        $("quizOptions");


    box.innerHTML = "";


    question.options
        .forEach(
            (option,index) => {

                const button =
                    document.createElement("button");

                button.className =
                    "quiz-option";

                button.textContent =
                    option;

                button.onclick =
                    () =>
                        answerQuiz(
                            index,
                            button
                        );

                box.appendChild(button);

            }
        );


    $("quizNextBtn").disabled =
        false;

    $("quizNextBtn").textContent =
        quiz.index ===
        questions.length-1
            ? "Finish"
            : "Next →";


    quiz.answered = false;

}


function answerQuiz(answer,button){

    if(quiz.answered)
        return;


    quiz.answered = true;


    const question =
        questions[
            quiz.index
        ];


    const buttons =
        document.querySelectorAll(
            ".quiz-option"
        );


    buttons.forEach(
        (item,index) => {

            item.disabled = true;

            if(
                index ===
                question.answer
            ){

                item.classList.add(
                    "correct"
                );

            }

        }
    );


    if(answer === question.answer){

        quiz.score++;

        button.classList.add(
            "correct"
        );

        toast(
            "Correct!",
            "success"
        );

    }else{

        button.classList.add(
            "wrong"
        );

        toast(
            "Not quite. Review the highlighted answer.",
            "error"
        );

    }


    $("quizScore").textContent =
        `Score: ${quiz.score}`;

}


function nextQuizQuestion(){

    if(
        !quiz.answered
    ){

        toast(
            "Choose an answer first.",
            "info"
        );

        return;
    }


    if(
        quiz.index >=
        questions.length-1
    ){

        toast(
            `Quiz complete! Score: ${quiz.score}/${questions.length}`,
            "success"
        );

        quiz.index = 0;
        quiz.score = 0;

    }else{

        quiz.index++;

    }


    renderQuiz();

}


/* =========================================================
   KEYBOARD SHORTCUTS
========================================================= */

document.addEventListener(
    "keydown",
    event => {

        if(
            event.key === "Enter" &&
            document.activeElement.tagName === "INPUT"
        ){

            if(
                $("recordId").value &&
                $("recordName").value &&
                $("recordDept").value &&
                $("recordMarks").value
            ){

                insertRecord();

            }

        }

        if(
            event.key === " " &&
            playback.active
        ){

            event.preventDefault();

            togglePlayback();

        }

    }
);


/* =========================================================
   INITIALIZE
========================================================= */

renderFiles();

renderLog();

renderHistory();

renderQuiz();

addLog(
    "SYSTEM",
    "FILEFORGE simulation engine initialized."
);