<?php

namespace App\Support;

use Illuminate\Support\Facades\Storage;

class PublicStorageUrl
{
    /**
     * Browser-safe URL for files on the public disk (company logos, etc.).
     * Uses a relative /storage/... path so images still load when APP_URL is misconfigured in production.
     */
    public static function for(?string $path): ?string
    {
        if (!$path) {
            return null;
        }

        if (str_starts_with($path, 'data:') || str_starts_with($path, 'http://') || str_starts_with($path, 'https://')) {
            return $path;
        }

        $normalized = ltrim(str_replace('\\', '/', $path), '/');

        return '/storage/' . $normalized;
    }

    /**
     * Absolute URL (PDF generation, external callbacks). Requires correct APP_URL.
     */
    public static function absolute(?string $path): ?string
    {
        if (!$path) {
            return null;
        }

        return Storage::disk('public')->url($path);
    }
}
