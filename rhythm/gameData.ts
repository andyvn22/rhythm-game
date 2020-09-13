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

interface LevelConstructor {
    name: string;
    description: string;
}

/**
 * Any kind of level in the game; subclasses can use different `page` values to have completely different gameplay.
 */
abstract class Level {
    readonly name: string;
    readonly description: string;
    /** The base name of the HTML page used to play this level */
    readonly page: string;
    readonly icon: string;

    /** The skill containing this level, set when it is added to a skill. */
    parentSkill!: Skill;
    /** The index of this level within the parent skill, set when it is added to a skill. */
    index!: number;

    protected constructor(name: string, page: string, icon: string, description: string) {
        this.name = name;
        this.description = description;
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

        document.title = `${this.current.name} - Rhythm Game`;

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
        }
    }

    /** If this is not the final level in the current skill, go to the next. Otherwise, return to the world. */
    static goToNext() {
        if (Level.current!.isFinal) {
            this.exit();
        } else {
            location.href = Skill.current!.levels[Level.current!.index + 1].pageURL;
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
        super(data.name, "piece", icon, data.description);

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
        super(data.name, "text", "comment", data.description);
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

        newSkill({
            id: "welcome",
            name: "Welcome!",
            knownCounts: [Count.beat],
            levels: [
                new ComposedLevel({
                    name: "First Steps",
                    description: "Just tap on every beat&mdash;no claps in here. Should be easy enough, right?",
                    backingLoop: 0,
                    timeSignature: TimeSignature.fourFour,
                    notes: [
                        Rest.whole,
                        Rest.whole,
                        Rest.whole,
                        Rest.whole
                    ]
                }),
                new ComposedLevel({
                    name: "Out Loud",
                    description: "Good so far! Go again&mdash;but speak all the numbers out loud this time. These are called &quot;whole rests&quot;, by the way.",
                    timeSignature: TimeSignature.fourFour,
                    notes: [
                        Rest.whole,
                        Rest.whole,
                        Rest.whole,
                        Rest.whole
                    ]
                }),
                new ComposedLevel({
                    name: "Whole Notes",
                    description: "Whole notes are just like whole rests&mdash;four beats long. Except they're notes. Which means you clap when they start.",
                    timeSignature: TimeSignature.fourFour,
                    notes: [
                        Rest.whole,
                        Note.whole,
                        Rest.whole,
                        Note.whole,
                        Rest.whole,
                        Note.whole,
                        Rest.whole,
                        Note.whole
                    ]
                }),
                new RandomLevel({
                    name: "Changing It Up",
                    tempo: 100,
                    description: "Let's mix it up. And speed it up. And finish this first skill up!",
                    timeSignature: TimeSignature.fourFour,
                    bars: 8,
                    blocks: [
                        Block.required([Note.whole]),
                        Block.required([Rest.whole])
                    ]
                })
            ]
        });

        newSkill({
            id: "halfNotes",
            name: "Half Notes",
            knownCounts: [Count.beat],
            levels: [
                new ComposedLevel({
                    name: "Half Rests",
                    description: "They're two beats long, and they look like upside-down whole rests. Or hats.",
                    tempo: 100,
                    timeSignature: TimeSignature.fourFour,
                    notes: [
                        Rest.half, Rest.half,
                        Rest.whole,
                        Rest.half, Rest.half,
                        Note.whole,
                        Rest.half, Rest.half,
                        Rest.whole,
                        Rest.half, Rest.half,
                        Note.whole
                    ]
                }),
                new ComposedLevel({
                    name: "Half Notes",
                    description: "They're two beats long, and they look like whole notes with stems.",
                    tempo: 100,
                    timeSignature: TimeSignature.fourFour,
                    notes: [
                        Note.half, Note.half,
                        Note.whole,
                        Note.half, Note.half,
                        Note.half, Note.half,
                        Note.half, Note.half,
                        Note.whole,
                        Note.half, Note.half,
                        Note.whole
                    ]
                }),
                new ComposedLevel({
                    name: "On & Off",
                    description: "Are you still counting the numbers out loud?",
                    timeSignature: TimeSignature.fourFour,
                    notes: [
                        Note.half, Rest.half,
                        Note.half, Rest.half,
                        Note.half, Rest.half,
                        Rest.whole,
                        Note.half, Rest.half,
                        Note.half, Rest.half,
                        Note.half, Rest.half,
                        Note.whole,
                    ]
                }),
                new ComposedLevel({
                    name: "Off & On",
                    description: "Loud out numbers the counting still you are?",
                    timeSignature: TimeSignature.fourFour,
                    notes: [
                        Note.whole,
                        Rest.half, Note.half,
                        Rest.half, Note.half,
                        Rest.half, Note.half,
                        Rest.whole,
                        Rest.half, Note.half,
                        Rest.half, Note.half,
                        Rest.half, Note.half,
                    ]
                }),
                new RandomLevel({
                    name: "Half Random",
                    description: "On & off & off & on...",
                    timeSignature: TimeSignature.fourFour,
                    bars: 8,
                    blocks: [
                        Block.required([Note.whole]),
                        Block.required([Rest.whole]),
                        Block.required([Note.half]),
                        Block.required([Rest.half])
                    ]
                })
            ]
        });

        newSkill({
            id: "quarterNotes",
            name: "Quarter Notes",
            knownCounts: [Count.beat],
            levels: [
                new ComposedLevel({
                    name: "Synchronized",
                    description: "Quarter notes look like filled-in half notes, and are only one beat long.",
                    timeSignature: TimeSignature.fourFour,
                    notes: [
                        Note.quarter, Note.quarter, Note.quarter, Note.quarter,
                        Note.quarter, Note.quarter, Note.quarter, Note.quarter,
                        Note.quarter, Note.quarter, Note.quarter, Note.quarter,
                        Note.half, Note.half,
                        Note.quarter, Note.quarter, Note.quarter, Note.quarter,
                        Note.quarter, Note.quarter, Note.quarter, Note.quarter,
                        Note.quarter, Note.quarter, Note.quarter, Note.quarter,
                        Note.half, Rest.half
                    ]
                }),
                new ComposedLevel({
                    name: "Ignore the Four",
                    description: "Quarter rests are one beat long and look like... I'm not even sure. (Weird little squiggly things.)",
                    timeSignature: TimeSignature.fourFour,
                    notes: [
                        Note.quarter, Note.quarter, Note.quarter, Rest.quarter,
                        Note.quarter, Note.quarter, Note.half,
                        Note.quarter, Note.quarter, Note.quarter, Rest.quarter,
                        Note.whole,
                        Note.quarter, Note.quarter, Note.quarter, Rest.quarter,
                        Note.quarter, Note.quarter, Note.half,
                        Note.quarter, Note.quarter, Note.quarter, Rest.quarter,
                        Note.quarter, Rest.quarter, Rest.quarter, Rest.quarter
                    ]
                }),
                new ComposedLevel({
                    name: "Boo, Two",
                    description: "Let's try another.",
                    timeSignature: TimeSignature.fourFour,
                    notes: [
                        Note.quarter, Rest.quarter, Note.quarter, Note.quarter,
                        Note.half, Note.quarter, Note.quarter,
                        Note.quarter, Rest.quarter, Note.quarter, Note.quarter,
                        Note.whole,
                        Note.quarter, Rest.quarter, Note.quarter, Note.quarter,
                        Note.half, Note.quarter, Note.quarter,
                        Note.quarter, Rest.quarter, Note.quarter, Note.quarter,
                        Note.quarter, Rest.quarter, Rest.half
                    ]
                }),
                new ComposedLevel({
                    name: "Free the Three",
                    description: "This is trickier than it looks!",
                    timeSignature: TimeSignature.fourFour,
                    notes: [
                        Note.quarter, Note.quarter, Rest.quarter, Note.quarter,
                        Note.quarter, Note.quarter, Rest.quarter, Note.quarter,
                        Note.quarter, Note.half, Note.quarter,
                        Note.quarter, Note.half, Note.quarter,
                        Note.quarter, Note.quarter, Rest.quarter, Note.quarter,
                        Note.quarter, Note.quarter, Rest.quarter, Note.quarter,
                        Note.quarter, Note.half, Note.quarter,
                        Note.whole
                    ]
                }),
                new ComposedLevel({
                    name: "Fun Without One",
                    description: "Don't add extra claps!",
                    timeSignature: TimeSignature.fourFour,
                    notes: [
                        Rest.quarter, Note.quarter, Note.quarter, Note.quarter,
                        Rest.quarter, Note.quarter, Note.quarter, Note.quarter,
                        Rest.quarter, Note.quarter, Note.quarter, Note.quarter,
                        Rest.quarter, Note.quarter, Note.half,
                        Rest.quarter, Note.quarter, Note.quarter, Note.quarter,
                        Rest.quarter, Note.quarter, Note.quarter, Note.quarter,
                        Rest.quarter, Note.quarter, Note.quarter, Note.quarter,
                        Note.half, Rest.quarter, Rest.quarter
                    ]
                }),
                new RandomLevel({
                    name: "All Together Now",
                    description: "Can you remember every note and rest you've learned so far?",
                    timeSignature: TimeSignature.fourFour,
                    bars: 8,
                    blocks: [
                        Block.required([Note.whole]),
                        Block.required([Rest.whole]),
                        Block.required([Note.half]),
                        Block.required([Rest.half]),
                        Block.required([Note.quarter, Rest.quarter]),
                        Block.required([Rest.quarter, Note.quarter]),
                        Block.required([Note.quarter, Note.quarter])
                    ]
                }),
                new RandomLevel({
                    name: "100 bpm",
                    description: "Can you keep up?",
                    timeSignature: TimeSignature.fourFour,
                    bars: 8,
                    tempo: 100,
                    blocks: [
                        Block.required([Note.whole]),
                        Block.required([Rest.whole]),
                        Block.required([Note.half]),
                        Block.required([Rest.half]),
                        Block.required([Note.quarter, Rest.quarter]),
                        Block.required([Rest.quarter, Note.quarter]),
                        Block.required([Note.quarter, Note.quarter])
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
                    description: "See those numbers at the beginning of every piece? They're called a &quot;time signature&quot;&mdash;and the top number sets how many beats are in each measure. So... if we change it to two...",
                    timeSignature: TimeSignature.twoFour,
                    notes: [
                        Note.half,
                        Note.half,
                        Note.quarter, Note.quarter,
                        Note.quarter, Note.quarter,
                        Note.half,
                        Note.half,
                        Note.half,
                        Rest.half
                    ]
                }),
                new ComposedLevel({
                    name: "Three On Top",
                    description: "Want three beats per measure? Set that top number to three! Make sure you're counting these numbers out loud&mdash;and don't say &quot;four&quot;!",
                    timeSignature: TimeSignature.threeFour,
                    notes: [
                        Note.quarter, Note.quarter, Note.quarter,
                        Note.quarter, Note.quarter, Note.quarter,
                        Note.quarter, Note.quarter, Note.quarter,
                        Note.quarter, Rest.quarter, Rest.quarter,
                        Note.quarter, Note.quarter, Note.quarter,
                        Note.quarter, Note.quarter, Note.quarter,
                        Note.quarter, Note.quarter, Note.quarter,
                        Note.quarter, Rest.quarter, Rest.quarter
                    ]
                }),
                new ComposedLevel({
                    name: "Five On Top",
                    description: "Are you wondering what the bottom number does yet? That's a secret for now. Set the top number to five!",
                    timeSignature: TimeSignature.fiveFour,
                    notes: [
                        Note.quarter, Note.quarter, Note.quarter, Note.quarter, Note.quarter,
                        Note.quarter, Note.quarter, Note.quarter, Note.half,
                        Note.quarter, Note.quarter, Note.quarter, Note.quarter, Note.quarter,
                        Note.quarter, Rest.quarter, Rest.quarter, Note.half
                    ]
                }),
                new ComposedLevel({
                    name: "Now This is Just Silly",
                    description: "...Sorry about this...",
                    timeSignature: new TimeSignature(1, Note.quarter),
                    notes: [
                        Note.quarter,
                        Note.quarter,
                        Note.quarter,
                        Note.quarter,
                        Note.quarter, 
                        Note.quarter,
                        Note.quarter,
                        Rest.quarter,
                        Note.quarter,
                        Note.quarter,
                        Note.quarter,
                        Note.quarter,
                        Note.quarter,
                        Note.quarter,
                        Note.quarter,
                        Rest.quarter
                    ]
                })
            ]
        });

        newSkill({
            id: "eighthNotes",
            name: "Eighth Notes",
            knownCounts: Count.allSimpleBasic,
            levels: [
                new ComposedLevel({
                    name: "Friendly Eighth Notes",
                    description: "Eighth notes look like a quarter note with a beam coming off it, and they're only <strong>half</strong> a beat long. That means two of them fit on every beat. If you have to clap halfway through a beat, say &quot;and&quot; (write &quot;+&quot;).",
                    timeSignature: TimeSignature.fourFour,
                    tempo: 60,
                    notes: [
                        Note.eighth, Note.eighth, Note.eighth, Note.eighth, Note.eighth, Note.eighth, Note.eighth, Note.eighth,
                        Note.quarter, Note.quarter, Note.quarter, Note.quarter, 
                        Note.eighth, Note.eighth, Note.eighth, Note.eighth, Note.eighth, Note.eighth, Note.eighth, Note.eighth,
                        Note.quarter, Note.quarter, Note.quarter, Note.quarter
                    ]
                }),
                new ComposedLevel({
                    name: "Eighth Rests",
                    description: "Eighth rests look like a fancy seven. They're half a beat long, so one beat can fit two eighth rests. Don't count &quot;and&quot; (+) out loud unless you're clapping on it!",
                    timeSignature: TimeSignature.fourFour,
                    tempo: 60,
                    notes: [
                        Rest.quarter, Rest.quarter, Rest.quarter, Rest.quarter,
                        Rest.eighth, Rest.eighth, Rest.eighth, Rest.eighth, Rest.eighth, Rest.eighth, Rest.eighth, Rest.eighth,
                        Rest.quarter, Rest.quarter, Rest.quarter, Rest.quarter,
                        Rest.eighth, Rest.eighth, Rest.eighth, Rest.eighth, Rest.eighth, Rest.eighth, Rest.eighth, Rest.eighth
                    ]
                }),
                new ComposedLevel({
                    name: "Lonely Eighth Notes",
                    description: "When they're all alone, eighth notes' beams fall down and become flags. They're still eighth notes. They're still half a beat long. You still shouldn't count &quot;and&quot; (+) out loud unless you're clapping on it.",
                    timeSignature: TimeSignature.fourFour,
                    tempo: 60,
                    notes: [
                        Note.quarter, Note.quarter, Note.quarter, Note.quarter,
                        Note.eighth, Rest.eighth, Note.eighth, Rest.eighth, Note.eighth, Rest.eighth, Note.eighth, Rest.eighth,
                        Note.quarter, Note.quarter, Note.quarter, Note.quarter,
                        Note.eighth, Note.eighth, Note.eighth, Note.eighth, Note.eighth, Note.eighth, Note.eighth, Note.eighth,
                        Note.quarter, Note.quarter, Note.quarter, Note.quarter,
                        Note.eighth, Rest.eighth, Note.eighth, Rest.eighth, Note.eighth, Rest.eighth, Note.eighth, Rest.eighth,
                        Note.quarter, Note.quarter, Note.quarter, Note.quarter,
                        Note.eighth, Note.eighth, Note.eighth, Note.eighth, Note.half
                    ]
                }),
                new ComposedLevel({
                    name: "Split One, Two",
                    description: "Let's mix eighths and quarters.",
                    timeSignature: TimeSignature.fourFour,
                    tempo: 60,
                    notes: [
                        Note.eighth, Note.eighth, Note.quarter, Note.quarter, Note.quarter,
                        Note.eighth, Note.eighth, Note.quarter, Note.quarter, Note.quarter,
                        Note.eighth, Note.eighth, Note.quarter, Note.quarter, Note.quarter,
                        Note.whole,
                        Note.quarter, Note.eighth, Note.eighth, Note.quarter, Note.quarter,
                        Note.quarter, Note.eighth, Note.eighth, Note.quarter, Note.quarter,
                        Note.quarter, Note.eighth, Note.eighth, Note.quarter, Note.quarter,
                        Note.whole
                    ]
                }),
                new ComposedLevel({
                    name: "Split Three, Four",
                    description: "Let's mix eighths and quarters.",
                    timeSignature: TimeSignature.fourFour,
                    tempo: 60,
                    notes: [
                        Note.quarter, Note.quarter, Note.eighth, Note.eighth, Note.quarter,
                        Note.quarter, Note.quarter, Note.eighth, Note.eighth, Note.quarter,
                        Note.quarter, Note.quarter, Note.eighth, Note.eighth, Note.quarter,
                        Note.whole,
                        Note.quarter, Note.quarter, Note.quarter, Note.eighth, Note.eighth,
                        Note.quarter, Note.quarter, Note.quarter, Note.eighth, Note.eighth,
                        Note.quarter, Note.quarter, Note.quarter, Note.eighth, Note.eighth,
                        Note.whole
                    ]
                }),
                new ComposedLevel({
                    name: "Four in a Row",
                    description: "Have you noticed eighth notes are exactly twice as fast as quarter notes? Keep switching between them!",
                    timeSignature: TimeSignature.fourFour,
                    tempo: 60,
                    notes: [
                        Note.eighth, Note.eighth, Note.eighth, Note.eighth, Note.quarter, Note.quarter,
                        Note.eighth, Note.eighth, Note.eighth, Note.eighth, Note.quarter, Note.quarter,
                        Note.eighth, Note.eighth, Note.eighth, Note.eighth, Note.quarter, Note.quarter,
                        Note.quarter, Rest.quarter, Note.quarter, Rest.quarter,
                        Note.quarter, Note.quarter, Note.eighth, Note.eighth, Note.eighth, Note.eighth,
                        Note.quarter, Note.quarter, Note.eighth, Note.eighth, Note.eighth, Note.eighth,
                        Note.quarter, Note.quarter, Note.eighth, Note.eighth, Note.eighth, Note.eighth,
                        Note.quarter, Rest.eighth, Rest.eighth, Rest.eighth, Rest.eighth, Rest.eighth, Rest.eighth
                    ]
                }),
                new ComposedLevel({
                    name: "Unexpected",
                    description: "It's harder than you'd think.",
                    timeSignature: TimeSignature.fourFour,
                    tempo: 60,
                    notes: [
                        Note.quarter, Note.eighth, Note.eighth, Note.eighth, Note.eighth, Note.quarter,
                        Note.quarter, Note.eighth, Note.eighth, Note.eighth, Note.eighth, Note.quarter,
                        Note.quarter, Note.eighth, Note.eighth, Note.eighth, Note.eighth, Note.quarter,
                        Note.quarter, Rest.quarter, Rest.half,
                        Note.eighth, Note.eighth, Note.quarter, Note.quarter, Note.eighth, Note.eighth,
                        Note.eighth, Note.eighth, Note.quarter, Note.quarter, Note.eighth, Note.eighth,
                        Note.eighth, Note.eighth, Note.quarter, Note.quarter, Note.eighth, Note.eighth,
                        Note.whole
                    ]
                }),
                new ComposedLevel({
                    name: "No Extra Ands",
                    description: "Be on the lookout for quarter notes!",
                    timeSignature: TimeSignature.fourFour,
                    tempo: 60,
                    notes: [
                        Note.quarter, Note.eighth, Note.eighth, Note.eighth, Note.eighth, Note.eighth, Note.eighth,
                        Note.quarter, Note.eighth, Note.eighth, Note.eighth, Note.eighth, Note.eighth, Note.eighth,
                        Note.eighth, Note.eighth, Note.quarter, Note.eighth, Note.eighth, Note.eighth, Note.eighth,
                        Note.eighth, Note.eighth, Note.quarter, Note.eighth, Note.eighth, Note.eighth, Note.eighth,
                        Note.eighth, Note.eighth, Note.eighth, Note.eighth, Note.quarter, Note.eighth, Note.eighth,
                        Note.eighth, Note.eighth, Note.eighth, Note.eighth, Note.quarter, Note.eighth, Note.eighth,
                        Note.eighth, Note.eighth, Note.eighth, Note.eighth, Note.eighth, Note.eighth, Note.quarter,
                        Note.eighth, Note.eighth, Note.eighth, Note.eighth, Note.eighth, Note.eighth, Note.quarter
                    ]
                }),
                new RandomLevel({
                    name: "More in the Mix",
                    description: "Are you ready for this?",
                    timeSignature: TimeSignature.fourFour,
                    tempo: 60,
                    bars: 8,
                    blocks: [
                        Block.required([Note.half]),
                        Block.required([Rest.half]),
                        Block.required([Note.quarter]),
                        Block.required([Rest.quarter]),
                        Block.required([Note.eighth, Note.eighth]),
                        Block.required([Note.eighth, Note.eighth]),
                        Block.required([Note.eighth, Note.eighth]),
                        Block.required([Note.eighth, Rest.eighth])
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
                    description: "A dot makes a note longer&mdash;it adds half its original length. For example, a whole note is 4 beats long, so a dotted whole note is 4 + 2 = <strong>6</strong> beats long.",
                    timeSignature: new TimeSignature(6, Note.quarter),
                    tempo: 100,
                    notes: [
                        Note.quarter, Note.quarter, Note.quarter, Note.quarter, Note.quarter, Note.quarter,
                        Note.whole.dotted,
                        Note.half, Note.half, Note.half,
                        Note.whole.dotted,
                        Note.quarter, Note.quarter, Note.quarter, Note.quarter, Note.quarter, Note.quarter,
                        Rest.whole.dotted,
                        Note.whole, Note.half,
                        Note.whole.dotted
                    ]
                }),
                new ComposedLevel({
                    name: "Dotted Half Notes",
                    description: "Remember, a dot makes a note 50% longer&mdash;so a dotted half note is 2 + 1 = <strong>3</strong> beats long.",
                    timeSignature: TimeSignature.fourFour,
                    tempo: 80,
                    notes: [
                        Note.quarter, Rest.quarter, Rest.quarter, Note.quarter,
                        Note.half.dotted, Note.quarter,
                        Note.quarter, Note.quarter, Note.quarter, Note.quarter,
                        Note.half.dotted, Note.quarter,
                        Note.quarter, Rest.quarter, Rest.quarter, Note.quarter,
                        Note.half, Rest.half,
                        Note.half.dotted, Note.quarter,
                        Note.whole
                    ]
                }),
                new ComposedLevel({
                    name: "Dotted Quarter Notes",
                    description: "Remember, a dot increases a note's length by half its original value&mdash;so a dotted quarter note is 1 + &frac12; = <strong>1&frac12;</strong> beats long.",
                    timeSignature: TimeSignature.fourFour,
                    tempo: 60,
                    notes: [
                        Note.quarter, Note.quarter, Note.quarter.dotted, Note.eighth,
                        Note.quarter, Note.quarter, Note.quarter.dotted, Note.eighth,
                        Note.quarter, Note.quarter, Note.quarter.dotted, Note.eighth,
                        Note.whole,
                        Note.quarter.dotted, Note.eighth, Note.quarter, Note.quarter,
                        Note.quarter.dotted, Note.eighth, Note.quarter, Note.quarter,
                        Note.quarter.dotted, Note.eighth, Note.quarter, Note.quarter,
                        Note.whole
                    ]
                }),
                new RandomLevel({
                    name: "Lots of Dots",
                    description: "Remember, a dot multiplies a note's length by 1.5. We've learned lots of different ways of thinking about that&mdash;pick your favorite! And good luck...",
                    timeSignature: new TimeSignature(6, Note.quarter),
                    tempo: 80,
                    bars: 8,
                    blocks: [
                        Block.required([Note.half.dotted, Note.quarter]),
                        Block.required([Note.quarter.dotted, Note.eighth, Note.half]),
                        Block.required([Note.whole.dotted]),
                        Block.required([Rest.half.dotted, Note.quarter]),
                        Block.required([Note.half, Rest.quarter.dotted, Note.eighth, Note.half]),
                        Block.required([Rest.whole.dotted]),
                        new Block([Note.quarter, Note.quarter]),
                        new Block([Note.half]),
                        new Block([Note.whole]),
                        new Block([Note.eighth, Note.eighth, Note.eighth, Note.eighth])
                    ]
                })
            ]
        });

        newSkill({
            id: "sixteenthNotes",
            name: "Sixteenth Notes",
            knownCounts: Count.allSimple,
            levels: [
                new ComposedLevel({
                    name: "Subdividing",
                    description: `Sixteenth notes look like eighth notes, but with a second beam or second flag. They're only <strong>one quarter</strong> of a beat long&mdash;half as long as eighth notes!
                    <ul>
                        <li>You'll need to know the count for <strong>one quarter</strong> of the way through the beat: <strong>e</strong>.</li>
                        <li>You already know the count for <strong>two quarters</strong> of the way through the beat, because two quarters equals one half: <strong>and</strong> (+)</li>
                        <li>You'll need to know the count for <strongthree quarters</strong> of the way through the beat: <strong>a</strong> (pronounced &quot;duh&quot;)</li>
                    </ul>`,
                    timeSignature: TimeSignature.fourFour,
                    tempo: 60,
                    notes: [
                        Note.whole,
                        Note.half, Note.half,
                        Note.quarter, Note.quarter, Note.quarter, Note.quarter,
                        Note.eighth, Note.eighth, Note.eighth, Note.eighth, Note.eighth, Note.eighth, Note.eighth, Note.eighth,
                        Note.sixteenth, Note.sixteenth, Note.sixteenth, Note.sixteenth, Note.sixteenth, Note.sixteenth, Note.sixteenth, Note.sixteenth, Note.sixteenth, Note.sixteenth, Note.sixteenth, Note.sixteenth, Note.sixteenth, Note.sixteenth, Note.sixteenth, Note.sixteenth,
                        Note.eighth, Note.eighth, Note.eighth, Note.eighth, Note.quarter, Note.quarter,
                        Note.half, Note.half,
                        Note.whole
                    ]
                }),
                new RandomLevel({
                    name: "1 e + a",
                    description: "Let's play with groups of four sixteenth notes.",
                    timeSignature: TimeSignature.fourFour,
                    tempo: 60,
                    bars: 8,
                    blocks: [
                        Block.required([Note.sixteenth, Note.sixteenth, Note.sixteenth, Note.sixteenth]),
                        new Block([Note.quarter]),
                        new Block([Note.half]),
                        new Block([Note.eighth, Note.eighth]),
                        new Block([Rest.quarter])
                    ]
                }),
                new ComposedLevel({
                    name: "Split the +",
                    description: "Remember two sixteenth notes fit into an eighth note.",
                    timeSignature: TimeSignature.fourFour,
                    tempo: 60,
                    notes: [
                        Note.quarter, Note.quarter, Note.eighth, Note.eighth, Note.eighth, Note.eighth,
                        Note.eighth, Note.sixteenth, Note.sixteenth, Note.eighth, Note.sixteenth, Note.sixteenth, Note.eighth, Note.sixteenth, Note.sixteenth, Note.eighth, Note.sixteenth, Note.sixteenth,
                        Note.quarter, Note.quarter, Note.eighth, Note.eighth, Note.eighth, Note.eighth,
                        Note.eighth, Note.sixteenth, Note.sixteenth, Note.eighth, Note.sixteenth, Note.sixteenth, Note.half
                    ]
                }),
                new RandomLevel({
                    name: "1 + a",
                    description: "Let's play with an eighth note followed by two sixteenth notes.",
                    timeSignature: TimeSignature.fourFour,
                    tempo: 60,
                    bars: 8,
                    blocks: [
                        Block.required([Note.eighth, Note.sixteenth, Note.sixteenth]),
                        new Block([Note.quarter]),
                        new Block([Note.half]),
                        new Block([Note.eighth, Note.eighth]),
                        new Block([Rest.quarter])
                    ]
                }),
                new ComposedLevel({
                    name: "Split the beat",
                    description: "Remember sixteenth notes are twice as fast as eighth notes.",
                    timeSignature: TimeSignature.fourFour,
                    tempo: 60,
                    notes: [
                        Note.quarter, Note.quarter, Note.eighth, Note.eighth, Note.eighth, Note.eighth,
                        Note.sixteenth, Note.sixteenth, Note.eighth, Note.sixteenth, Note.sixteenth, Note.eighth, Note.sixteenth, Note.sixteenth, Note.eighth, Note.sixteenth, Note.sixteenth, Note.eighth,
                        Note.quarter, Note.quarter, Note.eighth, Note.eighth, Note.eighth, Note.eighth,
                        Note.sixteenth, Note.sixteenth, Note.eighth, Note.sixteenth, Note.sixteenth, Note.eighth, Note.half
                    ]
                }),
                new RandomLevel({
                    name: "1 e +",
                    description: "Let's play with two sixteenth notes followed by an eighth note.",
                    timeSignature: TimeSignature.fourFour,
                    tempo: 60,
                    bars: 8,
                    blocks: [
                        Block.required([Note.sixteenth, Note.sixteenth, Note.eighth]),
                        new Block([Note.quarter]),
                        new Block([Note.half]),
                        new Block([Note.eighth, Note.eighth]),
                        new Block([Rest.quarter])
                    ]
                }),
                new RandomLevel({
                    name: "Juxtaposition",
                    description: "You've mastered &quot;1 e + a&quot? How about &quot;1 + a&quot;? And &quot;1 e +&quot? Remember, a sixteenth note has two beams&mdash;and eighth note has one.",
                    timeSignature: TimeSignature.fourFour,
                    tempo: 60,
                    bars: 8,
                    blocks: [
                        Block.required([Note.sixteenth, Note.sixteenth, Note.eighth]),
                        Block.required([Note.sixteenth, Note.sixteenth, Note.sixteenth, Note.sixteenth]),
                        Block.required([Note.eighth, Note.sixteenth, Note.sixteenth]),
                        new Block([Note.quarter]),
                        new Block([Note.half]),
                        new Block([Note.eighth, Note.eighth]),
                        new Block([Rest.quarter])
                    ]
                })
            ]
        });

        newSkill({
            id: "threeFour",
            name: "Three Four",
            knownCounts: Count.allSimpleBasic,
            levels: [
                new ComposedLevel({
                    name: "Slowly at First",
                    description: "Three beats per measure; slowly at first.",
                    timeSignature: TimeSignature.threeFour,
                    tempo: 60,
                    notes: [
                        Note.eighth, Note.eighth, Note.quarter, Note.quarter,
                        Note.quarter.dotted, Note.eighth, Note.quarter,
                        Note.eighth, Note.eighth, Note.quarter, Note.quarter,
                        Note.half.dotted,
                        Note.eighth, Note.eighth, Note.quarter, Note.quarter,
                        Note.quarter.dotted, Note.eighth, Note.quarter,
                        Note.eighth, Note.eighth, Note.eighth, Note.eighth, Note.eighth, Note.eighth,
                        Note.half.dotted
                    ]
                }),
                new ComposedLevel({
                    name: "A Little Faster Now",
                    description: "Three beats per measure; a little faster now.",
                    timeSignature: TimeSignature.threeFour,
                    tempo: 80,
                    notes: [
                        Note.quarter, Note.eighth, Note.eighth, Note.quarter,
                        Note.quarter, Note.quarter.dotted, Note.eighth,
                        Note.quarter, Note.eighth, Note.eighth, Note.quarter,
                        Note.half.dotted,
                        Note.quarter, Note.eighth, Note.eighth, Note.quarter,
                        Note.quarter, Note.quarter.dotted, Note.eighth,
                        Note.eighth, Note.eighth, Note.eighth, Note.eighth, Note.eighth, Note.eighth,
                        Note.half.dotted
                    ]
                }),
                new ComposedLevel({
                    name: "Almost a Waltz",
                    description: "Three beats per measure; quite fast!",
                    timeSignature: TimeSignature.threeFour,
                    tempo: 100,
                    notes: [
                        Note.quarter, Note.eighth, Note.eighth, Note.eighth, Note.eighth,
                        Note.quarter.dotted, Note.eighth, Note.quarter,
                        Note.half, Note.eighth, Note.eighth,
                        Note.quarter, Rest.quarter, Rest.quarter,
                        Note.quarter, Note.eighth, Note.eighth, Note.eighth, Note.eighth,
                        Note.quarter, Note.quarter.dotted, Note.eighth,
                        Note.quarter, Rest.quarter, Rest.eighth, Note.eighth,
                        Note.half.dotted
                    ]
                })
            ]
        });

        newSkill({
            id: "bottomNumber",
            name: "The Bottom Number",
            knownCounts: Count.allSimpleBasic,
            levels: [
                new ComposedLevel({
                    name: "Twice the Length: Easy",
                    description: "The bottom number of the time signature isn't a number at all: it represents a <strong>note</strong>. Specifically, the bottom of the time signature tells us <strong>what note gets one beat</strong>. The 4 down there is a <strong>4</strong> for <strong>quarter</strong> note&mdash;and it's the only reason that quarter notes have been one beat long so far. What if we change it to an <strong>8</strong>? <strong>Eighth notes</strong> are now <strong>one beat long</strong>. (And that means <strong>quarter notes</strong> must be <strong>two</strong>!)",
                    timeSignature: new TimeSignature(4, Note.eighth),
                    tempo: 80,
                    notes: [
                        Note.eighth, Note.eighth, Note.eighth, Note.eighth,
                        Note.quarter, Note.quarter,
                        Note.eighth, Note.eighth, Note.eighth, Note.eighth,
                        Note.half,
                        Note.eighth, Note.eighth, Note.eighth, Note.eighth,
                        Note.eighth, Note.eighth, Note.quarter,
                        Note.quarter, Note.quarter,
                        Note.half
                    ]
                }),
                new ComposedLevel({
                    name: "Twice the Length: Hard",
                    description: "Used to it yet?",
                    timeSignature: new TimeSignature(4, Note.eighth),
                    tempo: 80,
                    notes: [
                        Note.eighth, Note.eighth, Note.quarter,
                        Rest.eighth, Note.eighth, Note.quarter,
                        Note.eighth, Note.eighth, Note.eighth, Note.eighth,
                        Note.half,
                        Note.eighth, Note.eighth, Note.quarter,
                        Rest.eighth, Note.eighth, Note.quarter,
                        Note.quarter.dotted, Note.eighth,
                        Note.half
                    ]
                }),
                new ComposedLevel({
                    name: "Half the Length: Easy",
                    description: "What if we put a 2 down there? <strong>2</strong> for <strong>half</strong> note; <strong>half notes</strong> are now <strong>one beat long</strong>. (And that means <strong>whole notes</strong> are now <strong>two</strong>!)",
                    timeSignature: new TimeSignature(4, Note.half),
                    tempo: 80,
                    notes: [
                        Note.half, Note.half, Note.whole,
                        Rest.half, Note.half, Note.whole,
                        Note.half, Note.half, Note.half, Note.half,
                        Note.whole, Rest.whole,
                        Note.half, Note.half, Note.whole,
                        Rest.half, Note.half, Note.whole,
                        Note.whole.dotted, Note.half,
                        Note.whole, Rest.whole
                    ]
                }),
                new ComposedLevel({
                    name: "Half the Length: Hard",
                    description: "If half notes are one beat long, what about quarter notes? Two quarter notes still have to fit in one half note, so quarter notes must only be <strong>half a beat</strong>!",
                    timeSignature: new TimeSignature(4, Note.half),
                    tempo: 60,
                    notes: [
                        Note.half, Note.half, Note.whole,
                        Note.quarter, Note.quarter, Note.quarter, Note.quarter, Note.whole,
                        Note.half, Note.half, Note.whole,
                        Note.half.dotted, Note.quarter, Note.whole,
                        Note.half, Note.half, Note.whole,
                        Note.quarter, Note.quarter, Note.quarter, Note.quarter, Note.quarter, Note.quarter, Note.quarter, Note.quarter,
                        Note.half, Note.half, Note.whole,
                        Rest.whole.dotted, Note.half
                    ]
                }),
                new ComposedLevel({
                    name: "Let's Get Nuts",
                    description: "Can we put a 1 on the bottom? Sure, we can! Why would we ever want <strong>whole notes</strong> to be <strong>one beat</strong> long? I... really don't know... But now they are...",
                    timeSignature: new TimeSignature(4, Note.whole),
                    tempo: 80,
                    notes: [
                        Note.whole, Note.whole, Note.whole, Note.whole,
                        Note.half, Note.half, Note.half, Note.half, Note.whole, Rest.whole,
                        Note.whole, Note.whole, Note.whole, Rest.whole,
                        Note.whole.dotted, Note.half, Note.whole, Rest.whole
                    ]
                })
            ]
        });
    }
}