<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('client_reminders', function (Blueprint $table) {
            $table->id();
            $table->foreignId('client_id')->constrained()->cascadeOnDelete();
            $table->string('key', 190);
            $table->string('kind', 30);
            $table->string('context', 30);
            $table->date('target_date');
            $table->string('title');
            $table->string('external_id')->nullable();
            $table->timestamps();

            $table->unique(['client_id', 'key', 'kind'], 'client_reminders_unique_key');
            $table->index(['client_id', 'target_date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('client_reminders');
    }
};
