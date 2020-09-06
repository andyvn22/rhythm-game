/// <reference path="music.ts" />

/**
 * Records the progress made on a particular skill.
 */
class SkillState {
    readonly id: string;
    currentLevel: number;

    constructor(id: string, currentLevel = 0) {
        this.id = id;
        this.currentLevel = currentLevel;
    }
}

/**
 * Tracks all state of a player's progress through the game.
 */
class Profile {
    name: string;
    private skills: Array<SkillState>;

    constructor(name = "", skills: Array<SkillState> = []) {
        this.name = name;
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

    static all: Array<Profile>;
    static currentIndex: number;
    static get current() { return Profile.all[Profile.currentIndex]; }

    static loadAllFromStorage() {
        const profileCodes = localStorage.getItem("rhythmGame-allProfiles")?.split("\n").slice(0,-1) ?? [];
        Profile.all = profileCodes.map(x => Profile.decode(x));
        Profile.currentIndex = parseInt(localStorage.getItem("rhythmGame-currentProfileIndex") ?? "0");

        if (Profile.all.length === 0) { Profile.all.push(new Profile()); }
        if (Profile.currentIndex >= Profile.all.length) { Profile.currentIndex = 0; }
    }

    static saveAllToStorage() {
        let result = "";
        for (let profile of Profile.all) {
            result += profile.encode() + "\n";
        }
        localStorage.setItem("rhythmGame-allProfiles", result);
        localStorage.setItem("rhythmGame-currentProfileIndex", Profile.currentIndex.toString());
    }
}

/**
 * A level in the game; consists primarily of a piece of music.
 */
class Level {
    readonly name: string;
    readonly piece: Piece;
    readonly tempo: number;

    constructor(name: string, piece: Piece, tempo = 80) {
        this.name = name;
        this.piece = piece;
        this.tempo = tempo;
    }
}

/**
 * An ordered list of levels.
 */
class Skill {
    readonly name: string;
    readonly levels: Array<Level>;

    constructor(name: string, levels: Array<Level>) {
        this.name = name;
        this.levels = levels;
    }

    static forID(id: string): Skill {
        switch (id) {
            case "sixEightTest": return new Skill("6/8 Test", [
                new Level("6/8 Test Level", new Piece(TimeSignature.sixEight, [
                    Note.quarter,
                    Note.eighth,
                    Note.eighth,
                    Note.sixteenth,
                    Note.sixteenth,
                    Note.eighth,
                    Note.eighth,
                    Note.quarter,
                    Note.quarter.dotted
                ]))
            ]);

            case "fiveFourTest": return new Skill("5/4 Test", [
                new Level("5/4 Test Level", new Piece(TimeSignature.fiveFour, [
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
                ])
            )]);

            case "randomEasy": return new Skill("Random Easy", [
                new Level("First Some Long Notes", Piece.random(TimeSignature.threeFour, 8, [
                    new Block([Note.whole]),
                    new Block([Note.half]),
                    new Block([Note.quarter]),
                    new Block([Note.half.dotted])
                ])),
                new Level("Eighth Note Pairs", Piece.random(TimeSignature.threeFour, 8, [
                    new Block([Note.whole]),
                    new Block([Note.half]),
                    new Block([Note.quarter]),
                    new Block([Note.half.dotted]),
                    new Block([Note.eighth, Note.eighth])
                ])),
                new Level("Aah, Syncopation!", Piece.random(TimeSignature.threeFour, 8, [
                    new Block([Note.whole]),
                    new Block([Note.half]),
                    new Block([Note.quarter]),
                    new Block([Note.half.dotted]),
                    new Block([Note.eighth, Note.eighth]),
                    new Block([Note.quarter.dotted, Note.eighth]),
                    new Block([Note.eighth, Note.quarter, Note.eighth])
                ]))
            ]);

            case "randomHard": return new Skill("Random Hard", [
                new Level("Random Hard Level", Piece.random(TimeSignature.fiveFour, 8, [
                    new Block([Note.whole]),
                    new Block([Note.half]),
                    new Block([Note.quarter]),
                    new Block([Note.half.dotted]),
                    new Block([Note.eighth, Note.eighth]),
                    new Block([Note.quarter.dotted, Note.eighth]),
                    new Block([Note.eighth, Note.sixteenth, Note.sixteenth]),
                    new Block([Note.sixteenth, Note.sixteenth, Note.eighth]),
                    new Block([Note.sixteenth, Note.sixteenth, Note.sixteenth, Note.sixteenth])
                ]))
            ]);

            default: assertionFailure("unknown level!");
        }
    }
}