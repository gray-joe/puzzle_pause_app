import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Alert } from 'react-native';
import type {
    ChessPuzzle,
    ChoicePuzzle,
    ClueRevealPuzzle,
    ConnectionsPuzzle,
    CountdownPuzzle,
    ImageWordPuzzle,
    LadderPuzzle,
    MatchPuzzle,
    NumGridPuzzle,
    OrderPuzzle,
    Puzzle,
    ScrabblePuzzle,
    TextPuzzle,
    WordWheelPuzzle,
    WordsearchPuzzle,
} from '../../api/schemas';
import {
    allText,
    changeText,
    findAllByHost,
    findByHost,
    findPressableByText,
    press,
    render,
    submitEditing,
    textContent,
} from '../../test/render';
import { ChessPuzzleView } from './ChessPuzzle';
import { ChoicePuzzleView } from './ChoicePuzzle';
import { ClueRevealPuzzleView } from './ClueRevealPuzzle';
import { ConnectionsPuzzleView } from './ConnectionsPuzzle';
import { CountdownPuzzleView } from './CountdownPuzzle';
import { ImageWordPuzzleView } from './ImageWordPuzzle';
import { LadderPuzzleView } from './LadderPuzzle';
import { MatchPuzzleView } from './MatchPuzzle';
import { NumGridPuzzleView } from './NumGridPuzzle';
import { OrderPuzzleView } from './OrderPuzzle';
import { PuzzleRenderer, type PuzzleInteractionProps } from './PuzzleRenderer';
import { ScrabblePuzzleView } from './ScrabblePuzzle';
import { TextAnswerPuzzle } from './TextAnswerPuzzle';
import { WordWheelPuzzleView } from './WordWheelPuzzle';
import { WordsearchPuzzleView } from './WordsearchPuzzle';

const interactionProps: PuzzleInteractionProps = {
    onSubmit: vi.fn(),
    onHint: vi.fn(),
    onGiveUp: vi.fn(),
    isSubmitting: false,
    isHinting: false,
    isGivingUp: false,
    submitError: undefined,
    hintsRevealed: [],
    canHint: true,
};

const basePuzzle = {
    id: 1,
    puzzle_date: '2026-05-07',
    puzzle_name: 'Component Puzzle',
    puzzle_number: 42,
    hint: null,
    has_hint: true,
    total_hints: 2,
};

function textPuzzle(overrides: Partial<TextPuzzle> = {}): TextPuzzle {
    return {
        ...basePuzzle,
        puzzle_type: 'word',
        question: '<p>Guess the word</p>',
        ...overrides,
    } as TextPuzzle;
}

function choicePuzzle(): ChoicePuzzle {
    return {
        ...basePuzzle,
        puzzle_type: 'choice',
        question: { prompt: 'Pick one', options: ['Alpha', 'Beta'] },
    } as ChoicePuzzle;
}

function chessPuzzle(overrides: Partial<ChessPuzzle> = {}): ChessPuzzle {
    return {
        ...basePuzzle,
        puzzle_type: 'chess',
        question: {
            fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4',
        },
        ...overrides,
    } as ChessPuzzle;
}

function ladderPuzzle(): LadderPuzzle {
    return textPuzzle({
        puzzle_type: 'ladder',
        question: '<p>CAT<br>___<br>___<br>___<br>___<br>DOG</p>',
    }) as LadderPuzzle;
}

function cluePuzzle(): ClueRevealPuzzle {
    return {
        ...basePuzzle,
        puzzle_type: 'clue-reveal',
        question: { prompt: 'Who am I?', clues: ['First clue', 'Second clue'] },
    } as ClueRevealPuzzle;
}

function imagePuzzle(): ImageWordPuzzle {
    return {
        ...basePuzzle,
        puzzle_type: 'image-word',
        question: {
            prompt: 'Name this image',
            image_url: 'https://puzzlepause.app/image.jpg',
        },
    } as ImageWordPuzzle;
}

