import React from "react";

interface RatingStarsProps {
  value: number;
}

const RatingStars = ({ value }: RatingStarsProps) => {
  const clampedValue = Math.max(0, Math.min(5, value));
  return (
    <div className="flex items-center gap-0.5" dir="rtl">
      {[1, 2, 3, 4, 5].map((index) => {
        const fillPercentage = Math.max(0, Math.min(1, clampedValue - (index - 1))) * 100;
        return (
          <div key={index} className="relative w-[14px] h-[14px]">
            <svg className="absolute inset-0 text-slate-200" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
            </svg>
            {fillPercentage > 0 && (
              <svg
                className="absolute inset-0 text-amber-400"
                viewBox="0 0 24 24"
                fill="currentColor"
                style={{ clipPath: `polygon(100% 0, ${100 - fillPercentage}% 0, ${100 - fillPercentage}% 100%, 100% 100%)` }}
              >
                <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
              </svg>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default RatingStars;
