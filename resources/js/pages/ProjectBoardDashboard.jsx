import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
    ArrowLeft,
    Clock,
    LayoutGrid,
    Loader2,
    PiggyBank,
    Users,
    CheckCircle2,
    ListTodo,
    Layers,
} from 'lucide-react';
import { fetchAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { isFreelanceUser } from '../utils/permissions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import ManhourBucketBreakdown from '../components/ManhourBucketBreakdown';
import BillingOverviewDetail from '../components/board/BillingOverviewDetail';
import { subtasksTotalHours } from '../components/board/SubtaskSection';
import { TaskBillingBadges } from '../utils/taskBillable.jsx';
import {
    BOARD_STATUSES,
    buildBillingBreakdown,
    buildMemberTeamRows,
    computeBillingSummary,
    computeGeneralQuotaFromTasks,
    computeTaskStatusCounts,
    computeWaterfallProgress,
    deriveDisplayProjectStatus,
    formatBoardHours,
    normalizeBoardTaskStatus,
} from '../utils/projectBoardMetrics';

function getProjectInitials(name) {
    const words = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) return '?';
    if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
    return (words[0][0] + words[1][0]).toUpperCase();
}

function ProjectCompanyIcon({ logoUrl, projectName, size = 'lg' }) {
    const imgClass = size === 'lg' ? 'size-14 rounded-xl' : 'size-10 rounded-lg';
    const textClass = size === 'lg' ? 'text-lg' : 'text-sm';

    if (logoUrl) {
        return (
            <img
                src={logoUrl}
                alt={projectName ? `${projectName} company logo` : 'Company logo'}
                className={`${imgClass} object-cover border border-slate-200 dark:border-slate-700 bg-white shrink-0`}
            />
        );
    }

    return (
        <div className={`${imgClass} ${textClass} flex items-center justify-center bg-primary/10 font-black text-primary shrink-0`}>
            {getProjectInitials(projectName)}
        </div>
    );
}

