import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';
import { getPuzzleHintSession, setPuzzleHintSessionHints } from './puzzleHintSession';

describe('puzzle hint sessions', () => {
    it.each(['today', 'archive'] as const)(
        'restores server hints without duplicating local %s reveals',
        (scope) => {
            const client = new QueryClient();
            expect(getPuzzleHintSession(client, scope, 'user', 1, 2, 'First|Second')).toEqual({
                hints: ['First', 'Second'],
                baseline: 0,
            });
            setPuzzleHintSessionHints(client, scope, 'user', 1, ['First', 'Second', 'Third']);
            expect(getPuzzleHintSession(client, scope, 'user', 1, 2, 'First|Second')).toEqual({
                hints: ['First', 'Second', 'Third'],
                baseline: 0,
            });
            expect(getPuzzleHintSession(client, scope, 'other', 1, 0)).toEqual({
                hints: [],
                baseline: 0,
            });
            client.clear();
        }
    );
    it('merges a later full server history with locally revealed hints after a baseline', () => {
        const client = new QueryClient();
        getPuzzleHintSession(client, 'today', 'user', 1, 2);
        setPuzzleHintSessionHints(client, 'today', 'user', 1, ['Third', 'Fourth']);
        expect(getPuzzleHintSession(client, 'today', 'user', 1, 3, 'First|Second|Third')).toEqual({
            hints: ['First', 'Second', 'Third', 'Fourth'],
            baseline: 0,
        });
        client.clear();
    });

    it('retains a baseline when an endpoint does not supply hint text', () => {
        const client = new QueryClient();
        expect(getPuzzleHintSession(client, 'today', 'user', 1, 2)).toEqual({
            hints: [],
            baseline: 2,
        });
        setPuzzleHintSessionHints(client, 'today', 'user', 1, ['Third']);
        expect(getPuzzleHintSession(client, 'today', 'user', 1, 3)).toEqual({
            hints: ['Third'],
            baseline: 2,
        });
        client.clear();
    });
});
