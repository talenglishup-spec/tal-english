'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

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
        // Init from localStorage
        const storedUser = localStorage.getItem('tal_user');
        if (storedUser) {
            try {
                setUser(JSON.parse(storedUser));
            } catch (e) {
                console.error('Failed to parse user session', e);
                localStorage.removeItem('tal_user');
            }
        }
        setIsLoading(false);
    }, []);

    // Strict Auth Guard
    useEffect(() => {
        if (isLoading) return;

        const path = window.location.pathname;
        const isPublic = path === '/';

        if (!user && !isPublic) {
            router.push('/');
        } else if (user && isPublic) {
            if (user.role === 'teacher' || user.role === 'admin') {
                router.push('/teacher');
            } else {
                router.push('/home');
            }
        }
    }, [user, isLoading, router]);

    // Login via API
    const login = async (userData: any) => {
        // userData comes from the API response now
        setUser(userData);
        localStorage.setItem('tal_user', JSON.stringify(userData));
    };

    const logout = () => {
        setUser(null);
        localStorage.removeItem('tal_user');
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
