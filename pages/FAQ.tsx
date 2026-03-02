
import React from 'react';
import { HelpCircle, MessageCircle, ShieldCheck, CreditCard, Gavel, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const FAQ = () => {
  const navigate = useNavigate();

  const placeholderFAQs = [
    {
      category: "عن المنصة",
      icon: <HelpCircle className="w-6 h-6 text-primary" />,
      items: [
        { q: "سؤال تجريبي: كيف تعمل منصة مزاد؟", a: "هنا ستوضع الإجابة التفصيلية حول آلية عمل المنصة لاحقاً." },
      ]
    },
    {
      category: "المزايدة والشراء",
      icon: <Gavel className="w-6 h-6 text-emerald-500" />,
      items: [
        { q: "سؤال تجريبي: كيف يمكنني المشاركة في مزاد؟", a: "سيتم شرح خطوات المشاركة في المزايدة هنا." },
      ]
    },
    {
      category: "الأمان والخصوصية",
      icon: <ShieldCheck className="w-6 h-6 text-rose-500" />,
      items: [
        { q: "سؤال تجريبي: هل بياناتي الشخصية آمنة؟", a: "سيتم توضيح إجراءات حماية البيانات هنا." },
      ]
    }
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      {/* Header */}
      <div className="text-center mb-16">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/10 rounded-3xl mb-4">
          <HelpCircle className="w-8 h-8 text-primary" />
        </div>
        <h1 className="text-4xl font-black text-slate-900 mb-4 tracking-tight">الأسئلة الشائعة</h1>
        <p className="text-slate-500 text-lg max-w-2xl mx-auto font-medium">
          هنا تجد إجابات على أكثر الاستفسارات شيوعاً حول استخدام منصة مزاد في العراق.
        </p>
      </div>

      {/* FAQ Categories */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {placeholderFAQs.map((section, idx) => (
          <div key={idx} className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-slate-50 rounded-2xl">{section.icon}</div>
              <h2 className="text-xl font-black text-slate-900">{section.category}</h2>
            </div>
            
            <div className="space-y-6">
              {section.items.map((item, i) => (
                <div key={i} className="group cursor-pointer">
                  <h3 className="font-bold text-slate-800 mb-2 flex items-start gap-2 group-hover:text-primary transition-colors">
                    <span className="text-primary opacity-50 text-xl font-black">؟</span>
                    {item.q}
                  </h3>
                  <p className="text-slate-500 text-sm leading-relaxed pr-5 border-r-2 border-slate-50 group-hover:border-primary/20 transition-all">
                    {item.a}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Support Card */}
        <div className="bg-slate-900 p-8 rounded-[2.5rem] shadow-xl text-white flex flex-col justify-center items-center text-center">
          <div className="bg-white/10 p-4 rounded-3xl mb-6">
            <MessageCircle className="w-10 h-10 text-primary-light" />
          </div>
          <h2 className="text-2xl font-black mb-2">لم تجد إجابتك؟</h2>
          <p className="text-slate-400 mb-8 text-sm font-medium">
            فريق الدعم الفني متواجد لمساعدتك في أي وقت على مدار الساعة.
          </p>
          <button className="bg-primary hover:bg-primary-dark text-white px-8 py-4 rounded-2xl font-black transition-all active:scale-95 shadow-lg shadow-primary/20">
            تواصل معنا الآن
          </button>
        </div>
      </div>

      {/* Back Button */}
      <div className="mt-16 text-center">
        <button 
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 text-slate-400 hover:text-primary font-bold transition-colors"
        >
          <ArrowLeft className="w-5 h-5" /> العودة للصفحة السابقة
        </button>
      </div>
    </div>
  );
};

export default FAQ;
