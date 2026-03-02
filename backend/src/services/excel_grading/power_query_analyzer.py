"""
Power Query (M Language) Analyzer

Extracts Power Query queries from .xlsx/.xlsm files by parsing
the customXml or xl/connections parts of the OOXML package,
and the [Content_Types].xml for Power Query references.

Parses M code to detect: transformations, merges, filters, groupBy,
source types, and validates expected data transformations.
"""

import logging
import re
import zipfile
from io import BytesIO
from typing import Dict, Any, List
from xml.etree import ElementTree as ET

logger = logging.getLogger(__name__)

# M language transformation patterns
M_TRANSFORMATIONS = {
    'Table.SelectRows': 'Filter rows',
    'Table.RemoveColumns': 'Remove columns',
    'Table.RenameColumns': 'Rename columns',
    'Table.AddColumn': 'Add custom column',
    'Table.TransformColumns': 'Transform column types',
    'Table.TransformColumnTypes': 'Change column types',
    'Table.Group': 'Group by',
    'Table.Sort': 'Sort rows',
    'Table.Distinct': 'Remove duplicates',
    'Table.Skip': 'Skip rows',
    'Table.FirstN': 'Keep top N rows',
    'Table.ExpandTableColumn': 'Expand table column',
    'Table.ExpandRecordColumn': 'Expand record column',
    'Table.Pivot': 'Pivot column',
    'Table.Unpivot': 'Unpivot columns',
    'Table.UnpivotOtherColumns': 'Unpivot other columns',
    'Table.FillDown': 'Fill down',
    'Table.FillUp': 'Fill up',
    'Table.ReplaceValue': 'Replace values',
    'Table.SplitColumn': 'Split column',
    'Table.CombineColumns': 'Combine columns',
    'Table.NestedJoin': 'Merge queries (join)',
    'Table.Join': 'Join tables',
    'Table.Combine': 'Append queries',
    'Table.FromList': 'Create from list',
    'Table.FromRecords': 'Create from records',
    'Table.PromoteHeaders': 'Promote headers',
    'Table.DemoteHeaders': 'Demote headers',
    'Table.Buffer': 'Buffer table',
    'Table.SelectColumns': 'Select columns',
    'Table.ReorderColumns': 'Reorder columns',
    'List.Transform': 'List transform',
    'List.Select': 'List filter',
    'List.Accumulate': 'List accumulate',
    'Text.Split': 'Text split',
    'Text.Combine': 'Text combine',
    'Text.Replace': 'Text replace',
    'Text.Clean': 'Text clean',
    'Text.Trim': 'Text trim',
    'Number.Round': 'Number round',
    'Date.From': 'Date conversion',
    'DateTime.From': 'DateTime conversion',
    'Duration.TotalDays': 'Duration calculation',
    'Record.Field': 'Record field access',
    'Value.ReplaceType': 'Type conversion',
}

# Data source patterns in M
M_DATA_SOURCES = {
    'Excel.Workbook': 'Excel file',
    'Csv.Document': 'CSV file',
    'Sql.Database': 'SQL Server',
    'Sql.Databases': 'SQL Server databases',
    'OData.Feed': 'OData feed',
    'Web.Contents': 'Web page/API',
    'Web.Page': 'Web page',
    'Json.Document': 'JSON',
    'Xml.Document': 'XML',
    'Folder.Files': 'Folder',
    'SharePoint.Files': 'SharePoint',
    'Access.Database': 'Access database',
    'Odbc.DataSource': 'ODBC connection',
    'Oracle.Database': 'Oracle database',
    'MySQL.Database': 'MySQL database',
    'PostgreSQL.Database': 'PostgreSQL database',
    'File.Contents': 'Local file',
    'AzureStorage.Blobs': 'Azure Blob Storage',
    '#table': 'Manual table',
    'Table.FromRows': 'Manual table from rows',
}


