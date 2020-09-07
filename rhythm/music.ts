function assert(condition: boolean, message = "Assertion failed") {
	if (!condition) {
		if (typeof Error !== "undefined") {
			throw new Error(message);
		} else {
			throw message;
		}
	}
}

function assertionFailure(message = "Assertion failed: unreachable code"): never {
	throw message;
}

/** Converts from vw (hundredths of viewport width) to pixels */
function vw(vw: number) {
	return Math.round(vw * document.documentElement.clientWidth / 100);
}

/** Converts from em to pixels, relative to the font size of the element `relativeTo`, or `document.body` if no element is given. */
function em(em: number, relativeTo = document.body) {
	return parseFloat(getComputedStyle(relativeTo).fontSize) * em;
}

/**
 * A sound effect that can be audibly played, such as a click, part of a countoff, or a backing loop.
 * 
 * I don't have the slightest idea why, but you need to delete all instances of "export" in howler/index.d.ts for this to compile... :(
 */
class Sound {
	private value: Howl;
	private static howls = Object.create(null);

	private constructor(name: string, loop = false, rate = 1) {
		if (Sound.howls[name] === undefined) {
			Sound.howls[name] = new Howl({
				src: [`media/sounds/${name}.mp3`],
				loop: loop,
				preload: true,
				rate: rate
			});
		}
		this.value = Sound.howls[name];
	}

	play() {
		this.value.play();
	}

	stop() {
		this.value.stop();
	}

	static get metronome() { return new Sound("metronome"); }

	static number(number: number) {
		assert(number < 11);
		assert(number === Math.floor(number));
		return new Sound(number.toString());
	}

	static get readyFirstSyllable() { return new Sound("rea-"); }
	static get readySecondSyllable() { return new Sound("-dy"); }
	static get go() { return new Sound("go"); }

	static get fanfare() { return new Sound("fanfare"); }

	/**
	 * Creates and returns a backing loop appropriate for the given time signature and tempo.
	 * 
	 * This is not a pure function; save your backing loop instance if you need to stop it later.
	 */
	static backingLoop(timeSignature: TimeSignature, tempo: Tempo, index?: number): Sound | undefined {
		function indexTo(upperBound: number) {
			if (index !== undefined) {
				return index % upperBound;
			} else {
				return Level.current?.stablePseudorandomIntegerTo(upperBound) ?? Math.floor(Math.random() * upperBound);
			}
		}

		const rate = tempo/80;
		if (timeSignature.isCompound) {
			switch(timeSignature.top) {
				case 2: case 4:
					return new Sound(`loops/compoundQuadruple/${indexTo(0)}`, true, rate);
				case 3:
					return new Sound(`loops/compoundTriple/${indexTo(0)}`, true, rate);
			}
		} else {
			switch(timeSignature.top) {
				case 2: case 4:
					return new Sound(`loops/simpleQuadruple/${indexTo(3)}`, true, rate);
				case 3: return new Sound(`loops/simpleTriple/${indexTo(2)}`, true, rate);
				case 5: return new Sound(`loops/simpleQuintuple/${indexTo(2)}`, true, rate);
			}
		}
		return new Sound(`loops/0`, true, rate);
	}
}

type Tempo = 60 | 80 | 100;

/**
 * An event (like a note or beat), whose timing is specified in absolute beats from the start of a piece
 */
class MusicEvent {
	/** The absolute time (in beats) of the event, since the start of a piece */
	timing: number;

	/** Whether or not the event should be performed; if false, all performance attempts will be graded as incorrect. */
	shouldPerform: boolean;

	/** Whether or not this event's performance attempts should be graded */
	graded: boolean;

	/** A sorted list of offsets of attempts to match this event's timing */
	private performanceAttempts: Array<number>;
	
	constructor(timing: number, shouldPerform = true, graded = false, performanceAttempts = []) {
		this.timing = timing;
		this.shouldPerform = shouldPerform;
		this.graded = graded;
		this.performanceAttempts = performanceAttempts;
	}

	/** Returns the first performance attempt, or `undefined` if there are no attempts */
	get earliestPerformanceAttempt() {
		if (this.performanceAttempts.length == 0) { return undefined; }
		return Math.min.apply(Math, this.performanceAttempts);
	}

	/** The offset of the best attempt to match this event's timing, or `undefined` if none exists */
	get bestPerformanceAttempt() {
		if (this.performanceAttempts.length == 0) { return undefined; }
		return this.performanceAttempts[0];
	}

	/** Any extra (beyond the first, best) attempts to match this event's timing, as an array of offsets */
	get extraPerformanceAttempts() {
		if (this.performanceAttempts.length == 0) { return []; }
		else return this.performanceAttempts.slice(1);
	}

	/** Add an offset as an attempt to match this event's timing */
	addPerformanceAttempt(offset: number) {
		const bestTimingSort = function(a: number, b: number) {
			if (Math.abs(a) < Math.abs(b)) { return -1; }
			else if (Math.abs(a) > Math.abs(b)) { return 1; }
			else { return 0; }
		}

		this.performanceAttempts.push(offset);
		this.performanceAttempts.sort(bestTimingSort);
	}

	/** Remove (and return) the earliest performance attempt from the list, or return `undefined` if there are no attempts */
	removeEarliestPerformanceAttempt() {
		if (this.performanceAttempts.length == 0) { return undefined; }

		let indexOfEarliestAttempt = 0;
		for (let i = 0; i < this.performanceAttempts.length; i++) {
			if (this.performanceAttempts[i] < this.performanceAttempts[indexOfEarliestAttempt]) {
				indexOfEarliestAttempt = i;
			}
		}

		const result = this.performanceAttempts[indexOfEarliestAttempt];
		this.performanceAttempts.splice(indexOfEarliestAttempt, 1);
		return result;
	}

	removeAllPerformanceAttempts() {
		this.performanceAttempts = [];
	}

	accuracy(tempo: Tempo) {
		assert(tempo > 0);
		function easeInOutSine(x: number): number { return -(Math.cos(Math.PI * x) - 1) / 2; }

		if (this.shouldPerform) {
			if (this.bestPerformanceAttempt === undefined) { return 0; }
			return easeInOutSine(Math.max(1 - (Math.abs(this.bestPerformanceAttempt * Player.beatLength(tempo)) / MusicEvent.timingThreshold), 0));
		} else {
			if (this.bestPerformanceAttempt === undefined) { return 1; }
			else return 0;
		}
	}

	/** Returns the offsets to all whole-numbered beats that occur before `length` is over */
	offsetsToBeatsForLength(length: number) {
		assert(length > 0);
		
		let result = [];
		for (let i = Math.ceil(this.timing); i < this.timing + length; i++) {
			result.push(i - this.timing);
		}
		return result;
	}

	static readonly timingThreshold = 150; //ms
}

/**
 * An ordered collection of `MusicEvent`s
 */
