"use strict";

function assert(condition, message = "Assertion failed") {
	if (!condition) {
		if (typeof Error !== "undefined") {
			throw new Error(message);
		} else {
			throw message;
		}
	}
}

//Note

Note.dotCharacter = ".";

function Note(type, dots = 0, customPrefix = "", customSuffix = "", sound = "metronome", clapAttempts = []) {
	assert(typeof type === "number");
	assert(type === 1 || type === 2 || type === 4 || type === 8 || type === 16);
	assert(typeof dots === "number");
	assert(dots >= 0 && dots <= 2);
	
	Object.defineProperty(this, "type", {
		value: type,
		writable: false
	});
	
	Object.defineProperty(this, "dots", {
		value: dots,
		writable: false
	});
	
	Object.defineProperty(this, "typeDescription", {
		get() {
			switch (type) {
				case 1: return "whole note";
				case 2: return "half note";
				case 4: return "quarter note";
				case 8: return "eighth note";
				case 16: return "sixteenth note";
				default: assert(false);
			}
		}
	});
	
	Object.defineProperty(this, "dotsDescription", {
		get() {
			switch (dots) {
				case 0: return "";
				case 1: return "dotted ";
				case 2: return "doubly-dotted ";
			}
		}
	});
	
	Object.defineProperty(this, "absoluteLength", {
		get() {
			const result = 1/type;
			switch (dots) {
				case 0: return result;
				case 1: return result * 1.5;
				case 2: return result * 1.75;
				default: assert(false);
			}
		}
	});
	
	Object.defineProperty(this, "customPrefix", {
		value: customPrefix,
		writable: true
	});
	
	Object.defineProperty(this, "customSuffix", {
		value: customSuffix,
		writable: true
	});
	
	Object.defineProperty(this, "sound", {
		value: sound,
		writable: true
	});
	
	Object.defineProperty(this, "beams", {
		get() {
			switch (type) {
				case 1: return 0;
				case 2: return 0;
				case 4: return 0;
				case 8: return 1;
				case 16: return 2;
				default: assert(false);
			}
		}
	});
	
	let clapTimingSort = function(a,b) {
		if (Math.abs(a) < Math.abs(b)) { return -1; }
		else if (Math.abs(a) > Math.abs(b)) { return 1; }
		else { return 0; }
	};
	
	this._clapAttempts = clapAttempts;
	Object.defineProperty(this, "bestClapTiming", {
		get() {
			if (this._clapAttempts.length == 0) { return null; }
			return this._clapAttempts[0];
		}
	});
	Object.defineProperty(this, "extraClaps", {
		get() {
			return this._clapAttempts.slice(1);
		}
	});
	this.addClap = function(offset) {
		this._clapAttempts.push(offset);
		this._clapAttempts.sort(clapTimingSort);
	};
	this.removeEarliestClap = function() {
		if (this._clapAttempts.length == 0) { return null; }
		
		let indexOfEarliestClap = 0;
		for (let i = 1; i < this._clapAttempts.length; i++) {
			if (this._clapAttempts[i] < this._clapAttempts[indexOfEarliestClap]) {
				indexOfEarliestClap = i;
			}
		}
		
		const result = this._clapAttempts[indexOfEarliestClap];
		this._clapAttempts.splice(indexOfEarliestClap, 1);
		return result;
	};
	this.removeAllClaps = function() {
		this._clapAttempts = [];
	};
	this.updateClapsWithID = function(noteID) {
		const noteElement = document.getElementById(noteID);
		
		if (this.bestClapTiming === null) {
			$(noteElement).css("color","black");
		} else {
			const threshold = 200;
			const correctness = Math.max(1 - (Math.abs(this.bestClapTiming) / threshold), 0);
			
			const hue = correctness * 125; //125°==green, 0°==red
			$(noteElement).css("color","hsl(" + hue + ",80%,40%)");
			//$(noteElement).animate({ color: "hsl(" + hue + ",80%,40%)" }, "slow"); //jQuery can't animate HSL??
			
			const extraClapClass = noteID + "-extraClap";
			$(noteElement.parentNode).children("." + extraClapClass).remove();
			if (this.extraClaps.length > 0) {
				for (let extraClap of this.extraClaps) {
					$(noteElement).after('<div class="extraClap ' + extraClapClass + '" style="left: ' + noteElement.offsetLeft + 'px;">Extra clap!<br/>❗️</div>');
				}
			}
		}
	};
	
	this.relativeLength = function(other) {
		return this.absoluteLength / other.absoluteLength;
	};
	
	this.toMilliseconds = function(timeSignature, tempo) {
		return this.relativeLength(timeSignature.bottom) * Player.beatLength(tempo);
	};
	
	this.toString = function() {
		return this.dotsDescription + this.typeDescription;
	};
	
	this.toNotation = function(beamsIn = 0, beamsOut = 0) {
		assert(typeof beamsIn === "number");
		assert(beamsIn == 0 || beamsIn == 1 || beamsIn == 2);
		assert(typeof beamsOut === "number");
		assert(beamsOut == 0 || beamsOut == 1 || beamsOut == 2);
		
		const result = (beamsIn == 0 && beamsOut == 0) ? Note.unbeamedCharacter(type) : Note.beamedCharacter(beamsIn, beamsOut);
		
		return customPrefix + result + Note.dots(dots) + customSuffix;
	};
	
	this.undotted = function() {
		return new Note(type, 0, customPrefix, customSuffix, sound);
	};
	
	this.doubled = function() {
		const resultType = type / 2;
		if (resultType < 1) {
			return null;
		} else {
			return new Note(resultType, dots, customPrefix, customSuffix, sound);
		}
	};
	
	this.halved = function() {
		const resultType = type * 2;
		if (resultType > 16) {
			return null;
		} else {
			return new Note(resultType, dots, customPrefix, customSuffix, sound);
		}
	};
	
	this.normalized = function() {
		return new Note(type, dots);
	};
};

