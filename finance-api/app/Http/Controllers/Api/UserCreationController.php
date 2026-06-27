<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Account;
use App\Models\User;
use App\Models\UserCreationOtp;
use App\Services\WhatsAppService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Throwable;

class UserCreationController extends Controller
{
    public function requestOtp(Request $request, WhatsAppService $messaging): JsonResponse
    {
        $actor = $request->user();

        if (! $this->isAdmin($actor)) {
            return response()->json(['message' => 'هذه الصلاحية متاحة للمدير فقط.'], 403);
        }

        $validated = $request->validate([
            'phone' => ['required', 'string', 'max:30'],
            'username' => Schema::hasColumn('users', 'username')
                ? ['nullable', 'string', 'max:255', Rule::unique('users', 'username')]
                : ['nullable', 'string', 'max:255'],
        ]);

        $phone = $messaging->normalizeSaudiPhone($validated['phone']);

        if (Schema::hasColumn('users', 'phone') && User::query()->where('phone', $phone)->exists()) {
            throw ValidationException::withMessages([
                'phone' => ['يوجد مستخدم بهذا الرقم.'],
            ]);
        }

        $code = (string) random_int(100000, 999999);

        UserCreationOtp::query()
            ->where('phone', $phone)
            ->whereNull('consumed_at')
            ->delete();

        UserCreationOtp::query()->create([
            'created_by_user_id' => $actor?->id,
            'phone' => $phone,
            'code_hash' => Hash::make($code),
            'attempts' => 0,
            'expires_at' => now()->addMinutes(10),
        ]);

        try {
            $messaging->sendText($phone, "رمز التحقق لإنشاء المستخدم في تطبيق التمويل: {$code}\nصالح لمدة 10 دقائق.");
        } catch (Throwable) {
            throw ValidationException::withMessages([
                'phone' => ['تعذر إرسال رمز التحقق. تأكد من الرقم وحاول مرة أخرى.'],
            ]);
        }

        return response()->json([
            'message' => 'تم إرسال رمز التحقق.',
            'data' => [
                'phone' => $this->maskPhone($phone),
                'expires_in' => 600,
            ],
        ]);
    }

    public function verifyOtp(Request $request, WhatsAppService $messaging): JsonResponse
    {
        $actor = $request->user();

        if (! $this->isAdmin($actor)) {
            return response()->json(['message' => 'هذه الصلاحية متاحة للمدير فقط.'], 403);
        }

        $rules = [
            'name' => ['required', 'string', 'max:255'],
            'phone' => ['required', 'string', 'max:30'],
            'otp' => ['required', 'digits:6'],
            'password' => ['required', 'string', 'min:6', 'confirmed'],
            'account_id' => ['nullable', 'integer', 'exists:accounts,id'],
        ];

        if (Schema::hasColumn('users', 'username')) {
            $rules['username'] = ['required', 'string', 'max:255', Rule::unique('users', 'username')];
        } else {
            $rules['username'] = ['nullable', 'string', 'max:255'];
        }

        if (Schema::hasColumn('users', 'email')) {
            $rules['email'] = ['nullable', 'email', 'max:255', Rule::unique('users', 'email')];
        }

        $validated = $request->validate($rules);
        $phone = $messaging->normalizeSaudiPhone($validated['phone']);

        if (Schema::hasColumn('users', 'phone') && User::query()->where('phone', $phone)->exists()) {
            throw ValidationException::withMessages([
                'phone' => ['يوجد مستخدم بهذا الرقم.'],
            ]);
        }

        $otp = UserCreationOtp::query()
            ->where('phone', $phone)
            ->whereNull('consumed_at')
            ->latest('id')
            ->first();

        if (! $otp || $otp->expires_at->isPast()) {
            throw ValidationException::withMessages([
                'otp' => ['انتهت صلاحية رمز التحقق. اطلب رمزًا جديدًا.'],
            ]);
        }

        if ($otp->attempts >= 5) {
            throw ValidationException::withMessages([
                'otp' => ['تم تجاوز عدد المحاولات. اطلب رمزًا جديدًا.'],
            ]);
        }

        if (! Hash::check((string) $validated['otp'], (string) $otp->code_hash)) {
            $otp->increment('attempts');
            throw ValidationException::withMessages([
                'otp' => ['رمز التحقق غير صحيح.'],
            ]);
        }

        $accountId = $validated['account_id'] ?? $actor?->account_id;

        if (! $accountId) {
            $accountId = Account::query()->orderBy('id')->value('id');
        }

        $attributes = [
            'name' => $validated['name'],
            'password' => $validated['password'],
        ];

        if (Schema::hasColumn('users', 'username')) {
            $attributes['username'] = $validated['username'];
        }

        if (Schema::hasColumn('users', 'email')) {
            $attributes['email'] = $validated['email'] ?? $this->generatedEmail($validated['username'] ?? $phone, $phone);
        }

        if (Schema::hasColumn('users', 'phone')) {
            $attributes['phone'] = $phone;
        }

        if (Schema::hasColumn('users', 'account_id') && $accountId) {
            $attributes['account_id'] = $accountId;
        }

        if (Schema::hasColumn('users', 'role')) {
            $attributes['role'] = 'user';
        }

        $user = User::query()->create($attributes);

        $otp->forceFill(['consumed_at' => now()])->save();

        return response()->json([
            'message' => 'تم إنشاء المستخدم بنجاح.',
            'data' => [
                'id' => $user->id,
                'name' => $user->name,
                'username' => $user->username ?? null,
                'email' => $user->email ?? null,
                'phone' => $this->maskPhone($phone),
                'role' => Schema::hasColumn('users', 'role') ? $user->role : 'user',
            ],
        ], 201);
    }

    private function generatedEmail(string $username, string $phone): string
    {
        $base = Str::slug($username, '-') ?: 'user';
        $base = str_replace('-', '.', $base);
        $candidate = $base . '@pm.sa';

        if (! User::query()->where('email', $candidate)->exists()) {
            return $candidate;
        }

        return 'u' . $phone . '@pm.sa';
    }

    private function maskPhone(string $phone): string
    {
        if (strlen($phone) <= 6) {
            return $phone;
        }

        return substr($phone, 0, 4) . '****' . substr($phone, -4);
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
