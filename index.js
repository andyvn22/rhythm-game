"use strict";
/// <reference path="gameData.ts" />
var __values = (this && this.__values) || function(o) {
    var s = typeof Symbol === "function" && Symbol.iterator, m = s && o[s], i = 0;
    if (m) return m.call(o);
    if (o && typeof o.length === "number") return {
        next: function () {
            if (o && i >= o.length) o = void 0;
            return { value: o && o[i++], done: !o };
        }
    };
    throw new TypeError(s ? "Object is not iterable." : "Symbol.iterator is not defined.");
};
jQuery.fn.extend({
    onPushExactly: function (handler) {
        $(this)
            .on("click", handler)
            .on("touchstart", function () { $(this).removeData("touchMoved"); })
            .on("touchmove", function () { $(this).data("touchMoved", 1); })
            .on("touchend", function (event) {
            if ($(this).data("touchMoved") !== 1) {
                handler(event);
            }
        });
    }
});
function copy(element, then) {
    element.select();
    if (navigator.clipboard) {
        navigator.clipboard.writeText(element.prop("value"))
            .then(function () { return then(true); })
            .catch(function () { return then(false); });
    }
    else {
        try {
            document.execCommand("copy");
            then(true);
        }
        catch (_a) {
            then(false);
        }
    }
}
function isCheating() {
    var params = new URLSearchParams(location.search);
    return (params.get("cheat") !== null);
}
function updateRequirementLines() {
    var lines = "";
    var disabledLines = "";
    $(".skill").each(function () {
        var e_1, _a;
        var _b, _c, _d, _e, _f;
        var skill = Skill.forID($(this).attr("id"));
        try {
            for (var _g = __values(requirementIDsForSkillElement($(this))), _h = _g.next(); !_h.done; _h = _g.next()) {
                var requirementID = _h.value;
                var requirement = Skill.forID(requirementID);
                var color = ((_b = skill === null || skill === void 0 ? void 0 : skill.isCompleted) !== null && _b !== void 0 ? _b : false) ? "#dbcfb5" : ((_c = requirement === null || requirement === void 0 ? void 0 : requirement.isCompleted) !== null && _c !== void 0 ? _c : false) ? "white" : "hsl(0,0%,30%)";
                var requirementElement = $("#" + requirementID);
                var newLine = "<line \n                x1=\"" + ($(this).offset().left + $(this).width() / 2) + "\" y1=\"" + ($(this).offset().top + $(this).height() / 2) + "\"\n                x2=\"" + (requirementElement.offset().left + requirementElement.width() / 2) + "\" y2=\"" + (requirementElement.offset().top + requirementElement.height() / 2) + "\"\n                stroke=\"" + color + "\" stroke-width=\"" + (((_d = skill === null || skill === void 0 ? void 0 : skill.isCompleted) !== null && _d !== void 0 ? _d : false) || ((_e = requirement === null || requirement === void 0 ? void 0 : requirement.isCompleted) !== null && _e !== void 0 ? _e : false) ? 5 : 3) + "\"\n            />";
                if ((_f = requirement === null || requirement === void 0 ? void 0 : requirement.isCompleted) !== null && _f !== void 0 ? _f : false) {
                    lines += newLine;
                }
                else {
                    disabledLines += newLine;
                }
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (_h && !_h.done && (_a = _g.return)) _a.call(_g);
            }
            finally { if (e_1) throw e_1.error; }
        }
    });
    $("#requirements").remove();
    $("#requirements-disabled").remove();
    $(document.body).append($("<svg id=\"requirements\" style=\"width: " + $(document).width() + "px; height: " + $(document).height() + "px;\">" + lines + "</svg>"));
    $(document.body).append($("<svg id=\"requirements-disabled\" style=\"width: " + $(document).width() + "px; height: " + $(document).height() + "px;\">" + disabledLines + "</svg>"));
}
/** Returns an array of the skill IDs required by `element`. */
function requirementIDsForSkillElement(element) {
    var _a;
    var requirements = element.data("requirements");
    return (_a = requirements === null || requirements === void 0 ? void 0 : requirements.split(" ")) !== null && _a !== void 0 ? _a : [];
}
function skillIsComplete(skillID) {
    var _a, _b;
    if (Profile.current.finishedSkill === skillID) {
        return false;
    }
    return (_b = (_a = Skill.forID(skillID)) === null || _a === void 0 ? void 0 : _a.isCompleted) !== null && _b !== void 0 ? _b : true;
}
/** Returns true if and only if all requirements for the given skill element are completed. */
function skillElementIsUnlocked(element) {
    var e_2, _a;
    if (isCheating()) {
        return true;
    }
    else if (Profile.current.skillState(element.attr("id")).currentLevel > 0) {
        return true;
    }
    var requirements = element.data("requirements");
    if (requirements !== undefined) {
        try {
            for (var _b = __values(requirements.split(" ")), _c = _b.next(); !_c.done; _c = _b.next()) {
                var requirementID = _c.value;
                if (!skillIsComplete(requirementID)) {
                    return false;
                }
            }
        }
        catch (e_2_1) { e_2 = { error: e_2_1 }; }
        finally {
            try {
                if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
            }
            finally { if (e_2) throw e_2.error; }
        }
    }
    return true;
}
function updateSkills() {
    updateRequirementLines();
    $(".skill").each(function () {
        var skillID = $(this).attr("id");
        var skill = Skill.forID(skillID);
        if (skill === undefined) {
            $(this).addClass("skill-undefined");
            $(this).text(skillID);
            return;
        }
        if (skillIsComplete(skillID)) {
            $(this).addClass("skill-completed");
            $(this).removeClass("skill-current");
            $(this).removeClass("skill-locked");
        }
        else if (skillElementIsUnlocked($(this))) {
            $(this).removeClass("skill-completed");
            $(this).addClass("skill-current");
            $(this).removeClass("skill-locked");
        }
        else {
            $(this).removeClass("skill-completed");
            $(this).removeClass("skill-current");
            $(this).addClass("skill-locked");
        }
        $(this).html(skill.name);
    });
}
function openDetailsForSkillElement(element) {
    var skillID = element.attr("id");
    var skill = Skill.forID(skillID);
    if (skill === undefined) {
        return;
    }
    var locked = element.hasClass("skill-locked");
    var completed = element.hasClass("skill-completed");
    var levelList = "";
    var currentUnlockedLevel = isCheating() ? skill.levels.length - 1 : Profile.current.skillState(skillID).currentLevel;
    for (var i = 0; i < skill.levels.length; i++) {
        var level = skill.levels[i];
        var levelName = "<span class=\"level-name\">" + level.name + "</span>&nbsp;<span class=\"ui-icon ui-icon-" + level.icon + "\"></span>";
        if (locked || i > currentUnlockedLevel) {
            levelList += "<li class=\"level-locked\">" + levelName + "</li>";
        }
        else if (i == currentUnlockedLevel) {
            levelList += "<li class=\"level-current\"><a href=\"" + level.pageURL + "\">" + levelName + "</a></li>";
        }
        else {
            levelList += "<li class=\"level-completed\"><a href=\"" + level.pageURL + "\">" + levelName + "</a></li>";
        }
    }
    var skillProgress = "<div id=\"skillProgress-" + skillID + "\"></div>";
    if (locked) {
        var missingRequirements = requirementIDsForSkillElement(element)
            .filter(function (x) { var _a, _b; return !((_b = (_a = Skill.forID(x)) === null || _a === void 0 ? void 0 : _a.isCompleted) !== null && _b !== void 0 ? _b : true); })
            .map(function (x) { var _a, _b; return "<li><span class=\"ui-icon ui-icon-locked\"></span>" + ((_b = (_a = Skill.forID(x)) === null || _a === void 0 ? void 0 : _a.name) !== null && _b !== void 0 ? _b : x) + "</li>"; });
        skillProgress = "<div class=\"skillRequirementsList\">\n            To unlock this skill, complete:\n            <ul>\n                " + missingRequirements.join("") + "\n            </ul>\n        </div>";
    }
    var tooltipContent = "<div class=\"skillDetails " + (locked ? "skillDetails-locked" : completed ? "skillDetails-completed" : "skillDetails-current") + "\">\n        <h2>" + skill.name + "</h2>\n        " + skillProgress + "\n        <ol class=\"levelList\">" + levelList + "</ol>\n    </div>";
    element.tooltip({
        content: tooltipContent,
        position: { my: "center top", at: "center bottom" },
        show: { effect: "fade", duration: 700 },
        hide: { effect: "fade", duration: 700 },
        close: function () {
            var _this = this;
            window.setTimeout(function () { return $(_this).tooltip("destroy"); }, 700);
        }
    });
    element.attr("title", "");
    element.tooltip("open");
    element.off("mouseleave"); //prevent tooltip from autoclosing
    element.addClass("skill-open");
    $("#skillProgress-" + skillID).progressbar({
        value: Profile.current.skillState(skillID).currentLevel,
        max: skill.levels.length
    });
}
function closeAllSkillDetails() {
    $(".skill-open").each(function () {
        if ($(this).tooltip("instance") !== undefined) {
            $(this).tooltip("close");
        }
        $(this).removeClass("skill-open");
    });
}
function centerOnElement(element) {
    $(window).scrollLeft(element.offset().left + element.width() / 2 - $(window).width() / 2);
    $(window).scrollTop(element.offset().top + element.height() / 2 - $(window).height() / 2);
}
function updateProfileButton() {
    var name = Profile.current.hasName ? Profile.current.name + " (" + Profile.current.completionDescription + ")" : Profile.current.completionDescription + " complete";
    $("#profileButton").button({
        label: name,
        icons: { primary: "ui-icon-person" }
    }).on("click", function () {
        openProfileDialog();
    });
}
function updateProfileDialog() {
    var greeting = Profile.current.hasName ? "Hello, <strong>" + Profile.current.name + "</strong>!" : "Hello, unnamed player!";
    var profileRows = "";
    Profile.each(function (i, profile) {
        if (i !== Profile.currentIndex) {
            var name_1 = profile.hasName ? profile.name : "Unnamed Player";
            profileRows += "<button class=\"profileBecomeButton\" type=\"button\" value=\"" + i + "\">Become " + name_1 + " (" + profile.completionDescription + ")</button><br/>";
        }
    });
    profileRows += "<button id=\"profileAddButton\" type=\"button\">Create New Player</button><br/>";
    var reviveLink = "";
    if (Profile.recentlyDeleted !== null) {
        reviveLink = "<br/><a href=\"\" id=\"profileReviveLink\">(Oops; please revive " + (Profile.recentlyDeleted.hasName ? Profile.recentlyDeleted.name : "Unnamed Player") + "!)</a>";
    }
    $("#profileDialog").html("<div id=\"profileDialog\">\n        <p id=\"profileGreeting\">" + greeting + " <span id=\"profileCompletion\">(" + Profile.current.completionDescription + " complete)</span></p>\n        <fieldset>\n            <legend>Switch Players</legend>\n            " + profileRows + "\n        </fieldset>\n        <fieldset>\n            <legend>" + (Profile.current.hasName ? "Change" : "Set") + " Your Name</legend>\n            <label for=\"profileNameField\">Your name:</label>\n            <input type=\"text\" id=\"profileNameField\" value=\"" + Profile.current.name + "\">\n        </fieldset>\n        <fieldset>\n            <legend>Continue on Another Device</legend>\n            <button id=\"profileCopySavedLinkButton\" type=\"button\">Copy Link to " + (Profile.current.hasName ? "\"" + Profile.current.name + "\"" : "Current Player") + "</button>\n            <input type=\"text\" id=\"profileSavedLink\" value=\"" + Profile.current.savedLink + "\" readonly>\n            <label for=\"profileSavedLink\" id=\"profileSavedLinkLabel\">Open this link on another device to transfer your progress.</label><br/>\n        </fieldset>\n        <fieldset>\n            <legend>Erase Your Progress</legend>\n            <button id=\"profileDeleteButton\" type=\"button\">Delete " + (Profile.current.hasName ? "\"" + Profile.current.name + "\"" : "Current Player") + "</button>\n            " + reviveLink + "\n        </fieldset>\n    </div>");
    $("#profileNameField").on("change", function () {
        Profile.current.name = $(this).val();
    });
    $(".profileBecomeButton").button({
        icons: { primary: "ui-icon-transfer-e-w" }
    }).on("click", function () {
        Profile.currentIndex = parseInt($(this).val());
    });
    $("#profileAddButton").button({
        icons: { primary: "ui-icon-circle-plus" }
    }).on("click", function () {
        Profile.add(new Profile("New Player"));
    });
    $("#profileSavedLink").onPushExactly(function () { return $("#profileSavedLink").select(); });
    $("#profileCopySavedLinkButton").button({
        icons: { primary: "ui-icon-link" }
    }).on("click", function () {
        copy($("#profileSavedLink"), function (success) {
            var _a;
            if (success) {
                $("#profileCopySavedLinkButton").button("option", "icon", "ui-icon-clipboard");
                $("#profileCopySavedLinkButton").button("option", "label", "Copied Link!");
            }
            else {
                $("#profileCopySavedLinkButton").button("option", "icon", "ui-icon-notice");
                $("#profileCopySavedLinkButton").button("option", "label", "Copy Failed.");
            }
            $("#profileCopySavedLinkButton").button("disable");
            if (isMobile()) {
                (_a = document.getSelection()) === null || _a === void 0 ? void 0 : _a.removeAllRanges();
            }
        });
    });
    $("#profileDeleteButton").button({
        icons: { primary: "ui-icon-alert" }
    }).on("click", function () {
        Profile.removeCurrent();
    });
    if (Profile.recentlyDeleted !== null) {
        $("#profileReviveLink").onPushExactly(function () { return Profile.reviveRecentlyDeleted(); });
    }
    $("#profileDialog").dialog({
        title: "Edit Players",
        autoOpen: false,
        modal: true,
        width: Math.min(vw(80), em(40)),
        buttons: { "OK": function () { $(this).dialog("close"); } },
        show: {
            effect: "drop",
            duration: 600
        },
        hide: {
            effect: "drop",
            duration: 600
        },
        beforeClose: function () { var _a; return (_a = document.getSelection()) === null || _a === void 0 ? void 0 : _a.removeAllRanges(); }
    });
}
function openProfileDialog() {
    updateProfileDialog();
    $("#profileDialog").dialog("open");
    if (!isMobile()) {
        $("#profileSavedLink").select();
    }
}
function initializeHelpButton() {
    $("#helpDialog").dialog({
        title: "Rhythm Game Help",
        autoOpen: false,
        modal: true,
        width: Math.min(vw(80), em(40)),
        buttons: { "OK": function () { $(this).dialog("close"); } },
        show: {
            effect: "drop",
            duration: 600
        },
        hide: {
            effect: "drop",
            duration: 600
        }
    });
    $("#helpButton").onPushExactly(function () { return $("#helpDialog").dialog("open"); });
}
function handleFinishedSkill() {
    if (Profile.current.finishedSkill === "") {
        return;
    }
    var skill = Skill.forID(Profile.current.finishedSkill);
    if (skill === undefined) {
        return;
    }
    var skillElement = $("#" + Profile.current.finishedSkill);
    centerOnElement(skillElement);
    ExplodingParticle.makeContext();
    //preload success sound
    Sound.success;
    var popup = $("<div class=\"finishedSkill\">You completed all " + skill.levels.length + " levels in the &quot;" + skill.name + "&quot; skill!</div>");
    popup.dialog({
        title: "Skill Complete!",
        modal: true,
        closeOnEscape: false,
        buttons: [{
                text: "Yay!",
                icon: "ui-icon-star",
                click: function () { return popup.dialog("close"); },
                class: "nextSkillButton"
            }],
        hide: { effect: "fade", duration: 1000 },
        close: function () {
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
$(document).ready(function () {
    Profile.onUpdate = function () {
        updateProfileButton();
        updateProfileDialog();
        updateSkills();
    };
    Profile.loadAllFromStorage();
    initializeHelpButton();
    var params = new URLSearchParams(location.search);
    if (params.get("finishedSkill") !== null) {
        Profile.current.finishedSkill = params.get("finishedSkill");
    }
    $(document.body).onPushExactly(function () {
        closeAllSkillDetails();
    });
    $(".skill").on("click", function (event) {
        event.stopPropagation(); //prevent event from bubbling up to body and closing the new tooltip
        closeAllSkillDetails();
        if ($(this).tooltip("instance") !== undefined) {
            return;
        } //we were open (& now we're closing); we're done here.
        openDetailsForSkillElement($(this));
        //finally, prevent tooltip clicks from bubbling up to body and closing the very tooltips they were trying to interact with
        $(".skillDetails").parent().parent().on("click touchend", function (event) { event.stopPropagation(); });
    });
    //Start centered (in case page is wider than the window--we'll center on different elements later if appropriate)
    $(window).scrollLeft(document.body.scrollWidth / 2 - $(window).width() / 2);
    var skillID = params.get("skill");
    if (skillID !== null) {
        var skill = $("#" + skillID);
        openDetailsForSkillElement(skill);
        centerOnElement(skill);
    }
    handleFinishedSkill();
});
$(window).on('resize', function () {
    updateRequirementLines();
});
var ExplodingParticle = /** @class */ (function () {
    function ExplodingParticle(x, y, color) {
        this.speed = {
            x: -3 + Math.random() * 6,
            y: -3 + Math.random() * 6
        };
        this.x = x;
        this.y = y;
        this.color = color;
        this.startTime = Date.now();
        this.startRadius = 5 + Math.random() * 5;
        this.radius = this.startRadius;
    }
    ExplodingParticle.prototype.draw = function (context) {
        if (this.radius <= 0) {
            return;
        }
        // Draw a circle at the current location
        context.beginPath();
        context.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        context.fillStyle = "rgba(" + this.color.r + ',' + this.color.g + ',' + this.color.b + ", 1)";
        context.fill();
    };
    ExplodingParticle.makeContext = function () {
        var particleCanvas = document.createElement("canvas");
        ExplodingParticle.context = particleCanvas.getContext("2d");
        console.log(parseInt($("#requirements").css("width")));
        particleCanvas.width = $(document).width();
        particleCanvas.height = $(document).height();
        particleCanvas.style.position = "absolute";
        particleCanvas.style.top = "0";
        particleCanvas.style.left = "0";
        particleCanvas.style.zIndex = "-999";
        document.body.appendChild(particleCanvas);
        window.requestAnimationFrame(ExplodingParticle.update);
    };
    ExplodingParticle.explode = function (element, colors) {
        // Keep track of how many times we've iterated (in order to reduce
        // the total number of particles create)
        var count = 0;
        var reductionFactor = 80;
        // Go through every location of our button and create a particle
        for (var localX = 0; localX < element.width(); localX++) {
            for (var localY = 0; localY < element.height(); localY++) {
                if (count % reductionFactor === 0) {
                    var globalX = element.offset().left + localX;
                    var globalY = element.offset().top + localY;
                    ExplodingParticle.particles.push(new ExplodingParticle(globalX, globalY, colors[Math.floor(Math.random() * colors.length)]));
                }
                count++;
            }
        }
    };
    ExplodingParticle.update = function () {
        if (ExplodingParticle.context === undefined) {
            return;
        }
        ExplodingParticle.context.clearRect(0, 0, $(document).width(), $(document).height());
        // Draw all of our particles in their new location
        for (var i = 0; i < ExplodingParticle.particles.length; i++) {
            var particle = ExplodingParticle.particles[i];
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
    };
    ExplodingParticle.animationDuration = 200; //frames
    ExplodingParticle.particles = [];
    return ExplodingParticle;
}());
