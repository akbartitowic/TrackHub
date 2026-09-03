import { useEffect, useRef, useState } from 'react';
import { getApiUrl } from '../../services/api';
import { Button } from '@/components/ui/button';

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
    const [preview, setPreview] = useState(previewUrl || null);

    const fieldName = kind === 'favicon' ? 'favicon' : 'logo';
    const uploadPath = kind === 'favicon' ? '/settings/branding/favicon' : '/settings/branding/logo';
    const deletePath = uploadPath;

    useEffect(() => {
        setPreview(previewUrl || null);
    }, [previewUrl]);

    useEffect(() => {
        return () => {
            if (preview && preview.startsWith('blob:')) {
                URL.revokeObjectURL(preview);
            }
        };
    }, [preview]);

    const uploadFile = async (file) => {
        if (!file) return;
        const token = localStorage.getItem('auth_token');
        const formData = new FormData();
        formData.append(fieldName, file);

        setUploading(true);
        try {
            const response = await fetch(`${getApiUrl()}${uploadPath}`, {
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
                throw new Error(data.message || 'Gagal mengunggah file');
            }
            if (preview && preview.startsWith('blob:')) {
                URL.revokeObjectURL(preview);
            }
            const url = kind === 'favicon' ? data.data?.favicon_url : data.data?.logo_url;
            setPreview(url || null);
            onUpdated?.(data.data);
        } catch (e) {
            onError?.(e.message);
        } finally {
            setUploading(false);
        }
    };

    const removeAsset = async () => {
        const token = localStorage.getItem('auth_token');
        setUploading(true);
        try {
            const response = await fetch(`${getApiUrl()}${deletePath}`, {
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
                throw new Error(data.message || 'Gagal menghapus file');
            }
            if (preview && preview.startsWith('blob:')) {
                URL.revokeObjectURL(preview);
            }
            const url = kind === 'favicon' ? data.data?.favicon_url : data.data?.logo_url;
            setPreview(url || null);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
            onUpdated?.(data.data);
        } catch (e) {
            onError?.(e.message);
        } finally {
            setUploading(false);
        }
    };

    const onFileChange = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 4 * 1024 * 1024) {
            onError?.('Ukuran file maksimal 4 MB.');
            return;
        }
        if (preview && preview.startsWith('blob:')) {
            URL.revokeObjectURL(preview);
        }
        setPreview(URL.createObjectURL(file));
        uploadFile(file);
    };

    return (
        <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{label}</p>
            {description && (
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{description}</p>
            )}
            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900">
                    {preview ? (
                        <img src={preview} alt="" className="max-h-full max-w-full object-contain p-1" />
                    ) : (
                        <span className="text-[10px] text-slate-400">Default</span>
                    )}
                </div>
                <div className="flex flex-wrap gap-2">
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/gif,image/webp,image/x-icon,.ico"
                        className="hidden"
                        disabled={disabled || uploading}
                        onChange={onFileChange}
                    />
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={disabled || uploading}
                        onClick={() => fileInputRef.current?.click()}
                    >
                        {uploading ? 'Memproses...' : preview ? 'Ganti' : 'Upload'}
                    </Button>
                    {hasCustom && (
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-rose-600"
                            disabled={disabled || uploading}
                            onClick={removeAsset}
                        >
                            Reset default
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
}
