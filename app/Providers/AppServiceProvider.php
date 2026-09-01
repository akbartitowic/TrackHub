<?php

namespace App\Providers;

use App\Support\MailSettings;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        RateLimiter::for('api', function (Request $request) {
            return Limit::perMinute(300)
                ->by($request->user()?->id ?: $request->ip())
                ->response(function (Request $request, array $headers) {
                    $retryAfter = (int) ($headers['Retry-After'] ?? 60);

                    return response()->json([
                        'message' => "Terlalu banyak permintaan. Silakan coba lagi dalam {$retryAfter} detik.",
                        'retry_after' => $retryAfter,
                    ], 429, $headers);
                });
        });

        MailSettings::apply();

        if ($this->app->environment('production') || isset($_ENV['VERCEL']) || isset($_SERVER['VERCEL'])) {
            \Illuminate\Support\Facades\URL::forceScheme('https');
        }

        $this->app->make('hash')->extend('bcrypt', function ($app) {
            return new class extends \Illuminate\Hashing\BcryptHasher {
                public function make($value, array $options = [])
                {
                    try {
                        return password_hash($value, defined('PASSWORD_BCRYPT') ? PASSWORD_BCRYPT : PASSWORD_DEFAULT, [
                            'cost' => $this->cost($options),
                        ]);
                    } catch (\Throwable) {
                        return password_hash($value, PASSWORD_DEFAULT);
                    }
                }

                public function check($value, $hashedValue, array $options = [])
                {
                    if (is_null($hashedValue) || strlen($hashedValue) === 0) {
                        return false;
                    }
                    try {
                        return password_verify($value, $hashedValue);
                    } catch (\Throwable) {
                        return false;
                    }
                }
            };
        });
    }
}
