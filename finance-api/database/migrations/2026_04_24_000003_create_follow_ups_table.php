<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('follow_ups', function (Blueprint $table) {
            $table->id();
            $table->foreignId('client_id')->constrained()->cascadeOnDelete();
            $table->string('outcome', 30);
            $table->text('note')->nullable();
            $table->date('next_follow_up_at')->nullable();
            $table->string('channel', 30)->nullable();
            $table->timestamps();

            $table->index(['client_id', 'created_at']);
            $table->index(['client_id', 'next_follow_up_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('follow_ups');
    }
};
