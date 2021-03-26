/// <reference path="music.ts" />

/**
 * Returns true if and only if the user is on Safari on iOS (so that you can, for example, hack around a redraw bug).
 */
function isMobileSafari() {
    var safari = !!navigator.userAgent.match(/Version\/[\d\.]+.*Safari/);
    var iOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    return safari && iOS;
}

function isMobile() {
    return navigator.userAgent.match(/Mobi/);
}

function isMac() {
    return navigator.platform.match(/Mac/);
}

function returnKeyName() {
    return isMac() ? `return` : `enter`;
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

/**
 * Records the progress made on a particular skill. Automatically calls `Profile.update()` when modified.
 */
class SkillState {
    readonly id: string;
    private _currentLevel: number;
    private _failedAttempts: number;

    get currentLevel() { return this._currentLevel; }
    set currentLevel(newValue) {
        this._currentLevel = newValue;
        this._failedAttempts = 0;
        Profile.update();
    }

    get failedAttempts() { return this._failedAttempts; }
    set failedAttempts(newValue) {
        this._failedAttempts = newValue;
        Profile.update();
    }

    constructor(id: string, currentLevel = 0, failedAttempts = 0) {
        this.id = id;
        this._currentLevel = currentLevel;
        this._failedAttempts = failedAttempts;
    }
}

/**
 * Tracks all state of a player's progress through the game. Automatically calls `Profile.update()` when modified.
 */
class Profile {
    private _name: string;
    get name() { return this._name; }
    set name(newValue) {
        this._name = newValue.trim();
        Profile.update();
    }

    private skills: Array<SkillState>;

    private _finishedSkill: string;
    get finishedSkill() { return this._finishedSkill; }
    set finishedSkill(newValue) {
        this._finishedSkill = newValue;
        Profile.update();
    }

    constructor(name = "", skills: Array<SkillState> = [], finishedSkill = "") {
        this._name = name;
        this.skills = skills;
        this._finishedSkill = finishedSkill;
    }

    static decode(profileCode: string) {
        const params = new URLSearchParams(profileCode);
        let name = "";
        let finishedSkill = "";
        let result: Array<SkillState> = [];
        let skillsFailedAttempts = Object.create(null);
        params.forEach(function(value, key) {
            switch (key) {
                case "name":
                    name = value;
                    break;
                case "finishedSkill":
                    finishedSkill = value;
                    break;
                default:
                    if (key.indexOf("failedAttempts-") === 0) {
                        skillsFailedAttempts[key.slice(15)] = parseInt(value);
                    } else {
                        result.push(new SkillState(key, parseInt(value), skillsFailedAttempts[key]));
                    }
            }
        });
        return new Profile(name, result, finishedSkill);
    }

    encode() {
        const params = new URLSearchParams();
        params.append("name", this.name);
        params.append("finishedSkill", this.finishedSkill);
        for (let skill of this.skills) {
            if (skill.currentLevel == 0) { continue; }
            if (skill.failedAttempts > 0) {
                params.append(`failedAttempts-${skill.id}`, skill.failedAttempts.toString());
            }
            params.append(skill.id, skill.currentLevel.toString());
        }
        return params.toString();
    }

    static loadFromLink() {
        const params = new URLSearchParams(location.search);
        return Profile.decode(atob(params.get("save") ?? ""));
    }

    get savedLink() {
        const relativeLink = `load.html?save=${btoa(this.encode())}`;
        return $(`<a href="${relativeLink}"></a`).prop("href");
    }

    /** Returns the `SkillState` for the given `id`, creating it if none exists yet. */
    skillState(id: string) {
        for (let skill of this.skills) {
            if (skill.id === id) { return skill; }
        }
        //I guess it doesn't exist yet
        const newState = new SkillState(id);
        this.skills.push(newState);
        return newState;
    }

    /** Returns true if and only if this profile's `name` has a legitimate-looking value */
    get hasName() {
        return this.name.trim() !== "";
    }

    get completionValue() {
        let finishedLevels = 0;
        let totalLevels = 0;

        for (let skill of Skill.all) {
            totalLevels += skill.levels.length;
            finishedLevels += this.skillState(skill.id).currentLevel;
        }

        return finishedLevels / totalLevels;
    }

    get completionDescription() {
        return `${Math.floor(this.completionValue * 100)}%`;
    }

    get completionDetails() {
        let completed: Array<string> = [];
        let partial: Array<string> = [];
        for (let skillState of this.skills) {
            let skill = Skill.forID(skillState.id);
            if (skill === undefined) { continue; }
            if (skill.levels.length <= skillState.currentLevel) {
                completed.push(`<span class="completed-skill">${skill.name}</span>`);
            } else if (skillState.currentLevel > 0) {
                partial.push(`<span class="partial-skill">${skill.name}</span>: ${skillState.currentLevel}/${skill.levels.length}`);
            }
        }

        let result = ``;
        if (completed.length > 0) {
            result += `<h3>Completed Skills</h3>
            <p class="skill-list">${completed.join(`, `)}</p>`;
        }
        if (partial.length > 0) {
            result += `<h3>Skills In Progress</h3>
            <p class="skill-list">${partial.join(`, `)}</p>`;
        }
        return result;
    }

    get isTrivial() {
        return this.completionValue === 0;
    }
    
    /*****************************/
    /* Static Properties/Methods */
    /*****************************/

    /** All loaded profiles. Do not mutate this array directly. */
    static all: Array<Profile>;
    private static _currentIndex: number;
    static onUpdate = function() {};

    static get currentIndex() { return this._currentIndex; }
    static set currentIndex(newValue) {
        this._currentIndex = newValue;
        this.update();
    }
    static get current() { return Profile.all[Profile.currentIndex]; }
    
    private static _recentlyDeleted: Profile | null;
    /** The most recently deleted profile, if it exists. */
    static get recentlyDeleted() { return this._recentlyDeleted; }

    static add(profile: Profile) {
        this.all.push(profile);
        this._currentIndex = Profile.all.length - 1;
        this.update();
    }

    static replaceAt(index: number, replacement: Profile) {
        this.all[index] = replacement;
        this.currentIndex = index;

        this.update();
    }

    static removeCurrent() {
        if (!Profile.current.isTrivial) {
            Profile._recentlyDeleted = Profile.current;
        }

        if (this.all.length === 1) { this.all.push(new Profile("")); }
        this.all.splice(this.currentIndex, 1);
        this.currentIndex = 0;

        this.update();
    }

    static reviveRecentlyDeleted() {
        if (Profile.recentlyDeleted === null) { return; }
        this.all.push(Profile.recentlyDeleted);
        Profile._recentlyDeleted = null;
        this._currentIndex = Profile.all.length - 1;
        this.update();
    }

    static each(action: (index: number, profile: Profile) => void) {
        for (let i = 0; i < this.all.length; i++) {
            action(i, this.all[i]);
        }
    }

    static loadAllFromStorage() {
        const profileCodes = localStorage.getItem("rhythmGame-allProfiles")?.split("\n").slice(0,-1) ?? [];
        Profile.all = profileCodes.map(x => Profile.decode(x));
        Profile._currentIndex = parseInt(localStorage.getItem("rhythmGame-currentProfileIndex") ?? "0");

        const deleted = Profile.decode(localStorage.getItem("rhythmGame-recentlyDeletedProfile") ?? "");
        Profile._recentlyDeleted = deleted.isTrivial ? null : deleted;

        if (Profile.all.length === 0) { Profile.all.push(new Profile()); }
        if (Profile._currentIndex >= Profile.all.length) { Profile._currentIndex = 0; }

        this.update();
    }

    private static saveAllToStorage() {
        let result = "";
        for (let profile of Profile.all) {
            result += profile.encode() + "\n";
        }
        localStorage.setItem("rhythmGame-allProfiles", result);
        localStorage.setItem("rhythmGame-currentProfileIndex", Profile.currentIndex.toString());
        localStorage.setItem("rhythmGame-recentlyDeletedProfile", Profile.recentlyDeleted?.encode() ?? "");
    }

    /**
     * Saves all state to local storage, and calls the `onUpdate` callback. Called automatically when modifying properties of `Profile`s and `SkillState`s.
     */
    static update() {
        this.saveAllToStorage();
        this.onUpdate();
    }

    static get allAreTrivial() {
        return Profile.all.reduce((a,b) => a + b.completionValue, 0) === 0;
    }
}

interface LevelConstructor {
    name: string;
    pageTitle?: string;
    description: string;
}

/**
 * Any kind of level in the game; subclasses can use different `page` values to have completely different gameplay.
 */
abstract class Level {
    readonly name: string;
    /** The name to use for the HTML page title (if different from `name`) */
    readonly pageTitle?: string;
    readonly description: string;
    /** The base name of the HTML page used to play this level */
    readonly page: string;
    readonly icon: string;

    /** The skill containing this level, set when it is added to a skill. */
    parentSkill!: Skill;
    /** The index of this level within the parent skill, set when it is added to a skill. */
    index!: number;

    protected constructor(name: string, page: string, icon: string, description: string, pageTitle?: string) {
        this.name = name;
        this.pageTitle = pageTitle;
        this.description = description;
        this.page = page;
        this.icon = icon;
    }

    /** Returns a pseudo(-not-very-)random number between 0 and `upperBound` (not including `upperBound`), which will always be the same for this level */
    stablePseudorandomIntegerTo(upperBound: number) {
        if (upperBound === 0) { return 0; }
        var hash = 0, i, chr;
        for (i = 0; i < this.name.length; i++) {
            chr   = this.name.charCodeAt(i);
            hash  = ((hash << 5) - hash) + chr;
            hash |= 0; // Convert to 32bit integer
        }
        return Math.abs(hash) % upperBound;
    }

    get pageURL() {
        return `${this.page}.html?skill=${this.parentSkill!.id}&level=${this.index!}`;
    }

    get isFinal() {
        return this.index === this.parentSkill.levels.length - 1;
    }

    /** Returns the level being displayed by the current page, or `undefined` if not on a level page */
    static get current() {
        const params = new URLSearchParams(location.search);
        const result = params.get("level");
        if (result === null) { return undefined; }
        const index = parseInt(result);
        if (index === undefined) { return undefined; }
        return Skill.current?.levels[index];
    }

    /** Sets up the current page as a level page, with appropriate title and exit button. Also loads all `Profile`s and shows the level splash. */
    static initializePage() {
        if (this.current === undefined) { assertionFailure(); }

        Profile.loadAllFromStorage();

        document.title = `${this.current.pageTitle ?? this.current.name} - Rhythm Game`;

        const exitButton = $(`<div style="position: fixed; left: 1em; top: 1em; z-position: 1000;" id="exitButton"></div>`);
        $(document.body).append(exitButton);
        exitButton.button({
            label: `Exit Level`,
            icons: { primary: "ui-icon-home" }
        }).on("click", function() {
            Level.exit();
        });

        const shouldShowFinalLevel = (Level.current!.index == Skill.current!.levels.length - 1) && (Level.current!.index == Profile.current.skillState(Skill.current!.id).currentLevel);
        const finalLevel = shouldShowFinalLevel ? `<div class="finalLevel"><span class="ui-icon ui-icon-key"></span>&nbsp;This level completes the &quot;${Skill.current!.name}&quot; skill!</span>` : ``;

        const splash = $(`
            <div id="splash" title="Level ${Level.current!.index+1}/${Skill.current!.levels.length} in &quot;${Skill.current!.name}&quot;">
                <h2>${Level.current!.index+1}. ${this.current.name} <span class="ui-icon ui-icon-${Level.current!.icon}"></span></h2>
                <p>${this.current.description}</p>
                ${finalLevel}
            </div>
        `);
        splash.dialog({
            modal: true,
            resizable: false,
            width: Math.min(vw(80), em(50)),
            buttons: [{
                text: "Let's Go!",
                icon: "ui-icon-check",
                click: function() {
                    $(this).dialog("close");
                }
            }],
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
            },
            open: function() {
                //Safari on iOS has a bizarre bug where the dialog button stays onscreen forever, so we'll replace it with one that works
                if (isMobileSafari()) {
                    $(".ui-dialog-buttonset .ui-button").remove();
                    $(".ui-dialog-buttonset").append("<div id='badButton'></div>");
                    $("#badButton").button({
                        label: "Let's Go!",
                        icons: "ui-icon-check", 
                    }).onButtonPush(() => $(this).dialog("close"));
                }
            }
        });
    }

    static showGradeSummary(content: string, passed: boolean, buttons: Array<DialogButton>, reset: () => void) {
        const summaryElement = `<div id="gradeSummary" title="Your Performance">
            ${content}
        </div>`;

        if (passed) {
            Level.pass();
            if (Skill.current!.isCompleted && Level.current!.isFinal) {
                 buttons.push({
                     text: "Next Skill!",
                     icon: "ui-icon-key",
                     click: Level.exit,
                     class: "nextSkillButton"
                 })
            } else {
                buttons.push({
                    text: "Next Level!",
                    icon: "ui-icon-star",
                    click: Level.goToNext
                });
            }
        } else {
            Level.fail();
            buttons.push({
                text: "Try Again",
                icon: "ui-icon-refresh",
                click: function() {
                    $(this).dialog("close");
                    reset();
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
            beforeClose: function() {
                $('html, body').animate({ scrollTop: 0 }, 600);
            }
        });
    
        if (passed) { Sound.fanfare.play(); }
    }

    /** If the current level is the last unlocked skill, advances the unlocked level of the current skill by one; call only from a level page (when it's complete). */
    static pass() {
        if (Skill.current === undefined) { assertionFailure(); }
        if (Profile.current.skillState(Skill.current.id).currentLevel === Level.current!.index) {
            Profile.current.skillState(Skill.current.id).currentLevel = Level.current!.index + 1;
            if (Skill.current.levels.length === Level.current!.index + 1) {
                Profile.current.finishedSkill = Skill.current.id;
            }
        }
    }

    /** If the current level is the last unlocked skill, advances the failure count for that skill by one; call only from a level page (when it's failed). */
    static fail() {
        if (Skill.current === undefined) { assertionFailure(); }
        if (Profile.current.skillState(Skill.current.id).currentLevel === Level.current!.index) {
            Profile.current.skillState(Skill.current.id).failedAttempts++;
            console.log(Profile.current.skillState(Skill.current.id).failedAttempts);
        }
    }

    /** If this is not the final level in the current skill, go to the next. Otherwise, return to the world. */
    static goToNext() {
        if (Level.current!.isFinal) {
            Level.exit();
        } else {
            location.href = Skill.current!.levels[Level.current!.index + 1].pageURL;
        }
    }

    /** Exits the current level page, returning to the world. */
    static exit() {
        if (Skill.current == undefined || Profile.current.finishedSkill !== "") {
            location.href = "./";
        } else {
            location.href = `./?skill=${Skill.current.id}`;
        }
    }
}

interface PieceLevelConstructor extends LevelConstructor {
    timeSignature: TimeSignature;
    tempo?: Tempo;
    knownCounts?: Array<Count>;
    backingLoop?: number;
}

/**
 * A normal level in the game; consists primarily of a piece of music to clap & count.
 */
abstract class PieceLevel extends Level {
    readonly tempo: Tempo;
    readonly knownCounts?: Array<Count>;
    abstract piece: Piece;

    constructor(data: PieceLevelConstructor, icon: string) {
        super(data.name, "piece", icon, data.description, data.pageTitle);

        this.tempo = data.tempo ?? 80;
        this.knownCounts = data.knownCounts;
    }

    static get current() { return Level.current as PieceLevel; }
    static get currentCounts() {
        return this.current.knownCounts ?? Skill.current?.knownCounts ?? Count.all;
    }
}

interface ComposedLevelConstructor extends PieceLevelConstructor {
    notes: Array<Note>;
}

/**
 * A composed level with a pre-set piece.
 */
class ComposedLevel extends PieceLevel {
    readonly piece: Piece;

    constructor(data: ComposedLevelConstructor) {
        super(data, "volume-on");
        this.piece = new Piece(data.timeSignature, data.notes, data.backingLoop);
    }

    static get current() { return Level.current as ComposedLevel; }
}

interface RandomLevelConstructor extends PieceLevelConstructor {
    bars: number;
    blocks: Array<Block>;
}

/**
 * A randomized level that regenerates `piece` every time it's read.
 */
class RandomLevel extends PieceLevel {
    readonly blocks: Array<Block>;
    readonly timeSignature: TimeSignature;
    readonly measures: number;
    readonly backingLoopIndex?: number;

    constructor(data: RandomLevelConstructor) {
        super(data, "shuffle");
        this.blocks = data.blocks;
        this.timeSignature = data.timeSignature;
        this.measures = data.bars;
        this.backingLoopIndex = data.backingLoop;
    }

    get piece() {
        return Piece.random(this.timeSignature, this.measures, this.blocks, this.backingLoopIndex);
    }

    static get current() { return Level.current as RandomLevel; }
}

interface TextLevelConstructor extends LevelConstructor {
    html: string;
    isEnd?: boolean;
}

/**
 * An explanatory level that is automatically won just by reading it.
 */
class TextLevel extends Level {
    readonly html: string;
    readonly isEnd: boolean;

    constructor(data: TextLevelConstructor) {
        super(data.name, "text", "comment", data.description, data.pageTitle);
        this.html = data.html;
        this.isEnd = data.isEnd ?? false;
    }

    static get current() { return Level.current as TextLevel; }
}

interface QuizLevelConstructor extends LevelConstructor {
    questions: Array<Question>;
}

/**
 * A level that displays a multiple-choice quiz.
 */
class QuizLevel extends Level {
    private _questions: Array<Question>;
    get questions(): Array<Question> {
        return this._questions;
    }

    constructor(data: QuizLevelConstructor) {
        super(data.name, "quiz", "help", data.description, data.pageTitle);
        this._questions = data.questions;
    }

    static get current() { return Level.current as QuizLevel; }

    shuffle() {
        for (let i = 0; i < this._questions.length; i++) {
            const j = Math.floor(Math.random() * this._questions.length);
            const temp = this._questions[i];
            this._questions[i] = this._questions[j];
            this._questions[j] = temp;
        }

        for (let question of this._questions) {
            question.shuffle();
        }
    }
}

interface AnswerConstructor {
    text: string;
    correct: boolean;
    explanation?: string;
}

interface QuestionConstructor {
    text: string;
    answers: Array<AnswerConstructor>;
}

function aFewOthers<T>(one: T, others: Array<T>) {
    let allOthers = others.filter(x => x !== one);
    let result: Array<T> = [];
    let resultCount = Math.min(3, allOthers.length);
    for (let i = 0; i < resultCount; i++) {
        const chosenIndex = Math.floor(Math.random() * allOthers.length);
        result.push(allOthers[chosenIndex]);
        allOthers.splice(chosenIndex, 1);
    }
    return result;
}

class Question {
    readonly text: string;
    private _answers: Array<Answer>;
    get answers(): Array<Answer> {
        return this._answers;
    }

    constructor(data: QuestionConstructor) {
        this.text = data.text;
        this._answers = data.answers.map(x => new Answer(x));
    }

    get correctAnswer() {
        return this.answers.filter(x => x.correct)[0];
    }

    shuffle() {
        for (let i = 0; i < this._answers.length; i++) {
            const j = Math.floor(Math.random() * this._answers.length);
            const temp = this._answers[i];
            this._answers[i] = this._answers[j];
            this._answers[j] = temp;
        }
    }

    static noteNames(...notes: Array<Note>): Array<Question> {
        function nameQuestion(note: Note) {
            let answers = aFewOthers(note, notes).map(x => new Answer({
                text: x.toString(),
                correct: false,
                explanation: `${x.capitalizedIndefiniteDescription} looks like this: ${x.inlineNotation}`
            }));
            answers.push(new Answer({
                text: note.toString(),
                correct: true
            }));

            return new Question({
                text: `What is ${note.inlineNotation} called?`,
                answers: answers
            });
        }

        function noteQuestion(note: Note) {
            let answers = aFewOthers(note, notes).map(x => new Answer({
                text: x.inlineNotation,
                correct: false,
                explanation: `${x.inlineNotation} is ${x.lowercaseIndefiniteDescription}.`
            }));
            answers.push(new Answer({
                text: note.inlineNotation,
                correct: true
            }));

            return new Question({
                text: `Which of these is ${note.lowercaseIndefiniteDescription}?`,
                answers: answers
            });
        }

        let result: Array<Question> = [];
        for (let note of notes) {
            result.push(nameQuestion(note));
            result.push(noteQuestion(note));
        }
        return result;
    }

    static noteLengths(timeSignature: TimeSignature, ...notes: Array<Note>): Array<Question> {
        function meterDescription(timeSignature: TimeSignature) {
            return (timeSignature.isCompound ? "compound " : "") + timeSignature.inlineNotation + " time";
        }

        function lengthQuestion(note: Note) {
            let uniqueNotes = [note];
            let existingLengths = [note.absoluteLength];

            for (let i = 0; i < notes.length; i++) {
                if (existingLengths.indexOf(notes[i].absoluteLength) === -1) {
                    uniqueNotes.push(notes[i]);
                    existingLengths.push(notes[i].absoluteLength);
                }
            }

            let answers = aFewOthers(note, uniqueNotes).map(x => new Answer({
                text: x.readableLength(timeSignature),
                correct: false,
                explanation: `${x.capitalizedIndefiniteDescription} (${x.inlineNotation}) is ${x.readableLength(timeSignature)} long in ${meterDescription(timeSignature)}.`
            }));
            answers.push(new Answer({
                text: `${note.readableLength(timeSignature)}`,
                correct: true
            }));

            return new Question({
                text: `How many beats long is ${note.lowercaseIndefiniteDescription} (${note.inlineNotation}) in ${meterDescription(timeSignature)}?`,
                answers: answers
            });
        }

        function noteQuestion(note: Note) {
            let choices = aFewOthers(note, notes);
            choices.push(note);

            let answers = choices.map(x => new Answer({
                text: `${x.lowercaseIndefiniteDescription} (${x.inlineNotation})`,
                correct: x.absoluteLength === note.absoluteLength,
                explanation: x.absoluteLength === note.absoluteLength ? undefined : `${x.capitalizedIndefiniteDescription} (${x.inlineNotation}) is ${x.readableLength(timeSignature)} long in ${meterDescription(timeSignature)}.`
            }));

            return new Question({
                text: `Which of these is ${note.readableLength(timeSignature)} long in ${meterDescription(timeSignature)}?`,
                answers: answers
            });
        }

        let result: Array<Question> = [];
        for (let note of notes) {
            result.push(lengthQuestion(note));
            result.push(noteQuestion(note));
        }
        return result;
    }

    static noteRelationshipSimple(smaller: Note, bigger: Note) {
        let answerValues = [bigger.relativeLength(smaller)];
        let possibleChoices: Array<number> = [];
        for (let i = 2; i <= bigger.relativeLength(smaller) * 2; i++) {
            if (i === bigger.relativeLength(smaller)) { continue; }
            possibleChoices.push(i);
        }

        while (answerValues.length < 4 && possibleChoices.length > 0) {
            const randomIndex = Math.floor(Math.random() * possibleChoices.length);
            answerValues.push(possibleChoices[randomIndex]);
            possibleChoices.splice(randomIndex, 1);
        }

        const answers = answerValues.map(x => new Answer({
            text: `${x}`,
            correct: x === bigger.relativeLength(smaller)
        }));

        return new Question({
            text: `How many ${smaller.description}s (${smaller.inlineNotation}) fit into a ${bigger.description} (${bigger.inlineNotation})?`,
            answers: answers
        })
    }

    static noteRelationship(smaller: Note, bigger: Note, others: Array<Note>) {
        let choices = [bigger];
        let remainingOthers = others.filter(x => x.absoluteLength !== bigger.absoluteLength);
        while (choices.length < 4 && remainingOthers.length > 0) {
            const randomIndex = Math.floor(Math.random() * remainingOthers.length);
            choices.push(remainingOthers[randomIndex]);
            remainingOthers.splice(randomIndex, 1);
        }

        const answers = choices.map(x => new Answer({
            text: `${x.relativeLength(smaller)}`,
            correct: x.relativeLength(smaller) === bigger.relativeLength(smaller),
            explanation: x.relativeLength(smaller) === bigger.relativeLength(smaller) ? undefined : `${x.relativeLength(smaller)} ${smaller.description}s add up to ${x.lowercaseIndefiniteDescription}`
        }));

        return new Question({
            text: `How many ${smaller.description}s (${smaller.inlineNotation}) fit into a ${bigger.description} (${bigger.inlineNotation})?`,
            answers: answers
        })
    }

    static counts(counts: Array<Count>) {
        const nonBeatCounts = counts.filter((x) => x.timing !== 0);

        function timingQuestion(count: Count) {
            let uniqueCounts = [count];
            let existingTimings = [count.timing];

            for (let i = 0; i < nonBeatCounts.length; i++) {
                if (existingTimings.indexOf(nonBeatCounts[i].timing) === -1) {
                    uniqueCounts.push(nonBeatCounts[i]);
                    existingTimings.push(nonBeatCounts[i].timing);
                }
            }

            let answers = aFewOthers(count, uniqueCounts).map(x => new Answer({
                text: x.capitalizedTimingString,
                correct: false,
                explanation: `&quot;${x.description}&quot; is ${x.timingString} the beat.`
            }));
            answers.push(new Answer({
                text: count.capitalizedTimingString,
                correct: true
            }));

            return new Question({
                text: `How far through the beat is &quot;${count.description}&quot;?`,
                answers: answers
            });
        }

        function countQuestion(count: Count) {
            let uniqueCounts = [count];
            let existingTimings = [count.timing];

            for (let i = 0; i < nonBeatCounts.length; i++) {
                if (existingTimings.indexOf(nonBeatCounts[i].timing) === -1) {
                    uniqueCounts.push(nonBeatCounts[i]);
                    existingTimings.push(nonBeatCounts[i].timing);
                }
            }

            let answers = aFewOthers(count, uniqueCounts).map(x => new Answer({
                text: `&quot;${x.description}&quot;`,
                correct: false,
                explanation: `&quot;${x.description}&quot; is ${x.timingString} the beat.`
            }));
            answers.push(new Answer({
                text: `&quot;${count.description}&quot;`,
                correct: true
            }));

            return new Question({
                text: `What count is ${count.timingString} the beat?`,
                answers: answers
            });
        }

        let result: Array<Question> = [];
        for (let count of nonBeatCounts) {
            result.push(timingQuestion(count));
            result.push(countQuestion(count));
        }
        return result;
    }
}

class Answer {
    readonly text: string;
    readonly correct: boolean;
    readonly explanation?: string;

    constructor(data: AnswerConstructor) {
        this.text = data.text;
        this.correct = data.correct;
        this.explanation = data.explanation;
    }
}

interface SkillConstructor {
    id: string,
    name: string,
    knownCounts: Array<Count>,
    levels: Array<Level>
}

/**
 * An ordered list of levels.
 */
class Skill {
    readonly id: string;
    readonly name: string;
    /** The counts that should be known by the player during this skill; these are used as a default for any `PieceLevel` with no `knownCounts` value. */
    readonly knownCounts: Array<Count>;
    readonly levels: Array<Level>;

    constructor(data: SkillConstructor) {
        this.id = data.id;
        this.name = data.name;
        this.knownCounts = data.knownCounts;
        this.levels = data.levels;
        for (let i = 0; i < this.levels.length; i++) {
            this.levels[i].parentSkill = this;
            this.levels[i].index = i;
        }
    }

    /** Returns true if and only if the skill represented by `id` has been completed by `Profile.current`. */
    get isCompleted() {
        const currentLevel = Profile.current.skillState(this.id).currentLevel;
        return currentLevel >= this.levels.length;
    }

    static _all: Array<Skill> = [];
    static get all(): Array<Skill> {
        if (this._all.length === 0) { this.loadAll(); }
        return this._all;
    }

    static forID(id: string) {
        const matches = this.all.filter(x => x.id === id);
        return matches.length > 0 ? matches[0] : undefined;
    }

    /** Returns the skill the current level page is inside, or `undefined` if not on a level page */
    static get current() {
        const params = new URLSearchParams(location.search);
        const skillID = params.get("skill");
        if (skillID === null) { return undefined; }
        return Skill.forID(skillID);
    }

    private static loadAll() {
        function newSkill(newData: SkillConstructor) {
            Skill._all.push(new Skill(newData));
        }

        const tapKeyExplanation = isMobile() ? `` : ` Try using the spacebar on your keyboard to tap.`;
        const clapExplanation = isMobile() ? `Use one hand for the &quot;tap&quot; button and the other for the &quot;clap&quot; button.` : `Use the spacebar to tap and the &quot;${returnKeyName()}&quot; key to clap.`;

        const w = Note.whole;
        const dw = Note.whole.dotted;
        const W = Rest.whole;
        const DW = Rest.whole.dotted;
        const h = Note.half;
        const dh = Note.half.dotted;
        const H = Rest.half;
        const DH = Rest.half.dotted;
        const q = Note.quarter;
        const dq = Note.quarter.dotted;
        const Q = Rest.quarter;
        const DQ = Rest.quarter.dotted;
        const e = Note.eighth;
        const de = Note.eighth.dotted;
        const E = Rest.eighth;
        const DE = Rest.eighth.dotted;
        const s = Note.sixteenth;
        const S = Rest.sixteenth;

        newSkill({
            id: "welcome",
            name: "Welcome!",
            knownCounts: [Count.beat],
            levels: [
                new ComposedLevel({
                    name: "First Steps",
                    description: "Just hit that &quot;<strong>tap</strong>&quot; button on every beat. Should be easy enough, right? Tap, tap, tap, tap...<br/><br/>Oh, there is <em>one</em> catch&mdash;wireless headphones make it impossible.",
                    backingLoop: 0,
                    timeSignature: TimeSignature.fourFour,
                    notes: [
                        W,
                        W,
                        W,
                        W
                    ]
                }),
                new ComposedLevel({
                    name: "Out Loud",
                    description: `Good so far&mdash;let's do it again! Keep <strong>tapping</strong>, but also <strong>speak the numbers</strong> out loud this time.${tapKeyExplanation}<br/>
                    <br/>
                    Oh, by the way&mdash;these are called &quot;whole rests&quot; (${Rest.whole.inlineNotation}).`,
                    timeSignature: TimeSignature.fourFour,
                    notes: [
                        W,
                        W,
                        W,
                        W
                    ]
                }),
                new ComposedLevel({
                    name: "Whole Notes",
                    description: `Whole <strong>notes</strong> (${Note.whole.inlineNotation}) are just like whole rests (${Rest.whole.inlineNotation}): four beats long. ...Except they're <em>notes</em>. Which means you <em>clap</em> when they start.<br/>
                    <br/>
                    (Yes, you still need to tap, too! ${clapExplanation} That way you can do them at the same time!)`,
                    timeSignature: TimeSignature.fourFour,
                    notes: [
                        W,
                        w,
                        W,
                        w,
                        W,
                        w,
                        W,
                        w
                    ]
                }),
                new RandomLevel({
                    name: "Changing It Up",
                    tempo: 100,
                    description: `Let's mix it up. And speed it up! And finish this first skill up!!<br/>
                    <br/>
                    (And keep counting out loud!)`,
                    timeSignature: TimeSignature.fourFour,
                    bars: 8,
                    blocks: [
                        Block.required([w]),
                        Block.required([W])
                    ]
                })
            ]
        });

        newSkill({
            id: "halfNotes",
            name: "Hello, Half Notes",
            knownCounts: [Count.beat],
            levels: [
                new ComposedLevel({
                    name: "Half Rests",
                    description: `They're two beats long, and they look like upside-down whole rests.<br/><br/>...<em>I</em> like to think that <em><strong>wh</strong>ole</em> rests (${Rest.whole.inlineNotation}) look like <em><strong>h</strong>oles</em> that you could fall into, but <em>hal<strong>f</strong></em> rests (${Rest.half.inlineNotation}) look like <em>ha<strong>t</strong>s</em>. But you probably shouldn't listen to me...`,
                    tempo: 100,
                    timeSignature: TimeSignature.fourFour,
                    notes: [
                        H, H,
                        W,
                        H, H,
                        w,
                        H, H,
                        W,
                        H, H,
                        w
                    ]
                }),
                new ComposedLevel({
                    name: "Half Notes",
                    description: `They're two beats long, and they look like whole notes, only with stems (${Note.half.inlineNotation}). Maybe they're flowers! Delicious, two-beat-long flowers...`,
                    tempo: 100,
                    timeSignature: TimeSignature.fourFour,
                    notes: [
                        h, h,
                        w,
                        h, h,
                        h, h,
                        h, h,
                        w,
                        h, h,
                        w
                    ]
                }),
                new ComposedLevel({
                    name: "On & Off",
                    description: "Are you still counting the numbers out loud? Hmm?",
                    timeSignature: TimeSignature.fourFour,
                    notes: [
                        h, H,
                        h, H,
                        h, H,
                        W,
                        h, H,
                        h, H,
                        h, H,
                        w,
                    ]
                }),
                new ComposedLevel({
                    name: "Off & On",
                    description: "Hmm? Loud out numbers the counting still you are?",
                    timeSignature: TimeSignature.fourFour,
                    notes: [
                        w,
                        H, h,
                        H, h,
                        H, h,
                        W,
                        H, h,
                        H, h,
                        H, h,
                    ]
                }),
                new QuizLevel({
                    name: "You Half to Remember",
                    description: `The hardest thing is telling those hats apart from those holes...`,
                    questions: Question.noteNames(w, W, h, H).concat([
                        Question.noteRelationshipSimple(h, w),
                        Question.noteRelationshipSimple(H, W)
                    ])
                }),
                new RandomLevel({
                    name: "Half Random",
                    description: "On & off & off & on...",
                    timeSignature: TimeSignature.fourFour,
                    bars: 8,
                    blocks: [
                        Block.required([w]),
                        Block.required([W]),
                        Block.required([h]),
                        Block.required([H])
                    ]
                })
            ]
        });

        newSkill({
            id: "quarterNotes",
            name: "Time for Quarters",
            knownCounts: [Count.beat],
            levels: [
                new ComposedLevel({
                    name: "Synchronized",
                    description: `Quarter notes look like half notes that somebody filled in with a sharpie (${Note.quarter.inlineNotation}), and are only one beat long. Or I guess they might have used a black crayon. Or perhaps some sort of paint&mdash;what do you think?`,
                    timeSignature: TimeSignature.fourFour,
                    notes: [
                        q, q, q, q,
                        q, q, q, q,
                        q, q, q, q,
                        h, h,
                        q, q, q, q,
                        q, q, q, q,
                        q, q, q, q,
                        h, H
                    ]
                }),
                new ComposedLevel({
                    name: "Ignore the Four",
                    description: `Quarter rests are one beat long and they look like... well... I'm not even sure. Weird little squiggly things (${Rest.quarter.inlineNotation})? Yes, that.<br/>
                    <br/>
                    Don't forget to count out loud every time you tap! Even if there's a rest, or you're partway through a note, if you're tapping, you're counting.<br/>
                    It's how the beats know you care about them. Be nice.`,
                    timeSignature: TimeSignature.fourFour,
                    notes: [
                        q, q, q, Q,
                        q, q, h,
                        q, q, q, Q,
                        w,
                        q, q, q, Q,
                        q, q, h,
                        q, q, q, Q,
                        q, Q, Q, Q
                    ]
                }),
                new ComposedLevel({
                    name: "Boo, Two",
                    description: `Let's try another! Don't clap in those quarter rests (${Rest.quarter.inlineNotation}), or they'll be sad. You don't want sad, weird little squiggly things, do you? <em>No.</em> Of course you don't.`,
                    timeSignature: TimeSignature.fourFour,
                    notes: [
                        q, Q, q, q,
                        h, q, q,
                        q, Q, q, q,
                        w,
                        q, Q, q, q,
                        h, q, q,
                        q, Q, q, q,
                        q, Q, H
                    ]
                }),
                new ComposedLevel({
                    name: "Free the Three",
                    description: "Did you enjoy that? No? Well, you won't like this either!",
                    timeSignature: TimeSignature.fourFour,
                    notes: [
                        q, q, Q, q,
                        q, q, Q, q,
                        q, h, q,
                        q, h, q,
                        q, q, Q, q,
                        q, q, Q, q,
                        q, h, q,
                        w
                    ]
                }),
                new ComposedLevel({
                    name: "Fun Without One",
                    description: "By the way, what makes music on your head?<br/><br/>A headband! AhAhaHAahaha... get it? Because... <em>band</em>... and... fine. Just do the thing.",
                    timeSignature: TimeSignature.fourFour,
                    notes: [
                        Q, q, q, q,
                        Q, q, q, q,
                        Q, q, q, q,
                        Q, q, h,
                        Q, q, q, q,
                        Q, q, q, q,
                        Q, q, q, q,
                        h, Q, Q
                    ]
                }),
                new QuizLevel({
                    name: "Memory 1",
                    description: "Did I hear you say, &quot;Gee, I sure would love to have to remember every note and rest I've learned so far!&quot;? I'm pretty sure I did.",
                    questions: Question.noteNames(w, W, h, H, q, Q)
                }),
                new RandomLevel({
                    name: "All Together Now",
                    description: `So you know them all&mdash;excellent. But can you <em>clap</em> them all!?<br/>
                    And <em>tap</em> them all?<br/>
                    And <em>count</em> them all!?<br/>
                    <br/>
                    Let's find out.`,
                    timeSignature: TimeSignature.fourFour,
                    bars: 8,
                    blocks: [
                        Block.required([w]),
                        Block.required([W]),
                        Block.required([h]),
                        Block.required([H]),
                        Block.required([q, Q]),
                        Block.required([Q, q]),
                        Block.required([q, q])
                    ]
                }),
                new QuizLevel({
                    name: "Memory 2",
                    description: `So you know them all <em>and</em> you can clap them all! But can you... remember all their <em>lengths</em>!?<br/>
                    And can you bake a delicious apple pie!?<br/>
                    <br/>
                    That last part isn't relevant to the game; I'm just curious.`,
                    questions: Question.noteLengths(TimeSignature.fourFour, w, W, h, H, q, Q).concat([
                        Question.noteRelationshipSimple(q, w),
                        Question.noteRelationshipSimple(q, h),
                        Question.noteRelationshipSimple(Q, W),
                        Question.noteRelationshipSimple(Q, H)
                    ])
                }),
                new RandomLevel({
                    name: "100 bpm",
                    description: `Can you keep up?<br/><br/>...'Cause <em>I</em> can. Just sayin&apos;. I'm great at this one. Like... I'm so confident that I basically <strong>YELL</strong> every single count.<br/>
                    <br/>
                    My neighbors love it.`,
                    timeSignature: TimeSignature.fourFour,
                    bars: 8,
                    tempo: 100,
                    blocks: [
                        Block.required([w]),
                        Block.required([W]),
                        Block.required([h]),
                        Block.required([H]),
                        Block.required([q, Q]),
                        Block.required([Q, q]),
                        Block.required([q, q])
                    ]
                })
            ]
        });

        newSkill({
            id: "topNumber",
            name: "The Top Number",
            knownCounts: [Count.beat],
            levels: [
                new ComposedLevel({
                    name: "Two On Top",
                    description: "See those numbers at the beginning of every piece? They're called a &quot;time signature&quot;&mdash;and the top number sets how many beats are in each measure. So... if we change it to two...<br/><br/>Also, the top number's name is Reginald Numberpants. He told me so. He also said I should tell you not to say &quot;three&quot; or &quot;four&quot; at any point during this one.",
                    timeSignature: TimeSignature.twoFour,
                    notes: [
                        h,
                        h,
                        q, q,
                        q, q,
                        h,
                        h,
                        h,
                        H
                    ]
                }),
                new ComposedLevel({
                    name: "Two Again",
                    description: `You realize that if you say &quot;three&quot; or &quot;four&quot; in here you're going to make Reginald <em>very</em> angry, right? Because there's a two on top of the time signature, there are only two beats in each measure.<br/>
                    <br/>
                    And you also realize that &quot;counting <em>in your head</em>&quot; is <em>cheating</em>, right? If you're not speaking out loud, you're gonna get stuck later!`,
                    timeSignature: TimeSignature.twoFour,
                    notes: [
                        q, q,
                        h,
                        q, Q,
                        h,
                        q, q,
                        h,
                        Q, q,
                        h
                    ]
                }),
                new ComposedLevel({
                    name: "Three On Top",
                    description: "Want three beats per measure? Set that top number to three! Make sure you're counting these numbers <em>out loud</em>&mdash;like, with your vocal cords. Making noises and whatnot. ...But not the noise &quot;four&quot;.",
                    timeSignature: TimeSignature.threeFour,
                    notes: [
                        q, q, q,
                        q, q, q,
                        q, q, q,
                        q, Q, Q,
                        q, q, q,
                        q, q, q,
                        q, q, q,
                        q, Q, Q
                    ]
                }),
                new ComposedLevel({
                    name: "Three Again",
                    description: "Different time signatures feel different from one another, even if the notes inside each measure are old friends. Can you sense how beat one of every measure feels more important than beats two and three?<br/><br/>It thinks it's better than everyone else.<br/>The other notes are mad at it.",
                    timeSignature: TimeSignature.threeFour,
                    notes: [
                        q, Q, q,
                        q, Q, q,
                        q, Q, q,
                        h, Q,
                        q, q, q,
                        q, H,
                        q, Q, q,
                        h, Q
                    ]
                }),
                new ComposedLevel({
                    name: "Five On Top",
                    description: "Are you wondering what the bottom number does yet? Well...<br/><br/>...too bad! That's a secret for now.<br/>Set the top number to five!",
                    timeSignature: TimeSignature.fiveFour,
                    notes: [
                        q, q, q, q, q,
                        q, q, q, h,
                        q, q, q, q, q,
                        q, Q, Q, h
                    ]
                }),
                new ComposedLevel({
                    name: "Five Again",
                    description: "Make sure you're counting all the way to &quot;five&quot; every measure! You know, 5. Like the number of fingers on your hand. Probably.",
                    timeSignature: TimeSignature.fiveFour,
                    notes: [
                        q, Q, Q, q, q,
                        q, Q, Q, h,
                        q, q, q, q, q,
                        q, Q, q, h
                    ]
                }),
                new ComposedLevel({
                    name: "Six On Top",
                    description: "Can we put <em>any</em> number in the top of a time signature? Let's try <strong>13&#960;<sup>2</sup></strong>.<br/><br/>...Just kidding. How about <strong>6</strong>?",
                    timeSignature: new TimeSignature(6, q),
                    notes: [
                        q, H, q, H,
                        q, q, q, q, H,
                        q, q, q, q, q, q,
                        q, Q, q, q, H
                    ]
                }),
                new ComposedLevel({
                    name: "Six Again",
                    description: "Which beats feel strongest in this time signature?<br/><br/>You just <em>know</em> <strong>1</strong> is going to be one of them. Look at him, sitting there at the beginning of the measure. So smug.",
                    timeSignature: new TimeSignature(6, q),
                    notes: [
                        h, q, h, q,
                        h, q, q, H,
                        h, q, h, q,
                        q, q, q, q, H
                    ]
                }),
                new ComposedLevel({
                    name: "Now This is Just Silly",
                    description: "...I'm... I'm sorry about this...<br/><br/>Although it's kinda fun to speak.",
                    timeSignature: new TimeSignature(1, q),
                    notes: [
                        q,
                        q,
                        q,
                        q,
                        q, 
                        q,
                        q,
                        Q,
                        q,
                        q,
                        q,
                        q,
                        q,
                        q,
                        q,
                        Q
                    ]
                })
            ]
        });

        newSkill({
            id: "quarterNoteChallenge",
            name: "Challenge: Quarter Notes",
            knownCounts: [Count.beat],
            levels: [
                new RandomLevel({
                    name: "Challenge in Two",
                    description: "What do you get when you drop a piano down a mineshaft?<br/><br/>A flat minor.",
                    timeSignature: TimeSignature.twoFour,
                    bars: 16,
                    tempo: 80,
                    blocks: [
                        Block.required([h]),
                        Block.required([H]),
                        Block.required([q]),
                        Block.required([Q])
                    ]
                }),
                new RandomLevel({
                    name: "Challenge in Three",
                    description: "What do you get when you drop a piano on an army base?<br/><br/>A flat major.",
                    timeSignature: TimeSignature.threeFour,
                    bars: 16,
                    tempo: 100,
                    blocks: [
                        Block.required([h]),
                        Block.required([H]),
                        Block.required([q]),
                        Block.required([Q])
                    ]
                }),
                new RandomLevel({
                    name: "Challenge in Five",
                    description: "Why couldn't the orchestra find their composer?<br/><br/>He was Haydn.",
                    timeSignature: TimeSignature.fiveFour,
                    bars: 16,
                    tempo: 100,
                    blocks: [
                        Block.required([w, q]),
                        Block.required([W, q]),
                        Block.required([h]),
                        Block.required([H]),
                        Block.required([q, q]),
                        Block.required([q, Q]),
                        Block.required([Q, q]),
                        Block.required([q, q, q]),
                        Block.required([q, Q, q]),
                        Block.required([Q, q, q]),
                        Block.required([q, q, Q]),
                        Block.required([h, q]),
                        Block.required([q, h])
                    ]
                }),
                new RandomLevel({
                    name: "Challenge in Six",
                    description: "What genre of music frightens balloons?<br/><br/>Pop.",
                    timeSignature: new TimeSignature(6, q),
                    bars: 16,
                    tempo: 120,
                    blocks: [
                        Block.required([w]),
                        Block.required([W]),
                        Block.required([h]),
                        Block.required([H]),
                        Block.required([q, q]),
                        Block.required([Q, q]),
                        Block.required([q, Q]),
                        Block.required([q, h, q])
                    ]
                }),
                new RandomLevel({
                    name: "Challenge in Seven",
                    description: "What's Beethoven doing now?<br/><br/><em>De-</em>composing.",
                    timeSignature: new TimeSignature(7, q),
                    bars: 16,
                    tempo: 120,
                    blocks: [
                        Block.required([w]),
                        Block.required([W]),
                        Block.required([q, q, Q, q]),
                        Block.required([h, q, q]),
                        Block.required([q, q, h]),
                        Block.required([Q, q, h]),
                        Block.required([Q, q, q, q]),
                        Block.required([h, q]),
                        Block.required([q, h]),
                        Block.required([q, q, q]),
                        Block.required([Q, q, q]),
                        Block.required([H, q])
                    ]
                })
            ]
        });

        newSkill({
            id: "eighthNotes",
            name: "Friendly Eighth Notes",
            knownCounts: Count.allSimpleBasic,
            levels: [
                new ComposedLevel({
                    name: "Friendly Eighth Notes",
                    description: `Eighth notes (${Note.eighth.inlineNotation}) look like a quarter notes (${Note.quarter.inlineNotation}), but with flags coming off of &apos;em, or beams connecting them. They're only <strong>half</strong> a beat long. That means two of them fit on every beat.<br/>
                    <br/>
                    Oh... you'll need to <strong>clap</strong> halfway <strong>between</strong> two beats sometimes, now. When you do, say &quot;and&quot; (write &quot;+&quot;).<br/>
                    This is the first time we'll clap <em>between</em> taps&mdash;fun! We've tapped without clapping before, but this is the first time we've ever <em>clapped</em> without <em>tapping</em>. (Good; I think those claps need to become more independent, anyway!)`,
                    timeSignature: TimeSignature.fourFour,
                    tempo: 60,
                    notes: [
                        e, e, e, e, e, e, e, e,
                        q, q, q, q, 
                        e, e, e, e, e, e, e, e,
                        q, q, q, q
                    ]
                }),
                new ComposedLevel({
                    name: "Split One, Two",
                    description: `Remember, of course you'll <em>clap</em> on every note&mdash;but for your <em>taps</em> you only tap on the <em>beats</em> (the numbers) and not on the &quot;and&quot;s.<br/>
                    <br/>
                    By the way, how are these pieces I'm writing for you? Are they any good? I can't read music, so I wouldn't know.`,
                    timeSignature: TimeSignature.fourFour,
                    tempo: 60,
                    notes: [
                        e, e, q, q, q,
                        e, e, q, q, q,
                        e, e, q, q, q,
                        w,
                        q, e, e, q, q,
                        q, e, e, q, q,
                        q, e, e, q, q,
                        w
                    ]
                }),
                new ComposedLevel({
                    name: "Split Three, Four",
                    description: "Okay, I lied. I can totally read music. This one goes like doot doo dooooo doot doodooooooo, right?<br/><br/>Yeah, it totally does. Nailed it.",
                    timeSignature: TimeSignature.fourFour,
                    tempo: 60,
                    notes: [
                        q, q, e, e, q,
                        q, q, e, e, q,
                        q, q, e, e, q,
                        w,
                        q, q, q, e, e,
                        q, q, q, e, e,
                        q, q, q, e, e,
                        w
                    ]
                }),
                new ComposedLevel({
                    name: "Four in a Row",
                    description: `Have you noticed eighth notes (${Note.eighth.inlineNotation}) are exactly twice as fast as quarter notes (${Note.quarter.inlineNotation})? No? Shame on you. These poor eighth notes, crawling all over the page for you, and you're neglecting their little feelings. Think about their lengths!<br/>
                    <br/>
                    Also, make sure you're counting them out loud! Some of them are on numbers, and others are on &quot;and&quot;&mdash;but we <em>speak</em> for all of them!`,
                    timeSignature: TimeSignature.fourFour,
                    tempo: 60,
                    notes: [
                        e, e, e, e, q, q,
                        e, e, e, e, q, q,
                        e, e, e, e, q, q,
                        q, Q, q, Q,
                        q, q, e, e, e, e,
                        q, q, e, e, e, e,
                        q, q, e, e, e, e,
                        q, Q, H
                    ]
                }),
                new ComposedLevel({
                    name: "Unexpected",
                    description: "...<br/><br/>Meow.",
                    timeSignature: TimeSignature.fourFour,
                    tempo: 60,
                    notes: [
                        q, e, e, e, e, q,
                        q, e, e, e, e, q,
                        q, e, e, e, e, q,
                        q, Q, H,
                        e, e, q, q, e, e,
                        e, e, q, q, e, e,
                        e, e, q, q, e, e,
                        w
                    ]
                }),
                new ComposedLevel({
                    name: "No Extra Ands",
                    description: `Be on the lookout for quarter notes (${Note.quarter.inlineNotation})! They're hiding in there, amongst the eighths (${Note.eighth.inlineNotation}).<br/><br/>Quarter notes are known to be sneaky.<br/>
                    <br/>
                    You know what <em>else</em> is sneaky? &quot;Counting in your head&quot;. Make sure you're making audible noises, or you're gonna get stuck soon. (Preferably count-like noises, not just like... mooing or something.)`,
                    timeSignature: TimeSignature.fourFour,
                    tempo: 60,
                    notes: [
                        q, e, e, e, e, e, e,
                        q, e, e, e, e, e, e,
                        e, e, q, e, e, e, e,
                        e, e, q, e, e, e, e,
                        e, e, e, e, q, e, e,
                        e, e, e, e, q, e, e,
                        e, e, e, e, e, e, q,
                        e, e, e, e, e, e, q
                    ]
                }),
                new RandomLevel({
                    name: "More in the Mix",
                    description: "Are you ready for this?<br/>Because... you have to be.<br/><br/>There's really nothing I can do about it if you aren't.",
                    timeSignature: TimeSignature.fourFour,
                    tempo: 60,
                    bars: 8,
                    blocks: [
                        Block.required([h]),
                        Block.required([H], [0,2]),
                        Block.required([q]),
                        Block.required([Q, q]),
                        Block.required([e, e, e, e]),
                        Block.required([e, e, q]),
                        Block.required([e, e, h])
                    ]
                })
            ]
        });

        newSkill({
            id: "eighthRests",
            name: "Lonely Eighth Notes",
            knownCounts: Count.allSimpleBasic,
            levels: [
                new ComposedLevel({
                    name: "Eighth Rests",
                    description: `Eighth rests look like... a really fancy seven, I guess (${Rest.eighth.inlineNotation}). I don't know&mdash;look, the point is they're half a beat long, so one beat can fit two eighth rests.<br/><br/>Do you remember when to count &quot;and&quot; (+)? When you're <em>clapping</em> halfway between beats&mdash;in other words, <strong>not now!</strong> Numbers only!`,
                    timeSignature: TimeSignature.fourFour,
                    tempo: 60,
                    notes: [
                        Q, Q, Q, Q,
                        E, E, E, E, E, E, E, E,
                        Q, Q, Q, Q,
                        E, E, E, E, E, E, E, E
                    ]
                }),
                new ComposedLevel({
                    name: "Lonely Eighth Notes",
                    description: `When they're all alone, eighth notes' beams fall down and become flags. (${Note.eighth.inlineNotation})<br/>Poor li&apos;l lonely dudes.<br/>But they're still eighth notes. So they're still half a beat long. And you still shouldn't count &quot;and&quot; (+) out loud unless you're clapping on it.`,
                    timeSignature: TimeSignature.fourFour,
                    tempo: 60,
                    notes: [
                        q, q, q, q,
                        e, E, e, E, e, E, e, E,
                        q, q, q, q,
                        e, E, e, E, e, e, e, e,
                        q, q, q, q,
                        e, E, e, E, e, E, e, E,
                        q, q, q, q,
                        e, E, e, E, h
                    ]
                }),
                new ComposedLevel({
                    name: "Extra And",
                    description: `Try to see the lonely eighth note as having an eighth rest friend (${Note.eighth.inlineNotation}${Rest.eighth.inlineNotation})&mdash;they come in a pair! Not only does this help you group the music into one-beat-long chunks, it also makes the lonely eighth notes less lonely.<br/>
                    And remember&mdash;you should only speak if you're either clapping or tapping. Not if you're rapping. Or zapping. Or napping.<br/><br/>
                    Especially napping.<br/><br/>
                    Or mapping. (I didn't even know you were into cartography!)`,
                    timeSignature: TimeSignature.fourFour,
                    tempo: 60,
                    notes: [
                        e, e, q, e, e, q,
                        e, e, e, E, e, e, e, E,
                        e, e, q, e, e, q,
                        e, E, Q, H,
                        e, e, e, E, e, e, e, E,
                        e, e, q, e, e, q,
                        e, e, e, E, e, e, e, E,
                        H, Q, e, E
                    ]
                }),
                new ComposedLevel({
                    name: "And Not Here, Either",
                    description: "We <em>always</em> speak the numbers, but we only say &quot;and&quot; if a note starts there.<br/><br/>I have a great trick to help you remember this: think of the numbers as... something that you always speak. And the &quot;and&quot;s are like... something you only say if a note starts there.<br/><br/>Well, I tried.",
                    timeSignature: TimeSignature.fourFour,
                    tempo: 60,
                    notes: [
                        q, e, e, q, e, e,
                        e, E, e, e, e, E, e, e,
                        q, e, e, q, e, e,
                        e, E, Q, H,
                        e, E, e, e, e, E, e, e,
                        q, e, e, q, e, e,
                        e, E, e, e, e, E, e, e,
                        H, Q, e, E
                    ]
                }),
                new ComposedLevel({
                    name: "Surprise!",
                    description: "Beware the rests...<br/><br/>I mean, just don't clap in them. They're not going to stab you or anything.<br/><br/>Well, <em>that</em> one might.",
                    timeSignature: TimeSignature.fourFour,
                    tempo: 60,
                    notes: [
                        e, e, e, e, e, e, Q,
                        e, e, e, e, H,
                        e, e, Q, e, e, Q,
                        Q, e, e, e, e, Q
                    ]
                }),
                new ComposedLevel({
                    name: "Odd Rests",
                    description: `Now our lonely eighth note/eighth rest pairs are <em>backwards</em> (${Rest.eighth.inlineNotation}${Note.eighth.inlineNotation})&mdash;so the rest is on the beat, and gets counted out loud this time.<br/>
                    Shouting the number and giving an extra-confident tap on those rest-y beats may help with this one. Or it may just make you look cool. Either way, you should probably go for it.`,
                    timeSignature: TimeSignature.fourFour,
                    tempo: 60,
                    notes: [
                        E, e, e, e, E, e, e, e,
                        E, e, e, e, h,
                        E, e, e, e, E, e, e, e,
                        E, e, e, e, q, q
                    ]
                }),
                new ComposedLevel({
                    name: "Even More",
                    description: `Something something even numbered beats mumble.<br/>
                    I'm tired today; you're on your own.<br/><br/>
                    Just like those lonely eighth notes.<br/>
                    Except they're not alone&mdash;they have their eighth rest friends! Try to see them in pairs: ${Rest.eighth.inlineNotation}${Note.eighth.inlineNotation}!<br/>
                    <br/>
                    ...Huh, I guess I gave you advice after all.`,
                    timeSignature: TimeSignature.fourFour,
                    tempo: 60,
                    notes: [
                        e, e, E, e, e, e, E, e,
                        e, e, E, e, q, Q,
                        e, e, E, e, e, e, E, e,
                        e, e, E, e, e, E, Q
                    ]
                }),
                new QuizLevel({
                    name: "Check Up",
                    description: `You're doing pretty well, here, but do you <em>understand</em> what you're doing?<br/>
                    <br/>
                    I guess we'll find out shortly!`,
                    questions: Question.noteNames(q, h, e, E).concat(Question.noteLengths(TimeSignature.fourFour, e, E, h, Q)).concat([
                        Question.noteRelationship(e, q, [h, w]),
                        Question.noteRelationship(e, h, [q, w])
                    ])
                }),
                new ComposedLevel({
                    name: "Offbeats",
                    description: `Keep that beat steady and bounce your &quot;and&quot;s off it.<br/><br/>
                    You know, some people call <em>me</em> &quot;off-beat&quot;. ...I'm not sure what they mean.<br/>
                    Anyway, <strong>ONE AND TWO AND THREE AND FOUR AND!</strong>`,
                    timeSignature: TimeSignature.fourFour,
                    tempo: 60,
                    notes: [
                        E, e, E, e, E, e, E, e,
                        H, q, q,
                        E, e, E, e, E, e, E, e,
                        H, h,
                        E, e, E, e, E, e, E, e,
                        E, e, E, e, E, e, E, e,
                        E, e, E, e, E, e, E, e,
                        H, h
                    ]
                }),
                new ComposedLevel({
                    name: "Dotted Quarters Without the Dots",
                    description: `Don't understand the name? You will later...<br/><br/>I mean, I hope you will. I don't know. Maybe you won't.<br/>
                    <br/>
                    Anyway, our pairs are all mixed together now! First, there's one of these: ${Note.eighth.inlineNotation}${Rest.eighth.inlineNotation} and you're all like, &quot;<strong>ONE!</strong>&quot;<br/>
                    Then, there's one of these: ${Rest.eighth.inlineNotation}${Note.eighth.inlineNotation} and you're all like, &quot;two <strong>AND</strong>!&quot;`,
                    timeSignature: TimeSignature.fourFour,
                    tempo: 60,
                    notes: [
                        e, E, E, e, h,
                        e, E, E, e, h,
                        e, E, E, e, e, E, E, e,
                        h, H,
                        h, e, E, E, e,
                        h, e, E, E, e,
                        e, E, E, e, e, E, E, e,
                        e, E, Q, Q, e, E
                    ]
                }),
                new ComposedLevel({
                    name: "Almost There...",
                    description: "This one's tough, but you're almost there... eh, never mind, just give up now.<br/><br/>Still here? Good... goooooooood... My plan is coming to fruition...",
                    timeSignature: TimeSignature.fourFour,
                    tempo: 60,
                    notes: [
                        E, e, q, E, e, q,
                        E, e, e, E, E, e, e, E,
                        E, e, q, E, e, q,
                        E, e, e, e, h,
                        E, e, e, E, E, e, e, E,
                        E, e, q, E, e, q,
                        E, e, e, E, E, e, e, E,
                        e, E, Q, H
                    ]
                }),
                new RandomLevel({
                    name: "Still More in the Mix",
                    description: `It's the eighth-noteiest!&trade;<br/>
                    <br/>
                    You can do this&mdash;keep up the good work, and search for those two different kinds of pairs:<br/>
                    This: ${Note.eighth.inlineNotation}${Rest.eighth.inlineNotation} just sits there on the beat. It's basically just like a quarter note (${Note.quarter.inlineNotation})!<br/>
                    But, this: ${Rest.eighth.inlineNotation}${Note.eighth.inlineNotation} is more complicated&mdash;first a rest on the beat (tap, don't clap), then a note on the &quot;and&quot; (clap, don't tap)!`,
                    timeSignature: TimeSignature.fourFour,
                    tempo: 60,
                    bars: 8,
                    blocks: [
                        Block.required([h]),
                        Block.required([H], [0,2]),
                        Block.required([q]),
                        Block.required([Q]),
                        Block.required([e, e]),
                        Block.required([e, e]),
                        Block.required([e, E]),
                        Block.required([E, e]),
                        new Block([h]),
                        new Block([h]),
                        new Block([q]),
                        new Block([q]),
                        new Block([q])
                    ]
                })
            ]
        });

        newSkill({
            id: "swing1",
            name: "Swing",
            knownCounts: Count.allSwing,
            levels: [
                new ComposedLevel({
                    name: "Lopsided Eighth Notes",
                    description: `&quot;Swing&quot; is a style of music that affects how we read rhythms. Don't worry, there's a simple rule to follow&mdash;but it changes <em>so much</em>:<br/>
                    <br/>
                    Anything that looks like &quot;and&quot; (<strong>halfway</strong> through the beat) gets moved to &quot;ma&quot; (<strong>&frac23;</strong> of the way through the beat).<br/>
                    <br/>
                    (For anyone whose math brain is asleep right now, &quot;ma&quot; is a little <strong>later</strong> than &quot;and&quot;.) What does this do to our friendly eighth notes? Well... it makes them feel kind of... lopsided...`,
                    timeSignature: new TimeSignature(4, q).swung,
                    tempo: 60,
                    notes: [
                        e, e, e, e, e, e, e, e,
                        q, q, q, q,
                        e, e, e, e, e, e, e, e,
                        h, Q, q
                    ]
                }),
                new ComposedLevel({
                    name: "Split One, Three",
                    description: `Weird, right? Yes, this means that our eighth notes are no longer half a beat long each.<br/>
                    In fact, they're not even the same length as each other! The ones <em>on</em> the beat are longer than the ones on <em>ma</em>.<br/>
                    Oh, Swing, you're so crazy!`,
                    timeSignature: new TimeSignature(4, q).swung,
                    tempo: 60,
                    notes: [
                        e, e, q, q, q,
                        e, e, q, h,
                        e, e, q, q, q,
                        w,
                        h, e, e, q,
                        q, q, e, e, q,
                        h, e, e, q,
                        w
                    ]
                }),
                new ComposedLevel({
                    name: "Split Two, Four",
                    description: `How can you tell which kid on the playground has a jazz trombonist parent?<br/>
                    <br/>
                    Just look for whoever's extra-good at swinging... and using the slide.`,
                    timeSignature: new TimeSignature(4, q).swung,
                    tempo: 60,
                    notes: [
                        q, e, e, q, q,
                        q, e, e, h,
                        q, e, e, q, q,
                        w,
                        q, q, q, e, e,
                        q, q, q, e, e,
                        q, q, q, e, e,
                        w
                    ]
                }),
                new ComposedLevel({
                    name: "Fast in a Row",
                    description: `Ready to swing even faster?<br/>
                    No?<br/>
                    <br/>
                    Too bad!`,
                    timeSignature: new TimeSignature(4, q).swung,
                    tempo: 80,
                    notes: [
                        e, e, e, e, q, q,
                        e, e, e, e, h,
                        e, e, e, e, q, q,
                        Q, q, Q, q,
                        q, q, e, e, e, e,
                        q, q, e, e, e, e,
                        q, q, e, e, e, e,
                        q, q, h
                    ]
                }),
                new ComposedLevel({
                    name: "Unexpected II",
                    description: `...<br/><br/>...Arf?`,
                    timeSignature: new TimeSignature(4, q).swung,
                    tempo: 80,
                    notes: [
                        q, e, e, e, e, q,
                        q, e, e, e, e, q,
                        q, e, e, e, e, q,
                        Q, q, Q, q,
                        e, e, q, q, e, e,
                        e, e, q, q, e, e,
                        e, e, q, q, e, e,
                        w
                    ]
                }),
                new RandomLevel({
                    name: "Mixed Swing",
                    description: `Let's mix up these swing rhythms!<br/><br/>They don't mind. I asked them first.`,
                    timeSignature: new TimeSignature(4, q).swung,
                    tempo: 60,
                    bars: 8,
                    blocks: [
                        Block.required([h]),
                        Block.required([H], [0,2]),
                        Block.required([q]),
                        Block.required([Q, q]),
                        Block.required([e, e, e, e]),
                        Block.required([e, e, q]),
                        Block.required([e, e, h])
                    ]
                }),
                new RandomLevel({
                    name: "Faster Mixed Swing",
                    description: `let'smixuptheseswingrhythmstheydon'tmindiaskedthemfirst!`,
                    timeSignature: new TimeSignature(4, q).swung,
                    tempo: 80,
                    bars: 8,
                    blocks: [
                        Block.required([h]),
                        Block.required([H], [0,2]),
                        Block.required([q]),
                        Block.required([Q, q]),
                        Block.required([e, e, e, e]),
                        Block.required([e, e, q]),
                        Block.required([e, e, h])
                    ]
                })
            ]
        });

        newSkill({
            id: "swing2",
            name: "More Swing",
            knownCounts: Count.allSwing,
            levels: [
                new RandomLevel({
                    name: "Speed Review",
                    description: `Do you remember how swing turns &quot;and&quot;s into &quot;ma&quot;s?<br/>
                    <br/>
                    ...How <em>quickly</em> can you remember?`,
                    timeSignature: new TimeSignature(4, q).swung,
                    tempo: 100,
                    bars: 8,
                    blocks: [
                        Block.required([h]),
                        Block.required([H], [0,2]),
                        Block.required([q]),
                        Block.required([Q, q]),
                        Block.required([e, e, e, e]),
                        Block.required([e, e, q]),
                        Block.required([e, e, h])
                    ]
                }),
                new ComposedLevel({
                    name: "Pickups!",
                    description: `Think of those lonely &quot;ma&quot;s as leading forward into the next beat.<br/>
                    They're... really close to the next beat. Bein' all &frac23; of the way to it and all.`,
                    timeSignature: TimeSignature.fourFour.swung,
                    tempo: 80,
                    notes: [
                        E, e, q, E, e, q,
                        Q, E, e, h,
                        E, e, q, E, e, q,
                        H, E, e, q
                    ]
                }),
                new ComposedLevel({
                    name: "Swung Odd Rests",
                    description: `My advice for this one stands: tapping confidently on the odd-numbered beats is how cool people behave.<br/>
                    <br/>
                    Also, it might help you with the piece or whatever.`,
                    timeSignature: TimeSignature.fourFour.swung,
                    tempo: 80,
                    notes: [
                        E, e, e, e, E, e, e, e,
                        E, e, e, e, h,
                        E, e, e, e, E, e, e, e,
                        E, e, e, e, q, q
                    ]
                }),
                new ComposedLevel({
                    name: "Even More Swing",
                    description: `Are you still counting out loud? I would hate for you to forget that there are definitely no &quot;and&quot;s in here!<br/>
                    <br/>
                    Remember the whole point of swing: anything that <em>looks</em> like &quot;and&quot; is really &quot;ma&quot; in disguise.`,
                    timeSignature: TimeSignature.fourFour.swung,
                    tempo: 80,
                    notes: [
                        e, e, E, e, e, e, E, e,
                        e, e, E, e, q, Q,
                        e, e, E, e, e, e, E, e,
                        e, e, E, e, e, E, Q
                    ]
                }),
                new RandomLevel({
                    name: "More Mixed Swing",
                    description: "Just keep swinging, just keep swinging...",
                    timeSignature: TimeSignature.fourFour.swung,
                    tempo: 80,
                    bars: 8,
                    blocks: [
                        Block.required([h]),
                        Block.required([H], [0,2]),
                        Block.required([q]),
                        Block.required([Q]),
                        Block.required([e, e]),
                        Block.required([e, e]),
                        Block.required([e, E]),
                        Block.required([E, e]),
                        new Block([h]),
                        new Block([h]),
                        new Block([q]),
                        new Block([q]),
                        new Block([q])
                    ]
                })
            ]
        });

        newSkill({
            id: "swing3",
            name: "Swingcopation",
            knownCounts: Count.allSwing,
            levels : [
                new ComposedLevel({
                    name: "Dots, not Dahts",
                    description: `Let's warm up first... this is technically not syncopation. But it <em>is</em> swung!`,
                    timeSignature: TimeSignature.fourFour.swung,
                    tempo: 100,
                    notes: [
                        dq, e, h,
                        Q, q, q, q,
                        dq, e, h,
                        Q, q, q, q,
                        dq, e, dq, e,
                        dq, e, dq, e,
                        w,
                        W
                    ]
                }),
                new ComposedLevel({
                    name: "Hide the Two, Swung",
                    description: `Daht doo-doo-dooooooo... Doo-dah doo-dooooooo...<br/>
                    Doo-dah doo-dooooooo... ... DAHT! ... DAHT!<br/>
                    Daht doo-daht! Doo-daht daht!<br/>
                    Doo-daht daht! ... daht! DOOOOOOOOOOOOOOO.<br/>
                    <br/>
                    ...Oh, hello! Um, hi. I was just... singing this next piece. (Or should I say &quot;<em>swing</em>ing&quot; this next piece?)`,
                    timeSignature: TimeSignature.fourFour.swung,
                    tempo: 80,
                    notes: [
                        q, e, e, h,
                        e, q, e, h,
                        e, q, e, h,
                        Q, q, Q, q,
                        q, e, e, H,
                        e, q, e, H,
                        e, q, e, Q, q,
                        w
                    ]
                }),
                new ComposedLevel({
                    name: "Hide the Four, Swung",
                    description: `Second verse, similar but not identical to the first!<br/><br/>
                    Dooooooo...daht doo-doo-doooooooo...doo-dah doo-dooooooooo...`,
                    timeSignature: TimeSignature.fourFour.swung,
                    tempo: 80,
                    notes: [
                        h, q, e, e,
                        h, e, q, e,
                        h, e, q, e,
                        w,
                        H, q, e, e,
                        H, e, q, e,
                        H, e, q, e,
                        Q, q, Q, q
                    ]
                }),
                new ComposedLevel({
                    name: "Hide the Three, Swung",
                    description: `This one's a little rough, but you're hot stuff&mdash;your skills should be enough.<br/>
                    <br/>
                    ...marshmallow fluff...<br/>
                    (I ran out of rhymes.)`,
                    timeSignature: TimeSignature.fourFour.swung,
                    tempo: 80,
                    notes: [
                        q, q, e, e, q,
                        q, e, q, e, q,
                        q, e, q, e, q,
                        Q, q, Q, q,
                        Q, q, e, e, Q,
                        Q, e, q, e, Q,
                        Q, e, q, e, q,
                        W
                    ]
                }),
                new ComposedLevel({
                    name: "String of Swing",
                    description: `It's a cool thing.`,
                    timeSignature: TimeSignature.fourFour.swung,
                    tempo: 80,
                    notes: [
                        w,
                        e, e, E, e, E, e, q,
                        w,
                        e, e, E, e, E, e, q,
                        H, h,
                        e, e, E, e, E, e, q,
                        H, h,
                        w
                    ]
                }),
                new RandomLevel({
                    name: "Swingcopation",
                    description: `You can never have too much of a good swing!`,
                    timeSignature: TimeSignature.fourFour.swung,
                    tempo: 80,
                    bars: 8,
                    blocks: [
                        Block.required([q, e, e, H]),
                        Block.required([e, q, e, H]),
                        Block.required([Q, q, e, e, Q]),
                        Block.required([Q, e, q, e, Q]),
                        Block.required([e, q, e], [0]),
                        Block.required([e, q, e], [1]),
                        Block.required([e, q, e], [2]),
                        new Block([q]),
                        new Block([Q]),
                        new Block([e, e]),
                        new Block([h]),
                        new Block([H]),
                    ]
                })
            ]
        });

        newSkill({
            id: "dots",
            name: "Dots",
            knownCounts: Count.allSimpleBasic,
            levels: [
                new ComposedLevel({
                    name: "Dotted Whole Notes",
                    description: `A dot makes a note longer&mdash;it adds half the note's original length.<br/>
                    <br/>
                    A whole note (${Note.whole.inlineNotation}) is 4 beats long, and dotting it adds half that, and half of 4 is 2. So... a dotted whole note (${Note.whole.dotted.inlineNotation}) is 4 + 2 = <strong>6</strong> beats long.<br/>
                    <br/>
                    I know how to add 4 and 2, because I'm smart. You're going to notice the <strong>6</strong> on top of this time signature, because you're smart, too.`,
                    timeSignature: new TimeSignature(6, q),
                    tempo: 100,
                    notes: [
                        q, q, q, q, q, q,
                        dw,
                        h, h, h,
                        dw,
                        q, q, q, q, q, q,
                        DW,
                        w, h,
                        dw
                    ]
                }),
                new ComposedLevel({
                    name: "Dotted Half Notes",
                    description: `Remember, a dot makes a note 50% longer&mdash;so a dotted half note (${Note.half.dotted.inlineNotation}) is 2 + 1 = <strong>3</strong> beats long.<br/><br/>That's right, it's math class now. Your teacher <em>told</em> you it would come in handy.`,
                    timeSignature: TimeSignature.fourFour,
                    tempo: 80,
                    notes: [
                        q, Q, Q, q,
                        dh, q,
                        q, q, q, q,
                        dh, q,
                        q, Q, Q, q,
                        h, H,
                        dh, q,
                        w
                    ]
                }),
                new ComposedLevel({
                    name: "Half Notes, Dotted",
                    description: `Half notes (${Note.half.inlineNotation}) are always telling me they're two beats long, so I guess &quot;half a half note&quot; is one beat long, and that's what a dot adds.<br/><br/>(And 2 + 1 = 3. Just in case you weren't sure.)`,
                    timeSignature: TimeSignature.fourFour,
                    tempo: 80,
                    notes: [
                        q, q, H,
                        q, dh,
                        q, q, q, q,
                        q, dh,
                        q, q, H,
                        h, H,
                        q, dh,
                        w
                    ]
                }),
                new ComposedLevel({
                    name: "Some of Each",
                    description: `Do you think dotted whole notes (${Note.whole.dotted.inlineNotation}) and dotted half notes (${Note.half.dotted.inlineNotation}) are friends? Or will they eat each other?<br/><br/>Time for a science experiment.`,
                    timeSignature: new TimeSignature(6, q),
                    tempo: 100,
                    notes: [
                        dw,
                        dh, dh,
                        dw,
                        dh, DH,
                        dw,
                        dh, dh,
                        dh, dh,
                        dw
                    ]
                }),
                new ComposedLevel({
                    name: "Dotted Quarter Notes",
                    description: `Did I hear you say, &quot;This game is fun, but it needs way more fractions!&quot;? I'm pretty sure I did.<br/>
                    <br/>
                    Remember, a dot increases a note's length by half its original value&mdash;so a dotted quarter note (${Note.quarter.dotted.inlineNotation}) is 1 + &frac12; = <strong>1&frac12; beats</strong> long.<br/>
                    That's <strong><sup>3</sup>&frasl;<sub>2</sub> beats</strong> if you're a mathematician.<br/>
                    Or <strong>1.5 beats</strong> if you have poor taste in numbers. Eww.`,
                    timeSignature: TimeSignature.fourFour,
                    tempo: 60,
                    notes: [
                        q, e, e, h,
                        q, E, e, h,
                        dq, e, h,
                        w,
                        dq, e, h,
                        q, E, e, h,
                        dq, e, h,
                        w
                    ]
                }),
                new ComposedLevel({
                    name: "Flip it Around",
                    description: `Pop quiz: which is longer: 1&frac12; or 1?<br/><br/>I solve this by imagining 1&frac12; pies, and wanting to eat them. They are blueberry.<br/>
                    <br/>
                    Dotted quarter notes (${Note.quarter.dotted.inlineNotation}) are longer than one beat long. That's why the next beat starts before you move on from the dotted quarters.`,
                    timeSignature: TimeSignature.fourFour,
                    tempo: 60,
                    notes: [
                        h, q, e, e,
                        h, q, E, e,
                        h, dq, e,
                        h, H,
                        h, dq, e,
                        h, q, E, e,
                        h, dq, e,
                        h, H
                    ]
                }),
                new ComposedLevel({
                    name: "All in a Row",
                    description: "Pay close attention to which beats <em>don't</em> have a clap on them.<br/><br/>They feel left out. But <strong>don't you clap on them</strong>&mdash;they deserve it.<br/><br/>...They know what they did.",
                    timeSignature: TimeSignature.fourFour,
                    tempo: 60,
                    notes: [
                        q, e, e, q, e, e,
                        q, E, e, q, E, e,
                        dq, e, dq, e,
                        q, Q, H,
                        dq, e, dq, e,
                        q, E, e, q, E, e,
                        dq, e, dq, e,
                        q, Q, H
                    ]
                }),
                new QuizLevel({
                    name: "Dot Thought",
                    description: `You're getting all this dot math, right? It's like regular math, only... dottier!`,
                    questions: Question.noteLengths(TimeSignature.fourFour, dw, w, dh, h, dq, q, e).concat([
                        Question.noteRelationship(q, dw, [h, w, dh]),
                        Question.noteRelationship(q, dh, [h, w, dw]),
                        Question.noteRelationship(e, dq, [q, dq, h])
                    ])
                }),
                new ComposedLevel({
                    name: "And the Rest",
                    description: `Think of the eighth notes (${Note.eighth.inlineNotation}) as &quot;bouncing off of&quot; the beat just before them. Don't worry&mdash;the beat is a good sport about it.`,
                    timeSignature: TimeSignature.fourFour,
                    tempo: 80,
                    notes: [
                        Q, E, e, h,
                        DQ, e, h,
                        DQ, e, h,
                        e, DQ, H,
                        h, Q, E, e,
                        h, DQ, e,
                        h, DQ, e,
                        e, DQ, H
                    ]
                }),
                new RandomLevel({
                    name: "Lots of Dots",
                    description: "Remember, a dot multiplies a note's length by 1.5. We've learned lots of different ways of thinking about that&mdash;you pick your favorite while I try to get this bucket of dots off this high shelf... aAAUgh!<br/><br/>Good luck.",
                    timeSignature: new TimeSignature(6, q),
                    tempo: 80,
                    bars: 8,
                    blocks: [
                        Block.required([dh, q]),
                        Block.required([dq, e, h]),
                        Block.required([dw]),
                        Block.required([DH, q]),
                        Block.required([h, DQ, e, h]),
                        Block.required([DW]),
                        new Block([q, q]),
                        new Block([h]),
                        new Block([w]),
                        new Block([e, e, e, e])
                    ]
                })
            ]
        });

        newSkill({
            id: "eighthNoteChallenge",
            name: "Challenge: Eighth Notes",
            knownCounts: Count.allSimpleBasic,
            levels: [
                new RandomLevel({
                    name: "Challenge in Two",
                    description: "What's a bunny's favorite type of music?<br/><br/>Hip Hop.",
                    timeSignature: TimeSignature.twoFour,
                    tempo: 80,
                    bars: 16,
                    blocks: [
                        Block.required([h]),
                        Block.required([H]),
                        Block.required([q]),
                        Block.required([Q]),
                        Block.required([e, e]),
                        Block.required([e, e]),
                        Block.required([e, E]),
                        Block.required([E, e]),
                        Block.required([dq, e]),
                        Block.required([DQ, e])
                    ]
                }),
                new RandomLevel({
                    name: "Challenge in Three",
                    description: "What's a skeleton's favorite type of music?<br/><br/>Everything written for trom<strong>bone</strong>.",
                    timeSignature: TimeSignature.threeFour,
                    tempo: 80,
                    bars: 16,
                    blocks: [
                        Block.required([h]),
                        Block.required([H]),
                        Block.required([dh]),
                        Block.required([DH]),
                        Block.required([q]),
                        Block.required([Q]),
                        Block.required([e, e]),
                        Block.required([e, e]),
                        Block.required([e, E]),
                        Block.required([E, e]),
                        Block.required([dq, e]),
                        Block.required([DQ, e])
                    ]
                }),
                new RandomLevel({
                    name: "Challenge in Four",
                    description: "What's a fish's favorite type of music?<br/><br/>They mostly just like the <strong>scales</strong>.",
                    timeSignature: TimeSignature.fourFour,
                    tempo: 100,
                    bars: 16,
                    blocks: [
                        Block.required([w]),
                        Block.required([W]),
                        Block.required([h]),
                        Block.required([H], [0,2]),
                        Block.required([q]),
                        Block.required([Q]),
                        Block.required([e, e]),
                        Block.required([e, e]),
                        Block.required([e, E]),
                        Block.required([E, e]),
                        Block.required([dq, e], [0,2]),
                        Block.required([DQ, e], [0,2])
                    ]
                }),
                new RandomLevel({
                    name: "Challenge in Five",
                    description: "What's a pirate's favorite type of music?<br/><br/>Anything, really&mdash;as long as it's focused on the high Cs.",
                    timeSignature: TimeSignature.fiveFour,
                    tempo: 100,
                    bars: 16,
                    blocks: [
                        new Block([w, q]),
                        new Block([W, q]),
                        new Block([h]),
                        new Block([H], [0,3]),
                        new Block([q, q]),
                        new Block([q, Q]),
                        new Block([Q, q]),
                        new Block([q, q, q]),
                        new Block([q, Q, q]),
                        new Block([Q, q, q]),
                        new Block([q, q, Q]),
                        new Block([h, q]),
                        new Block([q, h]),
                        Block.required([e, e]),
                        Block.required([e, e]),
                        Block.required([e, E]),
                        Block.required([E, e]),
                        Block.required([dq, e], [0,1,3,4]),
                        Block.required([DQ, e], [0,1,3,4])
                    ]
                })
            ]
        });

        newSkill({
            id: "sixteenthNotes1",
            name: "Meet Sixteenth Notes",
            knownCounts: Count.allSimple,
            levels: [
                new ComposedLevel({
                    name: "Subdividing",
                    description: `Sixteenth notes (${Note.sixteenth.inlineNotation}) look like eighth notes (${Note.eighth.inlineNotation}), except they have a second <strong>beam</strong> between them when they're near each other (or a second <strong>flag</strong> if they're all alone). Somehow, this makes them go faster. It doesn't look very aerodynamic to me.<br/>
                    Whatever. The point is, they're only <strong>one quarter</strong> of a beat long&mdash;<em>half</em> as long as eighth notes! Ready?<br/>
                    <br/>
                    No. No, you're not ready. You need to know a bunch of stuff now:
                    <ul>
                        <li>You'll need to know the count for <strong>one quarter</strong> of the way through the beat: <strong>e</strong>. That's right, just say &quot;eee!&quot; like the second sixteenth note of each beat is a large spider.</li>
                        <li>You <em>already know</em> the count for <strong>two quarters</strong> of the way through the beat, because one time a math teacher told me two quarters equals one half: <strong>and</strong>. Which we write as &quot;+&quot; for some reason&mdash;maybe because &quot;&amp;&quot; is so hard to draw.</li>
                        <li>You'll need to know the count for <strong>three quarters</strong> of the way through the beat: <strong>a</strong> (pronounced &quot;duh&quot;). (You know... for a count pronounced &quot;duh&quot;, its pronunciation is ironically non-obvious.)</li>
                    </ul>`,
                    timeSignature: TimeSignature.fourFour,
                    tempo: 46,
                    notes: [
                        h, q, q,
                        e, e, e, e, s, s, s, s, q,
                        q, e, e, s, s, s, s, q,
                        e, e, s, s, s, s, s, s, s, s, q
                    ]
                }),
                new ComposedLevel({
                    name: "Building it Up",
                    description: `Have you noticed that four sixteenth notes (${Note.sixteenth.inlineNotation}) fit in a beat? Good. They've noticed you, too.`,
                    timeSignature: TimeSignature.fourFour,
                    tempo: 46,
                    notes: [
                        s, s, s, s, s, s, s, s, e, e, e, e,
                        s, s, s, s, s, s, s, s, e, e, e, e,
                        s, s, s, s, s, s, s, s, e, e, e, e,
                        q, q, h
                    ]
                }),
                new ComposedLevel({
                    name: "Halves and Sixteenths",
                    description: `How many sixteenth notes (${Note.sixteenth.inlineNotation}) fit in a half note (${Note.half.inlineNotation})?<br/>
                    <br/>
                    No, the answer is not &quot;as many as I can cram in there.&quot; You need to calm down.`,
                    timeSignature: TimeSignature.fourFour,
                    tempo: 60,
                    notes: [
                        h, s, s, s, s, s, s, s, s,
                        h, h,
                        s, s, s, s, s, s, s, s, h,
                        s, s, s, s, s, s, s, s, h
                    ]
                }),
                new ComposedLevel({
                    name: "Quarter Notes and Quarters of a Beat",
                    description: `How many sixteenth notes (${Note.sixteenth.inlineNotation}) fit in a quarter note (${Note.quarter.inlineNotation})?<br/>
                    <br/>
                    It's 93. 93 sixteenth notes.</br>
                    <br/>
                    I'm just messing with you. It's 7.2&times;10<sup>53</sup>.<br/>
                    <br/>
                    <br/>
                    <br/>
                    ...Okay, it might be four.`,
                    timeSignature: TimeSignature.fourFour,
                    tempo: 60,
                    notes: [
                        q, q, q, s, s, s, s,
                        q, q, s, s, s, s, q,
                        q, s, s, s, s, q, q,
                        s, s, s, s, q, q, q,
                        s, s, s, s, s, s, s, s, s, s, s, s, q,
                        s, s, s, s, q, q, s, s, s, s,
                        q, s, s, s, s, s, s, s, s, q,
                        s, s, s, s, q, s, s, s, s, q
                    ]
                }),
                new QuizLevel({
                    name: "What Are You Saying?",
                    description: `Sure, you've gotten used to all these funny words, but do you remember what they mean?<br/>
                    You'd better. The counting alligator feeds on those who don't know what counts mean.<br/>
                    <br/>
                    Nah, I'm just kidding!<br/>
                    <br/>
                    ...he's a crocodile.`,
                    questions: Question.counts(Count.allSimple)
                }),
                new ComposedLevel({
                    name: "One Beam or Two?",
                    description: `How many sixteenth notes (${Note.sixteenth.inlineNotation}) fit in an eighth note (${Note.eighth.inlineNotation})? Hint: it's the same number as the number of entire cheesecakes I ate for breakfast this morning.<br/>
                    <br/>
                    Oh, were you not there for that?`,
                    timeSignature: TimeSignature.fourFour,
                    tempo: 60,
                    notes: [
                        e, e, e, e, e, e, s, s, s, s,
                        e, e, e, e, s, s, s, s, e, e,
                        e, e, s, s, s, s, e, e, e, e,
                        s, s, s, s, e, e, e, e, q,
                        s, s, s, s, s, s, s, s, s, s, s, s, e, e,
                        s, s, s, s, e, e, e, e, s, s, s, s,
                        e, e, s, s, s, s, s, s, s, s, e, e,
                        s, s, s, s, e, e, s, s, s, s, q
                    ]
                }),
                new RandomLevel({
                    name: "1 e + a",
                    description: "I sense your hesitance about this next one&mdash;you've got to have more confidence! You know, they told Beethoven he couldn't write great music anymore because he was deaf. But did he listen?",
                    timeSignature: TimeSignature.fourFour,
                    tempo: 60,
                    bars: 8,
                    blocks: [
                        Block.required([s, s, s, s, q]),
                        Block.required([s, s, s, s, e, e]),
                        new Block([q]),
                        new Block([h]),
                        new Block([e, e]),
                        new Block([Q])
                    ]
                }),
                new ComposedLevel({
                    name: "Sixteenth Rests",
                    description: `A sixteenth rest (${Rest.sixteenth.inlineNotation}) looks like an eighth rest (${Rest.eighth.inlineNotation}), if it had a second globby thingy on it! On Thursdays, it's &frac14; of a beat long.<br/>
                    <br/>
                    It is <em>also</em> &frac14; of a beat long on all the <em>other</em> days.`,
                    timeSignature: TimeSignature.fourFour,
                    tempo: 60,
                    notes: [
                        Q, Q, S, S, S, S, Q,
                        s, s, s, s, s, S, S, S, s, s, s, s, s, S, S, S,
                        s, S, S, S, s, S, S, S, s, S, S, S, s, S, S, S,
                        s, S, S, S, s, S, s, S, s, S, s, S, s, S, S, S
                    ]
                }),
                new QuizLevel({
                    name: "Wrap it Up",
                    description: `Pop quiz!<br/>
                    <br/>
                    On notes and stuff, that is. Don't worry, I won't ask you the capital of France.<br/>
                    <br/>
                    (But if someone ever does... it's &quot;F&quot;.)`,
                    questions: Question.noteNames(S, E, s, e).concat(Question.noteLengths(TimeSignature.fourFour, s, e, q)).concat([
                        Question.noteRelationship(s, e, [q, h, w]),
                        Question.noteRelationship(s, q, [e, h, w])
                    ])
                })
            ]
        });

        newSkill({
            id: "sixteenthNotes2",
            name: "Sixteenths on the Beat",
            knownCounts: Count.allSimple,
            levels: [
                new ComposedLevel({
                    name: "Resting on a",
                    description: "Don't clap on <strong>a</strong>. Just... don't. I'm watching you.",
                    timeSignature: TimeSignature.fourFour,
                    tempo: 60,
                    notes: [
                        s, s, s, s, q, s, s, s, s, q,
                        s, s, s, S, q, s, s, s, S, q,
                        s, s, s, S, s, s, s, S, s, s, s, S, q,
                        s, s, e, s, s, e, s, s, e, q
                    ]
                }),
                new ComposedLevel({
                    name: "Splitting the Beat",
                    description: `Remember sixteenth notes (${Note.sixteenth.inlineNotation}) are twice as fast as eighth notes (${Note.eighth.inlineNotation}). And eighth notes are twice as slow as sixteenth notes. And the sun could fit 1.3 million copies of Earth inside it. That's not really relevant to this piece; I just think it's cool.`,
                    timeSignature: TimeSignature.fourFour,
                    tempo: 60,
                    notes: [
                        q, q, e, e, e, e,
                        s, s, e, s, s, e, s, s, e, s, s, e,
                        q, q, e, e, e, e,
                        s, s, e, s, s, e, h
                    ]
                }),
                new ComposedLevel({
                    name: "Combining + a",
                    description: `See how the last two sixteenth notes (${Note.sixteenth.inlineNotation}) of the beat have been combined into an eighth note (${Note.eighth.inlineNotation})? They don't even like each other, and they're stuck in there together. Just for you. I hope you're happy.`,
                    timeSignature: TimeSignature.fourFour,
                    tempo: 60,
                    notes: [
                        s, s, s, s, s, s, e, s, s, e, s, s, e,
                        s, s, s, s, s, s, s, s, s, s, e, s, s, e,
                        s, s, s, s, s, s, s, s, s, s, s, s, s, s, e,
                        s, s, s, s, s, s, e, h
                    ]
                }),
                new ComposedLevel({
                    name: "Rotation",
                    description: `See how the first eighth note (${Note.sixteenth.inlineNotation}) in the pair has been split into two sixteenth notes (${Note.sixteenth.inlineNotation})?<br/>
                    <br/>
                    Do you know how <em>difficult</em> that is to do? I had to buy a special kind of hammer!`,
                    timeSignature: TimeSignature.fourFour,
                    tempo: 60,
                    notes: [
                        s, s, e, e, e, e, e, q,
                        e, e, s, s, e, e, e, q,
                        e, e, e, e, s, s, e, q,
                        q, q, q, s, s, e,
                        e, e, e, e, s, s, e, s, s, e,
                        e, e, s, s, e, s, s, e, q,
                        s, s, e, s, s, e, e, e, e, e,
                        s, s, e, s, s, e, s, s, e, q
                    ]
                }),
                new RandomLevel({
                    name: "1 e +",
                    description: "You're leaving? So soon? All the &quot;1 e +&quot;s barely got a chance to know you!",
                    timeSignature: TimeSignature.fourFour,
                    tempo: 60,
                    bars: 8,
                    blocks: [
                        Block.required([s, s, e]),
                        Block.required([s, s, e]),
                        Block.required([s, s, e]),
                        Block.required([s, s, e]),
                        new Block([q]),
                        new Block([h]),
                        new Block([e, e]),
                        new Block([Q])
                    ]
                })
            ]
        });

        newSkill({
            id: "sixteenthNotes3",
            name: "Sixteenths on the And",
            knownCounts: Count.allSimple,
            levels: [
                new ComposedLevel({
                    name: "Resting on e",
                    description: "Don't clap on &quot;e&quot;!<br/><br/>...<br/><br/><strong>EEEEEEEEEEEEEEEEEEEEEEEE!</strong><br/><br/>Ahem.",
                    timeSignature: TimeSignature.fourFour,
                    tempo: 60,
                    notes: [
                        s, s, s, s, q, s, s, s, s, q,
                        s, S, s, s, q, s, S, s, s, q,
                        s, S, s, s, s, S, s, s, s, S, s, s, q,
                        e, s, s, e, s, s, e, s, s, q
                    ]
                }),
                new ComposedLevel({
                    name: "Splitting the +",
                    description: `Remember two sixteenth notes (${Note.sixteenth.inlineNotation}) fit into an eighth note (${Note.eighth.inlineNotation}). Also remember my birthday&mdash;you didn't forget it already, did you?`,
                    timeSignature: TimeSignature.fourFour,
                    tempo: 60,
                    notes: [
                        q, q, e, e, e, e,
                        e, s, s, e, s, s, e, s, s, e, s, s,
                        q, q, e, e, e, e,
                        e, s, s, e, s, s, h
                    ]
                }),
                new ComposedLevel({
                    name: "Combining With e",
                    description: `See how the first two sixteenth notes (${Note.sixteenth.inlineNotation}) of the beat have been combined into an eighth note (${Note.eighth.inlineNotation})?<br/>
                    <br/>
                    It takes a lot of gymnastics to bend their little beams and fit in there.`,
                    timeSignature: TimeSignature.fourFour,
                    tempo: 60,
                    notes: [
                        s, s, s, s, e, s, s, e, s, s, e, s, s,
                        s, s, s, s, s, s, s, s, e, s, s, e, s, s,
                        s, s, s, s, s, s, s, s, s, s, s, s, e, s, s,
                        s, s, s, s, e, s, s, h
                    ]
                }),
                new ComposedLevel({
                    name: "Rotation",
                    description: `See how the second eighth note (${Note.eighth.inlineNotation}) in the pair has been split into two sixteenth notes (${Note.sixteenth.inlineNotation})?<br/>
                    <br/>
                    No? Okay, it's like if I had an adorable puppy, and I split it into two half-pup... you know, I'm not sure this analogy is helping.`,
                    timeSignature: TimeSignature.fourFour,
                    tempo: 60,
                    notes: [
                        e, s, s, e, e, e, e, q,
                        e, e, e, s, s, e, e, q,
                        e, e, e, e, e, s, s, q,
                        q, q, q, e, s, s,
                        e, e, e, e, e, s, s, e, s, s,
                        e, e, e, s, s, e, s, s, q,
                        e, s, s, e, s, s, e, e, e, e,
                        e, s, s, e, s, s, e, s, s, q
                    ]
                }),
                new RandomLevel({
                    name: "1 + a",
                    description: "Ready to play with one and a? Sorry, not one and a&mdash;I mean one, and, and a?",
                    timeSignature: TimeSignature.fourFour,
                    tempo: 60,
                    bars: 8,
                    blocks: [
                        Block.required([e, s, s]),
                        Block.required([e, s, s]),
                        Block.required([e, s, s]),
                        Block.required([e, s, s]),
                        new Block([q]),
                        new Block([h]),
                        new Block([e, e]),
                        new Block([Q])
                    ]
                })
            ]
        });

        newSkill({
            id: "sixteenthNotes4",
            name: "Mixed &apos;teenth Notes",
            knownCounts: Count.allSimple,
            levels: [
                new ComposedLevel({
                    name: "Juxtaposition 1",
                    description: `You've mastered &quot;1 + a&quot; and &quot;1 e +&quot, but can you tell them apart?<br/>
                    <br/>
                    Hint: &quot;1 + a&quot; wears high heels; &quot;1 e +&quot; wears sneakers.<br/>
                    <br/>
                    Another, perhaps more helpful, hint: a sixteenth note has two beams (${Note.sixteenth.inlineNotation}); an eighth note has one (${Note.eighth.inlineNotation}).`,
                    timeSignature: TimeSignature.fourFour,
                    tempo: 60,
                    notes: [
                        e, s, s, e, s, s, e, s, s, q,
                        s, s, e, s, s, e, s, s, e, q,
                        e, s, s, q, s, s, e, q,
                        s, s, e, e, s, s, h
                    ]
                }),
                new ComposedLevel({
                    name: "Juxtaposition 2",
                    description: "Look at the beams! LOOK AT THEMMMMMMM!<br/><br/>Specifically, look at which notes have two and which notes have one.<br/><br/>And which notes have 0, but that seems obvious.",
                    timeSignature: TimeSignature.fourFour,
                    tempo: 60,
                    notes: [
                        q, e, e, s, s, e, q,
                        e, e, e, s, s, e, s, s, q,
                        q, s, s, e, e, s, s, q,
                        e, s, s, s, s, e, h
                    ]
                }),
                new ComposedLevel({
                    name: "Juxtaposition 3",
                    description: "Think for each beamed group: are the faster notes first? Or is the slower note first?<br/>And what are all these notes doing here anyway?<br/><br/>Also, what's the meaning of life?",
                    timeSignature: TimeSignature.fourFour,
                    tempo: 60,
                    notes: [
                        e, s, s, e, s, s, e, s, s, s, s, e,
                        e, s, s, e, s, s, s, s, e, e, s, s,
                        e, s, s, s, s, e, e, s, s, e, s, s, 
                        s, s, e, e, s, s, h
                    ]
                }),
                new ComposedLevel({
                    name: "Juxtaposition 4",
                    description: "I know it's hard to tell &quot;1 + &quot; and &quot;1 e +&quot; apart, but it's really important that you can. Mostly because they get really offended when you confuse them. C'mon. How about a little empathy?",
                    timeSignature: TimeSignature.fourFour,
                    tempo: 60,
                    notes: [
                        s, s, e, s, s, e, s, s, e, e, s, s,
                        s, s, e, s, s, e, e, s, s, s, s, e,
                        s, s, e, e, s, s, s, s, e, s, s, e,
                        e, s, s, s, s, e, h
                    ]
                }),
                new RandomLevel({
                    name: "Juxtaposition 5: Random Edition",
                    description: "Now with even more randomness!",
                    timeSignature: TimeSignature.fourFour,
                    tempo: 60,
                    bars: 8,
                    blocks: [
                        Block.required([s, s, e]),
                        Block.required([e, s, s]),
                        Block.required([s, s, e]),
                        Block.required([e, s, s]),
                        Block.required([s, s, e]),
                        Block.required([e, s, s]),
                        new Block([q]),
                        new Block([h]),
                        new Block([e, e]),
                        new Block([Q])
                    ]
                }),
                new RandomLevel({
                    name: "Thruxtaposition",
                    description: "Let's not forget our old friend &quot;1 e + a&quot;! And, no, that's not really a word...",
                    timeSignature: TimeSignature.fourFour,
                    tempo: 60,
                    bars: 8,
                    blocks: [
                        Block.required([s, s, e]),
                        Block.required([s, s, s, s]),
                        Block.required([e, s, s]),
                        new Block([q]),
                        new Block([h]),
                        new Block([e, e]),
                        new Block([Q])
                    ]
                })
            ]
        });

        newSkill({
            id: "sixteenthNotes5",
            name: "The Last Sixteenth",
            knownCounts: Count.allSimple,
            levels: [
                new ComposedLevel({
                    name: "Resting on e +",
                    description: `An eighth note (${Note.eighth.inlineNotation}) is &frac12; a beat, so dotting it adds another &frac14;.<br/>
                    <br/>
                    To add those together... does the phrase &quot;common denominator&quot; ring any bells? Well, then, tell it to stop making noise; I'm trying to focus and do math. A <strong>dotted eighth note</strong> (${Note.eighth.dotted.inlineNotation}) is &frac12; + &frac14; = <strong>&frac34; of a beat</strong>.<br/>
                    <br/>
                    Oh, uh, and don't forget: the count <strong>a</strong> is not, uh, pronounced &quot;uh&quot;. It's &quot;duh&quot;. Duh!`,
                    timeSignature: TimeSignature.fourFour,
                    tempo: 60,
                    notes: [
                        s, s, s, s, q, s, s, s, s, q,
                        s, S, S, s, q, s, S, S, s, q,
                        s, S, S, s, s, S, S, s, s, S, S, s, q,
                        de, s, de, s, de, s, q
                    ]
                }),
                new ComposedLevel({
                    name: "Pickups on a",
                    description: `Do you know how many sixteenth notes (${Note.sixteenth.inlineNotation}) fit in a dotted eighth note (${Note.eighth.dotted.inlineNotation})? Here, I'll help you. One moment.<br/>
                    <br/>
                    There. I've hidden the answer somewhere in the next piece.<br/>
                    <br/>
                    It's the time signature. I hid it on top of the time signature. Sorry I gave it away. I'm too excited.`,
                    timeSignature: TimeSignature.threeFour,
                    tempo: 60,
                    notes: [
                        q, q, q,
                        de, s, de, s, de, s,
                        q, q, q,
                        de, s, de, s, q,
                        e, e, e, e, e, e,
                        de, s, de, s, de, s,
                        e, e, e, e, e, e,
                        de, s, de, s, q
                    ]
                }),
                new ComposedLevel({
                    name: "Combining &frac34;",
                    pageTitle: "Combining ¾",
                    description: `See how the first three sixteenth notes (${Note.sixteenth.inlineNotation}) of the beat have been combined into a dotted eighth note (${Note.eighth.dotted.inlineNotation})? It's, like, super-crowded in there. Everybody's shoving each other.<br/>
                    <br/>
                    What are you still doing here!? Get going! I don't think they can stay in there much longer.`,
                    timeSignature: TimeSignature.fourFour,
                    tempo: 60,
                    notes: [
                        s, s, s, s, de, s, de, s, de, s,
                        s, s, s, s, s, s, s, s, de, s, de, s,
                        s, s, s, s, s, s, s, s, s, s, s, s, de, s,
                        s, s, s, s, de, s, h
                    ]
                }),
                new QuizLevel({
                    name: "Testing &frac34;",
                    pageTitle: "Testing ¾",
                    description: `How long do you think I can keep writing these levels? It's pretty hard&mdash;my foot hurts like crazy.<br/>
                    <br/>
                    What's that? Oh. Yeah, I guess I could try writing them with my hand.`,
                    questions: Question.noteLengths(TimeSignature.fourFour, dq, q, de, DE, e, E, s, S).concat([
                        Question.noteRelationship(s, q, [de, e, dq]),
                        Question.noteRelationship(s, de, [q, e, dq]),
                        Question.noteRelationship(s, dq, [de, e, q])
                    ])
                }),
                new ComposedLevel({
                    name: "Rotation",
                    description: "See how we clap on the very last quarter of the beat? Good. And see how we dance around shouting &quot;I AM THE GENIUS I AM THE BEST&quot; after each piece? ...Oh, is that only me?",
                    timeSignature: TimeSignature.fourFour,
                    tempo: 60,
                    notes: [
                        de, s, e, e, e, e, q,
                        e, e, de, s, e, e, q,
                        e, e, e, e, de, s, q,
                        q, q, q, de, s,
                        e, e, e, e, de, s, de, s,
                        e, e, de, s, de, s, q,
                        de, s, de, s, e, e, e, e,
                        de, s, de, s, de, s, q
                    ]
                }),
                new RandomLevel({
                    name: "1 a",
                    description: `Are you ready to play with a dotted eighth note (${Note.eighth.dotted.inlineNotation}) followed by a sixteenth note (${Note.sixteenth.inlineNotation})? Of course you are; look at you. You can hardly contain yourself.<br/>
                    <br/>
                    Look, I don't care <em>how</em> excited you are; there's no need to jump on the furniture like that.`,
                    timeSignature: TimeSignature.fourFour,
                    tempo: 60,
                    bars: 8,
                    blocks: [
                        Block.required([de, s]),
                        Block.required([de, s]),
                        Block.required([de, s]),
                        Block.required([de, s]),
                        new Block([q]),
                        new Block([h]),
                        new Block([e, e]),
                        new Block([Q])
                    ]
                }),
                new RandomLevel({
                    name: "Quadruxtaposition",
                    description: "<em>Also</em> not a word. GLHF!",
                    timeSignature: TimeSignature.threeFour,
                    tempo: 60,
                    bars: 8,
                    blocks: [
                        Block.required([s, s, s, s]),
                        Block.required([e, s, s]),
                        Block.required([s, s, e]),
                        Block.required([de, s]),
                        new Block([q]),
                        new Block([h]),
                        new Block([e, e]),
                        new Block([Q])
                    ]
                })
            ]
        });

        newSkill({
            id: "sixteenthNoteChallenge",
            name: "Challenge: Sixteenth Notes",
            knownCounts: Count.allSimple,
            levels: [
                new RandomLevel({
                    name: "Challenge in Two",
                    description: "I have a joke about this level. Bear with me&mdash;it comes out different every time.",
                    timeSignature: TimeSignature.twoFour,
                    tempo: 80,
                    bars: 16,
                    blocks: [
                        new Block([h]),
                        new Block([H]),
                        new Block([q]),
                        new Block([Q]),
                        new Block([e, e]),
                        new Block([e, e]),
                        new Block([e, E]),
                        new Block([E, e]),
                        new Block([dq, e]),
                        new Block([DQ, e]),
                        Block.required([s, s, s, s]),
                        Block.required([e, s, s]),
                        Block.required([s, s, e]),
                        Block.required([de, s])
                    ]
                }),
                new RandomLevel({
                    name: "Challenge in Three",
                    description: "Do you want to hear a joke about a sixteenth note? I promise, it's very short!",
                    timeSignature: TimeSignature.threeFour,
                    tempo: 80,
                    bars: 16,
                    blocks: [
                        new Block([h]),
                        new Block([H]),
                        new Block([dh]),
                        new Block([DH]),
                        new Block([q]),
                        new Block([Q]),
                        new Block([e, e]),
                        new Block([e, e]),
                        new Block([e, E]),
                        new Block([E, e]),
                        new Block([dq, e]),
                        new Block([DQ, e]),
                        Block.required([s, s, s, s]),
                        Block.required([e, s, s]),
                        Block.required([s, s, e]),
                        Block.required([de, s])
                    ]
                }),
                new RandomLevel({
                    name: "Challenge in Four",
                    description: "Should I tell a joke about a whole note? Never mind, it's too long.",
                    timeSignature: TimeSignature.fourFour,
                    tempo: 80,
                    bars: 16,
                    blocks: [
                        new Block([w]),
                        new Block([W]),
                        new Block([h]),
                        new Block([H], [0,2]),
                        new Block([q]),
                        new Block([Q]),
                        new Block([e, e]),
                        new Block([e, e]),
                        new Block([e, E]),
                        new Block([E, e]),
                        new Block([dq, e], [0,2]),
                        new Block([DQ, e], [0,2]),
                        Block.required([s, s, s, s]),
                        Block.required([e, s, s]),
                        Block.required([s, s, e]),
                        Block.required([de, s])
                    ]
                }),
                new RandomLevel({
                    name: "Challenge in Five",
                    description: "I know a joke about this kind of joke... but you've probably heard it before.",
                    timeSignature: TimeSignature.fiveFour,
                    tempo: 92,
                    bars: 8,
                    blocks: [
                        new Block([w, q]),
                        new Block([W, q]),
                        new Block([h]),
                        new Block([H], [0,3]),
                        new Block([q, q]),
                        new Block([q, Q]),
                        new Block([Q, q]),
                        new Block([q, q, q]),
                        new Block([q, Q, q]),
                        new Block([Q, q, q]),
                        new Block([q, q, Q]),
                        new Block([h, q]),
                        new Block([q, h]),
                        new Block([e, e]),
                        Block.required([e, E]),
                        Block.required([E, e]),
                        Block.required([dq, e], [0,1,3,4]),
                        Block.required([DQ, e], [0,1,3,4]),
                        Block.required([s, s, s, s]),
                        Block.required([e, s, s]),
                        Block.required([s, s, e]),
                        Block.required([de, s])
                    ]
                })
            ]
        })

        newSkill({
            id: "threeFour",
            name: "Three Four",
            knownCounts: Count.allSimpleBasic,
            levels: [
                new ComposedLevel({
                    name: "Slowly at First",
                    description: "There are three beats in this time signature.",
                    timeSignature: TimeSignature.threeFour,
                    tempo: 60,
                    notes: [
                        h, q,
                        q, q, q,
                        h, q,
                        dh,
                        h, q,
                        q, e, e, q,
                        q, h,
                        dh
                    ]
                }),
                new ComposedLevel({
                    name: "Slowly at Second",
                    description: "There are three beats in every one of these measures.<br/><br/>There are 8 measures, though. That's not three. Boo.",
                    timeSignature: TimeSignature.threeFour,
                    tempo: 60,
                    notes: [
                        e, e, q, q,
                        dq, e, q,
                        e, e, q, q,
                        dh,
                        e, e, q, q,
                        dq, e, q,
                        e, e, e, e, e, e,
                        dh
                    ]
                }),
                new ComposedLevel({
                    name: "A Little Faster Now",
                    description: "There are three dotted half notes in here.<br/>Each of which lasts for three beats.<br/>There are three lines in this text.",
                    timeSignature: TimeSignature.threeFour,
                    tempo: 80,
                    notes: [
                        dh,
                        q, q, q,
                        q, e, e, e, e,
                        dh,
                        q, q, q,
                        q, dq, e,
                        q, e, e, q,
                        dh
                    ]
                }),
                new ComposedLevel({
                    name: "A Little Faster Still",
                    description: "There are three pieces finished in this skill.<br/><br/>Also, three moons of Neptune. Okay, fourteen. But only three that <em>matter</em>.",
                    timeSignature: TimeSignature.threeFour,
                    tempo: 80,
                    notes: [
                        q, e, e, q,
                        q, dq, e,
                        q, e, e, q,
                        dh,
                        q, e, e, q,
                        q, dq, e,
                        e, e, e, e, e, e,
                        dh
                    ]
                }),
                new ComposedLevel({
                    name: "English Waltz",
                    description: "There are three reasons I hope you finish this skill soon.<br/><br/>No, I won't tell you what they are.",
                    timeSignature: TimeSignature.threeFour,
                    tempo: 100,
                    notes: [
                        q, e, e, e, e,
                        dq, e, q,
                        h, e, e,
                        q, Q, Q,
                        q, e, e, e, e,
                        q, dq, e,
                        q, Q, e, e,
                        dh
                    ]
                })
            ]
        });

        newSkill({
            id: "compoundSingle",
            name: "Compound Single",
            knownCounts: Count.allCompound,
            levels: [
                new ComposedLevel({
                    name: "Step One",
                    description: `Just like we can pretend ${TimeSignature.sixEight.inlineNotation} is actually 2 over dotted quarter note (${Note.quarter.dotted.inlineNotation}), can we pretend ${TimeSignature.threeFour.inlineNotation} is <strong>1</strong> over <strong>dotted <em>half</em> note</strong> (${Note.half.dotted.inlineNotation})?<br/>
                    <br/>
                    Yes. Yes, we can. Let's.`,
                    timeSignature: new TimeSignature(1, dh),
                    tempo: 46,
                    notes: [
                        dh,
                        dh,
                        q, q, q,
                        dh,
                        q, Q, q,
                        h, q,
                        q, h,
                        dh
                    ]
                }),
                new ComposedLevel({
                    name: "Slowly at First Again",
                    description: `Can you believe those dotted half notes (${Note.half.dotted.inlineNotation}) are only one beat long now? And that the quarter notes (${Note.quarter.inlineNotation}) are &frac13; of a beat?<br/>
                    <br/>
                    I can. I can believe anything. Aren't you jealous?<br/>
                    <br/>
                    Right now I believe there's an invisible dragon watching you perform. I believe he's impressed.`,
                    timeSignature: new TimeSignature(1, dh),
                    tempo: 46,
                    notes: [
                        h, q,
                        q, q, q,
                        h, q,
                        dh,
                        h, q,
                        q, e, e, q,
                        q, h,
                        dh
                    ]
                }),
                new ComposedLevel({
                    name: "Slowly at Second Again",
                    description: `Have you noticed the little eighth notes (${Note.eighth.inlineNotation}), being all &frac16;-of-a-beat-y? We're able to write any of our favorite compound rhythms in our new time signature&mdash;everything's just half as long as you're used to.`,
                    timeSignature: new TimeSignature(1, dh),
                    tempo: 46,
                    notes: [
                        e, e, q, q,
                        dq, e, q,
                        e, e, q, q,
                        dh,
                        e, e, q, q,
                        dq, e, q,
                        e, e, e, e, e, e,
                        dh
                    ]
                }),
                new ComposedLevel({
                    name: "A Little Faster Now Again",
                    description: "These pieces are so familiar, yet different. Like if you cloned yourself, but then parted ways for a year and then met up for dinner to compare lives.",
                    timeSignature: new TimeSignature(1, dh),
                    tempo: 60,
                    notes: [
                        dh,
                        q, q, q,
                        q, e, e, e, e,
                        dh,
                        q, q, q,
                        q, dq, e,
                        q, e, e, q,
                        dh
                    ]
                }),
                new ComposedLevel({
                    name: "A Little Faster Still Again",
                    description: "To be clear, in the previous level, I was talking about the weird sci-fi kind of cloning, not real cloning, where your clone would be a 1-year-old at dinner and not have any of your memories anyway.<br/>Why would you take a 1-year-old to a restaurant?<br/>And it's very irresponsible of you to abandon a newborn for a year.<br/><br/>Poor choices all around, here, really.",
                    timeSignature: new TimeSignature(1, dh),
                    tempo: 60,
                    notes: [
                        q, e, e, q,
                        q, dq, e,
                        q, e, e, q,
                        dh,
                        q, e, e, q,
                        q, dq, e,
                        e, e, e, e, e, e,
                        dh
                    ]
                }),
                new QuizLevel({
                    name: "Pre-Waltz Check for Faults",
                    description: `Everything's a bit shorter than you're used to. Including this text.`,
                    questions: Question.noteLengths(new TimeSignature(1, dh), dh, h, dq, q, e).concat([
                        Question.noteRelationship(e, dq, [q, h, dh])
                    ])
                }),
                new ComposedLevel({
                    name: "Viennese Waltz",
                    description: `I hate it when people think they can just waltz into my room, when the music I'm listening to is clearly in ${TimeSignature.fourFour.inlineNotation}.`,
                    timeSignature: new TimeSignature(1, dh),
                    tempo: 60,
                    notes: [
                        q, e, e, e, e,
                        dq, e, q,
                        h, e, e,
                        q, Q, Q,
                        q, e, e, e, e,
                        q, dq, e,
                        q, Q, e, e,
                        dh
                    ]
                })
            ]
        });

        newSkill({
            id: "fiveFour",
            name: "Five Four",
            knownCounts: Count.allSimpleBasic,
            levels: [
                new ComposedLevel({
                    name: "3+2 is Easy",
                    description: `Where are the strong beats in this time signature? I know if I need some help moving furniture, I'm calling <strong>1</strong> and <strong>4</strong>.`,
                    timeSignature: TimeSignature.fiveFour,
                    tempo: 100,
                    notes: [
                        dh, h,
                        q, q, q, h,
                        h, q, h,
                        q, q, q, q, Q,
                        q, Q, q, q, q,
                        q, q, q, h,
                        q, q, q, q, q,
                        dh, H
                    ]
                }),
                new ComposedLevel({
                    name: "3+2 is... Hard?",
                    description: `Do the thing again, but with more stuff.`,
                    timeSignature: TimeSignature.fiveFour,
                    tempo: 100,
                    notes: [
                        q, q, q, e, e, q,
                        e, e, e, e, q, e, e, q,
                        dq, e, q, e, e, q,
                        q, e, e, e, e, h,
                        E, e, E, e, E, e, e, e, q,
                        q, dq, e, e, e, q,
                        e, e, q, e, e, e, e, e, e,
                        dh, q, Q
                    ]
                }),
                new ComposedLevel({
                    name: "2+3 is Easy",
                    description: `...This... doesn't feel the same. Maybe <strong>4</strong> hurt his back moving my furniture earlier...<br/>
                    I'm pretty sure <strong>3</strong> is our heavy lifter now.`,
                    timeSignature: TimeSignature.fiveFour,
                    tempo: 100,
                    notes: [
                        h, dh,
                        q, q, dh,
                        h, q, q, q,
                        h, DH,
                        q, q, h, q,
                        h, q, h,
                        h, q, q, q,
                        h, Q, Q, Q
                    ]
                }),
                new ComposedLevel({
                    name: "Nah, That's Hard Too",
                    description: `I'll say to you what I said to that construction equipment manufacturer one time: you know the drill.`,
                    timeSignature: TimeSignature.fiveFour,
                    tempo: 100,
                    notes: [
                        e, e, q, dh,
                        dq, e, dh,
                        E, e, E, e, h, q,
                        h, H, q,
                        e, e, e, e, dq, e, q,
                        e, e, q, e, e, e, e, q,
                        dq, e, dq, e, e, e,
                        q, Q, q, H
                    ]
                }),
                new RandomLevel({
                    name: "Addition is Commutative",
                    description: `I think it's clear now that ${TimeSignature.fiveFour.inlineNotation} is leading a double life: sometimes that 5 is 3+2, and other times it's 2+3.<br/>
                    <br/>
                    So&mdash;since those are basically two different time signatures&quot;I would never make you clap a piece that jumps back and forth between them. Right?<br/>
                    <br/>
                    <br/>
                    Wrong.`,
                    timeSignature: TimeSignature.fiveFour,
                    tempo: 100,
                    bars: 8,
                    blocks: [
                        new Block([dh], [0, 2]),
                        new Block([dh], [0, 2]),
                        new Block([h]),
                        new Block([h]),
                        new Block([q]),
                        new Block([q]),
                        new Block([dq, e]),
                        new Block([dq, e]),
                        new Block([e, e]),
                        new Block([E, e])
                    ]
                })
            ]
        })

        newSkill({
            id: "bottomNumber",
            name: "The Bottom &quot;Number&quot;",
            knownCounts: Count.allSimpleBasic,
            levels: [
                new ComposedLevel({
                    name: "Twice the Length: Easy",
                    description: `The bottom number of the time signature has a secret: it's <em>not a number</em>.<br/>
                    It's a <em>note</em>. And yes, it's in disguise&mdash;but it's <em>terrible</em> at disguises, because we all know who's in there:<br/>
                    <strong>8</strong> for <strong>8</strong>th note (${Note.eighth.inlineNotation}). <strong>4</strong> for <strong>quarter</strong> note (${Note.quarter.inlineNotation}). <strong>2</strong> for <strong>half</strong> note (${Note.half.inlineNotation}).<br/>
                    <br/>
                    Specifically, the bottom of the time signature tells us <strong>what note gets one beat</strong>. The 4 we're used to seeing down there is a <strong>4</strong> for <strong>quarter</strong> note&mdash;and it's the <em>only</em> reason that quarter notes (${Note.quarter.inlineNotation}) have been one beat long so far.<br/>
                    <br/>
                    What if we change it to an <strong>8</strong>? <strong>Eighth notes</strong> (${Note.eighth.inlineNotation}) are now <strong>one beat long</strong>. (And that means <strong>quarter notes</strong> (${Note.quarter.inlineNotation}) must be <strong>two</strong>! AGH! Everything is different!)`,
                    timeSignature: new TimeSignature(4, e),
                    tempo: 80,
                    notes: [
                        e, e, e, e,
                        q, q,
                        e, e, e, e,
                        h,
                        e, e, e, e,
                        e, e, q,
                        q, q,
                        h
                    ]
                }),
                new ComposedLevel({
                    name: "Twice the Length: Medium",
                    description: "Fun, right? No? Disorienting? Annoying that everything's twice as long as you're used to?<br/>That's okay, then. We'll just go back to our familiar 4 on the bottom.<br/><br/>...You didn't actually <em>believe</em> that, did you?",
                    timeSignature: new TimeSignature(4, e),
                    tempo: 80,
                    notes: [
                        e, e, q,
                        e, e, q,
                        e, e, e, e,
                        q, q,
                        e, e, q,
                        e, e, q,
                        e, E, E, e,
                        h
                    ]
                }),
                new QuizLevel({
                    name: "Twice the Length: Theory",
                    description: `While you were working on that last one, I wrote you a song.<br/>
                    <br/>
                    <em>🎵 La la la, we know an eighth note's (${Note.eighth.inlineNotation}) one beat in this song<br/>
                    Ooh, you know a quarter note's (${Note.quarter.inlineNotation}) twice as long!<br/>
                    So a quarter's two, so if you dot it it's three (${Note.quarter.dotted.inlineNotation}),<br/>
                    Whoah oh oh. Whoah oh oh. 🎶</em><br/>
                    <br/>
                    I didn't spend a lot of time on it. I had other things to do.`,
                    questions: Question.noteLengths(new TimeSignature(4, e), h, q, e, dq)
                }),
                new ComposedLevel({
                    name: "Twice the Length: Hard",
                    description: `I know my little song from last time wasn't great... but I hope you memorized every single lyric anyway!`,
                    timeSignature: new TimeSignature(3, e),
                    tempo: 80,
                    notes: [
                        q, e,
                        q, e,
                        e, q,
                        dq,
                        e, q,
                        e, q,
                        q, e,
                        dq
                    ]
                }),
                new ComposedLevel({
                    name: "Half the Length: Easy",
                    description: `Finally getting used to it, right? Great! Let's do something totally different.<br/>
                    What if we put a 2 down there? <strong>2</strong> for <strong>half</strong> note (${Note.half.inlineNotation}); <strong>half notes</strong> are now <strong>one</strong> beat.`,
                    timeSignature: new TimeSignature(4, h),
                    tempo: 80,
                    notes: [
                        h, h, w,
                        h, h, w,
                        h, h, h, h,
                        w, W,
                        w, h, h,
                        w, h, h,
                        h, h, h, h,
                        w, W
                    ]
                }),
                new ComposedLevel({
                    name: "Half the Length: Medium",
                    description: `Do you understand that because two half notes (${Note.half.inlineNotation}) fit in a whole note (${Note.whole.inlineNotation}), and half notes are <strong>one</strong> beat now, that a <strong>whole note</strong> must be <strong>two</strong> beats?<br/>
                    <br/>
                    No? So I <em>half</em> to explain the <em>whole</em> thing?`,
                    timeSignature: new TimeSignature(3, h),
                    tempo: 80,
                    notes: [
                        h, h, h,
                        H, h, h,
                        h, w,
                        h, W,
                        h, h, h,
                        H, h, h,
                        w, h,
                        dw,
                    ]
                }),
                new QuizLevel({
                    name: "Half the Length: Theory",
                    description: `If half notes (${Note.half.inlineNotation}) are one beat long, what about quarter notes (${Note.quarter.inlineNotation})? Two quarter notes still have to fit in one half note, so quarter notes must only be <strong>half a beat</strong>!<br/><br/>Aww. Tiny little quarter notes. They're so cute!`,
                    questions: Question.noteLengths(new TimeSignature(3, h), w, h, q, dw)
                }),
                new ComposedLevel({
                    name: "Half the Length: Hard",
                    description: `You're doing pretty well, considering your whole musical universe just shifted.<br/>
                    <br/>
                    How cool is it to know that we can change the lengths of <em>all</em> the notes just by messing with the bottom of our time signature!?<br/>
                    I mean, some of them might try to hide when the length-changing begins, but we'll find them.<br/>
                    <br/>
                    We'll find them <em>all</em>. MuaHahAaHAhaAhaha...`,
                    timeSignature: new TimeSignature(4, h),
                    tempo: 60,
                    notes: [
                        h, h, w,
                        q, q, q, q, w,
                        h, h, w,
                        h, Q, q, w,
                        h, h, w,
                        q, q, q, q, w,
                        h, Q, q, w,
                        DW, h
                    ]
                }),
                new ComposedLevel({
                    name: "Let's Get Nuts",
                    description: `Can we put a 1 on the bottom? Sure, we can! Why would we ever want <strong>whole notes</strong> (${Note.whole.inlineNotation}) to be <strong>one beat</strong> long? I... really don't know... But now they are!`,
                    timeSignature: new TimeSignature(3, w),
                    tempo: 80,
                    notes: [
                        w, w, w,
                        h, h, h, h, w,
                        w, w, w,
                        dw, h, w
                    ]
                }),
                new QuizLevel({
                    name: "Theory of Doom",
                    description: `Feeling pretty confident now, aren't we? Let's see what we can do about that...`,
                    questions: Question.noteLengths(new TimeSignature(4, h), w, h, q).concat(Question.noteLengths(new TimeSignature(4, q), h, q, e)).concat(Question.noteLengths(new TimeSignature(4, e), h, q, e)).concat([
                        Question.noteRelationship(e, dq, [q, h, dh])
                    ])
                })
            ]
        });

        newSkill({
            id: "compoundTime1",
            name: "Compound Time",
            knownCounts: Count.allCompoundBasic,
            levels: [
                new ComposedLevel({
                    name: "Bald-faced Lies!",
                    description: `Psst! Over here! Listen, we've got a problem: we've been making <strong>quarter notes</strong> (${Note.quarter.inlineNotation}) one beat long for most of our pieces. And now we've played with <strong>eighth notes</strong> (${Note.eighth.inlineNotation}) getting the beat, <strong>half notes</strong> (${Note.half.inlineNotation}) getting the beat, and even <strong>whole notes</strong> (${Note.whole.inlineNotation}) getting the beat! (By the way, I apologize for that last one. That was just weird.)<br/>
                    Well, the <strong>dotted quarter notes</strong> (${Note.quarter.dotted.inlineNotation}) have been watching us, and they're pretty jealous. Can we make a <strong>dotted quarter note</strong> one beat long&mdash;just to make them feel better?<br/>
                    Thanks; you're so nice.<br/>
                    <br/>
                    But, oh! What number can we put on the bottom of a time signature to mean &quot;dotted quarter note&quot;? Uhh... okay, here's the plan: let's just lie. We'll know the time signature is <em>really</em> <strong>two</strong> over <strong>dotted quarter note</strong>, but we'll just write ${TimeSignature.sixEight.inlineNotation}, because I don't have the time or energy to figure out how to write &quot;dotted quarter note&quot; as a number.<br/>
                    <br/>
                    That'll work out fine. We'll make the dotted quarter notes happy. Just pretend the time signature says <strong>two</strong> over <strong>dotted quarter note</strong> (${Note.quarter.dotted.inlineNotation}). Shh!`,
                    timeSignature: TimeSignature.sixEight,
                    backingLoop: 0,
                    tempo: 100,
                    notes: [
                        dq, dq,
                        dh,
                        dq, dq,
                        dh, 
                        dq, dq,
                        dq, dq,
                        dq, dq,
                        dh
                    ]
                }),
                new ComposedLevel({
                    name: "This is Fine.",
                    description: `Okay... this is going just fine. The dotted quarters (${Note.quarter.dotted.inlineNotation}) sure love being the beat. They threw a little party for us. There was cake. I forgot to tell you about it. It was delicious. Let's do another.<br/>
                    Just remember: there are <strong>two</strong> beats per measure, and a <strong>dotted quarter note</strong> is one beat long&mdash;no matter what the time signature <em>claims</em>.<br/>
                    <br/>
                    Say... that means that <strong>dotted half notes</strong> (${Note.half.dotted.inlineNotation}) are <strong>two</strong> beats long, right? Mmm... two... the number of cakes they gave us at the party...<br/>
                    <br/>
                    I ate yours.`,
                    timeSignature: TimeSignature.sixEight,
                    tempo: 100,
                    notes: [
                        dq, DQ,
                        dq, DQ,
                        dq, dq,
                        dh,
                        DQ, dq,
                        DQ, dq,
                        dq, dq,
                        dh
                    ]
                }),
                new ComposedLevel({
                    name: "The Third One",
                    description: `How many eighth notes (${Note.eighth.inlineNotation}) fit in a dotted quarter (${Note.quarter.dotted.inlineNotation})? Oh, no reason. I'm asking for a friend. I certainly didn't cram three of them in there while you weren't looking, without checking if that was correct.<br/>
                    But... it <em>is</em> three, right?<br/>
                    <br/>
                    Oh. Good. So... they're &frac13; of a beat each. You're gonna need some new words:
                    <ul>
                        <li><strong>&frac13;</strong> of the way through the beat is called &quot;ta&quot;. As in, &quot;We're counting <em>thirds</em> now? Ta ta; I'm out of here!&quot;</li>
                        <li><strong>&frac23;</strong> of the way through the beat is called &quot;ma&quot;. As in, &quot;We're counting <em>thirds</em> now? Ma! Ma ma! I need my mommy!&quot;</li>
                    </ul>`,
                    timeSignature: TimeSignature.sixEight,
                    tempo: 80,
                    notes: [
                        e, e, e, e, e, e,
                        dq, dq,
                        e, e, e, e, e, e,
                        dh,
                        e, e, e, e, e, e,
                        dq, dq,
                        e, e, e, e, e, e,
                        dh
                    ]
                }),
                new ComposedLevel({
                    name: "The Other Third One",
                    description: `You're not having trouble with these thirds, are you? I know it can be confusing: there's a fine line between numerator and denominator.`,
                    timeSignature: TimeSignature.sixEight,
                    tempo: 80,
                    notes: [
                        e, e, e, dq,
                        e, e, e, dq,
                        e, e, e, e, e, e,
                        dh,
                        dq, e, e, e,
                        dq, e, e, e,
                        e, e, e, e, e, e,
                        dq, DQ
                    ]
                }),
                new QuizLevel({
                    name: "One Third or Two?",
                    description: `It's really okay if you're struggling: five out of four people have trouble with fractions.`,
                    questions: Question.counts(Count.allCompoundBasic)
                }),
                new ComposedLevel({
                    name: "Ma",
                    description: `Would you prefer I say that an eighth note (${Note.eighth.inlineNotation}) is <strong>0.3333...</strong> beats long? Y'know, just in case you like decimals better.<br/>
                    <br/>
                    Personally, I prefer fractions, but some people say they're <em>pointless</em>.`,
                    timeSignature: TimeSignature.sixEight,
                    tempo: 60,
                    notes: [
                        e, e, e, dq,
                        e, E, e, dq,
                        q, e, dq,
                        dh,
                        e, E, e, e, E, e,
                        q, e, q, e,
                        e, E, e, e, E, e,
                        dh
                    ]
                }),
                new ComposedLevel({
                    name: "Ma-more",
                    description: `Truly, if you'd prefer decimals, (you're wrong but) just go for it! Let's just not fight about it: it's so <em>divisive</em>.`,
                    timeSignature: TimeSignature.sixEight,
                    tempo: 80,
                    notes: [
                        q, e, dq,
                        q, e, dq,
                        q, e, q, e,
                        e, e, e, dq,
                        dq, q, e,
                        dq, q, e,
                        e, e, e, q, e,
                        e, E, E, DQ
                    ]
                }),
                new ComposedLevel({
                    name: "Ta",
                    description: `You know what the bottom number of a fraction is called if the fraction represents an amount of cake?<br/>
                    <br/>
                    A de-nom-nom-nom-inator!`,
                    timeSignature: TimeSignature.sixEight,
                    tempo: 60,
                    notes: [
                        e, e, e, dq,
                        e, e, E, dq,
                        e, q, dq,
                        dh,
                        e, e, E, e, e, E,
                        e, q, e, q,
                        e, e, E, e, e, E,
                        dh
                    ]
                }),
                new ComposedLevel({
                    name: "Ta II: The Return",
                    description: `I'd keep going with these jokes, but I'm afraid only a fraction of people will enjoy them.`,
                    timeSignature: TimeSignature.sixEight,
                    tempo: 80,
                    notes: [
                        e, q, dq,
                        e, q, dq,
                        e, q, e, q,
                        e, e, e, dq,
                        dq, e, q,
                        dq, e, q,
                        e, e, e, e, q,
                        e, E, E, DQ
                    ]
                }),
                new QuizLevel({
                    name: "Compound Theory",
                    description: `Have you thought about how long a quarter note (${Note.quarter.inlineNotation}) is in this time signature?<br/>
                    What?<br/>
                    No, not two beats long! Shh! That's how long it'd be if we were taking the time signature literally! We're giving the dotted quarter note (${Note.quarter.dotted.inlineNotation}) the beat instead, remember?<br/><br/>
                    Eighth notes (${Note.eighth.inlineNotation}) are &frac13; of a beat... and two of them add up to a quarter note, so... a quarter note is &frac13;+&frac13;=<strong>&frac23;</strong> of a beat.`,
                    questions: Question.noteLengths(TimeSignature.sixEight, dh, dq, q, e).concat([
                        Question.noteRelationshipSimple(dq, dh),
                        Question.noteRelationship(e, dq, [q, h, dh]),
                        Question.noteRelationship(e, dh, [q, dq, h])
                    ])
                }),
                new ComposedLevel({
                    name: "Crossover Episode",
                    description: `It's ta meets ma, and ma meets ta! Tune in for some hilarious hijinks!`,
                    timeSignature: TimeSignature.sixEight,
                    tempo: 60,
                    notes: [
                        q, e, q, e,
                        q, e, dq,
                        e, q, e, q,
                        e, q, dq,
                        q, e, dq,
                        e, q, dq,
                        e, e, e, e, e, e,
                        dh
                    ]
                }),
                new ComposedLevel({
                    name: "Back and Forth",
                    description: `And forth and back!`,
                    timeSignature: TimeSignature.sixEight,
                    tempo: 60,
                    notes: [
                        q, e, dq,
                        e, q, dq,
                        q, e, q, e,
                        e, q, dq,
                        e, q, e, q,
                        q, e, q, e,
                        e, q, q, e,
                        e, e, e, dq
                    ]
                }),
                new ComposedLevel({
                    name: "Compounding Compound Rhythms",
                    description: `My, we really have gotten stuck in this lie, haven't we?<br/>
                    Oh, well!<br/>
                    <br/>
                    (Actually, reading time signatures like this (by squishing together <strong>three</strong> of the beats the time signature suggests to make the <em>real</em> beats) is quite common (unlike nested parentheses, which is Not Usually Okay&trade; (sorry English teachers)) and it's called &quot;compound time&quot; (when we read time signatures this way, not when we nest parentheses (although I guess you could name that &quot;compound parentheses&quot; (if you really wanted to))).)`,
                    timeSignature: TimeSignature.sixEight,
                    tempo: 60,
                    notes: [
                        e, e, e, q, e,
                        e, q, e, e, e,
                        q, e, q, e,
                        dq, DQ,
                        e, q, e, q,
                        e, e, e, e, q,
                        e, e, e, q, e,
                        dh
                    ]
                }),
                new RandomLevel({
                    name: "Compound Rhythmsing poundCom",
                    description: `Same, but different (every time).`,
                    timeSignature: TimeSignature.sixEight,
                    tempo: 60,
                    bars: 8,
                    blocks: [
                        Block.required([q, e]),
                        Block.required([e, q]),
                        Block.required([e, e, e]),
                        Block.required([dq]),
                        new Block([dh])
                    ]
                })
            ]
        })

        newSkill({
            id: "compoundTime2",
            name: "Have a Rest",
            knownCounts: Count.allCompoundBasic,
            levels: [
                new ComposedLevel({
                    name: "Ma One is Gone",
                    description: `Let's continue in compound time, but now with a bunch of rests!<br/>
                    What's that? Oh, you though you could have a nice rest?<br/>
                    <br/>
                    Nope! No rest! Only <em>rests</em>.`,
                    timeSignature: TimeSignature.sixEight,
                    tempo: 80,
                    notes: [
                        q, e, dq,
                        Q, e, dq,
                        Q, e, q, e,
                        dh,
                        Q, e, q, e,
                        Q, e, Q, e,
                        q, e, q, e,
                        dh
                    ]
                }),
                new ComposedLevel({
                    name: "Ta-ta, One!",
                    description: `People always tell me that my metaphor of &quot;bouncing <strong>ta</strong> off of your <strong>tap</strong> on the beat&quot; helps them clap it correctly&mdash;just a little bit after the beat!<br/>
                    <br/>
                    Of course, people also tell me, &quot;Stop teaching us counting&mdash;we came to the theatre to watch the movie!&quot; and, &quot;Get down from that arm rest; I can't see the screen!&quot; so... you be the judge!`,
                    timeSignature: TimeSignature.sixEight,
                    tempo: 80,
                    notes: [
                        e, q, dq,
                        E, q, dq,
                        E, q, E, q,
                        dh,
                        E, q, E, q,
                        E, q, E, q,
                        e, q, e, q,
                        DH
                    ]
                }),
                new ComposedLevel({
                    name: "We're Missing One",
                    description: `AUghGhgh the tas and mas have taken over! There's nothing left! Nothing, I tell you!<br/>
                    <br/>
                    Nothing on the beat, at least.`,
                    timeSignature: TimeSignature.sixEight,
                    tempo: 60,
                    notes: [
                        E, e, e, E, e, e,
                        dq, dq,
                        E, e, e, dq,
                        DQ, dq,
                        E, e, e, E, e, e,
                        dq, dq,
                        dq, E, e, e,
                        e, e, e, e, Q
                    ]
                }),
                new ComposedLevel({
                    name: "Back and &quot;Fourth&quot;",
                    pageTitle: "Back and \"Fourth\"",
                    description: `Ready to accidentally clap in a bunch of rests?<br/>
                    <br/>
                    No?<br/>
                    Well, that's probably what's about to happen!`,
                    timeSignature: TimeSignature.sixEight,
                    tempo: 80,
                    notes: [
                        Q, e, q, e,
                        Q, e, q, e,
                        E, q, E, q,
                        dh,
                        E, e, e, E, e, e,
                        E, q, E, q,
                        Q, e, q, e,
                        dh
                    ]
                }),
                new QuizLevel({
                    name: "Compound Theory: Rest Edition",
                    description: `Second verse, same as the first&mdash;only rest-ier!`,
                    questions: Question.noteLengths(TimeSignature.sixEight, DH, DQ, Q, E).concat([
                        Question.noteRelationshipSimple(DQ, DH),
                        Question.noteRelationship(E, DQ, [Q, H, DH]),
                        Question.noteRelationship(E, DH, [Q, DQ, H]),
                    ])
                }),
                new ComposedLevel({
                    name: "Old Friends",
                    description: `Let's go back to visit some old friends.<br/>
                    They look different from how I remember them; I guess they've grown during our time apart. They told me they miss you.<br/>
                    <br/>
                    They also told me you might not recognize them if you count unnecessary eighth rests, so, y'know... be careful and stuff.`,
                    timeSignature: TimeSignature.sixEight,
                    tempo: 80,
                    notes: [
                        e, E, e, e, E, e,
                        dh,
                        e, e, E, e, e, E,
                        dh,
                        e, e, e, e, E, E,
                        e, e, e, e, Q,
                        e, E, e, e, e, E,
                        DQ, dq
                    ]
                }),
                new RandomLevel({
                    name: "All the Rest",
                    description: `I'm sure as you were completing the previous levels you were thinking &quot;this would be way more fun if these were random and harder&quot;&mdash;no?<br/>
                    Well, it's too late for me to change this level now. You should've said something earlier!`,
                    timeSignature: TimeSignature.sixEight,
                    tempo: 60,
                    bars: 8,
                    blocks: [
                        Block.required([e, E, e]),
                        Block.required([e, e, E]),
                        Block.required([E, e, e]),
                        Block.required([DQ]),
                        Block.required([E, q]),
                        Block.required([Q, e]),
                        new Block([q, e]),
                        new Block([e, q]),
                        new Block([e, e, e]),
                        new Block([dq]),
                        new Block([dh])
                    ]
                })
            ]
        })

        newSkill({
            id: "nineEight",
            name: "Nine Eight",
            knownCounts: Count.allCompoundBasic,
            levels: [
                new ComposedLevel({
                    name: "Extending the Lie",
                    description: `Our interpretation of ${TimeSignature.sixEight.inlineNotation} as two over dotted quarter note (${Note.quarter.dotted.inlineNotation}) went swimmingly, don't you think?<br/>
                    I wonder if we could try this with any <em>other</em> time signatures...<br/>
                    <br/>
                    If we gave dotted quarter notes (${Note.quarter.dotted.inlineNotation}) the beat again, how do you suppose we'd interpret ${TimeSignature.nineEight.inlineNotation}? How many beats would there be per measure?<br/>
                    <br/>
                    <br/>
                    Okay, I'll give you a hint. Ready? The answer is greater than 0, but less than 4,294,967,296.`,
                    timeSignature: TimeSignature.nineEight,
                    tempo: 100,
                    notes: [
                        dq, dq, dq,
                        dq, DQ, dq,
                        dq, dq, dq,
                        dh, dq,
                        dq, DH,
                        dq, DH,
                        dq, dh,
                        dh, DQ
                    ]
                }),
                new ComposedLevel({
                    name: "Thirds in Three",
                    description: `Remember, the time signature is <em>really</em> <strong>3</strong> over <strong>dotted quarter note</strong> (${Note.quarter.dotted.inlineNotation}).<br/>
                    Since a dotted quarter note (${Note.quarter.dotted.inlineNotation}) is one beat long, eighth notes (${Note.eighth.inlineNotation}) are <strong>&frac13; of a beat</strong>.<br/>
                    <br/>
                    The eighth notes work just like before, in six eight, except there are <em>more</em> of them now in each measure. A <em>lot</em> more. Well, <em>three</em> more. I guess that's not a lot.<br/>
                    But they do outnumber us... so don't make them mad by miscounting them! They hate being miscounted.`,
                    timeSignature: TimeSignature.nineEight,
                    tempo: 80,
                    notes: [
                        dq, dq, e, e, e,
                        dq, e, e, e, dq,
                        e, e, e, e, e, e, e, e, e,
                        dh, DQ,
                        e, e, e, dq, dq,
                        e, e, e, e, e, e, dq,
                        dq, e, e, e, e, e, e,
                        e, e, e, e, e, e, dq
                    ]
                }),
                new ComposedLevel({
                    name: "Ma-most",
                    description: `Remember our good friend &quot;ma&quot; who lives &frac23; of the way through the beat? Well, she said that she thinks of herself as living 0.666... of the way through the beat, because she prefers decimals to fractions.<br/>
                    "Ta", on the other hand, thinks &frac13; is way cooler than 0.333... no matter <em>how</em> many threes there are in there!<br/>
                    <br/>
                    I guess opinions are... divided.`,
                    timeSignature: TimeSignature.nineEight,
                    tempo: 80,
                    notes: [
                        q, e, q, e, dq,
                        e, e, e, q, e, dq,
                        dq, q, e, q, e,
                        dh, DQ,
                        e, e, e, q, e, q, e,
                        e, e, e, e, e, e, dq,
                        q, e, dq, q, e,
                        q, e, e, e, e, dq
                    ]
                }),
                new ComposedLevel({
                    name: "Ta III: The Return of the Return",
                    description: `You thought we were done with fraction jokes, right? What can I say: I'm obsessed with fractions!<br/>
                    My latest hobby is simplifying them all&mdash;it's just so fun reducing every fraction I come across to lowest terms. Even if my friends tell me to stop. Even if my friends all leave and say they'll only start talking to me again if I stop simplifying all the fractions I see.<br/>
                    <br/>
                    Huh. Maybe I should've listened to them.<br/>
                    It seems obvious, looking back&mdash;but you know what they say: &quot;hindsight is 1.&quot;`,
                    timeSignature: TimeSignature.nineEight,
                    tempo: 80,
                    notes: [
                        e, e, e, e, e, e, dq,
                        e, q, e, q, dq,
                        e, q, dq, dq,
                        e, q, e, q, dq,
                        e, e, e, e, q, dq,
                        e, q, e, q, dq,
                        e, q, e, q, e, q,
                        e, q, e, q, DQ
                    ]
                }),
                new ComposedLevel({
                    name: "Mix & Match",
                    description: `Be on your guard&mdash;the quarter notes and eighth notes like to switch places when you're not looking.`,
                    timeSignature: TimeSignature.nineEight,
                    tempo: 60,
                    notes: [
                        q, e, q, e, dq,
                        e, q, e, q, dq,
                        e, q, dq, q, e,
                        e, q, q, e, dq,
                        e, e, e, e, q, dq,
                        q, e, q, e, dq,
                        e, q, e, q, e, q,
                        q, e, e, q, dq
                    ]
                }),
                new ComposedLevel({
                    name: "Good Fthreeling",
                    description: `Let's wrap this up! And by &quot;this&quot; I mean &quot;everything we've learned so far&quot;.<br/>
                    And by &quot;wrap&quot;... I mean &quot;speed&quot;.`,
                    timeSignature: TimeSignature.nineEight,
                    tempo: 80,
                    notes: [
                        q, e, e, e, e, dq,
                        e, e, e, q, e, dq,
                        q, e, q, e, q, e,
                        e, q, dh,
                        e, e, e, q, e, dq,
                        e, e, e, e, q, dq,
                        q, e, e, e, e, e, e, e,
                        e, q, e, q, dq
                    ]
                })
            ]
        })

        newSkill({
            id: "compoundTime3",
            name: "Meet Sixteenth Notes: Compound",
            knownCounts: Count.allCompound,
            levels: [
                new ComposedLevel({
                    name: "Subdividing",
                    description: `Sixteenth notes (${Note.sixteenth.inlineNotation}) look like eighth notes (${Note.eighth.inlineNotation}), except they have a second beam or second flag. Somehow, this makes them go faster. It doesn't look very aerodynamic to me.<br/>
                    Whatever. The point is, they're only <strong>one <em>sixth</em></strong> of a beat long&mdash;half as long as eighth notes! Ready?<br/>
                    <br/>
                    No. No, you're not ready. You need to know a whole ton of stuff now:
                    <ul>
                        <li>You'll need to know the count for <strong>one sixth</strong> of the way through the beat: <strong>di</strong>. Pronounced "dee", like the first letter of &quot;<strong>d</strong>on't be frightened by the absurd number of new countings you're about to learn&quot;.</li>
                        <li>You <em>already know</em> the count for <strong>two sixths</strong> of the way through the beat, because one time a math teacher told me two sixths equals one third: <strong>ta</strong>.</li>
                        <li>You'll need to know the count for <strong>three sixths</strong> of the way through the beat: <strong>ti</strong> (pronounced "tee"). This one's really going to cook your noodle... ready? <strong>Yes</strong>, three sixths equals one half... and yet <strong>no</strong>, ti doesn't equal and. Let that simmer for a while.</li>
                        <li>You <em>already know</em> the count for <strong>four sixths</strong> of the way through the beat, because four sixths equals two thirds: <strong>ma</strong>. (And unlike with &quot;ti&quot;, math works.)</li>
                        <li>You'll need to know the count for <strong>five sixths</strong> of the way through the beat: <strong>mi</strong> (pronounced "mee"). Yes, this means the last two sixths of the beat are &quot;ma mi&quot;. And yes, that's hilarious and fun.</li>
                    </ul>`,
                    timeSignature: TimeSignature.sixEight,
                    tempo: 46,
                    notes: [
                        dh,
                        dq, dq, 
                        e, e, e, e, e, e,
                        s, s, s, s, s, s, dq,
                        s, s, s, s, s, s, e, e, e,
                        s, s, s, s, s, s, e, e, e,
                        e, e, e, s, s, s, s, s, s,
                        dh
                    ]
                }),
                new ComposedLevel({
                    name: "Building it Up",
                    description: `Have you noticed that six sixteenth notes (${Note.sixteenth.inlineNotation}) fit in a beat? No? Well... they do!`,
                    timeSignature: TimeSignature.sixEight,
                    tempo: 46,
                    notes: [
                        s, s, s, s, s, s, e, e, e,
                        s, s, s, s, s, s, e, e, e,
                        s, s, s, s, s, s, dq,
                        s, s, s, s, s, s, dq,
                        s, s, s, s, s, s, e, e, e,
                        e, e, e, e, e, e,
                        dq, dq,
                        dh
                    ]
                }),
                new ComposedLevel({
                    name: "One Beam or Two?",
                    description: `How many sixteenth notes (${Note.sixteenth.inlineNotation}) fit in an eighth note (${Note.eighth.inlineNotation})? Hint: it's the same as the minimum number of kittens everyone should have.`,
                    timeSignature: TimeSignature.sixEight,
                    tempo: 46,
                    notes: [
                        e, e, e, e, e, e,
                        s, s, s, s, s, s, e, e, e,
                        s, s, s, s, s, s, e, e, e,
                        dh,
                        e, e, e, s, s, s, s, s, s,
                        e, e, e, dq,
                        s, s, s, s, s, s, s, s, s, s, s, s,
                        dh
                    ]
                }),
                new QuizLevel({
                    name: "Know Your Sixths",
                    description: `Have you noticed all of our new counting friends end in an "eee" sound? <strong>Di</strong>, <strong>ti</strong>, <strong>mi</strong>. Just like how our old &frac13;-y friends shared an "ah" vowel&mdash;<strong>ta</strong>, <strong>ma</strong>.<br/>
                    <br/>
                    This information may help you remember them... which you may or may not need to do... <em>right now!</em>`,
                    questions: Question.counts(Count.allCompound)
                }),
                new ComposedLevel({
                    name: "Splitting the Beat: 1",
                    description: `Bye-bye, beat!`,
                    timeSignature: TimeSignature.sixEight,
                    tempo: 46,
                    notes: [
                        e, e, e, dq,
                        e, e, e, dq,
                        s, s, e, e, q, e,
                        dh,
                        s, s, e, e, dq,
                        s, s, e, e, dq,
                        s, s, e, e, s, s, e, e,
                        dh
                    ]
                }),
                new ComposedLevel({
                    name: "Splitting the Beat: 2",
                    description: `Beat, bye-bye!`,
                    timeSignature: TimeSignature.sixEight,
                    tempo: 46,
                    notes: [
                        dq, e, e, e,
                        dq, e, e, e,
                        dq, s, s, e, e,
                        dh,
                        q, e, s, s, e, e,
                        q, e, s, s, e, e,
                        s, s, e, e, s, s, e, e,
                        dh
                    ]
                }),
                new ComposedLevel({
                    name: "Splitting the Ta: 1",
                    description: `Ta-ta, ta!<br/>
                    <br/>
                    (Have you noticed that <strong>ta</strong> and its friend <strong>ti</strong> share a starting "t" consonant?)`,
                    timeSignature: TimeSignature.sixEight,
                    tempo: 46,
                    notes: [
                        e, e, e, e, q,
                        e, e, e, dq,
                        e, s, s, e, q, e,
                        dh,
                        e, s, s, e, e, e, e,
                        e, s, s, e, e, e, e,
                        e, s, s, e, e, s, s, e,
                        dh
                    ]
                }),
                new ComposedLevel({
                    name: "Splitting the Ta: 2",
                    description: `Ta, ta-ta!`,
                    timeSignature: TimeSignature.sixEight,
                    tempo: 46,
                    notes: [
                        dq, e, e, e,
                        dq, e, e, e,
                        dq, e, s, s, e,
                        dq, DQ,
                        dq, e, s, s, e,
                        q, e, e, s, s, e,
                        e, s, s, e, e, s, s, e,
                        e, e, e, dq
                    ]
                }),
                new ComposedLevel({
                    name: "Splitting the Ma: 1",
                    description: `M... m... I got nothing.<br/><br>Adi&ograve;s, ma!<br/>
                    <br/>
                    (Have you noticed that <strong>ma</strong> and its friend <strong>mi</strong> share a starting "m" consonant?)`,
                    timeSignature: TimeSignature.sixEight,
                    tempo: 46,
                    notes: [
                        e, e, e, dq,
                        e, e, e, dq,
                        e, e, s, s, q, e,
                        q, e, dq,
                        e, e, s, s, e, q,
                        e, e, s, s, dq,
                        e, e, s, s, e, e, s, s,
                        e, e, e, dq
                    ]
                }),
                new ComposedLevel({
                    name: "Splitting the Ma: 2",
                    description: `Uh... hasta la vista, ma.`,
                    timeSignature: TimeSignature.sixEight,
                    tempo: 46,
                    notes: [
                        dq, e, e, e,
                        q, e, e, e, e,
                        q, e, e, e, s, s,
                        e, e, e, DQ,
                        e, q, e, e, s, s,
                        e, e, e, e, e, s, s,
                        e, e, s, s, e, e, s, s,
                        e, e, s, s, dq
                    ]
                }),
                new QuizLevel({
                    name: "More Compound Theory",
                    description: `Welcome to the party, sixteenth notes (${Note.sixteenth.inlineNotation})! We've all been waiting for you. There's punch in the back, near the quarter rest.`,
                    questions: Question.noteLengths(TimeSignature.sixEight, dh, dq, q, e, s).concat([
                        Question.noteRelationship(s, e, [q, dq, dh]),
                        Question.noteRelationship(s, q, [e, dq, dh]),
                        Question.noteRelationship(s, dq, [e, q, dh])
                    ])
                }),
                new ComposedLevel({
                    name: "Splitting Them All",
                    description: `Keep your eye on the beams... one for &frac13; of a beat, two for &frac16; of a beat.<br/>
                    <br/>
                    ...Plus they're just plain suspicious.`,
                    timeSignature: TimeSignature.sixEight,
                    tempo: 46,
                    notes: [
                        s, s, e, e, q, e,
                        s, s, e, e, dq,
                        e, s, s, e, q, e,
                        e, s, s, e, dq,
                        e, e, s, s, e, q,
                        e, e, s, s, e, q,
                        s, s, e, e, e, s, s, e,
                        e, e, s, s, dq
                    ]
                }),
                new ComposedLevel({
                    name: "Splitting Them All Again",
                    description: "Are you still counting out loud? Sometimes it feels easier not to, but it's worth it&mdash;giving <em>names</em> to all these different parts of the beat is what helps us internalize the rhythms.<br/><br/>Plus, it makes them happy that someone knows their names.<br/>You've made many fractions very happy today. You're a swell person.",
                    timeSignature: TimeSignature.sixEight,
                    tempo: 46,
                    notes: [
                        e, e, s, s, e, e, s, s,
                        e, e, s, s, dq,
                        e, s, s, e, e, s, s, e,
                        e, s, s, e, dq,
                        s, s, e, e, s, s, e, e,
                        s, s, e, e, dq,
                        e, e, s, s, e, s, s, e,
                        s, s, e, e, dq
                    ]
                }),
                new ComposedLevel({
                    name: "Splitting Them All Again, Again",
                    description: "Keep it up&mdash;you're almost there! Plus, while you work on this one, I'll be making us a delicious dessert.",
                    timeSignature: TimeSignature.sixEight,
                    tempo: 46,
                    notes: [
                        e, e, e, q, e,
                        s, s, e, e, dq,
                        e, s, s, e, e, s, s, e,
                        s, s, e, e, dq,
                        e, q, e, q,
                        e, e, e, e, e, s, s,
                        e, s, s, e, s, s, e, e,
                        s, s, s, s, s, s, dq
                    ]
                }),
                new RandomLevel({
                    name: "Splitting Whatever",
                    description: "I threw all these rhythms in the mixer, and they've turned into a delicious batter. You perform&mdash;I'll be over here licking the beaters.<br/>AGHgAghGHGHGHHH!!<br/><br/>...I guess I should turn off the mixer first.",
                    timeSignature: TimeSignature.sixEight,
                    tempo: 46,
                    bars: 8,
                    blocks: [
                        Block.required([s, s, e, e]),
                        Block.required([e, s, s, e]),
                        Block.required([e, e, s, s]),
                        Block.required([q, e]),
                        Block.required([e, q]),
                        Block.required([e, e, e]),
                        new Block([dq]),
                        new Block([dh])
                    ]
                })
            ]
        })

        newSkill({
            id: "compoundTime4",
            name: "Advanced Compound Time",
            knownCounts: Count.allCompound,
            levels: [
                new ComposedLevel({
                    name: "Combining Ma Mi",
                    description: `&quot;Mommy&quot;? No&mdash;we're squishing the "ma" and the "mi" together into one big eighth note: <span style="font-size:4em;">${e.inlineNotation}</span>.<br/>
                    <br/>
                    ...I meant... <em>rhythmically</em> big.`,
                    timeSignature: TimeSignature.sixEight,
                    tempo: 46,
                    notes: [
                        s, s, s, s, s, s, dq,
                        s, s, s, s, e, dq,
                        s, s, s, s, e, s, s, s, s, e,
                        dq, DQ,
                        dq, s, s, s, s, s, s,
                        dq, s, s, s, s, e,
                        s, s, s, s, e, s, s, s, s, e,
                        s, s, s, s, e, DQ
                    ]
                }),
                new ComposedLevel({
                    name: "Combining with Di",
                    description: `&quot;Combiningd&quot;? &quot;Combinding&quot;? Public service announcement: there is not actually a &quot;d&quot; in &quot;combine&quot;.`,
                    timeSignature: TimeSignature.sixEight,
                    tempo: 46,
                    notes: [
                        s, s, s, s, s, s, dq,
                        e, s, s, s, s, dq,
                        e, s, s, s, s, e, s, s, s, s,
                        e, s, s, s, s, dq,
                        q, e, s, s, s, s, s, s,
                        q, e, e, s, s, s, s,
                        e, s, s, s, s, e, s, s, s, s,
                        e, s, s, s, s, dq
                    ]
                }),
                new ComposedLevel({
                    name: "Combining Ta Ti",
                    description: `Well, hello, friendly rhythm trainee!<br/>
                    Can you guess what this next piece will be?<br/>
                    You've seen "ta ma" before,<br/>
                    so you'll get a good score<br/>
                    with a missing sixteenth note on "ti".`,
                    timeSignature: TimeSignature.sixEight,
                    tempo: 46,
                    notes: [
                        s, s, s, s, s, s, dq,
                        s, s, e, s, s, dq,
                        s, s, e, s, s, s, s, e, s, s,
                        s, s, e, s, s, e, Q,
                        e, q, s, s, s, s, s, s,
                        e, q, s, s, e, s, s,
                        s, s, e, s, s, s, s, e, s, s,
                        s, s, e, s, s, dq
                    ]
                }),
                new ComposedLevel({
                    name: "Combining Them All",
                    description: `That Old Level "Splitting Them All": Now with Double Sixteenth Notes&trade;!`,
                    timeSignature: TimeSignature.sixEight,
                    tempo: 46,
                    notes: [
                        dq, dq,
                        e, s, s, s, s, dq,
                        s, s, e, s, s, e, e, e,
                        s, s, s, s, s, s, dq,
                        e, s, s, s, s, q, e,
                        s, s, s, s, e, dq,
                        s, s, s, s, e, s, s, e, s, s,
                        e, s, s, s, s, dq
                    ]
                }),
                new ComposedLevel({
                    name: "Splitting the Ma Again",
                    description: `Poor "ma", always getting chopped in half.<br/>
                    Getting chopped in half is no fun.<br/>
                    <br/>
                    Don't ask how I know.`,
                    timeSignature: TimeSignature.sixEight,
                    tempo: 60,
                    notes: [
                        q, e, dq,
                        q, e, dq,
                        q, s, s, dq,
                        q, s, s, dq,
                        e, e, e, q, e,
                        q, s, s, q, e,
                        q, s, s, q, s, s,
                        dh
                    ]
                }),
                new ComposedLevel({
                    name: "Splitting the Beat Again",
                    description: `Be-&nbsp;&nbsp;-at.`,
                    timeSignature: TimeSignature.sixEight,
                    tempo: 60,
                    notes: [
                        e, q, dq,
                        e, q, dq,
                        s, s, q, dq,
                        s, s, q, dq,
                        e, q, e, q,
                        s, s, e, e, e, q,
                        s, s, q, s, s, q,
                        dh
                    ]
                }),
                new ComposedLevel({
                    name: "Lots of Sixteenths",
                    description: `Did you know that "lot" technically just means "group"? It's only colloquially (in informal, slang usage) that it means "a <em>large</em> group".<br/>
                    Here, I am using it colloquially.<br/>
                    <br/>
                    In a moment, you're gonna see a large number of sixteenth notes, is what I'm sayin'.`,
                    timeSignature: TimeSignature.sixEight,
                    tempo: 46,
                    notes: [
                        q, e, e, s, s, s, s,
                        q, s, s, dq,
                        s, s, s, s, e, s, s, e, s, s,
                        e, s, s, s, s, dq,
                        s, s, q, s, s, q,
                        s, s, e, s, s, dq,
                        e, e, e, q, s, s,
                        q, s, s, dq
                    ]
                }),
                new RandomLevel({
                    name: "Lots of Mixed 'teenths",
                    description: `That's right, I used this pun for a skill name <em>and</em> a level name. Sue me.<br/>
                    <br/>
                    Disclaimer: please do not actually sue me for any reason.`,
                    timeSignature: TimeSignature.sixEight,
                    tempo: 46,
                    bars: 8,
                    blocks: [
                        Block.required([e, s, s, s, s]),
                        Block.required([s, s, e, s, s]),
                        Block.required([s, s, s, s, e]),
                        Block.required([q, s, s]),
                        Block.required([s, s, q]),
                        new Block([e, e, e]),
                        new Block([q, e]),
                        new Block([e, q]),
                        new Block([dq]),
                        new Block([dh])
                    ]
                }),
                new ComposedLevel({
                    name: "Dot Mi!",
                    description: `No, don't dot <em>me</em>&mdash;I don't want to be 1&frac12; times my current length! I'll hit my head on all the doorways!<br/>
                    We're not dotting "mi", either. It's dot, <em>then</em> "mi".<br/>
                    <br/>
                    What's that?<br/>
                    Yes, I suppose that <em>is</em> what commas are for. Fine:<br/>
                    <strong>Dot, Mi!</strong><br/>
                    <br/>
                    My bad.`,
                    timeSignature: TimeSignature.sixEight,
                    tempo: 46,
                    notes: [
                        dq, e, e, s, s,
                        dq, e, e, S, s,
                        dq, e, de, s,
                        q, e, dq,
                        dq, e, de, s,
                        q, e, e, de, s,
                        e, de, s, e, de, s,
                        e, de, s, dq
                    ]
                }),
                new ComposedLevel({
                    name: "Very Dotti",
                    description: `Much dot<br/><br/>so sixteenth note<br/><br/>Many "ti"`,
                    timeSignature: TimeSignature.sixEight,
                    tempo: 46,
                    notes: [
                        dq, e, s, s, e,
                        dq, e, S, s, e,
                        dq, de, s, e,
                        e, e, e, dq,
                        dq, de, s, e,
                        e, e, e, de, s, e,
                        de, s, e, de, s, e,
                        de, s, e, dq
                    ]
                }),
                new ComposedLevel({
                    name: "Mi Ti-me!",
                    description: `You've seen 1 ta mi.<br/>
                    <br/>
                    You've seen 1 ti ma.<br/>
                    <br/>
                    But what happens when they meet!?<br/>
                    <br/>
                    This. <em>This</em> happens when they meet.`,
                    timeSignature: TimeSignature.sixEight,
                    tempo: 46,
                    notes: [
                        e, de, s, dq,
                        e, de, s, dq,
                        de, s, e, dq,
                        dh,
                        de, s, e, q, e,
                        e, de, s, q, e,
                        de, s, e, e, de, s,
                        dh
                    ]
                }),
                new QuizLevel({
                    name: "All the Marbles",
                    description: `Prepare yourself. This is a quiz of astonishing length, and in which every question is harder than the one before.<br/>
                    You will be truly shocked by the breadth of what you're about to experience.<br/>
                    <br/>
                    And, all of the questions after the first one don't even have answers.<br/>
                    Also, after every 7 questions there's a dragon.`,
                    questions: [
                        Question.noteRelationship(s, de, [e, q, dq])
                    ]
                }),
                new ComposedLevel({
                    name: "Combining <sup>3</sup>&frasl;<sub>6</sub>",
                    pageTitle: "Combining 3/6",
                    description: `...What? <a href="https://en.wikipedia.org/wiki/Vacuous_truth">Technically everything I said in the last level is true.</a>`,
                    timeSignature: TimeSignature.sixEight,
                    tempo: 46,
                    notes: [
                        s, s, s, s, s, s, dq,
                        s, S, S, s, s, s, dq,
                        de, s, s, s, dq,
                        dh,
                        e, s, s, s, s, dq,
                        e, S, s, s, s, dq,
                        de, s, s, s, de, s, s, s,
                        dh
                    ]
                }),
                new ComposedLevel({
                    name: "Care for Some Ti?",
                    description: `Some folks, like mi and my ma, enjoy a hot cup of ti.`,
                    timeSignature: TimeSignature.sixEight,
                    tempo: 60,
                    notes: [
                        q, s, s, dq,
                        de, s, s, s, dq,
                        q, s, s, q, s, s,
                        de, s, s, s, dq,
                        de, s, s, s, q, s, s,
                        q, s, s, de, s, s, s,
                        q, s, s, q, s, s,
                        DH
                    ]
                }),
                new ComposedLevel({
                    name: "Dots Ahoy!",
                    description: `YARRR! Avast, mateys! Batten down the hatches and hoist the mainsails, for thar be <strong>dots</strong> ahead!<br/>
                    <br/>
                    Ahem. Sorry, sometimes I'm temporarily a pirate.`,
                    timeSignature: TimeSignature.sixEight,
                    tempo: 46,
                    notes: [
                        e, e, e, q, e,
                        e, de, s, q, e,
                        q, e, e, s, s, e,
                        de, s, e, dq,
                        de, s, e, e, e, e,
                        e, de, s, e, e, e,
                        de, s, e, e, de, s,
                        de, s, s, s, dq
                    ]
                }),
                new RandomLevel({
                    name: "Dots & Lots",
                    description: `It's tough, in spots. Might take a few shots.`,
                    timeSignature: TimeSignature.sixEight,
                    tempo: 46,
                    bars: 8,
                    blocks: [
                        Block.required([e, s, s, s, s]),
                        Block.required([s, s, e, s, s]),
                        Block.required([s, s, s, s, e]),
                        Block.required([q, s, s]),
                        Block.required([s, s, q]),
                        Block.required([e, de, s]),
                        Block.required([de, s, e]),
                        Block.required([de, s, s, s]),
                        new Block([dq]),
                        new Block([dq]),
                        new Block([dq]),
                        new Block([dq]),
                        new Block([dq]),
                        new Block([dq]),
                        new Block([dq]),
                        new Block([dq]),
                        new Block([dq]),
                        new Block([dq]),
                        new Block([dq]),
                        new Block([dq]),
                        new Block([q, e]),
                        new Block([q, e]),
                        new Block([q, e]),
                        new Block([q, e]),
                        new Block([q, e]),
                        new Block([q, e]),
                        new Block([q, e]),
                        new Block([q, e]),
                        new Block([e, q]),
                        new Block([e, q]),
                        new Block([e, q]),
                        new Block([e, q]),
                        new Block([e, e, e]),
                        new Block([e, e, e]),
                        new Block([e, e, e]),
                        new Block([e, e, e])
                    ]
                })
            ]
        })

        newSkill({
            id: "compoundTime5",
            name: "Very Advanced Compound Time",
            knownCounts: Count.allCompound,
            levels: [
                new ComposedLevel({
                    name: "Hidden Beat",
                    description: `Now, where could that beat have gone off to...?`,
                    timeSignature: TimeSignature.sixEight,
                    tempo: 46,
                    notes: [
                        s, s, s, s, s, s, dq,
                        S, s, s, s, s, s, dq,
                        S, s, s, s, s, s, S, s, s, s, s, s,
                        S, s, s, s, s, s, dq,
                        q, e, s, s, s, s, s, s,
                        dq, S, s, s, s, s, s,
                        S, s, s, s, s, s, S, s, s, s, s, s,
                        S, s, s, s, s, s, dq
                    ]
                }),
                new ComposedLevel({
                    name: "Hidden Ta",
                    description: `I found the beat! ...but I lost ta.<br/>
                    Come back, ta!<br/>
                    <br/>
                    I miss you.`,
                    timeSignature: TimeSignature.sixEight,
                    tempo: 46,
                    notes: [
                        s, s, s, s, e, dq,
                        s, s, S, s, e, dq,
                        s, e, s, e, q, e,
                        s, e, s, e, dq,
                        q, e, s, e, s, e,
                        e, e, e, s, e, s, e,
                        s, e, s, e, s, e, s, e,
                        s, e, s, e, dq
                    ]
                }),
                new ComposedLevel({
                    name: "Hidden Ma",
                    description: `Oh, welcome back, ta! Ma and I have been waiting for y... ma?<br/>
                    <br/>
                    Ma!?`,
                    timeSignature: TimeSignature.sixEight,
                    tempo: 46,
                    notes: [
                        e, s, s, s, s, dq,
                        e, s, s, S, s, dq,
                        e, s, e, s, q, e,
                        e, s, e, s, dq,
                        e, q, e, s, e, s,
                        e, e, e, e, s, e, s,
                        e, s, e, s, e, s, e, s,
                        e, s, e, s, e, Q
                    ]
                }),
                new ComposedLevel({
                    name: "Who's Missing Now?",
                    description: `Let's mix those up a bit.`,
                    timeSignature: TimeSignature.sixEight,
                    tempo: 46,
                    notes: [
                        q, e, s, e, s, e,
                        e, e, e, dq,
                        e, e, e, e, s, e, s,
                        e, s, e, s, dq,
                        s, e, s, e, e, e, e,
                        e, s, e, s, dq,
                        s, e, s, e, e, s, e, s,
                        dq, DQ
                    ]
                }),
                new ComposedLevel({
                    name: "Hidden Ta Ma",
                    description: `Sorry, ta, I'm glad you're back, but I don't know where ma went off t... ta? You were <em>just</em> here!<br/>
                    <br/>
                    Oh, you've <em>got</em> to be kidding me.`,
                    timeSignature: TimeSignature.sixEight,
                    tempo: 46,
                    notes: [
                        s, s, s, s, s, s, dq,
                        s, s, S, s, S, s, dq,
                        s, e, e, s, e, e, e,
                        s, e, e, s, dq,
                        q, e, s, e, e, s,
                        e, e, e, s, e, e, s,
                        s, e, e, s, s, e, e, s,
                        s, e, e, s, DQ
                    ]
                }),
                new ComposedLevel({
                    name: "Ma? Mi?",
                    description: `Say, you're getting mighty close to the end of this game, aren't you?<br/>
                    <br/>
                    ...Hmm...`,
                    timeSignature: TimeSignature.sixEight,
                    tempo: 46,
                    notes: [
                        s, e, s, e, dq,
                        s, e, e, s, dq,
                        s, e, s, e, s, e, e, s,
                        dh,
                        s, e, s, e, s, e, e, s,
                        s, e, e, s, dq,
                        s, e, e, s, s, e, s, e,
                        e, e, e, dq
                    ]
                }),
                new ComposedLevel({
                    name: "Compound Mixopation",
                    description: `So... I just need to be clear, here. "Mixopation" is still not a word. I know I used it a bunch. But I made it up.<br/>
                    "Syncopation" is, though! Rhythms that hide the beat are called "syncopated".<br/>
                    <br/>
                    ...I just feel like our time together is nearing an end, and I don't want to send you off saying "mixopation" to people.<br/>
                    They'll look at you funny. It's not a thing.`,
                    timeSignature: TimeSignature.sixEight,
                    tempo: 46,
                    notes: [
                        s, e, s, e, e, e, e,
                        s, e, s, e, dq,
                        s, e, e, s, e, e, e,
                        S, s, s, s, s, s, dq,
                        e, s, e, s, e, s, e, s,
                        s, s, s, s, s, s, dq,
                        e, e, e, s, s, e, e,
                        s, e, e, s, DQ
                    ]
                }),
                new RandomLevel({
                    name: "Compound Blendopation",
                    description: `I mean... same deal with "blendopation".<br/>
                    <br/>
                    Obviously.`,
                    timeSignature: TimeSignature.sixEight,
                    tempo: 46,
                    bars: 8,
                    blocks: [
                        Block.required([s, e, e, s]),
                        Block.required([s, e, s, e]),
                        Block.required([e, s, e, s]),
                        Block.required([S, s, s, s, s, s]),
                        new Block([q], [0, 1]),
                        new Block([e]),
                        new Block([s, s]),
                        new Block([dq]),
                        new Block([dq]),
                        new Block([dq]),
                        new Block([dq]),
                        new Block([e, q]),
                        new Block([e, q]),
                        new Block([q, e]),
                        new Block([q, e])
                    ]
                })
            ]
        })

        newSkill({
            id: "cutTime",
            name: "Cut Time",
            knownCounts: Count.allSimple,
            levels: [
                new ComposedLevel({
                    name: "Yes, We Half Two",
                    description: `This time signature is ${TimeSignature.cutTime.inlineNotation}, but it prefers to be called &quot;cut time&quot;. Let's honor its wishes.`,
                    timeSignature: TimeSignature.cutTime,
                    tempo: 80,
                    notes: [
                        h, h,
                        w,
                        h, h,
                        w,
                        h, H,
                        H, h,
                        h, h,
                        w
                    ]
                }),
                new ComposedLevel({
                    name: "Quarter's Back",
                    description: `You once played a piece that was sweet<br/>
                    while you tried to make &quot;Cut Time&quot; complete.<br/>
                    You knew, from the &quot;2&quot;,<br/>
                    every length would be new<br/>
                    so you gave quarter notes (${Note.quarter.inlineNotation}) half a beat.`,
                    timeSignature: TimeSignature.cutTime,
                    tempo: 80,
                    notes: [
                        q, q, q, q,
                        w,
                        q, Q, q, Q,
                        w,
                        h, q, q,
                        w,
                        q, q, h,
                        w
                    ]
                }),
                new ComposedLevel({
                    name: "Offbeats 2",
                    description: "Are you hungry? I'm kinda hungry.<br/><br/>Oh, yeah, also there's a piece for you to clap or something.",
                    timeSignature: TimeSignature.cutTime,
                    tempo: 80,
                    notes: [
                        q, Q, q, Q,
                        q, Q, q, Q,
                        Q, q, Q, q,
                        Q, q, Q, q,
                        q, Q, q, Q,
                        q, Q, q, Q,
                        Q, q, Q, q,
                        w
                    ]
                }),
                new ComposedLevel({
                    name: "The Dot Spot",
                    description: `Question: if a half note (${Note.half.inlineNotation}) is one beat long, then a dotted half note (${Note.half.dotted.inlineNotation}) is...?<br/><br/>Answer: in this piece.`,
                    timeSignature: TimeSignature.cutTime,
                    tempo: 80,
                    notes: [
                        h, q, q,
                        w,
                        q, Q, Q, q,
                        h, h,
                        dh, q,
                        dh, q,
                        dh, q,
                        w
                    ]
                }),
                new QuizLevel({
                    name: "Cut Theory",
                    description: `Another question: do you like cut time? I think it's pretty cool.<br/>
                    <br/>
                    A third question: do you think <em>cut time</em> likes <em>me</em>? I think it's being nice to me, but I'm not really sure.<br/>
                    <br/>
                    I bought it some ice cream this one time, so that probably helped.`,
                    questions: Question.noteLengths(TimeSignature.cutTime, w, dh, h, q).concat([
                        Question.noteRelationship(q, dh, [h, w]),
                        new Question({
                            text: `What time signature is also called &quot;cut time&quot;?`,
                            answers: [
                                new Answer({
                                    text: TimeSignature.cutTime.inlineNotation,
                                    correct: true
                                }),
                                new Answer({
                                    text: TimeSignature.twoFour.inlineNotation,
                                    correct: false,
                                    explanation: `${TimeSignature.twoFour.inlineNotation} has the correct number on top&mdash;there <em>are</em> two beats per measure in cut time&mdash;but the bottom number's wrong. That &quot;4&quot; on the bottom means a quarter note (${q.inlineNotation} gets the beat in ${TimeSignature.twoFour.inlineNotation}, but in cut time, a half note (${h.inlineNotation}) should get the beat instead.`
                                }),
                                new Answer({
                                    text: new TimeSignature(8, e).inlineNotation,
                                    correct: false,
                                    explanation: `You've got it backwards&mdash;in ${new TimeSignature(8, e).inlineNotation}, there are a ton of beats per measure, and a tiny little eighth note (${e.inlineNotation}) gets the beat. In cut time, there are supposed to be only <strong>2</strong> beats per measure, and a big ol' half note (${h.inlineNotation}) should get the beat.`
                                }),
                                new Answer({
                                    text: new TimeSignature(1, q).inlineNotation,
                                    correct: false,
                                    explanation: `Cut time has a name because it's used a lot. There's no reason to give this very weird ${new TimeSignature(1, q).inlineNotation} time signature a name&mdash;you'll basically never see it. A quarter note (${q.inlineNotation}) gets the beat, which is fine, but look at the number of beats per measure&mdash;only <strong>one</strong>! You'd be counting &quot;one, one, one, one...&quot; It's weird.`
                                })
                            ]
                        })
                    ])
                }),
                new RandomLevel({
                    name: "Cut Instinct",
                    description: "Let's <em>do</em> this. You're past due to take your cue and &mdash;woo!&mdash;break through this! Ooh, you're gonna say <em>&quot;adieu&quot;</em> to this skill.",
                    timeSignature: TimeSignature.cutTime,
                    tempo: 80,
                    bars: 8,
                    blocks: [
                        Block.required([w]),
                        Block.required([h]),
                        Block.required([H]),
                        Block.required([q, q]),
                        Block.required([q, Q]),
                        Block.required([Q, q]),
                        Block.required([dh, q]),
                        new Block([W])
                    ]
                })
            ]
        })

        newSkill({
            id: "cutTime2",
            name: "Advanced Cut Time",
            knownCounts: Count.allSimple,
            levels: [
                new ComposedLevel({
                    name: "Meet... Eighth Notes?",
                    description: `We know eighth notes (${Note.eighth.inlineNotation}). Hello, eighth notes! Wait... why are you only <strong>&frac14; of a beat long</strong>!?<br/>
                    <br/>
                    Oh. Ohhhhhhh... because four of you fit in a half note (${Note.half.inlineNotation}). And half notes are only <strong>one beat</strong> in cut time.<br/>
                    <br/>
                    <em>Sneaky</em> little eighth notes...`,
                    timeSignature: TimeSignature.cutTime,
                    tempo: 60,
                    notes: [
                        h, h,
                        q, q, q, q,
                        e, e, e, e, e, e, e, e,
                        w,
                        e, e, e, e, q, q,
                        h, e, e, e, e,
                        q, q, e, e, e, e,
                        h, H
                    ]
                }),
                new ComposedLevel({
                    name: "Eighths on the Beat",
                    description: `Do you know why they call it &quot;the beat&quot;? It's because, in ancient times, when the musicians didn't tap at the right time, the conductor would grab a large rock and beat them.<br/>
                    <br/>
                    Rhythmically.<br/>
                    Until they tapped at the right time.<br/>
                    <br/>
                    I am making this up.`,
                    timeSignature: TimeSignature.cutTime,
                    tempo: 60,
                    notes: [
                        e, e, e, e, h,
                        e, e, e, E, h,
                        e, e, q, e, e, q,
                        w,
                        e, e, q, e, e, q,
                        q, q, q, q,
                        e, e, e, e, e, e, q,
                        w
                    ]
                }),
                new ComposedLevel({
                    name: "Eighths on the And",
                    description: `Do you know why they call it &quot;and&quot;? It's because, if we could, we would absolutely count, &quot;One, two, two <strong>and</strong> a half,&quot; it's just too hard to say!<br/>
                    <br/>
                    So we shortened &quot;two <strong>and</strong> a half&quot; to just &quot;<strong>and</strong>.&quot;<br/>
                    <br/>
                    I am <em>not</em> making <em>this</em> one up!`,
                    timeSignature: TimeSignature.cutTime,
                    tempo: 60,
                    notes: [
                        e, e, e, e, h,
                        e, E, e, e, h,
                        q, e, e, q, e, e,
                        w,
                        q, e, e, q, e, e,
                        q, q, q, q,
                        e, e, e, e, q, e, e,
                        w
                    ]
                }),
                new ComposedLevel({
                    name: "The Last Eighth",
                    description: `Do you know why they call it &quot;a&quot; (or &quot;da&quot;)?<br/>
                    <br/>
                    <br/>
                    <br/>
                    ...Me neither.`,
                    timeSignature: TimeSignature.cutTime,
                    tempo: 60,
                    notes: [
                        e, e, e, e, h,
                        e, E, E, e, h,
                        dq, e, dq, e,
                        w,
                        dq, e, dq, e,
                        q, q, q, q,
                        e, e, e, e, dq, e,
                        w
                    ]
                }),
                new QuizLevel({
                    name: "More Cut Theory",
                    description: `Okay, I do at least know why &quot;a&quot; is pronounced &quot;duh&quot;.<br/>
                    It's because people were saying &quot;and a&quot; a lot, and it accidentally changed into &quot;an da&quot;.<br/>
                    <br/>
                    The same thing happened with &quot;an apron&quot;&mdash;people used to be like, &quot;I'm gonna cook; I'll go put on a napron.&quot;<br/>
                    And then &quot;a napron&quot; accidentally turned into &quot;an apron&quot;. No joke! Or... is it &quot;noj oke&quot;?`,
                    questions: Question.noteLengths(TimeSignature.cutTime, w, dh, h, dq, q, e, DQ, E).concat([
                        Question.noteRelationship(e, dq, [q, h, dh]),
                        Question.noteRelationship(e, h, [q, h, dq]),
                        Question.noteRelationship(e, q, [dh, h, dq])
                    ])
                }),
                new RandomLevel({
                    name: "Quadruxtaposition II",
                    description: `Let's throw all our favorite rhythms together, like a rhythmic trail mix!<br/>
                    <br/>
                    Mmmm... eighth note trail mix. I'm sure it'll be delicious.<br/>
                    Or maybe we've put too many rhythms in and this level will be <em>nuts</em>!`,
                    timeSignature: TimeSignature.cutTime,
                    tempo: 60,
                    bars: 8,
                    blocks: [
                        Block.required([e, e, e, e]),
                        Block.required([q, e, e]),
                        Block.required([e, e, q]),
                        Block.required([dq, e]),
                        new Block([h]),
                        new Block([w]),
                        new Block([q, q]),
                        new Block([H])
                    ]
                })
            ]
        })

        newSkill({
            id: "cutTime3",
            name: "Very Advanced Cut Time",
            knownCounts: Count.allSimple,
            levels: [
                new ComposedLevel({
                    name: "Cut Syncopation 1",
                    description: `Let's syncopate in cut time. Do you think you can <strong>cut</strong> it?`,
                    timeSignature: TimeSignature.cutTime,
                    tempo: 60,
                    notes: [
                        e, e, e, e, h,
                        e, dq, h,
                        e, dq, e, dq,
                        W,
                        e, e, e, e, h,
                        e, q, e, h,
                        e, q, e, e, q, e,
                        w,
                    ]
                }),
                new ComposedLevel({
                    name: "Cut Syncopation 2",
                    description: `Do you like these syncopated rhythms better in cut time? It's okay either way&mdash;some time signatures are just not <strong>cut</strong> out for syncopation.`,
                    timeSignature: TimeSignature.cutTime,
                    tempo: 60,
                    notes: [
                        e, q, e, e, e, q,
                        w,
                        e, q, e, E, e, q,
                        w,
                        e, q, q, e, q,
                        e, q, q, e, q,
                        e, q, q, e, q,
                        W
                    ]
                }),
                new ComposedLevel({
                    name: "Cut Syncopation 3",
                    description: `You're almost there! Keep working hard and counting out loud&mdash;there are no short<strong>cut</strong>s.`,
                    timeSignature: TimeSignature.cutTime,
                    tempo: 60,
                    notes: [
                        e, q, e, e, q, e,
                        w,
                        e, q, e, E, q, e,
                        w,
                        e, q, q, q, e,
                        e, q, q, q, e,
                        e, q, q, q, e,
                        w
                    ]
                }),
                new ComposedLevel({
                    name: "Cut Pop",
                    description: `Speaking of &quot;cut&quot;, did you know I can cut pieces of wood in half using nothing but my face?<br/>
                    <br/>
                    It's true; I <strong>saw</strong> it with my own eyes.`,
                    timeSignature: TimeSignature.cutTime,
                    tempo: 60,
                    notes: [
                        dq, e, q, q,
                        w,
                        dq, e, Q, q,
                        w,
                        dq, dq, q,
                        dq, dq, q,
                        dq, dq, q,
                        w
                    ]
                }),
                new ComposedLevel({
                    name: "Cut Mixopation",
                    description: `Okay... that last pun was extra-bad.<br/>
                    I'm sorry.<br/>
                    <br/>
                    I'll <strong>cut</strong> it out.`,
                    timeSignature: TimeSignature.cutTime,
                    tempo: 60,
                    notes: [
                        h, q, q,
                        e, q, e, q, q,
                        e, q, q, e, q,
                        w,
                        dq, dq, q,
                        e, q, e, q, q,
                        e, q, q, q, e,
                        h, H
                    ]
                }),
                new ComposedLevel({
                    name: "Not Technically Cut Time",
                    description: `This one's not actually cut time! We'll keep the 2 on the bottom, so a half note (${Note.half.inlineNotation}) will still be <strong>one beat</strong>... but let's change up the number of beats in a measure.<br/>
                    <br/>
                    Don't worry&mdash;you can do it! You're a <strong>cut</strong> above the rest; no ifs, ands, or <strong>cut</strong>s.`,
                    timeSignature: new TimeSignature(3, Note.half),
                    tempo: 80,
                    notes: [
                        h, h, h,
                        q, q, q, q, h,
                        e, e, e, e, q, e, e, h,
                        dw,
                        e, e, q, q, e, e, h,
                        dq, dq, q, h,
                        e, q, e, e, q, e, q, q,
                        dw
                    ]
                })
            ]
        })

        newSkill({
            id: "syncopation",
            name: "Syncopation",
            knownCounts: Count.allSimple,
            levels: [
                new ComposedLevel({
                    name: "Hide the Three",
                    description: "What's your favorite beat? Three? Well, <em>too bad</em>&mdash;you'll never see it again! MuAhAhAhAhaHAhahaha...",
                    timeSignature: TimeSignature.fourFour,
                    tempo: 100,
                    notes: [
                        q, q, Q, q,
                        q, h, q,
                        q, q, Q, q,
                        h, H,
                        q, h, q,
                        q, h, q,
                        q, h, q,
                        w
                    ]
                }),
                new ComposedLevel({
                    name: "Hide the Two",
                    description: "Holding notes right through a beat like this is called &quot;syncopation&quot;. Now, where's beat two? WHERE IS IT!? <em>WHAT DID YOU DO WITH IT!?</em>",
                    timeSignature: TimeSignature.threeFour,
                    tempo: 60,
                    notes: [
                        e, e, E, e, q,
                        e, q, e, q,
                        e, e, E, e, q,
                        dh,
                        e, q, e, q,
                        e, q, e, q,
                        e, q, e, q,
                        dh
                    ]
                }),
                new ComposedLevel({
                    name: "Hide the Three Again",
                    description: "Oh, Three&mdash;this game we play! Just when I thought you were back; where have you run off to now?",
                    timeSignature: TimeSignature.threeFour,
                    tempo: 60,
                    notes: [
                        q, e, e, E, e,
                        q, e, q, e,
                        q, e, e, E, e,
                        q, H,
                        q, e, q, e,
                        q, e, q, e,
                        q, e, q, e,
                        dh
                    ]
                }),
                new ComposedLevel({
                    name: "Hide the Two Again",
                    description: "Well, I found Three.<br/><br/>But I lost Two.<br/><br/>I might need a better organizational system. Or just... a backpack without holes in the bottom.",
                    timeSignature: TimeSignature.fourFour,
                    tempo: 80,
                    notes: [
                        e, e, E, e, h,
                        e, q, e, h,
                        e, e, E, e, h,
                        q, Q, H,
                        e, q, e, h,
                        e, q, e, h,
                        e, q, e, q, q,
                        w
                    ]
                }),
                new ComposedLevel({
                    name: "Hide the Four",
                    description: "So I lost the Four, now&mdash;no big deal! This series of events is not indicative of a larger planning issue!<br/><br/><strong>THIS SERIES OF EVENTS IS NOT INDICATIVE OF A LARGER PLANNING ISSUE!</strong><br/><br/>...Things get truer the louder you say them, right?",
                    timeSignature: TimeSignature.fourFour,
                    tempo: 80,
                    notes: [
                        q, q, e, e, E, e,
                        q, q, e, q, e,
                        q, q, e, e, E, e,
                        q, Q, H,
                        q, q, e, q, e,
                        h, e, q, e,
                        q, q, e, q, e,
                        w
                    ]
                }),
                new ComposedLevel({
                    name: "Hide the Three Three",
                    description: "O, swear not by the Three, th' inconstant Three,<br/>That piecely changes in her hidden state,<br/>Lest that thy claps prove likewise variable.",
                    timeSignature: TimeSignature.fourFour,
                    tempo: 80,
                    notes: [
                        q, e, e, E, e, q,
                        q, e, q, e, q,
                        q, e, e, E, e, q,
                        q, Q, H,
                        q, e, q, e, q,
                        q, e, q, e, q,
                        Q, e, q, e, q,
                        W
                    ]
                }),
                new ComposedLevel({
                    name: "Hide ALL THE THINGS!",
                    description: "I give up. Who needs beats anyway?<br/>Actually, <em>you</em> do: make sure you're counting them out loud, even when you're not clapping them!",
                    timeSignature: TimeSignature.fourFour,
                    tempo: 60,
                    notes: [
                        e, q, e, e, q, e,
                        e, e, E, e, e, e, E, e,
                        e, q, e, e, q, e,
                        e, q, e, q, q
                    ]
                }),
                new RandomLevel({
                    name: "Mixopation",
                    description: "Sorry; I've been really into Not Words&trade; lately. I'll just go with it&mdash;I guess now it's my new thing. <strong>Let's get ready to MIXOPATE!</strong>",
                    timeSignature: TimeSignature.fourFour,
                    tempo: 80,
                    bars: 8,
                    blocks: [
                        Block.required([q, h, q]),
                        Block.required([e, q, e], [0]),
                        Block.required([e, q, e], [1]),
                        Block.required([e, q, e], [2]),
                        new Block([q]),
                        new Block([e, e]),
                        new Block([h]),
                        new Block([Q])
                    ]
                })
            ]
        })

        newSkill({
            id: "syncopation2",
            name: "More Syncopation",
            knownCounts: Count.allSimpleBasic,
            levels: [
                new ComposedLevel({
                    name: "Hide the Odds",
                    description: `These quarter notes (${Note.quarter.inlineNotation}) don't even realize that they're part of a secret plot to hide certain beats. They're unwitting pawns. I just thought I should tell you that. Don't blame them.`,
                    timeSignature: TimeSignature.fourFour,
                    tempo: 100,
                    notes: [
                        q, q, Q, q,
                        Q, q, Q, q,
                        Q, q, Q, q,
                        w
                    ]
                }),
                new ComposedLevel({
                    name: "Drag it Out",
                    description: "Draaaaaaaaaaag&nbsp;&nbsp;&nbsp;it&nbsp;&nbsp;&nbsp;&nbsp;ouuuuuuuuuuuuuuuuuut.",
                    timeSignature: TimeSignature.fourFour,
                    tempo: 60,
                    notes: [
                        e, E, E, E, E, E, q,
                        e, e, E, E, E, E, q,
                        e, e, E, e, E, E, q,
                        e, e, E, e, E, e, q,
                        e, q, q, e, q,
                        e, q, q, e, q,
                        e, q, q, e, q,
                        w
                    ]
                }),
                new ComposedLevel({
                    name: "Draaag it Ouuuuuuuut",
                    description: "Draaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaag<br/><br/>it<br/><br/><br/><br/>ouuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuut.",
                    timeSignature: TimeSignature.fourFour,
                    tempo: 80,
                    notes: [
                        e, e, E, e, E, E, E, E,
                        e, e, E, e, E, e, E, E,
                        e, e, E, e, E, e, E, e,
                        e, e, E, e, E, e, E, e,
                        e, q, q, q, e,
                        e, q, q, q, e,
                        e, q, q, q, e,
                        w
                    ]
                }),
                new ComposedLevel({
                    name: "Hemiola",
                    description: "These measures are divided into three equal parts... or is it <em>two</em> equal parts?",
                    timeSignature: TimeSignature.threeFour,
                    tempo: 80,
                    notes: [
                        q, q, q,
                        dq, dq,
                        q, q, q, 
                        dq, dq, 
                        q, q, q, 
                        dq, dq, 
                        dq, dq, 
                        dh
                    ]
                }),
                new ComposedLevel({
                    name: "Momentum",
                    description: "Second verse, same as the first.<br/><br/>Only... y'know... faster.",
                    timeSignature: TimeSignature.threeFour,
                    tempo: 100,
                    notes: [
                        q, q, q,
                        dq, dq,
                        q, q, q, 
                        dq, dq, 
                        q, q, q, 
                        dq, dq, 
                        dq, dq, 
                        dh
                    ]
                }),
                new ComposedLevel({
                    name: "Pop",
                    description: "You have <em>definitely</em> heard this rhythm.",
                    timeSignature: TimeSignature.fourFour,
                    tempo: 80,
                    notes: [
                        dq, dq, q,
                        w,
                        dq, dq, q,
                        w,
                        dq, dq, q,
                        dq, dq, q,
                        dq, dq, q,
                        w
                    ]
                }),
                new ComposedLevel({
                    name: "A Little of Each",
                    description: "The syncopated rhythms didn't know they were all being prepared for this stew! Let me just stir it up, here&mdash;there. Ready to eat!<br/>Or clap.",
                    timeSignature: TimeSignature.fourFour,
                    tempo: 46,
                    notes: [
                        q, h, q,
                        dq, dq, q,
                        e, q, e, e, q, e,
                        w,
                        q, e, q, e, q,
                        e, q, q, e, q,
                        e, q, q, q, e,
                        w
                    ]
                }),
                new RandomLevel({
                    name: "More Mixopation",
                    description: "It's just like before, but with more&mdash;syncopation galore! I implore you: pore over these notes I adore, or your score at the end of this chore may be one you deplore (or&mdash;roar!&mdash;less than you swore it'd be), and you'll need an encore&mdash;don't ignore this call for an outpour of your skills from your mentor, with whom you've developed rapport despite jokes which wore on and became an eyesore that might bore your poor offshore carnivorous Baltimore icthyosaur... uh...<br/><br/>I think that sentence got away from me at the end, there.",
                    timeSignature: TimeSignature.fourFour,
                    tempo: 46,
                    bars: 8,
                    blocks: [
                        Block.required([q, h, q]),
                        Block.required([e, q, e], [0]),
                        Block.required([e, q, e], [1]),
                        Block.required([e, q, e], [2]),
                        Block.required([e, q, q, e]),
                        Block.required([e, q, q, q, e]),
                        Block.required([dq, dq], [0]),
                        new Block([q]),
                        new Block([e, e]),
                        new Block([h]),
                        new Block([Q])
                    ]
                }),
                new RandomLevel({
                    name: "Faster Mixopation",
                    description: "It's a blast from the past that is fast&mdash;the vast skills you've amassed might not last unsurpassed, as you might be outclassed&mdash;just compare and contrast all the patterns you've passed and you'll enthusiastically... broadcast... a chloroplast...<br/><br/>It happened again. Apologies.",
                    timeSignature: TimeSignature.fourFour,
                    tempo: 60,
                    bars: 8,
                    blocks: [
                        Block.required([q, h, q]),
                        Block.required([e, q, e], [0]),
                        Block.required([e, q, e], [1]),
                        Block.required([e, q, e], [2]),
                        Block.required([e, q, q, e]),
                        Block.required([e, q, q, q, e]),
                        Block.required([dq, dq], [0]),
                        new Block([q]),
                        new Block([e, e]),
                        new Block([h]),
                        new Block([Q])
                    ]
                })
            ]
        })

        newSkill({
            id: "syncopation3",
            name: "Faster Syncopation",
            knownCounts: Count.allSimple,
            levels: [
                new ComposedLevel({
                    name: "E",
                    description: "E! Eeeeeeeee! EEEeeEEEEEEeeeeE!<br/>E! E.<br/><br/>E!<br/><br/><br/>Ahem&mdash;sorry about that. This is the last time I let a dolphin take over for me.",
                    timeSignature: TimeSignature.twoFour,
                    tempo: 46,
                    notes: [
                        s, s, s, s, q,
                        s, s, S, S, q,
                        s, de, q,
                        h,
                        s, de, q,
                        s, de, q,
                        s, de, s, de,
                        s, de, Q
                    ]
                }),
                new ComposedLevel({
                    name: "Hide the And",
                    description: "PSST!&mdash;I'll tell you a secret. If you <em>really</em> want to, you're allowed to count the missing &quot;and&quot; out loud&mdash;temporarily! Just while you get used to it. I won't tell.",
                    timeSignature: TimeSignature.twoFour,
                    tempo: 46,
                    notes: [
                        s, s, S, s, q,
                        s, e, s, q,
                        s, s, S, s, q,
                        q, q,
                        s, e, s, q,
                        s, e, s, q,
                        s, e, s, q,
                        h
                    ]
                }),
                new ComposedLevel({
                    name: "Hide the Other And",
                    description: "PSST!&mdash;follow-up secret: when I allowed you to count the extra &mdash;and&mdash; (temporarily!), that was called &quot;subdividing&quot;. And <em>that <strong>is</strong></em> a real word.<br/><br/>...I guess this wasn't really a secret.",
                    timeSignature: TimeSignature.twoFour,
                    tempo: 60,
                    notes: [
                        q, s, s, S, s,
                        q, s, e, s,
                        q, s, s, S, s,
                        q, q,
                        q, s, e, s,
                        q, s, e, s,
                        q, s, e, s,
                        h
                    ]
                }),
                new ComposedLevel({
                    name: "Hide Several Ands",
                    description: "Sure, you can do it once&mdash;but can you repeat it?<br/>Sure, you can do it once&mdash;but can you repeat it?<br/>Sure, you can do it once&mdash;but can you repeat it?",
                    timeSignature: TimeSignature.fourFour,
                    tempo: 60,
                    notes: [
                        s, e, s, q, s, e, s, q,
                        q, s, s, S, s, s, s, S, s, q,
                        q, s, e, s, q, s, e, s,
                        s, e, s, s, e, s, s, e, s, q
                    ]
                }),
                new ComposedLevel({
                    name: "Hide <em>All</em> the Ands!",
                    pageTitle: "Hide ALL the Ands!",
                    description: "Good luck with this one. I'd tell you to cross your fingers, but then I don't know how you'd clap.",
                    timeSignature: TimeSignature.fourFour,
                    tempo: 60,
                    notes: [
                        s, e, s, s, e, s, h,
                        s, e, s, s, e, s, s, e, s, q,
                        s, e, s, s, e, s, s, e, s, s, e, s,
                        s, e, s, s, e, s, s, e, s, q
                    ]
                }),
                new RandomLevel({
                    name: "Scrambled",
                    description: "dlemSrcab",
                    timeSignature: TimeSignature.threeFour,
                    tempo: 60,
                    bars: 8,
                    blocks: [
                        Block.required([s, e, s], [0]),
                        Block.required([s, e, s], [1]),
                        Block.required([s, e, s], [2]),
                        Block.required([e, q, e]),
                        new Block([q]),
                        new Block([e, e]),
                        new Block([h])
                    ]
                }),
                new RandomLevel({
                    name: "Fast Four",
                    description: "This final fragment fits no fewer than four beats per bar... and it feels frightfully fast. Have fun fending off failure facing this feat!",
                    timeSignature: TimeSignature.fourFour,
                    tempo: 80,
                    bars: 8,
                    blocks: [
                        Block.required([s, e, s], [0]),
                        Block.required([s, e, s], [1]),
                        Block.required([s, e, s], [2]),
                        Block.required([s, e, s], [3]),
                        Block.required([e, q, e], [0]),
                        Block.required([e, q, e], [2]),
                        new Block([q]),
                        new Block([e, e]),
                        new Block([h]),
                        new Block([dh]),
                        new Block([w])
                    ]
                })
            ]
        })

        newSkill({
            id: "syncopation4",
            name: "More Faster Syncopation",
            knownCounts: Count.allSimple,
            levels: [
                new ComposedLevel({
                    name: "Building Blocks",
                    description: "Hmm, what do we have to work with, here...? Quite a lot&mdash;you've learned a bunch of rhythms! Let's review some of them before we put them together in the <em>most confusing ways possible</em>.",
                    timeSignature: TimeSignature.threeFour,
                    tempo: 46,
                    notes: [
                        q, s, s, e, q,
                        q, S, s, e, q,
                        q, S, s, e, Q,
                        dh,
                        q, s, e, s, q,
                        q, S, e, s, q,
                        q, S, e, s, q,
                        q, Q, Q
                    ]
                }),
                new ComposedLevel({
                    name: "2",
                    description: "The number of the level you're on. Also the number of beats we'll stay syncopated.",
                    timeSignature: TimeSignature.fourFour,
                    tempo: 46,
                    notes: [
                        s, e, s, s, e, s, h,
                        s, e, s, S, e, s, h,
                        s, e, e, e, s, h,
                        s, e, e, e, s, q, Q
                    ]
                }),
                new ComposedLevel({
                    name: "1&frac12;",
                    pageTitle: "1½",
                    description: "The number of beats we'll stay syncopated this time. Staying syncopated for 1&frac12; beats should be easier than staying syncopated for 2 whole beats.<br/><br/>...It <em>should</em> be. But it isn't!",
                    timeSignature: TimeSignature.fourFour,
                    tempo: 46,
                    notes: [
                        s, e, s, s, s, e, h,
                        s, e, s, S, s, e, h,
                        s, e, e, s, e, h,
                        s, e, e, s, e, q, Q
                    ]
                }),
                new ComposedLevel({
                    name: "3",
                    description: "The number of parties you'll throw when you win.",
                    timeSignature: TimeSignature.fourFour,
                    tempo: 60,
                    notes: [
                        s, e, s, s, e, s, s, e, s, q,
                        s, e, s, S, e, s, S, e, s, q,
                        s, e, e, e, e, e, s, q,
                        s, e, e, e, e, e, s, q
                    ]
                }),
                new ComposedLevel({
                    name: "2&frac12;",
                    pageTitle: "2½",
                    description: "The number of times you'll have to retry this one.<br/><br/>...if you're counting by tens...",
                    timeSignature: TimeSignature.fourFour,
                    tempo: 60,
                    notes: [
                        s, e, s, s, e, s, s, s, e, q,
                        s, e, s, S, e, s, S, s, e, q,
                        s, e, e, e, e, s, e, q,
                        s, e, e, e, e, s, e, Q
                    ]
                }),
                new ComposedLevel({
                    name: "4",
                    description: "The number of times you'll break down crying during this one.",
                    timeSignature: TimeSignature.fourFour,
                    tempo: 60,
                    notes: [
                        s, e, s, s, e, s, s, e, s, s, e, s,
                        q, Q, H,
                        s, e, s, S, e, s, S, e, s, S, e, s,
                        h, H,
                        s, e, e, e, e, e, e, e, s,
                        q, Q, H,
                        s, e, e, e, e, e, e, e, s,
                        q, q, h
                    ]
                }),
                new ComposedLevel({
                    name: "3&frac12;",
                    pageTitle: "3½",
                    description: "The number of hours this'll take to learn.",
                    timeSignature: TimeSignature.fourFour,
                    tempo: 60,
                    notes: [
                        s, e, s, s, e, s, s, e, s, s, s, e,
                        q, Q, q, Q,
                        s, e, s, S, e, s, S, e, s, S, s, e,
                        q, q, h,
                        s, e, e, e, e, e, e, s, e,
                        q, Q, H,
                        s, e, e, e, e, e, e, s, e,
                        w
                    ]
                }),
                new RandomLevel({
                    name: "Mix-o-more-o-fast-o-pation",
                    description: "Let's mix it all up! ...A <em>little</em>. Like, gently hand-mixed.<br/>Step away from the eggbeater.",
                    timeSignature: TimeSignature.fourFour,
                    tempo: 46,
                    bars: 8,
                    blocks: [
                        Block.required([s, e, s, q]),
                        Block.required([s, e, e, s, e, h]),
                        Block.required([s, e, e, e, s, h]),
                        Block.required([s, e, e, e, e, s, e, q]),
                        Block.required([s, e, e, e, e, e, s, q]),
                        new Block([e, e]),
                        new Block([q]),
                        new Block([h])
                    ]
                }),
                new ComposedLevel({
                    name: "More Building Blocks",
                    description: "I need more blocks.<br/><br/><br/>(I'm building a skyscraper.)",
                    timeSignature: TimeSignature.threeFour,
                    tempo: 46,
                    notes: [
                        de, s, e, e, q,
                        de, s, E, e, q,
                        de, s, E, e, q,
                        dh,
                        q, s, s, e, q,
                        q, s, s, E, q,
                        q, s, de, q,
                        dh,
                        q, s, de, q,
                        q, S, de, q,
                        q, S, de, q,
                        dh
                    ]
                }),
                new ComposedLevel({
                    name: "Pop<sup>2</sup>",
                    pageTitle: "Pop Squared",
                    description: "You've heard this rhythm, too.",
                    timeSignature: TimeSignature.fourFour,
                    tempo: 60,
                    notes: [
                        de, s, e, e, h,
                        de, s, E, e, h,
                        de, de, e, h,
                        w,
                        de, s, E, e, h,
                        de, de, e, h,
                        de, de, e, de, de, e,
                        de, de, e, h
                    ]
                }),
                new ComposedLevel({
                    name: "2Pop<sup>2</sup>",
                    pageTitle: "Two Pop Squared",
                    description: "I love a good 4:3 polyrhythm!<br/>And so do you!<br/><br/>Even if you don't know it, yet.",
                    timeSignature: TimeSignature.fourFour,
                    tempo: 60,
                    notes: [
                        de, s, e, e, s, de, q,
                        de, s, e, e, s, de, q,
                        de, s, E, e, S, de, q,
                        w,
                        de, s, E, e, S, de, q,
                        de, de, de, de, q,
                        de, de, de, de, q,
                        H, Q, q

                    ]
                }),
                new ComposedLevel({
                    name: "Pop<sup>2</sup> + 2Pop<sup>2</sup>",
                    pageTitle: "Pop Squared Plus Two Pop Squared",
                    description: "...well... I guess that's just 3Pop<sup>2</sup>. Combining like terms and all. Anyway, good luck!",
                    timeSignature: TimeSignature.fourFour,
                    tempo: 60,
                    notes: [
                        de, de, de, de, q,
                        de, de, e, h,
                        de, de, e, de, de, e,
                        de, de, e, h,
                        de, de, e, de, de, e,
                        de, de, de, de, q,
                        de, de, de, de, q,
                        de, de, e, h
                    ]
                })
            ]
        })

        newSkill({
            id: "syncopationChallenge",
            name: "Challenge: Syncopation",
            knownCounts: Count.allSimple,
            levels: [
                new ComposedLevel({
                    name: "Building It Up",
                    description: "Why did the pianist keep banging his head against the keys?<br/><br/>He was playing by ear.",
                    timeSignature: TimeSignature.fourFour,
                    tempo: 46,
                    notes: [
                        s, e, s, dh,
                        s, e, e, s, e, h,
                        s, e, e, e, s, h,
                        q, q, q, q,
                        s, e, e, e, e, s, e, q,
                        s, e, e, e, e, e, e, s, e,
                        s, e, e, e, e, e, e, e, s,
                        q, s, e, s, q, Q
                    ]
                }),
                new ComposedLevel({
                    name: "More Than Four?",
                    description: "Why is that final &quot;4&quot; count in the last piece so worried?<br/><br/>Because he's under a rest.",
                    timeSignature: TimeSignature.fourFour,
                    tempo: 60,
                    notes: [
                        s, e, s, dh,
                        s, e, e, e, s, h,
                        s, e, e, e, e, e, s, q,
                        s, e, s, q, H,
                        s, e, e, e, e, e, e, e, s,
                        S, e, e, e, e, e, e, e, s,
                        S, e, e, e, e, e, e, e, s,
                        w
                    ]
                }),
                new RandomLevel({
                    name: "Can <em>I</em> Even Clap This?",
                    pageTitle: "Can *I* Even Clap This?",
                    description: "Seriously. I had to check.<br/><br/>...It took a few attempts.",
                    timeSignature: TimeSignature.fourFour,
                    tempo: 46,
                    bars: 8,
                    blocks: [
                        Block.required([s, e, s]),
                        Block.required([s, e, e, s, e]),
                        Block.required([s, e, e, e, s]),
                        Block.required([s, e, e, e, e, s, e]),
                        Block.required([s, e, e, e, e, e, s]),
                        Block.required([de, de, e]),
                        Block.required([de, de, de, de]),
                        new Block([e, e]),
                        new Block([q]),
                        new Block([s, s, e]),
                        new Block([e, s, s]),
                        new Block([h])
                    ]
                }),
                new RandomLevel({
                    name: "60bpm Never Felt So Fast",
                    description: "...but at least it's all the same rhythms!",
                    timeSignature: TimeSignature.fourFour,
                    tempo: 60,
                    bars: 8,
                    blocks: [
                        Block.required([s, e, s]),
                        Block.required([s, e, e, s, e]),
                        Block.required([s, e, e, e, s]),
                        Block.required([s, e, e, e, e, s, e]),
                        Block.required([s, e, e, e, e, e, s]),
                        Block.required([de, de, e]),
                        Block.required([de, de, de, de]),
                        new Block([e, e]),
                        new Block([q]),
                        new Block([s, s, e]),
                        new Block([e, s, s]),
                        new Block([h])
                    ]
                }),
                new RandomLevel({
                    name: "Syncopation Master",
                    description: "...at least it's all the same rhythms?<br/><br/>...help...",
                    timeSignature: TimeSignature.fourFour,
                    tempo: 80,
                    bars: 8,
                    blocks: [
                        Block.required([s, e, s]),
                        Block.required([s, e, e, s, e]),
                        Block.required([s, e, e, e, s]),
                        Block.required([s, e, e, e, e, s, e]),
                        Block.required([s, e, e, e, e, e, s]),
                        Block.required([de, de, e]),
                        Block.required([de, de, de, de]),
                        new Block([e, e]),
                        new Block([q]),
                        new Block([s, s, e]),
                        new Block([e, s, s]),
                        new Block([h])
                    ]
                })
            ]
        })

        newSkill({
            id: "everythingChallenge",
            name: "Challenge: Everything!",
            knownCounts: Count.all,
            levels: [
                new RandomLevel({
                    name: "Everything 1",
                    description: `Well, this is it. We've been through a lot together, and here we are, at the beginning of the end.<br/>
                    <br/>
                    Let's start by making sure you remember the basics.`,
                    timeSignature: TimeSignature.fourFour,
                    tempo: 120,
                    bars: 12,
                    blocks: [
                        Block.required([q, q, q, q]),
                        Block.required([q, h, q]),
                        Block.required([q, q, h]),
                        Block.required([h, q, q]),
                        Block.required([dh, q]),
                        Block.required([q, dh]),
                        Block.required([w]),
                        Block.required([Q, q, Q, q]),
                        Block.required([q, Q, Q, q]),
                        Block.required([H, Q, q]),
                        Block.required([Q, q, H])
                    ]
                }),
                new RandomLevel({
                    name: "Everything 8",
                    description: `What, you expected &quot;Everything 2&quot; to come after &quot;Everything 1&quot;? I guess I could call it &quot;Everything 3&quot;.<br/>
                    Not better? You know, I'm going to miss you and all your... clapping, and... numbering critique. In fact, I got you a farewell present.<br/>
                    <br/>
                    ...now where did I put it? Hmm.<br/>
                    While I search, review eighth notes!`,
                    timeSignature: TimeSignature.threeFour,
                    tempo: 100,
                    bars: 12,
                    blocks: [
                        Block.required([e, q, e], [0]),
                        Block.required([e, q, e], [1]),
                        Block.required([e, q, q, e]),
                        Block.required([dq, dq]),
                        Block.required([h]),
                        Block.required([dh]),
                        Block.required([q]),
                        Block.required([Q]),
                        Block.required([e, e]),
                        Block.required([e, E]),
                        Block.required([E, e]),
                        Block.required([dq, e])
                    ]
                }),
                new QuizLevel({
                    name: "Everything You Know(te)",
                    description: `I still haven't found that gift I bought for you... oh, is this it, here?<br/>
                    <br/>
                    No, that's an eighth note.`,
                    questions: Question.noteNames(w, h, q, e, s, W, H, Q, E, S)
                }),
                new RandomLevel({
                    name: "Everything 16",
                    description: `...is <em>this</em> the gift? No, that's my hat.<br/>
                    Is <em>this</em> it? No, that's my shoe.<br/>
                    Is the gift under this rug, here? Nope... just... a large number of spiders. I, uh... I've got to leave now. Quickly. You just... review sixteenth notes or something. Bye!`,
                    timeSignature: TimeSignature.twoFour,
                    tempo: 80,
                    bars: 12,
                    blocks: [
                        new Block([h]),
                        new Block([h]),
                        new Block([H]),
                        new Block([H]),
                        new Block([q]),
                        new Block([q]),
                        new Block([q]),
                        new Block([q]),
                        new Block([q]),
                        new Block([q]),
                        new Block([Q]),
                        new Block([Q]),
                        new Block([Q]),
                        new Block([Q]),
                        new Block([dq, e]),
                        new Block([dq, e]),
                        new Block([DQ, e]),
                        new Block([DQ, e]),
                        new Block([e, e]),
                        new Block([e, e]),
                        new Block([e, E]),
                        new Block([E, e]),
                        Block.required([s, s, s, s]),
                        Block.required([s, s, s, s]),
                        Block.required([e, s, s]),
                        Block.required([e, s, s]),
                        Block.required([s, s, e]),
                        Block.required([s, s, e]),
                        Block.required([de, s]),
                        Block.required([de, s]),
                        Block.required([s, e, s]),
                        Block.required([s, e, e, s, e]),
                        Block.required([s, e, e, e, s]),
                        Block.required([de, de, e])
                    ]
                }),
                new ComposedLevel({
                    name: "Everything 5",
                    description: `What's that? No, I'm still searching... you should clap this piece while I look. It's in ${TimeSignature.fiveFour.inlineNotation}, which you're an expert at, because what <em>aren't</em> you an expert at, now!?<br/>
                    <br/>
                    Maybe... maybe the <em>real</em> gift was the knowledge you gained along the way!?<br/>
                    <br/>
                    No?<br/>
                    Okay, fine. I'll find what I actually got you...`,
                    timeSignature: TimeSignature.fiveFour,
                    tempo: 80,
                    notes: [
                        s, s, e, e, e, q, Q, e, s, s,
                        de, s, s, e, s, e, e, e, s, s, e, e,
                        E, s, s, E, e, s, e, e, e, e, e, s,
                        e, e, s, s, e, dh,
                        s, s, e, s, s, e, s, s, e, E, e, E, e,
                        e, s, s, s, s, s, s, s, s, s, s, Q, q,
                        de, de, de, de, E, s, s, s, s, s, s,
                        dh, h
                    ]
                }),
                new RandomLevel({
                    name: "Everything 2",
                    description: `Oh, <em>there's</em> the gift!<br/>
                    <br/>
                    ...nope, that's an old fish.<br/>
                    <br/>
                    ...<br/>
                    ...I mean, would you <em>like</em> an old fish?`,
                    timeSignature: TimeSignature.cutTime,
                    tempo: 60,
                    bars: 12,
                    blocks: [
                        new Block([w]),
                        new Block([w]),
                        new Block([w]),
                        new Block([w]),
                        new Block([W]),
                        new Block([W]),
                        new Block([h]),
                        new Block([h]),
                        new Block([h]),
                        new Block([h]),
                        new Block([h]),
                        new Block([h]),
                        new Block([H]),
                        new Block([H]),
                        new Block([H]),
                        new Block([H]),
                        new Block([q, q]),
                        new Block([q, q]),
                        new Block([q, q]),
                        new Block([q, q]),
                        new Block([q, Q]),
                        new Block([q, Q]),
                        new Block([Q, q]),
                        new Block([Q, q]),
                        new Block([dh, q]),
                        new Block([dh, q]),
                        new Block([dh, q]),
                        new Block([dh, q]),
                        new Block([DH, q]),
                        new Block([DH, q]),
                        Block.required([e, e, e, e]),
                        Block.required([q, e, e]),
                        Block.required([e, e, q]),
                        Block.required([dq, e]),
                        Block.required([e, q, e]),
                        Block.required([e, q, q, e, q]),
                        Block.required([e, q, q, q, e]),
                        Block.required([dq, dq, q])
                    ]
                }),
                new QuizLevel({
                    name: "Everything in Time",
                    description: `Nice work on that last one! Let's talk about note lengths next.<br/>
                    <br/>
                    Hmm, what's that?<br/>
                    What are you talking about? I never mentioned any presents.`,
                    questions: Question.noteLengths(TimeSignature.fourFour, w, h, q, e, s, dh, dq, de)
                    .concat(Question.noteLengths(TimeSignature.cutTime, w, h, q, e, dh, dq))
                    .concat(Question.noteLengths(TimeSignature.sixEight, dh, dq, q, e, s))
                }),
                new RandomLevel({
                    name: "Everything 3",
                    description: `Why do you keep going on about this &quot;gift&quot;? I already told you, I never said any such thing. Stop making things up.<br/>
                    <br/>
                    It's like that one time this person said they played the &quot;saxophone&quot;. So silly! I told him to stop making up instruments.`,
                    timeSignature: TimeSignature.nineEight,
                    tempo: 80,
                    bars: 12,
                    blocks: [
                        Block.required([q, e]),
                        Block.required([e, q]),
                        Block.required([e, e, e]),
                        Block.required([dq]),
                        Block.required([e, E, e]),
                        Block.required([e, e, E]),
                        Block.required([E, e, e]),
                        Block.required([DQ]),
                        Block.required([E, q]),
                        Block.required([Q, e]),
                        Block.required([dh]),
                        new Block([q, e]),
                        new Block([q, e]),
                        new Block([q, e]),
                        new Block([q, e]),
                        new Block([e, q]),
                        new Block([e, q]),
                        new Block([e, e, e]),
                        new Block([e, e, e]),
                        new Block([e, e, e]),
                        new Block([dq]),
                        new Block([dq]),
                        new Block([dq]),
                        new Block([dq]),
                        new Block([dq]),
                        new Block([dq]),
                        new Block([dq]),
                        new Block([dq]),
                        new Block([dh]),
                        new Block([dh]),
                        new Block([dh]),
                        new Block([dh]),
                        new Block([dh])
                    ]
                }),
                new QuizLevel({
                    name: "Everything Counts",
                    description: `Okay... honesty time. So... I <em>might've</em> mentioned a present. Look, I lost it, okay?<br/>
                    But it was chocolate. And it was really good chocolate, so you should be grateful!<br/>
                    Just... <em>really</em> delicious chocolate.<br/>
                    <br/>
                    ...When I say &quot;lost&quot;, I might technically mean &quot;ate&quot;.`,
                    questions: Question.counts(Count.all)
                }),
                new RandomLevel({
                    name: "Everything 2, Again",
                    description: `All right, I feel bad that I ate your parting gift. I'll find something else.<br/>
                    Just give me a minute.<br/>
                    <br/>
                    It could take a while, actually... I'd better give you a lot to do while I hunt.`,
                    timeSignature: TimeSignature.sixEight,
                    tempo: 46,
                    bars: 12,
                    blocks: [
                        Block.required([s, e, e, s]),
                        Block.required([s, e, s, e]),
                        Block.required([e, s, e, s]),
                        Block.required([S, s, s, s, s, s]),
                        Block.required([e, s, s, s, s]),
                        Block.required([s, s, e, s, s]),
                        Block.required([s, s, s, s, e]),
                        Block.required([q, s, s]),
                        Block.required([s, s, q]),
                        Block.required([e, de, s]),
                        Block.required([de, s, e]),
                        Block.required([de, s, s, s]),

                        new Block([e, E, e]),
                        new Block([e, e, E]),
                        new Block([E, e, e]),
                        new Block([DQ]),
                        new Block([E, q]),
                        new Block([Q, e]),
                        new Block([dh]),

                        new Block([q, e]),
                        new Block([e, q]),
                        new Block([e, e, e]),
                        new Block([dq]),
                        new Block([dq]),
                        new Block([dh])
                    ]
                }),
                new TextLevel({
                    name: "The End",
                    description: `Wow. Here we are. The end.<br/>
                    <br/>
                    Well, the end of what you can learn from <em>this game</em>. We didn't even get into mixed meter, or asymmetric time signatures, or thirty-second notes, or triplets.<br/>
                    <br/>
                    There's so much more music out there. I hope you seek it out! If you made it to here, then you're ready for practically anything.<br/>`,
                    html: `
                        And I did find you a gift, in the end.<br/>
                        <br/>
                        Well, really more of a <em>GIF</em>...<br/>
                        <img src="media/ico.gif"/>
                        <br/>
                        <br/>
                        It's been an absolute pleasure.<br/>
                        But please leave now.<br/>
                        <br/>
                        I baked myself a pie.
                    `,
                    isEnd: true
                })
            ]
        })
    }
}