function countdownPuzzle(): CountdownPuzzle {
    return {
        ...basePuzzle,
        puzzle_type: 'countdown',
        question: {
            prompt: 'Reach the target using the numbers and operators below:',
            target: 306,
            numbers: [75, 50, 6, 3, 2, 1],
            operators: ['+', '-', '×', '÷'],
        },
    } as CountdownPuzzle;
}

function orderPuzzle(): OrderPuzzle {
    return {
        ...basePuzzle,
        puzzle_type: 'order',
        question: {
            prompt: 'Sort these words into alphabetical order:',
            items: ['One', 'Two', 'Three'],
        },
    } as OrderPuzzle;
}

function wordWheelPuzzle(): WordWheelPuzzle {
    return {
        ...basePuzzle,
        puzzle_type: 'word-wheel',
        question: {
            prompt: 'Find the 8-letter word hidden in each wheel.',
            wheels: [
                { letters: ['S', 'T', null, 'R', 'L', 'I', null, 'G'] },
                { letters: [null, 'L', 'I', 'M', null, 'I', 'N', 'G'] },
            ],
        },
    } as WordWheelPuzzle;
}

function scrabblePuzzle(): ScrabblePuzzle {
    return {
        ...basePuzzle,
        puzzle_type: 'scrabble',
        question: {
            prompt: 'What is the highest scoring word achievable with these letters?',
            board: [null, null, null, null, null, null, null],
            modifiers: [null, null, 'tl', null, null, 'dw', null],
            rack: ['C', 'O', 'R', 'M', 'A', 'N', 'E'],
        },
    } as ScrabblePuzzle;
}

function numgridPuzzle(): NumGridPuzzle {
    return {
        ...basePuzzle,
        puzzle_type: 'numgrid',
        question: {
            prompt: 'What number is missing from this grid?',
            grid: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, null, 12, 13, 14, 15, 16],
        },
    } as NumGridPuzzle;
}

function wordsearchPuzzle(question?: string): WordsearchPuzzle {
    return {
        ...basePuzzle,
        puzzle_type: 'wordsearch',
        question: question ?? 'A B C D E\nF G H I J\nE A R T H\nK L M N O\nP Q R S T\nFind: EARTH',
    } as WordsearchPuzzle;
}

function matchPuzzle(): MatchPuzzle {
    return {
        ...basePuzzle,
        puzzle_type: 'match',
        question: {
            prompt: 'Match each country to its capital city:',
            left: ['France', 'Japan', 'Brazil', 'Australia'],
            right: ['Canberra', 'Paris', 'Brasilia', 'Tokyo'],
        },
    } as MatchPuzzle;
}

function connectionsPuzzle(overrides: Partial<ConnectionsPuzzle> = {}): ConnectionsPuzzle {
    return {
        ...basePuzzle,
        puzzle_type: 'connections',
        total_hints: 3,
        question: {
            prompt: 'Group these 9 words into 3 categories of 3:',
            items: [
                'Apple',
                'Banana',
                'Cherry',
                'Carrot',
                'Broccoli',
                'Spinach',
                'Red',
                'Blue',
                'Green',
            ],
        },
        ...overrides,
    } as ConnectionsPuzzle;
}

describe('TextAnswerPuzzle', () => {
    it('trims and submits typed answers', () => {
        const onSubmit = vi.fn();
        const renderer = render(
            <TextAnswerPuzzle {...interactionProps} puzzle={textPuzzle()} onSubmit={onSubmit} />
        );

        changeText(findByHost(renderer, 'TextInput'), '  answer  ');
        press(findPressableByText(renderer, 'Submit')!);

        expect(onSubmit).toHaveBeenCalledWith('answer');
    });

    it('disables empty submissions and displays hints/errors', () => {
        const renderer = render(
            <TextAnswerPuzzle
                {...interactionProps}
                puzzle={textPuzzle()}
                submitError="Try again"
                hintsRevealed={['Think smaller']}
            />
        );

        expect(findPressableByText(renderer, 'Submit')?.props.disabled).toBe(true);
        expect(allText(renderer)).toContain('Try again');
        expect(allText(renderer)).toContain('Hint: Think smaller');
        expect(allText(renderer)).toContain('Hint');
    });
});

