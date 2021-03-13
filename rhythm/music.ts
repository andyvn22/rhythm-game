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

function isInternetExplorer() {
    return window.navigator.userAgent.indexOf('MSIE ') >= 0 || window.navigator.userAgent.indexOf('Trident/') >= 0;
}

let cachedWidth: number | undefined = undefined;
$(window).on("resize", function() {
	cachedWidth = document.documentElement.clientWidth; //reading this width is SLOWWWW.
});

/** Converts from vw (hundredths of viewport width) to pixels */
function vw(vw: number) {
	if (cachedWidth === undefined) {
		cachedWidth = document.documentElement.clientWidth;
	}
	return Math.round(vw * cachedWidth / 100);
}

/** Converts from em to pixels, relative to the font size of the element `relativeTo`, or `document.body` if no element is given. */
function em(em: number, relativeTo = document.body) {
	return Math.round(parseFloat(getComputedStyle(relativeTo).fontSize) * em);
}

function nudgeFloat(input: number) {
	const epsilon = 0.00001;
	if (Math.abs(input - Math.round(input)) < epsilon) {
		return Math.round(input);
	} else {
		return input;
	}
}

/**
 * A sound effect that can be audibly played, such as a click, part of a countoff, or a backing loop.
 * 
 * Sounds are preloaded at initialization.
 * I don't have the slightest idea why, but you need to delete all instances of "export" in howler/index.d.ts for this to compile... :(
 */

class Sound {
	private name: string;
	private value: Howl;
	private static howls = Object.create(null);
	private static playCallbacks = Object.create(null);

	private constructor(name: string, loop = false, rate = 1) {
		this.name = name;
		if (Sound.howls[name] === undefined) {
			Sound.howls[name] = new Howl({
				src: [`media/sounds/${name}.mp3`],
				loop: loop,
				preload: true,
				rate: rate,
				onplay: function() {
					const callback = Sound.playCallbacks[name];
					if (callback !== undefined) {
						callback();
						Sound.playCallbacks[name] = undefined;
					}
				}
			});
		}
		this.value = Sound.howls[name];
	}

	play(onPlay: () => void = function() {}) {
		Sound.playCallbacks[this.name] = onPlay;
		this.value.play();
	}

	stop() {
		this.value.stop();
	}

	get seek() {
		return this.value.seek() as number;
	}

	static get usingWebAudio() { return Howler.usingWebAudio; }

	static get clap() { return new Sound("metronome"); }
	static get beat() { return new Sound("beat"); }

	static number(number: number) {
		assert(number < 11);
		assert(number === Math.floor(number));
		return new Sound(number.toString());
	}

	static get readyFirstSyllable() { return new Sound("rea-"); }
	static get readySecondSyllable() { return new Sound("-dy"); }
	static get go() { return new Sound("go"); }

	static get fanfare() { return new Sound("fanfare"); }
	static get success() { return new Sound("success"); }
	static get correct() { return new Sound("correct"); }
	static get wrong() { return new Sound("wrong"); }

	/**
	 * Creates and returns a backing loop appropriate for the given time signature and tempo.
	 * 
	 * May return different instances for the same input; save your backing loop instance if you need to stop it later.
	 */
	static backingLoop(timeSignature: TimeSignature, tempo: Tempo, index?: number): Sound {
		function indexTo(upperBound: number) {
			if (index !== undefined) {
				return index % upperBound;
			} else {
				return Level.current?.stablePseudorandomIntegerTo(upperBound) ?? Math.floor(Math.random() * upperBound);
			}
		}

		const rate = tempo/80;
		if (timeSignature.isSwing) {
			switch(timeSignature.top) {
				case 2: case 4:
				case 3:
			}
		} else if (timeSignature.isCompound) {
			switch(timeSignature.top) {
				case 2: case 4:
					return new Sound(`loops/compoundQuadruple/${indexTo(6)}`, true, rate);
				case 3:
					return new Sound(`loops/compoundTriple/${indexTo(1)}`, true, rate);
			}
		} else {
			switch(timeSignature.top) {
				case 2: case 4:
					return new Sound(`loops/simpleQuadruple/${indexTo(8)}`, true, rate);
				case 3: return new Sound(`loops/simpleTriple/${indexTo(3)}`, true, rate);
				case 5: return new Sound(`loops/simpleQuintuple/${indexTo(2)}`, true, rate);
			}
		}
		return new Sound(`loops/0`, true, rate);
	}
}

