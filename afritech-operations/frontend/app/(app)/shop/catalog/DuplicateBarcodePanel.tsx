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
}

/**
 * Inline panel for a barcode the catalogue already holds: either the result
 * of a pre-save lookup or the `existing` payload of a 409 response.
 */
export function DuplicateBarcodePanel({
  existing,
  lookup,
  barcode,
  tone = 'error',
  onOpen,
  onUse,
  compact = false,
  className = '',
}: {
  existing?: BarcodeConflict | null;
  lookup?: BarcodeLookup | null;
  barcode?: string;
  tone?: 'error' | 'info';
  onOpen?: (productId: number) => void;
  onUse?: (productId: number) => void;
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

  const name = found
    ? `${product.name || ''}${variant ? ` — ${variant.name}` : ''}`
    : existing
      ? existing.kind === 'variant' && existing.product_name
        ? `${existing.product_name} — ${existing.name}`
        : existing.name || ''
      : '';
  const sku = found ? (variant ? variant.sku : product.sku) : existing?.sku;
  const status = found ? product.status : existing?.status;

  const isError = tone === 'error';
  const heading = isError ? 'Barcode already registered' : 'Already registered to this item';

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
      {found && !compact ? (
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
