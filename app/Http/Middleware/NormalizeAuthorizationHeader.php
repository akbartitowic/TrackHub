<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class NormalizeAuthorizationHeader
{
    /**
     * Handle an incoming request and ensure Authorization header is extracted
     * from all serverless / FastCGI header variants.
     *
     * @param  \Illuminate\Http\Request  $request
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        if (!$request->headers->has('Authorization') || empty($request->header('Authorization'))) {
            $auth = $request->header('X-Authorization')
                ?: $request->header('x-authorization')
                ?: $request->server('HTTP_AUTHORIZATION')
                ?: $request->server('REDIRECT_HTTP_AUTHORIZATION')
                ?: $request->server('HTTP_X_AUTHORIZATION');

            if (!$auth && function_exists('getallheaders')) {
                foreach (getallheaders() as $k => $v) {
                    if (strcasecmp($k, 'Authorization') === 0 || strcasecmp($k, 'X-Authorization') === 0) {
                        $auth = $v;
                        break;
                    }
                }
            }

            if ($auth) {
                $request->headers->set('Authorization', $auth);
            }
        }

        return $next($request);
    }
}
