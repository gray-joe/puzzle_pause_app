import { z } from 'zod';

// --- Auth ---

export const UserSchema = z.object({
    id: z.number(),
    email: z.string(),
    display_name: z.string().nullable(),
});
export type User = z.infer<typeof UserSchema>;

export const AuthLoginResponseSchema = z.object({ message: z.string() });

export const AuthVerifyResponseSchema = z.object({
    token: z.string(),
    user: UserSchema,
});
export type AuthVerifyResponse = z.infer<typeof AuthVerifyResponseSchema>;

export const AuthMeResponseSchema = UserSchema;

// --- Puzzle ---

export const AttemptStateSchema = z.object({
    solved: z.boolean(),
    gave_up: z.boolean().optional(),
    score: z.number().nullable(),
    incorrect_guesses: z.number(),
    hint_used: z
        .union([z.boolean(), z.number()])
        .transform((v) => (typeof v === 'boolean' ? (v ? 1 : 0) : v)),
    completed_at: z.string().nullable(),
    opened_at: z.string().nullable().optional(),
});
export type AttemptState = z.infer<typeof AttemptStateSchema>;

const CompletionStatsSchema = z.object({
    completion_percentage: z.number(),
    completed_users: z.number(),
    average_seconds: z.number().nullable(),
    average_score: z.number().nullable().optional(),
});

const PuzzleBase = z.object({
    id: z.number(),
    puzzle_date: z.string(),
    puzzle_name: z.string(),
    puzzle_number: z.number(),
    puzzle_type: z.string(),
    // Exact source required by the progress API's question/version precondition.
    raw_question: z.string().optional(),
    hint: z.string().nullable(),
    has_hint: z.boolean(),
    total_hints: z.number(),
    revealed_hint: z.string().nullable().optional(),
    attempt: AttemptStateSchema.nullable().optional(),
    solved: z.boolean().optional(),
    answer: z.string().nullable().optional(),
    explanation: z.string().nullable().optional(),
    completion_stats: CompletionStatsSchema.nullable().optional(),
});

const WordPuzzleSchema = z.object({
    ...PuzzleBase.shape,
    puzzle_type: z.literal('word'),
    question: z.string(),
});

const MathPuzzleSchema = z.object({
    ...PuzzleBase.shape,
    puzzle_type: z.literal('math'),
    question: z.string(),
});

const LadderPuzzleSchema = z.object({
    ...PuzzleBase.shape,
    puzzle_type: z.literal('ladder'),
    question: z.string(),
});

const ChoicePuzzleSchema = z.object({
    ...PuzzleBase.shape,
    puzzle_type: z.literal('choice'),
    question: z.string().transform((s) => {
        const parts = s.split('|');
        return { prompt: parts[0] ?? '', options: parts.slice(1) };
    }),
});

const WordLadderV2PuzzleSchema = z.object({
    ...PuzzleBase.shape,
    puzzle_type: z.literal('word-ladder-v2'),
    question: z.string(),
});

const KNOWN_PUZZLE_TYPES = [
    'word',
    'math',
    'ladder',
    'word-ladder-v2',
    'choice',
    'image-word',
    'clue-reveal',
    'countdown',
    'order',
    'word-wheel',
    'scrabble',
    'numgrid',
    'wordsearch',
    'match',
    'connections',
    'chess',
    'crossword',
    'sudoku',
    'codeword',
    'word-square',
    'number-square',
    'canvas',
];

function parseQuestionJson(value: unknown, ctx: z.RefinementCtx): unknown {
    if (typeof value !== 'string') return value;
    try {
        return JSON.parse(value);
    } catch {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'question is not valid JSON' });
        return z.NEVER;
    }
}

function jsonQuestion<T extends z.ZodTypeAny>(schema: T) {
    return z.unknown().transform((value, ctx): z.output<T> => {
        const raw = parseQuestionJson(value, ctx);
        const result = schema.safeParse(raw);
        if (!result.success) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: result.error.issues.map((i) => i.message).join('; '),
            });
            return z.NEVER;
        }
        return result.data;
    });
}

function isHttpImageUrl(url: string): boolean {
    try {
        const { protocol } = new URL(url);
        return protocol === 'http:' || protocol === 'https:';
    } catch {
        return false;
    }
}

const imageUrlSchema = z
    .string()
    .url()
    .refine(isHttpImageUrl, { message: 'image_url must be an http(s) URL' });

