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

workers = 4  # For a small to medium application
worker_class = "sync"
worker_connections = 1000
timeout = 60
keepalive = 2

# Process naming
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