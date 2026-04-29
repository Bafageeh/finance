<?php

use App\Models\Client;
use Illuminate\Support\Facades\Schema;

require __DIR__ . '/vendor/autoload.php';

$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$data = [
    'name'          => 'خالد قاسم',
    'id_number'     => '2322186574',
    'phone'         => '0562306556',
    'asset'         => 'سيارة',
    'contract_date' => '2023-06-06',
    'cost'          => 25548.28,

    // مهم: هذا هو أساس حساب الربح الحالي في Laravel.
    // لا تضع هنا 30195.88 وإلا سيصبح الربح الكلي غير مطابق للجدول.
    'principal'     => 25548.28,

    // 0.02040109 في ملف الإكسل تعني 2.040109% شهريًا.
    'rate'          => 2.040109,
    'months'        => 24,
    'bond_cost'     => 230.00,
    'bond_total'    => 38400.00,
    'profit_share'  => 'shared',
    'status'        => 'active',
    'has_court'     => false,
    'court_note'    => null,
];

$client = Client::updateOrCreate(
    ['id_number' => $data['id_number']],
    $data
);

$client->refresh();
$summary = method_exists($client, 'getSummary') ? $client->getSummary() : [];

$expected = [
    'funding_value_cost_plus_bond' => 25778.28,
    'full_financed_amount'        => 30195.88,
    'total_profit'                => 12621.72,
    'monthly_profit'              => 525.91,
    'ahmad_total'                 => 8204.12,
    'ahmad_monthly'               => 341.84,
    'ali_total'                   => 4417.60,
    'ali_monthly'                 => 184.07,
    'monthly_installment'         => 1600.00,
];

echo "تم إدخال/تحديث العميل بنجاح.\n";
echo "ID: {$client->id}\n";
echo "الاسم: {$client->name}\n";
echo "الهوية: {$client->id_number}\n";
echo "الجوال: {$client->phone}\n";
echo "قيمة الشراء: " . number_format((float) $client->cost, 2) . "\n";
echo "رسوم السند: " . number_format((float) $client->bond_cost, 2) . "\n";
echo "قيمة السند / القسط الكلي: " . number_format((float) $client->bond_total, 2) . "\n";
echo "القسط الشهري: " . number_format((float) ($summary['monthly_installment'] ?? $expected['monthly_installment']), 2) . "\n";
echo "الربح الكلي المتوقع: " . number_format($expected['total_profit'], 2) . "\n";
echo "المبلغ الممول بالكامل للعرض: " . number_format($expected['full_financed_amount'], 2) . "\n";

if (!empty($summary)) {
    echo "\nملخص من النظام بعد الإدخال:\n";
    foreach (['bond_total', 'financed_amount', 'total_profit', 'monthly_profit', 'ahmad_total', 'ahmad_monthly', 'ali_total', 'ali_monthly'] as $key) {
        if (array_key_exists($key, $summary)) {
            echo "- {$key}: " . number_format((float) $summary[$key], 2) . "\n";
        }
    }
}
