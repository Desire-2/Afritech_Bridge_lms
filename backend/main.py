# Main application file for Afritec Bridge LMS
import os
import sys
# DON'T CHANGE THIS !!!
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from flask import Flask, send_from_directory, jsonify
from flask_jwt_extended import JWTManager
from datetime import timedelta
import logging

from src.models.user_models import db, User, Role
from src.models.course_models import (
    Course, Module, Lesson, Enrollment, Quiz, Question, Answer, Submission, Announcement,
    Assignment, AssignmentSubmission, Project, ProjectSubmission
)
from src.models.opportunity_models import Opportunity # Import Opportunity model
from src.models.achievement_models import (
    Achievement, UserAchievement, LearningStreak, StudentPoints, 
    Milestone, UserMilestone, Leaderboard, QuestChallenge, UserQuestProgress
) # Import achievement models
from src.utils.email_utils import mail # Import the mail instance

from src.routes.user_routes import auth_bp, user_bp, token_in_blocklist_loader
from src.routes.course_routes import course_bp, module_bp, lesson_bp, enrollment_bp, quiz_bp, submission_bp, announcement_bp
from src.routes.opportunity_routes import opportunity_bp # Import opportunity blueprint
from src.routes.instructor_routes import instructor_bp # Import instructor blueprint
from src.routes.course_creation_routes import course_creation_bp # Import course creation blueprint
from src.routes.instructor_assessment_routes import instructor_assessment_bp # Import instructor assessment blueprint (consolidated - replaced old assessment_bp)
from src.routes.dashboard_routes import dashboard_bp # Import dashboard blueprint
from src.routes.student_routes import student_bp # Import student blueprint
from src.routes.learning_routes import learning_bp # Import learning blueprint 
from src.routes.content_assignment_routes import content_assignment_bp # Import content assignment blueprint
from src.routes.achievement_routes import achievement_bp # Import achievement blueprint
from src.routes.grading_routes import grading_bp # Import grading blueprint
from src.routes.progress_routes import progress_bp # Import progress blueprint
from src.routes.certificate_routes import certificate_bp # Import certificate blueprint
from src.routes.forum_routes import forum_bp # Import forum blueprint
from dotenv import load_dotenv
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
    # In development, allow all origins with full configuration
    CORS(app, 
         resources={r"/*": {
             "origins": ["http://localhost:3000", "http://localhost:3001", "http://localhost:3002", 
                        "http://localhost:3005", "http://localhost:5173", 
                        "http://192.168.0.5:3000", "http://192.168.0.5:3001", 
                        "http://192.168.0.5:3002", "http://192.168.0.5:3005",
                        "http://192.168.0.3:3000", "http://192.168.0.3:3001",
                        "http://192.168.116.116:3000", "http://192.168.116.116:3001", 
                        "http://192.168.116.116:3002", "http://192.168.116.116:3005"],
             "methods": ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
             "allow_headers": ["Content-Type", "Authorization", "X-Requested-With", "Accept", "Origin"],
             "expose_headers": ["Content-Type", "Authorization"],
             "supports_credentials": True,
             "max_age": 3600
         }})
    logger.info("CORS configured for development with specific settings")

# Disable strict trailing slash enforcement to prevent redirects during CORS preflight
app.url_map.strict_slashes = False

# Load environment variables
load_dotenv()

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
if env == 'production':
    # Use PostgreSQL in production (required for Render)
    database_url = os.getenv('DATABASE_URL')
    if not database_url:
        raise ValueError("DATABASE_URL must be set in production environment")
    
    # Fix for SQLAlchemy 2.0+ - ensure proper dialect specification
    original_url = database_url
    if database_url.startswith('postgres://'):
        database_url = database_url.replace('postgres://', 'postgresql+psycopg2://', 1)
        logger.info(f"Transformed database URL from postgres:// to postgresql+psycopg2://")
    elif database_url.startswith('postgresql://') and '+psycopg2' not in database_url:
        database_url = database_url.replace('postgresql://', 'postgresql+psycopg2://', 1)
        logger.info(f"Transformed database URL from postgresql:// to postgresql+psycopg2://")
    else:
        logger.info("Database URL already has correct format for SQLAlchemy 2.0+")
    
    app.config['SQLALCHEMY_DATABASE_URI'] = database_url
    logger.info("Using PostgreSQL database in production")
