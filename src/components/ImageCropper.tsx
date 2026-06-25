import React, { useState, useEffect, useRef } from 'react';
import { Check, X, Move, RotateCcw } from 'lucide-react';

interface ImageCropperProps {
  imageSrc: string;              // Base64 or image URL input
  onCropComplete: (croppedBase64: string) => void;
  onCancel: () => void;
}

export default function ImageCropper({ imageSrc, onCropComplete, onCancel }: ImageCropperProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [aspectRatioMode, setAspectRatioMode] = useState<string>('free'); // 'free', '1:1', '4:3', '16:9'
  
  // Crop box dimensions and position relative to the image container
  const [cropBox, setCropBox] = useState({ x: 50, y: 50, width: 160, height: 160 });
  const [imageRect, setImageRect] = useState({ left: 0, top: 0, width: 0, height: 0 });

  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);

  // Dragging and resizing state
  const [dragMode, setDragMode] = useState<'move' | 'n' | 's' | 'e' | 'w' | 'nw' | 'ne' | 'sw' | 'se' | null>(null);
  const dragStartOffset = useRef({ x: 0, y: 0 });
  const dragStartCropBox = useRef({ x: 0, y: 0, width: 0, height: 0 });

  // Refs for smooth tracking without listener re-binding lags
  const cropBoxRef = useRef(cropBox);
  const imageRectRef = useRef(imageRect);
  const aspectRatioModeRef = useRef(aspectRatioMode);
  const dragModeRef = useRef(dragMode);

  useEffect(() => {
    cropBoxRef.current = cropBox;
  }, [cropBox]);

  useEffect(() => {
    imageRectRef.current = imageRect;
  }, [imageRect]);

  useEffect(() => {
    aspectRatioModeRef.current = aspectRatioMode;
  }, [aspectRatioMode]);

  useEffect(() => {
    dragModeRef.current = dragMode;
  }, [dragMode]);

  // Calculate the actual position and size of the "object-contain" image inside the container
  const updateImageRect = () => {
    if (!imageRef.current || !containerRef.current) return;
    const img = imageRef.current;
    const container = containerRef.current;
    
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;
    
    const naturalWidth = img.naturalWidth;
    const naturalHeight = img.naturalHeight;
    
    if (naturalWidth === 0 || naturalHeight === 0) return;

    // Calculate object-contain bounding box
    const containerRatio = containerWidth / containerHeight;
    const imageRatio = naturalWidth / naturalHeight;
    
    let renderedWidth = containerWidth;
    let renderedHeight = containerHeight;
    
    if (imageRatio > containerRatio) {
      renderedHeight = containerWidth / imageRatio;
    } else {
      renderedWidth = containerHeight * imageRatio;
    }
    
    const renderedLeft = (containerWidth - renderedWidth) / 2;
    const renderedTop = (containerHeight - renderedHeight) / 2;
    
    const newRect = {
      left: renderedLeft,
      top: renderedTop,
      width: renderedWidth,
      height: renderedHeight
    };
    
    setImageRect(newRect);

    // Initialize or adjust crop box to center inside the image bounds
    const initialWidth = Math.min(renderedWidth * 0.7, 160);
    const initialHeight = Math.min(renderedHeight * 0.7, 160);
    
    setCropBox({
      x: renderedLeft + (renderedWidth - initialWidth) / 2,
      y: renderedTop + (renderedHeight - initialHeight) / 2,
      width: initialWidth,
      height: initialHeight
    });
    setAspectRatioMode('free');
  };

  // Reset when image changes
  useEffect(() => {
    setImageLoaded(false);
  }, [imageSrc]);

  // Handle window resizing
  useEffect(() => {
    window.addEventListener('resize', updateImageRect);
    return () => {
      window.removeEventListener('resize', updateImageRect);
    };
  }, []);

  // Update rect once image is loaded
  useEffect(() => {
    if (imageLoaded) {
      const timer = setTimeout(() => {
        updateImageRect();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [imageLoaded, imageSrc]);

  // Setup Global dragging event listeners - depends ONLY on dragMode state
  useEffect(() => {
    if (!dragMode) return;

    const handleGlobalMove = (e: MouseEvent) => {
      handleMove(e.clientX, e.clientY);
    };

    const handleGlobalTouchMove = (e: TouchEvent) => {
      if (e.touches[0]) {
        if (e.cancelable) {
          e.preventDefault();
        }
        handleMove(e.touches[0].clientX, e.touches[0].clientY);
      }
    };

    const handleGlobalEnd = () => {
      setDragMode(null);
    };

    window.addEventListener('mousemove', handleGlobalMove, { passive: false });
    window.addEventListener('mouseup', handleGlobalEnd);
    window.addEventListener('touchmove', handleGlobalTouchMove, { passive: false });
    window.addEventListener('touchend', handleGlobalEnd);

    return () => {
      window.removeEventListener('mousemove', handleGlobalMove);
      window.removeEventListener('mouseup', handleGlobalEnd);
      window.removeEventListener('touchmove', handleGlobalTouchMove);
      window.removeEventListener('touchend', handleGlobalEnd);
    };
  }, [dragMode]);

  // Redraw the real-time cropped preview canvas
  useEffect(() => {
    if (!imageRef.current || !previewCanvasRef.current || imageRect.width === 0) return;
    const img = imageRef.current;
    const canvas = previewCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const aspect = cropBox.width / cropBox.height;
    
    // Set fixed preview size maintaining aspect ratio
    canvas.width = 160;
    canvas.height = 160 / aspect;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Map screen container coordinates to natural image coordinates
    const scaleX = img.naturalWidth / imageRect.width;
    const scaleY = img.naturalHeight / imageRect.height;
    
    const sourceX = (cropBox.x - imageRect.left) * scaleX;
    const sourceY = (cropBox.y - imageRect.top) * scaleY;
    const sourceWidth = cropBox.width * scaleX;
    const sourceHeight = cropBox.height * scaleY;

    ctx.drawImage(
      img,
      Math.max(0, sourceX),
      Math.max(0, sourceY),
      Math.min(img.naturalWidth - sourceX, sourceWidth),
      Math.min(img.naturalHeight - sourceY, sourceHeight),
      0,
      0,
      canvas.width,
      canvas.height
    );
  }, [cropBox, imageRect, imageLoaded]);

  // Drag / Resize start handler
  const handleStart = (mode: typeof dragMode, clientX: number, clientY: number) => {
    setDragMode(mode);
    dragStartOffset.current = { x: clientX, y: clientY };
    dragStartCropBox.current = { ...cropBox };
  };

  // Perform calculations during drag using refs for buttery smoothness
  const handleMove = (clientX: number, clientY: number) => {
    const currentDragMode = dragModeRef.current;
    const rect = imageRectRef.current;
    if (!currentDragMode || rect.width === 0) return;
    
    const dx = clientX - dragStartOffset.current.x;
    const dy = clientY - dragStartOffset.current.y;
    
    const start = dragStartCropBox.current;
    let newBox = { ...start };
    
    const minSize = 30; // 30px min size for flexibility
    
    const limitLeft = rect.left;
    const limitRight = rect.left + rect.width;
    const limitTop = rect.top;
    const limitBottom = rect.top + rect.height;

    // Locked Aspect ratio
    let ratio = 1;
    const currentAspectMode = aspectRatioModeRef.current;
    const hasLockedRatio = currentAspectMode !== 'free';
    if (currentAspectMode === '1:1') ratio = 1;
    else if (currentAspectMode === '4:3') ratio = 4 / 3;
    else if (currentAspectMode === '16:9') ratio = 16 / 9;

    if (currentDragMode === 'move') {
      let newX = start.x + dx;
      let newY = start.y + dy;
      
      if (newX < limitLeft) newX = limitLeft;
      if (newX + start.width > limitRight) newX = limitRight - start.width;
      if (newY < limitTop) newY = limitTop;
      if (newY + start.height > limitBottom) newY = limitBottom - start.height;
      
      newBox.x = newX;
      newBox.y = newY;
    } else if (hasLockedRatio) {
      // Locked aspect ratio resizing - supported at corners
      if (currentDragMode === 'se') {
        let desiredRight = start.x + start.width + dx;
        if (desiredRight > limitRight) desiredRight = limitRight;
        let pWidth = desiredRight - start.x;
        let pHeight = pWidth / ratio;
        
        if (start.y + pHeight > limitBottom) {
          pHeight = limitBottom - start.y;
          pWidth = pHeight * ratio;
        }
        if (pWidth >= minSize && pHeight >= minSize) {
          newBox.width = pWidth;
          newBox.height = pHeight;
        }
      } else if (currentDragMode === 'sw') {
        let desiredX = start.x + dx;
        if (desiredX < limitLeft) desiredX = limitLeft;
        let pWidth = start.width + (start.x - desiredX);
        let pHeight = pWidth / ratio;
        
        if (start.y + pHeight > limitBottom) {
          pHeight = limitBottom - start.y;
          pWidth = pHeight * ratio;
          desiredX = start.x + start.width - pWidth;
        }
        if (pWidth >= minSize && pHeight >= minSize) {
          newBox.x = desiredX;
          newBox.width = pWidth;
          newBox.height = pHeight;
        }
      } else if (currentDragMode === 'ne') {
        let desiredRight = start.x + start.width + dx;
        if (desiredRight > limitRight) desiredRight = limitRight;
        let pWidth = desiredRight - start.x;
        let pHeight = pWidth / ratio;
        let desiredY = start.y + start.height - pHeight;
        
        if (desiredY < limitTop) {
          desiredY = limitTop;
          pHeight = start.y + start.height - desiredY;
          pWidth = pHeight * ratio;
          desiredRight = start.x + pWidth;
        }
        if (pWidth >= minSize && pHeight >= minSize) {
          newBox.y = desiredY;
          newBox.width = pWidth;
          newBox.height = pHeight;
        }
      } else if (currentDragMode === 'nw') {
        let desiredX = start.x + dx;
        if (desiredX < limitLeft) desiredX = limitLeft;
        let pWidth = start.width + (start.x - desiredX);
        let pHeight = pWidth / ratio;
        let desiredY = start.y + start.height - pHeight;
        
        if (desiredY < limitTop) {
          desiredY = limitTop;
          pHeight = start.y + start.height - desiredY;
          pWidth = pHeight * ratio;
          desiredX = start.x + start.width - pWidth;
        }
        if (pWidth >= minSize && pHeight >= minSize) {
          newBox.x = desiredX;
          newBox.y = desiredY;
          newBox.width = pWidth;
          newBox.height = pHeight;
        }
      }
    } else {
      // Free drag resizing
      if (currentDragMode.includes('n')) {
        let desiredY = start.y + dy;
        if (desiredY < limitTop) desiredY = limitTop;
        const pHeight = start.height + (start.y - desiredY);
        if (pHeight >= minSize) {
          newBox.y = desiredY;
          newBox.height = pHeight;
        }
      }
      if (currentDragMode.includes('s')) {
        let desiredBottom = start.y + start.height + dy;
        if (desiredBottom > limitBottom) desiredBottom = limitBottom;
        const pHeight = desiredBottom - start.y;
        if (pHeight >= minSize) {
          newBox.height = pHeight;
        }
      }
      if (currentDragMode.includes('w')) {
        let desiredX = start.x + dx;
        if (desiredX < limitLeft) desiredX = limitLeft;
        const pWidth = start.width + (start.x - desiredX);
        if (pWidth >= minSize) {
          newBox.x = desiredX;
          newBox.width = pWidth;
        }
      }
      if (currentDragMode.includes('e')) {
        let desiredRight = start.x + start.width + dx;
        if (desiredRight > limitRight) desiredRight = limitRight;
        const pWidth = desiredRight - start.x;
        if (pWidth >= minSize) {
          newBox.width = pWidth;
        }
      }
    }
    
    setCropBox(newBox);
  };

  // Adjust crop ratio and resize selection box
  const handleAspectRatioChange = (mode: string) => {
    setAspectRatioMode(mode);
    if (imageRect.width === 0) return;
    
    let targetRatio = 1;
    if (mode === '1:1') targetRatio = 1;
    else if (mode === '4:3') targetRatio = 4 / 3;
    else if (mode === '16:9') targetRatio = 16 / 9;
    else return; // 'free' mode leaves it as is
    
    // Calculate new crop box dimensions
    const maxW = Math.min(imageRect.width * 0.8, 180);
    const maxH = maxW / targetRatio;
    
    let finalW = maxW;
    let finalH = maxH;
    
    if (finalH > imageRect.height * 0.8) {
      finalH = imageRect.height * 0.8;
      finalW = finalH * targetRatio;
    }
    
    setCropBox({
      x: imageRect.left + (imageRect.width - finalW) / 2,
      y: imageRect.top + (imageRect.height - finalH) / 2,
      width: finalW,
      height: finalH
    });
  };

  // Reset the crop area to original centered defaults
  const handleReset = () => {
    updateImageRect();
  };

  // Generate cropped base64 output
  const handleGenerateCrop = () => {
    if (!imageRef.current || imageRect.width === 0) return;
    const img = imageRef.current;

    try {
      const scaleX = img.naturalWidth / imageRect.width;
      const scaleY = img.naturalHeight / imageRect.height;
      
      const sourceX = (cropBox.x - imageRect.left) * scaleX;
      const sourceY = (cropBox.y - imageRect.top) * scaleY;
      const sourceWidth = cropBox.width * scaleX;
      const sourceHeight = cropBox.height * scaleY;

      const canvas = document.createElement('canvas');
      const maxOutputDim = 800;
      
      let outWidth = sourceWidth;
      let outHeight = sourceHeight;
      if (outWidth > maxOutputDim || outHeight > maxOutputDim) {
        const ratio = outWidth / outHeight;
        if (ratio > 1) {
          outWidth = maxOutputDim;
          outHeight = maxOutputDim / ratio;
        } else {
          outHeight = maxOutputDim;
          outWidth = maxOutputDim * ratio;
        }
      }
      
      canvas.width = outWidth;
      canvas.height = outHeight;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.drawImage(
        img,
        Math.max(0, sourceX),
        Math.max(0, sourceY),
        Math.min(img.naturalWidth - sourceX, sourceWidth),
        Math.min(img.naturalHeight - sourceY, sourceHeight),
        0,
        0,
        outWidth,
        outHeight
      );

      const croppedUrl = canvas.toDataURL('image/jpeg', 0.90);
      onCropComplete(croppedUrl);
    } catch (err: any) {
      console.error("Canvas cropping failed:", err);
      alert("裁剪图片失败：由于浏览器的安全策略（跨域限制），部分外部网络图片可能无法直接裁剪。建议您点击上方“上传新配图”或拖入本地文件后再进行裁剪，即可完美呈现！");
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/85 backdrop-blur-md p-4 overflow-y-auto animate-fade-in" id="crop-avatar-modal">
      <div className="bg-white rounded-3xl max-w-md w-full p-5 shadow-2xl border border-gray-100 flex flex-col gap-4 relative my-auto max-h-[96vh] overflow-y-auto">
        {/* Decorative background blur */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50/40 rounded-full blur-2xl pointer-events-none -mr-8 -mt-8" />
        
        {/* Child 1: Header */}
        <div className="flex items-center justify-between border-b border-gray-100 pb-2.5 shrink-0">
          <div>
            <h3 className="font-sans font-extrabold text-slate-900 text-base">拖拽拉伸剪裁图片</h3>
            <p className="text-[10px] text-slate-400 mt-0.5">拖动裁剪框移动位置，拉动边缘/角落调整宽度和长度</p>
          </div>
          <button 
            type="button"
            onClick={onCancel}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="h-4.5 w-4.5" />
          </button>
        </div>

        {/* Child 2: Viewport with custom selection box resizing */}
        <div 
          ref={containerRef}
          className="relative w-full h-[260px] rounded-2xl bg-slate-950 border border-slate-900 overflow-hidden select-none flex items-center justify-center touch-none shrink-0"
        >
          <img
            ref={imageRef}
            src={imageSrc}
            crossOrigin="anonymous"
            alt="Source to crop"
            onLoad={() => setImageLoaded(true)}
            className="max-w-full max-h-full object-contain pointer-events-none"
          />

          {/* Translucent background overlay around the crop area */}
          {imageRect.width > 0 && (
            <>
              <div className="absolute bg-black/60 pointer-events-none" style={{ top: 0, left: 0, right: 0, height: cropBox.y }} />
              <div className="absolute bg-black/60 pointer-events-none" style={{ top: cropBox.y + cropBox.height, left: 0, right: 0, bottom: 0 }} />
              <div className="absolute bg-black/60 pointer-events-none" style={{ top: cropBox.y, bottom: 'auto', left: 0, width: cropBox.x, height: cropBox.height }} />
              <div className="absolute bg-black/60 pointer-events-none" style={{ top: cropBox.y, bottom: 'auto', right: 0, left: cropBox.x + cropBox.width, height: cropBox.height }} />
            </>
          )}

          {/* Draggable & Resizable Selection Box */}
          {imageRect.width > 0 && (
            <div
              style={{
                position: 'absolute',
                left: cropBox.x,
                top: cropBox.y,
                width: cropBox.width,
                height: cropBox.height,
              }}
              className="border border-white shadow-[0_0_0_1px_rgba(0,0,0,0.6)] cursor-move select-none z-20 flex items-center justify-center"
              onMouseDown={(e) => {
                e.stopPropagation();
                handleStart('move', e.clientX, e.clientY);
              }}
              onTouchStart={(e) => {
                e.stopPropagation();
                if (e.touches[0]) {
                  handleStart('move', e.touches[0].clientX, e.touches[0].clientY);
                }
              }}
            >
              {/* Central drag indicator icon */}
              <Move className="h-4.5 w-4.5 text-white/50 animate-pulse pointer-events-none" />

              {/* Resize Corners */}
              <div 
                className="absolute -top-1.5 -left-1.5 w-4.5 h-4.5 bg-white border-2 border-indigo-600 rounded-full cursor-nw-resize shadow-md z-30"
                onMouseDown={(e) => { e.stopPropagation(); handleStart('nw', e.clientX, e.clientY); }}
                onTouchStart={(e) => { e.stopPropagation(); if (e.touches[0]) handleStart('nw', e.touches[0].clientX, e.touches[0].clientY); }}
              />
              <div 
                className="absolute -top-1.5 -right-1.5 w-4.5 h-4.5 bg-white border-2 border-indigo-600 rounded-full cursor-ne-resize shadow-md z-30"
                onMouseDown={(e) => { e.stopPropagation(); handleStart('ne', e.clientX, e.clientY); }}
                onTouchStart={(e) => { e.stopPropagation(); if (e.touches[0]) handleStart('ne', e.touches[0].clientX, e.touches[0].clientY); }}
              />
              <div 
                className="absolute -bottom-1.5 -left-1.5 w-4.5 h-4.5 bg-white border-2 border-indigo-600 rounded-full cursor-sw-resize shadow-md z-30"
                onMouseDown={(e) => { e.stopPropagation(); handleStart('sw', e.clientX, e.clientY); }}
                onTouchStart={(e) => { e.stopPropagation(); if (e.touches[0]) handleStart('sw', e.touches[0].clientX, e.touches[0].clientY); }}
              />
              <div 
                className="absolute -bottom-1.5 -right-1.5 w-4.5 h-4.5 bg-white border-2 border-indigo-600 rounded-full cursor-se-resize shadow-md z-30"
                onMouseDown={(e) => { e.stopPropagation(); handleStart('se', e.clientX, e.clientY); }}
                onTouchStart={(e) => { e.stopPropagation(); if (e.touches[0]) handleStart('se', e.touches[0].clientX, e.touches[0].clientY); }}
              />

              {/* Resize Edges (Active in free aspect mode) */}
              {aspectRatioMode === 'free' && (
                <>
                  <div 
                    className="absolute top-0 left-3 right-3 h-2 -mt-1 cursor-n-resize hover:bg-indigo-400/20 rounded z-25"
                    onMouseDown={(e) => { e.stopPropagation(); handleStart('n', e.clientX, e.clientY); }}
                    onTouchStart={(e) => { e.stopPropagation(); if (e.touches[0]) handleStart('n', e.touches[0].clientX, e.touches[0].clientY); }}
                  />
                  <div 
                    className="absolute bottom-0 left-3 right-3 h-2 -mb-1 cursor-s-resize hover:bg-indigo-400/20 rounded z-25"
                    onMouseDown={(e) => { e.stopPropagation(); handleStart('s', e.clientX, e.clientY); }}
                    onTouchStart={(e) => { e.stopPropagation(); if (e.touches[0]) handleStart('s', e.touches[0].clientX, e.touches[0].clientY); }}
                  />
                  <div 
                    className="absolute top-3 bottom-3 left-0 w-2 -ml-1 cursor-w-resize hover:bg-indigo-400/20 rounded z-25"
                    onMouseDown={(e) => { e.stopPropagation(); handleStart('w', e.clientX, e.clientY); }}
                    onTouchStart={(e) => { e.stopPropagation(); if (e.touches[0]) handleStart('w', e.touches[0].clientX, e.touches[0].clientY); }}
                  />
                  <div 
                    className="absolute top-3 bottom-3 right-0 w-2 -mr-1 cursor-e-resize hover:bg-indigo-400/20 rounded z-25"
                    onMouseDown={(e) => { e.stopPropagation(); handleStart('e', e.clientX, e.clientY); }}
                    onTouchStart={(e) => { e.stopPropagation(); if (e.touches[0]) handleStart('e', e.touches[0].clientX, e.touches[0].clientY); }}
                  />
                </>
              )}
            </div>
          )}
        </div>

        {/* Child 3: Real-time Preview Container */}
        <div className="flex items-center gap-4 bg-slate-50 p-3 rounded-2xl border border-slate-100 shrink-0">
          <div className="relative shrink-0 select-none">
            <canvas 
              ref={previewCanvasRef} 
              className="w-14 h-14 rounded-xl border-2 border-white shadow-md bg-slate-900 object-contain" 
            />
            <span className="absolute -bottom-1.5 -right-1.5 bg-indigo-600 text-[8px] text-white font-extrabold px-1.5 py-0.5 rounded-full shadow-sm tracking-wider">
              预览
            </span>
          </div>
          <div className="space-y-0.5">
            <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              实时剪裁效果
            </h4>
            <p className="text-[10px] text-slate-400 leading-relaxed">
              支持对宽度和长度进行拉伸调整。预览区域会随您拖拽的比例动态呈现。
            </p>
          </div>
        </div>

        {/* Child 4: Controller options */}
        <div className="space-y-3 shrink-0">
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
              裁剪尺寸比例选项
            </span>
            <div className="flex gap-2 items-center">
              <span className="font-mono text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded text-[10px]">
                {Math.round(cropBox.width)} × {Math.round(cropBox.height)} px
              </span>
              <button
                type="button"
                onClick={handleReset}
                title="重置选区"
                className="text-[10px] text-slate-500 hover:text-indigo-600 transition-colors flex items-center gap-0.5 cursor-pointer"
              >
                <RotateCcw className="h-3 w-3" /> 重置
              </button>
            </div>
          </div>
          
          <div className="grid grid-cols-4 gap-1.5">
            {[
              { label: '自由剪裁', value: 'free' },
              { label: '1:1 正方形', value: '1:1' },
              { label: '4:3 比例', value: '4:3' },
              { label: '16:9 比例', value: '16:9' }
            ].map((ratio) => (
              <button
                key={ratio.value}
                type="button"
                onClick={() => handleAspectRatioChange(ratio.value)}
                className={`py-1.5 px-0.5 rounded-xl text-[10px] font-bold transition-all border cursor-pointer ${
                  aspectRatioMode === ratio.value 
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-600/15' 
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {ratio.label}
              </button>
            ))}
          </div>
        </div>

        {/* Child 5: Sticky Footer buttons */}
        <div className="flex gap-3 pt-1 border-t border-gray-50 shrink-0">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
          >
            取消
          </button>
          
          <button
            type="button"
            onClick={handleGenerateCrop}
            className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white hover:bg-indigo-500 transition-colors text-xs font-semibold flex items-center justify-center gap-1.5 shadow-md shadow-indigo-600/10 cursor-pointer"
          >
            <Check className="h-4 w-4" />
            完成剪裁并应用
          </button>
        </div>
      </div>
    </div>
  );
}