type Tempo = 46 | 52 | 60 | 80 | 92 | 100 | 120;

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

	/**
	 * Returns the accuracy (from 0-1) of the best performance attempt at the given tempo.
	 * @param tempo The tempo at which to grade the performance attempt
	 * @param offset A beat offset to shift the performance attempt by before grading it; defaults to 0
	 */
	accuracy(tempo: Tempo, offset: number = 0) {
		assert(tempo > 0);

		if (this.shouldPerform) {
			if (this.bestPerformanceAttempt === undefined) { return 0; }
			return Math.max(1 - (Math.abs((this.bestPerformanceAttempt + offset) * Player.beatLength(tempo)) / MusicEvent.timingThreshold), 0);
		} else {
			if (this.bestPerformanceAttempt === undefined) { return 1; }
			else return 0;
		}
	}

	/** Returns the offsets to all whole-numbered beats that occur before `length` is over */
	offsetsToBeatsForLength(length: number) {
		assert(length > 0);
		
		let result = [];
		for (let i = Math.ceil(this.timing); i < nudgeFloat(this.timing + length); i++) {
			result.push(nudgeFloat(i - this.timing));
		}
		return result;
	}

	/** How far away two timings can be before they're graded as different */
	static readonly timingThreshold = 200; //ms
}

/**
 * An ordered collection of `MusicEvent`s
 */
class EventList {
	private value: Array<MusicEvent>
	readonly ignoreLastEvent: boolean;

