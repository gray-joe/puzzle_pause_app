import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as accountApi from './account';
import * as archiveApi from './archive';
import * as authApi from './auth';
import { apiRequest } from './client';
import * as leaguesApi from './leagues';
import * as puzzleApi from './puzzle';
import {
    AccountResponseSchema,
    AttemptResponseSchema,
    AuthLoginResponseSchema,
    AuthMeResponseSchema,
    AuthVerifyResponseSchema,
    CompletedDatesResponseSchema,
    DeleteAccountResponseSchema,
    HintResponseSchema,
    LeagueDetailSchema,
    LeagueResponseSchema,
    PuzzleResultSchema,
    PuzzleSchema,
    UserSchema,
} from './schemas';

vi.mock('./client', () => ({
    apiRequest: vi.fn(),
}));

const apiRequestMock = vi.mocked(apiRequest);

beforeEach(() => {
    apiRequestMock.mockReset();
    apiRequestMock.mockResolvedValue({ ok: true });
});

describe('auth api', () => {
    it('posts login email', async () => {
        await authApi.login('user@example.com');

        expect(apiRequestMock).toHaveBeenCalledWith('/auth/login', AuthLoginResponseSchema, {
            method: 'POST',
            body: { email: 'user@example.com' },
        });
    });

    it('posts verification code and returns auth payload', async () => {
        apiRequestMock.mockResolvedValueOnce({
            token: 'jwt',
            user: { id: 1, email: 'user@example.com', display_name: null },
        });

        const result = await authApi.verify('user@example.com', 'ABC123');

        expect(result).toEqual({
            token: 'jwt',
            user: { id: 1, email: 'user@example.com', display_name: null },
        });
        expect(apiRequestMock).toHaveBeenCalledWith('/auth/verify', AuthVerifyResponseSchema, {
            method: 'POST',
            body: { email: 'user@example.com', code: 'ABC123' },
        });
    });

    it('fetches current user with token', async () => {
        await authApi.me('jwt');

        expect(apiRequestMock).toHaveBeenCalledWith('/auth/me', AuthMeResponseSchema, {
            token: 'jwt',
        });
    });

    it('posts logout with token', async () => {
        await authApi.logout('jwt');

        expect(apiRequestMock).toHaveBeenCalledWith('/auth/logout', expect.anything(), {
            method: 'POST',
            token: 'jwt',
        });
    });
});

describe('puzzle api', () => {
    it('fetches today puzzle with optional token', async () => {
        await puzzleApi.today(null);

        expect(apiRequestMock).toHaveBeenCalledWith('/puzzle/today', PuzzleSchema, {
            token: null,
        });
    });

    it('posts today puzzle attempt', async () => {
        await puzzleApi.attempt('jwt', 12, 'answer', '2026-05-07T10:00:00Z', 1, 2);

        expect(apiRequestMock).toHaveBeenCalledWith('/puzzle/attempt', AttemptResponseSchema, {
            method: 'POST',
            token: 'jwt',
            body: {
                puzzle_id: 12,
                guess: 'answer',
                opened_at: '2026-05-07T10:00:00Z',
                incorrect_guesses: 1,
                hints_used: 2,
            },
        });
    });

    it('posts today puzzle hint', async () => {
        await puzzleApi.hint('jwt', 12);

        expect(apiRequestMock).toHaveBeenCalledWith('/puzzle/hint', HintResponseSchema, {
            method: 'POST',
            token: 'jwt',
            body: { puzzle_id: 12 },
        });
    });

    it('posts today puzzle give-up', async () => {
        await puzzleApi.giveUp('jwt', 12);

        expect(apiRequestMock).toHaveBeenNthCalledWith(1, '/auth/me', AuthMeResponseSchema, {
            token: 'jwt',
        });
        expect(apiRequestMock).toHaveBeenCalledWith('/puzzle/give-up', AttemptResponseSchema, {
            method: 'POST',
            token: 'jwt',
            body: { puzzle_id: 12 },
        });
        expect(apiRequestMock).toHaveBeenCalledTimes(2);
    });

    it('fetches today puzzle result', async () => {
        await puzzleApi.result('jwt');

        expect(apiRequestMock).toHaveBeenCalledWith('/puzzle/result', PuzzleResultSchema, {
            token: 'jwt',
        });
    });

    it('fetches puzzle calendar entries', async () => {
        await puzzleApi.calendar('jwt', '2026-06-01', '2026-06-30');

        expect(apiRequestMock).toHaveBeenCalledWith(
            '/puzzle/calendar?start=2026-06-01&end=2026-06-30',
            expect.anything(),
            { token: 'jwt' }
        );
    });

    it('propagates request failures', async () => {
        const error = new Error('Network unavailable');
        apiRequestMock.mockRejectedValueOnce(error);

        await expect(puzzleApi.today('jwt')).rejects.toBe(error);
    });
});

