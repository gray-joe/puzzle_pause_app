export type WordCell = { r: number; c: number };

export function parseWordsearchQuestion(question: string) {
    const lines = question
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);
    const findLine = lines.find((line) => /^Find:/i.test(line)) ?? '';
    const themeLine = lines.find((line) => /^Theme:/i.test(line));
    const gridLines = lines.filter((line) => !/^(Find|Theme):/i.test(line));
    const findValue = findLine.replace(/^Find:\s*/i, '');
    const count = /^\d+$/.test(findValue) ? Number(findValue) : 1;
    const grid = gridLines.map((line) => line.toUpperCase().replace(/\s+/g, '').split(''));
    const rectangular =
        grid.length > 0 &&
        grid[0].length > 0 &&
        grid.every(
            (row) => row.length === grid[0].length && row.every((cell) => /^[A-Z]$/.test(cell))
        );
    return {
        grid: rectangular ? grid : null,
        gridText: gridLines.join('\n'),
        findLine,
        themeLine,
        inputCount: Number.isSafeInteger(count) && count > 0 ? count : 1,
        isCountFormat: /^\d+$/.test(findValue),
    };
}

export function wordsearchAnswers(answer: string): string[] {
    return [
        ...new Set(
            answer
                .split('|')
                .flatMap((group) =>
                    group.trim().replace(/^~/, '').toUpperCase().split(/\s+/).filter(Boolean)
                )
        ),
    ];
}

// Use the first valid occurrence: the wire format has words, not authored coordinates.
export function findWordInGrid(grid: string[][], word: string): WordCell[] | null {
    if (!/^[A-Z]+$/i.test(word)) return null;
    const w = word.toUpperCase();
    const directions = [
        [0, 1],
        [0, -1],
        [1, 0],
        [-1, 0],
        [1, 1],
        [1, -1],
        [-1, 1],
        [-1, -1],
    ];
    for (let r = 0; r < grid.length; r++) {
        for (let c = 0; c < grid[r].length; c++) {
            for (const [dr, dc] of directions) {
                const cells = Array.from({ length: w.length }, (_, i) => ({
                    r: r + dr * i,
                    c: c + dc * i,
                }));
                if (cells.every((cell, i) => grid[cell.r]?.[cell.c]?.toUpperCase() === w[i]))
                    return cells;
            }
        }
    }
    return null;
}

export function wordLocation(cells: WordCell[] | null): string {
    if (!cells?.length) return 'Location unavailable';
    const start = cells[0];
    const end = cells[cells.length - 1];
    return `Row ${start.r + 1} column ${start.c + 1} to row ${end.r + 1} column ${end.c + 1}`;
}
