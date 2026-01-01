"""
Enhanced Application Scoring System
Evaluates applications across multiple dimensions for fair and comprehensive ranking.
"""
import json


def calculate_risk(application):
    """
    Calculate risk score based on technical barriers and readiness.
    Lower score = Lower risk = Better
    Range: 0-100
    """
    risk = 0

    # Computer Access (Critical) - 30 points
    if not application.has_computer:
        risk += 30
    
    # Internet Access Quality - 25 points
    if not application.has_internet:
        risk += 25
    elif application.internet_access_type == "limited_access":
        risk += 15
    elif application.internet_access_type == "public_wifi":
        risk += 10
    elif application.internet_access_type == "mobile_data":
        risk += 5
    
    # Excel/Digital Skills - 20 points
    if application.excel_skill_level == "never_used":
        risk += 20
    elif application.excel_skill_level == "beginner":
        risk += 10
    elif application.excel_skill_level == "intermediate":
        risk += 3
    
    # Learning Experience - 15 points
    if not application.online_learning_experience:
        risk += 15
    
    # Commitment Indicators - 10 points
    if not application.committed_to_complete:
        risk += 5
    if not application.agrees_to_assessments:
        risk += 5

    application.risk_score = min(risk, 100)
    application.is_high_risk = risk >= 50


def calculate_readiness_score(application):
    """
    Calculate readiness score based on skills, experience, and resources.
    Higher score = More ready
    Range: 0-100
    """
    score = 0
    
    # Technical Resources (30 points)
    if application.has_computer:
        score += 15
    if application.has_internet:
        score += 10
    if application.internet_access_type == "stable_broadband":
        score += 5
    
    # Excel Skills & Experience (30 points)
    excel_skill_map = {
        "expert": 30,
        "advanced": 25,
        "intermediate": 18,
        "beginner": 10,
        "never_used": 0
    }
    score += excel_skill_map.get(application.excel_skill_level or "never_used", 0)
    
    # Previous Excel Tasks (10 points bonus)
    if application.excel_tasks_done:
        try:
            tasks = json.loads(application.excel_tasks_done) if isinstance(application.excel_tasks_done, str) else application.excel_tasks_done
            if isinstance(tasks, list):
                # Award 2 points per task, max 10
                score += min(len(tasks) * 2, 10)
        except:
            pass
    
    # Education & Background (20 points)
    education_map = {
        "phd": 20,
        "masters": 18,
        "bachelors": 15,
        "diploma": 12,
        "high_school": 8,
        "other": 5
    }
    score += education_map.get(application.education_level or "other", 0)
    
    # Learning Experience (10 points)
    if application.online_learning_experience:
        score += 10
    
    # Professional Status (10 points)
    if application.current_status in ["employed", "self_employed", "freelancer"]:
        score += 10
    elif application.current_status == "student":
        score += 7
    
    application.readiness_score = min(score, 100)
    return score


def calculate_commitment_score(application):
    """
    Calculate commitment score based on motivation and dedication indicators.
    Higher score = More committed
    Range: 0-100
    """
    score = 0
    
    # Commitment Agreement (20 points)
    if application.committed_to_complete:
        score += 10
    if application.agrees_to_assessments:
        score += 10
    
    # Motivation Quality (30 points)
    if application.motivation:
        length = len(application.motivation.strip())
        if length >= 500:
            score += 30
        elif length >= 300:
            score += 25
        elif length >= 150:
            score += 18
        elif length >= 50:
            score += 10
    
    # Learning Outcomes Clarity (20 points)
    if application.learning_outcomes:
        length = len(application.learning_outcomes.strip())
        if length >= 200:
            score += 20
        elif length >= 100:
            score += 15
        elif length >= 50:
            score += 10
    
    # Career Impact Vision (20 points)
    if application.career_impact:
        length = len(application.career_impact.strip())
        if length >= 200:
            score += 20
        elif length >= 100:
            score += 15
        elif length >= 50:
            score += 10
    
    # Time Availability (10 points)
    if application.available_time:
        try:
            times = json.loads(application.available_time) if isinstance(application.available_time, str) else application.available_time
            if isinstance(times, list) and len(times) >= 2:
                score += 10
            elif isinstance(times, list) and len(times) == 1:
                score += 5
        except:
            pass
    
    application.commitment_score = min(score, 100)
    return score


def calculate_application_score(application):
    """
    Calculate overall application score combining multiple factors.
    Higher score = Better application
    Range: 0-100
    """
    score = 0
    
    # Technical Readiness (25 points)
    if application.has_computer:
        score += 15
    if application.has_internet:
        score += 10
    
    # Excel Skills (25 points)
    excel_map = {
        "expert": 25,
        "advanced": 22,
        "intermediate": 18,
        "beginner": 12,
        "never_used": 5  # Still award some points for honesty
    }
    score += excel_map.get(application.excel_skill_level or "never_used", 0)
    
    # Education Level (15 points)
    education_map = {
        "phd": 15,
        "masters": 14,
        "bachelors": 12,
        "diploma": 10,
        "high_school": 7,
        "other": 4
    }
    score += education_map.get(application.education_level or "other", 0)
    
    # Motivation & Goals (20 points)
    if application.motivation and len(application.motivation) >= 150:
        score += 10
    if application.learning_outcomes and len(application.learning_outcomes) >= 50:
        score += 5
    if application.career_impact and len(application.career_impact) >= 50:
        score += 5
    
    # Commitment (10 points)
    if application.committed_to_complete:
        score += 5
    if application.agrees_to_assessments:
        score += 5
    
    # Preferred Learning Mode Bonus (5 points)
    if application.preferred_learning_mode in ["live_sessions", "hybrid"]:
        score += 5
    elif application.preferred_learning_mode == "self_paced":
        score += 3
    
    application.application_score = min(score, 100)
    return score


def calculate_final_rank(application):
    """
    Calculate final ranking score using weighted combination of all factors.
    Considers readiness, commitment, and subtracts risk.
    Higher score = Better candidate
    """
    # Ensure all component scores are calculated
    readiness = application.readiness_score or calculate_readiness_score(application)
    commitment = application.commitment_score or calculate_commitment_score(application)
    app_score = application.application_score or calculate_application_score(application)
    risk = application.risk_score or 0
    
    # Weighted formula
    # 40% Application Score + 30% Readiness + 20% Commitment - 10% Risk
    final_score = (
        (app_score * 0.4) +
        (readiness * 0.3) +
        (commitment * 0.2) -
        (risk * 0.1)
    )
    
    # Boost for African countries (if specified)
    if application.country:
        african_countries = [
            "nigeria", "kenya", "ghana", "south africa", "egypt", "ethiopia",
            "tanzania", "uganda", "morocco", "algeria", "tunisia", "rwanda",
            "senegal", "ivory coast", "cameroon", "zimbabwe", "zambia", "botswana"
        ]
        if any(country in application.country.lower() for country in african_countries):
            final_score += 5
    
    application.final_rank_score = round(max(0, final_score), 2)
    return application.final_rank_score


def evaluate_application(application):
    """
    Complete evaluation pipeline for an application.
    Calculates all scores in proper order.
    """
    calculate_risk(application)
    calculate_readiness_score(application)
    calculate_commitment_score(application)
    calculate_application_score(application)
    calculate_final_rank(application)
    
    return {
        "risk_score": application.risk_score,
        "is_high_risk": application.is_high_risk,
        "readiness_score": application.readiness_score,
        "commitment_score": application.commitment_score,
        "application_score": application.application_score,
        "final_rank_score": application.final_rank_score,
    }