	/** Creates a new list of the specified events. The given events must be in chronological order. */
	constructor(events: Array<MusicEvent>, ignoreLastEvent = false) {
		this.value = events;
		this.ignoreLastEvent = ignoreLastEvent;
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

	private get gradedEvents() {
		return this.ignoreLastEvent ? this.value.slice(0,-1) : this.value;
	}

	get averageOffset() {
		const bestAttempts = this.gradedEvents.map(x => x.bestPerformanceAttempt).filter(x => x !== undefined) as Array<number>;
		if (bestAttempts.length === 0) { return 0; }
		return bestAttempts.reduce((a,b) => a + b, 0) / bestAttempts.length;
	}

	/**
	 * Returns grading info about the quality of performances of these events, at a specific tempo. 
	 * @param tempo The tempo at which to evaluate these performances
	 * @param offset An offset to apply to all performances before grading; defaults to 0
	 */
	gradingInfo(tempo: Tempo, offset: number = 0) {
		assert(tempo > 0);

		const successes = this.gradedEvents.filter(x => x.accuracy(tempo, offset) > 0);
		const extraAttempts = this.gradedEvents.reduce((a,b) => a + b.extraPerformanceAttempts.length, 0);
		const accuracy = successes.length / (this.gradedEvents.length + extraAttempts);
		const timingRating = this.value.reduce((a,b) => a + b.accuracy(tempo, offset), 0) / this.gradedEvents.length;
		
		return {accuracy: accuracy, timingRating: timingRating, averageOffset: this.averageOffset};
	}

	mightHaveLatencyIssues(tempo: Tempo) {
		const apparentAccuracy = this.gradingInfo(tempo, 0).accuracy;
		if (apparentAccuracy > 0.8) { return false; }
		if (this.averageOffset < 0) { return false; }
		const correctedAccuracy = this.gradingInfo(tempo, -this.averageOffset).accuracy;
		return (correctedAccuracy > 0.65 && correctedAccuracy - apparentAccuracy > 0.25);
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
			case 1: return "whole";
			case 2: return "half";
			case 4: return "quarter";
			case 8: return "eighth";
			case 16: return "sixteenth";
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

	get stemmed() {
		return this.rawValue > 1;
	}

	get absoluteLength() {
		return 1/this.rawValue;
	}

	static readonly dotCharacter = "\ue1fc&nbsp;";

	static dots(count: number) {
		assert(count >= 0);
		let result = "";
		for (let i = 0; i < count; i++) {
			result += NoteType.dotCharacter;
		}
		return result;
	}

	static readonly unbeamedSpacer = "&nbsp;";

	static spacer(beams: NoteTypeBeams): string {
		switch (beams) {
			case 0: return "&nbsp;&nbsp;";
			case 1: return "\ue1f8";
			case 2: return "\ue1fa";
		}
	}

	unbeamedCharacter(dots: 0 | 1 | 2, spaced = true): string {
		let result: string;
		switch (this.rawValue) {
			case 1: result = "\ue1d2"; break;
			case 2: result = "\ue1d3"; break;
			case 4: result = "\ue1d5"; break;
			case 8: result = "\ue1d7"; break;
			case 16: result = "\ue1d9"; break;
		}
		if (spaced || dots > 0) {
			result += NoteType.unbeamedSpacer + NoteType.dots(dots);
		}
		return result + (spaced ? NoteType.unbeamedSpacer : "");
	}

	static beamedCharacter(beamsIn: NoteTypeBeams, beamsOut: NoteTypeBeams, dots: 0 | 1 | 2): string {
		let result = "";

		switch (beamsIn) {
			case 0: result += "\ue1f1"; break;
			case 1: result += "\ue1f3"; break;
			case 2: result += "\ue1f5"; break;
			default: assertionFailure();
		}

		switch (beamsOut) {
			case 0: result += ""; break;
			case 1: result += "\ue1f8"; break;
			case 2: result += "\ue1fa"; break;
			default: assertionFailure();
		}

		result += NoteType.dots(dots);

		if (beamsOut == 0) {
			result += NoteType.unbeamedSpacer + NoteType.unbeamedSpacer; //dots combine correctly with beam-finishing note characters so we do both spacers afterwards instead of on either side like with true unbeamed notes
		}

		return result;
	}

	restCharacter(dots: 0 | 1 | 2, spaced = true): string {
		let result: string;
		switch (this.rawValue) {
			case 1: result = "&nbsp;\ue4f4"; break;
			case 2: result = "&nbsp;\ue4f5"; break;
			case 4: result = "\ue4e5"; break;
			case 8: result = "\ue4e6"; break;
			case 16: result = "\ue4e7"; break;
		}
		if (spaced || dots > 0) {
			result += NoteType.unbeamedSpacer + NoteType.dots(dots);
		}
		return result + (spaced ? NoteType.unbeamedSpacer : "");
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

	constructor(type: NoteType, dots: 0 | 1 | 2 = 0, customPrefix = "", customSuffix = "", sound = Sound.clap) {
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
		return this.dotsDescription + this.type.description + " note";
	}

	toString() {
		return this.description;
	}

	get lowercaseIndefiniteDescription() {
		return `${this.description[0] === "e" ? "an" : "a"} ${this.description}`;
	}

	get capitalizedIndefiniteDescription() {
		return `${this.description[0] === "e" ? "An" : "A"} ${this.description}`;
	}

	notation(beamsIn: NoteTypeBeams = 0, beamsOut: NoteTypeBeams = 0, spaced = true) {
		const result = (beamsIn == 0 && beamsOut == 0) ? this.type.unbeamedCharacter(this.dots, spaced) : NoteType.beamedCharacter(beamsIn, beamsOut, this.dots);
		return this.customPrefix + result + this.customSuffix;
	}

	get inlineNotation() {
		const style = this.stemmed ? ` style="top: 0.4em;"` : ``;
		return `<span class="inline-notation"${style}>${this.notation(0, 0, false)}</span>`;
	}

	get stemmed(): boolean {
		return !(this instanceof Rest) && this.type.stemmed;
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

	readableLength(timeSignature: TimeSignature) {
		const wholeComponent = Math.floor(this.relativeLength(timeSignature.bottom));
		const fractionalComponent = this.relativeLength(timeSignature.bottom) - wholeComponent;

		const wholeDescription = wholeComponent === 0 ? "" : wholeComponent.toString();
		let fractionalDescription = "";

		const epsilon = 0.0001;
		const phrases = [
			[0, ``],
			[1/4, `&frac14;`],
			[1/2, `&frac12;`],
			[3/4, `&frac34;`],
			[1/6, `&frac16;`],
			[1/3, `&frac13;`],
			[2/3, `&frac23;`],
			[5/6, `&frac56;`]
		];
		for (let pair of phrases) {
			const value = pair[0] as number;
			const phrase = pair[1] as string;

			if (Math.abs(value - fractionalComponent) < epsilon) {
				fractionalDescription = phrase;
			}
		}

		return wholeDescription + fractionalDescription + " beat" + (this.relativeLength(timeSignature.bottom) > 1 ? "s" : "");
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
};

/**
 * A subclass of `Note` that should not be performed and makes no sound.
 */
class Rest extends Note {
	constructor(type: NoteType, dots: 0 | 1 | 2 = 0, customPrefix = "", customSuffix = "", sound?: Sound) {
		super(type, dots, customPrefix, customSuffix, sound);
		if (sound === undefined) { this.sound = undefined; }
	}

	get description() {
		return this.dotsDescription + this.type.description + " rest";
	}

	notation(beamsIn: 0 | 1 | 2 = 0, beamsOut: 0 | 1 | 2 = 0, spaced = true) {
		beamsIn; beamsOut;
		const result = this.type.restCharacter(this.dots, spaced);
		return this.customPrefix + result + this.customSuffix;
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

	get description() {
		return this.toString();
	}

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

	get capitalizedTimingString(): string {
		return this.timingString.charAt(0).toUpperCase() + this.timingString.slice(1);
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
	static of(timing: number, timeSignature: TimeSignature, tempo: Tempo = 80) {
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
			fractionalTiming = fractionalTiming - 1;
		}

		if (closestCount.isEqual(Count.and) && timeSignature.isCompound) {
			closestCount = Count.ti;
		} else if (closestCount.isEqual(Count.ti) && !timeSignature.isCompound) {
			closestCount = Count.and;
		}

		let offset = (fractionalTiming - closestCount.timing) * Player.beatLength(tempo);

		let precision: TimingPrecision = "on";
		if (offset > MusicEvent.timingThreshold / 4) {
			precision = "a little after";
		} else if (offset < -MusicEvent.timingThreshold / 4) {
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

type TimeSignatureTop = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16;

/**
 * An Orff time signature, consisting of a number of beats per measure (top) and a type of note that receives 1 beat (bottom).
 */
class TimeSignature {
	readonly top: TimeSignatureTop;
	readonly bottom: Note;
	readonly isSwing: boolean;

	constructor(top: TimeSignatureTop, bottom: Note, isSwing: boolean = false) {
		assert(Math.floor(top) === top);
		assert(top > 0);
		assert(top <= 10);
		assert(bottom.dots <= 1);
		
		this.top = top;
		this.bottom = bottom.normalized;
		this.isSwing = isSwing;
	}

	static get twoFour() { return new TimeSignature(2, Note.quarter); }
	static get threeFour() { return new TimeSignature(3, Note.quarter); }
	static get fourFour() { return new TimeSignature(4, Note.quarter); }
	static get fiveFour() { return new TimeSignature(5, Note.quarter); }

	static get commonTime() { return TimeSignature.fourFour; }
	static get cutTime() { return new TimeSignature(2, Note.half); }

	static get sixEight() { return new TimeSignature(2, Note.quarter.dotted); }
	static get nineEight() { return new TimeSignature(3, Note.quarter.dotted); }
	static get twelveEight() { return new TimeSignature(4, Note.quarter.dotted); }

	get swung() { return new TimeSignature(this.top, this.bottom, true); }

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
		let go = this.bottom.copy();
		
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
		assert(numerator <= 16);
		const denominator = this.bottom.dots === 0 ? this.bottom.type.rawValue : this.bottom.type.rawValue * 2;
		assert(denominator <= 16);
		return `<span class="timeSignature-top">${TimeSignature.topNotation(numerator as TimeSignatureTop)}</span><span class="timeSignature-bottom">${TimeSignature.bottomNotation(denominator as NoteTypeName)}</span>`;
	}

	get inlineNotation() {
		return `<span class="inline-notation" style="margin-left: -0.2em; margin-right: -0.3em;">${this.notation}</span>`;
	}

	static topNotation(value: TimeSignatureTop) {
		return this.numericCharacters(value, "\ue09e") + "&nbsp;";
	}

	static bottomNotation(value: NoteTypeName) {
		return this.numericCharacters(value, "\ue09f") + "&nbsp;";
	}

	private static numericCharacters(value: TimeSignatureTop, control: string) {
		const basis = 0xe080;
		let result = "";
		let place = 1;
		while (place <= value) {
			const digit = (value % (place*10)) / place;
			result += control + String.fromCharCode(basis + digit);
			place *= 10;
		}
		return result;
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
		assert(measures >= requiredBlocks.length);
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

interface StaffElementPositionArguments {
	element: JQuery<HTMLElement>
	noteIndex: number
	beatOffset: number
	verticalOffset: number
	centerElement: boolean
	belowNote: boolean
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
			timing = nudgeFloat(timing);
		}
		
		if (timeSignature.isSwing) {
			for (let event of noteEvents) {
				if (event.timing % 1 == 0.5) {
					event.timing += 1/6;
				}
			}
		}

		this.noteEvents = new EventList(noteEvents);

		let beatEvents: Array<MusicEvent> = [];
		for (let beat = 0; beat <= timing; beat++) {
			beatEvents.push(new MusicEvent(beat));
		}
		this.beatEvents = new EventList(beatEvents, true);

		this.backingLoopIndex = backingLoopIndex;
	}

	static random(timeSignature: TimeSignature, measures: number, blocks: Array<Block>, backingLoopIndex?: number) {
		assert(measures > 0);
		return new Piece(timeSignature, Block.randomMeasures(timeSignature, measures, blocks), backingLoopIndex);
	}

	get end() {
		return this.noteEvents.last.timing + this.notes[this.notes.length-1].relativeLength(this.timeSignature.bottom);
	}

	/** Returns a reference note to use when considering how far to space out the music. Never returns whole note, though; that's too squished. */
	get maxNoteType() {
		let result = 4;
		for (let note of this.notes) {
			result = Math.max(result, note.type.rawValue);
		}
		return new NoteType(result as NoteTypeName);
	}

	appropriateSpaces(note: Note, beams: NoteTypeBeams) {
		let result = "";
		const relativeLength = note.relativeLength(new Note(this.maxNoteType));
		for (let i = 0; i < relativeLength-1; i++) {
			result += NoteType.spacer(beams);
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
		const timingRating = (clapInfo.timingRating + tapInfo.timingRating) / 2;
		const averageAccuracy = (clapInfo.accuracy + tapInfo.accuracy) / 2;
		const averageOffset = (clapInfo.averageOffset + tapInfo.averageOffset) / 2;

		let summary: string;

		if (passed) {
			if (timingRating > 0.9) {
				summary = "Wow! You totally rocked that level; amazing job! See if you can do as well on the next!";
			} else if (timingRating > 0.5) {
				summary = "Nice performance! This level's done; onto the next!";
			} else {
				summary = "You successfully performed every clap and tap! You can head on to the next level, or stick around and try to improve your timing!";
			}
		} else if (this.beatEvents.mightHaveLatencyIssues(tempo)) {
			summary = `Say... your beat taps are <em>consistently</em> ${Math.round(this.beatEvents.averageOffset * Player.beatLength(tempo) / 100) / 10} seconds late. You're not playing on wireless headphones, are you? Try using your device's built-in speakers!`;
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

		summary += "<br/><br/>"

		return {
			clapAccuracy: clapInfo.accuracy,
			tapAccuracy: tapInfo.accuracy,
			timingRating: timingRating,
			averageOffset: averageOffset,
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
			const isAtEnd = i == this.notes.length - 1;
			const willCrossBeat = Math.floor(currentBeat) != Math.floor(nudgeFloat(currentBeat + noteLength)) && nudgeFloat(currentBeat + noteLength) == Math.floor(nudgeFloat(currentBeat + noteLength));
			const nextBeams = isAtEnd || willCrossBeat || this.notes[i+1] instanceof Rest ? 0 : this.notes[i+1].type.beams;
			
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
			} else if (previousBeams > note.type.beams && nextBeams > note.type.beams) {
				beamsIn = note.type.beams;
				beamsOut = note.type.beams;
			} else if (nextBeams > previousBeams && nextBeams === note.type.beams) {
				beamsIn = previousBeams;
				beamsOut = nextBeams;
			} else {
				const minorRhythmFactor = this.timeSignature.bottom.relativeLength(note.undotted.doubled)
				const willCrossMinorRhythmicBoundary = Math.floor(currentBeat * minorRhythmFactor) != Math.floor(nudgeFloat((currentBeat + noteLength) * minorRhythmFactor)) && nudgeFloat((currentBeat + noteLength) * minorRhythmFactor) == Math.floor(nudgeFloat((currentBeat + noteLength) * minorRhythmFactor));
				if (willCrossMinorRhythmicBoundary) {
					beamsIn = note.type.beams;
					beamsOut = Math.min(nextBeams, note.type.beams) as 0 | 1 | 2;
				} else {
					beamsIn = Math.min(previousBeams, note.type.beams) as 0 | 1 | 2;
					beamsOut = note.type.beams;
				}
			}
			
			const type = note instanceof Rest ? "rest" : "note";
			result += `<span class="${type}" id="${this.idForNoteIndex(i)}" title="">${note.notation(beamsIn, beamsOut)}`;
			result += this.appropriateSpaces(note, beamsOut) + `</span>`;
			
			currentBeat = nudgeFloat(currentBeat + noteLength);
			previousBeams = beamsOut;
		}

		return result + `<span id="${this.idForNoteIndex(this.notes.length)}">${Piece.finalBarlineCharacter}</span><span class="ie-padding-hack"></span>`;
	}

	private metricsForIndices(startIndex: number, endIndex: number) {
		assert(startIndex >= 0);
		assert(startIndex < this.notes.length);
		assert(endIndex >= 0);
		assert(endIndex <= this.notes.length); //final barline could be equal to length

		const startElement = $("#" + this.idForNoteIndex(startIndex));
		const endElement = $("#" + this.idForNoteIndex(endIndex));
		
		const earlierIndex = Math.min(startIndex, endIndex);
		const laterIndex = Math.max(startIndex, endIndex);
		const crossesBarline = laterIndex != this.notes.length && this.noteEvents.index(laterIndex).timing % this.timeSignature.top == 0;
		const beatLength = this.notes[earlierIndex].relativeLength(this.timeSignature.bottom) + (crossesBarline ? 1 : 0);
		const pixelOffset = endElement.position().left - startElement.position().left;

		return {beatLength: beatLength, pixelOffset: pixelOffset, crossesBarline: crossesBarline};
	}

	/**
	 * Positions a staff element relative to a note
	 */
	private position(args: StaffElementPositionArguments) {
		assert(args.noteIndex >= 0);
		assert(args.noteIndex < this.notes.length);

		const noteElement = $("#" + this.idForNoteIndex(args.noteIndex));

		let horizontalOffset: number;
		if (args.beatOffset < 0) {
			if (args.noteIndex == 0) {
				horizontalOffset = 0;
			} else {
				const metrics = this.metricsForIndices(args.noteIndex, args.noteIndex - 1);
				const timingDescription = TimingDescription.of(this.noteEvents.index(args.noteIndex).timing + args.beatOffset, this.timeSignature);
				const isOnBeat1 = timingDescription.count.rawValue === "beat" && timingDescription.beat === 0;
				const fraction = (args.beatOffset - (metrics.crossesBarline && !isOnBeat1 ? 1 : 0)) / metrics.beatLength;
				horizontalOffset = fraction * -metrics.pixelOffset;
			}
		} else {
			const metrics = this.metricsForIndices(args.noteIndex, args.noteIndex + 1);
			horizontalOffset = (args.beatOffset / metrics.beatLength) * metrics.pixelOffset;
		}

		horizontalOffset += vw(0.7);
		if (args.centerElement) {
			horizontalOffset -= args.element.width()!/2;
		}

		let verticalOffset = args.verticalOffset;
		if (args.belowNote) {
			verticalOffset += noteElement.height()! + vw(2);
		}

		const goshDarnIE = isInternetExplorer() ? noteElement.parent().scrollLeft()! : 0;

		args.element.offset({
			left: noteElement.position().left + noteElement.parent().position().left + goshDarnIE + horizontalOffset,
			top: noteElement.parent().position().top + verticalOffset
		});
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
		
		const offset = (noteOrRest == "note") ? em(0.3, noteElement[0]) : 0; //undo span-shifting hack from .note CSS

		noteElement.tooltip({
			content: tooltipContent,
			position: { my: "center top", at: `center bottom-${offset}`, collision: "fit" }
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
			const extraClapElement = $(`<div class="extraClap ${extraClapClass}" title="">Extra clap<br/>❗️</div>`);
			noteElement.parent().append(extraClapElement);
			this.position({
				element: extraClapElement,
				noteIndex: noteIndex,
				beatOffset: extraClap,
				verticalOffset: 0,
				centerElement: true,
				belowNote: false
			});
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
		const length = noteIndex == this.notes.length-1 ? this.beatEvents.last.timing - noteEvent.timing : this.noteEvents.index(noteIndex+1).timing - noteEvent.timing;

		const shouldShowNoteCount = !(note instanceof Rest) || noteEvent.timing === Math.floor(noteEvent.timing);
		const visibleCountings = (shouldShowNoteCount ? [0] : []).concat(noteEvent.offsetsToBeatsForLength(length));
		for (let relativeCounting of visibleCountings) {
			const absoluteCounting = noteEvent.timing + relativeCounting;

			let noteAccuracy = 1;
			let beatAccuracy = 1;
			let tooltipContent: string;
			if (absoluteCounting === Math.floor(absoluteCounting)) {
				const beatEvent = this.beatEvents.index(absoluteCounting);
				beatAccuracy = beatEvent.accuracy(tempo);

				if (!beatEvent.graded) { return; }

				//Render extra taps
				for (let extraTap of beatEvent.extraPerformanceAttempts) {
					const extraTapElement = $(`<div class="extraTap ${extraTapClass}" title="">❗️<br/>Extra tap</div>`);
					noteElement.parent().append(extraTapElement);
					this.position({
						element: extraTapElement,
						noteIndex: noteIndex,
						beatOffset: extraTap + beatEvent.timing - noteEvent.timing,
						verticalOffset: vw(3),
						centerElement: true,
						belowNote: true
					});
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

			this.position({
				element: countingElement,
				noteIndex: noteIndex,
				beatOffset: relativeCounting,
				verticalOffset: vw(1),
				centerElement: true,
				belowNote: true
			});
			
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

	static readonly barlineCharacter = "&nbsp;\ue030&nbsp;&nbsp;";
	static readonly finalBarlineCharacter = "&nbsp;\ue032";
}

/**
 * Data the Player class uses to track in-progress playback of a piece.
 */
interface Playback {
	startTime: number;
	nextNote: number;
	nextBeat: number;
	timerID: number;
	lastClap: number;
}

/**
 * A music player which can play back a piece of music at a given tempo, and accept & grade performed claps.
 */
class Player {
	private _piece: Piece;
	get piece() { return this._piece; }
	set piece(newValue: Piece) {
		if (this.isPlaying) {
			this.stop();
		}
		this._piece = newValue;
		this.backingLoop = Sound.backingLoop(newValue.timeSignature, this.tempo, newValue.backingLoopIndex);
	}

	private _tempo: Tempo;
	get tempo() { return this._tempo; }
	set tempo(newValue: Tempo) {
		if (this.isPlaying) {
			this.stop();
		}
		this._tempo = newValue;
		this.backingLoop = Sound.backingLoop(this.piece.timeSignature, newValue, this.piece.backingLoopIndex);
	}

	private backingLoop: Sound;

	/** Called when the player starts playback. */
	onPlay = function() {};

	/** Called when the player ceases playback, either by pausing early or by finishing the piece. */
	onStop = function() {};

	/** Called when the player successfully finishes the piece. */
	onComplete = function() {};

	private playback?: Playback;

	private audioDelay = 0;
	private static inputLatency = 30;

	get timingCorrection() {
		return Player.inputLatency - this.audioDelay;
	}

	constructor(piece: Piece, tempo: Tempo) {
		this._piece = piece;
		this._tempo = tempo;
		this.backingLoop = Sound.backingLoop(piece.timeSignature, tempo, piece.backingLoopIndex);
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
			nextBeat: 0,
			timerID: NaN, //will replace momentarily
			lastClap: -Infinity
		};

		this.playNote();
		this.onPlay();
	}

	private startBackingLoop() {
		if (!this.isPlaying) { return; }
		if (this.playback === undefined) { assertionFailure(); }
		if (!Sound.usingWebAudio) { return; }

		const self = this;
		this.backingLoop?.play(function() {
			if (!self.isPlaying) { return; }
			if (self.playback === undefined) { assertionFailure(); }
			self.audioDelay = (self.backingLoop.seek * 1000) - (Date.now() - self.playback.startTime);
			console.log(`Calculated audio delay: ${self.audioDelay}ms`);
		});
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
		this.playerElement.stop(true);
		this.piece.showTooltips(true);
		this.onStop();
	}

	/**
	 * Scrolls the player back to the start. You may only rewind while the player is stopped.
	 */
	rewind() {
		assert(!this.isPlaying);

		this.playerElement.animate({ scrollLeft: 0 }, 1000);
	}

	/** The jQuery element on the page this player is controlling */
	get playerElement() {
		return $("#" + this.piece.idForNoteIndex(0)).parent();
	}

	gradeClap() {
		if (this.isCountingOff || !this.isPlaying) { return; }
		if (this.playback === undefined) { assertionFailure(); }

		const clapTime = (Date.now() - this.timingCorrection - this.playback.startTime);
		const debounceTime = 100;
		if (clapTime - this.playback.lastClap <= debounceTime) { return; }
		this.playback.lastClap = clapTime;

		const affectedIndices = this.piece.noteEvents.gradePerformanceAttempt(clapTime / Player.beatLength(this.tempo));
		for (let i of affectedIndices) {
			if (i == this.piece.notes.length) { continue; }
			this.piece.updateAppearanceOfNoteAtIndex(i, this.tempo);
		}
	}

	gradeTap() {
		if (this.isCountingOff || !this.isPlaying) { return; }
		if (this.playback === undefined) { assertionFailure(); }

		const tapTime = (Date.now() - this.timingCorrection - this.playback.startTime) / Player.beatLength(this.tempo);
		const affectedIndices = this.piece.beatEvents.gradePerformanceAttempt(tapTime);
		for (let i of affectedIndices) {
			const noteIndex = this.piece.noteEvents.lastIndexBefore(this.piece.beatEvents.index(i).timing);
			this.piece.updateAppearanceOfNoteAtIndex(noteIndex, this.tempo);
		}
	}

	/** Schedules playback of the next beat or note after the giving timing. Returns the time of the next note, even if it comes after the beat. */
	private scheduleNextPlay(beat: boolean) {
		if (this.playback === undefined) { assertionFailure(); }

		let nextNoteTime: number;
		let nextBeatTime: number | undefined = undefined;
		if (this.isCountingOff) {
			const countoffIndex = this.playback.nextNote + this.piece.timeSignature.countoff.notes.length;
			const remainingCountoff = this.piece.timeSignature.countoff.notes.slice(countoffIndex);
			const remainingTime = this.piece.timeSignature.milliseconds(remainingCountoff, this.tempo);
			nextNoteTime = this.playback.startTime - remainingTime;
		} else {
			const isAtEnd = this.playback.nextNote == this.piece.notes.length;
			const nextNoteTiming = isAtEnd ? this.piece.end : this.piece.noteEvents.index(this.playback.nextNote).timing;
			nextNoteTime = this.playback.startTime + (nextNoteTiming * Player.beatLength(this.tempo));

			if (this.playback.nextNote > 0) {
				const currentTiming = beat ? this.playback.nextBeat-1 : this.piece.noteEvents.index(this.playback.nextNote-1).timing;
				const nextBeat = Math.ceil(currentTiming+0.01);
				if (nextNoteTiming > nextBeat) { nextBeatTime = this.playback.startTime + (nextBeat * Player.beatLength(this.tempo)); }
			}
		}

		var self = this;
		if (nextBeatTime !== undefined) {
			this.playback.timerID = window.setTimeout(function() { self.playBeat(); }, nextBeatTime - Date.now());
		} else {
			this.playback.timerID = window.setTimeout(function() { self.playNote(); }, nextNoteTime - Date.now());
		}

		return nextNoteTime;
	}

	private playBeat() {
		if (this.piece === undefined) { return; }
		if (this.playback === undefined) { return; }
		if (!this.isPlaying) { return; }

		this.handleBeat();
		
		this.scheduleNextPlay(true);
	}

	private handleBeat() {
		if (this.piece === undefined) { return; }
		if (this.playback === undefined) { return; }
		if (!this.isPlaying) { return; }
		
		if (!Sound.usingWebAudio) {
			Sound.beat.play();
		}

		this.piece.beatEvents.enableGradingThrough(this.playback.nextBeat);
		if (this.playback.nextNote > 0 && this.playback.nextNote <= this.piece.notes.length) {
			this.piece.updateAppearanceOfNoteAtIndex(this.playback.nextNote - 1, this.tempo);
		}

		this.playback.nextBeat += 1;
	}

	private playNote() {
		if (this.piece === undefined) { return; }
		if (this.playback === undefined) { return; }

		if (this.playback.nextNote >= this.piece.notes.length) {
			this.piece.beatEvents.enableGradingThrough(this.piece.end);
			this.piece.updateAppearanceOfNoteAtIndex(this.piece.notes.length - 1, this.tempo);
			this.stop();
			this.onComplete();
		}
		if (!this.isPlaying) { return; }
		
		if (this.playback.nextNote === 0) {
			this.startBackingLoop();
		}
		
		const currentNote = this.isCountingOff ? this.piece.timeSignature.countoff.notes[this.playback.nextNote + this.piece.timeSignature.countoff.notes.length] : this.piece.notes[this.playback.nextNote];
		currentNote.sound?.play();
		
		let noteElement = undefined;
		if (!this.isCountingOff) {
			const timing = this.piece.noteEvents.index(this.playback.nextNote).timing;
			if (timing >= this.playback.nextBeat) { this.handleBeat(); }

			noteElement = $("#" + this.piece.idForNoteIndex(this.playback.nextNote));
			this.piece.noteEvents.index(this.playback.nextNote).graded = true;
			if (this.playback.nextNote > 0) {
				this.piece.updateAppearanceOfNoteAtIndex(this.playback.nextNote - 1, this.tempo);
			}
			this.piece.updateAppearanceOfNoteAtIndex(this.playback.nextNote, this.tempo);
		}
		
		this.playback.nextNote += 1;
		
		const nextNoteTime = this.scheduleNextPlay(false);

		if (noteElement && this.playback.nextNote > 0 && this.playback.nextNote < this.piece.notes.length) {
			const nextNoteElement = $("#" + this.piece.idForNoteIndex(this.playback.nextNote));
			const scrollMargin = vw(20);
			let newScrollPosition;
			if (nextNoteElement === undefined) {
				newScrollPosition = noteElement[0].offsetLeft;
			} else {
				newScrollPosition = nextNoteElement[0].offsetLeft;
			}
			noteElement.parent().animate({ scrollLeft: newScrollPosition - scrollMargin }, nextNoteTime - Date.now(), "linear");
		}
	}

	static beatLength(tempo: Tempo) {
		assert(tempo > 0);
		return 1000 * 60/tempo;
	};
}