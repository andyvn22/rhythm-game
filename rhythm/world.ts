/// <reference path="gameData.ts" />

interface JQuery<TElement = HTMLElement> {
    /**
     * Calls `handler` on `click` *or* `touchend`, but not both, and throws out touches that looks like drags.
     */
    onPushExactly(handler: (event: Event) => void): void;
}

jQuery.fn.extend({
    onPushExactly: function(handler: (event: Event) => void) {
        $(this)
            .on("click", handler)
            .on("touchstart", function() { $(this).removeData("touchMoved"); })
            .on("touchmove", function() { $(this).data("touchMoved", 1); })
            .on("touchend", function(event: Event) {
                if ($(this).data("touchMoved") !== 1) {
                    handler(event);
                }
            });
    }
});

function updateRequirementLines() {
    let lines = "";

    let height = 0;
    $(".skill").each(function() {
        const requirements = $(this).data("requirement");
        if (requirements === undefined) { return; }

        for (let requirementID of requirements.split(" ")) {
            const requirement = $("#" + requirementID);
            lines += `<line 
                x1="${$(this).offset()!.left + $(this).width()!/2}" y1="${$(this).offset()!.top + $(this).height()!/2}"
                x2="${requirement.offset()!.left + requirement.width()!/2}" y2="${requirement.offset()!.top + requirement.height()!/2}"
                stroke="white" stroke-width="3"
            />`;
            height = Math.max(height, $(this).offset()!.top + $(this).height()!);
        }
    });

    $("#requirements").remove();
    $(document.body).append($(`<svg id="requirements" style="height: ${height}px">${lines}</svg>`));
}

function updateSkills() {
    updateRequirementLines();

    $(".skill").each(function() {
        const skill = Skill.forID($(this).attr("id")!);
        let result = `<div class="skillDetails"><h2>${skill.name}</h2><ol class="levelList">`;
        for (let i = 0; i < skill.levels.length; i++) {
            const level = skill.levels[i];
            result += `<li><a href="level.html?skill=${$(this).attr("id")}&level=${i}">${level.name}</a></li>`;
        }
        result += "</ol></div>";

        $(this).on("click", function(event) {
            event.stopPropagation(); //prevent event from bubbling up to body and closing the new tooltip
            closeAllSkillDetails();

            if ($(this).tooltip("instance") !== undefined) { return; } //we were open (& now we're closing); we're done here.
            
            $(this).tooltip({
                content: result,
                hide: { effect: "fade", duration: 500 },
                close: function() { window.setTimeout(() => $(this).tooltip("destroy"), 500); }
            });
            $(this).attr("title", "");

            $(this).tooltip("open");
            $(this).off("mouseleave"); //prevent tooltip from autoclosing
            $(this).addClass("skill-open");

            //finally, prevent tooltip clicks from bubbling up to body and closing the very tooltips they were trying to interact with
            $(".skillDetails").on("click touchend", function(event) { event.stopPropagation(); });
        });
    });
}

function closeAllSkillDetails() {
    $(".skill").each(function() {
        $(this).removeClass("skill-open");
        if ($(this).tooltip("instance") !== undefined) {
            $(this).tooltip("close");
        }
    })
}

function updateProfileButton() {
    $("#profile").button({
        label: Profile.current.name,
        icons: { primary: "ui-icon-person" }
    }).on("click", function() {
        openProfileDialog();
    });
}

function updateProfileDialog() {
    const greeting = Profile.current.hasName ? `Hello, <strong>${Profile.current.name}</strong>!` : `Hello, unnamed player!`;

    let profileRows = "";
    for (let i = 0; i < Profile.all.length; i++) {
        if (i !== Profile.currentIndex) {
            const name = Profile.all[i].hasName ? Profile.all[i].name : "Unnamed Player";
            profileRows += `<button class="profileBecomeButton" type="button" value="${i}">Become ${name}</button><br/>`;
        }
    }
    profileRows += `<button id="profileAddButton" type="button">Create New Player</button><br/>`;

    const profileHTML = `<div id="profileDialog">
        <p>${greeting}</p>
        <fieldset>
            <legend>${Profile.current.hasName ? "Change" : "Set"} Your Name</legend>
            <label for="profileNameField">Your name:</label>
            <input type="text" id="profileNameField" value="${Profile.current.name}">
        </fieldset>
        <fieldset>
            <legend>Other Players</legend>
            ${profileRows}
        </fieldset>
        <fieldset>
            <legend>Erase Your Progress</legend>
            <button id="profileDeleteButton" type="button">Delete ${Profile.current.hasName ? `"${Profile.current.name}"` : `Current Player`}</button>
        </fieldset>
    </div>`;

    $("#profileDialog").html(profileHTML);

    $("#profileNameField").on("change", function() {
        Profile.current.name = $(this).val() as string;
        Profile.saveAllToStorage();
        updateProfileButton();
        updateProfileDialog();
    });

    $(".profileBecomeButton").button({
        icons: { primary: "ui-icon-transfer-e-w" }
    }).on("click", function() {
        Profile.currentIndex = parseInt($(this).val() as string);
        Profile.saveAllToStorage();
        updateProfileButton();
        updateProfileDialog();
    });

    $("#profileAddButton").button({
        icons: { primary: "ui-icon-circle-plus" }
    }).on("click", function() {
        Profile.all.push(new Profile("New Player"));
        Profile.currentIndex = Profile.all.length - 1;
        Profile.saveAllToStorage();
        updateProfileButton();
        updateProfileDialog();
    });

    $("#profileDeleteButton").button({
        icons: { primary: "ui-icon-alert" }
    }).on("click", function() {
        if (Profile.all.length === 1) { Profile.all.push(new Profile("")); }
        Profile.all.splice(Profile.currentIndex, 1);
        Profile.currentIndex = 0;
        Profile.saveAllToStorage();
        updateProfileButton();
        updateProfileDialog();
    });
}

function openProfileDialog() {
    updateProfileDialog();
    $("#profileDialog").dialog({
        title: "Edit Players",
        modal: true,
        width: Math.min(vw(80), em(30)),
        buttons: { "OK": function() { $(this).dialog("close"); } },
        show: {
            effect: "drop",
            duration: 600
        },
        hide: {
            effect: "drop",
            duration: 600
        }
    });
}

$(document).ready(function() {
    Profile.loadAllFromStorage();

    $(document.body).onPushExactly(function() {
        closeAllSkillDetails();
    })
    updateSkills();
    updateProfileButton();
});

$(window).on('resize', function(){
    updateRequirementLines();
});