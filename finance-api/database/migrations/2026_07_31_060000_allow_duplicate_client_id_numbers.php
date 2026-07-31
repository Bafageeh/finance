<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * رقم الهوية حقل تعريفي للعميل، وليس مفتاحًا فريدًا للتمويل.
     * قد يوجد أكثر من سجل عميل يحمل الرقم نفسه، لذلك نزيل أي فهرس
     * فريد يتضمن هذا الحقل ونبقي الفهارس العادية دون تغيير.
     */
    public function up(): void
    {
        $uniqueIndexes = collect(DB::select("SHOW INDEX FROM `clients` WHERE `Non_unique` = 0"))
            ->groupBy(fn (object $index): string => (string) $index->Key_name)
            ->filter(fn ($columns): bool => $columns->contains(
                fn (object $index): bool => (string) $index->Column_name === 'id_number'
            ));

        foreach ($uniqueIndexes->keys() as $indexName) {
            if ($indexName === 'PRIMARY') {
                continue;
            }

            $escapedIndexName = str_replace('`', '``', (string) $indexName);
            DB::statement("ALTER TABLE `clients` DROP INDEX `{$escapedIndexName}`");
        }
    }

    /**
     * لا نعيد قيد uniqueness عند الرجوع؛ فقد تكون هناك هويات مكررة
     * أُضيفت بصورة صحيحة بعد تطبيق هذا التغيير.
     */
    public function down(): void
    {
        // Intentionally left empty.
    }
};
