from main import app
from src.models.user_models import db, User, Role

def create_test_user():
    with app.app_context():
        # Check if user already exists
        existing_user = User.query.filter_by(email='testuser@example.com').first()
        if existing_user:
            print('Test user already exists')
            return
            
        # Get student role
        student_role = Role.query.filter_by(name='student').first()
        if not student_role:
            print('Student role not found. Creating it...')
            student_role = Role(name='student')
            db.session.add(student_role)
            db.session.commit()
            student_role = Role.query.filter_by(name='student').first()
            
        # Create test user
        test_user = User(
            username='testuser',
            email='testuser@example.com',
            first_name='Test',
            last_name='User',
            role_id=student_role.id
        )
        test_user.set_password('password123')
        db.session.add(test_user)
        db.session.commit()
        print('Test user created successfully')

if __name__ == "__main__":
    create_test_user()