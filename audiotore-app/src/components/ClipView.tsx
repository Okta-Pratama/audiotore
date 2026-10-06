import React, { useEffect, useRef } from 'react';
import { Clip, AudioAsset } from '../store/useDawStore';
interface ClipViewProps {
  clip: Clip;
  asset: AudioAsset;
  pixelsPerSecond: number;
  isSelected: boolean;
  isDragging?: boolean;
  dragDx?: number;
  dragDy?: number;
  previewShift?: number;
  onClick: (e: React.MouseEvent) => void;
  onMouseDown: (e: React.MouseEvent) => void;
  cursor?: string;
}

export const ClipView: React.FC<ClipViewProps> = ({ clip, asset, pixelsPerSecond, isSelected, isDragging, dragDx = 0, dragDy = 0, previewShift = 0, onClick, onMouseDown, cursor = 'grab' }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const width = clip.duration * pixelsPerSecond;
  
  
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Bersihkan canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const buffer = asset.buffer;
    const channelData = buffer.getChannelData(0); // Ambil channel 1
    
    // Hitung sample yang perlu digambar berdasarkan offset dan durasi klip
    const startSample = Math.floor(clip.offset * buffer.sampleRate);
    const endSample = Math.floor((clip.offset + clip.duration) * buffer.sampleRate);
    const totalSamples = endSample - startSample;
    
    const step = Math.ceil(totalSamples / canvas.width);
    const amp = canvas.height / 2;

    ctx.fillStyle = '#3b82f6';
    
    const fadeInPx = (clip.fadeIn || 0) * pixelsPerSecond;
    const fadeOutPx = (clip.fadeOut || 0) * pixelsPerSecond;
    
    // Gambar peak waveform sederhana
    for (let i = 0; i < canvas.width; i++) {
      let min = 0;
      let max = 0;
      
      for (let j = 0; j < step; j++) {
        const datum = channelData[startSample + (i * step) + j];
        if (datum !== undefined) {
          if (datum < min) min = datum;
          if (datum > max) max = datum;
        }
      }
      
      let fadeRatio = 1.0;
      if (fadeInPx > 0 && i < fadeInPx) {
        fadeRatio = i / fadeInPx;
      } else if (fadeOutPx > 0 && i > canvas.width - fadeOutPx) {
        fadeRatio = (canvas.width - i) / fadeOutPx;
      }
      
      const scaledMin = min * fadeRatio;
      const scaledMax = max * fadeRatio;
      
      const y = (1 - scaledMax) * amp;
      const h = Math.max(1, (scaledMax - scaledMin) * amp);
      ctx.fillRect(i, y, 1, h);
    }

  }, [clip.offset, clip.duration, clip.fadeIn, clip.fadeOut, asset, width, pixelsPerSecond]);

  return (
    <div
      onMouseDown={onMouseDown}
      onClick={onClick}
      style={{
        position: 'absolute',
        top: 0,
        left: `${(clip.start + previewShift) * pixelsPerSecond}px`,
        width: `${width}px`,
        height: '100%',
        backgroundColor: isSelected ? 'rgba(59, 130, 246, 0.4)' : 'rgba(59, 130, 246, 0.2)',
        border: `1px solid ${isSelected ? '#ef4444' : '#3b82f6'}`,
        borderRadius: '4px',
        overflow: 'hidden',
        cursor: isDragging ? 'grabbing' : cursor,
        boxSizing: 'border-box',
        opacity: isDragging ? 0.7 : 1,
        zIndex: isDragging ? 50 : 10,
        boxShadow: isDragging ? '0 10px 20px rgba(0,0,0,0.5)' : 'none',
        transform: isDragging ? `translate(${dragDx}px, ${dragDy}px)` : 'none',
        transition: isDragging ? 'none' : 'left 0.3s cubic-bezier(0.2, 0.8, 0.2, 1), box-shadow 0.2s, opacity 0.2s, transform 0.2s'
      }}
    >
      <div style={{ position: 'absolute',
        top: 2, left: 4, fontSize: '10px', color: '#fff', textShadow: '1px 1px 2px #000', pointerEvents: 'none', zIndex: 10 }}>
        {asset.name}
      </div>
      

      <canvas
        ref={canvasRef}
        width={width}
        height={80}
        style={{ width: '100%', height: '100%', display: 'block', pointerEvents: 'none' }}
      />
    </div>
  );
};
