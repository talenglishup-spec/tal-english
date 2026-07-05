'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabase } from '@/utils/supabase';

export type UserRole = 'player' | 'teacher' | 'admin' | null;

export interface User {
    id: string; // player_id or 'admin'
    name: string; // player_name or 'Teacher'
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
            // 1. 이메일 로그인은 localStorage에 tal_user를 직접 기록 → 즉시 복원
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

            // 2. OAuth 로그인(Google, Kakao)은 Supabase 쿠키만 설정하고
            //    localStorage를 기록하지 않으므로 세션에서 직접 복원한다.
            try {
                const supabase = getSupabase();
                const { data: { session } } = await supabase.auth.getSession();
                if (session?.user) {
                    const userData: User = {
                        id: session.user.id,
                        name:
                            session.user.user_metadata?.name ||
                            session.user.user_metadata?.full_name ||
                            session.user.email?.split('@')[0] ||
                            'Player',
                        role: 'player',
                    };
                    setUser(userData);
                    // 다음 페이지 로드에서 1번 경로로 즉시 복원되도록 캐싱
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



    // Login via API
    const login = async (userData: any) => {
        // userData comes from the API response now
        setUser(userData);
        localStorage.setItem('tal_user', JSON.stringify(userData));
    };

    const logout = () => {
        setUser(null);
        localStorage.removeItem('tal_user');
        // Supabase 쿠키 세션도 함께 만료 (OAuth 로그아웃 포함)
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