class PowerQueryAnalyzer:
    """Analyzes Power Query / M language code from Excel files."""

    def __init__(self, file_bytes: bytes, analysis_data: Dict[str, Any]):
        self.file_bytes = file_bytes
        self.analysis_data = analysis_data
        self.queries: List[Dict[str, Any]] = []

    def analyze(self) -> Dict[str, Any]:
        """Run Power Query analysis."""
        ext = self.analysis_data.get('file_type', '')
        if ext not in ('xlsx', 'xlsm'):
            return {
                'has_power_query': False,
                'query_count': 0,
                'queries': [],
                'note': f'.{ext} files do not support Power Query detection.',
            }

        # Extract queries
        self._extract_queries()

        if not self.queries:
            return {
                'has_power_query': False,
                'query_count': 0,
                'queries': [],
            }

        # Analyze each query
        all_transformations = set()
        all_sources = set()
        total_steps = 0

        for q in self.queries:
            m_code = q.get('m_code', '')
            analysis = self._analyze_m_code(m_code)
            q['analysis'] = analysis
            all_transformations.update(analysis.get('transformations_used', []))
            all_sources.update(analysis.get('data_sources', []))
            total_steps += analysis.get('step_count', 0)

        return {
            'has_power_query': True,
            'query_count': len(self.queries),
            'queries': [{
                'name': q.get('name', ''),
                'step_count': q.get('analysis', {}).get('step_count', 0),
                'transformations': q.get('analysis', {}).get('transformations_used', []),
                'data_sources': q.get('analysis', {}).get('data_sources', []),
                'has_merge': q.get('analysis', {}).get('has_merge', False),
                'has_group_by': q.get('analysis', {}).get('has_group_by', False),
                'has_filter': q.get('analysis', {}).get('has_filter', False),
                'complexity_score': q.get('analysis', {}).get('complexity_score', 0),
                'm_code_preview': (q.get('m_code', '') or '')[:400],
            } for q in self.queries],
            'all_transformations': sorted(all_transformations),
            'all_data_sources': sorted(all_sources),
            'total_steps': total_steps,
        }

    def _extract_queries(self):
        """Extract Power Query M code from the .xlsx/.xlsm archive."""
        buf = BytesIO(self.file_bytes)
        try:
            with zipfile.ZipFile(buf, 'r') as zf:
                # Method 1: customXml (Power Query stores queries here)
                self._extract_from_custom_xml(zf)

                # Method 2: xl/connections.xml
                if not self.queries:
                    self._extract_from_connections(zf)

                # Method 3: Look for query table parts
                if not self.queries:
                    self._extract_from_query_tables(zf)

        except Exception as e:
            logger.warning(f"Power Query extraction failed: {e}")

    def _extract_from_custom_xml(self, zf: zipfile.ZipFile):
        """Extract queries from customXml parts."""
        for name in zf.namelist():
            if 'customXml' in name and name.endswith('.xml'):
                try:
                    with zf.open(name) as f:
                        content = f.read().decode('utf-8', errors='replace')

                    # Power Query stores queries in a specific format
                    # Look for M code patterns
                    if 'let' in content.lower() and ('in' in content.lower() or 'Source' in content):
                        # Try to extract individual queries
                        queries = self._parse_m_queries_from_xml(content)
                        self.queries.extend(queries)

                except Exception as e:
                    logger.debug(f"Error reading customXml {name}: {e}")

    def _extract_from_connections(self, zf: zipfile.ZipFile):
        """Extract from xl/connections.xml."""
        try:
            if 'xl/connections.xml' in zf.namelist():
                with zf.open('xl/connections.xml') as f:
                    tree = ET.parse(f)
                    root = tree.getroot()

                ns = {'sp': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
                for conn in root.iter('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}connection'):
                    name = conn.attrib.get('name', 'Unknown')
                    desc = conn.attrib.get('description', '')

                    # Power Query connections often have the M code in description
                    if 'Power Query' in desc or 'let' in desc.lower():
                        self.queries.append({
                            'name': name,
                            'm_code': desc,
                        })
        except Exception as e:
            logger.debug(f"Connections extraction failed: {e}")

    def _extract_from_query_tables(self, zf: zipfile.ZipFile):
        """Extract from xl/queryTables/ parts."""
        for name in zf.namelist():
            if 'queryTable' in name and name.endswith('.xml'):
                try:
                    with zf.open(name) as f:
                        content = f.read().decode('utf-8', errors='replace')

                    # Look for connection references
                    if 'Power Query' in content or 'powerquery' in content.lower():
                        self.queries.append({
                            'name': name.split('/')[-1].replace('.xml', ''),
                            'm_code': '',
                            'note': 'Query table detected but M code not directly extractable.',
                        })
                except Exception as e:
                    logger.debug(f"Error reading queryTable {name}: {e}")

    def _parse_m_queries_from_xml(self, xml_content: str) -> List[Dict[str, Any]]:
        """Parse individual M queries from XML content."""
        queries = []

        # Pattern for Power Query formula blocks
        # Power Query stores M code in specific XML elements
        # Try multiple extraction patterns

        # Pattern 1: Look for formula content between tags
        formula_pattern = re.compile(
            r'<(?:\w+:)?Formula[^>]*>(.*?)</(?:\w+:)?Formula>',
            re.DOTALL | re.IGNORECASE
        )

        for match in formula_pattern.finditer(xml_content):
            m_code = match.group(1).strip()
            if m_code and len(m_code) > 10:
                # Unescape XML entities
                m_code = (m_code.replace('&amp;', '&')
                                .replace('&lt;', '<')
                                .replace('&gt;', '>')
                                .replace('&quot;', '"')
                                .replace('&#xD;', '\r')
                                .replace('&#xA;', '\n')
                                .replace('&#x9;', '\t'))

                # Extract query name from 'let' block
                name_match = re.search(r'//\s*(\w+)\s*$|(\w+)\s*=\s*let', m_code[:200], re.MULTILINE)
                name = name_match.group(1) or name_match.group(2) if name_match else f'Query_{len(queries)+1}'

                queries.append({
                    'name': name,
                    'm_code': m_code,
                })

        # Pattern 2: Look for raw 'let ... in ...' blocks
        if not queries:
            let_pattern = re.compile(
                r'(let\s+.*?in\s+\w+)',
                re.DOTALL | re.IGNORECASE
            )
            for match in let_pattern.finditer(xml_content):
                m_code = match.group(1).strip()
                if len(m_code) > 20:
                    queries.append({
                        'name': f'Query_{len(queries)+1}',
                        'm_code': m_code,
                    })

        return queries

    def _analyze_m_code(self, m_code: str) -> Dict[str, Any]:
        """Analyze a single Power Query M code block."""
        if not m_code or not m_code.strip():
            return {
                'step_count': 0,
                'transformations_used': [],
                'data_sources': [],
                'has_merge': False,
                'has_group_by': False,
                'has_filter': False,
                'complexity_score': 0,
            }

        # Count steps (each = assignment in let block)
        steps = re.findall(r'(\w+)\s*=\s', m_code)
        step_count = len(steps)

        # Detect transformations
        transformations_used = []
        for func, description in M_TRANSFORMATIONS.items():
            if func in m_code or func.lower() in m_code.lower():
                transformations_used.append(description)

        # Detect data sources
        data_sources = []
        for source, description in M_DATA_SOURCES.items():
            if source in m_code or source.lower() in m_code.lower():
                data_sources.append(description)

        # Specific feature detection
        has_merge = 'NestedJoin' in m_code or 'Table.Join' in m_code
        has_group_by = 'Table.Group' in m_code
        has_filter = 'Table.SelectRows' in m_code or 'List.Select' in m_code

        # Complexity scoring
        complexity = self._compute_m_complexity(
            step_count, transformations_used, data_sources, has_merge, has_group_by
        )

        return {
            'step_count': step_count,
            'transformations_used': transformations_used,
            'data_sources': data_sources,
            'has_merge': has_merge,
            'has_group_by': has_group_by,
            'has_filter': has_filter,
            'complexity_score': complexity,
        }

    def _compute_m_complexity(
        self, step_count, transformations, sources, has_merge, has_group_by
    ) -> int:
        """Compute M code complexity score 0-100."""
        score = 0

        # Steps (0-25)
        score += min(25, step_count * 3)

        # Transformation diversity (0-30)
        score += min(30, len(transformations) * 4)

        # Data source diversity (0-15)
        score += min(15, len(sources) * 5)

        # Merge operations (0-15)
        if has_merge:
            score += 15

        # Group by (0-15)
        if has_group_by:
            score += 15

        return min(100, score)


def check_required_queries(
    pq_analysis: Dict[str, Any],
    required_transformations: List[str] = None,
    min_queries: int = 1,
) -> Dict[str, Any]:
    """
    Check Power Query requirements compliance.

    Args:
        pq_analysis: Output of PowerQueryAnalyzer.analyze()
        required_transformations: e.g. ['Filter rows', 'Group by', 'Merge queries (join)']
        min_queries: Minimum number of queries expected.
    """
    issues = []
    met = 0
    total = 0

    # Query count
    total += 1
    if pq_analysis.get('query_count', 0) >= min_queries:
        met += 1
    else:
        issues.append(f"Expected at least {min_queries} Power Query query(ies), found {pq_analysis.get('query_count', 0)}.")

    # Required transformations
    if required_transformations:
        all_trans = set(pq_analysis.get('all_transformations', []))
        for req in required_transformations:
            total += 1
            if req in all_trans:
                met += 1
            else:
                issues.append(f"Required transformation '{req}' not found.")

    compliance = round(met / max(total, 1) * 100, 1)

    return {
        'compliance_pct': compliance,
        'issues': issues,
        'met_requirements': met,
        'total_requirements': total,
    }
