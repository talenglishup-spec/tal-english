'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabase } from '@/utils/supabase';

export type UserRole = 'player' | 'teacher' | 'admin' | null;

export interface User {
    id: string;
    name: string;
    role: UserRole;
    isAdmin?: boolean;
}

interface AuthContextType {
    user: User | null;
    isLoading: boolean;
    login: (userData: User) => Promise<void>;
    logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        async function initUser() {
            const storedUser = localStorage.getItem('tal_user');
            if (storedUser) {
                try {
                    setUser(JSON.parse(storedUser));
                    setIsLoading(false);
                    return;
                } catch (e) {
                    console.error('Failed to parse user session', e);
                    localStorage.removeItem('tal_user');
                }
            }

            try {
                const supabase = getSupabase();
                const { data: { session } } = await supabase.auth.getSession();
                if (session?.user) {
                    const userData: User = {
                        id: session.user.id,
                        name:
                            (session.user.user_metadata as Record<string, string>)?.name ||
                            (session.user.user_metadata as Record<string, string>)?.full_name ||
                            session.user.email?.split('@')[0] ||
                            'Player',
                        role: 'player',
                    };
                    setUser(userData);
                    localStorage.setItem('tal_user', JSON.stringify(userData));
                }
            } catch (e) {
                console.error('[AuthContext] Failed to get Supabase session', e);
            } finally {
                setIsLoading(false);
            }
        }

        initUser();
    }, []);

    const login = async (userData: any) => {
        setUser(userData);
        localStorage.setItem('tal_user', JSON.stringify(userData));
    };

    const logout = () => {
        setUser(null);
        localStorage.removeItem('tal_user');
        try { getSupabase().auth.signOut(); } catch (_) {}
        router.push('/');
    };

    return (
        <AuthContext.Provider value={{ user, isLoading, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