class EventList {
	private value: Array<MusicEvent>

	/** Creates a new list of the specified events. The given events must be in chronological order. */
	constructor(events: Array<MusicEvent>) {
		this.value = events;
	}

	index(index: number) {
		assert(index >= 0);
		assert(index < this.value.length);

		return this.value[index];
	}

	get last() {
		assert(this.value.length > 0);

		return this.value[this.value.length - 1];
	}

	/** Returns the index of the last `MusicEvent` that occurs before `time` */
	lastIndexBefore(time: number) {
		assert(this.value.length > 0);

		let result = -1;

		while(result < this.value.length - 1) {
			result++;
			if (this.value[result].timing > time) {
				return result - 1;
			}
		}

		return result;
	}

	/** Grades the given `attemptTime`, calling `addPerformanceAttempt()` on the appropriate `MusicEvent`. Returns all modified indices (which may be more than one due to adjusting earlier guesses). */
	gradePerformanceAttempt(attemptTime: number) {
		assert(this.value.length > 0);

		let closestIndex = -1;
		let offset = Infinity;
		while(closestIndex < this.value.length - 1) {
			closestIndex++;
			if (Math.abs(attemptTime - this.value[closestIndex].timing) > Math.abs(offset)) {
				closestIndex--;
				break;
			} else {
				offset = attemptTime - this.value[closestIndex].timing;
			}
		}

		let result: Array<number> = [closestIndex];

		if (closestIndex > 0) {
			const previousNoteIsMissingAttempt = this.value[closestIndex - 1].bestPerformanceAttempt === undefined && this.value[closestIndex - 1].shouldPerform;
			const thisNoteHasEarlyAttempt = this.value[closestIndex].earliestPerformanceAttempt ?? Infinity < 0;
			if (previousNoteIsMissingAttempt && thisNoteHasEarlyAttempt) {
				this.value[closestIndex - 1].addPerformanceAttempt(this.value[closestIndex].removeEarliestPerformanceAttempt()!);
				result.push(closestIndex - 1);
			}
		}
		this.value[closestIndex].addPerformanceAttempt(offset);
		
		return result;
	}

	removeGrading() {
		for (let i = 0; i < this.value.length; i++) {
			this.value[i].removeAllPerformanceAttempts();
			this.value[i].graded = false;
		}
	}

	enableGradingThrough(time: number) {
		for (let event of this.value) {
			if (event.timing > time) { return; }
			event.graded = true;
		}
	}

	gradingInfo(tempo: Tempo) {
		assert(tempo > 0);

		const successes = this.value.filter(x => x.accuracy(tempo) > 0);
		const extraAttempts = this.value.reduce((a,b) => a + b.extraPerformanceAttempts.length, 0);
		const accuracy = successes.length / (this.value.length + extraAttempts);
		const timingAverage = this.value.reduce((a,b) => a + b.accuracy(tempo), 0) / this.value.length;
		
		return {accuracy: accuracy, timing: timingAverage};
	}
}

type NoteTypeName = 1 | 2 | 4 | 8 | 16;
type NoteTypeBeams = 0 | 1 | 2;

/**
 * A type of note (quarter, eighth, etc.)
 */
class NoteType {
	readonly rawValue: NoteTypeName;

	constructor(rawValue: NoteTypeName) {
		this.rawValue = rawValue;
	}

	get description(): string {
		switch (this.rawValue) {
			case 1: return "whole note";
			case 2: return "half note";
			case 4: return "quarter note";
			case 8: return "eighth note";
			case 16: return "sixteenth note";
		}
	}

	get beams(): NoteTypeBeams {
		switch (this.rawValue) {
			case 1: return 0;
			case 2: return 0;
			case 4: return 0;
			case 8: return 1;
			case 16: return 2;
		}
	}

	get absoluteLength() {
		return 1/this.rawValue;
	}

	get unbeamedCharacter(): string {
		switch (this.rawValue) {
			case 1: return "w";
			case 2: return "h";
			case 4: return "q";
			case 8: return "e";
			case 16: return "s";
		}
	}

	static beamedCharacter(beamsIn: NoteTypeBeams, beamsOut: NoteTypeBeams): string {
		switch (beamsIn) {
			case 0: switch (beamsOut) {
				case 1: return "r";
				case 2: return "d";
				default: assertionFailure(); //beamsIn: 0, beamsOut:0 does not produce a beamed character at all
			}
			case 1: switch (beamsOut) {
				case 0: return "y";
				case 1: return "t";
				case 2: return "d";
			}
			case 2: switch (beamsOut) {
				case 0: return "g";
				case 1: return "g";
				case 2: return "f";
			}
		}
	}

	get restCharacter(): string {
		switch (this.rawValue) {
			case 1: return "W";
			case 2: return "H";
			case 4: return "Q";
			case 8: return "E";
			case 16: return "S";
		}
	}
}

/**
 * A single note within a larger piece; consists primarily of a type (quarter, eighth, etc.) and a number of dots (0, 1, or 2). Subclassed by `Rest`.
 */
class Note {
	readonly type: NoteType;
	readonly dots: 0 | 1 | 2;

	customPrefix: string;
	customSuffix: string;

	//** A sound this note makes; empty string for silence */
	sound?: Sound;

	constructor(type: NoteType, dots: 0 | 1 | 2 = 0, customPrefix = "", customSuffix = "", sound = Sound.metronome) {
		assert(dots >= 0 && dots <= 2);
		
		this.type = type;
		this.dots = dots;
		this.customPrefix = customPrefix;
		this.customSuffix = customSuffix;
		this.sound = sound;
	}

	/** Returns the class of the current instance */
	get Self() {
		return this.constructor as typeof Note;
	}

	copy() {
		return new this.Self(this.type, this.dots, this.customPrefix, this.customSuffix, this.sound);
	}

	static get whole() { return new this(new NoteType(1)); }
	static get half() { return new this(new NoteType(2)); }
	static get quarter() { return new this(new NoteType(4)); }
	static get eighth() { return new this(new NoteType(8)); }
	static get sixteenth() { return new this(new NoteType(16)); }

	get dotsDescription() {
		switch (this.dots) {
			case 0: return "";
			case 1: return "dotted ";
			case 2: return "doubly-dotted ";
		}
	}

	get description() {
		return this.dotsDescription + this.type.description;
	}

	toString() {
		return this.description;
	}

	notation(beamsIn: 0 | 1 | 2 = 0, beamsOut: 0 | 1 | 2 = 0) {
		const result = (beamsIn == 0 && beamsOut == 0) ? this.type.unbeamedCharacter : NoteType.beamedCharacter(beamsIn, beamsOut);
		return this.customPrefix + result + Note.dots(this.dots) + this.customSuffix;
	}

	get absoluteLength(): number {
		switch (this.dots) {
			case 0: return this.type.absoluteLength;
			case 1: return this.type.absoluteLength * 1.5;
			case 2: return this.type.absoluteLength * 1.75;
		}
	}