Note.unbeamedCharacter = function(type) {
	switch (type) {
		case 1: return "w";
		case 2: return "h";
		case 4: return "q";
		case 8: return "e";
		case 16: return "s";
		default: return "?";
	}
};

Note.beamedCharacter = function(beamsIn, beamsOut) {
	switch (beamsIn) {
		case 0: switch (beamsOut) {
			case 1: return "r";
			case 2: return "d";
			default: return "?";
		}
		case 1: switch (beamsOut) {
			case 0: return "y";
			case 1: return "t";
			case 2: return "d";
			default: return "?";
		}
		case 2: switch (beamsOut) {
			case 0: return "g";
			case 1: return "g";
			case 2: return "f";
			default: return "?";
		}
		default: return "?";
	}
};

Note.dots = function(count) {
	let result = "";
	for (let i = 0; i < count; i++) {
		result += Note.dotCharacter;
	}
	return result;
};

//Time Signature

TimeSignature.prefix = "<span class=\"timeSignature\">";
TimeSignature.suffix = "</span>";

function TimeSignature(top, bottom) {
	assert(typeof top === "number");
	assert(Math.floor(top) === top && top > 0);
	assert(bottom.constructor === Note);
	assert(bottom.dots <= 1);
	
	Object.defineProperty(this, "top", {
		value: top,
		writable: false
	});
	
	Object.defineProperty(this, "bottom", {
		value: bottom.normalized(),
		writable: false
	});
	
	Object.defineProperty(this, "countoff", {
		get: function() {
			let result = [];
			while (result.length < 2) {
				for (var i = 0; i < (top <= 2 ? top : top - 2); i++) {
					let count = this.bottom.normalized();
					count.sound = (i+1).toString();
					result.push(count);
				}
			}
			
			let rea, dy;
			if (bottom.dots == 0) {
				rea = this.bottom.halved();
				dy = this.bottom.halved();
			} else {
				rea = this.bottom.undotted();
				dy = this.bottom.undotted().halved();
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
	});
	
	this.toString = function() {
		return top + " over " + bottom.toString();
	};
	
	this.toNotation = function() {
		const numerator = bottom.dots === 0 ? top : top * 3;
		const denominator = bottom.dots === 0 ? bottom.type : bottom.type * 2;
		
		return TimeSignature.prefix + TimeSignature.character(numerator, true) + TimeSignature.character(denominator, false) + TimeSignature.suffix;
	};
}

TimeSignature.character = function(digit, top) {
	assert(typeof digit === "number");
	assert(typeof top === "boolean");
	if (top) {
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
			default: assert(false);
		}
	} else {
		switch (digit) {
			case 1: return "1";
			case 2: return "2";
			case 4: return "4";
			case 8: return "8";
			case 16: return "6";
			default: assert(false);
		}
	}
};

//Piece

Piece.barlineCharacter = "\\ ";
Piece.finalBarlineCharacter = "\\|";

function Piece(timeSignature, notes) {
	assert(timeSignature.constructor === TimeSignature);
	assert(Array.isArray(notes));
	
	Object.defineProperty(this, "timeSignature", {
		value: timeSignature,
		writable: false
	});
	
	Object.defineProperty(this, "notes", {
		value: notes,
		writable: false
	});
	
	Object.defineProperty(this, "pieceID", {
		value: "piece",
		writable: true
	});
	
	this.maxNoteType = function() {
		let result = 1;
		for (let note of notes) {
			result = Math.max(result, note.type);
		}
		return result;
	};
	
	this.appropriateSpaces = function(note) {
		let result = "";
		const relativeLength = note.relativeLength(new Note(this.maxNoteType()));
		for (let i = 0; i < relativeLength-1; i++) {
			result += "&nbsp;";
		}
		return result;
	};
	
	this.idForNoteIndex = function(noteIndex) {
		assert(typeof noteIndex === "number");
		assert(noteIndex >= 0);
		return this.pieceID + "-note" + noteIndex;
	};
	
	this.toNotation = function() {
		let result = "";
		result += timeSignature.toNotation();
		let currentBeat = 0;
		
		let previousBeams = 0;
		
		for (let i = 0; i < notes.length; i++) {
			if (currentBeat >= timeSignature.top) {
				currentBeat -= timeSignature.top;
				result += Piece.barlineCharacter;
			}
			
			const note = notes[i];
			const noteLength = note.relativeLength(timeSignature.bottom);
			const willCrossBeat = Math.floor(currentBeat) != Math.floor(currentBeat + noteLength) || i == notes.length - 1;
			const nextBeams = (willCrossBeat || i == notes.length-1) ? 0 : notes[i+1].beams;
			
			let beamsIn, beamsOut;
			if (note.beams == 0) {
				beamsIn = 0;
				beamsOut = 0;
			} else if (previousBeams == 0) {
				beamsIn = 0;
				beamsOut = (nextBeams == 0) ? 0 : note.beams;
			} else if (nextBeams == 0) {
				beamsIn = (previousBeams == 0) ? 0 : note.beams;
				beamsOut = 0;
			} else if (previousBeams == note.beams || nextBeams == note.beams) {
				beamsIn = previousBeams;
				beamsOut = nextBeams;
			} else if (previousBeams > note.beams && nextBeams > note.beams) {
				beamsIn = note.beams;
				beamsOut = note.beams;
			} else {
				const minorRhythmFactor = timeSignature.bottom.relativeLength(note.undotted().doubled())
				const willCrossMinorRhythmicBoundary = Math.floor(currentBeat * minorRhythmFactor) != Math.floor((currentBeat + noteLength) * minorRhythmFactor);
				if (willCrossMinorRhythmicBoundary) {
					beamsIn = note.beams;
					beamsOut = nextBeams;
				} else {
					beamsIn = previousBeams;
					beamsOut = note.beams;
				}
			}
			
			result += '<span id="' + this.idForNoteIndex(i) + '">';
			result += note.toNotation(beamsIn, beamsOut);
			if (beamsIn == 0 && beamsOut == 0) {
				result += this.appropriateSpaces(note);
			}
			result += '</span>';
			
			currentBeat += noteLength;
			previousBeams = beamsOut;
		}
		return result + Piece.finalBarlineCharacter;
	};
	
	this.removeAllClaps = function() {
		for (let i = 0; i < this.notes.length; i++) {
			this.notes[i].removeAllClaps();
			this.notes[i].updateClapsWithID(this.idForNoteIndex(i));
		}
	};
}

//Player

Player.beatLength = function(tempo) { return 1000 * 60/tempo; };

function Player(piece = null, tempo = 90) {
	const setPiece = function(self, newValue) {
		assert(newValue === null || newValue.constructor === Piece);
		self._piece = newValue;
		
		self._isPlaying = false;
		self._startTime = null;
		self._nextNote = 0;
		self._nextNoteTime = null;
	}
	Object.defineProperty(this, "piece", {
		get: function() { return this._piece; },
		set: function(newValue) { setPiece(this, newValue); }
	});
	setPiece(this, piece);
	
	const setTempo = function(self, newValue) {
		assert(typeof newValue === "number");
		assert(newValue > 0);
		self._tempo = newValue;
	}
	Object.defineProperty(this, "tempo", {
		get: function() { return this._tempo; },
		set: function(newValue) { setTempo(this, newValue); }
	});
	setTempo(this, tempo);
	
	Object.defineProperty(this, "isPlaying", {
		get: function() { return this._isPlaying; }
	});
	
	Object.defineProperty(this, "isCountingOff", {
		get: function() { return this._isPlaying && this._nextNote < 0; }
	});
	
	this.play = function() {
		if (this.isPlaying) { return; }
		const parentElement = document.getElementById(this.piece.idForNoteIndex(0)).parentNode;
		parentElement.scrollLeft = 0;
		
		this._isPlaying = true;
		this._startTime = Date.now();
		this._nextNoteTime = this._startTime;
		this._nextNote = 0 - this.piece.timeSignature.countoff.notes.length;
		
		this._playNote();
	};
	
	this.stop = function() {
		this._isPlaying = false;
		this._startTime = null;
		this._nextNote = null;
		this._nextNoteTime = null;
	};
	
	this._playNote = function() {
		if (this._nextNote >= this.piece.notes.length) { this.stop(); }
		if (!this.isPlaying) { return; }
		
		const currentNote = this.isCountingOff ? this.piece.timeSignature.countoff.notes[this._nextNote + this.piece.timeSignature.countoff.notes.length] : this.piece.notes[this._nextNote];
		
		ion.sound.play(currentNote.sound);
		
		let noteElement = null;
		if (!this.isCountingOff) {
			noteElement = document.getElementById(this.piece.idForNoteIndex(this._nextNote));
			//$(noteElement).css("color","red");
			//$(noteElement).animate({ color: "black" }, "slow");
			
			//$(noteElement.parentNode).hide().show(0); //Complete redraw needed in Safari for overlapping beams, but scrolling works, too, so this shouldn't be necessary.
		}
		
		this._nextNoteTime += currentNote.toMilliseconds(this.piece.timeSignature, this.tempo);
		this._nextNote += 1;
		
		if (this._nextNote > 0 && this._nextNote < this.piece.notes.length) {
			const nextNoteElement = document.getElementById(this.piece.idForNoteIndex(this._nextNote));
			const scrollMargin = 80;
			let newScrollPosition;
			if (nextNoteElement === null) {
				newScrollPosition = noteElement.offsetLeft;
			} else {
				newScrollPosition = nextNoteElement.offsetLeft;
			}
			$(noteElement.parentNode).animate({ scrollLeft: newScrollPosition - scrollMargin }, this._nextNoteTime - Date.now());
		}
		
		var self = this;
		setTimeout(function() { self._playNote(); }, this._nextNoteTime - Date.now());
	};
	
	this.gradeClap = function() {
		if (this.isCountingOff || !this.isPlaying) { return; }
		const clapTime = Date.now();
		
		const noteDistance = function(noteTime) {
			return Math.abs(clapTime - noteTime);
		};
		
		const offsetToNextNote = this._nextNote == this.piece.notes.length ? Infinity : clapTime - this._nextNoteTime;
		const offsetToPreviousNote = this._nextNote == 0 ? Infinity : clapTime - (this._nextNoteTime - this.piece.notes[this._nextNote-1].toMilliseconds(this.piece.timeSignature, this.tempo));
		
		let closestNote, offset;
		if (Math.abs(offsetToNextNote) < Math.abs(offsetToPreviousNote)) {
			closestNote = this._nextNote;
			offset = offsetToNextNote;
		} else {
			closestNote = this._nextNote - 1;
			offset = offsetToPreviousNote;
		}
		
		if (closestNote > 0) {
			const previousNoteHasNoClap = this.piece.notes[closestNote - 1].bestClapTiming === null;
			const thisNoteAlreadyHasClap = this.piece.notes[closestNote].bestClapTiming !== null;
			if (previousNoteHasNoClap && thisNoteAlreadyHasClap) {
				this.piece.notes[closestNote - 1].addClap(this.piece.notes[closestNote].removeEarliestClap());
				this.piece.notes[closestNote - 1].updateClapsWithID(this.piece.idForNoteIndex(closestNote - 1));
			}
		}
		this.piece.notes[closestNote].addClap(offset);
		this.piece.notes[closestNote].updateClapsWithID(this.piece.idForNoteIndex(closestNote));
	};
}