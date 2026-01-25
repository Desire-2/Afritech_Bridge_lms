# Main application file for Afritec Bridge LMS
import os
import sys
# DON'T CHANGE THIS !!!
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

# Load environment variables FIRST before any other imports
from dotenv import load_dotenv
load_dotenv()

from flask import Flask, send_from_directory, jsonify, request
from flask_jwt_extended import JWTManager
from datetime import timedelta
import logging

from src.models.user_models import db, User, Role
from src.models.course_models import (
    Course, Module, Lesson, Enrollment, Quiz, Question, Answer, Submission, Announcement,
    Assignment, AssignmentSubmission, Project, ProjectSubmission
)
from src.models.quiz_progress_models import QuizAttempt, UserAnswer # Import quiz progress models
from src.models.student_models import LessonCompletion, UserProgress, ModuleProgress, Certificate # Import student tracking models
from src.models.opportunity_models import Opportunity # Import Opportunity model
from src.models.achievement_models import (
    Achievement, UserAchievement, LearningStreak, StudentPoints, 
    Milestone, UserMilestone, Leaderboard, QuestChallenge, UserQuestProgress
) # Import achievement models
from src.utils.email_utils import mail # Import the mail instance (legacy wrapper)
from src.utils.brevo_email_service import brevo_service # Import Brevo service

from src.routes.user_routes import auth_bp, user_bp, token_in_blocklist_loader
from src.routes.course_routes import course_bp, module_bp, lesson_bp, enrollment_bp, quiz_bp, submission_bp, announcement_bp
from src.routes.student_profile_routes import profile_bp  # Import profile blueprint
from src.routes.student_support_routes import support_bp  # Import student support blueprint
from src.routes.opportunity_routes import opportunity_bp # Import opportunity blueprint
from src.routes.application_routes import application_bp
from src.routes.instructor_routes import instructor_bp # Import instructor blueprint
from src.routes.course_creation_routes import course_creation_bp # Import course creation blueprint
from src.routes.instructor_assessment_routes import instructor_assessment_bp # Import instructor assessment blueprint (consolidated - replaced old assessment_bp)
from src.routes.dashboard_routes import dashboard_bp # Import dashboard blueprint
from src.routes.student_routes import student_bp # Import student blueprint
from src.routes.learning_routes import learning_bp # Import learning blueprint 
from src.routes.content_assignment_routes import content_assignment_bp # Import content assignment blueprint
from src.routes.achievement_routes import achievement_bp # Import achievement blueprint
from src.routes.grading_routes import grading_bp # Import grading blueprint
from src.routes.modification_routes import modification_bp # Import modification request blueprint
from src.routes.progress_routes import progress_bp # Import progress blueprint
from src.routes.certificate_routes import certificate_bp # Import certificate blueprint
from src.routes.forum_routes import forum_bp # Import forum blueprint
from src.routes.ai_agent_routes import ai_agent_bp # Import AI agent blueprint
from src.routes.admin_routes import admin_bp # Import admin blueprint
from src.routes.file_upload_routes import file_upload_bp # Import file upload blueprint
from src.utils.db_health import get_pool_status, force_pool_cleanup, check_database_health  # Import DB health utilities
from src.services.background_service import background_service # Import background service for initialization
from flask_cors import CORS

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler()]
)
logger = logging.getLogger(__name__)

# Create Flask app
app = Flask(__name__, static_folder=os.path.join(os.path.dirname(__file__), 'static'))

# Configure CORS for development and production
if os.environ.get('FLASK_ENV') == 'production':
    # In production, only allow specific origins
    allowed_origins = os.environ.get('ALLOWED_ORIGINS', 'https://yourfrontenddomain.com').split(',')
    CORS(app, 
         resources={r"/*": {
             "origins": allowed_origins,
             "methods": ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
             "allow_headers": ["Content-Type", "Authorization", "X-Requested-With"],
             "expose_headers": ["Content-Type", "Authorization"],
             "supports_credentials": True,
             "max_age": 3600
         }})
    logger.info(f"CORS configured for production with origins: {allowed_origins}")