	relativeLength(other: Note) {
		return this.absoluteLength / other.absoluteLength;
	}

	get undotted() {
		return new this.Self(this.type, 0, this.customPrefix, this.customSuffix, this.sound);
	}

	get dotted() {
		assert(this.dots < 2);
		return new this.Self(this.type, this.dots + 1 as (1 | 2), this.customPrefix, this.customSuffix, this.sound);
	}

	get doubled() {
		const resultType = this.type.rawValue / 2;
		assert(resultType >= 1);
		return new this.Self(new NoteType(resultType as NoteTypeName), this.dots, this.customPrefix, this.customSuffix, this.sound);
	}

	get halved() {
		const resultType = this.type.rawValue * 2;
		assert(resultType <= 16);
		return new this.Self(new NoteType(resultType as NoteTypeName), this.dots, this.customPrefix, this.customSuffix, this.sound);
	}

	get normalized() {
		return new this.Self(this.type, this.dots);
	}

	static readonly dotCharacter = ".";

	static dots(count: number) {
		assert(count >= 0);
		let result = "";
		for (let i = 0; i < count; i++) {
			result += Note.dotCharacter;
		}
		return result;
	}
};

/**
 * A subclass of `Note` that should not be performed and makes no sound.
 */
class Rest extends Note {
	constructor(type: NoteType, dots: 0 | 1 | 2 = 0, customPrefix = "", customSuffix = "", sound?: Sound) {
		super(type, dots, customPrefix, customSuffix, sound);
		if (sound === undefined) { this.sound = undefined; }
	}

	notation(beamsIn: 0 | 1 | 2 = 0, beamsOut: 0 | 1 | 2 = 0) {
		beamsIn; beamsOut;
		const result = this.type.restCharacter;
		return this.customPrefix + result + Note.dots(this.dots) + this.customSuffix;
	}
}

type CountNameBeat = "beat"

const AllCountNamesSimpleBasic = ["beat", "+"] as const;
type CountNameSimpleBasic = typeof AllCountNamesSimpleBasic[number];
const AllCountNamesSimple = ["beat", "e", "+", "a"] as const;
type CountNameSimple = typeof AllCountNamesSimple[number];

const AllCountNamesCompoundBasic = ["beat", "ta", "ma"] as const;
type CountNameCompoundBasic = typeof AllCountNamesCompoundBasic[number];
const AllCountNamesCompound = ["beat", "di", "ta", "ti", "ma", "mi"] as const;
type CountNameCompound = typeof AllCountNamesCompound[number];

const AllCountNames = ["beat", "e", "+", "a", "di", "ta", "ti", "ma", "mi"] as const;
type CountName = typeof AllCountNames[number];

/**
 * A count (specific location in time through a beat). "+" and "ti" are not equal.
 */
class Count {
	readonly rawValue: CountName
	
	private constructor(rawValue: CountName) {
		this.rawValue = rawValue;
	}

	toString() { return this.rawValue; }

	get timing(): number {
		switch (this.rawValue) {
			case "beat": return 0;
			case "e": return 1/4;
			case "+": return 1/2;
			case "a": return 3/4;
			case "di": return 1/6;
			case "ta": return 1/3;
			case "ti": return 3/6; //distinct from + despite equal timing
			case "ma": return 2/3;
			case "mi": return 5/6;
		}
	}

	get timingString(): string {
		switch (this.rawValue) {
			case "beat": return "right at the start of";
			case "e": return "1/4 of the way through";
			case "+": return "halfway through";
			case "a": return "3/4 of the way through";
			case "di": return "1/6 of the way through";
			case "ta": return "1/3 of the way through";
			case "ti": return "3/6 of the way through"; //distinct from + despite equal timing
			case "ma": return "2/3 of the way through";
			case "mi": return "5/6 of the way through";
		}
	}

	isEqual(other: Count) {
		return this.rawValue === other.rawValue;
	}

	static get beat() { return new Count("beat"); }
	static get e() { return new Count("e"); }
	static get and() { return new Count("+"); }
	static get a() { return new Count("e"); }
	static get di() { return new Count("di"); }
	static get ta() { return new Count("ta"); }
	static get ti() { return new Count("ti"); }
	static get ma() { return new Count("ma"); }
	static get mi() { return new Count("mi"); }

	static get allSimpleBasic() { return AllCountNamesSimpleBasic.map(x => new Count(x)); }
	static get allSimple() { return AllCountNamesSimple.map(x => new Count(x)); }
	static get allCompoundBasic() { return AllCountNamesCompoundBasic.map(x => new Count(x)); }
	static get allCompound() { return AllCountNamesCompound.map(x => new Count(x)); }
	static get all() { return AllCountNames.map(x => new Count(x)); }
	
	static get allExceptCompoundAdvanced() { return this.allSimple.concat(this.allCompoundBasic); }
}

type TimingPrecision = "on" | "a little before" | "a little after";

enum Verbosity {
	short, medium, long
}

/**
 * A description of a given musical timing
 */
class TimingDescription {
	readonly count: Count;
	/** The beat this timing occurs on, 0-indexed from the start of the measure */
	readonly beat: number;
	readonly precision: TimingPrecision;

	constructor(count: Count, beat: number, precision: TimingPrecision) {
		this.count = count;
		this.beat = beat;
		this.precision = precision;
	}

	/** Creates a timing description of the given absolute `timing` in the given `timeSignature` */
	static of(timing: number, timeSignature: TimeSignature, tempo: Tempo) {
		assert(tempo > 0);

		let beat = Math.floor(timing);
		let fractionalTiming = timing - beat;

		let closestCount = Count.beat;
		for (let count of TimingDescription.knownCounts) {
			if (Math.abs(count.timing - fractionalTiming) < Math.abs(closestCount.timing - fractionalTiming)) {
				closestCount = count;
			}
		}
		if (Math.abs(1 - fractionalTiming) < Math.abs(closestCount.timing - fractionalTiming)) {
			closestCount = Count.beat;
			beat++;
			fractionalTiming = 1 - fractionalTiming;
		}

		if (closestCount.isEqual(Count.and) && timeSignature.isCompound) {
			closestCount = Count.ti;
		} else if (closestCount.isEqual(Count.ti) && !timeSignature.isCompound) {
			closestCount = Count.and;
		}

		let offset = (closestCount.timing - fractionalTiming) * Player.beatLength(tempo);
		let precision: TimingPrecision = "on";
		if (offset > MusicEvent.timingThreshold / 2) {
			precision = "a little after";
		} else if (offset < -MusicEvent.timingThreshold / 2) {
			precision = "a little before";
		}

		const negativeModulo = function(lhs: number, rhs: number) {
			return ((lhs % rhs) + rhs) % rhs;
		}

		return new TimingDescription(closestCount, negativeModulo(beat, timeSignature.top), precision);
	}

