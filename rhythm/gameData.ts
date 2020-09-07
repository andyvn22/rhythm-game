/// <reference path="music.ts" />

/**
 * Records the progress made on a particular skill. Automatically calls `Profile.update()` when modified.
 */
class SkillState {
    readonly id: string;
    private _currentLevel: number;
    get currentLevel() { return this._currentLevel; }
    set currentLevel(newValue) {
        this._currentLevel = newValue;
        Profile.update();
    }

    constructor(id: string, currentLevel = 0) {
        this.id = id;
        this._currentLevel = currentLevel;
    }
}

/**
 * Tracks all state of a player's progress through the game. Automatically calls `Profile.update()` when modified.
 */
class Profile {
    private _name: string;
    get name() { return this._name; }
    set name(newValue) {
        this._name = newValue;
        Profile.update();
    }

    private skills: Array<SkillState>;

    constructor(name = "", skills: Array<SkillState> = []) {
        this._name = name;
        this.skills = skills;
    }

    static decode(profileCode: string) {
        const params = new URLSearchParams(profileCode);
        let name = "";
        let skills: Array<SkillState> = [];
        params.forEach(function(value, key) {
            switch (key) {
                case "name":
                    name = value;
                    break;
                default:
                    skills.push(new SkillState(key, parseInt(value)));
            }
        });
        return new Profile(name, skills);
    }

    encode() {
        const params = new URLSearchParams();
        params.append("name", this.name);
        for (let skill of this.skills) {
            params.append(skill.id, skill.currentLevel.toString());
        }
        return params.toString();
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
    
    /*****************************/
    /* Static Properties/Methods */
    /*****************************/

    private static all: Array<Profile>;
    private static _currentIndex: number;
    static onUpdate = function() {};

    static get currentIndex() { return this._currentIndex; }
    static set currentIndex(newValue) {
        this._currentIndex = newValue;
        this.update();
    }
    static get current() { return Profile.all[Profile.currentIndex]; }

    static add(profile: Profile) {
        this.all.push(profile);
        this._currentIndex = Profile.all.length - 1;
        this.update();
    }

    static removeCurrent() {
        if (this.all.length === 1) { this.all.push(new Profile("")); }
        this.all.splice(this.currentIndex, 1);
        this.currentIndex = 0;

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
    }

    /**
     * Saves all state to local storage, and calls the `onUpdate` callback. Called automatically when modifying properties of `Profile`s and `SkillState`s.
     */
    static update() {
        this.saveAllToStorage();
        this.onUpdate();
    }
}

/**
 * Any kind of level in the game; subclasses can use different `page` values to have completely different gameplay.
 */
abstract class AnyLevel {
    readonly name: string;
    /** The base name of the HTML page used to play this level */
    readonly page: string;
    readonly icon: string;

    protected constructor(name: string, page: string, icon: string) {
        this.name = name;
        this.page = page;
        this.icon = icon;
    }

    /** Returns a pseudo(-not-very-)random number between 0 and `upperBound`, which will always be the same for this level */
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

    /** Returns the index of the level the current page describes, or `undefined` if not on a level page */
    static get currentIndex() {
        const params = new URLSearchParams(location.search);
        const result = params.get("level");
        if (result === null) { return undefined; }
        return parseInt(result);
    }

    /** Returns the level being displayed by the current page, or `undefined` if not on a level page */
    static get current() {
        const index = AnyLevel.currentIndex;
        if (index === undefined) { return undefined; }
        return Skill.current?.levels[index];
    }

    /** Sets up the current page as a level page, with appropriate title, header, and exit button. Also loads all `Profile`s. */
    static initializePage() {
        if (this.current === undefined) { assertionFailure(); }

        Profile.loadAllFromStorage();

        $("h1").text(this.current.name);
        document.title = `${this.current.name} - Rhythm Game`;

        const exitButton = $(`<div style="position: fixed; left: 1em; top: 1em; z-position: 1000;" id="exitButton"></div>`);
        $(document.body).append(exitButton);
        exitButton.button({
            label: "Exit Level",
            icons: { primary: "ui-icon-home" }
        }).on("click", function() {
            AnyLevel.exit();
        });
    }