const imageWordQuestionSchema = z
    .object({
        prompt: z.string(),
        image_url: imageUrlSchema.optional(),
        imageUrl: imageUrlSchema.optional(),
        url: imageUrlSchema.optional(),
    })
    .transform((data, ctx) => {
        const imageUrl = data.image_url ?? data.imageUrl ?? data.url;
        if (!imageUrl) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'image_url is required' });
            return z.NEVER;
        }
        return { prompt: data.prompt, image_url: imageUrl };
    });

const ImageWordPuzzleSchema = z.object({
    ...PuzzleBase.shape,
    puzzle_type: z.literal('image-word'),
    question: jsonQuestion(imageWordQuestionSchema),
});

const countdownQuestionSchema = z.object({
    prompt: z.string(),
    target: z.number(),
    numbers: z.array(z.number()).min(1),
    operators: z.array(z.string()).min(1),
});

const CountdownPuzzleSchema = z.object({
    ...PuzzleBase.shape,
    puzzle_type: z.literal('countdown'),
    question: jsonQuestion(countdownQuestionSchema),
});

const orderQuestionSchema = z.object({
    prompt: z.string(),
    items: z.array(z.string()).min(2),
});

const OrderPuzzleSchema = z.object({
    ...PuzzleBase.shape,
    puzzle_type: z.literal('order'),
    question: jsonQuestion(orderQuestionSchema),
});

const wordWheelQuestionSchema = z.object({
    prompt: z.string(),
    wheels: z.array(z.object({ letters: z.array(z.string().nullable()) })).min(1),
});

const WordWheelPuzzleSchema = z.object({
    ...PuzzleBase.shape,
    puzzle_type: z.literal('word-wheel'),
    question: jsonQuestion(wordWheelQuestionSchema),
});

const scrabbleQuestionSchema = z.object({
    prompt: z.string(),
    board: z.array(z.string().nullable()),
    modifiers: z.array(z.string().nullable()),
    rack: z.array(z.string()),
});

const ScrabblePuzzleSchema = z.object({
    ...PuzzleBase.shape,
    puzzle_type: z.literal('scrabble'),
    question: jsonQuestion(scrabbleQuestionSchema),
});

const numgridQuestionSchema = z
    .object({
        prompt: z.string(),
        grid: z.array(z.number().nullable()),
    })
    .refine((data) => data.grid.filter((cell) => cell == null).length === 1, {
        message: 'grid must contain exactly one missing cell',
    });

const NumGridPuzzleSchema = z.object({
    ...PuzzleBase.shape,
    puzzle_type: z.literal('numgrid'),
    question: jsonQuestion(numgridQuestionSchema),
});

const WordsearchPuzzleSchema = z.object({
    ...PuzzleBase.shape,
    puzzle_type: z.literal('wordsearch'),
    question: z.string().refine((question) => /^Find:/im.test(question), {
        message: 'question must contain a Find: section',
    }),
});

const matchQuestionSchema = z
    .object({
        prompt: z.string(),
        left: z.array(z.string()).min(2),
        right: z.array(z.string()).min(2),
    })
    .refine((data) => data.left.length === data.right.length, {
        message: 'left and right must have equal length',
    });

const MatchPuzzleSchema = z.object({
    ...PuzzleBase.shape,
    puzzle_type: z.literal('match'),
    question: jsonQuestion(matchQuestionSchema),
});

const connectionsQuestionSchema = z
    .object({
        prompt: z.string(),
        items: z.array(z.string()),
        categories: z.array(z.string()).min(2).optional(),
    })
    .refine((data) => !data.categories || data.items.length >= data.categories.length, {
        message: 'items length must be at least categories length',
    })
    .refine((data) => !data.categories || data.items.length % data.categories.length === 0, {
        message: 'items length must divide evenly by categories length',
    });

const ConnectionsPuzzleSchema = z.object({
    ...PuzzleBase.shape,
    puzzle_type: z.literal('connections'),
    question: jsonQuestion(connectionsQuestionSchema),
});

const chessQuestionSchema = z.object({
    fen: z.string().min(1),
});

const ChessPuzzleSchema = z.object({
    ...PuzzleBase.shape,
    puzzle_type: z.literal('chess'),
    question: jsonQuestion(chessQuestionSchema),
});

