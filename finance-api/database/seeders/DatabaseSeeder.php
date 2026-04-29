<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        User::updateOrCreate(
            ['email' => env('FINANCE_ADMIN_EMAIL', 'admin@pm.sa')],
            [
                'name' => env('FINANCE_ADMIN_NAME', 'مدير النظام'),
                'password' => Hash::make(env('FINANCE_ADMIN_PASSWORD', '12345678')),
            ]
        );
    }
}
