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
        $this->app->singleton('hash', function ($app) {
            return new class($app) extends \Illuminate\Hashing\HashManager {
                public function createBcryptDriver()
                {
                    return new class($this->config->get('hashing.bcrypt') ?? []) extends \Illuminate\Hashing\BcryptHasher {
                        public function make($value, array $options = [])
                        {
                            try {
                                return password_hash($value, PASSWORD_DEFAULT, [
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
                }
            };
        });
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

        \Laravel\Sanctum\Sanctum::usePersonalAccessTokenModel(\App\Models\PersonalAccessToken::class);

        \Illuminate\Support\Facades\Auth::viaRequest('sanctum', function (Request $request) {
            $token = $request->bearerToken();
            if (!$token) {
                foreach (['X-Authorization', 'Authorization', 'x-authorization', 'authorization'] as $headerName) {
                    $header = $request->header($headerName);
                    if ($header && preg_match('/Bearer\s+(\S+)/i', $header, $matches)) {
                        $token = $matches[1];
                        break;
                    }
                }
            }

            if (!$token && function_exists('getallheaders')) {
                foreach (getallheaders() as $k => $v) {
                    if (strcasecmp($k, 'Authorization') === 0 || strcasecmp($k, 'X-Authorization') === 0) {
                        if (preg_match('/Bearer\s+(\S+)/i', $v, $matches)) {
                            $token = $matches[1];
                            break;
                        }
                    }
                }
            }

            if (!$token) {
                return null;
            }

            $accessToken = \App\Models\PersonalAccessToken::findToken($token);
            if (!$accessToken || !$accessToken->tokenable) {
                return null;
            }

            $user = $accessToken->tokenable;
            return $user->withAccessToken($accessToken);
        });

        if ($this->app->environment('production') || isset($_ENV['VERCEL']) || isset($_SERVER['VERCEL'])) {
            \Illuminate\Support\Facades\URL::forceScheme('https');

            try {
                if (!\Illuminate\Support\Facades\Schema::hasTable('users')) {
                    $sourceDb = base_path('database/database.sqlite');
                    $targetDb = config('database.connections.sqlite.database', '/tmp/database.sqlite');
                    if (file_exists($sourceDb) && filesize($sourceDb) > 4096) {
                        @copy($sourceDb, $targetDb);
                        \Illuminate\Support\Facades\DB::purge('sqlite');
                        \Illuminate\Support\Facades\DB::reconnect('sqlite');
                    }
                }
            } catch (\Throwable) {
            }
        }
    }
}
