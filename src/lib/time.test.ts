import { describe, expect, it } from 'vitest';
import { formatDate } from './time';

describe('formatDate', () => {
    it('formats an ISO date string as D Mon YYYY', () => {
        expect(formatDate('2026-05-07')).toBe('7 May 2026');
    });

    it('handles leading-zero day and month values', () => {
        expect(formatDate('2026-01-03')).toBe('3 Jan 2026');
    });
});
