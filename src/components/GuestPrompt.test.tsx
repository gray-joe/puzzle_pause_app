import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../api/client';
import type { User } from '../api/schemas';
import {
    allText,
    changeText,
    findByHost,
    findPressableByText,
    press,
    render,
} from '../test/render';
import { GuestPrompt } from './GuestPrompt';

const mocks = vi.hoisted(() => ({
    login: vi.fn(),
    verify: vi.fn(),
    signIn: vi.fn(),
    useMutation: vi.fn(),
}));

vi.mock('@tanstack/react-query', () => ({
    useMutation: mocks.useMutation,
}));

vi.mock('../api/auth', () => ({
    login: mocks.login,
    verify: mocks.verify,
}));

vi.mock('../auth/useSession', () => ({
    useSession: () => ({ signIn: mocks.signIn }),
}));

const user: User = { id: 7, email: 'user@example.com', display_name: null };

beforeEach(() => {
    vi.clearAllMocks();
    mocks.useMutation.mockImplementation((options) => ({
        isPending: false,
        mutate: (arg: unknown) => {
            try {
                const result = options.mutationFn(arg);
                options.onSuccess?.(result, arg);
            } catch (err) {
                options.onError?.(err);
            }
        },
    }));
});

describe('GuestPrompt', () => {
    it('starts with the guest message and opens the email step', () => {
        const renderer = render(<GuestPrompt message="Sign in to save progress." />);

        expect(allText(renderer)).toContain('Sign in to save progress.');

        press(findPressableByText(renderer, 'Sign in')!);

        expect(allText(renderer)).toContain("We'll email you a code to sign in.");
    });

    it('validates email input before calling login', () => {
        const renderer = render(<GuestPrompt message="Sign in required." />);
        press(findPressableByText(renderer, 'Sign in')!);

        press(findPressableByText(renderer, 'Send code')!);
        expect(allText(renderer)).toContain('Email is required.');

        changeText(findByHost(renderer, 'TextInput'), 'invalid-email');
        press(findPressableByText(renderer, 'Send code')!);

        expect(allText(renderer)).toContain('Please enter a valid email address.');
        expect(mocks.login).not.toHaveBeenCalled();
    });

    it('shows API login errors', () => {
        mocks.login.mockImplementationOnce(() => {
            throw new ApiError(400, 'Email blocked', null);
        });
        const renderer = render(<GuestPrompt message="Sign in required." />);
        press(findPressableByText(renderer, 'Sign in')!);

        changeText(findByHost(renderer, 'TextInput'), 'user@example.com');
        press(findPressableByText(renderer, 'Send code')!);

        expect(mocks.login).toHaveBeenCalledWith('user@example.com');
        expect(allText(renderer)).toContain('Email blocked');
    });

    it('shows a fallback login error for non-API failures', () => {
        mocks.login.mockImplementationOnce(() => {
            throw new Error('Network down');
        });
        const renderer = render(<GuestPrompt message="Sign in required." />);
        press(findPressableByText(renderer, 'Sign in')!);

        changeText(findByHost(renderer, 'TextInput'), 'user@example.com');
        press(findPressableByText(renderer, 'Send code')!);

        expect(allText(renderer)).toContain('Something went wrong. Try again.');
    });

    it('moves from email to code and validates code input', () => {
        mocks.login.mockReturnValueOnce({ message: 'sent' });
        const renderer = render(<GuestPrompt message="Sign in required." />);
        press(findPressableByText(renderer, 'Sign in')!);

        changeText(findByHost(renderer, 'TextInput'), ' USER@Example.COM ');
        press(findPressableByText(renderer, 'Send code')!);

        expect(allText(renderer)).toContain('Enter the 6-character code sent to user@example.com.');

        press(findPressableByText(renderer, 'Sign in')!);
        expect(allText(renderer)).toContain('Code is required.');

        changeText(findByHost(renderer, 'TextInput'), 'abc');
        press(findPressableByText(renderer, 'Sign in')!);
        expect(allText(renderer)).toContain('Code must be 6 characters.');
    });

    it('signs in after successful verification and shows verification errors', () => {
        mocks.login.mockReturnValue({ message: 'sent' });
        mocks.verify.mockImplementationOnce(() => {
            throw new Error('Network down');
        });
        const renderer = render(<GuestPrompt message="Sign in required." />);
        press(findPressableByText(renderer, 'Sign in')!);
        changeText(findByHost(renderer, 'TextInput'), 'user@example.com');
        press(findPressableByText(renderer, 'Send code')!);

        changeText(findByHost(renderer, 'TextInput'), 'abc123');
        press(findPressableByText(renderer, 'Sign in')!);

        expect(mocks.verify).toHaveBeenCalledWith('user@example.com', 'ABC123');
        expect(allText(renderer)).toContain('Something went wrong. Try again.');

        mocks.verify.mockReturnValueOnce({ token: 'jwt-token', user });
        press(findPressableByText(renderer, 'Sign in')!);

        expect(mocks.signIn).toHaveBeenCalledWith('jwt-token', user);
    });

    it('shows API verification errors', () => {
        mocks.login.mockReturnValue({ message: 'sent' });
        mocks.verify.mockImplementationOnce(() => {
            throw new ApiError(401, 'Invalid code', null);
        });
        const renderer = render(<GuestPrompt message="Sign in required." />);
        press(findPressableByText(renderer, 'Sign in')!);
        changeText(findByHost(renderer, 'TextInput'), 'user@example.com');
        press(findPressableByText(renderer, 'Send code')!);

        changeText(findByHost(renderer, 'TextInput'), 'abc123');
        press(findPressableByText(renderer, 'Sign in')!);

        expect(allText(renderer)).toContain('Invalid code');
    });
});
