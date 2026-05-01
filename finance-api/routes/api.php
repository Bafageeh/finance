<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\ClientController;
use App\Http\Controllers\Api\ClientReminderController;
use App\Http\Controllers\Api\FollowUpController;
use App\Http\Controllers\Api\PartnerClientController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->group(function () {
    Route::post('auth/login', [AuthController::class, 'login'])->middleware('throttle:10,1');
    Route::post('login', [AuthController::class, 'login'])->middleware('throttle:10,1');

    Route::middleware('finance.auth')->group(function () {
        Route::get('auth/me', [AuthController::class, 'me']);
        Route::get('me', [AuthController::class, 'me']);
        Route::get('user', [AuthController::class, 'me']);
        Route::post('auth/logout', [AuthController::class, 'logout']);
        Route::post('logout', [AuthController::class, 'logout']);

        Route::get('stats', [ClientController::class, 'stats']);
        Route::get('partner-clients', [PartnerClientController::class, 'index']);
        Route::get('partner-clients/{client}', [PartnerClientController::class, 'show']);
        Route::apiResource('clients', ClientController::class);
        Route::post('clients/{client}/pay', [ClientController::class, 'recordPayment']);
        Route::delete('clients/{client}/pay/{periodKey}', [ClientController::class, 'removePayment']);

        Route::get('follow-ups/summaries', [FollowUpController::class, 'summaries']);
        Route::get('clients/{client}/follow-ups', [FollowUpController::class, 'index']);
        Route::get('clients/{client}/follow-ups/summary', [FollowUpController::class, 'summary']);
        Route::post('clients/{client}/follow-ups', [FollowUpController::class, 'store']);
        Route::get('clients/{client}/reminders/summary', [ClientReminderController::class, 'summary']);
        Route::post('clients/{client}/reminders/upsert', [ClientReminderController::class, 'upsert']);
    });
});