describe('ChessPuzzleView', () => {
    it('renders the FEN position and submits a tapped move as lowercase UCI', () => {
        const onSubmit = vi.fn();
        const renderer = render(
            <ChessPuzzleView
                {...interactionProps}
                puzzle={chessPuzzle()}
                onSubmit={onSubmit}
                hintsRevealed={['The queen and bishop both target f7']}
            />
        );

        expect(allText(renderer)).toContain('White to move, mate in 1');
        expect(allText(renderer)).toContain('Hint: The queen and bishop both target f7');

        const square = (label: string) =>
            findAllByHost(renderer, 'Pressable').find(
                (node) => node.props.accessibilityLabel === label
            )!;
        expect(square('h5, white queen')).toBeDefined();
        press(square('h5, white queen'));
        expect(allText(renderer)).toContain('Selected h5. Choose a destination.');
        press(square('f7, black pawn'));
        expect(allText(renderer)).toContain('Move: h5 → f7');
        press(findPressableByText(renderer, 'Submit')!);

        expect(onSubmit).toHaveBeenCalledWith('h5f7');
    });

    it('uses the FEN side-to-move field for the prompt', () => {
        const renderer = render(
            <ChessPuzzleView
                {...interactionProps}
                puzzle={chessPuzzle({
                    question: {
                        fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR b KQkq - 0 1',
                    },
                })}
            />
        );

        expect(allText(renderer)).toContain('Black to move, mate in 1');
        expect(findAllByHost(renderer, 'Pressable')[0]?.props.accessibilityLabel).toBe(
            'h1, white rook'
        );
    });

    it('adds the selected promotion piece to the UCI move', () => {
        const onSubmit = vi.fn();
        const renderer = render(
            <ChessPuzzleView
                {...interactionProps}
                puzzle={chessPuzzle({
                    question: { fen: '7k/4P3/8/8/8/8/8/K7 w - - 0 1' },
                })}
                onSubmit={onSubmit}
            />
        );
        const square = (label: string) =>
            findAllByHost(renderer, 'Pressable').find(
                (node) => node.props.accessibilityLabel === label
            )!;

        press(square('e7, white pawn'));
        press(square('e8, empty'));

        expect(allText(renderer)).toContain('Promote to');
        expect(findPressableByText(renderer, 'Submit')?.props.disabled).toBe(true);

        press(findPressableByText(renderer, 'Queen')!);
        press(findPressableByText(renderer, 'Submit')!);

        expect(onSubmit).toHaveBeenCalledWith('e7e8q');
    });
});

describe('ChoicePuzzleView', () => {
    it('submits the selected choice and displays feedback', () => {
        const onSubmit = vi.fn();
        const renderer = render(
            <ChoicePuzzleView
                {...interactionProps}
                puzzle={choicePuzzle()}
                onSubmit={onSubmit}
                submitError="Not quite"
                hintsRevealed={['Alphabetical']}
            />
        );

        press(findPressableByText(renderer, 'Beta')!);

        expect(onSubmit).toHaveBeenCalledWith('B');
        expect(allText(renderer)).toContain('Pick one');
        expect(allText(renderer)).toContain('Not quite');
        expect(allText(renderer)).toContain('Hint: Alphabetical');
    });

    it('disables choice buttons while submitting', () => {
        const renderer = render(
            <ChoicePuzzleView {...interactionProps} puzzle={choicePuzzle()} isSubmitting />
        );

        expect(findPressableByText(renderer, 'Alpha')?.props.disabled).toBe(true);
        expect(findPressableByText(renderer, 'Beta')?.props.disabled).toBe(true);
    });
});

