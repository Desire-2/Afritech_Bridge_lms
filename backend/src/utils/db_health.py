"""
Database Health and Connection Pool Monitoring Utilities
"""

import logging
from sqlalchemy import text
from flask import current_app

logger = logging.getLogger(__name__)

def get_pool_status(db):
    """
    Get current database connection pool status
    Returns dict with pool statistics
    """
    try:
        engine = db.engine
        pool = engine.pool
        
        status = {
            'pool_size': pool.size(),
            'checked_in_connections': pool.checkedin(),
            'checked_out_connections': pool.checkedout(),
            'overflow': pool.overflow(),
            'total_connections': pool.size() + pool.overflow(),
            'max_overflow': engine.pool._max_overflow,
            'pool_timeout': engine.pool._timeout,
        }
        
        logger.info(f"Pool Status: {status}")
        return status
    except Exception as e:
        logger.error(f"Error getting pool status: {e}")
        return {"error": str(e)}


def force_pool_cleanup(db):
    """
    Force cleanup of database connection pool
    Use with caution - only in emergency situations
    """
    try:
        # Remove all sessions
        db.session.remove()
        
        # Dispose of all connections in the pool
        db.engine.dispose()
        
        logger.warning("EMERGENCY: Forced connection pool cleanup executed")
        return {"message": "Connection pool cleaned up successfully"}
    except Exception as e:
        logger.error(f"Error during pool cleanup: {e}")
        return {"error": str(e)}


def check_database_health(db):
    """
    Check database health by executing a simple query
    Returns True if healthy, False otherwise
    """
    try:
        # Execute a simple query to test connection
        db.session.execute(text("SELECT 1"))
        return True
    except Exception as e:
        logger.error(f"Database health check failed: {e}")
        return False
    finally:
        # Always clean up after health check
        try:
            db.session.remove()
        except:
            pass


def get_active_connections_count(db):
    """
    Get count of active database connections (PostgreSQL specific)
    """
    try:
        result = db.session.execute(
            text("SELECT count(*) FROM pg_stat_activity WHERE datname = current_database()")
        )
        count = result.scalar()
        db.session.remove()  # Clean up immediately
        return count
    except Exception as e:
        logger.error(f"Error getting active connections: {e}")
        return None
    finally:
        try:
            db.session.remove()
        except:
            pass
