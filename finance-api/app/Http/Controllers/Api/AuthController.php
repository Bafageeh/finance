<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PersonalAccessToken;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function login(Request $request): JsonResponse
    {
        $credentials = $request->validate([
            'login' => 'required_without:username|string|max:255',
            'username' => 'required_without:login|string|max:255',
            'password' => 'required|string|max:255',
        ]);

        $username = trim((string) ($credentials['username'] ?? $credentials['login'] ?? ''));

        $query = User::query()->with('account');

        if (Schema::hasColumn('users', 'username')) {
            $query->where('username', $username);
        } else {
            $query->where('name', $username);
        }

        $user = $query->first();

        if (! $user || ! Hash::check((string) $credentials['password'], (string) $user->password)) {
            throw ValidationException::withMessages([
                'username' => ['اسم المستخدم أو كلمة المرور غير صحيحة.'],
            ]);
        }

        [$tokenModel, $plainToken] = PersonalAccessToken::issueFor($user, 'mobile');

        return response()->json([
            'data' => [
                'token' => $plainToken,
                'token_type' => 'Bearer',
                'expires_at' => $tokenModel->expires_at?->toISOString(),
                'user' => $this->formatUser($user),
            ],
        ]);
    }

    public function me(Request $request): JsonResponse
    {
        return response()->json([
            'data' => $this->formatUser($request->user()?->loadMissing('account')),
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        $token = $request->attributes->get('auth_access_token');

        if ($token instanceof PersonalAccessToken) {
            $token->delete();
        }

        return response()->json([
            'message' => 'تم تسجيل الخروج بنجاح.',
        ]);
    }

    private function formatUser(?User $user): array
    {
        return [
            'id' => $user?->id,
            'account_id' => $user?->account_id,
            'account_name' => $user?->account?->name,
            'account_slug' => $user?->account?->slug,
            'name' => $user?->name ?? 'مستخدم النظام',
            'username' => $user?->username,
            'email' => $user?->email,
            'phone' => null,
            'role' => 'admin',
        ];
    }
}
