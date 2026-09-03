import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { CalendarOff, ArrowUpDown, Check, ChevronDown, ExternalLink, Loader2, Plus, Search, Settings, SlidersHorizontal, Trash2, X } from 'lucide-react';
import PaginationControls from '../components/ui/PaginationControls';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import {
    LOAD_ALL_ROW_HEIGHT,
    LOAD_DAY_WIDTH,
    LOAD_ROW_HEIGHT,
    LOAD_USER_COL_WIDTH,
    buildLoadMonthBands,
    formatLoadDateLong,
    formatLoadMh,
    formatWeekdayHeader,
    isExcludedLoadDate,
    isNonWorkingLoadDay,
    isWeekendDate,
    loadCellClasses,
    loadPeakDotClass,
    nonWorkingDayTitle,
} from '../utils/teamLoad';

export default function TeamLoad() {
    const navigate = useNavigate();
    const { user: currentUser } = useAuth();
    const [loading, setLoading]                   = useState(true);
    const [savingExcluded, setSavingExcluded]     = useState(false);
    const [payload, setPayload]                   = useState(null);
    const [searchQuery, setSearchQuery]           = useState('');
    const [selectedRoleIds, setSelectedRoleIds]   = useState([]);
    const [selectedUserIds, setSelectedUserIds]   = useState([]);
    const [cellDetail, setCellDetail]             = useState(null);
    const [showExcludedDialog, setShowExcludedDialog] = useState(false);
    const [newExcludedDate, setNewExcludedDate]   = useState('');
    const [newExcludedLabel, setNewExcludedLabel] = useState('');
    const [roleDropdownOpen, setRoleDropdownOpen] = useState(false);
    const [roleSearchQuery, setRoleSearchQuery]   = useState('');
    const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
    const [relatedOnly, setRelatedOnly]           = useState(true);
    const [sortOrder, setSortOrder]               = useState('asc');
    const [chartPage, setChartPage]               = useState(1);
    const [chartPageSize, setChartPageSize]       = useState(15);
    const chartScrollRef  = useRef(null);
    const roleDropdownRef = useRef(null);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetchAPI('/team-load');
            setPayload(res);
        } catch (err) {
            console.error('Failed to load team load', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { loadData(); }, [loadData]);

    const users               = payload?.users || [];
    const roles               = payload?.roles || [];
    const timelineDays        = payload?.timeline_days || payload?.weekdays || [];
    const excludedDates       = payload?.excluded_dates || [];
    const excludedDateStrings = useMemo(() => excludedDates.map((e) => e.date), [excludedDates]);
    const excludedLabelByDate = useMemo(() => {
        const map = {};
        for (const e of excludedDates) map[e.date] = e.label;
        return map;
    }, [excludedDates]);

    const toggleRole = (roleId) =>
        setSelectedRoleIds((prev) => prev.includes(roleId) ? prev.filter((id) => id !== roleId) : [...prev, roleId]);

    const toggleUser = (userId) =>
        setSelectedUserIds((prev) => prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]);

    const currentUserProjectIds = useMemo(() => {
        if (!currentUser) return new Set();
        const me = users.find((u) => u.id === currentUser.id);
        return new Set(me?.project_ids ?? []);
    }, [users, currentUser]);

    const matchesRoleFilter = (user) => {
        if (selectedRoleIds.length === 0) return true;
        return (user.roles || []).some((r) => selectedRoleIds.includes(r.id));
    };

    const sidebarUsers = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        let list = users.filter(matchesRoleFilter);
        if (relatedOnly && currentUserProjectIds.size > 0) {
            list = list.filter((u) =>
                u.id === currentUser?.id ||
                (u.project_ids ?? []).some((pid) => currentUserProjectIds.has(pid))
            );
        }
        if (q) list = list.filter((u) => u.name.toLowerCase().includes(q));
        list = [...list].sort((a, b) =>
            sortOrder === 'asc'
                ? a.name.localeCompare(b.name)
                : b.name.localeCompare(a.name)
        );
        return list;
    }, [users, searchQuery, selectedRoleIds, relatedOnly, currentUserProjectIds, currentUser, sortOrder]);

    const displayUsers = useMemo(() => {
        const base = selectedUserIds.length > 0
            ? sidebarUsers.filter((u) => selectedUserIds.includes(u.id))
            : sidebarUsers;
        return base;
    }, [sidebarUsers, selectedUserIds]);

    const pagedDisplayUsers = useMemo(() => {
        if (selectedUserIds.length > 0) return displayUsers;
        return displayUsers.slice((chartPage - 1) * chartPageSize, chartPage * chartPageSize);
    }, [displayUsers, selectedUserIds, chartPage, chartPageSize]);

    const monthBands   = useMemo(() => buildLoadMonthBands(timelineDays, LOAD_DAY_WIDTH), [timelineDays]);
    const chartWidth   = timelineDays.length * LOAD_DAY_WIDTH;
    const rowHeight    = LOAD_ALL_ROW_HEIGHT;
    const userColWidth = LOAD_USER_COL_WIDTH;

    const todayKey = useMemo(() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }, []);

    const openCellDetail = (user, date, mh) => {
        if (mh <= 0 || isNonWorkingLoadDay(date, excludedDateStrings)) return;
        setCellDetail({ user, date, mh, items: user.daily_details?.[date] || [] });
    };

    const scrollToToday = () => {
        const el = chartScrollRef.current;
        if (!el || !timelineDays.length) return;
        const idx = timelineDays.indexOf(todayKey);
        if (idx < 0) return;
        el.scrollLeft = Math.max(0, userColWidth + idx * LOAD_DAY_WIDTH - el.clientWidth / 2 + LOAD_DAY_WIDTH / 2);
    };

    useLayoutEffect(() => {
        if (loading || !pagedDisplayUsers.length || !timelineDays.length) return;
        scrollToToday();
        const frame = requestAnimationFrame(() => scrollToToday());
        return () => cancelAnimationFrame(frame);
    }, [loading, pagedDisplayUsers.length, timelineDays.length, todayKey]);

    useEffect(() => {
        if (!roleDropdownOpen) return;
        const handler = (e) => {
            if (roleDropdownRef.current && !roleDropdownRef.current.contains(e.target)) {
                setRoleDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [roleDropdownOpen]);

    const handleAddExcludedDate = async () => {
        if (!newExcludedDate) return;
        setSavingExcluded(true);
        try {
            const res = await fetchAPI('/team-load/excluded-dates', {
                method: 'POST',
                body: JSON.stringify({ date: newExcludedDate, label: newExcludedLabel.trim() || null }),
            });
            setPayload(res.data || res);
            setNewExcludedDate('');
            setNewExcludedLabel('');
        } catch (err) {
            alert(err.message || 'Gagal menambah tanggal libur.');
        } finally {
            setSavingExcluded(false);
        }
    };

    const handleRemoveExcludedDate = async (id) => {
        setSavingExcluded(true);
        try {
            const res = await fetchAPI(`/team-load/excluded-dates/${id}`, { method: 'DELETE' });
            setPayload(res.data || res);
        } catch (err) {
            alert(err.message || 'Gagal menghapus tanggal libur.');
        } finally {
            setSavingExcluded(false);
        }
    };

    const getDayCellClass = (date) => {
        if (isExcludedLoadDate(date, excludedDateStrings))
            return 'bg-violet-100/90 dark:bg-violet-950/40 text-violet-600 dark:text-violet-300';
        if (isWeekendDate(date))
            return 'bg-slate-100/90 dark:bg-slate-800/60 text-slate-400';
        return '';
    };

    if (loading && !payload) {
        return (
            <div className="flex-1 flex items-center justify-center min-h-[320px]">
                <Loader2 className="size-8 animate-spin text-primary" />
            </div>
        );
    }

    const hasActiveFilter = selectedUserIds.length > 0 || selectedRoleIds.length > 0 || searchQuery.trim();

    return (
        <div className="relative flex-1 flex flex-col min-h-0 overflow-hidden bg-slate-50 dark:bg-[#0B192C]">
            <div className="relative z-10 flex flex-1 flex-col min-h-0 overflow-hidden p-4 sm:p-6 gap-4">

            {/* ── Header ── */}
            <div className="shrink-0 flex items-center justify-between gap-3">
                <div>
                    <h1 className="text-xl font-bold text-slate-900 dark:text-white">Team Load</h1>
                    {payload?.range_start && (
                        <p className="text-xs text-slate-400 mt-0.5">
                            {payload.range_start} — {payload.range_end}
                        </p>
                    )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    <Button
                        variant="outline"
                        size="sm"
                        className="md:hidden h-8 gap-1.5 relative"
                        onClick={() => setMobileSidebarOpen(true)}
                    >
                        <SlidersHorizontal className="size-3.5" />
                        Filters
                        {hasActiveFilter && (
                            <span className="absolute -top-1 -right-1 size-2 rounded-full bg-primary" />
                        )}
                    </Button>
                    {loading && <Loader2 className="size-4 animate-spin text-primary" />}
                    <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={scrollToToday}>
                        Hari Ini
                    </Button>
                    <Button variant="outline" size="sm" className="h-8 gap-1.5"
                        onClick={() => setShowExcludedDialog(true)}>
                        <CalendarOff className="size-3.5" />
                        <span className="hidden sm:inline">Tanggal Libur</span>
                        {excludedDates.length > 0 && (
                            <span className="rounded-full bg-slate-200 dark:bg-slate-700 px-1.5 text-[10px] font-bold">
                                {excludedDates.length}
                            </span>
                        )}
                    </Button>
                </div>
            </div>

            {/* ── Main content ── */}
            <div className="flex-1 min-h-0 flex gap-3 overflow-hidden">

                {mobileSidebarOpen && (
                    <button
                        type="button"
                        className="fixed inset-0 z-40 bg-black/40 md:hidden"
                        onClick={() => setMobileSidebarOpen(false)}
                        aria-label="Close filters"
                    />
                )}

                {/* ── Sidebar ── */}
                <div className={cn(
                    'shrink-0 flex flex-col gap-2',
                    // Desktop: always visible, normal layout
                    'md:w-52 md:min-h-0',
                    // Mobile: hidden by default, slide in as overlay when open
                    mobileSidebarOpen
                        ? 'fixed inset-y-0 left-0 z-50 w-72 bg-white/90 backdrop-blur-xl dark:bg-[#151b28]/95 p-4 shadow-2xl overflow-y-auto'
                        : 'hidden md:flex',
                )}>

                    <div className="md:hidden flex items-center justify-between shrink-0 pb-2 border-b border-slate-100 dark:border-slate-800 mb-1">
                        <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Filter</span>
                        <button type="button" onClick={() => setMobileSidebarOpen(false)}>
                            <X className="size-4 text-slate-500" />
                        </button>
                    </div>

                    {/* Search */}
                    <div className="relative">
                        <Search className="absolute left-2.5 top-2 size-3.5 text-slate-400 pointer-events-none" />
                        <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Cari nama..." className="h-8 pl-8 text-sm" />
                        {searchQuery && (
                            <button type="button" onClick={() => setSearchQuery('')}
                                className="absolute right-2 top-2 text-slate-400 hover:text-slate-600">
                                <X className="size-3.5" />
                            </button>
                        )}
                    </div>

                    {/* Tampilkan filter */}
                    <div className="flex rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden text-xs">
                        <button
                            type="button"
                            onClick={() => { setRelatedOnly(true); setChartPage(1); }}
                            className={cn(
                                'flex-1 px-2 py-1.5 font-medium transition-colors',
                                relatedOnly
                                    ? 'bg-primary text-white'
                                    : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800',
                            )}>
                            Terkait
                        </button>
                        <button
                            type="button"
                            onClick={() => { setRelatedOnly(false); setChartPage(1); }}
                            className={cn(
                                'flex-1 px-2 py-1.5 font-medium transition-colors border-l border-slate-200 dark:border-slate-700',
                                !relatedOnly
                                    ? 'bg-primary text-white'
                                    : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800',
                            )}>
                            Semua
                        </button>
                    </div>

                    {/* Role filter dropdown */}
                    {roles.length > 0 && (
                        <div className="relative" ref={roleDropdownRef}>
                            <button
                                type="button"
                                onClick={() => {
                                    setRoleDropdownOpen((o) => !o);
                                    setRoleSearchQuery('');
                                }}
                                className={cn(
                                    'w-full flex items-center justify-between gap-1.5 rounded-lg border px-3 h-8 text-xs transition-colors',
                                    roleDropdownOpen
                                        ? 'border-primary/60 bg-primary/5 text-primary dark:bg-primary/10'
                                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600',
                                )}>
                                <span className="font-medium">
                                    {selectedRoleIds.length > 0
                                        ? `Role (${selectedRoleIds.length})`
                                        : 'Filter Role'}
                                </span>
                                <ChevronDown className={cn('size-3.5 shrink-0 transition-transform', roleDropdownOpen && 'rotate-180')} />
                            </button>

                            {roleDropdownOpen && (
                                <div className="absolute top-full left-0 right-0 mt-1 z-30 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg overflow-hidden">
                                    {/* Search input */}
                                    <div className="p-2 border-b border-slate-100 dark:border-slate-800">
                                        <div className="relative">
                                            <Search className="absolute left-2 top-1.5 size-3 text-slate-400 pointer-events-none" />
                                            <input
                                                autoFocus
                                                value={roleSearchQuery}
                                                onChange={(e) => setRoleSearchQuery(e.target.value)}
                                                placeholder="Cari role..."
                                                className="w-full pl-6 pr-2 py-1 text-xs rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:border-primary/50"
                                            />
                                        </div>
                                    </div>

                                    {/* Role list */}
                                    <div className="max-h-48 overflow-y-auto">
                                        {(() => {
                                            const q = roleSearchQuery.trim().toLowerCase();
                                            const filtered = q.length >= 2
                                                ? roles.filter((r) => r.name.toLowerCase().includes(q))
                                                : roles;

                                            if (filtered.length === 0) {
                                                return (
                                                    <p className="text-[11px] text-slate-400 text-center py-4 px-3">
                                                        {q.length > 0 && q.length < 2
                                                            ? 'Ketik minimal 2 karakter...'
                                                            : 'Tidak ada role ditemukan.'}
                                                    </p>
                                                );
                                            }

                                            if (q.length > 0 && q.length < 2) {
                                                return (
                                                    <p className="text-[11px] text-slate-400 text-center py-4 px-3">
                                                        Ketik minimal 2 karakter...
                                                    </p>
                                                );
                                            }

                                            return filtered.map((role) => {
                                                const active = selectedRoleIds.includes(role.id);
                                                return (
                                                    <button
                                                        key={role.id}
                                                        type="button"
                                                        onClick={() => toggleRole(role.id)}
                                                        className={cn(
                                                            'w-full flex items-center gap-2 px-3 py-2 text-xs border-b border-slate-50 dark:border-slate-800 transition-colors text-left',
                                                            active
                                                                ? 'bg-primary/8 dark:bg-primary/10 text-primary font-medium'
                                                                : 'hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300',
                                                        )}>
                                                        <span className={cn(
                                                            'size-3.5 rounded border flex items-center justify-center shrink-0 transition-colors',
                                                            active ? 'bg-primary border-primary' : 'border-slate-300 dark:border-slate-600',
                                                        )}>
                                                            {active && <Check className="size-2 text-white" />}
                                                        </span>
                                                        {role.name}
                                                    </button>
                                                );
                                            });
                                        })()}
                                    </div>

                                    {/* Footer reset */}
                                    {selectedRoleIds.length > 0 && (
                                        <div className="px-3 py-1.5 border-t border-slate-100 dark:border-slate-800">
                                            <button
                                                type="button"
                                                onClick={() => { setSelectedRoleIds([]); setRoleDropdownOpen(false); }}
                                                className="text-[11px] text-red-500 hover:text-red-600 transition-colors">
                                                Reset filter role
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* User list */}
                    <Card className="flex-1 min-h-0 flex flex-col border-slate-200 dark:border-slate-800 overflow-hidden">
                        <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                {sidebarUsers.length} anggota
                            </span>
                            {selectedUserIds.length > 0 && (
                                <button type="button" onClick={() => setSelectedUserIds([])}
                                    className="text-[10px] text-slate-400 hover:text-red-500 transition-colors">
                                    Reset ({selectedUserIds.length})
                                </button>
                            )}
                        </div>
                        <div className="flex-1 overflow-y-auto">
                            {sidebarUsers.length === 0 ? (
                                <p className="text-xs text-slate-400 text-center py-6 px-3">Tidak ada user ditemukan.</p>
                            ) : (
                                sidebarUsers.map((user) => {
                                    const selected = selectedUserIds.includes(user.id);
                                    return (
                                        <button key={user.id} type="button" onClick={() => toggleUser(user.id)}
                                            className={cn(
                                                'w-full text-left px-3 py-2 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2 transition-colors text-sm',
                                                selected
                                                    ? 'bg-primary/8 dark:bg-primary/10'
                                                    : 'hover:bg-slate-50 dark:hover:bg-slate-800/60',
                                            )}>
                                            <span className={cn(
                                                'size-4 rounded border flex items-center justify-center shrink-0 transition-colors',
                                                selected ? 'bg-primary border-primary' : 'border-slate-300 dark:border-slate-600',
                                            )}>
                                                {selected
                                                    ? <Check className="size-2.5 text-white" />
                                                    : <span className={cn('size-1.5 rounded-full', loadPeakDotClass(user.peak_mh))} />
                                                }
                                            </span>
                                            <span className={cn('truncate flex-1 text-xs', selected ? 'font-semibold text-primary' : 'text-slate-700 dark:text-slate-300')}>
                                                {user.name}
                                            </span>
                                            {user.peak_mh > 0 && (
                                                <span className="text-[10px] text-slate-400 shrink-0 tabular-nums">
                                                    {formatLoadMh(user.peak_mh)}h
                                                </span>
                                            )}
                                        </button>
                                    );
                                })
                            )}
                        </div>
                    </Card>

                    <Button
                        className="md:hidden w-full mt-2"
                        size="sm"
                        onClick={() => setMobileSidebarOpen(false)}
                    >
                        Terapkan Filter
                    </Button>
                </div>

                {/* ── Chart ── */}
                <Card className="flex-1 min-w-0 flex flex-col border-slate-200 dark:border-slate-800 overflow-hidden">

                    {/* Chart top info */}
                    <div className="shrink-0 px-4 py-2 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-3 text-[10px] text-slate-500">
                            <span className="flex items-center gap-1.5">
                                <span className="size-3 rounded border bg-emerald-100 border-emerald-200 dark:bg-emerald-900/40 dark:border-emerald-800" />
                                ≤5 MH
                            </span>
                            <span className="flex items-center gap-1.5">
                                <span className="size-3 rounded border bg-amber-100 border-amber-200 dark:bg-amber-900/40 dark:border-amber-800" />
                                5–8 MH
                            </span>
                            <span className="flex items-center gap-1.5">
                                <span className="size-3 rounded border bg-rose-100 border-rose-200 dark:bg-rose-900/40 dark:border-rose-800" />
                                &gt;8 MH
                            </span>
                            <span className="flex items-center gap-1.5">
                                <span className="size-3 rounded bg-violet-200 dark:bg-violet-900/60" />
                                Libur
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => setSortOrder((s) => s === 'asc' ? 'desc' : 'asc')}
                                className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
                                title={sortOrder === 'asc' ? 'A-Z (klik untuk Z-A)' : 'Z-A (klik untuk A-Z)'}
                            >
                                <ArrowUpDown className="size-3" />
                                {sortOrder === 'asc' ? 'A-Z' : 'Z-A'}
                            </button>
                            <span className="text-slate-300 dark:text-slate-700">·</span>
                            <span className="text-[11px] text-slate-400">
                                {selectedUserIds.length > 0
                                    ? `${displayUsers.length} dipilih`
                                    : `${pagedDisplayUsers.length} dari ${displayUsers.length}`}
                            </span>
                        </div>
                    </div>

                    {pagedDisplayUsers.length === 0 ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-slate-400 text-sm gap-2 py-16">
                            <p>Tidak ada user yang sesuai filter.</p>
                            {(hasActiveFilter || relatedOnly) && (
                                <button type="button"
                                    onClick={() => { setSearchQuery(''); setSelectedRoleIds([]); setSelectedUserIds([]); setRelatedOnly(false); setChartPage(1); }}
                                    className="text-xs text-primary hover:underline">
                                    Reset semua filter
                                </button>
                            )}
                        </div>
                    ) : (
                        <div ref={chartScrollRef} className="flex-1 overflow-auto min-h-0">
                            <div style={{ minWidth: chartWidth + userColWidth }}>

                                {/* Sticky header */}
                                <div className="sticky top-0 z-20 bg-white/90 backdrop-blur-sm dark:bg-[#151b28]/95 border-b border-slate-200 dark:border-slate-800">
                                    <div className="flex h-6 border-b border-slate-100 dark:border-slate-800" style={{ marginLeft: userColWidth }}>
                                        {monthBands.map((m) => (
                                            <div key={m.key}
                                                className="text-[10px] font-bold uppercase tracking-wide text-slate-500 px-1 flex items-center border-r border-slate-100 dark:border-slate-800"
                                                style={{ width: m.days * LOAD_DAY_WIDTH }}>
                                                {m.label}
                                            </div>
                                        ))}
                                    </div>
                                    <div className="flex border-b border-slate-100 dark:border-slate-800">
                                        <div className="shrink-0 sticky left-0 z-30 bg-white/90 backdrop-blur-sm dark:bg-[#151b28]/95 border-r border-slate-200 dark:border-slate-800 px-2 flex items-center text-[10px] font-bold uppercase text-slate-400"
                                            style={{ width: userColWidth, height: rowHeight }}>
                                            Nama / MH
                                        </div>
                                        <div className="flex" style={{ height: rowHeight }}>
                                            {timelineDays.map((date) => (
                                                <div key={date}
                                                    title={excludedLabelByDate[date] || undefined}
                                                    className={cn(
                                                        'text-[10px] flex flex-col items-center justify-center border-r border-slate-100 dark:border-slate-800 text-slate-500',
                                                        getDayCellClass(date),
                                                        date === todayKey && 'ring-1 ring-inset ring-primary/50 font-semibold text-primary',
                                                    )}
                                                    style={{ width: LOAD_DAY_WIDTH }}>
                                                    <span>{formatWeekdayHeader(date)}</span>
                                                    {isExcludedLoadDate(date, excludedDateStrings) && (
                                                        <span className="text-[8px] opacity-60">libur</span>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                {/* Rows */}
                                {pagedDisplayUsers.map((user) => (
                                    <div key={user.id}
                                        className={cn(
                                            'flex border-b border-slate-100 dark:border-slate-800',
                                            selectedUserIds.includes(user.id) && 'bg-primary/5 dark:bg-primary/8',
                                        )}>
                                        <div className="shrink-0 sticky left-0 z-10 bg-white/90 backdrop-blur-sm dark:bg-[#151b28]/95 border-r border-slate-200 dark:border-slate-800 px-2 flex items-center gap-1.5"
                                            style={{ width: userColWidth, height: rowHeight }}>
                                            <span className={cn('size-1.5 rounded-full shrink-0', loadPeakDotClass(user.peak_mh))} />
                                            <span className="text-xs font-medium truncate text-slate-800 dark:text-slate-200">
                                                {user.name}
                                            </span>
                                        </div>
                                        <div className="flex" style={{ height: rowHeight }}>
                                            {timelineDays.map((date) => {
                                                const mh         = user.daily_mh?.[date] ?? 0;
                                                const nonWorking = isNonWorkingLoadDay(date, excludedDateStrings);
                                                const hasLoad    = mh > 0 && !nonWorking;
                                                return (
                                                    <button key={date} type="button" disabled={!hasLoad}
                                                        onClick={() => openCellDetail(user, date, mh)}
                                                        title={
                                                            nonWorking
                                                                ? nonWorkingDayTitle(date, excludedDateStrings) + (excludedLabelByDate[date] ? ` (${excludedLabelByDate[date]})` : '')
                                                                : `${user.name} · ${date}: ${formatLoadMh(mh)} MH`
                                                        }
                                                        className={cn(
                                                            'flex items-center justify-center border-r border-slate-100 dark:border-slate-800 text-[11px] font-semibold transition-opacity',
                                                            nonWorking
                                                                ? cn(getDayCellClass(date), 'cursor-default')
                                                                : hasLoad
                                                                    ? cn(loadCellClasses(mh), 'cursor-pointer hover:opacity-80')
                                                                    : 'bg-slate-50/50 dark:bg-slate-900/30 text-slate-400 cursor-default',
                                                            date === todayKey && 'ring-1 ring-inset ring-primary/40',
                                                        )}
                                                        style={{ width: LOAD_DAY_WIDTH }}>
                                                        {formatLoadMh(mh)}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    {selectedUserIds.length === 0 && displayUsers.length > chartPageSize && (
                        <div className="shrink-0 px-4 py-2 border-t border-slate-100 dark:border-slate-800">
                            <PaginationControls
                                page={chartPage}
                                pageSize={chartPageSize}
                                total={displayUsers.length}
                                onPageChange={setChartPage}
                                onPageSizeChange={(s) => { setChartPageSize(s); setChartPage(1); }}
                            />
                        </div>
                    )}
                </Card>
            </div>

            {/* ── Excluded dates dialog ── */}
            <Dialog open={showExcludedDialog} onOpenChange={setShowExcludedDialog}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <CalendarOff className="size-4" />
                            Tanggal Tidak Dihitung MH
                        </DialogTitle>
                        <DialogDescription>
                            Tanggal libur nasional atau cuti bersama yang dikecualikan dari perhitungan beban MH.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        <div className="flex flex-wrap gap-2 items-end">
                            <div>
                                <label className="text-[10px] text-slate-500 block mb-1">Tanggal</label>
                                <Input type="date" value={newExcludedDate}
                                    onChange={(e) => setNewExcludedDate(e.target.value)}
                                    className="h-8 w-40 text-sm" />
                            </div>
                            <div className="flex-1 min-w-[140px]">
                                <label className="text-[10px] text-slate-500 block mb-1">Label (opsional)</label>
                                <Input value={newExcludedLabel}
                                    onChange={(e) => setNewExcludedLabel(e.target.value)}
                                    placeholder="Misal: Hari Raya Idul Fitri"
                                    className="h-8 text-sm" />
                            </div>
                            <Button size="sm" className="h-8 shrink-0" disabled={!newExcludedDate || savingExcluded}
                                onClick={handleAddExcludedDate}>
                                <Plus className="size-3.5 mr-1" />
                                Tambah
                            </Button>
                        </div>

                        {excludedDates.length === 0 ? (
                            <p className="text-sm text-slate-400 text-center py-4">Belum ada tanggal libur.</p>
                        ) : (
                            <div className="space-y-1.5 max-h-56 overflow-y-auto">
                                {excludedDates.map((ex) => (
                                    <div key={ex.id}
                                        className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2">
                                        <div>
                                            <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{ex.date}</p>
                                            {ex.label && <p className="text-xs text-slate-400">{ex.label}</p>}
                                        </div>
                                        <button type="button" disabled={savingExcluded}
                                            onClick={() => handleRemoveExcludedDate(ex.id)}
                                            className="rounded p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors">
                                            <Trash2 className="size-3.5" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            {/* ── Cell detail dialog ── */}
            <Dialog open={!!cellDetail} onOpenChange={(open) => !open && setCellDetail(null)}>
                <DialogContent className="sm:max-w-md max-h-[85vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle>Detail Beban MH</DialogTitle>
                        <DialogDescription asChild>
                            <div className="text-left space-y-0.5">
                                {cellDetail && (
                                    <>
                                        <p className="font-medium text-slate-700 dark:text-slate-300">{cellDetail.user?.name}</p>
                                        <p className="text-slate-500">{formatLoadDateLong(cellDetail.date)} · <strong className="text-slate-700 dark:text-slate-200">{formatLoadMh(cellDetail.mh)} MH</strong></p>
                                    </>
                                )}
                            </div>
                        </DialogDescription>
                    </DialogHeader>
                    {cellDetail && (
                        <div className="flex-1 min-h-0 overflow-y-auto -mx-1 px-1 space-y-2">
                            {cellDetail.items.length === 0 ? (
                                <p className="text-sm text-slate-500 py-4 text-center">Tidak ada detail task.</p>
                            ) : (
                                cellDetail.items.map((item) => (
                                    <div key={`${item.task_id}-${item.project_id}`}
                                        className="rounded-lg border border-slate-200 dark:border-slate-700 p-3 space-y-2">
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0">
                                                <p className="font-medium text-slate-900 dark:text-white text-sm leading-snug">{item.title}</p>
                                                {item.feature_title && (
                                                    <p className="text-xs text-primary font-semibold mt-0.5 truncate">{item.feature_title}</p>
                                                )}
                                            </div>
                                            <Badge variant="secondary" className="shrink-0 text-xs tabular-nums">
                                                {formatLoadMh(item.mh_per_day)} MH
                                            </Badge>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                                            <span>{item.project_name}</span>
                                            {item.is_subtask && (
                                                <Badge variant="outline" className="text-[10px] py-0">Subtask</Badge>
                                            )}
                                        </div>
                                        <Button variant="outline" size="sm" className="w-full h-8 text-xs"
                                            onClick={() => { setCellDetail(null); navigate(`/board/${item.project_id}?task=${item.task_id}`); }}>
                                            <ExternalLink className="size-3.5 mr-1.5" />
                                            Buka di Project Board
                                        </Button>
                                    </div>
                                ))
                            )}
                        </div>
                    )}
                </DialogContent>
            </Dialog>
            </div>
        </div>
    );
}
