<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('users', 'username')) {
            Schema::table('users', function (Blueprint $table) {
                $table->string('username')->nullable()->unique()->after('name');
            });
        }

        DB::table('users')
            ->select(['id', 'name', 'email', 'username'])
            ->orderBy('id')
            ->get()
            ->each(function ($user): void {
                if (! empty($user->username)) {
                    return;
                }

                $base = Str::before((string) $user->email, '@') ?: Str::slug((string) $user->name, '_') ?: 'user_'.$user->id;
                $base = Str::lower(preg_replace('/[^a-zA-Z0-9_\.\-]/', '', $base) ?: 'user_'.$user->id);
                $username = $base;
                $counter = 2;

                while (DB::table('users')->where('username', $username)->where('id', '<>', $user->id)->exists()) {
                    $username = $base.'_'.$counter;
                    $counter++;
                }

                DB::table('users')->where('id', $user->id)->update(['username' => $username]);
            });
    }

    public function down(): void
    {
        if (Schema::hasColumn('users', 'username')) {
            Schema::table('users', function (Blueprint $table) {
                $table->dropUnique(['username']);
                $table->dropColumn('username');
            });
        }
    }
};
