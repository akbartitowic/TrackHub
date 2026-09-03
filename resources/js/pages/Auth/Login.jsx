import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, LogIn, AlertCircle, Info, CheckCircle2, AlertTriangle, AlertOctagon, Download } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { getDefaultLandingPath } from '../../utils/permissions';
import { fetchAPI } from '../../services/api';
import { useAppBranding } from '../../context/AppBrandingContext';
import AppLogo from '../../components/AppLogo';

const ANNOUNCEMENT_TYPE_META = {
    info: { Icon: Info, accentClass: 'text-sky-300' },
    success: { Icon: CheckCircle2, accentClass: 'text-emerald-300' },
    warning: { Icon: AlertTriangle, accentClass: 'text-amber-300' },
    danger: { Icon: AlertOctagon, accentClass: 'text-rose-300' },
};

const AUTO_SLIDE_MS = 6000;

// sessionStorage (not localStorage) on purpose — a dismissed announcement stays
// hidden across refreshes in this tab/session, but reappears next time the
// visitor opens a fresh browser session, so a still-relevant notice isn't
// silently gone forever after one dismiss.
const DISMISSED_ANNOUNCEMENTS_KEY = 'hubtask_dismissed_announcements';

function readDismissedIds() {
    try {
        const raw = sessionStorage.getItem(DISMISSED_ANNOUNCEMENTS_KEY);
        const ids = raw ? JSON.parse(raw) : [];
        return Array.isArray(ids) ? ids : [];
    } catch {
        return [];
    }
}

/** Fetches active announcements and tracks which ones have been dismissed this session. */
function useAnnouncements() {
    const [announcements, setAnnouncements] = useState([]);
    const [dismissedIds, setDismissedIds] = useState(() => readDismissedIds());

    useEffect(() => {
        let cancelled = false;
        fetchAPI('/announcements/active')
            .then((res) => {
                if (!cancelled) setAnnouncements(res.data || []);
            })
            .catch(() => {
                // Best-effort: the login page must never break because a banner failed to load.
            });
        return () => { cancelled = true; };
    }, []);

    // Accepts a single id or an array (closing the modal dismisses everything shown at once).
    // Functional setState so multiple dismiss calls in the same tick never clobber each other.
    const dismiss = (idOrIds) => {
        const ids = Array.isArray(idOrIds) ? idOrIds : [idOrIds];
        setDismissedIds((prev) => {
            const next = [...new Set([...prev, ...ids])];
            try {
                sessionStorage.setItem(DISMISSED_ANNOUNCEMENTS_KEY, JSON.stringify(next));
            } catch {
                // Private-browsing/storage-blocked: dismissal just won't persist across reloads.
            }
            return next;
        });
    };

    return {
        visible: announcements.filter((a) => !dismissedIds.includes(a.id)),
        dismiss,
    };
}

/** Popup shown on page load when there's at least one active announcement — auto-advances through
 *  the rest if there's more than one. Closing it (X, backdrop, Escape, or the Close button) dismisses
 *  everything currently queued for the session in one go. */
