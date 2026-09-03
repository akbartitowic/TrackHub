import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { fetchAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { hasPermission } from '../utils/permissions';
import {
    ArrowLeft, Star, Settings2, Plus, Trash2, Check, X,
    Loader2, ChevronDown, ChevronRight,
    Info, Pencil, Calendar, Hash, UserCheck, ShieldCheck,
    Zap, Percent, AlarmClock, GitBranch, ListChecks, KanbanSquare,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

const METHODOLOGY_LABELS = {
    'Agile Scrum': { color: 'text-blue-600', bg: 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800' },
    'Waterfall':   { color: 'text-violet-600', bg: 'bg-violet-50 border-violet-200 dark:bg-violet-900/20 dark:border-violet-800' },
};

const TRIGGER_TYPES = {
    mh_percentage:         { label: '% Man-Hours',       icon: Percent,    desc: 'Aktif saat persentase MH tertentu tercapai' },
    task_done_percentage:  { label: '% Task Selesai',    icon: GitBranch,  desc: 'Aktif saat persentase task berstatus Done tercapai' },
    project_percentage:    { label: '% Progres Project', icon: GitBranch,  desc: 'Aktif saat progres project mencapai persentase tertentu' },
    date_based:            { label: 'Tanggal / Milestone', icon: AlarmClock, desc: 'Aktif berdasarkan tanggal atau milestone project' },
};

const TRIGGER_BASIS = {
    total_mh:  'Total MH Kontrak',
    topup_mh:  'MH Top-Up',
};

function buildTriggerLabel(triggerType, triggerValue, triggerBasis) {
    if (triggerType === 'mh_percentage') {
        const basis = TRIGGER_BASIS[triggerBasis] ?? 'MH';
        return `Saat ${triggerValue ?? '?'}% ${basis} Terpakai`;
    }
    if (triggerType === 'task_done_percentage') {
        return `Saat ${triggerValue ?? '?'}% Task Berstatus Done`;
    }
    if (triggerType === 'project_percentage') {
        return `Saat Progres Project ${triggerValue ?? '?'}%`;
    }
    return 'Berdasarkan Tanggal / Milestone';
}

/* ── Trigger type badge ── */
function TriggerBadge({ triggerType, triggerValue, triggerBasis }) {
    const meta = TRIGGER_TYPES[triggerType];
    if (!meta) return null;
    const Icon = meta.icon;
    const label = triggerType === 'mh_percentage'
        ? `${triggerValue ?? '?'}% ${TRIGGER_BASIS[triggerBasis] ?? 'MH'}`
        : triggerType === 'task_done_percentage'
            ? `${triggerValue ?? '?'}% task done`
            : triggerType === 'project_percentage'
                ? `${triggerValue ?? '?'}% progres`
                : 'Tanggal / Milestone';
    return (
        <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
            <Icon className="size-2.5" />
            {label}
        </span>
    );
}

/* ── Create Evaluation Form ── */
function CreateEvaluationForm({ onCreated, onCancel }) {
    const [methodology,   setMethodology]   = useState('Agile Scrum');
    const [name,          setName]          = useState('');
    const [triggerType,   setTriggerType]   = useState('mh_percentage');
    const [triggerBasis,  setTriggerBasis]  = useState('total_mh');
    const [triggerValue,  setTriggerValue]  = useState('');
    const [focus,         setFocus]         = useState('');
    const [purpose,       setPurpose]       = useState('');
    const [saving,        setSaving]        = useState(false);

    // When methodology changes, reset trigger type to sensible default
    const handleMethodologyChange = (m) => {
        setMethodology(m);
        setTriggerType(m === 'Agile Scrum' ? 'mh_percentage' : 'task_done_percentage');
        setTriggerValue('');
    };

    const needsValue = ['mh_percentage', 'task_done_percentage', 'project_percentage'].includes(triggerType);
    const valid = name.trim() &&
        (!needsValue || (triggerValue !== '' && Number(triggerValue) >= 1 && Number(triggerValue) <= 100)) &&
        (triggerType !== 'mh_percentage' || triggerBasis) &&
        focus.trim() && purpose.trim();

    const handleSave = async () => {
        setSaving(true);
        try {
            const label = buildTriggerLabel(triggerType, needsValue ? triggerValue : null, triggerBasis);
            const payload = {
                methodology,
                name:          name.trim(),
                trigger_type:  triggerType,
                trigger_basis: triggerType === 'mh_percentage' ? triggerBasis : null,
                trigger_value: needsValue ? Number(triggerValue) : null,
                trigger_label: label,
                focus:         focus.trim(),
                purpose:       purpose.trim(),
            };
            const res = await fetchAPI('/review/evaluations', { method: 'POST', body: JSON.stringify(payload) });
            onCreated(res.data);
        } catch (e) { alert('Gagal membuat siklus: ' + e.message); }
        finally { setSaving(false); }
    };

    const methodStyle = METHODOLOGY_LABELS[methodology] ?? {};

    return (
        <div className="rounded-xl border-2 border-primary/30 bg-primary/[0.02] dark:bg-primary/[0.04] p-5 space-y-4">
            <p className="text-sm font-semibold text-slate-800 dark:text-white flex items-center gap-2">
                <Zap className="size-4 text-primary" /> Buat Siklus Evaluasi Baru
            </p>

            {/* Methodology */}
            <div className="space-y-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Metodologi</label>
                <div className="flex gap-2">
                    {['Agile Scrum', 'Waterfall'].map(m => (
                        <button
                            key={m}
                            type="button"
                            onClick={() => handleMethodologyChange(m)}
                            className={cn(
                                'flex-1 py-2 rounded-lg border text-sm font-medium transition-all',
                                methodology === m
                                    ? cn('border-2', METHODOLOGY_LABELS[m]?.bg, METHODOLOGY_LABELS[m]?.color)
                                    : 'border-slate-200 dark:border-slate-700 text-slate-500 hover:border-slate-300',
                            )}
                        >
                            {m}
                        </button>
                    ))}
                </div>
            </div>

            {/* Name */}
            <div className="space-y-1">
                <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    Nama Siklus <span className="text-rose-400">*</span>
                </label>
                <Input value={name} onChange={e => setName(e.target.value)} placeholder="mis. Evaluasi Mid-Sprint, Evaluasi Akhir Fase 1…" className="h-9 text-sm" />
            </div>

            {/* Trigger config */}
            <div className="space-y-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 flex items-center gap-1.5">
                    <Zap className="size-3.5" /> Kapan Form Aktif (Trigger)
                </p>

                {/* Trigger type — only Waterfall can switch type */}
                {methodology === 'Waterfall' && (
                    <div className="space-y-1.5">
                        <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Jenis Trigger</label>
                        <div className="grid grid-cols-3 gap-2">
                            {Object.entries(TRIGGER_TYPES)
                                .filter(([k]) => k !== 'mh_percentage' && k !== 'project_percentage')
                                .map(([k, meta]) => {
                                    const Icon = meta.icon;
                                    return (
                                        <button
                                            key={k}
                                            type="button"
                                            onClick={() => { setTriggerType(k); setTriggerValue(''); }}
                                            className={cn(
                                                'flex flex-col items-center gap-1.5 p-2.5 rounded-lg border text-xs transition-all',
                                                triggerType === k
                                                    ? 'border-primary bg-primary/10 text-primary font-semibold'
                                                    : 'border-slate-200 dark:border-slate-700 text-slate-500 hover:border-primary/30',
                                            )}
                                        >
                                            <Icon className="size-4" />
                                            {meta.label}
                                        </button>
                                    );
                                })}
                        </div>
                    </div>
                )}

                {/* Agile: always mh_percentage — show badge */}
                {methodology === 'Agile Scrum' && (
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                        <Percent className="size-3.5 text-blue-500" />
                        <span>Agile menggunakan trigger berdasarkan persentase <strong>Man-Hours</strong></span>
                    </div>
                )}

                {/* trigger_value — for percentage types */}
                {needsValue && (
                    <div className="space-y-1">
                        <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                            Persentase (%) <span className="text-rose-400">*</span>
                        </label>
                        <div className="flex items-center gap-2">
                            <Input
                                type="number" min={1} max={100}
                                value={triggerValue}
                                onChange={e => setTriggerValue(e.target.value)}
                                placeholder="1–100"
                                className="h-8 text-sm w-28"
                            />
                            <span className="text-xs text-slate-400">%</span>
                        </div>
                    </div>
                )}

                {/* trigger_basis — only for mh_percentage (Agile) */}
                {triggerType === 'mh_percentage' && (
                    <div className="space-y-1.5">
                        <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                            Basis MH <span className="text-rose-400">*</span>
                        </label>
                        <div className="flex gap-2">
                            {Object.entries(TRIGGER_BASIS).map(([k, label]) => (
                                <button
                                    key={k}
                                    type="button"
                                    onClick={() => setTriggerBasis(k)}
                                    className={cn(
                                        'flex-1 py-2 px-3 rounded-lg border text-xs font-medium transition-all',
                                        triggerBasis === k
                                            ? 'border-primary bg-primary/10 text-primary'
                                            : 'border-slate-200 dark:border-slate-700 text-slate-500 hover:border-primary/30',
                                    )}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                        <p className="text-[11px] text-slate-400">
                            {triggerBasis === 'total_mh'
                                ? 'Trigger dihitung dari total Man-Hours yang sudah disepakati dalam kontrak.'
                                : 'Trigger dihitung dari Man-Hours tambahan (top-up) di luar kontrak awal.'}
                        </p>
                    </div>
                )}

                {/* date_based: just info */}
                {triggerType === 'date_based' && (
                    <p className="text-[11px] text-slate-400 flex items-start gap-1.5">
                        <Info className="size-3.5 shrink-0 mt-0.5" />
                        Trigger berbasis tanggal/milestone akan diaktifkan secara manual oleh admin pada saat yang tepat.
                    </p>
                )}

                {/* Preview label */}
                {(needsValue ? triggerValue !== '' : true) && (
                    <div className="flex items-center gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
                        <span className="text-[11px] text-slate-400">Label:</span>
                        <span className="text-[11px] font-medium text-slate-600 dark:text-slate-300 italic">
                            {buildTriggerLabel(triggerType, triggerValue || null, triggerBasis)}
                        </span>
                    </div>
                )}
            </div>

            {/* Focus + Purpose */}
            <div className="grid sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                    <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                        Fokus Kinerja <span className="text-rose-400">*</span>
                    </label>
                    <textarea value={focus} onChange={e => setFocus(e.target.value)} rows={2} placeholder="Apa yang dievaluasi…" className="w-full text-sm rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-primary" />
                </div>
                <div className="space-y-1">
                    <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                        Tujuan <span className="text-rose-400">*</span>
                    </label>
                    <textarea value={purpose} onChange={e => setPurpose(e.target.value)} rows={2} placeholder="Tujuan dari evaluasi ini…" className="w-full text-sm rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-primary" />
                </div>
            </div>

            <div className="flex gap-2 pt-1">
                <Button size="sm" className="h-8 gap-1.5" onClick={handleSave} disabled={!valid || saving}>
                    {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
                    Buat Siklus
                </Button>
                <Button size="sm" variant="ghost" className="h-8" onClick={onCancel} disabled={saving}>Batal</Button>
            </div>
        </div>
    );
}

/* ── Score bar visual ── */
function ScoreBar({ score, maxScore = 10 }) {
    return (
        <div className="flex items-center gap-1">
            {Array.from({ length: maxScore }).map((_, i) => (
                <div key={i} className={cn(
                    'h-1.5 flex-1 rounded-full',
                    i < score ? 'bg-primary' : 'bg-slate-200 dark:bg-slate-700',
                )} />
            ))}
        </div>
    );
}

/* ── Add / Edit question form ── */
function QuestionForm({ initial, onSave, onCancel, saving, maxWeight }) {
    const [question,    setQuestion]    = useState(initial?.question    ?? '');
    const [description, setDescription] = useState(initial?.description ?? '');
    const [weight,      setWeight]      = useState(initial?.weight      ?? '');
    const [hasWeight,   setHasWeight]   = useState(initial ? initial.has_weight !== false : true);

    const limit = maxWeight ?? 100;
    const weightNum = weight !== '' ? Number(weight) : null;
    const overLimit = hasWeight && weightNum !== null && weightNum > limit;
    const valid = hasWeight
        ? question.trim() && weightNum !== null && weightNum >= 0 && !overLimit
        : question.trim() && description.trim();

    return (
        <div className="rounded-lg border border-primary/30 bg-primary/[0.02] dark:bg-primary/[0.04] p-4 space-y-3">
            <div className="space-y-1">
                <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    Pertanyaan <span className="text-rose-400">*</span>
                </label>
                <Input
                    autoFocus
                    value={question}
                    onChange={e => setQuestion(e.target.value)}
                    placeholder="Masukkan pertanyaan evaluasi…"
                    className="text-sm h-9"
                />
            </div>

            <div className="space-y-1">
                <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Tipe Pertanyaan</label>
                <div className="flex gap-2">
                    <button
                        type="button"
                        onClick={() => setHasWeight(true)}
                        className={cn(
                            'flex-1 rounded-md border px-3 py-2 text-xs font-medium text-left transition-colors',
                            hasWeight
                                ? 'border-primary bg-primary/10 text-primary'
                                : 'border-slate-200 dark:border-slate-700 text-slate-500 hover:border-primary/40',
                        )}
                    >
                        Dinilai dengan bobot
                        <p className="text-[10px] font-normal text-slate-400 mt-0.5">Diberi skor 1–10, punya bobot % ke total skor</p>
                    </button>
                    <button
                        type="button"
                        onClick={() => setHasWeight(false)}
                        className={cn(
                            'flex-1 rounded-md border px-3 py-2 text-xs font-medium text-left transition-colors',
                            !hasWeight
                                ? 'border-primary bg-primary/10 text-primary'
                                : 'border-slate-200 dark:border-slate-700 text-slate-500 hover:border-primary/40',
                        )}
                    >
                        Tanpa bobot
                        <p className="text-[10px] font-normal text-slate-400 mt-0.5">Cuma informasi/deskripsi, tidak dinilai skor</p>
                    </button>
                </div>
            </div>

            <div className="space-y-1">
                <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    {hasWeight ? 'Deskripsi / Panduan (opsional)' : 'Deskripsi'}
                    {!hasWeight && <span className="text-rose-400"> *</span>}
                </label>
                <textarea
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder={hasWeight
                        ? 'Panduan singkat untuk penilai dalam menjawab pertanyaan ini…'
                        : 'Isi informasi/keterangan yang ingin ditampilkan ke penilai…'}
                    rows={2}
                    className="w-full text-sm rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-primary"
                />
            </div>

            {hasWeight && (
                <div className="space-y-1">
                    <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                        Bobot (%) <span className="text-rose-400">*</span>
                    </label>
                    <div className="flex items-center gap-2">
                        <Input
                            type="number"
                            min={0}
                            max={limit}
                            step={0.01}
                            value={weight}
                            onChange={e => setWeight(e.target.value)}
                            placeholder={`0–${limit}`}
                            className={cn('text-sm h-9 w-32', overLimit && 'border-rose-400 focus-visible:ring-rose-400')}
                        />
                        <span className="text-xs text-slate-400">
                            % · sisa {limit.toFixed(2).replace(/\.?0+$/, '')}%
                        </span>
                    </div>
                    {overLimit && (
                        <p className="text-xs text-rose-500">
                            Melebihi sisa bobot ({limit.toFixed(2).replace(/\.?0+$/, '')}%). Kurangi bobot pertanyaan lain terlebih dahulu.
                        </p>
                    )}
                </div>
            )}

            <div className="flex items-center gap-2 pt-1">
                <Button
                    size="sm"
                    className="h-8 gap-1.5"
                    onClick={() => onSave({
                        question: question.trim(),
                        description: description.trim() || null,
                        has_weight: hasWeight,
                        weight: hasWeight ? Number(weight) : 0,
                    })}
                    disabled={!valid || saving}
                >
                    {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
                    {initial ? 'Simpan' : 'Tambah Pertanyaan'}
                </Button>
                <Button size="sm" variant="ghost" className="h-8" onClick={onCancel} disabled={saving}>Batal</Button>
            </div>
        </div>
    );
}

/* ── Single question row ── */
function QuestionRow({ question, index, canConfig, onEdit, onDelete }) {
    const [confirmDel, setConfirmDel] = useState(false);
    const [deleting,   setDeleting]   = useState(false);

    const handleDelete = async () => {
        setDeleting(true);
        try {
            await fetchAPI(`/review/questions/${question.id}`, { method: 'DELETE' });
            onDelete(question.id);
        } catch (e) { alert('Gagal menghapus: ' + e.message); }
        finally { setDeleting(false); setConfirmDel(false); }
    };

    return (
        <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 p-3.5 space-y-2">
            <div className="flex items-start gap-3">
                <span className="size-6 rounded-full bg-primary/10 text-primary text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                    {index + 1}
                </span>
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 dark:text-white leading-snug">
                        {question.question}
                    </p>
                    {question.description && (
                        <p className="text-xs text-slate-400 mt-1 flex gap-1.5">
                            <Info className="size-3 shrink-0 mt-0.5" />
                            {question.description}
                        </p>
                    )}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                    {question.has_weight === false ? (
                        <span className="text-[11px] font-semibold text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
                            Tanpa bobot
                        </span>
                    ) : (
                        <span className="text-[11px] font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                            {question.weight}%
                        </span>
                    )}
                    {canConfig && (
                        <>
                            <button onClick={() => onEdit(question)} className="text-slate-400 hover:text-primary transition-colors p-0.5">
                                <Pencil className="size-3.5" />
                            </button>
                            <button onClick={() => setConfirmDel(true)} className="text-slate-400 hover:text-rose-500 transition-colors p-0.5">
                                <Trash2 className="size-3.5" />
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Skor 1-10 visual */}
            {question.has_weight !== false && (
                <div className="pl-9 flex items-center gap-2">
                    <span className="text-[10px] text-slate-400">Skor 1–10</span>
                    <ScoreBar score={6} />
                </div>
            )}

            {/* Confirm delete */}
            {confirmDel && (
                <div className="pl-9 flex items-center gap-2 pt-1 border-t border-slate-100 dark:border-slate-800 mt-2">
                    <span className="text-xs text-slate-500">Hapus pertanyaan ini?</span>
                    <Button size="sm" variant="destructive" className="h-6 text-xs px-2 gap-1" onClick={handleDelete} disabled={deleting}>
                        {deleting ? <Loader2 className="size-3 animate-spin" /> : null} Ya
                    </Button>
                    <Button size="sm" variant="ghost" className="h-6 text-xs px-2" onClick={() => setConfirmDel(false)}>Batal</Button>
                </div>
            )}
        </div>
    );
}

/* ── Evaluation block ── */
function EvaluationBlock({ evaluation, canConfig, onDeleted }) {
    // Collapsed by default — with several cycles already configured, auto-expanding
    // every card (rules + meta + every question) at once made the page feel dense
    // the moment it opened. The header row alone (name, trigger, weight%, toggle)
    // is enough to scan; details load on click.
    const [expanded,      setExpanded]      = useState(false);
    const [confirmDel,    setConfirmDel]    = useState(false);
    const [deleting,      setDeleting]      = useState(false);
    const [isActive,      setIsActive]      = useState(evaluation.is_active ?? true);
    const [togglingActive, setTogglingActive] = useState(false);
    const [questions,     setQuestions]     = useState(evaluation.questions ?? []);
    const [showAdd,       setShowAdd]       = useState(false);
    const [editingQ,      setEditingQ]      = useState(null);
    const [savingQ,       setSavingQ]       = useState(false);
    const [editingMeta,   setEditingMeta]   = useState(false);
    const [metaInput,     setMetaInput]     = useState({ name: evaluation.name, trigger_label: evaluation.trigger_label, focus: evaluation.focus, purpose: evaluation.purpose, trigger_value: evaluation.trigger_value ?? '', trigger_basis: evaluation.trigger_basis ?? 'total_mh' });
    const [savingMeta,    setSavingMeta]    = useState(false);
    const [meta,          setMeta]          = useState({ name: evaluation.name, trigger_label: evaluation.trigger_label, focus: evaluation.focus, purpose: evaluation.purpose });
    const [triggerConfig, setTriggerConfig] = useState({ trigger_value: evaluation.trigger_value, trigger_basis: evaluation.trigger_basis });
    const [editingRules,  setEditingRules]  = useState(false);
    const [rulesInput,    setRulesInput]    = useState({ active_days: evaluation.active_days ?? '', max_submissions: evaluation.max_submissions ?? '', one_per_user: evaluation.one_per_user ?? false });
    const [savingRules,   setSavingRules]   = useState(false);
    const [rules,         setRules]         = useState({ active_days: evaluation.active_days, max_submissions: evaluation.max_submissions, one_per_user: evaluation.one_per_user ?? false });

    const totalWeight = questions.reduce((s, q) => s + Number(q.weight), 0);
    const needsTriggerValue = ['mh_percentage', 'task_done_percentage', 'project_percentage'].includes(evaluation.trigger_type);
    const validMeta = metaInput.name.trim() && metaInput.trigger_label.trim() &&
        (metaInput.focus ?? '').trim() && (metaInput.purpose ?? '').trim() &&
        (!needsTriggerValue || (metaInput.trigger_value !== '' && Number(metaInput.trigger_value) >= 1 && Number(metaInput.trigger_value) <= 100));

    const handleDelete = async () => {
        setDeleting(true);
        try {
            await fetchAPI(`/review/evaluations/${evaluation.id}`, { method: 'DELETE' });
            onDeleted(evaluation.id);
        } catch (e) { alert('Gagal menghapus: ' + e.message); }
        finally { setDeleting(false); setConfirmDel(false); }
    };

    const handleToggleActive = async () => {
        setTogglingActive(true);
        try {
            await fetchAPI(`/review/evaluations/${evaluation.id}`, {
                method: 'PUT',
                body: JSON.stringify({ is_active: !isActive }),
            });
            setIsActive(v => !v);
        } catch (e) { alert('Gagal: ' + e.message); }
        finally { setTogglingActive(false); }
    };

    const handleAddQuestion = async (payload) => {
        setSavingQ(true);
        try {
            const res = await fetchAPI(`/review/evaluations/${evaluation.id}/questions`, { method: 'POST', body: JSON.stringify(payload) });
            setQuestions(prev => [...prev, res.data]);
            setShowAdd(false);
        } catch (e) { alert('Gagal: ' + e.message); }
        finally { setSavingQ(false); }
    };

    const handleEditQuestion = async (payload) => {
        setSavingQ(true);
        try {
            const res = await fetchAPI(`/review/questions/${editingQ.id}`, { method: 'PUT', body: JSON.stringify(payload) });
            setQuestions(prev => prev.map(q => q.id === res.data.id ? res.data : q));
            setEditingQ(null);
        } catch (e) { alert('Gagal: ' + e.message); }
        finally { setSavingQ(false); }
    };

    const handleDeleteQuestion = (id) => setQuestions(prev => prev.filter(q => q.id !== id));

    const handleSaveMeta = async () => {
        setSavingMeta(true);
        try {
            const payload = {
                name:           metaInput.name,
                trigger_label:  metaInput.trigger_label,
                focus:          metaInput.focus,
                purpose:        metaInput.purpose,
                trigger_value:  needsTriggerValue ? Number(metaInput.trigger_value) : null,
                trigger_basis:  evaluation.trigger_type === 'mh_percentage' ? metaInput.trigger_basis : null,
            };
            const res = await fetchAPI(`/review/evaluations/${evaluation.id}`, { method: 'PUT', body: JSON.stringify(payload) });
            setMeta({ name: res.data.name, trigger_label: res.data.trigger_label, focus: res.data.focus, purpose: res.data.purpose });
            setTriggerConfig({ trigger_value: res.data.trigger_value, trigger_basis: res.data.trigger_basis });
            setEditingMeta(false);
        } catch (e) { alert('Gagal: ' + e.message); }
        finally { setSavingMeta(false); }
    };

    const handleSaveRules = async () => {
        setSavingRules(true);
        try {
            const payload = {
                active_days:     rulesInput.active_days     !== '' ? Number(rulesInput.active_days)     : null,
                max_submissions: rulesInput.max_submissions !== '' ? Number(rulesInput.max_submissions) : null,
                one_per_user:    rulesInput.one_per_user,
            };
            const res = await fetchAPI(`/review/evaluations/${evaluation.id}`, { method: 'PUT', body: JSON.stringify(payload) });
            setRules({ active_days: res.data.active_days, max_submissions: res.data.max_submissions, one_per_user: res.data.one_per_user });
            setEditingRules(false);
        } catch (e) { alert('Gagal: ' + e.message); }
        finally { setSavingRules(false); }
    };

    return (
        <div className={cn(
            'rounded-xl border overflow-hidden shadow-sm dark:shadow-xl transition-opacity',
            isActive
                ? 'border-white/60 dark:border-white/10'
                : 'border-white/60 dark:border-white/10 opacity-60',
        )}>
            {/* Header */}
            <div
                className="flex items-center gap-3 px-4 py-3.5 bg-white/70 backdrop-blur-xl dark:bg-[#151b28] cursor-pointer hover:bg-white/90 dark:hover:bg-white/5 transition-colors select-none"
                onClick={() => setExpanded(v => !v)}
            >
                <div className={cn(
                    'size-9 rounded-lg flex items-center justify-center shrink-0',
                    isActive ? 'bg-primary/10 text-primary' : 'bg-slate-100 dark:bg-slate-800 text-slate-400',
                )}>
                    <Star className="size-4" />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">{meta.name}</p>
                        {!isActive && (
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                                Nonaktif
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                        <p className="text-[10px] text-slate-400">{meta.trigger_label}</p>
                        <TriggerBadge
                            triggerType={evaluation.trigger_type}
                            triggerValue={triggerConfig.trigger_value}
                            triggerBasis={triggerConfig.trigger_basis}
                        />
                    </div>
                </div>
                <span className={cn(
                    'text-[10px] font-medium px-1.5 py-0.5 rounded-full shrink-0',
                    Math.abs(totalWeight - 100) < 0.1
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-amber-50 text-amber-700',
                )}>
                    {totalWeight.toFixed(1)}%
                </span>
                {canConfig && (
                    <>
                        {/* Active toggle */}
                        <button
                            type="button"
                            onClick={e => { e.stopPropagation(); handleToggleActive(); }}
                            disabled={togglingActive}
                            className={cn(
                                'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors',
                                isActive ? 'bg-primary' : 'bg-slate-200 dark:bg-slate-700',
                                togglingActive && 'opacity-50 cursor-wait',
                            )}
                            title={isActive ? 'Nonaktifkan evaluasi' : 'Aktifkan evaluasi'}
                        >
                            <span className={cn(
                                'pointer-events-none inline-block size-4 rounded-full bg-white shadow-sm transition-transform',
                                isActive ? 'translate-x-4' : 'translate-x-0',
                            )} />
                        </button>
                        <button
                            onClick={e => { e.stopPropagation(); setConfirmDel(true); }}
                            className="text-slate-300 hover:text-rose-500 transition-colors p-1 shrink-0"
                            title="Hapus siklus"
                        >
                            <Trash2 className="size-3.5" />
                        </button>
                    </>
                )}
                {expanded ? <ChevronDown className="size-4 text-slate-400 shrink-0" /> : <ChevronRight className="size-4 text-slate-400 shrink-0" />}
            </div>

            {/* Delete confirmation */}
            {confirmDel && (
                <div className="px-4 py-3 bg-rose-50 dark:bg-rose-900/20 border-t border-rose-100 dark:border-rose-800 flex items-center gap-3">
                    <Trash2 className="size-4 text-rose-500 shrink-0" />
                    <span className="text-xs text-rose-700 dark:text-rose-300 flex-1">
                        Hapus siklus "<strong>{meta.name}</strong>" beserta semua pertanyaannya?
                    </span>
                    <Button size="sm" variant="destructive" className="h-7 text-xs px-3 gap-1" onClick={handleDelete} disabled={deleting}>
                        {deleting ? <Loader2 className="size-3 animate-spin" /> : null} Ya, Hapus
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setConfirmDel(false)}>Batal</Button>
                </div>
            )}

            {/* Expanded body */}
            {expanded && (
                <div className="border-t border-white/50 dark:border-white/10 bg-white/50 dark:bg-white/5 px-4 py-5 space-y-4">

                    {/* Meta info + edit */}
                    {editingMeta ? (
                        <div className="space-y-3 bg-white dark:bg-slate-800 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                            <div className="grid sm:grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Nama Evaluasi</label>
                                    <Input value={metaInput.name} onChange={e => setMetaInput(p => ({ ...p, name: e.target.value }))} className="h-8 text-sm" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Trigger / Waktu</label>
                                    <Input value={metaInput.trigger_label} onChange={e => setMetaInput(p => ({ ...p, trigger_label: e.target.value }))} className="h-8 text-sm" />
                                </div>
                            </div>

                            {needsTriggerValue && (
                                <div className="grid sm:grid-cols-2 gap-3 rounded-lg border border-slate-200 dark:border-slate-700 p-3">
                                    <div className="space-y-1">
                                        <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                                            Persentase (%) <span className="text-rose-400">*</span>
                                        </label>
                                        <div className="flex items-center gap-2">
                                            <Input
                                                type="number" min={1} max={100}
                                                value={metaInput.trigger_value}
                                                onChange={e => {
                                                    const val = e.target.value;
                                                    setMetaInput(p => ({ ...p, trigger_value: val, trigger_label: buildTriggerLabel(evaluation.trigger_type, val || null, p.trigger_basis) }));
                                                }}
                                                placeholder="1–100"
                                                className="h-8 text-sm w-28"
                                            />
                                            <span className="text-xs text-slate-400">%</span>
                                        </div>
                                    </div>
                                    {evaluation.trigger_type === 'mh_percentage' && (
                                        <div className="space-y-1">
                                            <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Basis MH</label>
                                            <div className="flex gap-2">
                                                {Object.entries(TRIGGER_BASIS).map(([k, label]) => (
                                                    <button
                                                        key={k}
                                                        type="button"
                                                        onClick={() => setMetaInput(p => ({ ...p, trigger_basis: k, trigger_label: buildTriggerLabel(evaluation.trigger_type, p.trigger_value || null, k) }))}
                                                        className={cn(
                                                            'flex-1 py-1.5 px-2 rounded-md border text-xs font-medium transition-all',
                                                            metaInput.trigger_basis === k
                                                                ? 'border-primary bg-primary/10 text-primary'
                                                                : 'border-slate-200 dark:border-slate-700 text-slate-500 hover:border-primary/30',
                                                        )}
                                                    >
                                                        {label}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="space-y-1">
                                <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                                    Fokus Kinerja <span className="text-rose-400">*</span>
                                </label>
                                <textarea value={metaInput.focus} onChange={e => setMetaInput(p => ({ ...p, focus: e.target.value }))} rows={2} className="w-full text-sm rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-primary" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                                    Tujuan <span className="text-rose-400">*</span>
                                </label>
                                <textarea value={metaInput.purpose} onChange={e => setMetaInput(p => ({ ...p, purpose: e.target.value }))} rows={2} className="w-full text-sm rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-primary" />
                            </div>
                            <div className="flex gap-2">
                                <Button size="sm" className="h-8 gap-1.5" onClick={handleSaveMeta} disabled={savingMeta || !validMeta}>
                                    {savingMeta ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />} Simpan
                                </Button>
                                <Button size="sm" variant="ghost" className="h-8" onClick={() => { setEditingMeta(false); setMetaInput({ name: meta.name, trigger_label: meta.trigger_label, focus: meta.focus, purpose: meta.purpose, trigger_value: triggerConfig.trigger_value ?? '', trigger_basis: triggerConfig.trigger_basis ?? 'total_mh' }); }}>Batal</Button>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 p-3.5 space-y-2">
                            <div className="flex items-start justify-between gap-2">
                                <div className="space-y-1.5 flex-1">
                                    <div>
                                        <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Fokus Kinerja</span>
                                        <p className="text-sm text-slate-700 dark:text-slate-300 mt-0.5">{meta.focus}</p>
                                    </div>
                                    <div>
                                        <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Tujuan</span>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{meta.purpose}</p>
                                    </div>
                                </div>
                                {canConfig && (
                                    <button onClick={(e) => { e.stopPropagation(); setEditingMeta(true); }} className="text-slate-400 hover:text-primary transition-colors p-1 shrink-0">
                                        <Pencil className="size-3.5" />
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                    {/* ── Aturan Pengisian ── */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 flex items-center gap-1.5">
                                <ShieldCheck className="size-3.5" /> Aturan Pengisian
                            </span>
                            {canConfig && !editingRules && (
                                <button onClick={() => setEditingRules(true)} className="text-slate-400 hover:text-primary transition-colors p-1">
                                    <Pencil className="size-3.5" />
                                </button>
                            )}
                        </div>

                        {editingRules ? (
                            <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 p-4 space-y-4">
                                {/* active_days */}
                                <div className="flex items-start gap-3">
                                    <Calendar className="size-4 text-slate-400 mt-2 shrink-0" />
                                    <div className="flex-1 space-y-1">
                                        <label className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                                            Aktif selama berapa hari?
                                        </label>
                                        <p className="text-[11px] text-slate-400">Form hanya bisa diisi dalam X hari setelah trigger terpenuhi. Kosongkan = tidak ada batas waktu.</p>
                                        <div className="flex items-center gap-2">
                                            <Input
                                                type="number" min={1} max={3650}
                                                value={rulesInput.active_days}
                                                onChange={e => setRulesInput(p => ({ ...p, active_days: e.target.value }))}
                                                placeholder="Kosong = tidak terbatas"
                                                className="h-8 text-sm w-52"
                                            />
                                            {rulesInput.active_days !== '' && <span className="text-xs text-slate-400">hari</span>}
                                        </div>
                                    </div>
                                </div>

                                {/* max_submissions */}
                                <div className="flex items-start gap-3">
                                    <Hash className="size-4 text-slate-400 mt-2 shrink-0" />
                                    <div className="flex-1 space-y-1">
                                        <label className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                                            Maksimal total pengisian
                                        </label>
                                        <p className="text-[11px] text-slate-400">Jumlah maksimal submission per evaluasi per project. Kosongkan = tidak terbatas.</p>
                                        <div className="flex items-center gap-2">
                                            <Input
                                                type="number" min={1} max={999}
                                                value={rulesInput.max_submissions}
                                                onChange={e => setRulesInput(p => ({ ...p, max_submissions: e.target.value }))}
                                                placeholder="Kosong = tidak terbatas"
                                                className="h-8 text-sm w-52"
                                            />
                                            {rulesInput.max_submissions !== '' && <span className="text-xs text-slate-400">kali</span>}
                                        </div>
                                    </div>
                                </div>

                                {/* one_per_user */}
                                <div className="flex items-start gap-3">
                                    <UserCheck className="size-4 text-slate-400 mt-0.5 shrink-0" />
                                    <div className="flex-1 space-y-1">
                                        <label className="text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                                            <span>1x per pengguna</span>
                                            <button
                                                type="button"
                                                onClick={() => setRulesInput(p => ({ ...p, one_per_user: !p.one_per_user }))}
                                                className={cn(
                                                    'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors',
                                                    rulesInput.one_per_user ? 'bg-primary' : 'bg-slate-200 dark:bg-slate-700',
                                                )}
                                            >
                                                <span className={cn(
                                                    'pointer-events-none inline-block size-4 rounded-full bg-white shadow-sm transition-transform',
                                                    rulesInput.one_per_user ? 'translate-x-4' : 'translate-x-0',
                                                )} />
                                            </button>
                                        </label>
                                        <p className="text-[11px] text-slate-400">Jika aktif, satu pengguna hanya bisa submit 1x untuk evaluasi ini. Jika nonaktif, bisa submit berkali-kali.</p>
                                    </div>
                                </div>

                                <div className="flex gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
                                    <Button size="sm" className="h-8 gap-1.5" onClick={handleSaveRules} disabled={savingRules}>
                                        {savingRules ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />} Simpan
                                    </Button>
                                    <Button size="sm" variant="ghost" className="h-8" onClick={() => { setEditingRules(false); setRulesInput({ active_days: rules.active_days ?? '', max_submissions: rules.max_submissions ?? '', one_per_user: rules.one_per_user }); }}>
                                        Batal
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-800">
                                <div className="flex items-center gap-3 px-3.5 py-2.5">
                                    <Calendar className="size-3.5 text-slate-400 shrink-0" />
                                    <span className="text-xs text-slate-500 dark:text-slate-400 flex-1">Aktif selama</span>
                                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                                        {rules.active_days != null ? `${rules.active_days} hari` : 'Tidak terbatas'}
                                    </span>
                                </div>
                                <div className="flex items-center gap-3 px-3.5 py-2.5">
                                    <Hash className="size-3.5 text-slate-400 shrink-0" />
                                    <span className="text-xs text-slate-500 dark:text-slate-400 flex-1">Maks. pengisian</span>
                                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                                        {rules.max_submissions != null ? `${rules.max_submissions}×` : 'Tidak terbatas'}
                                    </span>
                                </div>
                                <div className="flex items-center gap-3 px-3.5 py-2.5">
                                    <UserCheck className="size-3.5 text-slate-400 shrink-0" />
                                    <span className="text-xs text-slate-500 dark:text-slate-400 flex-1">1x per pengguna</span>
                                    <span className={cn(
                                        'text-[10px] font-semibold px-1.5 py-0.5 rounded-full',
                                        rules.one_per_user
                                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400'
                                            : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
                                    )}>
                                        {rules.one_per_user ? 'Aktif' : 'Nonaktif'}
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Questions */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                                Pertanyaan ({questions.length})
                                {Math.abs(totalWeight - 100) > 0.1 && (
                                    <span className="ml-2 text-amber-600 normal-case font-normal">
                                        ⚠ Total bobot {totalWeight.toFixed(1)}% (idealnya 100%)
                                    </span>
                                )}
                            </span>
                            {canConfig && !showAdd && !editingQ && (
                                <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setShowAdd(true)}>
                                    <Plus className="size-3" /> Tambah
                                </Button>
                            )}
                        </div>

                        {questions.map((q, idx) => {
                            const otherTotal = questions.filter(x => x.id !== q.id).reduce((s, x) => s + Number(x.weight), 0);
                            return editingQ?.id === q.id ? (
                                <QuestionForm
                                    key={q.id}
                                    initial={q}
                                    onSave={handleEditQuestion}
                                    onCancel={() => setEditingQ(null)}
                                    saving={savingQ}
                                    maxWeight={Math.max(0, 100 - otherTotal)}
                                />
                            ) : (
                                <QuestionRow
                                    key={q.id}
                                    question={q}
                                    index={idx}
                                    canConfig={canConfig}
                                    onEdit={(q) => { setShowAdd(false); setEditingQ(q); }}
                                    onDelete={handleDeleteQuestion}
                                />
                            );
                        })}

                        {showAdd && (
                            <QuestionForm
                                onSave={handleAddQuestion}
                                onCancel={() => setShowAdd(false)}
                                saving={savingQ}
                                maxWeight={Math.max(0, 100 - totalWeight)}
                            />
                        )}

                        {questions.length === 0 && !showAdd && (
                            <p className="text-xs text-slate-400 italic text-center py-4">
                                Belum ada pertanyaan. Tambah pertanyaan pertama.
                            </p>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

/* ── Project eligibility toggle row — "Project" tab ── */
function ProjectEligibilityRow({ project, canConfig, onToggled }) {
    const [enabled, setEnabled] = useState(project.review_enabled !== false);
    const [saving,  setSaving]  = useState(false);

    const handleToggle = async (next) => {
        const prev = enabled;
        setEnabled(next); // optimistic
        setSaving(true);
        try {
            const res = await fetchAPI(`/review/projects/${project.id}/eligibility`, {
                method: 'PATCH',
                body: JSON.stringify({ review_enabled: next }),
            });
            onToggled(project.id, res.data.review_enabled);
        } catch (e) {
            setEnabled(prev);
            alert('Gagal menyimpan: ' + e.message);
        } finally { setSaving(false); }
    };

    const style = METHODOLOGY_LABELS[project.methodology] ?? {};

    return (
        <div className="flex items-center gap-3 px-4 py-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700">
            <div className="size-8 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center shrink-0">
                <KanbanSquare className="size-4" />
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800 dark:text-white truncate">{project.name}</p>
                <div className="flex items-center gap-1.5 mt-1">
                    <span className={cn(
                        'inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded-full border',
                        style.bg ?? 'bg-slate-100 border-slate-200', style.color ?? 'text-slate-500',
                    )}>
                        {project.methodology ?? '—'}
                    </span>
                    <span className="text-[10px] text-slate-400">{project.status}</span>
                </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
                <span className={cn('text-[11px] font-medium', enabled ? 'text-emerald-600' : 'text-slate-400')}>
                    {enabled ? 'Berhak Review' : 'Tidak Berhak'}
                </span>
                {canConfig ? (
                    <Switch checked={enabled} onCheckedChange={handleToggle} disabled={saving} />
                ) : (
                    <span className={cn(
                        'text-[10px] font-semibold px-1.5 py-0.5 rounded-full',
                        enabled ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500',
                    )}>
                        {enabled ? 'Aktif' : 'Nonaktif'}
                    </span>
                )}
            </div>
        </div>
    );
}

/* ── "Project" tab body — list of all projects with a review-eligibility toggle ── */
function ProjectEligibilityTab({ canConfig }) {
    const [projects, setProjects] = useState([]);
    const [loading,  setLoading]  = useState(true);
    const [error,    setError]    = useState(null);
    const [search,   setSearch]   = useState('');

    const load = useCallback(async () => {
        setLoading(true); setError(null);
        try {
            const res = await fetchAPI('/review/projects');
            setProjects(res.data ?? []);
        } catch { setError('Gagal memuat daftar project.'); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { load(); }, [load]);

    const handleToggled = (id, reviewEnabled) => {
        setProjects(prev => prev.map(p => p.id === id ? { ...p, review_enabled: reviewEnabled } : p));
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center gap-2 py-16 text-slate-400 text-sm">
                <Loader2 className="size-5 animate-spin" /> Memuat daftar project…
            </div>
        );
    }
    if (error) {
        return (
            <div className="flex items-center justify-center gap-2 py-16 text-rose-500 text-sm">
                <X className="size-4 shrink-0" /> {error}
                <Button variant="outline" size="sm" className="ml-2 h-7 text-xs" onClick={load}>Coba lagi</Button>
            </div>
        );
    }

    const filtered = projects.filter(p => (p.name ?? '').toLowerCase().includes(search.toLowerCase()));
    const enabledCount = projects.filter(p => p.review_enabled !== false).length;

    return (
        <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                    <strong className="text-slate-700 dark:text-slate-200">{enabledCount}</strong>
                    <span className="text-slate-400">/{projects.length}</span> project berhak menerima review.
                </p>
                <Input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Cari project…"
                    className="h-8 text-xs w-full sm:w-56"
                />
            </div>

            {filtered.length === 0 ? (
                <p className="text-xs text-slate-400 italic text-center py-10">
                    {projects.length === 0 ? 'Belum ada project.' : 'Tidak ada project yang cocok pencarian.'}
                </p>
            ) : (
                <div className="space-y-2">
                    {filtered.map(p => (
                        <ProjectEligibilityRow key={p.id} project={p} canConfig={canConfig} onToggled={handleToggled} />
                    ))}
                </div>
            )}
        </div>
    );
}

/* ── Page ── */
export default function ReviewConfig() {
    const { user }   = useAuth();
    const canConfig  = hasPermission(user, 'review.update');
    const navigate   = useNavigate();

    // Tab — "Siklus Evaluasi" (existing config) vs "Project" (review-eligibility toggle list),
    // synced to the URL (?tab=projects) so it's linkable/bookmarkable.
    const [searchParams, setSearchParams] = useSearchParams();
    const activeTab = searchParams.get('tab') === 'projects' ? 'projects' : 'evaluations';
    const setActiveTab = (t) => setSearchParams(prev => {
        if (t === 'evaluations') prev.delete('tab'); else prev.set('tab', t);
        return prev;
    });

    const [evaluations,  setEvaluations]  = useState([]);
    const [loading,      setLoading]      = useState(true);
    const [error,        setError]        = useState(null);
    const [showCreate,   setShowCreate]   = useState(false);

    const load = useCallback(async () => {
        setLoading(true); setError(null);
        try {
            const res = await fetchAPI('/review/evaluations');
            setEvaluations(res.data ?? []);
        } catch { setError('Gagal memuat konfigurasi review.'); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { load(); }, [load]);

    const handleCreated = (ev) => {
        setEvaluations(prev => [...prev, ev]);
        setShowCreate(false);
    };

    const handleDeleted = (id) => setEvaluations(prev => prev.filter(e => e.id !== id));

    // Group evaluations by methodology, preserve insertion order
    const grouped = evaluations.reduce((acc, ev) => {
        const key = ev.methodology ?? 'Lainnya';
        if (!acc[key]) acc[key] = [];
        acc[key].push(ev);
        return acc;
    }, {});

    return (
        <div className="relative min-h-full overflow-hidden bg-slate-50 dark:bg-[#0B192C]">
            <div className="relative w-full px-4 py-5 sm:px-6 lg:px-8 pb-16 space-y-5">
            {/* Header */}
            <div className="flex items-center gap-3">
                <Button variant="ghost" size="icon" className="size-8 shrink-0" onClick={() => navigate('/review')}>
                    <ArrowLeft className="size-4" />
                </Button>
                <div className="flex-1 min-w-0">
                    <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                        Konfigurasi Review
                    </h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1.5">
                        <Settings2 className="size-3.5" />
                        {canConfig ? 'Kelola siklus evaluasi dan pertanyaan review' : 'Lihat siklus evaluasi dan pertanyaan review'}
                    </p>
                </div>
                {activeTab === 'evaluations' && canConfig && !showCreate && (
                    <Button size="sm" className="gap-1.5 h-8 text-xs shrink-0" onClick={() => setShowCreate(true)}>
                        <Plus className="size-3.5" /> Tambah Siklus
                    </Button>
                )}
            </div>

            {/* Tabs */}
            <div className="inline-flex rounded-xl border border-slate-200 bg-white/70 p-0.5 backdrop-blur-xl dark:border-white/10 dark:bg-[#151b28]">
                <Button
                    type="button" variant="ghost" size="sm"
                    className={cn('h-8 gap-1.5 px-3', activeTab === 'evaluations' && 'bg-accent text-white hover:bg-accent hover:text-white')}
                    onClick={() => setActiveTab('evaluations')}
                >
                    <ListChecks className="size-3.5" /> Siklus Evaluasi
                </Button>
                <Button
                    type="button" variant="ghost" size="sm"
                    className={cn('h-8 gap-1.5 px-3', activeTab === 'projects' && 'bg-accent text-white hover:bg-accent hover:text-white')}
                    onClick={() => setActiveTab('projects')}
                >
                    <KanbanSquare className="size-3.5" /> Project
                </Button>
            </div>

            {/* Content */}
            {activeTab === 'projects' ? (
                <ProjectEligibilityTab canConfig={canConfig} />
            ) : loading ? (
                <div className="flex items-center justify-center gap-2 py-16 text-slate-400 text-sm">
                    <Loader2 className="size-5 animate-spin" /> Memuat konfigurasi…
                </div>
            ) : error ? (
                <div className="flex items-center justify-center gap-2 py-16 text-rose-500 text-sm">
                    <X className="size-4 shrink-0" /> {error}
                    <Button variant="outline" size="sm" className="ml-2 h-7 text-xs" onClick={load}>Coba lagi</Button>
                </div>
            ) : evaluations.length === 0 && !showCreate ? (
                <div className="flex flex-col items-center justify-center py-16 text-slate-400 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
                    <Star className="size-10 mb-2 opacity-20" />
                    <p className="text-sm">Belum ada siklus evaluasi.</p>
                    {canConfig && (
                        <Button size="sm" className="mt-4 gap-1.5 h-8 text-xs" onClick={() => setShowCreate(true)}>
                            <Plus className="size-3.5" /> Buat Siklus Pertama
                        </Button>
                    )}
                </div>
            ) : (
                <div className="space-y-6">
                    {showCreate && (
                        <CreateEvaluationForm
                            onCreated={handleCreated}
                            onCancel={() => setShowCreate(false)}
                        />
                    )}
                    {Object.entries(grouped).map(([methodology, evals]) => {
                        const style = METHODOLOGY_LABELS[methodology] ?? {};
                        return (
                            <div key={methodology} className="space-y-3">
                                <div className="flex items-center gap-2">
                                    <span className={cn(
                                        'inline-flex items-center text-[11px] font-semibold px-2.5 py-1 rounded-full border',
                                        style.bg ?? 'bg-slate-100 border-slate-200',
                                        style.color ?? 'text-slate-600',
                                    )}>
                                        {methodology}
                                    </span>
                                    <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
                                    <span className="text-[11px] text-slate-400">{evals.length} siklus</span>
                                </div>
                                <div className="space-y-4">
                                    {evals.map(ev => (
                                        <EvaluationBlock key={ev.id} evaluation={ev} canConfig={canConfig} onDeleted={handleDeleted} />
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
            </div>
        </div>
    );
}
