"""
VBA Macro Analyzer - Extracts and analyzes VBA code from .xlsm files.

Uses oletools (if available) or zipfile-based extraction as fallback.
Analyses: code quality, security, automation patterns, naming conventions.
"""

import logging
import re
import zipfile
from io import BytesIO
from typing import Dict, Any, List, Optional

logger = logging.getLogger(__name__)

# Suspicious patterns for security analysis
SUSPICIOUS_PATTERNS = [
    (r'Shell\s*\(', 'Shell command execution'),
    (r'CreateObject\s*\(\s*["\']WScript', 'WScript object creation'),
    (r'CreateObject\s*\(\s*["\']Scripting\.FileSystemObject', 'FileSystemObject access'),
    (r'Kill\s+', 'File deletion (Kill)'),
    (r'Environ\s*\(', 'Environment variable access'),
    (r'SendKeys\s', 'SendKeys automation'),
    (r'Open\s+.*For\s+Output', 'File write operation'),
    (r'CallByName\s*\(', 'CallByName dynamic invocation'),
    (r'MacScript\s*\(', 'MacScript execution'),
    (r'DeleteFile|DeleteFolder', 'File/Folder deletion'),
    (r'\.Run\s', 'External process execution'),
    (r'PowerShell|cmd\.exe|wscript\.exe', 'External shell reference'),
    (r'URLDownloadToFile|XMLHTTP|WinHttpRequest', 'Network download/request'),
    (r'RegWrite|RegDelete|RegRead', 'Windows Registry access'),
    (r'Auto_Open|AutoExec|Workbook_Open|Document_Open', 'Auto-execute macro'),
]

# VBA code quality patterns
GOOD_PRACTICES = [
    (r'Option\s+Explicit', 'Uses Option Explicit'),
    (r'On\s+Error\s+', 'Has error handling'),
    (r"'[^\n]+", 'Has code comments'),
    (r'(Private|Public)\s+(Sub|Function)', 'Uses access modifiers'),
    (r'Const\s+', 'Uses constants'),
    (r'Dim\s+\w+\s+As\s+', 'Uses typed declarations'),
    (r'(Do\s+While|For\s+Each|For\s+\w+\s*=)', 'Uses loops'),
    (r'(If\s+.+\s+Then|Select\s+Case)', 'Uses conditional logic'),
    (r'(Private\s+)?Sub\s+\w+|Function\s+\w+', 'Uses procedures/functions'),
    (r'MsgBox\s|InputBox\s', 'Has user interaction (MsgBox/InputBox)'),
]

# Automation patterns
AUTOMATION_PATTERNS = [
    (r'Range\s*\(|Cells\s*\(|\.Value\s*=', 'Cell manipulation'),
    (r'Worksheets?\s*\(|Sheets?\s*\(', 'Sheet operations'),
    (r'ActiveWorkbook|ThisWorkbook', 'Workbook references'),
    (r'\.AutoFilter|\.AdvancedFilter', 'Filter operations'),
    (r'\.Sort\s|\.SortFields', 'Sort operations'),
    (r'\.PivotTables\(|\.PivotFields', 'PivotTable manipulation'),
    (r'Charts?\s*\(|\.ChartObjects', 'Chart manipulation'),
    (r'UserForm|\.Show\b', 'UserForm interaction'),
    (r'Application\.ScreenUpdating|Application\.Calculation', 'Performance optimization'),
    (r'ADODB|Connection|Recordset', 'Database connectivity'),
    (r'Dir\s*\(|FileLen|FileCopy', 'File system operations'),
    (r'Format\s*\(|\.NumberFormat', 'Formatting operations'),
]


