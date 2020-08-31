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
	timing?: number;
	ungraded = true;
	private clapAttempts: Array<number>;

	constructor(type: NoteType, dots: 0 | 1 | 2 = 0, customPrefix = "", customSuffix = "", sound = "metronome", clapAttempts: Array<number> = []) {
		assert(dots >= 0 && dots <= 2);
		
		this.type = type;
		this.dots = dots;
		this.customPrefix = customPrefix;
		this.customSuffix = customSuffix;
		this.sound = sound;
		this.clapAttempts = clapAttempts;
	}

	copy() {
		return new Note(this.type, this.dots, this.customPrefix, this.customSuffix, this.sound, this.clapAttempts);
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

	milliseconds(timeSignature: TimeSignature, tempo: number) {
		return this.relativeLength(timeSignature.bottom) * Player.beatLength(tempo);
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

	get bestClapTiming() {
		if (this.clapAttempts.length == 0) { return null; }
		return this.clapAttempts[0];
	}
	
	get extraClaps() {
		if (this.clapAttempts.length == 0) { return []; }
		return this.clapAttempts.slice(1);
	}

	addClap(offset: number) {
		const clapTimingSort = function(a: number, b: number) {
			if (Math.abs(a) < Math.abs(b)) { return -1; }
			else if (Math.abs(a) > Math.abs(b)) { return 1; }
			else { return 0; }
		}

		this.clapAttempts.push(offset);
		this.clapAttempts.sort(clapTimingSort);
	}

	removeEarliestClap() {
		if (this.clapAttempts.length == 0) { return null; }

		let indexOfEarliestClap = 0;
		for (let i = 1; i < this.clapAttempts.length; i++) {
			if (this.clapAttempts[i] < this.clapAttempts[indexOfEarliestClap]) {
				indexOfEarliestClap = i;
			}
		}

		const result = this.clapAttempts[indexOfEarliestClap];
		this.clapAttempts.splice(indexOfEarliestClap, 1);
		return result;
	}

	removeAllClaps() {
		this.clapAttempts = [];
	}

	static readonly dotCharacter = ".";
	static readonly timingThreshold = 200; //in milliseconds, so we have higher standards at slower tempos

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

/**
 * A description of a given timing
 */
class TimingDescription {
	readonly count: Count;
	readonly beat: number;
	readonly precision: TimingPrecision;

	constructor(count: Count, beat: number, precision: TimingPrecision) {
		assert(beat >= 0);
		this.count = count;
		this.beat = beat;
		this.precision = precision;
	}

	static of(timing: number, timeSignature: TimeSignature, counts: Array<Count>, tempo = 90) {
		assert(timing >= 0);
		assert(timing < timeSignature.top, "Timing: " + timing);
		assert(tempo > 0);

		let beat = Math.floor(timing);
		const fractionalTiming = timing - beat;

		let closestCount = Count.beat;
		for (let count of counts) {
			if (Math.abs(count.timing - fractionalTiming) < Math.abs(closestCount.timing - fractionalTiming)) {
				closestCount = count;
			}
		}
		if (Math.abs(1 - fractionalTiming) < Math.abs(closestCount.timing - fractionalTiming)) {
			closestCount = Count.beat;
			beat = (beat + 1) % timeSignature.top;
		}

		if (closestCount.isEqual(Count.and) && timeSignature.isCompound) {
			closestCount = Count.ti;
		} else if (closestCount.isEqual(Count.ti) && !timeSignature.isCompound) {
			closestCount = Count.and;
		}

		let offset = (closestCount.timing - fractionalTiming) * Player.beatLength(tempo);
		let precision: TimingPrecision = "on";
		if (offset > Note.timingThreshold) {
			precision = "a little after";
		} else if (offset < -Note.timingThreshold) {
			precision = "a little before";
		}

		return new TimingDescription(closestCount, beat, precision);
	}

	get shortBeatDescription() {
		return this.beat + 1;
	}

	get longBeatDescription() {
		return "beat " + this.shortBeatDescription;
	}

	description(verbose: boolean) {
		let result: string;
		if (this.count.isEqual(Count.beat)) {
			result = `<strong>${this.longBeatDescription}</strong>`;
		} else if (verbose) {
			result = `the <strong>${this.count.toString()}</strong> of ${this.shortBeatDescription} <em>(${this.count.timingString} ${this.longBeatDescription})</em>`;
		} else {
			result = `<strong>${this.count.toString()}</strong> <em>(${this.count.timingString} ${this.longBeatDescription})</em>`;
		}
		return this.precision + " " + result;
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

	offsetTiming(timing: number, offset: number) {
		let result = timing + offset;
		if (result < 0) {
			result = this.top + result;
		} else if (result >= this.top) {
			result -= this.top;
		}
		return result;
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

	/** A unique ID for this piece, usable to look up generated notation as HTML elements. */
	pieceID?: string;

	constructor(timeSignature: TimeSignature, notes: Array<Note> = []) {
		this.timeSignature = timeSignature;
		this.notes = notes.map(x => x.copy());
		
		let timing = 0;
		for (let note of this.notes) {
			note.timing = timing;
			timing += note.relativeLength(timeSignature.bottom);
			timing = timing % timeSignature.top;
		}
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
		for (let i = 0; i < this.notes.length; i++) {
			this.notes[i].removeAllClaps();
			this.notes[i].ungraded = true;
			this.updateClapsForNoteAtIndex(i);
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
			} else {
				return 0;
			}
		}
	}

	updateClapsForNoteAtIndex(noteIndex: number, tempo = 90) {
		assert(tempo > 0);
		assert(noteIndex >= 0);
		assert(noteIndex < this.notes.length);

		const note = this.notes[noteIndex];
		if (note.timing === undefined) { assertionFailure(); }

		const noteElement = $("#" + this.idForNoteIndex(noteIndex));

		const extraClapClass = this.idForNoteIndex(noteIndex) + "-extraClap";
		noteElement.parent().children("." + extraClapClass).remove();
		
		let tooltipContent = `<div>This note is ${TimingDescription.of(note.timing, this.timeSignature, Count.all, tempo).description(true)}</div>`;
		
		if (note.bestClapTiming === null) {
			if (note.ungraded) {
				noteElement.css("color","black");
			} else {
				noteElement.css("color","hsl(0,80%,40%)");
				tooltipContent += `<div style="color: hsl(0,80%,40%)">You didn't clap near it.</div>`;
			}
		} else {
			const correctness = Math.max(1 - (Math.abs(note.bestClapTiming * Player.beatLength(tempo)) / Note.timingThreshold), 0);
			
			const hue = correctness * 125; //125°==green, 0°==red
			noteElement.css("color", `hsl(${hue},80%,40%)`);
			
			if (note.extraClaps.length > 0) {
				for (let extraClap of note.extraClaps) {
					const position = this.positionOffsetFromNoteIndex(extraClap, noteIndex);
					const extraClapElement = $(`<div class="extraClap ${extraClapClass}" title="">Extra clap<br/>❗️</div>`);
					noteElement.parent().append(extraClapElement);
					extraClapElement.position({
						my: "center top",
						at: `center+${position} top`,
						of: noteElement,
						collision: "fit",
						within: noteElement.parent()
					})
					extraClapElement.tooltip({
						content: `<div style="color: hsl(0,80%,40%)">You added a clap ${TimingDescription.of(this.timeSignature.offsetTiming(note.timing, extraClap), this.timeSignature, Count.all, tempo).description(true)}</div>`
					});
				}
			}
			
			tooltipContent += `<div style="color: hsl(${hue},80%,40%)">You clapped ${TimingDescription.of(this.timeSignature.offsetTiming(note.timing, note.bestClapTiming), this.timeSignature, Count.all, tempo).description(true)}</div>`;
		}
		
		noteElement.tooltip({
			content: tooltipContent,
			position: { my: "center top", at: "center bottom-30", collision: "fit" }
		});
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
	nextNoteTime: number;
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
	/**
	 * Called when the player finishes playback.
	 */
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
		
		const now = Date.now();
		this.playback = { startTime: now, nextNoteTime: now, nextNote: countOff ? 0 - this.piece.timeSignature.countoff.notes.length : 0 };
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
		if (this.piece === undefined) { return; }
		if (this.playback === undefined) { return; }

		const clapTime = Date.now();
		
		const offsetToNextNote = this.playback.nextNote == this.piece.notes.length ? Infinity : clapTime - this.playback.nextNoteTime;
		const offsetToPreviousNote = this.playback.nextNote == 0 ? Infinity : clapTime - (this.playback.nextNoteTime - this.piece.notes[this.playback.nextNote-1].milliseconds(this.piece.timeSignature, this.tempo));
		
		let closestNote, offset;
		if (Math.abs(offsetToNextNote) < Math.abs(offsetToPreviousNote)) {
			closestNote = this.playback.nextNote;
			offset = offsetToNextNote;
		} else {
			closestNote = this.playback.nextNote - 1;
			offset = offsetToPreviousNote;
		}
		
		if (closestNote > 0) {
			const previousNoteHasNoClap = this.piece.notes[closestNote - 1].bestClapTiming === null;
			const thisNoteAlreadyHasClap = this.piece.notes[closestNote].bestClapTiming !== null;
			if (previousNoteHasNoClap && thisNoteAlreadyHasClap) {
				this.piece.notes[closestNote - 1].addClap(this.piece.notes[closestNote].removeEarliestClap() as number);
				this.piece.updateClapsForNoteAtIndex(closestNote - 1, this.tempo);
			}
		}
		this.piece.notes[closestNote].addClap(offset / Player.beatLength(this.tempo));
		this.piece.updateClapsForNoteAtIndex(closestNote, this.tempo);
	}

	private playNote() {
		if (this.piece === undefined) { return; }
		if (this.playback === undefined) { return; }

		if (this.playback.nextNote >= this.piece.notes.length) { this.stop(); }
		if (!this.isPlaying) { return; }
		
		const currentNote = this.isCountingOff ? this.piece.timeSignature.countoff.notes[this.playback.nextNote + this.piece.timeSignature.countoff.notes.length] : this.piece.notes[this.playback.nextNote];
		
		//@ts-ignore
		ion.sound.play(currentNote.sound);
		
		let noteElement = null;
		if (!this.isCountingOff) {
			noteElement = $("#" + this.piece.idForNoteIndex(this.playback.nextNote));
			currentNote.ungraded = false;
			this.piece.updateClapsForNoteAtIndex(this.playback.nextNote, this.tempo);
		}
		
		this.playback.nextNoteTime += currentNote.milliseconds(this.piece.timeSignature, this.tempo);
		this.playback.nextNote += 1;
		
		if (noteElement && this.playback.nextNote > 0 && this.playback.nextNote < this.piece.notes.length) {
			const nextNoteElement = $("#" + this.piece.idForNoteIndex(this.playback.nextNote));
			const scrollMargin = 80;
			let newScrollPosition;
			if (nextNoteElement === null) {
				newScrollPosition = noteElement[0].offsetLeft;
			} else {
				newScrollPosition = nextNoteElement[0].offsetLeft;
			}
			noteElement.parent().animate({ scrollLeft: newScrollPosition - scrollMargin }, this.playback.nextNoteTime - Date.now());
		}
		
		var self = this;
		window.setTimeout(function() { self.playNote(); }, this.playback.nextNoteTime - Date.now());
	}

	static beatLength(tempo: number) {
		assert(tempo > 0);
		return 1000 * 60/tempo;
	};
}