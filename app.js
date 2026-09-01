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


    blocks.forEach(
        (records,index) => {

            const block =
                document.createElement("div");

            block.className =
                "block";

            block.dataset.block =
                index;


            block.innerHTML =
                `<div class="block-header">
                    <span>
                        BLOCK ${String(index)
                            .padStart(2,"0")}
                    </span>

                    <span>
                        ${records.length}/${getBlockSize()}
                    </span>
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
   STATS
========================================================= */

function updateStats(){

    const heapBlockCount =
        Math.ceil(
            heap.length /
            getBlockSize()
        );

    const seqBlockCount =
        Math.ceil(
            sequential.length /
            getBlockSize()
        );


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


    /* HEAP */

    heap.forEach(
        (record,index) => {

            steps.push({

                file:"heap",

                index,

                id:record.id,

                status:
                    record.id === id
                        ? "found"
                        : "checking"

            });


            if(record.id === id)
                return;

        }
    );


    /* SEQUENTIAL */

    sequential.forEach(
        (record,index) => {

            steps.push({

                file:"seq",

                index,

                id:record.id,

                status:
                    record.id === id
                        ? "found"
                        : "checking"

            });


            if(
                strategy === "ordered" &&
                record.id > id
            ){

                steps.push({

                    file:"seq",

                    index,

                    id:record.id,

                    status:"stop"

                });

            }

        }
    );


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
                    current/total*100
                )
            )
            : 0;


    $("progressBar").style.width =
        `${percent}%`;


    clearHighlights();


    if(
        playback.current < 0 ||
        !playback.steps[
            playback.current
        ]
    ){

        return;
    }


    const step =
        playback.steps[
            playback.current
        ];


    const container =
        step.file === "heap"
            ? $("heapBlocksView")
            : $("seqBlocksView");


    const records =
        container.querySelectorAll(
            ".record"
        );


    if(records[step.index]){

        records[step.index]
            .classList.add(
                step.status === "found"
                    ? "found"
                    : "checking"
            );


        const block =
            records[step.index]
                .closest(".block");


        if(block)
            block.classList.add("active");

    }


    $("playbackTitle").textContent =
        step.status === "found"
            ? `Record ${step.id} found in ${step.file === "heap" ? "Heap" : "Sequential"}`
            : step.status === "stop"
                ? `Ordered search stopped at ${step.id}`
                : `Checking Record ${step.id}`;

}


function clearHighlights(){

    document
        .querySelectorAll(
            ".record.checking, .record.found, .block.active"
        )
        .forEach(item => {

            item.classList.remove(
                "checking",
                "found",
                "active"
            );

        });

}


function nextStep(){

    if(!playback.active){

        toast(
            "Start a search first.",
            "info"
        );

        return;
    }


    if(
        playback.current >=
        playback.steps.length - 1
    ){

        finishSearch();

        return;
    }


    playback.current++;

    updatePlaybackUI();


    if(
        playback.steps[
            playback.current
        ].status === "found"
    ){

        finishSearch();

    }

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

        toast(
            "Start a search first.",
            "info"
        );

        return;
    }


    if(playback.running){

        stopPlayback();

        $("playBtn").textContent =
            "▶";

        return;
    }


    playback.running =
        true;

    $("playBtn").textContent =
        "Ⅱ";


    runPlayback();

}


async function runPlayback(){

    while(
        playback.running &&
        playback.active &&
        playback.current <
            playback.steps.length - 1
    ){

        playback.current++;

        updatePlaybackUI();

        await wait(
            Number($("speed").value)
        );

    }


    if(
        playback.current >=
        playback.steps.length - 1
    ){

        finishSearch();

    }

}


function stopPlayback(){

    playback.running =
        false;

    if(playback.timer)
        clearTimeout(
            playback.timer
        );

    $("playBtn").textContent =
        "▶";

}


function finishSearch(){

    playback.running =
        false;

    $("playBtn").textContent =
        "▶";


    if(!playback.active)
        return;


    const id =
        playback.target;

    const strategy =
        $("searchStrategy").value;


    const heapIndex =
        heap.findIndex(
            r => r.id === id
        );

    const seqIndex =
        sequential.findIndex(
            r => r.id === id
        );


    const heapComparisons =
        heapIndex === -1
            ? heap.length
            : heapIndex + 1;


    let seqComparisons;


    if(seqIndex !== -1){

        seqComparisons =
            seqIndex + 1;

    }else{

        seqComparisons =
            strategy === "ordered"

                ? sequential.findIndex(
                    r => r.id > id
                ) + 1

                : sequential.length;

        if(seqComparisons <= 0)
            seqComparisons =
                sequential.length;

    }


    stats.heapComparisons +=
        heapComparisons;

    stats.seqComparisons +=
        seqComparisons;


    const heapAccess =
        Math.max(
            1,
            Math.ceil(
                heapComparisons /
                getBlockSize()
            )
        );


    const seqAccess =
        Math.max(
            1,
            Math.ceil(
                seqComparisons /
                getBlockSize()
            )
        );


    stats.heapBlocks +=
        heap.length
            ? heapAccess
            : 0;

    stats.seqBlocks +=
        sequential.length
            ? seqAccess
            : 0;


    operations++;


    const found =
        heapIndex !== -1 ||
        seqIndex !== -1;


    showResult(
        found,
        found
            ? `Record ${id} found`
            : `Record ${id} not found`,
        [
            ["Heap comparisons",heapComparisons],
            ["Sequential comparisons",seqComparisons],
            ["Heap blocks accessed",heapAccess],
            ["Sequential blocks accessed",seqAccess],
            ["Strategy",strategy === "ordered"
                ? "Ordered Search"
                : "Sequential Scan"]
        ]
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
        `Record ${id}: ${found ? "FOUND" : "NOT FOUND"}`
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

        html =
            `<p>
                <strong>Heap:</strong>
                Record ${data.id} was appended to the
                Heap file. Its insertion position does not
                depend on the value of the key.
            </p>

            <p style="margin-top:10px">
                <strong>Sequential:</strong>
                The same record was placed according to
                ascending Record ID, preserving the ordered
                structure.
            </p>`;

    }


    if(type === "search"){

        html =
            `<p>
                The simulator examined records until the
                target key was found or the search could
                terminate.
            </p>

            <p style="margin-top:10px">
                <strong>Heap:</strong>
                ${data.heapComparisons}
                record comparisons and approximately
                ${data.heapAccess} block access(es).
            </p>

            <p style="margin-top:10px">
                <strong>Sequential:</strong>
                ${data.seqComparisons}
                record comparisons and approximately
                ${data.seqAccess} block access(es).
            </p>`;

        if(data.strategy === "ordered"){

            html +=
                `<p style="margin-top:10px">
                    Because the Sequential file is ordered
                    by ID, the simulator can stop when it
                    reaches a key greater than the target.
                </p>`;

        }

    }


    if(type === "delete"){

        html =
            `<p>
                Record ${data.id} was removed from both
                file representations.
            </p>

            <p style="margin-top:10px">
                Deletion requires locating the target
                record first. The exact cost depends on
                the search process and file organization.
            </p>`;

    }


    $("explanation").innerHTML =
        html;

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