/** Visible rule conflicts only; never compare entries to a solution. */
export function sudokuConflicts(digits: readonly string[]): string[] {
    const conflicts = Array.from({ length: 81 }, () => [] as string[]);
    if (digits.length !== 81) return conflicts.map(() => '');
    for (let unit = 0; unit < 9; unit++) {
        const groups = [
            { name: `row ${unit + 1}`, cells: Array.from({ length: 9 }, (_, i) => unit * 9 + i) },
            {
                name: `column ${unit + 1}`,
                cells: Array.from({ length: 9 }, (_, i) => i * 9 + unit),
            },
            {
                name: `box ${unit + 1}`,
                cells: Array.from(
                    { length: 9 },
                    (_, i) =>
                        Math.floor(unit / 3) * 27 + (unit % 3) * 3 + Math.floor(i / 3) * 9 + (i % 3)
                ),
            },
        ];
        for (const { name, cells } of groups) {
            const positions = new Map<string, number[]>();
            for (const cell of cells) {
                const digit = digits[cell];
                if (!/^[1-9]$/.test(digit)) continue;
                const indices = positions.get(digit) ?? [];
                indices.push(cell);
                positions.set(digit, indices);
            }
            for (const [digit, indices] of positions) {
                if (indices.length < 2) continue;
                for (const cell of indices) conflicts[cell].push(`Duplicate ${digit} in ${name}.`);
            }
        }
    }
    return conflicts.map((messages) => messages.join(' '));
}
