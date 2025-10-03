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
from src.models.course_models import Course, Module, Lesson, Enrollment, Quiz, Question, Answer, Submission, Announcement
from src.models.opportunity_models import Opportunity # Import Opportunity model
from src.models.student_models import (
    LessonCompletion, UserProgress, StudentNote, Badge, UserBadge,
    Assignment, AssignmentSubmission, StudentBookmark, StudentForum, ForumPost
) # Import student models
from src.utils.email_utils import mail # Import the mail instance

from src.routes.user_routes import auth_bp, user_bp, token_in_blocklist_loader
from src.routes.course_routes import course_bp, module_bp, lesson_bp, enrollment_bp, quiz_bp, submission_bp, announcement_bp
from src.routes.opportunity_routes import opportunity_bp # Import opportunity blueprint
from src.routes.student_routes import student_bp # Import student blueprint
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
    CORS(app, resources={r"/*": {"origins": allowed_origins}}, supports_credentials=True)
    logger.info(f"CORS configured for production with origins: {allowed_origins}")
else:
    # In development, allow all origins with full configuration
    CORS(app, 
         origins=["http://localhost:3000", "http://localhost:3001", "http://localhost:3002", "http://localhost:3005", "http://localhost:5173", "http://192.168.133.116:3000", "http://192.168.133.116:3001", "http://192.168.133.116:3002", "http://192.168.133.116:3005"], 
         methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
         allow_headers=["Content-Type", "Authorization", "X-Requested-With"],
         expose_headers=["Content-Type", "Authorization"],
         supports_credentials=True)
    logger.info("CORS configured for development with specific settings")

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
    app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL')
    if not app.config['SQLALCHEMY_DATABASE_URI']:
        raise ValueError("DATABASE_URL must be set in production environment")
    logger.info("Using PostgreSQL database in production")
else:
    # Use SQLite for development and testing
    app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv("SQLALCHEMY_DATABASE_URI", "sqlite:///instance/afritec_lms_db.db")
    logger.info(f"Using SQLite database at {app.config['SQLALCHEMY_DATABASE_URI']}")

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
app.register_blueprint(student_bp) # Register student blueprint

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

