/// <reference path="music.ts" />

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

    static forID(id: string): Level {
        switch (id) {
            case "sixEightTest": {
                const piece = new Piece(TimeSignature.sixEight, [
                    Note.quarter,
                    Note.eighth,
                    Note.eighth,
                    Note.sixteenth,
                    Note.sixteenth,
                    Note.eighth,
                    Note.eighth,
                    Note.quarter,
                    Note.quarter.dotted
                ]);
                return new Level("6/8 Test Level", piece);
            }

            case "fiveFourTest": {
                const piece = new Piece(TimeSignature.fiveFour, [
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
                ]);
                return new Level("5/4 Test Level", piece);
            }

            case "easyFiveFourTest": {
                const piece = new Piece(TimeSignature.fiveFour, [
                    Note.quarter,
                    Note.eighth,
                    Note.eighth,
                    Note.half,
                    Note.quarter,
                    Note.whole,
                    Note.quarter,
                    Note.quarter,
                    Note.half,
                    Note.quarter,
                    Note.quarter
                ]);
                return new Level("5/4 Easy Level", piece);
            }

            case "randomEasy": {
                const blocks = [
                    new Block([Note.whole]),
                    new Block([Note.half]),
                    new Block([Note.quarter]),
                    new Block([Note.half.dotted]),
                    new Block([Note.eighth, Note.eighth]),
                    new Block([Note.quarter.dotted, Note.eighth])
                ];
                return new Level("Random Easy Level", Piece.randomWithBlocks(blocks, TimeSignature.threeFour, 8));
            }

            case "randomHard": {
                const blocks = [
                    new Block([Note.whole]),
                    new Block([Note.half]),
                    new Block([Note.quarter]),
                    new Block([Note.half.dotted]),
                    new Block([Note.eighth, Note.eighth]),
                    new Block([Note.quarter.dotted, Note.eighth]),
                    new Block([Note.eighth, Note.sixteenth, Note.sixteenth]),
                    new Block([Note.sixteenth, Note.sixteenth, Note.eighth]),
                    new Block([Note.sixteenth, Note.sixteenth, Note.sixteenth, Note.sixteenth])
                ];
                return new Level("Random Hard Level", Piece.randomWithBlocks(blocks, TimeSignature.fiveFour, 8));
            }

            default: assertionFailure("unknown level!");
        }
    }
}