describe('archive api', () => {
    it('fetches archive list without query params', async () => {
        await archiveApi.list(null);

        expect(apiRequestMock).toHaveBeenCalledWith('/archive', expect.anything(), {
            token: null,
        });
    });

    it('fetches archive list with pagination params', async () => {
        await archiveApi.list('jwt', { limit: 25, offset: 50 });

        expect(apiRequestMock).toHaveBeenCalledWith(
            '/archive?limit=25&offset=50',
            expect.anything(),
            {
                token: 'jwt',
            }
        );
    });

    it('fetches archive list with status param', async () => {
        await archiveApi.list('jwt', { limit: 25, offset: 0, status: 'solved' });

        expect(apiRequestMock).toHaveBeenCalledWith(
            '/archive?limit=25&offset=0&status=solved',
            expect.anything(),
            {
                token: 'jwt',
            }
        );
    });

    it('fetches archive list with only a limit param', async () => {
        await archiveApi.list('jwt', { limit: 25 });

        expect(apiRequestMock).toHaveBeenCalledWith('/archive?limit=25', expect.anything(), {
            token: 'jwt',
        });
    });

    it('fetches archive list with only an offset param', async () => {
        await archiveApi.list('jwt', { offset: 50 });

        expect(apiRequestMock).toHaveBeenCalledWith('/archive?offset=50', expect.anything(), {
            token: 'jwt',
        });
    });

    it('fetches archive detail by id', async () => {
        await archiveApi.detail('jwt', 7);

        expect(apiRequestMock).toHaveBeenCalledWith('/archive/7', PuzzleSchema, {
            token: 'jwt',
        });
    });

    it('posts archive attempt', async () => {
        await archiveApi.attempt(null, 7, 'guess', null, 2, 1);

        expect(apiRequestMock).toHaveBeenCalledWith('/archive/7/attempt', AttemptResponseSchema, {
            method: 'POST',
            token: null,
            body: {
                puzzle_id: 7,
                guess: 'guess',
                opened_at: null,
                incorrect_guesses: 2,
                hints_used: 1,
            },
        });
    });

    it('posts archive hint without request body', async () => {
        await archiveApi.hint('jwt', 7);

        expect(apiRequestMock).toHaveBeenCalledWith('/archive/7/hint', HintResponseSchema, {
            method: 'POST',
            token: 'jwt',
        });
    });

    it('posts archive puzzle give-up without a request body', async () => {
        await archiveApi.giveUp(null, 7);

        expect(apiRequestMock).toHaveBeenCalledWith('/archive/7/give-up', AttemptResponseSchema, {
            method: 'POST',
            token: null,
        });
    });

    it('validates an authenticated session before archive give-up', async () => {
        await archiveApi.giveUp('jwt', 7);

        expect(apiRequestMock).toHaveBeenNthCalledWith(1, '/auth/me', AuthMeResponseSchema, {
            token: 'jwt',
        });
        expect(apiRequestMock).toHaveBeenNthCalledWith(
            2,
            '/archive/7/give-up',
            AttemptResponseSchema,
            { method: 'POST', token: 'jwt' }
        );
    });
});

describe('account api', () => {
    it('fetches account with token', async () => {
        await accountApi.getAccount('jwt');

        expect(apiRequestMock).toHaveBeenCalledWith('/account', AccountResponseSchema, {
            token: 'jwt',
        });
    });

    it('patches display name', async () => {
        await accountApi.updateDisplayName('jwt', 'Puzzle Friend');

        expect(apiRequestMock).toHaveBeenCalledWith('/account', UserSchema, {
            method: 'PATCH',
            token: 'jwt',
            body: { display_name: 'Puzzle Friend' },
        });
    });

    it('fetches completed dates', async () => {
        await accountApi.completedDates(null, '2026-06-01', '2026-06-30');

        expect(apiRequestMock).toHaveBeenCalledWith(
            '/account/completed-dates?start=2026-06-01&end=2026-06-30',
            CompletedDatesResponseSchema,
            { token: null }
        );
    });

    it('deletes account with token', async () => {
        await accountApi.deleteAccount('jwt');

        expect(apiRequestMock).toHaveBeenCalledWith('/account', DeleteAccountResponseSchema, {
            method: 'DELETE',
            token: 'jwt',
        });
    });
});

describe('leagues api', () => {
    it('fetches league list', async () => {
        await leaguesApi.list('jwt');

        expect(apiRequestMock).toHaveBeenCalledWith('/leagues', expect.anything(), {
            token: 'jwt',
        });
    });

    it('posts league create', async () => {
        await leaguesApi.create('jwt', 'Friends');

        expect(apiRequestMock).toHaveBeenCalledWith('/leagues', LeagueResponseSchema, {
            method: 'POST',
            token: 'jwt',
            body: { name: 'Friends' },
        });
    });

    it('fetches league detail', async () => {
        await leaguesApi.detail('jwt', 3);

        expect(apiRequestMock).toHaveBeenCalledWith('/leagues/3', LeagueDetailSchema, {
            token: 'jwt',
        });
    });

    it('posts join invite code', async () => {
        await leaguesApi.join('jwt', 'ABC123');

        expect(apiRequestMock).toHaveBeenCalledWith('/leagues/join', LeagueResponseSchema, {
            method: 'POST',
            token: 'jwt',
            body: { invite_code: 'ABC123' },
        });
    });

    it('posts leave league', async () => {
        await leaguesApi.leave('jwt', 3);

        expect(apiRequestMock).toHaveBeenCalledWith('/leagues/3/leave', expect.anything(), {
            method: 'POST',
            token: 'jwt',
        });
    });

    it('deletes league', async () => {
        await leaguesApi.deleteLeague('jwt', 3);

        expect(apiRequestMock).toHaveBeenCalledWith('/leagues/3', expect.anything(), {
            method: 'DELETE',
            token: 'jwt',
        });
    });
});
