<?php

namespace App\Support;

use App\Models\Setting;
use Illuminate\Support\Facades\Storage;

class AppBranding
{
    public const KEY_LOGO = 'app_logo_path';

    public const KEY_FAVICON = 'app_favicon_path';

    public static function logoPath(): ?string
    {
        return self::pathFor(self::KEY_LOGO);
    }

    public static function faviconPath(): ?string
    {
        return self::pathFor(self::KEY_FAVICON);
    }

    public static function logoUrl(): string
    {
        $path = self::logoPath();
        if (!$path) {
            return '/logo.png';
        }

        if (str_starts_with($path, 'data:') || str_starts_with($path, 'http://') || str_starts_with($path, 'https://')) {
            return $path;
        }

        if (Storage::disk('public')->exists($path)) {
            return PublicStorageUrl::for($path);
        }

        return '/logo.png';
    }

    public static function appName(): string
    {
        try {
            $val = Setting::where('key', 'app_name')->value('value');
            if (!$val || strcasecmp(trim((string) $val), 'noohtify') === 0 || strcasecmp(trim((string) $val), 'laravel') === 0) {
                return 'MyActivity';
            }
            return (string) $val;
        } catch (\Throwable) {
            return 'MyActivity';
        }
    }

    public static function appTagline(): string
    {
        try {
            return Setting::where('key', 'app_tagline')->value('value') ?: 'SOFTWARE MANAGEMENT';
        } catch (\Throwable) {
            return 'SOFTWARE MANAGEMENT';
        }
    }

    public static function loginTitle(): string
    {
        try {
            $val = Setting::where('key', 'login_title')->value('value');
            if (!$val || strcasecmp(trim((string) $val), 'noohtify') === 0 || strcasecmp(trim((string) $val), 'hubtask') === 0 || strcasecmp(trim((string) $val), 'laravel') === 0) {
                return self::appName();
            }
            return (string) $val;
        } catch (\Throwable) {
            return self::appName();
        }
    }

    public static function loginSubtitle(): string
    {
        try {
            return Setting::where('key', 'login_subtitle')->value('value') ?: 'Task management connected to your world.';
        } catch (\Throwable) {
            return 'Task management connected to your world.';
        }
    }

    public static function faviconUrl(): string
    {
        $path = self::faviconPath();
        if (!$path) {
            return '/favicon.png';
        }

        if (str_starts_with($path, 'data:') || str_starts_with($path, 'http://') || str_starts_with($path, 'https://')) {
            return $path;
        }

        if (Storage::disk('public')->exists($path)) {
            return PublicStorageUrl::for($path);
        }

        return '/favicon.png';
    }

    public static function hasCustomLogo(): bool
    {
        $path = self::logoPath();
        if (!$path) {
            return false;
        }
        if (str_starts_with($path, 'data:')) {
            return true;
        }
        return Storage::disk('public')->exists($path);
    }

    public static function hasCustomFavicon(): bool
    {
        $path = self::faviconPath();
        if (!$path) {
            return false;
        }
        if (str_starts_with($path, 'data:')) {
            return true;
        }
        return Storage::disk('public')->exists($path);
    }

    /** Absolute filesystem path for PDF / DomPDF when a custom logo exists. */
    public static function logoFilesystemPath(): ?string
    {
        $path = self::logoPath();
        if ($path && !str_starts_with($path, 'data:') && Storage::disk('public')->exists($path)) {
            return Storage::disk('public')->path($path);
        }

        $default = public_path('logo.png');

        return is_file($default) ? $default : null;
    }

    public static function toArray(): array
    {
        return [
            'app_name' => self::appName(),
            'app_tagline' => self::appTagline(),
            'login_title' => self::loginTitle(),
            'login_subtitle' => self::loginSubtitle(),
            'logo_url' => self::logoUrl(),
            'favicon_url' => self::faviconUrl(),
            'has_custom_logo' => self::hasCustomLogo(),
            'has_custom_favicon' => self::hasCustomFavicon(),
        ];
    }

    public static function setLogoPath(?string $path): void
    {
        self::setPath(self::KEY_LOGO, $path);
    }

    public static function setFaviconPath(?string $path): void
    {
        self::setPath(self::KEY_FAVICON, $path);
    }

    public static function deleteStoredFile(?string $path): void
    {
        if ($path && !str_starts_with($path, 'data:') && Storage::disk('public')->exists($path)) {
            Storage::disk('public')->delete($path);
        }
    }

    private static function pathFor(string $key): ?string
    {
        try {
            $value = Setting::where('key', $key)->value('value');
            return $value ? (string) $value : null;
        } catch (\Throwable) {
            return null;
        }
    }

    private static function setPath(string $key, ?string $path): void
    {
        if ($path === null || $path === '') {
            Setting::where('key', $key)->delete();

            return;
        }

        Setting::updateOrCreate(
            ['key' => $key],
            ['value' => $path]
        );
    }
}
