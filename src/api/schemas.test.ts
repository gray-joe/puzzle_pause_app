import { describe, expect, it } from 'vitest';
import {
    AccountResponseSchema,
    ArchiveListItemSchema,
    AttemptResponseSchema,
    AttemptStateSchema,
    AuthVerifyResponseSchema,
    CompletedDatesResponseSchema,
    LeaderboardEntrySchema,
    LeagueDetailSchema,
    LeagueResponseSchema,
    PuzzleSchema,
    PuzzleResultSchema,
    type ChoicePuzzle,
    type ClueRevealPuzzle,
    type ConnectionsPuzzle,
    type CountdownPuzzle,
    type ImageWordPuzzle,
    type MatchPuzzle,
    type NumGridPuzzle,
    type OrderPuzzle,
    type ScrabblePuzzle,
    type WordWheelPuzzle,
    type WordsearchPuzzle,
} from './schemas';

const basePuzzle = {
    id: 10,
    puzzle_date: '2026-05-07',
    puzzle_name: 'Schema Check',
    puzzle_number: 42,
    hint: null,
    has_hint: false,
    total_hints: 1,
};

describe('AttemptStateSchema', () => {
    it('transforms boolean hint_used to a numeric counter', () => {
        const parsed = AttemptStateSchema.parse({
            solved: false,
            score: null,
            incorrect_guesses: 0,
            hint_used: true,
            completed_at: null,
            opened_at: null,
        });

        expect(parsed.hint_used).toBe(1);
    });

    it('keeps numeric hint_used as-is', () => {
        const parsed = AttemptStateSchema.parse({
            solved: false,
            score: null,
            incorrect_guesses: 2,
            hint_used: 3,
            completed_at: null,
            opened_at: null,
        });

        expect(parsed.hint_used).toBe(3);
    });

    it('transforms false hint_used to zero and allows missing opened_at', () => {
        const parsed = AttemptStateSchema.parse({
            solved: false,
            score: null,
            incorrect_guesses: 0,
            hint_used: false,
            completed_at: null,
        });

        expect(parsed.hint_used).toBe(0);
        expect(parsed.opened_at).toBeUndefined();
    });

    it('parses terminal give-up state', () => {
        const parsed = AttemptStateSchema.parse({
            solved: false,
            gave_up: true,
            score: 0,
            incorrect_guesses: 2,
            hint_used: 1,
            completed_at: '2026-07-20T12:34:56Z',
            opened_at: null,
        });

        expect(parsed.gave_up).toBe(true);
        expect(parsed.solved).toBe(false);
    });
});

