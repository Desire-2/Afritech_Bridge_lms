'use client';

import React, { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { normalizeBarcode, ScanBurst, makeScanGate } from '@/lib/barcode';

export interface BarcodeInputHandle {
  focus: () => void;
  clear: () => void;
}

/**
 * Manual entry + hardware scanner (USB/Bluetooth keyboard-wedge) input.
 *
 * Scanners type a burst of characters and end with Enter (or Tab); a burst
 * submits as one scan. Manual typing never auto-submits — the user presses
 * Enter or the scan button. Identical values inside `dedupeMs` fire only once.
 */
function BarcodeInputInner(
  {
    value,
    onChange,
    onScan,
    onCamera,
    onClear,
    placeholder = 'Scan barcode or type it, then Enter',
    label,
    autoFocus,
    disabled,
    busy,
    id,
    className = '',
    dedupeMs = 1200,
    size = 'sm',
    showCameraButton = true,
    inputRef,
    hint,
  }: {
    value: string;
    onChange: (value: string) => void;
    onScan: (value: string, source: 'manual' | 'hardware') => void | Promise<void>;
    onCamera?: () => void;
    onClear?: () => void;
    placeholder?: string;
    label?: string;
    autoFocus?: boolean;
    disabled?: boolean;
    busy?: boolean;
    id?: string;
    className?: string;
    dedupeMs?: number;
    size?: 'sm' | 'md';
    showCameraButton?: boolean;
    inputRef?: React.RefObject<HTMLInputElement>;
    hint?: string;
  },
  ref: React.Ref<BarcodeInputHandle>
) {
  const localRef = useRef<HTMLInputElement>(null);
  const input = inputRef || localRef;
  const burstRef = useRef(new ScanBurst());
  const gateRef = useRef(makeScanGate(dedupeMs));
  const gateMsRef = useRef(dedupeMs);
  gateMsRef.current = dedupeMs;

  useImperativeHandle(ref, () => ({
    focus: () => input.current?.focus(),
    clear: () => onChange(''),
  }));

  useEffect(() => {
    if (autoFocus && !disabled) input.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoFocus]);

  async function submit(source: 'manual' | 'hardware') {
    const code = normalizeBarcode(value);
    if (!code || disabled || busy) return;
    if (!gateRef.current(code)) {
      burstRef.current.reset();
      return;
    }
    burstRef.current.reset();
    await onScan(code, source);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.preventDefault();
      submit('hardware');
      return;
    }
    if (event.key === 'Tab' && !event.shiftKey && value) {
      if (burstRef.current.isScannerBurst()) {
        event.preventDefault();
        submit('hardware');
      }
      return;
    }
    if (event.key.length === 1 || event.key === 'Backspace') {
      burstRef.current.keystroke();
    }
  }

  const controlClass = size === 'sm' ? 'form-control form-control-sm' : 'form-control';

  return (
    <div className={className}>
      {label && <label className="form-label small mb-1">{label}</label>}
      <div className="input-group">
        <input
          ref={input}
          id={id}
          type="text"
          className={controlClass}
          value={value}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="none"
          spellCheck={false}
          inputMode="text"
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
        />
        {showCameraButton && onCamera && (
          <button
            type="button"
            className={`btn btn-outline-secondary ${size === 'sm' ? '' : ''}`}
            onClick={onCamera}
            disabled={disabled || busy}
            title="Scan with camera"
            aria-label="Scan with camera"
          >
            <i className="bi bi-camera" />
          </button>
        )}
        <button
          type="button"
          className="btn btn-outline-secondary"
          onClick={() => submit('manual')}
          disabled={disabled || busy}
          title="Look up barcode"
          aria-label="Look up barcode"
        >
          <i className="bi bi-upc-scan" />
        </button>
        {value && onClear && (
          <button
            type="button"
            className="btn btn-outline-secondary"
            onClick={() => {
              onClear();
              input.current?.focus();
            }}
            disabled={disabled || busy}
            title="Clear barcode"
            aria-label="Clear barcode"
          >
            <i className="bi bi-x-lg" />
          </button>
        )}
      </div>
      {hint && <div className="form-text small mt-1">{hint}</div>}
    </div>
  );
}

export const BarcodeInput = forwardRef<BarcodeInputHandle, any>(BarcodeInputInner);
BarcodeInput.displayName = 'BarcodeInput';

export default BarcodeInput;
