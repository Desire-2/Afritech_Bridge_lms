"""Barcode handling for the electronics shop.

A shop barcode is an opaque string — never a number. Retail codes are read
from a scanner (which may hand over ``00012345678905``), typed by a shopkeeper
(``AB-000001``) or reported by the scanner library with an explicit symbology.
This module is deliberately free of route imports so migrations, services and
blueprints can all use it without a circular import:

* :func:`normalize_barcode` trims scanner noise while preserving leading zeros;
* :func:`detect_format` labels checksum-valid GTIN/UPC codes and calls
  everything else ``UNKNOWN`` (internal shop codes are not failures);
* :func:`validate_barcode` only enforces a length/check digit when the caller
  asserts a specific symbology — a generic lookup never rejects a code for not
  looking like a GTIN;
* :func:`resolve` matches a scanned value against barcodes and SKUs
  (:func:`resolve_all` returns *every* owner — one code may be shared by
  several rebranded products, so a scan can be genuinely ambiguous);
* :func:`register_barcode` writes a barcode with a friendly 409 when another
  product or variant already owns it (callers may pass ``allow_shared`` to
  take the code deliberately, listing the candidates either way), and an
  audit row either way;
* :func:`record_unknown_scan` upserts the unknown-scan queue and warns the
  catalogue team once a code has been scanned three times.
"""
from datetime import datetime, timezone

from ..extensions import db
from ..models import (
    Branch, ShopProduct, ShopProductVariant, ShopUnknownBarcode,
)
from .audit import audit
from .notifications import notify_users_with_permission
from .shop_inventory import ShopStockError

# Formats whose value is a checksummed retail code.
GTIN_FORMATS = ('EAN_13', 'UPC_A', 'EAN_8', 'UPC_E')
# Formats a caller may name without the value having to look like a GTIN.
GENERIC_FORMATS = ('UNKNOWN', 'CODE_128', 'CODE_39', 'ITF', 'QR_CODE',
                   'DATA_MATRIX')
UNKNOWN_CONTEXTS = ('pos', 'receiving', 'count', 'lookup')
MAX_BARCODE_LENGTH = 64
UNKNOWN_SCAN_NOTIFY_AT = 3


class ShopBarcodeError(ShopStockError):
    """A barcode could not be accepted. ``status`` is the HTTP code to return.

    Mirrors :class:`ShopStockError` so the shop error handlers and the POS's
    ``except ShopStockError`` blocks treat it identically; ``existing``
    describes the first row that already carries a duplicate barcode while
    ``candidates`` lists every one of them, so routes can answer 409 with the
    full set of products the operator has to disambiguate between.
    """

    def __init__(self, message, status=400, code='invalid_barcode',
                 existing=None, candidates=None):
        super().__init__(message, status, code)
        self.existing = existing
        self.candidates = candidates


def _utc_now():
    return datetime.now(timezone.utc)


def _is_digits(value):
    return bool(value) and all('0' <= ch <= '9' for ch in value)


def normalize_barcode(raw):
    """Trim scanner noise from ``raw`` and return it as text, or ``None``.

    Leading zeros are part of the code and always survive; ``\\r``/``\\n``/``\\t``
    are dropped wherever they appear (scanners inject them mid-code), while any
    other control character or a value longer than 64 characters raises. The
    value is never coerced through ``int``/``float``.
    """
    if raw is None:
        return None
    if isinstance(raw, bool):
        raise ShopBarcodeError('Barcode must be a text value')
    if isinstance(raw, int):
        value = str(raw)
    elif isinstance(raw, str):
        value = raw
    else:
        raise ShopBarcodeError('Barcode must be a text value')
    value = value.strip()
    value = ''.join(ch for ch in value if ch not in '\r\n\t')
    if not value:
        return None
    if len(value) > MAX_BARCODE_LENGTH:
        raise ShopBarcodeError(
            f'Barcode may not be longer than {MAX_BARCODE_LENGTH} characters')
    if any(ord(ch) < 32 or ord(ch) == 127 for ch in value):
        raise ShopBarcodeError('Barcode contains characters that cannot be printed')
    return value


