import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
    Star, Loader2, X, CheckCircle2, Info,
    User, Building2, Briefcase, ChevronRight, Send,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

async function fetchPublic(path, opts = {}) {
    const res = await fetch(`/api${path}`, {
        ...opts,
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            ...(opts.headers ?? {}),
        },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error ?? data.message ?? `HTTP ${res.status}`);
    return data;
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
                        'flex size-8 items-center justify-center rounded-md border text-sm font-semibold transition-colors',
                        s === value
                            ? 'border-primary bg-primary text-white'
                            : 'border-slate-200 bg-white text-slate-500 hover:border-primary/50 hover:text-primary',
                    )}
                >
                    {s}
                </button>
            ))}
            {value > 0 && <span className="ml-1.5 text-sm text-slate-500">{value}/10</span>}
        </div>
    );
}

/* ── Step indicator ── */
function StepDot({ active, done, label }) {
    return (
        <div className="flex flex-col items-center gap-1">
            <div className={cn(
                'size-7 rounded-full flex items-center justify-center text-xs font-bold transition-all',
                done  ? 'bg-emerald-500 text-white' :
                active ? 'bg-primary text-white ring-4 ring-primary/20' :
                         'bg-slate-200 text-slate-400',
            )}>
                {done ? <CheckCircle2 className="size-4" /> : label}
            </div>
            <span className={cn('text-[10px] font-medium', active ? 'text-primary' : 'text-slate-400')}>{label === 1 ? 'Identitas' : 'Review'}</span>
        </div>
    );
}

