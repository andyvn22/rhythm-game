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
        let skills: Array<SkillState> = [];
        params.forEach(function(value, key) {
            switch (key) {
                case "name":
                    name = value;
                    break;
                case "finishedSkill":
                    finishedSkill = value;
                    break;
                default:
                    skills.push(new SkillState(key, parseInt(value)));
            }
        });
        return new Profile(name, skills, finishedSkill);
    }

    encode() {
        const params = new URLSearchParams();
        params.append("name", this.name);
        params.append("finishedSkill", this.finishedSkill);
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
            label: "Exit Level",
            icons: { primary: "ui-icon-home" }
        }).on("click", function() {
            Level.exit();
        });

        const shouldShowFinalLevel = (Level.current!.index == Skill.current!.levels.length - 1) && (Level.current!.index == Profile.current.skillState(Skill.current!.id).currentLevel);
        const finalLevel = shouldShowFinalLevel ? `<span class="finalLevel"><span class="ui-icon ui-icon-key"></span>&nbsp;This level completes the &quot;${Skill.current!.name}&quot; skill!</span>` : ``;

        const splash = $(`
            <div title="Level ${Level.current!.index+1}/${Skill.current!.levels.length} in &quot;${Skill.current!.name}&quot;">
                <h2>${Level.current!.index+1}. ${this.current.name} <span class="ui-icon ui-icon-${Level.current!.icon}"></span></h2>
                <p>${this.current.description}</p>
                ${finalLevel}
            </div>
        `);
        splash.dialog({
            modal: true,
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
            }
        });
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
            location.href = "world.html";
        } else {
            location.href = `world.html?skill=${Skill.current.id}`;
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
}

/**
 * An explanatory level that is automatically won just by reading it.
 */
class TextLevel extends Level {
    readonly html: string;

    constructor(data: TextLevelConstructor) {
        super(data.name, "text", "comment", data.description, data.pageTitle);
        this.html = data.html;
    }

    static get current() { return Level.current as TextLevel; }
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
        function newSkill(newData: SkillConstructor) {
            Skill.all.push(new Skill(newData));
        }

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
        //const DE = Rest.eighth.dotted;
        const s = Note.sixteenth;
        const S = Rest.sixteenth;

