
import React from 'react';
import { ShieldCheck, Scale, Info, Lock, EyeOff, FileText } from 'lucide-react';

const PrivacyPolicy = () => {
  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-extrabold text-slate-900 mb-4">سياسة الخصوصية وإخلاء المسؤولية</h1>
        <p className="text-slate-500">آخر تحديث: {new Date().toLocaleDateString('ar-IQ')}</p>
      </div>

      <div className="space-y-12">
        {/* سياسة الخصوصية */}
        <section className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
          <div className="flex items-center gap-3 mb-6 border-b border-slate-50 pb-4">
            <Lock className="w-8 h-8 text-primary" />
            <h2 className="text-2xl font-bold text-slate-900">أولاً: سياسة الخصوصية</h2>
          </div>

          <div className="space-y-6 text-slate-600 leading-relaxed">
            <p>
              نحن في <strong>منصة "مزاد"</strong> نولي خصوصية بياناتكم أهمية قصوى. تلتزم المنصة بحماية كافة البيانات الشخصية التي يتم جمعها من المستخدمين (عاديين وتجار) وفقاً لأعلى معايير الأمان التقني.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-slate-50 p-6 rounded-2xl">
                <h3 className="font-bold text-slate-900 mb-3 flex items-center gap-2">
                  <Info className="w-5 h-5 text-primary" /> البيانات التي نجمعها
                </h3>
                <ul className="list-disc list-inside space-y-2 text-sm">
                  <li>الاسم الكامل ورقم الهاتف الموثق.</li>
                  <li>المحافظة والعنوان التفصيلي لإتمام المعاملات.</li>
                  <li>سجل المزايدات والمزادات المنشأة.</li>
                  <li>بيانات الدفع المشفرة (في حال تفعيل ميزات الدفع).</li>
                </ul>
              </div>

              <div className="bg-slate-50 p-6 rounded-2xl">
                <h3 className="font-bold text-slate-900 mb-3 flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-primary" /> استخدام البيانات
                </h3>
                <ul className="list-disc list-inside space-y-2 text-sm">
                  <li>إدارة الحسابات والتحقق من الهوية عبر الـ OTP.</li>
                  <li>تسهيل التواصل بين البائع والمشتري الفائز.</li>
                  <li>إرسال تنبيهات المزايدات وحماية أمن المنصة.</li>
                  <li>تحسين تجربة المستخدم وتحليل الأداء.</li>
                </ul>
              </div>
            </div>

            <h3 className="font-bold text-slate-900 mt-6">مشاركة البيانات وحمايتها</h3>
            <p>
              لا يتم مشاركة بياناتكم مع أي أطراف خارجية إلا في حالات الضرورة القانونية أو لإتمام عملية المزاد؛ حيث يتم تزويد <strong>الفائز بالمزاد فقط</strong> برقم هاتف البائع وعنوانه لإتمام عملية الاستلام والتسليم. نقوم بتشفير كافة البيانات الحساسة وحمايتها من الوصول غير المصرح به باستخدام بروتوكولات أمان متقدمة.
            </p>

            <h3 className="font-bold text-slate-900 mt-6">ملفات تعريف الارتباط (Cookies)</h3>
            <p>
              نستخدم ملفات تعريف الارتباط لتحسين سرعة التصفح وحفظ تفضيلاتكم الشخصية. للمستخدم الحق الكامل في تعديل بياناته أو طلب حذف حسابه نهائياً من المنصة عبر إعدادات الملف الشخصي.
            </p>
          </div>
        </section>

        {/* إخلاء المسؤولية */}
        <section className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
          <div className="flex items-center gap-3 mb-6 border-b border-slate-50 pb-4">
            <Scale className="w-8 h-8 text-accent" />
            <h2 className="text-2xl font-bold text-slate-900">ثانياً: إخلاء المسؤولية القانونية</h2>
          </div>

          <div className="space-y-6 text-slate-600 leading-relaxed">
            <div className="bg-red-50 border-r-4 border-red-500 p-4 rounded-lg flex items-start gap-3">
              <EyeOff className="w-6 h-6 text-red-500 flex-shrink-0" />
              <p className="text-sm text-red-800">
                تعمل منصة "مزاد" كوسيط تقني فقط لتسهيل عمليات المزايدة، ولا نتدخل في عمليات الفحص الفني للسلع أو عمليات الدفع المالي المباشر.
              </p>
            </div>

            <ul className="list-decimal list-inside space-y-4">
              <li>
                <strong>مسؤولية السلع:</strong> تقع المسؤولية الكاملة عن جودة، حالة، وقانونية المنتجات المعروضة على عاتق <strong>البائع</strong>. كما تقع مسؤولية التحقق والمعاينة قبل الشراء على عاتق <strong>المشتري</strong>.
              </li>
              <li>
                <strong>الامتثال للقوانين:</strong> يجب أن تكون كافة المزادات متوافقة مع القوانين والأنظمة المعمول بها في جمهورية العراق، ويُحظر عرض أي مواد ممنوعة قانوناً.
              </li>
              <li>
                <strong>النزاعات:</strong> أي نزاع مالي أو قانوني ينشأ بين البائع والمشتري يتم حله بين الطرفين مباشرة، والمنصة ليست طرفاً في أي تعويضات أو مطالبات قانونية.
              </li>
              <li>
                <strong>صحة المعلومات:</strong> يلتزم المستخدم بتقديم بيانات صحيحة ومحدثة. أي تلاعب في المزايدات أو تقديم بيانات وهمية يعرض الحساب للحظر النهائي والملاحقة القانونية.
              </li>
              <li>
                <strong>التعديلات:</strong> تحتفظ المنصة بالحق في تعديل هذه السياسات أو إيقاف أي خدمة في أي وقت لضمان جودة وأمان العمل.
              </li>
            </ul>

            <div className="mt-8 p-6 bg-slate-900 text-white rounded-2xl text-center">
              <FileText className="w-8 h-8 mx-auto mb-3 opacity-50" />
              <p className="font-bold">
                إن إتمامك لعملية التسجيل في منصة "مزاد" يُعد موافقة صريحة ونهائية على كافة البنود المذكورة أعلاه.
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