function StatCard({ label, value, sub, icon: Icon, accent }) {
    return (
        <Card className="border-white/60 bg-white/70 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-[#151b28] dark:shadow-xl">
            <CardContent className="p-5">
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                            {label}
                        </p>
                        <p className={`text-2xl font-bold mt-2 tabular-nums ${accent || 'text-slate-900 dark:text-white'}`}>
                            {value}
                        </p>
                        {sub && (
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{sub}</p>
                        )}
                    </div>
                    {Icon && (
                        <div className="p-2.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 shrink-0">
                            <Icon className="size-5" />
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}

function QuotaProgressRow({ title, allocated, quota, taskCount, buckets, topupHours, baseQuotaHours }) {
    const qh = Number(quota) || 0;
    const alloc = Number(allocated) || 0;
    const pct = qh > 0 ? Math.min(100, Math.round((alloc / qh) * 100)) : 0;
    const isOver = alloc > qh && qh > 0;

    return (
        <div className="rounded-xl border border-white/60 bg-white/70 backdrop-blur-sm p-4 space-y-3 dark:border-white/10 dark:bg-white/5">
            <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                    <h4 className="font-semibold text-slate-900 dark:text-white">{title}</h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                        {taskCount != null ? `${taskCount} task` : ''}
                        {topupHours > 0 ? `${taskCount != null ? ' · ' : ''}Top-up +${formatBoardHours(topupHours)}h` : ''}
                    </p>
                </div>
                <div className="text-right">
                    <p className="text-lg font-bold tabular-nums text-slate-900 dark:text-white">
                        {formatBoardHours(alloc)}
                        <span className="text-sm font-normal text-slate-400"> / {formatBoardHours(qh)}h</span>
                    </p>
                    <p className={`text-xs font-bold ${pct > 90 ? 'text-rose-500' : pct > 70 ? 'text-amber-600' : 'text-primary'}`}>
                        {pct}% allocated
                        {isOver && <span className="text-rose-500 ml-1">(+{formatBoardHours(alloc - qh)}h over)</span>}
                    </p>
                </div>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                <div
                    className={`h-full rounded-full transition-all ${pct > 90 ? 'bg-rose-500' : pct > 70 ? 'bg-amber-500' : 'bg-primary'}`}
                    style={{ width: `${pct}%` }}
                />
            </div>
            {baseQuotaHours != null && Number(baseQuotaHours) !== Number(quota) && (
                <p className="text-[11px] text-slate-500">
                    Base quota {formatBoardHours(baseQuotaHours)}h + top-up = {formatBoardHours(quota)}h
                </p>
            )}
            {buckets?.length > 0 && (
                <ManhourBucketBreakdown buckets={buckets} compact />
            )}
        </div>
    );
}

export default function ProjectBoardDashboard() {
    const { projectId } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const isFreelance = isFreelanceUser(user);

    const [loading, setLoading] = useState(true);
    const [project, setProject] = useState(null);
    const [tasks, setTasks] = useState([]);
    const [members, setMembers] = useState([]);
    const [stats, setStats] = useState(null);
    const [roleQuotas, setRoleQuotas] = useState([]);
    const [quotasMeta, setQuotasMeta] = useState(null);

    useEffect(() => {
        if (!projectId) {
            navigate('/board');
            return;
        }

        const load = async () => {
            setLoading(true);
            try {
                const projectsRes = await fetchAPI('/projects');
                const found = (projectsRes.data || []).find(
                    (p) => p.id.toString() === projectId.toString(),
                );
                if (!found) {
                    navigate('/board');
                    return;
                }
                setProject(found);

                const [tasksRes, membersRes] = await Promise.all([
                    fetchAPI(`/tasks?project_id=${projectId}`),
                    fetchAPI(`/projects/${projectId}/members`),
                ]);
                setTasks(tasksRes.data || []);
                setMembers(membersRes.data || []);

                if (!isFreelance) {
                    try {
                        const balanceRes = await fetchAPI(`/projects/${projectId}/balance`);
                        if (balanceRes.data) {
                            const s = balanceRes.data;
                            let perc = 0;
                            if (s.total_manhours) {
                                perc = Math.round((s.allocated_hours / s.total_manhours) * 100);
                                if (perc > 100) perc = 100;
                            }
                            setStats({
                                ...s,
                                perc,
                                remaining: s.remaining ?? s.fifo_remaining_hours,
                            });
                        }
                    } catch (e) {
                        console.warn('Dashboard: balance unavailable', e);
                    }

                    try {
                        const quotasRes = await fetchAPI(`/projects/${projectId}/quotas`);
                        setRoleQuotas((quotasRes.data || []).filter((q) => q.is_active !== false));
                        setQuotasMeta(quotasRes.meta || null);
                    } catch (e) {
                        console.warn('Dashboard: quotas unavailable', e);
                    }
                }
            } catch (err) {
                console.error('Failed to load project dashboard', err);
            } finally {
                setLoading(false);
            }
        };

        load();
    }, [projectId, navigate, isFreelance]);

    const statusCounts = useMemo(() => computeTaskStatusCounts(tasks), [tasks]);
    const billing = useMemo(() => computeBillingSummary(tasks), [tasks]);
    const billingBreakdown = useMemo(() => buildBillingBreakdown(tasks), [tasks]);
    const displayStatus = useMemo(
        () => deriveDisplayProjectStatus(project, tasks),
        [project, tasks],
    );
    const waterfallCards = useMemo(() => computeWaterfallProgress(tasks), [tasks]);
    const visibleRoleQuotas = useMemo(
        () => roleQuotas.filter((q) => Number(q.quota_hours || 0) > 0),
        [roleQuotas],
    );
    const generalQuota = useMemo(
        () =>
            computeGeneralQuotaFromTasks(
                tasks,
                stats?.total_manhours ?? project?.total_manhours,
                roleQuotas,
            ),
        [tasks, stats, project, roleQuotas],
    );

    const uniqueMembers = useMemo(() => {
        const seen = new Set();
        return members.filter((m) => {
            if (!m?.user_id || seen.has(m.user_id)) return false;
            seen.add(m.user_id);
            return true;
        });
    }, [members]);

    const isScrum = project?.methodology === 'Agile Scrum';
    const memberTeamRows = useMemo(
        () => buildMemberTeamRows(uniqueMembers, tasks),
        [uniqueMembers, tasks],
    );

    const assigneeName = (task) => {
        if (!task.assignee_id) return 'Unassigned';
        const m = members.find((x) => x.user_id === task.assignee_id);
        return task.assignee_name || m?.user_name || `User #${task.assignee_id}`;
    };

    if (loading) {
        return (
            <div className="flex-1 flex items-center justify-center min-h-[320px]">
                <Loader2 className="size-8 animate-spin text-primary" />
            </div>
        );
    }

    if (!project) return null;

    const isWaterfall = project.methodology === 'Waterfall';
    const totalManhours = stats?.total_manhours ?? project.total_manhours;
    const allocatedHours = stats?.allocated_hours ?? project.allocated_hours;
    const usagePct = stats?.perc ?? project.usage_percentage;

    return (
        <div className="relative flex-1 w-full overflow-y-auto overflow-x-hidden bg-slate-50 dark:bg-[#0B192C]">
            <div className="relative w-full px-4 py-5 sm:px-6 sm:py-8 lg:px-8 space-y-8">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                    <div className="flex gap-4 min-w-0">
                        <ProjectCompanyIcon
                            logoUrl={project.company_logo_url}
                            projectName={project.name}
                        />
                        <div className="min-w-0">
                            <Button
                                variant="ghost"
                                className="-ml-3 mb-1 text-slate-500 h-8 px-2"
                                onClick={() => navigate(`/board/${projectId}`)}
                            >
                                <ArrowLeft className="size-4 mr-1.5" />
                                Back to Board
                            </Button>
                            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white truncate">
                                {project.name}
                            </h1>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                                Project dashboard · {project.methodology || 'Project'}
                            </p>
                            <div className="flex flex-wrap items-center gap-2 mt-2">
                                <Badge
                                    variant="outline"
                                    className={
                                        displayStatus === 'Done'
                                            ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                                            : displayStatus === 'In Progress'
                                              ? 'bg-blue-50 text-blue-600 border-blue-200'
                                              : 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-900/40 dark:border-slate-800 dark:text-slate-300'
                                    }
                                >
                                    {displayStatus}
                                </Badge>
                                {project.budget_status && (
                                    <Badge variant="outline" className="text-slate-600">
                                        Budget: {project.budget_status}
                                    </Badge>
                                )}
                            </div>
                        </div>
                    </div>
                    <Button
                        className="shrink-0 shadow-lg shadow-primary/20"
                        onClick={() => navigate(`/board/${projectId}`)}
                    >
                        <LayoutGrid className="size-4 mr-2" />
                        Open Kanban Board
                    </Button>
                </div>

                <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <StatCard
                        label="Total tasks"
                        value={billing.totalRootTasks}
                        sub={`${billing.totalSubtasks} subtask${billing.totalSubtasks === 1 ? '' : 's'}`}
                        icon={ListTodo}
                    />
                    <StatCard
                        label="Done"
                        value={statusCounts.Done || 0}
                        sub={`${statusCounts['In Progress'] || 0} in progress`}
                        icon={CheckCircle2}
                        accent="text-emerald-600 dark:text-emerald-400"
                    />
                    <StatCard
                        label="Team members"
                        value={uniqueMembers.length}
                        sub="Assigned on project"
                        icon={Users}
                    />
                    {!isFreelance && !isWaterfall && Number(totalManhours) > 0 ? (
                        <StatCard
                            label="MH allocated"
                            value={`${formatBoardHours(allocatedHours)}h`}
                            sub={`${usagePct ?? 0}% of ${formatBoardHours(totalManhours)}h total`}
                            icon={Clock}
                            accent="text-primary"
                        />
                    ) : (
                        <StatCard
                            label="Billable hours"
                            value={`${formatBoardHours(billing.billableHours)}h`}
                            sub={
                                billing.mixedParentCount > 0
                                    ? `${billing.mixedParentCount} task with mixed billing`
                                    : `${billing.billableSubtasks} billable subtasks`
                            }
                            icon={PiggyBank}
                        />
                    )}
                </section>

                <section>
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4">
                        Tasks by status
                    </h2>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                        {BOARD_STATUSES.map((status) => (
                            <Card key={status} className="border-white/60 bg-white/70 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-[#151b28] dark:shadow-xl">
                                <CardContent className="p-4 text-center">
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                        {status}
                                    </p>
                                    <p className="text-3xl font-bold mt-2 tabular-nums text-slate-900 dark:text-white">
                                        {statusCounts[status] || 0}
                                    </p>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </section>

                <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Card className="border-white/60 bg-white/70 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-[#151b28] dark:shadow-xl">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-base flex items-center gap-2">
                                <PiggyBank className="size-4 text-primary" />
                                Billing overview
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <BillingOverviewDetail
                                breakdown={billingBreakdown}
                                summary={billing}
                                projectId={projectId}
                                showHours={!isFreelance}
                            />
                        </CardContent>
                    </Card>

                    <Card className="border-white/60 bg-white/70 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-[#151b28] dark:shadow-xl">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-base flex items-center gap-2">
                                <Users className="size-4 text-primary" />
                                Project team
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {memberTeamRows.length === 0 ? (
                                <p className="text-sm text-slate-500 italic">No members assigned yet.</p>
                            ) : (
                                <div className="overflow-x-auto -mx-1">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="text-left text-[10px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100 dark:border-slate-800">
                                                <th className="pb-2 pr-3">Member</th>
                                                <th className="pb-2 pr-3">Role</th>
                                                <th className="pb-2 pr-3 text-right">Tasks</th>
                                                {isScrum && !isFreelance && (
                                                    <th className="pb-2 text-right">MH allocated</th>
                                                )}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                            {memberTeamRows.map((m) => (
                                                <tr key={m.user_id}>
                                                    <td className="py-2.5 pr-3 font-medium text-slate-900 dark:text-white">
                                                        {m.user_name}
                                                    </td>
                                                    <td className="py-2.5 pr-3 text-xs text-slate-500">
                                                        {m.role_name}
                                                    </td>
                                                    <td className="py-2.5 pr-3 text-right tabular-nums">
                                                        <span className="font-semibold text-slate-900 dark:text-white">
                                                            {m.taskCount}
                                                        </span>
                                                        {m.subtaskCount > 0 && (
                                                            <span className="block text-[10px] text-slate-500">
                                                                {m.rootTaskCount} task · {m.subtaskCount} sub
                                                            </span>
                                                        )}
                                                        {m.taskCount === 0 && (
                                                            <span className="block text-[10px] text-slate-400 italic">
                                                                not assigned yet
                                                            </span>
                                                        )}
                                                    </td>
                                                    {isScrum && !isFreelance && (
                                                        <td className="py-2.5 text-right tabular-nums font-semibold text-primary">
                                                            {formatBoardHours(m.allocatedHours)}h
                                                        </td>
                                                    )}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                            {isScrum && !isFreelance && memberTeamRows.length > 0 && (
                                <p className="text-[10px] text-slate-500 mt-3 leading-relaxed">
                                    <strong>MH allocated</strong> = billable hours on tasks/subtasks assigned to the member.
                                </p>
                            )}
                        </CardContent>
                    </Card>
                </section>

                {isWaterfall && (
                    <section>
                        <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4">
                            Waterfall progress
                        </h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                            {waterfallCards.map((item) => (
                                <Card key={item.status} className="border-white/60 bg-white/70 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-[#151b28] dark:shadow-xl">
                                    <CardContent className="p-5">
                                        <p className="text-xs font-bold text-slate-500 uppercase">{item.status}</p>
                                        <p className="text-2xl font-bold mt-2">{item.percentage}%</p>
                                        <p className="text-xs text-slate-500 mt-1">{item.count} tasks</p>
                                        <div className="h-2 mt-3 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                                            <div
                                                className="h-full bg-primary rounded-full"
                                                style={{ width: `${item.percentage}%` }}
                                            />
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    </section>
                )}

                {!isFreelance && !isWaterfall && Number(totalManhours) > 0 && (
                    <section className="space-y-6">
                        <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <Clock className="size-5 text-primary" />
                            Manhour & quota
                        </h2>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <StatCard
                                label="Total quota"
                                value={`${formatBoardHours(totalManhours)}h`}
                            />
                            <StatCard
                                label="Allocated"
                                value={`${formatBoardHours(allocatedHours)}h`}
                                accent="text-primary"
                            />
                            <StatCard
                                label="Remaining (FIFO)"
                                value={`${formatBoardHours(stats?.remaining ?? stats?.fifo_remaining_hours)}h`}
                                accent={
                                    Number(stats?.mh_overflow_hours) > 0
                                        ? 'text-rose-600'
                                        : 'text-emerald-600 dark:text-emerald-400'
                                }
                                sub={
                                    Number(stats?.mh_overflow_hours) > 0
                                        ? `Overflow +${formatBoardHours(stats.mh_overflow_hours)}h`
                                        : undefined
                                }
                            />
                        </div>

                        {stats?.manhour_buckets?.length > 0 && (
                            <Card className="border-white/60 bg-white/70 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-[#151b28] dark:shadow-xl">
                                <CardHeader>
                                    <CardTitle className="text-base">Project manhour buckets (FIFO)</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <ManhourBucketBreakdown
                                        buckets={stats.manhour_buckets}
                                        overflowHours={stats.mh_overflow_hours}
                                        hasTopup={stats.manhour_buckets.some((b) => b.kind === 'topup')}
                                    />
                                </CardContent>
                            </Card>
                        )}

                        <div className="space-y-4">
                            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500">
                                Per role quota
                            </h3>
                            {visibleRoleQuotas.length === 0 && (
                                <p className="text-sm text-slate-500 italic">No role quotas configured.</p>
                            )}
                            {visibleRoleQuotas.map((quota) => (
                                <QuotaProgressRow
                                    key={quota.id}
                                    title={quota.role_name}
                                    allocated={quota.allocated_hours}
                                    quota={quota.quota_hours}
                                    taskCount={quota.task_count}
                                    buckets={quota.manhour_buckets}
                                    topupHours={quota.topup_hours}
                                    baseQuotaHours={quota.base_quota_hours}
                                />
                            ))}
                            {generalQuota.generalQuotaFromPresales > 0 && (
                                <QuotaProgressRow
                                    title="General quota"
                                    allocated={generalQuota.generalAllocatedHours}
                                    quota={generalQuota.generalQuotaFromPresales}
                                    buckets={quotasMeta?.general_quota?.manhour_buckets}
                                />
                            )}
                        </div>
                    </section>
                )}

                <section>
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                        <Layers className="size-4" />
                        All tasks
                    </h2>
                    <Card className="border-white/60 bg-white/70 shadow-sm backdrop-blur-xl overflow-hidden dark:border-white/10 dark:bg-[#151b28] dark:shadow-xl">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-slate-100 dark:bg-slate-800/80 text-slate-500 text-xs uppercase">
                                    <tr>
                                        <th className="text-left px-4 py-3">Feature / Task</th>
                                        <th className="text-left px-4 py-3">Status</th>
                                        <th className="text-left px-4 py-3">Assignee</th>
                                        <th className="text-left px-4 py-3">Billing</th>
                                        {!isFreelance && (
                                            <th className="text-right px-4 py-3">Hours</th>
                                        )}
                                        <th className="text-right px-4 py-3">Subtasks</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {tasks.map((task) => (
                                        <tr
                                            key={task.id}
                                            className="hover:bg-slate-50/80 dark:hover:bg-slate-900/40 cursor-pointer"
                                            onClick={() => navigate(`/board/${projectId}?task=${task.id}`)}
                                        >
                                            <td className="px-4 py-3">
                                                <p className="text-[10px] font-bold text-primary uppercase">
                                                    {task.feature_title || '—'}
                                                </p>
                                                <p className="font-medium text-slate-900 dark:text-white">
                                                    {task.title}
                                                </p>
                                            </td>
                                            <td className="px-4 py-3">
                                                <Badge variant="outline" className="text-[10px]">
                                                    {normalizeBoardTaskStatus(task.status)}
                                                </Badge>
                                            </td>
                                            <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                                                {assigneeName(task)}
                                            </td>
                                            <td className="px-4 py-3">
                                                <TaskBillingBadges task={task} />
                                            </td>
                                            {!isFreelance && (
                                                <td className="px-4 py-3 text-right tabular-nums font-medium">
                                                    {task.subtasks?.length > 0
                                                        ? `${formatBoardHours(subtasksTotalHours(task.subtasks))}h`
                                                        : task.is_billable === false
                                                          ? '—'
                                                          : `${formatBoardHours(task.estimated_hours)}h`}
                                                </td>
                                            )}
                                            <td className="px-4 py-3 text-right text-slate-500">
                                                {task.subtasks?.length || 0}
                                            </td>
                                        </tr>
                                    ))}
                                    {tasks.length === 0 && (
                                        <tr>
                                            <td
                                                colSpan={isFreelance ? 5 : 6}
                                                className="px-4 py-10 text-center text-slate-500"
                                            >
                                                No tasks yet.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                </section>
            </div>
        </div>
    );
}
