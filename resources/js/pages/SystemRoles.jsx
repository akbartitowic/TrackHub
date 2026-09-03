import { useState, useEffect, useMemo, useCallback } from 'react';
import { fetchAPI } from '../services/api';
import {
    Shield,
    Lock,
    Save,
    Plus,
    Trash2,
    Search,
    Loader2,
    Check,
    LayoutGrid,
    Eye,
    EyeOff,
    Plug,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';

const ACTIONS = ['create', 'read', 'update', 'delete', 'edit_last_update', 'view_all'];

const ACTION_LABELS = {
    create: 'Create',
    read: 'Menu',
    update: 'Update',
    delete: 'Delete',
    edit_last_update: 'Update Date Task Manual',
    view_all: 'View All Projects',
};

const ACTION_HINTS = {
    read: 'Tampilkan menu di sidebar',
    create: 'Tambah data baru',
    update: 'Ubah data',
    delete: 'Hapus data',
    edit_last_update: 'Override tanggal "Diperbarui" pada task secara manual',
    view_all: 'Lihat data seluruh project, bukan hanya yang di-assign (halaman Review)',
};

const ACTION_BADGE_LABELS = {
    edit_last_update: 'manual',
    view_all: 'all',
};

const MODULE_ACTION_NOTES = {};

function formatModuleName(raw) {
    return raw
        .split(/[_\s]+/)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
}

function permissionIdsFromRole(role) {
    return new Set((role?.permissions || []).map((p) => p.id));
}

function setsEqual(a, b) {
    if (a.size !== b.size) return false;
    for (const id of a) if (!b.has(id)) return false;
    return true;
}

export default function SystemRoles() {
    const [roles, setRoles] = useState([]);
    const [permissions, setPermissions] = useState({});
    const [selectedRoleId, setSelectedRoleId] = useState(null);
    const [draftPermissionIds, setDraftPermissionIds] = useState(new Set());
    const [baselinePermissionIds, setBaselinePermissionIds] = useState(new Set());
    const [roleSearch, setRoleSearch] = useState('');
    const [moduleSearch, setModuleSearch] = useState('');
    const [showSlugs, setShowSlugs] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const [newRoleName, setNewRoleName] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    const selectedRole = useMemo(
        () => roles.find((r) => r.id === selectedRoleId) ?? null,
        [roles, selectedRoleId],
    );

    const loadData = useCallback(async (keepRoleId = selectedRoleId) => {
        setIsLoading(true);
        try {
            const [rolesRes, permRes] = await Promise.all([
                fetchAPI('/roles'),
                fetchAPI('/permissions'),
            ]);
            const fetchedRoles = rolesRes.data || [];
            const fetchedPermissions = permRes.data || {};
            setRoles(fetchedRoles);
            setPermissions(fetchedPermissions);

            const nextId = keepRoleId && fetchedRoles.some((r) => r.id === keepRoleId)
                ? keepRoleId
                : fetchedRoles[0]?.id ?? null;
            setSelectedRoleId(nextId);
            if (nextId) {
                const role = fetchedRoles.find((r) => r.id === nextId);
                const ids = permissionIdsFromRole(role);
                setDraftPermissionIds(new Set(ids));
                setBaselinePermissionIds(new Set(ids));
            } else {
                setDraftPermissionIds(new Set());
                setBaselinePermissionIds(new Set());
            }
        } catch (err) {
            console.error('Failed to load roles/permissions', err);
        } finally {
            setIsLoading(false);
        }
    }, [selectedRoleId]);

    useEffect(() => { loadData(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

    const selectRole = (role) => {
        if (isDirty && !window.confirm('Ada perubahan yang belum disimpan. Buang perubahan?')) return;
        setSelectedRoleId(role.id);
        const ids = permissionIdsFromRole(role);
        setDraftPermissionIds(new Set(ids));
        setBaselinePermissionIds(new Set(ids));
    };

    const modulePermissionGroups = useMemo(() => {
        return Object.entries(permissions).map(([moduleName, modulePerms]) => {
            const byAction = {};
            modulePerms.forEach((perm) => {
                const slugParts = String(perm.slug || '').split('.');
                const actionFromSlug = slugParts[slugParts.length - 1];
                const action = ACTIONS.includes(actionFromSlug)
                    ? actionFromSlug
                    : ACTIONS.find((a) => String(perm.name || '').toLowerCase().startsWith(a));
                if (action) byAction[action] = perm;
            });
            const isModuleActive = modulePerms[0]?.module?.is_active ?? true;
            return { moduleName, byAction, isModuleActive };
        });
    }, [permissions]);

    const filteredRoles = useMemo(() => {
        const q = roleSearch.trim().toLowerCase();
        return q ? roles.filter((r) => r.name.toLowerCase().includes(q)) : roles;
    }, [roles, roleSearch]);

    const filteredModules = useMemo(() => {
        const q = moduleSearch.trim().toLowerCase();
        return q ? modulePermissionGroups.filter((g) => g.moduleName.toLowerCase().includes(q)) : modulePermissionGroups;
    }, [modulePermissionGroups, moduleSearch]);

    const totalPermissionCount = useMemo(() => {
        let n = 0;
        modulePermissionGroups.forEach((g) => ACTIONS.forEach((a) => { if (g.byAction[a]) n += 1; }));
        return n;
    }, [modulePermissionGroups]);

    const isDirty = useMemo(
        () => !setsEqual(draftPermissionIds, baselinePermissionIds),
        [draftPermissionIds, baselinePermissionIds],
    );

    const handleTogglePermission = (id) => {
        setDraftPermissionIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    const handleToggleModuleAll = (moduleGroup) => {
        const modulePermissionIds = ACTIONS.map((a) => moduleGroup.byAction[a]?.id).filter(Boolean);
        if (!modulePermissionIds.length) return;
        setDraftPermissionIds((prev) => {
            const next = new Set(prev);
            const allActive = modulePermissionIds.every((id) => next.has(id));
            if (allActive) modulePermissionIds.forEach((id) => next.delete(id));
            else modulePermissionIds.forEach((id) => next.add(id));
            return next;
        });
    };

    const handleSavePermissions = async () => {
        if (!selectedRole) return;
        setIsSaving(true);
        try {
            await fetchAPI(`/roles/${selectedRole.id}`, {
                method: 'PUT',
                body: JSON.stringify({ name: selectedRole.name, permissions: Array.from(draftPermissionIds) }),
            });
            await loadData(selectedRole.id);
        } catch (err) {
            alert(`Gagal menyimpan: ${err.message}`);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDiscard = () => setDraftPermissionIds(new Set(baselinePermissionIds));

    const handleCreateRole = async () => {
        if (!newRoleName.trim()) return;
        try {
            const res = await fetchAPI('/roles', {
                method: 'POST',
                body: JSON.stringify({ name: newRoleName.trim() }),
            });
            setNewRoleName('');
            setIsCreating(false);
            await loadData(res?.id ?? selectedRoleId);
        } catch (err) {
            alert(`Gagal membuat role: ${err.message}`);
        }
    };

    const handleDeleteRole = async (id, name) => {
        if (!window.confirm(`Hapus role "${name}"? User dengan role ini bisa terpengaruh.`)) return;
        try {
            await fetchAPI(`/roles/${id}`, { method: 'DELETE' });
            await loadData(selectedRoleId === id ? null : selectedRoleId);
        } catch (err) {
            alert(`Gagal menghapus: ${err.message}`);
        }
    };

    const moduleStats = (moduleGroup) => {
        const ids = ACTIONS.map((a) => moduleGroup.byAction[a]?.id).filter(Boolean);
        const active = ids.filter((id) => draftPermissionIds.has(id)).length;
        return { active, total: ids.length };
    };

    const hasIntegrationNote = (moduleName, action) =>
        Boolean(MODULE_ACTION_NOTES[moduleName]?.[action]);

    return (
        <div className="flex h-[calc(100dvh-4.25rem)] min-h-0 flex-col overflow-hidden">
            {/* ── Page header ── */}
            <div className="shrink-0 border-b border-slate-200 bg-white px-4 py-4 sm:px-6 dark:border-slate-800 dark:bg-[#151b28]">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                            <Lock className="size-5" />
                        </div>
                        <div className="min-w-0">
                            <h1 className="text-lg font-bold tracking-tight text-slate-900 sm:text-xl dark:text-white">
                                Roles &amp; Akses
                            </h1>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                Kelola role dan izin per menu — termasuk akses integrasi API
                            </p>
                        </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="secondary" className="tabular-nums">{roles.length} role</Badge>
                        <Badge variant="outline" className="tabular-nums">{modulePermissionGroups.length} menu</Badge>
                        <Button
                            className="gap-1.5 shadow-sm"
                            size="sm"
                            onClick={() => setIsCreating(true)}
                        >
                            <Plus className="size-4" />
                            Role baru
                        </Button>
                    </div>
                </div>
            </div>

            {/* ── Mobile: horizontal role tabs ── */}
            <div className="sm:hidden shrink-0 border-b border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-[#151b28]">
                {isLoading ? (
                    <div className="flex items-center gap-2 py-1 text-sm text-slate-400">
                        <Loader2 className="size-3.5 animate-spin" /> Memuat…
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <div className="flex gap-1.5 pb-0.5">
                            {filteredRoles.map((role) => (
                                <button
                                    key={role.id}
                                    type="button"
                                    onClick={() => selectRole(role)}
                                    className={cn(
                                        'shrink-0 rounded-full px-3 py-1 text-sm font-medium whitespace-nowrap transition-colors',
                                        selectedRoleId === role.id
                                            ? 'bg-primary text-white'
                                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300',
                                    )}
                                >
                                    {role.name}
                                </button>
                            ))}
                            <button
                                type="button"
                                onClick={() => setIsCreating(true)}
                                className="shrink-0 rounded-full border border-dashed border-slate-300 px-3 py-1 text-sm text-slate-400 hover:border-primary hover:text-primary dark:border-slate-700"
                            >
                                + Baru
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* ── Main content ── */}
            <div className="flex min-h-0 w-full flex-1 flex-col overflow-hidden px-4 py-4 sm:flex-row sm:gap-4 sm:px-6 sm:py-5 lg:px-8">

                {/* Desktop roles sidebar */}
                <aside className="hidden sm:flex w-64 lg:w-72 shrink-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-[#151b28]">
                    <div className="border-b border-slate-100 px-3 py-3 dark:border-slate-800">
                        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                            System roles
                        </p>
                        <div className="relative">
                            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
                            <Input
                                value={roleSearch}
                                onChange={(e) => setRoleSearch(e.target.value)}
                                placeholder="Cari role…"
                                className="h-8 pl-8 text-sm"
                            />
                        </div>
                    </div>

                    <div className="board-column-scroll min-h-0 flex-1 overflow-y-auto p-2">
                        {isLoading ? (
                            <div className="flex items-center justify-center py-10 text-slate-400">
                                <Loader2 className="size-5 animate-spin" />
                            </div>
                        ) : filteredRoles.length === 0 ? (
                            <p className="px-2 py-6 text-center text-sm text-slate-500">Role tidak ditemukan</p>
                        ) : (
                            <ul className="space-y-1">
                                {filteredRoles.map((role) => {
                                    const isSelected = selectedRoleId === role.id;
                                    const count = role.permissions?.length ?? 0;
                                    return (
                                        <li key={role.id}>
                                            <div className={cn(
                                                'group flex w-full items-center gap-1 rounded-lg transition-colors',
                                                isSelected ? 'bg-primary text-white shadow-sm' : 'hover:bg-slate-50 dark:hover:bg-slate-800/60',
                                            )}>
                                                <button
                                                    type="button"
                                                    onClick={() => selectRole(role)}
                                                    className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-left"
                                                >
                                                    <div className={cn(
                                                        'flex size-8 shrink-0 items-center justify-center rounded-lg',
                                                        isSelected ? 'bg-white/20' : 'bg-slate-100 text-slate-500 dark:bg-slate-800',
                                                    )}>
                                                        <Shield className="size-4" />
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <p className={cn('truncate text-sm font-semibold', isSelected ? 'text-white' : 'text-slate-900 dark:text-white')}>
                                                            {role.name}
                                                        </p>
                                                        <p className={cn('text-[11px] tabular-nums', isSelected ? 'text-white/80' : 'text-slate-500')}>
                                                            {count} izin aktif
                                                        </p>
                                                    </div>
                                                </button>
                                                <button
                                                    type="button"
                                                    className={cn(
                                                        'mr-1.5 shrink-0 rounded p-1.5 opacity-0 transition-opacity group-hover:opacity-100',
                                                        isSelected
                                                            ? 'text-white/70 hover:bg-white/20 hover:text-white'
                                                            : 'text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-900/30',
                                                    )}
                                                    onClick={() => handleDeleteRole(role.id, role.name)}
                                                    aria-label={`Hapus ${role.name}`}
                                                >
                                                    <Trash2 className="size-3.5" />
                                                </button>
                                            </div>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </div>

                    {isCreating && (
                        <div className="shrink-0 border-t border-slate-100 p-3 dark:border-slate-800">
                            <Input
                                placeholder="Nama role baru"
                                value={newRoleName}
                                onChange={(e) => setNewRoleName(e.target.value)}
                                className="mb-2 h-8 text-sm"
                                autoFocus
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleCreateRole();
                                    if (e.key === 'Escape') setIsCreating(false);
                                }}
                            />
                            <div className="flex gap-2">
                                <Button size="sm" className="h-8 flex-1" onClick={handleCreateRole}>Simpan</Button>
                                <Button size="sm" variant="outline" className="h-8 flex-1" onClick={() => { setIsCreating(false); setNewRoleName(''); }}>Batal</Button>
                            </div>
                        </div>
                    )}
                </aside>

                {/* ── Permissions panel ── */}
                <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-[#151b28]">
                    {!selectedRole ? (
                        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-10 text-center text-slate-400">
                            <LayoutGrid className="size-12 opacity-20" />
                            <p className="text-sm font-medium">Pilih role untuk mengatur izin aksesnya</p>
                        </div>
                    ) : (
                        <>
                            {/* Panel header */}
                            <div className="shrink-0 border-b border-slate-100 px-4 py-3 dark:border-slate-800 sm:px-5">
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                    <div className="min-w-0">
                                        <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">
                                            Mengatur akses
                                        </p>
                                        <h2 className="truncate text-lg font-bold text-slate-900 dark:text-white">
                                            {selectedRole.name}
                                        </h2>
                                        <p className="mt-0.5 text-sm text-slate-500 tabular-nums">
                                            {draftPermissionIds.size} / {totalPermissionCount} izin dipilih
                                            {isDirty && (
                                                <span className="ml-2 font-medium text-amber-600 dark:text-amber-400">
                                                    · belum disimpan
                                                </span>
                                            )}
                                        </p>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            className="h-8 gap-1.5"
                                            onClick={() => setShowSlugs((v) => !v)}
                                        >
                                            {showSlugs ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                                            Slug
                                        </Button>
                                        {isDirty && (
                                            <Button type="button" variant="ghost" size="sm" className="h-8" onClick={handleDiscard} disabled={isSaving}>
                                                Batalkan
                                            </Button>
                                        )}
                                        <Button
                                            size="sm"
                                            className="h-8 gap-1.5 bg-emerald-600 hover:bg-emerald-700"
                                            onClick={handleSavePermissions}
                                            disabled={isSaving || !isDirty}
                                        >
                                            {isSaving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
                                            Simpan
                                        </Button>
                                    </div>
                                </div>

                                <div className="relative mt-3 max-w-sm">
                                    <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
                                    <Input
                                        value={moduleSearch}
                                        onChange={(e) => setModuleSearch(e.target.value)}
                                        placeholder="Cari menu / modul…"
                                        className="h-8 pl-8 text-sm"
                                    />
                                </div>
                            </div>

                            {/* Permission cards */}
                            <div className="board-column-scroll min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
                                {filteredModules.length === 0 ? (
                                    <p className="py-8 text-center text-sm text-slate-500">Menu tidak ditemukan</p>
                                ) : (
                                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                                        {filteredModules.map((moduleGroup) => {
                                            const { active, total } = moduleStats(moduleGroup);
                                            const moduleIds = ACTIONS.map((a) => moduleGroup.byAction[a]?.id).filter(Boolean);
                                            const allSelected = moduleIds.length > 0 && moduleIds.every((id) => draftPermissionIds.has(id));
                                            const hasIntegration = Object.keys(MODULE_ACTION_NOTES[moduleGroup.moduleName] || {}).length > 0;

                                            return (
                                                <Card
                                                    key={moduleGroup.moduleName}
                                                    className={cn(
                                                        'overflow-hidden border-slate-200/90 shadow-none dark:border-slate-700/80',
                                                        !moduleGroup.isModuleActive && 'opacity-60',
                                                    )}
                                                >
                                                    <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/80 px-4 py-2.5 dark:border-slate-800 dark:bg-slate-900/40">
                                                        <div className="min-w-0 flex-1">
                                                            <div className="flex items-center gap-1.5">
                                                                <h3 className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
                                                                    {formatModuleName(moduleGroup.moduleName)}
                                                                </h3>
                                                                {hasIntegration && (
                                                                    <Plug className="size-3 shrink-0 text-primary/70" title="Mengontrol akses integrasi API" />
                                                                )}
                                                                {!moduleGroup.isModuleActive && (
                                                                    <Badge variant="outline" className="h-4 shrink-0 border-amber-300 px-1 text-[10px] font-semibold text-amber-600 dark:border-amber-700 dark:text-amber-400">
                                                                        Nonaktif
                                                                    </Badge>
                                                                )}
                                                            </div>
                                                            <p className="text-[11px] text-slate-500 tabular-nums">
                                                                {active} dari {total} izin aktif
                                                            </p>
                                                        </div>
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            size="sm"
                                                            className="h-6 shrink-0 px-2 text-[11px]"
                                                            onClick={() => handleToggleModuleAll(moduleGroup)}
                                                        >
                                                            {allSelected ? 'Hapus semua' : 'Pilih semua'}
                                                        </Button>
                                                    </div>
                                                    <CardContent className="divide-y divide-slate-100 p-0 dark:divide-slate-800">
                                                        {ACTIONS.map((action) => {
                                                            const perm = moduleGroup.byAction[action];
                                                            if (!perm) return null;
                                                            const checked = draftPermissionIds.has(perm.id);
                                                            const isRead = action === 'read';
                                                            const integrationNote = MODULE_ACTION_NOTES[moduleGroup.moduleName]?.[action];

                                                            return (
                                                                <label
                                                                    key={perm.id}
                                                                    className={cn(
                                                                        'flex cursor-pointer items-start gap-3 px-4 py-2.5 transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/30',
                                                                        checked && isRead && 'bg-blue-50/50 dark:bg-blue-950/20',
                                                                        checked && !isRead && 'bg-emerald-50/40 dark:bg-emerald-950/15',
                                                                    )}
                                                                >
                                                                    <Checkbox
                                                                        checked={checked}
                                                                        onCheckedChange={() => handleTogglePermission(perm.id)}
                                                                        className="mt-0.5 shrink-0"
                                                                    />
                                                                    <div className="min-w-0 flex-1">
                                                                        <div className="flex flex-wrap items-center gap-1.5">
                                                                            <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                                                                                {isRead ? 'Sidebar menu' : ACTION_LABELS[action]}
                                                                            </span>
                                                                            <Badge
                                                                                variant="outline"
                                                                                className={cn(
                                                                                    'h-4 px-1 text-[10px] font-semibold uppercase',
                                                                                    isRead
                                                                                        ? 'border-blue-200 text-blue-700 dark:border-blue-800 dark:text-blue-300'
                                                                                        : 'border-slate-200 text-slate-500',
                                                                                )}
                                                                            >
                                                                                {ACTION_BADGE_LABELS[action] || action}
                                                                            </Badge>
                                                                        </div>
                                                                        <p className="mt-0.5 text-xs text-slate-500">
                                                                            {ACTION_HINTS[action]}
                                                                        </p>
                                                                        {integrationNote && (
                                                                            <p className="mt-0.5 flex items-center gap-1 text-xs text-primary/80">
                                                                                <Plug className="size-2.5 shrink-0" />
                                                                                {integrationNote}
                                                                            </p>
                                                                        )}
                                                                        {showSlugs && (
                                                                            <p className="mt-1 font-mono text-[10px] text-slate-400">{perm.slug}</p>
                                                                        )}
                                                                    </div>
                                                                    {checked && (
                                                                        <Check className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                                                                    )}
                                                                </label>
                                                            );
                                                        })}
                                                    </CardContent>
                                                </Card>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </section>
            </div>
        </div>
    );
}
