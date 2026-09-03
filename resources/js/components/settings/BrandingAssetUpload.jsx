import { useEffect, useRef, useState } from 'react';
import { getApiUrl } from '../../services/api';
import { Button } from '@/components/ui/button';
import { Loader2, Upload, Save, CheckCircle2, AlertCircle, X, RotateCcw, Image as ImageIcon } from 'lucide-react';

export default function BrandingAssetUpload({
    kind,
    label,
    description,
    previewUrl,
    hasCustom = false,
    disabled,
    onUpdated,
    onError,
}) {
    const fileInputRef = useRef(null);
    const [uploading, setUploading] = useState(false);
    const [selectedFile, setSelectedFile] = useState(null);
    const [preview, setPreview] = useState(previewUrl || null);
    const [statusMessage, setStatusMessage] = useState(null); // { type: 'success' | 'error', text: string, detail?: string }

    const fieldName = kind === 'favicon' ? 'favicon' : 'logo';
    const uploadPath = kind === 'favicon' ? '/settings/branding/favicon' : '/settings/branding/logo';
    const deletePath = uploadPath;

    useEffect(() => {
        if (!selectedFile) {
            setPreview(previewUrl || null);
        }
    }, [previewUrl, selectedFile]);

    useEffect(() => {
        return () => {
            if (preview && preview.startsWith('blob:')) {
                URL.revokeObjectURL(preview);
            }
        };
    }, [preview]);

    const onFileChange = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setStatusMessage(null);

        if (file.size > 4 * 1024 * 1024) {
            const errText = 'Ukuran file maksimal 4 MB.';
            setStatusMessage({ type: 'error', text: errText });
            onError?.(errText);
            return;
        }

        if (preview && preview.startsWith('blob:')) {
            URL.revokeObjectURL(preview);
        }

        const objectUrl = URL.createObjectURL(file);
        setSelectedFile(file);
        setPreview(objectUrl);
    };

    const handleCancelSelection = () => {
        if (preview && preview.startsWith('blob:')) {
            URL.revokeObjectURL(preview);
        }
        setSelectedFile(null);
        setPreview(previewUrl || null);
        setStatusMessage(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleSaveUpload = async () => {
        if (!selectedFile) return;

        const token = localStorage.getItem('auth_token');
        const formData = new FormData();
        formData.append(fieldName, selectedFile);

        setUploading(true);
        setStatusMessage(null);

        try {
            const fullUrl = `${getApiUrl()}${uploadPath}`;
            const response = await fetch(fullUrl, {
                method: 'POST',
                credentials: 'omit',
                headers: {
                    Accept: 'application/json',
                    ...(token
                        ? {
                              Authorization: `Bearer ${token}`,
                              'X-Authorization': `Bearer ${token}`,
                          }
                        : {}),
                },
                body: formData,
            });

            const data = await response.json().catch(() => ({}));

            if (!response.ok) {
                const errorMsg = data.message || `HTTP ${response.status}: Gagal menyimpan ${fieldName}`;
                const detailMsg = data.errors ? JSON.stringify(data.errors) : undefined;
                setStatusMessage({
                    type: 'error',
                    text: errorMsg,
                    detail: detailMsg,
                });
                onError?.(errorMsg);
                return;
            }

            if (preview && preview.startsWith('blob:')) {
                URL.revokeObjectURL(preview);
            }

            const updatedUrl = kind === 'favicon' ? data.data?.favicon_url : data.data?.logo_url;
            setPreview(updatedUrl || null);
            setSelectedFile(null);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }

            setStatusMessage({
                type: 'success',
                text: `${label} berhasil disimpan ke server dan diperbarui di sistem.`,
            });

            onUpdated?.(data.data);
        } catch (e) {
            const errText = e.message || 'Terjadi kesalahan jaringan saat upload.';
            setStatusMessage({
                type: 'error',
                text: `Gagal upload: ${errText}`,
            });
            onError?.(errText);
        } finally {
            setUploading(false);
        }
    };

    const handleResetDefault = async () => {
        if (!window.confirm(`Yakin ingin mereset ${label.toLowerCase()} ke default?`)) {
            return;
        }

        const token = localStorage.getItem('auth_token');
        setUploading(true);
        setStatusMessage(null);

        try {
            const fullUrl = `${getApiUrl()}${deletePath}`;
            const response = await fetch(fullUrl, {
                method: 'DELETE',
                credentials: 'omit',
                headers: {
                    Accept: 'application/json',
                    ...(token
                        ? {
                              Authorization: `Bearer ${token}`,
                              'X-Authorization': `Bearer ${token}`,
                          }
                        : {}),
                },
            });

            const data = await response.json().catch(() => ({}));

            if (!response.ok) {
                const errorMsg = data.message || `HTTP ${response.status}: Gagal reset ${fieldName}`;
                setStatusMessage({
                    type: 'error',
                    text: errorMsg,
                });
                onError?.(errorMsg);
                return;
            }

            if (preview && preview.startsWith('blob:')) {
                URL.revokeObjectURL(preview);
            }

            const defaultUrl = kind === 'favicon' ? data.data?.favicon_url : data.data?.logo_url;
            setPreview(defaultUrl || null);
            setSelectedFile(null);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }

            setStatusMessage({
                type: 'success',
                text: `${label} berhasil di-reset ke default.`,
            });

            onUpdated?.(data.data);
        } catch (e) {
            const errText = e.message || 'Terjadi kesalahan jaringan saat reset.';
            setStatusMessage({
                type: 'error',
                text: `Gagal reset: ${errText}`,
            });
            onError?.(errText);
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-800 bg-white dark:bg-slate-900/50 space-y-3">
            <div>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                    <ImageIcon className="size-4 text-primary" />
                    {label}
                </p>
                {description && (
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{description}</p>
                )}
            </div>

            {/* Status Alert Banner */}
            {statusMessage && (
                <div
                    className={`flex items-start gap-2.5 p-3 rounded-md text-xs font-medium ${
                        statusMessage.type === 'success'
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                            : 'bg-rose-50 text-rose-800 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800'
                    }`}
                >
                    {statusMessage.type === 'success' ? (
                        <CheckCircle2 className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
                    ) : (
                        <AlertCircle className="size-4 shrink-0 text-rose-600 dark:text-rose-400 mt-0.5" />
                    )}
                    <div className="flex-1 space-y-1">
                        <p>{statusMessage.text}</p>
                        {statusMessage.detail && (
                            <p className="font-mono text-[11px] opacity-90">{statusMessage.detail}</p>
                        )}
                    </div>
                    <button
                        type="button"
                        onClick={() => setStatusMessage(null)}
                        className="opacity-70 hover:opacity-100 p-0.5"
                    >
                        <X className="size-3.5" />
                    </button>
                </div>
            )}

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                {/* Image Preview Box */}
                <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900 shadow-sm relative">
                    {preview ? (
                        <img
                            src={preview}
                            alt={label}
                            className="max-h-full max-w-full object-contain p-1"
                        />
                    ) : (
                        <span className="text-[10px] text-slate-400 font-medium">Default</span>
                    )}
                    {selectedFile && (
                        <span className="absolute bottom-0 inset-x-0 bg-primary/90 text-[8px] text-white text-center py-0.5 font-bold uppercase tracking-wider">
                            Baru
                        </span>
                    )}
                </div>

                {/* Controls */}
                <div className="flex flex-col gap-2 flex-1">
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/gif,image/webp,image/x-icon,.ico"
                        className="hidden"
                        disabled={disabled || uploading}
                        onChange={onFileChange}
                    />

                    {selectedFile ? (
                        <div className="space-y-2">
                            <p className="text-xs text-slate-600 dark:text-slate-300 font-medium truncate">
                                File dipilih: <span className="font-semibold text-primary">{selectedFile.name}</span>{' '}
                                <span className="text-slate-400">({(selectedFile.size / 1024).toFixed(1)} KB)</span>
                            </p>
                            <div className="flex flex-wrap items-center gap-2">
                                <Button
                                    type="button"
                                    size="sm"
                                    className="gap-1.5 bg-primary hover:bg-primary/90 text-white font-medium shadow-sm"
                                    disabled={disabled || uploading}
                                    onClick={handleSaveUpload}
                                >
                                    {uploading ? (
                                        <>
                                            <Loader2 className="size-3.5 animate-spin" />
                                            Menyimpan...
                                        </>
                                    ) : (
                                        <>
                                            <Save className="size-3.5" />
                                            Simpan & Terapkan {kind === 'favicon' ? 'Favicon' : 'Logo'}
                                        </>
                                    )}
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="gap-1 text-slate-600"
                                    disabled={disabled || uploading}
                                    onClick={handleCancelSelection}
                                >
                                    <X className="size-3.5" />
                                    Batal
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-wrap items-center gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="gap-1.5"
                                disabled={disabled || uploading}
                                onClick={() => fileInputRef.current?.click()}
                            >
                                <Upload className="size-3.5 text-slate-500" />
                                {preview ? `Ganti ${kind === 'favicon' ? 'Favicon' : 'Logo'}` : `Pilih File ${kind === 'favicon' ? 'Favicon' : 'Logo'}`}
                            </Button>

                            {hasCustom && (
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30 gap-1"
                                    disabled={disabled || uploading}
                                    onClick={handleResetDefault}
                                >
                                    <RotateCcw className="size-3.5" />
                                    Reset default
                                </Button>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
