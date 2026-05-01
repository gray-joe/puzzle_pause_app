export type CountdownToken =
    | { type: 'number'; value: number; tileIndex: number }
    | { type: 'operator'; value: string }
    | { type: 'paren'; value: '(' | ')' };

type Operator = '+' | '-' | '*' | '/';
type EvalToken = number | Operator | '(' | ')';

const PRECEDENCE: Record<Operator, number> = { '+': 1, '-': 1, '*': 2, '/': 2 };

function normalizeOperator(operator: string): Operator | null {
    if (operator === '+') return '+';
    if (operator === '-') return '-';
    if (operator === '×' || operator === '*') return '*';
    if (operator === '÷' || operator === '/') return '/';
    return null;
}

function toEvalTokens(tokens: CountdownToken[]): EvalToken[] | null {
    const evalTokens: EvalToken[] = [];
    let expectsOperand = true;

    for (const token of tokens) {
        if (token.type === 'number') {
            if (!expectsOperand) return null;
            evalTokens.push(token.value);
            expectsOperand = false;
            continue;
        }

        if (token.type === 'paren') {
            if (token.value === '(') {
                if (!expectsOperand) return null;
                evalTokens.push('(');
                expectsOperand = true;
            } else {
                if (expectsOperand) return null;
                evalTokens.push(')');
                expectsOperand = false;
            }
            continue;
        }

        const operator = normalizeOperator(token.value);
        if (!operator) return null;
        if (expectsOperand) {
            if (operator !== '-') return null;
            evalTokens.push(0);
        }
        evalTokens.push(operator);
        expectsOperand = true;
    }

    return expectsOperand ? null : evalTokens;
}

function toRpn(tokens: EvalToken[]): (number | Operator)[] | null {
    const output: (number | Operator)[] = [];
    const operators: (Operator | '(')[] = [];

    for (const token of tokens) {
        if (typeof token === 'number') {
            output.push(token);
            continue;
        }

        if (token === '(') {
            operators.push(token);
            continue;
        }

        if (token === ')') {
            while (operators.length > 0 && operators[operators.length - 1] !== '(') {
                output.push(operators.pop() as Operator);
            }
            if (operators.pop() !== '(') return null;
            continue;
        }

        while (operators.length > 0) {
            const previous = operators[operators.length - 1];
            if (previous === '(' || PRECEDENCE[previous] < PRECEDENCE[token]) break;
            output.push(operators.pop() as Operator);
        }
        operators.push(token);
    }

    while (operators.length > 0) {
        const operator = operators.pop();
        if (!operator || operator === '(') return null;
        output.push(operator);
    }

    return output;
}

function evaluateRpn(tokens: (number | Operator)[]): number | null {
    const stack: number[] = [];

    for (const token of tokens) {
        if (typeof token === 'number') {
            stack.push(token);
            continue;
        }

        const right = stack.pop();
        const left = stack.pop();
        if (left == null || right == null) return null;

        if (token === '+') stack.push(left + right);
        if (token === '-') stack.push(left - right);
        if (token === '*') stack.push(left * right);
        if (token === '/') {
            if (right === 0) return null;
            stack.push(left / right);
        }
    }

    if (stack.length !== 1 || !Number.isFinite(stack[0])) return null;
    return stack[0];
}

export function evaluateCountdownTokens(tokens: CountdownToken[]): number | null {
    const evalTokens = toEvalTokens(tokens);
    if (!evalTokens) return null;
    const rpn = toRpn(evalTokens);
    if (!rpn) return null;
    return evaluateRpn(rpn);
}

export function formatCountdownResult(value: number): string {
    if (Number.isInteger(value)) return String(value);
    return value.toFixed(10).replace(/0+$/, '').replace(/\.$/, '');
}

export function countdownTokenLabel(token: CountdownToken): string {
    return token.type === 'number' ? String(token.value) : token.value;
}
