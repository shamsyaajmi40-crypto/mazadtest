export const RATING_REASONS = {
  buyer_to_seller: {
    positive: [
      { key: "fast_communication", label: "تواصل سريع" },
      { key: "accurate_description", label: "وصف دقيق" },
      { key: "on_time_delivery", label: "التزم بالموعد" },
      { key: "good_packaging", label: "تغليف جيد وآمن" },
    ],
    negative: [
      { key: "late_delivery", label: "تأخير في التسليم" },
      { key: "item_not_as_described", label: "الوصف غير مطابق" },
      { key: "deal_not_completed", label: "لم تكتمل الصفقة" },
      { key: "poor_communication", label: "تواصل سيئ" },
    ],
  },

  seller_to_buyer: {
    positive: [
      { key: "fast_payment", label: "دفع سريع" },
      { key: "good_communication", label: "تواصل جيد" },
      { key: "serious_buyer", label: "مشتري جاد" },
    ],
    negative: [
      { key: "late_payment", label: "تأخير بالدفع" },
      { key: "did_not_complete_deal", label: "لم يُكمل الصفقة" },
      { key: "fake_bidding", label: "مزايدة وهمية" },
      { key: "unreachable", label: "لا يرد على الاتصالات" },
    ],
  },
};
