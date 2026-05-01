import { z } from 'zod';
import { apiRequest } from './client';
import {
    AuthLoginResponseSchema,
    AuthMeResponseSchema,
    AuthVerifyResponseSchema,
    type User,
} from './schemas';

export async function login(email: string): Promise<void> {
    await apiRequest('/auth/login', AuthLoginResponseSchema, {
        method: 'POST',
        body: { email },
    });
}

export async function verify(email: string, code: string): Promise<{ token: string; user: User }> {
    return apiRequest('/auth/verify', AuthVerifyResponseSchema, {
        method: 'POST',
        body: { email, code },
    });
}

export async function me(token: string): Promise<User> {
    return apiRequest('/auth/me', AuthMeResponseSchema, { token });
}

export async function logout(token: string): Promise<void> {
    await apiRequest('/auth/logout', z.unknown(), { method: 'POST', token });
}