describe('LadderPuzzleView', () => {
    it('submits four trimmed ladder steps as the expected answer chain', () => {
        const onSubmit = vi.fn();
        const renderer = render(
            <LadderPuzzleView {...interactionProps} puzzle={ladderPuzzle()} onSubmit={onSubmit} />
        );
        const inputs = findAllByHost(renderer, 'TextInput');

        changeText(inputs[0]!, '  cot ');
        changeText(inputs[1]!, ' dot');
        changeText(inputs[2]!, ' dig ');
        changeText(inputs[3]!, 'dug');
        press(findPressableByText(renderer, 'Submit')!);

        expect(inputs).toHaveLength(4);
        expect(onSubmit).toHaveBeenCalledWith('cot,dot,dig,dug');
    });

    it('requires all ladder steps before submitting', () => {
        const renderer = render(
            <LadderPuzzleView
                {...interactionProps}
                puzzle={ladderPuzzle()}
                submitError="Not quite"
                hintsRevealed={['Change one letter each step']}
            />
        );

        expect(findPressableByText(renderer, 'Submit')?.props.disabled).toBe(true);
        expect(allText(renderer)).toContain('Step 1');
        expect(allText(renderer)).toContain('Not quite');
        expect(allText(renderer)).toContain('Hint: Change one letter each step');
    });
});

describe('ClueRevealPuzzleView', () => {
    it('shows visible clues, requests more clues, and submits guesses', () => {
        const onHint = vi.fn();
        const onSubmit = vi.fn();
        const renderer = render(
            <ClueRevealPuzzleView
                {...interactionProps}
                puzzle={cluePuzzle()}
                onHint={onHint}
                onSubmit={onSubmit}
                hintsRevealed={['Second clue']}
            />
        );

        expect(allText(renderer)).toContain('First clue');
        expect(allText(renderer)).toContain('Second clue');

        press(findPressableByText(renderer, 'Next clue')!);
        changeText(findByHost(renderer, 'TextInput'), '  solution  ');
        press(findPressableByText(renderer, 'Submit')!);

        expect(onHint).toHaveBeenCalledTimes(1);
        expect(onSubmit).toHaveBeenCalledWith('solution');
    });
});

describe('ImageWordPuzzleView', () => {
    it('renders the image prompt and submits guesses', () => {
        const onSubmit = vi.fn();
        const renderer = render(
            <ImageWordPuzzleView
                {...interactionProps}
                puzzle={imagePuzzle()}
                onSubmit={onSubmit}
                hintsRevealed={['Look closely']}
            />
        );

        const image = findByHost(renderer, 'Image');
        changeText(findByHost(renderer, 'TextInput'), 'image answer');
        press(findPressableByText(renderer, 'Submit')!);

        expect(image.props.source).toEqual({ uri: 'https://puzzlepause.app/image.jpg' });
        expect(allText(renderer)).toContain('Name this image');
        expect(allText(renderer)).toContain('Hint: Look closely');
        expect(onSubmit).toHaveBeenCalledWith('image answer');
    });
});

describe('CountdownPuzzleView', () => {
    it('builds expressions, shows totals, and submits evaluated results', () => {
        const onSubmit = vi.fn();
        const renderer = render(
            <CountdownPuzzleView
                {...interactionProps}
                puzzle={countdownPuzzle()}
                onSubmit={onSubmit}
            />
        );

        expect(allText(renderer)).toContain('Reach the target');
        expect(allText(renderer)).toContain('306');
        expect(findPressableByText(renderer, 'Submit')?.props.disabled).toBe(true);

        press(findPressableByText(renderer, '75')!);
        press(findPressableByText(renderer, '+')!);
        press(findPressableByText(renderer, '50')!);
        press(findPressableByText(renderer, 'Show total')!);

        expect(allText(renderer)).toContain('75 + 50');
        expect(allText(renderer)).toContain('Total: 125');

        press(findPressableByText(renderer, 'Submit')!);

        expect(onSubmit).toHaveBeenCalledWith('125');
    });

    it('disables used number tiles and frees them on backspace', () => {
        const renderer = render(
            <CountdownPuzzleView {...interactionProps} puzzle={countdownPuzzle()} />
        );

        press(findPressableByText(renderer, '75')!);
        expect(findPressableByText(renderer, '75')?.props.disabled).toBe(true);

        press(findPressableByText(renderer, 'Backspace')!);

        expect(findPressableByText(renderer, '75')?.props.disabled).toBe(false);
    });

    it('clears expressions and displays hints/errors', () => {
        const renderer = render(
            <CountdownPuzzleView
                {...interactionProps}
                puzzle={countdownPuzzle()}
                submitError="Not quite"
                hintsRevealed={['50 × 6 is a great start']}
            />
        );

        press(findPressableByText(renderer, '75')!);
        press(findPressableByText(renderer, 'Clear')!);

        expect(allText(renderer)).toContain('Build your expression');
        expect(allText(renderer)).toContain('Not quite');
        expect(allText(renderer)).toContain('Hint: 50 × 6 is a great start');
    });
});

