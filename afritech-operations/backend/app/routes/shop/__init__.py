"""Electronics shop route package.

Each resource owns a blueprint; :func:`register_shop_routes` wires them into
the app together with the shared ``ShopStockError`` handler.
"""
from . import (
    catalog, inventory, purchasing, sales, customers, returns, warranty,
    shifts, promotions, settings, reports, barcodes,
)

SHOP_BLUEPRINTS = [
    catalog.bp, inventory.bp, purchasing.bp, sales.bp, customers.bp,
    returns.bp, warranty.bp, shifts.bp, promotions.bp, settings.bp,
    reports.bp, barcodes.bp,
]


def register_shop_routes(app):
    for blueprint in SHOP_BLUEPRINTS:
        app.register_blueprint(blueprint)

    from ...services.shop_inventory import ShopStockError

    @app.errorhandler(ShopStockError)
    def handle_shop_stock_error(error):
        """Stock conflicts answer with 409 and no partial writes — the request
        handler returns rather than raises, so ``after_request`` rolls back."""
        return {'error': error.message, 'code': error.code}, error.status
