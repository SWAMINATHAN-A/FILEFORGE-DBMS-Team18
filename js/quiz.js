// Multiple-choice quiz questions and answers
const questions = [
    {
        q: "Which file organization keeps records in insertion order without sorting?",
        options: ["Heap File", "Sequential File", "B+ Tree", "Hash File"],
        answer: 0
    },
    {
        q: "What is the defining characteristic of a sequential file?",
        options: [
            "Records are randomly placed",
            "Records are maintained according to an ordering key",
            "Records are always hashed",
            "Records cannot be deleted"
        ],
        answer: 1
    },
    {
        q: "What does FILEFORGE use blocks to represent?",
        options: [
            "CPU instructions",
            "Network packets",
            "Secondary storage disk pages/blocks",
            "SQL keywords"
        ],
        answer: 2
    },
    {
        q: "Which operation is typically fastest in a heap file when space is available?",
        options: [
            "Appending a new record O(1)",
            "Finding an arbitrary record",
            "Sorting all records",
            "Ordered traversal"
        ],
        answer: 0
    },
    {
        q: "Why can a search be performed in O(logâ‚‚ n) in a sequential file?",
        options: [
            "Because records are encrypted",
            "Because keys are maintained in sorted order (Binary Search)",
            "Because blocks are deleted",
            "Because heap files are sorted"
        ],
        answer: 1
    }
];

// Render current quiz question and option buttons
function renderQuiz() {
    const question = questions[quiz.index];
    $("quizNumber").textContent = `Question ${quiz.index + 1} of ${questions.length}`;
    $("quizProgress").style.width = `${((quiz.index + 1) / questions.length) * 100}%`;
    $("quizQuestion").textContent = question.q;
    $("quizScore").textContent = `Score: ${quiz.score}`;

    const box = $("quizOptions");
    box.innerHTML = "";

    question.options.forEach((option, index) => {
        const button = document.createElement("button");
        button.className = "quiz-option";
        button.textContent = option;
        button.onclick = () => answerQuiz(index, button);
        box.appendChild(button);
    });

    $("quizNextBtn").disabled = false;
    $("quizNextBtn").textContent = quiz.index === questions.length - 1 ? "Finish" : "Next â†’";
    quiz.answered = false;
}

// Check selected quiz answer and update score
function answerQuiz(answer, button) {
    if (quiz.answered) return;
    quiz.answered = true;

    const question = questions[quiz.index];
    const buttons = document.querySelectorAll(".quiz-option");

    buttons.forEach((item, index) => {
        item.disabled = true;
        if (index === question.answer) item.classList.add("correct");
    });

    if (answer === question.answer) {
        quiz.score++;
        button.classList.add("correct");
        toast("Correct answer!", "success");
    } else {
        button.classList.add("wrong");
        toast("Not quite. Review the highlighted answer.", "error");
    }

    $("quizScore").textContent = `Score: ${quiz.score}`;
}

// Advance to the next quiz question
function nextQuizQuestion() {
    if (!quiz.answered) {
        toast("Choose an answer first.", "info");
        return;
    }

    if (quiz.index >= questions.length - 1) {
        toast(`Quiz complete! Final Score: ${quiz.score}/${questions.length}`, "success");
        quiz.index = 0;
        quiz.score = 0;
    } else {
        quiz.index++;
    }

    renderQuiz();
}

