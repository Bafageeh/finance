<?php

namespace App\Providers;

use App\Http\Controllers\Api\ActiveLateClientsXlsxReportController;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\ServiceProvider;

class ReportRouteServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        Route::middleware('finance.auth')
            ->prefix('api/v1')
            ->get('reports/active-late-clients-xlsx', [ActiveLateClientsXlsxReportController::class, 'download']);
    }
}
