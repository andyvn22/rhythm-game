/// <reference path="gameData.ts" />

const params = new URLSearchParams(location.search);
let skillID = params.get("skill")!;
let levelIndex = parseInt(params.get("level")!);

let level = Skill.forID(skillID).levels[levelIndex];
let player = new Player(level.piece, level.tempo);
player.onPlay = function() { play(); }
player.onStop = function() { stop(); }
player.onComplete = function() { showGradeSummary(); }

function isMobile() {
    return navigator.userAgent.match(/Mobi/);
}

interface JQuery<TElement = HTMLElement> {
    /**
     * Calls `handler` on `mousedown` *or* `touchstart`, but not both. Handy for timing-sensitive buttons whose actions should be triggered immediately and exactly once.
     * @param handler The action to peform when the button is pushed in.
     */
    onButtonPush(handler: (event: Event) => void): void;
}

jQuery.fn.extend({
    onButtonPush: function(handler: (event: Event) => void) {
        $(this).on("mousedown", handler).on("touchstart", function(e: Event) { e.preventDefault(); handler(e); });
    }
});

function showGradeSummary() {
    assert(player.tempo > 0);

    function formatAccuracy(accuracy: number) {
        const hue = Piece.hueForCorrectness(accuracy);
        const percentage = Math.round(accuracy * 100) + "%";
        return `<span style="color: hsl(${hue},80%,40%)">${percentage}</span>`;
    }

    function formatExtraPerformanceAttempts(extraPerformanceAttempts: number) {
        const hue = Piece.hueForCorrectness(extraPerformanceAttempts == 0 ? 1 : 0);
        return `<span style="color: hsl(${hue},80%,40%)">${extraPerformanceAttempts}</span>`;
    }

    function formatSummary(summary: string, passed: boolean) {
        const hue = Piece.hueForCorrectness(passed ? 1 : 0);
        const icon = passed ? "check" : "cancel";
        return `<p style="color: hsl(${hue},80%,40%)"><span class="ui-icon ui-icon-${icon}"></span> ${summary}</p>`;
    }

    const gradingInfo = player.piece.gradingInfo(player.tempo);
    const summaryElement = `
        <div id="gradeSummary" title="Let's See How You Did!">
            <dl style="display: grid">
                <dt style="grid-column: 1 / 2; grid-row: 2 / 3;">👏 Clap accuracy</dt><dd style="grid-column: 1 / 2; grid-row: 1 / 2;">${formatAccuracy(gradingInfo.clapAccuracy)}</dd>
                <dt style="grid-column: 2 / 3; grid-row: 2 / 3;">👏 Extra claps</dt><dd style="grid-column: 2 / 3; grid-row: 1 / 2;">${formatExtraPerformanceAttempts(gradingInfo.extraClaps)}</dd>
                <dt style="grid-column: 1 / 2; grid-row: 4 / 5;">🦶 Tap accuracy</dt><dd style="grid-column: 1 / 2; grid-row: 3 / 4;">${formatAccuracy(gradingInfo.tapAccuracy)}</dd>
                <dt style="grid-column: 2 / 3; grid-row: 4 / 5;">🦶 Extra taps</dt><dd style="grid-column: 2 / 3; grid-row: 3 / 4;">${formatExtraPerformanceAttempts(gradingInfo.extraTaps)}</dd>
            </dl>
            ${formatSummary(gradingInfo.summary, gradingInfo.passed)}
        </div>
    `;

    let buttons = [{
        text: "Grade Details",
        icon: "ui-icon-search",
        click: function() {
            $(this).dialog("close");
            player.rewind();
        }
    }];
    if (gradingInfo.passed) {
        buttons.push({
            text: "Next Level!",
            icon: "ui-icon-star",
            click: exitLevel
        });
    } else {
        buttons.push({
            text: "Try Again",
            icon: "ui-icon-refresh",
            click: function() {
                $(this).dialog("close");
                player.play();
            }
        });
    }

    $(summaryElement).dialog({
        modal: true,
        width: Math.min(vw(80), em(50)),
        buttons: buttons,
        show: {
            effect: "scale",
            duration: 400
        },
        hide: {
            effect: "fade",
            duration: 600
        },
        beforeClose: function() { //Levels are never taller than the window, so if we're scrolled down, it's because of this dialog
            $('html, body').animate({ scrollTop: 0 }, 600);
        }
    });

    if (gradingInfo.passed) {
        playSound("fanfare");
    }
}

function exitLevel() {
    if (Skill.isCompleted(skillID)) {
        location.href = "world.html";
    } else {
        location.href = `world.html?skill=${skillID}`;
    }
}

$(document).ready(function() {
    Profile.loadAllFromStorage();

    $("#exitButton").button({
        label: "Exit Level",
        icons: { primary: "ui-icon-home" }
    }).on("click", function() {
        exitLevel();
    });

    $("#play").button({
        label: "<strong>Play</strong>",
        icons: { primary: "ui-icon-play" }
    }).onButtonPush(togglePlayback);

    $("#clap").button({
        label: "<strong>Clap</strong>" + (isMobile() ? "" : "<br/>(spacebar)"),
        disabled: true
    }).onButtonPush(clap);
    
    $("#tap").button({
        label: "<strong>Tap</strong>" + (isMobile() ? "" : "<br/>(shift)"),
        disabled: true
    }).onButtonPush(tap);

    //@ts-ignore
    ion.sound({
        sounds: [
            { name: "metronome" },
            { name: "fanfare" },
            { name: "1" },
            { name: "2" },
            { name: "3" },
            { name: "4" },
            { name: "5" },
            { name: "6" },
            { name: "7" },
            { name: "8" },
            { name: "9" },
            { name: "10" },
            { name: "rea-" },
            { name: "-dy" },
            { name: "go" }
        ],
        volume: 0.8,
        path: "media/sounds/",
        preload: true,
        multiplay: true
    });

    $("h1").text(level.name);
    document.title = level.name;
    displayPiece();
    showGradeSummary();
});

$(document).keydown(function(event) {
    switch (event.which) {
        case $.ui.keyCode.SPACE:
            event.preventDefault();
            clap();
            if (!$("#clap").button("option", "disabled")) {
                $("#clap").addClass("ui-state-active", 0);
                $("#clap").removeClass("ui-state-active", 100);
            }
            break;
        case 16: //shift
            event.preventDefault();
            tap();
            if (!$("#tap").button("option", "disabled")) {
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
        default:
    }
}); 

function displayPiece() {
    $("#staff").html(player.piece.notation);
    for (let i = 0; i < level.piece.notes.length; i++) {
        level.piece.updateAppearanceOfNoteAtIndex(i);
    }
};

function togglePlayback() {
    if (player.isPlaying) {
        stop();
    } else {
        play();
    }
};

function play() {
    if (!player.isPlaying) {
        player.play();
    }
    player.piece.removeGrading();
    $("#play").button({
        label: "Stop",
        icons: { primary: "ui-icon-stop" }
    });
    $("#clap").button("option", "disabled", false);
    $("#tap").button("option", "disabled", false);
}

function stop() {
    if (player.isPlaying) {
        player.stop();
    }
    $("#play").button({
        label: "Play",
        icons: { primary: "ui-icon-play" }
    });
    $("#clap").button("option", "disabled", true);
    $("#tap").button("option", "disabled", true);

    if (player.piece.gradingInfo(player.tempo).passed) {
        if (Profile.current.skillState(skillID).currentLevel === levelIndex) {
            Profile.current.skillState(skillID).currentLevel = levelIndex + 1;
        }
    }
}

function clap() {
    player.gradeClap();
};

function tap() {
    player.gradeTap();
}