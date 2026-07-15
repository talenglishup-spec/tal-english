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
        /**
         * 자체 복구: profiles 행이 어떤 이유로든 없으면(이메일 미동의 카카오 가입,
         * 트리거 미적용 시점 가입 등) 그 자리에서 채운다. handle_new_user 트리거
         * 하나에만 의존하지 않는 이중 방어.
         *
         * initUser()의 localStorage 조기 return과 무관하게 항상 실행되어야 하므로
         * (재방문 유저가 대부분의 접속이다) 별도 함수로 분리해 세션이 있으면
         * 무조건 호출한다. 멱등(ON CONFLICT DO NOTHING)이라 매 진입 호출해도 안전하고,
         * 실패해도 로그인 흐름은 막지 않는다(non-blocking).
         */
        async function ensureProfile() {
            try {
                const supabase = getSupabase();
                const { data: { session } } = await supabase.auth.getSession();
                if (!session?.user) return;
                const { error } = await supabase.rpc('ensure_profile');
                if (error) console.warn('[AuthContext] ensure_profile 실패:', error.message);
            } catch (e) {
                console.warn('[AuthContext] ensure_profile 호출 실패', e);
            }
        }

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
        ensureProfile();
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
