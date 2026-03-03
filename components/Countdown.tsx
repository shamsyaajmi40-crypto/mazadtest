import { useEffect, useState } from "react";

interface CountdownProps {
  endTime: string;
  showBeforeMinutes?: number; // كم دقيقة قبل النهاية يظهر
}

const Countdown = ({
  endTime,
  showBeforeMinutes = 60, // الافتراضي 60 دقيقة
}: CountdownProps) => {
  const getRemaining = () => {
    const diff = new Date(endTime).getTime() - Date.now();
    return diff > 0 ? diff : 0;
  };

  const [remaining, setRemaining] = useState(getRemaining());

  useEffect(() => {
    const interval = setInterval(() => {
      setRemaining(getRemaining());
    }, 1000);

    return () => clearInterval(interval);
  }, [endTime]);

  const remainingMinutes = remaining / 60000;

  // ❌ لا نعرض العدّاد إذا الوقت بعيد
  if (remainingMinutes > showBeforeMinutes) {
    return null;
  }

  if (remaining <= 0) {
    return (
      <span className="text-xs font-bold text-red-600">
        انتهى المزاد
      </span>
    );
  }

  const totalSeconds = Math.floor(remaining / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  const urgent = remainingMinutes <= 5;

  return (
    <span
      className={`text-xs font-bold ${
        urgent ? "text-red-600" : "text-amber-600"
      }`}
    >
      ⏳ {minutes}:{seconds.toString().padStart(2, "0")}
    </span>
  );
};

export default Countdown;
