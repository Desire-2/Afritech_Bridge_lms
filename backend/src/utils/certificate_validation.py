# Certificate Validation Helper - Detailed requirement checking with actionable feedback

from typing import Dict, List


class CertificateValidator:
    """Comprehensive certificate requirement validation utility"""
    
    PASSING_SCORE = 80.0
    
    @staticmethod
    def validate_certificate_requirements(
        overall_score: float,
        module_scores: List[float],
        module_details: List[Dict],
        total_modules: int,
        completed_modules: int,
        failed_modules: int
    ) -> Dict:
        """Validate all certificate requirements with detailed feedback"""
        
        is_eligible = (
            overall_score >= CertificateValidator.PASSING_SCORE and
            all(score >= CertificateValidator.PASSING_SCORE for score in module_scores) if module_scores else False and
            completed_modules == total_modules and
            failed_modules == 0
        )
        
        validation = {
            "eligible": is_eligible,
            "overall_score": round(overall_score, 1),
            "passing_score": CertificateValidator.PASSING_SCORE,
            "completed_modules": completed_modules,
            "total_modules": total_modules,
            "failed_modules": failed_modules,
            "requirements_status": {},
            "failure_details": [],
            "module_breakdown": [],
            "next_steps": []
        }
        
        # Check Overall Score
        if overall_score >= CertificateValidator.PASSING_SCORE:
            validation["requirements_status"]["overall_score"] = {
                "status": "PASS",
                "message": f"Overall score {overall_score:.1f}% meets requirement"
            }
        else:
            gap = CertificateValidator.PASSING_SCORE - overall_score
            validation["requirements_status"]["overall_score"] = {
                "status": "FAIL",
                "message": f"Overall score is {overall_score:.1f}%, need {gap:.1f}% more"
            }
            validation["failure_details"].append({
                "type": "overall_score",
                "current": round(overall_score, 1),
                "required": CertificateValidator.PASSING_SCORE,
                "gap": round(gap, 1),
                "advice": "Improve performance in low-scoring modules"
            })
        
        # Check Module Completion
        if completed_modules == total_modules:
            validation["requirements_status"]["module_completion"] = {
                "status": "PASS",
                "message": f"All {total_modules} modules completed"
            }
        else:
            remaining = total_modules - completed_modules
            incomplete = [m for m in module_details if m.get("status") != "completed"]
            validation["requirements_status"]["module_completion"] = {
                "status": "FAIL",
                "message": f"Completed {completed_modules}/{total_modules} modules"
            }
            validation["failure_details"].append({
                "type": "incomplete_modules",
                "completed": completed_modules,
                "total": total_modules,
                "remaining": remaining,
                "incomplete_list": [{
                    "name": m.get("module_name"),
                    "status": m.get("status")
                } for m in incomplete],
                "advice": f"Complete {remaining} remaining module(s)"
            })
        
        # Check All Modules Passing
        passing_count = sum(1 for s in module_scores if s >= CertificateValidator.PASSING_SCORE)
        if failing_modules := [m for m in module_details if m.get("score", 0) < CertificateValidator.PASSING_SCORE]:
            validation["requirements_status"]["modules_passing"] = {
                "status": "FAIL",
                "message": f"{len(failing_modules)} modules below passing threshold"
            }
            validation["failure_details"].append({
                "type": "failing_modules",
                "count": len(failing_modules),
                "failing_list": [{
                    "name": m.get("module_name"),
                    "score": m.get("score", 0),
                    "gap": max(0, CertificateValidator.PASSING_SCORE - m.get("score", 0))
                } for m in failing_modules],
                "advice": "Retake quizzes or complete additional practice in failing modules"
            })
        else:
            validation["requirements_status"]["modules_passing"] = {
                "status": "PASS",
                "message": f"All {len(module_scores)} modules have passing scores"
            }
        
        # Add module breakdown
        for module in module_details:
            is_passing = module.get("score", 0) >= CertificateValidator.PASSING_SCORE
            validation["module_breakdown"].append({
                "name": module.get("module_name"),
                "score": module.get("score", 0),
                "status": module.get("status"),
                "passing": is_passing,
                "feedback": CertificateValidator._get_module_feedback(
                    module.get("status"),
                    module.get("score", 0)
                )
            })
        
        # Build next steps
        if not is_eligible:
            for detail in validation["failure_details"]:
                if detail["type"] == "overall_score":
                    validation["next_steps"].append(
                        f"Improve your score by {detail['gap']:.1f}%"
                    )
                elif detail["type"] == "incomplete_modules":
                    validation["next_steps"].append(
                        f"Complete {detail['remaining']} module(s)"
                    )
                elif detail["type"] == "failing_modules":
                    for module in detail["failing_list"][:2]:
                        validation["next_steps"].append(
                            f"Improve {module['name']}: need {module['gap']:.1f}% more"
                        )
        
        validation["summary"] = CertificateValidator._build_summary(validation)
        
        return validation
    
    @staticmethod
    def _get_module_feedback(status: str, score: float) -> str:
        """Get feedback message for a module"""
        if status == "completed":
            return f"Passed with {score:.1f}%"
        elif status == "failed":
            return f"Failed with {score:.1f}% (need 80%)"
        elif status == "in_progress":
            return f"In progress - {score:.1f}% (need 80%)"
        elif status == "not_started":
            return "Not started"
        return f"Status: {status}"
    
    @staticmethod
    def _build_summary(validation: Dict) -> str:
        """Build a concise summary message"""
        if validation["eligible"]:
            return f"Ready for certificate! Overall score: {validation['overall_score']}%"
        
        actions = []
        for detail in validation["failure_details"]:
            if detail["type"] == "overall_score":
                actions.append(f"Improve score by {detail['gap']:.1f}%")
            elif detail["type"] == "incomplete_modules":
                actions.append(f"Complete {detail['remaining']} module(s)")
            elif detail["type"] == "failing_modules":
                actions.append(f"Fix {detail['count']} failing module(s)")
        
        return " • ".join(actions) if actions else "Requirements not met"