def check_digit_ok(value, fmt):
    """True when ``value`` matches ``fmt``'s length and check digit.

    ``EAN_13``/``UPC_A``/``EAN_8`` carry a modulo-10 check digit; ``UPC_E``
    exists both with and without one, so only its digit count is checked.
    Formats without a check digit always pass.
    """
    if fmt in ('EAN_13', 'UPC_A', 'EAN_8'):
        expected_length = {'EAN_13': 13, 'UPC_A': 12, 'EAN_8': 8}[fmt]
        if not _is_digits(value) or len(value) != expected_length:
            return False
        digits = [int(ch) for ch in value]
        if fmt == 'EAN_13':
            weights = [1, 3] * 6
        else:
            weights = [3, 1] * (len(digits) // 2)
        total = sum(d * w for d, w in zip(digits[:-1], weights))
        return (10 - total % 10) % 10 == digits[-1]
    if fmt == 'UPC_E':
        return _is_digits(value) and len(value) in (6, 8)
    return True


def detect_format(value):
    """Best-effort symbology of ``value`` from its shape and checksum.

    Only checksum-valid retail codes earn their format: a 13/12/8-digit string
    whose check digit validates is ``EAN_13``/``UPC_A``/``EAN_8``, a bare 6
    digits is ``UPC_E`` and everything else — internal codes like
    ``AB-000001`` included — is ``UNKNOWN``. Zero-padded retail codes
    (``00012345678905``) are judged on their trailing 13 digits so a scanner
    that pads a UPC still reads as ``EAN_13``. Scanner-reported symbologies
    are passed in explicitly by the routes, never guessed from here.
    """
    if not _is_digits(value):
        return 'UNKNOWN'
    while len(value) > 13 and value.startswith('0'):
        value = value[1:]
    if len(value) == 13 and check_digit_ok(value, 'EAN_13'):
        return 'EAN_13'
    if len(value) == 12 and check_digit_ok(value, 'UPC_A'):
        return 'UPC_A'
    if len(value) == 8 and check_digit_ok(value, 'EAN_8'):
        return 'EAN_8'
    if len(value) == 6:
        return 'UPC_E'
    return 'UNKNOWN'


def validate_barcode(value, fmt=None):
    """Return the normalized barcode, raising :class:`ShopBarcodeError` when
    it cannot be stored.

    Empty, overlong and non-printable values always fail. A checksummed
    ``fmt`` additionally enforces that exact length and check digit; ``None``
    and the generic symbologies accept any printable value so internal shop
    codes are never rejected for not looking like GTINs.
    """
    normalized = normalize_barcode(value)
    if normalized is None:
        raise ShopBarcodeError('A barcode is required')
    if fmt in GTIN_FORMATS:
        if fmt == 'UPC_E':
            if not _is_digits(normalized) or len(normalized) not in (6, 8):
                raise ShopBarcodeError('A UPC_E barcode must be 6 or 8 digits')
        else:
            expected_length = {'EAN_13': 13, 'UPC_A': 12, 'EAN_8': 8}[fmt]
            if not _is_digits(normalized) or len(normalized) != expected_length:
                raise ShopBarcodeError(
                    f'A {fmt} barcode must be {expected_length} digits')
            if not check_digit_ok(normalized, fmt):
                raise ShopBarcodeError(
                    f'The {fmt} check digit does not match the barcode')
    return normalized


def barcode_identity(value, fmt=None, btype=None):
    """``(barcode_format, barcode_type)`` to persist for ``value``.

    A format the caller supplied (from the scanner library) wins; otherwise
    the shape is detected. Retail formats are ``external`` — anything else is
    an ``internal`` shop code — unless the caller states the type.
    """
    if not value:
        return None, btype or 'external'
    resolved = fmt if (fmt and fmt != 'UNKNOWN') else detect_format(value)
    return resolved, btype or ('external' if resolved in GTIN_FORMATS
                               else 'internal')


def barcode_candidates(value, *, exclude_product_id=None, exclude_variant_id=None):
    """Every row that already carries ``value``, products before variants.

    One factory code can legitimately live on several rows — the same printed
    EAN-13 ships in different brands' boxes — so callers get the whole list
    and decide whether that is a mistake (409) or the intended shared barcode
    (proceed with ``allow_shared_barcode``).
    """
    if not value:
        return []
    candidates = []
    product_query = ShopProduct.query.filter(ShopProduct.barcode == value)
    if exclude_product_id:
        product_query = product_query.filter(ShopProduct.id != exclude_product_id)
    for product in product_query.order_by(ShopProduct.id).all():
        candidates.append({'kind': 'product', 'id': product.id,
                           'name': product.name, 'sku': product.sku,
                           'status': product.status,
                           'product_name': product.name,
                           'product_id': product.id})
    variant_query = ShopProductVariant.query.filter(ShopProductVariant.barcode == value)
    if exclude_variant_id:
        variant_query = variant_query.filter(
            ShopProductVariant.id != exclude_variant_id)
    for variant in variant_query.order_by(ShopProductVariant.id).all():
        candidates.append({'kind': 'variant', 'id': variant.id,
                           'name': variant.name, 'sku': variant.sku,
                           'status': 'active' if variant.is_active else 'inactive',
                           'product_name': variant.product.name if variant.product else None,
                           'product_id': variant.product_id})
    return candidates


def barcode_conflict(value, *, exclude_product_id=None, exclude_variant_id=None):
    """The first row that already owns ``value``, or ``None`` when free.

    Uniqueness spans products *and* variants, so a barcode parked on a variant
    blocks the parent product and vice versa. Kept for callers that only need
    "is someone already using this?" — ones that surface the conflict should
    use :func:`barcode_candidates` so the operator sees every owner.
    """
    candidates = barcode_candidates(
        value, exclude_product_id=exclude_product_id,
        exclude_variant_id=exclude_variant_id)
    return candidates[0] if candidates else None


def resolve_all(value):
    """Every ``(product, variant, matched_by)`` pair for a scanned value.

    Barcode matches win over SKUs (as in :func:`resolve`) and come back
    products first, each group ordered by id — a shared code therefore yields
    every owner in a deterministic order, and the caller decides how to
    disambiguate. SKUs are unique per table, so the SKU fallback contributes
    at most one row.
    """
    code = normalize_barcode(value)
    if not code:
        return []
    matches = [(product, None, 'barcode') for product in
               ShopProduct.query.filter_by(barcode=code).order_by(
                   ShopProduct.id).all()]
    if not matches:
        matches = [(variant.product, variant, 'barcode') for variant in
                   ShopProductVariant.query.filter_by(barcode=code).order_by(
                       ShopProductVariant.id).all()]
    if not matches:
        product = ShopProduct.query.filter_by(sku=code).first()
        if product is not None:
            matches = [(product, None, 'sku')]
        else:
            variant = ShopProductVariant.query.filter_by(sku=code).first()
            if variant is not None:
                matches = [(variant.product, variant, 'sku')]
    return matches


def resolve(value):
    """``(product, variant, matched_by)`` for a scanned barcode or SKU.

    The first match :func:`resolve_all` finds — exact string match only, in
    ownership order: product barcode, variant barcode, product SKU, variant
    SKU. Nothing is skipped here — whether an inactive or discontinued item
    may be traded is the caller's decision. Callers that must not silently
    pick between several owners of one shared code use :func:`resolve_all`.
    """
    matches = resolve_all(value)
    return matches[0] if matches else (None, None, None)


def register_barcode(user, *, product, value, fmt=None, btype=None, variant=None,
                     allow_shared=False):
    """Write ``value`` onto ``variant`` (or ``product`` when no variant).

    Raises :class:`ShopBarcodeError` (409 ``duplicate_barcode``) when the code
    is already carried elsewhere:

    * inside the *same* product tree (a variant shadowing its parent, or a
      product taking its own variant's code) — always fatal, sharing there
      buys nothing and breaks the till's variant lookup;
    * on another product — when ``allow_shared`` is false. The error carries
      every owner in ``candidates`` so the caller can offer "create anyway".

    Appends a ``shop_barcode_registered`` / ``shop_barcode_changed`` audit row
    when the value actually moves. Returns the row that was written.
    """
    if product is None:
        raise ShopBarcodeError('Product not found', 404, 'product_not_found')
    if variant is not None and variant.product_id != product.id:
        raise ShopBarcodeError('Variant not found', 404, 'variant_not_found')
    target = variant if variant is not None else product
    normalized = validate_barcode(value, fmt)
    candidates = barcode_candidates(
        normalized,
        exclude_product_id=target.id if variant is None else None,
        exclude_variant_id=target.id if variant is not None else None)
    if candidates:
        own_tree = [c for c in candidates if c['product_id'] == product.id]
        blocking = own_tree or candidates
        if own_tree or not allow_shared:
            raise ShopBarcodeError(
                'This barcode is already assigned to another product.', 409,
                'duplicate_barcode', existing=blocking[0],
                candidates=candidates)
    if (target.barcode or None) == normalized:
        target.barcode_format, target.barcode_type = barcode_identity(
            normalized, fmt or target.barcode_format, btype)
        return target
    action = 'shop_barcode_registered' if not target.barcode else 'shop_barcode_changed'
    previous = {'barcode': target.barcode,
                'barcode_format': target.barcode_format,
                'barcode_type': target.barcode_type}
    target.barcode = normalized
    target.barcode_format, target.barcode_type = barcode_identity(normalized, fmt, btype)
    audit(action,
          'shop_product_variant' if variant is not None else 'shop_product',
          target.id,
          previous_value=previous if action == 'shop_barcode_changed' else None,
          new_value={'barcode': normalized,
                     'barcode_format': target.barcode_format,
                     'barcode_type': target.barcode_type},
          user=user)
    return target


def record_unknown_scan(raw, *, context, branch_id, user_id):
    """Upsert the unknown-scan queue for ``raw`` at this branch and context.

    The first scan opens the row; later scans bump ``times_scanned`` and
    ``last_seen_at`` while keeping the original opener. On the third scan the
    holders of ``shop.products.create`` are warned exactly once.
    """
    value = normalize_barcode(raw)
    if not value:
        raise ShopBarcodeError('A barcode is required')
    if context not in UNKNOWN_CONTEXTS:
        raise ShopBarcodeError(
            f'context must be one of {", ".join(UNKNOWN_CONTEXTS)}', 400,
            'invalid_context')
    if not branch_id or Branch.query.get(branch_id) is None:
        raise ShopBarcodeError('A branch is required for this action', 400,
                               'branch_required')
    row = ShopUnknownBarcode.query.filter_by(
        barcode=value, context=context, branch_id=branch_id).first()
    now = _utc_now()
    if row is None:
        row = ShopUnknownBarcode(
            barcode=value, barcode_format=detect_format(value),
            context=context, branch_id=branch_id, first_seen_by=user_id,
            times_scanned=1, first_seen_at=now, last_seen_at=now)
        db.session.add(row)
    else:
        row.times_scanned = int(row.times_scanned or 0) + 1
        row.last_seen_at = now
    if int(row.times_scanned or 0) >= UNKNOWN_SCAN_NOTIFY_AT and not row.notified:
        row.notified = True
        branch = row.branch or Branch.query.get(branch_id)
        db.session.flush()
        notify_users_with_permission(
            'shop.products.create', 'shop_unknown_barcode',
            f'Unknown barcode {value} scanned {int(row.times_scanned)} times '
            f'({context} at {branch.name if branch else branch_id}) — not yet '
            f'registered in the shop catalogue.',
            severity='warning', related_type='shop_unknown_barcode',
            related_id=row.id)
    db.session.flush()
    return row