const crosswordQuestionSchema = z
    .object({
        prompt: z.string(),
        layout: z
            .array(z.string().regex(/^[.#]{3,25}$/))
            .min(3)
            .max(25),
        clues: z.object({
            across: z.record(z.string(), z.string()),
            down: z.record(z.string(), z.string()),
        }),
    })
    .refine((data) => data.layout.every((row) => row.length === data.layout[0]!.length), {
        message: 'layout rows must have equal length',
    });

const CrosswordPuzzleSchema = z.object({
    ...PuzzleBase.shape,
    puzzle_type: z.literal('crossword'),
    question: jsonQuestion(crosswordQuestionSchema),
});

const SudokuPuzzleSchema = z.object({
    ...PuzzleBase.shape,
    puzzle_type: z.literal('sudoku'),
    question: jsonQuestion(z.object({ prompt: z.string(), grid: z.string().regex(/^[0-9]{81}$/) })),
});

const codewordQuestionSchema = z
    .object({
        prompt: z.string(),
        cells: z
            .array(z.array(z.number().int().min(0).max(26)).min(3).max(25))
            .min(3)
            .max(25),
        givens: z.record(z.string(), z.string().regex(/^[A-Za-z]$/)),
    })
    .refine((data) => data.cells.every((row) => row.length === data.cells[0]!.length), {
        message: 'cells must be rectangular',
    });

const CodewordPuzzleSchema = z.object({
    ...PuzzleBase.shape,
    puzzle_type: z.literal('codeword'),
    question: jsonQuestion(codewordQuestionSchema),
});

const wordSquareQuestionSchema = z
    .object({
        prompt: z.string(),
        size: z.number().int().min(3).max(6),
        clues: z.array(z.string()),
    })
    .refine((data) => data.clues.length === data.size, {
        message: 'clues must have one entry per row',
    });

const WordSquarePuzzleSchema = z.object({
    ...PuzzleBase.shape,
    puzzle_type: z.literal('word-square'),
    question: jsonQuestion(wordSquareQuestionSchema),
});

const numberSquareOpSchema = z.enum(['+', '-', '*', '/']);
const numberSquareOpsSchema = z
    .array(z.tuple([numberSquareOpSchema, numberSquareOpSchema]))
    .length(3);

const NumberSquarePuzzleSchema = z.object({
    ...PuzzleBase.shape,
    puzzle_type: z.literal('number-square'),
    question: jsonQuestion(
        z.object({
            prompt: z.string(),
            cells: z.array(z.number().nullable()).length(9),
            row_ops: numberSquareOpsSchema,
            col_ops: numberSquareOpsSchema,
            row_results: z.array(z.number()).length(3),
            col_results: z.array(z.number()).length(3),
        })
    ),
});

const canvasColorSchema = z.union([
    z.string().regex(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i),
    z.literal('none'),
]);
const canvasPaintSchema = {
    fill: canvasColorSchema.optional(),
    stroke: canvasColorSchema.optional(),
    strokeWidth: z.number().min(0).max(50).optional(),
};

const canvasShapeSchema = z.discriminatedUnion('type', [
    z.object({
        type: z.literal('rect'),
        x: z.number(),
        y: z.number(),
        w: z.number(),
        h: z.number(),
        ...canvasPaintSchema,
    }),
    z.object({
        type: z.literal('ellipse'),
        cx: z.number(),
        cy: z.number(),
        rx: z.number(),
        ry: z.number(),
        ...canvasPaintSchema,
    }),
    z.object({
        type: z.literal('line'),
        x1: z.number(),
        y1: z.number(),
        x2: z.number(),
        y2: z.number(),
        arrow: z.boolean().optional(),
        ...canvasPaintSchema,
    }),
    z.object({
        type: z.literal('path'),
        points: z.array(z.tuple([z.number(), z.number()])).min(2),
        ...canvasPaintSchema,
    }),
    z.object({
        type: z.literal('text'),
        x: z.number(),
        y: z.number(),
        text: z.string(),
        size: z.number(),
        ...canvasPaintSchema,
    }),
]);
export type CanvasShape = z.infer<typeof canvasShapeSchema>;

const CanvasPuzzleSchema = z.object({
    ...PuzzleBase.shape,
    puzzle_type: z.literal('canvas'),
    question: jsonQuestion(
        z.object({
            prompt: z.string(),
            background: canvasColorSchema.optional().catch(undefined),
            alt: z.string().optional(),
            // Unknown or malformed shapes are skipped so new shape types don't break the puzzle.
            shapes: z.array(z.unknown()).transform((shapes) =>
                shapes.flatMap((shape) => {
                    const result = canvasShapeSchema.safeParse(shape);
                    return result.success ? [result.data] : [];
                })
            ),
        })
    ),
});

const clueRevealQuestionSchema = z.object({
    prompt: z.string(),
    clues: z.array(z.string()),
});

const ClueRevealPuzzleSchema = z.object({
    ...PuzzleBase.shape,
    puzzle_type: z.literal('clue-reveal'),
    question: jsonQuestion(clueRevealQuestionSchema),
});

const UnsupportedPuzzleSchema = z.object({
    ...PuzzleBase.shape,
    puzzle_type: z.string().refine((type) => !KNOWN_PUZZLE_TYPES.includes(type), {
        message: 'known puzzle_type must match its schema',
    }),
    question: z.string(),
});

const ParsedPuzzleSchema = z.union([
    WordPuzzleSchema,
    MathPuzzleSchema,
    LadderPuzzleSchema,
    WordLadderV2PuzzleSchema,
    ChoicePuzzleSchema,
    ImageWordPuzzleSchema,
    CountdownPuzzleSchema,
    OrderPuzzleSchema,
    WordWheelPuzzleSchema,
    ScrabblePuzzleSchema,
    NumGridPuzzleSchema,
    WordsearchPuzzleSchema,
    MatchPuzzleSchema,
    ConnectionsPuzzleSchema,
    ChessPuzzleSchema,
    CrosswordPuzzleSchema,
    SudokuPuzzleSchema,
    CodewordPuzzleSchema,
    WordSquarePuzzleSchema,
    NumberSquarePuzzleSchema,
    CanvasPuzzleSchema,
    ClueRevealPuzzleSchema,
    UnsupportedPuzzleSchema,
]);

export const PuzzleSchema = z.preprocess((value) => {
    if (
        value &&
        typeof value === 'object' &&
        'puzzle_type' in value &&
        ['sudoku', 'crossword', 'codeword'].includes(String(value.puzzle_type)) &&
        'question' in value &&
        typeof value.question === 'string'
    ) {
        return { ...value, raw_question: value.question };
    }
    return value;
}, ParsedPuzzleSchema);

export type Puzzle = z.infer<typeof PuzzleSchema>;
export type WordPuzzle = z.infer<typeof WordPuzzleSchema>;
export type MathPuzzle = z.infer<typeof MathPuzzleSchema>;
export type LadderPuzzle = z.infer<typeof LadderPuzzleSchema>;
export type WordLadderV2Puzzle = z.infer<typeof WordLadderV2PuzzleSchema>;
export type ChoicePuzzle = z.infer<typeof ChoicePuzzleSchema>;
export type ImageWordPuzzle = z.infer<typeof ImageWordPuzzleSchema>;
export type CountdownPuzzle = z.infer<typeof CountdownPuzzleSchema>;
export type OrderPuzzle = z.infer<typeof OrderPuzzleSchema>;
export type WordWheelPuzzle = z.infer<typeof WordWheelPuzzleSchema>;
export type ScrabblePuzzle = z.infer<typeof ScrabblePuzzleSchema>;
export type NumGridPuzzle = z.infer<typeof NumGridPuzzleSchema>;
export type WordsearchPuzzle = z.infer<typeof WordsearchPuzzleSchema>;
export type MatchPuzzle = z.infer<typeof MatchPuzzleSchema>;
export type ConnectionsPuzzle = z.infer<typeof ConnectionsPuzzleSchema>;
export type ChessPuzzle = z.infer<typeof ChessPuzzleSchema>;
export type ClueRevealPuzzle = z.infer<typeof ClueRevealPuzzleSchema>;
export type CrosswordPuzzle = z.infer<typeof CrosswordPuzzleSchema>;
export type SudokuPuzzle = z.infer<typeof SudokuPuzzleSchema>;
export type CodewordPuzzle = z.infer<typeof CodewordPuzzleSchema>;
export type WordSquarePuzzle = z.infer<typeof WordSquarePuzzleSchema>;
export type NumberSquarePuzzle = z.infer<typeof NumberSquarePuzzleSchema>;
export type CanvasPuzzle = z.infer<typeof CanvasPuzzleSchema>;
export type TextPuzzle = WordPuzzle | MathPuzzle | LadderPuzzle;

// POST /puzzle/attempt response
export const AttemptResponseSchema = z.object({
    correct: z.boolean(),
    error_cells: z.array(z.number().int().nonnegative()).optional(),
    length_penalty_applied: z.boolean().optional(),
    score: z.number().nullable(),
    incorrect_guesses: z.number(),
    solved: z.boolean(),
    gave_up: z.boolean().optional(),
    answer: z.string().nullable().optional(),
    question: z.string().nullable().optional(),
    explanation: z.string().nullable().optional(),
    streak: z.number().nullable().optional(),
    opened_at: z.string().nullable().optional(),
    completed_at: z.string().nullable().optional(),
});
export type AttemptResponse = z.infer<typeof AttemptResponseSchema>;

// POST /puzzle/hint response
export const HintResponseSchema = z.object({
    hint: z.string(),
    total_hints: z.number(),
});
export type HintResponse = z.infer<typeof HintResponseSchema>;

// GET /puzzle/result response
export const PuzzleResultSchema = z.object({
    puzzle: z.object({
        id: z.number(),
        puzzle_date: z.string(),
        puzzle_type: z.string(),
        puzzle_name: z.string(),
        puzzle_number: z.number(),
        question: z.string(),
        hint: z.string().nullable(),
        has_hint: z.boolean(),
        total_hints: z.number(),
        answer: z.string().optional(),
        explanation: z.string().nullable().optional(),
    }),
    attempt: AttemptStateSchema,
});
export type PuzzleResult = z.infer<typeof PuzzleResultSchema>;

// GET /puzzle/calendar entry
export const PuzzleCalendarEntrySchema = z.object({
    id: z.number(),
    puzzle_date: z.string(),
});
export type PuzzleCalendarEntry = z.infer<typeof PuzzleCalendarEntrySchema>;

// --- Account ---

export const CompletedDatesResponseSchema = z.object({
    completed_dates: z.array(z.string()),
    gave_up_dates: z.array(z.string()),
});
export type CompletedDatesResponse = z.infer<typeof CompletedDatesResponseSchema>;

export const AccountStatsSchema = z.object({
    puzzles_solved: z.number(),
    average_score: z.number(),
    alltime_total: z.number(),
    weekly_total: z.number(),
    today_score: z.number().nullable(),
    percentile: z.number(),
    streak: z.number(),
});
export type AccountStats = z.infer<typeof AccountStatsSchema>;

export const AccountResponseSchema = z.object({
    id: z.number(),
    email: z.string(),
    display_name: z.string().nullable(),
    stats: AccountStatsSchema,
});
export type AccountResponse = z.infer<typeof AccountResponseSchema>;

export const DeleteAccountResponseSchema = z.object({ message: z.string() });
export type DeleteAccountResponse = z.infer<typeof DeleteAccountResponseSchema>;

// --- Leagues ---

const TagEntryBaseSchema = z.object({
    user_id: z.number(),
    display_name: z.string().nullable(),
});
export type TagEntry = z.infer<typeof TagEntryBaseSchema> | null;

export const LeaderboardEntrySchema = z.object({
    user_id: z.number(),
    display_name: z.string().nullable(),
    score: z.number().transform((v) => (v === -1 ? null : v)),
    rank: z.number(),
});
export type LeaderboardEntry = z.infer<typeof LeaderboardEntrySchema>;

export const LeagueResponseSchema = z.object({
    id: z.number(),
    name: z.string(),
    invite_code: z.string(),
    creator_id: z.number(),
    member_count: z.number(),
    user_rank: z
        .number()
        .nullable()
        .transform((v) => (v === -1 ? null : v)),
    user_score: z.number().transform((v) => (v === -1 ? 0 : v)),
});
export type LeagueResponse = z.infer<typeof LeagueResponseSchema>;

export const LeagueDetailSchema = z.object({
    ...LeagueResponseSchema.shape,
    leaderboard_today: z.array(LeaderboardEntrySchema),
    leaderboard_weekly: z.array(LeaderboardEntrySchema),
    leaderboard_alltime: z.array(LeaderboardEntrySchema),
    tags: z.object({
        guesser: TagEntryBaseSchema.nullable(),
        one_shotter: TagEntryBaseSchema.nullable(),
        early_riser: TagEntryBaseSchema.nullable(),
        hint_lover: TagEntryBaseSchema.nullable(),
    }),
});
export type LeagueDetail = z.infer<typeof LeagueDetailSchema>;

// GET /archive list item
export const ArchiveListItemSchema = z.object({
    id: z.number(),
    puzzle_date: z.string(),
    puzzle_type: z.string(),
    puzzle_name: z.string(),
    hint: z.string().nullable(),
    has_hint: z.boolean(),
    puzzle_number: z.number(),
    solved: z.boolean().nullable(),
});
export type ArchiveListItem = z.infer<typeof ArchiveListItemSchema>;
