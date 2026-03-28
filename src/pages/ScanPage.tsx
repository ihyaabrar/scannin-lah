import { useState, useRef, useEffect, useCallback } from 'react';
import { Page, User } from '../types';
import StatusBar from '../components/StatusBar';
import Toast from '../components/Toast';
import { CloseIcon } from '../components/Icons';

// ── Types ─────────────────────────────────────────────────────────────────────
interface Props {
  user: User;
  onNavigate: (page: Page) => void;
  addDoc: (doc: import('../types').DocFile, dataUrl?: string) => void;
}

type ScanState = 'camera' | 'crop' | 'preview' | 'saving';

interface Point { x: number; y: number; }
interface Corners { tl: Point; tr: Point; br: Point; bl: Point; }

// Declare jscanify global (loaded via CDN in index.html)
declare global {
  interface Window {
    jscanify: new () => JscanifyInstance;
    cv: Record<string, unknown>;
    _cvReady: boolean;
  }
}
interface JscanifyInstance {
  highlightPaper(src: HTMLCanvasElement | HTMLImageElement): HTMLCanvasElement;
  extractPaper(
    src: HTMLCanvasElement | HTMLImageElement,
    width: number,
    height: number,
    cornerPoints?: { topLeftCorner: Point; topRightCorner: Point; bottomRightCorner: Point; bottomLeftCorner: Point }
  ): HTMLCanvasElement;
  findPaperContour(mat: unknown): unknown;
  getCornerPoints(contour: unknown): { topLeftCorner: Point; topRightCorner: Point; bottomRightCorner: Point; bottomLeftCorner: Point } | null;
}

const HANDLE_RADIUS = 22;

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

