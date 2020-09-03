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

            case "randomTest": {
                const blocks = [
                    new Block([Note.whole]),
                    new Block([Note.half]),
                    new Block([Note.quarter]),
                    new Block([Note.half.dotted])
                ];
                return new Level("Random Level", Piece.randomWithBlocks(blocks, TimeSignature.fourFour, 8));
            }

            default: assertionFailure("unknown level!");
        }
    }
}