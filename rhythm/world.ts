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

function isCheating() {
    const params = new URLSearchParams(location.search);
    return (params.get("cheat") !== null);
}

function updateRequirementLines() {
    let lines = "";
    let disabledLines = "";

    $(".skill").each(function() {
        const skill = Skill.forID($(this).attr("id")!);

        for (let requirementID of requirementIDsForSkillElement($(this))) {
            const requirement = Skill.forID(requirementID);
            const color = (skill?.isCompleted ?? false) ? "#dbcfb5" : (requirement?.isCompleted ?? false) ? "white" : "hsl(0,0%,30%)";

            const requirementElement = $("#" + requirementID);
            const newLine = `<line 
                x1="${$(this).offset()!.left + $(this).width()!/2}" y1="${$(this).offset()!.top + $(this).height()!/2}"
                x2="${requirementElement.offset()!.left + requirementElement.width()!/2}" y2="${requirementElement.offset()!.top + requirementElement.height()!/2}"
                stroke="${color}" stroke-width="${(skill?.isCompleted ?? false) || (requirement?.isCompleted ?? false) ? 5 : 3}"
            />`;

            if (requirement?.isCompleted ?? false) {
                lines += newLine;
            } else {
                disabledLines += newLine;
            }
        }
    });

    $("#requirements").remove();
    $("#requirements-disabled").remove();
    $(document.body).append($(`<svg id="requirements" style="width: ${$(document).width()!}px; height: ${$(document).height()!}px;">${lines}</svg>`));
    $(document.body).append($(`<svg id="requirements-disabled" style="width: ${$(document).width()!}px; height: ${$(document).height()!}px;">${disabledLines}</svg>`));
}

/** Returns an array of the skill IDs required by `element`. */
function requirementIDsForSkillElement(element: JQuery<HTMLElement>): Array<string> {
    const requirements = element.data("requirements");
    return requirements?.split(" ") ?? [];
}

function skillIsComplete(skillID: string) {
    if (Profile.current.finishedSkill === skillID) { return false; }
    return Skill.forID(skillID)?.isCompleted ?? true;
}

