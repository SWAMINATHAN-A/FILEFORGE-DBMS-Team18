// Global application state

// Active database records
let heap = [];
let sequential = [];
let operations = 0;

// Operation and I/O comparison statistics
let stats = {
    heapComparisons: 0,
    seqComparisons: 0,
    heapBlocks: 0,
    seqBlocks: 0
};

// Activity log history
let activity = [];

// Saved simulations from browser localStorage
let savedHistory = JSON.parse(localStorage.getItem("fileforgeHistory") || "[]");

// Search stepper and playback state
let playback = {
    active: false,
    running: false,
    target: null,
    steps: [],
    current: -1,
    timer: null
};

// Quiz state tracking
let quiz = {
    index: 0,
    score: 0,
    answered: false
};
