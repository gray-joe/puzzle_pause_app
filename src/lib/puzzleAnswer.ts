import type { Puzzle } from '../api/schemas';

export function formatPuzzleAnswer(
    puzzle: Puzzle,
    answer: string,
    answerQuestion?: string | null
): string {
    if (typeof puzzle.question === 'string') return formatStandardAnswer(answer);

    if (puzzle.puzzle_type === 'order') {
        const solvedQuestion = parseQuestion(answerQuestion);
        const items = getStringArray(solvedQuestion?.items) ?? puzzle.question.items;
        const labels = answer.split(',').map((value) => {
            const index = Number(value.trim());
            return Number.isInteger(index) ? items[index] : undefined;
        });

        return labels.some((label) => label == null)
            ? answer
            : labels.map((label, index) => `${index + 1}. ${label}`).join('\n');
    }

    if (puzzle.puzzle_type === 'choice') {
        const optionIndex = answer.trim().toUpperCase().charCodeAt(0) - 65;
        const option = puzzle.question.options[optionIndex];
        return option ? option.trim() : answer;
    }

    if (puzzle.puzzle_type === 'match') {
        const solvedQuestion = parseQuestion(answerQuestion);
        const leftItems = getStringArray(solvedQuestion?.left) ?? puzzle.question.left;
        const rightItems = getStringArray(solvedQuestion?.right) ?? puzzle.question.right;
        const pairs = answer.split(',').map((value, leftIndex) => {
            const rightIndex = Number(value.trim());
            const left = leftItems[leftIndex];
            const right = Number.isInteger(rightIndex) ? rightItems[rightIndex] : undefined;
            return left && right ? `${left} -> ${right}` : undefined;
        });

        return pairs.some((pair) => pair == null) ? answer : pairs.join('\n');
    }

    if (puzzle.puzzle_type === 'connections') {
        const solvedQuestion = parseConnectionsQuestion(answerQuestion);
        const categories = puzzle.question.categories ?? solvedQuestion?.categories;
        const items = solvedQuestion?.items ?? puzzle.question.items;
        const lines = answer.split('|').map((group, groupIndex) => {
            const category = categories?.[groupIndex];
            const labels = group
                .split(',')
                .map((value) => {
                    const index = Number(value.trim());
                    return Number.isInteger(index) ? items[index] : undefined;
                })
                .filter((label): label is string => !!label);

            if (!category || labels.length === 0) return undefined;
            return `${category}: ${labels.join(', ')}`;
        });

        return lines.some((line) => line == null) ? answer : lines.join('\n');
    }

    return formatStandardAnswer(answer);
}

function formatStandardAnswer(answer: string): string {
    return answer
        .replace(/^~/, '')
        .split('|')
        .map((value) => value.trim())
        .join(', ');
}

function parseQuestion(question: string | null | undefined): Record<string, unknown> | undefined {
    if (!question) return undefined;
    try {
        const parsed: unknown = JSON.parse(question);
        return parsed && typeof parsed === 'object'
            ? (parsed as Record<string, unknown>)
            : undefined;
    } catch {
        return undefined;
    }
}

function getStringArray(value: unknown): string[] | undefined {
    return Array.isArray(value) && value.every((item) => typeof item === 'string')
        ? value
        : undefined;
}

type CompletionStats = {
    completion_percentage: number;
    completed_users: number;
    average_seconds: number | null;
    average_score?: number | null;
};

export type CompletionStatsFormatted = {
    solvedBy: string;
    averageScore: string | null;
    averageTime: string | null;
};

export function formatCompletionStats(
    stats: CompletionStats | null | undefined
): CompletionStatsFormatted | null {
    if (!stats || stats.completed_users === 0) return null;

    const solvedBy = `${Math.round(stats.completion_percentage)}%`;

    const averageScore =
        stats.average_score != null ? String(Math.round(stats.average_score)) : null;

    let averageTime: string | null = null;
    if (stats.average_seconds != null) {
        const totalSeconds = Math.floor(stats.average_seconds);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        const parts: string[] = [];
        if (minutes > 0) parts.push(`${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`);
        parts.push(`${seconds} ${seconds === 1 ? 'second' : 'seconds'}`);
        averageTime = parts.join(' ');
    }

    return { solvedBy, averageScore, averageTime };
}

function parseConnectionsQuestion(question: string | null | undefined):
    | {
          items: string[];
          categories: string[];
      }
    | undefined {
    if (!question) return undefined;
    try {
        const parsed: unknown = JSON.parse(question);
        if (
            parsed &&
            typeof parsed === 'object' &&
            'items' in parsed &&
            'categories' in parsed &&
            Array.isArray(parsed.items) &&
            Array.isArray(parsed.categories) &&
            parsed.items.every((item) => typeof item === 'string') &&
            parsed.categories.every((category) => typeof category === 'string')
        ) {
            return { items: parsed.items, categories: parsed.categories };
        }
    } catch {
        return undefined;
    }
    return undefined;
}
