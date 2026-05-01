import { useContext } from 'react';
import { SessionContext } from './SessionContext';

export function useSession() {
    const ctx = useContext(SessionContext);
    if (!ctx) throw new Error('useSession must be used within SessionProvider');
    return ctx;
}