else:
    # In development, allow configurable origins with sensible defaults
    dev_allowed_origins = os.environ.get('DEV_ALLOWED_ORIGINS')
    if dev_allowed_origins:
        dev_allowed_origins = [origin.strip() for origin in dev_allowed_origins.split(',') if origin.strip()]
    else:
        dev_allowed_origins = [
            "http://localhost:3000", "http://localhost:3001", "http://localhost:3002",
            "http://localhost:3005", "http://localhost:5173",
            "http://192.168.0.4:3000", "http://192.168.0.4:3001",
            "http://192.168.0.4:3002", "http://192.168.0.4:3005",
            "http://192.168.0.3:3000", "http://192.168.0.3:3001",
            "http://192.168.116.116:3000", "http://192.168.116.116:3001",
            "http://192.168.116.116:3002", "http://192.168.116.116:3005",
            "http://192.168.0.4:5001", "http://localhost:5001",
            "http://localhost:51164", "http://192.168.0.5:3000", "http://192.168.0.5:3001"
        ]

    CORS(app,
         resources={r"/*": {
             "origins": dev_allowed_origins,
             "methods": ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
             "allow_headers": ["Content-Type", "Authorization", "X-Requested-With", "Accept", "Origin"],
             "expose_headers": ["Content-Type", "Authorization"],
             "supports_credentials": True,
             "max_age": 3600
         }})
    logger.info(f"CORS configured for development with origins: {dev_allowed_origins}")

# Disable strict trailing slash enforcement to prevent redirects during CORS preflight
app.url_map.strict_slashes = False

# Environment variables already loaded at top of file

# Determine environment
env = os.environ.get('FLASK_ENV', 'development')
logger.info(f"Starting application in {env} environment")

# Configuration
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY')
if not app.config['SECRET_KEY']:
    logger.warning("SECRET_KEY not set in environment! Using fallback (not secure for production)")
    app.config['SECRET_KEY'] = 'a_very_secret_key_that_should_be_in_env' if env != 'production' else None
    if env == 'production' and not app.config['SECRET_KEY']:
        raise ValueError("SECRET_KEY must be set in production environment")

# Database configuration
# Priority: DATABASE_URL from .env (if set) > environment-specific defaults
database_url = os.getenv('DATABASE_URL')

if database_url:
    # DATABASE_URL is explicitly set in .env - use it regardless of environment
    logger.info("Using DATABASE_URL from environment configuration")
    
    # Fix for SQLAlchemy 2.0+ - ensure proper dialect specification
    if database_url.startswith('postgres://'):
        database_url = database_url.replace('postgres://', 'postgresql+psycopg2://', 1)
        logger.info("Transformed database URL from postgres:// to postgresql+psycopg2://")
    elif database_url.startswith('postgresql://') and '+psycopg2' not in database_url:
        database_url = database_url.replace('postgresql://', 'postgresql+psycopg2://', 1)
        logger.info("Transformed database URL from postgresql:// to postgresql+psycopg2://")
    
    app.config['SQLALCHEMY_DATABASE_URI'] = database_url
    
    if 'postgresql' in database_url or 'postgres' in database_url:
        logger.info(f"Using PostgreSQL database (env: {env})")
    else:
        logger.info(f"Using custom database configuration (env: {env})")
        
elif env == 'production':
    # Production requires DATABASE_URL to be set
    raise ValueError("DATABASE_URL must be set in production environment")
    
