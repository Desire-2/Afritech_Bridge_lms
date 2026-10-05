'use client';

import { useEffect, useState } from 'react';
import { Modal } from '@/components/ui';
import { Field, SelectInput, TextInput } from '@/components/form';
import { BarcodeStatus } from '@/components/shop';
import { detectBarcodeFormat, formatLabel } from '@/lib/barcode';
import { barcodeSvg } from '@/lib/barcode-render';

/** The retail symbology this value can honestly be printed as, if any. */
function gtinFormatFor(value: string, stored?: string | null): 'EAN_13' | 'UPC_A' | null {
  const detected = detectBarcodeFormat(value);
  if (detected === 'EAN_13' || detected === 'UPC_A') return detected;
  if (
    (stored === 'EAN_13' || stored === 'UPC_A') &&
    /^\d+$/.test(value) &&
    value.length === (stored === 'EAN_13' ? 13 : 12)
  ) {
    return stored;
  }
  return null;
}

export function BarcodeLabelDialog({
  show,
  onClose,
  value,
  format,
  barcodeType,
  name,
  sku,
}: {
  show: boolean;
  onClose: () => void;
  value: string;
  format?: string | null;
  barcodeType?: string | null;
  name?: string;
  sku?: string;
}) {
  const gtin = show && value ? gtinFormatFor(value, format) : null;
  const internal = barcodeType === 'internal' || !gtin;
  const [printFormat, setPrintFormat] = useState('CODE_39');
  const [qty, setQty] = useState(1);

  useEffect(() => {
    if (!show) return;
    setPrintFormat(internal ? 'CODE_39' : gtin || 'CODE_39');
    setQty(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show, value]);

  let svg = '';
  let svgError = '';
  if (show && value) {
    try {
      svg = barcodeSvg(value, printFormat, { moduleWidth: 3, height: 56 });
    } catch (err: any) {
      svgError = err?.message || 'This barcode cannot be drawn as a label.';
    }
  }

  const options: { value: string; label: string }[] = internal
    ? [{ value: 'CODE_39', label: 'Code 39' }]
    : [
        { value: gtin as string, label: formatLabel(gtin) },
        { value: 'CODE_39', label: 'Code 39' },
      ];

  const labelCard = (key: number) => (
    <div key={key} className="border rounded p-2 text-center bg-white" style={{ width: 232 }}>
      {name && (
        <div className="small fw-semibold text-truncate" title={name}>
          {name}
        </div>
      )}
      {sku && <div className="text-muted" style={{ fontSize: '0.7rem' }}>SKU {sku}</div>}
      <div className="mt-1" dangerouslySetInnerHTML={{ __html: svg }} />
      <div className="font-monospace mt-1" style={{ fontSize: '0.8rem' }}>
        {value}
      </div>
    </div>
  );

  return (
    <Modal
      show={show}
      title="Print barcode label"
      onClose={onClose}
      size="lg"
      footer={
        <>
          <button type="button" className="btn btn-outline-secondary" onClick={onClose}>
            Close
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!svg}
            onClick={() => window.print()}
          >
            <i className="bi bi-printer me-1" />
            Print
          </button>
        </>
      }
    >
      <div className="alert alert-light border py-2 small mb-3">
        <div className="fw-semibold">
          {internal
            ? 'Internal shop barcode — not a GS1-issued GTIN'
            : 'External product barcode — a GS1-issued retail barcode'}
        </div>
        <div className="text-secondary">
          {internal
            ? 'Printed as Code 39, the shop’s own label symbology, so every till and handheld scanner can read it.'
            : 'Printed exactly as issued by the manufacturer; Code 39 is offered for a reprint of the same value.'}
        </div>
      </div>

      <div className="d-flex flex-wrap gap-3 align-items-end mb-3">
        <div style={{ maxWidth: 220 }}>
          <Field label="Print format">
            <SelectInput value={printFormat} onChange={(e) => setPrintFormat(e.target.value)}>
              {options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </SelectInput>
          </Field>
        </div>
        <div style={{ maxWidth: 130 }}>
          <Field label="Copies">
            <TextInput
              type="number"
              min={1}
              max={30}
              value={qty}
              onChange={(e) => setQty(Math.min(30, Math.max(1, Number(e.target.value) || 1)))}
            />
          </Field>
        </div>
        <div className="pb-3">
          <BarcodeStatus value={value} format={printFormat === 'CODE_39' ? 'CODE_39' : printFormat} />
        </div>
      </div>

      {svgError && <div className="alert alert-warning py-2 small mb-2">{svgError}</div>}

      {svg && (
        <div className="d-flex flex-wrap gap-2">
          {Array.from({ length: qty }).map((_, i) => labelCard(i))}
        </div>
      )}
    </Modal>
  );
}

export default BarcodeLabelDialog;
