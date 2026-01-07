"""
Database utility functions for connection management and optimization
"""
import logging
from flask import current_app
from contextlib import contextmanager
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from ..models import db

logger = logging.getLogger(__name__)

@contextmanager
def safe_db_session():
    """
    Context manager for safe database operations with proper cleanup
    """
    try:
        yield db.session
        db.session.commit()
    except SQLAlchemyError as e:
        logger.error(f"Database error occurred: {e}")
        db.session.rollback()
        raise
    except Exception as e:
        logger.error(f"Unexpected error during database operation: {e}")
        db.session.rollback()
        raise
    finally:
        # Ensure session is closed to release connection back to pool
        db.session.close()

def check_db_health():
    """
    Check database health and connection status
    """
    try:
        # Simple query to test connection
        result = db.session.execute(text('SELECT 1')).scalar()
        db.session.commit()
        return True, "Database connection healthy"
    except Exception as e:
        logger.error(f"Database health check failed: {e}")
        db.session.rollback()
        return False, str(e)
    finally:
        db.session.close()

def get_pool_status():
    """
    Get current connection pool status for monitoring
    """
    try:
        engine = db.engine
        pool = engine.pool
        
        status = {
            'pool_size': pool.size(),
            'checked_in': pool.checkedin(),
            'checked_out': pool.checkedout(),
            'overflow': pool.overflow(),
            'invalid': pool.invalid()
        }
        
        logger.info(f"Pool status: {status}")
        return status
    except Exception as e:
        logger.error(f"Failed to get pool status: {e}")
        return None

def force_close_connections():
    """
    Force close all database connections - use only in emergencies
    """
    try:
        db.session.remove()
        db.engine.dispose()
        logger.info("Forced closure of all database connections")
    except Exception as e:
        logger.error(f"Failed to force close connections: {e}")

def optimize_query_for_pool(query_func):
    """
    Decorator to optimize queries for connection pool efficiency
    """
    def wrapper(*args, **kwargs):
        try:
            # Execute the query function
            result = query_func(*args, **kwargs)
            
            # Explicitly commit and close session
            db.session.commit()
            return result
        except SQLAlchemyError as e:
            logger.error(f"Query optimization wrapper caught SQL error: {e}")
            db.session.rollback()
            raise
        except Exception as e:
            logger.error(f"Query optimization wrapper caught unexpected error: {e}")
            db.session.rollback()
            raise
        finally:
            # Always close session to release connection
            db.session.close()
    
    return wrapper

class DatabaseManager:
    """
    Manager class for database operations with connection pooling optimization
    """
    
    @staticmethod
    def execute_with_retry(operation, max_retries=3):
        """
        Execute database operation with retry logic for connection timeouts
        """
        for attempt in range(max_retries):
            try:
                result = operation()
                db.session.commit()
                return result
            except SQLAlchemyError as e:
                logger.warning(f"Database operation failed (attempt {attempt + 1}): {e}")
                db.session.rollback()
                
                if attempt == max_retries - 1:
                    logger.error(f"Database operation failed after {max_retries} attempts")
                    raise
                
                # Wait a bit before retry
                import time
                time.sleep(0.5 * (attempt + 1))
            finally:
                db.session.close()
    
    @staticmethod
    def bulk_insert(model_class, data_list, chunk_size=100):
        """
        Efficiently bulk insert data with connection management
        """
        try:
            total_inserted = 0
            
            for i in range(0, len(data_list), chunk_size):
                chunk = data_list[i:i + chunk_size]
                
                # Create objects
                objects = [model_class(**data) for data in chunk]
                
                # Add to session
                db.session.bulk_save_objects(objects)
                db.session.commit()
                
                total_inserted += len(chunk)
                logger.info(f"Bulk inserted {len(chunk)} records ({total_inserted}/{len(data_list)} total)")
                
                # Close session to release connection
                db.session.close()
            
            return total_inserted
            
        except Exception as e:
            logger.error(f"Bulk insert failed: {e}")
            db.session.rollback()
            raise
        finally:
            db.session.close()