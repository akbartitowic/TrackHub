<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;

$app = Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->trustProxies(at: '*');

        $middleware->alias([
            'permission'  => \App\Http\Middleware\CheckPermission::class,
            'token.lifetime' => \App\Http\Middleware\ValidateSanctumTokenLifetime::class,
            'signup.enabled' => \App\Http\Middleware\RestrictPublicSignup::class,
            'external.apikey' => \App\Http\Middleware\ExternalApiKeyMiddleware::class,
        ]);

        // Return JSON 401 for unauthenticated API requests instead of redirecting
        $middleware->redirectGuestsTo(fn ($request) =>
            $request->expectsJson() || $request->is('api/*') ? null : route('login')
        );
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        //
    })
    ->create();

if (isset($_ENV['VERCEL']) || isset($_SERVER['VERCEL']) || (env('APP_ENV') === 'production' && !is_writable(dirname(__DIR__).'/storage'))) {
    $app->useStoragePath('/tmp/storage');
}

$app->booting(function () {
    if (!config('database.default')) {
        config(['database.default' => 'sqlite']);
    }
    if (config('database.default') === 'sqlite') {
        $dbPath = config('database.connections.sqlite.database');
        if (!$dbPath || !file_exists($dbPath) || (file_exists($dbPath) && filesize($dbPath) === 0)) {
            $target = (isset($_ENV['VERCEL']) || isset($_SERVER['VERCEL'])) ? '/tmp/database.sqlite' : database_path('database.sqlite');
            $source = database_path('database.sqlite');
            if ($target !== $source && (!file_exists($target) || filesize($target) === 0) && file_exists($source) && filesize($source) > 0) {
                @copy($source, $target);
                @chmod($target, 0666);
            } elseif (!file_exists($target)) {
                @touch($target);
                @chmod($target, 0666);
            }
            config(['database.connections.sqlite.database' => $target]);
        }
    }
});

$app->booted(function () {
    if (config('database.default') === 'sqlite') {
        try {
            if (!\Illuminate\Support\Facades\Schema::hasTable('users')) {
                \Illuminate\Support\Facades\Artisan::call('migrate', ['--force' => true]);
            }
            if (\Illuminate\Support\Facades\Schema::hasTable('users') && \App\Models\User::where('email', 'admin@example.com')->doesntExist()) {
                \Illuminate\Support\Facades\Artisan::call('db:seed', ['--force' => true]);
            }
        } catch (\Throwable) {
            // Ignore during cli or migration
        }
    }
});

return $app;
