<?php

namespace App\Providers;

use App\Models\Client;
use App\Models\ClientReminder;
use App\Models\FollowUp;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        foreach ([Client::class, FollowUp::class, ClientReminder::class] as $modelClass) {
            $modelClass::addGlobalScope('account', function (Builder $builder) {
                $accountId = request()?->user()?->account_id;

                if ($accountId) {
                    $builder->where($builder->getModel()->getTable() . '.account_id', $accountId);
                }
            });

            $modelClass::creating(function ($model) {
                if (! $model->account_id) {
                    $model->account_id = request()?->user()?->account_id;
                }
            });
        }
    }
}