    /** Advances the unlocked level of the current skill by one; call only from a level page (when it's complete). */
    static advance() {
        if (Skill.current === undefined) { assertionFailure(); }
        if (Profile.current.skillState(Skill.current.id).currentLevel === AnyLevel.currentIndex) {
            Profile.current.skillState(Skill.current.id).currentLevel = AnyLevel.currentIndex + 1;
        }
    }

    /** Exits the current level page, returning to the world. */
    static exit() {
        if (Skill.current == undefined || Skill.current.isCompleted) {
            location.href = "world.html";
        } else {
            location.href = `world.html?skill=${Skill.current.id}`;
        }
    }
}

interface LevelConstructor {
    name: string;
    timeSignature: TimeSignature;
    tempo?: Tempo;
    knownCounts?: Array<Count>;
    backingLoop?: number;
}

interface RandomLevelConstructor extends LevelConstructor {
    bars: number;
    blocks: Array<Block>;
}

interface ComposedLevelConstructor extends LevelConstructor {
    notes: Array<Note>;
}

/**
 * A normal level in the game; consists primarily of a piece of music to clap & count.
 */
class Level extends AnyLevel {
    readonly piece: Piece;
    readonly tempo: Tempo;
    readonly knownCounts: Array<Count>;

    constructor(data: RandomLevelConstructor | ComposedLevelConstructor) {
        let piece: Piece;
        let icon: string;

        let randomData = data as RandomLevelConstructor;
        let composedData = data as ComposedLevelConstructor;
        if (randomData.bars !== undefined && randomData.blocks !== undefined) {
            piece = Piece.random(randomData.timeSignature, randomData.bars, randomData.blocks, randomData.backingLoop);
            icon = "shuffle";
        } else if (composedData.notes !== undefined) {
            piece = new Piece(composedData.timeSignature, composedData.notes, composedData.backingLoop);
            icon = "volume-on";
        } else {
            assertionFailure();
        }

        super(data.name, "level", icon);

        this.piece = piece;
        this.tempo = data.tempo ?? 80;
        this.knownCounts = data.knownCounts ?? Count.allExceptCompoundAdvanced;
    }

    static get current() { return AnyLevel.current as Level; }
}

/**
 * An explanatory level that is automatically won just by reading it.
 */
class TextLevel extends AnyLevel {
    readonly html: string;

    constructor(name: string, html: string) {
        super(name, "text", "comment");
        this.html = html;
    }

    static get current() { return AnyLevel.current as TextLevel; }
}

/**
 * An ordered list of levels.
 */
class Skill {
    readonly id: string;
    readonly name: string;
    readonly levels: Array<AnyLevel>;

    constructor(id: string, name: string, levels: Array<AnyLevel>) {
        this.id = id;
        this.name = name;
        this.levels = levels;
    }

    /** Returns true if and only if the skill represented by `id` has been completed by `Profile.current`. */
    get isCompleted() {
        const currentLevel = Profile.current.skillState(this.id).currentLevel;
        return currentLevel >= this.levels.length;
    }

    private static all: Array<Skill> = [];

