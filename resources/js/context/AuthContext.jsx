import { createContext, useContext, useState, useEffect } from 'react';
import { fetchAPI } from '../services/api';

const AuthContext = createContext();

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [loginNotifications, setLoginNotifications] = useState(null);

    useEffect(() => {
        const token = localStorage.getItem('auth_token');
        if (token) {
            fetchUser();
        } else {
            setLoading(false);
        }
    }, []);

    const fetchUser = async () => {
        try {
            const res = await fetchAPI('/me');
            if (res.status === 'success') {
                setUser(res.user);
            }
        } catch (err) {
            console.error("Failed to fetch user", err);
        } finally {
            setLoading(false);
        }
    };

    const login = async (email, password) => {
        const res = await fetchAPI('/login', {
            method: 'POST',
            body: JSON.stringify({ email, password })
        });

        if (res.status === 'success') {
            localStorage.setItem('auth_token', res.access_token);
            setUser(res.user);
            // Skip the unread-notifications popup when the user is about to be forced
            // into the mandatory password-change page — nothing else should show first.
            if (!res.user?.password_expired) {
                fetchUnreadForLoginPopup();
            }
            return { success: true, user: res.user };
        }
        return { success: false, message: res.message };
    };

    // Best-effort: shown once right after a successful login, never blocks the login flow itself.
    const fetchUnreadForLoginPopup = async () => {
        try {
            const res = await fetchAPI('/notifications/unread');
            if (res?.data?.length) {
                setLoginNotifications({ items: res.data, total: res?.meta?.total ?? res.data.length });
            }
        } catch {
            // Silent — popup just won't show, bell/badge still reflects unread state normally.
        }
    };

    const dismissLoginNotifications = () => setLoginNotifications(null);

    const signup = async (userData) => {
        const res = await fetchAPI('/signup', {
            method: 'POST',
            body: JSON.stringify(userData)
        });

        if (res.status === 'success') {
            localStorage.setItem('auth_token', res.access_token);
            setUser(res.user);
            return { success: true };
        }
        return { success: false, message: res.message };
    };

    const logout = async () => {
        try {
            await fetchAPI('/logout', { method: 'POST' });
        } catch (err) {
            console.error("Logout error", err);
        } finally {
            localStorage.removeItem('auth_token');
            setUser(null);
            window.location.href = '/login';
        }
    };

    const updateProfile = async (profileData) => {
        const res = await fetchAPI('/profile', {
            method: 'PUT',
            body: JSON.stringify(profileData)
        });

        if (res.status === 'success') {
            if (res.force_logout) {
                localStorage.removeItem('auth_token');
                setUser(null);
                return { success: true, message: res.message, forceLogout: true };
            }
            setUser(res.user);
            return { success: true, message: res.message };
        }
        return { success: false, message: res.message };
    };

    // Used by the mandatory password-rotation page (user.password_expired === true).
    // Always force-logs-out on success — same policy as a voluntary change in updateProfile().
    const forceChangePassword = async (payload) => {
        const res = await fetchAPI('/force-password-change', {
            method: 'POST',
            body: JSON.stringify(payload),
        });

        if (res.status === 'success') {
            if (res.force_logout) {
                localStorage.removeItem('auth_token');
                setUser(null);
            }
            return { success: true, message: res.message };
        }
        return { success: false, message: res.message };
    };

    // Exposed so screens that mutate the user outside updateProfile() (e.g. avatar
    // upload, which uses its own multipart request) can sync the returned user
    // straight into context without a full refetch.
    const setUserDirect = (nextUser) => setUser(nextUser);

    return (
        <AuthContext.Provider value={{ user, loading, login, signup, logout, updateProfile, forceChangePassword, loginNotifications, dismissLoginNotifications, setUserDirect }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);
