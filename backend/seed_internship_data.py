#!/usr/bin/env python3
"""
Seed script for Internship Application System
Creates 8 default internship tracks and sample cohorts
Run with: python backend/seed_internship_data.py
"""

import os
import sys
from datetime import datetime, timedelta

# Add backend to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from main import app, db
from src.models.internship_models import InternshipTrack, InternshipCohort


def seed_internship_data():
    """Seed database with initial internship tracks and sample cohorts"""
    
    with app.app_context():
        try:
            # Check if tracks already exist
            existing_tracks = InternshipTrack.query.count()
            if existing_tracks > 0:
                print(f"✓ Internship tracks already exist ({existing_tracks} found). Skipping seed.")
                return
            
            print("🌱 Seeding internship data...")
            
            # Define the 8 default tracks
            tracks_data = [
                {
                    'name': 'Mobile Development',
                    'slug': 'mobile',
                    'icon_key': 'mobile',
                    'description': 'Build cross-platform mobile applications using Flutter, React Native, or native iOS/Android development.',
                },
                {
                    'name': 'Frontend Development',
                    'slug': 'frontend',
                    'icon_key': 'frontend',
                    'description': 'Create responsive, engaging user interfaces with React, Vue, Angular, and modern web technologies.',
                },
                {
                    'name': 'Backend Development',
                    'slug': 'backend',
                    'icon_key': 'backend',
                    'description': 'Build scalable server-side applications with Python, Node.js, Java, or Go.',
                },
                {
                    'name': 'Fullstack Development',
                    'slug': 'fullstack',
                    'icon_key': 'fullstack',
                    'description': 'Master both frontend and backend development to build complete web applications.',
                },
                {
                    'name': 'Data Science',
                    'slug': 'data',
                    'icon_key': 'data',
                    'description': 'Analyze data, build machine learning models, and create data-driven insights using Python and advanced analytics.',
                },
                {
                    'name': 'UI/UX Design',
                    'slug': 'design',
                    'icon_key': 'design',
                    'description': 'Design beautiful, user-centered digital experiences with tools like Figma, Adobe XD, and prototyping.',
                },
                {
                    'name': 'DevOps & Cloud',
                    'slug': 'devops',
                    'icon_key': 'devops',
                    'description': 'Manage cloud infrastructure, CI/CD pipelines, and deployment with AWS, GCP, Docker, and Kubernetes.',
                },
                {
                    'name': 'Other',
                    'slug': 'other',
                    'icon_key': 'other',
                    'description': 'Specialized tech tracks including cybersecurity, blockchain, or emerging technologies.',
                },
            ]
            
            # Create tracks
            created_tracks = {}
            for track_data in tracks_data:
                track = InternshipTrack(
                    name=track_data['name'],
                    slug=track_data['slug'],
                    icon_key=track_data['icon_key'],
                    description=track_data['description'],
                    is_active=True,
                )
                db.session.add(track)
                created_tracks[track_data['slug']] = track
                print(f"  ✓ Created track: {track_data['name']}")
            
            db.session.flush()  # Flush to get IDs without committing
            
            # Create sample cohorts for each track
            now = datetime.utcnow()
            cohort_configs = [
                {
                    'track_slug': 'mobile',
                    'name': 'Mobile Q2 2026',
                    'code': 'MOB-Q2-2026',
                    'start': now + timedelta(days=30),
                    'end': now + timedelta(days=120),
                    'capacity': 20,
                },
                {
                    'track_slug': 'frontend',
                    'name': 'Frontend Q2 2026',
                    'code': 'FE-Q2-2026',
                    'start': now + timedelta(days=30),
                    'end': now + timedelta(days=120),
                    'capacity': 25,
                },
                {
                    'track_slug': 'backend',
                    'name': 'Backend Q2 2026',
                    'code': 'BE-Q2-2026',
                    'start': now + timedelta(days=30),
                    'end': now + timedelta(days=120),
                    'capacity': 25,
                },
                {
                    'track_slug': 'fullstack',
                    'name': 'Fullstack Q2 2026',
                    'code': 'FS-Q2-2026',
                    'start': now + timedelta(days=30),
                    'end': now + timedelta(days=120),
                    'capacity': 15,
                },
                {
                    'track_slug': 'data',
                    'name': 'Data Science Q2 2026',
                    'code': 'DATA-Q2-2026',
                    'start': now + timedelta(days=30),
                    'end': now + timedelta(days=120),
                    'capacity': 15,
                },
                {
                    'track_slug': 'design',
                    'name': 'UI/UX Design Q2 2026',
                    'code': 'DESIGN-Q2-2026',
                    'start': now + timedelta(days=30),
                    'end': now + timedelta(days=120),
                    'capacity': 12,
                },
                {
                    'track_slug': 'devops',
                    'name': 'DevOps Q2 2026',
                    'code': 'DEVOPS-Q2-2026',
                    'start': now + timedelta(days=30),
                    'end': now + timedelta(days=120),
                    'capacity': 10,
                },
            ]
            
            for config in cohort_configs:
                track = created_tracks.get(config['track_slug'])
                if track:
                    cohort = InternshipCohort(
                        track_id=track.id,
                        cohort_name=config['name'],
                        cohort_code=config['code'],
                        start_date=config['start'],
                        end_date=config['end'],
                        capacity=config['capacity'],
                        is_accepting=True,
                        description=f"Q2 2026 cohort for {track.name}",
                    )
                    db.session.add(cohort)
                    print(f"  ✓ Created cohort: {config['code']} ({config['capacity']} positions)")
            
            # Commit all changes
            db.session.commit()
            
            print("\n✅ Internship data seeded successfully!")
            print(f"   - 8 tracks created")
            print(f"   - 7 sample cohorts created")
            print("\n📌 Sample cohorts will start in 30 days and run for 90 days")
            
        except Exception as e:
            db.session.rollback()
            print(f"❌ Error seeding data: {str(e)}")
            import traceback
            traceback.print_exc()
            sys.exit(1)


if __name__ == '__main__':
    seed_internship_data()
