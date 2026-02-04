# Student Data Validators
from typing import Dict, List, Tuple, Any
import re
from datetime import datetime


class StudentValidators:
    """Validation utilities for student data"""
    
    @staticmethod
    def validate_enrollment_application(data: Dict) -> Tuple[bool, List[str]]:
        """
        Validate enrollment application data
        
        Args:
            data: Application data dictionary
            
        Returns:
            Tuple of (is_valid, error_messages)
        """
        errors = []
        
        # Required fields
        if 'course_id' not in data or not data['course_id']:
            errors.append("Course ID is required")
        
        if 'type' not in data or data['type'] not in ['free', 'paid', 'scholarship']:
            errors.append("Valid enrollment type is required (free, paid, scholarship)")
        
        # Scholarship specific validation
        if data.get('type') == 'scholarship':
            if not data.get('motivation_letter'):
                errors.append("Motivation letter is required for scholarship applications")
            elif len(data['motivation_letter']) < 100:
                errors.append("Motivation letter must be at least 100 characters")
            elif len(data['motivation_letter']) > 2000:
                errors.append("Motivation letter cannot exceed 2000 characters")
        
        return len(errors) == 0, errors
    
    @staticmethod
    def validate_lesson_completion(data: Dict) -> Tuple[bool, List[str]]:
        """
        Validate lesson completion data
        
        Args:
            data: Lesson completion data
            
        Returns:
            Tuple of (is_valid, error_messages)
        """
        errors = []
        
        # Time spent validation
        time_spent = data.get('time_spent', 0)
        if not isinstance(time_spent, int) or time_spent < 0:
            errors.append("Time spent must be a non-negative integer")
        elif time_spent > 86400:  # 24 hours in seconds
            errors.append("Time spent cannot exceed 24 hours")
        
        return len(errors) == 0, errors
    
    @staticmethod
    def validate_quiz_answers(answers: List[Dict]) -> Tuple[bool, List[str]]:
        """
        Validate quiz answer submission
        
        Args:
            answers: List of answer dictionaries
            
        Returns:
            Tuple of (is_valid, error_messages)
        """
        errors = []
        
        if not answers or not isinstance(answers, list):
            errors.append("Answers must be a non-empty list")
            return False, errors
        
        for i, answer in enumerate(answers):
            if 'question_id' not in answer:
                errors.append(f"Question ID missing for answer {i+1}")
            
            if 'selected_answers' not in answer:
                errors.append(f"Selected answers missing for question {answer.get('question_id', i+1)}")
            elif not isinstance(answer['selected_answers'], list):
                errors.append(f"Selected answers must be a list for question {answer.get('question_id', i+1)}")
        
        return len(errors) == 0, errors
    
    @staticmethod
    def validate_assignment_submission(data: Dict) -> Tuple[bool, List[str]]:
        """
        Validate assignment submission data
        
        Args:
            data: Assignment submission data
            
        Returns:
            Tuple of (is_valid, error_messages)
        """
        errors = []
        
        # Check if at least one type of submission is provided
        has_files = data.get('files') and len(data['files']) > 0
        has_text = data.get('text_submission') and len(data['text_submission'].strip()) > 0
        has_urls = data.get('urls') and len(data['urls']) > 0
        
        if not (has_files or has_text or has_urls):
            errors.append("At least one form of submission is required (files, text, or URLs)")
        
        # Validate URLs if provided
        if data.get('urls'):
            url_pattern = re.compile(
                r'^https?://'  # http:// or https://
                r'(?:(?:[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?\.)+[A-Z]{2,6}\.?|'  # domain...
                r'localhost|'  # localhost...
                r'\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})'  # ...or ip
                r'(?::\d+)?'  # optional port
                r'(?:/?|[/?]\S+)$', re.IGNORECASE)
            
            for url in data['urls']:
                if not url_pattern.match(url):
                    errors.append(f"Invalid URL format: {url}")
        
        # Validate text submission length
        if data.get('text_submission'):
            text_length = len(data['text_submission'].strip())
            if text_length > 10000:  # 10KB limit
                errors.append("Text submission cannot exceed 10,000 characters")
        
        return len(errors) == 0, errors
    
    @staticmethod
    def validate_payment_data(data: Dict) -> Tuple[bool, List[str]]:
        """
        Validate payment processing data
        
        Args:
            data: Payment data dictionary
            
        Returns:
            Tuple of (is_valid, error_messages)
        """
        errors = []
        
        # Required fields
        required_fields = ['payment_method', 'amount', 'currency']
        for field in required_fields:
            if field not in data or not data[field]:
                errors.append(f"{field.replace('_', ' ').title()} is required")
        
        # Validate amount
        if 'amount' in data:
            try:
                amount = float(data['amount'])
                if amount <= 0:
                    errors.append("Amount must be greater than zero")
                elif amount > 10000:  # Reasonable upper limit
                    errors.append("Amount cannot exceed $10,000")
            except (ValueError, TypeError):
                errors.append("Amount must be a valid number")
        
        # Validate currency
        if 'currency' in data:
            valid_currencies = [
                'USD', 'EUR', 'GBP', 'CAD', 'AUD',
                'GHS', 'UGX', 'RWF', 'XOF', 'XAF',
                'KES', 'ZMW', 'NGN', 'TZS'
            ]
            if data['currency'] not in valid_currencies:
                errors.append(f"Currency must be one of: {', '.join(valid_currencies)}")
        
        # Validate payment method
        if 'payment_method' in data:
            valid_methods = ['credit_card', 'debit_card', 'paypal', 'bank_transfer', 'mobile_money']
            if data['payment_method'] not in valid_methods:
                errors.append(f"Payment method must be one of: {', '.join(valid_methods)}")
        
        return len(errors) == 0, errors
    
    @staticmethod
    def validate_final_assessment_submission(data: Dict) -> Tuple[bool, List[str]]:
        """
        Validate final assessment submission
        
        Args:
            data: Final assessment submission data
            
        Returns:
            Tuple of (is_valid, error_messages)
        """
        errors = []
        
        # Essay answers validation
        essay_answers = data.get('essay_answers', {})
        if not essay_answers:
            errors.append("Essay answers are required")
        else:
            for question_id, answer in essay_answers.items():
                if not answer or len(answer.strip()) < 50:
                    errors.append(f"Essay answer for question {question_id} must be at least 50 characters")
                elif len(answer.strip()) > 5000:
                    errors.append(f"Essay answer for question {question_id} cannot exceed 5000 characters")
        
        # Practical work validation
        practical_work = data.get('practical_work', {})
        if not practical_work:
            errors.append("Practical work submission is required")
        
        # Time spent validation
        time_spent = data.get('time_spent', 0)
        if not isinstance(time_spent, int) or time_spent < 0:
            errors.append("Time spent must be a non-negative integer")
        elif time_spent > 7200:  # 2 hours max for final assessment
            errors.append("Time spent cannot exceed 2 hours")
        
        return len(errors) == 0, errors
    
    @staticmethod
    def validate_certificate_verification(data: Dict) -> Tuple[bool, List[str]]:
        """
        Validate certificate verification request
        
        Args:
            data: Certificate verification data
            
        Returns:
            Tuple of (is_valid, error_messages)
        """
        errors = []
        
        if 'certificate_number' not in data or not data['certificate_number']:
            errors.append("Certificate number is required")
        else:
            # Validate certificate number format (ABC-YYYY-NNNNNN)
            cert_pattern = re.compile(r'^[A-Z]{3}-\d{4}-\d{6}$')
            if not cert_pattern.match(data['certificate_number']):
                errors.append("Invalid certificate number format")
        
        # Validate verification hash if provided (optional)
        if data.get('verification_hash'):
            hash_pattern = re.compile(r'^[a-f0-9]{64}$')  # SHA-256 hash
            if not hash_pattern.match(data['verification_hash']):
                errors.append("Invalid verification hash format")
        
        return len(errors) == 0, errors
    
    @staticmethod
    def validate_email(email: str) -> bool:
        """
        Validate email format
        
        Args:
            email: Email address to validate
            
        Returns:
            True if valid, False otherwise
        """
        email_pattern = re.compile(
            r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        )
        return bool(email_pattern.match(email))
    
    @staticmethod
    def validate_date_range(start_date: str, end_date: str) -> Tuple[bool, str]:
        """
        Validate date range
        
        Args:
            start_date: Start date in ISO format
            end_date: End date in ISO format
            
        Returns:
            Tuple of (is_valid, error_message)
        """
        try:
            start = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
            end = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
            
            if start >= end:
                return False, "Start date must be before end date"
            
            # Check if date range is reasonable (not more than 1 year)
            if (end - start).days > 365:
                return False, "Date range cannot exceed one year"
            
            return True, ""
            
        except (ValueError, AttributeError):
            return False, "Invalid date format. Use ISO format (YYYY-MM-DDTHH:MM:SS)"
    
    @staticmethod
    def sanitize_text_input(text: str, max_length: int = 1000) -> str:
        """
        Sanitize text input by removing/escaping potentially harmful content
        
        Args:
            text: Text to sanitize
            max_length: Maximum allowed length
            
        Returns:
            Sanitized text
        """
        if not text:
            return ""
        
        # Remove HTML tags
        import html
        sanitized = html.escape(text.strip())
        
        # Truncate to max length
        if len(sanitized) > max_length:
            sanitized = sanitized[:max_length] + "..."
        
        return sanitized
    
    @staticmethod
    def validate_file_upload(file_data: Dict) -> Tuple[bool, List[str]]:
        """
        Validate file upload data
        
        Args:
            file_data: File data dictionary
            
        Returns:
            Tuple of (is_valid, error_messages)
        """
        errors = []
        
        # Required fields
        if 'filename' not in file_data or not file_data['filename']:
            errors.append("Filename is required")
        
        if 'content_type' not in file_data or not file_data['content_type']:
            errors.append("Content type is required")
        
        if 'size' not in file_data or not isinstance(file_data['size'], int):
            errors.append("File size must be specified as an integer")
        
        filename = file_data.get('filename', '')
        content_type = file_data.get('content_type', '')
        size = file_data.get('size', 0)
        
        # Validate file size (max 50MB for assignments)
        max_size = 50 * 1024 * 1024  # 50MB
        if size > max_size:
            errors.append(f"File size cannot exceed {max_size // (1024 * 1024)}MB")
        
        # Minimum file size check (prevent empty files)
        if size <= 0:
            errors.append("File cannot be empty")
        
        # Validate filename
        if len(filename) > 255:
            errors.append("Filename is too long (maximum 255 characters)")
        
        # Check for dangerous file names and patterns
        import re
        dangerous_patterns = [
            r'\.\.',  # Directory traversal
            r'[<>:"|?*]',  # Invalid filename characters
            r'^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$',  # Windows reserved names
            r'^\\.+$',  # Hidden files that are only dots
            r'^\\s+$',  # Whitespace-only names
        ]
        
        for pattern in dangerous_patterns:
            if re.search(pattern, filename, re.IGNORECASE):
                errors.append("Filename contains invalid characters or patterns")
                break
        
        # Validate file extension with enhanced security
        if filename:
            # Enhanced list of allowed extensions
            allowed_extensions = [
                # Documents
                '.pdf', '.doc', '.docx', '.txt', '.rtf', '.odt',
                
                # Code files
                '.py', '.js', '.html', '.css', '.json', '.xml', '.yaml', '.yml',
                '.java', '.cpp', '.c', '.h', '.hpp', '.cs', '.php', '.rb', '.go',
                '.rs', '.kt', '.swift', '.ts', '.jsx', '.tsx', '.vue', '.scss', '.sass',
                '.sql', '.md', '.markdown', '.rst', '.ini', '.cfg', '.conf',
                
                # Images
                '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.svg', '.webp', '.ico',
                
                # Archives
                '.zip', '.tar', '.gz', '.bz2', '.xz', '.7z',
                
                # Spreadsheets & Presentations
                '.xls', '.xlsx', '.csv', '.ods',
                '.ppt', '.pptx', '.odp',
                
                # Media (limited)
                '.mp3', '.wav', '.ogg', '.m4a',
                '.mp4', '.webm', '.mov', '.avi'
            ]
            
            # Blacklisted extensions (security risk)
            blacklisted_extensions = [
                '.exe', '.bat', '.cmd', '.com', '.pif', '.scr', '.vbs', '.jse',
                '.jar', '.msi', '.dll', '.sys', '.bin', '.app', '.deb', '.rpm',
                '.dmg', '.pkg', '.sh', '.bash', '.fish', '.zsh', '.ps1', '.psm1'
            ]
            
            filename_lower = filename.lower()
            file_ext = None
            
            # Find the file extension
            for ext in allowed_extensions + blacklisted_extensions:
                if filename_lower.endswith(ext):
                    file_ext = ext
                    break
            
            if file_ext in blacklisted_extensions:
                errors.append(f"File type '{file_ext}' is not allowed for security reasons")
            elif file_ext not in allowed_extensions:
                errors.append(f"File type not allowed. Allowed types: {', '.join(allowed_extensions[:20])}... and more")
        
        # Additional security checks
        if filename:
            # Check for suspicious filename patterns
            suspicious_patterns = [
                r'\\.(php|asp|aspx|jsp|cgi)\\.',  # Double extension attacks
                r'\\.(php|asp|aspx|jsp|cgi)$',   # Server-side script files
                r'\\.exe\\.',                    # Disguised executables
                r'[\\x00-\\x1f]',               # Control characters
            ]
            
            for pattern in suspicious_patterns:
                if re.search(pattern, filename, re.IGNORECASE):
                    errors.append("Filename contains suspicious patterns")
                    break
        
        return len(errors) == 0, errors