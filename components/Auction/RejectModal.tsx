import React from "react";
import { X, AlertTriangle, Loader2, CheckCircle } from "lucide-react";

interface RejectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onReject: () => Promise<void>;
  rejectionReasons: string[];
  setRejectionReasons: React.Dispatch<React.SetStateAction<string[]>>;
  rejectionNote: string;
  setRejectionNote: React.Dispatch<React.SetStateAction<string>>;
  loading: boolean;
}

const RejectModal: React.FC<RejectModalProps> = ({
  isOpen,
  onClose,
  onReject,
  rejectionReasons,
  setRejectionReasons,
  rejectionNote,
  setRejectionNote,
  loading
}) => {
  if (!isOpen) return null;

  const reasons = [
    "صور غير واضحة",
    "وصف غير كافٍ",
    "سعر مبالغ فيه",
    "تصنيف خاطئ",
    "مخالف للشروط والأحكام",
    "أخرى"
  ];

  const toggleReason = (reason: string) => {
    if (rejectionReasons.includes(reason)) {
      setRejectionReasons(rejectionReasons.filter(r => r !== reason));
    } else {
      setRejectionReasons([...rejectionReasons, reason]);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-[100]">
      <div className="w-full max-w-md rounded-[2.5rem] bg-white p-8 shadow-2xl relative overflow-hidden border border-slate-100" dir="rtl">
        <div className="flex items-center justify-between mb-8">
          <div className="text-xl font-black text-slate-800 flex items-center gap-2">
            <span className="bg-rose-100 p-2 rounded-xl text-rose-600">
              <AlertTriangle className="w-5 h-5" />
            </span>
            رفض المزاد
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-6">
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-3">أسباب الرفض (اختر سببًا أو أكثر):</label>
            <div className="flex flex-wrap gap-2">
              {reasons.map(r => (
                <button
                  key={r}
                  onClick={() => toggleReason(r)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                    rejectionReasons.includes(r)
                      ? "bg-rose-600 text-white shadow-md shadow-rose-200"
                      : "bg-slate-50 text-slate-600 border border-slate-200 hover:border-slate-300"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 mb-2">ملاحظات إضافية:</label>
            <textarea
              value={rejectionNote}
              onChange={(e) => setRejectionNote(e.target.value)}
              placeholder="اكتب تفاصيل إضافية لمساعدة البائع على فهم سبب الرفض..."
              className="w-full rounded-2xl border-2 border-slate-100 bg-slate-50 p-4 font-bold text-sm text-slate-800 focus:outline-none focus:border-rose-500 min-h-[100px] resize-none"
            />
          </div>

          <button
            onClick={onReject}
            disabled={loading || (rejectionReasons.length === 0 && !rejectionNote.trim())}
            className="w-full py-4 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl font-black text-sm shadow-xl shadow-rose-900/10 transition-all active:scale-95 disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : "تأكيد الرفض وإخطار البائع"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default RejectModal;
