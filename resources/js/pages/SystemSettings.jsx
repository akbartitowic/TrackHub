import { useState, useEffect } from 'react';
import { fetchAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useAppBranding } from '../context/AppBrandingContext';
import { hasPermission } from '../utils/permissions';
import BrandingAssetUpload from '../components/settings/BrandingAssetUpload';
import {
    Settings,
    Database,
    AlertTriangle,
    RefreshCcw,
    CheckCircle2,
    ShieldAlert,
    Mail,
    Save,
    Loader2,
    Send,
    Image,
    Download,
    FileArchive,
    FileText,
    RotateCcw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { PasswordInput } from '@/components/ui/password-input';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';

const REVIEW_TEMPLATE_DEFAULTS = {
    review_invite_email_subject: 'Permintaan Review Project: {project_name}',
    review_invite_email_body:
        'Kami mengundang Anda untuk memberikan review/evaluasi atas project berikut: {project_name} ({evaluation_name}).\n\nSilakan klik tombol di bawah ini untuk mengisi review.',
};

const REVIEW_TEMPLATE_PLACEHOLDERS = [
    { token: '{project_name}', desc: 'Nama project' },
    { token: '{evaluation_name}', desc: 'Nama siklus evaluasi' },
    { token: '{app_name}', desc: 'Nama aplikasi' },
    { token: '{review_url}', desc: 'Link review (dipakai di tombol, opsional disebut di body)' },
];

const SMTP_FIELDS = [
    { name: 'mail_host', label: 'SMTP Host', placeholder: 'smtp.gmail.com', half: true },
    { name: 'mail_port', label: 'Port', placeholder: '587', half: true },
    { name: 'mail_username', label: 'Username', placeholder: 'email@example.com', half: true },
    { name: 'mail_password', label: 'Password', placeholder: '••••••••', half: true, password: true },
    { name: 'mail_encryption', label: 'Encryption', placeholder: 'tls atau ssl', half: true },
    { name: 'mail_from_address', label: 'From address', placeholder: 'no-reply@app.com', half: true },
    { name: 'mail_from_name', label: 'From name', placeholder: 'Project Tracker', half: false },
];

export default function SystemSettings() {
    const { user } = useAuth();
    const canResetData = hasPermission(user, 'settings.reset');
    const {
        app_name: initialAppName,
        app_tagline: initialAppTagline,
        login_title: initialLoginTitle,
        login_subtitle: initialLoginSubtitle,
        logo_url: logoUrl,
        favicon_url: faviconUrl,
        has_custom_logo: hasCustomLogo,
        has_custom_favicon: hasCustomFavicon,
        refreshBranding,
    } = useAppBranding();

    const [appName, setAppName] = useState(initialAppName || 'MyActivity');
    const [appTagline, setAppTagline] = useState(initialAppTagline || 'Software Management');
    const [loginTitle, setLoginTitle] = useState(initialLoginTitle || 'MyActivity');
    const [loginSubtitle, setLoginSubtitle] = useState(initialLoginSubtitle || 'Task management connected to your world.');
    const [isSavingBrandingText, setIsSavingBrandingText] = useState(false);

    useEffect(() => {
        if (initialAppName) setAppName(initialAppName);
        if (initialAppTagline) setAppTagline(initialAppTagline);
        if (initialLoginTitle) setLoginTitle(initialLoginTitle);
        if (initialLoginSubtitle) setLoginSubtitle(initialLoginSubtitle);
    }, [initialAppName, initialAppTagline, initialLoginTitle, initialLoginSubtitle]);

    const handleSaveBrandingText = async (e) => {
        e.preventDefault();
        setIsSavingBrandingText(true);
        try {
            await fetchAPI('/settings/update', {
                method: 'POST',
                body: JSON.stringify({
                    app_name: appName,
                    app_tagline: appTagline,
                    login_title: loginTitle,
                    login_subtitle: loginSubtitle,
                }),
            });
            await refreshBranding();
            alert('Pengaturan teks branding & halaman login berhasil disimpan.');
        } catch (err) {
            alert(`Gagal menyimpan: ${err.message}`);
        } finally {
            setIsSavingBrandingText(false);
        }
    };

    const handleBrandingUpdated = async (data) => {
        if (data) {
            await refreshBranding();
        }
    };

    const [isResetModalOpen, setIsResetModalOpen] = useState(false);
    const [resetStep, setResetStep] = useState(1);
    const [isLoading, setIsLoading] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');
    const [backupLoading, setBackupLoading] = useState({ sql: false, csv: false });

    const handleBackup = async (format) => {
        setBackupLoading((p) => ({ ...p, [format]: true }));
        try {
            const token = localStorage.getItem('auth_token');
            const res = await fetch(`/api/system/backup/${format}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok) throw new Error(`Backup gagal: ${res.statusText}`);
            const blob = await res.blob();
            const url  = URL.createObjectURL(blob);
            const a    = document.createElement('a');
            const cd   = res.headers.get('Content-Disposition') || '';
            const match = cd.match(/filename="(.+?)"/);
            a.href     = url;
            a.download = match ? match[1] : `backup.${format === 'csv' ? 'zip' : 'sql'}`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
        } catch (err) {
            alert(err.message || 'Gagal download backup.');
        } finally {
            setBackupLoading((p) => ({ ...p, [format]: false }));
        }
    };

    const [smtpSettings, setSmtpSettings] = useState({
        mail_host: '',
        mail_port: '',
        mail_username: '',
        mail_password: '',
        mail_encryption: 'tls',
        mail_from_address: '',
        mail_from_name: '',
    });
    const [isSmtpLoading, setIsSmtpLoading] = useState(true);
    const [isSavingSmtp, setIsSavingSmtp] = useState(false);
    const [isTestingSmtp, setIsTestingSmtp] = useState(false);

    useEffect(() => {
        const loadSettings = async () => {
            try {
                const keys = Object.keys(smtpSettings).join(',');
                const res = await fetchAPI(`/settings/all?keys=${keys}`);
                if (res.status === 'success' && res.data) {
                    setSmtpSettings((prev) => ({ ...prev, ...res.data }));
                }
            } catch (err) {
                console.error('Failed to load SMTP settings', err);
            } finally {
                setIsSmtpLoading(false);
            }
        };
        loadSettings();
    }, []);

    const handleSmtpChange = (e) => {
        const { name, value } = e.target;
        setSmtpSettings((prev) => ({ ...prev, [name]: value }));
    };

    const saveSmtpSettings = async () => {
        setIsSavingSmtp(true);
        try {
            await fetchAPI('/settings/update', {
                method: 'POST',
                body: JSON.stringify(smtpSettings),
            });
            alert('Pengaturan SMTP berhasil disimpan.');
        } catch (err) {
            alert(`Gagal menyimpan: ${err.message}`);
        } finally {
            setIsSavingSmtp(false);
        }
    };

    const testSmtpConnection = async () => {
        setIsTestingSmtp(true);
        try {
            const res = await fetchAPI('/settings/test-smtp', {
                method: 'POST',
                body: JSON.stringify(smtpSettings),
            });
            alert(res.status === 'success' ? res.message : `Gagal: ${res.message}`);
        } catch (err) {
            alert(`Error: ${err.message}`);
        } finally {
            setIsTestingSmtp(false);
        }
    };

    const [reviewTemplate, setReviewTemplate] = useState(REVIEW_TEMPLATE_DEFAULTS);
    const [isReviewTemplateLoading, setIsReviewTemplateLoading] = useState(true);
    const [isSavingReviewTemplate, setIsSavingReviewTemplate] = useState(false);

    useEffect(() => {
        const loadReviewTemplate = async () => {
            try {
                const keys = Object.keys(REVIEW_TEMPLATE_DEFAULTS).join(',');
                const res = await fetchAPI(`/settings/all?keys=${keys}`);
                if (res.status === 'success' && res.data) {
                    setReviewTemplate((prev) => ({
                        review_invite_email_subject: res.data.review_invite_email_subject || prev.review_invite_email_subject,
                        review_invite_email_body: res.data.review_invite_email_body || prev.review_invite_email_body,
                    }));
                }
            } catch (err) {
                console.error('Failed to load review email template', err);
            } finally {
                setIsReviewTemplateLoading(false);
            }
        };
        loadReviewTemplate();
    }, []);

    const handleReviewTemplateChange = (e) => {
        const { name, value } = e.target;
        setReviewTemplate((prev) => ({ ...prev, [name]: value }));
    };

    const saveReviewTemplate = async () => {
        setIsSavingReviewTemplate(true);
        try {
            await fetchAPI('/settings/update', {
                method: 'POST',
                body: JSON.stringify(reviewTemplate),
            });
            alert('Template email review berhasil disimpan.');
        } catch (err) {
            alert(`Gagal menyimpan: ${err.message}`);
        } finally {
            setIsSavingReviewTemplate(false);
        }
    };

    const resetReviewTemplate = () => {
        setReviewTemplate(REVIEW_TEMPLATE_DEFAULTS);
    };

    const handleResetData = async () => {
        setIsLoading(true);
        try {
            const res = await fetchAPI('/system/reset', { method: 'POST' });
            if (res.status === 'success') {
                setSuccessMessage(res.message);
                setResetStep(3);
            } else {
                alert(res.message || 'Gagal reset data');
                setIsResetModalOpen(false);
            }
        } catch (err) {
            alert(`Error: ${err.message}`);
            setIsResetModalOpen(false);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-full bg-slate-50/80 dark:bg-background-dark">
            <div className="w-full space-y-6 px-4 py-5 sm:px-6 lg:px-8 pb-16">
                <header className="flex items-start gap-3">
                    <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <Settings className="size-5" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Settings</h1>
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                            Logo aplikasi, favicon browser, email, dan pemeliharaan data.
                        </p>
                    </div>
                </header>

                <Card className="border-slate-200/90 shadow-none dark:border-slate-800">
                    <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2 text-base">
                            <Image className="size-4 text-primary" />
                            Branding
                        </CardTitle>
                        <CardDescription>Logo sidebar/login dan ikon tab browser.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <form onSubmit={handleSaveBrandingText} className="space-y-4 rounded-xl border border-slate-200/80 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-900/40">
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                                        Nama Aplikasi (Global)
                                    </label>
                                    <Input
                                        type="text"
                                        value={appName}
                                        onChange={(e) => setAppName(e.target.value)}
                                        placeholder="Contoh: MyActivity"
                                        required
                                        className="bg-white dark:bg-slate-950"
                                    />
                                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                        Ditampilkan di header sidebar dan judul default aplikasi.
                                    </p>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                                        Tagline Sidebar
                                    </label>
                                    <Input
                                        type="text"
                                        value={appTagline}
                                        onChange={(e) => setAppTagline(e.target.value)}
                                        placeholder="Contoh: SOFTWARE MANAGEMENT"
                                        className="bg-white dark:bg-slate-950"
                                    />
                                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                        Teks keterangan kecil di bawah nama aplikasi pada sidebar.
                                    </p>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                                        Teks Judul Login
                                    </label>
                                    <Input
                                        type="text"
                                        value={loginTitle}
                                        onChange={(e) => setLoginTitle(e.target.value)}
                                        placeholder="Contoh: MyActivity"
                                        className="bg-white dark:bg-slate-950"
                                    />
                                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                        Teks judul besar di sebelah logo pada panel halaman login.
                                    </p>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                                        Deskripsi Halaman Login
                                    </label>
                                    <Input
                                        type="text"
                                        value={loginSubtitle}
                                        onChange={(e) => setLoginSubtitle(e.target.value)}
                                        placeholder="Contoh: Task management connected to your world."
                                        className="bg-white dark:bg-slate-950"
                                    />
                                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                        Teks keterangan/moto di bawah logo pada panel halaman login.
                                    </p>
                                </div>
                            </div>
                            <div className="flex justify-end pt-1">
                                <Button type="submit" disabled={isSavingBrandingText} size="sm" className="gap-1.5">
                                    {isSavingBrandingText ? (
                                        <Loader2 className="size-3.5 animate-spin" />
                                    ) : (
                                        <Save className="size-3.5" />
                                    )}
                                    Simpan Teks Branding
                                </Button>
                            </div>
                        </form>

                        <div className="border-t border-slate-200/80 pt-4 dark:border-slate-800 space-y-4">
                            <BrandingAssetUpload
                                kind="logo"
                                label="Logo aplikasi"
                                description="Dipakai di sidebar, halaman login, dan default quotation PDF."
                                previewUrl={logoUrl}
                                hasCustom={hasCustomLogo}
                                onUpdated={handleBrandingUpdated}
                                onError={(msg) => alert(msg)}
                            />
                            <BrandingAssetUpload
                                kind="favicon"
                                label="Favicon (tab browser)"
                                description="Ikon di tab browser. Disarankan PNG persegi, min. 32×32 px."
                                previewUrl={faviconUrl}
                                hasCustom={hasCustomFavicon}
                                onUpdated={handleBrandingUpdated}
                                onError={(msg) => alert(msg)}
                            />
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-slate-200/90 shadow-none dark:border-slate-800">
                    <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2 text-base">
                            <Mail className="size-4 text-primary" />
                            Email (SMTP)
                        </CardTitle>
                        <CardDescription>Server untuk notifikasi dan email sistem.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {isSmtpLoading ? (
                            <div className="flex justify-center py-10">
                                <Loader2 className="size-6 animate-spin text-primary" />
                            </div>
                        ) : (
                            <>
                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                    {SMTP_FIELDS.map((field) => (
                                        <div
                                            key={field.name}
                                            className={field.half ? 'space-y-1.5' : 'space-y-1.5 sm:col-span-2'}
                                        >
                                            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                                {field.label}
                                            </label>
                                            {field.password ? (
                                                <PasswordInput
                                                    name={field.name}
                                                    value={smtpSettings[field.name]}
                                                    onChange={handleSmtpChange}
                                                    placeholder={field.placeholder}
                                                    className="h-9"
                                                />
                                            ) : (
                                                <Input
                                                    name={field.name}
                                                    value={smtpSettings[field.name]}
                                                    onChange={handleSmtpChange}
                                                    placeholder={field.placeholder}
                                                    className="h-9"
                                                />
                                            )}
                                        </div>
                                    ))}
                                </div>
                                <div className="flex flex-col gap-2 border-t border-slate-100 pt-4 dark:border-slate-800 sm:flex-row">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        className="gap-1.5 sm:flex-1"
                                        onClick={testSmtpConnection}
                                        disabled={isTestingSmtp || !smtpSettings.mail_host}
                                    >
                                        {isTestingSmtp ? (
                                            <Loader2 className="size-4 animate-spin" />
                                        ) : (
                                            <Send className="size-4" />
                                        )}
                                        Tes koneksi
                                    </Button>
                                    <Button
                                        type="button"
                                        className="gap-1.5 sm:flex-1"
                                        onClick={saveSmtpSettings}
                                        disabled={isSavingSmtp}
                                    >
                                        {isSavingSmtp ? (
                                            <Loader2 className="size-4 animate-spin" />
                                        ) : (
                                            <Save className="size-4" />
                                        )}
                                        Simpan
                                    </Button>
                                </div>
                            </>
                        )}
                    </CardContent>
                </Card>

                {hasPermission(user, 'settings.update') && (
                    <Card className="border-slate-200/90 shadow-none dark:border-slate-800">
                        <CardHeader className="pb-3">
                            <CardTitle className="flex items-center gap-2 text-base">
                                <FileText className="size-4 text-primary" />
                                Template Email Review
                            </CardTitle>
                            <CardDescription>
                                Subject dan isi email undangan review yang dikirim ke client. Berlaku sebagai default —
                                masih bisa diedit ulang saat mengirim per link di halaman Review.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {isReviewTemplateLoading ? (
                                <div className="flex justify-center py-10">
                                    <Loader2 className="size-6 animate-spin text-primary" />
                                </div>
                            ) : (
                                <>
                                    <div className="space-y-1.5">
                                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Subject</label>
                                        <Input
                                            name="review_invite_email_subject"
                                            value={reviewTemplate.review_invite_email_subject}
                                            onChange={handleReviewTemplateChange}
                                            placeholder={REVIEW_TEMPLATE_DEFAULTS.review_invite_email_subject}
                                            className="h-9"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Isi email</label>
                                        <Textarea
                                            name="review_invite_email_body"
                                            value={reviewTemplate.review_invite_email_body}
                                            onChange={handleReviewTemplateChange}
                                            placeholder={REVIEW_TEMPLATE_DEFAULTS.review_invite_email_body}
                                            rows={5}
                                            className="text-sm"
                                        />
                                    </div>
                                    <div className="rounded-lg border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/40 p-3">
                                        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1.5">Placeholder yang tersedia</p>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
                                            {REVIEW_TEMPLATE_PLACEHOLDERS.map((p) => (
                                                <p key={p.token} className="text-xs text-slate-600 dark:text-slate-400">
                                                    <code className="text-[11px] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-1 py-0.5 font-mono text-primary">{p.token}</code>
                                                    {' '}— {p.desc}
                                                </p>
                                            ))}
                                        </div>
                                        <p className="text-[11px] text-slate-400 mt-2">
                                            Tombol "Isi Review" dan link fallback selalu otomatis mengarah ke link review yang benar,
                                            terlepas apakah {'{review_url}'} disebut di isi email atau tidak.
                                        </p>
                                    </div>
                                    <div className="flex flex-col gap-2 border-t border-slate-100 pt-4 dark:border-slate-800 sm:flex-row">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            className="gap-1.5 sm:flex-1"
                                            onClick={resetReviewTemplate}
                                        >
                                            <RotateCcw className="size-4" />
                                            Reset ke default
                                        </Button>
                                        <Button
                                            type="button"
                                            className="gap-1.5 sm:flex-1"
                                            onClick={saveReviewTemplate}
                                            disabled={isSavingReviewTemplate}
                                        >
                                            {isSavingReviewTemplate ? (
                                                <Loader2 className="size-4 animate-spin" />
                                            ) : (
                                                <Save className="size-4" />
                                            )}
                                            Simpan
                                        </Button>
                                    </div>
                                </>
                            )}
                        </CardContent>
                    </Card>
                )}

                {hasPermission(user, 'settings.update') && (
                    <Card className="border-slate-200 shadow-none dark:border-slate-800">
                        <CardHeader className="pb-3">
                            <CardTitle className="flex items-center gap-2 text-base">
                                <Download className="size-4 text-primary" />
                                Backup data
                            </CardTitle>
                            <CardDescription>
                                Unduh seluruh data sebagai file SQL atau CSV (ZIP). Direkomendasikan sebelum reset.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <p className="text-sm text-slate-600 dark:text-slate-400 max-w-md">
                                SQL menghasilkan file <code className="text-xs bg-slate-100 dark:bg-slate-800 px-1 rounded">.sql</code> berisi INSERT statement semua tabel.
                                CSV menghasilkan <code className="text-xs bg-slate-100 dark:bg-slate-800 px-1 rounded">.zip</code> berisi satu file per tabel.
                            </p>
                            <div className="flex gap-2 shrink-0">
                                <Button variant="outline" size="sm" className="gap-1.5"
                                    disabled={backupLoading.sql}
                                    onClick={() => handleBackup('sql')}>
                                    {backupLoading.sql
                                        ? <Loader2 className="size-4 animate-spin" />
                                        : <Database className="size-4" />}
                                    SQL
                                </Button>
                                <Button variant="outline" size="sm" className="gap-1.5"
                                    disabled={backupLoading.csv}
                                    onClick={() => handleBackup('csv')}>
                                    {backupLoading.csv
                                        ? <Loader2 className="size-4 animate-spin" />
                                        : <FileArchive className="size-4" />}
                                    CSV (ZIP)
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {canResetData && (
                    <Card className="border-rose-200/80 bg-rose-50/30 shadow-none dark:border-rose-900/40 dark:bg-rose-950/10">
                        <CardHeader className="pb-3">
                            <CardTitle className="flex items-center gap-2 text-base text-rose-800 dark:text-rose-300">
                                <Database className="size-4" />
                                Pemeliharaan data
                            </CardTitle>
                            <CardDescription className="text-rose-700/80 dark:text-rose-400/80">
                                Hapus data transaksi. User, role, dan permission tetap ada.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                            <p className="text-sm text-slate-600 dark:text-slate-400 max-w-md">
                                Menghapus project, task, manhour, finance, dan log. Tindakan tidak dapat dibatalkan.
                            </p>
                            <Button
                                variant="destructive"
                                size="sm"
                                className="shrink-0 gap-1.5"
                                onClick={() => {
                                    setIsResetModalOpen(true);
                                    setResetStep(1);
                                    setSuccessMessage('');
                                }}
                            >
                                <RefreshCcw className="size-4" />
                                Reset data
                            </Button>
                        </CardContent>
                    </Card>
                )}
            </div>

            {canResetData && (
                <Dialog open={isResetModalOpen} onOpenChange={setIsResetModalOpen}>
                    <DialogContent className="sm:max-w-md">
                        {resetStep === 1 && (
                            <>
                                <DialogHeader>
                                    <DialogTitle className="flex items-center gap-2">
                                        <AlertTriangle className="size-5 text-rose-500" />
                                        Reset data transaksi?
                                    </DialogTitle>
                                    <DialogDescription>
                                        Semua project dan data terkait akan dihapus permanen.
                                    </DialogDescription>
                                </DialogHeader>
                                <DialogFooter className="gap-2 sm:gap-0">
                                    <Button variant="outline" onClick={() => setIsResetModalOpen(false)}>
                                        Batal
                                    </Button>
                                    <Button variant="destructive" onClick={() => setResetStep(2)}>
                                        Lanjut
                                    </Button>
                                </DialogFooter>
                            </>
                        )}
                        {resetStep === 2 && (
                            <>
                                <DialogHeader>
                                    <DialogTitle className="flex items-center gap-2">
                                        <ShieldAlert className="size-5 text-amber-500" />
                                        Konfirmasi terakhir
                                    </DialogTitle>
                                    <DialogDescription>
                                        User dan role tidak terhapus. Data project akan hilang selamanya.
                                    </DialogDescription>
                                </DialogHeader>
                                <DialogFooter className="gap-2 sm:gap-0">
                                    <Button variant="outline" onClick={() => setIsResetModalOpen(false)}>
                                        Batal
                                    </Button>
                                    <Button variant="destructive" onClick={handleResetData} disabled={isLoading}>
                                        {isLoading && <Loader2 className="mr-1 size-4 animate-spin" />}
                                        Ya, reset
                                    </Button>
                                </DialogFooter>
                            </>
                        )}
                        {resetStep === 3 && (
                            <>
                                <div className="flex flex-col items-center py-4 text-center">
                                    <CheckCircle2 className="mb-3 size-12 text-emerald-500" />
                                    <DialogTitle>Berhasil</DialogTitle>
                                    <DialogDescription className="mt-2">{successMessage}</DialogDescription>
                                </div>
                                <DialogFooter>
                                    <Button className="w-full" onClick={() => window.location.reload()}>
                                        Muat ulang halaman
                                    </Button>
                                </DialogFooter>
                            </>
                        )}
                    </DialogContent>
                </Dialog>
            )}
        </div>
    );
}
