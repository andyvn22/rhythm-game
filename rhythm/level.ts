/// <reference path="gameData.ts" />

let level = new Level("No Level!", new Piece(TimeSignature.commonTime));
let player = new Player(level.piece, level.tempo);
player.onPlay = function() { play(); }
player.onStop = function() { stop(); }

function loadLevel() {
    const params = new URLSearchParams(location.search);
    level = Skill.forID(params.get("skill")!).levels[parseInt(params.get("level")!)];
    $("h1").text(level.name);
    document.title = level.name;
    player.piece = level.piece;
    displayPiece();
}

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

$(document).ready(function() {
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

    loadLevel();
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
}

function clap() {
    player.gradeClap();
};

function tap() {
    player.gradeTap();
}