# Opportunity Connection Models for Afritec Bridge LMS

from datetime import datetime
from .user_models import db, User # Assuming user_models.py is in the same directory and has db

class Opportunity(db.Model):
    __tablename__ = "opportunities"
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text, nullable=False)
    type = db.Column(db.String(100), nullable=False)  # e.g., "internship", "job", "freelance", "scholarship", "hackathon"
    location = db.Column(db.String(255), nullable=True) # e.g., "Remote", "City, Country"
    company_name = db.Column(db.String(255), nullable=True)
    application_link = db.Column(db.String(500), nullable=False)
    application_deadline = db.Column(db.DateTime, nullable=True)
    posted_by_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    is_active = db.Column(db.Boolean, default=True, nullable=False)

    posted_by = db.relationship("User", backref=db.backref("opportunities_posted", lazy="dynamic"))

    def __repr__(self):
        return f"<Opportunity {self.title}>"

    def to_dict(self):
        return {
            "id": self.id,
            "title": self.title,
            "description": self.description,
            "type": self.type,
            "location": self.location,
            "company_name": self.company_name,
            "application_link": self.application_link,
            "application_deadline": self.application_deadline.isoformat() if self.application_deadline else None,
            "posted_by_id": self.posted_by_id,
            "posted_by_username": self.posted_by.username if self.posted_by else None,
            "created_at": self.created_at.isoformat(),
            "is_active": self.is_active
        }