describe('OrderPuzzleView', () => {
    it('reorders items and submits original item indices', () => {
        const onSubmit = vi.fn();
        const renderer = render(
            <OrderPuzzleView {...interactionProps} puzzle={orderPuzzle()} onSubmit={onSubmit} />
        );

        const downButtons = findAllByHost(renderer, 'Pressable').filter((node) =>
            textContent(node).includes('Down')
        );
        press(downButtons[0]!);
        press(findPressableByText(renderer, 'Submit')!);

        expect(allText(renderer)).toContain('Sort these words into alphabetical order:');
        expect(onSubmit).toHaveBeenCalledWith('1,0,2');
    });

    it('displays hints and submit errors', () => {
        const renderer = render(
            <OrderPuzzleView
                {...interactionProps}
                puzzle={orderPuzzle()}
                submitError="Not quite"
                hintsRevealed={['Start with One']}
            />
        );

        expect(allText(renderer)).toContain('Not quite');
        expect(allText(renderer)).toContain('Hint: Start with One');
    });
});

describe('WordWheelPuzzleView', () => {
    it('uppercases inputs and submits one word per wheel', () => {
        const onSubmit = vi.fn();
        const renderer = render(
            <WordWheelPuzzleView
                {...interactionProps}
                puzzle={wordWheelPuzzle()}
                onSubmit={onSubmit}
            />
        );

        let inputs = findAllByHost(renderer, 'TextInput');
        expect(findPressableByText(renderer, 'Submit')?.props.disabled).toBe(true);
        expect(allText(renderer)).toContain('?');

        changeText(inputs[0]!, 'starling');
        changeText(inputs[1]!, ' climbing ');
        inputs = findAllByHost(renderer, 'TextInput');
        submitEditing(inputs[1]!);

        expect(inputs[0]?.props.value).toBe('STARLING');
        expect(inputs[1]?.props.value).toBe(' CLIMBING ');
        expect(onSubmit).toHaveBeenCalledWith('STARLING CLIMBING');
    });

    it('displays hints and submit errors', () => {
        const renderer = render(
            <WordWheelPuzzleView
                {...interactionProps}
                puzzle={wordWheelPuzzle()}
                submitError="Not quite"
                hintsRevealed={['Both words are outdoorsy']}
            />
        );

        expect(allText(renderer)).toContain('Not quite');
        expect(allText(renderer)).toContain('Hint: Both words are outdoorsy');
    });
});

describe('ScrabblePuzzleView', () => {
    it('renders board, modifiers, and rack, then submits and clears trimmed answers', () => {
        const onSubmit = vi.fn();
        const renderer = render(
            <ScrabblePuzzleView
                {...interactionProps}
                puzzle={scrabblePuzzle()}
                onSubmit={onSubmit}
            />
        );

        expect(allText(renderer)).toContain('What is the highest scoring word');
        expect(allText(renderer)).toContain('_');
        expect(allText(renderer)).toContain('Triple Letter');
        expect(allText(renderer)).toContain('Double Word');
        expect(allText(renderer)).toContain('C');
        expect(findPressableByText(renderer, 'Submit')?.props.disabled).toBe(true);

        changeText(findByHost(renderer, 'TextInput'), '  romance 34  ');
        press(findPressableByText(renderer, 'Submit')!);

        expect(onSubmit).toHaveBeenCalledWith('romance 34');
        expect(findByHost(renderer, 'TextInput').props.value).toBe('');
    });

    it('displays hints and submit errors', () => {
        const renderer = render(
            <ScrabblePuzzleView
                {...interactionProps}
                puzzle={scrabblePuzzle()}
                submitError="Not quite"
                hintsRevealed={['Use all 7 letters']}
            />
        );

        expect(allText(renderer)).toContain('Not quite');
        expect(allText(renderer)).toContain('Hint: Use all 7 letters');
    });
});

