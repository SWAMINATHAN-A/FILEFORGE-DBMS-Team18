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
