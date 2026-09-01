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
        $exceptions->render(function (\Throwable $e, $request) {
            if ($request->is('api/*') || $request->expectsJson()) {
                return new \Illuminate\Http\JsonResponse([
                    'message' => $e->getMessage(),
                    'exception' => get_class($e),
                    'file' => $e->getFile(),
                    'line' => $e->getLine(),
                ], 500);
            }
        });
    })
    ->create();

if (!is_writable(dirname(__DIR__).'/storage') || is_dir('/tmp/storage')) {
    $app->useStoragePath('/tmp/storage');
}

return $app;
