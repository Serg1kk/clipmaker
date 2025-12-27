import { useRef, useEffect, useCallback, RefObject } from 'react';
import { NormalizedCropCoordinates } from './types';

/**
 * Props for the CroppedFrameCanvas component
 */
export interface CroppedFrameCanvasProps {
  /** Reference to the source video element */
  videoRef: RefObject<HTMLVideoElement>;
  /** Normalized crop coordinates (0-1 range) */
  cropCoordinates: NormalizedCropCoordinates;
  /** Width of the preview frame in pixels */
  frameWidth: number;
  /** Height of the preview frame in pixels */
  frameHeight: number;
  /** Optional CSS class name */
  className?: string;
  /** Frame index for identification */
  frameIndex?: number;
}

/**
 * CroppedFrameCanvas - Renders a cropped region of a video to a canvas
 *
 * This component uses the Canvas API to draw only the cropped portion
 * of the source video, stretched to fill the preview frame. It updates
 * in real-time using requestAnimationFrame for smooth dragging.
 *
 * Key features:
 * - Draws from a shared video element (no duplicate streams)
 * - Real-time updates on crop coordinate changes
 * - Smooth animation using requestAnimationFrame
 * - Stretches small crops to fill frame (shows pixelation accurately)
 */
const CroppedFrameCanvas = ({
  videoRef,
  cropCoordinates,
  frameWidth,
  frameHeight,
  className = '',
  frameIndex = 0
}: CroppedFrameCanvasProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastDrawTimeRef = useRef<number>(0);

  // Draw the cropped video region to canvas
  const drawCroppedFrame = useCallback(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;

    if (!canvas || !video || video.readyState < 2) {
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Get video dimensions
    const videoWidth = video.videoWidth;
    const videoHeight = video.videoHeight;

    if (videoWidth === 0 || videoHeight === 0) return;

    // Calculate source crop region in pixels
    const sourceX = cropCoordinates.x * videoWidth;
    const sourceY = cropCoordinates.y * videoHeight;
    const sourceWidth = cropCoordinates.width * videoWidth;
    const sourceHeight = cropCoordinates.height * videoHeight;

    // Ensure valid dimensions
    if (sourceWidth <= 0 || sourceHeight <= 0) return;

    // Clear canvas
    ctx.clearRect(0, 0, frameWidth, frameHeight);

    // Draw cropped region stretched to fill the frame
    // drawImage(image, sx, sy, sWidth, sHeight, dx, dy, dWidth, dHeight)
    try {
      ctx.drawImage(
        video,
        sourceX,           // Source X (crop start)
        sourceY,           // Source Y (crop start)
        sourceWidth,       // Source width (crop width)
        sourceHeight,      // Source height (crop height)
        0,                 // Destination X (fill frame from 0)
        0,                 // Destination Y (fill frame from 0)
        frameWidth,        // Destination width (full frame width)
        frameHeight        // Destination height (full frame height)
      );
    } catch {
      // Video might not be ready yet, ignore error
    }
  }, [videoRef, cropCoordinates, frameWidth, frameHeight]);

  // Animation loop for real-time updates
  const animate = useCallback(() => {
    const now = performance.now();

    // Throttle to ~30fps for performance while still being smooth
    if (now - lastDrawTimeRef.current >= 33) {
      drawCroppedFrame();
      lastDrawTimeRef.current = now;
    }

    animationFrameRef.current = requestAnimationFrame(animate);
  }, [drawCroppedFrame]);

  // Start animation loop on mount
  useEffect(() => {
    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [animate]);

  // Also draw immediately when crop coordinates change
  useEffect(() => {
    drawCroppedFrame();
  }, [cropCoordinates, drawCroppedFrame]);

  // Draw when video time updates (for synchronized playback)
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      drawCroppedFrame();
    };

    const handleSeeked = () => {
      drawCroppedFrame();
    };

    const handleLoadedData = () => {
      drawCroppedFrame();
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('seeked', handleSeeked);
    video.addEventListener('loadeddata', handleLoadedData);

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('seeked', handleSeeked);
      video.removeEventListener('loadeddata', handleLoadedData);
    };
  }, [videoRef, drawCroppedFrame]);

  return (
    <canvas
      ref={canvasRef}
      width={frameWidth}
      height={frameHeight}
      className={`cropped-frame-canvas ${className}`}
      data-testid={`cropped-frame-canvas-${frameIndex}`}
      style={{
        width: '100%',
        height: '100%',
        display: 'block',
        imageRendering: 'auto' // Let browser decide, can use 'pixelated' for intentional pixelation
      }}
    />
  );
};

export default CroppedFrameCanvas;