describe('NumGridPuzzleView', () => {
    it('renders the grid, filters numeric input, then submits and clears trimmed answers', () => {
        const onSubmit = vi.fn();
        const renderer = render(
            <NumGridPuzzleView {...interactionProps} puzzle={numgridPuzzle()} onSubmit={onSubmit} />
        );

        expect(allText(renderer)).toContain('What number is missing from this grid?');
        expect(allText(renderer)).toContain('?');
        expect(findPressableByText(renderer, 'Submit')?.props.disabled).toBe(true);

        const input = findByHost(renderer, 'TextInput');
        changeText(input, 'abc');
        expect(findByHost(renderer, 'TextInput').props.value).toBe('');

        changeText(findByHost(renderer, 'TextInput'), '-11.5');
        press(findPressableByText(renderer, 'Submit')!);

        expect(onSubmit).toHaveBeenCalledWith('-11.5');
        expect(findByHost(renderer, 'TextInput').props.value).toBe('');
    });

    it('displays hints and submit errors', () => {
        const renderer = render(
            <NumGridPuzzleView
                {...interactionProps}
                puzzle={numgridPuzzle()}
                submitError="Not quite"
                hintsRevealed={['Count the rows']}
            />
        );

        expect(allText(renderer)).toContain('Not quite');
        expect(allText(renderer)).toContain('Hint: Count the rows');
    });
});

describe('WordsearchPuzzleView', () => {
    it('renders single-word grids and submits uppercase letter-only guesses', () => {
        const onSubmit = vi.fn();
        const renderer = render(
            <WordsearchPuzzleView
                {...interactionProps}
                puzzle={wordsearchPuzzle()}
                onSubmit={onSubmit}
            />
        );

        expect(allText(renderer)).toContain('A B C D E');
        expect(allText(renderer)).toContain('Find: EARTH');
        expect(findPressableByText(renderer, 'Submit')?.props.disabled).toBe(true);

        changeText(findByHost(renderer, 'TextInput'), 'earth-123');
        press(findPressableByText(renderer, 'Submit')!);

        expect(findByHost(renderer, 'TextInput').props.value).toBe('EARTH');
        expect(onSubmit).toHaveBeenCalledWith('EARTH');
    });

    it('renders one input per requested word in count mode', () => {
        const onSubmit = vi.fn();
        const renderer = render(
            <WordsearchPuzzleView
                {...interactionProps}
                puzzle={wordsearchPuzzle(
                    'E A R T H\nM A R S X\nV E N U S\nFind: 3\nTheme: Planets'
                )}
                onSubmit={onSubmit}
            />
        );

        const inputs = findAllByHost(renderer, 'TextInput');
        expect(inputs).toHaveLength(3);
        expect(allText(renderer)).toContain('Theme: Planets');
        expect(allText(renderer)).toContain('Find 3 words');
        expect(allText(renderer)).not.toContain('Find: 3');

        changeText(inputs[0]!, 'venus');
        changeText(inputs[1]!, 'earth');
        changeText(inputs[2]!, 'mars');
        press(findPressableByText(renderer, 'Submit')!);

        expect(onSubmit).toHaveBeenCalledWith('VENUS EARTH MARS');
    });

    it('displays hints and submit errors', () => {
        const renderer = render(
            <WordsearchPuzzleView
                {...interactionProps}
                puzzle={wordsearchPuzzle()}
                submitError="Not quite"
                hintsRevealed={['The third planet from the Sun']}
            />
        );

        expect(allText(renderer)).toContain('Not quite');
        expect(allText(renderer)).toContain('Hint: The third planet from the Sun');
    });
});

