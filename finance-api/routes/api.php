<?php

use App\Http\Controllers\Api\AhmedIntegrationController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\ClientController;
use App\Http\Controllers\Api\ClientReminderController;
use App\Http\Controllers\Api\FollowUpController;
use App\Http\Controllers\Api\OverdueWhatsAppReportController;
use App\Http\Controllers\Api\PartnerClientController;
use App\Http\Controllers\Api\SafeClientImportController;
use App\Http\Controllers\Api\WhatsAppWebhookController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->group(function () {
    Route::get('integrations/ahmed/summary', [AhmedIntegrationController::class, 'summary']);
    Route::get('integrations/ahmed/installments-income', [AhmedIntegrationController::class, 'installmentsIncome']);
    Route::post('reports/overdue-whatsapp/send', [OverdueWhatsAppReportController::class, 'send'])->middleware('throttle:5,1');
    Route::get('wa/webhook', [WhatsAppWebhookController::class, 'verify']);
    Route::post('wa/webhook', [WhatsAppWebhookController::class, 'receive'])->middleware('throttle:30,1');

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
        Route::post('clients/safe-import', [SafeClientImportController::class, 'store']);
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
