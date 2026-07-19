<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Account;
use App\Models\Client;
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

    public function changePassword(Request $request): JsonResponse
    {
        $user = $request->user();

        if (! $user) {
            throw ValidationException::withMessages([
                'user' => ['يلزم تسجيل الدخول أولاً.'],
            ]);
        }

        $validated = $request->validate([
            'current_password' => 'required|string|max:255',
            'password' => 'nullable|string|min:6|max:255',
            'password_confirmation' => 'nullable|string|max:255',
            'new_password' => 'nullable|string|min:6|max:255',
            'new_password_confirmation' => 'nullable|string|max:255',
        ]);

        $newPassword = (string) ($validated['password'] ?? $validated['new_password'] ?? '');
        $confirmation = (string) ($validated['password_confirmation'] ?? $validated['new_password_confirmation'] ?? '');

        if ($newPassword === '') {
            throw ValidationException::withMessages([
                'password' => ['أدخل كلمة المرور الجديدة.'],
            ]);
        }

        if ($confirmation === '' || $newPassword !== $confirmation) {
            throw ValidationException::withMessages([
                'password_confirmation' => ['تأكيد كلمة المرور غير مطابق.'],
            ]);
        }

        if (! Hash::check((string) $validated['current_password'], (string) $user->password)) {
            throw ValidationException::withMessages([
                'current_password' => ['كلمة المرور الحالية غير صحيحة.'],
            ]);
        }

        $user->forceFill([
            'password' => Hash::make($newPassword),
        ])->save();

        return response()->json([
            'message' => 'تم تغيير كلمة المرور بنجاح.',
        ]);
    }

    public function accounts(Request $request): JsonResponse
    {
        $user = $request->user();

        if (! $this->isAdmin($user)) {
            return response()->json([
                'message' => 'هذه الصلاحية متاحة للمدير فقط.',
            ], 403);
        }

        $accounts = Account::query()
            ->withCount('users')
            ->with(['users' => function ($query) {
                $query->select('id', 'account_id', 'name', 'username', 'email', 'created_at')
                    ->orderBy('name');
            }])
            ->when($user?->account_id, fn ($query) => $query->where('id', '!=', $user->account_id))
            ->orderBy('name')
            ->get();

        // بعض السجلات القديمة كانت مرتبطة بالمستخدم عبر user_id قبل اكتمال نقلها إلى account_id.
        // نعطي user_id الأولوية عند تحديد الحساب الفعلي حتى لا تضيع هذه السجلات أو تُحسب مرتين.
        $userAccountMap = User::query()
            ->whereNotNull('account_id')
            ->pluck('account_id', 'id');

        $allClients = Client::withoutGlobalScope('account')
            ->with([
                'payments' => fn ($query) => $query->withoutGlobalScope('account'),
            ])
            ->get();

        $data = $accounts->map(function (Account $account) use ($allClients, $userAccountMap): array {
            $accountClients = $allClients->filter(function (Client $client) use ($account, $userAccountMap): bool {
                $linkedUserAccountId = (int) ($userAccountMap->get((int) ($client->user_id ?? 0)) ?? 0);
                $effectiveAccountId = $linkedUserAccountId > 0
                    ? $linkedUserAccountId
                    : (int) ($client->account_id ?? 0);

                return $effectiveAccountId === (int) $account->id;
            });

            // المقصود بالنشط هنا: التمويل القائم بما فيه المتأخر، مع استبعاد
            // المتعثر والقضية والمنتهي والملغي، واشتراط وجود مبلغ متبقٍ فعلي.
            $activeClientsCount = $accountClients
                ->filter(fn (Client $client) => $this->isActiveFinancingClient($client))
                ->count();

            return [
                'id' => $account->id,
                'name' => $account->name,
                'slug' => $account->slug,
                'status' => $account->status,
                'users_count' => $account->users_count,
                'clients_count' => $activeClientsCount,
                'active_clients_count' => $activeClientsCount,
                'all_clients_count' => $accountClients->count(),
                'users' => $account->users->map(fn (User $accountUser) => [
                    'id' => $accountUser->id,
                    'name' => $accountUser->name,
                    'username' => $accountUser->username,
                    'email' => $accountUser->email,
                    'created_at' => $accountUser->created_at?->toDateString(),
                ])->values(),
            ];
        })->values();

        return response()->json([
            'data' => $data,
        ]);
    }

    private function isActiveFinancingClient(Client $client): bool
    {
        if ($client->getRemainingAmount() <= 0.01) {
            return false;
        }

        if ((bool) ($client->has_court ?? false)) {
            return false;
        }

        $status = strtolower(trim((string) ($client->status ?? '')));

        return ! in_array($status, [
            'stuck',
            'court',
            'done',
            'cancelled',
            'canceled',
        ], true);
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
            'role' => $this->isAdmin($user) ? 'admin' : 'user',
        ];
    }

    private function isAdmin(?User $user): bool
    {
        if (! $user) {
            return false;
        }

        if (Schema::hasColumn('users', 'role') && (string) $user->getAttribute('role') === 'admin') {
            return true;
        }

        return strtolower((string) ($user->username ?: $user->email ?: $user->name)) === 'admin'
            || strtolower((string) $user->email) === 'admin@pm.sa';
    }
}
