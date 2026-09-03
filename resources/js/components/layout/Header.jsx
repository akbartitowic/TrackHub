import { Menu, Search, Bell, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "../../context/AuthContext";
import { useNotifications } from "../../hooks/useNotifications";
import { describeNotification, formatNotificationTime } from "../../utils/notificationDisplay";

export default function Header({ title = "Executive Overview", onMenuClick }) {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { notifications, unreadCount, loading, page, totalPages, loadNotifications, markAsRead, markAllAsRead } =
        useNotifications(!!user);

    const handleNotificationClick = (notification) => {
        if (!notification.read_at) {
            markAsRead(notification.id);
        }
        const { project_id, task_id } = notification.data || {};
        if (project_id && task_id) {
            navigate(`/board/${project_id}/task/${task_id}`);
        } else if (project_id) {
            navigate(`/board/${project_id}/dashboard`);
        }
    };

    return (
        <header className="sticky top-0 z-30 bg-background-light/80 dark:bg-[#0B192C]/85 backdrop-blur-md px-4 py-3 sm:px-6 lg:px-8 sm:py-4 flex items-center justify-between gap-2 border-b border-slate-200 dark:border-white/10 transition-colors duration-200">
            <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-4">
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="shrink-0 lg:hidden -ml-1"
                    onClick={onMenuClick}
                    aria-label="Open navigation menu"
                >
                    <Menu className="size-5" />
                </Button>
                <h2 className="truncate text-lg font-bold text-slate-900 dark:text-white sm:text-xl">{title}</h2>
            </div>
            <div className="flex shrink-0 items-center gap-2 sm:gap-4">
                <div className="relative hidden md:block">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 size-4" />
                    <Input type="text" placeholder="Search projects or logs..."
                        className="w-48 lg:w-64 pl-10 pr-4 py-2 bg-white dark:bg-[#151b28] border-slate-200 dark:border-white/10 rounded-lg text-sm focus-visible:ring-accent focus-visible:border-accent text-slate-900 dark:text-white transition-colors duration-200" />
                </div>

                <DropdownMenu onOpenChange={(open) => open && loadNotifications(1)}>
                    <DropdownMenuTrigger asChild>
                        <Button
                            variant="outline"
                            size="icon"
                            className="relative size-10 rounded-lg border-slate-200 dark:border-white/10 dark:bg-[#151b28] text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/10 transition-colors duration-200"
                            aria-label="Notifications"
                        >
                            <Bell className="size-5" />
                            {unreadCount > 0 && (
                                <Badge
                                    variant="destructive"
                                    className="absolute -top-1 -right-1 size-4 min-w-4 px-1 py-0 justify-center text-[9px] leading-none rounded-full"
                                >
                                    {unreadCount > 9 ? "9+" : unreadCount}
                                </Badge>
                            )}
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-[360px] p-0 dark:border-white/10 dark:bg-[#151b28]">
                        <div className="flex items-center justify-between px-3 py-2">
                            <DropdownMenuLabel className="p-0 text-sm">Notifications</DropdownMenuLabel>
                            {unreadCount > 0 && (
                                <button
                                    type="button"
                                    className="text-xs text-accent hover:underline"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        markAllAsRead();
                                    }}
                                >
                                    Mark all as read
                                </button>
                            )}
                        </div>
                        <DropdownMenuSeparator className="m-0" />
                        <div className="max-h-96 overflow-y-auto">
                            {loading ? (
                                <div className="flex items-center justify-center py-8 text-slate-500">
                                    <Loader2 className="size-5 animate-spin mr-2" />
                                    Loading…
                                </div>
                            ) : notifications.length === 0 ? (
                                <p className="text-xs text-slate-500 italic px-3 py-6 text-center">
                                    No notifications.
                                </p>
                            ) : (
                                <ul className="divide-y divide-slate-200/80 dark:divide-white/10">
                                    {notifications.map((n) => {
                                        const data = n.data || {};
                                        const isUnread = !n.read_at;
                                        const { Icon, iconClass, title, subtitle } = describeNotification(data);
                                        return (
                                            <li
                                                key={n.id}
                                                className={`px-3 py-2.5 flex items-start gap-2.5 ${
                                                    isUnread ? "bg-accent/5 dark:bg-accent/10" : ""
                                                }`}
                                            >
                                                <div className={`size-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${iconClass}`}>
                                                    <Icon className="size-4" />
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-start gap-1.5">
                                                        <p className="text-xs text-slate-700 dark:text-slate-300 flex-1">
                                                            {title}
                                                        </p>
                                                        {isUnread && <span className="size-2 rounded-full bg-accent shrink-0 mt-1" />}
                                                    </div>
                                                    {subtitle && (
                                                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                                                            {subtitle}
                                                        </p>
                                                    )}
                                                    <div className="flex items-center justify-between mt-1.5">
                                                        <span className="text-[10px] text-slate-400">
                                                            {formatNotificationTime(n.created_at)}
                                                        </span>
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleNotificationClick(n);
                                                            }}
                                                            className="flex items-center gap-1 rounded-md border border-accent/30 px-2 py-1 text-[11px] font-medium text-accent hover:bg-accent/10 transition-colors"
                                                        >
                                                            Details
                                                            <ChevronRight className="size-3" />
                                                        </button>
                                                    </div>
                                                </div>
                                            </li>
                                        );
                                    })}
                                </ul>
                            )}
                        </div>
                        {!loading && totalPages > 1 && (
                            <>
                                <DropdownMenuSeparator className="m-0" />
                                <div className="flex items-center justify-between px-3 py-2">
                                    <button
                                        type="button"
                                        disabled={page <= 1}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            loadNotifications(page - 1);
                                        }}
                                        className="p-1 rounded-md text-slate-400 hover:text-accent hover:bg-accent/10 transition-colors disabled:opacity-30 disabled:pointer-events-none"
                                        aria-label="Previous page"
                                    >
                                        <ChevronLeft className="size-4" />
                                    </button>
                                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                                        Page {page} / {totalPages}
                                    </span>
                                    <button
                                        type="button"
                                        disabled={page >= totalPages}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            loadNotifications(page + 1);
                                        }}
                                        className="p-1 rounded-md text-slate-400 hover:text-accent hover:bg-accent/10 transition-colors disabled:opacity-30 disabled:pointer-events-none"
                                        aria-label="Next page"
                                    >
                                        <ChevronRight className="size-4" />
                                    </button>
                                </div>
                            </>
                        )}
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </header>
    );
}
