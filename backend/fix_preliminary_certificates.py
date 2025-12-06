#!/usr/bin/env python3
"""
Fix script: Add preliminary certificates to existing enrollments
that don't have certificates yet
"""
from main import app
from src.models.course_models import Enrollment
from src.models.student_models import Certificate, db
import json
from datetime import datetime

def fix_missing_certificates():
    """Add preliminary certificates to enrollments that don't have them"""
    with app.app_context():
        try:
            # Find all enrollments
            enrollments = Enrollment.query.all()
            created_count = 0
            
            print(f"\n📋 Found {len(enrollments)} enrollments")
            print("=" * 60)
            
            for enrollment in enrollments:
                # Check if certificate already exists for this enrollment
                existing_cert = Certificate.query.filter_by(
                    enrollment_id=enrollment.id
                ).first()
                
                if existing_cert:
                    print(f"✓ Enrollment {enrollment.id} - Certificate already exists (ID: {existing_cert.id})")
                    continue
                
                # Create preliminary certificate
                try:
                    preliminary_cert = Certificate(
                        student_id=enrollment.student_id,
                        course_id=enrollment.course_id,
                        enrollment_id=enrollment.id,
                        overall_score=0,
                        grade="",
                        is_active=True
                    )
                    
                    # Generate certificate number
                    preliminary_cert.generate_certificate_number()
                    
                    # Set empty skills and portfolio
                    preliminary_cert.skills_acquired = json.dumps([])
                    preliminary_cert.portfolio_items = json.dumps([])
                    
                    db.session.add(preliminary_cert)
                    db.session.commit()
                    
                    created_count += 1
                    print(f"✅ Created preliminary certificate for enrollment {enrollment.id}")
                    print(f"   - Student: {enrollment.student_id}")
                    print(f"   - Course: {enrollment.course_id}")
                    print(f"   - Cert #: {preliminary_cert.certificate_number}")
                    
                except Exception as e:
                    db.session.rollback()
                    print(f"❌ Failed to create certificate for enrollment {enrollment.id}: {str(e)}")
                    continue
            
            print("=" * 60)
            print(f"\n✨ Summary:")
            print(f"   - Total enrollments: {len(enrollments)}")
            print(f"   - New certificates created: {created_count}")
            print(f"   - Already had certificates: {len(enrollments) - created_count}")
            print("\n✅ Fix completed successfully!")
            
        except Exception as e:
            print(f"\n❌ Error: {str(e)}")
            raise

if __name__ == "__main__":
    print("\n🔧 Fixing missing preliminary certificates...")
    print("This script adds preliminary certificates to existing enrollments\n")
    fix_missing_certificates()