describe('MatchPuzzleView', () => {
    it('assigns right items to selected left items and submits right indices in left order', () => {
        const onSubmit = vi.fn();
        const renderer = render(
            <MatchPuzzleView {...interactionProps} puzzle={matchPuzzle()} onSubmit={onSubmit} />
        );

        expect(allText(renderer)).toContain('Match each country to its capital city:');
        expect(findPressableByText(renderer, 'Canberra')?.props.disabled).toBe(true);
        expect(findPressableByText(renderer, 'Submit')?.props.disabled).toBe(true);

        press(findPressableByText(renderer, 'France')!);
        press(findPressableByText(renderer, 'Paris')!);
        press(findPressableByText(renderer, 'Japan')!);
        press(findPressableByText(renderer, 'Tokyo')!);
        press(findPressableByText(renderer, 'Brazil')!);
        press(findPressableByText(renderer, 'Brasilia')!);
        press(findPressableByText(renderer, 'Australia')!);
        press(findPressableByText(renderer, 'Canberra')!);
        press(findPressableByText(renderer, 'Submit')!);

        expect(onSubmit).toHaveBeenCalledWith('1,3,2,0');
    });

    it('reassigns used right items away from their previous left item', () => {
        const renderer = render(<MatchPuzzleView {...interactionProps} puzzle={matchPuzzle()} />);

        press(findPressableByText(renderer, 'France')!);
        press(findPressableByText(renderer, 'Paris')!);
        press(findPressableByText(renderer, 'Japan')!);
        press(
            findAllByHost(renderer, 'Pressable').find((node) =>
                textContent(node).includes('Matched to France')
            )!
        );

        expect(allText(renderer)).toContain('Matched to Japan');
        expect(findPressableByText(renderer, 'Submit')?.props.disabled).toBe(true);
    });

    it('displays hints and submit errors', () => {
        const renderer = render(
            <MatchPuzzleView
                {...interactionProps}
                puzzle={matchPuzzle()}
                submitError="Not quite"
                hintsRevealed={['Think capitals']}
            />
        );

        expect(allText(renderer)).toContain('Not quite');
        expect(allText(renderer)).toContain('Hint: Think capitals');
    });
});

describe('ConnectionsPuzzleView', () => {
    it('assigns items to groups and submits sorted groups joined by pipes', () => {
        const onSubmit = vi.fn();
        const renderer = render(
            <ConnectionsPuzzleView
                {...interactionProps}
                puzzle={connectionsPuzzle()}
                onSubmit={onSubmit}
                hintsRevealed={['Fruits']}
            />
        );

        expect(allText(renderer)).toContain('Group these 9 words into 3 categories of 3:');
        expect(allText(renderer)).toContain('Fruits');
        expect(findPressableByText(renderer, 'Submit')?.props.disabled).toBe(true);

        press(findPressableByText(renderer, 'Apple')!);
        press(findPressableByText(renderer, 'Banana')!);
        press(findPressableByText(renderer, 'Cherry')!);
        press(findPressableByText(renderer, 'Group 2')!);
        press(findPressableByText(renderer, 'Carrot')!);
        press(findPressableByText(renderer, 'Broccoli')!);
        press(findPressableByText(renderer, 'Spinach')!);
        press(findPressableByText(renderer, 'Group 3')!);
        press(findPressableByText(renderer, 'Red')!);
        press(findPressableByText(renderer, 'Blue')!);
        press(findPressableByText(renderer, 'Green')!);
        press(findPressableByText(renderer, 'Submit')!);

        expect(onSubmit).toHaveBeenCalledWith('0,1,2|3,4,5|6,7,8');
    });

    it('moves items between groups and keeps submit disabled until all are assigned', () => {
        const renderer = render(
            <ConnectionsPuzzleView {...interactionProps} puzzle={connectionsPuzzle()} />
        );

        press(findPressableByText(renderer, 'Apple')!);
        press(findPressableByText(renderer, 'Group 2')!);
        press(findPressableByText(renderer, 'Apple')!);

        expect(allText(renderer)).toContain('Group 2');
        expect(findPressableByText(renderer, 'Submit')?.props.disabled).toBe(true);
    });

    it('falls back to prompt category count when total_hints is not usable', () => {
        const renderer = render(
            <ConnectionsPuzzleView
                {...interactionProps}
                puzzle={connectionsPuzzle({ total_hints: 1 })}
            />
        );

        expect(allText(renderer)).toContain('Group 3');
    });

    it('displays submit errors and revealed category hints', () => {
        const renderer = render(
            <ConnectionsPuzzleView
                {...interactionProps}
                puzzle={connectionsPuzzle()}
                submitError="Not quite"
                hintsRevealed={['Fruits', 'Vegetables']}
            />
        );

        expect(allText(renderer)).toContain('Not quite');
        expect(allText(renderer)).toContain('Hint: Fruits');
        expect(allText(renderer)).toContain('Vegetables');
    });
});

