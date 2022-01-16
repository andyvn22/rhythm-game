"use strict";
/// <reference path="gameData.ts" />
TimingDescription.knownCounts = PieceLevel.currentCounts;
var player = new Player(PieceLevel.current.piece, PieceLevel.current.tempo);
player.onPlay = function () { play(); };
player.onStop = function () { stop(); };
player.onComplete = function () { showGradeSummary(); };
var onboarding = Skill.current.id == "welcome";
var firstLevel = onboarding && PieceLevel.current.index == 0;
var tapsOnly = onboarding && PieceLevel.current.index < 2;
var playButtonIcon = Level.current instanceof RandomLevel ? "ui-icon-shuffle" : "ui-icon-play";
function showGradeSummary(gradingInfo) {
    if (gradingInfo === void 0) { gradingInfo = player.piece.gradingInfo(player.tempo); }
    assert(player.tempo > 0);
    function formatAccuracy(accuracy) {
        var hue = Piece.hueForAccuracy(accuracy);
        var percentage = Math.round(accuracy * 100) + "%";
        return "<span style=\"color: hsl(" + hue + ",80%,40%)\">" + percentage + "</span>";
    }
    function formatStars(timingAccuracy) {
        var maxStars = 5;
        var stars = Math.round(timingAccuracy * maxStars);
        var result = "";
        for (var i = 0; i < maxStars; i++) {
            result += "<span class=\"star-" + (i < stars ? "enabled" : "disabled") + "\">\u2605</span>";
        }
        return result;
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
    function formatTendency(offset) {
        var roundedOffset = Math.round(offset * 100) / 100;
        var formattedOffset = "" + Math.abs(roundedOffset);
        if (Math.abs(roundedOffset) < 1) {
            formattedOffset = formattedOffset.substring(1);
        }
        var singular = Math.abs(roundedOffset) == 1;
        if (roundedOffset == 0) {
            return "\n                <dd class=\"tendency-perfect\" style=\"" + col(4, 6) + " " + row(3) + "\">Correct!</dd>\n            ";
        }
        else {
            return "\n                <dd class=\"tendency-value\" style=\"" + col(4) + " " + row(3) + "\">" + formattedOffset + "</dd>\n                <dd class=\"tendency-text\" style=\"" + col(5) + " " + row(3) + "\">beat" + (singular ? "" : "s") + "<br/>" + (roundedOffset > 0 ? "late" : "early") + "</dd>\n            ";
        }
    }
    function formatSummary(summary, passed) {
        var hue = Piece.hueForAccuracy(passed ? 1 : 0);
        var icon = passed ? "check" : "cancel";
        var result = "<p style=\"color: hsl(" + hue + ",80%,40%)\"><span class=\"ui-icon ui-icon-" + icon + "\"></span> " + summary + "</p>";
        var failedAttempts = Profile.current.skillState(Skill.current.id).failedAttempts;
        if (!passed && failedAttempts > 1) {
            var tips = [
                "You're doing some great hard work, here! Are you <strong>counting out loud</strong> with your voice? It feels harder at first, but it helps you <strong>understand</strong> the rhythms better, so it will eventually help you master this level!",
                "Keep up this awesome effort! Try clicking the <strong>&quot;Grade Details&quot; button below</strong> to see what's giving you trouble&mdash;you can scroll around and <strong>check each red note, rest, or count</strong>. Try the hardest parts <strong>slowly by themselves</strong> before replaying!"
            ];
            if (Level.current.index > 1 && failedAttempts > 2) {
                tips.push("You're so dedicated and hardworking! If you're feeling really stuck, try jumping back to the <strong>beginning of this skill and replay</strong> carefully, counting out loud&mdash;that will help <strong>build up the skills</strong> you need to conquer this level!");
            }
            if (Skill.current.id === "welcome" && Level.current.index === 2) {
                tips = [
                    "Remember, you need to <strong>tap</strong> on <strong>every number</strong>, <em>and</em> <strong>clap</strong> at the start of each <strong>note</strong>. That means for this level you'll need to hit: tap, tap, tap, tap, <strong>both</strong>, tap, tap, tap...",
                    "You can click the &quot;Grade Details&quot; button below to see exactly what you're missing&mdash;check which things are red. If there's a red <strong>number</strong> you missed a <strong>tap</strong>, but if there's a red <strong>note</strong> you missed a <strong>clap</strong>. (If there's a red <strong>rest</strong> you clapped extra!)"
                ];
            }
            result += "<p>" + tips[Math.floor(Math.random() * tips.length)] + "</p>";
        }
        return result;
    }
    var content = "\n        <dl style=\"-ms-grid-columns: 1fr 1fr 1fr 1fr 1fr\">\n            <dt style=\"" + col(1, 3) + " " + row(2) + "\">\uD83D\uDC4F Successful Claps</dt>\n                <dd style=\"" + col(1, 3) + " " + row(1) + "\">" + formatAccuracy(gradingInfo.clapAccuracy) + "</dd>\n            <dt style=\"" + col(4, 6) + " " + row(2) + "\">\uD83E\uDDB6 Successful Taps</dt>\n                <dd style=\"" + col(4, 6) + " " + row(1) + "\">" + formatAccuracy(gradingInfo.tapAccuracy) + "</dd>\n            <dt style=\"" + col(1, 3) + " " + row(4) + "\">\u23F1 Timing Accuracy</dt>\n                <dd style=\"" + col(1, 3) + " " + row(3) + "\">" + formatStars(gradingInfo.timingRating) + "</dd>\n            <dt style=\"" + col(4, 6) + " " + row(4) + "\">\uD83D\uDCC8 Average Tendency</dt>\n                " + formatTendency(gradingInfo.averageOffset) + "\n        </dl>\n        " + formatSummary(gradingInfo.summary, gradingInfo.passed) + "\n    ";
    var buttons = [{
            text: "Grade Details",
            icon: "ui-icon-search",
            click: function () {
                $(this).dialog("close");
                player.rewind();
            }
        }];
    Level.showGradeSummary(content, gradingInfo.passed, buttons, function () { return play(); });
}
$(document).ready(function () {
    PieceLevel.initializePage();
    //preload sounds
    Sound.clap;
    Sound.beat;
    Sound.fanfare;
    player.piece.timeSignature.countoff;
    $("#play").button({
        label: "<strong>Play</strong>",
        icons: { primary: playButtonIcon }
    }).onButtonPush(togglePlayback);
    var clapKey = isMobile() ? "" : "<br/>(" + returnKeyName() + ")";
    var tapKey = isMobile() ? "" : "<br/>(spacebar)";
    $("#clap").button({
        label: "<strong>Clap</strong>" + clapKey,
        disabled: true
    }).onButtonPush(clap);
    $("#tap").button({
        label: "<strong>Tap</strong>" + tapKey,
        disabled: true
    }).onButtonPush(tap);
    displayPiece();
    if (firstLevel) {
        $("#play").addClass("require");
    }
});
var clapKey = $.ui.keyCode.ENTER;
var tapKey = $.ui.keyCode.SPACE;
var clapKeyIsDown = false;
var tapKeyIsDown = false;
$(document).keydown(function (event) {
    switch (event.which) {
        case clapKey:
            if (!player.isPlaying) {
                return;
            }
            event.preventDefault();
            if (!clapKeyIsDown) {
                clapKeyIsDown = true;
                clap();
                $("#clap").addClass("ui-state-active", 0);
                $("#clap").removeClass("ui-state-active", 100);
            }
            break;
        case tapKey:
            if (!player.isPlaying) {
                return;
            }
            event.preventDefault();
            if (!tapKeyIsDown) {
                tapKeyIsDown = true;
                tap();
                $("#tap").addClass("ui-state-active", 0);
                $("#tap").removeClass("ui-state-active", 100);
            }
            break;
        case $.ui.keyCode.ESCAPE:
            if (player.isPlaying) {
                event.preventDefault();
                stop();
            }
            break;
        /*case $.ui.keyCode.PERIOD: //cheat pass
            showGradeSummary({
                clapAccuracy: 1,
                tapAccuracy: 1,
                timingRating: 1,
                averageOffset: 0,
                passed: true,
                summary: "You cheated!"
            });
            break;
        case $.ui.keyCode.COMMA: //cheat fail back to here
            Profile.current.skillState(Skill.current!.id).currentLevel = PieceLevel.current.index;
            break;*/
        default:
    }
});
$(document).keyup(function (event) {
    switch (event.which) {
        case clapKey:
            clapKeyIsDown = false;
            break;
        case tapKey:
            tapKeyIsDown = false;
            break;
        default:
    }
});
function displayPiece() {
    $("#staff").html(player.piece.notation);
    for (var i = 0; i < player.piece.notes.length; i++) {
        player.piece.updateAppearanceOfNoteAtIndex(i, player.tempo);
    }
}
;
$(window).on("resize", function () {
    displayPiece();
});
function togglePlayback() {
    if (player.isPlaying) {
        stop();
    }
    else {
        play();
    }
}
;
function play() {
    if (!player.isPlaying) {
        if (Level.current instanceof RandomLevel) {
            player.piece = Level.current.piece;
            displayPiece();
        }
        player.play();
    }
    player.piece.removeGrading(player.tempo);
    $("#play").button({
        label: "Stop",
        icons: { primary: "ui-icon-stop" }
    });
    $("#play").removeClass("require");
    $("#tap").button("option", "disabled", false);
    if (onboarding) {
        $("#tap").addClass("introduce");
    }
    if (!tapsOnly) {
        $("#clap").button("option", "disabled", false);
        if (onboarding) {
            setTimeout(function () { return $("#clap").addClass("introduce"); }, 250);
        }
    }
}
function stop() {
    if (player.isPlaying) {
        player.stop();
    }
    $("#play").button({
        label: "Play",
        icons: { primary: playButtonIcon }
    });
    $("#tap").button("option", "disabled", true);
    $("#tap").removeClass("introduce");
    $("#clap").button("option", "disabled", true);
    $("#clap").removeClass("introduce");
}
function clap() {
    player.gradeClap();
}
;
function tap() {
    player.gradeTap();
}