	get shortBeatDescription() {
		return this.beat + 1;
	}

	get longBeatDescription() {
		return "beat " + this.shortBeatDescription;
	}

	description(verbosity: Verbosity): string {
		if (this.count.isEqual(Count.beat)) {
			switch (verbosity) {
				case Verbosity.short: return `<strong>${this.shortBeatDescription}</strong>`;
				default: return `${this.precision} <strong>${this.longBeatDescription}</strong>`;
			}
		} else {
			switch (verbosity) {
				case Verbosity.short: return `<strong>${this.count.toString()}</strong>`;
				case Verbosity.medium: return `${this.precision} <strong>${this.count.toString()}</strong> <em>(${this.count.timingString} ${this.longBeatDescription})</em>`;
				case Verbosity.long: return `${this.precision} the <strong>${this.count.toString()}</strong> of ${this.shortBeatDescription} <em>(${this.count.timingString} ${this.longBeatDescription})</em>`;
			}
		}
	}

	static knownCounts = Count.all;
}

type TimeSignatureTop = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 12;

/**
 * An Orff time signature, consisting of a number of beats per measure (top) and a type of note that receives 1 beat (bottom).
 */
class TimeSignature {
	readonly top: TimeSignatureTop;
	readonly bottom: Note;

	constructor(top: TimeSignatureTop, bottom: Note) {
		assert(Math.floor(top) === top);
		assert(top > 0);
		assert(top <= 10);
		assert(bottom.dots <= 1);
		
		this.top = top;
		this.bottom = bottom;
	}

	static get twoFour() { return new TimeSignature(2, Note.quarter); }
	static get threeFour() { return new TimeSignature(3, Note.quarter); }
	static get fourFour() { return new TimeSignature(4, Note.quarter); }
	static get fiveFour() { return new TimeSignature(5, Note.quarter); }

	static get commonTime() { return TimeSignature.fourFour; }
	static get cutTime() { return new TimeSignature(4, Note.quarter); }

	static get sixEight() { return new TimeSignature(2, Note.quarter.dotted); }
	static get nineEight() { return new TimeSignature(3, Note.quarter.dotted); }
	static get twelveEight() { return new TimeSignature(4, Note.quarter.dotted); }

	get isCompound() {
		return this.bottom.dots == 1;
	}

	get countoff() {
		let result = [];
		for (var i = 0; i < (this.top <= 2 ? this.top : this.top - 2); i++) {
			let count = this.bottom.normalized;
			count.sound = Sound.number(i+1);
			result.push(count);
		}
		
		let rea, dy;
		if (this.isCompound) {
			rea = this.bottom.undotted;
			dy = this.bottom.undotted.halved;
		} else {
			rea = this.bottom.halved;
			dy = this.bottom.halved;
		}
		let go = this.bottom;
		
		rea.sound = Sound.readyFirstSyllable;
		dy.sound = Sound.readySecondSyllable;
		go.sound = Sound.go;
		result.push(rea);
		result.push(dy);
		result.push(go);
		
		return new Piece(this, result);
	}

	milliseconds(notes: Array<Note>, tempo: Tempo) {
		assert(tempo > 0);

		return notes.reduce((a,b) => a + b.relativeLength(this.bottom) * Player.beatLength(tempo), 0);
	}

	toString() {
		return this.top + " over " + this.bottom.toString();
	}

	get notation() {
		const numerator = this.bottom.dots === 0 ? this.top : this.top * 3;
		assert(numerator <= 12);
		const denominator = this.bottom.dots === 0 ? this.bottom.type.rawValue : this.bottom.type.rawValue * 2;
		assert(denominator <= 16);
		return TimeSignature.prefix + TimeSignature.topCharacter(numerator as TimeSignatureTop) + TimeSignature.bottomCharacter(denominator as NoteTypeName) + TimeSignature.suffix;
	}

	static readonly prefix = '<span class="timeSignature">';
	static readonly suffix = '</span>';

	static topCharacter(digit: TimeSignatureTop) {
		switch (digit) {
			case 1: return "!";
			case 2: return "@";
			case 3: return "#";
			case 4: return "$";
			case 5: return "%";
			case 6: return "^";
			case 7: return "&";
			case 8: return "*";
			case 9: return "(";
			case 10: return ")";
			case 12: return "~";
		}
	}

	static bottomCharacter(digit: NoteTypeName) {
		switch (digit) {
			case 1: return "1";
			case 2: return "2";
			case 4: return "4";
			case 8: return "8";
			case 16: return "6";
		}
	}
}

/**
 * Several notes combined into a rhythmic unit usable as a building block for a measure of music
 */
class Block {
	/** The contents of the block */
	readonly notes: Array<Note>;
	/** The beats in the measure (0-indexed) this block is allowed to be placed; `undefined` means anywhere, `[]` means nowhere. */
	readonly allowedStarts?: Array<number>;
	/** Whether or not this block is mandated to appear in a randomly-generated piece at least once */
	readonly isRequired: boolean;

	constructor(notes: Array<Note>, allowedStarts?: Array<number>, isRequired = false) {
		assert(notes.length > 0);
		this.notes = notes;
		this.allowedStarts = allowedStarts;
		this.isRequired = isRequired;
	}

	static required(notes: Array<Note>, allowedStarts?: Array<number>) {
		return new Block(notes, allowedStarts, true);
	}

	lengthIn(timeSignature: TimeSignature) {
		return this.notes.reduce((a,b) => a + b.relativeLength(timeSignature.bottom), 0);
	}

	static lengthOf(blocks: Array<Block>, timeSignature: TimeSignature) {
		return blocks.reduce((a,b) => a + b.lengthIn(timeSignature), 0);
	}

	fitsAfter(blocks: Array<Block>, timeSignature: TimeSignature) {
		if (this.allowedStarts?.indexOf(Block.lengthOf(blocks, timeSignature)) === -1) {
			return false;
		} else {
			return Block.lengthOf(blocks, timeSignature) + this.lengthIn(timeSignature) <= timeSignature.top;
		}
	}

	/**
	 * Returns every possible evolution of a given in-progress measure
	 * @param original The partial measure to build upon. If it's already finished, it's returned as-is.
	 * @param timeSignature The time signature in which to work
	 * @param possibilities A library of blocks to use. If none of them can be applied to `original`, an empty array is returned.
	 */
	static allPossibleNextStepsFor(original: Array<Block>, timeSignature: TimeSignature, possibilities: Array<Block>) {
		const currentLength = Block.lengthOf(original, timeSignature);
		if (currentLength == timeSignature.top) { return [original]; }
		return possibilities.filter(x => x.fitsAfter(original, timeSignature)).map(x => original.concat(x));
	}