else:
    # Development fallback: Use SQLite if DATABASE_URL not set
    db_path = os.path.join(os.path.dirname(__file__), 'instance', 'afritec_lms_db.db')
    database_url = f"sqlite:///{db_path}"
    app.config['SQLALCHEMY_DATABASE_URI'] = database_url
    logger.info(f"Using SQLite database at {database_url}")
    logger.info(f"Database file path: {db_path}")
    
    # Ensure the instance directory exists
    instance_dir = os.path.dirname(db_path)
    if not os.path.exists(instance_dir):
        os.makedirs(instance_dir)
        logger.info(f"Created instance directory: {instance_dir}")
    
    # Check if database file exists
    if os.path.exists(db_path):
        logger.info(f"Database file exists and is accessible: {os.access(db_path, os.R_OK | os.W_OK)}")

    else:
        logger.info("Database file does not exist, will be created")

app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# SQLAlchemy Engine Options for better connection handling
# Detect database type to apply appropriate configuration
is_postgresql = app.config['SQLALCHEMY_DATABASE_URI'].startswith('postgresql')

if is_postgresql:
    # Optimized for PostgreSQL with better connection handling
    app.config['SQLALCHEMY_ENGINE_OPTIONS'] = {
        'pool_pre_ping': True,  # Test connections before using them
        'pool_recycle': 300,  # Recycle connections after 5 minutes
        'pool_size': 5,  # Increased base connections
        'max_overflow': 10,  # Increased overflow connections (total max = 15)
        'pool_timeout': 30,  # 30 second timeout for high-traffic periods
        'pool_reset_on_return': 'rollback',  # Always rollback on return to prevent locks
        'echo_pool': False,  # Disable pool logging in production
        'connect_args': {
            'connect_timeout': 30,  # 30 second connection timeout (PostgreSQL specific)
            'options': '-c statement_timeout=30000'  # 30 second query timeout
        }
    }
    logger.info("SQLAlchemy configured for PostgreSQL (pool_size=5, max_overflow=10, TOTAL=15)")
else:
    # SQLite configuration - simpler pool settings
    app.config['SQLALCHEMY_ENGINE_OPTIONS'] = {
        'pool_pre_ping': True,  # Test connections before using them
        'pool_size': 5,  # SQLite can handle more local connections
        'max_overflow': 10,  # More overflow for development
        'pool_timeout': 30,  # 30 second timeout
        'pool_reset_on_return': 'rollback',
    }
    logger.info("SQLAlchemy configured for SQLite development (pool_size=5, max_overflow=10)")

# JWT Configuration
app.config['JWT_SECRET_KEY'] = os.getenv('JWT_SECRET_KEY')
if not app.config['JWT_SECRET_KEY']:
    logger.warning("JWT_SECRET_KEY not set in environment! Using fallback (not secure for production)")
    app.config['JWT_SECRET_KEY'] = 'another_super_secret_jwt_key' if env != 'production' else None
    if env == 'production' and not app.config['JWT_SECRET_KEY']:
        raise ValueError("JWT_SECRET_KEY must be set in production environment")
        
# Enhanced Email configuration for Brevo API
# Brevo API Key (preferred method)
app.config['BREVO_API_KEY'] = os.getenv('BREVO_API_KEY')
app.config['MAIL_SENDER_NAME'] = os.getenv('MAIL_SENDER_NAME', 'Afritec Bridge LMS')

# Legacy email configuration (fallback for SMTP)
app.config['MAIL_SERVER'] = os.getenv('MAIL_SERVER', 'smtp.gmail.com')
app.config['MAIL_PORT'] = int(os.getenv('MAIL_PORT', 587))
app.config['MAIL_USE_TLS'] = os.getenv('MAIL_USE_TLS', 'True').lower() in ('true', 'yes', '1')
app.config['MAIL_USE_SSL'] = os.getenv('MAIL_USE_SSL', 'False').lower() in ('true', 'yes', '1')
app.config['MAIL_USERNAME'] = os.getenv('MAIL_USERNAME')
app.config['MAIL_PASSWORD'] = os.getenv('MAIL_PASSWORD')
app.config['MAIL_DEFAULT_SENDER'] = os.getenv('MAIL_DEFAULT_SENDER', 'noreply@afritecbridge.online')

