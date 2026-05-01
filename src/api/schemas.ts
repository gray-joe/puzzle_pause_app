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

const PuzzleBase = z.object({
    id: z.number(),
    puzzle_date: z.string(),
    puzzle_name: z.string(),
    puzzle_number: z.number(),
    puzzle_type: z.string(),
    hint: z.string().nullable(),
    has_hint: z.boolean(),
    total_hints: z.number(),
    attempt: AttemptStateSchema.nullable().optional(),
    solved: z.boolean().optional(),
    answer: z.string().nullable().optional(),
    explanation: z.string().nullable().optional(),
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

const KNOWN_PUZZLE_TYPES = [
    'word',
    'math',
    'ladder',
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
    question: z.unknown().transform((value, ctx) => {
        const raw = parseQuestionJson(value, ctx);
        const result = imageWordQuestionSchema.safeParse(raw);
        if (!result.success) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: result.error.issues.map((i) => i.message).join('; '),
            });
            return z.NEVER;
        }
        return result.data;
    }),
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
    question: z.unknown().transform((value, ctx) => {
        const raw = parseQuestionJson(value, ctx);
        const result = countdownQuestionSchema.safeParse(raw);
        if (!result.success) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: result.error.issues.map((i) => i.message).join('; '),
            });
            return z.NEVER;
        }
        return result.data;
    }),
});

const orderQuestionSchema = z.object({
    prompt: z.string(),
    items: z.array(z.string()).min(2),
});

const OrderPuzzleSchema = z.object({
    ...PuzzleBase.shape,
    puzzle_type: z.literal('order'),
    question: z.unknown().transform((value, ctx) => {
        const raw = parseQuestionJson(value, ctx);
        const result = orderQuestionSchema.safeParse(raw);
        if (!result.success) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: result.error.issues.map((i) => i.message).join('; '),
            });
            return z.NEVER;
        }
        return result.data;
    }),
});

const wordWheelQuestionSchema = z.object({
    prompt: z.string(),
    wheels: z.array(z.object({ letters: z.array(z.string().nullable()) })).min(1),
});

const WordWheelPuzzleSchema = z.object({
    ...PuzzleBase.shape,
    puzzle_type: z.literal('word-wheel'),
    question: z.unknown().transform((value, ctx) => {
        const raw = parseQuestionJson(value, ctx);
        const result = wordWheelQuestionSchema.safeParse(raw);
        if (!result.success) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: result.error.issues.map((i) => i.message).join('; '),
            });
            return z.NEVER;
        }
        return result.data;
    }),
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
    question: z.unknown().transform((value, ctx) => {
        const raw = parseQuestionJson(value, ctx);
        const result = scrabbleQuestionSchema.safeParse(raw);
        if (!result.success) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: result.error.issues.map((i) => i.message).join('; '),
            });
            return z.NEVER;
        }
        return result.data;
    }),
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
    question: z.unknown().transform((value, ctx) => {
        const raw = parseQuestionJson(value, ctx);
        const result = numgridQuestionSchema.safeParse(raw);
        if (!result.success) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: result.error.issues.map((i) => i.message).join('; '),
            });
            return z.NEVER;
        }
        return result.data;
    }),
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
    question: z.unknown().transform((value, ctx) => {
        const raw = parseQuestionJson(value, ctx);
        const result = matchQuestionSchema.safeParse(raw);
        if (!result.success) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: result.error.issues.map((i) => i.message).join('; '),
            });
            return z.NEVER;
        }
        return result.data;
    }),
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
    question: z.unknown().transform((value, ctx) => {
        const raw = parseQuestionJson(value, ctx);
        const result = connectionsQuestionSchema.safeParse(raw);
        if (!result.success) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: result.error.issues.map((i) => i.message).join('; '),
            });
            return z.NEVER;
        }
        return result.data;
    }),
});

const clueRevealQuestionSchema = z.object({
    prompt: z.string(),
    clues: z.array(z.string()),
});

const ClueRevealPuzzleSchema = z.object({
    ...PuzzleBase.shape,
    puzzle_type: z.literal('clue-reveal'),
    question: z.string().transform((s, ctx) => {
        let raw: unknown;
        try {
            raw = JSON.parse(s);
        } catch {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'question is not valid JSON' });
            return z.NEVER;
        }
        const result = clueRevealQuestionSchema.safeParse(raw);
        if (!result.success) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: result.error.issues.map((i) => i.message).join('; '),
            });
            return z.NEVER;
        }
        return result.data;
    }),
});

const UnsupportedPuzzleSchema = z.object({
    ...PuzzleBase.shape,
    puzzle_type: z.string().refine((type) => !KNOWN_PUZZLE_TYPES.includes(type), {
        message: 'known puzzle_type must match its schema',
    }),
    question: z.string(),
});

export const PuzzleSchema = z.union([
    WordPuzzleSchema,
    MathPuzzleSchema,
    LadderPuzzleSchema,
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
    ClueRevealPuzzleSchema,
    UnsupportedPuzzleSchema,
]);

export type Puzzle = z.infer<typeof PuzzleSchema>;
export type WordPuzzle = z.infer<typeof WordPuzzleSchema>;
export type MathPuzzle = z.infer<typeof MathPuzzleSchema>;
export type LadderPuzzle = z.infer<typeof LadderPuzzleSchema>;
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
export type ClueRevealPuzzle = z.infer<typeof ClueRevealPuzzleSchema>;
export type TextPuzzle = WordPuzzle | MathPuzzle | LadderPuzzle;

// POST /puzzle/attempt response
export const AttemptResponseSchema = z.object({
    correct: z.boolean(),
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