    static forID(id: string) {
        if (this.all.length === 0) { this.loadAll(); }
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
        this.all.push(new Skill("sixEightTest", "6/8 Test", [
            new Level({
                name: "6/8 Test Level",
                timeSignature: TimeSignature.sixEight,
                knownCounts: Count.allCompound,
                tempo: 60,
                notes: [
                    Note.quarter,
                    Note.eighth,
                    Note.eighth,
                    Note.sixteenth,
                    Note.sixteenth,
                    Note.eighth,
                    Note.eighth,
                    Note.quarter,
                    Note.quarter.dotted
                ]
            })
        ]));
        
        this.all.push(new Skill("fiveFourTest", "5/4 Test", [
            new Level({
                name: "5/4 Test Level",
                timeSignature: TimeSignature.fiveFour,
                knownCounts: Count.allSimple,
                notes: [
                    Note.eighth,
                    Note.quarter,
                    Note.eighth,
                    Note.sixteenth,
                    Note.sixteenth,
                    Note.eighth,
                    Note.eighth.dotted,
                    Note.sixteenth,
                    Note.sixteenth,
                    Note.eighth,
                    Note.sixteenth
                ]
            })
        ]));

        this.all.push(new Skill("randomEasy", "Random Easy", [
            new Level({
                name: "First Some Long Notes",
                timeSignature: TimeSignature.fourFour,
                tempo: 100,
                knownCounts: Count.allSimpleBasic,
                backingLoop: 0,
                bars: 8,
                blocks: [
                    new Block([Note.whole]),
                    new Block([Note.half]),
                    new Block([Note.quarter, Note.quarter]),
                    new Block([Note.half.dotted, Note.quarter])
                ]
            }),
            new Level({
                name: "Eighth Note Pairs",
                timeSignature: TimeSignature.fourFour,
                tempo: 80,
                knownCounts: Count.allSimpleBasic,
                bars: 8,
                blocks: [
                    new Block([Note.whole]),
                    new Block([Note.half]),
                    new Block([Note.quarter]),
                    new Block([Note.half.dotted]),
                    new Block([Note.eighth, Note.eighth])
                ]
            }),
            new Level({
                name: "Aah, Syncopation!",
                timeSignature: TimeSignature.fourFour,
                tempo: 60,
                knownCounts: Count.allSimpleBasic,
                bars: 8,
                blocks: [
                    new Block([Note.whole]),
                    new Block([Note.half]),
                    new Block([Note.quarter]),
                    new Block([Note.half.dotted]),
                    new Block([Note.eighth, Note.eighth]),
                    new Block([Note.quarter.dotted, Note.eighth], [0, 2]),
                    new Block([Note.eighth, Note.quarter, Note.eighth], [0, 2])
                ]
            })
        ]));

        this.all.push(new Skill("randomHard", "Random Hard", [
            new Level({
                name: "Random Hard Level",
                timeSignature: TimeSignature.fiveFour,
                knownCounts: Count.allSimple,
                bars: 8,
                blocks: [
                    new Block([Note.whole]),
                    new Block([Note.half]),
                    new Block([Note.quarter]),
                    new Block([Note.half.dotted]),
                    new Block([Note.eighth, Note.eighth]),
                    new Block([Note.quarter.dotted, Note.eighth]),
                    new Block([Note.eighth, Note.sixteenth, Note.sixteenth]),
                    new Block([Note.sixteenth, Note.sixteenth, Note.eighth]),
                    new Block([Note.sixteenth, Note.sixteenth, Note.sixteenth, Note.sixteenth])
                ]
            })
        ]));

        this.all.push(new Skill("rests", "Rests!", [
            new Level({
                name: "Rests!",
                timeSignature: TimeSignature.commonTime,
                knownCounts: Count.allSimpleBasic,
                notes: [
                    Rest.quarter,
                    Note.quarter,
                    Rest.eighth,
                    Note.eighth,
                    Note.quarter,
                    Rest.half,
                    Note.quarter,
                    Note.quarter
                ]
            }),
            new TextLevel("Let's Talk", `
                <p>I'm here to <strong>strongly</strong> encourage you to read about <em>rests</em>!</p>
            `),
            new Level({
                name: "Tricky Rest Countings",
                timeSignature: TimeSignature.commonTime,
                knownCounts: Count.allSimpleBasic,
                notes: [
                    Note.quarter,
                    Note.eighth, Rest.eighth,
                    Note.quarter,
                    Rest.eighth, Note.eighth,
                    Rest.half,
                    Rest.eighth, Rest.quarter, Rest.eighth
                ]
            }),
        ]));
        
        this.all.push(new Skill("sixteenths", "16th Notes", [
            new Level({
                name: "Every 16th Note Rhythm",
                timeSignature: TimeSignature.commonTime,
                knownCounts: Count.allSimple,
                bars: 8,
                blocks: [
                    Block.required([Note.sixteenth, Note.sixteenth, Note.eighth]),
                    Block.required([Note.eighth, Note.sixteenth, Note.sixteenth]),
                    Block.required([Note.sixteenth, Note.sixteenth, Note.sixteenth, Note.sixteenth]),
                    Block.required([Note.sixteenth, Note.eighth, Note.sixteenth]),
                    new Block([Note.quarter]),
                    new Block([Note.half]),
                    new Block([Note.whole]),
                    new Block([Note.eighth, Note.eighth]),
                    new Block([Note.eighth, Note.quarter, Note.eighth], [0,2]),
                    new Block([Note.quarter.dotted, Note.eighth], [0,2]),
                    new Block([Note.half.dotted]),
                    new Block([Rest.half]),
                    new Block([Rest.quarter]),
                    new Block([Rest.eighth, Note.eighth])
                ]
            })
        ]));
    }
}