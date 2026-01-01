"""User utility functions for username and password generation."""
import secrets
import string
from ..models.user_models import User


def generate_username(first_name, last_name):
    """
    Generate a unique username from first and last name.
    Format: firstname.lastname or firstname.lastname2 if duplicate exists.
    
    Args:
        first_name (str): User's first name
        last_name (str): User's last name
        
    Returns:
        str: Unique username
    """
    # Clean and lowercase the names
    first = first_name.strip().lower().replace(" ", "")
    last = last_name.strip().lower().replace(" ", "")
    
    # Create base username
    base_username = f"{first}.{last}"
    username = base_username
    
    # Check for duplicates and append number if needed
    counter = 1
    while User.query.filter_by(username=username).first() is not None:
        counter += 1
        username = f"{base_username}{counter}"
    
    return username


def generate_temp_password(length=12):
    """
    Generate a secure temporary password.
    
    Args:
        length (int): Length of the password (default: 12)
        
    Returns:
        str: Randomly generated secure password
    """
    # Define character sets
    lowercase = string.ascii_lowercase
    uppercase = string.ascii_uppercase
    digits = string.digits
    special = "!@#$%^&*"
    
    # Ensure at least one character from each set
    password = [
        secrets.choice(lowercase),
        secrets.choice(uppercase),
        secrets.choice(digits),
        secrets.choice(special)
    ]
    
    # Fill the rest randomly from all characters
    all_chars = lowercase + uppercase + digits + special
    password.extend(secrets.choice(all_chars) for _ in range(length - 4))
    
    # Shuffle to avoid predictable patterns
    password_list = list(password)
    secrets.SystemRandom().shuffle(password_list)
    
    return ''.join(password_list)