// ── Perspective transform using pure canvas (no OpenCV needed for warp) ───────
// Uses bilinear interpolation to map destination pixels from source quadrilateral
function perspectiveTransform(
  img: HTMLImageElement,
  corners: Corners,
  outW: number,
  outH: number
): string {
  const { tl, tr, br, bl } = corners;

  const dst = document.createElement('canvas');
  dst.width = outW;
  dst.height = outH;
  const dctx = dst.getContext('2d')!;

  // Draw source onto temp canvas
  const src = document.createElement('canvas');
  src.width = img.naturalWidth;
  src.height = img.naturalHeight;
  const sctx = src.getContext('2d')!;
  sctx.drawImage(img, 0, 0);
  const srcData = sctx.getImageData(0, 0, src.width, src.height);
  const dstData = dctx.createImageData(outW, outH);

  const sw = src.width;
  const sh = src.height;

  for (let dy = 0; dy < outH; dy++) {
    for (let dx = 0; dx < outW; dx++) {
      // Normalized destination coords [0,1]
      const u = dx / (outW - 1);
      const v = dy / (outH - 1);

      // Bilinear interpolation of source point from the 4 corners
      // P = (1-v)*((1-u)*tl + u*tr) + v*((1-u)*bl + u*br)
      const sx = (1 - v) * ((1 - u) * tl.x + u * tr.x) + v * ((1 - u) * bl.x + u * br.x);
      const sy = (1 - v) * ((1 - u) * tl.y + u * tr.y) + v * ((1 - u) * bl.y + u * br.y);

      // Clamp to source bounds
      const px = clamp(Math.round(sx), 0, sw - 1);
      const py = clamp(Math.round(sy), 0, sh - 1);

      const srcIdx = (py * sw + px) * 4;
      const dstIdx = (dy * outW + dx) * 4;
      dstData.data[dstIdx]     = srcData.data[srcIdx];
      dstData.data[dstIdx + 1] = srcData.data[srcIdx + 1];
      dstData.data[dstIdx + 2] = srcData.data[srcIdx + 2];
      dstData.data[dstIdx + 3] = srcData.data[srcIdx + 3];
    }
  }

  dctx.putImageData(dstData, 0, 0);

  // Contrast enhancement for documents
  const final = document.createElement('canvas');
  final.width = outW;
  final.height = outH;
  const fctx = final.getContext('2d')!;
  fctx.filter = 'contrast(1.15) brightness(1.05)';
  fctx.drawImage(dst, 0, 0);

  return final.toDataURL('image/jpeg', 0.93);
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function ScanPage({ onNavigate, addDoc }: Props) {
  const [state, setState] = useState<ScanState>('camera');
  const [saveFormat, setSaveFormat] = useState<'PDF' | 'JPG' | 'PNG'>('PDF');
  const [toast, setToast] = useState<{ msg: string; type?: 'success' | 'error' | 'info' } | null>(null);
  const [camError, setCamError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [capturedImage, setCapturedImage] = useState<HTMLImageElement | null>(null);
  const [corners, setCorners] = useState<Corners | null>(null);
  const [croppedDataUrl, setCroppedDataUrl] = useState<string | null>(null);
  const [dragging, setDragging] = useState<keyof Corners | null>(null);
  const [flash, setFlash] = useState(false);
  const [, setCvReady] = useState(false);
  const [autoDetecting, setAutoDetecting] = useState(false);
  const [scannerReady, setScannerReady] = useState(false);
  const [liveHighlight, setLiveHighlight] = useState(true);
  // Multi-scan: kumpulkan halaman sebelum simpan
  const [scannedPages, setScannedPages] = useState<string[]>([]);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const liveCanvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const scannerRef = useRef<JscanifyInstance | null>(null);
  const highlightIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // ── Wait for OpenCV + jscanify to load ────────────────────────────────────
  useEffect(() => {
    const check = () => {
      if (window.cv && window._cvReady && window.jscanify) {
        try {
          scannerRef.current = new window.jscanify();
          setScannerReady(true);
          setCvReady(true);
        } catch {
          setTimeout(check, 300);
        }
      } else if (window.cv && window._cvReady) {
        // cv ready but jscanify might not be yet
        setTimeout(check, 200);
      } else {
        setTimeout(check, 300);
      }
    };

    if (window._cvReady && window.jscanify) {
      try {
        scannerRef.current = new window.jscanify();
        setScannerReady(true);
        setCvReady(true);
      } catch {
        setTimeout(check, 300);
      }
    } else {
      window.addEventListener('opencv-ready', check);
      setTimeout(check, 500);
    }

    return () => {
      window.removeEventListener('opencv-ready', check);
    };
  }, []);

  // ── Start camera ──────────────────────────────────────────────────────────
  const stopCamera = useCallback(() => {
    if (highlightIntervalRef.current) {
      clearInterval(highlightIntervalRef.current);
      highlightIntervalRef.current = null;
    }
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  }, []);

  const startLiveHighlight = useCallback(() => {
    if (!scannerRef.current || !videoRef.current || !liveCanvasRef.current) return;
    if (highlightIntervalRef.current) clearInterval(highlightIntervalRef.current);

    const video = videoRef.current;
    const canvas = liveCanvasRef.current;

    highlightIntervalRef.current = setInterval(() => {
      if (!video || video.readyState < 2) return;
      const w = video.videoWidth;
      const h = video.videoHeight;
      if (!w || !h) return;
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(video, 0, 0, w, h);
      try {
        const result = scannerRef.current!.highlightPaper(canvas);
        ctx.clearRect(0, 0, w, h);
        ctx.drawImage(result, 0, 0, w, h);
      } catch {
        // silently ignore if detection fails
      }
    }, 150); // ~7fps for highlight
  }, []);

  const startCamera = useCallback(async (mode: 'environment' | 'user') => {
    stopCamera();
    setCamError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: mode,
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        // Start live highlight after video starts
        videoRef.current.onloadedmetadata = () => {
          if (scannerReady && liveHighlight) startLiveHighlight();
        };
        if (videoRef.current.readyState >= 2 && scannerReady && liveHighlight) {
          startLiveHighlight();
        }
      }
    } catch (e: unknown) {
      const err = e as DOMException;
      if (err.name === 'NotAllowedError') {
        setCamError('Izin kamera ditolak. Aktifkan izin kamera di pengaturan browser.');
      } else if (err.name === 'NotFoundError') {
        setCamError('Kamera tidak ditemukan di perangkat ini.');
      } else if (err.name === 'OverconstrainedError') {
        // Retry with lower constraints
        try {
          const stream2 = await navigator.mediaDevices.getUserMedia({ video: { facingMode: mode }, audio: false });
          streamRef.current = stream2;
          if (videoRef.current) {
            videoRef.current.srcObject = stream2;
            await videoRef.current.play();
          }
        } catch {
          setCamError('Tidak dapat mengakses kamera: ' + err.message);
        }
      } else {
        setCamError('Tidak dapat mengakses kamera: ' + err.message);
      }
    }
  }, [stopCamera, scannerReady, liveHighlight, startLiveHighlight]);

  useEffect(() => {
    if (state === 'camera') {
      startCamera(facingMode);
    }
    return () => {
      if (state !== 'camera') stopCamera();
    };
  }, [facingMode, state]); // eslint-disable-line

  // Reset batch saat komponen unmount (navigasi keluar)
  useEffect(() => {
    return () => { setScannedPages([]); };
  }, []); // eslint-disable-line

  // When scannerReady changes and camera is active, start live highlight
  useEffect(() => {
    if (scannerReady && state === 'camera' && streamRef.current && liveHighlight) {
      startLiveHighlight();
    }
  }, [scannerReady, liveHighlight]); // eslint-disable-line

  // ── Capture photo from camera ──────────────────────────────────────────────
  const capturePhoto = useCallback(() => {
    const video = videoRef.current;
    if (!video || video.readyState < 2) return;

    setFlash(true);
    setTimeout(() => setFlash(false), 200);

    // Capture from live canvas if available (already has highlight frame)
    const captureCanvas = document.createElement('canvas');
    captureCanvas.width = video.videoWidth || 1280;
    captureCanvas.height = video.videoHeight || 720;
    const ctx = captureCanvas.getContext('2d')!;
    ctx.drawImage(video, 0, 0);

    const img = new Image();
    img.onload = () => {
      setCapturedImage(img);
      // Try auto-detect corners first
      if (scannerReady && scannerRef.current) {
        setAutoDetecting(true);
        try {
          const cv = window.cv as unknown as { imread: (src: HTMLCanvasElement) => unknown };
          const mat = cv.imread(captureCanvas);
          const contour = scannerRef.current.findPaperContour(mat);
          const pts = scannerRef.current.getCornerPoints(contour);
          setAutoDetecting(false);
          if (pts && pts.topLeftCorner && pts.topRightCorner && pts.bottomRightCorner && pts.bottomLeftCorner) {
            setCorners({
              tl: pts.topLeftCorner,
              tr: pts.topRightCorner,
              br: pts.bottomRightCorner,
              bl: pts.bottomLeftCorner,
            });
            setToast({ msg: '✅ Tepi dokumen terdeteksi otomatis!', type: 'success' });
          } else {
            initCorners(img.naturalWidth, img.naturalHeight);
            setToast({ msg: 'Sesuaikan sudut secara manual', type: 'info' });
          }
        } catch {
          setAutoDetecting(false);
          initCorners(img.naturalWidth, img.naturalHeight);
        }
      } else {
        initCorners(img.naturalWidth, img.naturalHeight);
      }
      setState('crop');
    };
    img.src = captureCanvas.toDataURL('image/jpeg', 0.95);
  }, [scannerReady]);

  // ── Load from gallery ──────────────────────────────────────────────────────
  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        setCapturedImage(img);
        stopCamera();

        // Draw image to canvas for detection
        const tmpCanvas = document.createElement('canvas');
        tmpCanvas.width = img.naturalWidth;
        tmpCanvas.height = img.naturalHeight;
        const tmpCtx = tmpCanvas.getContext('2d')!;
        tmpCtx.drawImage(img, 0, 0);

        if (scannerReady && scannerRef.current) {
          setAutoDetecting(true);
          try {
            const cv = window.cv as unknown as { imread: (src: HTMLCanvasElement) => unknown };
            const mat = cv.imread(tmpCanvas);
            const contour = scannerRef.current.findPaperContour(mat);
            const pts = scannerRef.current.getCornerPoints(contour);
            setAutoDetecting(false);
            if (pts && pts.topLeftCorner) {
              setCorners({
                tl: pts.topLeftCorner,
                tr: pts.topRightCorner,
                br: pts.bottomRightCorner,
                bl: pts.bottomLeftCorner,
              });
              setToast({ msg: '✅ Tepi dokumen terdeteksi otomatis!', type: 'success' });
            } else {
              initCorners(img.naturalWidth, img.naturalHeight);
            }
          } catch {
            setAutoDetecting(false);
            initCorners(img.naturalWidth, img.naturalHeight);
          }
        } else {
          initCorners(img.naturalWidth, img.naturalHeight);
        }
        setState('crop');
      };
      img.src = ev.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const initCorners = (imgW: number, imgH: number) => {
    const pad = 0.07;
    setCorners({
      tl: { x: imgW * pad,       y: imgH * pad },
      tr: { x: imgW * (1 - pad), y: imgH * pad },
      br: { x: imgW * (1 - pad), y: imgH * (1 - pad) },
      bl: { x: imgW * pad,       y: imgH * (1 - pad) },
    });
  };

  // ── Draw overlay on canvas ─────────────────────────────────────────────────
  const drawOverlay = useCallback(() => {
    const canvas = overlayCanvasRef.current;
    const imgEl = capturedImage;
    if (!canvas || !imgEl || !corners) return;

    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const displayW = rect.width;
    const displayH = rect.height;

    canvas.width = displayW;
    canvas.height = displayH;

    // Figure out actual image display dimensions (object-contain)
    const imgAspect = imgEl.naturalWidth / imgEl.naturalHeight;
    const containerAspect = displayW / displayH;

    let imgDisplayW: number, imgDisplayH: number, imgOffsetX: number, imgOffsetY: number;
    if (imgAspect > containerAspect) {
      imgDisplayW = displayW;
      imgDisplayH = displayW / imgAspect;
      imgOffsetX = 0;
      imgOffsetY = (displayH - imgDisplayH) / 2;
    } else {
      imgDisplayH = displayH;
      imgDisplayW = displayH * imgAspect;
      imgOffsetX = (displayW - imgDisplayW) / 2;
      imgOffsetY = 0;
    }

    const scaleX = imgDisplayW / imgEl.naturalWidth;
    const scaleY = imgDisplayH / imgEl.naturalHeight;

    const toDisplay = (p: Point) => ({
      x: p.x * scaleX + imgOffsetX,
      y: p.y * scaleY + imgOffsetY,
    });

    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, displayW, displayH);

    const tl = toDisplay(corners.tl);
    const tr = toDisplay(corners.tr);
    const br = toDisplay(corners.br);
    const bl = toDisplay(corners.bl);

    // Dark overlay outside selection
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0, 0, displayW, displayH);

    // Clear inside polygon (transparent window)
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(tl.x, tl.y);
    ctx.lineTo(tr.x, tr.y);
    ctx.lineTo(br.x, br.y);
    ctx.lineTo(bl.x, bl.y);
    ctx.closePath();
    ctx.clip();
    ctx.clearRect(0, 0, displayW, displayH);
    ctx.restore();

    // Glowing border
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(tl.x, tl.y);
    ctx.lineTo(tr.x, tr.y);
    ctx.lineTo(br.x, br.y);
    ctx.lineTo(bl.x, bl.y);
    ctx.closePath();
    ctx.strokeStyle = '#22d3ee';
    ctx.lineWidth = 2.5;
    ctx.shadowColor = '#22d3ee';
    ctx.shadowBlur = 12;
    ctx.stroke();
    ctx.restore();

    // Dashed edge lines
    [[tl, tr], [tr, br], [br, bl], [bl, tl]].forEach(([a, b]) => {
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.strokeStyle = 'rgba(34,211,238,0.5)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 4]);
      ctx.stroke();
      ctx.restore();
    });

    // Corner handles
    [
      { p: tl, label: 'TL', bracket: [[-1, 0], [-1, -1], [0, -1]] },
      { p: tr, label: 'TR', bracket: [[1, 0], [1, -1], [0, -1]] },
      { p: br, label: 'BR', bracket: [[1, 0], [1, 1], [0, 1]] },
      { p: bl, label: 'BL', bracket: [[-1, 0], [-1, 1], [0, 1]] },
    ].forEach(({ p, bracket }) => {
      // Glow ring
      const gradient = ctx.createRadialGradient(p.x, p.y, 5, p.x, p.y, HANDLE_RADIUS);
      gradient.addColorStop(0, 'rgba(34,211,238,0.25)');
      gradient.addColorStop(1, 'rgba(34,211,238,0)');
      ctx.beginPath();
      ctx.arc(p.x, p.y, HANDLE_RADIUS, 0, Math.PI * 2);
      ctx.fillStyle = gradient;
      ctx.fill();

      // White dot
      ctx.beginPath();
      ctx.arc(p.x, p.y, 10, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = '#22d3ee';
      ctx.shadowBlur = 10;
      ctx.fill();
      ctx.shadowBlur = 0;

      // Cyan inner dot
      ctx.beginPath();
      ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#22d3ee';
      ctx.fill();

      // L-bracket
      const bs = 12;
      ctx.save();
      ctx.strokeStyle = '#22d3ee';
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(p.x + bracket[0][0] * bs, p.y + bracket[0][1] * bs);
      ctx.lineTo(p.x + bracket[1][0] * bs, p.y + bracket[1][1] * bs);
      ctx.lineTo(p.x + bracket[2][0] * bs, p.y + bracket[2][1] * bs);
      ctx.stroke();
      ctx.restore();
    });
  }, [capturedImage, corners]);

  useEffect(() => {
    if (state === 'crop') drawOverlay();
  }, [state, drawOverlay]);

  // ── Pointer events for dragging corners ───────────────────────────────────
  const getPointerPosInImageSpace = (e: React.PointerEvent): Point => {
    const canvas = overlayCanvasRef.current!;
    const imgEl = capturedImage!;
    const rect = canvas.getBoundingClientRect();

    const imgAspect = imgEl.naturalWidth / imgEl.naturalHeight;
    const containerAspect = rect.width / rect.height;

    let imgDisplayW: number, imgDisplayH: number, imgOffsetX: number, imgOffsetY: number;
    if (imgAspect > containerAspect) {
      imgDisplayW = rect.width;
      imgDisplayH = rect.width / imgAspect;
      imgOffsetX = 0;
      imgOffsetY = (rect.height - imgDisplayH) / 2;
    } else {
      imgDisplayH = rect.height;
      imgDisplayW = rect.height * imgAspect;
      imgOffsetX = (rect.width - imgDisplayW) / 2;
      imgOffsetY = 0;
    }

    const clientX = e.clientX;
    const clientY = e.clientY;

    return {
      x: ((clientX - rect.left - imgOffsetX) / imgDisplayW) * imgEl.naturalWidth,
      y: ((clientY - rect.top - imgOffsetY) / imgDisplayH) * imgEl.naturalHeight,
    };
  };

  const findNearestCorner = (pos: Point): keyof Corners | null => {
    if (!corners || !capturedImage || !overlayCanvasRef.current) return null;
    const canvas = overlayCanvasRef.current;
    const imgEl = capturedImage;
    const rect = canvas.getBoundingClientRect();

    const imgAspect = imgEl.naturalWidth / imgEl.naturalHeight;
    const containerAspect = rect.width / rect.height;
    let imgDisplayW: number, imgDisplayH: number;
    if (imgAspect > containerAspect) {
      imgDisplayW = rect.width;
      imgDisplayH = rect.width / imgAspect;
    } else {
      imgDisplayH = rect.height;
      imgDisplayW = rect.height * imgAspect;
    }

    const scaleX = imgDisplayW / imgEl.naturalWidth;
    const scaleY = imgDisplayH / imgEl.naturalHeight;
    // threshold in image space — corresponds to HANDLE_RADIUS display pixels
    const threshX = HANDLE_RADIUS * 2 / scaleX;
    const threshY = HANDLE_RADIUS * 2 / scaleY;

    let nearest: keyof Corners | null = null;
    let minDist = Infinity;
    (Object.keys(corners) as (keyof Corners)[]).forEach(key => {
      const c = corners[key];
      const dx = (c.x - pos.x) * scaleX;
      const dy = (c.y - pos.y) * scaleY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dx / scaleX < threshX && dy / scaleY < threshY && dist < minDist) {
        minDist = dist;
        nearest = key;
      }
    });
    return nearest;
  };

  const onPointerDown = (e: React.PointerEvent) => {
    const pos = getPointerPosInImageSpace(e);
    const corner = findNearestCorner(pos);
    if (corner) {
      setDragging(corner);
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      e.preventDefault();
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging || !corners || !capturedImage) return;
    const pos = getPointerPosInImageSpace(e);
    const x = clamp(pos.x, 0, capturedImage.naturalWidth);
    const y = clamp(pos.y, 0, capturedImage.naturalHeight);
    setCorners(prev => prev ? { ...prev, [dragging]: { x, y } } : prev);
    e.preventDefault();
  };

  const onPointerUp = () => setDragging(null);

  // ── Auto re-detect after capture (manual trigger) ─────────────────────────
  const autoDetectEdges = () => {
    if (!capturedImage || !scannerReady || !scannerRef.current) return;
    setAutoDetecting(true);
    const tmpCanvas = document.createElement('canvas');
    tmpCanvas.width = capturedImage.naturalWidth;
    tmpCanvas.height = capturedImage.naturalHeight;
    const tmpCtx = tmpCanvas.getContext('2d')!;
    tmpCtx.drawImage(capturedImage, 0, 0);
    try {
      const cv = window.cv as unknown as { imread: (src: HTMLCanvasElement) => unknown };
      const mat = cv.imread(tmpCanvas);
      const contour = scannerRef.current.findPaperContour(mat);
      const pts = scannerRef.current.getCornerPoints(contour);
      setAutoDetecting(false);
      if (pts && pts.topLeftCorner) {
        setCorners({
          tl: pts.topLeftCorner,
          tr: pts.topRightCorner,
          br: pts.bottomRightCorner,
          bl: pts.bottomLeftCorner,
        });
        setToast({ msg: '✅ Tepi terdeteksi ulang!', type: 'success' });
      } else {
        setToast({ msg: 'Tepi tidak terdeteksi, sesuaikan manual', type: 'info' });
      }
    } catch {
      setAutoDetecting(false);
      setToast({ msg: 'Deteksi otomatis gagal', type: 'error' });
    }
  };

  // ── Apply perspective crop ─────────────────────────────────────────────────
  const applyCrop = () => {
    if (!capturedImage || !corners) return;

    // Use jscanify if available for best perspective transform
    if (scannerReady && scannerRef.current) {
      try {
        // Calculate output dimensions based on corner distances
        const topW = Math.hypot(corners.tr.x - corners.tl.x, corners.tr.y - corners.tl.y);
        const botW = Math.hypot(corners.br.x - corners.bl.x, corners.br.y - corners.bl.y);
        const leftH = Math.hypot(corners.bl.x - corners.tl.x, corners.bl.y - corners.tl.y);
        const rightH = Math.hypot(corners.br.x - corners.tr.x, corners.br.y - corners.tr.y);
        const outW = Math.round(Math.max(topW, botW));
        const outH = Math.round(Math.max(leftH, rightH));

        const resultCanvas = scannerRef.current.extractPaper(
          capturedImage,
          outW,
          outH,
          {
            topLeftCorner: corners.tl,
            topRightCorner: corners.tr,
            bottomRightCorner: corners.br,
            bottomLeftCorner: corners.bl,
          }
        );

        // Enhance: apply contrast filter
        const enhanced = document.createElement('canvas');
        enhanced.width = resultCanvas.width;
        enhanced.height = resultCanvas.height;
        const ectx = enhanced.getContext('2d')!;
        ectx.filter = 'contrast(1.15) brightness(1.05)';
        ectx.drawImage(resultCanvas, 0, 0);

        setCroppedDataUrl(enhanced.toDataURL('image/jpeg', 0.93));
        setState('preview');
        return;
      } catch (err) {
        console.warn('jscanify extractPaper failed, falling back to custom perspective:', err);
      }
    }

    // Fallback: custom perspective transform
    const topW = Math.hypot(corners.tr.x - corners.tl.x, corners.tr.y - corners.tl.y);
    const botW = Math.hypot(corners.br.x - corners.bl.x, corners.br.y - corners.bl.y);
    const leftH = Math.hypot(corners.bl.x - corners.tl.x, corners.bl.y - corners.tl.y);
    const rightH = Math.hypot(corners.br.x - corners.tr.x, corners.br.y - corners.tr.y);
    const outW = Math.round(Math.max(topW, botW));
    const outH = Math.round(Math.max(leftH, rightH));

    const dataUrl = perspectiveTransform(capturedImage, corners, outW, outH);
    setCroppedDataUrl(dataUrl);
    setState('preview');
  };

  // ── Save document — supports multi-page PDF merge ────────────────────────
  const saveDocument = async () => {
    if (!croppedDataUrl) return;
    setState('saving');

    // All pages = previously collected batch + current page
    const allPages = [...scannedPages, croppedDataUrl];

    const now = new Date();
    const dateStr = now.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
    const namePrefix = `Scan_${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;

    let finalDataUrl = croppedDataUrl;
    let finalMimeType = 'image/jpeg';
    let docType: 'pdf' | 'jpg' | 'png' = 'jpg';
    let ext = saveFormat.toLowerCase();

    // Helper: load image and return HTMLImageElement
    const loadImg = (src: string) => new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image(); i.onload = () => resolve(i); i.onerror = reject; i.src = src;
    });

    try {
      if (saveFormat === 'PDF') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const jspdfLib = (window as any).jspdf;
        if (jspdfLib) {
          const { jsPDF } = jspdfLib;
          const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
          const pdfW = pdf.internal.pageSize.getWidth();
          const pdfH = pdf.internal.pageSize.getHeight();

          for (let i = 0; i < allPages.length; i++) {
            if (i > 0) pdf.addPage();
            const imgEl = await loadImg(allPages[i]);
            const ratio = imgEl.naturalWidth / imgEl.naturalHeight;
            let rW = pdfW - 10, rH = rW / ratio;
            if (rH > pdfH - 10) { rH = pdfH - 10; rW = rH * ratio; }
            pdf.addImage(allPages[i], 'JPEG', (pdfW - rW) / 2, (pdfH - rH) / 2, rW, rH);
          }

          finalDataUrl = pdf.output('datauristring');
          finalMimeType = 'application/pdf';
          docType = 'pdf'; ext = 'pdf';
        } else {
          // jsPDF not loaded — save as JPG
          docType = 'jpg'; ext = 'jpg';
        }
      } else if (saveFormat === 'PNG') {
        const imgEl = await loadImg(croppedDataUrl);
        const canvas = document.createElement('canvas');
        canvas.width = imgEl.naturalWidth; canvas.height = imgEl.naturalHeight;
        canvas.getContext('2d')!.drawImage(imgEl, 0, 0);
        finalDataUrl = canvas.toDataURL('image/png');
        finalMimeType = 'image/png'; docType = 'png'; ext = 'png';
      }
    } catch (e) {
      console.error('Gagal membuat file:', e);
      ext = 'jpg'; docType = 'jpg'; finalMimeType = 'image/jpeg';
    }

    const base64str = finalDataUrl.split(',')[1] || '';
    const sizeBytes = Math.round((base64str.length * 3) / 4);
    const sizeMB = sizeBytes / (1024 * 1024);
    const sizeStr = sizeMB < 1 ? (sizeMB * 1024).toFixed(1) + ' KB' : sizeMB.toFixed(1) + ' MB';

    const newDoc: import('../types').DocFile = {
      id: `doc_${Date.now()}`,
      name: `${namePrefix}${allPages.length > 1 ? `_${allPages.length}hal` : ''}.${ext}`,
      type: docType,
      size: sizeStr,
      date: dateStr,
      color: docType === 'pdf' ? '#e8d5f5' : docType === 'png' ? '#ffe4e6' : '#fdf0c4',
      mimeType: finalMimeType,
    };

    addDoc(newDoc, finalDataUrl);
    setScannedPages([]);
    setToast({ msg: `✅ Disimpan! ${allPages.length > 1 ? `${allPages.length} halaman` : ''}`, type: 'success' });
    setTimeout(() => onNavigate('documents'), 1500);
  };

  const retake = (keepBatch = false) => {
    setCapturedImage(null);
    setCorners(null);
    setCroppedDataUrl(null);
    if (!keepBatch) setScannedPages([]);
    setState('camera');
  };

  // Simpan halaman saat ini ke batch, lalu scan lagi
  const addPageAndScanAgain = () => {
    if (croppedDataUrl) {
      setScannedPages(prev => [...prev, croppedDataUrl]);
    }
    setCapturedImage(null);
    setCorners(null);
    setCroppedDataUrl(null);
    setState('camera');
  };

  const flipCamera = () => {
    setFacingMode(prev => prev === 'environment' ? 'user' : 'environment');
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full bg-gray-950 page-enter relative overflow-hidden">
      <StatusBar dark />

      {toast && (
        <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileInput}
        onClick={e => { (e.target as HTMLInputElement).value = ''; }}
      />

      {/* ── CAMERA STATE ──────────────────────────────────── */}
      {state === 'camera' && (
        <div className="flex flex-col h-full">
          {/* Top bar */}
          <div className="flex items-center justify-between px-4 py-3 z-10 flex-shrink-0">
            <button
              onClick={() => { stopCamera(); onNavigate('home'); }}
              aria-label="Tutup scanner"
              className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center active:scale-90 transition-all"
            >
              <CloseIcon size={18} className="text-white" />
            </button>
            <div className="text-center">
              <p className="text-white font-bold text-sm tracking-wide">Scan Dokumen</p>
              {scannerReady ? (
                <span className="text-cyan-400 text-[10px] font-medium">● AI Aktif</span>
              ) : (
                <span className="text-yellow-400 text-[10px] font-medium">⟳ Memuat AI…</span>
              )}
            </div>
            <button
              onClick={flipCamera}
              aria-label="Ganti kamera"
              className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center active:scale-90 transition-all"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white">
                <path d="M1 4v6h6" /><path d="M23 20v-6h-6" />
                <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4-4.64 4.36A9 9 0 0 1 3.51 15" />
              </svg>
            </button>
          </div>

          {/* Camera viewfinder */}
          <div className="flex-1 relative overflow-hidden">
            {camError ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center px-8 gap-4">
                <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                    <line x1="12" y1="11" x2="12" y2="17" /><circle cx="12" cy="9" r="1" fill="#ef4444" />
                  </svg>
                </div>
                <p className="text-white text-center text-sm leading-relaxed">{camError}</p>
                <button
                  onClick={() => startCamera(facingMode)}
                  className="px-6 py-3 bg-cyan-500 rounded-2xl text-white text-sm font-bold active:scale-95 transition-all"
                >
                  Coba Lagi
                </button>
              </div>
            ) : (
              <>
                {/* Video element (hidden, source for canvas) */}
                <video
                  ref={videoRef}
                  className="absolute inset-0 w-full h-full object-cover"
                  playsInline muted autoPlay
                />
                {/* Live highlight canvas — drawn on top of video */}
                <canvas
                  ref={liveCanvasRef}
                  className="absolute inset-0 w-full h-full object-cover"
                  style={{ display: scannerReady && liveHighlight ? 'block' : 'none' }}
                />
                {/* Flash overlay */}
                {flash && <div className="absolute inset-0 bg-white z-20 pointer-events-none" />}

                {/* Document frame guide (only shown when AI not ready or highlight off) */}
                {(!scannerReady || !liveHighlight) && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="relative" style={{ width: '78%', aspectRatio: '3/4' }}>
                      <div className="absolute inset-0 rounded-2xl" style={{ boxShadow: '0 0 0 9999px rgba(0,0,0,0.4)' }} />
                      {[
                        'top-0 left-0 border-t-2 border-l-2 rounded-tl-xl',
                        'top-0 right-0 border-t-2 border-r-2 rounded-tr-xl',
                        'bottom-0 left-0 border-b-2 border-l-2 rounded-bl-xl',
                        'bottom-0 right-0 border-b-2 border-r-2 rounded-br-xl',
                      ].map((cls, i) => (
                        <div key={i} className={`absolute ${cls} w-8 h-8 border-cyan-400`} />
                      ))}
                    </div>
                  </div>
                )}

                {/* Live highlight toggle */}
                <button
                  onClick={() => setLiveHighlight(v => !v)}
                  className="absolute top-3 right-3 z-10 px-2 py-1 rounded-lg bg-black/50 text-xs font-medium active:scale-95 transition-all"
                  style={{ color: liveHighlight ? '#22d3ee' : '#ffffff99' }}
                >
                  {liveHighlight ? '◉ Live Detect' : '○ Live Detect'}
                </button>
              </>
            )}
          </div>

          {/* Bottom controls */}
          <div className="px-5 py-5 flex items-center justify-between gap-4 flex-shrink-0">
            {/* Gallery */}
            <button
              onClick={() => fileInputRef.current?.click()}
              aria-label="Pilih dari galeri"
              className="w-14 h-14 rounded-2xl bg-white/10 border border-white/20 flex flex-col items-center justify-center gap-1 active:scale-90 transition-all"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
              <span className="text-white/60 text-[9px] font-medium">Galeri</span>
            </button>

            {/* Shutter button */}
            <button
              onClick={capturePhoto}
              disabled={!!camError}
              aria-label="Ambil foto"
              className="w-20 h-20 rounded-full bg-white flex items-center justify-center active:scale-90 transition-all shadow-2xl disabled:opacity-40"
              style={{ boxShadow: '0 0 0 4px rgba(255,255,255,0.25), 0 8px 32px rgba(0,0,0,0.5)' }}
            >
              <div className="w-16 h-16 rounded-full border-4 border-gray-200 bg-white" />
            </button>

            {/* Flip camera */}
            <button
              onClick={flipCamera}
              aria-label="Ganti kamera"
              className="w-14 h-14 rounded-2xl bg-white/10 border border-white/20 flex flex-col items-center justify-center gap-1 active:scale-90 transition-all"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 4v6h6"/><path d="M23 20v-6h-6"/>
                <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4-4.64 4.36A9 9 0 0 1 3.51 15"/>
              </svg>
              <span className="text-white/60 text-[9px] font-medium">Balik</span>
            </button>
          </div>
        </div>
      )}

      {/* ── CROP STATE ────────────────────────────────────── */}
      {state === 'crop' && capturedImage && corners && (
        <div className="flex flex-col h-full">
          {/* Top bar */}
          <div className="flex items-center justify-between px-4 py-3 z-10 flex-shrink-0">
            <button
              onClick={retake}
              aria-label="Ulangi foto"
              className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center active:scale-90 transition-all"
            >
              <CloseIcon size={18} className="text-white" />
            </button>
            <div className="text-center">
              <p className="text-white font-bold text-sm">Sesuaikan Pinggiran</p>
              <p className="text-white/50 text-xs">Seret sudut biru</p>
            </div>
            <button
              onClick={applyCrop}
              aria-label="Konfirmasi crop"
              className="px-4 py-2 rounded-xl bg-cyan-500 text-white text-xs font-bold active:scale-90 transition-all shadow-lg shadow-cyan-500/30"
            >
              Crop ✓
            </button>
          </div>

          {/* Image + overlay */}
          <div
            ref={containerRef}
            className="flex-1 relative overflow-hidden mx-3 rounded-2xl"
          >
            <img
              src={capturedImage.src}
              alt="Captured"
              className="absolute inset-0 w-full h-full object-contain bg-black"
              draggable={false}
            />
            <canvas
              ref={overlayCanvasRef}
              className="absolute inset-0 w-full h-full touch-none cursor-crosshair"
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
            />
          </div>

          {/* Bottom toolbar */}
          <div className="px-4 py-4 flex-shrink-0 flex gap-2">
            {/* Auto-detect button */}
            <button
              onClick={autoDetectEdges}
              disabled={!scannerReady || autoDetecting}
              className="flex-1 py-3 rounded-2xl flex items-center justify-center gap-2 text-sm font-bold active:scale-95 transition-all disabled:opacity-50"
              style={{ background: 'rgba(34,211,238,0.15)', color: '#22d3ee', border: '1px solid rgba(34,211,238,0.3)' }}
            >
              {autoDetecting ? (
                <>
                  <div className="w-4 h-4 border-2 border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin" />
                  <span>Mendeteksi…</span>
                </>
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 6V2h4" /><path d="M1 18v4h4" /><path d="M23 6V2h-4" /><path d="M23 18v4h-4" />
                    <rect x="7" y="7" width="10" height="10" rx="1" />
                  </svg>
                  <span>Auto Deteksi</span>
                </>
              )}
            </button>

            {/* Reset corners */}
            <button
              onClick={() => initCorners(capturedImage.naturalWidth, capturedImage.naturalHeight)}
              className="w-12 h-12 rounded-2xl flex items-center justify-center active:scale-95 transition-all"
              style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)' }}
              aria-label="Reset sudut"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                <path d="M3 3v5h5" />
              </svg>
            </button>
          </div>


        </div>
      )}

      {/* ── PREVIEW STATE ─────────────────────────────────── */}
      {state === 'preview' && croppedDataUrl && (
        <div className="flex flex-col h-full">
          {/* Top bar */}
          <div className="flex items-center justify-between px-4 py-3 flex-shrink-0">
            <button
              onClick={() => setState('crop')}
              aria-label="Kembali ke crop"
              className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center active:scale-90 transition-all"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
            <div className="text-center">
              <p className="text-white font-bold text-sm">Preview Hasil</p>
              {scannedPages.length > 0 && (
                <p className="text-cyan-400 text-[10px] font-medium">{scannedPages.length} halaman tersimpan</p>
              )}
            </div>
            <button
              onClick={() => { const a = document.createElement('a'); a.href = croppedDataUrl; a.download = `Scan_preview.${saveFormat.toLowerCase()}`; a.click(); }}
              aria-label="Unduh"
              className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center active:scale-90 transition-all"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
            </button>
          </div>
          {/* Batch page thumbnails — reorder & delete */}
          {scannedPages.length > 0 && (
            <div className="px-4 pb-2 flex-shrink-0">
              <p className="text-white/50 text-[10px] font-semibold uppercase tracking-wider mb-2">
                {scannedPages.length} halaman sebelumnya — seret untuk urutkan
              </p>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {scannedPages.map((url, idx) => (
                  <div key={idx} className="relative flex-shrink-0">
                    <img
                      src={url}
                      alt={`Hal ${idx + 1}`}
                      className="w-14 h-20 object-cover rounded-xl border-2 border-white/20"
                    />
                    <span className="absolute top-1 left-1 bg-black/60 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-md">
                      {idx + 1}
                    </span>
                    {/* Hapus halaman dari batch */}
                    <button
                      onClick={() => setScannedPages(prev => prev.filter((_, i) => i !== idx))}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center shadow"
                    >
                      <span className="text-white text-[10px] font-black leading-none">✕</span>
                    </button>
                    {/* Pindah ke kiri */}
                    {idx > 0 && (
                      <button
                        onClick={() => setScannedPages(prev => {
                          const a = [...prev]; [a[idx-1], a[idx]] = [a[idx], a[idx-1]]; return a;
                        })}
                        className="absolute bottom-1 left-0.5 w-5 h-5 bg-black/60 rounded-full flex items-center justify-center"
                      >
                        <span className="text-white text-[9px]">◀</span>
                      </button>
                    )}
                    {/* Pindah ke kanan */}
                    {idx < scannedPages.length - 1 && (
                      <button
                        onClick={() => setScannedPages(prev => {
                          const a = [...prev]; [a[idx], a[idx+1]] = [a[idx+1], a[idx]]; return a;
                        })}
                        className="absolute bottom-1 right-0.5 w-5 h-5 bg-black/60 rounded-full flex items-center justify-center"
                      >
                        <span className="text-white text-[9px]">▶</span>
                      </button>
                    )}
                  </div>
                ))}
                {/* Current page preview */}
                <div className="relative flex-shrink-0 opacity-80">
                  <img
                    src={croppedDataUrl}
                    alt="Halaman ini"
                    className="w-14 h-20 object-cover rounded-xl border-2 border-cyan-400"
                  />
                  <span className="absolute top-1 left-1 bg-cyan-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-md">
                    {scannedPages.length + 1}
                  </span>
                </div>
              </div>
            </div>
          )}
          <div className="flex-1 mx-3 mb-3 rounded-2xl overflow-hidden relative bg-black">
            <img src={croppedDataUrl} alt="Cropped document" className="absolute inset-0 w-full h-full object-contain" />
            <div className="absolute top-3 right-3 bg-green-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg">✓ Siap disimpan</div>
            <div className="absolute bottom-3 left-3 bg-black/60 text-cyan-400 text-xs font-medium px-2.5 py-1 rounded-full">📐 Perspective Corrected</div>
          </div>
          <div className="px-5 pb-3 flex justify-center gap-2 flex-shrink-0">
            {(['PDF', 'JPG', 'PNG'] as const).map((fmt) => (
              <button key={fmt} onClick={() => setSaveFormat(fmt)}
                className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${saveFormat === fmt ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/30' : 'bg-white/10 text-white/70 border border-white/20'}`}>
                {fmt}
              </button>
            ))}
          </div>
          <div className="px-4 pb-5 flex gap-2 flex-shrink-0">
            <button onClick={() => retake(true)} className="flex-1 py-3.5 rounded-2xl border border-white/20 text-white text-xs font-bold active:scale-95 transition-all">🔄 Ulangi</button>
            <button onClick={addPageAndScanAgain} className="flex-1 py-3.5 rounded-2xl text-cyan-400 text-xs font-bold active:scale-95 transition-all" style={{ background: 'rgba(34,211,238,0.1)', border: '1px solid rgba(34,211,238,0.3)' }}>➕ Scan Lagi</button>
            <button onClick={saveDocument} className="flex-1 py-3.5 rounded-2xl bg-cyan-500 text-white text-xs font-bold active:scale-95 transition-all shadow-lg shadow-cyan-500/30">💾 Simpan</button>
          </div>
        </div>
      )}

      {/* ── SAVING STATE ──────────────────────────────────── */}
      {state === 'saving' && (
        <div className="flex-1 flex flex-col items-center justify-center gap-6 px-8">
          <div className="relative">
            <div className="w-20 h-20 rounded-full border-4 border-cyan-500/20 border-t-cyan-500 animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#22d3ee" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
            </div>
          </div>
          <div className="text-center">
            <p className="text-white font-bold text-lg">Menyimpan dokumen…</p>
            <p className="text-white/50 text-sm mt-1">{scannedPages.length > 1 ? `${scannedPages.length} halaman` : 'Harap tunggu sebentar'}</p>
          </div>
          <div className="w-full max-w-[200px] h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div className="h-full bg-cyan-500 rounded-full progress-bar-fill" />
          </div>
        </div>
      )}
    </div>
  );
}
