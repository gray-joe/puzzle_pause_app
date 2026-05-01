import { describe, expect, it } from 'vitest';
import { evaluateCountdownTokens, formatCountdownResult, type CountdownToken } from './countdown';

function number(value: number, tileIndex: number): CountdownToken {
    return { type: 'number', value, tileIndex };
}

function operator(value: string): CountdownToken {
    return { type: 'operator', value };
}

function paren(value: '(' | ')'): CountdownToken {
    return { type: 'paren', value };
}

describe('evaluateCountdownTokens', () => {
    it('evaluates operator precedence', () => {
        expect(
            evaluateCountdownTokens([
                number(50, 0),
                operator('+'),
                number(6, 1),
                operator('×'),
                number(3, 2),
            ])
        ).toBe(68);
    });

    it('evaluates parentheses', () => {
        expect(
            evaluateCountdownTokens([
                paren('('),
                number(50, 0),
                operator('+'),
                number(6, 1),
                paren(')'),
                operator('×'),
                number(3, 2),
            ])
        ).toBe(168);
    });

    it('evaluates division and decimal results', () => {
        expect(evaluateCountdownTokens([number(7, 0), operator('÷'), number(2, 1)])).toBe(3.5);
        expect(formatCountdownResult(3.5)).toBe('3.5');
    });

    it('normalizes integer results', () => {
        expect(formatCountdownResult(306)).toBe('306');
    });

    it('returns null for invalid expressions and division by zero', () => {
        expect(evaluateCountdownTokens([number(7, 0), operator('+')])).toBeNull();
        expect(evaluateCountdownTokens([number(7, 0), operator('÷'), number(0, 1)])).toBeNull();
        expect(evaluateCountdownTokens([number(7, 0), number(2, 1)])).toBeNull();
    });
});
