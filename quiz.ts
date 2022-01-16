/// <reference path="gameData.ts" />

let currentQuestionIndex = 0;
let correctAnswers = 0;
function currentQuestion() {
    return QuizLevel.current.questions[currentQuestionIndex];
}

$(document).ready(function() {
    QuizLevel.initializePage();

    //Preload sounds
    Sound.correct;
    Sound.wrong;

    reset();
});

function displayCurrentQuestion() {
    $("h1").text(`Question ${currentQuestionIndex+1}/${QuizLevel.current.questions.length}`);
    $("#progress").progressbar({
        value: currentQuestionIndex,
        max: QuizLevel.current.questions.length-1
    })

    $("#question").html(currentQuestion().text);
    $("#answers").empty();

    for (let answerIndex = 0; answerIndex < currentQuestion().answers.length; answerIndex++) {
        const answer = currentQuestion().answers[answerIndex];
        const answerElement = $(`<div class="answer answer-${answerIndex}" title=""></div>`);
        $("#answers").append(answerElement);
        
        answerElement.button({
            label: answer.text,
            icons: { primary: "ui-icon-help" }
        }).on("click", () => grade(answerIndex));
    }
}

function reset() {
    currentQuestionIndex = 0;
    correctAnswers = 0;
    QuizLevel.current.shuffle();
    displayCurrentQuestion();
}

function showQuizGrade() {
    function formatAccuracy(accuracy: number) {
        const hue = Piece.hueForAccuracy(accuracy);
        const percentage = Math.round(accuracy * 100) + "%";
        return `<span style="color: hsl(${hue},80%,40%); font-size: 1.2em">${percentage}</span>`;
    }

    function col(start: number, end: number = start+1) {
        if (isInternetExplorer()) {
            return `-ms-grid-column: ${start}; -ms-grid-column-span: ${end-start};`;
        } else {
            return `grid-column: ${start}/${end};`;
        }
    }

    function row(start: number, end: number = start+1) {
        if (isInternetExplorer()) {
            return `-ms-grid-row: ${start}; -ms-grid-row-span: ${end-start};`;
        } else {
            return `grid-row: ${start}/${end};`;
        }
    }

    const accuracy = correctAnswers / QuizLevel.current.questions.length;
    const content = `<dl style="-ms-grid-columns: 1fr 1fr;">
        <dt style="${col(1)} ${row(2)}">🎉 Correct Answers</dt>
            <dd style="${col(1)} ${row(1)}">${correctAnswers}</dd>
        <dt style="${col(2)} ${row(2)}">👎 Incorrect Answers</dt>
            <dd style="${col(2)} ${row(1)}">${QuizLevel.current.questions.length - correctAnswers}</dd>
        <dt style="${col(1,3)} ${row(4)}">📈 Overall Score</dt>
            <dd style="${col(1,3)} ${row(3)}">${formatAccuracy(accuracy)}</dd>
    </dl>`;

    Level.showGradeSummary(content, accuracy == 1, [], reset);
}

function nextQuestion() {
    if (currentQuestionIndex < QuizLevel.current.questions.length - 1) {
        currentQuestionIndex++;
        displayCurrentQuestion();
    } else {
        showQuizGrade();
    }
}

function grade(chosenIndex: number) {
    for (let answerIndex = 0; answerIndex < currentQuestion().answers.length; answerIndex++) {
        const answer = currentQuestion().answers[answerIndex];
        const answerElement = $(`.answer-${answerIndex}`);
        if (answerElement.hasClass("ui-state-disabled")) { continue; } //IE enables disabled buttons if there's a span inside...
        
        answerElement.button("option", "icon", answer.correct ? "ui-icon-check" : "ui-icon-cancel");
        answerElement.addClass("ui-state-disabled"); //can't do actual disabled or else IE won't show tooltips...
        answerElement.addClass(answer.correct ? "correct" : "incorrect");

        if (answerIndex != chosenIndex) { continue; }
        
        if (answer.correct) {
            correctAnswers++;
            Sound.correct.play();
        } else {
            Sound.wrong.play();
        }

        let explanation: string;
        if (answer.explanation == null) {
            explanation = "";
        } else {
            explanation = `<p>${answer.explanation}</p>`;
        }

        let header: string;
        if (answer.correct) {
            header = `<h2 class="correct">Correct! <span class="ui-icon ui-icon-check"></span></h2>`;
        } else {
            header = `<h2 class="incorrect">Incorrect. <span class="ui-icon ui-icon-cancel"></span></h2>`;
            explanation += `<p>The correct answer was: ${currentQuestion().correctAnswer.text}</p>`;
        }

        const tooltipContent = `<div class="tooltip">
            ${header}
            ${explanation}
            <div id="nextQuestion"></div>
        </div>`;

        answerElement.tooltip({
            content: tooltipContent,
            show: { effect: "fade", duration: 700 },
            hide: { effect: "fade", duration: 700 },
            close: function() { window.setTimeout(() => $(this).tooltip("destroy"), 700); }
        });
        answerElement.attr("title", "");

        answerElement.tooltip("open");
        answerElement.off("mouseleave"); //prevent tooltip from autoclosing

        $("#nextQuestion").button({
            label: currentQuestionIndex == QuizLevel.current.questions.length-1 ? "Finish" : "Next Question",
            icons: { secondary: "ui-icon-arrowthick-1-e" }
        }).on("click", function() {
            answerElement.tooltip("close");
            nextQuestion();
        });
    }
}