<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Client;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;

class AhmedIntegrationController extends Controller
{
    private const AHMED_ACCOUNT_ID = 1;

    public function summary(): JsonResponse
    {
        // جميع القيم المرسلة إلى تطبيق أحمد تخص حساب الأدمن رقم 1 فقط.
        $clients = Client::with('payments')
            ->where('account_id', self::AHMED_ACCOUNT_ID)
            ->get();

        $today = Carbon::today();

        $includedClients = $clients->filter(
            fn ($client) => $this->isIncludedForAhmedMonthlyProfit($client, $today)
        );

        $stuckClients = $clients->filter(fn ($client) => $this->isStuckClient($client));
        $doneClients = $clients->filter(fn ($client) => $this->isDoneClient($client));
        $courtClients = $clients->filter(fn ($client) => $this->isCourtClient($client));

        // التأخير والنشاط يُحسبان من نفس مجموعة العملاء الداخلة في القيم المالية؛
        // لذلك لا يمكن أن يتجاوز مجموعهما عدد العملاء المحتسبين.
        $overdueClients = $includedClients->filter(
            fn ($client) => $this->isOverdueClient($client, $today)
        );

        $activeClients = $includedClients->filter(
            fn ($client) => ! $this->isOverdueClient($client, $today)
        );

        $monthlyInstallmentsTotal = $includedClients->sum(
            fn ($client) => $client->getMonthlyInstallment()
        );

        $monthlyProfitTotal = $includedClients->sum(
            fn ($client) => $client->getMonthlyProfit()
        );

        $ahmedMonthlyProfit = $includedClients->sum(
            fn ($client) => $this->ahmedProfitAmount($client, $client->getMonthlyProfit())
        );

        $aliMonthlyProfit = $includedClients->sum(
            fn ($client) => $this->aliProfitAmount($client, $client->getMonthlyProfit())
        );

        $remainingInstallmentsTotal = $includedClients->sum(
            fn ($client) => $client->getRemainingAmount()
        );

        $remainingPrincipalTotal = $includedClients->sum(
            fn ($client) => $client->getRemainingPrincipal()
        );

        $ahmedTotalProfit = $includedClients->sum(
            fn ($client) => $this->ahmedProfitAmount($client, $client->getTotalProfit())
        );

        // قيم المتعثرين معلومات مستقلة للعرض فقط؛ لأنهم مستبعدون أصلًا من
        // includedClients، ولذلك لا تُطرح أرباحهم مرة ثانية من صافي الربح.
        $ahmedStuckProfitExcluded = $stuckClients->sum(
            fn ($client) => $this->ahmedProfitAmount($client, $client->getTotalProfit())
        );

        $ahmedStuckMonthlyProfitExcluded = $stuckClients->sum(
            fn ($client) => $this->ahmedProfitAmount($client, $client->getMonthlyProfit())
        );

        $overdueAmount = $overdueClients->sum(
            fn ($client) => $this->overdueAmount($client, $today)
        );

        $overdueInstallments = $overdueClients->sum(
            fn ($client) => $this->overdueCount($client, $today)
        );

        return response()->json([
            'data' => [
                'source' => 'finance',
                'source_account' => 'admin@pm.sa',
                'source_account_id' => self::AHMED_ACCOUNT_ID,
                'currency' => 'SAR',
                'synced_at' => now()->toDateTimeString(),
                'period' => [
                    'from' => now()->startOfMonth()->toDateString(),
                    'to' => now()->endOfMonth()->toDateString(),
                ],
                'income' => [
                    'monthly_installments_total' => $this->money($monthlyInstallmentsTotal),
                    'monthly_profit_total' => $this->money($monthlyProfitTotal),
                    'ahmed_monthly_profit' => $this->money($ahmedMonthlyProfit),
                    'ali_monthly_profit' => $this->money($aliMonthlyProfit),
                ],
                'portfolio' => [
                    'active_monthly_installments' => $this->money($monthlyInstallmentsTotal),
                    'remaining_installments_total' => $this->money($remainingInstallmentsTotal),
                    'remaining_principal_total' => $this->money($remainingPrincipalTotal),
                    'ahmed_total_profit' => $this->money($ahmedTotalProfit),

                    // الأسماء القديمة محفوظة للتوافق مع تطبيق أحمد، لكن القيمة
                    // أصبحت معلومة مستقلة وليست مبلغًا يُطرح مرة ثانية.
                    'ahmed_stuck_profit_deduction' => $this->money($ahmedStuckProfitExcluded),
                    'ahmed_stuck_profit_excluded' => $this->money($ahmedStuckProfitExcluded),
                    'ahmed_net_profit_after_stuck_deduction' => $this->money($ahmedTotalProfit),

                    'ahmed_monthly_profit' => $this->money($ahmedMonthlyProfit),
                    'ahmed_stuck_monthly_profit_deduction' => $this->money($ahmedStuckMonthlyProfitExcluded),
                    'ahmed_stuck_monthly_profit_excluded' => $this->money($ahmedStuckMonthlyProfitExcluded),
                    'ahmed_monthly_net_profit_after_stuck_deduction' => $this->money($ahmedMonthlyProfit),
                ],
                'counts' => [
                    // إجمالي العملاء المعروض في لوحة التمويل: نشط + متأخر.
                    'clients_total' => $includedClients->count(),
                    'clients_included' => $includedClients->count(),
                    'clients_all_in_account' => $clients->count(),
                    'clients_active' => $activeClients->count(),
                    'clients_stuck' => $stuckClients->count(),
                    'clients_done' => $doneClients->count(),
                    'clients_court' => $courtClients->count(),
                    'clients_overdue' => $overdueClients->count(),
                    'overdue_installments' => (int) $overdueInstallments,
                ],
                'alerts' => [
                    'overdue_amount' => $this->money($overdueAmount),
                ],
                'rules' => [
                    'account_filter' => 'جميع القيم تخص حساب الأدمن رقم 1 فقط.',
                    'active_monthly_installments' => 'مجموع الأقساط الشهرية للعملاء النشطين والمتأخرين فقط في حساب الأدمن رقم 1، مع استبعاد المتعثرين والقضايا والمنتهين والملغيين.',
                    'ahmed_monthly_profit' => '65% من ربح التمويل الشهري إذا كان علي شريكًا، و100% إذا لم يكن علي شريكًا. يتم احتساب النشطين والمتأخرين فقط من حساب الأدمن رقم 1.',
                    'stuck_profit' => 'المتعثرون مستبعدون من الربح من البداية، وتُعرض قيمة ربحهم كمعلومة مستقلة فقط ولا تُطرح مرة ثانية.',
                    'overdue' => 'يُعد القسط متأخرًا بعد تجاوز تاريخ استحقاقه، وليس في يوم الاستحقاق نفسه.',
                    'included_statuses' => ['active', 'late', 'overdue'],
                    'excluded_statuses' => ['stuck', 'court', 'done', 'cancelled'],
                ],
            ],
        ]);
    }