describe('PuzzleSchema', () => {
    it.each(['word', 'math', 'ladder'] as const)('parses %s text puzzles', (puzzleType) => {
        const parsed = PuzzleSchema.parse({
            ...basePuzzle,
            puzzle_type: puzzleType,
            question: '<p>Solve me</p>',
        });

        expect(parsed.puzzle_type).toBe(puzzleType);
        expect(parsed.question).toBe('<p>Solve me</p>');
    });

    it('parses choice puzzles from pipe-delimited question content', () => {
        const parsed = PuzzleSchema.parse({
            ...basePuzzle,
            puzzle_type: 'choice',
            question: 'Pick one|A|B|C|D',
        }) as ChoicePuzzle;

        expect(parsed.question).toEqual({
            prompt: 'Pick one',
            options: ['A', 'B', 'C', 'D'],
        });
    });

    it('parses clue-reveal puzzles from JSON question content', () => {
        const parsed = PuzzleSchema.parse({
            ...basePuzzle,
            puzzle_type: 'clue-reveal',
            question: '{"prompt":"Guess it","clues":["c1","c2"]}',
            has_hint: true,
            total_hints: 2,
        }) as ClueRevealPuzzle;

        expect(parsed.question).toEqual({
            prompt: 'Guess it',
            clues: ['c1', 'c2'],
        });
    });

    it('parses image-word puzzles with allowed image hosts', () => {
        const parsed = PuzzleSchema.parse({
            ...basePuzzle,
            puzzle_type: 'image-word',
            question: JSON.stringify({
                prompt: 'Name this place',
                image_url: 'https://images.example-cdn.com/place.jpg',
            }),
        }) as ImageWordPuzzle;

        expect(parsed.question).toEqual({
            prompt: 'Name this place',
            image_url: 'https://images.example-cdn.com/place.jpg',
        });
    });

    it('parses image-word puzzles from object payloads with camelCase image URLs', () => {
        const parsed = PuzzleSchema.parse({
            ...basePuzzle,
            puzzle_type: 'image-word',
            question: {
                prompt: 'Name this place',
                imageUrl: 'https://images.example-cdn.com/place.jpg',
            },
        }) as ImageWordPuzzle;

        expect(parsed.question).toEqual({
            prompt: 'Name this place',
            image_url: 'https://images.example-cdn.com/place.jpg',
        });
    });

    it('rejects image-word puzzles with non-http image URLs', () => {
        const result = PuzzleSchema.safeParse({
            ...basePuzzle,
            puzzle_type: 'image-word',
            question: JSON.stringify({
                prompt: 'Name this place',
                image_url: 'file:///tmp/place.jpg',
            }),
        });

        expect(result.success).toBe(false);
    });

    it('rejects image-word puzzles with invalid JSON', () => {
        const result = PuzzleSchema.safeParse({
            ...basePuzzle,
            puzzle_type: 'image-word',
            question: '{not json}',
        });

        expect(result.success).toBe(false);
    });

    it('rejects clue-reveal puzzles missing required clue data', () => {
        const result = PuzzleSchema.safeParse({
            ...basePuzzle,
            puzzle_type: 'clue-reveal',
            question: JSON.stringify({ prompt: 'Guess it' }),
        });

        expect(result.success).toBe(false);
    });

    it('parses countdown puzzles from JSON question content', () => {
        const parsed = PuzzleSchema.parse({
            ...basePuzzle,
            puzzle_type: 'countdown',
            question: JSON.stringify({
                prompt: 'Reach the target using the numbers and operators below:',
                target: 306,
                numbers: [75, 50, 6, 3, 2, 1],
                operators: ['+', '-', '×', '÷'],
            }),
        }) as CountdownPuzzle;

        expect(parsed.question).toEqual({
            prompt: 'Reach the target using the numbers and operators below:',
            target: 306,
            numbers: [75, 50, 6, 3, 2, 1],
            operators: ['+', '-', '×', '÷'],
        });
    });

    it('parses order puzzles from JSON question content', () => {
        const parsed = PuzzleSchema.parse({
            ...basePuzzle,
            puzzle_type: 'order',
            question: JSON.stringify({
                prompt: 'Sort these words into alphabetical order:',
                items: ['Three', 'One', 'Two'],
            }),
        }) as OrderPuzzle;

        expect(parsed.question).toEqual({
            prompt: 'Sort these words into alphabetical order:',
            items: ['Three', 'One', 'Two'],
        });
    });

    it('rejects order puzzles with fewer than two items', () => {
        const result = PuzzleSchema.safeParse({
            ...basePuzzle,
            puzzle_type: 'order',
            question: JSON.stringify({
                prompt: 'Sort these words',
                items: ['One'],
            }),
        });

        expect(result.success).toBe(false);
    });

    it('parses word-wheel puzzles from JSON question content', () => {
        const parsed = PuzzleSchema.parse({
            ...basePuzzle,
            puzzle_type: 'word-wheel',
            question: JSON.stringify({
                prompt: 'Find the hidden words.',
                wheels: [
                    { letters: ['S', 'T', null, 'R', 'L', 'I', null, 'G'] },
                    { letters: [null, 'L', 'I', 'M', null, 'I', 'N', 'G'] },
                ],
            }),
        }) as WordWheelPuzzle;

        expect(parsed.question).toEqual({
            prompt: 'Find the hidden words.',
            wheels: [
                { letters: ['S', 'T', null, 'R', 'L', 'I', null, 'G'] },
                { letters: [null, 'L', 'I', 'M', null, 'I', 'N', 'G'] },
            ],
        });
    });

    it('rejects word-wheel puzzles without wheels', () => {
        const result = PuzzleSchema.safeParse({
            ...basePuzzle,
            puzzle_type: 'word-wheel',
            question: JSON.stringify({
                prompt: 'Find the hidden words.',
                wheels: [],
            }),
        });

        expect(result.success).toBe(false);
    });

    it('parses scrabble puzzles from JSON question content', () => {
        const parsed = PuzzleSchema.parse({
            ...basePuzzle,
            puzzle_type: 'scrabble',
            question: JSON.stringify({
                prompt: 'What is the highest scoring word?',
                board: [null, null, 'A', null],
                modifiers: [null, 'tl', null, 'dw'],
                rack: ['C', 'O', 'R', 'M'],
            }),
        }) as ScrabblePuzzle;

        expect(parsed.question).toEqual({
            prompt: 'What is the highest scoring word?',
            board: [null, null, 'A', null],
            modifiers: [null, 'tl', null, 'dw'],
            rack: ['C', 'O', 'R', 'M'],
        });
    });

    it('rejects scrabble puzzles missing required arrays', () => {
        const result = PuzzleSchema.safeParse({
            ...basePuzzle,
            puzzle_type: 'scrabble',
            question: JSON.stringify({
                prompt: 'What is the highest scoring word?',
                board: [],
                rack: ['A'],
            }),
        });

        expect(result.success).toBe(false);
    });

    it('parses numgrid puzzles from JSON question content', () => {
        const parsed = PuzzleSchema.parse({
            ...basePuzzle,
            puzzle_type: 'numgrid',
            question: JSON.stringify({
                prompt: 'What number is missing from this grid?',
                grid: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, null, 12, 13, 14, 15, 16],
            }),
        }) as NumGridPuzzle;

        expect(parsed.question).toEqual({
            prompt: 'What number is missing from this grid?',
            grid: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, null, 12, 13, 14, 15, 16],
        });
    });

    it('rejects numgrid puzzles without exactly one missing cell', () => {
        const result = PuzzleSchema.safeParse({
            ...basePuzzle,
            puzzle_type: 'numgrid',
            question: JSON.stringify({
                prompt: 'What number is missing from this grid?',
                grid: [1, null, 3, null],
            }),
        });

        expect(result.success).toBe(false);
    });

    it('parses wordsearch puzzles from plain text question content', () => {
        const question = 'A B C D E\nF G H I J\nE A R T H\nFind: EARTH';
        const parsed = PuzzleSchema.parse({
            ...basePuzzle,
            puzzle_type: 'wordsearch',
            question,
        }) as WordsearchPuzzle;

        expect(parsed.question).toBe(question);
    });

    it('rejects wordsearch puzzles without a Find section', () => {
        const result = PuzzleSchema.safeParse({
            ...basePuzzle,
            puzzle_type: 'wordsearch',
            question: 'A B C D E\nF G H I J',
        });

        expect(result.success).toBe(false);
    });

    it('parses match puzzles from JSON question content', () => {
        const parsed = PuzzleSchema.parse({
            ...basePuzzle,
            puzzle_type: 'match',
            question: JSON.stringify({
                prompt: 'Match each country to its capital city:',
                left: ['France', 'Japan', 'Brazil', 'Australia'],
                right: ['Canberra', 'Paris', 'Brasilia', 'Tokyo'],
            }),
        }) as MatchPuzzle;

        expect(parsed.question).toEqual({
            prompt: 'Match each country to its capital city:',
            left: ['France', 'Japan', 'Brazil', 'Australia'],
            right: ['Canberra', 'Paris', 'Brasilia', 'Tokyo'],
        });
    });

    it('rejects match puzzles with uneven columns', () => {
        const result = PuzzleSchema.safeParse({
            ...basePuzzle,
            puzzle_type: 'match',
            question: JSON.stringify({
                prompt: 'Match these:',
                left: ['A', 'B'],
                right: ['One', 'Two', 'Three'],
            }),
        });

        expect(result.success).toBe(false);
    });

    it('parses unsolved connections puzzles without categories', () => {
        const parsed = PuzzleSchema.parse({
            ...basePuzzle,
            puzzle_type: 'connections',
            total_hints: 3,
            question: JSON.stringify({
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
            }),
        }) as ConnectionsPuzzle;

        expect(parsed.question).toEqual({
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
        });
    });

    it('parses solved connections puzzles with categories', () => {
        const parsed = PuzzleSchema.parse({
            ...basePuzzle,
            puzzle_type: 'connections',
            total_hints: 3,
            question: JSON.stringify({
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
                categories: ['Fruits', 'Vegetables', 'Colors'],
            }),
        }) as ConnectionsPuzzle;

        expect(parsed.question.categories).toEqual(['Fruits', 'Vegetables', 'Colors']);
    });

    it('rejects connections puzzles whose categories do not divide items evenly', () => {
        const result = PuzzleSchema.safeParse({
            ...basePuzzle,
            puzzle_type: 'connections',
            question: JSON.stringify({
                prompt: 'Group these:',
                items: ['A', 'B', 'C', 'D', 'E'],
                categories: ['One', 'Two'],
            }),
        });

        expect(result.success).toBe(false);
    });

    it('rejects countdown puzzles missing required structured data', () => {
        const result = PuzzleSchema.safeParse({
            ...basePuzzle,
            puzzle_type: 'countdown',
            question: JSON.stringify({
                prompt: 'Reach the target',
                target: 306,
                numbers: [],
                operators: ['+'],
            }),
        });

        expect(result.success).toBe(false);
    });

    it('parses unknown puzzle types as unsupported puzzles', () => {
        const parsed = PuzzleSchema.parse({
            ...basePuzzle,
            puzzle_type: 'future-puzzle',
            question: 'Coming soon',
        });

        expect(parsed.puzzle_type).toBe('future-puzzle');
        expect(parsed.question).toBe('Coming soon');
    });

    it('allows a null revealed answer', () => {
        const parsed = PuzzleSchema.parse({
            ...basePuzzle,
            puzzle_type: 'word',
            question: 'Guess it',
            answer: null,
        });

        expect(parsed.answer).toBeNull();
    });
});

