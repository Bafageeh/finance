<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('accounts')) {
            Schema::create('accounts', function (Blueprint $table) {
                $table->id();
                $table->string('name');
                $table->string('slug')->unique();
                $table->string('status')->default('active');
                $table->timestamps();
            });
        }

        $now = now();

        DB::table('accounts')->updateOrInsert(
            ['slug' => 'main'],
            ['name' => 'النسخة الأصلية', 'status' => 'active', 'updated_at' => $now, 'created_at' => $now]
        );

        DB::table('accounts')->updateOrInsert(
            ['slug' => 'sara'],
            ['name' => 'نسخة سارة', 'status' => 'active', 'updated_at' => $now, 'created_at' => $now]
        );

        $mainAccountId = (int) DB::table('accounts')->where('slug', 'main')->value('id');
        $saraAccountId = (int) DB::table('accounts')->where('slug', 'sara')->value('id');

        foreach (['users', 'clients', 'payments', 'follow_ups', 'client_reminders', 'personal_access_tokens'] as $tableName) {
            $this->addAccountColumn($tableName);
            if (Schema::hasTable($tableName) && Schema::hasColumn($tableName, 'account_id')) {
                DB::table($tableName)->whereNull('account_id')->update(['account_id' => $mainAccountId]);
            }
        }

        $defaultPassword = env('FINANCE_DEFAULT_USER_PASSWORD', '123456');

        DB::table('users')->updateOrInsert(
            ['email' => 'admin@pm.sa'],
            [
                'account_id' => $mainAccountId,
                'name' => 'Admin',
                'password' => Hash::make($defaultPassword),
                'updated_at' => $now,
                'created_at' => $now,
            ]
        );

        DB::table('users')->updateOrInsert(
            ['email' => 'sara@pm.sa'],
            [
                'account_id' => $saraAccountId,
                'name' => 'Sara',
                'password' => Hash::make($defaultPassword),
                'updated_at' => $now,
                'created_at' => $now,
            ]
        );
    }

    public function down(): void
    {
        // نترك الأعمدة والبيانات كما هي حتى لا تختلط الحسابات عند الرجوع.
    }

    private function addAccountColumn(string $tableName): void
    {
        if (! Schema::hasTable($tableName) || Schema::hasColumn($tableName, 'account_id')) {
            return;
        }

        Schema::table($tableName, function (Blueprint $table) {
            $table->unsignedBigInteger('account_id')->nullable()->index()->after('id');
        });
    }
};
