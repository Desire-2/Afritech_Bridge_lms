'use client';

import React from 'react';
import { Badge } from '@/components/ui';
import { BarcodeStatus, ProductScanResult } from '@/components/shop';
import { BarcodeLookup } from '@/lib/barcode';

/** The `existing` object a 409 duplicate_barcode response carries. */
export interface BarcodeConflict {
  kind?: string;
  id?: number;
  name?: string;
  sku?: string;
  status?: string;
  product_name?: string | null;
  product_id?: number;
}

/** Owner rows are named the same way wherever they are rendered. */
function ownerLabel(row: BarcodeConflict): string {
  return row.kind === 'variant' && row.product_name
    ? `${row.product_name} — ${row.name || ''}`
    : row.name || '';
}

/**
 * Inline panel for a barcode the catalogue already holds: either the result
 * of a pre-save lookup or the `existing` payload of a 409 response. When the
 * code is shared, every owner is listed and the operator can still opt into
 * creating another product with the same printed code.
 */
export function DuplicateBarcodePanel({
  existing,
  lookup,
  barcode,
  tone = 'error',
  onOpen,
  onUse,
  candidates,
  onShare,
  shared = false,
  compact = false,
  className = '',
}: {
  existing?: BarcodeConflict | null;
  lookup?: BarcodeLookup | null;
  barcode?: string;
  tone?: 'error' | 'info';
  onOpen?: (productId: number) => void;
  onUse?: (productId: number) => void;
  candidates?: BarcodeConflict[] | null;
  onShare?: () => void;
  shared?: boolean;
  compact?: boolean;
  className?: string;
}) {
  const found = !!lookup?.found;
  const product: any = found ? lookup!.product || {} : null;
  const variant: any = found ? lookup!.variant || null : null;
  const code = barcode || lookup?.barcode || '';
  const format = lookup?.barcode_format || product?.barcode_format;
  const productId: number | undefined =
    product?.id ?? (existing?.kind === 'product' ? existing?.id : undefined);

  // Every known owner — the candidates list when the server sent one, the
  // single `existing` row otherwise.
  const owners: BarcodeConflict[] = candidates && candidates.length
    ? candidates
    : existing ? [existing] : [];
  // A list replaces the single row whenever several owners exist, and also
  // when sharing is offered, so the operator sees who already carries the code.
  const listed = owners.length > 1 || (!!onShare && owners.length > 0);

  const name = found
    ? `${product.name || ''}${variant ? ` — ${variant.name}` : ''}`
    : existing
      ? ownerLabel(existing)
      : '';
  const sku = found ? (variant ? variant.sku : product.sku) : existing?.sku;
  const status = found ? product.status : existing?.status;

  const isError = tone === 'error' && !shared;
  const heading = owners.length > 1
    ? `Barcode used by ${owners.length} products`
    : isError ? 'Barcode already registered' : 'Already registered to this item';

  const actions =
    (onOpen || onUse) && productId !== undefined && productId !== null ? (
      <>
        {onOpen && (
          <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => onOpen(productId)}>
            View Product
          </button>
        )}
        {onUse && (
          <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => onUse(productId)}>
            Use Existing Product
          </button>
        )}
      </>
    ) : null;

  return (
    <div
      className={`border rounded p-2 small bg-body ${isError ? 'border-danger' : 'border-info'} ${className}`}
    >
      <div className={`fw-semibold mb-1 ${isError ? 'text-danger' : 'text-info'}`}>
        <i className={`bi ${isError ? 'bi-exclamation-triangle' : 'bi-info-circle'} me-1`} />
        {heading}
      </div>
      {listed ? (
        <>
          <div className="d-grid gap-1 mb-2">
            {owners.map((row, i) => {
              const rowId = row.product_id ?? (row.kind === 'product' ? row.id : undefined);
              const canOpen = (onOpen || onUse) && rowId !== undefined && rowId !== null;
              return (
                <div
                  key={`${row.kind || 'row'}-${row.id ?? i}-${i}`}
                  className="border rounded p-2 d-flex align-items-center gap-2 flex-wrap"
                >
                  <span className="fw-semibold">{ownerLabel(row)}</span>
                  {row.sku && <span className="text-secondary">SKU {row.sku}</span>}
                  {row.status && <Badge status={row.status} />}
                  {canOpen && (
                    <span className="d-flex gap-2 flex-wrap ms-auto">
                      {onOpen && rowId !== undefined && rowId !== null && (
                        <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => onOpen(rowId)}>
                          View
                        </button>
                      )}
                      {onUse && rowId !== undefined && rowId !== null && (
                        <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => onUse(rowId)}>
                          Use Existing Product
                        </button>
                      )}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
          {shared ? (
            <div className="small text-info mb-0">
              <i className="bi bi-info-circle me-1" />
              This product will be saved sharing that barcode.
            </div>
          ) : onShare ? (
            <button type="button" className="btn btn-sm btn-outline-primary" onClick={onShare}>
              Create as another product with this code
            </button>
          ) : null}
        </>
      ) : found && !compact ? (
        <ProductScanResult result={lookup!} actions={actions} />
      ) : (
        <div className="d-flex flex-wrap align-items-center gap-2">
          <span className="fw-semibold">{name}</span>
          {sku && <span className="text-secondary">SKU {sku}</span>}
          {status && <Badge status={status} />}
          {code && <BarcodeStatus value={code} format={format} />}
          {actions && <span className="d-flex gap-2 flex-wrap ms-auto">{actions}</span>}
        </div>
      )}
    </div>
  );
}

export default DuplicateBarcodePanel;
