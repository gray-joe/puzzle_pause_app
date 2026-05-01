import { apiRequest } from './client';
import {
    AccountResponseSchema,
    CompletedDatesResponseSchema,
    DeleteAccountResponseSchema,
    UserSchema,
    type AccountResponse,
    type CompletedDatesResponse,
    type DeleteAccountResponse,
    type User,
} from './schemas';

export async function getAccount(token: string): Promise<AccountResponse> {
    return apiRequest('/account', AccountResponseSchema, { token });
}

export async function updateDisplayName(token: string, displayName: string): Promise<User> {
    return apiRequest('/account', UserSchema, {
        method: 'PATCH',
        token,
        body: { display_name: displayName },
    });
}

export async function completedDates(
    token: string | null,
    start: string,
    end: string
): Promise<CompletedDatesResponse> {
    const params = new URLSearchParams({ start, end });
    return apiRequest(`/account/completed-dates?${params}`, CompletedDatesResponseSchema, {
        token,
    });
}

async function deleteAccount(token: string): Promise<DeleteAccountResponse> {
    return apiRequest('/account', DeleteAccountResponseSchema, {
        method: 'DELETE',
        token,
    });
}

export { deleteAccount, deleteAccount as delete };
