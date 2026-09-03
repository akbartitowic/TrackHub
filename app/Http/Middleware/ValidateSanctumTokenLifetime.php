<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Laravel\Sanctum\PersonalAccessToken;
use Symfony\Component\HttpFoundation\Response;

class ValidateSanctumTokenLifetime
{
    /**
     * Tokens stay alive across a whole active session (sliding idle timeout — see below)
     * but always die when the calendar day changes (server/app timezone), and always die
     * after `sanctum.expiration` minutes since creation regardless of activity (generous
     * hard ceiling, enforced natively by Sanctum's own guard before this middleware runs).
     */
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if ($user && $user->currentAccessToken() instanceof PersonalAccessToken) {
            /** @var PersonalAccessToken $token */
            $token = $user->currentAccessToken();
            $created = $token->created_at;
            $tz = config('app.timezone') ?: 'Asia/Jakarta';
            $now = now()->timezone($tz);
            $createdAt = $created ? $created->copy()->timezone($tz) : null;

            if ($createdAt && !$createdAt->isSameDay($now)) {
                $token->delete();

                return response()->json([
                    'message' => 'Session expired. Please log in again.',
                    'code' => 'token_expired',
                ], 401);
            }

            // Sliding idle timeout: extend the token's native `expires_at` on every active
            // request. Sanctum's own guard rejects the token (401, before this middleware
            // even runs) once `idle_expiration` minutes pass with no request at all — an
            // actively-used session never reaches that ceiling.
            //
            // Best-effort: `Sanctum::actingAs()` (used throughout the test suite) swaps in a
            // Mockery double of this class with only `can()` stubbed, so guard against that
            // and any other non-persisted/unexpected token gracefully instead of erroring.
            if ($token->exists && !($token instanceof \Mockery\MockInterface)) {
                try {
                    $idleMinutes = (int) config('sanctum.idle_expiration', 480);
                    $token->forceFill(['expires_at' => now()->addMinutes($idleMinutes)])->save();
                } catch (\Throwable $e) {
                    // Non-fatal: worst case this request's activity doesn't extend the idle
                    // window, it doesn't break the request itself.
                }
            }
        }

        return $next($request);
    }
}
