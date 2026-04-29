<?php

namespace App\Http\Middleware;

use App\Models\PersonalAccessToken;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class ApiTokenAuth
{
    public function handle(Request $request, Closure $next): Response
    {
        $plainToken = $request->bearerToken();

        if (! $plainToken) {
            return response()->json([
                'message' => 'يلزم تسجيل الدخول للوصول إلى هذا المسار.',
            ], 401);
        }

        $accessToken = PersonalAccessToken::query()
            ->where('token_hash', hash('sha256', $plainToken))
            ->with('user')
            ->first();

        if (! $accessToken || $accessToken->isExpired() || ! $accessToken->user) {
            return response()->json([
                'message' => 'جلسة الدخول غير صالحة أو منتهية. سجّل الدخول مرة أخرى.',
            ], 401);
        }

        $accessToken->forceFill(['last_used_at' => now()])->save();

        $request->setUserResolver(fn () => $accessToken->user);
        $request->attributes->set('auth_access_token', $accessToken);

        return $next($request);
    }
}
