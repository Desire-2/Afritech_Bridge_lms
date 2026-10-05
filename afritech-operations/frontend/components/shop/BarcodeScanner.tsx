'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Modal } from '@/components/ui';
import {
  BarcodeFormat,
  detectBarcodeFormat,
  normalizeBarcode,
  RETAIL_FORMATS,
  scanFeedback,
} from '@/lib/barcode';

type Mode =
  | 'intro'
  | 'requesting'
  | 'scanning'
  | 'denied'
  | 'no-camera'
  | 'insecure'
  | 'unsupported'
  | 'manual';

const NATIVE_NAMES: Record<string, string> = {
  EAN_13: 'ean_13',
  UPC_A: 'upc_a',
  EAN_8: 'ean_8',
  UPC_E: 'upc_e',
  CODE_128: 'code_128',
  CODE_39: 'code_39',
  ITF: 'itf',
  QR_CODE: 'qr_code',
  DATA_MATRIX: 'data_matrix',
};

/**
 * Layered scanner: native BarcodeDetector first, ZXing over the camera as the
 * fallback, hardware scanners and manual entry always available. The camera
 * only starts when the user asks for it and stops on success, close or error.
 */
export function BarcodeScanner({
  show,
  onClose,
  onDetected,
  title = 'Scan Barcode',
  formats = RETAIL_FORMATS,
  sound = true,
  vibration = true,
}: {
  show: boolean;
  onClose: () => void;
  onDetected: (value: string, format: BarcodeFormat) => void;
  title?: string;
  formats?: BarcodeFormat[];
  sound?: boolean;
  vibration?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<number | null>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);
  const busyRef = useRef(false);
  const handledRef = useRef(false);
  const onDetectedRef = useRef(onDetected);
  onDetectedRef.current = onDetected;

  const [mode, setMode] = useState<Mode>('intro');
  const [manualValue, setManualValue] = useState('');
  const [nativeWanted, setNativeWanted] = useState(false);

  const stopCamera = useCallback(() => {
    if (intervalRef.current) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    try {
      controlsRef.current?.stop();
    } catch {
      /* already stopped */
    }
    controlsRef.current = null;
    const stream = streamRef.current;
    streamRef.current = null;
    if (stream) stream.getTracks().forEach((track) => track.stop());
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  useEffect(() => () => stopCamera(), [stopCamera]);
  useEffect(() => {
    if (!show) {
      stopCamera();
      setMode('intro');
      setManualValue('');
      handledRef.current = false;
    }
  }, [show, stopCamera]);

  const handleValue = useCallback(
    (raw: string, format?: BarcodeFormat) => {
      const value = normalizeBarcode(raw);
      if (!value || handledRef.current) return;
      handledRef.current = true;
      stopCamera();
      scanFeedback('ok', { sound, vibration });
      onDetectedRef.current(value, format || detectBarcodeFormat(value));
      onClose();
    },
    [onClose, sound, stopCamera, vibration]
  );

  async function startCamera() {
    if (typeof window !== 'undefined' && !window.isSecureContext) {
      setMode('insecure');
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setMode('unsupported');
      return;
    }
    setMode('requesting');
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      });
    } catch (err: any) {
      const name = err?.name || '';
      if (name === 'NotAllowedError' || name === 'SecurityError') setMode('denied');
      else if (name === 'NotFoundError' || name === 'OverconstrainedError') setMode('no-camera');
      else setMode('unsupported');
      return;
    }
    streamRef.current = stream;
    const video = videoRef.current;
    if (!video) {
      stream.getTracks().forEach((t) => t.stop());
      setMode('intro');
      return;
    }
    video.srcObject = stream;
    try {
      await video.play();
    } catch {
      /* autoplay is allowed for muted inline video */
    }

    const Detector = (window as any).BarcodeDetector;
    let supported: string[] = [];
    if (Detector?.getSupportedFormats) {
      try {
        supported = await Detector.getSupportedFormats();
      } catch {
        supported = [];
      }
    }
    const wanted = formats
      .map((f) => NATIVE_NAMES[f])
      .filter((name) => supported.includes(name));
    if (Detector && wanted.length) {
      try {
        const detector = new Detector({ formats: wanted });
        setNativeWanted(true);
        setMode('scanning');
        intervalRef.current = window.setInterval(() => {
          const el = videoRef.current;
          if (!el || el.readyState < 2) return;
          if (busyRef.current || handledRef.current) return;
          busyRef.current = true;
          detector
            .detect(el)
            .then((results: any[]) => {
              if (results && results[0] && !handledRef.current) {
                const fmt = String(results[0].format || '').toUpperCase();
                handleValue(results[0].rawValue, (fmt as BarcodeFormat) || undefined);
              }
            })
            .catch(() => undefined)
            .finally(() => {
              busyRef.current = false;
            });
        }, 300);
        return;
      } catch {
        /* fall through to ZXing */
      }
    }

    try {
      const [{ BrowserMultiFormatReader }, zxing] = await Promise.all([
        import('@zxing/browser'),
        import('@zxing/library'),
      ]);
      const hints = new Map<any, any>();
      const zxingFormats = formats
        .map((f) => (zxing.BarcodeFormat as any)[f])
        .filter((v) => typeof v === 'number');
      if (zxingFormats.length) hints.set(zxing.DecodeHintType.POSSIBLE_FORMATS, zxingFormats);
      const reader = new BrowserMultiFormatReader(hints, {
        delayBetweenScanAttempts: 250,
      });
      setNativeWanted(false);
      setMode('scanning');
      controlsRef.current = await reader.decodeFromVideoDevice(
        undefined,
        video,
        (result: any) => {
          if (!result || handledRef.current) return;
          let fmt: BarcodeFormat | undefined;
          try {
            fmt = (zxing.BarcodeFormat as any)[result.getBarcodeFormat()] as BarcodeFormat;
          } catch {
            fmt = undefined;
          }
          handleValue(result.getText(), fmt);
        }
      );
    } catch {
      stopCamera();
      setMode('unsupported');
    }
  }

  function submitManual(event?: React.FormEvent) {
    event?.preventDefault();
    const value = normalizeBarcode(manualValue);
    if (!value) return;
    handleValue(value);
  }

  const cameraRunning = mode === 'scanning' || mode === 'requesting';

  const statusBlock = (() => {
    switch (mode) {
      case 'denied':
        return {
          text: 'Camera permission was denied. Allow camera access in your browser settings, or enter the barcode manually.',
          variant: 'warning',
        };
      case 'no-camera':
        return {
          text: 'No camera was found on this device.',
          variant: 'warning',
        };
      case 'insecure':
        return {
          text: 'Camera scanning requires a secure connection (HTTPS).',
          variant: 'warning',
        };
      case 'unsupported':
        return {
          text: 'Camera scanning is not supported on this device/browser. Use a USB/Bluetooth scanner or enter the barcode manually.',
          variant: 'warning',
        };
      default:
        return null;
    }
  })();

  return (
    <Modal show={show} title={title} onClose={() => { stopCamera(); onClose(); }} size="lg"
      footer={
        <div className="d-flex gap-2 justify-content-between w-100 align-items-center">
          <div className="small text-secondary">
            {mode === 'scanning'
              ? nativeWanted
                ? 'Detecting EAN/UPC, Code 128 and Code 39…'
                : 'Camera decoder active'
              : 'Hardware scanners work in any barcode field — no camera needed.'}
          </div>
          <div className="d-flex gap-2">
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm"
              onClick={() => { stopCamera(); setMode('manual'); }}
            >
              Enter manually
            </button>
            {cameraRunning && (
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm"
                onClick={() => { stopCamera(); setMode('intro'); }}
              >
                Stop camera
              </button>
            )}
            {!cameraRunning && mode !== 'manual' && (
              <button type="button" className="btn btn-primary btn-sm" onClick={startCamera}>
                <i className="bi bi-camera me-1" />
                {mode === 'intro' ? 'Scan with camera' : 'Retry camera'}
              </button>
            )}
            <button type="button" className="btn btn-outline-danger btn-sm" onClick={() => { stopCamera(); onClose(); }}>
              Close
            </button>
          </div>
        </div>
      }
    >
      {mode === 'manual' ? (
        <form onSubmit={submitManual}>
          <label className="form-label">Barcode</label>
          <div className="input-group mb-2">
            <input
              autoFocus
              className="form-control"
              value={manualValue}
              onChange={(e) => setManualValue(e.target.value)}
              placeholder="Enter barcode, e.g. 4006381333931"
              autoComplete="off"
              spellCheck={false}
            />
            <button type="submit" className="btn btn-primary">Use barcode</button>
          </div>
          <div className="form-text">
            Leading zeros are kept. The value is looked up in the shop catalogue only.
          </div>
        </form>
      ) : (
        <>
          <div className="position-relative bg-dark rounded overflow-hidden mb-2"
            style={{ aspectRatio: '4 / 3', minHeight: 220 }}>
            <video
              ref={videoRef}
              className="w-100 h-100"
              style={{ objectFit: 'cover', display: cameraRunning ? 'block' : 'none' }}
              playsInline
              muted
              autoPlay
            />
            {mode === 'scanning' && (
              <div
                className="position-absolute top-50 start-50 translate-middle border border-3 border-light rounded"
                style={{
                  width: '72%',
                  height: '42%',
                  boxShadow: '0 0 0 9999px rgba(0,0,0,.4)',
                }}
              />
            )}
            {!cameraRunning && (
              <div className="position-absolute top-50 start-50 translate-middle text-center text-white px-3">
                <i className="bi bi-upc fs-2 d-block mb-2 opacity-75" />
                <div className="small">Align the barcode inside the frame</div>
              </div>
            )}
            <div
              className="position-absolute bottom-0 start-0 end-0 text-center text-white small py-1"
              style={{ background: 'rgba(0,0,0,.5)' }}
            >
              {mode === 'scanning' ? 'Align the barcode inside the frame' : ''}
            </div>
          </div>
          {statusBlock && (
            <div className={`alert alert-${statusBlock.variant} py-2 small mb-2`} role="alert">
              {statusBlock.text}
              <div className="mt-2">
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary me-2"
                  onClick={() => setMode('manual')}
                >
                  Enter barcode manually
                </button>
              </div>
            </div>
          )}
          {mode === 'intro' && !statusBlock && (
            <div className="text-center small text-secondary">
              Camera access is requested only when you start scanning, and the camera stops as
              soon as a barcode is read.
            </div>
          )}
        </>
      )}
    </Modal>
  );
}

export default BarcodeScanner;
