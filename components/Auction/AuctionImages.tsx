import React, { useState } from "react";
import { ChevronRight, ChevronLeft, Image, X, Maximize2 } from "lucide-react";
import { getImageUrl } from "@/utils/getImageUrl";
import { motion, AnimatePresence } from "framer-motion";

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
          <motion.img
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            key={activeImageIndex}
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

      <AnimatePresence>
        {lightboxOpen && hasImages && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] bg-slate-950/95 backdrop-blur-md flex items-center justify-center p-4 select-none"
            onClick={() => setLightboxOpen(false)}
          >
            <motion.button
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              type="button"
              onClick={() => setLightboxOpen(false)}
              className="absolute top-6 left-6 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center border border-white/10 transition-colors"
            >
              <X className="w-6 h-6" />
            </motion.button>

            {totalImages > 1 && (
              <>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    prevImage();
                  }}
                  className="absolute right-4 sm:right-10 top-1/2 -translate-y-1/2 w-14 h-14 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center border border-white/10 transition-all active:scale-90"
                >
                  <ChevronRight className="w-8 h-8" />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    nextImage();
                  }}
                  className="absolute left-4 sm:left-10 top-1/2 -translate-y-1/2 w-14 h-14 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center border border-white/10 transition-all active:scale-90"
                >
                  <ChevronLeft className="w-8 h-8" />
                </button>
              </>
            )}

            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="relative max-h-[85vh] max-w-[95vw]"
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={getImageUrl(auction.images?.[activeImageIndex] || auction.images?.[0])}
                alt={auction.title}
                className="max-h-[85vh] max-w-[95vw] object-contain rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.5)]"
              />
              <div className="absolute inset-0 pointer-events-none rounded-2xl ring-1 ring-white/20"></div>
            </motion.div>

            <div className="absolute bottom-8 right-1/2 translate-x-1/2 flex flex-col items-center gap-4">
              <div className="text-white/90 text-sm font-black bg-white/10 backdrop-blur-md px-5 py-2 rounded-full border border-white/10 shadow-xl">
                {activeImageIndex + 1} / {totalImages}
              </div>
              
              <div className="flex gap-2.5 overflow-x-auto p-2 max-w-[90vw] hide-scrollbar">
                {auction.images.map((img: string, idx: number) => (
                  <button
                    key={`lb-${idx}`}
                    onClick={(e) => { e.stopPropagation(); setActiveImageIndex(idx); }}
                    className={`relative shrink-0 w-14 h-14 rounded-xl overflow-hidden border-2 transition-all ${idx === activeImageIndex ? "border-primary scale-110" : "border-white/20 opacity-40"}`}
                  >
                    <img src={getImageUrl(img)} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default AuctionImages;
