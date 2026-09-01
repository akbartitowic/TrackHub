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

// Resting position (relative 0..1) blobs settle into before/without any mouse input —
// placed near the bottom-left brand text so the liquid "pools" there by default.
const LIQUID_REST = { x: 0.32, y: 0.74 };

// Each blob chases the cursor at its own ease speed/offset so they trail one another
// like fluid with inertia, instead of moving as one rigid group.
const LIQUID_BLOBS = [
    { size: 520, ease: 0.055, offset: { x: 0, y: 0 }, color: '#EE5D2B', opacity: 0.5 },
    { size: 440, ease: 0.032, offset: { x: 70, y: -50 }, color: '#fff7ec', opacity: 0.45 },
    { size: 600, ease: 0.02, offset: { x: -80, y: 60 }, color: '#1e2a52', opacity: 0.4 },
];

function LiquidBackdrop({ containerRef }) {
    const blobElsRef = useRef([]);
    const posRef = useRef(LIQUID_BLOBS.map(() => ({ ...LIQUID_REST })));
    const targetRef = useRef({ ...LIQUID_REST });

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return undefined;

        const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        const handleMove = (e) => {
            targetRef.current = {
                x: e.clientX / window.innerWidth,
                y: e.clientY / window.innerHeight,
            };
        };
        const handleLeave = () => {
            targetRef.current = { ...LIQUID_REST };
        };
        window.addEventListener('mousemove', handleMove);
        window.addEventListener('mouseleave', handleLeave);

        let rafId;
        let frame = 0;
        const tick = () => {
            frame += 1;
            const rect = container.getBoundingClientRect();

            LIQUID_BLOBS.forEach((cfg, i) => {
                const pos = posRef.current[i];
                // Subtle idle drift keeps the liquid gently alive even at rest.
                const idleX = reduceMotion ? 0 : Math.sin(frame / 260 + i * 2) * 0.015;
                const idleY = reduceMotion ? 0 : Math.cos(frame / 220 + i * 2) * 0.015;
                const tx = targetRef.current.x + idleX;
                const ty = targetRef.current.y + idleY;
                pos.x += (tx - pos.x) * cfg.ease;
                pos.y += (ty - pos.y) * cfg.ease;

                const el = blobElsRef.current[i];
                if (el) {
                    const px = pos.x * rect.width + cfg.offset.x;
                    const py = pos.y * rect.height + cfg.offset.y;
                    el.style.transform = `translate3d(${px}px, ${py}px, 0) translate(-50%, -50%)`;
                }
            });

            rafId = requestAnimationFrame(tick);
        };
        rafId = requestAnimationFrame(tick);

        return () => {
            window.removeEventListener('mousemove', handleMove);
            window.removeEventListener('mouseleave', handleLeave);
            cancelAnimationFrame(rafId);
        };
    }, [containerRef]);

    return (
        <div className="absolute inset-0 pointer-events-none" style={{ filter: 'blur(30px)' }}>
            {LIQUID_BLOBS.map((cfg, i) => (
                <div
                    key={i}
                    ref={(el) => { blobElsRef.current[i] = el; }}
                    className="absolute top-0 left-0 rounded-full"
                    style={{
                        width: cfg.size,
                        height: cfg.size,
                        opacity: cfg.opacity,
                        mixBlendMode: 'soft-light',
                        background: `radial-gradient(circle at center, ${cfg.color} 0%, ${cfg.color} 35%, transparent 72%)`,
                    }}
                />
            ))}
        </div>
    );
}

export default function Login() {
    const { login } = useAuth();
    const { app_name, app_tagline } = useAppBranding();
    const navigate = useNavigate();
    const isLocalDev = import.meta.env.DEV || ['localhost', '127.0.0.1'].includes(window.location.hostname);
    const [credentials, setCredentials] = useState({
        email: isLocalDev ? 'admin@example.com' : '',
        password: isLocalDev ? 'password123' : '',
    });
    const [rememberMe, setRememberMe] = useState(true);
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const leftPanelRef = useRef(null);
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
        <div className="min-h-screen flex bg-[#000040] font-sans">
            <AnnouncementModal items={announcements} onCloseAll={() => dismissAnnouncement(announcements.map((a) => a.id))} />

            {/* Left panel — brand, hidden on small screens */}
            <div ref={leftPanelRef} className="hidden md:flex relative w-1/2 overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-[#f4e9da] via-[#dcc3ac] to-[#4b5568]" />
                <LiquidBackdrop containerRef={leftPanelRef} />

                <div className="relative z-10 flex flex-col justify-end h-full px-12 pb-14 lg:px-16 lg:pb-20">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="size-12 bg-white/15 backdrop-blur-md rounded-xl flex items-center justify-center border border-white/20">
                            <AppLogo alt="Application logo" className="size-8" />
                        </div>
                        <span className="text-4xl font-black text-white tracking-wide">{app_name || 'Noohtify'}</span>
                    </div>
                    <p className="text-white/75 font-medium text-base max-w-[18rem] leading-relaxed tracking-wide">
                        {app_tagline || 'Software Management'}
                    </p>
                </div>
            </div>

            {/* Right panel — sign-in card */}
            <div className="relative flex-1 flex items-center justify-center overflow-hidden">
                <div className="absolute inset-0 bg-[#3d4759]" />
                <div className="absolute top-[-15%] left-[10%] size-[32rem] bg-slate-400/25 rounded-full blur-[120px]" />
                <div className="absolute top-[10%] right-[-10%] size-96 bg-primary/40 rounded-full blur-[110px]" />
                <div className="absolute bottom-[-20%] left-[-10%] size-[28rem] bg-[#232a38]/80 rounded-full blur-[110px]" />
                <div className="absolute bottom-[-15%] right-[5%] size-96 bg-accent/10 rounded-full blur-[120px]" />

                <div className="relative z-10 w-full max-w-md p-4 sm:p-8 flex flex-col items-center">
                    {/* Compact brand mark for small screens where the left panel is hidden */}
                    <div className="flex md:hidden items-center justify-center gap-2.5 mb-6 w-full">
                        <div className="size-10 bg-white/10 backdrop-blur-md rounded-xl flex items-center justify-center border border-white/20">
                            <AppLogo alt="Application logo" className="size-6" />
                        </div>
                        <span className="text-xl font-black text-white tracking-tight">{app_name || 'Noohtify'}</span>
                    </div>

                    <div className="w-full rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur-xl sm:p-8">
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
                                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-slate-500 group-focus-within:text-accent transition-colors" />
                                    <Input
                                        type="email"
                                        required
                                        placeholder="you@company.com"
                                        className="pl-12 h-13 bg-white/5 border-white/10 text-white placeholder:text-slate-400 rounded-2xl focus:ring-accent focus:border-accent transition-all"
                                        value={credentials.email}
                                        onChange={e => setCredentials({ ...credentials, email: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider ml-1">Password</label>
                                <div className="relative group">
                                    <Lock className="pointer-events-none absolute left-4 top-1/2 z-10 size-5 -translate-y-1/2 text-slate-500 transition-colors group-focus-within:text-accent" />
                                    <PasswordInput
                                        required
                                        placeholder="••••••••"
                                        className="h-13 rounded-2xl border-white/10 bg-white/5 pl-12 text-white placeholder:text-slate-400 transition-all focus:border-accent focus:ring-accent"
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
                                className="w-full h-13 bg-accent hover:bg-orange-600 text-white font-bold rounded-2xl shadow-lg shadow-accent/20 transition-all hover:scale-[1.02] active:scale-[0.98] mt-2"
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
