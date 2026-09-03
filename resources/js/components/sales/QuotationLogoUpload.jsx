import { useEffect, useRef, useState } from 'react';
import { getApiUrl } from '../../services/api';
import { Button } from '@/components/ui/button';

export default function QuotationLogoUpload({
  pitchId,
  logoUrl,
  disabled,
  onUpdated,
  onError,
}) {
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState(logoUrl || null);

  useEffect(() => {
    setPreview(logoUrl || null);
  }, [logoUrl]);

  useEffect(() => {
    return () => {
      if (preview && preview.startsWith('blob:')) {
        URL.revokeObjectURL(preview);
      }
    };
  }, [preview]);

  const uploadLogo = async (file) => {
    if (!pitchId || !file) return;
    const token = localStorage.getItem('auth_token');
    const formData = new FormData();
    formData.append('logo', file);

    setUploading(true);
    try {
      const response = await fetch(`${getApiUrl()}/sales-pitches/${pitchId}/quotation/logo`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: formData,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.message || 'Gagal mengunggah logo');
      }
      if (preview && preview.startsWith('blob:')) {
        URL.revokeObjectURL(preview);
      }
      setPreview(data.data?.quotation_logo_url || null);
      onUpdated?.(data.data);
    } catch (e) {
      onError?.(e.message);
    } finally {
      setUploading(false);
    }
  };

  const removeLogo = async () => {
    if (!pitchId) return;
    const token = localStorage.getItem('auth_token');
    setUploading(true);
    try {
      const response = await fetch(`${getApiUrl()}/sales-pitches/${pitchId}/quotation/logo`, {
        method: 'DELETE',
        headers: {
          Accept: 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.message || 'Gagal menghapus logo');
      }
      if (preview && preview.startsWith('blob:')) {
        URL.revokeObjectURL(preview);
      }
      setPreview(null);
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
    if (!file.type.startsWith('image/')) {
      onError?.('Pilih file gambar (PNG, JPG, dll.).');
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      onError?.('Ukuran logo maksimal 4 MB.');
      return;
    }
    if (preview && preview.startsWith('blob:')) {
      URL.revokeObjectURL(preview);
    }
    setPreview(URL.createObjectURL(file));
    uploadLogo(file);
  };

  return (
    <div className="rounded-md border border-slate-200 dark:border-slate-700 p-4 space-y-3 bg-white/80 dark:bg-slate-950/40">
      <div>
        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Logo quotation</p>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Unggah logo untuk header PDF (mis. logo MyActivity pada contoh Sunpride). Tanpa upload, dipakai logo default aplikasi.
        </p>
      </div>
      <div className="flex flex-col sm:flex-row gap-4 items-start">
        <div className="flex h-16 min-w-[140px] items-center justify-center rounded-md border border-dashed border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 px-4">
          {preview ? (
            <img src={preview} alt="Logo quotation" className="max-h-12 max-w-[200px] object-contain" />
          ) : (
            <span className="text-xs text-slate-400">Belum ada logo</span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
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
            {uploading ? 'Mengunggah...' : preview ? 'Ganti logo' : 'Upload logo'}
          </Button>
          {preview && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-rose-600"
              disabled={disabled || uploading}
              onClick={removeLogo}
            >
              Hapus logo
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
