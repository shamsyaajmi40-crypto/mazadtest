import React from "react";
import { Trophy, Truck, Package, Navigation, Home, CreditCard, Check, X } from "lucide-react";

export const deliveryFailureReasonLabel: Record<string, string> = {
  BUYER_NO_SHOW: "المشتري غير متواجد",
  BUYER_REFUSED: "المشتري رفض الاستلام",
  BUYER_DID_NOT_RECEIVE: "المشتري لم يستلم البضاعة",
  BUYER_UNREACHABLE: "المشتري لا يرد",
  WRONG_ADDRESS: "عنوان غير صحيح/غير واضح",
  SELLER_NO_SHOW: "البائع غير متواجد",
  SELLER_NOT_READY: "البائع غير جاهز",
  COURIER_ISSUE: "مشكلة لوجستية",
};

interface DeliveryStepperProps {
  auction: any;
}

const DeliveryStepper = ({ auction }: DeliveryStepperProps) => {
  const order = auction.deliveryOrder;
  const status = order?.status;

  const steps = [
    { label: "تحديد الفائز", icon: Trophy, id: "WINNER" },
    { label: "حجز التوصيل", icon: Truck, id: "BOOKED" },
    { label: "انتظار الاستلام", icon: Package, id: "READY" },
    { label: "في الطريق", icon: Navigation, id: "TRANSIT" },
    { label: "تم الوصول", icon: Home, id: "DELIVERED" },
    { label: "اكتمال الدفع", icon: CreditCard, id: "COMPLETED" },
  ];

  // Calculate current step index
  const normalizedStatus = String(auction.status || "").toLowerCase();
  let currentStep = -1;
  
  if (normalizedStatus === "ended") currentStep = 0;
  if (order) {
    currentStep = 1;
    if (status === "READY_FOR_PICKUP") currentStep = 2;
    if (status === "PICKED_UP") currentStep = 3;
    if (status === "DELIVERED") currentStep = 4;
    if (status === "COD_PAID_TO_SELLER") currentStep = 5;
  }

  // إذا كانت الصفقة مكتملة وناجحة، نعتبر كل الخطوات منتهية (Index 6)
  if (normalizedStatus === "completed") {
    currentStep = 6;
  }

  const isFailed = status === "DELIVERY_FAILED";

  return (
    <div className="w-full py-6 px-2 mb-6">
      <div className="relative flex items-center justify-between">
        {/* Connection Lines */}
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-0.5 bg-slate-100 -z-10"></div>
        <div 
          className="absolute left-0 top-1/2 -translate-y-1/2 h-0.5 bg-primary transition-all duration-700 ease-in-out -z-10"
          style={{ width: `${(Math.min(steps.length - 1, Math.max(0, currentStep)) / (steps.length - 1)) * 100}%` }}
        ></div>

        {steps.map((step, idx) => {
          const Icon = step.icon;
          const isCompleted = idx < currentStep;
          const isActive = idx === currentStep;

          return (
            <div key={idx} className="flex flex-col items-center gap-2 relative">
              <div 
                className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all duration-500 shadow-sm border ${
                  isFailed && isActive ? "bg-rose-500 border-rose-300 text-white animate-bounce" :
                  isActive ? "bg-primary border-primary-light text-white shadow-primary/30 scale-110 ring-4 ring-primary/10" :
                  isCompleted ? "bg-emerald-500 border-emerald-300 text-white" :
                  "bg-white border-slate-200 text-slate-400"
                }`}
              >
                {isFailed && isActive ? <X className="w-5 h-5" /> : (isCompleted ? <Check className="w-5 h-5" /> : <Icon className={`w-5 h-5 ${isActive ? "animate-pulse" : ""}`} />)}
              </div>
              <span className={`text-[10px] font-black whitespace-nowrap hidden sm:block ${
                isFailed && isActive ? "text-rose-600" :
                isActive ? "text-primary" :
                isCompleted ? "text-emerald-600" :
                "text-slate-400"
              }`}>
                {step.label}
              </span>

              {/* Mobile Indicator Pointer */}
              {isActive && (
                <div className="absolute -top-1 w-2 h-2 bg-primary rounded-full sm:hidden"></div>
              )}
            </div>
          );
        })}
      </div>
      
      {/* Active Step Label for Mobile */}
      <div className="mt-4 text-center sm:hidden">
        <span className="text-xs font-black text-primary bg-primary/5 px-4 py-1.5 rounded-full border border-primary/10">
          المرحلة الحالية: {steps[Math.max(0, currentStep)]?.label}
        </span>
      </div>
    </div>
  );
};

export default DeliveryStepper;