# Frontend URL for email links
app.config['FRONTEND_URL'] = os.getenv('FRONTEND_URL', 'http://localhost:3000')

# Admin email for notifications
app.config['ADMIN_EMAIL'] = os.getenv('ADMIN_EMAIL')

# Check email service configuration
if app.config.get('BREVO_API_KEY'):
    logger.info("🚀 Brevo API key found - enhanced email service will be used")
elif not app.config['MAIL_USERNAME'] or not app.config['MAIL_PASSWORD']:
    logger.warning("⚠️ No email configuration found (Brevo API key or SMTP credentials)")
    logger.warning("📧 Email sending will be disabled - check your .env file")
    logger.warning("   Add BREVO_API_KEY for best performance, or MAIL_USERNAME/MAIL_PASSWORD for SMTP fallback")
else:
    logger.info("📧 SMTP email configuration found - legacy mode enabled")

app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(hours=int(os.getenv('JWT_ACCESS_TOKEN_EXPIRES_HOURS', 1)))
app.config['JWT_REFRESH_TOKEN_EXPIRES'] = timedelta(days=int(os.getenv('JWT_REFRESH_TOKEN_EXPIRES_DAYS', 30)))
app.config["JWT_TOKEN_LOCATION"] = ["headers"]
app.config["JWT_BLOCKLIST_ENABLED"] = True
app.config["JWT_BLOCKLIST_TOKEN_CHECKS"] = ["access", "refresh"]

# Initialize extensions
db.init_app(app)
jwt = JWTManager(app)

# Initialize enhanced email service (Brevo + legacy compatibility)
mail.init_app(app)
brevo_service.init_app(app)

@jwt.user_identity_loader
def user_identity_loader(user_id):
    return user_id

@jwt.user_lookup_loader
def user_lookup_callback(_jwt_header, jwt_data):
    identity = jwt_data["sub"]
    return User.query.filter_by(id=identity).one_or_none()

@jwt.token_in_blocklist_loader
def check_if_token_in_blocklist(jwt_header, jwt_payload):
    return token_in_blocklist_loader(jwt_header, jwt_payload)

# Register Blueprints
app.register_blueprint(auth_bp)
app.register_blueprint(user_bp)
app.register_blueprint(course_bp)
app.register_blueprint(module_bp)
app.register_blueprint(lesson_bp)
app.register_blueprint(enrollment_bp)
app.register_blueprint(quiz_bp)
app.register_blueprint(submission_bp)
app.register_blueprint(announcement_bp)
app.register_blueprint(opportunity_bp) # Register opportunity blueprint
app.register_blueprint(instructor_bp) # Register instructor blueprint
app.register_blueprint(course_creation_bp) # Register course creation blueprint
app.register_blueprint(instructor_assessment_bp) # Register instructor assessment blueprint (consolidated endpoint - OLD assessment_bp removed)
app.register_blueprint(dashboard_bp) # Register dashboard blueprint
app.register_blueprint(student_bp) # Register student blueprint
app.register_blueprint(profile_bp) # Register student profile blueprint
app.register_blueprint(support_bp, url_prefix='/api/v1/student/support') # Register student support blueprint
app.register_blueprint(learning_bp) # Register learning blueprint
app.register_blueprint(content_assignment_bp) # Register content assignment blueprint
app.register_blueprint(achievement_bp) # Register achievement blueprint
app.register_blueprint(grading_bp) # Register grading blueprint
app.register_blueprint(modification_bp, url_prefix='/api/v1/modification') # Register modification request blueprint
app.register_blueprint(progress_bp) # Register progress blueprint
app.register_blueprint(certificate_bp) # Register certificate blueprint
app.register_blueprint(forum_bp) # Register forum blueprint
app.register_blueprint(ai_agent_bp) # Register AI agent blueprint
app.register_blueprint(application_bp) # Register application blueprint
app.register_blueprint(admin_bp) # Register admin blueprint
app.register_blueprint(file_upload_bp) # Register file upload blueprint

