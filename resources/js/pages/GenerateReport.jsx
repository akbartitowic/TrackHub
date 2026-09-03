import { useState, useEffect } from 'react';
import { fetchAPI, getApiUrl } from '../services/api';
import {
    FileText, Download, Eye, Loader2, Calendar, Briefcase,
    Filter, ChevronLeft, Mail, Send, CheckCircle2,
    Clock, Plus, Pencil, Trash2, Play, Pause, AlertCircle,
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle,
    DialogDescription, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import { useNavigate } from 'react-router-dom';

// ── Constants ────────────────────────────────────────────────────────────────

const DAYS = [
    { value: '1', label: 'Monday' },
    { value: '2', label: 'Tuesday' },
    { value: '3', label: 'Wednesday' },
    { value: '4', label: 'Thursday' },
    { value: '5', label: 'Friday' },
    { value: '6', label: 'Saturday' },
    { value: '0', label: 'Sunday' },
];

const FREQ_LABELS = {
    weekly:   'Weekly',
    biweekly: 'Bi-weekly',
    monthly:  'Monthly',
    custom:   'One-time',
};

const DAY_OF_MONTH_OPTIONS = Array.from({ length: 28 }, (_, i) => ({
    value: String(i + 1),
    label: `${i + 1}${[,'st','nd','rd'][((i+1)%100>>3^1)&&(i+1)%10]||'th'} of every month`,
}));

const BLANK_SCHEDULE = {
    project_id:   '',
    frequency:    'weekly',
    day_of_week:  '1',
    day_of_month: '1',
    custom_date:  '',
    emails:       '',
    subject:      '',
    body:         '',
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function dayLabel(n) {
    return DAYS.find(d => d.value === String(n))?.label ?? '—';
}

function formatDate(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('id-ID', {
        weekday: 'short', day: 'numeric', month: 'short',
        year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function GenerateReport() {
    const navigate = useNavigate();

    // Manual report state
    const [projects, setProjects]               = useState([]);
    const [selectedProject, setSelectedProject] = useState('');
    const [range, setRange]                     = useState('weekly');
    const [manualRange, setManualRange]         = useState({ start_date: '', end_date: '' });
    const [loading, setLoading]                 = useState(false);
    const [projectsLoading, setProjectsLoading] = useState(true);
    const [previewUrl, setPreviewUrl]           = useState(null);

    // Email modal
    const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
    const [emailData, setEmailData]               = useState({ emails: '', subject: '', body: '' });
    const [isSendingEmail, setIsSendingEmail]     = useState(false);
    const [emailSuccess, setEmailSuccess]         = useState(false);

    // Schedule state
    const [schedules, setSchedules]               = useState([]);
    const [schedulesLoading, setSchedulesLoading] = useState(true);
    const [isScheduleOpen, setIsScheduleOpen]     = useState(false);
    const [editingSchedule, setEditingSchedule]   = useState(null);
    const [scheduleForm, setScheduleForm]         = useState(BLANK_SCHEDULE);
    const [isSavingSchedule, setIsSavingSchedule] = useState(false);
    const [togglingId, setTogglingId]             = useState(null);
    const [deletingId, setDeletingId]             = useState(null);
    const [confirmDeleteId, setConfirmDeleteId]   = useState(null);
    const [scheduleError, setScheduleError]       = useState('');

    // ── Load data ──────────────────────────────────────────────────────────
    useEffect(() => {
        fetchAPI('/reports/projects')
            .then(res => { if (res.data) setProjects(res.data); })
            .finally(() => setProjectsLoading(false));

        fetchAPI('/report-schedules')
            .then(res => { if (res.data) setSchedules(res.data); })
            .finally(() => setSchedulesLoading(false));
    }, []);

    // Auto-fill email subject/body (manual send)
    useEffect(() => {
        if (!selectedProject) return;
        const project    = projects.find(p => p.id.toString() === selectedProject);
        const rangeLabel = range === 'manual'
            ? (manualRange.start_date && manualRange.end_date
                ? `manual (${manualRange.start_date} – ${manualRange.end_date})`
                : 'manual range')
            : range;
        setEmailData(prev => ({
            ...prev,
            subject: `Project Report: ${project?.name} (${rangeLabel})`,
            body: `Hello,\n\nPlease find attached the ${rangeLabel} project report for "${project?.name}".\n\nBest regards,\nProject Tracker System`,
        }));
    }, [selectedProject, range, manualRange.start_date, manualRange.end_date, projects]);

    // Auto-fill schedule subject/body on create
    useEffect(() => {
        if (editingSchedule || !scheduleForm.project_id) return;
        const project = projects.find(p => p.id.toString() === scheduleForm.project_id);
        if (!project) return;
        setScheduleForm(prev => ({
            ...prev,
            subject: `[Auto Report] ${project.name} — ${FREQ_LABELS[prev.frequency] ?? prev.frequency}`,
            body: `Hello,\n\nAttached is the ${(FREQ_LABELS[prev.frequency] ?? '').toLowerCase()} project report for "${project.name}".\n\nBest regards,\nProject Tracker System`,
        }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [scheduleForm.project_id, scheduleForm.frequency]);

    // ── Manual report handlers ─────────────────────────────────────────────
    const canRunReport = selectedProject && !loading &&
        (range !== 'manual' || (manualRange.start_date && manualRange.end_date));

    const handlePreview = async () => {
        setLoading(true);
        try {
            const response = await fetch(`${getApiUrl()}/reports/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` },
                body: JSON.stringify({
                    project_id: selectedProject, range,
                    start_date: range === 'manual' ? manualRange.start_date : null,
                    end_date:   range === 'manual' ? manualRange.end_date   : null,
                    preview: true,
                }),
            });
            if (!response.ok) throw new Error('Failed to generate report');
            setPreviewUrl(URL.createObjectURL(await response.blob()));
        } catch (err) { alert(err.message); }
        finally { setLoading(false); }
    };

    const handleDownload = async () => {
        setLoading(true);
        try {
            const response = await fetch(`${getApiUrl()}/reports/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` },
                body: JSON.stringify({
                    project_id: selectedProject, range,
                    start_date: range === 'manual' ? manualRange.start_date : null,
                    end_date:   range === 'manual' ? manualRange.end_date   : null,
                    preview: false,
                }),
            });
            if (!response.ok) throw new Error('Failed to download report');
            const a = document.createElement('a');
            a.href     = window.URL.createObjectURL(await response.blob());
            a.download = `Report-${projects.find(p => p.id.toString() === selectedProject)?.name}-${range}.pdf`;
            document.body.appendChild(a); a.click(); a.remove();
        } catch (err) { alert(err.message); }
        finally { setLoading(false); }
    };

    const handleSendEmail = async () => {
        setIsSendingEmail(true);
        try {
            const res = await fetchAPI('/reports/send-email', {
                method: 'POST',
                body: JSON.stringify({
                    project_id: selectedProject, range,
                    start_date: range === 'manual' ? manualRange.start_date : null,
                    end_date:   range === 'manual' ? manualRange.end_date   : null,
                    ...emailData,
                }),
            });
            if (res.status === 'success') {
                setEmailSuccess(true);
                setTimeout(() => { setIsEmailModalOpen(false); setEmailSuccess(false); }, 2000);
            }
        } catch (err) { alert('Email Error: ' + err.message); }
        finally { setIsSendingEmail(false); }
    };

    // ── Schedule handlers ──────────────────────────────────────────────────
    const openCreate = () => {
        setEditingSchedule(null);
        setScheduleForm({ ...BLANK_SCHEDULE, project_id: selectedProject || '' });
        setScheduleError('');
        setIsScheduleOpen(true);
    };

    const openEdit = (s) => {
        setEditingSchedule(s);
        setScheduleForm({
            project_id:   String(s.project_id),
            frequency:    s.frequency,
            day_of_week:  s.day_of_week  != null ? String(s.day_of_week)  : '1',
            day_of_month: s.day_of_month != null ? String(s.day_of_month) : '1',
            custom_date:  s.custom_date ? String(s.custom_date).slice(0, 10) : '',
            emails:       Array.isArray(s.emails) ? s.emails.join(', ') : (s.emails ?? ''),
            subject:      s.subject,
            body:         s.body,
        });
        setScheduleError('');
        setIsScheduleOpen(true);
    };

    const handleSave = async () => {
        setScheduleError('');
        const needsDay   = ['weekly', 'biweekly'].includes(scheduleForm.frequency);
        const needsMonth = scheduleForm.frequency === 'monthly';
        const needsDate  = scheduleForm.frequency === 'custom';

        if (!scheduleForm.project_id) { setScheduleError('Project is required.'); return; }
        if (!scheduleForm.emails.trim()) { setScheduleError('Recipients are required.'); return; }
        if (needsDate && !scheduleForm.custom_date) { setScheduleError('Date is required for one-time schedule.'); return; }

        setIsSavingSchedule(true);
        try {
            const payload = {
                project_id:   Number(scheduleForm.project_id),
                frequency:    scheduleForm.frequency,
                day_of_week:  needsDay   ? Number(scheduleForm.day_of_week)  : null,
                day_of_month: needsMonth ? Number(scheduleForm.day_of_month) : null,
                custom_date:  needsDate  ? scheduleForm.custom_date : null,
                emails:      scheduleForm.emails,
                subject:     scheduleForm.subject,
                body:        scheduleForm.body,
                timezone:    Intl.DateTimeFormat().resolvedOptions().timeZone,
            };

            let res;
            if (editingSchedule) {
                res = await fetchAPI(`/report-schedules/${editingSchedule.id}`, { method: 'PUT', body: JSON.stringify(payload) });
                setSchedules(prev => prev.map(s => s.id === editingSchedule.id ? res.data : s));
            } else {
                res = await fetchAPI('/report-schedules', { method: 'POST', body: JSON.stringify(payload) });
                setSchedules(prev => [res.data, ...prev]);
            }
            setIsScheduleOpen(false);
        } catch (err) {
            setScheduleError(err.message || 'Failed to save schedule.');
        } finally {
            setIsSavingSchedule(false);
        }
    };

    const handleToggle = async (id) => {
        setTogglingId(id);
        try {
            const res = await fetchAPI(`/report-schedules/${id}/toggle`, { method: 'PATCH' });
            setSchedules(prev => prev.map(s => s.id === id ? res.data : s));
        } catch (err) { alert('Failed: ' + err.message); }
        finally { setTogglingId(null); }
    };

    const handleDelete = async (id) => {
        setDeletingId(id);
        try {
            await fetchAPI(`/report-schedules/${id}`, { method: 'DELETE' });
            setSchedules(prev => prev.filter(s => s.id !== id));
            setConfirmDeleteId(null);
        } catch (err) { alert('Failed: ' + err.message); }
        finally { setDeletingId(null); }
    };

    // ── Render ─────────────────────────────────────────────────────────────
    return (
        <div className="relative flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-slate-50 pb-8 dark:bg-[#0B192C] sm:pb-10">
            <header className="relative flex items-start gap-3 border-b border-white/60 bg-white/70 backdrop-blur-xl p-4 sm:items-center sm:p-6 dark:border-white/10 dark:bg-[#151b28]/90">
                <div className="flex min-w-0 flex-1 items-start gap-3 sm:gap-4">
                    <Button variant="ghost" size="icon" onClick={() => navigate('/reports')} className="mt-0.5 shrink-0 rounded-full sm:mt-0">
                        <ChevronLeft className="size-5" />
                    </Button>
                    <div className="min-w-0">
                        <h1 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white sm:text-2xl">Generate Project Report</h1>
                        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 sm:text-sm">Configure, export, email, or schedule automated project reports.</p>
                    </div>
                </div>
            </header>

            <div className="relative flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto p-4 sm:p-6 lg:flex-row lg:overflow-hidden">

                {/* ── Left sidebar ── */}
                <div className="w-full lg:w-80 flex flex-col gap-6 shrink-0 lg:overflow-y-auto lg:pb-4">

                    {/* Manual report filter */}
                    <Card className="border border-white/60 bg-white/70 shadow-xl shadow-slate-200/50 backdrop-blur-xl dark:border-white/10 dark:bg-[#151b28] dark:shadow-xl">
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <Filter className="size-4 text-primary" />
                                Report Filter
                            </CardTitle>
                            <CardDescription>Select project and timeframe</CardDescription>
                        </CardHeader>
                        <CardContent className="flex flex-col gap-4">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                                    <Briefcase className="size-3" /> Project
                                </label>
                                <Select value={selectedProject} onValueChange={setSelectedProject}>
                                    <SelectTrigger className="bg-white dark:bg-slate-800">
                                        <SelectValue placeholder={projectsLoading ? 'Loading…' : 'Select a project'} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {projects.map(p => (
                                            <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                                    <Calendar className="size-3" /> Time Range
                                </label>
                                <Select value={range} onValueChange={setRange}>
                                    <SelectTrigger className="bg-white dark:bg-slate-800">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="weekly">Weekly</SelectItem>
                                        <SelectItem value="biweekly">Bi-weekly</SelectItem>
                                        <SelectItem value="monthly">Monthly</SelectItem>
                                        <SelectItem value="manual">Manual Date Range</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {range === 'manual' && (
                                <div className="space-y-3 rounded-lg border border-slate-200 dark:border-slate-700 p-3 bg-slate-50/80 dark:bg-slate-900/40">
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Start Date</label>
                                        <Input type="date" value={manualRange.start_date}
                                            onChange={e => setManualRange(p => ({ ...p, start_date: e.target.value }))}
                                            className="bg-white dark:bg-slate-800" />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">End Date</label>
                                        <Input type="date" value={manualRange.end_date}
                                            min={manualRange.start_date || undefined}
                                            onChange={e => setManualRange(p => ({ ...p, end_date: e.target.value }))}
                                            className="bg-white dark:bg-slate-800" />
                                    </div>
                                </div>
                            )}

                            <div className="pt-2 flex flex-col gap-3">
                                <Button onClick={handlePreview} className="w-full gap-2 shadow-lg shadow-primary/20 h-10" disabled={!canRunReport}>
                                    {loading ? <Loader2 className="size-4 animate-spin" /> : <Eye className="size-4" />}
                                    Preview PDF
                                </Button>
                                <div className="grid grid-cols-2 gap-3">
                                    <Button variant="outline" onClick={handleDownload}
                                        className="gap-2 border-slate-200 dark:border-slate-700 h-10" disabled={!canRunReport}>
                                        <Download className="size-4" /> Download
                                    </Button>
                                    <Button variant="outline" onClick={() => setIsEmailModalOpen(true)}
                                        className="gap-2 border-primary/20 hover:bg-primary/5 text-primary h-10" disabled={!canRunReport}>
                                        <Mail className="size-4" /> Send Email
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* ── Schedule card ── */}
                    <Card className="border border-white/60 bg-white/70 shadow-xl shadow-slate-200/50 backdrop-blur-xl dark:border-white/10 dark:bg-[#151b28] dark:shadow-xl">
                        <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-base flex items-center gap-2">
                                    <Clock className="size-4 text-primary" />
                                    Auto Schedule
                                </CardTitle>
                                <Button size="sm" variant="outline"
                                    className="h-7 gap-1.5 text-xs border-primary/30 text-primary hover:bg-primary/5"
                                    onClick={openCreate}>
                                    <Plus className="size-3" /> New
                                </Button>
                            </div>
                            <CardDescription className="text-xs">
                                Reports sent automatically at 08:00 on the configured day.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="pt-0">
                            {schedulesLoading ? (
                                <div className="flex items-center justify-center py-6">
                                    <Loader2 className="size-5 animate-spin text-slate-400" />
                                </div>
                            ) : schedules.length === 0 ? (
                                <div className="text-center py-6 text-slate-400 dark:text-slate-600">
                                    <Clock className="size-8 mx-auto mb-2 opacity-40" />
                                    <p className="text-xs">No schedules yet.</p>
                                    <p className="text-xs mt-0.5">Click <strong>New</strong> to set one up.</p>
                                </div>
                            ) : (
                                <div className="flex flex-col gap-2">
                                    {schedules.map(s => (
                                        <ScheduleRow
                                            key={s.id}
                                            schedule={s}
                                            toggling={togglingId === s.id}
                                            deleting={deletingId === s.id}
                                            confirmingDelete={confirmDeleteId === s.id}
                                            onEdit={() => openEdit(s)}
                                            onToggle={() => handleToggle(s.id)}
                                            onDelete={() => setConfirmDeleteId(s.id)}
                                            onConfirmDelete={() => handleDelete(s.id)}
                                            onCancelDelete={() => setConfirmDeleteId(null)}
                                        />
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Card className="border-none shadow-lg shadow-primary/5 bg-primary/5 border-primary/10">
                        <CardContent className="p-4 flex gap-3">
                            <FileText className="size-5 text-primary shrink-0 mt-0.5" />
                            <div>
                                <p className="text-[10px] font-bold text-primary uppercase tracking-tight">Report Insights</p>
                                <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                                    The report includes complete task audit logs and developer man-hours based on the specified range.
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* ── Preview area ── */}
                <div className="flex-1 h-full min-h-[500px] lg:min-h-0 bg-white/70 backdrop-blur-xl dark:bg-[#151b28] rounded-2xl border border-white/60 dark:border-white/10 flex flex-col shadow-2xl shadow-slate-200/50 dark:shadow-xl relative overflow-hidden">
                    {previewUrl ? (
                        <iframe src={previewUrl} className="w-full h-full border-none rounded-xl" title="Report Preview" />
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-12 text-center">
                            <div className="size-24 bg-slate-50 dark:bg-slate-800/50 rounded-full flex items-center justify-center mb-6 border border-slate-100 dark:border-slate-800">
                                <FileText className="size-10 text-slate-300 dark:text-slate-600" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-700 dark:text-slate-200 mb-2">Ready for Preview</h3>
                            <p className="max-w-xs text-sm leading-relaxed">Select a project and timeframe, then click Preview to generate the PDF.</p>
                        </div>
                    )}
                    {loading && (
                        <div className="absolute inset-0 bg-white/60 dark:bg-slate-900/60 backdrop-blur-[2px] z-10 flex items-center justify-center">
                            <div className="flex flex-col items-center gap-4">
                                <div className="size-16 rounded-full border-4 border-primary/10 border-t-primary animate-spin"></div>
                                <p className="text-sm font-black text-primary uppercase tracking-widest">Generating PDF…</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* ── Manual email dialog ── */}
            <Dialog open={isEmailModalOpen} onOpenChange={setIsEmailModalOpen}>
                <DialogContent className="sm:max-w-[500px] border-none shadow-2xl dark:bg-[#1e2532]">
                    {emailSuccess ? (
                        <div className="py-12 flex flex-col items-center text-center">
                            <div className="size-20 rounded-full bg-emerald-100 dark:bg-emerald-900/20 flex items-center justify-center mb-6">
                                <CheckCircle2 className="size-12 text-emerald-600 animate-in zoom-in duration-300" />
                            </div>
                            <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-2">Email Sent!</h3>
                            <p className="text-slate-500 dark:text-slate-400">The report has been dispatched to the recipients.</p>
                        </div>
                    ) : (
                        <>
                            <DialogHeader>
                                <div className="size-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                                    <Mail className="size-6 text-primary" />
                                </div>
                                <DialogTitle className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Send Report</DialogTitle>
                                <DialogDescription>Send the generated PDF report directly to stakeholders.</DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Recipients (comma separated)</label>
                                    <Input placeholder="stakeholder@company.com, boss@company.com"
                                        value={emailData.emails} onChange={e => setEmailData({ ...emailData, emails: e.target.value })}
                                        className="bg-slate-50 dark:bg-slate-900/50" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Subject</label>
                                    <Input value={emailData.subject} onChange={e => setEmailData({ ...emailData, subject: e.target.value })}
                                        className="bg-slate-50 dark:bg-slate-900/50" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Message</label>
                                    <Textarea rows={4} value={emailData.body} onChange={e => setEmailData({ ...emailData, body: e.target.value })}
                                        className="bg-slate-50 dark:bg-slate-900/50 resize-none" />
                                </div>
                            </div>
                            <DialogFooter className="gap-3">
                                <DialogClose asChild><Button variant="ghost" className="flex-1">Cancel</Button></DialogClose>
                                <Button onClick={handleSendEmail} disabled={!emailData.emails || isSendingEmail}
                                    className="flex-1 gap-2 shadow-lg shadow-primary/20">
                                    {isSendingEmail ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                                    Send Report
                                </Button>
                            </DialogFooter>
                        </>
                    )}
                </DialogContent>
            </Dialog>

            {/* ── Schedule create / edit dialog ── */}
            <Dialog open={isScheduleOpen} onOpenChange={setIsScheduleOpen}>
                <DialogContent className="sm:max-w-[480px] border-none shadow-2xl dark:bg-[#1e2532]">
                    <DialogHeader>
                        <div className="size-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                            <Clock className="size-6 text-primary" />
                        </div>
                        <DialogTitle className="text-xl font-black text-slate-900 dark:text-white">
                            {editingSchedule ? 'Edit Schedule' : 'New Auto Schedule'}
                        </DialogTitle>
                        <DialogDescription>
                            Report will be sent automatically at <strong>08:00</strong> on the configured day.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-2">

                        {/* Project */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Project</label>
                            <Select value={scheduleForm.project_id}
                                onValueChange={v => setScheduleForm(p => ({ ...p, project_id: v }))}>
                                <SelectTrigger className="bg-slate-50 dark:bg-slate-900/50">
                                    <SelectValue placeholder="Select project" />
                                </SelectTrigger>
                                <SelectContent>
                                    {projects.map(p => (
                                        <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Frequency */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Frequency</label>
                            <Select value={scheduleForm.frequency}
                                onValueChange={v => setScheduleForm(p => ({ ...p, frequency: v, custom_date: '', day_of_week: '1' }))}>
                                <SelectTrigger className="bg-slate-50 dark:bg-slate-900/50">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="weekly">Weekly — every week on selected day</SelectItem>
                                    <SelectItem value="biweekly">Bi-weekly — every 2 weeks on selected day</SelectItem>
                                    <SelectItem value="monthly">Monthly — on selected date each month</SelectItem>
                                    <SelectItem value="custom">One-time — on a specific date</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Day of month selector (monthly) */}
                        {scheduleForm.frequency === 'monthly' && (
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                                    Send on date
                                </label>
                                <Select value={scheduleForm.day_of_month}
                                    onValueChange={v => setScheduleForm(p => ({ ...p, day_of_month: v }))}>
                                    <SelectTrigger className="bg-slate-50 dark:bg-slate-900/50">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {DAY_OF_MONTH_OPTIONS.map(d => (
                                            <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}

                        {/* Day of week selector (weekly / biweekly) */}
                        {(scheduleForm.frequency === 'weekly' || scheduleForm.frequency === 'biweekly') && (
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                                    Send on day
                                </label>
                                <Select value={scheduleForm.day_of_week}
                                    onValueChange={v => setScheduleForm(p => ({ ...p, day_of_week: v }))}>
                                    <SelectTrigger className="bg-slate-50 dark:bg-slate-900/50">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {DAYS.map(d => (
                                            <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}

                        {/* Date picker (custom) */}
                        {scheduleForm.frequency === 'custom' && (
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Send date</label>
                                <Input type="date" value={scheduleForm.custom_date}
                                    min={new Date().toISOString().slice(0, 10)}
                                    onChange={e => setScheduleForm(p => ({ ...p, custom_date: e.target.value }))}
                                    className="bg-slate-50 dark:bg-slate-900/50" />
                            </div>
                        )}

                        {/* Recipients */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Recipients</label>
                            <Input placeholder="email@company.com, another@company.com"
                                value={scheduleForm.emails}
                                onChange={e => setScheduleForm(p => ({ ...p, emails: e.target.value }))}
                                className="bg-slate-50 dark:bg-slate-900/50" />
                        </div>

                        {/* Subject */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Subject</label>
                            <Input value={scheduleForm.subject}
                                onChange={e => setScheduleForm(p => ({ ...p, subject: e.target.value }))}
                                className="bg-slate-50 dark:bg-slate-900/50" />
                        </div>

                        {/* Body */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Message</label>
                            <Textarea rows={3} value={scheduleForm.body}
                                onChange={e => setScheduleForm(p => ({ ...p, body: e.target.value }))}
                                className="bg-slate-50 dark:bg-slate-900/50 resize-none" />
                        </div>

                        {scheduleError && (
                            <div className="flex items-center gap-2 text-red-500 text-sm bg-red-50 dark:bg-red-900/10 rounded-lg px-3 py-2">
                                <AlertCircle className="size-4 shrink-0" /> {scheduleError}
                            </div>
                        )}
                    </div>

                    <DialogFooter className="gap-3 pt-2">
                        <DialogClose asChild><Button variant="ghost" className="flex-1">Cancel</Button></DialogClose>
                        <Button onClick={handleSave} disabled={isSavingSchedule} className="flex-1 gap-2 shadow-lg shadow-primary/20">
                            {isSavingSchedule ? <Loader2 className="size-4 animate-spin" /> : <Clock className="size-4" />}
                            {editingSchedule ? 'Save Changes' : 'Create Schedule'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

// ── Schedule row ──────────────────────────────────────────────────────────────

function ScheduleRow({ schedule, toggling, deleting, confirmingDelete, onEdit, onToggle, onDelete, onConfirmDelete, onCancelDelete }) {
    const isCustom = schedule.frequency === 'custom';

    const description = isCustom
        ? `One-time · ${schedule.custom_date ? new Date(schedule.custom_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}`
        : schedule.frequency === 'monthly'
            ? `Monthly · Every ${schedule.day_of_month}${[,'st','nd','rd'][((schedule.day_of_month%100>>3)^1)&&schedule.day_of_month%10]||'th'} at 08:00`
            : `${FREQ_LABELS[schedule.frequency]} · Every ${dayLabel(schedule.day_of_week)} at 08:00`;

    return (
        <div className={`rounded-lg border p-3 text-xs transition-colors ${
            schedule.is_active
                ? 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/40'
                : 'border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/20 opacity-60'
        }`}>
            <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                    <p className="font-semibold text-slate-800 dark:text-slate-100 truncate">
                        {schedule.project?.name ?? '—'}
                    </p>
                    <p className="text-slate-500 dark:text-slate-400 mt-0.5">{description}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                    {!isCustom && (
                        <button onClick={onToggle} disabled={toggling} title={schedule.is_active ? 'Pause' : 'Resume'}
                            className={`p-1.5 rounded-md transition-colors ${schedule.is_active
                                ? 'text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20'
                                : 'text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20'}`}>
                            {toggling ? <Loader2 className="size-3.5 animate-spin" />
                                : schedule.is_active ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
                        </button>
                    )}
                    <button onClick={onEdit} title="Edit"
                        className="p-1.5 rounded-md text-slate-400 hover:text-primary hover:bg-primary/5 transition-colors">
                        <Pencil className="size-3.5" />
                    </button>
                    <button onClick={onDelete} title="Delete"
                        className="p-1.5 rounded-md text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                        <Trash2 className="size-3.5" />
                    </button>
                </div>
            </div>

            {/* Status + next run */}
            <div className="mt-2 flex items-center gap-2 flex-wrap">
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                    schedule.is_active
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                        : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                }`}>
                    <span className={`size-1.5 rounded-full ${schedule.is_active ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                    {isCustom ? 'One-time' : schedule.is_active ? 'Active' : 'Paused'}
                </span>
            </div>

            {schedule.is_active && schedule.next_run_at && (
                <p className="mt-1.5 text-slate-400 dark:text-slate-500">
                    Next: {formatDate(schedule.next_run_at)}
                </p>
            )}
            {schedule.last_run_at && (
                <p className="mt-0.5 text-slate-400 dark:text-slate-500">
                    Last sent: {formatDate(schedule.last_run_at)}
                </p>
            )}

            {/* Inline delete confirm */}
            {confirmingDelete && (
                <div className="mt-2 pt-2 border-t border-red-100 dark:border-red-900/30 flex items-center gap-2">
                    <p className="flex-1 text-red-500 text-[11px]">Delete this schedule?</p>
                    <button onClick={onCancelDelete}
                        className="px-2 py-1 rounded text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 text-[11px]">
                        Cancel
                    </button>
                    <button onClick={onConfirmDelete} disabled={deleting}
                        className="px-2 py-1 rounded bg-red-500 text-white hover:bg-red-600 text-[11px] disabled:opacity-50">
                        {deleting ? '…' : 'Delete'}
                    </button>
                </div>
            )}
        </div>
    );
}
