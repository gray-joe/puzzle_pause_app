import { z } from 'zod';
import { apiRequest } from './client';
import {
    LeagueDetailSchema,
    LeagueResponseSchema,
    type LeagueDetail,
    type LeagueResponse,
} from './schemas';

export async function list(token: string): Promise<LeagueResponse[]> {
    return apiRequest('/leagues', z.array(LeagueResponseSchema), { token });
}

export async function create(token: string, name: string): Promise<LeagueResponse> {
    return apiRequest('/leagues', LeagueResponseSchema, {
        method: 'POST',
        token,
        body: { name },
    });
}

export async function detail(token: string, id: number): Promise<LeagueDetail> {
    return apiRequest(`/leagues/${id}`, LeagueDetailSchema, { token });
}

export async function join(token: string, inviteCode: string): Promise<LeagueResponse> {
    return apiRequest('/leagues/join', LeagueResponseSchema, {
        method: 'POST',
        token,
        body: { invite_code: inviteCode },
    });
}

export async function leave(token: string, id: number): Promise<{ message: string }> {
    return apiRequest(`/leagues/${id}/leave`, z.object({ message: z.string() }), {
        method: 'POST',
        token,
    });
}

export async function deleteLeague(token: string, id: number): Promise<null> {
    return apiRequest(`/leagues/${id}`, z.null(), {
        method: 'DELETE',
        token,
    });
}
