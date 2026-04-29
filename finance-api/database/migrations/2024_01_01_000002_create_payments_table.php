<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('client_id')->constrained()->onDelete('cascade');
            $table->string('period_key');       // مثال: "2026-3"
            $table->integer('month_number');
            $table->date('due_date');
            $table->decimal('installment_amount', 12, 2);
            $table->decimal('paid_amount', 12, 2)->nullable();
            $table->text('bank_note')->nullable();
            $table->date('paid_date')->nullable();
            $table->boolean('is_paid')->default(false);
            $table->timestamps();

            $table->unique(['client_id', 'period_key']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payments');
    }
};
