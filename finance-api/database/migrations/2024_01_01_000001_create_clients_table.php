<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('clients', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('id_number')->nullable();
            $table->string('phone')->nullable();
            $table->string('asset')->nullable();
            $table->date('contract_date');
            $table->decimal('cost', 12, 2)->default(0);           // تكلفة الشراء
            $table->decimal('principal', 12, 2)->default(0);      // المبلغ الممول بالكامل
            $table->decimal('rate', 8, 4)->default(0);            // نسبة الربح الشهرية
            $table->integer('months');
            $table->decimal('bond_cost', 8, 2)->default(74.75);   // تكلفة السند
            $table->decimal('bond_total', 12, 2)->nullable();     // قيمة السند الكاملة
            $table->enum('profit_share', ['shared', 'ahmad_only'])->default('shared');
            $table->enum('status', ['active', 'stuck', 'done'])->default('active');
            $table->boolean('has_court')->default(false);
            $table->text('court_note')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('clients');
    }
};
