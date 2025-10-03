# Gunicorn configuration file for Afritec Bridge LMS backend
import os

# Server socket
port = os.environ.get('PORT', '5000')
bind = f"0.0.0.0:{port}"  # Render will supply the PORT environment variable

# Debug logging for port configuration
print(f"Starting Gunicorn server for Afritec Bridge LMS")
print(f"PORT environment variable: {os.environ.get('PORT', 'NOT_SET')}")
print(f"Using port: {port}")
print(f"Binding to: {bind}")

# Additional port debugging for Render
if 'PORT' in os.environ:
    print(f"✅ Render PORT detected: {os.environ['PORT']}")
    actual_port = os.environ['PORT']
    bind = f"0.0.0.0:{actual_port}"
    print(f"✅ Updated bind address: {bind}")
else:
    print("⚠️ No PORT environment variable found, using default 5000")

workers = 2  # Reduced for memory efficiency on Render's free tier
worker_class = "sync" 
worker_connections = 500  # Reduced to prevent memory issues
timeout = 120  # Increased timeout for slower operations like email sending
keepalive = 5  # Increased keepalive
max_requests = 1000  # Restart workers after 1000 requests to prevent memory leaks
max_requests_jitter = 100  # Add some randomness to worker restarts
worker_tmp_dir = "/dev/shm"  # Use memory for temporary files (faster on Render)
preload_app = True  # Preload the application for better memory efficiency# Process naming
proc_name = "afritec_bridge_lms"

# Server mechanics
daemon = False  # Don't daemonize on cloud platforms like Render
pidfile = None
umask = 0
user = None
group = None
tmp_upload_dir = None

# Logging
loglevel = "info"
accesslog = "-"  # Log to stdout (captured by Render)
errorlog = "-"   # Log to stderr (captured by Render)

# Server hooks
def on_starting(server):
    print("Starting Gunicorn server for Afritec Bridge LMS")

def on_exit(server):
    print("Shutting down Gunicorn server")