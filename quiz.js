"use strict";
/// <reference path="gameData.ts" />
var currentQuestionIndex = 0;
var correctAnswers = 0;
function currentQuestion() {
    return QuizLevel.current.questions[currentQuestionIndex];
}
$(document).ready(function () {
    QuizLevel.initializePage();
    //Preload sounds
    Sound.correct;
    Sound.wrong;
    reset();
});
function displayCurrentQuestion() {
    $("h1").text("Question " + (currentQuestionIndex + 1) + "/" + QuizLevel.current.questions.length);
    $("#progress").progressbar({
        value: currentQuestionIndex,
        max: QuizLevel.current.questions.length - 1
    });
    $("#question").html(currentQuestion().text);
    $("#answers").empty();
    var _loop_1 = function (answerIndex) {
        var answer = currentQuestion().answers[answerIndex];
        var answerElement = $("<div class=\"answer answer-" + answerIndex + "\" title=\"\"></div>");
        $("#answers").append(answerElement);
        answerElement.button({
            label: answer.text,
            icons: { primary: "ui-icon-help" }
        }).on("click", function () { return grade(answerIndex); });
    };
    for (var answerIndex = 0; answerIndex < currentQuestion().answers.length; answerIndex++) {
        _loop_1(answerIndex);
    }
}
function reset() {
    currentQuestionIndex = 0;
    correctAnswers = 0;
    QuizLevel.current.shuffle();
    displayCurrentQuestion();
}
function showQuizGrade() {
    function formatAccuracy(accuracy) {
        var hue = Piece.hueForAccuracy(accuracy);
        var percentage = Math.round(accuracy * 100) + "%";
        return "<span style=\"color: hsl(" + hue + ",80%,40%); font-size: 1.2em\">" + percentage + "</span>";
    }
    function col(start, end) {
        if (end === void 0) { end = start + 1; }
        if (isInternetExplorer()) {
            return "-ms-grid-column: " + start + "; -ms-grid-column-span: " + (end - start) + ";";
        }
        else {
            return "grid-column: " + start + "/" + end + ";";
        }
    }
    function row(start, end) {
        if (end === void 0) { end = start + 1; }
        if (isInternetExplorer()) {
            return "-ms-grid-row: " + start + "; -ms-grid-row-span: " + (end - start) + ";";
        }
        else {
            return "grid-row: " + start + "/" + end + ";";
        }
    }
    var accuracy = correctAnswers / QuizLevel.current.questions.length;
    var content = "<dl style=\"-ms-grid-columns: 1fr 1fr;\">\n        <dt style=\"" + col(1) + " " + row(2) + "\">\uD83C\uDF89 Correct Answers</dt>\n            <dd style=\"" + col(1) + " " + row(1) + "\">" + correctAnswers + "</dd>\n        <dt style=\"" + col(2) + " " + row(2) + "\">\uD83D\uDC4E Incorrect Answers</dt>\n            <dd style=\"" + col(2) + " " + row(1) + "\">" + (QuizLevel.current.questions.length - correctAnswers) + "</dd>\n        <dt style=\"" + col(1, 3) + " " + row(4) + "\">\uD83D\uDCC8 Overall Score</dt>\n            <dd style=\"" + col(1, 3) + " " + row(3) + "\">" + formatAccuracy(accuracy) + "</dd>\n    </dl>";
    Level.showGradeSummary(content, accuracy == 1, [], reset);
}
function nextQuestion() {
    if (currentQuestionIndex < QuizLevel.current.questions.length - 1) {
        currentQuestionIndex++;
        displayCurrentQuestion();
    }
    else {
        showQuizGrade();
    }
}
function grade(chosenIndex) {
    var _loop_2 = function (answerIndex) {
        var answer = currentQuestion().answers[answerIndex];
        var answerElement = $(".answer-" + answerIndex);
        if (answerElement.hasClass("ui-state-disabled")) {
            return "continue";
        } //IE enables disabled buttons if there's a span inside...
        answerElement.button("option", "icon", answer.correct ? "ui-icon-check" : "ui-icon-cancel");
        answerElement.addClass("ui-state-disabled"); //can't do actual disabled or else IE won't show tooltips...
        answerElement.addClass(answer.correct ? "correct" : "incorrect");
        if (answerIndex != chosenIndex) {
            return "continue";
        }
        if (answer.correct) {
            correctAnswers++;
            Sound.correct.play();
        }
        else {
            Sound.wrong.play();
        }
        var explanation = void 0;
        if (answer.explanation == null) {
            explanation = "";
        }
        else {
            explanation = "<p>" + answer.explanation + "</p>";
        }
        var header = void 0;
        if (answer.correct) {
            header = "<h2 class=\"correct\">Correct! <span class=\"ui-icon ui-icon-check\"></span></h2>";
        }
        else {
            header = "<h2 class=\"incorrect\">Incorrect. <span class=\"ui-icon ui-icon-cancel\"></span></h2>";
            explanation += "<p>The correct answer was: " + currentQuestion().correctAnswer.text + "</p>";
        }
        var tooltipContent = "<div class=\"tooltip\">\n            " + header + "\n            " + explanation + "\n            <div id=\"nextQuestion\"></div>\n        </div>";
        answerElement.tooltip({
            content: tooltipContent,
            show: { effect: "fade", duration: 700 },
            hide: { effect: "fade", duration: 700 },
            close: function () {
                var _this = this;
                window.setTimeout(function () { return $(_this).tooltip("destroy"); }, 700);
            }
        });
        answerElement.attr("title", "");
        answerElement.tooltip("open");
        answerElement.off("mouseleave"); //prevent tooltip from autoclosing
        $("#nextQuestion").button({
            label: currentQuestionIndex == QuizLevel.current.questions.length - 1 ? "Finish" : "Next Question",
            icons: { secondary: "ui-icon-arrowthick-1-e" }
        }).on("click", function () {
            answerElement.tooltip("close");
            nextQuestion();
        });
    };
    for (var answerIndex = 0; answerIndex < currentQuestion().answers.length; answerIndex++) {
        _loop_2(answerIndex);
    }
}
