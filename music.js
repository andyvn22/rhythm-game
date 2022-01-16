"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var __values = (this && this.__values) || function(o) {
    var s = typeof Symbol === "function" && Symbol.iterator, m = s && o[s], i = 0;
    if (m) return m.call(o);
    if (o && typeof o.length === "number") return {
        next: function () {
            if (o && i >= o.length) o = void 0;
            return { value: o && o[i++], done: !o };
        }
    };
    throw new TypeError(s ? "Object is not iterable." : "Symbol.iterator is not defined.");
};
function assert(condition, message) {
    if (message === void 0) { message = "Assertion failed"; }
    if (!condition) {
        if (typeof Error !== "undefined") {
            throw new Error(message);
        }
        else {
            throw message;
        }
    }
}
function assertionFailure(message) {
    if (message === void 0) { message = "Assertion failed: unreachable code"; }
    throw message;
}
function isInternetExplorer() {
    return window.navigator.userAgent.indexOf('MSIE ') >= 0 || window.navigator.userAgent.indexOf('Trident/') >= 0;
}
var cachedWidth = undefined;
$(window).on("resize", function () {
    cachedWidth = document.documentElement.clientWidth; //reading this width is SLOWWWW.
});
/** Converts from vw (hundredths of viewport width) to pixels */
function vw(vw) {
    if (cachedWidth === undefined) {
        cachedWidth = document.documentElement.clientWidth;
    }
    return Math.round(vw * cachedWidth / 100);
}
/** Converts from em to pixels, relative to the font size of the element `relativeTo`, or `document.body` if no element is given. */
function em(em, relativeTo) {
    if (relativeTo === void 0) { relativeTo = document.body; }
    return Math.round(parseFloat(getComputedStyle(relativeTo).fontSize) * em);
}
function nudgeFloat(input) {
    var epsilon = 0.00001;
    if (Math.abs(input - Math.round(input)) < epsilon) {
        return Math.round(input);
    }
    else {
        return input;
    }
}
/**
 * A sound effect that can be audibly played, such as a click, part of a countoff, or a backing loop.
 *
 * Sounds are preloaded at initialization.
 * I don't have the slightest idea why, but you need to delete all instances of "export" in howler/index.d.ts for this to compile... :(
 */