	/** Returns every possible measure composable with the given blocks in the given time signature */
	static allPossibleMeasuresFrom(possibilities: Array<Block>, timeSignature: TimeSignature) {
		let result: Array<Array<Block>> = possibilities.filter(x => x.allowedStarts?.indexOf(0) !== -1).map(x => [x]);
		while (result.filter(x => Block.lengthOf(x, timeSignature) < timeSignature.top).length > 0) {
			result = result.map(x => Block.allPossibleNextStepsFor(x, timeSignature, possibilities)).reduce((a,b) => a.concat(b), []);
		}
		return result;
	}

	/** Flattens an array of blocks into an array of notes */
	static flatten(measure: Array<Block>) {
		return measure.reduce((a,b) => a.concat(b.notes), [] as Array<Note>);
	}

	/** Returns the specified number of measures, randomly generated from the given blocks, respecting the time signature and `required` property */
	static randomMeasures(timeSignature: TimeSignature, measures: number, blocks: Array<Block>) {
		const requiredBlocks = blocks.filter(x => x.isRequired);
		assert(measures > requiredBlocks.length);
		const possibleMeasures = Block.allPossibleMeasuresFrom(blocks, timeSignature);
		
		let resultMeasures: Array<Array<Note>> = [];
		for (let requiredBlock of requiredBlocks) {
			const options = possibleMeasures.filter(x => x.indexOf(requiredBlock) !== -1);
			resultMeasures.push(Block.flatten(options[Math.floor(Math.random() * options.length)]));
		}
		while (resultMeasures.length < measures) {
			resultMeasures.push(Block.flatten(possibleMeasures[Math.floor(Math.random() * possibleMeasures.length)]));
		}
		
		function shuffle(array: Array<Array<Note>>) {
			var j, x, i;
			for (i = array.length - 1; i > 0; i--) {
				j = Math.floor(Math.random() * (i + 1));
				x = array[i];
				array[i] = array[j];
				array[j] = x;
			}
		}

		shuffle(resultMeasures);
		return resultMeasures.reduce((a,b) => a.concat(b));
	}
}

/**
 * A piece of music, consisting of sequential notes in a particular time signature.
 */
class Piece {
	readonly timeSignature: TimeSignature;
	readonly notes: Array<Note>;
	/** Events corresponding to each of the `notes`, as well as one final end-of-piece event */
	readonly noteEvents: EventList;
	readonly beatEvents: EventList;

	/** A specific index to request when generating a backing loop; if not provided, `Sound` will pick a level-stable random choice */
	readonly backingLoopIndex?: number;

	/** A unique ID for this piece, usable to look up generated notation as HTML elements. */
	pieceID?: string;

	constructor(timeSignature: TimeSignature, notes: Array<Note> = [], backingLoopIndex?: number) {
		this.timeSignature = timeSignature;
		this.notes = notes.map(x => x.copy());
		
		let noteEvents: Array<MusicEvent> = [];
		let timing = 0;
		for (let note of this.notes) {
			noteEvents.push(new MusicEvent(timing, !(note instanceof Rest)));
			timing += note.relativeLength(timeSignature.bottom);
		}
		this.noteEvents = new EventList(noteEvents);

		let beatEvents: Array<MusicEvent> = [];
		for (let beat = 0; beat < timing; beat++) {
			beatEvents.push(new MusicEvent(beat));
		}
		this.beatEvents = new EventList(beatEvents);

		this.backingLoopIndex = backingLoopIndex;
	}

	static random(timeSignature: TimeSignature, measures: number, blocks: Array<Block>, backingLoopIndex?: number) {
		assert(measures > 0);
		return new Piece(timeSignature, Block.randomMeasures(timeSignature, measures, blocks), backingLoopIndex);
	}

	get end() {
		return this.noteEvents.last.timing + this.notes[this.notes.length-1].relativeLength(this.timeSignature.bottom);
	}

	get maxNoteType() {
		let result = 1;
		for (let note of this.notes) {
			result = Math.max(result, note.type.rawValue);
		}
		return new NoteType(result as NoteTypeName);
	}

	appropriateSpaces(note: Note) {
		let result = "";
		const relativeLength = note.relativeLength(new Note(this.maxNoteType));
		for (let i = 0; i < relativeLength-1; i++) {
			result += "&nbsp;";
		}
		return result;
	}

	idForNoteIndex(noteIndex: number) {
		assert(noteIndex >= 0);
		return this.pieceID + "-note" + noteIndex;
	}

	removeGrading(tempo: Tempo) {
		this.noteEvents.removeGrading();
		this.beatEvents.removeGrading();
		for (let i = 0; i < this.notes.length; i++) {
			this.updateAppearanceOfNoteAtIndex(i, tempo);
		}
	}

	gradingInfo(tempo: Tempo) {
		assert(tempo > 0);
		
		const clapInfo = this.noteEvents.gradingInfo(tempo);
		const tapInfo = this.beatEvents.gradingInfo(tempo);
		const passed = clapInfo.accuracy === 1 && tapInfo.accuracy === 1;
		const timingAccuracy = (clapInfo.timing + tapInfo.timing) / 2;
		const averageAccuracy = (clapInfo.accuracy + tapInfo.accuracy) / 2;

		let summary: string;

		if (passed) {
			if (timingAccuracy > 0.9) {
				summary = "Wow! You totally rocked that level; amazing job! See if you can do as well on the next!";
			} else if (timingAccuracy > 0.5) {
				summary = "Nice performance! This level's done; onto the next!";
			} else {
				summary = "You successfully performed every clap and tap! You can head on to the next level, or stick around and try to improve your timing!";
			}
		} else if (tapInfo.accuracy === 0) {
			summary = "Don't forget that you have to tap to the beat, not just clap the notes! Keep trying!";
		} else if (clapInfo.accuracy === 1) {
			summary = "Nice clapping! Focus on keeping a steady beat and you'll have this!";
		} else if (tapInfo.accuracy === 1) {
			summary = "Good work keeping the beat&mdash;focus next on clap accuracy; you can do this!";
		} else if (averageAccuracy > 0.8) {
			summary = "Almost there! Review the measures that are tripping you up&mdash;try practicing them one at a time before you go again!";
		} else {
			summary = "Practice is hard; keep working! You don't have to master the whole piece at once&mdash;pick just one measure to review and repeat it over and over yourself before you try again!";
		}

		return {
			clapAccuracy: clapInfo.accuracy,
			tapAccuracy: tapInfo.accuracy,
			timingAccuracy: timingAccuracy,
			passed: passed,
			summary: summary
		};
	}

	showTooltips(showTooltips: boolean) {
		for (let i = 0; i < this.notes.length; i++) {
			const noteElement = $("#" + this.idForNoteIndex(i));
			noteElement.tooltip(showTooltips ? "enable" : "disable");
			if (!showTooltips) {
				noteElement.attr("title", ""); //needed because jQuery bug removes `title` attribute when disabling tooltips, and then they never can be re-enabled
			}
		}
	}

