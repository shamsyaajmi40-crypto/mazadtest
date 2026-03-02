import React, { useState } from 'react';
import { ShieldAlert, AlertTriangle, AlertCircle, Loader2 } from 'lucide-react';

interface TermsModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAccept: () => void;
    title: string;
    description: React.ReactNode;
    termsList: string[];
    actionLabel?: string;
    isLoading?: boolean;
}

const TermsModal: React.FC<TermsModalProps> = ({
    isOpen,
    onClose,
    onAccept,
    title,
    description,
    termsList,
    actionLabel = "أوافق على الشروط واستمرار",
    isLoading = false,
}) => {
    const [agreed, setAgreed] = useState(false);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" dir="rtl">
            {/* Background Overlay to close */}
            <div className="absolute inset-0" onClick={() => !isLoading && onClose()} />

            <div className="relative bg-white w-full max-w-lg rounded-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in duration-200">

                {/* Header */}
                <div className="flex items-center gap-3 p-6 border-b border-slate-100 bg-slate-50/50">
                    <div className="p-2 bg-rose-100 text-rose-600 rounded-xl">
                        <ShieldAlert className="w-6 h-6" />
                    </div>
                    <h2 className="text-xl font-black text-slate-800">{title}</h2>
                </div>

                {/* Content Body */}
                <div className="p-6 overflow-y-auto flex-1">

                    {/* Description Block */}
                    <div className="mb-6 p-4 bg-amber-50 border border-amber-200/60 rounded-2xl flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                        <div className="text-sm font-bold text-amber-800 leading-relaxed">
                            {description}
                        </div>
                    </div>

                    <h3 className="font-black text-slate-800 mb-3 px-1">شروط الاستخدام والإقرار:</h3>
                    <ul className="space-y-3 mb-6 bg-slate-50 p-5 rounded-2xl border border-slate-100">
                        {termsList.map((term, idx) => (
                            <li key={idx} className="flex gap-2.5 text-sm font-medium text-slate-600">
                                <span className="text-rose-500 font-bold mt-0.5">•</span>
                                <span className="leading-snug">{term}</span>
                            </li>
                        ))}
                    </ul>

                    {/* Checkbox agreement */}
                    <label className="flex items-start gap-3 cursor-pointer group p-3 rounded-xl hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-200">
                        <div className="relative flex items-center">
                            <input
                                type="checkbox"
                                checked={agreed}
                                onChange={(e) => setAgreed(e.target.checked)}
                                className="peer shrink-0 appearance-none w-5 h-5 border-2 border-slate-300 rounded-lg checked:bg-emerald-500 checked:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all cursor-pointer"
                            />
                            <div className="absolute inset-0 flex items-center justify-center opacity-0 peer-checked:opacity-100 pointer-events-none transition-opacity text-white">
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3.5">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                            </div>
                        </div>
                        <div className="text-sm font-bold text-slate-700 select-none pt-0.5 group-hover:text-slate-900 transition-colors">
                            أقر بأنني قرأت الشروط المذكورة أعلاه وأوافق عليها تماماً.
                        </div>
                    </label>
                </div>

                {/* Footer Actions */}
                <div className="p-5 border-t border-slate-100 bg-slate-50/80 flex items-center gap-3">
                    <button
                        onClick={onClose}
                        disabled={isLoading}
                        className="flex-1 py-3.5 px-4 font-bold text-slate-600 bg-white border-2 border-slate-200 border-b-4 hover:border-slate-300 hover:bg-slate-50 active:border-b-2 active:translate-y-[2px] rounded-xl transition-all disabled:opacity-50"
                    >
                        إلغاء
                    </button>

                    <button
                        onClick={() => {
                            if (agreed && !isLoading) {
                                onAccept();
                            }
                        }}
                        disabled={!agreed || isLoading}
                        className={`flex-[2] py-3.5 px-4 font-black rounded-xl border-b-4 transition-all flex items-center justify-center gap-2 ${agreed
                                ? "bg-slate-900 text-white border-slate-950 hover:bg-slate-800 active:border-b-0 active:translate-y-[4px] shadow-lg shadow-slate-900/20"
                                : "bg-slate-200 text-slate-400 border-slate-300 cursor-not-allowed"
                            }`}
                    >
                        {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : actionLabel}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default TermsModal;