else:
    # Use SQLite for development and testing (or PostgreSQL if configured)
    # Ensure we use an absolute path for the SQLite database
    db_path = os.path.join(os.path.dirname(__file__), 'instance', 'afritec_lms_db.db')
    db_uri = f"sqlite:///{db_path}"
    database_url = os.getenv("SQLALCHEMY_DATABASE_URI", db_uri)
    
    # Fix for SQLAlchemy 2.0+ in development too
    if database_url.startswith('postgres://'):
        database_url = database_url.replace('postgres://', 'postgresql+psycopg2://', 1)
        logger.info(f"Transformed development database URL from postgres:// to postgresql+psycopg2://")
    elif database_url.startswith('postgresql://') and '+psycopg2' not in database_url:
        database_url = database_url.replace('postgresql://', 'postgresql+psycopg2://', 1)
        logger.info(f"Transformed development database URL from postgresql:// to postgresql+psycopg2://")
    
    app.config['SQLALCHEMY_DATABASE_URI'] = database_url
    
    if database_url.startswith('sqlite'):
        logger.info(f"Using SQLite database at {app.config['SQLALCHEMY_DATABASE_URI']}")
        logger.info(f"Database file path: {db_path}")
    else:
        logger.info(f"Using PostgreSQL database in development")
    
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

# JWT Configuration
app.config['JWT_SECRET_KEY'] = os.getenv('JWT_SECRET_KEY')
if not app.config['JWT_SECRET_KEY']:
    logger.warning("JWT_SECRET_KEY not set in environment! Using fallback (not secure for production)")
    app.config['JWT_SECRET_KEY'] = 'another_super_secret_jwt_key' if env != 'production' else None
    if env == 'production' and not app.config['JWT_SECRET_KEY']:
        raise ValueError("JWT_SECRET_KEY must be set in production environment")
        
# Email configuration
app.config['MAIL_SERVER'] = os.getenv('MAIL_SERVER', 'smtp.gmail.com')
app.config['MAIL_PORT'] = int(os.getenv('MAIL_PORT', 587))
app.config['MAIL_USE_TLS'] = os.getenv('MAIL_USE_TLS', 'True').lower() in ('true', 'yes', '1')
app.config['MAIL_USE_SSL'] = os.getenv('MAIL_USE_SSL', 'False').lower() in ('true', 'yes', '1')
app.config['MAIL_USERNAME'] = os.getenv('MAIL_USERNAME')
app.config['MAIL_PASSWORD'] = os.getenv('MAIL_PASSWORD')
app.config['MAIL_DEFAULT_SENDER'] = os.getenv('MAIL_DEFAULT_SENDER', 'noreply@afritecbridge.online')

if not app.config['MAIL_USERNAME'] or not app.config['MAIL_PASSWORD']:
    logger.warning("Email credentials not set! Email functionality will not work properly.")

app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(hours=int(os.getenv('JWT_ACCESS_TOKEN_EXPIRES_HOURS', 1)))
app.config['JWT_REFRESH_TOKEN_EXPIRES'] = timedelta(days=int(os.getenv('JWT_REFRESH_TOKEN_EXPIRES_DAYS', 30)))
app.config["JWT_TOKEN_LOCATION"] = ["headers"]
app.config["JWT_BLOCKLIST_ENABLED"] = True
app.config["JWT_BLOCKLIST_TOKEN_CHECKS"] = ["access", "refresh"]

# Initialize extensions
db.init_app(app)
jwt = JWTManager(app)
mail.init_app(app)

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
app.register_blueprint(learning_bp) # Register learning blueprint
app.register_blueprint(content_assignment_bp) # Register content assignment blueprint
app.register_blueprint(achievement_bp) # Register achievement blueprint
app.register_blueprint(grading_bp) # Register grading blueprint
app.register_blueprint(progress_bp) # Register progress blueprint
app.register_blueprint(certificate_bp) # Register certificate blueprint
app.register_blueprint(forum_bp) # Register forum blueprint

with app.app_context():
    db.create_all()
    if not Role.query.filter_by(name='student').first():
        db.session.add(Role(name='student'))
    if not Role.query.filter_by(name='instructor').first():
        db.session.add(Role(name='instructor'))
    if not Role.query.filter_by(name='admin').first():
        db.session.add(Role(name='admin'))
    db.session.commit()

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

if __name__ == '__main__':
    # In development, run with debug mode
    port = int(os.environ.get('PORT', 5000))
    debug_mode = os.environ.get('FLASK_ENV') != 'production'
    app.run(host='0.0.0.0', port=port, debug=debug_mode)

