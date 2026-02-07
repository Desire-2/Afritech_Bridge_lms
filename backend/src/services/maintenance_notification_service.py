"""
Maintenance Mode Notification Service

Handles sending email notifications for maintenance mode events
"""
import logging
from datetime import datetime
from typing import List, Optional
from datetime import datetime

from ..models.user_models import User
from ..utils.email_templates import (
    maintenance_notification_email,
    maintenance_completed_email
)

# Import brevo service with error handling
try:
    from ..utils.brevo_email_service import brevo_service
    BREVO_AVAILABLE = True
except (ImportError, ModuleNotFoundError):
    brevo_service = None
    BREVO_AVAILABLE = False

logger = logging.getLogger(__name__)


class MaintenanceNotificationService:
    """Service for sending maintenance-related email notifications"""
    
    @staticmethod
    def send_maintenance_scheduled_notification(
        maintenance_message: str,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
        notify_all_users: bool = True,
        specific_users: Optional[List[int]] = None
    ) -> dict:
        """
        Send email notification when maintenance is scheduled
        
        Args:
            maintenance_message: Custom message about the maintenance
            start_time: When maintenance will start (datetime object)
            end_time: Estimated completion time (datetime object)
            notify_all_users: Whether to notify all active users
            specific_users: List of specific user IDs to notify
        
        Returns:
            dict with success status and statistics
        """
        if not BREVO_AVAILABLE or brevo_service is None:
            logger.warning("📧 Email service not available - cannot send maintenance notifications")
            return {
                'success': False,
                'message': 'Email service not configured',
                'sent_count': 0,
                'failed_count': 0
            }
        
        try:
            # Get users to notify
            if specific_users:
                users = User.query.filter(User.id.in_(specific_users), User.is_active == True).all()
            elif notify_all_users:
                # Notify all active users
                users = User.query.filter(User.is_active == True).all()
            else:
                return {
                    'success': False,
                    'message': 'No users specified for notification',
                    'sent_count': 0,
                    'failed_count': 0
                }
            
            logger.info(f"📬 Found {len(users)} users to notify about maintenance")
            
            if not users:
                logger.warning("No users found to notify about maintenance")
                return {
                    'success': True,
                    'message': 'No users to notify',
                    'sent_count': 0,
                    'failed_count': 0
                }
            
            sent_count = 0
            failed_count = 0
            
            # Calculate duration if both times provided
            duration = None
            if start_time and end_time:
                time_diff = end_time - start_time
                hours = time_diff.total_seconds() / 3600
                if hours < 1:
                    minutes = time_diff.total_seconds() / 60
                    duration = f"approximately {int(minutes)} minutes"
                else:
                    duration = f"approximately {int(hours)} hours"
            
            # Send email to each user
            for user in users:
                try:
                    user_name = user.get_display_name()
                    
                    email_html = maintenance_notification_email(
                        recipient_name=user_name,
                        maintenance_message=maintenance_message,
                        start_time=start_time,
                        end_time=end_time,
                        duration=duration,
                        show_countdown=True
                    )
                    
                    brevo_service.send_email(
                        to_emails=[user.email],
                        subject="🔧 Scheduled System Maintenance - Afritech Bridge LMS",
                        html_content=email_html
                    )
                    
                    sent_count += 1
                    logger.info(f"📧 Maintenance notification sent to {user.email}")
                    
                except Exception as e:
                    failed_count += 1
                    logger.error(f"❌ Failed to send maintenance notification to {user.email}: {str(e)}")
            
            logger.info(f"✅ Maintenance notifications: {sent_count} sent, {failed_count} failed out of {len(users)} total")
            
            return {
                'success': True,
                'message': f'Sent {sent_count} notifications successfully',
                'sent_count': sent_count,
                'failed_count': failed_count,
                'total_users': len(users)
            }
            
        except Exception as e:
            logger.error(f"❌ Error sending maintenance notifications: {str(e)}")
            return {
                'success': False,
                'message': f'Error: {str(e)}',
                'sent_count': 0,
                'failed_count': 0
            }
    
    @staticmethod
    def send_maintenance_completed_notification(
        downtime_duration: Optional[str] = None,
        improvements: Optional[List[str]] = None,
        notify_all_users: bool = True,
        specific_users: Optional[List[int]] = None
    ) -> dict:
        """
        Send email notification when maintenance is completed
        
        Args:
            downtime_duration: How long the maintenance took (human-readable)
            improvements: List of improvements/changes made
            notify_all_users: Whether to notify all active users
            specific_users: List of specific user IDs to notify
        
        Returns:
            dict with success status and statistics
        """
        if not BREVO_AVAILABLE or brevo_service is None:
            logger.warning("📧 Email service not available - cannot send maintenance completion notifications")
            return {
                'success': False,
                'message': 'Email service not configured',
                'sent_count': 0,
                'failed_count': 0
            }
        
        try:
            # Get users to notify
            if specific_users:
                users = User.query.filter(User.id.in_(specific_users), User.is_active == True).all()
            elif notify_all_users:
                users = User.query.filter(
                    User.is_active == True,
                    User.email_notifications == True
                ).all()
            else:
                return {
                    'success': False,
                    'message': 'No users specified for notification',
                    'sent_count': 0,
                    'failed_count': 0
                }
            
            if not users:
                logger.warning("No users found to notify about maintenance completion")
                return {
                    'success': True,
                    'message': 'No users to notify',
                    'sent_count': 0,
                    'failed_count': 0
                }
            
            sent_count = 0
            failed_count = 0
            
            # Send email to each user
            for user in users:
                try:
                    user_name = user.get_display_name()
                    
                    email_html = maintenance_completed_email(
                        recipient_name=user_name,
                        downtime_duration=downtime_duration,
                        improvements=improvements
                    )
                    
                    brevo_service.send_email(
                        to_emails=[user.email],
                        subject="✅ System Back Online - Afritech Bridge LMS",
                        html_content=email_html
                    )
                    
                    sent_count += 1
                    logger.info(f"📧 Maintenance completion notification sent to {user.email}")
                    
                except Exception as e:
                    failed_count += 1
                    logger.error(f"❌ Failed to send completion notification to {user.email}: {str(e)}")
            
            logger.info(f"✅ Completion notifications: {sent_count} sent, {failed_count} failed out of {len(users)} total")
            
            return {
                'success': True,
                'message': f'Sent {sent_count} completion notifications successfully',
                'sent_count': sent_count,
                'failed_count': failed_count,
                'total_users': len(users)
            }
            
        except Exception as e:
            logger.error(f"❌ Error sending completion notifications: {str(e)}")
            return {
                'success': False,
                'message': f'Error: {str(e)}',
                'sent_count': 0,
                'failed_count': 0
            }
    
    @staticmethod
    def send_test_maintenance_email(user_email: str) -> bool:
        """Send a test maintenance notification to a specific email"""
        if not BREVO_AVAILABLE or brevo_service is None:
            logger.warning("📧 Email service not available")
            return False
        
        try:
            from datetime import datetime, timedelta
            
            now = datetime.utcnow()
            start_time = now + timedelta(hours=2)
            end_time = start_time + timedelta(hours=3)
            
            email_html = maintenance_notification_email(
                recipient_name="Test User",
                maintenance_message="This is a test maintenance notification email. We're testing the system to ensure all notifications are delivered properly.",
                start_time=start_time,
                end_time=end_time,
                duration="approximately 3 hours",
                show_countdown=True
            )
            
            brevo_service.send_email(
                to_emails=[user_email],
                subject="🔧 TEST: Scheduled System Maintenance - Afritech Bridge LMS",
                html_content=email_html
            )
            
            logger.info(f"📧 Test maintenance notification sent to {user_email}")
            return True
            
        except Exception as e:
            logger.error(f"❌ Failed to send test notification: {str(e)}")
            return False
    
    def notify_all_users(
        self,
        start_time: datetime,
        end_time: datetime,
        message: str,
        exclude_admins: bool = False
    ) -> dict:
        """
        Notify all active users about scheduled maintenance
        
        Args:
            start_time: When maintenance will start
            end_time: When maintenance will end
            message: Maintenance message
            exclude_admins: Whether to exclude admin users from notifications
        
        Returns:
            dict with success status and statistics
        """
        try:
            # Build query for active users
            query = User.query.filter(User.is_active == True)
            
            # Exclude admins if requested
            if exclude_admins:
                from ..models.user_models import Role
                admin_role = Role.query.filter_by(name='admin').first()
                if admin_role:
                    # User.role_id is the foreign key, filter by role_id
                    query = query.filter(User.role_id != admin_role.id)
            
            users = query.all()
            
            logger.info(f"🔔 Preparing to send maintenance notifications to {len(users)} users (exclude_admins={exclude_admins})")
            
            # Use the existing static method to send notifications
            result = self.send_maintenance_scheduled_notification(
                maintenance_message=message,
                start_time=start_time,
                end_time=end_time,
                specific_users=[user.id for user in users]
            )
            
            return {
                'success': result.get('success', False),
                'success_count': result.get('sent_count', 0),
                'failed_count': result.get('failed_count', 0),
                'total_users': len(users)
            }
            
        except Exception as e:
            logger.error(f"❌ Error in notify_all_users: {str(e)}")
            return {
                'success': False,
                'success_count': 0,
                'failed_count': 0,
                'error': str(e)
            }
    
    def notify_specific_roles(
        self,
        roles: List[str],
        start_time: datetime,
        end_time: datetime,
        message: str
    ) -> dict:
        """
        Notify users with specific roles about scheduled maintenance
        
        Args:
            roles: List of role names to notify (e.g., ['student', 'instructor'])
            start_time: When maintenance will start
            end_time: When maintenance will end
            message: Maintenance message
        
        Returns:
            dict with success status and statistics
        """
        try:
            from ..models.user_models import Role
            
            # Get role IDs for the specified roles
            role_objects = Role.query.filter(Role.name.in_(roles)).all()
            
            if not role_objects:
                logger.warning(f"⚠️ No roles found matching: {roles}")
                return {
                    'success': False,
                    'success_count': 0,
                    'failed_count': 0,
                    'error': 'No matching roles found'
                }
            
            # Get role IDs
            role_ids = [role.id for role in role_objects]
            
            # Get all users who have any of these roles
            users = User.query.filter(
                User.role_id.in_(role_ids),
                User.is_active == True
            ).all()
            
            logger.info(f"🔔 Preparing to send maintenance notifications to {len(users)} users with roles: {roles}")
            
            # Use the existing static method to send notifications
            result = self.send_maintenance_scheduled_notification(
                maintenance_message=message,
                start_time=start_time,
                end_time=end_time,
                specific_users=[user.id for user in users]
            )
            
            return {
                'success': result.get('success', False),
                'success_count': result.get('sent_count', 0),
                'failed_count': result.get('failed_count', 0),
                'total_users': len(users)
            }
            
        except Exception as e:
            logger.error(f"❌ Error in notify_specific_roles: {str(e)}")
            return {
                'success': False,
                'success_count': 0,
                'failed_count': 0,
                'error': str(e)
            }


# Convenience function for easy import
def notify_maintenance_scheduled(maintenance_message, start_time=None, end_time=None):
    """Shortcut to send maintenance scheduled notifications"""
    return MaintenanceNotificationService.send_maintenance_scheduled_notification(
        maintenance_message=maintenance_message,
        start_time=start_time,
        end_time=end_time,
        notify_all_users=True
    )


def notify_maintenance_completed(downtime_duration=None, improvements=None):
    """Shortcut to send maintenance completed notifications"""
    return MaintenanceNotificationService.send_maintenance_completed_notification(
        downtime_duration=downtime_duration,
        improvements=improvements,
        notify_all_users=True
    )
