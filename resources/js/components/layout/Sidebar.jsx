import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useTheme } from '../../hooks/useTheme';
import { useAuth } from '../../context/AuthContext';
import { useAppBranding } from '../../context/AppBrandingContext';
import {
    LayoutDashboard, PlusCircle, KanbanSquare, Users, Shield, BarChart3, Settings, Moon, Sun,
    Activity, Wallet, Tag, Lock, LogOut, User, ClipboardList, FileText, PieChart, ClipboardCheck,
    Building2, Handshake, Layers, Plug, Cable, Gauge, Star, LayoutGrid, HelpCircle, Bell, Megaphone,
    ChevronLeft, ChevronRight,
} from "lucide-react";
import AppLogo from '../AppLogo';
import { hasPermission, getModuleSortOrder } from '../../utils/permissions';
import { cn } from '@/lib/utils';

/** Maps the `icon` string stored in `menu_items` to its Lucide component. */
const ICONS = {
    LayoutDashboard, PlusCircle, KanbanSquare, Users, Shield, BarChart3, Settings,
    Activity, Wallet, Tag, Lock, User, ClipboardList, FileText, PieChart, ClipboardCheck,
    Building2, Handshake, Layers, Plug, Cable, Gauge, Star, LayoutGrid, Bell, Megaphone,
};

/** Sidebar section header display order — not part of `menu_items` data since it's a fixed, stable taxonomy. */
const SECTION_ORDER = ['Operation', 'Report', 'User Management', 'System Settings'];

const COLLAPSE_STORAGE_KEY = 'sidebar-collapsed';

// `lg:hidden` (rather than a plain conditional render) so a collapsed desktop sidebar
// hides labels only at the lg breakpoint — the mobile drawer stays fully labeled
// regardless of whatever collapsed state desktop last left behind.
const collapsedLabelClass = (collapsed) => (collapsed ? 'lg:hidden' : '');

const navLinkClass = (isActive, variant = 'primary', collapsed = false) => cn(
    'flex items-center gap-3 rounded-xl transition-colors',
    variant === 'sub' ? 'px-6 py-2' : 'px-3 py-2.5',
    collapsed && 'lg:justify-center lg:px-2',
    isActive
        ? 'bg-[#00529C]/10 text-[#00529C] font-semibold dark:bg-[#3FA9F5]/20 dark:text-[#3FA9F5]'
        : variant === 'sub'
            ? 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5'
            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5',
);

function SidebarNavItem({ item, collapsed }) {
    const Icon = ICONS[item.icon] || HelpCircle;
    return (
        <NavLink
            to={item.path}
            title={item.label}
            className={({ isActive }) => navLinkClass(isActive, item.variant, collapsed)}
        >
            <Icon className={cn(item.variant === 'sub' ? 'size-4' : 'size-5', 'shrink-0')} />
            <span className={cn(item.variant === 'sub' ? 'text-xs' : 'text-sm', 'truncate', collapsedLabelClass(collapsed))}>
                {item.label}
            </span>
        </NavLink>
    );
}

/** Visible items for a section, sorted by their permission's module `sort_order` (editable from the Modules admin screen), then by the item's own `sort_order` as a tiebreaker (e.g. the two Integrasi items share one module). */
function visibleSortedItems(items, user) {
    return items
        .filter((item) => hasPermission(user, item.permission_slug))
        .slice()
        .sort((a, b) =>
            getModuleSortOrder(user, a.permission_slug) - getModuleSortOrder(user, b.permission_slug)
            || a.sort_order - b.sort_order
        );
}

