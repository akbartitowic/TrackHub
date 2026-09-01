<?php

namespace App\Support;

class SettingKeys
{
    /** Keys never returned from read APIs (secrets). */
    public const SENSITIVE_READ = [
        'mail_password',
        'smtp_password',
        'password',
    ];

    /** Keys allowed to be written via settings update API. */
    public const UPDATABLE = [
        'app_name',
        'app_tagline',
        'company_name',
        'mail_host',
        'mail_port',
        'mail_username',
        'mail_password',
        'mail_encryption',
        'mail_from_address',
        'mail_from_name',
        'smtp_host',
        'smtp_port',
        'smtp_username',
        'smtp_password',
        'smtp_encryption',
        'review_invite_email_subject',
        'review_invite_email_body',
    ];

    public static function isSensitiveKey(string $key): bool
    {
        $lower = strtolower($key);
        foreach (self::SENSITIVE_READ as $sensitive) {
            if ($lower === $sensitive || str_contains($lower, 'password') || str_contains($lower, 'secret')) {
                return true;
            }
        }

        return false;
    }

    public static function filterForRead(array $settings): array
    {
        return collect($settings)
            ->reject(fn ($value, $key) => self::isSensitiveKey((string) $key))
            ->all();
    }
}