describe('LeagueResponseSchema', () => {
    it('normalizes user_rank and user_score sentinel values', () => {
        const parsed = LeagueResponseSchema.parse({
            id: 1,
            name: 'League',
            invite_code: 'ABC123',
            creator_id: 10,
            member_count: 3,
            user_rank: -1,
            user_score: -1,
        });

        expect(parsed.user_rank).toBeNull();
        expect(parsed.user_score).toBe(0);
    });

    it('keeps nullable rank values and normalizes leaderboard sentinel scores', () => {
        const league = LeagueResponseSchema.parse({
            id: 1,
            name: 'League',
            invite_code: 'ABC123',
            creator_id: 10,
            member_count: 3,
            user_rank: null,
            user_score: 25,
        });
        const leaderboardEntry = LeaderboardEntrySchema.parse({
            user_id: 10,
            display_name: null,
            score: -1,
            rank: 2,
        });

        expect(league.user_rank).toBeNull();
        expect(league.user_score).toBe(25);
        expect(leaderboardEntry.score).toBeNull();
    });
});

describe('endpoint fixture schemas', () => {
    it('parses auth verify response payload', () => {
        const parsed = AuthVerifyResponseSchema.parse({
            token: 'jwt-token',
            user: {
                id: 25,
                email: 'user@example.com',
                display_name: null,
            },
        });

        expect(parsed.user.email).toBe('user@example.com');
    });

    it('parses account response payload', () => {
        const parsed = AccountResponseSchema.parse({
            id: 25,
            email: 'user@example.com',
            display_name: null,
            stats: {
                puzzles_solved: 0,
                average_score: 0,
                alltime_total: 0,
                weekly_total: 0,
                today_score: null,
                percentile: 33,
                streak: 0,
            },
        });

        expect(parsed.stats.percentile).toBe(33);
    });

    it('parses solved and given-up calendar dates', () => {
        const parsed = CompletedDatesResponseSchema.parse({
            completed_dates: ['2026-07-03', '2026-07-08'],
            gave_up_dates: ['2026-07-05', '2026-07-12'],
        });

        expect(parsed.gave_up_dates).toEqual(['2026-07-05', '2026-07-12']);
    });

    it('parses puzzle result response and normalizes hint_used', () => {
        const parsed = PuzzleResultSchema.parse({
            puzzle: {
                id: 14,
                puzzle_date: '2026-04-30',
                puzzle_type: 'math',
                puzzle_name: 'Quick Maths',
                question: '1+1=?',
                hint: 'Count on your fingers',
                has_hint: true,
                total_hints: 1,
                puzzle_number: 24,
            },
            attempt: {
                solved: true,
                score: 950,
                incorrect_guesses: 0,
                hint_used: false,
                completed_at: '2026-05-07T10:00:00Z',
                opened_at: '2026-05-07T09:59:00Z',
            },
        });

        expect(parsed.attempt.hint_used).toBe(0);
    });

    it('parses attempt response payload from puzzle submit', () => {
        const parsed = AttemptResponseSchema.parse({
            correct: true,
            score: 875,
            incorrect_guesses: 1,
            solved: true,
            answer: 'ANSWER',
            streak: 5,
            opened_at: '2026-05-07T09:59:00Z',
            completed_at: '2026-05-07T10:00:00Z',
        });

        expect(parsed.correct).toBe(true);
        expect(parsed.streak).toBe(5);
        expect(parsed.completed_at).toBe('2026-05-07T10:00:00Z');
    });

    it('allows gave_up to be absent on older attempt responses', () => {
        const parsed = AttemptResponseSchema.parse({
            correct: false,
            score: null,
            incorrect_guesses: 1,
            solved: false,
        });

        expect(parsed.gave_up).toBeUndefined();
    });

    it('parses archive list entries with nullable solved status', () => {
        const parsed = ArchiveListItemSchema.array().parse([
            {
                id: 5,
                puzzle_date: '2026-05-01',
                puzzle_type: 'word',
                puzzle_name: 'Word One',
                hint: null,
                has_hint: false,
                puzzle_number: 10,
                solved: null,
            },
        ]);

        expect(parsed[0]?.solved).toBeNull();
    });

    it('parses league detail payload with tags and sentinel values', () => {
        const parsed = LeagueDetailSchema.parse({
            id: 1,
            name: 'My League',
            invite_code: 'XK9T2F',
            creator_id: 7,
            member_count: 4,
            user_rank: -1,
            user_score: -1,
            leaderboard_today: [{ user_id: 7, display_name: 'Alice', score: 95, rank: 1 }],
            leaderboard_weekly: [{ user_id: 7, display_name: 'Alice', score: 480, rank: 1 }],
            leaderboard_alltime: [{ user_id: 7, display_name: 'Alice', score: 3200, rank: 1 }],
            tags: {
                guesser: { user_id: 3, display_name: 'Bob' },
                one_shotter: { user_id: 7, display_name: 'Alice' },
                early_riser: { user_id: 5, display_name: 'Carol' },
                hint_lover: null,
            },
        });

        expect(parsed.user_rank).toBeNull();
        expect(parsed.user_score).toBe(0);
        expect(parsed.tags.hint_lover).toBeNull();
    });
});