export default function PublicReview() {
    const { token } = useParams();

    const [formData,  setFormData]  = useState(null);   // evaluation + questions
    const [loading,   setLoading]   = useState(true);
    const [error,     setError]     = useState(null);   // fatal error (link inactive etc.)
    const [step,      setStep]      = useState(1);      // 1 = identity, 2 = questions, 3 = done

    // Step 1 fields
    const [name,      setName]      = useState('');
    const [company,   setCompany]   = useState('');
    const [position,  setPosition]  = useState('');

    // Step 2 fields
    const [answers,   setAnswers]   = useState([]);
    const [notes,     setNotes]     = useState('');
    const [saving,    setSaving]    = useState(false);
    const [submitErr, setSubmitErr] = useState(null);

    useEffect(() => {
        fetchPublic(`/public/review/${token}`)
            .then(res => {
                setFormData(res.data);
                setAnswers((res.data.questions ?? [])
                    .filter(q => q.has_weight !== false)
                    .map(q => ({ question_id: q.id, score: 0, comment: '' })));
            })
            .catch(e => setError(e.message))
            .finally(() => setLoading(false));
    }, [token]);

    const step1Valid = name.trim() && company.trim();
    const step2Valid = answers.every(a => a.score > 0);

    const handleSubmit = async () => {
        if (!step2Valid) return;
        setSaving(true); setSubmitErr(null);
        try {
            await fetchPublic(`/public/review/${token}/submit`, {
                method: 'POST',
                body: JSON.stringify({
                    reviewer_name:     name.trim(),
                    reviewer_company:  company.trim(),
                    reviewer_position: position.trim() || null,
                    answers,
                    notes: notes.trim() || null,
                }),
            });
            setStep(3);
        } catch (e) { setSubmitErr(e.message); }
        finally { setSaving(false); }
    };

    /* ── Layout wrapper ── */
    return (
        <div className="min-h-screen bg-slate-50 flex flex-col">
            {/* Top bar */}
            <header className="bg-white border-b border-slate-200 px-4 py-3 flex items-center gap-2">
                <div className="size-7 rounded-lg bg-primary flex items-center justify-center shrink-0">
                    <Star className="size-4 text-white fill-white" />
                </div>
                <span className="text-sm font-bold text-slate-800">MyActivity</span>
                <span className="text-slate-300 mx-1">·</span>
                <span className="text-sm text-slate-500">Form Review</span>
            </header>

            <main className="flex-1 flex items-start justify-center p-4 pt-8">
                <div className="w-full max-w-xl">

                    {/* Loading */}
                    {loading && (
                        <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-400">
                            <Loader2 className="size-8 animate-spin" />
                            <p className="text-sm">Memuat form…</p>
                        </div>
                    )}

                    {/* Fatal error (link invalid/inactive) */}
                    {!loading && error && (
                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 text-center space-y-3">
                            <div className="size-14 rounded-full bg-rose-50 flex items-center justify-center mx-auto">
                                <X className="size-7 text-rose-500" />
                            </div>
                            <h2 className="text-lg font-bold text-slate-800">Link Tidak Tersedia</h2>
                            <p className="text-sm text-slate-500">{error}</p>
                        </div>
                    )}

                    {/* Done / thank you */}
                    {!loading && !error && step === 3 && (
                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 text-center space-y-3">
                            <div className="size-14 rounded-full bg-emerald-50 flex items-center justify-center mx-auto">
                                <CheckCircle2 className="size-7 text-emerald-500" />
                            </div>
                            <h2 className="text-lg font-bold text-slate-800">Terima Kasih!</h2>
                            <p className="text-sm text-slate-500">
                                Review Anda untuk <strong>{formData?.project_name}</strong> sudah kami terima.
                            </p>
                            <p className="text-xs text-slate-400 pt-2">Anda dapat menutup halaman ini.</p>
                        </div>
                    )}

                    {/* Form */}
                    {!loading && !error && step < 3 && formData && (
                        <div className="space-y-5">
                            {/* Project + eval info */}
                            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-1.5">
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{formData.project_name}</p>
                                <h1 className="text-xl font-bold text-slate-900">{formData.evaluation_name}</h1>
                                {formData.expires_at && (
                                    <p className="text-xs text-amber-600 font-medium pt-0.5">
                                        Aktif hingga: {new Date(formData.expires_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                                    </p>
                                )}
                            </div>

                            {/* Step indicator */}
                            <div className="flex items-center justify-center gap-4">
                                <StepDot active={step === 1} done={step > 1} label={1} />
                                <div className="flex-1 max-w-16 h-px bg-slate-200" />
                                <StepDot active={step === 2} done={step > 2} label={2} />
                            </div>

                            {/* Step 1: Identity */}
                            {step === 1 && (
                                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
                                    <div>
                                        <h2 className="text-base font-bold text-slate-800">Identitas Anda</h2>
                                        <p className="text-sm text-slate-400 mt-0.5">Digunakan untuk mencatat siapa yang memberikan review.</p>
                                    </div>

                                    <div className="space-y-3">
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                                                <User className="size-3.5 text-slate-400" /> Nama Lengkap <span className="text-rose-400">*</span>
                                            </label>
                                            <Input
                                                autoFocus
                                                value={name}
                                                onChange={e => setName(e.target.value)}
                                                placeholder="Nama Anda…"
                                                className="h-10"
                                            />
                                        </div>

                                        <div className="space-y-1.5">
                                            <label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                                                <Building2 className="size-3.5 text-slate-400" /> Perusahaan <span className="text-rose-400">*</span>
                                            </label>
                                            <Input
                                                value={company}
                                                onChange={e => setCompany(e.target.value)}
                                                placeholder="Nama perusahaan Anda…"
                                                className="h-10"
                                            />
                                        </div>

                                        <div className="space-y-1.5">
                                            <label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                                                <Briefcase className="size-3.5 text-slate-400" /> Jabatan <span className="text-slate-400 font-normal">(opsional)</span>
                                            </label>
                                            <Input
                                                value={position}
                                                onChange={e => setPosition(e.target.value)}
                                                placeholder="Jabatan / posisi Anda…"
                                                className="h-10"
                                            />
                                        </div>
                                    </div>

                                    <Button
                                        className="w-full gap-2"
                                        disabled={!step1Valid}
                                        onClick={() => setStep(2)}
                                    >
                                        Lanjut ke Review <ChevronRight className="size-4" />
                                    </Button>
                                </div>
                            )}

                            {/* Step 2: Questions */}
                            {step === 2 && (
                                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-5">
                                    <div className="flex items-start justify-between gap-2">
                                        <div>
                                            <h2 className="text-base font-bold text-slate-800">Form Review</h2>
                                            <p className="text-sm text-slate-400 mt-0.5">
                                                Halo <strong>{name}</strong>, berikan penilaian Anda di bawah ini.
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => setStep(1)}
                                            className="text-xs text-primary hover:underline shrink-0 mt-1"
                                        >
                                            ← Ubah identitas
                                        </button>
                                    </div>

                                    <div className="space-y-5 divide-y divide-slate-100">
                                        {formData.questions.map((q, idx) => {
                                            const isWeighted = q.has_weight !== false;
                                            const answer = answers.find(a => a.question_id === q.id);
                                            return (
                                                <div key={q.id} className="pt-4 first:pt-0 space-y-2.5">
                                                    <div className="flex items-start gap-2.5">
                                                        <span className="size-6 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                                                            {idx + 1}
                                                        </span>
                                                        <div className="flex-1">
                                                            <p className="text-sm font-medium text-slate-800 leading-snug">{q.question}</p>
                                                            {q.description && (
                                                                <p className="text-[11px] text-slate-400 mt-1 flex gap-1.5">
                                                                    <Info className="size-3 shrink-0 mt-0.5" />{q.description}
                                                                </p>
                                                            )}
                                                            {!isWeighted && (
                                                                <p className="text-[10px] text-slate-400 mt-0.5">Informasi — tidak dinilai</p>
                                                            )}
                                                        </div>
                                                    </div>
                                                    {isWeighted && (
                                                        <div className="pl-8 space-y-2">
                                                            <ScoreInput
                                                                value={answer.score}
                                                                onChange={s => setAnswers(prev => prev.map(a => a.question_id === q.id ? { ...a, score: s } : a))}
                                                            />
                                                            <textarea
                                                                rows={1}
                                                                placeholder="Komentar (opsional)…"
                                                                value={answer.comment}
                                                                onChange={e => setAnswers(prev => prev.map(a => a.question_id === q.id ? { ...a, comment: e.target.value } : a))}
                                                                className="w-full text-xs rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-primary text-slate-700"
                                                            />
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {/* General notes */}
                                    <div className="space-y-1.5 pt-2 border-t border-slate-100">
                                        <label className="text-xs font-semibold text-slate-500">Catatan Umum (opsional)</label>
                                        <textarea
                                            rows={3}
                                            placeholder="Ceritakan pengalaman Anda bekerja sama dengan tim…"
                                            value={notes}
                                            onChange={e => setNotes(e.target.value)}
                                            className="w-full text-sm rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 resize-none focus:outline-none focus:ring-1 focus:ring-primary text-slate-700"
                                        />
                                    </div>

                                    {submitErr && (
                                        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm text-rose-700">
                                            {submitErr}
                                        </div>
                                    )}

                                    <Button
                                        className="w-full gap-2"
                                        disabled={!step2Valid || saving}
                                        onClick={handleSubmit}
                                    >
                                        {saving
                                            ? <><Loader2 className="size-4 animate-spin" /> Mengirim…</>
                                            : <><Send className="size-4" /> Kirim Review</>
                                        }
                                    </Button>

                                    {!step2Valid && (
                                        <p className="text-center text-xs text-slate-400">Semua pertanyaan wajib diberi skor.</p>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </main>

            <footer className="py-4 text-center text-[11px] text-slate-400">
                Powered by MyActivity
            </footer>
        </div>
    );
}