	get notation() {
		let result = "";
		result += this.timeSignature.notation;
		let currentBeat = 0;
		
		let previousBeams: NoteTypeBeams = 0;
		
		for (let i = 0; i < this.notes.length; i++) {
			if (currentBeat >= this.timeSignature.top) {
				currentBeat -= this.timeSignature.top;
				result += Piece.barlineCharacter;
			}
			
			const note = this.notes[i];
			const noteLength = note.relativeLength(this.timeSignature.bottom);
			const willCrossBeat = Math.floor(currentBeat) != Math.floor(currentBeat + noteLength) || i == this.notes.length - 1;
			const nextBeams = willCrossBeat || this.notes[i+1] instanceof Rest ? 0 : this.notes[i+1].type.beams;
			
			let beamsIn: NoteTypeBeams;
			let beamsOut: NoteTypeBeams;

			if (note.type.beams == 0 || note instanceof Rest) {
				beamsIn = 0;
				beamsOut = 0;
			} else if (previousBeams == 0) {
				beamsIn = 0;
				beamsOut = (nextBeams == 0) ? 0 : note.type.beams;
			} else if (nextBeams == 0) {
				beamsIn = note.type.beams;
				beamsOut = 0;
			} else if (previousBeams == note.type.beams || nextBeams == note.type.beams) {
				beamsIn = previousBeams;
				beamsOut = nextBeams;
			} else if (previousBeams > note.type.beams && nextBeams > note.type.beams) {
				beamsIn = note.type.beams;
				beamsOut = note.type.beams;
			} else {
				const minorRhythmFactor = this.timeSignature.bottom.relativeLength(note.undotted.doubled)
				const willCrossMinorRhythmicBoundary = Math.floor(currentBeat * minorRhythmFactor) != Math.floor((currentBeat + noteLength) * minorRhythmFactor);
				if (willCrossMinorRhythmicBoundary) {
					beamsIn = note.type.beams;
					beamsOut = nextBeams;
				} else {
					beamsIn = previousBeams;
					beamsOut = note.type.beams;
				}
			}
			
			result += `<span id="${this.idForNoteIndex(i)}" title="">${note.notation(beamsIn, beamsOut)}</span>`;
			if (beamsIn == 0 && beamsOut == 0) {
				result += this.appropriateSpaces(note);
			}
			
			currentBeat += noteLength;
			previousBeams = beamsOut;
		}
		return result + Piece.finalBarlineCharacter;
	}

	private metricsForIndices(startIndex: number, endIndex: number) {
		assert(startIndex >= 0);
		assert(startIndex < this.notes.length);
		assert(endIndex >= 0);
		assert(endIndex < this.notes.length);

		const startElement = $("#" + this.idForNoteIndex(startIndex));
		const endElement = $("#" + this.idForNoteIndex(endIndex));
		
		const earlierIndex = Math.min(startIndex, endIndex);
		const laterIndex = Math.max(startIndex, endIndex);
		const crossesBarline = this.noteEvents.index(laterIndex).timing % this.timeSignature.top == 0;
		const beatLength = this.notes[earlierIndex].relativeLength(this.timeSignature.bottom) + (crossesBarline ? 1 : 0);
		const pixelOffset = endElement.position().left - startElement.position().left;

		return {beatLength: beatLength, pixelOffset: pixelOffset, crossesBarline: crossesBarline};
	}

	/**
	 * Converts a beat offset from a note into a pixel offset from a note HTML element
	 * @param offset The beat offset to convert
	 * @param noteIndex The index of the note to offset from
	 * @param counts Which counts may be used to describe locations in time; necessary to interpret offsets near barlines
	 * @param tempo The tempo of the piece
	 */
	private positionOffsetFromNoteIndex(offset: number, noteIndex: number, tempo: Tempo) {
		assert(noteIndex >= 0);
		assert(noteIndex < this.notes.length);

		if (offset < 0) {
			if (noteIndex > 0) {
				const metrics = this.metricsForIndices(noteIndex, noteIndex - 1);
				const timingDescription = TimingDescription.of(this.noteEvents.index(noteIndex).timing + offset, this.timeSignature, tempo);
				const isOnBeat1 = timingDescription.count.rawValue === "beat" && timingDescription.beat === 0;
				const fraction = (offset - (metrics.crossesBarline && !isOnBeat1 ? 1 : 0)) / metrics.beatLength;
				return fraction * -metrics.pixelOffset;
			} else {
				return 0;
			}
		} else {
			if (noteIndex < this.notes.length - 1) {
				const metrics = this.metricsForIndices(noteIndex, noteIndex + 1);
				return (offset / metrics.beatLength) * metrics.pixelOffset;
			} else {
				return offset * em(5); //just guessing
			}
		}
	}

	static hueForAccuracy(accuracy: number) {
		return accuracy * 125; //125°==green, 0°==red
	}
	
	updateAppearanceOfNoteAtIndex(noteIndex: number, tempo: Tempo) {
		assert(tempo > 0);
		assert(noteIndex >= 0);
		assert(noteIndex < this.notes.length);

		this.updateTooltipForNoteAtIndex(noteIndex, tempo);
		this.updateExtraClapsOfNoteAtIndex(noteIndex, tempo);
		this.updateCountingsOfNoteAtIndex(noteIndex, tempo); //must be called after setting `noteElement.tooltip`
	}

	private updateTooltipForNoteAtIndex(noteIndex: number, tempo: Tempo) {
		assert(tempo > 0);
		assert(noteIndex >= 0);
		assert(noteIndex < this.notes.length);

		const event = this.noteEvents.index(noteIndex);

		const noteElement = $("#" + this.idForNoteIndex(noteIndex));
		const noteOrRest = this.notes[noteIndex] instanceof Rest ? "rest" : "note";
		
		let tooltipContent = `<div>This ${noteOrRest} is ${TimingDescription.of(event.timing, this.timeSignature, tempo).description(Verbosity.long)}</div>`;
		
		if (!event.graded) {
			noteElement.css("color","black");
		} else {
			const hue = Piece.hueForAccuracy(event.accuracy(tempo));

			if (event.bestPerformanceAttempt === undefined) {
				tooltipContent += `<div style="color: hsl(${event.accuracy},80%,40%)">You didn't clap near it</div>`;
			} else {
				tooltipContent += `<div style="color: hsl(${hue},80%,40%)">You clapped ${TimingDescription.of(event.timing + event.bestPerformanceAttempt, this.timeSignature, tempo).description(Verbosity.long)}</div>`;
			}

			noteElement.css("color", `hsl(${hue},80%,40%)`);
		}

		if (event.timing === Math.floor(event.timing)) {
			let beatEvent = this.beatEvents.index(event.timing);
			if (beatEvent.graded) {
				const hue = Piece.hueForAccuracy(beatEvent.accuracy(tempo));
				if (beatEvent.bestPerformanceAttempt === undefined) {
					tooltipContent += `<div style="color: hsl(${hue},80%,40%)">You didn't tap ${TimingDescription.of(beatEvent.timing, this.timeSignature, tempo).description(Verbosity.medium)}</div>`;
				} else {
					tooltipContent += `<div style="color: hsl(${hue},80%,40%)">You tapped ${TimingDescription.of(beatEvent.timing + beatEvent.bestPerformanceAttempt, this.timeSignature, tempo).description(Verbosity.medium)}</div>`;
				}
			}
		}
		
		if (noteElement.tooltip("instance") !== undefined) {
			noteElement.tooltip("destroy");
		}
		
		noteElement.tooltip({
			content: tooltipContent,
			position: { my: "center top", at: "center bottom-30", collision: "fit" }
		});
	}

