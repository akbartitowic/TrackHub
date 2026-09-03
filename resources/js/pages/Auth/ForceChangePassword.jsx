import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { ShieldAlert, Lock, KeyRound, AlertCircle } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import AppLogo from '../../components/AppLogo';

// Full-page, unskippable gate shown when User::isPasswordExpired() is true (password not
// changed in 6+ months). Reached right after login (Login.jsx) and re-enforced on every
// route render while user.password_expired is true (see App.jsx's ProtectedRoute).
export default function ForceChangePassword() {
    const { user, forceChangePassword } = useAuth();
    const [data, setData] = useState({ current_password: '', password: '', password_confirmation: '' });
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (data.password !== data.password_confirmation) {
            setError('New password confirmation does not match.');
            return;
        }

        setIsLoading(true);
        try {
            const res = await forceChangePassword(data);
            if (res.success) {
                alert(res.message || 'Password changed successfully. Please log in again.');
                window.location.href = '/login';
                return;
            }
            setError(res.message || 'Failed to change password.');
        } catch (err) {
            setError(err.message || 'Failed to change password.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-[#0B192C] font-sans p-4">
            <div className="relative z-10 w-full max-w-md">
                <div className="flex items-center justify-center gap-2.5 mb-6">
                    <div className="h-12 px-4 bg-white rounded-xl flex items-center justify-center border border-white/20 shadow-md">
                        <AppLogo alt="MyActivity logo" className="h-7 w-auto object-contain" />
                    </div>
                </div>

                <div className="rounded-3xl border border-[#1E3A5F] bg-[#112239] p-6 shadow-2xl sm:p-8">
                    <div className="text-center mb-6">
                        <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-amber-500/15 text-amber-400">
                            <ShieldAlert className="size-6" />
                        </div>
                        <h2 className="text-xl font-black text-white tracking-tight">Your Password Has Expired</h2>
                        <p className="text-slate-400 font-medium mt-1 text-sm">
                            For security, passwords must be changed every 6 months{user?.name ? `, ${user.name}` : ''}.
                            Please set a new password to continue.
                        </p>
                    </div>

                    {error && (
                        <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-center gap-3 text-rose-200 text-sm animate-in fade-in slide-in-from-top-2">
                            <AlertCircle className="size-5 shrink-0" />
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-300 uppercase tracking-wider ml-1">Current Password</label>
                            <div className="relative group">
                                <Lock className="pointer-events-none absolute left-4 top-1/2 z-10 size-5 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-[#3FA9F5]" />
                                <PasswordInput
                                    required
                                    placeholder="••••••••"
                                    className="h-13 rounded-2xl border-[#1E3A5F] bg-[#0B192C] pl-12 text-white placeholder:text-slate-500 transition-all focus:border-[#3FA9F5] focus:ring-[#3FA9F5]"
                                    toggleButtonClassName="text-slate-400 hover:bg-white/10 hover:text-white dark:hover:bg-white/10"
                                    value={data.current_password}
                                    onChange={e => setData({ ...data, current_password: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-300 uppercase tracking-wider ml-1">New Password</label>
                            <div className="relative group">
                                <KeyRound className="pointer-events-none absolute left-4 top-1/2 z-10 size-5 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-[#3FA9F5]" />
                                <PasswordInput
                                    required
                                    minLength={8}
                                    placeholder="Minimum 8 characters"
                                    className="h-13 rounded-2xl border-[#1E3A5F] bg-[#0B192C] pl-12 text-white placeholder:text-slate-500 transition-all focus:border-[#3FA9F5] focus:ring-[#3FA9F5]"
                                    toggleButtonClassName="text-slate-400 hover:bg-white/10 hover:text-white dark:hover:bg-white/10"
                                    value={data.password}
                                    onChange={e => setData({ ...data, password: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-300 uppercase tracking-wider ml-1">Confirm New Password</label>
                            <div className="relative group">
                                <KeyRound className="pointer-events-none absolute left-4 top-1/2 z-10 size-5 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-[#3FA9F5]" />
                                <PasswordInput
                                    required
                                    minLength={8}
                                    placeholder="Repeat the new password"
                                    className="h-13 rounded-2xl border-[#1E3A5F] bg-[#0B192C] pl-12 text-white placeholder:text-slate-500 transition-all focus:border-[#3FA9F5] focus:ring-[#3FA9F5]"
                                    toggleButtonClassName="text-slate-400 hover:bg-white/10 hover:text-white dark:hover:bg-white/10"
                                    value={data.password_confirmation}
                                    onChange={e => setData({ ...data, password_confirmation: e.target.value })}
                                />
                            </div>
                        </div>

                        <p className="text-xs text-slate-400 leading-relaxed">
                            Your new password can't be the same as your last 3 passwords.
                        </p>

                        <Button
                            type="submit"
                            disabled={isLoading}
                            className="w-full h-13 bg-[#00529C] hover:bg-[#00417C] text-white font-bold rounded-2xl shadow-lg shadow-blue-900/40 transition-all hover:scale-[1.01] active:scale-[0.99] mt-2"
                        >
                            {isLoading ? 'Saving...' : 'Change Password'}
                        </Button>
                    </form>
                </div>
            </div>
        </div>
    );
}
