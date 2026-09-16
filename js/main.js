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

// Attach navigation click listeners
document.querySelectorAll(".nav-btn").forEach(button => {
    button.addEventListener("click", () => navigate(button.dataset.page));
});

// Initial startup rendering
renderFiles();
renderLog();
renderHistory();
renderQuiz();
addLog("SYSTEM", "FILEFORGE simulation engine initialized.");
