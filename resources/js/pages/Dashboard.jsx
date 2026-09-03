import { useState, useEffect } from 'react';
import { fetchAPI } from '../services/api';
import { Rocket, Users, AlertCircle, Clock, LayoutGrid, ArrowRight, CheckCircle2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { isAdminUser } from '../utils/permissions';
import { cn } from '@/lib/utils';

const getMethodologyLabel = (value) => {
    const normalized = String(value || '').toLowerCase();
    return normalized.includes('waterfall') ? 'Waterfall' : 'Scrum';
};

const STATUS_COLORS = {
    'To Do': 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-300',
    'In Progress': 'border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-800/50 dark:bg-blue-950/30 dark:text-blue-300',
    Review: 'border-violet-200 bg-violet-50 text-violet-800 dark:border-violet-800/50 dark:bg-violet-950/30 dark:text-violet-300',
    Reopen: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800/50 dark:bg-amber-950/30 dark:text-amber-300',
    Done: 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800/50 dark:bg-emerald-950/30 dark:text-emerald-300',
};

function KpiCard({ label, value, hint, icon: Icon, iconClass }) {
    return (
        <Card className="border-white/60 bg-white/70 shadow-sm backdrop-blur-xl transition-colors dark:border-white/10 dark:bg-[#151b28] dark:shadow-xl">
            <CardContent className="flex items-start gap-3 p-4 sm:p-5">
                {Icon && (
                    <div className={cn('flex size-10 shrink-0 items-center justify-center rounded-2xl', iconClass)}>
                        <Icon className="size-5" />
                    </div>
                )}
                <div className="min-w-0">
                    <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
                    <p className="mt-0.5 text-2xl font-bold tabular-nums text-slate-900 dark:text-white">{value}</p>
                    {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
                </div>
            </CardContent>
        </Card>
    );
}

export default function Dashboard() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [stats, setStats] = useState({
        totalProjects: 0,
        activeProjects: 0,
        doneProjects: 0,
        scrumProjects: 0,
        waterfallProjects: 0,
        totalHours: 0,
        activeTasks: 0,
        taskStatusCounts: {},
    });
    const [efficiencyData, setEfficiencyData] = useState([]);
    const [dashboardMode, setDashboardMode] = useState('admin');
    const [memberStats, setMemberStats] = useState({
        totalProjectsHandled: 0,
        activeTasks: 0,
        taskStatusCounts: {
            'To Do': 0,
            'In Progress': 0,
            Review: 0,
            Reopen: 0,
            Done: 0,
        },
    });

    useEffect(() => {
        const loadStats = async () => {
            try {
                const res = await fetchAPI('/dashboard/overview');
                if (res.mode === 'member') {
                    setDashboardMode('member');
                    if (res.userStats) setMemberStats(res.userStats);
                    return;
                }
                setDashboardMode('admin');
                if (res.stats) setStats(res.stats);
                if (res.efficiency) setEfficiencyData(res.efficiency.slice(0, 5));
            } catch (err) {
                console.error('Failed to load dashboard data', err);
            }
        };
        loadStats();
    }, []);

    const shouldShowMemberDashboard = dashboardMode === 'member' && !isAdminUser(user);
    const taskCounts = shouldShowMemberDashboard
        ? memberStats.taskStatusCounts
        : stats.taskStatusCounts || {};

    const criticalProjects = efficiencyData.filter((p) => p.burn_percentage > 85);

    return (
        <div className="relative min-h-full overflow-hidden bg-slate-50 dark:bg-[#0B192C]">
            <div className="relative w-full space-y-6 px-4 py-5 sm:px-6 lg:px-8 pb-16">
                <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                            {shouldShowMemberDashboard ? 'My Work Summary' : 'Dashboard'}
                        </h1>
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                            {shouldShowMemberDashboard
                                ? "Projects and tasks you're handling."
                                : 'A quick snapshot of projects, tasks, and manhour quota health.'}
                        </p>
                    </div>
                    {!shouldShowMemberDashboard && (
                        <div className="flex flex-wrap gap-2">
                            <Button variant="outline" size="sm" className="!rounded-xl gap-1.5 backdrop-blur-sm" onClick={() => navigate('/board')}>
                                <LayoutGrid className="size-4" />
                                Project Board
                            </Button>
                            <Button size="sm" className="!rounded-xl gap-1.5 bg-[#00529C] font-bold text-white shadow-lg shadow-blue-900/20 hover:bg-[#00417C]" onClick={() => navigate('/reports')}>
                                Reports
                                <ArrowRight className="size-3.5" />
                            </Button>
                        </div>
                    )}
                </header>

                <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {shouldShowMemberDashboard ? (
                        <>
                            <KpiCard
                                label="Involved Projects"
                                value={memberStats.involvedProjects}
                                hint="Projects you are a member of"
                                icon={Rocket}
                                iconClass="bg-primary/10 text-primary"
                            />
                            <KpiCard
                                label="Active Tasks"
                                value={memberStats.activeTasks}
                                icon={Users}
                                iconClass="bg-sky-500/10 text-sky-600"
                            />
                            <KpiCard
                                label="Completed Tasks"
                                value={taskCounts?.Done || 0}
                                icon={CheckCircle2}
                                iconClass="bg-emerald-500/10 text-emerald-600"
                            />
                        </>
                    ) : (
                        <>
                            <KpiCard
                                label="Active Projects"
                                value={stats.activeProjects}
                                hint={`Total ${stats.totalProjects} · Done ${stats.doneProjects}`}
                                icon={Rocket}
                                iconClass="bg-primary/10 text-primary"
                            />
                            <KpiCard
                                label="Active Tasks"
                                value={stats.activeTasks}
                                icon={Users}
                                iconClass="bg-violet-500/10 text-violet-600"
                            />
                            <KpiCard
                                label="Scrum"
                                value={stats.scrumProjects}
                                hint="Agile methodology"
                                icon={LayoutGrid}
                                iconClass="bg-blue-500/10 text-blue-600"
                            />
                            <KpiCard
                                label="Waterfall"
                                value={stats.waterfallProjects}
                                hint="Fixed-scope methodology"
                                icon={LayoutGrid}
                                iconClass="bg-slate-500/10 text-slate-600"
                            />
                        </>
                    )}
                </section>

                <section>
                    <h2 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-300">Tasks by Status</h2>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
                        {['To Do', 'In Progress', 'Review', 'Reopen', 'Done'].map((status) => (
                            <div
                                key={status}
                                className={cn(
                                    'rounded-2xl border px-3 py-3 text-center backdrop-blur-sm transition-colors',
                                    STATUS_COLORS[status] || STATUS_COLORS['To Do'],
                                )}
                            >
                                <p className="text-[11px] font-semibold uppercase tracking-wide opacity-80">{status}</p>
                                <p className="mt-1 text-xl font-bold tabular-nums">{taskCounts?.[status] || 0}</p>
                            </div>
                        ))}
                    </div>
                </section>

                {!shouldShowMemberDashboard && (
                    <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                        <Card className="border-white/60 bg-white/70 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-[#151b28] dark:shadow-xl lg:col-span-2">
                            <CardContent className="p-4 sm:p-5">
                                <div className="mb-4 flex items-center justify-between gap-2">
                                    <div>
                                        <h2 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                                            <AlertCircle className="size-4 text-rose-500" />
                                            Projects Needing Attention
                                        </h2>
                                        <p className="text-xs text-slate-500 mt-0.5">Manhour quota &gt; 85% used</p>
                                    </div>
                                </div>
                                {criticalProjects.length === 0 ? (
                                    <p className="rounded-2xl border border-dashed border-slate-200 py-8 text-center text-sm text-slate-500 dark:border-slate-700">
                                        All projects are within a safe range.
                                    </p>
                                ) : (
                                    <ul className="space-y-2">
                                        {criticalProjects.map((proj) => (
                                            <li
                                                key={proj.id || proj.name}
                                                className="flex items-center justify-between gap-3 rounded-2xl border border-rose-100 bg-rose-50/50 px-3 py-2.5 backdrop-blur-sm dark:border-rose-900/30 dark:bg-rose-950/20"
                                            >
                                                <div className="min-w-0">
                                                    <p className="truncate text-sm font-medium text-slate-900 dark:text-white">
                                                        {proj.name}
                                                    </p>
                                                    <p className="flex items-center gap-1 text-xs text-slate-500">
                                                        <Clock className="size-3" />
                                                        {Math.max(0, (proj.estimated_hours || 0) - (proj.allocated_hours || 0)).toFixed(1)}h left
                                                        · {getMethodologyLabel(proj.methodology)}
                                                    </p>
                                                </div>
                                                <span
                                                    className={cn(
                                                        'shrink-0 rounded-full px-2 py-0.5 text-xs font-bold tabular-nums',
                                                        proj.burn_percentage > 100
                                                            ? 'bg-rose-600 text-white'
                                                            : 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
                                                    )}
                                                >
                                                    {Math.round(proj.burn_percentage)}%
                                                </span>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </CardContent>
                        </Card>
                        <Card className="border-white/60 bg-white/70 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-[#151b28] dark:shadow-xl">
                            <CardContent className="flex h-full flex-col p-4 sm:p-5">
                                <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Quick Actions</h2>
                                <p className="mt-1 text-xs text-slate-500">Navigate to frequently used areas.</p>
                                <div className="mt-4 flex flex-1 flex-col gap-2">
                                    <Button variant="outline" className="!rounded-xl justify-start h-10 backdrop-blur-sm" onClick={() => navigate('/board')}>
                                        Open Project Board
                                    </Button>
                                    <Button variant="outline" className="!rounded-xl justify-start h-10 backdrop-blur-sm" onClick={() => navigate('/reports')}>
                                        Reports &amp; portfolio
                                    </Button>
                                    <Button variant="outline" className="!rounded-xl justify-start h-10 backdrop-blur-sm" onClick={() => navigate('/team-load')}>
                                        Team Load
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    </section>
                )}
            </div>
        </div>
    );
}
