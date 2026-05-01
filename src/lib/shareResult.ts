import * as Clipboard from 'expo-clipboard';
import type { AttemptResponse, Puzzle } from '../api/schemas';

type ShareContext = 'today' | 'archive';

export function buildShareText(
    puzzle: Puzzle,
    result: AttemptResponse,
    context: ShareContext
): string {
    if (result.gave_up) {
        return context === 'today'
            ? "I tried today's Puzzle Pause! https://puzzlepause.app"
            : `I tried ${puzzle.puzzle_name} on Puzzle Pause! https://puzzlepause.app/archive/${puzzle.id}`;
    }

    const time = formatSolveTime(result.opened_at, result.completed_at);

    if (context === 'today') {
        if (result.score != null) {
            return `I scored ${result.score} on today's Puzzle Pause${time}! https://puzzlepause.app`;
        }

        return `I solved ${puzzle.puzzle_name} on Puzzle Pause${time}! https://puzzlepause.app`;
    }

    if (result.score != null) {
        return `I scored ${result.score} on Puzzle Pause #${puzzle.puzzle_number ?? puzzle.id}${time}! https://puzzlepause.app/archive/${puzzle.id}`;
    }

    return `I solved ${puzzle.puzzle_name} on Puzzle Pause! https://puzzlepause.app/archive/${puzzle.id}`;
}

export function shareResult(shareText: string): void {
    Clipboard.setStringAsync(shareText).catch(() => {});
}

function formatSolveTime(openedAt?: string | null, completedAt?: string | null): string {
    if (!openedAt || !completedAt) return '';

    const seconds = Math.max(
        0,
        Math.floor((Date.parse(completedAt) - Date.parse(openedAt)) / 1000)
    );
    if (!Number.isFinite(seconds)) return '';

    if (seconds < 60) return ` in ${seconds}s`;

    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return ` in ${minutes}m`;

    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return remainingMinutes > 0 ? ` in ${hours}h ${remainingMinutes}m` : ` in ${hours}h`;
}
