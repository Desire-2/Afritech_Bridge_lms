# Gunicorn configuration file for Afritec Bridge LMS backend

# Server socket
bind = "0.0.0.0:$PORT"  # Render will supply the PORT environment variable
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