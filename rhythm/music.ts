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

/**
 * An event (like a note or beat), whose timing is specified in absolute beats from the start of a piece
 */
class MusicEvent {
	/** The absolute time (in beats) of the event, since the start of a piece */
	timing: number;

	/** Whether or not this event's performance attempts should be graded */
	graded: boolean;

	/** A sorted list of offsets of attempts to match this event's timing */
	private performanceAttempts: Array<number>;
	
	constructor(timing: number, graded = false, performanceAttempts = []) {
		this.timing = timing;
		this.graded = graded;
		this.performanceAttempts = performanceAttempts;
	}

	/** The offset of the best attempt to match this event's timing, or `null` if none exists */
	get bestPerformanceAttempt() {
		if (this.performanceAttempts.length == 0) { return null; }
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

	/** Remove (and return) the earliest performance attempt from the list, or return `null` if there are no attempts */
	removeEarliestPerformanceAttempt() {
		if (this.performanceAttempts.length == 0) { return null; }

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

	correctness(tempo: number) {
		assert(tempo > 0);
		if (this.bestPerformanceAttempt === null) { return 0; }
		return Math.max(1 - (Math.abs(this.bestPerformanceAttempt * Player.beatLength(tempo)) / MusicEvent.timingThreshold), 0);
	}

	/** Returns the offsets to all whole-numbered beats that occur before `length` is over, as well as the start of this event itself (always `0`) */
	offsetsToBeatsForLength(length: number) {
		assert(length > 0);
		
		let result = [0];
		for (let i = Math.ceil(this.timing); i < this.timing + length; i++) {
			result.push(i - this.timing);
		}
		return result;
	}

	static readonly timingThreshold = 200; //ms
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
			const previousNoteHasNoAttempt = this.value[closestIndex - 1].bestPerformanceAttempt === null;
			const thisNoteAlreadyHasAttempt = this.value[closestIndex].bestPerformanceAttempt !== null;
			if (previousNoteHasNoAttempt && thisNoteAlreadyHasAttempt) {
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

	enableGradingBefore(time: number) {
		for (let event of this.value) {
			if (event.timing >= time) { return; }
			event.graded = true;
		}
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
}

/**
 * A single note within a larger piece; consists primarily of a type (quarter, eighth, etc.) and a number of dots (0, 1, or 2).
 */
class Note {
	readonly type: NoteType;
	readonly dots: 0 | 1 | 2;
	customPrefix: string;
	customSuffix: string;
	sound: string;

	constructor(type: NoteType, dots: 0 | 1 | 2 = 0, customPrefix = "", customSuffix = "", sound = "metronome") {
		assert(dots >= 0 && dots <= 2);
		
		this.type = type;
		this.dots = dots;
		this.customPrefix = customPrefix;
		this.customSuffix = customSuffix;
		this.sound = sound;
	}

	copy() {
		return new Note(this.type, this.dots, this.customPrefix, this.customSuffix, this.sound);
	}

	static get whole() { return new Note(new NoteType(1)); }
	static get half() { return new Note(new NoteType(2)); }
	static get quarter() { return new Note(new NoteType(4)); }
	static get eighth() { return new Note(new NoteType(8)); }
	static get sixteenth() { return new Note(new NoteType(16)); }

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
		assert(beamsIn == 0 || beamsIn == 1 || beamsIn == 2);
		assert(beamsOut == 0 || beamsOut == 1 || beamsOut == 2);

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
		return new Note(this.type, 0, this.customPrefix, this.customSuffix, this.sound);
	}

	get dotted() {
		assert(this.dots < 2);
		return new Note(this.type, this.dots + 1 as (1 | 2), this.customPrefix, this.customSuffix, this.sound);
	}

	get doubled() {
		const resultType = this.type.rawValue / 2;
		assert(resultType >= 1);
		return new Note(new NoteType(resultType as NoteTypeName), this.dots, this.customPrefix, this.customSuffix, this.sound);
	}

	get halved() {
		const resultType = this.type.rawValue * 2;
		assert(resultType <= 16);
		return new Note(new NoteType(resultType as NoteTypeName), this.dots, this.customPrefix, this.customSuffix, this.sound);
	}

	get normalized() {
		return new Note(this.type, this.dots);
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
	static of(timing: number, timeSignature: TimeSignature, counts: Array<Count>, tempo = 90) {
		assert(tempo > 0);

		let beat = Math.floor(timing);
		let fractionalTiming = timing - beat;

		let closestCount = Count.beat;
		for (let count of counts) {
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
		if (offset > MusicEvent.timingThreshold) {
			precision = "a little after";
		} else if (offset < -MusicEvent.timingThreshold) {
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
}

type TimeSignatureTop = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 12;

/**
 * An Orff time signature, consisting of a number of beats per measure (top) and a type of note that receives 1 beat (bottom).
 */
class TimeSignature {
	readonly top: TimeSignatureTop;
	readonly bottom: Note;

	constructor(top: TimeSignatureTop, bottom: Note) {
		assert(Math.floor(top) === top && top > 0);
		assert(bottom.dots <= 1);
		
		this.top = top;
		this.bottom = bottom;
	}

	static get twoFour() { return new TimeSignature(3, Note.quarter); }
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
		while (result.length < 2) {
			for (var i = 0; i < (this.top <= 2 ? this.top : this.top - 2); i++) {
				let count = this.bottom.normalized;
				count.sound = (i+1).toString();
				result.push(count);
			}
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
		
		rea.sound = "rea-";
		dy.sound = "-dy";
		go.sound = "go";
		result.push(rea);
		result.push(dy);
		result.push(go);
		
		return new Piece(this, result);
	}

	milliseconds(notes: Array<Note>, tempo: number) {
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
	readonly notes: Array<Note>;

	constructor(notes: Array<Note>) {
		assert(notes.length > 0);
		this.notes = notes;
	}

	lengthIn(timeSignature: TimeSignature) {
		return this.notes.reduce((a,b) => a + b.relativeLength(timeSignature.bottom), 0);
	}

	static lengthOf(blocks: Array<Block>, timeSignature: TimeSignature) {
		return blocks.reduce((a,b) => a + b.lengthIn(timeSignature), 0);
	}

	fitsAfter(blocks: Array<Block>, timeSignature: TimeSignature) {
		return Block.lengthOf(blocks, timeSignature) + this.lengthIn(timeSignature) <= timeSignature.top;
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

	static allPossibleMeasuresFrom(possibilities: Array<Block>, timeSignature: TimeSignature) {
		let result: Array<Array<Block>> = possibilities.map(x => [x]);
		while (result.filter(x => Block.lengthOf(x, timeSignature) < timeSignature.top).length > 0) {
			result = result.map(x => Block.allPossibleNextStepsFor(x, timeSignature, possibilities)).reduce((a,b) => a.concat(b), []);
		}
		return result.map(x => x.reduce((a,b) => a.concat(b.notes), [] as Array<Note>));
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

	/** A unique ID for this piece, usable to look up generated notation as HTML elements. */
	pieceID?: string;

	constructor(timeSignature: TimeSignature, notes: Array<Note> = []) {
		this.timeSignature = timeSignature;
		this.notes = notes.map(x => x.copy());
		
		let noteEvents: Array<MusicEvent> = [new MusicEvent(0)];
		let timing = 0;
		for (let note of this.notes) {
			timing += note.relativeLength(timeSignature.bottom);
			noteEvents.push(new MusicEvent(timing));
		}
		this.noteEvents = new EventList(noteEvents);

		let beatEvents: Array<MusicEvent> = [];
		for (let beat = 0; beat <= timing; beat++) {
			beatEvents.push(new MusicEvent(beat));
		}
		this.beatEvents = new EventList(beatEvents);
	}

	static randomWithBlocks(blocks: Array<Block>, timeSignature: TimeSignature, measures: number) {
		assert(measures > 0);
		const possibleMeasures = Block.allPossibleMeasuresFrom(blocks, timeSignature);

		let result: Array<Note> = [];
		for (let i = 0; i < measures; i++) {
			result = result.concat(possibleMeasures[Math.floor(Math.random() * possibleMeasures.length)]);
		}

		return new Piece(timeSignature, result);
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

	removeGrading() {
		this.noteEvents.removeGrading();
		this.beatEvents.removeGrading();
		for (let i = 0; i < this.notes.length; i++) {
			this.updateAppearanceOfNoteAtIndex(i);
		}
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
			const nextBeams = (willCrossBeat || i == this.notes.length-1) ? 0 : this.notes[i+1].type.beams;
			
			let beamsIn: NoteTypeBeams;
			let beamsOut: NoteTypeBeams;

			if (note.type.beams == 0) {
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

	/**
	 * Converts a beat offset from a note into a pixel offset from a note HTML element
	 * @param offset The beat offset to convert
	 * @param noteIndex The index of the note to offset from
	 */
	positionOffsetFromNoteIndex(offset: number, noteIndex: number) {
		assert(noteIndex >= 0);
		assert(noteIndex < this.notes.length);

		const noteElement = $("#" + this.idForNoteIndex(noteIndex));
		const noteXPosition = noteElement.position().left;

		if (offset < 0) {
			if (noteIndex > 0) {
				const previousIndex = noteIndex - 1;
				const previousElement = $("#" + this.idForNoteIndex(previousIndex));
				const totalLength = this.notes[previousIndex].relativeLength(this.timeSignature.bottom);
				const positionXDistance = noteXPosition - previousElement.position().left;
				const fraction = offset / totalLength;
				return fraction * positionXDistance;
			} else {
				return 0;
			}
		} else {
			if (noteIndex < this.notes.length - 1) {
				const nextIndex = noteIndex + 1;
				const nextElement = $("#" + this.idForNoteIndex(nextIndex));
				const totalLength = this.notes[noteIndex].relativeLength(this.timeSignature.bottom);
				const positionXDistance = nextElement.position().left - noteXPosition;
				const fraction = offset / totalLength;
				return fraction * positionXDistance;
			} else if (noteIndex > 0) {
				//estimate using previous note as a guide
				const previousIndex = noteIndex - 1;
				const previousElement = $("#" + this.idForNoteIndex(previousIndex));
				const totalLength = this.notes[noteIndex].relativeLength(this.timeSignature.bottom);
				const positionXDistance = noteXPosition - previousElement.position().left;
				const fraction = offset / totalLength;
				return fraction * positionXDistance;
			} else {
				//give up
				return 0;
			}
		}
	}

	private static hueForCorrectness(correctness: number) {
		return correctness * 125; //125°==green, 0°==red
	}

	updateAppearanceOfNoteAtIndex(noteIndex: number, tempo = 90) {
		assert(tempo > 0);
		assert(noteIndex >= 0);
		assert(noteIndex < this.notes.length);

		const event = this.noteEvents.index(noteIndex);

		const noteElement = $("#" + this.idForNoteIndex(noteIndex));
		
		let tooltipContent = `<div>This note is ${TimingDescription.of(event.timing, this.timeSignature, Count.all, tempo).description(Verbosity.long)}</div>`;
		
		if (!event.graded) {
			noteElement.css("color","black");
		} else {
			const hue = Piece.hueForCorrectness(event.correctness(tempo));

			if (event.bestPerformanceAttempt === null) {
				tooltipContent += `<div style="color: hsl(0,80%,40%)">You didn't clap near it</div>`;
			} else {
				tooltipContent += `<div style="color: hsl(${hue},80%,40%)">You clapped ${TimingDescription.of(event.timing + event.bestPerformanceAttempt, this.timeSignature, Count.all, tempo).description(Verbosity.long)}</div>`;
			}

			noteElement.css("color", `hsl(${hue},80%,40%)`);
		}

		if (event.timing === Math.floor(event.timing)) {
			let beatEvent = this.beatEvents.index(event.timing);
			if (beatEvent.graded) {
				const hue = Piece.hueForCorrectness(beatEvent.correctness(tempo));
				if (beatEvent.bestPerformanceAttempt === null) {
					tooltipContent += `<div style="color: hsl(${hue},80%,40%)">You didn't tap ${TimingDescription.of(beatEvent.timing, this.timeSignature, Count.all, tempo).description(Verbosity.medium)}</div>`;
				} else {
					tooltipContent += `<div style="color: hsl(${hue},80%,40%)">You tapped ${TimingDescription.of(beatEvent.timing + beatEvent.bestPerformanceAttempt, this.timeSignature, Count.all, tempo).description(Verbosity.medium)}</div>`;
				}
			}
		}
		
		noteElement.tooltip({
			content: tooltipContent,
			position: { my: "center top", at: "center bottom-30", collision: "fit" }
		});

		this.updateExtraClapsOfNoteAtIndex(noteIndex, tempo);
		this.updateCountingsOfNoteAtIndex(noteIndex, tempo); //must be called after setting `noteElement.tooltip`
	}

	private updateExtraClapsOfNoteAtIndex(noteIndex: number, tempo: number) {
		assert(tempo > 0);
		assert(noteIndex >= 0);
		assert(noteIndex < this.notes.length);
		
		const event = this.noteEvents.index(noteIndex);
		if (event === undefined) { assertionFailure(); }
		const noteElement = $("#" + this.idForNoteIndex(noteIndex));

		const extraClapClass = this.idForNoteIndex(noteIndex) + "-extraClap";
		noteElement.parent().children("." + extraClapClass).remove();

		if (!event.graded || event.extraPerformanceAttempts.length == 0) { return; }

		for (let extraClap of event.extraPerformanceAttempts) {
			const position = this.positionOffsetFromNoteIndex(extraClap, noteIndex);
			const extraClapElement = $(`<div class="extraClap ${extraClapClass}" title="">Extra clap<br/>❗️</div>`);
			noteElement.parent().append(extraClapElement);
			extraClapElement.position({
				my: "center top",
				at: `center+${position} top+20`,
				of: noteElement,
				collision: "fit",
				within: noteElement.parent()
			})
			extraClapElement.tooltip({
				content: `<div style="color: hsl(0,80%,40%)">You added a clap ${TimingDescription.of(event.timing + extraClap, this.timeSignature, Count.all, tempo).description(Verbosity.long)}</div>`
			});
		}
	}

	private updateCountingsOfNoteAtIndex(noteIndex: number, tempo: number) {
		assert(tempo > 0);
		assert(noteIndex >= 0);
		assert(noteIndex < this.notes.length);
		
		const note = this.notes[noteIndex];
		const noteEvent = this.noteEvents.index(noteIndex);
		const noteElement = $("#" + this.idForNoteIndex(noteIndex));

		const countingClass = this.idForNoteIndex(noteIndex) + "-counting";
		noteElement.parent().children("." + countingClass).remove();

		if (!noteEvent.graded) { return; }

		for (let relativeCounting of noteEvent.offsetsToBeatsForLength(note.relativeLength(this.timeSignature.bottom))) {
			const absoluteCounting = noteEvent.timing + relativeCounting;
			const position = this.positionOffsetFromNoteIndex(relativeCounting, noteIndex);

			let noteCorrectness = 1;
			let beatCorrectness = 1;
			let tooltipContent: string;
			if (absoluteCounting === Math.floor(absoluteCounting)) {
				const beatEvent = this.beatEvents.index(absoluteCounting);
				beatCorrectness = beatEvent.correctness(tempo);
				if (!beatEvent.graded) { return; }
			}

			if (relativeCounting === 0) {
				noteCorrectness = noteEvent.correctness(tempo);
			}

			const hue = Piece.hueForCorrectness(Math.min(noteCorrectness, beatCorrectness));
			const countingElement = $(`<div style="color: hsl(${hue},80%,40%)" class="counting ${countingClass}" title="">${TimingDescription.of(absoluteCounting, this.timeSignature, Count.all, tempo).description(Verbosity.short)}&nbsp;&nbsp;</div>`);
			noteElement.parent().append(countingElement);
			countingElement.position({
				my: "right bottom",
				at: `center+${position} bottom-40`,
				of: noteElement,
				collision: "fit",
				within: noteElement.parent()
			})

			if (relativeCounting === 0) {
				const noteElement = $("#" + this.idForNoteIndex(noteIndex));
				tooltipContent = noteElement.tooltip("option", "content");
			} else {
				const beatEvent = this.beatEvents.index(absoluteCounting);

				if (beatEvent.bestPerformanceAttempt === null) {
					tooltipContent = `<div style="color: hsl(${hue},80%,40%)">You didn't tap ${TimingDescription.of(beatEvent.timing, this.timeSignature, Count.all, tempo).description(Verbosity.medium)}</div>`;
				} else {
					tooltipContent = `<div style="color: hsl(${hue},80%,40%)">You tapped ${TimingDescription.of(beatEvent.timing + beatEvent.bestPerformanceAttempt, this.timeSignature, Count.all, tempo).description(Verbosity.medium)}</div>`;
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

	tempo: number;
	/** Called when the player finishes playback. */
	callback: () => void;

	private playback?: Playback;

	constructor(piece: Piece, tempo = 90, callback = function() {}) {
		this._piece = piece;
		this.tempo = tempo;
		this.callback = callback;
	}

	get isPlaying() { return this.playback !== undefined; }

	get isCountingOff() {
		if (this.playback === undefined) { return false; }
		return this.isPlaying && this.playback.nextNote < 0;
	}

	play(countOff = true) {
		if (this.isPlaying) { return; }
		if (this.piece === undefined) { return; }

		const playerElement = $("#" + this.piece.idForNoteIndex(0));
		playerElement.parent().scrollLeft(0);
		
		const delayUntilStart = countOff ? this.piece.timeSignature.milliseconds(this.piece.timeSignature.countoff.notes, this.tempo) : 0;
		this.playback = { startTime: Date.now() + delayUntilStart, nextNote: (countOff ? -this.piece.timeSignature.countoff.notes.length : 0) };
		this.piece.showTooltips(false);
		this.playNote();
	}

	/**
	 * Stops playback, re-enabling tooltips on `piece` and calling `callback` if set. If playback has already been stopped, does nothing.
	 */
	stop() {
		if (!this.isPlaying) { return; }
		
		this.playback = undefined;
		this.piece.showTooltips(true);
		this.callback();
	}

	gradeClap() {
		if (this.isCountingOff || !this.isPlaying) { return; }
		if (this.playback === undefined) { assertionFailure(); }

		const clapTime = (Date.now() - this.playback.startTime) / Player.beatLength(this.tempo);

		const affectedIndices = this.piece.noteEvents.gradePerformanceAttempt(clapTime);
		for (let i of affectedIndices) {
			this.piece.updateAppearanceOfNoteAtIndex(i, this.tempo);
		}
	}

	gradeTap() {
		if (this.isCountingOff || !this.isPlaying) { return; }
		if (this.playback === undefined) { assertionFailure(); }

		const tapTime = (Date.now() - this.playback.startTime) / Player.beatLength(this.tempo);
		const affectedIndices = this.piece.beatEvents.gradePerformanceAttempt(tapTime);
		for (let i of affectedIndices) {
			const noteIndex = this.piece.noteEvents.lastIndexBefore(this.piece.beatEvents.index(i).timing);
			console.log(`${noteIndex} before beat ${this.piece.beatEvents.index(i).timing} at index ${i}`);
			this.piece.updateAppearanceOfNoteAtIndex(noteIndex, this.tempo);
		}
	}

	private playNote() {
		if (this.piece === undefined) { return; }
		if (this.playback === undefined) { return; }

		if (this.playback.nextNote >= this.piece.notes.length) {
			this.piece.beatEvents.enableGradingBefore(this.piece.noteEvents.index(this.piece.notes.length).timing);
			this.piece.updateAppearanceOfNoteAtIndex(this.piece.notes.length - 1);
			this.stop();
		}
		if (!this.isPlaying) { return; }
		
		const currentNote = this.isCountingOff ? this.piece.timeSignature.countoff.notes[this.playback.nextNote + this.piece.timeSignature.countoff.notes.length] : this.piece.notes[this.playback.nextNote];
		
		//@ts-ignore
		ion.sound.play(currentNote.sound);
		
		let noteElement = null;
		if (!this.isCountingOff) {
			noteElement = $("#" + this.piece.idForNoteIndex(this.playback.nextNote));
			this.piece.noteEvents.index(this.playback.nextNote).graded = true;
			if (this.playback.nextNote > 0) {
				this.piece.beatEvents.enableGradingBefore(this.piece.noteEvents.index(this.playback.nextNote).timing)
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
		} else {
			nextNoteTime = this.playback.startTime + (this.piece.noteEvents.index(this.playback.nextNote).timing * Player.beatLength(this.tempo));
		}
		
		if (noteElement && this.playback.nextNote > 0 && this.playback.nextNote < this.piece.notes.length) {
			const nextNoteElement = $("#" + this.piece.idForNoteIndex(this.playback.nextNote));
			const scrollMargin = 400;
			let newScrollPosition;
			if (nextNoteElement === null) {
				newScrollPosition = noteElement[0].offsetLeft;
			} else {
				newScrollPosition = nextNoteElement[0].offsetLeft;
			}
			noteElement.parent().animate({ scrollLeft: newScrollPosition - scrollMargin }, nextNoteTime - Date.now());
		}
		
		var self = this;
		window.setTimeout(function() { self.playNote(); }, nextNoteTime - Date.now());
	}

	static beatLength(tempo: number) {
		assert(tempo > 0);
		return 1000 * 60/tempo;
	};
}