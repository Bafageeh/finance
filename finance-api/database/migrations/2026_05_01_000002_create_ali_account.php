<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('accounts') || ! Schema::hasTable('users')) {
            return;
        }

        $now = now();

        DB::table('accounts')->updateOrInsert(
            ['slug' => 'ali'],
            [
                'name' => 'حساب علي',
                'status' => 'active',
                'created_at' => $now,
                'updated_at' => $now,
            ]
        );

        $aliAccountId = (int) DB::table('accounts')->where('slug', 'ali')->value('id');

        DB::table('users')->updateOrInsert(
            ['email' => 'ali@pm.sa'],
            [
                'account_id' => $aliAccountId,
                'name' => 'Ali',
                'password' => Hash::make(env('FINANCE_DEFAULT_USER_PASSWORD', '123456')),
                'created_at' => $now,
                'updated_at' => $now,
            ]
        );
    }

    public function down(): void
    {
        // لا نحذف الحساب تلقائياً حتى لا تُحذف أو تختلط بياناته إذا تم الرجوع.
    }
};