describe('PuzzleRenderer', () => {
    it.each([
        [textPuzzle(), 'Your answer'],
        [ladderPuzzle(), 'Step 1'],
        [choicePuzzle(), 'Pick one'],
        [imagePuzzle(), 'Name this image'],
        [cluePuzzle(), 'Who am I?'],
        [countdownPuzzle(), 'Reach the target'],
        [orderPuzzle(), 'Sort these words'],
        [wordWheelPuzzle(), 'Find the 8-letter word'],
        [scrabblePuzzle(), 'What is the highest scoring word'],
        [numgridPuzzle(), 'What number is missing'],
        [wordsearchPuzzle(), 'Wordsearch'],
        [matchPuzzle(), 'Match each country'],
        [connectionsPuzzle(), 'Group these 9 words'],
        [chessPuzzle(), 'White to move, mate in 1'],
    ])('renders the matching puzzle view for %s', (puzzle, expectedText) => {
        const renderer = render(<PuzzleRenderer {...interactionProps} puzzle={puzzle as Puzzle} />);

        expect(allText(renderer)).toContain(expectedText);
        expect(allText(renderer)).toContain('Solve within 10 mins for 100 pts');
    });

    it('passes text puzzle HTML into the HTML renderer', () => {
        const renderer = render(<PuzzleRenderer {...interactionProps} puzzle={textPuzzle()} />);

        expect(findAllByHost(renderer, 'RenderHtml')[0]?.props.source).toEqual({
            html: '<p>Guess the word</p>',
        });
    });

    it('asks for confirmation before giving up', () => {
        const onGiveUp = vi.fn();
        const renderer = render(
            <PuzzleRenderer {...interactionProps} onGiveUp={onGiveUp} puzzle={textPuzzle()} />
        );

        press(findPressableByText(renderer, 'Give up (score 0)')!);

        expect(Alert.alert).toHaveBeenCalledWith(
            'Give up?',
            'This will end the puzzle with a score of 0 and reveal the solution.',
            expect.any(Array)
        );
        expect(onGiveUp).not.toHaveBeenCalled();

        const [, , buttons] = vi.mocked(Alert.alert).mock.calls[0] as [
            string,
            string,
            { onPress?: () => void }[],
        ];
        buttons[0]!.onPress?.();
        expect(onGiveUp).not.toHaveBeenCalled();

        buttons[1]!.onPress!();
        expect(onGiveUp).toHaveBeenCalledTimes(1);
    });

    it('renders unsupported puzzle fallback for unknown puzzle types', () => {
        const renderer = render(
            <PuzzleRenderer
                {...interactionProps}
                puzzle={
                    {
                        ...basePuzzle,
                        puzzle_type: 'future-puzzle',
                        question: 'Future puzzle',
                    } as Puzzle
                }
            />
        );

        expect(allText(renderer)).toContain("Today's puzzle isn't supported");
        expect(allText(renderer)).not.toContain('Solve within 10 mins for 100 pts');
    });
});
