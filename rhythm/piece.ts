/// <reference path="gameData.ts" />

TimingDescription.knownCounts = PieceLevel.currentCounts;

let player = new Player(PieceLevel.current.piece, PieceLevel.current.tempo);
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

interface DialogButton {
    text: string;
    icon: string;
    click: () => void;
    class?: string;
}

function showGradeSummary(gradingInfo = player.piece.gradingInfo(player.tempo)) {
    assert(player.tempo > 0);

    function formatAccuracy(accuracy: number) {
        const hue = Piece.hueForAccuracy(accuracy);
        const percentage = Math.round(accuracy * 100) + "%";
        return `<span style="color: hsl(${hue},80%,40%)">${percentage}</span>`;
    }

    function formatStars(timingAccuracy: number) {
        const maxStars = 5;
        const stars = Math.round(timingAccuracy * maxStars);
        let result = "";
        for (let i = 0; i < maxStars; i++) {
            result += `<span class="star-${i < stars ? `enabled` : `disabled`}">★</span>`;
        }
        return result;
    }

    function formatSummary(summary: string, passed: boolean) {
        const hue = Piece.hueForAccuracy(passed ? 1 : 0);
        const icon = passed ? "check" : "cancel";
        return `<p style="color: hsl(${hue},80%,40%)"><span class="ui-icon ui-icon-${icon}"></span> ${summary}</p>`;
    }

    const summaryElement = `
        <div id="gradeSummary" title="Your Performance">
            <dl style="display: grid">
                <dt style="grid-column: 1/2; grid-row: 2/3;">👏 Successful Claps</dt>
                    <dd style="grid-column: 1/2; grid-row: 1/2;">${formatAccuracy(gradingInfo.clapAccuracy)}</dd>
                <dt style="grid-column: 3/4; grid-row: 2/3;">🦶 Successful Taps</dt>
                    <dd style="grid-column: 3/4; grid-row: 1/2;">${formatAccuracy(gradingInfo.tapAccuracy)}</dd>
                <dt style="grid-column: 1/4; grid-row: 4/5;">⏱ Timing Accuracy</dt>
                    <dd style="grid-column: 1/4; grid-row: 3/4">${formatStars(gradingInfo.timingAccuracy)}</dd>
            </dl>
            ${formatSummary(gradingInfo.summary, gradingInfo.passed)}
        </div>
    `;

    let buttons: Array<DialogButton> = [{
        text: "Grade Details",
        icon: "ui-icon-search",
        click: function() {
            $(this).dialog("close");
            player.rewind();
        }
    }];
    if (gradingInfo.passed) {
        if (Skill.current!.isCompleted) {
             buttons.push({
                 text: "Next Skill!",
                 icon: "ui-icon-key",
                 click: PieceLevel.exit,
                 class: "nextSkillButton"
             })
        } else {
            buttons.push({
                text: "Next Level!",
                icon: "ui-icon-star",
                click: PieceLevel.goToNext
            });
        }
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

    if (gradingInfo.passed) { Sound.fanfare.play(); }
}

$(document).ready(function() {
    PieceLevel.initializePage();

    //preload sounds
    Sound.metronome;
    Sound.fanfare;
    player.piece.timeSignature.countoff;

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

    displayPiece();
});

let spaceIsDown = false;
let shiftIsDown = false;
$(document).keydown(function(event) {
    switch (event.which) {
        case $.ui.keyCode.SPACE:
            event.preventDefault();
            if (!spaceIsDown) {
                spaceIsDown = true;
                clap();
                if (!$("#clap").button("option", "disabled")) {
                    $("#clap").addClass("ui-state-active", 0);
                    $("#clap").removeClass("ui-state-active", 100);
                }
            }
            break;
        case 16: //shift
            event.preventDefault();
            if (!shiftIsDown) {
                shiftIsDown = true;
                tap();
                if (!$("#tap").button("option", "disabled")) {
                    $("#tap").addClass("ui-state-active", 0);
                    $("#tap").removeClass("ui-state-active", 100);
                }
            }
            break;
        case $.ui.keyCode.ESCAPE:
            if (player.isPlaying) {
                event.preventDefault();
                stop();
            }
            break;
        case $.ui.keyCode.PERIOD: //cheat pass
            PieceLevel.pass();
            showGradeSummary({
                clapAccuracy: 1,
                tapAccuracy: 1,
                timingAccuracy: 1,
                passed: true,
                summary: "You cheated!"
            });
            break;
        case $.ui.keyCode.COMMA: //cheat fail back to here
            Profile.current.skillState(Skill.current!.id).currentLevel = PieceLevel.current.index;
            break;
        default:
    }
});
$(document).keyup(function(event) {
    switch (event.which) {
        case $.ui.keyCode.SPACE:
            spaceIsDown = false;
            break;
        case 16: //shift
            shiftIsDown = false;
            break;
        default:
    }
});

function displayPiece() {
    $("#staff").html(player.piece.notation);
    for (let i = 0; i < player.piece.notes.length; i++) {
        player.piece.updateAppearanceOfNoteAtIndex(i, player.tempo);
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
        PieceLevel.pass();
    }
}

function clap() {
    player.gradeClap();
};

function tap() {
    player.gradeTap();
}