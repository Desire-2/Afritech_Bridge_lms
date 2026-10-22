'use client';

import { Badge, Modal } from '@/components/ui';
import { BarcodeCandidate, BarcodeLookup } from '@/lib/barcode';
import { BarcodeStatus } from './ProductScanResult';

/**
 * One printed code, several products: the operator chooses which row the
 * scan meant before anything is added or matched.
 */
export function BarcodeCandidatePicker({
  lookup,
  show,
  onPick,
  onClose,
}: {
  lookup: BarcodeLookup | null;
  show: boolean;
  onPick: (c: BarcodeCandidate) => void;
  onClose: () => void;
}) {
  if (!show || !lookup) return null;
  const candidates = lookup.candidates || [];
  return (
    <Modal
      show={show}
      title="Several products share this barcode"
      onClose={onClose}
      size="sm"
      footer={
        <button type="button" className="btn btn-outline-secondary" onClick={onClose}>
          Cancel
        </button>
      }
    >
      {lookup.message && <div className="small text-secondary mb-2">{lookup.message}</div>}
      <div className="font-monospace mb-2">
        <BarcodeStatus value={lookup.barcode} format={lookup.barcode_format} />
      </div>
      <div className="d-grid gap-2">
        {candidates.map((c, i) => {
          const product: any = c.product || {};
          const variant: any = c.variant || null;
          const stock = typeof c.available_stock === 'number' ? c.available_stock : null;
          return (
            <button
              type="button"
              key={`${product.id ?? 'p'}-${variant?.id ?? 'v'}-${i}`}
              className="btn btn-outline-secondary border rounded p-2 text-start w-100"
              onClick={() => onPick(c)}
            >
              <div className="d-flex justify-content-between align-items-start gap-2 flex-wrap">
                <span className="fw-semibold">
                  {product.name}{variant ? ` — ${variant.name}` : ''}
                </span>
              </div>
              <div className="small text-secondary text-start">
                SKU {variant ? variant.sku : product.sku}
                {product.brand ? ` · ${product.brand}` : ''}
              </div>
              <div className="d-flex gap-3 mt-2 align-items-center flex-wrap text-start">
                <span className="money fw-semibold">
                  {Number(product.selling_price || 0).toLocaleString()} RWF
                </span>
                {stock !== null && (
                  <span className={`badge ${stock === 0 ? 'bg-danger-subtle text-danger border-danger-subtle' : 'bg-success-subtle text-success border-success-subtle'}`}>
                    {stock === 0 ? 'Out of stock' : `${stock} available`}
                  </span>
                )}
                {product.status && product.status !== 'active' && <Badge status={product.status} />}
              </div>
            </button>
          );
        })}
      </div>
    </Modal>
  );
}

export default BarcodeCandidatePicker;
