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
    let disabledLines = "";

    let height = 0;
    $(".skill").each(function() {
        const skill = Skill.forID($(this).attr("id")!);

        for (let requirementID of requirementIDsForSkillElement($(this))) {
            const requirement = Skill.forID(requirementID);
            const color = (skill?.isCompleted ?? false) ? "#dbcfb5" : (requirement?.isCompleted ?? false) ? "white" : "hsl(0,0%,85%)";

            const requirementElement = $("#" + requirementID);
            const newLine = `<line 
                x1="${$(this).offset()!.left + $(this).width()!/2}" y1="${$(this).offset()!.top + $(this).height()!/2}"
                x2="${requirementElement.offset()!.left + requirementElement.width()!/2}" y2="${requirementElement.offset()!.top + requirementElement.height()!/2}"
                stroke="${color}" stroke-width="3"
            />`;

            if (requirement?.isCompleted ?? false) {
                lines += newLine;
            } else {
                disabledLines += newLine;
            }

            height = Math.max(height, $(this).offset()!.top + $(this).height()!);
        }
    });

    $("#requirements").remove();
    $("#requirements-disabled").remove();
    $(document.body).append($(`<svg id="requirements" style="height: ${height}px">${lines}</svg>`));
    $(document.body).append($(`<svg id="requirements-disabled" style="height: ${height}px">${disabledLines}</svg>`));
}

/** Returns an array of the skill IDs required by `element`. */
function requirementIDsForSkillElement(element: JQuery<HTMLElement>): Array<string> {
    const requirements = element.data("requirements");
    return requirements?.split(" ") ?? [];
}

/** Returns true if and only if all requirements for the given skill element are completed. */
function skillElementIsUnlocked(element: JQuery<HTMLElement>) {
    const requirements = element.data("requirements");
    if (requirements !== undefined) {
        for (let requirementID of requirements.split(" ")) {
            const requirementMet = Skill.forID(requirementID)?.isCompleted ?? true;
            if (!requirementMet) { return false; }
        }
    }
    return true;
}

function updateSkills() {
    updateRequirementLines();

    $(".skill").each(function() {
        const skillID = $(this).attr("id")!;
        const skill = Skill.forID(skillID);
        if (skill === undefined) {
            $(this).addClass("skill-undefined");
            $(this).text(skillID);
            return;
        }
        const currentLevel = Profile.current.skillState(skillID).currentLevel;
        if (currentLevel >= skill.levels.length) {
            $(this).addClass("skill-completed");
            $(this).removeClass("skill-current");
            $(this).removeClass("skill-locked");
        } else if (skillElementIsUnlocked($(this))) {
            $(this).removeClass("skill-completed");
            $(this).addClass("skill-current");
            $(this).removeClass("skill-locked");
        } else {
            $(this).removeClass("skill-completed");
            $(this).removeClass("skill-current");
            $(this).addClass("skill-locked");
        }
        $(this).text(skill.name);
    });
}

function openDetailsForSkillElement(element: JQuery<HTMLElement>) {
    const skillID = element.attr("id")!;
    const skill = Skill.forID(skillID);
    if (skill === undefined) { return; }
    const locked = !skillElementIsUnlocked(element);
    const completed = skill.levels.length <= Profile.current.skillState(skillID).currentLevel;

    let levelList = ``;
    for (let i = 0; i < skill.levels.length; i++) {
        const level = skill.levels[i];
        const levelName = `<span class="level-name">${level.name}</span>&nbsp;<span class="ui-icon ui-icon-${level.icon}"></span>`;
        if (locked || i > Profile.current.skillState(skillID).currentLevel) {
            levelList += `<li class="level-locked">${levelName}</li>`;
        } else if (i == Profile.current.skillState(skillID).currentLevel) {
            levelList += `<li class="level-current"><a href="${level.pageURL}">${levelName}</a></li>`;
        } else {
            levelList += `<li class="level-completed"><a href="${level.pageURL}">${levelName}</a></li>`;
        }
    }

    let skillProgress = `<div id="skillProgress-${skillID}"></div>`;
    if (locked) {
        const missingRequirements = requirementIDsForSkillElement(element)
            .filter(x => !(Skill.forID(x)?.isCompleted ?? true))
            .map(x => `<li><span class="ui-icon ui-icon-locked"></span>${Skill.forID(x)?.name ?? x}</li>`);

        skillProgress = `<div class="skillRequirementsList">
            To unlock this skill, complete:
            <ul>
                ${missingRequirements.join("")}
            </ul>
        </div>`
    }

    const tooltipContent = `<div class="skillDetails ${locked ? "skillDetails-locked" : completed ? "skillDetails-completed" : "skillDetails-current"}">
        <h2>${skill.name}</h2>
        ${skillProgress}
        <ol class="levelList">${levelList}</ol>
    </div>`;
    
    element.tooltip({
        content: tooltipContent,
        position: { my: "center top", at: "center bottom" },
        show: { effect: "fade", duration: 700 },
        hide: { effect: "fade", duration: 700 },
        close: function() { window.setTimeout(() => $(this).tooltip("destroy"), 700); }
    });
    element.attr("title", "");

    element.tooltip("open");
    element.off("mouseleave"); //prevent tooltip from autoclosing
    element.addClass("skill-open");

    $(`#skillProgress-${skillID}`).progressbar({
        value: Profile.current.skillState(skillID).currentLevel,
        max: skill.levels.length
    })
}

