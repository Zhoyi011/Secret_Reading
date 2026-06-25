import React, { useState, useEffect, useRef } from 'react';
import { ImageIcon, Loader2, X, ZoomIn } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ImageWrapperProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt?: string;
  className?: string;
  width?: number;
  height?: number;
  quality?: number | 'auto';
  crop?: 'fill' | 'scale' | 'fit' | 'thumb';
  placeholderClassName?: string;
  enableLightbox?: boolean;
  isR18?: boolean;
}

/**
 * Optimizes Cloudinary images by inserting dynamic next-gen formatting,
 * quality compression, and dimensional crop operations.
 */
function optimizeCloudinaryUrl(
  url: string,
  options: { width?: number; height?: number; quality?: number | 'auto'; crop?: string }
): string {
  if (!url || !url.includes('res.cloudinary.com')) return url;

  const { width, height, quality = 'auto', crop = 'fill' } = options;
  const parts = url.split('/upload/');
  
  if (parts.length === 2) {
    const transforms: string[] = ['f_auto'];

    if (quality) {
      transforms.push(`q_${quality}`);
    }

    if (width) {
      transforms.push(`w_${width}`);
    }

    if (height) {
      transforms.push(`h_${height}`);
    }

    if ((width || height) && crop) {
      transforms.push(`c_${crop}`);
    }

    const transformString = transforms.join(',');
    return `${parts[0]}/upload/${transformString}/${parts[1]}`;
  }

  return url;
}

/**
 * Optimizes Unsplash images by modifying query string parameters
 * to dynamically resize, re-format to webp, and compress.
 */
function optimizeUnsplashUrl(
  url: string,
  options: { width?: number; height?: number; quality?: number | 'auto' }
): string {
  if (!url || !url.includes('images.unsplash.com')) return url;

  try {
    const parsedUrl = new URL(url);
    parsedUrl.searchParams.set('auto', 'format');

    if (options.width) {
      parsedUrl.searchParams.set('w', options.width.toString());
    }

    if (options.height) {
      parsedUrl.searchParams.set('h', options.height.toString());
    }

    if (options.quality) {
      parsedUrl.searchParams.set('q', options.quality.toString());
    } else {
      parsedUrl.searchParams.set('q', '80');
    }

    if (options.width && options.height) {
      parsedUrl.searchParams.set('fit', 'crop');
    }

    return parsedUrl.toString();
  } catch (err) {
    return url;
  }
}

/**
 * Generically parses image sources and applies adaptive transformations.
 */
export function getOptimizedImageUrl(
  src: string,
  options: { width?: number; height?: number; quality?: number | 'auto'; crop?: 'fill' | 'scale' | 'fit' | 'thumb' }
): string {
  if (!src) return '';
  if (src.includes('res.cloudinary.com')) {
    return optimizeCloudinaryUrl(src, options);
  }
  if (src.includes('images.unsplash.com')) {
    return optimizeUnsplashUrl(src, options);
  }
  return src;
}

export default function ImageWrapper({
  src,
  alt = 'Image',
  className = '',
  width,
  height,
  quality = 'auto',
  crop = 'fill',
  placeholderClassName = '',
  enableLightbox = true,
  isR18 = false,
  style,
  ...rest
}: ImageWrapperProps) {
  const [isInView, setIsInView] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Apply optimizations
  const optimizedSrc = getOptimizedImageUrl(src, { width, height, quality, crop });

  useEffect(() => {
    // If IntersectionObserver is not available, immediately load image
    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) {
      setIsInView(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsInView(true);
            observer.disconnect();
          }
        });
      },
      {
        rootMargin: '150px', // Pre-load 150px before entering viewport
        threshold: 0.01,
      }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => {
      observer.disconnect();
    };
  }, [src]);

  // Lock scroll when lightbox expanded
  useEffect(() => {
    if (isExpanded) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          setIsExpanded(false);
        }
      };
      window.addEventListener('keydown', handleKeyDown);

      return () => {
        document.body.style.overflow = originalOverflow;
        window.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [isExpanded]);

  const handleImageLoad = () => {
    setIsLoaded(true);
  };

  const handleImageError = () => {
    setHasError(true);
  };

  return (
    <>
      <div
        ref={containerRef}
        onClick={() => enableLightbox && isLoaded && !hasError && setIsExpanded(true)}
        className={`relative overflow-hidden bg-gray-50/50 ${placeholderClassName} ${
          enableLightbox && isLoaded && !hasError ? 'cursor-zoom-in group' : ''
        }`}
        style={{
          width: width ? `${width}px` : undefined,
          height: height ? `${height}px` : undefined,
          ...style
        }}
        id="optimized-image-wrapper"
      >
        {/* Visual Shimmer / Placeholder when loading */}
        {!isLoaded && !hasError && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-50 animate-pulse">
            <Loader2 className="h-5 w-5 text-indigo-300 animate-spin shrink-0" />
          </div>
        )}

        {/* Broken image error state */}
        {hasError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-100 text-zinc-400 p-2 text-center select-none">
            <ImageIcon className="h-6 w-6 opacity-60 mb-1 shrink-0" />
            <span className="text-[10px] font-mono tracking-tight font-medium opacity-75">IMAGE NOT LOADED</span>
          </div>
        )}

        {/* Actual Responsive Image tag */}
        {isInView && !hasError && (
          <img
            src={optimizedSrc}
            alt={alt}
            onLoad={handleImageLoad}
            onError={handleImageError}
            className={`transition-opacity duration-300 ${
              isLoaded ? 'opacity-100' : 'opacity-0'
            } ${className}`}
            referrerPolicy="no-referrer"
            {...rest}
          />
        )}

        {/* Dynamic Zoom Badge on Hover */}
        {enableLightbox && isLoaded && !hasError && (
          <div className="absolute bottom-2 right-2 p-1.5 rounded-lg bg-black/60 backdrop-blur-xs text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
            <ZoomIn className="h-3.5 w-3.5" />
          </div>
        )}
      </div>

      {/* Lightbox Portal Overlay */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/95 backdrop-blur-md p-4 sm:p-8 select-none"
            onClick={() => setIsExpanded(false)}
          >
            {/* Smooth sliding overlay background */}
            <div className="absolute top-4 right-4 flex items-center gap-3">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsExpanded(false);
                }}
                className="p-2 sm:p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all shadow-md focus:outline-none cursor-pointer"
                title="关闭预览"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <motion.div
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 10 }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className="relative max-w-5xl max-h-[85vh] flex items-center justify-center"
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={src} // Show high-res original image in lightbox
                alt={alt}
                className="max-w-full max-h-[85vh] object-contain rounded-xl shadow-2xl border border-white/5"
                referrerPolicy="no-referrer"
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
