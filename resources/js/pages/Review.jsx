import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import PaginationControls from '../components/ui/PaginationControls';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { fetchAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { hasPermission } from '../utils/permissions';
import {
    Star, LayoutGrid, List, Loader2, X, Lock,
    KanbanSquare, ChevronRight, Settings2, Clock,
    Send, ArrowLeft, Info, MessageSquare, Plus, AlertCircle,
    Link as LinkIcon, User, CheckCircle2, ClipboardCheck, Clipboard, MailCheck, MailX,
    LayoutDashboard, Radar as RadarIcon, ChevronDown, EyeOff, RotateCcw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuCheckboxItem } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

const fmtDateWIB = (iso) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('id-ID', {
        day: 'numeric', month: 'short', year: 'numeric',
        timeZone: 'Asia/Jakarta',
    });
};

/* ── Score helpers ── */
const LEVELS = [
    { key: 'good', min: 80,  label: 'Baik',             color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200', dot: 'bg-emerald-500', ring: 'ring-emerald-200' },
    { key: 'fair', min: 60,  label: 'Cukup',            color: 'text-amber-700',   bg: 'bg-amber-50 border-amber-200',     dot: 'bg-amber-500',   ring: 'ring-amber-200'   },
    { key: 'poor', min: 0,   label: 'Perlu Perbaikan',  color: 'text-rose-700',    bg: 'bg-rose-50 border-rose-200',       dot: 'bg-rose-500',    ring: 'ring-rose-200'    },
];

function getLevel(score) {
    if (score == null) return null;
    return LEVELS.find(l => score >= l.min) ?? LEVELS[2];
}

function LevelBadge({ score }) {
    const level = getLevel(score);
    if (!level) return null;
    return (
        <span className={cn('inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border', level.bg, level.color)}>
            <span className={cn('size-1.5 rounded-full', level.dot)} />
            {level.label}
        </span>
    );
}

/* ── Methodology badge ── */
const METHODOLOGY_STYLE = {
    'Agile Scrum': 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800',
    'Waterfall':   'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-900/20 dark:text-violet-400 dark:border-violet-800',
};

const STATUS_STYLE = {
    'In Progress': 'bg-emerald-50 text-emerald-700 border-emerald-200',
    'Planning':    'bg-blue-50 text-blue-600 border-blue-200',
    'Done':        'bg-slate-100 text-slate-500 border-slate-200',
};

/* ── Review result section (shown on card/row) ── */
function ReviewResultBar({ summary, overall, onClick }) {
    const hasSummary     = summary?.length > 0;
    const submittedCount = summary?.filter(s => s.submitted).length ?? 0;
    const totalCount     = summary?.length ?? 0;
    const allDone        = hasSummary && submittedCount === totalCount;
    const pct            = totalCount > 0 ? (submittedCount / totalCount) * 100 : 0;

    const lastReview = hasSummary
        ? summary
            .filter(s => s.submitted && s.submitted_at)
            .sort((a, b) => new Date(b.submitted_at) - new Date(a.submitted_at))[0]
        : null;

    const level = getLevel(overall);

    return (
        <button
            onClick={onClick}
            className="w-full text-left pt-2.5 mt-2.5 border-t border-slate-100 dark:border-slate-800 hover:opacity-80 transition-opacity space-y-1.5"
        >
            <div className="flex items-center justify-between gap-2">
                {overall != null ? (
                    <div className="flex items-center gap-1.5">
                        <span className={cn('text-base font-bold leading-none', level?.color)}>{overall.toFixed(1)}%</span>
                        <LevelBadge score={overall} />
                    </div>
                ) : (
                    <span className="text-[11px] text-slate-400 italic">
                        {hasSummary ? 'Belum ada review' : 'Lihat & isi review'}
                    </span>
                )}
                <ChevronRight className="size-3.5 text-slate-400 shrink-0" />
            </div>

            {hasSummary && (
                <div className="flex items-center gap-1.5">
                    <div className="flex-1 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                        <div
                            className={cn('h-full rounded-full transition-all', allDone ? 'bg-emerald-500' : 'bg-primary')}
                            style={{ width: `${pct}%` }}
                        />
                    </div>
                    <span className="text-[10px] text-slate-400 shrink-0 flex items-center gap-0.5">
                        {allDone && <CheckCircle2 className="size-2.5 text-emerald-500" />}
                        {submittedCount}/{totalCount} eval
                    </span>
                </div>
            )}

            {lastReview && (
                <p className="text-[10px] text-slate-400 flex items-center gap-1 truncate">
                    <User className="size-2.5 shrink-0" />
                    <span className="truncate">{lastReview.submitted_by} · {fmtDateWIB(lastReview.submitted_at)}</span>
                </p>
            )}
        </button>
    );
}

/* ── Score input (1-10) ── */
function ScoreInput({ value, onChange }) {
    return (
        <div className="flex flex-wrap items-center gap-1">
            {Array.from({ length: 10 }, (_, i) => i + 1).map(s => (
                <button
                    key={s}
                    type="button"
                    onClick={() => onChange(s)}
                    className={cn(
                        'flex size-7 items-center justify-center rounded-md border text-xs font-semibold transition-colors',
                        s === value
                            ? 'border-primary bg-primary text-white'
                            : 'border-slate-200 bg-white text-slate-500 hover:border-primary/50 hover:text-primary dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400',
                    )}
                >
                    {s}
                </button>
            ))}
            {value > 0 && (
                <span className="ml-1 text-xs text-slate-500">{value}/10</span>
            )}
        </div>
    );
}

/* ── Submit Review form ── */
function ReviewSubmitForm({ project, evaluation, onSubmitted, onCancel }) {
    const weightedQuestions = (evaluation.questions ?? []).filter(q => q.has_weight !== false);
    const [answers, setAnswers] = useState(() =>
        weightedQuestions.map(q => ({ question_id: q.id, score: 0, comment: '' }))
    );
    const [notes,       setNotes]       = useState('');
    const [saving,      setSaving]      = useState(false);
    const [submitError, setSubmitError] = useState(null);

    const allAnswered = answers.every(a => a.score > 0);

    const setScore   = (qid, score)   => setAnswers(prev => prev.map(a => a.question_id === qid ? { ...a, score } : a));
    const setComment = (qid, comment) => setAnswers(prev => prev.map(a => a.question_id === qid ? { ...a, comment } : a));

    const handleSubmit = async () => {
        if (!allAnswered) return;
        setSaving(true);
        setSubmitError(null);
        try {
            const res = await fetchAPI(`/projects/${project.id}/evaluations/${evaluation.id}/reviews`, {
                method: 'POST',
                body: JSON.stringify({ answers, notes }),
            });
            onSubmitted(res.data);
        } catch (e) { setSubmitError(e.message); }
        finally { setSaving(false); }
    };

    return (
        <div className="space-y-4">
            <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-4 py-3 space-y-1">
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">{evaluation.name}</p>
                <p className="text-[11px] text-slate-400">{evaluation.trigger_label}</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">{evaluation.focus}</p>
            </div>

            {submitError && (
                <div className="flex items-start gap-2.5 rounded-lg border border-rose-200 bg-rose-50 dark:border-rose-800 dark:bg-rose-900/20 px-3.5 py-3">
                    <AlertCircle className="size-4 text-rose-500 shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-rose-700 dark:text-rose-400">Gagal Submit</p>
                        <p className="text-xs text-rose-600 dark:text-rose-300 mt-0.5">{submitError}</p>
                    </div>
                    <button onClick={() => setSubmitError(null)} className="text-rose-400 hover:text-rose-600 shrink-0">
                        <X className="size-3.5" />
                    </button>
                </div>
            )}

            <div className="space-y-4">
                {(evaluation.questions ?? []).map((q, idx) => {
                    const isWeighted = q.has_weight !== false;
                    const answer = answers.find(a => a.question_id === q.id);
                    return (
                        <div key={q.id} className="space-y-2">
                            <div className="flex items-start gap-2">
                                <span className="size-5 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                                    {idx + 1}
                                </span>
                                <div className="flex-1">
                                    <p className="text-sm font-medium text-slate-800 dark:text-white">{q.question}</p>
                                    {q.description && (
                                        <p className="text-[11px] text-slate-400 mt-0.5 flex gap-1">
                                            <Info className="size-3 shrink-0 mt-0.5" />{q.description}
                                        </p>
                                    )}
                                    {isWeighted ? (
                                        <p className="text-[10px] text-primary mt-0.5">Bobot: {q.weight}%</p>
                                    ) : (
                                        <p className="text-[10px] text-slate-400 mt-0.5">Informasi — tidak dinilai</p>
                                    )}
                                </div>
                            </div>
                            {isWeighted && (
                                <div className="pl-7 space-y-1.5">
                                    <ScoreInput value={answer.score} onChange={s => setScore(q.id, s)} />
                                    <textarea
                                        rows={1}
                                        placeholder="Komentar (opsional)…"
                                        value={answer.comment}
                                        onChange={e => setComment(q.id, e.target.value)}
                                        className="w-full text-xs rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 resize-none focus:outline-none focus:ring-1 focus:ring-primary text-slate-700 dark:text-slate-300"
                                    />
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            <div className="space-y-1">
                <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Catatan Umum (opsional)</label>
                <textarea
                    rows={2}
                    placeholder="Catatan umum untuk evaluasi ini…"
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    className="w-full text-sm rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-primary"
                />
            </div>

            <div className="flex items-center gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
                <Button size="sm" className="gap-1.5" onClick={handleSubmit} disabled={!allAnswered || saving}>
                    {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
                    Submit Evaluasi
                </Button>
                <Button size="sm" variant="ghost" onClick={onCancel} disabled={saving}>Batal</Button>
                {!allAnswered && <span className="text-xs text-slate-400 ml-1">Semua pertanyaan wajib diisi.</span>}
            </div>
        </div>
    );
}

/* ── "Name (Company)" for a reviewer entry from summary.reviewers ── */
const fmtReviewer = (r) => (r?.company ? `${r.name} (${r.company})` : (r?.name ?? 'Anonim'));

/* ── Evaluation recap: aggregates every counted submission for one evaluation
   — average score, all reviewers (each still openable individually), and per
   question the average score + every comment. ── */
function EvaluationAggregateDetail({ evalSummary, evalDetail, reviews, canConfig, onToggleExclude, togglingId, onOpenSubmission }) {
    const counted  = reviews.filter(r => !r.is_excluded);
    const excluded = reviews.filter(r => r.is_excluded);

    // Aggregate answers per question, in the evaluation's configured order
    // (weighted questions only — "info" questions carry no score).
    const configuredOrder = (evalDetail?.questions ?? [])
        .filter(q => q.has_weight !== false)
        .map(q => q.id);

    const qMap = new Map();
    counted.forEach(r => (r.answers || []).forEach(a => {
        if (!qMap.has(a.question_id)) {
            qMap.set(a.question_id, { question: a.question, weight: a.weight, scores: [], comments: [] });
        }
        const q = qMap.get(a.question_id);
        q.scores.push(a.score);
        if (a.comment) q.comments.push({ by: r.submitted_by, comment: a.comment });
    }));

    const orderedQids = [
        ...configuredOrder.filter(id => qMap.has(id)),
        ...[...qMap.keys()].filter(id => !configuredOrder.includes(id)),
    ];

    const notes = counted.filter(r => r.notes).map(r => ({ by: r.submitted_by, notes: r.notes }));

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-[11px] text-slate-400">{evalSummary?.trigger_label}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                        Rata-rata {counted.length} penilaian
                        {excluded.length > 0 && ` · ${excluded.length} tidak dihitung`}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <LevelBadge score={evalSummary?.total_score} />
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{evalSummary?.total_score?.toFixed(1)}%</span>
                </div>
            </div>

            {/* Reviewers — click a row to see that person's individual answers */}
            <div className="rounded-lg border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-800">
                {reviews.map(r => (
                    <div key={r.id} className={cn('flex items-center gap-2 px-3 py-2', r.is_excluded && 'opacity-55')}>
                        <button onClick={() => onOpenSubmission(r)} className="flex-1 min-w-0 text-left group">
                            <p className="text-sm text-slate-800 dark:text-white truncate group-hover:text-primary flex items-center gap-1.5">
                                {r.submitted_by}
                                {r.is_excluded && (
                                    <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-[9px] font-semibold px-1.5 py-0.5">
                                        <EyeOff className="size-2.5" /> Tidak dihitung
                                    </span>
                                )}
                            </p>
                            <p className="text-[10px] text-slate-400">
                                {new Date(r.submitted_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                            </p>
                        </button>
                        <span className={cn('text-xs font-semibold text-slate-600 dark:text-slate-300 shrink-0', r.is_excluded && 'line-through')}>
                            {r.total_score?.toFixed(1)}%
                        </span>
                        {canConfig && onToggleExclude && (
                            <Button
                                size="sm" variant="ghost"
                                disabled={togglingId === r.id}
                                title={r.is_excluded ? 'Hitung kembali' : 'Tandai tidak dihitung'}
                                className={cn('h-6 px-1.5 shrink-0', r.is_excluded ? 'text-emerald-600' : 'text-amber-600')}
                                onClick={() => onToggleExclude(r)}
                            >
                                {togglingId === r.id
                                    ? <Loader2 className="size-3 animate-spin" />
                                    : r.is_excluded ? <RotateCcw className="size-3" /> : <EyeOff className="size-3" />}
                            </Button>
                        )}
                        <ChevronRight className="size-3.5 text-slate-400 shrink-0" />
                    </div>
                ))}
            </div>

            {/* Per-question average + all comments */}
            <div className="space-y-3">
                {orderedQids.map((qid, idx) => {
                    const q     = qMap.get(qid);
                    const avg   = q.scores.length ? q.scores.reduce((a, b) => a + b, 0) / q.scores.length : null;
                    const level = getLevel(avg != null ? (avg / 10) * 100 : null);
                    return (
                        <div key={qid} className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 space-y-2">
                            <div className="flex items-start gap-2">
                                <span className="size-5 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">{idx + 1}</span>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm text-slate-800 dark:text-white">{q.question}</p>
                                    {q.weight != null && <p className="text-[10px] text-primary">Bobot {q.weight}%</p>}
                                </div>
                                <span className={cn('text-sm font-bold shrink-0', level?.color)}>
                                    {avg != null ? `${avg.toFixed(1)}/10` : '—'}
                                </span>
                            </div>
                            {q.comments.length > 0 && (
                                <div className="pl-7 space-y-1">
                                    {q.comments.map((c, i) => (
                                        <p key={i} className="text-xs text-slate-500 dark:text-slate-400 flex gap-1.5">
                                            <MessageSquare className="size-3 shrink-0 mt-0.5" />
                                            <span><strong className="text-slate-600 dark:text-slate-300">{c.by}:</strong> {c.comment}</span>
                                        </p>
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {notes.length > 0 && (
                <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-3.5 py-3 space-y-1.5">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Catatan Umum</p>
                    {notes.map((n, i) => (
                        <p key={i} className="text-sm text-slate-700 dark:text-slate-300">
                            <strong className="text-slate-600 dark:text-slate-400">{n.by}:</strong> {n.notes}
                        </p>
                    ))}
                </div>
            )}
        </div>
    );
}

/* ── Review detail (answers summary of one review) ── */
function ReviewDetail({ review, canConfig, onToggleExclude, toggling }) {
    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-[11px] text-slate-400">{review.trigger_label}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                        Oleh {review.submitted_by} · {new Date(review.submitted_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <LevelBadge score={review.total_score} />
                    <span className={cn(
                        'text-sm font-bold text-slate-700 dark:text-slate-200',
                        review.is_excluded && 'line-through text-slate-400 dark:text-slate-500',
                    )}>{review.total_score?.toFixed(1)}%</span>
                </div>
            </div>

            {/* Exclusion status + toggle */}
            {(review.is_excluded || canConfig) && (
                <div className={cn(
                    'rounded-lg border px-3 py-2.5 flex items-center justify-between gap-3',
                    review.is_excluded
                        ? 'border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/10'
                        : 'border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/40',
                )}>
                    <div className="flex items-start gap-2 min-w-0">
                        <EyeOff className={cn('size-3.5 shrink-0 mt-0.5', review.is_excluded ? 'text-amber-500' : 'text-slate-400')} />
                        <p className={cn('text-xs', review.is_excluded ? 'text-amber-700 dark:text-amber-400' : 'text-slate-500 dark:text-slate-400')}>
                            {review.is_excluded
                                ? <>Penilaian ini <strong>tidak dihitung</strong> di Skor Overall, radar, maupun dashboard{review.excluded_by ? ` · dinonaktifkan oleh ${review.excluded_by}` : ''}.</>
                                : <>Penilaian ini <strong>dihitung</strong> di Skor Overall, radar, dan dashboard.</>}
                        </p>
                    </div>
                    {canConfig && onToggleExclude && (
                        <Button
                            size="sm" variant="outline"
                            disabled={toggling}
                            className={cn(
                                'h-7 text-xs gap-1.5 shrink-0',
                                review.is_excluded
                                    ? 'text-emerald-600 border-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/20'
                                    : 'text-amber-600 border-amber-300 hover:bg-amber-50 dark:hover:bg-amber-900/20',
                            )}
                            onClick={() => onToggleExclude(review)}
                        >
                            {toggling
                                ? <Loader2 className="size-3 animate-spin" />
                                : review.is_excluded ? <RotateCcw className="size-3" /> : <EyeOff className="size-3" />}
                            {review.is_excluded ? 'Hitung kembali' : 'Tandai tidak dihitung'}
                        </Button>
                    )}
                </div>
            )}

            <div className="space-y-3">
                {review.answers?.map((a, idx) => {
                    const level = getLevel((a.score / 10) * 100);
                    return (
                        <div key={a.question_id} className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 space-y-2">
                            <div className="flex items-start gap-2">
                                <span className="size-5 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">{idx + 1}</span>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm text-slate-800 dark:text-white">{a.question}</p>
                                    <p className="text-[10px] text-primary">Bobot {a.weight}%</p>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                    <span className={cn('text-sm font-bold', level?.color)}>{a.score}/10</span>
                                </div>
                            </div>
                            {a.comment && (
                                <p className="text-xs text-slate-500 dark:text-slate-400 pl-7 flex gap-1.5">
                                    <MessageSquare className="size-3 shrink-0 mt-0.5" />{a.comment}
                                </p>
                            )}
                        </div>
                    );
                })}
            </div>

            {review.notes && (
                <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-3.5 py-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-1">Catatan Umum</p>
                    <p className="text-sm text-slate-700 dark:text-slate-300">{review.notes}</p>
                </div>
            )}
        </div>
    );
}

/* ── Reusable email chip-list input (add via Enter/comma/blur, remove via X) ── */
function EmailChipInput({ emails, onChange, placeholder }) {
    const [draft, setDraft] = useState('');

    const commit = (raw) => {
        const value = raw.trim().replace(/,$/, '');
        if (!value) return;
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
            alert('Format email tidak valid: ' + value);
            return;
        }
        if (!emails.some(e => e.toLowerCase() === value.toLowerCase())) {
            onChange([...emails, value]);
        }
        setDraft('');
    };

    const removeEmail = (idx) => onChange(emails.filter((_, i) => i !== idx));

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            commit(draft);
        } else if (e.key === 'Backspace' && !draft && emails.length > 0) {
            removeEmail(emails.length - 1);
        }
    };

    return (
        <div className="space-y-1.5">
            {emails.length > 0 && (
                <div className="flex flex-wrap gap-1">
                    {emails.map((email, idx) => (
                        <span
                            key={email + idx}
                            className="flex items-center gap-1 text-[10px] font-medium pl-2 pr-1 py-0.5 rounded-full bg-primary/10 text-primary"
                        >
                            {email}
                            <button
                                type="button"
                                onClick={() => removeEmail(idx)}
                                className="rounded-full hover:bg-primary/20 p-0.5"
                                title="Hapus"
                            >
                                <X className="size-2.5" />
                            </button>
                        </span>
                    ))}
                </div>
            )}
            <div className="flex items-center gap-1.5">
                <Input
                    value={draft}
                    onChange={e => setDraft(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onBlur={() => commit(draft)}
                    placeholder={placeholder}
                    className="h-7 text-xs bg-white dark:bg-slate-900"
                />
                <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 w-7 p-0 shrink-0"
                    onClick={() => commit(draft)}
                    title="Tambah email"
                >
                    <Plus className="size-3" />
                </Button>
            </div>
        </div>
    );
}

/* ── Dialog to preview/edit subject+body before manually sending a review-invite email ── */
function SendReviewEmailDialog({ tokenId, open, onClose, onSent }) {
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [subject, setSubject] = useState('');
    const [body,    setBody]    = useState('');

    useEffect(() => {
        if (!open || !tokenId) return;
        setLoading(true);
        fetchAPI(`/review/tokens/${tokenId}/email-preview`)
            .then(res => {
                setSubject(res.data?.subject ?? '');
                setBody(res.data?.body ?? '');
            })
            .catch(e => alert('Gagal memuat template email: ' + e.message))
            .finally(() => setLoading(false));
    }, [open, tokenId]);

    const handleSend = async () => {
        setSending(true);
        try {
            const res = await fetchAPI(`/review/tokens/${tokenId}/send-email`, {
                method: 'POST',
                body: JSON.stringify({ subject, body }),
            });
            onSent(res.data);
            onClose();
        } catch (e) { alert('Gagal mengirim email: ' + e.message); }
        finally { setSending(false); }
    };

    return (
        <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle className="text-base">Kirim Email Review</DialogTitle>
                </DialogHeader>
                {loading ? (
                    <div className="flex items-center justify-center py-10 gap-2 text-slate-400 text-sm">
                        <Loader2 className="size-5 animate-spin" /> Memuat template…
                    </div>
                ) : (
                    <div className="space-y-3">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Subjek</label>
                            <Input value={subject} onChange={e => setSubject(e.target.value)} className="h-9 text-sm" />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Isi Email</label>
                            <Textarea value={body} onChange={e => setBody(e.target.value)} rows={6} className="text-sm" />
                            <p className="text-[10px] text-slate-400">
                                Tombol "Isi Review" &amp; link cadangan tetap ditambahkan otomatis setelah teks ini.
                                Perubahan di sini hanya berlaku untuk pengiriman ini.
                            </p>
                        </div>
                    </div>
                )}
                <DialogFooter className="gap-2 sm:gap-2">
                    <Button variant="outline" onClick={onClose} disabled={sending}>Batal</Button>
                    <Button onClick={handleSend} disabled={loading || sending} className="gap-1.5">
                        {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                        Kirim
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

/* ── Share link panel (per evaluation, inside dialog) ── */
const COPIED_LINKS_KEY   = 'hubtask_review_copied_links';
const COPIED_LINKS_EVENT = 'hubtask:review-link-copied';
const readCopiedLinks = () => {
    try { return JSON.parse(localStorage.getItem(COPIED_LINKS_KEY) ?? '{}'); } catch { return {}; }
};

// Shared across the dashboard summary tiles and the per-token badges inside
// ShareLinkPanel, so "sudah disalin" stays in sync without prop-drilling
// through the project card / summary dialog tree. Persisted per browser
// (clipboard copies aren't something the backend can observe).
function useCopiedLinks() {
    const [copiedAt, setCopiedAtState] = useState(readCopiedLinks);

    useEffect(() => {
        const onUpdate = () => setCopiedAtState(readCopiedLinks());
        window.addEventListener(COPIED_LINKS_EVENT, onUpdate);
        window.addEventListener('storage', onUpdate);
        return () => {
            window.removeEventListener(COPIED_LINKS_EVENT, onUpdate);
            window.removeEventListener('storage', onUpdate);
        };
    }, []);

    const markCopied = (id) => {
        const next = { ...readCopiedLinks(), [id]: new Date().toISOString() };
        try { localStorage.setItem(COPIED_LINKS_KEY, JSON.stringify(next)); } catch { /* storage unavailable, badge just won't persist */ }
        window.dispatchEvent(new Event(COPIED_LINKS_EVENT));
    };

    return [copiedAt, markCopied];
}

function ShareLinkPanel({ project, evaluation }) {
    const [tokens,      setTokens]      = useState(null); // null = not loaded yet
    const [loading,     setLoading]     = useState(false);
    const [creating,    setCreating]    = useState(false);
    const [copied,      setCopied]      = useState(null);
    const [copiedAt,    markCopied]     = useCopiedLinks(); // { [tokenId]: iso string } — persisted locally, per browser
    const [open,        setOpen]        = useState(false);
    const [emailsList,  setEmailsList]  = useState(project.review_client_emails ?? []);
    const [autoSend,    setAutoSend]    = useState(false);
    const [tokenEmailDrafts, setTokenEmailDrafts] = useState({}); // { [tokenId]: string[] } — local edits before saving
    const [savingEmailsId, setSavingEmailsId] = useState(null);
    const [sendDialogTokenId, setSendDialogTokenId] = useState(null);

    const load = async () => {
        setLoading(true);
        try {
            const res = await fetchAPI(`/projects/${project.id}/evaluations/${evaluation.id}/tokens`);
            const list = res.data ?? [];
            setTokens(list);
            setTokenEmailDrafts(Object.fromEntries(list.map(t => [t.id, t.client_emails ?? []])));
        } catch { setTokens([]); }
        finally { setLoading(false); }
    };

    const handleOpen = () => {
        setOpen(v => {
            if (!v && tokens === null) load();
            return !v;
        });
    };

    const handleCreate = async () => {
        setCreating(true);
        try {
            const res = await fetchAPI(`/projects/${project.id}/evaluations/${evaluation.id}/tokens`, {
                method: 'POST',
                body: JSON.stringify({ client_emails: emailsList, auto_send: autoSend }),
            });
            setTokens(prev => [res.data, ...(prev ?? [])]);
            setTokenEmailDrafts(prev => ({ ...prev, [res.data.id]: res.data.client_emails ?? [] }));
            setEmailsList([]);
        } catch (e) { alert('Gagal membuat link: ' + e.message); }
        finally { setCreating(false); }
    };

    const handleDeactivate = async (id) => {
        try {
            await fetchAPI(`/review/tokens/${id}`, { method: 'DELETE' });
            setTokens(prev => prev.map(t => t.id === id ? { ...t, is_active: false, is_usable: false } : t));
        } catch (e) { alert('Gagal: ' + e.message); }
    };

    // Emails save immediately on every add/remove — no separate "Simpan" step to
    // forget, which previously left a typed-but-unsaved email silently uncounted.
    const handleTokenEmailsChange = async (id, emails) => {
        setTokenEmailDrafts(prev => ({ ...prev, [id]: emails }));
        setSavingEmailsId(id);
        try {
            const res = await fetchAPI(`/review/tokens/${id}/emails`, {
                method: 'PATCH',
                body: JSON.stringify({ client_emails: emails }),
            });
            setTokens(prev => prev.map(t => t.id === id ? res.data : t));
            setTokenEmailDrafts(prev => ({ ...prev, [id]: res.data.client_emails ?? [] }));
        } catch (e) { alert('Gagal menyimpan email: ' + e.message); }
        finally { setSavingEmailsId(null); }
    };

    const handleEmailSent = (updatedToken) => {
        setTokens(prev => prev.map(t => t.id === updatedToken.id ? updatedToken : t));
        setTokenEmailDrafts(prev => ({ ...prev, [updatedToken.id]: updatedToken.client_emails ?? [] }));
    };

    const copyUrl = (url, id) => {
        navigator.clipboard.writeText(url);
        setCopied(id);
        setTimeout(() => setCopied(null), 2000);
        markCopied(id);
    };

    return (
        <div className="border-t border-slate-100 dark:border-slate-800">
            <button
                onClick={handleOpen}
                className="w-full flex items-center justify-between px-4 py-2 text-xs text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
            >
                <span className="flex items-center gap-1.5">
                    <LinkIcon className="size-3.5 text-slate-400" /> Bagikan Link Publik
                </span>
                <ChevronRight className={cn('size-3.5 text-slate-400 transition-transform', open && 'rotate-90')} />
            </button>

            {open && (
                <div className="px-4 pb-3 space-y-2.5 bg-slate-50/60 dark:bg-slate-800/20">
                    {loading ? (
                        <div className="flex items-center gap-2 py-2 text-slate-400 text-xs">
                            <Loader2 className="size-3.5 animate-spin" /> Memuat…
                        </div>
                    ) : (
                        <>
                            {/* Existing tokens */}
                            {(tokens ?? []).map(t => (
                                <div key={t.id} className={cn(
                                    'rounded-lg border px-3 py-2 space-y-1',
                                    t.is_usable
                                        ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-900/10'
                                        : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900 opacity-60',
                                )}>
                                    <div className="flex items-center justify-between gap-2">
                                        <span className={cn(
                                            'text-[10px] font-semibold px-1.5 py-0.5 rounded-full',
                                            t.is_usable
                                                ? 'bg-emerald-100 text-emerald-700'
                                                : 'bg-slate-100 text-slate-500',
                                        )}>
                                            {t.is_usable ? 'Aktif' : t.is_active ? 'Kadaluarsa' : 'Nonaktif'}
                                        </span>
                                        {t.expires_at && (
                                            <span className="text-[10px] text-slate-400">
                                                Sampai {new Date(t.expires_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                        {copiedAt[t.id] ? (
                                            <span
                                                title={`Disalin ${fmtDateWIB(copiedAt[t.id])}`}
                                                className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400"
                                            >
                                                <ClipboardCheck className="size-2.5" /> Disalin
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500">
                                                <Clipboard className="size-2.5" /> Belum disalin
                                            </span>
                                        )}
                                        {(t.email_sent_at || (t.client_emails ?? []).length > 0) ? (
                                            <span
                                                title={(t.client_emails ?? []).join(', ')}
                                                className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400"
                                            >
                                                <MailCheck className="size-2.5" />
                                                {t.email_sent_at ? `Terkirim ke User ${fmtDateWIB(t.email_sent_at)}` : 'Terkirim ke User'}
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400">
                                                <MailX className="size-2.5" /> Belum terkirim
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <code className="flex-1 text-[11px] text-slate-600 dark:text-slate-300 truncate bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-0.5 font-mono">
                                            {t.url}
                                        </code>
                                        <button
                                            onClick={() => copyUrl(t.url, t.id)}
                                            className="shrink-0 text-xs font-medium px-2 py-1 rounded bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                                        >
                                            {copied === t.id ? 'Tersalin!' : 'Salin'}
                                        </button>
                                        {t.is_usable && (
                                            <button
                                                onClick={() => handleDeactivate(t.id)}
                                                className="shrink-0 text-xs text-rose-500 hover:text-rose-700 px-1 py-1"
                                                title="Nonaktifkan link"
                                            >
                                                <X className="size-3.5" />
                                            </button>
                                        )}
                                    </div>
                                    {(t.client_emails ?? []).length > 0 && (
                                        <p className="text-[10px] text-slate-500 truncate pt-0.5" title={t.client_emails.join(', ')}>
                                            {t.email_sent_at ? 'Terkirim ke: ' : 'Klien: '}{t.client_emails.join(', ')}
                                        </p>
                                    )}
                                    {t.is_usable && (
                                        <div className="pt-1 space-y-1.5">
                                            <EmailChipInput
                                                emails={tokenEmailDrafts[t.id] ?? []}
                                                onChange={(emails) => handleTokenEmailsChange(t.id, emails)}
                                                placeholder="Tambah email klien…"
                                            />
                                            <div className="flex items-center gap-1.5">
                                                <span className="shrink-0 flex items-center gap-1 text-[10px] text-slate-400">
                                                    {savingEmailsId === t.id
                                                        ? <><Loader2 className="size-2.5 animate-spin" /> Menyimpan…</>
                                                        : 'Tersimpan otomatis'
                                                    }
                                                </span>
                                                <button
                                                    onClick={() => setSendDialogTokenId(t.id)}
                                                    disabled={(t.client_emails ?? []).length === 0}
                                                    title={(t.client_emails ?? []).length === 0 ? 'Simpan minimal 1 email dulu' : undefined}
                                                    className="shrink-0 flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                                >
                                                    <Send className="size-2.5" />
                                                    {t.email_sent_at ? 'Kirim Ulang' : 'Kirim Email'}
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}

                            {/* Create form */}
                            <div className="space-y-1.5">
                                <EmailChipInput
                                    emails={emailsList}
                                    onChange={setEmailsList}
                                    placeholder="email-client@company.com lalu Enter"
                                />
                                <div className="flex items-center justify-between px-0.5">
                                    <span className="text-[10px] text-slate-500">Kirim otomatis saat link dibuat</span>
                                    <Switch
                                        checked={autoSend}
                                        onCheckedChange={setAutoSend}
                                        className="scale-90"
                                    />
                                </div>
                            </div>

                            {/* Create button */}
                            <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs gap-1.5 w-full"
                                onClick={handleCreate}
                                disabled={creating}
                            >
                                {creating
                                    ? <Loader2 className="size-3 animate-spin" />
                                    : <Plus className="size-3" />
                                }
                                Buat Link Baru
                            </Button>
                        </>
                    )}
                </div>
            )}

            <SendReviewEmailDialog
                tokenId={sendDialogTokenId}
                open={sendDialogTokenId != null}
                onClose={() => setSendDialogTokenId(null)}
                onSent={handleEmailSent}
            />
        </div>
    );
}

/* ── Summary Dialog ── */
function ReviewSummaryDialog({ open, onClose, project, canSubmit, canConfig }) {
    const navigate = useNavigate();
    const [summary,   setSummary]   = useState(null);
    const [allReviews, setAllReviews] = useState({});
    const [loading,   setLoading]   = useState(true);
    const [activeEval, setActiveEval] = useState(null); // evaluation object for submit form
    const [detailReview, setDetailReview] = useState(null); // review object to view answers (one submission)
    const [aggregateEvalId, setAggregateEvalId] = useState(null); // evaluation_id to show the multi-reviewer recap for
    const [togglingExcludeId, setTogglingExcludeId] = useState(null); // review id currently being toggled
    const [evals,     setEvals]     = useState([]);
    const [pendingEmails, setPendingEmails] = useState([]);
    const [savingEmails,  setSavingEmails]  = useState(false);

    const [triggerStatuses, setTriggerStatuses] = useState({});

    const load = useCallback(async () => {
        if (!open || !project) return;
        setLoading(true);
        try {
            const [summaryRes, reviewsRes, evalsRes, triggerRes] = await Promise.all([
                fetchAPI(`/projects/${project.id}/reviews/summary`),
                fetchAPI(`/projects/${project.id}/reviews`),
                fetchAPI(`/review/evaluations?methodology=${encodeURIComponent(project.methodology ?? '')}`),
                fetchAPI(`/projects/${project.id}/reviews/trigger-status`),
            ]);
            setSummary(summaryRes);
            setAllReviews(reviewsRes.data ?? {});
            setEvals(evalsRes.data ?? []);
            setPendingEmails(project.review_client_emails ?? []);
            const tsMap = {};
            (triggerRes.data ?? []).forEach(t => { tsMap[t.evaluation_id] = t; });
            setTriggerStatuses(tsMap);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    }, [open, project]);

    useEffect(() => { load(); }, [load]);

    const handleSubmitted = (newReview) => {
        setActiveEval(null);
        load();
    };

    const handleSaveClientEmails = async () => {
        setSavingEmails(true);
        try {
            await fetchAPI(`/projects/${project.id}/review-client-emails`, {
                method: 'PUT',
                body: JSON.stringify({ client_emails: pendingEmails }),
            });
        } catch (e) { alert('Gagal menyimpan email: ' + e.message); }
        finally { setSavingEmails(false); }
    };

    // Toggle whether a submission counts toward Overall / radar / dashboard.
    // Non-destructive — the submission stays in the history list either way.
    const handleToggleExclude = async (review) => {
        const excluded = !review.is_excluded;
        if (excluded && !window.confirm(
            'Nonaktifkan penilaian ini? Skornya tidak akan dihitung di Skor Overall, radar chart, maupun dashboard. Bisa diaktifkan lagi kapan saja.'
        )) return;
        setTogglingExcludeId(review.id);
        try {
            const res = await fetchAPI(`/projects/${project.id}/reviews/${review.id}/exclusion`, {
                method: 'PATCH',
                body: JSON.stringify({ excluded }),
            });
            // Keep the individual detail view in sync if it's the one open;
            // the recap/summary views refresh from load() below.
            setDetailReview(prev => (prev && prev.id === review.id ? res.data : prev));
            await load();
        } catch (e) { alert('Gagal memperbarui status penilaian: ' + e.message); }
        finally { setTogglingExcludeId(null); }
    };

    if (!project) return null;

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-base">
                        <Star className="size-4 text-primary" />
                        {project.name}
                    </DialogTitle>
                </DialogHeader>

                {loading ? (
                    <div className="flex items-center justify-center py-12 gap-2 text-slate-400 text-sm">
                        <Loader2 className="size-5 animate-spin" /> Memuat data review…
                    </div>
                ) : detailReview ? (
                    <div className="space-y-3">
                        <button onClick={() => setDetailReview(null)} className="flex items-center gap-1.5 text-xs text-primary hover:underline">
                            <ArrowLeft className="size-3" /> {aggregateEvalId ? 'Kembali ke rekap' : 'Kembali ke ringkasan'}
                        </button>
                        <p className="text-sm font-semibold text-slate-800 dark:text-white">{detailReview.evaluation_name}</p>
                        <ReviewDetail
                            review={detailReview}
                            canConfig={canConfig}
                            onToggleExclude={handleToggleExclude}
                            toggling={togglingExcludeId === detailReview.id}
                        />
                    </div>
                ) : aggregateEvalId ? (
                    <div className="space-y-3">
                        <button onClick={() => setAggregateEvalId(null)} className="flex items-center gap-1.5 text-xs text-primary hover:underline">
                            <ArrowLeft className="size-3" /> Kembali ke ringkasan
                        </button>
                        {(() => {
                            const aggEval = (summary?.data ?? []).find(s => s.evaluation_id === aggregateEvalId);
                            return (
                                <>
                                    <p className="text-sm font-semibold text-slate-800 dark:text-white">{aggEval?.evaluation_name}</p>
                                    <EvaluationAggregateDetail
                                        evalSummary={aggEval}
                                        evalDetail={evals.find(e => e.id === aggregateEvalId)}
                                        reviews={allReviews[aggregateEvalId] ?? []}
                                        canConfig={canConfig}
                                        onToggleExclude={handleToggleExclude}
                                        togglingId={togglingExcludeId}
                                        onOpenSubmission={(r) => setDetailReview(r)}
                                    />
                                </>
                            );
                        })()}
                    </div>
                ) : activeEval ? (
                    <div className="space-y-3">
                        <button onClick={() => setActiveEval(null)} className="flex items-center gap-1.5 text-xs text-primary hover:underline">
                            <ArrowLeft className="size-3" /> Batal
                        </button>
                        <ReviewSubmitForm
                            project={project}
                            evaluation={activeEval}
                            onSubmitted={handleSubmitted}
                            onCancel={() => setActiveEval(null)}
                        />
                    </div>
                ) : (
                    <div className="space-y-4">
                        {/* Overall score */}
                        {summary?.overall != null && (
                            <div className={cn(
                                'rounded-xl border p-4 flex items-center justify-between',
                                getLevel(summary.overall)?.bg,
                            )}>
                                <div>
                                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Skor Overall</p>
                                    <p className={cn('text-3xl font-bold mt-0.5', getLevel(summary.overall)?.color)}>
                                        {summary.overall?.toFixed(1)}%
                                    </p>
                                    {summary.overall_count > 0 && (
                                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                                            Rata-rata {summary.overall_count} penilaian yang masuk
                                        </p>
                                    )}
                                </div>
                                <LevelBadge score={summary.overall} />
                            </div>
                        )}

                        {/* No evaluation cycle configured yet for this project's methodology */}
                        {evals.length === 0 && (
                            <div className="rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/10 p-4 space-y-3">
                                <div className="flex items-start gap-2">
                                    <AlertCircle className="size-4 text-amber-500 shrink-0 mt-0.5" />
                                    <div>
                                        <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                                            Konfigurasi evaluasi review belum dibuat
                                        </p>
                                        <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                                            Belum ada evaluation cycle untuk metodologi {project.methodology ?? 'project ini'}.
                                            Anda tetap bisa menyiapkan email client di bawah ini — link review baru bisa dibuat/dikirim
                                            setelah konfigurasi tersedia.
                                        </p>
                                    </div>
                                </div>

                                {canConfig && (
                                    <>
                                        <EmailChipInput
                                            emails={pendingEmails}
                                            onChange={setPendingEmails}
                                            placeholder="email-client@company.com lalu Enter"
                                        />
                                        <div className="flex items-center gap-2">
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="h-7 text-xs gap-1.5"
                                                onClick={handleSaveClientEmails}
                                                disabled={savingEmails}
                                            >
                                                {savingEmails
                                                    ? <Loader2 className="size-3 animate-spin" />
                                                    : null
                                                }
                                                Simpan Email
                                            </Button>
                                            <Button
                                                size="sm"
                                                className="h-7 text-xs gap-1.5"
                                                onClick={() => navigate('/review/config')}
                                            >
                                                <Settings2 className="size-3.5" /> Buat Konfigurasi
                                            </Button>
                                        </div>
                                    </>
                                )}
                            </div>
                        )}

                        {/* Per evaluation */}
                        <div className="space-y-3">
                            {(summary?.data ?? []).map((s) => {
                                const level      = getLevel(s.submitted ? s.total_score : null);
                                const evalDetail = evals.find(e => e.id === s.evaluation_id);
                                const history    = (allReviews[s.evaluation_id] ?? []);

                                return (
                                    <div key={s.evaluation_id} className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                                        {/* Eval header */}
                                        <div className="px-4 py-3 bg-white dark:bg-slate-900">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <p className="text-sm font-semibold text-slate-800 dark:text-white">{s.evaluation_name}</p>
                                                    <p className="text-[11px] text-slate-400">{s.trigger_label}</p>
                                                </div>
                                                {s.submitted ? (
                                                    <button
                                                        onClick={() => setAggregateEvalId(s.evaluation_id)}
                                                        className="flex flex-col items-end gap-0.5 hover:opacity-80 transition-opacity"
                                                        title="Lihat rekap semua penilaian"
                                                    >
                                                        <div className="flex items-center gap-2">
                                                            <LevelBadge score={s.total_score} />
                                                            <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{s.total_score?.toFixed(1)}%</span>
                                                            <ChevronRight className="size-3.5 text-slate-400" />
                                                        </div>
                                                        <span className="text-[10px] text-slate-400">
                                                            {s.submission_count > 1
                                                                ? `rata-rata ${s.submission_count} penilaian`
                                                                : '1 penilaian'}
                                                        </span>
                                                    </button>
                                                ) : (
                                                    <span className="text-[11px] text-slate-400 italic">Belum ada review</span>
                                                )}
                                            </div>
                                            {s.reviewers?.length > 0 && (
                                                <p className="text-[10px] text-slate-400 mt-1.5 leading-relaxed">
                                                    Oleh {s.reviewers.map(fmtReviewer).join(', ')}
                                                </p>
                                            )}
                                            {/* Trigger status bar */}
                                            {(() => {
                                                const ts = triggerStatuses[s.evaluation_id];
                                                if (!ts || ts.current_value == null || ts.trigger_value == null) return null;
                                                const triggered = ts.is_triggered;
                                                const pct = Math.min(ts.current_value, 100);
                                                const isTaskType = ts.trigger_type === 'task_done_percentage' || ts.trigger_type === 'project_percentage';
                                                const isMh = ts.trigger_type === 'mh_percentage';
                                                const label = isMh
                                                    ? (ts.trigger_basis === 'topup_mh' ? 'MH top-up terpakai' : 'MH terpakai')
                                                    : 'task selesai';
                                                return (
                                                    <div className="mt-2 space-y-1">
                                                        <div className="flex items-center justify-between text-[11px]">
                                                            <span className="text-slate-400">{ts.current_value}% {label}</span>
                                                            <span className={cn(
                                                                'font-semibold px-1.5 py-0.5 rounded-full text-[10px]',
                                                                triggered
                                                                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400'
                                                                    : 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400',
                                                            )}>
                                                                {triggered ? 'Siap review' : `Belum (target ${ts.trigger_value}%)`}
                                                            </span>
                                                        </div>
                                                        <div className="relative h-1.5 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                                                            <div
                                                                className={cn('h-full rounded-full transition-all', triggered ? 'bg-emerald-500' : 'bg-amber-400')}
                                                                style={{ width: `${pct}%` }}
                                                            />
                                                            {/* Threshold marker */}
                                                            <div
                                                                className="absolute top-0 h-full w-0.5 bg-slate-500/40 dark:bg-slate-300/30"
                                                                style={{ left: `${Math.min(ts.trigger_value, 100)}%` }}
                                                            />
                                                        </div>
                                                    </div>
                                                );
                                            })()}
                                        </div>

                                        {/* History list */}
                                        {history.length > 0 && (
                                            <div className="border-t border-slate-100 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800">
                                                {history.map(r => (
                                                    <button
                                                        key={r.id}
                                                        onClick={() => setDetailReview(r)}
                                                        className={cn(
                                                            'w-full flex items-center justify-between px-4 py-2.5 bg-slate-50/50 dark:bg-slate-800/30 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-left',
                                                            r.is_excluded && 'opacity-55',
                                                        )}
                                                    >
                                                        <div>
                                                            <p className="text-xs text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                                                                <span>Oleh <strong>{r.submitted_by}</strong></span>
                                                                {r.is_excluded && (
                                                                    <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-[9px] font-semibold px-1.5 py-0.5">
                                                                        <EyeOff className="size-2.5" /> Tidak dihitung
                                                                    </span>
                                                                )}
                                                            </p>
                                                            <p className="text-[10px] text-slate-400">
                                                                {new Date(r.submitted_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                            </p>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <LevelBadge score={r.total_score} />
                                                            <span className={cn(
                                                                'text-xs font-semibold text-slate-600 dark:text-slate-300',
                                                                r.is_excluded && 'line-through',
                                                            )}>{r.total_score?.toFixed(1)}%</span>
                                                            <ChevronRight className="size-3.5 text-slate-400" />
                                                        </div>
                                                    </button>
                                                ))}
                                            </div>
                                        )}

                                        {/* Submit button (internal) */}
                                        {canSubmit && evalDetail && (
                                            <div className="border-t border-slate-100 dark:border-slate-800 px-4 py-2.5 bg-white dark:bg-slate-900">
                                                <Button
                                                    size="sm" variant="outline"
                                                    className="h-7 text-xs gap-1.5 text-primary border-primary/30 hover:bg-primary/5"
                                                    onClick={() => setActiveEval(evalDetail)}
                                                >
                                                    <Plus className="size-3" />
                                                    {s.submitted ? 'Submit Review Baru' : 'Submit Review Pertama'}
                                                </Button>
                                            </div>
                                        )}

                                        {/* Share public link (canConfig only) */}
                                        {canConfig && evalDetail && (
                                            <ShareLinkPanel project={project} evaluation={evalDetail} />
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}

/* ── Relative time in Indonesian, e.g. "3 hari lalu" ── */
function timeAgo(iso) {
    if (!iso) return null;
    const diffMs = Date.now() - new Date(iso).getTime();
    const minutes = Math.floor(diffMs / 60000);
    if (minutes < 1)  return 'baru saja';
    if (minutes < 60) return `${minutes} menit lalu`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} jam lalu`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days} hari lalu`;
    const months = Math.floor(days / 30);
    if (months < 12) return `${months} bulan lalu`;
    return `${Math.floor(months / 12)} tahun lalu`;
}

const REVIEW_STATUS_STYLE = {
    full:      { icon: CheckCircle2, iconBg: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400', pill: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400', label: 'Sudah Direview' },
    partial:   { icon: Clock,        iconBg: 'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400',       pill: 'bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400',       label: 'Sebagian' },
    none:      { icon: Clock,        iconBg: 'bg-rose-50 text-rose-500 dark:bg-rose-900/20 dark:text-rose-400',           pill: 'bg-rose-100 text-rose-700 dark:bg-rose-900/20 dark:text-rose-400',           label: 'Belum Direview' },
    no_config: { icon: Clock,        iconBg: 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500',         pill: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',           label: 'Tanpa Evaluasi' },
};

/* ── Per-evaluation-cycle state chip (from summary().data[].cycle_state) ──
   submitted = sudah ada penilaian · due = target trigger tercapai tapi belum diisi
   waiting = target belum tercapai (belum waktunya) · open = trigger manual/tak terhitung */
const CYCLE_CHIP_STYLE = {
    submitted: { cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400', icon: CheckCircle2, text: 'terisi' },
    due:       { cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',          icon: Clock,        text: 'siap diisi' },
    waiting:   { cls: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',             icon: Clock,        text: 'belum waktunya' },
    open:      { cls: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',             icon: Clock,        text: 'terjadwal manual' },
};

function CycleChips({ cycles }) {
    if (!cycles?.length) return null;
    return (
        <div className="flex flex-wrap gap-1 mt-1.5">
            {cycles.map((c, i) => {
                const s = CYCLE_CHIP_STYLE[c.state] ?? CYCLE_CHIP_STYLE.open;
                const Icon = s.icon;
                const pct = (c.state === 'waiting' && c.current != null && c.target != null)
                    ? ` ${c.current}%/${c.target}%`
                    : '';
                return (
                    <span
                        key={i}
                        title={c.name}
                        className={cn('inline-flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.5 rounded-full', s.cls)}
                    >
                        <Icon className="size-2.5 shrink-0" />
                        {c.label}: {s.text}{pct}
                    </span>
                );
            })}
        </div>
    );
}

/* ── Horizontal segmented bar + legend — reusable proportion chart, no chart lib needed.
   Segments are clickable (bar slice or legend entry) when onSegmentClick is given. ── */
function SegmentedBarChart({ title, headline, headlineSub, segments, emptyLabel, onSegmentClick }) {
    const total = segments.reduce((acc, s) => acc + s.value, 0);
    return (
        <div className="rounded-xl border border-white/60 bg-white/70 backdrop-blur-xl dark:border-white/10 dark:bg-[#151b28] dark:shadow-xl p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{title}</p>
            </div>

            {headline != null && (
                <p className="text-2xl font-bold text-slate-900 dark:text-white -mt-1">
                    {headline}
                    {headlineSub && <span className="text-xs font-normal text-slate-400 ml-1">{headlineSub}</span>}
                </p>
            )}

            {total > 0 ? (
                <>
                    <div className="flex h-3 w-full rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800">
                        {segments.filter(s => s.value > 0).map(s => (
                            <button
                                key={s.key}
                                type="button"
                                onClick={() => onSegmentClick?.(s.key)}
                                className={cn('h-full transition-all', s.barColor, onSegmentClick && 'cursor-pointer hover:brightness-110')}
                                style={{ width: `${(s.value / total) * 100}%` }}
                                title={`${s.label}: ${s.value}`}
                            />
                        ))}
                    </div>
                    <div className="flex flex-wrap gap-x-1 gap-y-1">
                        {segments.map(s => (
                            <button
                                key={s.key}
                                type="button"
                                onClick={() => onSegmentClick?.(s.key)}
                                disabled={!onSegmentClick || s.value === 0}
                                className={cn(
                                    'flex items-center gap-1.5 text-xs rounded-md px-1.5 py-0.5 transition-colors',
                                    onSegmentClick && s.value > 0 && 'hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer',
                                    s.value === 0 && 'opacity-50',
                                )}
                            >
                                <span className={cn('size-2 rounded-full shrink-0', s.dotColor)} />
                                <span className="text-slate-500 dark:text-slate-400">{s.label}</span>
                                <span className="font-semibold text-slate-700 dark:text-slate-200">{s.value}</span>
                                <span className="text-slate-400">({Math.round((s.value / total) * 100)}%)</span>
                            </button>
                        ))}
                    </div>
                </>
            ) : (
                <p className="text-xs text-slate-400 italic">{emptyLabel}</p>
            )}
        </div>
    );
}

/* ── Radar/spider chart — pure SVG, no chart lib needed. Axes are numbered
   positions (1, 2, 3…), not question text, since different evaluation cycles
   can have different question sets; that's what keeps cycles/projects
   comparable on one chart, same idea as SegmentedBarChart above. Each axis
   label and data point carries a native tooltip (`title`) with the actual
   question text — same lightweight tooltip convention used everywhere else
   in this file (badges, share-link rows, etc.), no custom hover component. ── */
const RADAR_COLORS = ['#0f9c8f', '#6366f1', '#f59e0b', '#ef4444', '#0ea5e9', '#a855f7'];

// Curated palette for the first few series (brand-consistent), then falls
// back to evenly spaced hues so an arbitrary number of projects still stay
// visually distinguishable instead of repeating colors.
function seriesColor(i, total) {
    if (i < RADAR_COLORS.length) return RADAR_COLORS[i];
    const hue = Math.round((360 * i) / Math.max(total, 1));
    return `hsl(${hue}, 62%, 45%)`;
}

function RadarChart({ axes, series, maxValue = 10, size = 240 }) {
    const n = axes.length;
    const center = size / 2;
    const radius = center - 26;
    const ringCount = 5;

    if (n < 3 || series.length === 0) {
        return (
            <div className="flex items-center justify-center text-xs text-slate-400 italic" style={{ height: size }}>
                Belum ada data untuk filter ini.
            </div>
        );
    }

    const angleFor = (i) => (Math.PI * 2 * i) / n - Math.PI / 2;
    const pointFor = (i, value) => {
        const r = (Math.max(value, 0) / maxValue) * radius;
        const a = angleFor(i);
        return [center + r * Math.cos(a), center + r * Math.sin(a)];
    };

    return (
        <svg width={size} height={size} className="mx-auto overflow-visible">
            {Array.from({ length: ringCount }, (_, li) => {
                const r = ((li + 1) / ringCount) * radius;
                const pts = axes.map((_, i) => {
                    const a = angleFor(i);
                    return `${center + r * Math.cos(a)},${center + r * Math.sin(a)}`;
                }).join(' ');
                return <polygon key={li} points={pts} fill="none" className="stroke-slate-200 dark:stroke-slate-700" strokeWidth="1" />;
            })}
            {axes.map((_, i) => {
                const a = angleFor(i);
                return (
                    <line
                        key={i}
                        x1={center} y1={center}
                        x2={center + radius * Math.cos(a)} y2={center + radius * Math.sin(a)}
                        className="stroke-slate-200 dark:stroke-slate-700" strokeWidth="1"
                    />
                );
            })}
            {axes.map((label, i) => {
                const a = angleFor(i);
                const lx = center + (radius + 13) * Math.cos(a);
                const ly = center + (radius + 13) * Math.sin(a);
                // Different series can ask a different question at the same
                // position — list every distinct one so the label tooltip
                // stays accurate instead of picking just the first series.
                const questionsHere = [...new Set(series.map(s => s.questions?.[i]).filter(Boolean))];
                return (
                    <text key={i} x={lx} y={ly} textAnchor="middle" dominantBaseline="middle" className="fill-slate-400 dark:fill-slate-500 text-[10px] font-medium">
                        {questionsHere.length > 0 && <title>{questionsHere.join('\n\n')}</title>}
                        {label}
                    </text>
                );
            })}
            {series.map((s) => {
                const pts = axes.map((_, i) => pointFor(i, s.values[i] ?? 0).join(',')).join(' ');
                return (
                    <g key={s.key}>
                        <polygon points={pts} fill={s.color} fillOpacity="0.14" stroke={s.color} strokeWidth="2" />
                        {axes.map((_, i) => {
                            const v = s.values[i];
                            if (v == null) return null;
                            const [x, y] = pointFor(i, v);
                            const question = s.questions?.[i];
                            return (
                                <circle key={i} cx={x} cy={y} r="2.5" fill={s.color}>
                                    <title>{`${s.label}${question ? ` — ${question}` : ` — poin ${i + 1}`}\nSkor: ${v}/10`}</title>
                                </circle>
                            );
                        })}
                    </g>
                );
            })}
        </svg>
    );
}

/* ── One methodology's radar panel. Two ways to compare, picked via the
   "Bandingkan" toggle:
   - Antar Siklus: one line per active evaluation cycle (or a single one when
     a specific cycle is picked); Project filter scopes whose submitted
     reviews feed the averages ("Seluruh Project" = aggregate).
   - Antar Project: one line per project that has submitted reviews for one
     specific cycle (comparing projects only makes sense against a single,
     fixed question set) — Project filter is replaced by "every project with
     data", each its own color. ── */
function ReviewRadarPanel({ methodology, projects }) {
    const methodologyProjects = useMemo(
        () => projects.filter(p => p.methodology === methodology).sort((a, b) => (a.name || '').localeCompare(b.name || '')),
        [projects, methodology],
    );

    const [compareMode,     setCompareMode]     = useState('cycle'); // 'cycle' | 'project'
    const [evaluations,     setEvaluations]     = useState([]);
    const [cycleModeProjectIds, setCycleModeProjectIds] = useState([]); // used by compareMode='cycle' — [] means "Seluruh Project" (aggregate all)
    const [evaluationFilter, setEvaluationFilter] = useState('all'); // used by compareMode='cycle'
    const [projectModeEvalIds, setProjectModeEvalIds] = useState([]); // used by compareMode='project' — [] means "all loaded cycles"
    const [projectModeProjectIds, setProjectModeProjectIds] = useState([]); // used by compareMode='project' — [] means "every project with data"
    const [radar,           setRadar]           = useState(null);
    const [loading,         setLoading]         = useState(true);

    useEffect(() => {
        fetchAPI(`/review/evaluations?methodology=${encodeURIComponent(methodology)}`)
            .then(res => setEvaluations((res.data ?? []).filter(e => e.is_active)))
            .catch(() => setEvaluations([]));
    }, [methodology]);

    // Narrows which projects' reviews feed the per-cycle averages; empty = every
    // accessible project ("Seluruh Project"), a legitimate resting state (unlike
    // the cycle picker below, there's no "must keep at least one" here).
    const toggleCycleModeProject = (id) => {
        setCycleModeProjectIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    };

    // Antar Project mode compares against whichever cycles are toggled on;
    // empty selection defaults to "every loaded cycle" so switching modes
    // shows something immediately without needing a separate effect.
    const activeProjectModeEvalIds = projectModeEvalIds.length > 0 ? projectModeEvalIds : evaluations.map(e => e.id);

    const toggleProjectModeEval = (id) => {
        setProjectModeEvalIds(prev => {
            const current = prev.length > 0 ? prev : evaluations.map(e => e.id);
            if (current.includes(id)) {
                if (current.length === 1) return current; // keep at least one cycle selected
                return current.filter(x => x !== id);
            }
            return [...current, id];
        });
    };

    // Narrows which projects show up as lines; empty = every project that has
    // data for the selected cycle(s) (the previous, still-default behavior).
    const toggleProjectModeProject = (id) => {
        setProjectModeProjectIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    };

    const loadRadar = useCallback(async () => {
        setLoading(true);
        const params = new URLSearchParams({ methodology, compare: compareMode });

        if (compareMode === 'cycle') {
            cycleModeProjectIds.forEach(id => params.append('project_ids[]', id));
            if (evaluationFilter !== 'all') params.set('evaluation_id', evaluationFilter);
        } else {
            activeProjectModeEvalIds.forEach(id => params.append('evaluation_ids[]', id));
            projectModeProjectIds.forEach(id => params.append('project_ids[]', id));
        }

        try {
            const res = await fetchAPI(`/review/radar?${params.toString()}`);
            setRadar(res.data);
        } catch {
            setRadar({ axes: [], series: [] });
        } finally {
            setLoading(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps -- activeProjectModeEvalIds is derived from projectModeEvalIds+evaluations, both already deps
    }, [methodology, compareMode, cycleModeProjectIds, evaluationFilter, projectModeEvalIds, projectModeProjectIds, evaluations]);

    useEffect(() => { loadRadar(); }, [loadRadar]);

    const cycleModeProjectLabel = cycleModeProjectIds.length === 0
        ? 'Seluruh Project'
        : cycleModeProjectIds.length === 1
            ? (methodologyProjects.find(p => p.id === cycleModeProjectIds[0])?.name ?? '1 Project')
            : `${cycleModeProjectIds.length} Project dipilih`;

    const projectModeProjectLabel = projectModeProjectIds.length === 0
        ? 'Seluruh Project'
        : projectModeProjectIds.length === 1
            ? (methodologyProjects.find(p => p.id === projectModeProjectIds[0])?.name ?? '1 Project')
            : `${projectModeProjectIds.length} Project dipilih`;

    const seriesList = radar?.series ?? [];
    const coloredSeries = seriesList.map((s, i) => ({ ...s, color: seriesColor(i, seriesList.length) }));

    return (
        <div className="rounded-xl border border-white/60 bg-white/70 backdrop-blur-xl dark:border-white/10 dark:bg-[#151b28] dark:shadow-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 space-y-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-slate-800 dark:text-white">{methodology}</p>
                    <div className="flex items-center rounded-lg border border-slate-200 dark:border-slate-700 p-0.5 bg-slate-50 dark:bg-slate-800">
                        {[{ key: 'cycle', label: 'Antar Siklus' }, { key: 'project', label: 'Antar Project' }].map(m => (
                            <button
                                key={m.key}
                                type="button"
                                onClick={() => setCompareMode(m.key)}
                                className={cn(
                                    'px-2 py-1 rounded-md text-[10px] font-medium transition-all',
                                    compareMode === m.key
                                        ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                                        : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300',
                                )}
                            >
                                {m.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex items-center justify-end gap-1.5">
                    {compareMode === 'cycle' && (
                        <>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="outline" size="sm" className="h-7 w-[150px] justify-between text-[11px] font-normal px-2">
                                        <span className="truncate">{cycleModeProjectLabel}</span>
                                        <ChevronDown className="size-3 opacity-50 shrink-0" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="max-h-64 overflow-y-auto">
                                    {methodologyProjects.length === 0 && (
                                        <p className="px-2 py-1.5 text-xs text-slate-400 italic">Tidak ada project.</p>
                                    )}
                                    {methodologyProjects.map(p => (
                                        <DropdownMenuCheckboxItem
                                            key={p.id}
                                            className="text-xs"
                                            checked={cycleModeProjectIds.includes(p.id)}
                                            onSelect={(e) => e.preventDefault()}
                                            onCheckedChange={() => toggleCycleModeProject(p.id)}
                                        >
                                            {p.name}
                                        </DropdownMenuCheckboxItem>
                                    ))}
                                </DropdownMenuContent>
                            </DropdownMenu>
                            <Select value={evaluationFilter} onValueChange={setEvaluationFilter}>
                                <SelectTrigger className="h-7 w-[130px] text-[11px]"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all" className="text-xs">Seluruh Siklus</SelectItem>
                                    {evaluations.map(e => (
                                        <SelectItem key={e.id} value={String(e.id)} className="text-xs">{e.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </>
                    )}
                    {compareMode === 'project' && (
                        <div className="flex items-center gap-1.5 flex-wrap justify-end">
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="outline" size="sm" className="h-7 w-[150px] justify-between text-[11px] font-normal px-2">
                                        <span className="truncate">{projectModeProjectLabel}</span>
                                        <ChevronDown className="size-3 opacity-50 shrink-0" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="max-h-64 overflow-y-auto">
                                    {methodologyProjects.length === 0 && (
                                        <p className="px-2 py-1.5 text-xs text-slate-400 italic">Tidak ada project.</p>
                                    )}
                                    {methodologyProjects.map(p => (
                                        <DropdownMenuCheckboxItem
                                            key={p.id}
                                            className="text-xs"
                                            checked={projectModeProjectIds.includes(p.id)}
                                            onSelect={(e) => e.preventDefault()}
                                            onCheckedChange={() => toggleProjectModeProject(p.id)}
                                        >
                                            {p.name}
                                        </DropdownMenuCheckboxItem>
                                    ))}
                                </DropdownMenuContent>
                            </DropdownMenu>
                            <span className="text-[10px] text-slate-400">Siklus:</span>
                            {evaluations.map(e => {
                                const active = activeProjectModeEvalIds.includes(e.id);
                                return (
                                    <button
                                        key={e.id}
                                        type="button"
                                        onClick={() => toggleProjectModeEval(e.id)}
                                        className={cn(
                                            'text-[10px] font-medium px-2 py-1 rounded-full border transition-colors',
                                            active
                                                ? 'bg-primary/10 border-primary/30 text-primary'
                                                : 'bg-transparent border-slate-200 dark:border-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300',
                                        )}
                                        title={active ? 'Klik untuk sembunyikan dari perbandingan' : 'Klik untuk sertakan dalam perbandingan'}
                                    >
                                        {e.name}
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            <div className="p-4 space-y-3">
                {loading ? (
                    <div className="flex items-center justify-center gap-2 text-slate-400 text-xs" style={{ height: 240 }}>
                        <Loader2 className="size-4 animate-spin" /> Memuat…
                    </div>
                ) : (
                    <RadarChart axes={radar?.axes ?? []} series={coloredSeries} />
                )}

                {coloredSeries.length > 0 && (
                    <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 pt-1 border-t border-slate-100 dark:border-slate-800">
                        {coloredSeries.map(s => (
                            <div key={s.key} className="flex items-center gap-1.5 text-xs">
                                <span className="size-2 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                                <span className="text-slate-500 dark:text-slate-400">{s.label}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

/* ── Radar section — Agile Scrum & Waterfall side by side. ── */
function ReviewRadarSection({ projects }) {
    return (
        <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 flex items-center gap-1.5">
                <RadarIcon className="size-3.5" /> Detail Penilaian per Pertanyaan
            </p>
            <div className="grid md:grid-cols-2 gap-3">
                <ReviewRadarPanel methodology="Agile Scrum" projects={projects} />
                <ReviewRadarPanel methodology="Waterfall" projects={projects} />
            </div>
        </div>
    );
}

/* ── Review Dashboard — proportion charts + per-project review status list ── */
const LIST_TABS = ['all', 'Waterfall', 'Agile Scrum'];
const LIST_SORT_KEYS = ['urgent', 'name_asc', 'name_desc', 'score_desc', 'score_asc', 'recent'];

function ReviewDashboard({ summaries, projects, onOpenProject }) {
    const [activeSegment, setActiveSegment] = useState(null); // { title, items: [{ project, subtitle }] }

    // "Status Review per Project" list controls — kept in the URL (?list_tab / ?list_sort
    // / ?list_page) so a tab, sort or page is shareable, bookmarkable and survives refresh.
    const [searchParams, setSearchParams] = useSearchParams();
    const rawTab   = searchParams.get('list_tab');
    const rawSort  = searchParams.get('list_sort');
    const listTab  = LIST_TABS.includes(rawTab) ? rawTab : 'all';
    const listSort = LIST_SORT_KEYS.includes(rawSort) ? rawSort : 'urgent';
    const listPage = Math.max(1, Number(searchParams.get('list_page')) || 1);
    const [listPageSize, setListPageSize] = useState(10);

    const setListTab = (v) => setSearchParams(prev => {
        if (v === 'all') prev.delete('list_tab'); else prev.set('list_tab', v);
        prev.delete('list_page'); // back to page 1 when the tab changes
        return prev;
    });
    const setListSort = (v) => setSearchParams(prev => {
        if (v === 'urgent') prev.delete('list_sort'); else prev.set('list_sort', v);
        prev.delete('list_page');
        return prev;
    });
    const setListPage = (n) => setSearchParams(prev => {
        if (!n || n <= 1) prev.delete('list_page'); else prev.set('list_page', String(n));
        return prev;
    }, { replace: true }); // pagination shouldn't spam browser history

    if (projects.length === 0) return null;

    const withReview = projects.filter(p => summaries[p.id]?.overall != null);
    const avgScore = withReview.length > 0
        ? withReview.reduce((acc, p) => acc + summaries[p.id].overall, 0) / withReview.length
        : null;

    // Per-project status: how many of its evaluations are submitted, and — for
    // ones with nothing submitted yet — how long since a review link was first
    // generated for it (the longest-waiting evaluation, i.e. earliest link).
    const projectStatuses = projects.map(p => {
        const evals = summaries[p.id]?.data ?? [];
        const submittedCount = evals.filter(e => e.submitted).length;
        const totalCount = evals.length;
        const generatedTimes = evals.filter(e => !e.submitted).map(e => e.share?.generated_at).filter(Boolean).sort();
        const waitingSince = generatedTimes[0] ?? null;
        const submittedTimes = evals.filter(e => e.submitted && e.submitted_at).map(e => e.submitted_at).sort();
        const lastSubmittedAt = submittedTimes.length ? submittedTimes[submittedTimes.length - 1] : null;

        // Per-cycle chips: sequential "Siklus N" + its state/trigger progress.
        const cycles = evals.map((e, i) => ({
            label:   `Siklus ${i + 1}`,
            name:    e.evaluation_name,
            state:   e.cycle_state ?? (e.submitted ? 'submitted' : 'open'),
            current: e.trigger?.current ?? null,
            target:  e.trigger?.target ?? null,
        }));
        const dueCount = cycles.filter(c => c.state === 'due').length;

        let status;
        if (totalCount === 0) status = 'no_config';
        else if (submittedCount === 0) status = 'none';
        else if (submittedCount === totalCount) status = 'full';
        else status = 'partial';

        return { project: p, submittedCount, totalCount, status, waitingSince, lastSubmittedAt, cycles, dueCount };
    });

    // Grouped by status/score level — reused both for the chart segment values
    // and for the click-through modal listing which projects are in each group.
    const statusGroups = {
        full:      projectStatuses.filter(s => s.status === 'full'),
        partial:   projectStatuses.filter(s => s.status === 'partial'),
        none:      projectStatuses.filter(s => s.status === 'none'),
        no_config: projectStatuses.filter(s => s.status === 'no_config'),
    };
    const scoreGroups = {
        good: withReview.filter(p => getLevel(summaries[p.id].overall)?.key === 'good'),
        fair: withReview.filter(p => getLevel(summaries[p.id].overall)?.key === 'fair'),
        poor: withReview.filter(p => getLevel(summaries[p.id].overall)?.key === 'poor'),
    };

    // Most urgent first: not-reviewed (oldest waiting link first) → partial → no-config → fully reviewed.
    const ORDER = { none: 0, partial: 1, no_config: 2, full: 3 };
    const urgentSort = (a, b) => {
        if (ORDER[a.status] !== ORDER[b.status]) return ORDER[a.status] - ORDER[b.status];
        if (a.status === 'none' && (a.waitingSince || b.waitingSince)) {
            if (a.waitingSince && b.waitingSince) return new Date(a.waitingSince) - new Date(b.waitingSince);
            return a.waitingSince ? -1 : 1;
        }
        return (a.project.name || '').localeCompare(b.project.name || '');
    };
    const overallOf = (s) => summaries[s.project.id]?.overall;
    const LIST_SORTERS = {
        urgent:     urgentSort,
        name_asc:   (a, b) => (a.project.name || '').localeCompare(b.project.name || ''),
        name_desc:  (a, b) => (b.project.name || '').localeCompare(a.project.name || ''),
        score_desc: (a, b) => (overallOf(b) ?? -1) - (overallOf(a) ?? -1),
        score_asc:  (a, b) => (overallOf(a) ?? 101) - (overallOf(b) ?? 101),
        recent:     (a, b) => new Date(b.lastSubmittedAt || 0) - new Date(a.lastSubmittedAt || 0),
    };

    // Status list: methodology tab → sort → paginate (default 10/page).
    const wfCount = projectStatuses.filter(s => s.project.methodology === 'Waterfall').length;
    const agCount = projectStatuses.filter(s => s.project.methodology === 'Agile Scrum').length;
    const filteredStatuses = projectStatuses.filter(s => listTab === 'all' || s.project.methodology === listTab);
    const sortedStatuses   = [...filteredStatuses].sort(LIST_SORTERS[listSort] ?? urgentSort);
    const listTotal    = sortedStatuses.length;
    const listPages    = Math.max(1, Math.ceil(listTotal / listPageSize));
    // Clamp for display; an out-of-range ?list_page in the URL just resolves to
    // the last page rather than an empty list, and self-heals on the next change.
    const listPageSafe = Math.min(listPage, listPages);
    const pagedStatuses = sortedStatuses.slice((listPageSafe - 1) * listPageSize, listPageSafe * listPageSize);

    const statusSegments = [
        { key: 'full',      label: 'Sudah Direview',  value: statusGroups.full.length,      barColor: 'bg-emerald-500',              dotColor: 'bg-emerald-500' },
        { key: 'partial',   label: 'Sebagian',        value: statusGroups.partial.length,   barColor: 'bg-amber-400',                dotColor: 'bg-amber-400' },
        { key: 'none',      label: 'Belum Direview',  value: statusGroups.none.length,      barColor: 'bg-rose-400',                 dotColor: 'bg-rose-400' },
        { key: 'no_config', label: 'Tanpa Evaluasi',  value: statusGroups.no_config.length,  barColor: 'bg-slate-300 dark:bg-slate-600', dotColor: 'bg-slate-300 dark:bg-slate-600' },
    ];

    const scoreSegments = [
        { key: 'good', label: 'Baik',             value: scoreGroups.good.length, barColor: 'bg-emerald-500', dotColor: 'bg-emerald-500' },
        { key: 'fair', label: 'Cukup',            value: scoreGroups.fair.length, barColor: 'bg-amber-500',   dotColor: 'bg-amber-500' },
        { key: 'poor', label: 'Perlu Perbaikan',  value: scoreGroups.poor.length, barColor: 'bg-rose-500',    dotColor: 'bg-rose-500' },
    ];

    const statusSubtitle = ({ status, submittedCount, totalCount, waitingSince, lastSubmittedAt }) => {
        if (status === 'no_config') return 'Belum ada evaluasi aktif untuk metodologi ini';
        if (status === 'none') return waitingSince ? `Menunggu — link dibuat ${timeAgo(waitingSince)}` : 'Belum direview, link belum dibuat';
        if (status === 'partial') return `${submittedCount}/${totalCount} evaluasi direview${lastSubmittedAt ? ` · terakhir ${timeAgo(lastSubmittedAt)}` : ''}`;
        return `Semua evaluasi direview${lastSubmittedAt ? ` · terakhir ${timeAgo(lastSubmittedAt)}` : ''}`;
    };

    const openStatusSegment = (key) => {
        const label = statusSegments.find(s => s.key === key)?.label ?? '';
        setActiveSegment({
            title: `Project — ${label}`,
            items: statusGroups[key].map(g => ({ project: g.project, subtitle: statusSubtitle(g) })),
        });
    };

    const openScoreSegment = (key) => {
        const label = scoreSegments.find(s => s.key === key)?.label ?? '';
        setActiveSegment({
            title: `Project — Skor ${label}`,
            items: scoreGroups[key].map(p => ({ project: p, subtitle: `${summaries[p.id].overall.toFixed(1)}%` })),
        });
    };

    return (
        <div className="space-y-4">
            {/* Proportion charts — how projects are distributed across review status and score quality.
                Segments are clickable — opens a modal listing the matching projects. */}
            <div className="grid md:grid-cols-2 gap-3">
                <SegmentedBarChart
                    title="Status Review"
                    headline={`${withReview.length}/${projects.length}`}
                    headlineSub="project sudah direview"
                    segments={statusSegments}
                    emptyLabel="Belum ada project."
                    onSegmentClick={openStatusSegment}
                />
                <SegmentedBarChart
                    title="Distribusi Skor"
                    headline={avgScore != null ? `${avgScore.toFixed(1)}%` : '—'}
                    headlineSub="rata-rata keseluruhan"
                    segments={scoreSegments}
                    emptyLabel="Belum ada project yang direview."
                    onSegmentClick={openScoreSegment}
                />
            </div>

            {/* Segment detail modal — shared by both charts above */}
            <Dialog open={!!activeSegment} onOpenChange={(o) => !o && setActiveSegment(null)}>
                <DialogContent className="sm:max-w-md max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="text-base">{activeSegment?.title}</DialogTitle>
                    </DialogHeader>
                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                        {(activeSegment?.items ?? []).length === 0 && (
                            <p className="text-xs text-slate-400 italic py-6 text-center">Tidak ada project.</p>
                        )}
                        {(activeSegment?.items ?? []).map(({ project: p, subtitle }) => (
                            <button
                                key={p.id}
                                onClick={() => { onOpenProject(p); setActiveSegment(null); }}
                                className="w-full flex items-center justify-between gap-3 px-1 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors text-left"
                            >
                                <div className="min-w-0">
                                    <p className="text-sm font-medium text-slate-800 dark:text-white truncate">{p.name}</p>
                                    <p className="text-[11px] text-slate-400 truncate">{subtitle}</p>
                                </div>
                                <ChevronRight className="size-3.5 text-slate-300 shrink-0" />
                            </button>
                        ))}
                    </div>
                </DialogContent>
            </Dialog>

            {/* Radar chart — per-question average score, split Agile Scrum / Waterfall */}
            <ReviewRadarSection projects={projects} />

            {/* Per-project review status — who's reviewed, who's not, and how long the wait's been */}
            <div className="rounded-xl border border-white/60 bg-white/70 backdrop-blur-xl dark:border-white/10 dark:bg-[#151b28] dark:shadow-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 space-y-2.5">
                    <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-slate-800 dark:text-white">Status Review per Project</p>
                        <p className="text-[11px] text-slate-400">{listTotal} project</p>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="inline-flex rounded-lg border border-slate-200 bg-white/70 p-0.5 dark:border-white/10 dark:bg-[#0f1420]">
                            {[['all', 'Semua', projectStatuses.length], ['Waterfall', 'Waterfall', wfCount], ['Agile Scrum', 'Agile Scrum', agCount]].map(([k, label, n]) => (
                                <button
                                    key={k}
                                    type="button"
                                    onClick={() => setListTab(k)}
                                    className={cn(
                                        'h-7 px-2.5 text-xs font-medium rounded-md transition-colors',
                                        listTab === k ? 'bg-accent text-white' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200',
                                    )}
                                >
                                    {label} <span className="opacity-70">({n})</span>
                                </button>
                            ))}
                        </div>
                        <Select value={listSort} onValueChange={setListSort}>
                            <SelectTrigger className="h-7 w-[150px] text-xs">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="urgent" className="text-xs">Paling mendesak</SelectItem>
                                <SelectItem value="name_asc" className="text-xs">Nama A–Z</SelectItem>
                                <SelectItem value="name_desc" className="text-xs">Nama Z–A</SelectItem>
                                <SelectItem value="score_desc" className="text-xs">Skor tertinggi</SelectItem>
                                <SelectItem value="score_asc" className="text-xs">Skor terendah</SelectItem>
                                <SelectItem value="recent" className="text-xs">Terakhir direview</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {pagedStatuses.length === 0 && (
                        <p className="text-xs text-slate-400 italic py-8 text-center">Tidak ada project di tab ini.</p>
                    )}
                    {pagedStatuses.map(({ project: p, submittedCount, totalCount, status, waitingSince, lastSubmittedAt, cycles, dueCount }) => {
                        const style = REVIEW_STATUS_STYLE[status];
                        const Icon = style.icon;
                        return (
                            <button
                                key={p.id}
                                onClick={() => onOpenProject(p)}
                                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors text-left"
                            >
                                <div className={cn('size-8 rounded-lg flex items-center justify-center shrink-0', style.iconBg)}>
                                    <Icon className="size-4" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-medium text-slate-800 dark:text-white truncate">{p.name}</span>
                                        <span className={cn('inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded-full border shrink-0', METHODOLOGY_STYLE[p.methodology] ?? 'bg-slate-100 text-slate-400 border-slate-200')}>
                                            {p.methodology ?? '—'}
                                        </span>
                                    </div>
                                    <p className="text-[11px] text-slate-400 mt-0.5 truncate">
                                        {status === 'no_config' && 'Belum ada evaluasi aktif untuk metodologi ini'}
                                        {status === 'none' && (
                                            dueCount > 0
                                                ? `${dueCount} siklus siap diisi${waitingSince ? ` · link dibuat ${timeAgo(waitingSince)}` : ''}`
                                                : (waitingSince ? `Menunggu — link dibuat ${timeAgo(waitingSince)}` : 'Belum ada siklus yang waktunya diisi')
                                        )}
                                        {status === 'partial' && `${submittedCount}/${totalCount} siklus terisi${dueCount > 0 ? ` · ${dueCount} siap diisi` : ' · sisanya belum waktunya'}`}
                                        {status === 'full' && `Semua siklus terisi${lastSubmittedAt ? ` · terakhir ${timeAgo(lastSubmittedAt)}` : ''}`}
                                    </p>
                                    <CycleChips cycles={cycles} />
                                </div>
                                <span className={cn('shrink-0 text-[10px] font-semibold px-2 py-1 rounded-full', style.pill)}>
                                    {style.label}
                                </span>
                                <ChevronRight className="size-3.5 text-slate-300 shrink-0" />
                            </button>
                        );
                    })}
                </div>
                {listTotal > listPageSize && (
                    <div className="px-4 pb-3">
                        <PaginationControls
                            page={listPageSafe}
                            pageSize={listPageSize}
                            total={listTotal}
                            onPageChange={setListPage}
                            onPageSizeChange={setListPageSize}
                            perPageLabel="Per halaman"
                            formatShowing={(from, to, t) => `${from}–${to} dari ${t}`}
                        />
                    </div>
                )}
            </div>
        </div>
    );
}

/* ── "Terkirim"/"Disalin" badges — reused on both grid card and list row.
   Counted per review (evaluation), not per project — a project can have more
   than one review, each with its own link(s) and send/copy status. ── */
function ShareStatusBadges({ evaluations }) {
    const withLink = (evaluations ?? []).filter(e => e.share?.has_link);
    if (withLink.length === 0) return null;

    const copiedMap = readCopiedLinks();
    const copiedCount = withLink.filter(e => (e.share.token_ids ?? []).some(id => copiedMap[id])).length;
    // A review whose link already has client emails filled in counts as
    // "terkirim" too, even if the send button itself hasn't been clicked yet.
    const sentCount = withLink.filter(e => !!e.share.email_sent_at || !!e.share.has_emails).length;
    const total = withLink.length;

    return (
        <div className="flex items-center gap-1.5 flex-wrap pt-1.5 mt-1.5 border-t border-slate-100 dark:border-slate-800">
            <span className={cn(
                'inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full',
                copiedCount > 0 ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400' : 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500',
            )}>
                {copiedCount > 0 ? <ClipboardCheck className="size-2.5" /> : <Clipboard className="size-2.5" />}
                Disalin {copiedCount}/{total}
            </span>
            <span className={cn(
                'inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full',
                sentCount > 0 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400' : 'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400',
            )}>
                {sentCount > 0 ? <MailCheck className="size-2.5" /> : <MailX className="size-2.5" />}
                Terkirim ke User {sentCount}/{total}
            </span>
        </div>
    );
}

/* ── Project card (grid view) ── */
function ProjectGridCard({ project, onOpenSummary, summaryData }) {
    const s = summaryData;
    return (
        <div className="rounded-xl border border-white/60 bg-white/70 backdrop-blur-xl dark:border-white/10 dark:bg-[#151b28] shadow-sm hover:shadow-md dark:shadow-xl hover:border-primary/30 transition-all overflow-hidden">
            <div className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                    <div className={cn(
                        'size-10 rounded-xl flex items-center justify-center shrink-0',
                        project.status === 'In Progress' ? 'bg-primary/10 text-primary' : 'bg-slate-100 dark:bg-slate-800 text-slate-400',
                    )}>
                        <KanbanSquare className="size-5" />
                    </div>
                    <div className="flex flex-col items-end gap-1">
                        <span className={cn('inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded-full border', METHODOLOGY_STYLE[project.methodology] ?? 'bg-slate-100 text-slate-400 border-slate-200')}>
                            {project.methodology ?? '—'}
                        </span>
                        <span className={cn('inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded-full border', STATUS_STYLE[project.status] ?? 'bg-slate-100 text-slate-400 border-slate-200')}>
                            {project.status}
                        </span>
                    </div>
                </div>

                <p className="text-sm font-semibold text-slate-900 dark:text-white leading-snug line-clamp-2">
                    {project.name}
                </p>

                {(project.start_date || project.end_date) && (
                    <p className="text-[10px] text-slate-400 flex items-center gap-1">
                        <Clock className="size-2.5" />
                        {fmtDateWIB(project.start_date)} → {fmtDateWIB(project.end_date)}
                    </p>
                )}

                <ReviewResultBar
                    summary={s?.data}
                    overall={s?.overall}
                    onClick={() => onOpenSummary(project)}
                />
                <ShareStatusBadges evaluations={s?.data} />
            </div>
        </div>
    );
}

/* ── Project list row ── */
function ProjectListRow({ project, onOpenSummary, summaryData }) {
    const s = summaryData;
    return (
        <div className="px-4 py-3.5 bg-white/70 backdrop-blur-xl dark:bg-[#151b28] rounded-xl border border-white/60 dark:border-white/10 shadow-sm dark:shadow-xl hover:border-primary/20 transition-colors space-y-2.5">
            <div className="flex items-center gap-4">
                <div className={cn(
                    'size-9 rounded-lg flex items-center justify-center shrink-0',
                    project.status === 'In Progress' ? 'bg-primary/10 text-primary' : 'bg-slate-100 dark:bg-slate-800 text-slate-400',
                )}>
                    <KanbanSquare className="size-4" />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-slate-900 dark:text-white truncate">{project.name}</span>
                        <span className={cn('inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded-full border', METHODOLOGY_STYLE[project.methodology] ?? 'bg-slate-100 text-slate-400 border-slate-200')}>
                            {project.methodology ?? '—'}
                        </span>
                        <span className={cn('inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded-full border', STATUS_STYLE[project.status] ?? 'bg-slate-100 text-slate-400 border-slate-200')}>
                            {project.status}
                        </span>
                    </div>
                    {(project.start_date || project.end_date) && (
                        <p className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1">
                            <Clock className="size-2.5" />{fmtDateWIB(project.start_date)} → {fmtDateWIB(project.end_date)}
                        </p>
                    )}
                </div>
            </div>

            <ReviewResultBar
                summary={s?.data}
                overall={s?.overall}
                onClick={() => onOpenSummary(project)}
            />
            <ShareStatusBadges evaluations={s?.data} />
        </div>
    );
}

/* ── Page ── */
export default function Review() {
    const { user }  = useAuth();
    const canRead   = hasPermission(user, 'review.read');
    const canConfig = hasPermission(user, 'review.update');
    const canSubmit = hasPermission(user, 'review.create');

    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const view    = searchParams.get('view') === 'list' ? 'list' : 'card';
    const setView = (v) => setSearchParams(prev => { prev.set('view', v); return prev; });

    // View tab — "dashboard" (overview across all projects) / "Waterfall" / "Agile Scrum"
    // (project browsing filtered per methodology), synced to the URL (?methodology=...)
    // so it's linkable/bookmarkable, same pattern as the Aktif/Done/Favorit tabs on the Project Board.
    const methodologyTab = searchParams.get('methodology') ?? 'dashboard';
    const setMethodologyTab = (m) => setSearchParams(prev => {
        if (m === 'dashboard') prev.delete('methodology'); else prev.set('methodology', m);
        prev.delete('project');
        return prev;
    });

    // Year filter — synced to the URL (?year=...) so it's linkable/bookmarkable.
    // Defaults to the current calendar year ("tahun berjalan"). "all" shows every
    // project regardless of year.
    const currentYear = new Date().getFullYear();
    const yearParam = searchParams.get('year');
    const yearFilter = yearParam === 'all' ? 'all' : (yearParam ? Number(yearParam) : currentYear);
    const setYearFilter = (y) => setSearchParams(prev => {
        if (y === currentYear) prev.delete('year'); else prev.set('year', String(y));
        return prev;
    });

    // Summary dialog state lives in the URL (?project=<id>) so it's linkable,
    // shareable, and closes on browser back — not just local component state.
    const summaryProjectId = searchParams.get('project');
    const openSummary  = (project) => setSearchParams(prev => { prev.set('project', String(project.id)); return prev; });
    const closeSummary = () => {
        // Refresh just this project's summary so the "terkirim"/"disalin" badges on
        // its card reflect anything done inside the dialog (send email, copy link).
        if (summaryProjectId) {
            const pid = summaryProjectId;
            fetchAPI(`/projects/${pid}/reviews/summary`)
                .then(res => setSummaries(prev => ({ ...prev, [pid]: res })))
                .catch(() => {});
        }
        setSearchParams(prev => { prev.delete('project'); return prev; });
    };

    const [projects,       setProjects]       = useState([]);
    const [summaries,      setSummaries]      = useState({});
    const [loading,        setLoading]        = useState(true);
    const [page,           setPage]           = useState(1);
    const [pageSize,       setPageSize]       = useState(12);
    const [error,          setError]          = useState(null);

    const load = useCallback(async () => {
        setLoading(true); setError(null);
        try {
            // /review/projects is scoped by the Review module's "View All Projects"
            // permission: without it a user only gets their assigned projects here.
            const res = await fetchAPI('/review/projects');
            const allProjects = res.data ?? res ?? [];
            // Only projects marked eligible for review (toggled in Review Config → tab Project)
            // show up here — `review_enabled` defaults to true when absent for backward compat.
            const list = allProjects.filter(p => p.review_enabled !== false);
            setProjects(list);

            // Load summaries for all projects in parallel
            const results = await Promise.allSettled(
                list.map(p => fetchAPI(`/projects/${p.id}/reviews/summary`))
            );
            const map = {};
            results.forEach((r, i) => {
                if (r.status === 'fulfilled') map[list[i].id] = r.value;
            });
            setSummaries(map);
        } catch { setError('Gagal memuat daftar project.'); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { if (canRead) load(); else setLoading(false); }, [load, canRead]);
    useEffect(() => { setPage(1); }, [methodologyTab, yearFilter]);

    // Which year a project "belongs to" for the year filter: the year of its most
    // recent review activity (latest submission, or link generation if nothing's
    // been submitted yet) across all its evaluations — falling back to the
    // project's start_date year when it has no review activity at all yet.
    const projectYearMap = useMemo(() => {
        const map = {};
        for (const p of projects) {
            const evals = summaries[p.id]?.data ?? [];
            const dates = [];
            evals.forEach(e => {
                if (e.submitted_at) dates.push(e.submitted_at);
                if (e.share?.generated_at) dates.push(e.share.generated_at);
            });
            if (dates.length > 0) {
                map[p.id] = new Date(dates.sort().slice(-1)[0]).getFullYear();
            } else if (p.start_date) {
                map[p.id] = new Date(p.start_date).getFullYear();
            } else {
                map[p.id] = null;
            }
        }
        return map;
    }, [projects, summaries]);

    const availableYears = useMemo(() => {
        const years = new Set([currentYear]);
        Object.values(projectYearMap).forEach(y => { if (y != null) years.add(y); });
        return Array.from(years).sort((a, b) => b - a);
    }, [projectYearMap, currentYear]);

    // Projects with no determinable year (no review activity yet AND no start_date)
    // stay visible regardless of the selected year — there's no date to judge them by.
    const yearFilteredProjects = useMemo(() => {
        if (yearFilter === 'all') return projects;
        return projects.filter(p => projectYearMap[p.id] == null || projectYearMap[p.id] === yearFilter);
    }, [projects, projectYearMap, yearFilter]);

    const agileCount     = yearFilteredProjects.filter(p => p.methodology === 'Agile Scrum').length;
    const waterfallCount = yearFilteredProjects.filter(p => p.methodology === 'Waterfall').length;

    // Only "Waterfall"/"Agile Scrum" tabs browse a filtered project list; the
    // "dashboard" tab shows an overview over all projects instead (see below).
    const sortedProjects = useMemo(
        () => [...yearFilteredProjects]
            .filter(p => p.methodology === methodologyTab)
            .sort((a, b) => (a.name || '').localeCompare(b.name || '')),
        [yearFilteredProjects, methodologyTab]
    );
    const pagedProjects = useMemo(
        () => sortedProjects.slice((page - 1) * pageSize, page * pageSize),
        [sortedProjects, page, pageSize]
    );
    const summaryProject = useMemo(
        () => (summaryProjectId ? projects.find(p => String(p.id) === summaryProjectId) ?? null : null),
        [projects, summaryProjectId]
    );

    return (
        <div className="relative min-h-full overflow-hidden bg-slate-50 dark:bg-[#0B192C]">
            <div className="relative w-full px-4 py-5 sm:px-6 lg:px-8 pb-16 space-y-5">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
                        <Star className="size-6 text-primary shrink-0" />
                        Review
                    </h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        Evaluasi berkala kinerja tim per project berdasarkan metodologi yang digunakan.
                    </p>
                </div>
                <div className="flex items-center gap-2 self-start shrink-0">
                    {canConfig && (
                        <Button size="sm" variant="outline" className="gap-1.5 h-8 text-xs" onClick={() => navigate('/review/config')}>
                            <Settings2 className="size-3.5" /> Konfigurasi
                        </Button>
                    )}
                    {methodologyTab !== 'dashboard' && (
                        <div className="flex items-center rounded-lg border border-slate-200 dark:border-slate-700 p-0.5 bg-slate-50 dark:bg-slate-800">
                        {['card', 'list'].map(v => (
                            <button key={v} onClick={() => setView(v)} className={cn(
                                'flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all capitalize',
                                view === v
                                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300',
                            )}>
                                {v === 'card' ? <LayoutGrid className="size-3.5" /> : <List className="size-3.5" />}
                                {v.charAt(0).toUpperCase() + v.slice(1)}
                            </button>
                        ))}
                        </div>
                    )}
                </div>
            </div>

            {/* View tabs — Dashboard shows an overview across all projects;
                Waterfall/Agile Scrum browse the project list for that methodology.
                Year filter applies page-wide (default: tahun berjalan / current year). */}
            {projects.length > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="inline-flex rounded-xl border border-slate-200 bg-white/70 p-0.5 backdrop-blur-xl dark:border-white/10 dark:bg-[#151b28]">
                    <Button
                        type="button" variant="ghost" size="sm"
                        className={cn('h-8 gap-1.5 px-3', methodologyTab === 'dashboard' && 'bg-accent text-white hover:bg-accent hover:text-white')}
                        onClick={() => setMethodologyTab('dashboard')}
                    >
                        <LayoutDashboard className="size-3.5" />
                        Dashboard
                    </Button>
                    <Button
                        type="button" variant="ghost" size="sm"
                        className={cn('h-8 gap-1.5 px-3', methodologyTab === 'Waterfall' && 'bg-accent text-white hover:bg-accent hover:text-white')}
                        onClick={() => setMethodologyTab('Waterfall')}
                    >
                        Waterfall
                        <span className="text-xs opacity-80">({waterfallCount})</span>
                    </Button>
                    <Button
                        type="button" variant="ghost" size="sm"
                        className={cn('h-8 gap-1.5 px-3', methodologyTab === 'Agile Scrum' && 'bg-accent text-white hover:bg-accent hover:text-white')}
                        onClick={() => setMethodologyTab('Agile Scrum')}
                    >
                        Agile Scrum
                        <span className="text-xs opacity-80">({agileCount})</span>
                    </Button>
                </div>

                <Select value={String(yearFilter)} onValueChange={(v) => setYearFilter(v === 'all' ? 'all' : Number(v))}>
                    <SelectTrigger className="h-8 w-[130px] text-xs border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-[#151b28]">
                        <SelectValue placeholder="Tahun" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Semua Tahun</SelectItem>
                        {availableYears.map(y => (
                            <SelectItem key={y} value={String(y)}>Tahun {y}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                </div>
            )}

            {/* Content */}
            {!canRead ? (
                <div className="flex items-center justify-center gap-2 py-16 text-slate-500 text-sm border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
                    <Lock className="size-4" /> Anda tidak memiliki akses ke menu Review.
                </div>
            ) : loading ? (
                <div className="flex items-center justify-center gap-2 py-16 text-slate-400 text-sm">
                    <Loader2 className="size-5 animate-spin" /> Memuat…
                </div>
            ) : error ? (
                <div className="flex items-center justify-center gap-2 py-16 text-rose-500 text-sm">
                    <X className="size-4 shrink-0" /> {error}
                    <Button variant="outline" size="sm" className="ml-2 h-7 text-xs" onClick={load}>Coba lagi</Button>
                </div>
            ) : methodologyTab === 'dashboard' ? (
                yearFilteredProjects.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-slate-400 border-2 border-dashed border-slate-300/70 dark:border-white/10 rounded-xl bg-white/50 backdrop-blur-sm dark:bg-white/5">
                        <Star className="size-12 mb-3 opacity-20" />
                        <p className="text-sm font-medium">
                            {projects.length === 0 ? 'Belum ada project' : `Tidak ada project untuk ${yearFilter === 'all' ? 'filter ini' : `tahun ${yearFilter}`}`}
                        </p>
                    </div>
                ) : (
                    <ReviewDashboard summaries={summaries} projects={yearFilteredProjects} onOpenProject={openSummary} />
                )
            ) : sortedProjects.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-slate-400 border-2 border-dashed border-slate-300/70 dark:border-white/10 rounded-xl bg-white/50 backdrop-blur-sm dark:bg-white/5">
                    <Star className="size-12 mb-3 opacity-20" />
                    <p className="text-sm font-medium">Tidak ada project {methodologyTab}</p>
                </div>
            ) : view === 'card' ? (
                <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {pagedProjects.map(p => (
                            <ProjectGridCard
                                key={p.id} project={p}
                                onOpenSummary={openSummary}
                                summaryData={summaries[p.id]}
                            />
                        ))}
                    </div>
                    <PaginationControls
                        page={page} pageSize={pageSize} total={sortedProjects.length}
                        onPageChange={setPage}
                        onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
                    />
                </div>
            ) : (
                <div className="space-y-2.5">
                    {pagedProjects.map(p => (
                        <ProjectListRow
                            key={p.id} project={p}
                            onOpenSummary={openSummary}
                            summaryData={summaries[p.id]}
                        />
                    ))}
                    <PaginationControls
                        page={page} pageSize={pageSize} total={sortedProjects.length}
                        onPageChange={setPage}
                        onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
                    />
                </div>
            )}

            {/* Summary dialog — keyed by project id so switching directly from one
                project's modal to another's (e.g. via browser back/forward) fully
                remounts it, resetting sub-view state like activeEval/detailReview
                instead of leaving stale content from the previous project visible. */}
            <ReviewSummaryDialog
                key={summaryProject?.id ?? 'none'}
                open={summaryProject !== null}
                onClose={closeSummary}
                project={summaryProject}
                canSubmit={canSubmit}
                canConfig={canConfig}
            />
            </div>
        </div>
    );
}