	private updateExtraClapsOfNoteAtIndex(noteIndex: number, tempo: Tempo) {
		assert(tempo > 0);
		assert(noteIndex >= 0);
		assert(noteIndex < this.notes.length);
		
		const event = this.noteEvents.index(noteIndex);
		if (event === undefined) { assertionFailure(); }
		const noteElement = $("#" + this.idForNoteIndex(noteIndex));

		const extraClapClass = this.idForNoteIndex(noteIndex) + "-extraClap";
		noteElement.parent().children("." + extraClapClass).remove();

		if (!event.graded) { return; }

		for (let extraClap of event.extraPerformanceAttempts) {
			const position = this.positionOffsetFromNoteIndex(extraClap, noteIndex, tempo);
			const extraClapElement = $(`<div class="extraClap ${extraClapClass}" title="">Extra clap<br/>❗️</div>`);
			noteElement.parent().append(extraClapElement);
			extraClapElement.position({
				my: "center top",
				at: `left+${position} top+${vw(1.5)}`,
				of: noteElement,
				collision: "none",
				within: noteElement.parent()
			})
			extraClapElement.tooltip({
				content: `<div style="color: hsl(0,80%,40%)">You added a clap ${TimingDescription.of(event.timing + extraClap, this.timeSignature, tempo).description(Verbosity.long)}</div>`
			});
		}
	}

	private updateCountingsOfNoteAtIndex(noteIndex: number, tempo: Tempo) {
		assert(tempo > 0);
		assert(noteIndex >= 0);
		assert(noteIndex < this.notes.length);
		
		const note = this.notes[noteIndex];
		const noteEvent = this.noteEvents.index(noteIndex);
		const noteElement = $("#" + this.idForNoteIndex(noteIndex));

		const countingClass = this.idForNoteIndex(noteIndex) + "-counting";
		noteElement.parent().children("." + countingClass).remove();

		const extraTapClass = this.idForNoteIndex(noteIndex) + "-extraTap";
		noteElement.parent().children("." + extraTapClass).remove();

		if (!noteEvent.graded) { return; }

		const shouldShowNoteCount = !(note instanceof Rest) || noteEvent.timing === Math.floor(noteEvent.timing);
		const visibleCountings = (shouldShowNoteCount ? [0] : []).concat(noteEvent.offsetsToBeatsForLength(note.relativeLength(this.timeSignature.bottom)));
		for (let relativeCounting of visibleCountings) {
			const absoluteCounting = noteEvent.timing + relativeCounting;
			const position = this.positionOffsetFromNoteIndex(relativeCounting, noteIndex, tempo);

			let noteAccuracy = 1;
			let beatAccuracy = 1;
			let tooltipContent: string;
			if (absoluteCounting === Math.floor(absoluteCounting)) {
				const beatEvent = this.beatEvents.index(absoluteCounting);
				beatAccuracy = beatEvent.accuracy(tempo);
				if (!beatEvent.graded) { return; }

				//Render extra taps
				for (let extraTap of beatEvent.extraPerformanceAttempts) {
					const position = this.positionOffsetFromNoteIndex(extraTap + beatEvent.timing - noteEvent.timing, noteIndex, tempo);
					const extraTapElement = $(`<div class="extraTap ${extraTapClass}" title="">❗️<br/>Extra tap</div>`);
					noteElement.parent().append(extraTapElement);
					extraTapElement.position({
						my: "center bottom",
						at: `left+${position} bottom`,
						of: noteElement,
						collision: "none",
						within: noteElement.parent()
					})
					extraTapElement.tooltip({
						content: `<div style="color: hsl(0,80%,40%)">You added a tap ${TimingDescription.of(beatEvent.timing + extraTap, this.timeSignature, tempo).description(Verbosity.long)}</div>`
					});
				}
			}

			if (relativeCounting === 0 && noteEvent.timing !== Math.floor(noteEvent.timing)) {
				noteAccuracy = noteEvent.accuracy(tempo);
			}
			const hue = Piece.hueForAccuracy(Math.min(noteAccuracy, beatAccuracy));

			const countingElement = $(`<div style="color: hsl(${hue},80%,40%)" class="counting ${countingClass}" title="">&nbsp;${TimingDescription.of(absoluteCounting, this.timeSignature, tempo).description(Verbosity.short)}</div>`);
			noteElement.parent().append(countingElement);
			countingElement.position({
				my: "left bottom",
				at: `left+${position} bottom-${vw(2.5)}`,
				of: noteElement,
				collision: "fit",
				within: noteElement.parent()
			})

			if (relativeCounting === 0) {
				const noteElement = $("#" + this.idForNoteIndex(noteIndex));
				tooltipContent = noteElement.tooltip("option", "content");
			} else {
				const beatEvent = this.beatEvents.index(absoluteCounting);

				if (beatEvent.bestPerformanceAttempt === undefined) {
					tooltipContent = `<div style="color: hsl(${hue},80%,40%)">You didn't tap ${TimingDescription.of(beatEvent.timing, this.timeSignature, tempo).description(Verbosity.medium)}</div>`;
				} else {
					tooltipContent = `<div style="color: hsl(${hue},80%,40%)">You tapped ${TimingDescription.of(beatEvent.timing + beatEvent.bestPerformanceAttempt, this.timeSignature, tempo).description(Verbosity.medium)}</div>`;
				}
			}

			countingElement.tooltip({
				content: tooltipContent
			});
		}
	}

	static readonly barlineCharacter = "\\ ";
	static readonly finalBarlineCharacter = "\\|";
}

/**
 * Data the Player class uses to track in-progress playback of a piece.
 */
interface Playback {
	startTime: number;
	nextNote: number;
	timerID: number;
}

/**
 * A music player which can play back a piece of music at a given tempo, and accept & grade performed claps.
 */
class Player {
	private _piece: Piece;
	get piece() { return this._piece; }
	set piece(newValue: Piece) {
		this._piece = newValue;
		this.playback = undefined;
	}

	tempo: Tempo;
	private backingLoop?: Sound;

	/** Called when the player starts playback. */
	onPlay = function() {};

