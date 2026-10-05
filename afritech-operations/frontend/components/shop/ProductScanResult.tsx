'use client';

import React from 'react';
import { BarcodeLookup, formatLabel } from '@/lib/barcode';
import { Badge, Modal } from '@/components/ui';

export function BarcodeStatus({
  value,
  format,
  className = '',
}: {
  value?: string | null;
  format?: string | null;
  className?: string;
}) {
  if (!value) return null;
  return (
    <span className={`badge bg-light text-dark border font-monospace ${className}`}>
      {formatLabel(format)} · {value}
    </span>
  );
}

/** Compact identity card for a scanned product (setup, receiving, lookups). */
export function ProductScanResult({
  result,
  actions,
  children,
}: {
  result: BarcodeLookup;
  actions?: React.ReactNode;
  children?: React.ReactNode;
}) {
  if (!result.found) {
    return (
      <div className="alert alert-warning py-2 small mb-0">
        <div className="d-flex align-items-start gap-2">
          <i className="bi bi-exclamation-triangle mt-1" />
          <div className="flex-grow-1">
            <div className="fw-semibold">No product with this barcode exists in the current inventory.</div>
            <div className="font-monospace mt-1">
              {result.barcode_format && <BarcodeStatus value={result.barcode} format={result.barcode_format} />}
              {!result.barcode_format && <BarcodeStatus value={result.barcode} />}
            </div>
            {children && <div className="mt-2 d-flex flex-wrap gap-2">{children}</div>}
          </div>
        </div>
      </div>
    );
  }

  const product = result.product || {};
  const variant = result.variant;
  const stock = typeof result.available_stock === 'number' ? result.available_stock : null;
  const low = stock !== null && stock > 0 && stock <= Number(product.min_stock_level || 0);

  return (
    <div className="border rounded p-3 bg-body">
      <div className="d-flex justify-content-between align-items-start gap-2 flex-wrap">
        <div>
          <div className="fw-semibold">{product.name}{variant ? ` — ${variant.name}` : ''}</div>
          <div className="small text-secondary">
            SKU {variant ? variant.sku : product.sku}
            {product.brand ? ` · ${product.brand}` : ''}
            {product.category ? ` · ${product.category}` : ''}
          </div>
        </div>
        <BarcodeStatus value={result.barcode || product.barcode} format={product.barcode_format || result.barcode_format} />
      </div>
      <div className="d-flex gap-3 mt-2 align-items-center flex-wrap">
        <div className="money fw-semibold">{Number(product.selling_price || 0).toLocaleString()} RWF</div>
        {stock !== null && (
          <span className={`badge ${stock === 0 ? 'bg-danger-subtle text-danger border-danger-subtle' : low ? 'bg-warning-subtle text-warning border-warning-subtle' : 'bg-success-subtle text-success border-success-subtle'}`}>
            {stock === 0 ? 'Out of stock' : `${stock} available`}
          </span>
        )}
        {product.is_serialized && (
          <span className="badge bg-info-subtle text-info border-info-subtle">Serialized</span>
        )}
        {product.status && product.status !== 'active' && <Badge status={product.status} />}
      </div>
      {result.branches && result.branches.length > 0 && (
        <div className="small text-secondary mt-2">
          {result.branches.map((b) => `${b.name}: ${b.available}`).join(' · ')}
        </div>
      )}
      {children}
      {actions && <div className="mt-2 d-flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

/** Out-of-stock block used by the POS: nothing is added, options are offered. */
export function OutOfStockDialog({
  show,
  result,
  onClose,
  extra,
}: {
  show: boolean;
  result: BarcodeLookup | null;
  onClose: () => void;
  extra?: React.ReactNode;
}) {
  const product = result?.product || {};
  const variant = result?.variant;
  return (
    <Modal
      show={show}
      title="Out of stock"
      onClose={onClose}
      size="sm"
      footer={
        <div className="d-flex gap-2 w-100 justify-content-end">
          {extra}
          <button type="button" className="btn btn-outline-secondary btn-sm" onClick={onClose}>
            Close
          </button>
        </div>
      }
    >
      <div className="mb-2">
        <strong>{product.name}{variant ? ` — ${variant.name}` : ''}</strong> is out of stock at
        this branch.
      </div>
      <div className="small text-secondary">
        SKU {variant ? variant.sku : product.sku}
        {result?.barcode ? ` · ${result.barcode}` : ''}
      </div>
      {result?.branches && result.branches.length > 0 && (
        <div className="mt-2 small border-top pt-2">
          <div className="fw-semibold">Availability at other branches</div>
          {result.branches.map((b) => (
            <div key={b.branch_id} className="d-flex justify-content-between">
              <span>{b.name}</span>
              <span className="money">{b.available}</span>
            </div>
          ))}
          <div className="form-text">Sales still come from this branch only.</div>
        </div>
      )}
    </Modal>
  );
}