with app.app_context():
    db.create_all()
    if not Role.query.filter_by(name='student').first():
        db.session.add(Role(name='student'))
    if not Role.query.filter_by(name='instructor').first():
        db.session.add(Role(name='instructor'))
    if not Role.query.filter_by(name='admin').first():
        db.session.add(Role(name='admin'))
    db.session.commit()

# Request lifecycle hooks for connection management
@app.teardown_appcontext
def shutdown_session(exception=None):
    """
    Ensure database sessions are properly closed after each request
    This prevents connection leaks and pool exhaustion
    """
    db.session.remove()

@app.after_request
def after_request(response):
    """
    Cleanup after each request to prevent connection leaks
    CRITICAL: Always remove session to return connection to pool
    """
    try:
        # Only commit if response is successful (2xx status)
        if 200 <= response.status_code < 300:
            db.session.commit()
        else:
            # Rollback on error to prevent partial commits
            db.session.rollback()
    except Exception as e:
        logger.error(f"Error in after_request commit: {e}")
        db.session.rollback()
    finally:
        # CRITICAL: Remove session to return connection to pool
        db.session.remove()
    return response

@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve(path):
    static_folder_path = app.static_folder
    if static_folder_path is None:
        return jsonify({"error": "Static folder not configured"}), 404

    if path != "" and os.path.exists(os.path.join(static_folder_path, path)):
        return send_from_directory(static_folder_path, path)
    else:
        index_path = os.path.join(static_folder_path, 'index.html')
        if os.path.exists(index_path):
            return send_from_directory(static_folder_path, 'index.html')
        else:
            if path == "":
                return jsonify({"message": "Welcome to Afritec Bridge LMS API"}), 200
            return jsonify({"error": "File not found"}), 404


# =====================
# DATABASE HEALTH MONITORING ENDPOINTS
# =====================

@app.route('/api/v1/health/db', methods=['GET'])
def health_check():
    """Database health check endpoint"""
    try:
        is_healthy = check_database_health(db)
        pool_status = get_pool_status(db)
        
        return jsonify({
            "status": "healthy" if is_healthy else "unhealthy",
            "database": "connected" if is_healthy else "disconnected",
            "pool": pool_status,
            "timestamp": os.environ.get('RENDER_GIT_COMMIT', 'development')
        }), 200 if is_healthy else 503
    except Exception as e:
        return jsonify({
            "status": "error",
            "error": str(e)
        }), 500


@app.route('/api/v1/health/db/pool-status', methods=['GET'])
def pool_status_endpoint():
    """Get detailed connection pool status"""
    try:
        pool_status = get_pool_status(db)
        return jsonify(pool_status), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/v1/health/db/force-cleanup', methods=['POST'])
def force_cleanup_endpoint():
    """
    EMERGENCY ONLY: Force cleanup of connection pool
    Use when pool is exhausted and needs reset
    """
    try:
        # Simple authentication check (in production, use proper auth)
        auth_key = request.headers.get('X-Admin-Key')
        expected_key = os.environ.get('ADMIN_KEY', 'dev-admin-key')
        
        if auth_key != expected_key:
            return jsonify({"error": "Unauthorized"}), 401
        
        result = force_pool_cleanup(db)
        return jsonify(result), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    # In development, run with debug mode
    port = int(os.environ.get('PORT', 5000))
    debug_mode = os.environ.get('FLASK_ENV') != 'production'
    
    # Allow disabling auto-reload for testing AI generation
    use_reloader = debug_mode and os.environ.get('DISABLE_RELOADER') != 'true'
    
    app.run(
        host='0.0.0.0', 
        port=port, 
        debug=debug_mode,
        use_reloader=use_reloader
    )