function AnnouncementModal({ items, onCloseAll }) {
    const [index, setIndex] = useState(0);
    const [paused, setPaused] = useState(false);
    const open = items.length > 0;

    useEffect(() => {
        setIndex((i) => Math.min(i, Math.max(items.length - 1, 0)));
    }, [items.length]);

    useEffect(() => {
        if (!open || paused || items.length <= 1) return undefined;
        const timer = setInterval(() => {
            setIndex((i) => (i + 1) % items.length);
        }, AUTO_SLIDE_MS);
        return () => clearInterval(timer);
    }, [open, paused, items.length]);

    if (!open) return null;

    const current = items[index];
    const meta = ANNOUNCEMENT_TYPE_META[current.type] || ANNOUNCEMENT_TYPE_META.info;

    return (
        <Dialog open={open} onOpenChange={(next) => !next && onCloseAll()}>
            <DialogContent
                className="border-white/10 bg-[#151b28] sm:max-w-md"
                onMouseEnter={() => setPaused(true)}
                onMouseLeave={() => setPaused(false)}
            >
                <DialogHeader>
                    <div className="mx-auto mb-1 flex size-11 items-center justify-center rounded-full bg-white/10">
                        <meta.Icon className={`size-5 ${meta.accentClass}`} />
                    </div>
                    <DialogTitle className="text-center text-white">{current.title}</DialogTitle>
                    <DialogDescription className="text-center whitespace-pre-line break-words text-slate-300">
                        {current.message}
                    </DialogDescription>
                </DialogHeader>

                {current.attachment_url && (
                    <a
                        href={current.attachment_url}
                        download={current.attachment_name || undefined}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mx-auto inline-flex items-center gap-2 rounded-lg bg-white/10 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/20"
                    >
                        <Download className="size-4" />
                        Download attachment
                    </a>
                )}

                {items.length > 1 && (
                    <div className="flex items-center justify-center gap-1.5">
                        {items.map((a, i) => (
                            <button
                                key={a.id}
                                type="button"
                                onClick={() => setIndex(i)}
                                aria-label={`Show announcement ${i + 1}`}
                                className={`h-1.5 rounded-full transition-all ${i === index ? 'w-5 bg-white' : 'w-1.5 bg-white/30 hover:bg-white/50'}`}
                            />
                        ))}
                    </div>
                )}

                <DialogFooter className="sm:justify-center">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={onCloseAll}
                        className="w-full border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white sm:w-auto"
                    >
                        Close
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

export default function Login() {
    const { login } = useAuth();
    const { app_name, login_title, login_subtitle } = useAppBranding();
    const navigate = useNavigate();
    const isLocalDev = import.meta.env.DEV || ['localhost', '127.0.0.1'].includes(window.location.hostname);
    const [credentials, setCredentials] = useState({
        email: isLocalDev ? 'admin@example.com' : '',
        password: isLocalDev ? 'password123' : '',
    });
    const [rememberMe, setRememberMe] = useState(true);
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const { visible: announcements, dismiss: dismissAnnouncement } = useAnnouncements();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            const res = await login(credentials.email, credentials.password);
            if (res.success) {
                navigate(res.user?.password_expired ? '/force-change-password' : getDefaultLandingPath(res.user));
            } else {
                setError(res.message);
            }
        } catch (err) {
            setError("Something went wrong. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex bg-[#0B192C] font-sans">
            <AnnouncementModal items={announcements} onCloseAll={() => dismissAnnouncement(announcements.map((a) => a.id))} />

            {/* Left panel — brand, hidden on small screens */}
            <div className="hidden md:flex relative w-1/2 overflow-hidden bg-[#00529C]">
                <div className="relative z-10 flex flex-col justify-between h-full p-12 lg:p-16">
                    <div className="flex items-center gap-3">
                        <div className="h-12 px-3.5 bg-white rounded-2xl flex items-center justify-center border border-white/20 shadow-md">
                            <AppLogo alt="MyActivity logo" className="h-8 w-auto object-contain" />
                        </div>
                    </div>

                    <div className="space-y-4 max-w-md">
                        <div className="inline-block px-3 py-1 rounded-full bg-white/15 border border-white/20 text-xs font-semibold tracking-wider uppercase text-white">
                            Activity Management
                        </div>
                        <h1 className="text-4xl lg:text-5xl font-extrabold text-white leading-tight tracking-tight">
                            {login_title || 'MyActivity'}
                        </h1>
                        <p className="text-sky-100/90 font-normal text-base lg:text-lg leading-relaxed">
                            {login_subtitle || 'Task management connected to your world.'}
                        </p>
                    </div>

                    <div className="text-xs text-sky-200/70 font-medium">
                        &copy; {new Date().getFullYear()} MyActivity. All rights reserved.
                    </div>
                </div>
            </div>

            {/* Right panel — sign-in card */}
            <div className="relative flex-1 flex items-center justify-center bg-[#0B192C] p-4 sm:p-8">
                <div className="relative z-10 w-full max-w-md flex flex-col items-center">
                    {/* Compact brand mark for small screens where the left panel is hidden */}
                    <div className="flex md:hidden items-center justify-center gap-2.5 mb-6 w-full">
                        <div className="h-11 px-4 bg-white rounded-xl flex items-center justify-center border border-white/10 shadow-sm">
                            <AppLogo alt="MyActivity logo" className="h-7 w-auto object-contain" />
                        </div>
                    </div>

                    <div className="w-full rounded-3xl border border-[#1E3A5F] bg-[#112239] p-6 shadow-2xl sm:p-8">
                        <div className="text-center mb-8">
                            <h2 className="text-2xl font-black text-white tracking-tight">Welcome back</h2>
                            <p className="text-slate-400 font-medium mt-1 text-sm">Sign in to continue</p>
                        </div>

                        {error && (
                            <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-center gap-3 text-rose-200 text-sm animate-in fade-in slide-in-from-top-2">
                                <AlertCircle className="size-5 shrink-0" />
                                {error}
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-5">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider ml-1">Email</label>
                                <div className="relative group">
                                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-slate-400 group-focus-within:text-[#3FA9F5] transition-colors" />
                                    <Input
                                        type="email"
                                        required
                                        placeholder="you@company.com"
                                        className="pl-12 h-13 bg-[#0B192C] border-[#1E3A5F] text-white placeholder:text-slate-500 rounded-2xl focus:ring-[#3FA9F5] focus:border-[#3FA9F5] transition-all"
                                        value={credentials.email}
                                        onChange={e => setCredentials({ ...credentials, email: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider ml-1">Password</label>
                                <div className="relative group">
                                    <Lock className="pointer-events-none absolute left-4 top-1/2 z-10 size-5 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-[#3FA9F5]" />
                                    <PasswordInput
                                        required
                                        placeholder="••••••••"
                                        className="h-13 rounded-2xl border-[#1E3A5F] bg-[#0B192C] pl-12 text-white placeholder:text-slate-500 transition-all focus:border-[#3FA9F5] focus:ring-[#3FA9F5]"
                                        toggleButtonClassName="text-slate-400 hover:bg-white/10 hover:text-white dark:hover:bg-white/10"
                                        value={credentials.password}
                                        onChange={e => setCredentials({ ...credentials, password: e.target.value })}
                                    />
                                </div>
                            </div>

                            <label className="flex items-center gap-2.5 select-none cursor-pointer">
                                <Checkbox
                                    checked={rememberMe}
                                    onCheckedChange={(checked) => setRememberMe(checked === true)}
                                />
                                <span className="text-sm font-medium text-slate-300">Remember me</span>
                            </label>

                            <Button
                                type="submit"
                                disabled={isLoading}
                                className="w-full h-13 bg-[#00529C] hover:bg-[#00417C] text-white font-bold rounded-2xl shadow-lg shadow-blue-900/40 transition-all hover:scale-[1.01] active:scale-[0.99] mt-2"
                            >
                                {isLoading ? (
                                    <RefreshCcw className="size-5 animate-spin mr-2" />
                                ) : (
                                    <LogIn className="size-5 mr-2" />
                                )}
                                Sign in
                            </Button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
}

const RefreshCcw = ({ className }) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" /><path d="M16 16h5v5" /></svg>
);