    public function installmentsIncome(): JsonResponse
    {
        $summary = $this->summary()->getData(true)['data'] ?? [];

        return response()->json([
            'data' => [
                'label' => 'ربح أحمد الشهري من Finance',
                'amount' => $summary['portfolio']['ahmed_monthly_profit'] ?? 0,
                'currency' => 'SAR',
                'period' => 'monthly',
                'from' => $summary['period']['from'] ?? now()->startOfMonth()->toDateString(),
                'to' => $summary['period']['to'] ?? now()->endOfMonth()->toDateString(),
                'source' => 'finance',
                'source_account' => 'admin@pm.sa',
                'source_account_id' => self::AHMED_ACCOUNT_ID,
                'synced_at' => $summary['synced_at'] ?? now()->toDateTimeString(),
            ],
        ]);
    }

    private function isIncludedForAhmedMonthlyProfit(Client $client, Carbon $today): bool
    {
        if (
            $this->isStuckClient($client)
            || $this->isCourtClient($client)
            || $this->isDoneClient($client)
            || $this->isCancelledClient($client)
        ) {
            return false;
        }

        if ($client->getRemainingAmount() <= 0.01) {
            return false;
        }

        $status = $this->status($client);

        return in_array($status, ['active', 'late', 'overdue'], true)
            || $this->isOverdueClient($client, $today);
    }

    private function ahmedProfitAmount(Client $client, float $profit): float
    {
        return $profit * ($this->aliIsPartner($client) ? 0.65 : 1.0);
    }

    private function aliProfitAmount(Client $client, float $profit): float
    {
        return $profit * ($this->aliIsPartner($client) ? 0.35 : 0.0);
    }

    private function aliIsPartner(Client $client): bool
    {
        $share = strtolower(trim((string) ($client->profit_share ?: 'shared')));

        return ! in_array($share, [
            'ahmad_only',
            'ahmed_only',
            'none',
            'no_ali',
            'ahmad',
            'ahmed',
        ], true);
    }

    private function isStuckClient(Client $client): bool
    {
        return $this->status($client) === 'stuck';
    }

    private function isCourtClient(Client $client): bool
    {
        return (bool) ($client->has_court ?? false)
            || $this->status($client) === 'court';
    }

    private function isDoneClient(Client $client): bool
    {
        return in_array($this->status($client), ['done', 'completed', 'finished'], true)
            || $client->getRemainingAmount() <= 0.01;
    }

    private function isCancelledClient(Client $client): bool
    {
        return in_array($this->status($client), [
            'cancelled',
            'canceled',
            'void',
            'deleted',
        ], true);
    }

    private function isOverdueClient(Client $client, Carbon $today): bool
    {
        return $this->overdueCount($client, $today) > 0;
    }

    private function overdueCount(Client $client, Carbon $today): int
    {
        return count($this->overdueSchedule($client, $today));
    }

    private function overdueAmount(Client $client, Carbon $today): float
    {
        return array_sum(array_map(
            fn ($item) => (float) ($item['remaining_due'] ?? $item['amount'] ?? 0),
            $this->overdueSchedule($client, $today)
        ));
    }

    private function overdueSchedule(Client $client, Carbon $today): array
    {
        try {
            $schedule = $client->generateSchedule();
        } catch (\Throwable) {
            return [];
        }

        return array_values(array_filter($schedule, function ($item) use ($today) {
            $remaining = (float) ($item['remaining_due'] ?? $item['amount'] ?? 0);
            $dueDate = $item['due_date'] ?? null;

            if ($remaining <= 0.01 || ! $dueDate) {
                return false;
            }

            // لا يصبح القسط متأخرًا في يوم الاستحقاق؛ يبدأ التأخير من اليوم التالي.
            return Carbon::parse($dueDate)->lt($today);
        }));
    }

    private function status(Client $client): string
    {
        return strtolower(trim((string) ($client->status ?: 'active')));
    }

    private function money(float|int $value): float
    {
        return round((float) $value, 2);
    }
}
