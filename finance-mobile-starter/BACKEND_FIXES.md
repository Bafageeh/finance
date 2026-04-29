# Backend fixes recommended for Laravel API

## 1) Update endpoint should accept full financial fields

في `app/Http/Controllers/Api/ClientController.php` داخل `update()` اجعل التحقق يقبل:

- `contract_date`
- `cost`
- `principal`
- `rate`
- `months`
- `bond_cost`
- `bond_total`
- `profit_share`
- `status`
- `has_court`
- `court_note`

## 2) Fix recordPayment paid count

المنطق الحالي:

```php
$paidCount = $client->payments()->where('is_paid', true)->count() + 1;
```

الأصح أن يكون بعد `updateOrCreate()`:

```php
$paidCount = $client->payments()->where('is_paid', true)->count();
```

حتى لا يتم احتساب دفعة إضافية عند تعديل نفس القسط.

## 3) Add authentication

يفضل إضافة:

- Laravel Sanctum
- تسجيل دخول للمستخدمين
- حماية مسارات API

## 4) Restrict CORS

لا تترك CORS مفتوحًا لكل المصادر في بيئة الإنتاج.

## 5) Standardize response format

حافظ على نفس شكل الاستجابة في جميع المسارات:

```json
{
  "data": ...,
  "message": "..."
}
```
