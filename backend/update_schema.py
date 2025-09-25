from main import app
from src.models.user_models import db
from sqlalchemy import text

def update_schema():
    with app.app_context():
        try:
            with db.engine.connect() as conn:
                conn.execute(text('ALTER TABLE users ADD COLUMN reset_token VARCHAR(100)'))
                conn.commit()
            print("Added reset_token column successfully")
        except Exception as e:
            print(f"Error adding reset_token column: {e}")

        try:
            with db.engine.connect() as conn:
                conn.execute(text('ALTER TABLE users ADD COLUMN reset_token_expires_at DATETIME'))
                conn.commit()
            print("Added reset_token_expires_at column successfully")
        except Exception as e:
            print(f"Error adding reset_token_expires_at column: {e}")

if __name__ == "__main__":
    update_schema()