        newSkill({
            id: "welcome",
            name: "Welcome!",
            knownCounts: [Count.beat],
            levels: [
                new ComposedLevel({
                    name: "First Steps",
                    description: "Just tap on every beat&mdash;no claps in here. Should be easy enough, right? Tap, tap, tap, tap...",
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
                    description: "Good so far! Go again&mdash;but speak all the numbers out loud this time. Oh, by the way&mdash;these are called &quot;whole rests&quot;.",
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
                    description: "Whole notes are just like whole rests&mdash;four beats long.<br/><br/>...Except they're notes. Which means you <em>clap</em> when they start.",
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
                    description: "Let's mix it up. And speed it up! And finish this first skill up!!",
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
                    description: "They're two beats long, and they look like upside-down whole rests.<br/><br/>...<em>I</em> like to think that <em><strong>wh</strong>ole</em> rests look like <em><strong>h</strong>oles</em> that you could fall into, but <em>hal<strong>f</strong></em> rests look like <em>ha<strong>t</strong>s</em>. But you probably shouldn't listen to me...",
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
                    description: "They're two beats long, and they look like whole notes, only with stems. Maybe they're flowers! Delicious, two-beat-long flowers...",
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
                    description: "Quarter notes look like half notes that somebody filled in with a sharpie, and are only one beat long. Or I guess they might have used a black crayon. Or perhaps some sort of paint&mdash;what do you think?",
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
                    description: "Quarter rests are one beat long and they look like... well... I'm not even sure. Weird little squiggly things? Yes, that.",
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
                    description: "Let's try another! Don't clap in those quarter rests, or they'll be sad. You don't want sad, weird little squiggly things, do you? <em>No.</em> Of course you don't.",
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
                new RandomLevel({
                    name: "All Together Now",
                    description: "Did I hear you say, &quot;Gee, I sure would love to have to remember every note and rest I've learned so far!&quot;? I'm pretty sure I did.",
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
                new RandomLevel({
                    name: "100 bpm",
                    description: "Can you keep up?<br/><br/>...'Cause <em>I</em> can. Just sayin&apos;. I'm great at this one. Like... <em>so</em> good.",
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
                    description: "You realize that if you say &quot;three&quot; or &quot;four&quot; in here you're going to make Reginald <em>very</em> angry, right? Because there's a two on top of the time signature, there are only two beats in each measure.",
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
                    description: "...I'm... I'm sorry about this...",
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
                    description: "Eighth notes look like a quarter notes with beams coming off of &apos;em, and they're only <strong>half</strong> a beat long. That means two of them fit on every beat.<br/><br/>Oh... you'll need to clap halfway between two beats sometimes, now. When you do, say &quot;and&quot; (write &quot;+&quot;).",
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
                    description: "How are these pieces I'm writing for you? Are they any good? I can't read music, so I wouldn't know.",
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
                    description: "Have you noticed eighth notes are exactly twice as fast as quarter notes? No? Shame on you. These poor eighth notes, crawling all over the page for you, and you're neglecting their little feelings. Think about their lengths!",
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
                    description: "Be on the lookout for quarter notes! They're hiding in there.<br/><br/>Quarter notes are known to be sneaky.",
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
                    description: "Eighth rests look like... a really fancy seven, I guess. I don't know&mdash;look, the point is they're half a beat long, so one beat can fit two eighth rests.<br/><br/>Do you remember when to count &quot;and&quot; (+)? When you're clapping halfway between beats&mdash;in other words, <strong>not now!</strong>",
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
                    description: "When they're all alone, eighth notes' beams fall down and become flags.<br/>Poor li&apos;l lonely dudes.<br/>But they're still eighth notes. So they're still half a beat long. And you still shouldn't count &quot;and&quot; (+) out loud unless you're clapping on it.",
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
                    description: "Remember&mdash;you should only speak if you're either clapping or tapping. Not if you're rapping. Or zapping. Or napping.<br/><br/>Especially napping.<br/><br/>Or mapping. (I didn't even know you were into cartography!)",
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
                    description: "Giving a confident tap on the odd-numbered beats may help with this one. Or it may just make you look cool. Either way, you should probably go for it.",
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
                    description: "Something something even numbered beats mumble.<br/><br/>I'm tired today; you're on your own.",
                    timeSignature: TimeSignature.fourFour,
                    tempo: 60,
                    notes: [
                        e, e, E, e, e, e, E, e,
                        e, e, E, e, q, Q,
                        e, e, E, e, e, e, E, e,
                        e, e, E, e, e, E, Q
                    ]
                }),
                new ComposedLevel({
                    name: "Offbeats",
                    description: "Keep that beat steady and bounce your &quot;and&quot;s off it.<br/><br/>You know, some people call <em>me</em> &quot;off-beat&quot;. ...I'm not sure what they mean.",
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
                    description: "Don't understand the name? You will later...<br/><br/>I mean, I hope you will. I don't know. Maybe you won't.",
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
                    description: "This one's tough, but you're almost there... eh, never mind, just give up now.<br/><br/>Still here? Good... goooooooood...",
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
                    description: "It's the eighth-noteiest!&trade;",
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
                        Block.required([E, e])
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
                    description: "A dot makes a note longer&mdash;it adds half the note's original length.<br/><br/>A whole note is 4 beats long, and dotting it adds half that, and half of 4 is 2. So... a dotted whole note is 4 + 2 = <strong>6</strong> beats long.<br/><br/>I know how to add 4 and 2, because I'm smart. You're going to notice the <strong>6</strong> on top of this time signature, because you're smart, too.",
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
                    description: "Remember, a dot makes a note 50% longer&mdash;so a dotted half note is 2 + 1 = <strong>3</strong> beats long.<br/><br/>That's right, it's math class now. Your teacher <em>told</em> you it would come in handy.",
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
                    description: "Half notes are always telling me they're two beats long, so I guess &quot;half a half note&quot; is one beat long, and that's what a dot adds.<br/><br/>(And 2 + 1 = 3. Just in case you weren't sure.)",
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
                    description: "Do you think dotted whole notes and dotted half notes are friends? Or will they eat each other?<br/><br/>Time for a science experiment.",
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
                    description: "Did I hear you say, &quot;This game is fun, but it needs way more fractions!&quot;? I'm pretty sure I did.<br/><br/>Remember, a dot increases a note's length by half its original value&mdash;so a dotted quarter note is 1 + &frac12; = <strong>1&frac12; beats</strong> long.<br/>That's <strong><sup>3</sup>&frasl;<sub>2</sub> beats</strong> if you're a mathematician.<br/>Or <strong>1.5 beats</strong> if you have poor taste in numbers. Eww.",
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
                    description: "Pop quiz: which is longer: 1&frac12; or 1?<br/><br/>I solve this by imagining 1&frac12; pies, and wanting to eat them. They are blueberry.<br/><br/>Dotted quarter notes are longer than one beat long. That's why the next beat starts before you move on from the dotted quarters.",
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
                new ComposedLevel({
                    name: "And the Rest",
                    description: "Think of the eighth notes as &quot;bouncing off of&quot; the beat just before them. Don't worry&mdash;the beat is a good sport about it.",
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
                    description: `Sixteenth notes look like eighth notes, except they have a second beam or second flag. Somehow, this makes them go faster. It doesn't look very aerodynamic to me.<br/>
                    Whatever. The point is, they're only <strong>one quarter</strong> of a beat long&mdash;half as long as eighth notes! Ready?<br/>
                    <br/>
                    No. No, you're not ready. You need to know a bunch of stuff now:
                    <ul>
                        <li>You'll need to know the count for <strong>one quarter</strong> of the way through the beat: <strong>e</strong>. That's right, just say &quot;eee!&quot; like the second sixteenth note of each beat is a large spider.</li>
                        <li>You <em>already know</em> the count for <strong>two quarters</strong> of the way through the beat, because one time a math teacher told me two quarters equals one half: <strong>and</strong>. Which we write as &quot;+&quot; for some reason&mdash;maybe because &quot;&amp;&quot; is so hard to draw.</li>
                        <li>You'll need to know the count for <strong>three quarters</strong> of the way through the beat: <strong>a</strong> (pronounced &quot;duh&quot;). (You know... for a count pronounced &quot;duh&quot;, its pronunciation is ironically non-obvious.)</li>
                    </ul>`,
                    timeSignature: TimeSignature.fourFour,
                    tempo: 60,
                    notes: [
                        w,
                        h, h,
                        q, q, q, q,
                        e, e, e, e, e, e, e, e,
                        s, s, s, s, s, s, s, s, s, s, s, s, s, s, s, s,
                        s, s, s, s, s, s, s, s, s, s, s, s, s, s, s, s,
                        w,
                        W
                    ]
                }),
                new ComposedLevel({
                    name: "Building it Up",
                    description: "Have you noticed that four sixteenth notes fit in a beat? Good. They've noticed you, too.",
                    timeSignature: TimeSignature.fourFour,
                    tempo: 60,
                    notes: [
                        s, s, s, s, s, s, s, s, s, s, s, s, s, s, s, s,
                        s, s, s, s, s, s, s, s, s, s, s, s, s, s, s, s,
                        s, s, s, s, s, s, s, s, s, s, s, s, s, s, s, s,
                        e, e, e, e, e, e, e, e,
                        q, q, q, q,
                        h, h,
                        w,
                        W
                    ]
                }),
                new ComposedLevel({
                    name: "Halves and Sixteenths",
                    description: "How many sixteenth notes fit in a half note?<br/><br/>No, the answer is not &quot;as many as I can cram in there.&quot; You need to calm down.",
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
                    description: "How many sixteenth notes fit in a quarter note?<br/><br/>It's 93. 93 sixteenth notes.</br><br/>I'm just messing with you. It's 7.2&times;10<sup>53</sup>.<br/><br/><br/><br/>...Okay, it might be four.",
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
                new ComposedLevel({
                    name: "One Beam or Two?",
                    description: "How many sixteenth notes fit in an eighth note? Hint: it's the same number as the number of entire cheesecakes I ate for breakfast this morning.<br/><br/>Oh, were you not there for that?",
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
                    description: "A sixteenth rest looks like an eighth rest, if it had a second globby thingy on it! On Thursdays, it's &frac14; of a beat long.<br/><br/>It is <em>also</em> &frac14; of a beat long on all the <em>other</em> days.",
                    timeSignature: TimeSignature.fourFour,
                    tempo: 60,
                    notes: [
                        Q, Q, S, S, S, S, Q,
                        s, s, s, s, s, S, S, S, s, s, s, s, s, S, S, S,
                        s, S, S, S, s, S, S, S, s, S, S, S, s, S, S, S,
                        s, S, S, S, s, S, s, S, s, S, s, S, s, S, S, S
                    ]
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
                    description: "Remember sixteenth notes are twice as fast as eighth notes. And eighth notes are twice as slow as sixteenth notes. And the sun could fit 1.3 million copies of Earth inside it. That's not really relevant to this piece; I just think it's cool.",
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
                    description: "See how the last two sixteenth notes of the beat have been combined into an eighth note? They don't even like each other, and they're stuck in there together. Just for you. I hope you're happy.",
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
                    description: "See how the first eighth note in the pair has been split into two sixteenth notes?<br/><br/>Do you know how <em>difficult</em> that is to do? I had to buy a special kind of hammer!",
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
                    description: "Remember two sixteenth notes fit into an eighth note. Also remember my birthday&mdash;you didn't forget it already, did you?",
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
                    description: "See how the first two sixteenth notes of the beat have been combined into an eighth note?<br/><br/>It takes a lot of gymnastics to bend their little beams and fit in there.",
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
                    description: "See how the second eighth note in the pair has been split into two sixteenth notes?<br/><br/>No? Okay, it's like if I had an adorable puppy, and I split it into two half-pup... you know, I'm not sure this analogy is helping.",
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
                    description: "You've mastered &quot;1 + a&quot; and &quot;1 e +&quot, but can you tell them apart?<br/><br/>Hint: &quot;1 + a&quot; wears high heels; &quot;1 e +&quot; wears sneakers.<br/><br/>Another, perhaps more helpful, hint: a sixteenth note has two beams; an eighth note has one.",
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
                    description: "I know these are hard to &quot;1 + &quot; and &quot;1 e +&quot; apart, but it's really important that you can. Mostly because they get really offended when you confuse them. C'mon. How about a little empathy?",
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
                    description: "An eighth note is &frac12; a beat, so dotting it adds another &frac14;.<br/><br/>To add those together... does the phrase &quot;common denominator&quot; ring any bells? Well, then, tell it to stop making noise; I'm trying to focus and do math. A <strong>dotted eighth note</strong> is &frac12; + &frac14; = <strong>&frac34; of a beat</strong>.<br/><br/>Oh, uh, and don't forget: the count <strong>a</strong> is not, uh, pronounced &quot;uh&quot;. It's &quot;duh&quot;. Duh!",
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
                    description: "Do you know how many sixteenth notes fit in a dotted eighth note? Here, I'll help you. One moment.<br/><br/>There. I've hidden the answer somewhere in the next piece.<br/><br/>It's the time signature. I hid it on top of the time signature. Sorry I gave it away. I'm too excited.",
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
                    description: "See how the first three sixteenth notes of the beat have been combined into a dotted eighth note? It's, like, super-crowded in there. Everybody's shoving each other.<br/><br/>What are you still doing here!? Get going! I don't think they can stay in there much longer.",
                    timeSignature: TimeSignature.fourFour,
                    tempo: 60,
                    notes: [
                        s, s, s, s, de, s, de, s, de, s,
                        s, s, s, s, s, s, s, s, de, s, de, s,
                        s, s, s, s, s, s, s, s, s, s, s, s, de, s,
                        s, s, s, s, de, s, h
                    ]
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
                    description: "Are you ready to play with a dotted eighth note followed by a sixteenth note? Of course you are; look at you. You can hardly contain yourself.<br/><br/>Look, I don't care <em>how</em> excited you are; there's no need to jump on the furniture like that.",
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
                    name: "Slowly at First Again",
                    description: "Just like we can pretend 6 over 8 is 2 over dotted quarter note, can we pretend 3 over 4 is 1 over dotted <em>half</em> note?<br/><br/>Yes. Yes, we can.",
                    timeSignature: new TimeSignature(1, dh),
                    tempo: 40,
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
                    description: "Can you believe those dotted half notes are only one beat long now?<br/><br/>I can. I can believe anything. Aren't you jealous?<br/><br/>Right now I believe there's an invisible dragon watching you perform. I believe he's impressed.",
                    timeSignature: new TimeSignature(1, dh),
                    tempo: 40,
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
                new ComposedLevel({
                    name: "Viennese Waltz",
                    description: "I hate it when people think they can just waltz into my room, when the music I'm listening to is clearly in four four.",
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
            id: "bottomNumber",
            name: "The Bottom &quot;Number&quot;",
            knownCounts: Count.allSimpleBasic,
            levels: [
                new ComposedLevel({
                    name: "Twice the Length: Easy",
                    description: `The bottom number of the time signature has a secret: it's <em>not a number</em>.<br/>
                    It's a <em>note</em>. And yes, it's in disguise&mdash;but it's <em>terrible</em> at disguises, because we all know who's in there:<br/>
                    <strong>8</strong> for <strong>8</strong>th note. <strong>4</strong> for <strong>quarter</strong> note. <strong>2</strong> for <strong>half</strong> note.<br/>
                    <br/>
                    Specifically, the bottom of the time signature tells us <strong>what note gets one beat</strong>. The 4 we're used to seeing down there is a <strong>4</strong> for <strong>quarter</strong> note&mdash;and it's the <em>only</em> reason that quarter notes have been one beat long so far.<br/>
                    <br/>
                    What if we change it to an <strong>8</strong>? <strong>Eighth notes</strong> are now <strong>one beat long</strong>. (And that means <strong>quarter notes</strong> must be <strong>two</strong>! AGH! Everything is different!)`,
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
                new ComposedLevel({
                    name: "Twice the Length: Hard",
                    description: "While you were working on that last one, I wrote you a song.<br/><br/><em>🎵 La la la, we know an eighth note's one beat in this song<br/>Ooh, you know a quarter note's twice as long!<br/>So a quarter's two, so if you dot it it's three,<br/>Whoah oh oh. Whoah oh oh. 🎶</em><br/><br/>I didn't spend a lot of time on it. I had other things to do.",
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
                    description: "Finally getting used to it, right? Great! Let's do something totally different.<br/>What if we put a 2 down there? <strong>2</strong> for <strong>half</strong> note; <strong>half notes</strong> are now <strong>one</strong> beat.",
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
                    description: "Do you understand that because two half notes fit in a whole note, and half notes are <strong>one</strong> beat now, that a <strong>whole note</strong> must be <strong>two</strong> beats?<br/><br/>No? So I <em>half</em> to explain the <em>whole</em> thing?",
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
                new ComposedLevel({
                    name: "Half the Length: Hard",
                    description: "If half notes are one beat long, what about quarter notes? Two quarter notes still have to fit in one half note, so quarter notes must only be <strong>half a beat</strong>!<br/><br/>Aww. Tiny little quarter notes. They're so cute!",
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
                    description: "Can we put a 1 on the bottom? Sure, we can! Why would we ever want <strong>whole notes</strong> to be <strong>one beat</strong> long? I... really don't know... But now they are!",
                    timeSignature: new TimeSignature(3, w),
                    tempo: 80,
                    notes: [
                        w, w, w,
                        h, h, h, h, w,
                        w, w, w,
                        dw, h, w
                    ]
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
                    description: `Psst! Over here! Listen, we've got a problem: we've been making <strong>quarter notes</strong> one beat long for most of our pieces. And now we've played with <strong>eighth notes</strong> getting the beat, <strong>half notes</strong> getting the beat, and even <strong>whole notes</strong> getting the beat! (By the way, I apologize for that last one. That was just weird.)<br/>
                    Well, the <strong>dotted quarter notes</strong> have been watching us, and they're pretty jealous. Can we make a <strong>dotted quarter note</strong> one beat long&mdash;just to make them feel better?<br/>
                    Thanks; you're so nice.<br/>
                    <br/>
                    But, oh! What number can we put on the bottom to mean &quot;dotted quarter note&quot;? Uhh... okay, here's the plan: let's just lie. We'll know the time signature is <em>really</em> <strong>two</strong> over <strong>dotted quarter note</strong>, but we'll just write <strong>six</strong> over <strong>eight</strong>, because I don't have the time or energy to figure out how to write &quot;dotted quarter note&quot; as a number.<br/>
                    <br/>
                    That'll work out fine. We'll make the dotted quarter notes happy. Just pretend the time signature says <strong>two</strong> over <strong>dotted quarter note</strong>. Shh!`,
                    timeSignature: TimeSignature.sixEight,
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
                    description: `Okay... this is going just fine. The dotted quarters sure love being the beat. They threw a little party for us. There was cake. I forgot to tell you about it. It was delicious. Let's do another.<br/>
                    Just remember: there are <strong>two</strong> beats per measure, and a <strong>dotted quarter note</strong> is one beat long&mdash;no matter what the time signature <em>claims</em>.<br/>
                    <br/>
                    Say... that means that <strong>dotted half notes</strong> are <strong>two</strong> beats long, right? Mmm... two... the number of cakes they gave us at the party...<br/>
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
                    description: `How many eighth notes fit in a dotted quarter? Oh, no reason. I'm asking for a friend. I certainly didn't cram three of them in there while you weren't looking, without checking if that was correct.<br/>
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
                new ComposedLevel({
                    name: "Ma",
                    description: "It's really okay if you're struggling: five out of four people have trouble with fractions.",
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
                    description: `Would you prefer I say that an eighth note is <strong>0.3333...</strong> beats long? Y'know, just in case you like decimals better.<br/><br/>Personally, I prefer fractions, but some people say they're <em>pointless</em>.`,
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
                    description: `Truly, if you'd prefer decimals, (you're wrong but) just go for it! Let's just not fight about it: it's so <em>divisive</em>.`,
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
                    description: `I'd keep going with the jokes, but I'm afraid only a fraction of people will enjoy them.`,
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
                        q, e, q, e,
                        e, q, e, q,
                        e, e, e, e, e, e,
                        dh
                    ]
                }),
                new RandomLevel({
                    name: "Compounding Compound Rhythms",
                    description: `My, we really have gotten stuck in this lie, haven't we?<br/>
                    <br/>
                    Oh, well!`,
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
                new RandomLevel({
                    name: "Have a Rest",
                    description: `Or a whole bunch of rests! Oh, you thought... no. No rest. Only rests!`,
                    timeSignature: TimeSignature.sixEight,
                    tempo: 60,
                    bars: 8,
                    blocks: [
                        Block.required([e, E, e]),
                        Block.required([e, e, E]),
                        Block.required([E, e, e]),
                        Block.required([DQ]),
                        new Block([q, e]),
                        new Block([e, q]),
                        new Block([e, e, e]),
                        new Block([dq]),
                        new Block([dh])
                    ]
                }),
            ]
        });

        newSkill({
            id: "compoundTime2",
            name: "Meet Sixteenth Notes: Compound",
            knownCounts: Count.allCompound,
            levels: [
                new ComposedLevel({
                    name: "Subdividing",
                    description: `Sixteenth notes look like eighth notes, except they have a second beam or second flag. Somehow, this makes them go faster. It doesn't look very aerodynamic to me.<br/>
                    Whatever. The point is, they're only <strong>one <em>sixth</em></strong> of a beat long&mdash;half as long as eighth notes! Ready?<br/>
                    <br/>
                    No. No, you're not ready. You need to know a whole ton of stuff now:
                    <ul>
                        <li>You'll need to know the count for <strong>one sixth</strong> of the way through the beat: <strong>di</strong>. Not to be confused with &quot;d&quot;, the first letter of &quot;<strong>d</strong>on't be frightened by the absurd number of new countings you're about to learn&quot;.</li>
                        <li>You <em>already know</em> the count for <strong>two sixths</strong> of the way through the beat, because one time a math teacher told me two sixths equals one third: <strong>ta</strong>.</li>
                        <li>You'll need to know the count for <strong>three sixths</strong> of the way through the beat: <strong>ti</strong>. This one's really going to cook your noodle... ready? <strong>Yes</strong>, three sixths equals one half... and yet <strong>no</strong>, ti doesn't equal and. Let that simmer for a while.</li>
                        <li>You <em>already know</em> the count for <strong>four sixths</strong> of the way through the beat, because four sixths equals two thirds: <strong>ma</strong>. (And unlike with &quot;ti&quot;, math works.)</li>
                        <li>You'll need to know the count for <strong>five sixths</strong> of the way through the beat: <strong>mi</strong>. Yes, this means the last two sixths of the beat are &quot;ma mi&quot;. And yes, that's hilarious and fun.</li>
                    </ul>`,
                    timeSignature: TimeSignature.sixEight,
                    tempo: 40,
                    notes: [
                        dh,
                        dh,
                        dq, dq,
                        e, e, e, e, e, e,
                        s, s, s, s, s, s, s, s, s, s, s, s,
                        s, s, s, s, s, s, s, s, s, s, s, s,
                        dh,
                        DH
                    ]
                }),
                new ComposedLevel({
                    name: "Building it Up",
                    description: "Have you noticed that six sixteenth notes fit in a beat? No? Well... they do!",
                    timeSignature: TimeSignature.sixEight,
                    tempo: 40,
                    notes: [
                        s, s, s, s, s, s, s, s, s, s, s, s,
                        s, s, s, s, s, s, s, s, s, s, s, s,
                        s, s, s, s, s, s, s, s, s, s, s, s,
                        s, s, s, s, s, s, s, s, s, s, s, s,
                        e, e, e, e, e, e,
                        e, e, e, e, e, e,
                        dq, dq,
                        dh
                    ]
                }),
                new ComposedLevel({
                    name: "One Beam or Two?",
                    description: "How many sixteenth notes fit in an eighth note? Hint: it's the same as the minimum number of kittens everyone should have.",
                    timeSignature: TimeSignature.sixEight,
                    tempo: 40,
                    notes: [
                        e, e, e, e, e, e,
                        s, s, s, s, s, s, s, s, s, s, s, s,
                        e, e, e, s, s, s, s, s, s,
                        dh,
                        s, s, s, s, s, s, e, e, e,
                        s, s, s, s, s, s, e, e, e,
                        e, e, e, s, s, s, s, s, s,
                        dh
                    ]
                }),
                new ComposedLevel({
                    name: "Splitting the Beat",
                    description: "Bye-bye, beat!",
                    timeSignature: TimeSignature.sixEight,
                    tempo: 40,
                    notes: [
                        dq, dq,
                        e, e, e, e, e, e,
                        s, s, e, e, s, s, e, e,
                        dh,
                        s, s, e, e, s, s, e, e,
                        s, s, e, e, s, s, e, e,
                        s, s, e, e, s, s, e, e,
                        dh
                    ]
                }),
                new ComposedLevel({
                    name: "Splitting the Ta",
                    description: "Ta-ta, ta!",
                    timeSignature: TimeSignature.sixEight,
                    tempo: 40,
                    notes: [
                        dq, dq,
                        e, e, e, e, e, e,
                        e, s, s, e, e, s, s, e,
                        dh,
                        e, s, s, e, e, s, s, e,
                        e, s, s, e, e, s, s, e,
                        e, s, s, e, e, s, s, e,
                        dh
                    ]
                }),
                new ComposedLevel({
                    name: "Splitting the Ma",
                    description: "M... m... I got nothing.<br/><br>Adi&ograve;s, ma!",
                    timeSignature: TimeSignature.sixEight,
                    tempo: 40,
                    notes: [
                        dq, dq,
                        e, e, e, e, e, e,
                        e, e, s, s, e, e, s, s,
                        dh,
                        e, e, s, s, e, e, s, s,
                        e, e, s, s, e, e, s, s,
                        e, e, s, s, e, e, s, s,
                        dh
                    ]
                }),
                new ComposedLevel({
                    name: "Splitting Them All",
                    description: "Keep your eye on the beams... one for &frac13;, two for &frac16;.<br/><br/>Plus they're just plain suspicious.",
                    timeSignature: TimeSignature.sixEight,
                    tempo: 40,
                    notes: [
                        s, s, e, e, s, s, e, e,
                        s, s, e, e, dq,
                        e, s, s, e, e, s, s, e,
                        e, s, s, e, dq,
                        e, e, s, s, e, e, s, s,
                        e, e, s, s, dq,
                        s, s, e, e, e, s, s, e,
                        e, e, s, s, dq
                    ]
                }),
                new RandomLevel({
                    name: "Splitting Whatever",
                    description: "I threw all these rhythms in the mixer, and they've turned into a delicious batter. You perform&mdash;I'll be over here licking the beaters.<br/>AGHgAghGHGHGHHH!!<br/><br/>...I guess I should turn off the mixer first.",
                    timeSignature: TimeSignature.sixEight,
                    tempo: 40,
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
            id: "cutTime",
            name: "Cut Time",
            knownCounts: Count.allSimple,
            levels: [
                new ComposedLevel({
                    name: "Yes, We Half Two",
                    description: "This time signature is two two, but it prefers to be called &quot;cut time&quot;. Let's honor its wishes.",
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
                    so you gave quarter notes half a beat.`,
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
                    description: "Question: if a half note is one beat long, then a dotted half note is...?<br/><br/>Answer: in this piece.",
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
        });

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
                    description: "These quarter notes don't even realize that they're part of a secret plot to hide certain beats. They're unwitting pawns. I just thought I should tell you that. Don't blame them.",
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
                    description: "Draaaaaaaaaaag<br/><br/>it<br/><br/><br/><br/>ouuuuuuuuuuuuuuuuuut.",
                    timeSignature: TimeSignature.fourFour,
                    tempo: 80,
                    notes: [
                        e, q, e, h,
                        e, q, e, h,
                        e, q, q, e, q,
                        e, q, q, e, q,
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
                new RandomLevel({
                    name: "More Mixopation",
                    description: "It's just like before, but with more&mdash;syncopation galore! I implore you: pore over these notes I adore, or your score at the end of this chore may be one you deplore (or&mdash;roar!&mdash;less than you swore it'd be), and you'll need an encore&mdash;don't ignore this call for an outpour of your skills from your mentor, with whom you've developed rapport despite jokes which wore on and became an eyesore that might bore your poor offshore carnivorous Baltimore icthyosaur... uh...<br/><br/>I think that sentence got away from me at the end, there.",
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
                }),
                new RandomLevel({
                    name: "Faster Mixopation",
                    description: "It's a blast from the past that is fast&mdash;the vast skills you've amassed might not last unsurpassed, as you might be outclassed&mdash;just compare and contrast all the patterns you've passed and you'll enthusiastically... broadcast... a chloroplast...<br/><br/>It happened again. Apologies.",
                    timeSignature: TimeSignature.fourFour,
                    tempo: 80,
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
                    name: "Hide the And",
                    description: "PSST!&mdash;I'll tell you a secret. If you <em>really</em> want to, you're allowed to count the missing &quot;and&quot; out loud&mdash;temporarily! Just while you get used to it. I won't tell.",
                    timeSignature: TimeSignature.twoFour,
                    tempo: 60,
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
                    description: "PSST!&mdash;follow-up secret: when I let you count the extra &mdash;and&mdash; (temporarily!), that was called &quot;subdividing&quot;. And <em>that <strong>is</strong></em> a real word.<br/><br/>...I guess this wasn't really a secret.",
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
                        Block.required([e, q, e], [1]),
                        Block.required([e, q, e], [2]),
                        new Block([q]),
                        new Block([e, e]),
                        new Block([h])
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
                    name: "1&frac12;",
                    pageTitle: "1½",
                    description: "The number of beats we'll float.",
                    timeSignature: TimeSignature.fourFour,
                    tempo: 60,
                    notes: [
                        s, e, s, q, h,
                        s, e, e, s, e, h,
                        s, e, e, s, e, s, e, e, s, e,
                        s, e, e, s, e, h
                    ]
                }),
                new ComposedLevel({
                    name: "2",
                    description: "The number of the level you're on.",
                    timeSignature: TimeSignature.fourFour,
                    tempo: 60,
                    notes: [
                        s, e, s, q, h,
                        s, e, e, s, e, h,
                        s, e, e, e, s, q, q,
                        s, e, e, e, s, h
                    ]
                }),
                new ComposedLevel({
                    name: "2&frac12;",
                    pageTitle: "2½",
                    description: "The number of times you'll have to retry this one.",
                    timeSignature: TimeSignature.fourFour,
                    tempo: 60,
                    notes: [
                        s, e, s, q, h,
                        s, e, e, s, e, h,
                        s, e, e, e, s, h,
                        s, e, e, e, e, s, e, q
                    ]
                }),
                new ComposedLevel({
                    name: "3",
                    description: "The number of parties you'll throw when you win.",
                    timeSignature: TimeSignature.fourFour,
                    tempo: 80,
                    notes: [
                        s, e, e, e, e, e, s, q,
                        s, e, e, e, e, e, s, q,
                        Q, s, e, e, e, e, e, s,
                        s, e, e, e, e, e, s, q
                    ]
                }),
                new ComposedLevel({
                    name: "3&frac12;&ndash;4",
                    pageTitle: "3½–4",
                    description: "The number of hours this'll take to learn.",
                    timeSignature: TimeSignature.fourFour,
                    tempo: 80,
                    notes: [
                        s, e, e, e, e, e, e, s, e,
                        s, e, e, e, e, e, e, s, e,
                        s, e, e, e, e, e, e, e, s,
                        s, e, e, e, s, q, Q
                    ]
                }),
                new ComposedLevel({
                    name: "Pop<sup>2</sup>",
                    pageTitle: "Pop Squared",
                    description: "You've heard this rhythm, too.",
                    timeSignature: TimeSignature.fourFour,
                    tempo: 60,
                    notes: [
                        de, de, e, h,
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
                    tempo: 80,
                    notes: [
                        de, de, de, de, q,
                        de, de, de, de, q,
                        Q, de, de, de, de,
                        de, de, de, de, q
                    ]
                }),
                new RandomLevel({
                    name: "Can <em>I</em> Even Clap This?",
                    pageTitle: "Can *I* Even Clap This?",
                    description: "Seriously. I had to check.<br/><br/>...It took a few attempts.",
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
                })
            ]
        })
    }
}