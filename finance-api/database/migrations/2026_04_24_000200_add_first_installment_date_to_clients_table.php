<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('clients', 'first_installment_date')) {
            Schema::table('clients', function (Blueprint $table) {
                $table->date('first_installment_date')->nullable()->after('contract_date');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('clients', 'first_installment_date')) {
            Schema::table('clients', function (Blueprint $table) {
                $table->dropColumn('first_installment_date');
            });
        }
    }
};
