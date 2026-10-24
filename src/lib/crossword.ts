export type Direction = 'across' | 'down';

export type CrosswordGrid = {
    cols: number;
    black: boolean[];
    numbers: (number | undefined)[];
};

/** Mirrors the backend's crossword_numbers: one counter, left-to-right then top-to-bottom. */
export function buildCrossword(layout: string[]): CrosswordGrid {
    const rows = layout.length;
    const cols = layout[0]?.length ?? 0;
    const black = layout
        .join('')
        .split('')
        .map((char) => char === '#');
    const isWhite = (r: number, c: number) =>
        r >= 0 && r < rows && c >= 0 && c < cols && !black[r * cols + c];

    let next = 1;
    const numbers = black.map((isBlack, index) => {
        if (isBlack) return undefined;
        const r = Math.floor(index / cols);
        const c = index % cols;
        const startsAcross = !isWhite(r, c - 1) && isWhite(r, c + 1);
        const startsDown = !isWhite(r - 1, c) && isWhite(r + 1, c);
        return startsAcross || startsDown ? next++ : undefined;
    });

    return { cols, black, numbers };
}

/** Indexes of the word (2+ letters) through `index` in `direction`, or [] if there isn't one. */
export function wordCells(grid: CrosswordGrid, index: number, direction: Direction): number[] {
    const step = direction === 'across' ? 1 : grid.cols;
    const inLine = (i: number) =>
        i >= 0 &&
        i < grid.black.length &&
        !grid.black[i] &&
        (direction === 'down' || Math.floor(i / grid.cols) === Math.floor(index / grid.cols));

    if (!inLine(index)) return [];
    let start = index;
    while (inLine(start - step)) start -= step;
    const cells: number[] = [];
    for (let i = start; inLine(i); i += step) cells.push(i);
    return cells.length >= 2 ? cells : [];
}
