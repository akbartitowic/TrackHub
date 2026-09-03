<?php

namespace App\Models;

use Illuminate\Support\Carbon;
use Laravel\Sanctum\PersonalAccessToken as SanctumPersonalAccessToken;

class PersonalAccessToken extends SanctumPersonalAccessToken
{
    /**
     * Find the token instance matching the given token string.
     * Supports both standard database lookup and signed stateless tokens
     * for seamless authentication across multi-instance serverless deployments.
     *
     * @param  string  $token
     * @return static|null
     */
    public static function findToken($token)
    {
        if (!is_string($token) || $token === '') {
            return null;
        }

        // 1. Standard database lookup
        try {
            $found = parent::findToken($token);
            if ($found) {
                return $found;
            }
        } catch (\Throwable) {
            // In case of DB failure, continue to fallback verification
        }

        // 2. Stateless HMAC token verification for serverless multi-instance fallback
        if (strpos($token, '|') === false) {
            return null;
        }

        [$id, $rest] = explode('|', $token, 2);
        $parts = explode('.', $rest);
        if (count($parts) !== 3) {
            return null;
        }

        [$entropy, $payloadBase64, $signature] = $parts;
        $body = "{$id}|{$entropy}.{$payloadBase64}";
        $appKey = (string) config('app.key');

        if (!hash_equals($signature, hash_hmac('sha256', $body, $appKey))) {
            return null;
        }

        $decodedJson = base64_decode(strtr($payloadBase64, '-_', '+/'));
        $payload = json_decode($decodedJson, true);
        if (!is_array($payload) || empty($payload['u'])) {
            return null;
        }

        try {
            $user = User::find($payload['u']);
            if (!$user || $user->status !== 'Active') {
                return null;
            }
        } catch (\Throwable) {
            return null;
        }

        $createdAt = !empty($payload['t'])
            ? Carbon::createFromTimestamp($payload['t'])
            : Carbon::now();

        $instance = new static();
        $instance->id = (int) $id;
        $instance->name = 'auth_token';
        $instance->token = hash('sha256', "{$entropy}.{$payloadBase64}");
        $instance->abilities = ['*'];
        $instance->tokenable_type = User::class;
        $instance->tokenable_id = $user->id;
        $instance->created_at = $createdAt;
        $instance->expires_at = $createdAt->copy()->addMinutes((int) config('sanctum.expiration', 1440));
        $instance->exists = true;
        $instance->setRelation('tokenable', $user);

        return $instance;
    }
}