class VBAAnalyzer:
    """Analyzes VBA macros extracted from Excel files."""

    def __init__(self, file_bytes: bytes, analysis_data: Dict[str, Any]):
        self.file_bytes = file_bytes
        self.analysis_data = analysis_data
        self.vba_modules: List[Dict[str, Any]] = []

    def analyze(self) -> Dict[str, Any]:
        """Run full VBA analysis."""
        if not self.analysis_data.get('has_vba', False):
            return {
                'has_vba': False,
                'module_count': 0,
                'modules': [],
                'security': {'safe': True, 'issues': []},
                'code_quality': {},
                'automation_patterns': [],
                'summary': 'No VBA macros found in this workbook.',
            }

        # Extract VBA modules
        self._extract_vba()

        if not self.vba_modules:
            return {
                'has_vba': True,
                'module_count': 0,
                'modules': [],
                'security': {'safe': True, 'issues': []},
                'code_quality': {},
                'automation_patterns': [],
                'summary': 'VBA archive detected but no extractable modules found.',
            }

        security = self._analyze_security()
        quality = self._analyze_code_quality()
        automation = self._analyze_automation()
        structure = self._analyze_structure()

        return {
            'has_vba': True,
            'module_count': len(self.vba_modules),
            'modules': [{
                'name': m['name'],
                'type': m.get('type', 'module'),
                'line_count': m.get('line_count', 0),
                'procedure_count': m.get('procedure_count', 0),
                'procedures': m.get('procedures', []),
                'code_preview': m.get('code', '')[:500],
            } for m in self.vba_modules],
            'total_lines': sum(m.get('line_count', 0) for m in self.vba_modules),
            'total_procedures': sum(m.get('procedure_count', 0) for m in self.vba_modules),
            'security': security,
            'code_quality': quality,
            'automation_patterns': automation,
            'structure': structure,
        }

    def _extract_vba(self):
        """Extract VBA module source code from the file."""
        # Try oletools first
        try:
            self._extract_with_oletools()
            if self.vba_modules:
                return
        except ImportError:
            logger.debug("oletools not available, using ZIP fallback")
        except Exception as e:
            logger.debug(f"oletools extraction failed: {e}")

        # Fallback: extract from zip (vbaProject.bin is OLE, but we can try)
        self._extract_from_zip()

    def _extract_with_oletools(self):
        """Extract VBA using oletools library."""
        from oletools.olevba import VBA_Parser

        buf = BytesIO(self.file_bytes)
        vba_parser = VBA_Parser('file.xlsm', data=buf.read())

        if vba_parser.detect_vba_macros():
            for (filename, stream_path, vba_filename, vba_code) in vba_parser.extract_macros():
                if vba_code and vba_code.strip():
                    mod_type = 'module'
                    if 'ThisWorkbook' in vba_filename:
                        mod_type = 'workbook'
                    elif 'Sheet' in vba_filename:
                        mod_type = 'sheet'
                    elif vba_filename.startswith('frm') or 'UserForm' in vba_filename:
                        mod_type = 'userform'

                    lines = vba_code.strip().split('\n')
                    procedures = self._extract_procedures(vba_code)

                    self.vba_modules.append({
                        'name': vba_filename,
                        'type': mod_type,
                        'code': vba_code,
                        'line_count': len(lines),
                        'procedure_count': len(procedures),
                        'procedures': procedures,
                    })

        vba_parser.close()

    def _extract_from_zip(self):
        """Try to find VBA project info from the .xlsm ZIP structure."""
        try:
            buf = BytesIO(self.file_bytes)
            with zipfile.ZipFile(buf, 'r') as zf:
                vba_files = [n for n in zf.namelist()
                             if 'vba' in n.lower() or n.endswith('.bin')]

                # We can detect the presence but can't easily read OLE from zip
                # Mark that VBA exists but modules couldn't be extracted without oletools
                if vba_files and not self.vba_modules:
                    self.vba_modules.append({
                        'name': 'VBAProject (binary)',
                        'type': 'binary',
                        'code': '',
                        'line_count': 0,
                        'procedure_count': 0,
                        'procedures': [],
                        'note': 'VBA project detected in binary format. Install oletools for full analysis.',
                    })
        except Exception as e:
            logger.debug(f"ZIP VBA extraction failed: {e}")

    def _extract_procedures(self, code: str) -> List[Dict[str, Any]]:
        """Extract Sub/Function definitions from VBA code."""
        procedures = []
        pattern = re.compile(
            r'(Private\s+|Public\s+)?(Sub|Function)\s+(\w+)\s*\(([^)]*)\)',
            re.IGNORECASE
        )

        for match in pattern.finditer(code):
            access = (match.group(1) or '').strip()
            proc_type = match.group(2)
            name = match.group(3)
            params = match.group(4).strip()

            procedures.append({
                'name': name,
                'type': proc_type,
                'access': access or 'Public',
                'parameters': params,
            })

        return procedures

    def _analyze_security(self) -> Dict[str, Any]:
        """Scan VBA code for suspicious/malicious patterns."""
        issues = []
        all_code = '\n'.join(m.get('code', '') for m in self.vba_modules)

        for pattern, description in SUSPICIOUS_PATTERNS:
            if re.search(pattern, all_code, re.IGNORECASE):
                # Find which module(s) contain this pattern
                locations = []
                for m in self.vba_modules:
                    if re.search(pattern, m.get('code', ''), re.IGNORECASE):
                        locations.append(m['name'])

                issues.append({
                    'pattern': description,
                    'severity': 'high' if 'Shell' in description or 'execute' in description.lower() else 'medium',
                    'modules': locations,
                })

        return {
            'safe': len(issues) == 0,
            'issue_count': len(issues),
            'issues': issues,
            'risk_level': 'high' if any(i['severity'] == 'high' for i in issues) else
                         'medium' if issues else 'low',
        }

    def _analyze_code_quality(self) -> Dict[str, Any]:
        """Assess VBA code quality."""
        all_code = '\n'.join(m.get('code', '') for m in self.vba_modules)

        if not all_code.strip():
            return {
                'score': 0,
                'practices_found': [],
                'practices_missing': [],
                'note': 'No extractable VBA code for quality analysis.',
            }

        found = []
        missing = []

        for pattern, description in GOOD_PRACTICES:
            if re.search(pattern, all_code, re.IGNORECASE):
                found.append(description)
            else:
                missing.append(description)

        # Naming analysis
        naming_issues = []
        for m in self.vba_modules:
            for proc in m.get('procedures', []):
                name = proc.get('name', '')
                # Check for single-letter or very short names
                if len(name) <= 2 and name not in ('If', 'Or'):
                    naming_issues.append(f"Procedure '{name}' has a very short name.")
                # Check for naming convention (PascalCase or camelCase)
                if name and not name[0].isupper() and not name.startswith('_'):
                    naming_issues.append(f"Procedure '{name}' doesn't follow PascalCase convention.")

        # Calculate quality score
        total_practices = len(GOOD_PRACTICES)
        quality_score = round(len(found) / max(total_practices, 1) * 100)

        # Modularity: procedures per module
        total_procs = sum(m.get('procedure_count', 0) for m in self.vba_modules)
        module_count = max(len([m for m in self.vba_modules if m.get('code', '').strip()]), 1)
        avg_procs_per_module = round(total_procs / module_count, 1)

        return {
            'score': quality_score,
            'practices_found': found,
            'practices_missing': missing,
            'naming_issues': naming_issues[:10],
            'modularity': {
                'total_procedures': total_procs,
                'module_count': module_count,
                'avg_procedures_per_module': avg_procs_per_module,
            },
        }

    def _analyze_automation(self) -> List[Dict[str, str]]:
        """Detect automation patterns in VBA code."""
        all_code = '\n'.join(m.get('code', '') for m in self.vba_modules)
        found = []

        for pattern, description in AUTOMATION_PATTERNS:
            if re.search(pattern, all_code, re.IGNORECASE):
                found.append({'pattern': description})

        return found

    def _analyze_structure(self) -> Dict[str, Any]:
        """Analyze overall VBA project structure."""
        module_types = {}
        for m in self.vba_modules:
            t = m.get('type', 'module')
            module_types[t] = module_types.get(t, 0) + 1

        return {
            'module_types': module_types,
            'has_userforms': module_types.get('userform', 0) > 0,
            'has_class_modules': module_types.get('class', 0) > 0,
            'has_workbook_events': module_types.get('workbook', 0) > 0,
            'has_sheet_events': module_types.get('sheet', 0) > 0,
        }