/** Returns true if and only if all requirements for the given skill element are completed. */
function skillElementIsUnlocked(element: JQuery<HTMLElement>) {
    if (isCheating()) { return true; }

    const requirements = element.data("requirements");
    if (requirements !== undefined) {
        for (let requirementID of requirements.split(" ")) {
            if (!skillIsComplete(requirementID)) { return false; }
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
        if (skillIsComplete(skillID)) {
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
        $(this).html(skill.name);
    });
}

function openDetailsForSkillElement(element: JQuery<HTMLElement>) {
    const skillID = element.attr("id")!;
    const skill = Skill.forID(skillID);
    if (skill === undefined) { return; }
    const locked = element.hasClass("skill-locked");
    const completed = element.hasClass("skill-completed");

    let levelList = ``;
    const currentUnlockedLevel = isCheating() ? skill.levels.length - 1 : Profile.current.skillState(skillID).currentLevel;
    for (let i = 0; i < skill.levels.length; i++) {
        const level = skill.levels[i];
        const levelName = `<span class="level-name">${level.name}</span>&nbsp;<span class="ui-icon ui-icon-${level.icon}"></span>`;
        if (locked || i > currentUnlockedLevel) {
            levelList += `<li class="level-locked">${levelName}</li>`;
        } else if (i == currentUnlockedLevel) {
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

function handleFinishedSkill() {
    if (Profile.current.finishedSkill === "") { return; }

    const skill = Skill.forID(Profile.current.finishedSkill);
    if (skill === undefined) { return; }

    const skillElement = $("#" + Profile.current.finishedSkill);
    centerOnElement(skillElement);
    ExplodingParticle.makeContext();

    //preload success sound
    Sound.success;
    
    const popup = $(`<div class="finishedSkill">You completed all ${skill.levels.length} levels in the &quot;${skill.name}&quot; skill!</div>`);
    popup.dialog({
        title: "Skill Complete!",
        modal: true,
        closeOnEscape: false,
        buttons: [{
            text: "Yay!",
            icon: "ui-icon-star",
            click: () => popup.dialog("close"),
            class: "nextSkillButton"
        }],
        hide: { effect: "fade", duration: 1000 },
        close: function() {
            Profile.current.finishedSkill = "";
            ExplodingParticle.explode(skillElement, [
                { r: 209, g: 188, b: 119 },
                { r: 145, g: 122, b: 76 },
                { r: 255, g: 255, b: 255 }
            ]);
            Sound.success.play();
        }
    });
}

$(document).ready(function() {
    Profile.onUpdate = function() {
        updateProfileButton();
        updateProfileDialog();
        updateSkills();
    }
    Profile.loadAllFromStorage();

    const params = new URLSearchParams(location.search);
    if (params.get("finishedSkill") !== null) {
        Profile.current.finishedSkill = params.get("finishedSkill")!;
    }

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

    const skillID = params.get("skill");
    if (skillID !== null) {
        const skill = $("#" + skillID);
        openDetailsForSkillElement(skill);
        centerOnElement(skill);
    }

    handleFinishedSkill();
});

$(window).on('resize', function(){
    updateRequirementLines();
});

interface Color {
    r: number;
    g: number;
    b: number;
}

class ExplodingParticle {
    speed = {
        x: -3 + Math.random() * 6,
        y: -3 + Math.random() * 6
    };
    startRadius: number;
    radius: number;
    color: Color
    x: number;
    y: number;
    startTime: number;

    constructor(x: number, y: number, color: Color) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.startTime = Date.now();
        this.startRadius = 5 + Math.random() * 5;
        this.radius = this.startRadius;
    }

    draw(context: CanvasRenderingContext2D) {
        if(this.radius <= 0) { return; }

        // Draw a circle at the current location
        context.beginPath();
        context.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        context.fillStyle = "rgba(" + this.color.r + ',' + this.color.g + ',' + this.color.b + ", 1)";
        context.fill();
    }

    static animationDuration = 200; //frames

    private static context: CanvasRenderingContext2D;
    static makeContext() {
        const particleCanvas = document.createElement("canvas");
        ExplodingParticle.context = particleCanvas.getContext("2d")!;
        
        console.log(parseInt($("#requirements").css("width")));
        particleCanvas.width = $(document).width()!;
        particleCanvas.height = $(document).height()!;
        
        particleCanvas.style.position = "absolute";
        particleCanvas.style.top = "0";
        particleCanvas.style.left = "0";
        particleCanvas.style.zIndex = "-999";
        
        document.body.appendChild(particleCanvas);
        window.requestAnimationFrame(ExplodingParticle.update);
    }

    private static particles: Array<ExplodingParticle> = [];

    static explode(element: JQuery<HTMLElement>, colors: Array<Color>) {
        // Keep track of how many times we've iterated (in order to reduce
        // the total number of particles create)
        let count = 0;
        const reductionFactor = 80;
        
        // Go through every location of our button and create a particle
        for(let localX = 0; localX < element.width()!; localX++) {
            for(let localY = 0; localY < element.height()!; localY++) {
                if(count % reductionFactor === 0) {
                    let globalX = element.offset()!.left + localX;
                    let globalY = element.offset()!.top + localY;
                    ExplodingParticle.particles.push(new ExplodingParticle(globalX, globalY, colors[Math.floor(Math.random() * colors.length)]));
                }
                count++;
            }
        }
    }

    static update() {
        if (ExplodingParticle.context === undefined) { return; }
        ExplodingParticle.context.clearRect(0, 0, $(document).width()!, $(document).height()!);
      
        // Draw all of our particles in their new location
        for(let i = 0; i < ExplodingParticle.particles.length; i++) {
            const particle = ExplodingParticle.particles[i];
            particle.draw(ExplodingParticle.context);
    
            // Update the particle's location and life
            particle.radius -= particle.startRadius / ExplodingParticle.animationDuration;
            particle.x += particle.speed.x;
            particle.y += particle.speed.y;
            
            if (i === ExplodingParticle.particles.length - 1 && particle.radius <= 0) {
                ExplodingParticle.particles = [];
                $("canvas").remove();
                return;
            }
        }
        
        window.requestAnimationFrame(ExplodingParticle.update);
    }
}