function closeAllSkillDetails() {
    $(".skill-open").each(function() {
        if ($(this).tooltip("instance") !== undefined) {
            $(this).tooltip("close");
        }
        $(this).removeClass("skill-open");
    })
}

function centerOnElement(element: JQuery<HTMLElement>) {
    console.log(element.offset()!.left);
    console.log(element.width()!);
    console.log($(window).width()!);
    console.log(element.offset()!.left + element.width()!/2 - $(window).width()!/2);
    $(window).scrollLeft(element.offset()!.left + element.width()!/2 - $(window).width()!/2);
    $(window).scrollTop(element.offset()!.top + element.height()!/2 - $(window).height()!/2);
}

function updateProfileButton() {
    $("#profileButton").button({
        label: Profile.current.name,
        icons: { primary: "ui-icon-person" }
    }).on("click", function() {
        openProfileDialog();
    });
}

function updateProfileDialog() {
    const greeting = Profile.current.hasName ? `Hello, <strong>${Profile.current.name}</strong>!` : `Hello, unnamed player!`;

    let profileRows = "";
    Profile.each(function(i, profile) {
        if (i !== Profile.currentIndex) {
            const name = profile.hasName ? profile.name : "Unnamed Player";
            profileRows += `<button class="profileBecomeButton" type="button" value="${i}">Become ${name}</button><br/>`;
        }
    });
    profileRows += `<button id="profileAddButton" type="button">Create New Player</button><br/>`;

    const profileHTML = `<div id="profileDialog">
        <p>${greeting}</p>
        <fieldset>
            <legend>Switch Players</legend>
            ${profileRows}
        </fieldset>
        <fieldset>
            <legend>${Profile.current.hasName ? "Change" : "Set"} Your Name</legend>
            <label for="profileNameField">Your name:</label>
            <input type="text" id="profileNameField" value="${Profile.current.name}">
        </fieldset>
        <fieldset>
            <legend>Erase Your Progress</legend>
            <button id="profileDeleteButton" type="button">Delete ${Profile.current.hasName ? `"${Profile.current.name}"` : `Current Player`}</button>
        </fieldset>
    </div>`;

    $("#profileDialog").html(profileHTML);

    $("#profileNameField").on("change", function() {
        Profile.current.name = $(this).val() as string;
    });

    $(".profileBecomeButton").button({
        icons: { primary: "ui-icon-transfer-e-w" }
    }).on("click", function() {
        Profile.currentIndex = parseInt($(this).val() as string);
    });

    $("#profileAddButton").button({
        icons: { primary: "ui-icon-circle-plus" }
    }).on("click", function() {
        Profile.add(new Profile("New Player"));
    });

    $("#profileDeleteButton").button({
        icons: { primary: "ui-icon-alert" }
    }).on("click", function() {
        Profile.removeCurrent();
    });

    $("#profileDialog").dialog({
        title: "Edit Players",
        autoOpen: false,
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

function openProfileDialog() {
    updateProfileDialog();
    $("#profileDialog").dialog("open");
}

$(document).ready(function() {
    Profile.onUpdate = function() {
        updateProfileButton();
        updateProfileDialog();
        updateSkills();
    }
    Profile.loadAllFromStorage();

    $(document.body).onPushExactly(function() {
        closeAllSkillDetails();
    })

    $(".skill").on("click", function(event) {
        event.stopPropagation(); //prevent event from bubbling up to body and closing the new tooltip
        closeAllSkillDetails();

        if ($(this).tooltip("instance") !== undefined) { return; } //we were open (& now we're closing); we're done here.

        openDetailsForSkillElement($(this));

        //finally, prevent tooltip clicks from bubbling up to body and closing the very tooltips they were trying to interact with
        $(".skillDetails").parent().parent().on("click touchend", function(event) { event.stopPropagation(); });
    });

    const params = new URLSearchParams(location.search);
    const skillID = params.get("skill");
    if (skillID !== null) {
        const skill = $("#" + skillID);
        openDetailsForSkillElement(skill);
        centerOnElement(skill);
    }
});

$(window).on('resize', function(){
    updateRequirementLines();
});