	/** Called when the player ceases playback, either by pausing early or by finishing the piece. */
	onStop = function() {};

	/** Called when the player successfully finishes the piece. */
	onComplete = function() {};

	private playback?: Playback;

	constructor(piece: Piece, tempo: Tempo) {
		this._piece = piece;
		this.tempo = tempo;
		this.backingLoop = Sound.backingLoop(piece.timeSignature, tempo);
	}

	get isPlaying() { return this.playback !== undefined; }

	get isCountingOff() {
		if (this.playback === undefined) { return false; }
		return this.isPlaying && this.playback.nextNote < 0;
	}

	/**
	 * Begins playback, disabling tooltips on `piece` and calling `onPlay` if set. If already playing, does nothing.
	 */
	play(countOff = true) {
		if (this.isPlaying) { return; }
		if (this.piece === undefined) { return; }

		this.piece.showTooltips(false);
		this.rewind();
		
		const delayUntilStart = countOff ? this.piece.timeSignature.milliseconds(this.piece.timeSignature.countoff.notes, this.tempo) : 0;
		this.playback = {
			startTime: Date.now() + delayUntilStart,
			nextNote: (countOff ? -this.piece.timeSignature.countoff.notes.length : 0),
			timerID: NaN //will replace momentarily
		};

		this.playNote();
		requestAnimationFrame(() => this.update());
		this.onPlay();
	}

	/**
	 * Stops playback, re-enabling tooltips on `piece` and calling `onStop` if set. If playback has already been stopped, does nothing.
	 */
	stop() {
		if (!this.isPlaying) { return; }
		if (this.playback === undefined) { assertionFailure(); }
		clearTimeout(this.playback.timerID);
		this.backingLoop?.stop();
		this.playback = undefined;
		this.piece.showTooltips(true);
		this.onStop();
	}

	/**
	 * Scrolls the player back to the start. You may only rewind while the player is stopped.
	 */
	rewind() {
		assert(!this.isPlaying);

		const playerElement = $("#" + this.piece.idForNoteIndex(0));
		playerElement.parent().animate({ scrollLeft: 0 }, 1000);
	}

	gradeClap() {
		if (this.isCountingOff || !this.isPlaying) { return; }
		if (this.playback === undefined) { assertionFailure(); }

		const clapTime = (Date.now() - Player.synchronizationHack - this.playback.startTime) / Player.beatLength(this.tempo);

		const affectedIndices = this.piece.noteEvents.gradePerformanceAttempt(clapTime);
		for (let i of affectedIndices) {
			if (i == this.piece.notes.length) { continue; }
			this.piece.updateAppearanceOfNoteAtIndex(i, this.tempo);
		}
	}

	gradeTap() {
		if (this.isCountingOff || !this.isPlaying) { return; }
		if (this.playback === undefined) { assertionFailure(); }

		const tapTime = (Date.now() - Player.synchronizationHack - this.playback.startTime) / Player.beatLength(this.tempo);
		const affectedIndices = this.piece.beatEvents.gradePerformanceAttempt(tapTime);
		for (let i of affectedIndices) {
			const noteIndex = this.piece.noteEvents.lastIndexBefore(this.piece.beatEvents.index(i).timing);
			this.piece.updateAppearanceOfNoteAtIndex(noteIndex, this.tempo);
		}
	}

	private update() {
		if (!this.isPlaying) { return; }
		if (this.playback === undefined) { assertionFailure(); }

		this.piece.beatEvents.enableGradingThrough((Date.now() - this.playback.startTime) / Player.beatLength(this.tempo));
		if (this.playback.nextNote > 0 && this.playback.nextNote <= this.piece.notes.length) {
			this.piece.updateAppearanceOfNoteAtIndex(this.playback.nextNote - 1, this.tempo);
		}

		requestAnimationFrame(() => this.update());
	}

	private playNote() {
		if (this.piece === undefined) { return; }
		if (this.playback === undefined) { return; }

		if (this.playback.nextNote === 0) {
			this.backingLoop?.play();
		}

		if (this.playback.nextNote >= this.piece.notes.length) {
			this.piece.beatEvents.enableGradingThrough(this.piece.end);
			this.piece.updateAppearanceOfNoteAtIndex(this.piece.notes.length - 1, this.tempo);
			this.stop();
			this.onComplete();
		}
		if (!this.isPlaying) { return; }
		
		const currentNote = this.isCountingOff ? this.piece.timeSignature.countoff.notes[this.playback.nextNote + this.piece.timeSignature.countoff.notes.length] : this.piece.notes[this.playback.nextNote];
		
		currentNote.sound?.play();
		
		let noteElement = undefined;
		if (!this.isCountingOff) {
			noteElement = $("#" + this.piece.idForNoteIndex(this.playback.nextNote));
			this.piece.noteEvents.index(this.playback.nextNote).graded = true;
			if (this.playback.nextNote > 0) {
				this.piece.beatEvents.enableGradingThrough(this.piece.noteEvents.index(this.playback.nextNote).timing)
				this.piece.updateAppearanceOfNoteAtIndex(this.playback.nextNote - 1, this.tempo);
			}
			this.piece.updateAppearanceOfNoteAtIndex(this.playback.nextNote, this.tempo);
		}
		
		this.playback.nextNote += 1;
		let nextNoteTime: number;
		if (this.isCountingOff) {
			const countoffIndex = this.playback.nextNote + this.piece.timeSignature.countoff.notes.length;
			const remainingCountoff = this.piece.timeSignature.countoff.notes.slice(countoffIndex);
			const remainingTime = this.piece.timeSignature.milliseconds(remainingCountoff, this.tempo);
			nextNoteTime = this.playback.startTime - remainingTime;
		} else if (this.playback.nextNote == this.piece.notes.length) {
			nextNoteTime = this.playback.startTime + (this.piece.end * Player.beatLength(this.tempo));
		} else {
			nextNoteTime = this.playback.startTime + (this.piece.noteEvents.index(this.playback.nextNote).timing * Player.beatLength(this.tempo));
		}
		
		if (noteElement && this.playback.nextNote > 0 && this.playback.nextNote < this.piece.notes.length) {
			const nextNoteElement = $("#" + this.piece.idForNoteIndex(this.playback.nextNote));
			const scrollMargin = vw(20);
			let newScrollPosition;
			if (nextNoteElement === undefined) {
				newScrollPosition = noteElement[0].offsetLeft;
			} else {
				newScrollPosition = nextNoteElement[0].offsetLeft;
			}
			noteElement.parent().animate({ scrollLeft: newScrollPosition - scrollMargin }, nextNoteTime - Date.now());
		}
		
		var self = this;
		this.playback.timerID = window.setTimeout(function() { self.playNote(); }, nextNoteTime - Date.now());
	}

	static beatLength(tempo: Tempo) {
		assert(tempo > 0);
		return 1000 * 60/tempo;
	};

	static synchronizationHack = 20; //ms
}