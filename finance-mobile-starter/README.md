# Finance Mobile Starter

هذا المشروع هو **بداية عملية** لتحويل نظام التمويل الحالي إلى **تطبيق جوال Expo + React Native + TypeScript** يعمل لاحقًا على **Android و iPhone** من نفس الكود.

## ماذا يحتوي؟

- هيكل Expo Router جاهز
- تبويبات رئيسية:
  - الرئيسية
  - العملاء
  - الإحصائيات
- شاشة تفاصيل العميل
- شاشة إضافة / تعديل عميل
- تسجيل دفعة / إلغاء دفعة
- ربط مع Laravel API الحالي
- وضع Mock للمعاينة السريعة بدون API

## المجلدات المهمة

- `src/app` الشاشات والمسارات
- `src/components` المكونات العامة
- `src/services/api.ts` الربط مع الـ API
- `src/services/mock-data.ts` بيانات تجريبية للمعاينة
- `src/types/api.ts` أنواع البيانات
- `src/utils` أدوات التنسيق والحسابات

## التشغيل

```bash
npm install
cp .env.example .env
npx expo start
```

## الإعداد

### 1) لتجربة التطبيق على الـ API الحقيقي

عدّل ملف `.env` إلى رابط Laravel الفعلي:

```env
EXPO_PUBLIC_API_BASE_URL=https://my.pm.sa/api/v1
EXPO_PUBLIC_USE_MOCKS=false
```

### 2) للمعاينة السريعة بدون API

```env
EXPO_PUBLIC_API_BASE_URL=https://example.com/api/v1
EXPO_PUBLIC_USE_MOCKS=true
```

## ملاحظات مهمة عن الـ API الحالي

بناءً على تحليل مشروع Laravel الحالي، هناك نقطتان تحتاجان تعديل قريبًا:

1. **تعديل العميل**
   - الـ endpoint الحالي للتعديل لا يحفظ بعض الحقول المالية مثل:
   - `contract_date`
   - `cost`
   - `principal`
   - `rate`
   - `months`
   - `bond_cost`
   - `bond_total`
   - `profit_share`

2. **تسجيل الدفعة**
   - منطق احتساب عدد الدفعات المدفوعة في `recordPayment()` يحتاج تصحيح حتى لا يضيف عدًّا زائدًا عند تحديث دفعة موجودة.

## الترتيب المقترح للعمل

### المرحلة 1
- تشغيل هذا المشروع على Expo
- ربطه بالـ API
- اختبار الشاشات الأساسية

### المرحلة 2
- إصلاح Laravel API
- إضافة تسجيل دخول وصلاحيات
- إقفال الـ API

### المرحلة 3
- تحسين تجربة الجوال
- تنبيهات
- ملفات مرفقة
- تقارير وتصدير

### المرحلة 4
- إنشاء Preview builds
- إخراج نسخة Android
- إخراج نسخة iOS

## أوامر مفيدة

```bash
npm run android
npm run ios
npm run web
```

## ملاحظات النشر لاحقًا

قبل رفع التطبيق للمتاجر غيّر هذه القيم في `app.json`:

- `expo.name`
- `expo.slug`
- `android.package`
- `ios.bundleIdentifier`

## الفكرة من هذه النسخة

هذه النسخة ليست الشكل النهائي للتطبيق، لكنها **قاعدة نظيفة ومنظمة** نبدأ منها بدل الاستمرار على ملف HTML كبير.