var Sound = /** @class */ (function () {
    function Sound(name, loop, rate) {
        if (loop === void 0) { loop = false; }
        if (rate === void 0) { rate = 1; }
        this.name = name;
        if (Sound.howls[name] === undefined) {
            Sound.howls[name] = new Howl({
                src: ["media/sounds/" + name + ".mp3"],
                loop: loop,
                preload: true,
                rate: rate,
                onplay: function () {
                    var callback = Sound.playCallbacks[name];
                    if (callback !== undefined) {
                        callback();
                        Sound.playCallbacks[name] = undefined;
                    }
                }
            });
        }
        this.value = Sound.howls[name];
    }
    Sound.prototype.play = function (onPlay) {
        if (onPlay === void 0) { onPlay = function () { }; }
        Sound.playCallbacks[this.name] = onPlay;
        this.value.play();
    };
    Sound.prototype.stop = function () {
        this.value.stop();
    };
    Object.defineProperty(Sound.prototype, "seek", {
        get: function () {
            return this.value.seek();
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Sound, "usingWebAudio", {
        get: function () { return Howler.usingWebAudio; },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Sound, "clap", {
        get: function () { return new Sound("metronome"); },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Sound, "beat", {
        get: function () { return new Sound("beat"); },
        enumerable: false,
        configurable: true
    });
    Sound.number = function (number) {
        assert(number < 11);
        assert(number === Math.floor(number));
        return new Sound(number.toString());
    };
    Object.defineProperty(Sound, "readyFirstSyllable", {
        get: function () { return new Sound("rea-"); },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Sound, "readySecondSyllable", {
        get: function () { return new Sound("-dy"); },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Sound, "go", {
        get: function () { return new Sound("go"); },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Sound, "fanfare", {
        get: function () { return new Sound("fanfare"); },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Sound, "success", {
        get: function () { return new Sound("success"); },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Sound, "correct", {
        get: function () { return new Sound("correct"); },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Sound, "wrong", {
        get: function () { return new Sound("wrong"); },
        enumerable: false,
        configurable: true
    });
    /**
     * Creates and returns a backing loop appropriate for the given time signature and tempo.
     *
     * May return different instances for the same input; save your backing loop instance if you need to stop it later.
     */
    Sound.backingLoop = function (timeSignature, tempo, index) {
        function indexTo(upperBound) {
            var _a, _b;
            if (index !== undefined) {
                return index % upperBound;
            }
            else {
                return (_b = (_a = Level.current) === null || _a === void 0 ? void 0 : _a.stablePseudorandomIntegerTo(upperBound)) !== null && _b !== void 0 ? _b : Math.floor(Math.random() * upperBound);
            }
        }
        var rate = tempo / 80;
        if (timeSignature.isSwing) {
            switch (timeSignature.top) {
                case 2:
                case 4:
                    return new Sound("loops/swingQuadruple/" + indexTo(4), true, rate);
            }
        }
        else if (timeSignature.isCompound) {
            switch (timeSignature.top) {
                case 2:
                case 4:
                    return new Sound("loops/compoundQuadruple/" + indexTo(6), true, rate);
                case 3:
                    return new Sound("loops/compoundTriple/" + indexTo(1), true, rate);
            }
        }
        else {
            switch (timeSignature.top) {
                case 2:
                case 4:
                    return new Sound("loops/simpleQuadruple/" + indexTo(8), true, rate);
                case 3: return new Sound("loops/simpleTriple/" + indexTo(3), true, rate);
                case 5: return new Sound("loops/simpleQuintuple/" + indexTo(2), true, rate);
            }
        }
        return new Sound("loops/0", true, rate);
    };
    Sound.howls = Object.create(null);
    Sound.playCallbacks = Object.create(null);
    return Sound;
}());
/**
 * An event (like a note or beat), whose timing is specified in absolute beats from the start of a piece
 */
var MusicEvent = /** @class */ (function () {
    function MusicEvent(timing, shouldPerform, graded, performanceAttempts) {
        if (shouldPerform === void 0) { shouldPerform = true; }
        if (graded === void 0) { graded = false; }
        if (performanceAttempts === void 0) { performanceAttempts = []; }
        this.timing = timing;
        this.shouldPerform = shouldPerform;
        this.graded = graded;
        this.performanceAttempts = performanceAttempts;
    }
    Object.defineProperty(MusicEvent.prototype, "earliestPerformanceAttempt", {
        /** Returns the first performance attempt, or `undefined` if there are no attempts */
        get: function () {
            if (this.performanceAttempts.length == 0) {
                return undefined;
            }
            return Math.min.apply(Math, this.performanceAttempts);
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(MusicEvent.prototype, "bestPerformanceAttempt", {
        /** The offset of the best attempt to match this event's timing, or `undefined` if none exists */
        get: function () {
            if (this.performanceAttempts.length == 0) {
                return undefined;
            }
            return this.performanceAttempts[0];
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(MusicEvent.prototype, "extraPerformanceAttempts", {
        /** Any extra (beyond the first, best) attempts to match this event's timing, as an array of offsets */
        get: function () {
            if (this.performanceAttempts.length == 0) {
                return [];
            }
            else
                return this.performanceAttempts.slice(1);
        },
        enumerable: false,
        configurable: true
    });
    /** Add an offset as an attempt to match this event's timing */
    MusicEvent.prototype.addPerformanceAttempt = function (offset) {
        var bestTimingSort = function (a, b) {
            if (Math.abs(a) < Math.abs(b)) {
                return -1;
            }
            else if (Math.abs(a) > Math.abs(b)) {
                return 1;
            }
            else {
                return 0;
            }
        };
        this.performanceAttempts.push(offset);
        this.performanceAttempts.sort(bestTimingSort);
    };
    /** Remove (and return) the earliest performance attempt from the list, or return `undefined` if there are no attempts */
    MusicEvent.prototype.removeEarliestPerformanceAttempt = function () {
        if (this.performanceAttempts.length == 0) {
            return undefined;
        }
        var indexOfEarliestAttempt = 0;
        for (var i = 0; i < this.performanceAttempts.length; i++) {
            if (this.performanceAttempts[i] < this.performanceAttempts[indexOfEarliestAttempt]) {
                indexOfEarliestAttempt = i;
            }
        }
        var result = this.performanceAttempts[indexOfEarliestAttempt];
        this.performanceAttempts.splice(indexOfEarliestAttempt, 1);
        return result;
    };
    MusicEvent.prototype.removeAllPerformanceAttempts = function () {
        this.performanceAttempts = [];
    };
    /**
     * Returns the accuracy (from 0-1) of the best performance attempt at the given tempo.
     * @param tempo The tempo at which to grade the performance attempt
     * @param offset A beat offset to shift the performance attempt by before grading it; defaults to 0
     */
    MusicEvent.prototype.accuracy = function (tempo, offset) {
        if (offset === void 0) { offset = 0; }
        assert(tempo > 0);
        if (this.shouldPerform) {
            if (this.bestPerformanceAttempt === undefined) {
                return 0;
            }
            return Math.max(1 - (Math.abs((this.bestPerformanceAttempt + offset) * Player.beatLength(tempo)) / MusicEvent.timingThreshold), 0);
        }
        else {
            if (this.bestPerformanceAttempt === undefined) {
                return 1;
            }
            else
                return 0;
        }
    };
    /** Returns the offsets to all whole-numbered beats that occur before `length` is over */
    MusicEvent.prototype.offsetsToBeatsForLength = function (length) {
        assert(length > 0);
        var result = [];
        for (var i = Math.ceil(this.timing); i < nudgeFloat(this.timing + length); i++) {
            result.push(nudgeFloat(i - this.timing));
        }
        return result;
    };
    /** How far away two timings can be before they're graded as different */
    MusicEvent.timingThreshold = 200; //ms
    return MusicEvent;
}());
/**
 * An ordered collection of `MusicEvent`s
 */
var EventList = /** @class */ (function () {
    /** Creates a new list of the specified events. The given events must be in chronological order. */
    function EventList(events, ignoreLastEvent) {
        if (ignoreLastEvent === void 0) { ignoreLastEvent = false; }
        this.value = events;
        this.ignoreLastEvent = ignoreLastEvent;
    }
    EventList.prototype.index = function (index) {
        assert(index >= 0);
        assert(index < this.value.length);
        return this.value[index];
    };
    Object.defineProperty(EventList.prototype, "last", {
        get: function () {
            assert(this.value.length > 0);
            return this.value[this.value.length - 1];
        },
        enumerable: false,
        configurable: true
    });
    /** Returns the index of the last `MusicEvent` that occurs before `time` */
    EventList.prototype.lastIndexBefore = function (time) {
        assert(this.value.length > 0);
        var result = -1;
        while (result < this.value.length - 1) {
            result++;
            if (this.value[result].timing > time) {
                return result - 1;
            }
        }
        return result;
    };
    /** Grades the given `attemptTime`, calling `addPerformanceAttempt()` on the appropriate `MusicEvent`. Returns all modified indices (which may be more than one due to adjusting earlier guesses). */
    EventList.prototype.gradePerformanceAttempt = function (attemptTime) {
        var _a;
        assert(this.value.length > 0);
        var closestIndex = -1;
        var offset = Infinity;
        while (closestIndex < this.value.length - 1) {
            closestIndex++;
            if (Math.abs(attemptTime - this.value[closestIndex].timing) > Math.abs(offset)) {
                closestIndex--;
                break;
            }
            else {
                offset = attemptTime - this.value[closestIndex].timing;
            }
        }
        var result = [closestIndex];
        if (closestIndex > 0) {
            var previousNoteIsMissingAttempt = this.value[closestIndex - 1].bestPerformanceAttempt === undefined && this.value[closestIndex - 1].shouldPerform;
            var thisNoteHasEarlyAttempt = (_a = this.value[closestIndex].earliestPerformanceAttempt) !== null && _a !== void 0 ? _a : Infinity < 0;
            if (previousNoteIsMissingAttempt && thisNoteHasEarlyAttempt) {
                this.value[closestIndex - 1].addPerformanceAttempt(this.value[closestIndex].removeEarliestPerformanceAttempt());
                result.push(closestIndex - 1);
            }
        }
        this.value[closestIndex].addPerformanceAttempt(offset);
        return result;
    };
    EventList.prototype.removeGrading = function () {
        for (var i = 0; i < this.value.length; i++) {
            this.value[i].removeAllPerformanceAttempts();
            this.value[i].graded = false;
        }
    };
    EventList.prototype.enableGradingThrough = function (time) {
        var e_1, _a;
        try {
            for (var _b = __values(this.value), _c = _b.next(); !_c.done; _c = _b.next()) {
                var event_1 = _c.value;
                if (event_1.timing > time) {
                    return;
                }
                event_1.graded = true;
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
            }
            finally { if (e_1) throw e_1.error; }
        }
    };
    Object.defineProperty(EventList.prototype, "gradedEvents", {
        get: function () {
            return this.ignoreLastEvent ? this.value.slice(0, -1) : this.value;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(EventList.prototype, "averageOffset", {
        get: function () {
            var bestAttempts = this.gradedEvents.map(function (x) { return x.bestPerformanceAttempt; }).filter(function (x) { return x !== undefined; });
            if (bestAttempts.length === 0) {
                return 0;
            }
            return bestAttempts.reduce(function (a, b) { return a + b; }, 0) / bestAttempts.length;
        },
        enumerable: false,
        configurable: true
    });
    /**
     * Returns grading info about the quality of performances of these events, at a specific tempo.
     * @param tempo The tempo at which to evaluate these performances
     * @param offset An offset to apply to all performances before grading; defaults to 0
     */
    EventList.prototype.gradingInfo = function (tempo, offset) {
        if (offset === void 0) { offset = 0; }
        assert(tempo > 0);
        var successes = this.gradedEvents.filter(function (x) { return x.accuracy(tempo, offset) > 0; });
        var extraAttempts = this.gradedEvents.reduce(function (a, b) { return a + b.extraPerformanceAttempts.length; }, 0);
        var accuracy = successes.length / (this.gradedEvents.length + extraAttempts);
        var timingRating = this.value.reduce(function (a, b) { return a + b.accuracy(tempo, offset); }, 0) / this.gradedEvents.length;
        return { accuracy: accuracy, timingRating: timingRating, averageOffset: this.averageOffset };
    };
    EventList.prototype.mightHaveLatencyIssues = function (tempo) {
        var apparentAccuracy = this.gradingInfo(tempo, 0).accuracy;
        if (apparentAccuracy > 0.8) {
            return false;
        }
        if (this.averageOffset < 0) {
            return false;
        }
        var correctedAccuracy = this.gradingInfo(tempo, -this.averageOffset).accuracy;
        return (correctedAccuracy > 0.65 && correctedAccuracy - apparentAccuracy > 0.25);
    };
    return EventList;
}());
/**
 * A type of note (quarter, eighth, etc.)
 */
var NoteType = /** @class */ (function () {
    function NoteType(rawValue) {
        this.rawValue = rawValue;
    }
    Object.defineProperty(NoteType.prototype, "description", {
        get: function () {
            switch (this.rawValue) {
                case 1: return "whole";
                case 2: return "half";
                case 4: return "quarter";
                case 8: return "eighth";
                case 16: return "sixteenth";
            }
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(NoteType.prototype, "beams", {
        get: function () {
            switch (this.rawValue) {
                case 1: return 0;
                case 2: return 0;
                case 4: return 0;
                case 8: return 1;
                case 16: return 2;
            }
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(NoteType.prototype, "stemmed", {
        get: function () {
            return this.rawValue > 1;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(NoteType.prototype, "absoluteLength", {
        get: function () {
            return 1 / this.rawValue;
        },
        enumerable: false,
        configurable: true
    });
    NoteType.dots = function (count) {
        assert(count >= 0);
        var result = "";
        for (var i = 0; i < count; i++) {
            result += NoteType.dotCharacter;
        }
        return result;
    };
    NoteType.spacer = function (beams) {
        switch (beams) {
            case 0: return "&nbsp;&nbsp;";
            case 1: return "\ue1f8";
            case 2: return "\ue1fa";
        }
    };
    NoteType.prototype.unbeamedCharacter = function (dots, spaced) {
        if (spaced === void 0) { spaced = true; }
        var result;
        switch (this.rawValue) {
            case 1:
                result = "\ue1d2";
                break;
            case 2:
                result = "\ue1d3";
                break;
            case 4:
                result = "\ue1d5";
                break;
            case 8:
                result = "\ue1d7";
                break;
            case 16:
                result = "\ue1d9";
                break;
        }
        if (spaced || dots > 0) {
            result += NoteType.unbeamedSpacer + NoteType.dots(dots);
        }
        return result + (spaced ? NoteType.unbeamedSpacer : "");
    };
    NoteType.beamedCharacter = function (beamsIn, beamsOut, dots) {
        var result = "";
        switch (beamsIn) {
            case 0:
                result += "\ue1f1";
                break;
            case 1:
                result += "\ue1f3";
                break;
            case 2:
                result += "\ue1f5";
                break;
            default: assertionFailure();
        }
        switch (beamsOut) {
            case 0:
                result += "";
                break;
            case 1:
                result += "\ue1f8";
                break;
            case 2:
                result += "\ue1fa";
                break;
            default: assertionFailure();
        }
        result += NoteType.dots(dots);
        if (beamsOut == 0) {
            result += NoteType.unbeamedSpacer + NoteType.unbeamedSpacer; //dots combine correctly with beam-finishing note characters so we do both spacers afterwards instead of on either side like with true unbeamed notes
        }
        return result;
    };
    NoteType.prototype.restCharacter = function (dots, spaced) {
        if (spaced === void 0) { spaced = true; }
        var result;
        switch (this.rawValue) {
            case 1:
                result = "&nbsp;\ue4f4";
                break;
            case 2:
                result = "&nbsp;\ue4f5";
                break;
            case 4:
                result = "\ue4e5";
                break;
            case 8:
                result = "\ue4e6";
                break;
            case 16:
                result = "\ue4e7";
                break;
        }
        if (spaced || dots > 0) {
            result += NoteType.unbeamedSpacer + NoteType.dots(dots);
        }
        return result + (spaced ? NoteType.unbeamedSpacer : "");
    };
    NoteType.dotCharacter = "\ue1fc&nbsp;";
    NoteType.unbeamedSpacer = "&nbsp;";
    return NoteType;
}());
/**
 * A single note within a larger piece; consists primarily of a type (quarter, eighth, etc.) and a number of dots (0, 1, or 2). Subclassed by `Rest`.
 */
var Note = /** @class */ (function () {
    function Note(type, dots, customPrefix, customSuffix, sound) {
        if (dots === void 0) { dots = 0; }
        if (customPrefix === void 0) { customPrefix = ""; }
        if (customSuffix === void 0) { customSuffix = ""; }
        if (sound === void 0) { sound = Sound.clap; }
        assert(dots >= 0 && dots <= 2);
        this.type = type;
        this.dots = dots;
        this.customPrefix = customPrefix;
        this.customSuffix = customSuffix;
        this.sound = sound;
    }
    Object.defineProperty(Note.prototype, "Self", {
        /** Returns the class of the current instance */
        get: function () {
            return this.constructor;
        },
        enumerable: false,
        configurable: true
    });
    Note.prototype.copy = function () {
        return new this.Self(this.type, this.dots, this.customPrefix, this.customSuffix, this.sound);
    };
    Object.defineProperty(Note, "whole", {
        get: function () { return new this(new NoteType(1)); },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Note, "half", {
        get: function () { return new this(new NoteType(2)); },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Note, "quarter", {
        get: function () { return new this(new NoteType(4)); },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Note, "eighth", {
        get: function () { return new this(new NoteType(8)); },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Note, "sixteenth", {
        get: function () { return new this(new NoteType(16)); },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Note.prototype, "dotsDescription", {
        get: function () {
            switch (this.dots) {
                case 0: return "";
                case 1: return "dotted ";
                case 2: return "doubly-dotted ";
            }
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Note.prototype, "description", {
        get: function () {
            return this.dotsDescription + this.type.description + " note";
        },
        enumerable: false,
        configurable: true
    });
    Note.prototype.toString = function () {
        return this.description;
    };
    Object.defineProperty(Note.prototype, "lowercaseIndefiniteDescription", {
        get: function () {
            return (this.description[0] === "e" ? "an" : "a") + " " + this.description;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Note.prototype, "capitalizedIndefiniteDescription", {
        get: function () {
            return (this.description[0] === "e" ? "An" : "A") + " " + this.description;
        },
        enumerable: false,
        configurable: true
    });
    Note.prototype.notation = function (beamsIn, beamsOut, spaced) {
        if (beamsIn === void 0) { beamsIn = 0; }
        if (beamsOut === void 0) { beamsOut = 0; }
        if (spaced === void 0) { spaced = true; }
        var result = (beamsIn == 0 && beamsOut == 0) ? this.type.unbeamedCharacter(this.dots, spaced) : NoteType.beamedCharacter(beamsIn, beamsOut, this.dots);
        return this.customPrefix + result + this.customSuffix;
    };
    Object.defineProperty(Note.prototype, "inlineNotation", {
        get: function () {
            var style = this.stemmed ? " style=\"top: 0.4em;\"" : "";
            return "<span class=\"inline-notation\"" + style + ">" + this.notation(0, 0, false) + "</span>";
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Note.prototype, "stemmed", {
        get: function () {
            return !(this instanceof Rest) && this.type.stemmed;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Note.prototype, "absoluteLength", {
        get: function () {
            switch (this.dots) {
                case 0: return this.type.absoluteLength;
                case 1: return this.type.absoluteLength * 1.5;
                case 2: return this.type.absoluteLength * 1.75;
            }
        },
        enumerable: false,
        configurable: true
    });
    Note.prototype.relativeLength = function (other) {
        return this.absoluteLength / other.absoluteLength;
    };
    Note.prototype.readableLength = function (timeSignature) {
        var e_2, _a;
        var wholeComponent = Math.floor(this.relativeLength(timeSignature.bottom));
        var fractionalComponent = this.relativeLength(timeSignature.bottom) - wholeComponent;
        var wholeDescription = wholeComponent === 0 ? "" : wholeComponent.toString();
        var fractionalDescription = "";
        var epsilon = 0.0001;
        var phrases = [
            [0, ""],
            [1 / 4, "&frac14;"],
            [1 / 2, "&frac12;"],
            [3 / 4, "&frac34;"],
            [1 / 6, "&frac16;"],
            [1 / 3, "&frac13;"],
            [2 / 3, "&frac23;"],
            [5 / 6, "&frac56;"]
        ];
        try {
            for (var phrases_1 = __values(phrases), phrases_1_1 = phrases_1.next(); !phrases_1_1.done; phrases_1_1 = phrases_1.next()) {
                var pair = phrases_1_1.value;
                var value = pair[0];
                var phrase = pair[1];
                if (Math.abs(value - fractionalComponent) < epsilon) {
                    fractionalDescription = phrase;
                }
            }
        }
        catch (e_2_1) { e_2 = { error: e_2_1 }; }
        finally {
            try {
                if (phrases_1_1 && !phrases_1_1.done && (_a = phrases_1.return)) _a.call(phrases_1);
            }
            finally { if (e_2) throw e_2.error; }
        }
        return wholeDescription + fractionalDescription + " beat" + (this.relativeLength(timeSignature.bottom) > 1 ? "s" : "");
    };
    Object.defineProperty(Note.prototype, "undotted", {
        get: function () {
            return new this.Self(this.type, 0, this.customPrefix, this.customSuffix, this.sound);
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Note.prototype, "dotted", {
        get: function () {
            assert(this.dots < 2);
            return new this.Self(this.type, this.dots + 1, this.customPrefix, this.customSuffix, this.sound);
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Note.prototype, "doubled", {
        get: function () {
            var resultType = this.type.rawValue / 2;
            assert(resultType >= 1);
            return new this.Self(new NoteType(resultType), this.dots, this.customPrefix, this.customSuffix, this.sound);
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Note.prototype, "halved", {
        get: function () {
            var resultType = this.type.rawValue * 2;
            assert(resultType <= 16);
            return new this.Self(new NoteType(resultType), this.dots, this.customPrefix, this.customSuffix, this.sound);
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Note.prototype, "normalized", {
        get: function () {
            return new this.Self(this.type, this.dots);
        },
        enumerable: false,
        configurable: true
    });
    return Note;
}());
;
/**
 * A subclass of `Note` that should not be performed and makes no sound.
 */
var Rest = /** @class */ (function (_super) {
    __extends(Rest, _super);
    function Rest(type, dots, customPrefix, customSuffix, sound) {
        if (dots === void 0) { dots = 0; }
        if (customPrefix === void 0) { customPrefix = ""; }
        if (customSuffix === void 0) { customSuffix = ""; }
        var _this = _super.call(this, type, dots, customPrefix, customSuffix, sound) || this;
        if (sound === undefined) {
            _this.sound = undefined;
        }
        return _this;
    }
    Object.defineProperty(Rest.prototype, "description", {
        get: function () {
            return this.dotsDescription + this.type.description + " rest";
        },
        enumerable: false,
        configurable: true
    });
    Rest.prototype.notation = function (beamsIn, beamsOut, spaced) {
        if (beamsIn === void 0) { beamsIn = 0; }
        if (beamsOut === void 0) { beamsOut = 0; }
        if (spaced === void 0) { spaced = true; }
        beamsIn;
        beamsOut;
        var result = this.type.restCharacter(this.dots, spaced);
        return this.customPrefix + result + this.customSuffix;
    };
    return Rest;
}(Note));
var AllCountNamesSimpleBasic = ["beat", "+"];
var AllCountNamesSimple = ["beat", "e", "+", "a"];
var AllCountNamesCompoundBasic = ["beat", "ta", "ma"];
var AllCountNamesCompound = ["beat", "di", "ta", "ti", "ma", "mi"];
var AllCountNames = ["beat", "e", "+", "a", "di", "ta", "ti", "ma", "mi"];
/**
 * A count (specific location in time through a beat). "+" and "ti" are not equal.
 */
var Count = /** @class */ (function () {
    function Count(rawValue) {
        this.rawValue = rawValue;
    }
    Count.prototype.toString = function () { return this.rawValue; };
    Object.defineProperty(Count.prototype, "description", {
        get: function () {
            return this.toString();
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Count.prototype, "timing", {
        get: function () {
            switch (this.rawValue) {
                case "beat": return 0;
                case "e": return 1 / 4;
                case "+": return 1 / 2;
                case "a": return 3 / 4;
                case "di": return 1 / 6;
                case "ta": return 1 / 3;
                case "ti": return 3 / 6; //distinct from + despite equal timing
                case "ma": return 2 / 3;
                case "mi": return 5 / 6;
            }
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Count.prototype, "timingString", {
        get: function () {
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
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Count.prototype, "capitalizedTimingString", {
        get: function () {
            return this.timingString.charAt(0).toUpperCase() + this.timingString.slice(1);
        },
        enumerable: false,
        configurable: true
    });
    Count.prototype.isEqual = function (other) {
        return this.rawValue === other.rawValue;
    };
    Object.defineProperty(Count, "beat", {
        get: function () { return new Count("beat"); },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Count, "e", {
        get: function () { return new Count("e"); },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Count, "and", {
        get: function () { return new Count("+"); },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Count, "a", {
        get: function () { return new Count("e"); },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Count, "di", {
        get: function () { return new Count("di"); },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Count, "ta", {
        get: function () { return new Count("ta"); },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Count, "ti", {
        get: function () { return new Count("ti"); },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Count, "ma", {
        get: function () { return new Count("ma"); },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Count, "mi", {
        get: function () { return new Count("mi"); },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Count, "allSimpleBasic", {
        get: function () { return AllCountNamesSimpleBasic.map(function (x) { return new Count(x); }); },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Count, "allSimple", {
        get: function () { return AllCountNamesSimple.map(function (x) { return new Count(x); }); },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Count, "allCompoundBasic", {
        get: function () { return AllCountNamesCompoundBasic.map(function (x) { return new Count(x); }); },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Count, "allCompound", {
        get: function () { return AllCountNamesCompound.map(function (x) { return new Count(x); }); },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Count, "all", {
        get: function () { return AllCountNames.map(function (x) { return new Count(x); }); },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Count, "allExceptCompoundAdvanced", {
        get: function () { return this.allSimple.concat(this.allCompoundBasic); },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Count, "allSwing", {
        get: function () { return this.allSimpleBasic.concat([new Count("ma")]); },
        enumerable: false,
        configurable: true
    });
    return Count;
}());
var Verbosity;
(function (Verbosity) {
    Verbosity[Verbosity["short"] = 0] = "short";
    Verbosity[Verbosity["medium"] = 1] = "medium";
    Verbosity[Verbosity["long"] = 2] = "long";
})(Verbosity || (Verbosity = {}));
/**
 * A description of a given musical timing
 */
var TimingDescription = /** @class */ (function () {
    function TimingDescription(count, beat, precision) {
        this.count = count;
        this.beat = beat;
        this.precision = precision;
    }
    /** Creates a timing description of the given absolute `timing` in the given `timeSignature` */
    TimingDescription.of = function (timing, timeSignature, tempo) {
        var e_3, _a;
        if (tempo === void 0) { tempo = 80; }
        assert(tempo > 0);
        var beat = Math.floor(timing);
        var fractionalTiming = timing - beat;
        var closestCount = Count.beat;
        try {
            for (var _b = __values(TimingDescription.knownCounts), _c = _b.next(); !_c.done; _c = _b.next()) {
                var count = _c.value;
                if (Math.abs(count.timing - fractionalTiming) < Math.abs(closestCount.timing - fractionalTiming)) {
                    closestCount = count;
                }
            }
        }
        catch (e_3_1) { e_3 = { error: e_3_1 }; }
        finally {
            try {
                if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
            }
            finally { if (e_3) throw e_3.error; }
        }
        if (Math.abs(1 - fractionalTiming) < Math.abs(closestCount.timing - fractionalTiming)) {
            closestCount = Count.beat;
            beat++;
            fractionalTiming = fractionalTiming - 1;
        }
        if (closestCount.isEqual(Count.and) && timeSignature.isCompound) {
            closestCount = Count.ti;
        }
        else if (closestCount.isEqual(Count.ti) && !timeSignature.isCompound) {
            closestCount = Count.and;
        }
        var offset = (fractionalTiming - closestCount.timing) * Player.beatLength(tempo);
        var precision = "on";
        if (offset > MusicEvent.timingThreshold / 4) {
            precision = "a little after";
        }
        else if (offset < -MusicEvent.timingThreshold / 4) {
            precision = "a little before";
        }
        var negativeModulo = function (lhs, rhs) {
            return ((lhs % rhs) + rhs) % rhs;
        };
        return new TimingDescription(closestCount, negativeModulo(beat, timeSignature.top), precision);
    };
    Object.defineProperty(TimingDescription.prototype, "shortBeatDescription", {
        get: function () {
            return this.beat + 1;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(TimingDescription.prototype, "longBeatDescription", {
        get: function () {
            return "beat " + this.shortBeatDescription;
        },
        enumerable: false,
        configurable: true
    });
    TimingDescription.prototype.description = function (verbosity) {
        if (this.count.isEqual(Count.beat)) {
            switch (verbosity) {
                case Verbosity.short: return "<strong>" + this.shortBeatDescription + "</strong>";
                default: return this.precision + " <strong>" + this.longBeatDescription + "</strong>";
            }
        }
        else {
            switch (verbosity) {
                case Verbosity.short: return "<strong>" + this.count.toString() + "</strong>";
                case Verbosity.medium: return this.precision + " <strong>" + this.count.toString() + "</strong> <em>(" + this.count.timingString + " " + this.longBeatDescription + ")</em>";
                case Verbosity.long: return this.precision + " the <strong>" + this.count.toString() + "</strong> of " + this.shortBeatDescription + " <em>(" + this.count.timingString + " " + this.longBeatDescription + ")</em>";
            }
        }
    };
    TimingDescription.knownCounts = Count.all;
    return TimingDescription;
}());
/**
 * An Orff time signature, consisting of a number of beats per measure (top) and a type of note that receives 1 beat (bottom).
 */
var TimeSignature = /** @class */ (function () {
    function TimeSignature(top, bottom, isSwing) {
        if (isSwing === void 0) { isSwing = false; }
        assert(Math.floor(top) === top);
        assert(top > 0);
        assert(top <= 10);
        assert(bottom.dots <= 1);
        this.top = top;
        this.bottom = bottom.normalized;
        this.isSwing = isSwing;
    }
    Object.defineProperty(TimeSignature, "twoFour", {
        get: function () { return new TimeSignature(2, Note.quarter); },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(TimeSignature, "threeFour", {
        get: function () { return new TimeSignature(3, Note.quarter); },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(TimeSignature, "fourFour", {
        get: function () { return new TimeSignature(4, Note.quarter); },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(TimeSignature, "fiveFour", {
        get: function () { return new TimeSignature(5, Note.quarter); },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(TimeSignature, "commonTime", {
        get: function () { return TimeSignature.fourFour; },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(TimeSignature, "cutTime", {
        get: function () { return new TimeSignature(2, Note.half); },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(TimeSignature, "sixEight", {
        get: function () { return new TimeSignature(2, Note.quarter.dotted); },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(TimeSignature, "nineEight", {
        get: function () { return new TimeSignature(3, Note.quarter.dotted); },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(TimeSignature, "twelveEight", {
        get: function () { return new TimeSignature(4, Note.quarter.dotted); },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(TimeSignature.prototype, "swung", {
        get: function () { return new TimeSignature(this.top, this.bottom, true); },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(TimeSignature.prototype, "isCompound", {
        get: function () {
            return this.bottom.dots == 1;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(TimeSignature.prototype, "countoff", {
        get: function () {
            var result = [];
            for (var i = 0; i < (this.top <= 2 ? this.top : this.top - 2); i++) {
                var count = this.bottom.normalized;
                count.sound = Sound.number(i + 1);
                result.push(count);
            }
            var rea, dy;
            if (this.isCompound) {
                rea = this.bottom.undotted;
                dy = this.bottom.undotted.halved;
            }
            else {
                rea = this.bottom.halved;
                dy = this.bottom.halved;
            }
            var go = this.bottom.copy();
            rea.sound = Sound.readyFirstSyllable;
            dy.sound = Sound.readySecondSyllable;
            go.sound = Sound.go;
            result.push(rea);
            result.push(dy);
            result.push(go);
            return new Piece(this, result);
        },
        enumerable: false,
        configurable: true
    });
    TimeSignature.prototype.milliseconds = function (notes, tempo) {
        var _this = this;
        assert(tempo > 0);
        return notes.reduce(function (a, b) { return a + b.relativeLength(_this.bottom) * Player.beatLength(tempo); }, 0);
    };
    TimeSignature.prototype.toString = function () {
        return this.top + " over " + this.bottom.toString();
    };
    Object.defineProperty(TimeSignature.prototype, "notation", {
        get: function () {
            var numerator = this.bottom.dots === 0 ? this.top : this.top * 3;
            assert(numerator <= 16);
            var denominator = this.bottom.dots === 0 ? this.bottom.type.rawValue : this.bottom.type.rawValue * 2;
            assert(denominator <= 16);
            return "<span class=\"timeSignature-top\">" + TimeSignature.topNotation(numerator) + "</span><span class=\"timeSignature-bottom\">" + TimeSignature.bottomNotation(denominator) + "</span>";
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(TimeSignature.prototype, "inlineNotation", {
        get: function () {
            return "<span class=\"inline-notation\" style=\"margin-left: -0.2em; margin-right: -0.3em;\">" + this.notation + "</span>";
        },
        enumerable: false,
        configurable: true
    });
    TimeSignature.topNotation = function (value) {
        return this.numericCharacters(value, "\ue09e") + "&nbsp;";
    };
    TimeSignature.bottomNotation = function (value) {
        return this.numericCharacters(value, "\ue09f") + "&nbsp;";
    };
    TimeSignature.numericCharacters = function (value, control) {
        var basis = 0xe080;
        var result = "";
        var place = 1;
        while (place <= value) {
            var digit = (value % (place * 10)) / place;
            result += control + String.fromCharCode(basis + digit);
            place *= 10;
        }
        return result;
    };
    return TimeSignature;
}());
/**
 * Several notes combined into a rhythmic unit usable as a building block for a measure of music
 */
var Block = /** @class */ (function () {
    function Block(notes, allowedStarts, isRequired) {
        if (isRequired === void 0) { isRequired = false; }
        assert(notes.length > 0);
        this.notes = notes;
        this.allowedStarts = allowedStarts;
        this.isRequired = isRequired;
    }
    Block.required = function (notes, allowedStarts) {
        return new Block(notes, allowedStarts, true);
    };
    Block.prototype.lengthIn = function (timeSignature) {
        return this.notes.reduce(function (a, b) { return a + b.relativeLength(timeSignature.bottom); }, 0);
    };
    Block.lengthOf = function (blocks, timeSignature) {
        return blocks.reduce(function (a, b) { return a + b.lengthIn(timeSignature); }, 0);
    };
    Block.prototype.fitsAfter = function (blocks, timeSignature) {
        var _a;
        if (((_a = this.allowedStarts) === null || _a === void 0 ? void 0 : _a.indexOf(Block.lengthOf(blocks, timeSignature))) === -1) {
            return false;
        }
        else {
            return Block.lengthOf(blocks, timeSignature) + this.lengthIn(timeSignature) <= timeSignature.top;
        }
    };
    /**
     * Returns every possible evolution of a given in-progress measure
     * @param original The partial measure to build upon. If it's already finished, it's returned as-is.
     * @param timeSignature The time signature in which to work
     * @param possibilities A library of blocks to use. If none of them can be applied to `original`, an empty array is returned.
     */
    Block.allPossibleNextStepsFor = function (original, timeSignature, possibilities) {
        var currentLength = Block.lengthOf(original, timeSignature);
        if (currentLength == timeSignature.top) {
            return [original];
        }
        return possibilities.filter(function (x) { return x.fitsAfter(original, timeSignature); }).map(function (x) { return original.concat(x); });
    };
    /** Returns every possible measure composable with the given blocks in the given time signature */
    Block.allPossibleMeasuresFrom = function (possibilities, timeSignature) {
        var result = possibilities.filter(function (x) { var _a; return ((_a = x.allowedStarts) === null || _a === void 0 ? void 0 : _a.indexOf(0)) !== -1; }).map(function (x) { return [x]; });
        while (result.filter(function (x) { return Block.lengthOf(x, timeSignature) < timeSignature.top; }).length > 0) {
            result = result.map(function (x) { return Block.allPossibleNextStepsFor(x, timeSignature, possibilities); }).reduce(function (a, b) { return a.concat(b); }, []);
        }
        return result;
    };
    /** Flattens an array of blocks into an array of notes */
    Block.flatten = function (measure) {
        return measure.reduce(function (a, b) { return a.concat(b.notes); }, []);
    };
    /** Returns the specified number of measures, randomly generated from the given blocks, respecting the time signature and `required` property */
    Block.randomMeasures = function (timeSignature, measures, blocks) {
        var e_4, _a;
        var requiredBlocks = blocks.filter(function (x) { return x.isRequired; });
        assert(measures >= requiredBlocks.length);
        var possibleMeasures = Block.allPossibleMeasuresFrom(blocks, timeSignature);
        var resultMeasures = [];
        var _loop_1 = function (requiredBlock) {
            var options = possibleMeasures.filter(function (x) { return x.indexOf(requiredBlock) !== -1; });
            resultMeasures.push(Block.flatten(options[Math.floor(Math.random() * options.length)]));
        };
        try {
            for (var requiredBlocks_1 = __values(requiredBlocks), requiredBlocks_1_1 = requiredBlocks_1.next(); !requiredBlocks_1_1.done; requiredBlocks_1_1 = requiredBlocks_1.next()) {
                var requiredBlock = requiredBlocks_1_1.value;
                _loop_1(requiredBlock);
            }
        }
        catch (e_4_1) { e_4 = { error: e_4_1 }; }
        finally {
            try {
                if (requiredBlocks_1_1 && !requiredBlocks_1_1.done && (_a = requiredBlocks_1.return)) _a.call(requiredBlocks_1);
            }
            finally { if (e_4) throw e_4.error; }
        }
        while (resultMeasures.length < measures) {
            resultMeasures.push(Block.flatten(possibleMeasures[Math.floor(Math.random() * possibleMeasures.length)]));
        }
        function shuffle(array) {
            var j, x, i;
            for (i = array.length - 1; i > 0; i--) {
                j = Math.floor(Math.random() * (i + 1));
                x = array[i];
                array[i] = array[j];
                array[j] = x;
            }
        }
        shuffle(resultMeasures);
        return resultMeasures.reduce(function (a, b) { return a.concat(b); });
    };
    return Block;
}());
/**
 * A piece of music, consisting of sequential notes in a particular time signature.
 */
var Piece = /** @class */ (function () {
    function Piece(timeSignature, notes, backingLoopIndex) {
        var e_5, _a, e_6, _b;
        if (notes === void 0) { notes = []; }
        this.timeSignature = timeSignature;
        this.notes = notes.map(function (x) { return x.copy(); });
        var noteEvents = [];
        var timing = 0;
        try {
            for (var _c = __values(this.notes), _d = _c.next(); !_d.done; _d = _c.next()) {
                var note = _d.value;
                noteEvents.push(new MusicEvent(timing, !(note instanceof Rest)));
                timing += note.relativeLength(timeSignature.bottom);
                timing = nudgeFloat(timing);
            }
        }
        catch (e_5_1) { e_5 = { error: e_5_1 }; }
        finally {
            try {
                if (_d && !_d.done && (_a = _c.return)) _a.call(_c);
            }
            finally { if (e_5) throw e_5.error; }
        }
        if (timeSignature.isSwing) {
            try {
                for (var noteEvents_1 = __values(noteEvents), noteEvents_1_1 = noteEvents_1.next(); !noteEvents_1_1.done; noteEvents_1_1 = noteEvents_1.next()) {
                    var event_2 = noteEvents_1_1.value;
                    if (event_2.timing % 1 == 0.5) {
                        event_2.timing += 1 / 6;
                    }
                }
            }
            catch (e_6_1) { e_6 = { error: e_6_1 }; }
            finally {
                try {
                    if (noteEvents_1_1 && !noteEvents_1_1.done && (_b = noteEvents_1.return)) _b.call(noteEvents_1);
                }
                finally { if (e_6) throw e_6.error; }
            }
        }
        this.noteEvents = new EventList(noteEvents);
        var beatEvents = [];
        for (var beat = 0; beat <= timing; beat++) {
            beatEvents.push(new MusicEvent(beat));
        }
        this.beatEvents = new EventList(beatEvents, true);
        this.backingLoopIndex = backingLoopIndex;
    }
    Piece.random = function (timeSignature, measures, blocks, backingLoopIndex) {
        assert(measures > 0);
        return new Piece(timeSignature, Block.randomMeasures(timeSignature, measures, blocks), backingLoopIndex);
    };
    Object.defineProperty(Piece.prototype, "end", {
        get: function () {
            return this.noteEvents.last.timing + this.notes[this.notes.length - 1].relativeLength(this.timeSignature.bottom);
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Piece.prototype, "maxNoteType", {
        /** Returns a reference note to use when considering how far to space out the music. Never returns whole note, though; that's too squished. */
        get: function () {
            var e_7, _a;
            var result = 4;
            try {
                for (var _b = __values(this.notes), _c = _b.next(); !_c.done; _c = _b.next()) {
                    var note = _c.value;
                    result = Math.max(result, note.type.rawValue);
                }
            }
            catch (e_7_1) { e_7 = { error: e_7_1 }; }
            finally {
                try {
                    if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
                }
                finally { if (e_7) throw e_7.error; }
            }
            return new NoteType(result);
        },
        enumerable: false,
        configurable: true
    });
    Piece.prototype.appropriateSpaces = function (note, beams) {
        var result = "";
        var relativeLength = note.relativeLength(new Note(this.maxNoteType));
        for (var i = 0; i < relativeLength - 1; i++) {
            result += NoteType.spacer(beams);
        }
        return result;
    };
    Piece.prototype.idForNoteIndex = function (noteIndex) {
        assert(noteIndex >= 0);
        return this.pieceID + "-note" + noteIndex;
    };
    Piece.prototype.removeGrading = function (tempo) {
        this.noteEvents.removeGrading();
        this.beatEvents.removeGrading();
        for (var i = 0; i < this.notes.length; i++) {
            this.updateAppearanceOfNoteAtIndex(i, tempo);
        }
    };
    Piece.prototype.gradingInfo = function (tempo) {
        assert(tempo > 0);
        var clapInfo = this.noteEvents.gradingInfo(tempo);
        var tapInfo = this.beatEvents.gradingInfo(tempo);
        var passed = clapInfo.accuracy === 1 && tapInfo.accuracy === 1;
        var timingRating = (clapInfo.timingRating + tapInfo.timingRating) / 2;
        var averageAccuracy = (clapInfo.accuracy + tapInfo.accuracy) / 2;
        var averageOffset = (clapInfo.averageOffset + tapInfo.averageOffset) / 2;
        var summary;
        if (passed) {
            if (timingRating > 0.9) {
                summary = "Wow! You totally rocked that level; amazing job! See if you can do as well on the next!";
            }
            else if (timingRating > 0.5) {
                summary = "Nice performance! This level's done; onto the next!";
            }
            else {
                summary = "You successfully performed every clap and tap! You can head on to the next level, or stick around and try to improve your timing!";
            }
        }
        else if (this.beatEvents.mightHaveLatencyIssues(tempo)) {
            summary = "Say... your beat taps are <em>consistently</em> " + Math.round(this.beatEvents.averageOffset * Player.beatLength(tempo) / 100) / 10 + " seconds late. You're not playing on wireless headphones, are you? Try using your device's built-in speakers!";
        }
        else if (tapInfo.accuracy === 0) {
            summary = "Don't forget that you have to tap to the beat, not just clap the notes! Keep trying!";
        }
        else if (clapInfo.accuracy === 1) {
            summary = "Nice clapping! Focus on keeping a steady beat and you'll have this!";
        }
        else if (tapInfo.accuracy === 1) {
            summary = "Good work keeping the beat&mdash;focus next on clap accuracy; you can do this!";
        }
        else if (averageAccuracy > 0.8) {
            summary = "Almost there! Review the measures that are tripping you up&mdash;try practicing them one at a time before you go again!";
        }
        else {
            summary = "Practice is hard; keep working! You don't have to master the whole piece at once&mdash;pick just one measure to review and repeat it over and over yourself before you try again!";
        }
        summary += "<br/><br/>";
        return {
            clapAccuracy: clapInfo.accuracy,
            tapAccuracy: tapInfo.accuracy,
            timingRating: timingRating,
            averageOffset: averageOffset,
            passed: passed,
            summary: summary
        };
    };
    Piece.prototype.showTooltips = function (showTooltips) {
        for (var i = 0; i < this.notes.length; i++) {
            var noteElement = $("#" + this.idForNoteIndex(i));
            noteElement.tooltip(showTooltips ? "enable" : "disable");
            if (!showTooltips) {
                noteElement.attr("title", ""); //needed because jQuery bug removes `title` attribute when disabling tooltips, and then they never can be re-enabled
            }
        }
    };
    Object.defineProperty(Piece.prototype, "notation", {
        get: function () {
            var result = "";
            result += this.timeSignature.notation;
            var currentBeat = 0;
            var previousBeams = 0;
            for (var i = 0; i < this.notes.length; i++) {
                if (currentBeat >= this.timeSignature.top) {
                    currentBeat -= this.timeSignature.top;
                    result += Piece.barlineCharacter;
                }
                var note = this.notes[i];
                var noteLength = note.relativeLength(this.timeSignature.bottom);
                var isAtEnd = i == this.notes.length - 1;
                var willCrossBeat = Math.floor(currentBeat) != Math.floor(nudgeFloat(currentBeat + noteLength)) && nudgeFloat(currentBeat + noteLength) == Math.floor(nudgeFloat(currentBeat + noteLength));
                var nextBeams = isAtEnd || willCrossBeat || this.notes[i + 1] instanceof Rest ? 0 : this.notes[i + 1].type.beams;
                var beamsIn = void 0;
                var beamsOut = void 0;
                if (note.type.beams == 0 || note instanceof Rest) {
                    beamsIn = 0;
                    beamsOut = 0;
                }
                else if (previousBeams == 0) {
                    beamsIn = 0;
                    beamsOut = (nextBeams == 0) ? 0 : note.type.beams;
                }
                else if (nextBeams == 0) {
                    beamsIn = note.type.beams;
                    beamsOut = 0;
                }
                else if (previousBeams > note.type.beams && nextBeams > note.type.beams) {
                    beamsIn = note.type.beams;
                    beamsOut = note.type.beams;
                }
                else if (nextBeams > previousBeams && nextBeams === note.type.beams) {
                    beamsIn = previousBeams;
                    beamsOut = nextBeams;
                }
                else {
                    var minorRhythmFactor = this.timeSignature.bottom.relativeLength(note.undotted.doubled);
                    var willCrossMinorRhythmicBoundary = Math.floor(currentBeat * minorRhythmFactor) != Math.floor(nudgeFloat((currentBeat + noteLength) * minorRhythmFactor)) && nudgeFloat((currentBeat + noteLength) * minorRhythmFactor) == Math.floor(nudgeFloat((currentBeat + noteLength) * minorRhythmFactor));
                    if (willCrossMinorRhythmicBoundary) {
                        beamsIn = note.type.beams;
                        beamsOut = Math.min(nextBeams, note.type.beams);
                    }
                    else {
                        beamsIn = Math.min(previousBeams, note.type.beams);
                        beamsOut = note.type.beams;
                    }
                }
                var type = note instanceof Rest ? "rest" : "note";
                result += "<span class=\"" + type + "\" id=\"" + this.idForNoteIndex(i) + "\" title=\"\">" + note.notation(beamsIn, beamsOut);
                result += this.appropriateSpaces(note, beamsOut) + "</span>";
                currentBeat = nudgeFloat(currentBeat + noteLength);
                previousBeams = beamsOut;
            }
            return result + ("<span id=\"" + this.idForNoteIndex(this.notes.length) + "\">" + Piece.finalBarlineCharacter + "</span><span class=\"ie-padding-hack\"></span>");
        },
        enumerable: false,
        configurable: true
    });
    Piece.prototype.metricsForIndices = function (startIndex, endIndex) {
        assert(startIndex >= 0);
        assert(startIndex < this.notes.length);
        assert(endIndex >= 0);
        assert(endIndex <= this.notes.length); //final barline could be equal to length
        var startElement = $("#" + this.idForNoteIndex(startIndex));
        var endElement = $("#" + this.idForNoteIndex(endIndex));
        var earlierIndex = Math.min(startIndex, endIndex);
        var laterIndex = Math.max(startIndex, endIndex);
        var crossesBarline = laterIndex != this.notes.length && this.noteEvents.index(laterIndex).timing % this.timeSignature.top == 0;
        var beatLength = this.notes[earlierIndex].relativeLength(this.timeSignature.bottom) + (crossesBarline ? 1 : 0);
        var pixelOffset = endElement.position().left - startElement.position().left;
        return { beatLength: beatLength, pixelOffset: pixelOffset, crossesBarline: crossesBarline };
    };
    /**
     * Positions a staff element relative to a note
     */
    Piece.prototype.position = function (args) {
        assert(args.noteIndex >= 0);
        assert(args.noteIndex < this.notes.length);
        var noteElement = $("#" + this.idForNoteIndex(args.noteIndex));
        var horizontalOffset;
        if (args.beatOffset < 0) {
            if (args.noteIndex == 0) {
                horizontalOffset = 0;
            }
            else {
                var metrics = this.metricsForIndices(args.noteIndex, args.noteIndex - 1);
                var timingDescription = TimingDescription.of(this.noteEvents.index(args.noteIndex).timing + args.beatOffset, this.timeSignature);
                var isOnBeat1 = timingDescription.count.rawValue === "beat" && timingDescription.beat === 0;
                var fraction = (args.beatOffset - (metrics.crossesBarline && !isOnBeat1 ? 1 : 0)) / metrics.beatLength;
                horizontalOffset = fraction * -metrics.pixelOffset;
            }
        }
        else {
            var metrics = this.metricsForIndices(args.noteIndex, args.noteIndex + 1);
            horizontalOffset = (args.beatOffset / metrics.beatLength) * metrics.pixelOffset;
        }
        horizontalOffset += vw(0.7);
        if (args.centerElement) {
            horizontalOffset -= args.element.width() / 2;
        }
        var verticalOffset = args.verticalOffset;
        if (args.belowNote) {
            verticalOffset += noteElement.height() + vw(2);
        }
        var goshDarnIE = isInternetExplorer() ? noteElement.parent().scrollLeft() : 0;
        args.element.offset({
            left: noteElement.position().left + noteElement.parent().position().left + goshDarnIE + horizontalOffset,
            top: noteElement.parent().position().top + verticalOffset
        });
    };
    Piece.hueForAccuracy = function (accuracy) {
        return accuracy * 125; //125°==green, 0°==red
    };
    Piece.prototype.updateAppearanceOfNoteAtIndex = function (noteIndex, tempo) {
        assert(tempo > 0);
        assert(noteIndex >= 0);
        assert(noteIndex < this.notes.length);
        this.updateTooltipForNoteAtIndex(noteIndex, tempo);
        this.updateExtraClapsOfNoteAtIndex(noteIndex, tempo);
        this.updateCountingsOfNoteAtIndex(noteIndex, tempo); //must be called after setting `noteElement.tooltip`
    };
    Piece.prototype.updateTooltipForNoteAtIndex = function (noteIndex, tempo) {
        assert(tempo > 0);
        assert(noteIndex >= 0);
        assert(noteIndex < this.notes.length);
        var event = this.noteEvents.index(noteIndex);
        var noteElement = $("#" + this.idForNoteIndex(noteIndex));
        var noteOrRest = this.notes[noteIndex] instanceof Rest ? "rest" : "note";
        var tooltipContent = "<div>This " + noteOrRest + " is " + TimingDescription.of(event.timing, this.timeSignature, tempo).description(Verbosity.long) + "</div>";
        if (!event.graded) {
            noteElement.css("color", "black");
        }
        else {
            var hue = Piece.hueForAccuracy(event.accuracy(tempo));
            if (event.bestPerformanceAttempt === undefined) {
                tooltipContent += "<div style=\"color: hsl(" + event.accuracy + ",80%,40%)\">You didn't clap near it</div>";
            }
            else {
                tooltipContent += "<div style=\"color: hsl(" + hue + ",80%,40%)\">You clapped " + TimingDescription.of(event.timing + event.bestPerformanceAttempt, this.timeSignature, tempo).description(Verbosity.long) + "</div>";
            }
            noteElement.css("color", "hsl(" + hue + ",80%,40%)");
        }
        if (event.timing === Math.floor(event.timing)) {
            var beatEvent = this.beatEvents.index(event.timing);
            if (beatEvent.graded) {
                var hue = Piece.hueForAccuracy(beatEvent.accuracy(tempo));
                if (beatEvent.bestPerformanceAttempt === undefined) {
                    tooltipContent += "<div style=\"color: hsl(" + hue + ",80%,40%)\">You didn't tap " + TimingDescription.of(beatEvent.timing, this.timeSignature, tempo).description(Verbosity.medium) + "</div>";
                }
                else {
                    tooltipContent += "<div style=\"color: hsl(" + hue + ",80%,40%)\">You tapped " + TimingDescription.of(beatEvent.timing + beatEvent.bestPerformanceAttempt, this.timeSignature, tempo).description(Verbosity.medium) + "</div>";
                }
            }
        }
        if (noteElement.tooltip("instance") !== undefined) {
            noteElement.tooltip("destroy");
        }
        var offset = (noteOrRest == "note") ? em(0.3, noteElement[0]) : 0; //undo span-shifting hack from .note CSS
        noteElement.tooltip({
            content: tooltipContent,
            position: { my: "center top", at: "center bottom-" + offset, collision: "fit" }
        });
    };
    Piece.prototype.updateExtraClapsOfNoteAtIndex = function (noteIndex, tempo) {
        var e_8, _a;
        assert(tempo > 0);
        assert(noteIndex >= 0);
        assert(noteIndex < this.notes.length);
        var event = this.noteEvents.index(noteIndex);
        if (event === undefined) {
            assertionFailure();
        }
        var noteElement = $("#" + this.idForNoteIndex(noteIndex));
        var extraClapClass = this.idForNoteIndex(noteIndex) + "-extraClap";
        noteElement.parent().children("." + extraClapClass).remove();
        if (!event.graded) {
            return;
        }
        try {
            for (var _b = __values(event.extraPerformanceAttempts), _c = _b.next(); !_c.done; _c = _b.next()) {
                var extraClap = _c.value;
                var extraClapElement = $("<div class=\"extraClap " + extraClapClass + "\" title=\"\">Extra clap<br/>\u2757\uFE0F</div>");
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
                    content: "<div style=\"color: hsl(0,80%,40%)\">You added a clap " + TimingDescription.of(event.timing + extraClap, this.timeSignature, tempo).description(Verbosity.long) + "</div>"
                });
            }
        }
        catch (e_8_1) { e_8 = { error: e_8_1 }; }
        finally {
            try {
                if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
            }
            finally { if (e_8) throw e_8.error; }
        }
    };
    Piece.prototype.updateCountingsOfNoteAtIndex = function (noteIndex, tempo) {
        var e_9, _a, e_10, _b;
        assert(tempo > 0);
        assert(noteIndex >= 0);
        assert(noteIndex < this.notes.length);
        var note = this.notes[noteIndex];
        var noteEvent = this.noteEvents.index(noteIndex);
        var noteElement = $("#" + this.idForNoteIndex(noteIndex));
        var countingClass = this.idForNoteIndex(noteIndex) + "-counting";
        noteElement.parent().children("." + countingClass).remove();
        var extraTapClass = this.idForNoteIndex(noteIndex) + "-extraTap";
        noteElement.parent().children("." + extraTapClass).remove();
        if (!noteEvent.graded) {
            return;
        }
        var length = noteIndex == this.notes.length - 1 ? this.beatEvents.last.timing - noteEvent.timing : this.noteEvents.index(noteIndex + 1).timing - noteEvent.timing;
        var shouldShowNoteCount = !(note instanceof Rest) || noteEvent.timing === Math.floor(noteEvent.timing);
        var visibleCountings = (shouldShowNoteCount ? [0] : []).concat(noteEvent.offsetsToBeatsForLength(length));
        try {
            for (var visibleCountings_1 = __values(visibleCountings), visibleCountings_1_1 = visibleCountings_1.next(); !visibleCountings_1_1.done; visibleCountings_1_1 = visibleCountings_1.next()) {
                var relativeCounting = visibleCountings_1_1.value;
                var absoluteCounting = noteEvent.timing + relativeCounting;
                var noteAccuracy = 1;
                var beatAccuracy = 1;
                var tooltipContent = void 0;
                if (absoluteCounting === Math.floor(absoluteCounting)) {
                    var beatEvent = this.beatEvents.index(absoluteCounting);
                    beatAccuracy = beatEvent.accuracy(tempo);
                    if (!beatEvent.graded) {
                        return;
                    }
                    try {
                        //Render extra taps
                        for (var _c = (e_10 = void 0, __values(beatEvent.extraPerformanceAttempts)), _d = _c.next(); !_d.done; _d = _c.next()) {
                            var extraTap = _d.value;
                            var extraTapElement = $("<div class=\"extraTap " + extraTapClass + "\" title=\"\">\u2757\uFE0F<br/>Extra tap</div>");
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
                                content: "<div style=\"color: hsl(0,80%,40%)\">You added a tap " + TimingDescription.of(beatEvent.timing + extraTap, this.timeSignature, tempo).description(Verbosity.long) + "</div>"
                            });
                        }
                    }
                    catch (e_10_1) { e_10 = { error: e_10_1 }; }
                    finally {
                        try {
                            if (_d && !_d.done && (_b = _c.return)) _b.call(_c);
                        }
                        finally { if (e_10) throw e_10.error; }
                    }
                }
                if (relativeCounting === 0 && noteEvent.timing !== Math.floor(noteEvent.timing)) {
                    noteAccuracy = noteEvent.accuracy(tempo);
                }
                var hue = Piece.hueForAccuracy(Math.min(noteAccuracy, beatAccuracy));
                var countingElement = $("<div style=\"color: hsl(" + hue + ",80%,40%)\" class=\"counting " + countingClass + "\" title=\"\">&nbsp;" + TimingDescription.of(absoluteCounting, this.timeSignature, tempo).description(Verbosity.short) + "</div>");
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
                    var noteElement_1 = $("#" + this.idForNoteIndex(noteIndex));
                    tooltipContent = noteElement_1.tooltip("option", "content");
                }
                else {
                    var beatEvent = this.beatEvents.index(absoluteCounting);
                    if (beatEvent.bestPerformanceAttempt === undefined) {
                        tooltipContent = "<div style=\"color: hsl(" + hue + ",80%,40%)\">You didn't tap " + TimingDescription.of(beatEvent.timing, this.timeSignature, tempo).description(Verbosity.medium) + "</div>";
                    }
                    else {
                        tooltipContent = "<div style=\"color: hsl(" + hue + ",80%,40%)\">You tapped " + TimingDescription.of(beatEvent.timing + beatEvent.bestPerformanceAttempt, this.timeSignature, tempo).description(Verbosity.medium) + "</div>";
                    }
                }
                countingElement.tooltip({
                    content: tooltipContent
                });
            }
        }
        catch (e_9_1) { e_9 = { error: e_9_1 }; }
        finally {
            try {
                if (visibleCountings_1_1 && !visibleCountings_1_1.done && (_a = visibleCountings_1.return)) _a.call(visibleCountings_1);
            }
            finally { if (e_9) throw e_9.error; }
        }
    };
    Piece.barlineCharacter = "&nbsp;\ue030&nbsp;&nbsp;";
    Piece.finalBarlineCharacter = "&nbsp;\ue032";
    return Piece;
}());
/**
 * A music player which can play back a piece of music at a given tempo, and accept & grade performed claps.
 */
var Player = /** @class */ (function () {
    function Player(piece, tempo) {
        /** Called when the player starts playback. */
        this.onPlay = function () { };
        /** Called when the player ceases playback, either by pausing early or by finishing the piece. */
        this.onStop = function () { };
        /** Called when the player successfully finishes the piece. */
        this.onComplete = function () { };
        this.audioDelay = 0;
        this._piece = piece;
        this._tempo = tempo;
        this.backingLoop = Sound.backingLoop(piece.timeSignature, tempo, piece.backingLoopIndex);
    }
    Object.defineProperty(Player.prototype, "piece", {
        get: function () { return this._piece; },
        set: function (newValue) {
            if (this.isPlaying) {
                this.stop();
            }
            this._piece = newValue;
            this.backingLoop = Sound.backingLoop(newValue.timeSignature, this.tempo, newValue.backingLoopIndex);
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Player.prototype, "tempo", {
        get: function () { return this._tempo; },
        set: function (newValue) {
            if (this.isPlaying) {
                this.stop();
            }
            this._tempo = newValue;
            this.backingLoop = Sound.backingLoop(this.piece.timeSignature, newValue, this.piece.backingLoopIndex);
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Player.prototype, "timingCorrection", {
        get: function () {
            return Player.inputLatency - this.audioDelay;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Player.prototype, "isPlaying", {
        get: function () { return this.playback !== undefined; },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Player.prototype, "isCountingOff", {
        get: function () {
            if (this.playback === undefined) {
                return false;
            }
            return this.isPlaying && this.playback.nextNote < 0;
        },
        enumerable: false,
        configurable: true
    });
    /**
     * Begins playback, disabling tooltips on `piece` and calling `onPlay` if set. If already playing, does nothing.
     */
    Player.prototype.play = function (countOff) {
        if (countOff === void 0) { countOff = true; }
        if (this.isPlaying) {
            return;
        }
        if (this.piece === undefined) {
            return;
        }
        this.piece.showTooltips(false);
        this.rewind();
        var delayUntilStart = countOff ? this.piece.timeSignature.countoff.end * Player.beatLength(this.tempo) : 0;
        this.playback = {
            startTime: Date.now() + delayUntilStart,
            nextNote: (countOff ? -this.piece.timeSignature.countoff.notes.length : 0),
            nextBeat: 0,
            timerID: NaN,
            lastClap: -Infinity
        };
        this.playNote();
        this.onPlay();
    };
    Player.prototype.startBackingLoop = function () {
        var _a;
        if (!this.isPlaying) {
            return;
        }
        if (this.playback === undefined) {
            assertionFailure();
        }
        if (!Sound.usingWebAudio) {
            return;
        }
        var self = this;
        (_a = this.backingLoop) === null || _a === void 0 ? void 0 : _a.play(function () {
            if (!self.isPlaying) {
                return;
            }
            if (self.playback === undefined) {
                assertionFailure();
            }
            self.audioDelay = (self.backingLoop.seek * 1000) - (Date.now() - self.playback.startTime);
            console.log("Calculated audio delay: " + self.audioDelay + "ms");
        });
    };
    /**
     * Stops playback, re-enabling tooltips on `piece` and calling `onStop` if set. If playback has already been stopped, does nothing.
     */
    Player.prototype.stop = function () {
        var _a;
        if (!this.isPlaying) {
            return;
        }
        if (this.playback === undefined) {
            assertionFailure();
        }
        clearTimeout(this.playback.timerID);
        (_a = this.backingLoop) === null || _a === void 0 ? void 0 : _a.stop();
        this.playback = undefined;
        this.playerElement.stop(true);
        this.piece.showTooltips(true);
        this.onStop();
    };
    /**
     * Scrolls the player back to the start. You may only rewind while the player is stopped.
     */
    Player.prototype.rewind = function () {
        assert(!this.isPlaying);
        this.playerElement.animate({ scrollLeft: 0 }, 1000);
    };
    Object.defineProperty(Player.prototype, "playerElement", {
        /** The jQuery element on the page this player is controlling */
        get: function () {
            return $("#" + this.piece.idForNoteIndex(0)).parent();
        },
        enumerable: false,
        configurable: true
    });
    Player.prototype.gradeClap = function () {
        var e_11, _a;
        if (this.isCountingOff || !this.isPlaying) {
            return;
        }
        if (this.playback === undefined) {
            assertionFailure();
        }
        var clapTime = (Date.now() - this.timingCorrection - this.playback.startTime);
        var debounceTime = 100;
        if (clapTime - this.playback.lastClap <= debounceTime) {
            return;
        }
        this.playback.lastClap = clapTime;
        var affectedIndices = this.piece.noteEvents.gradePerformanceAttempt(clapTime / Player.beatLength(this.tempo));
        try {
            for (var affectedIndices_1 = __values(affectedIndices), affectedIndices_1_1 = affectedIndices_1.next(); !affectedIndices_1_1.done; affectedIndices_1_1 = affectedIndices_1.next()) {
                var i = affectedIndices_1_1.value;
                if (i == this.piece.notes.length) {
                    continue;
                }
                this.piece.updateAppearanceOfNoteAtIndex(i, this.tempo);
            }
        }
        catch (e_11_1) { e_11 = { error: e_11_1 }; }
        finally {
            try {
                if (affectedIndices_1_1 && !affectedIndices_1_1.done && (_a = affectedIndices_1.return)) _a.call(affectedIndices_1);
            }
            finally { if (e_11) throw e_11.error; }
        }
    };
    Player.prototype.gradeTap = function () {
        var e_12, _a;
        if (this.isCountingOff || !this.isPlaying) {
            return;
        }
        if (this.playback === undefined) {
            assertionFailure();
        }
        var tapTime = (Date.now() - this.timingCorrection - this.playback.startTime) / Player.beatLength(this.tempo);
        var affectedIndices = this.piece.beatEvents.gradePerformanceAttempt(tapTime);
        try {
            for (var affectedIndices_2 = __values(affectedIndices), affectedIndices_2_1 = affectedIndices_2.next(); !affectedIndices_2_1.done; affectedIndices_2_1 = affectedIndices_2.next()) {
                var i = affectedIndices_2_1.value;
                var noteIndex = this.piece.noteEvents.lastIndexBefore(this.piece.beatEvents.index(i).timing);
                this.piece.updateAppearanceOfNoteAtIndex(noteIndex, this.tempo);
            }
        }
        catch (e_12_1) { e_12 = { error: e_12_1 }; }
        finally {
            try {
                if (affectedIndices_2_1 && !affectedIndices_2_1.done && (_a = affectedIndices_2.return)) _a.call(affectedIndices_2);
            }
            finally { if (e_12) throw e_12.error; }
        }
    };
    /** Schedules playback of the next beat or note after the giving timing. Returns the time of the next note, even if it comes after the beat. */
    Player.prototype.scheduleNextPlay = function (beat) {
        if (this.playback === undefined) {
            assertionFailure();
        }
        var nextNoteTime;
        var nextBeatTime = undefined;
        if (this.isCountingOff) {
            var countoffIndex = this.playback.nextNote + this.piece.timeSignature.countoff.notes.length;
            var timing = this.piece.timeSignature.countoff.noteEvents.index(countoffIndex).timing - this.piece.timeSignature.countoff.end;
            nextNoteTime = this.playback.startTime + (timing * Player.beatLength(this.tempo));
        }
        else {
            var isAtEnd = this.playback.nextNote == this.piece.notes.length;
            var nextNoteTiming = isAtEnd ? this.piece.end : this.piece.noteEvents.index(this.playback.nextNote).timing;
            nextNoteTime = this.playback.startTime + (nextNoteTiming * Player.beatLength(this.tempo));
            if (this.playback.nextNote > 0) {
                var currentTiming = beat ? this.playback.nextBeat - 1 : this.piece.noteEvents.index(this.playback.nextNote - 1).timing;
                var nextBeat = Math.ceil(currentTiming + 0.01);
                if (nextNoteTiming > nextBeat) {
                    nextBeatTime = this.playback.startTime + (nextBeat * Player.beatLength(this.tempo));
                }
            }
        }
        var self = this;
        if (nextBeatTime !== undefined) {
            this.playback.timerID = window.setTimeout(function () { self.playBeat(); }, nextBeatTime - Date.now());
        }
        else {
            this.playback.timerID = window.setTimeout(function () { self.playNote(); }, nextNoteTime - Date.now());
        }
        return nextNoteTime;
    };
    Player.prototype.playBeat = function () {
        if (this.piece === undefined) {
            return;
        }
        if (this.playback === undefined) {
            return;
        }
        if (!this.isPlaying) {
            return;
        }
        this.handleBeat();
        this.scheduleNextPlay(true);
    };
    Player.prototype.handleBeat = function () {
        if (this.piece === undefined) {
            return;
        }
        if (this.playback === undefined) {
            return;
        }
        if (!this.isPlaying) {
            return;
        }
        if (!Sound.usingWebAudio) {
            Sound.beat.play();
        }
        this.piece.beatEvents.enableGradingThrough(this.playback.nextBeat);
        if (this.playback.nextNote > 0 && this.playback.nextNote <= this.piece.notes.length) {
            this.piece.updateAppearanceOfNoteAtIndex(this.playback.nextNote - 1, this.tempo);
        }
        this.playback.nextBeat += 1;
    };
    Player.prototype.playNote = function () {
        var _a;
        if (this.piece === undefined) {
            return;
        }
        if (this.playback === undefined) {
            return;
        }
        if (this.playback.nextNote >= this.piece.notes.length) {
            this.piece.beatEvents.enableGradingThrough(this.piece.end);
            this.piece.updateAppearanceOfNoteAtIndex(this.piece.notes.length - 1, this.tempo);
            this.stop();
            this.onComplete();
        }
        if (!this.isPlaying) {
            return;
        }
        if (this.playback.nextNote === 0) {
            this.startBackingLoop();
        }
        var currentNote = this.isCountingOff ? this.piece.timeSignature.countoff.notes[this.playback.nextNote + this.piece.timeSignature.countoff.notes.length] : this.piece.notes[this.playback.nextNote];
        (_a = currentNote.sound) === null || _a === void 0 ? void 0 : _a.play();
        var noteElement = undefined;
        if (!this.isCountingOff) {
            var timing = this.piece.noteEvents.index(this.playback.nextNote).timing;
            if (timing >= this.playback.nextBeat) {
                this.handleBeat();
            }
            noteElement = $("#" + this.piece.idForNoteIndex(this.playback.nextNote));
            this.piece.noteEvents.index(this.playback.nextNote).graded = true;
            if (this.playback.nextNote > 0) {
                this.piece.updateAppearanceOfNoteAtIndex(this.playback.nextNote - 1, this.tempo);
            }
            this.piece.updateAppearanceOfNoteAtIndex(this.playback.nextNote, this.tempo);
        }
        this.playback.nextNote += 1;
        var nextNoteTime = this.scheduleNextPlay(false);
        if (noteElement && this.playback.nextNote > 0 && this.playback.nextNote < this.piece.notes.length) {
            var nextNoteElement = $("#" + this.piece.idForNoteIndex(this.playback.nextNote));
            var scrollMargin = vw(20);
            var newScrollPosition = void 0;
            if (nextNoteElement === undefined) {
                newScrollPosition = noteElement[0].offsetLeft;
            }
            else {
                newScrollPosition = nextNoteElement[0].offsetLeft;
            }
            noteElement.parent().animate({ scrollLeft: newScrollPosition - scrollMargin }, nextNoteTime - Date.now(), "linear");
        }
    };
    Player.beatLength = function (tempo) {
        assert(tempo > 0);
        return 1000 * 60 / tempo;
    };
    ;
    Player.inputLatency = 30;
    return Player;
}());
