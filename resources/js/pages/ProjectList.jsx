import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { isFreelanceUser } from '../utils/permissions';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, KanbanSquare, Clock3, RefreshCcw, CheckCircle2, ListTodo, Activity, ArrowUpDown, Plus } from 'lucide-react';
import PaginationControls from '../components/ui/PaginationControls';
import CreateProjectModal from '../components/CreateProjectModal';

const MS_PER_DAY = 1000 * 60 * 60 * 24;

const normalizeMethodology = (value) => (value || '').toLowerCase();

const formatHours = (value) => {
    const num = Number(value || 0);
    return Number.isInteger(num) ? `${num}` : num.toFixed(1);
};

const formatDurationDays = (startDate, status, endDate) => {
    if (!startDate) return '-';
    const start = new Date(startDate);
    if (Number.isNaN(start.getTime())) return '-';

    const end = status === 'Done' && endDate ? new Date(endDate) : new Date();
    if (Number.isNaN(end.getTime())) return '-';

    const diffDays = Math.max(0, Math.ceil((end.getTime() - start.getTime()) / MS_PER_DAY));
    return `${diffDays} days`;
};

export default function ProjectList() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [projectTab, setProjectTab] = useState('active');
    const [sortBy, setSortBy] = useState('name_asc');
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [methodologyTab, setMethodologyTab] = useState('all');
    const [isCreateOpen, setIsCreateOpen] = useState(false);

    useEffect(() => {
        const loadProjects = async () => {
            try {
                const res = await fetchAPI('/projects');
                setProjects(res.data || []);
            } catch (error) {
                console.error('Failed to load projects:', error);
            } finally {
                setLoading(false);
            }
        };
        loadProjects();
    }, []);

    const filteredProjects = useMemo(() => {
        const keyword = searchTerm.trim().toLowerCase();
        return projects
            .filter((p) => p.status !== 'Archived')
            .filter((p) => p.status === 'Done' || p.status === 'In Progress' || p.status === 'Planning')
            .filter((p) => {
                if (!keyword) return true;
                return (p.name || '').toLowerCase().includes(keyword);
            });
    }, [projects, searchTerm]);
    const activeProjects = useMemo(() => filteredProjects.filter((p) => p.status !== 'Done'), [filteredProjects]);
    const doneProjects = useMemo(() => filteredProjects.filter((p) => p.status === 'Done'), [filteredProjects]);
    const visibleProjects = useMemo(() => {
        const base = projectTab === 'done' ? doneProjects : activeProjects;
        const withMethodology = base.filter((project) => {
            const methodology = normalizeMethodology(project.methodology);
            if (methodologyTab === 'waterfall') return methodology.includes('waterfall');
            if (methodologyTab === 'scrum') return methodology.includes('scrum') || methodology.includes('agile');
            return true;
        });
        const items = [...withMethodology];
        const createdAtTime = (project) => {
            const t = new Date(project?.created_at || '').getTime();
            return Number.isFinite(t) ? t : 0;
        };
        const numericId = (project) => Number(project?.id) || 0;
        const textName = (project) => String(project?.name || '').toLowerCase();
        const totalTask = (project) => Number(project?.total_tasks || 0);
        const reopen = (project) => Number(project?.reopen_tasks || 0);

        items.sort((a, b) => {
            if (sortBy === 'oldest') {
                const dateDiff = createdAtTime(a) - createdAtTime(b);
                return dateDiff !== 0 ? dateDiff : numericId(a) - numericId(b);
            }
            if (sortBy === 'name_asc') return textName(a).localeCompare(textName(b));
            if (sortBy === 'name_desc') return textName(b).localeCompare(textName(a));
            if (sortBy === 'tasks_desc') return totalTask(b) - totalTask(a);
            if (sortBy === 'reopen_desc') return reopen(b) - reopen(a);
            const dateDiff = createdAtTime(b) - createdAtTime(a);
            return dateDiff !== 0 ? dateDiff : numericId(b) - numericId(a);
        });
        return items;
    }, [projectTab, activeProjects, doneProjects, methodologyTab, sortBy]);
    const methodologyCounts = useMemo(() => {
        const base = projectTab === 'done' ? doneProjects : activeProjects;
        const waterfall = base.filter((project) => normalizeMethodology(project.methodology).includes('waterfall')).length;
        const scrum = base.filter((project) => {
            const methodology = normalizeMethodology(project.methodology);
            return methodology.includes('scrum') || methodology.includes('agile');
        }).length;
        return {
            all: base.length,
            waterfall,
            scrum,
        };
    }, [projectTab, activeProjects, doneProjects]);

    const summary = useMemo(() => {
        const total = filteredProjects.length;
        const done = filteredProjects.filter((p) => p.status === 'Done').length;
        const active = total - done;
        const totalTasks = filteredProjects.reduce((acc, p) => acc + Number(p.total_tasks || 0), 0);
        const totalReopen = filteredProjects.reduce((acc, p) => acc + Number(p.reopen_tasks || 0), 0);
        return { total, active, done, totalTasks, totalReopen };
    }, [filteredProjects]);
    const isFreelance = isFreelanceUser(user);

    const pagedProjects = useMemo(
        () => visibleProjects.slice((page - 1) * pageSize, page * pageSize),
        [visibleProjects, page, pageSize]
    );

    return (
        <div className="relative min-h-full overflow-hidden bg-slate-50 transition-colors duration-200 dark:bg-[#000040]">
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-orange-50/70 via-white to-slate-50 dark:from-[#000040] dark:via-[#0a0e2e] dark:to-background-dark" />
            <div className="pointer-events-none absolute -top-24 -left-24 size-[28rem] rounded-full bg-accent/10 blur-[120px] dark:bg-accent/15" />
            <div className="pointer-events-none absolute -bottom-32 -right-24 size-[32rem] rounded-full bg-primary/10 blur-[130px] dark:bg-accent/10" />

            <div className="relative z-10 w-full px-4 py-5 sm:px-6 lg:px-8 pb-16">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">List Project</h1>
                    <p className="text-slate-500 dark:text-text-secondary">
                        Shows active and done projects with a summary of duration, progress, and task stats.
                    </p>
                </div>
                <Button onClick={() => setIsCreateOpen(true)} className="gap-1.5 shadow-md shadow-primary/20 shrink-0">
                    <Plus className="size-4" />
                    New Project
                </Button>
            </div>

            <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
                <Card><CardContent className="p-4"><p className="text-xs text-slate-500">Total Project</p><p className="text-2xl font-bold">{summary.total}</p></CardContent></Card>
                <Card><CardContent className="p-4"><p className="text-xs text-slate-500">Active</p><p className="text-2xl font-bold text-blue-600">{summary.active}</p></CardContent></Card>
                <Card><CardContent className="p-4"><p className="text-xs text-slate-500">Done</p><p className="text-2xl font-bold text-emerald-600">{summary.done}</p></CardContent></Card>
                <Card><CardContent className="p-4"><p className="text-xs text-slate-500">Total Task</p><p className="text-2xl font-bold">{summary.totalTasks}</p></CardContent></Card>
                <Card><CardContent className="p-4"><p className="text-xs text-slate-500">Task Re-open</p><p className="text-2xl font-bold text-amber-600">{summary.totalReopen}</p></CardContent></Card>
            </div>

            <Card>
                <CardHeader className="pb-4">
                    <div className="flex flex-col gap-4">
                        <div>
                            <CardTitle className="flex items-center gap-2"><KanbanSquare className="size-5 text-primary" /> Project Overview</CardTitle>
                            <CardDescription>Per-project summary by Scrum/Waterfall methodology.</CardDescription>
                        </div>
                        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                            <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 dark:border-slate-700 dark:bg-slate-900">
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className={projectTab === 'active' ? 'h-8 bg-primary px-3 text-white hover:bg-primary hover:text-white' : 'h-8 px-3'}
                                    onClick={() => setProjectTab('active')}
                                >
                                    Active
                                    <span className="ml-1 text-xs opacity-80">({activeProjects.length})</span>
                                </Button>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className={projectTab === 'done' ? 'h-8 bg-primary px-3 text-white hover:bg-primary hover:text-white' : 'h-8 px-3'}
                                    onClick={() => setProjectTab('done')}
                                >
                                    Done
                                    <span className="ml-1 text-xs opacity-80">({doneProjects.length})</span>
                                </Button>
                            </div>
                            <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 dark:border-slate-700 dark:bg-slate-900">
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className={methodologyTab === 'all' ? 'h-8 bg-slate-100 px-3 dark:bg-slate-800' : 'h-8 px-3'}
                                    onClick={() => setMethodologyTab('all')}
                                >
                                    All
                                    <span className="ml-1 text-xs opacity-80">({methodologyCounts.all})</span>
                                </Button>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className={methodologyTab === 'waterfall' ? 'h-8 bg-slate-100 px-3 dark:bg-slate-800' : 'h-8 px-3'}
                                    onClick={() => setMethodologyTab('waterfall')}
                                >
                                    Waterfall
                                    <span className="ml-1 text-xs opacity-80">({methodologyCounts.waterfall})</span>
                                </Button>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className={methodologyTab === 'scrum' ? 'h-8 bg-slate-100 px-3 dark:bg-slate-800' : 'h-8 px-3'}
                                    onClick={() => setMethodologyTab('scrum')}
                                >
                                    Scrum
                                    <span className="ml-1 text-xs opacity-80">({methodologyCounts.scrum})</span>
                                </Button>
                            </div>
                            <div className="flex w-full flex-col gap-2 md:w-auto md:flex-row md:items-center">
                                <div className="relative w-full md:w-64">
                                    <Search className="absolute left-3 top-3 size-4 text-slate-400" />
                                    <Input
                                        className="pl-10"
                                        placeholder="Search projects..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                    />
                                </div>
                                <div className="w-full md:w-52">
                                    <Select value={sortBy} onValueChange={setSortBy}>
                                        <SelectTrigger>
                                            <ArrowUpDown className="mr-2 size-3.5 text-slate-500" />
                                            <SelectValue placeholder="Sort by" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="newest">Newest</SelectItem>
                                            <SelectItem value="oldest">Oldest</SelectItem>
                                            <SelectItem value="name_asc">Name A-Z</SelectItem>
                                            <SelectItem value="name_desc">Name Z-A</SelectItem>
                                            <SelectItem value="tasks_desc">Most tasks</SelectItem>
                                            <SelectItem value="reopen_desc">Highest re-open</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-500">
                                    <th className="text-left font-medium pb-3 px-2">Project</th>
                                    <th className="text-left font-medium pb-3 px-2">Status</th>
                                    <th className="text-left font-medium pb-3 px-2">Duration</th>
                                    {!isFreelance && <th className="text-left font-medium pb-3 px-2">Scrum (MH)</th>}
                                    <th className="text-left font-medium pb-3 px-2">Waterfall Progress</th>
                                    <th className="text-right font-medium pb-3 px-2">Total Task</th>
                                    <th className="text-right font-medium pb-3 px-2">Re-open</th>
                                    <th className="text-right font-medium pb-3 px-2"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                                {loading ? (
                                    <tr><td colSpan={isFreelance ? "7" : "8"} className="py-10 text-center text-slate-400">Loading projects...</td></tr>
                                ) : visibleProjects.length === 0 ? (
                                    <tr><td colSpan={isFreelance ? "7" : "8"} className="py-10 text-center text-slate-400">{projectTab === 'done' ? 'No Done projects yet.' : 'No Active projects yet.'}</td></tr>
                                ) : (
                                    pagedProjects.map((project) => {
                                        const methodology = normalizeMethodology(project.methodology);
                                        const isScrum = methodology.includes('scrum') || methodology.includes('agile');
                                        const isWaterfall = methodology.includes('waterfall');

                                        const totalMh = Number(project.total_manhours || 0);
                                        const remainingMh = Number(project.remaining_manhours ?? totalMh);
                                        const waterfallProgress = Number(project.waterfall_progress_percentage || 0);

                                        return (
                                            <tr key={project.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/20">
                                                <td className="py-3 px-2">
                                                    <div className="font-semibold text-slate-900 dark:text-white">{project.name}</div>
                                                    <div className="text-[11px] text-slate-500">{project.methodology || '-'}</div>
                                                </td>
                                                <td className="py-3 px-2">
                                                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase ${project.status === 'Done' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'}`}>
                                                        {project.status === 'Done' ? 'Done' : 'Active'}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-2 text-slate-700 dark:text-slate-300">
                                                    <div className="inline-flex items-center gap-1.5">
                                                        <Clock3 className="size-3.5 text-slate-400" />
                                                        {formatDurationDays(project.start_date, project.status, project.end_date)}
                                                    </div>
                                                </td>
                                                {!isFreelance && (
                                                    <td className="py-3 px-2">
                                                        {isScrum ? (
                                                            <div className="text-slate-700 dark:text-slate-300">
                                                                <div className="inline-flex items-center gap-1.5"><Activity className="size-3.5 text-primary" /> Total {formatHours(totalMh)}h</div>
                                                                <div className="text-[11px] text-slate-500">Remaining {formatHours(remainingMh)}h</div>
                                                            </div>
                                                        ) : (
                                                            <span className="text-slate-400">-</span>
                                                        )}
                                                    </td>
                                                )}
                                                <td className="py-3 px-2">
                                                    {isWaterfall ? (
                                                        <div className="text-slate-700 dark:text-slate-300">
                                                            <div className="inline-flex items-center gap-1.5"><CheckCircle2 className="size-3.5 text-emerald-500" /> {formatHours(waterfallProgress)}%</div>
                                                            <div className="text-[11px] text-slate-500">Task completion ratio</div>
                                                        </div>
                                                    ) : (
                                                        <span className="text-slate-400">-</span>
                                                    )}
                                                </td>
                                                <td className="py-3 px-2 text-right font-semibold">{project.total_tasks || 0}</td>
                                                <td className="py-3 px-2 text-right font-semibold text-amber-600">
                                                    <div className="inline-flex items-center gap-1.5">
                                                        <RefreshCcw className="size-3.5" />
                                                        {project.reopen_tasks || 0}
                                                    </div>
                                                </td>
                                                <td className="py-3 px-2 text-right">
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => navigate(`/board/${project.id}`)}
                                                        className="inline-flex items-center gap-1.5"
                                                    >
                                                        <ListTodo className="size-3.5" />
                                                        Board
                                                    </Button>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                        <PaginationControls
                            page={page}
                            pageSize={pageSize}
                            total={visibleProjects.length}
                            onPageChange={setPage}
                            onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
                        />
                    </div>
                </CardContent>
            </Card>
            </div>
            <CreateProjectModal open={isCreateOpen} onOpenChange={setIsCreateOpen} />
        </div>
    );
}
