import React, { useState } from "react";
import { ChevronRight, ChevronLeft, Image, X } from "lucide-react";
import { getImageUrl } from "@/utils/getImageUrl";

interface AuctionImagesProps {
  auction: any;
}

const AuctionImages = ({ auction }: AuctionImagesProps) => {
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [touchStart, setTouchStart] = useState<number | null>(null);

  const hasImages = auction.images && auction.images.length > 0;
  const totalImages = auction.images?.length || 0;

  const nextImage = () => setActiveImageIndex((prev) => (prev + 1) % totalImages);
  const prevImage = () => setActiveImageIndex((prev) => (prev === 0 ? totalImages - 1 : prev - 1));

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStart === null) return;
    const touchEnd = e.changedTouches[0].clientX;
    if (touchStart - touchEnd > 70) nextImage();
    if (touchStart - touchEnd < -70) prevImage();
    setTouchStart(null);
  };

  return (
    <>
      <div
        className="relative w-full aspect-[4/3] md:aspect-video rounded-3xl overflow-hidden bg-slate-100 shadow-xl group touch-pan-x"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {hasImages ? (
          <img
            src={getImageUrl(auction.images?.[activeImageIndex] || auction.images?.[0])}
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 cursor-zoom-in"
            alt={auction.title}
            onClick={() => setLightboxOpen(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-400">
            <div className="flex flex-col items-center gap-2">
              <Image className="w-10 h-10" />
              <span className="text-sm font-bold">لا توجد صور</span>
            </div>
          </div>
        )}

        {totalImages > 1 && (
          <>
            <div className="absolute top-4 left-4 bg-slate-900/40 text-white text-xs font-black px-3.5 py-1.5 rounded-full backdrop-blur-md shadow-lg">
              {activeImageIndex + 1} / {totalImages}
            </div>
            <button
              onClick={prevImage}
              className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/40 hover:bg-white/90 backdrop-blur-md p-3 rounded-2xl shadow-lg transition-all text-slate-800 opacity-0 group-hover:opacity-100 focus:opacity-100 active:scale-95 border border-white/40"
            >
              <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>
            <button
              onClick={nextImage}
              className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/40 hover:bg-white/90 backdrop-blur-md p-3 rounded-2xl shadow-lg transition-all text-slate-800 opacity-0 group-hover:opacity-100 focus:opacity-100 active:scale-95 border border-white/40"
            >
              <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>

            {/* Pagination Dots */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 bg-black/20 backdrop-blur-sm px-3 py-1.5 rounded-full truncate">
              {auction.images.map((_: any, idx: number) => (
                <span
                  key={idx}
                  className={`h-1.5 rounded-full transition-all duration-300 ${idx === activeImageIndex ? "w-4 bg-white" : "w-1.5 bg-white/50"}`}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {totalImages > 1 && (
        <div className="flex gap-2.5 overflow-x-auto pb-2 snap-x hide-scrollbar">
          {auction.images.map((img: string, idx: number) => (
            <button
              key={`${img}-${idx}`}
              type="button"
              onClick={() => setActiveImageIndex(idx)}
              className={`relative shrink-0 w-16 h-16 sm:w-20 sm:h-20 rounded-2xl overflow-hidden border-2 transition-all duration-300 snap-center ${idx === activeImageIndex ? "border-primary shadow-md scale-105 z-10" : "border-slate-200/60 opacity-70 hover:opacity-100"}`}
            >
              <img
                src={getImageUrl(img)}
                alt={`${auction.title}-${idx + 1}`}
                className="w-full h-full object-cover"
              />
            </button>
          ))}
        </div>
      )}

      {lightboxOpen && hasImages && (
        <div
          className="fixed inset-0 z-[70] bg-slate-950/90 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setLightboxOpen(false)}
        >
          <button
            type="button"
            onClick={() => setLightboxOpen(false)}
            className="absolute top-4 left-4 w-10 h-10 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center"
          >
            <X className="w-5 h-5" />
          </button>

          {totalImages > 1 && (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  prevImage();
                }}
                className="absolute right-4 sm:right-8 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  nextImage();
                }}
                className="absolute left-4 sm:left-8 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
            </>
          )}

          <img
            src={getImageUrl(auction.images?.[activeImageIndex] || auction.images?.[0])}
            alt={auction.title}
            className="max-h-[88vh] max-w-[94vw] object-contain rounded-2xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
          <div className="absolute bottom-5 right-1/2 translate-x-1/2 text-white/90 text-sm font-black bg-white/10 px-3 py-1.5 rounded-full">
            {activeImageIndex + 1} / {totalImages}
          </div>
        </div>
      )}
    </>
  );
};

export default AuctionImages;
