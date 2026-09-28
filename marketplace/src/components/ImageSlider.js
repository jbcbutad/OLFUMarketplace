"use client"; // This tells Next.js this component uses interactivity

import { useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";

export default function ImageSlider({ images }) {
  const [currentIndex, setCurrentIndex] = useState(0);

  // If there are no images, don't render anything
  if (!images || images.length === 0) return null;

  const nextSlide = () => {
    setCurrentIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
  };

  const prevSlide = () => {
    setCurrentIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
  };

  return (
    <div className="space-y-4">
      {/* Main Image Slider */}
      <div className="relative aspect-square rounded-2xl overflow-hidden border-3 border-black bg-black shadow-xl group">
        <Image
          src={images[currentIndex]}
          alt={`Product Image ${currentIndex + 1}`}
          fill
          // ✅ FIXED: Added sizes for the main slider image
          sizes="(max-width: 768px) 100vw, 50vw" 
          className="object-cover transition-opacity duration-300"
          priority
        />

        {/* Navigation Arrows (Only show if there's more than 1 image) */}
        {images.length > 1 && (
          <>
            <button
              onClick={prevSlide}
              className="absolute left-4 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/90 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-all z-10"
            >
              <ChevronLeft size={24} />
            </button>
            <button
              onClick={nextSlide}
              className="absolute right-4 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/90 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-all z-10"
            >
              <ChevronRight size={24} />
            </button>
          </>
        )}
      </div>

      {/* Clickable Thumbnails */}
      {images.length > 1 && (
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
          {images.map((imgUrl, index) => (
            <button
              key={index}
              onClick={() => setCurrentIndex(index)}
              className={`relative w-20 h-20 shrink-0 rounded-lg overflow-hidden border-2 transition-all ${
                currentIndex === index
                  ? "border-blue-500 opacity-100"
                  : "border-transparent opacity-50 hover:opacity-100"
              }`}
            >
              <Image 
                src={imgUrl} 
                alt={`Thumbnail ${index + 1}`} 
                fill 
                // ✅ FIXED: Added sizes for the thumbnail images (w-20 = 80px)
                sizes="80px"
                className="object-cover" 
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}