export default function Sidebar({ mobileOpen = false }) {
    const { toggleTheme } = useTheme();
    const { user, logout } = useAuth();
    const { app_name, app_tagline } = useAppBranding();
    const navigate = useNavigate();
    const menuItems = user?.menu_items || [];
    const [collapsed, setCollapsed] = useState(() => {
        if (typeof window === 'undefined') return false;
        return window.localStorage.getItem(COLLAPSE_STORAGE_KEY) === 'true';
    });

    const toggleCollapsed = () => {
        setCollapsed((prev) => {
            const next = !prev;
            window.localStorage.setItem(COLLAPSE_STORAGE_KEY, String(next));
            return next;
        });
    };

    const dashboardItem = menuItems.find((item) => !item.section);
    const sections = SECTION_ORDER
        .map((label) => ({
            key: label,
            label,
            items: visibleSortedItems(menuItems.filter((item) => item.section === label), user),
        }))
        .filter((section) => section.items.length > 0);

    return (
        <aside
            className={cn(
                'fixed inset-y-0 left-0 z-50 flex h-screen w-64 max-w-[min(18rem,88vw)] flex-col overflow-visible',
                'border-r border-slate-200 bg-white transition-[transform,width] duration-200 ease-out',
                'dark:border-white/10 dark:bg-[#0B192C]',
                mobileOpen ? 'translate-x-0' : '-translate-x-full',
                'lg:relative lg:inset-auto lg:z-20 lg:max-w-none lg:shrink-0 lg:translate-x-0',
                collapsed ? 'lg:w-20' : 'lg:w-64',
            )}
        >
            <button
                type="button"
                onClick={toggleCollapsed}
                title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                className="absolute top-6 -right-3 z-10 hidden size-6 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm hover:bg-slate-50 hover:text-slate-700 lg:flex dark:border-white/10 dark:bg-[#151b28] dark:text-slate-300 dark:hover:bg-white/10"
            >
                {collapsed ? <ChevronRight className="size-3.5" /> : <ChevronLeft className="size-3.5" />}
            </button>

            <div className="flex h-full min-h-0 w-full flex-col overflow-y-auto overflow-x-hidden">
            <div className={cn('flex items-center gap-3 p-6', collapsed && 'lg:justify-center lg:px-3')}>
                <div className="size-11 shrink-0 rounded-xl flex items-center justify-center p-1 bg-white shadow-sm border border-slate-200/80 dark:border-white/10">
                    <AppLogo alt="MyActivity logo" className="size-full object-contain" />
                </div>
                <div className={cn('min-w-0', collapsedLabelClass(collapsed))}>
                    <h1 className="font-extrabold text-xl leading-tight tracking-tight text-primary dark:text-white truncate">
                        {app_name || 'MyActivity'}
                    </h1>
                    <p className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 tracking-wider truncate">
                        {app_tagline || 'Software Management'}
                    </p>
                </div>
            </div>

            <nav className="flex-1 px-4 space-y-1">
                {dashboardItem && hasPermission(user, dashboardItem.permission_slug) && (
                    <SidebarNavItem item={dashboardItem} collapsed={collapsed} />
                )}

                {sections.map((section) => (
                    <div key={section.key}>
                        <div className={cn('pt-4 pb-2 px-3', collapsed && 'lg:px-0 lg:text-center')}>
                            <p className={cn('text-[10px] font-bold text-slate-400 uppercase tracking-wider', collapsed && 'lg:hidden')}>
                                {section.label}
                            </p>
                            {collapsed && <div className="hidden lg:block lg:mx-2 lg:border-t lg:border-slate-200 dark:lg:border-white/10" />}
                        </div>
                        {section.items.map((item) => (
                            <SidebarNavItem key={item.path} item={item} collapsed={collapsed} />
                        ))}
                    </div>
                ))}
            </nav>

            <div className="p-4 mt-auto border-t border-slate-200 dark:border-white/10 transition-colors duration-200">
                <button
                    type="button"
                    onClick={() => navigate('/profile')}
                    title="My Profile"
                    className={cn(
                        'mt-4 flex w-full items-center gap-3 overflow-hidden text-ellipsis rounded-xl bg-slate-50 p-2 text-left transition-colors duration-200 hover:bg-slate-100 dark:bg-[#151b28] dark:hover:bg-white/5',
                        collapsed && 'lg:justify-center',
                    )}
                >
                    <div className="size-9 shrink-0 rounded-lg overflow-hidden bg-[#00529C]/10 flex items-center justify-center text-[#00529C] font-black text-sm dark:bg-[#3FA9F5]/20 dark:text-[#3FA9F5]">
                        {user?.avatar_url ? (
                            <img src={user.avatar_url} alt={user?.name || 'Avatar'} className="size-full object-cover" />
                        ) : (
                            (user?.nickname || user?.name)?.charAt(0)
                        )}
                    </div>
                    <div className={cn('overflow-hidden', collapsedLabelClass(collapsed))}>
                        <p className="text-xs font-bold text-slate-700 dark:text-white truncate">{user?.nickname || user?.name}</p>
                        <p className="text-[10px] text-slate-400 font-medium truncate uppercase tracking-tighter">{user?.role_name || user?.role?.name || 'Member'}</p>
                    </div>
                </button>

                <div className={cn(
                    'mt-2 flex items-center gap-2 px-1',
                    collapsed ? 'lg:flex-col lg:justify-center' : 'justify-between',
                )}>
                    <button
                        onClick={logout}
                        title="Logout"
                        className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-500/10"
                    >
                        <LogOut className="size-4 shrink-0" />
                        <span className={cn('text-xs font-medium', collapsedLabelClass(collapsed))}>Logout</span>
                    </button>
                    <button
                        onClick={toggleTheme}
                        title="Toggle dark mode"
                        className="p-1.5 rounded-lg bg-white dark:bg-[#1e2532] border border-slate-200 dark:border-white/10 shadow-sm shrink-0">
                        <Sun className="size-4 text-amber-500 dark:hidden" />
                        <Moon className="size-4 text-slate-300 hidden dark:block" />
                    </button>
                </div>
            </div>
            </div>
        </aside>
    );
}
