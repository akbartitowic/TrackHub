import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { fetchAPI } from '../services/api';
import { formatTaskDateShort } from '../utils/taskDates';
import { ArrowLeft, GanttChart, LayoutGrid, Loader2, ChevronDown, Download } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
    GANTT_DAY_WIDTH,
    GANTT_LABEL_WIDTH,
    GANTT_ROW_HEIGHT,
    barMetrics,
    buildGanttRows,
    buildGanttTimeline,
    statusBarClass,
} from '../utils/ganttTasks';

function getProjectInitials(name) {
    const words = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) return '?';
    if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
    return (words[0][0] + words[1][0]).toUpperCase();
}

function ProjectCompanyIcon({ logoUrl, projectName, size = 'lg' }) {
    const imgClass = size === 'lg' ? 'size-12 rounded-xl' : 'size-10 rounded-lg';
    const textClass = size === 'lg' ? 'text-base' : 'text-sm';

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

export default function ProjectBoardGantt() {
    const { projectId } = useParams();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [project, setProject] = useState(null);
    const [tasks, setTasks] = useState([]);
    const [expandedParents, setExpandedParents] = useState(new Set());
    const [exporting, setExporting] = useState(false);

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

                const tasksRes = await fetchAPI(`/tasks?project_id=${projectId}`);
                setTasks(tasksRes.data || []);
            } catch (err) {
                console.error('Failed to load gantt data', err);
            } finally {
                setLoading(false);
            }
        };

        load();
    }, [projectId, navigate]);

    const ganttRows = useMemo(() => buildGanttRows(tasks), [tasks]);

    // Get flat list of all displayable rows (parents + expanded subtasks)
    const allDisplayRows = useMemo(() => {
        const rows = [];
        for (const parentRow of ganttRows) {
            rows.push(parentRow);
            if (expandedParents.has(parentRow.id) && parentRow.subtasks?.length > 0) {
                rows.push(...parentRow.subtasks);
            }
        }
        return rows;
    }, [ganttRows, expandedParents]);

    const timeline = useMemo(() => {
        const allRows = [];
        for (const parentRow of ganttRows) {
            allRows.push(parentRow);
            allRows.push(...(parentRow.subtasks || []));
        }
        return buildGanttTimeline(allRows);
    }, [ganttRows]);
    const chartWidth = timeline ? timeline.totalDays * GANTT_DAY_WIDTH : 0;

    const scheduledCount = ganttRows.length;
    const withoutDatesCount = useMemo(() => {
        let n = 0;
        for (const t of tasks) {
            const subs = t.subtasks || [];
            if (subs.length === 0) {
                if (!ganttRows.some((r) => r.id === t.id)) n += 1;
            } else {
                for (const st of subs) {
                    if (!ganttRows.some((parent) => parent.subtasks?.some((sub) => sub.id === st.id))) n += 1;
                }
            }
        }
        return n;
    }, [tasks, ganttRows]);

    const toggleExpand = (parentId) => {
        setExpandedParents((prev) => {
            const next = new Set(prev);
            if (next.has(parentId)) {
                next.delete(parentId);
            } else {
                next.add(parentId);
            }
            return next;
        });
    };

    const exportToPDF = () => {
        if (!project || !ganttRows.length) {
            alert('No tasks with a timeline yet');
            return;
        }

        setExporting(true);

        try {
            // Build table data
            const tableData = [];
            for (const parentRow of ganttRows) {
                const isExpanded = expandedParents.has(parentRow.id);
                const parentBar = barMetrics(parentRow, timeline, GANTT_DAY_WIDTH);

                // Add parent row
                tableData.push([
                    parentRow.task.title,
                    '—',
                    formatTaskDateShort(parentRow.task.start_date) || '—',
                    formatTaskDateShort(parentRow.task.due_date) || '—',
                    parentRow.task.status || '—',
                ]);

                // Add subtasks if expanded
                if (isExpanded && parentRow.subtasks?.length > 0) {
                    for (const subtask of parentRow.subtasks) {
                        tableData.push([
                            `  ↳ ${subtask.task.title}`,
                            subtask.task.feature_title || '—',
                            formatTaskDateShort(subtask.task.start_date) || '—',
                            formatTaskDateShort(subtask.task.due_date) || '—',
                            subtask.task.status || '—',
                        ]);
                    }
                }
            }

            // Create PDF
            const doc = new jsPDF({
                orientation: 'portrait',
                unit: 'mm',
                format: 'a4',
            });

            // Add title
            doc.setFontSize(14);
            doc.text(`${project.name} - Gantt Schedule`, 10, 10);

            // Add timestamp
            doc.setFontSize(10);
            doc.setTextColor(100);
            doc.text(`Generated: ${new Date().toLocaleString('en-US')}`, 10, 17);

            // Add table
            doc.setTextColor(0);
            autoTable(doc, {
                head: [['Task / Subtask', 'Feature', 'Start Date', 'End Date', 'Status']],
                body: tableData,
                startY: 24,
                margin: { left: 10, right: 10 },
                styles: {
                    fontSize: 9,
                    cellPadding: 3,
                },
                headStyles: {
                    fillColor: [59, 130, 246], // primary color
                    textColor: 255,
                    fontStyle: 'bold',
                },
                alternateRowStyles: {
                    fillColor: [245, 245, 245],
                },
                columnStyles: {
                    0: { cellWidth: 60 },
                    1: { cellWidth: 40 },
                    2: { cellWidth: 30 },
                    3: { cellWidth: 30 },
                    4: { cellWidth: 28 },
                },
            });

            // Save PDF
            const filename = `${project.name}-gantt-${new Date().toISOString().slice(0, 10)}.pdf`;
            doc.save(filename);

            setExporting(false);
        } catch (err) {
            console.error('Failed to export PDF', err);
            alert('Failed to export PDF: ' + err.message);
            setExporting(false);
        }
    };

    if (loading) {
        return (
            <div className="flex-1 flex items-center justify-center min-h-[320px]">
                <Loader2 className="size-8 animate-spin text-primary" />
            </div>
        );
    }

    if (!project) return null;

    return (
        <div className="relative flex-1 flex flex-col min-h-0 overflow-hidden bg-slate-50 dark:bg-[#0B192C]">
            <div className="relative shrink-0 border-b border-white/60 bg-white/70 backdrop-blur-xl dark:border-white/10 dark:bg-[#151b28]/90 px-5 py-4">
                <Button
                    variant="ghost"
                    className="-ml-2 mb-3 text-slate-500"
                    onClick={() => navigate(`/board/${projectId}`)}
                >
                    <ArrowLeft className="size-4 mr-2" />
                    Back to Board
                </Button>
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="flex gap-3 min-w-0">
                        <ProjectCompanyIcon logoUrl={project.company_logo_url} projectName={project.name} />
                        <div className="min-w-0">
                            <h1 className="text-xl font-bold text-slate-900 dark:text-white truncate">
                                {project.name}
                            </h1>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                                Gantt view · {project.methodology || 'Project'}
                            </p>
                            <div className="flex flex-wrap gap-2 mt-2">
                                <Badge variant="outline">{scheduledCount} scheduled</Badge>
                                {withoutDatesCount > 0 && (
                                    <Badge variant="outline" className="text-slate-500">
                                        {withoutDatesCount} without a full timeline
                                    </Badge>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            onClick={exportToPDF}
                            disabled={exporting || scheduledCount === 0}
                        >
                            <Download className="size-4 mr-2" />
                            {exporting ? 'Exporting...' : 'Export PDF'}
                        </Button>
                        <Button onClick={() => navigate(`/board/${projectId}`)}>
                            <LayoutGrid className="size-4 mr-2" />
                            Kanban Board
                        </Button>
                    </div>
                </div>
            </div>

            <div className="relative flex-1 min-h-0 p-4 sm:p-5 overflow-hidden flex flex-col">
                {scheduledCount === 0 ? (
                    <Card className="border-white/60 bg-white/70 shadow-sm backdrop-blur-xl max-w-lg mx-auto mt-12 dark:border-white/10 dark:bg-[#151b28] dark:shadow-xl">
                        <CardContent className="p-8 text-center">
                            <GanttChart className="size-12 mx-auto text-slate-300 mb-4" />
                            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                                No tasks with a timeline yet
                            </h2>
                            <p className="text-sm text-slate-500 mt-2">
                                Tasks or subtasks need a <strong>start date</strong> and{' '}
                                <strong>due date</strong> to appear in the Gantt.
                            </p>
                            <Button className="mt-6" onClick={() => navigate(`/board/${projectId}`)}>
                                Open Board
                            </Button>
                        </CardContent>
                    </Card>
                ) : (
                    <Card
                        id="gantt-chart-container"
                        className="flex-1 min-h-0 flex flex-col border-white/60 bg-white/70 shadow-sm backdrop-blur-xl overflow-hidden dark:border-white/10 dark:bg-[#151b28] dark:shadow-xl"
                    >
                        <div className="flex flex-1 min-h-0 overflow-hidden">
                            <div
                                className="shrink-0 border-r border-white/60 bg-white/60 backdrop-blur-sm dark:border-white/10 dark:bg-white/5 z-20"
                                style={{ width: GANTT_LABEL_WIDTH }}
                            >
                                <div
                                    className="border-b border-slate-200 dark:border-slate-800 px-3 flex items-end pb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500"
                                    style={{ height: 52 }}
                                >
                                    Task / Subtask
                                </div>
                                {allDisplayRows.map((row) => {
                                    const bar = barMetrics(row, timeline, GANTT_DAY_WIDTH);
                                    const isExpanded = expandedParents.has(row.id);
                                    const hasSubtasks = !row.isSubtask && row.subtasks && row.subtasks.length > 0;
                                    return (
                                        <div
                                            key={row.id}
                                            className="border-b border-slate-100 dark:border-slate-800 px-3 flex flex-col justify-center"
                                            style={{ height: GANTT_ROW_HEIGHT }}
                                        >
                                            <div className="flex items-center gap-1.5">
                                                {hasSubtasks && (
                                                    <button
                                                        type="button"
                                                        onClick={() => toggleExpand(row.id)}
                                                        className="flex items-center justify-center w-4 h-4 shrink-0 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                                                    >
                                                        <ChevronDown
                                                            className={`size-3.5 transition-transform ${
                                                                isExpanded ? 'rotate-0' : '-rotate-90'
                                                            }`}
                                                        />
                                                    </button>
                                                )}
                                                {!hasSubtasks && <span className="w-4 shrink-0" />}
                                                <div className="min-w-0 flex-1">
                                                    {row.isSubtask && (
                                                        <p className="text-[10px] text-slate-400 truncate">
                                                            ↳ {row.parentFeature || row.parentTitle}
                                                        </p>
                                                    )}
                                                    <p
                                                        className={`font-medium text-slate-900 dark:text-white truncate ${
                                                            row.isSubtask ? 'text-sm pl-2' : 'text-sm'
                                                        }`}
                                                    >
                                                        {row.task.title}
                                                    </p>
                                                    <p className="text-[10px] text-slate-500 truncate">
                                                        {row.task.status}
                                                        {bar ? ` · ${bar.durationDays} days` : ''}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="flex-1 overflow-x-auto overflow-y-auto min-w-0">
                                <div style={{ width: chartWidth, minWidth: '100%' }}>
                                    <div
                                        className="sticky top-0 z-10 bg-white/90 backdrop-blur-sm dark:bg-[#151b28]/95 border-b border-slate-200/80 dark:border-white/10"
                                        style={{ height: 52 }}
                                    >
                                        <div className="flex h-6 border-b border-slate-100 dark:border-slate-800">
                                            {timeline.months.map((m) => (
                                                <div
                                                    key={m.key}
                                                    className="text-[10px] font-bold uppercase tracking-wide text-slate-500 px-1 flex items-center border-r border-slate-100 dark:border-slate-800 truncate"
                                                    style={{ width: m.days * GANTT_DAY_WIDTH }}
                                                >
                                                    {m.label}
                                                </div>
                                            ))}
                                        </div>
                                        <div className="flex h-[26px]">
                                            {timeline.days.map((d) => (
                                                <div
                                                    key={d.index}
                                                    className={`text-[10px] flex items-center justify-center border-r border-slate-100 dark:border-slate-800 ${
                                                        d.isWeekend
                                                            ? 'bg-slate-100/80 dark:bg-slate-800/50 text-slate-400'
                                                            : 'text-slate-500'
                                                    } ${d.isToday ? 'bg-primary/10 font-bold text-primary' : ''}`}
                                                    style={{ width: GANTT_DAY_WIDTH }}
                                                >
                                                    {d.label}
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="relative">
                                        {timeline.todayInRange && (
                                            <div
                                                className="absolute top-0 bottom-0 w-0.5 bg-primary z-[5] pointer-events-none"
                                                style={{
                                                    left: timeline.todayOffset * GANTT_DAY_WIDTH + GANTT_DAY_WIDTH / 2,
                                                }}
                                            />
                                        )}

                                        {allDisplayRows.map((row) => {
                                            const bar = barMetrics(row, timeline, GANTT_DAY_WIDTH);
                                            return (
                                                <div
                                                    key={row.id}
                                                    className="relative border-b border-slate-100 dark:border-slate-800"
                                                    style={{ height: GANTT_ROW_HEIGHT }}
                                                >
                                                    <div className="absolute inset-0 flex pointer-events-none">
                                                        {timeline.days.map((d) => (
                                                            <div
                                                                key={d.index}
                                                                className={`border-r border-slate-50 dark:border-slate-800/80 ${
                                                                    d.isWeekend
                                                                        ? 'bg-slate-50 dark:bg-slate-900/40'
                                                                        : ''
                                                                }`}
                                                                style={{ width: GANTT_DAY_WIDTH }}
                                                            />
                                                        ))}
                                                    </div>
                                                    {bar && (
                                                        <button
                                                            type="button"
                                                            title={`${bar.startLabel} → ${bar.endLabel}`}
                                                            onClick={() =>
                                                                navigate(`/board/${projectId}?task=${row.id}`)
                                                            }
                                                            className={`absolute top-2 h-7 rounded-md border shadow-sm z-[2] hover:brightness-110 transition-all ${statusBarClass(
                                                                row.task.status,
                                                            )}`}
                                                            style={{
                                                                left: bar.left + 1,
                                                                width: bar.width,
                                                            }}
                                                        >
                                                            <span className="sr-only">{row.task.title}</span>
                                                        </button>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="shrink-0 px-4 py-2 border-t border-white/50 dark:border-white/10 bg-white/40 dark:bg-white/5 flex flex-wrap gap-3 text-[10px] text-slate-500">
                            <span className="flex items-center gap-1">
                                <span className="size-2.5 rounded-sm bg-slate-400" /> To Do
                            </span>
                            <span className="flex items-center gap-1">
                                <span className="size-2.5 rounded-sm bg-primary" /> In Progress
                            </span>
                            <span className="flex items-center gap-1">
                                <span className="size-2.5 rounded-sm bg-violet-500" /> Review
                            </span>
                            <span className="flex items-center gap-1">
                                <span className="size-2.5 rounded-sm bg-emerald-500" /> Done
                            </span>
                            <span className="flex items-center gap-1">
                                <span className="w-0.5 h-3 bg-primary" /> Today
                            </span>
                        </div>
                    </Card>
                )}
            </div>
        </div>
    );
}
