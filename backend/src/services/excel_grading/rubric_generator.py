"""
Intelligent Rubric Generator

Deeply parses assignment instructions to automatically build a task-specific
rubric when no instructor rubric is provided.  Understands:

  - Multi-part assignments (Part 1, Part 2, …)
  - Numbered tasks / questions
  - Expected Excel features (PivotTables, Data Model, Calculated Items, …)
  - Theoretical / written reflection questions
  - Relative complexity weighting

The generated rubric feeds directly into ``GradingEngine._build_rubric()``.
"""

import re
import logging
from typing import Dict, Any, List, Optional, Tuple

logger = logging.getLogger(__name__)

# ──────────────────────────────────────────────────────────────────────
# Concept vocabulary — maps keywords in instructions to concepts the
# grading engine can verify.  Each entry:
#   keyword  →  (concept_id, category, base_weight, description)
#
# 250+ entries covering Foundation → Expert level Excel concepts
# ──────────────────────────────────────────────────────────────────────

_CONCEPT_VOCABULARY: List[Tuple[str, str, str, float, str]] = [
    # keyword,             concept_id,             category,       weight, human label

    # ═══════════════════════════════════════════════════════════════════
    # PivotTable family (Intermediate → Expert)
    # ═══════════════════════════════════════════════════════════════════
    ('pivot table',        'pivot_table',          'PivotTables',  3.0,  'PivotTable creation'),
    ('pivottable',         'pivot_table',          'PivotTables',  3.0,  'PivotTable creation'),
    ('pivot chart',        'pivot_chart',          'Charts',       2.0,  'PivotChart creation'),
    ('pivotchart',         'pivot_chart',          'Charts',       2.0,  'PivotChart creation'),
    ('calculated item',    'calc_item',            'PivotTables',  4.0,  'Calculated Item implementation'),
    ('calculated field',   'calc_field',           'PivotTables',  3.5,  'Calculated Field creation'),
    ('slicer',             'slicer',               'PivotTables',  2.0,  'Slicer / timeline usage'),
    ('timeline',           'slicer',               'PivotTables',  2.0,  'Timeline usage'),
    ('data model',         'data_model',           'PivotTables',  4.0,  'Data Model / relationships'),
    ('relationship',       'relationship',         'PivotTables',  3.5,  'Table relationship definition'),
    ('one-to-many',        'relationship',         'PivotTables',  3.0,  'One-to-Many relationship'),
    ('many-to-one',        'relationship',         'PivotTables',  3.0,  'Many-to-One relationship'),
    ('fact table',         'data_model',           'PivotTables',  2.5,  'Fact table identification'),
    ('lookup table',       'data_model',           'PivotTables',  2.5,  'Lookup table identification'),
    ('dimension table',    'data_model',           'PivotTables',  2.5,  'Dimension table identification'),
    ('report layout',      'report_layout',        'PivotTables',  2.0,  'Report layout design'),
    ('getpivotdata',       'getpivotdata',         'PivotTables',  3.0,  'GETPIVOTDATA function'),
    ('pivot grouping',     'pivot_grouping',       'PivotTables',  2.5,  'PivotTable grouping'),
    ('group by date',      'pivot_grouping',       'PivotTables',  2.5,  'PivotTable date grouping'),
    ('group dates',        'pivot_grouping',       'PivotTables',  2.5,  'PivotTable date grouping'),
    ('value field setting', 'value_field_settings', 'PivotTables', 2.0,  'Value Field Settings'),
    ('show values as',     'show_values_as',       'PivotTables',  2.5,  'Show Values As (% of, difference)'),
    ('report filter',      'report_filter',        'PivotTables',  2.0,  'Report filter in PivotTable'),
    ('pivot cache',        'pivot_cache',          'PivotTables',  2.0,  'PivotTable cache management'),
    ('refresh pivot',      'pivot_refresh',        'PivotTables',  1.5,  'PivotTable refresh'),
    ('drill down',         'drill_down',           'PivotTables',  2.0,  'PivotTable drill-down'),
    ('power pivot',        'power_pivot',          'PivotTables',  4.5,  'Power Pivot / DAX'),
    ('dax',                'dax',                  'PivotTables',  4.5,  'DAX measures'),
    ('measure',            'dax_measure',          'PivotTables',  3.5,  'DAX measure creation'),

    # ═══════════════════════════════════════════════════════════════════
    # Formula / function family (Foundation → Expert)
    # ═══════════════════════════════════════════════════════════════════

    # -- Basic functions (Foundation) --
    ('sum function',       'sum_func',             'Formulas',     1.5,  'SUM function'),
    ('average function',   'avg_func',             'Formulas',     1.5,  'AVERAGE function'),
    ('count function',     'count_func',           'Formulas',     1.5,  'COUNT function'),
    ('min function',       'min_func',             'Formulas',     1.0,  'MIN function'),
    ('max function',       'max_func',             'Formulas',     1.0,  'MAX function'),
    ('round function',     'round_func',           'Formulas',     1.5,  'ROUND function'),

    # -- Lookup functions (Intermediate → Advanced) --
    ('vlookup',            'vlookup',              'Formulas',     3.0,  'VLOOKUP function'),
    ('xlookup',            'xlookup',              'Formulas',     3.0,  'XLOOKUP function'),
    ('hlookup',            'hlookup',              'Formulas',     2.5,  'HLOOKUP function'),
    ('index',              'index_match',          'Formulas',     3.0,  'INDEX function'),
    ('match',              'index_match',          'Formulas',     3.0,  'MATCH function'),
    ('index/match',        'index_match',          'Formulas',     3.5,  'INDEX/MATCH combination'),
    ('xmatch',             'xmatch',               'Formulas',     3.0,  'XMATCH function'),
    ('lookup function',    'lookup_general',       'Formulas',     2.5,  'Lookup functions'),

    # -- Conditional aggregation (Intermediate) --
    ('sumif',              'sumif',                'Formulas',     2.5,  'SUMIF/SUMIFS function'),
    ('sumifs',             'sumif',                'Formulas',     2.5,  'SUMIFS function'),
    ('countif',            'countif',              'Formulas',     2.5,  'COUNTIF/COUNTIFS function'),
    ('countifs',           'countif',              'Formulas',     2.5,  'COUNTIFS function'),
    ('averageif',          'averageif',            'Formulas',     2.5,  'AVERAGEIF/AVERAGEIFS'),
    ('maxifs',             'maxifs',               'Formulas',     3.0,  'MAXIFS function'),
    ('minifs',             'minifs',               'Formulas',     3.0,  'MINIFS function'),
    ('sumproduct',         'sumproduct',           'Formulas',     3.0,  'SUMPRODUCT function'),

    # -- Error handling --
    ('iferror',            'iferror',              'Formulas',     2.0,  'IFERROR error handling'),
    ('ifna',               'ifna',                 'Formulas',     2.0,  'IFNA error handling'),
    ('error handling',     'error_handling',       'Formulas',     2.0,  'Formula error handling'),

    # -- Logical functions --
    ('if function',        'if_func',              'Formulas',     2.0,  'IF function'),
    ('nested if',          'nested_if',            'Formulas',     3.0,  'Nested IF formulas'),
    ('ifs function',       'ifs_func',             'Formulas',     2.5,  'IFS function'),
    ('switch function',    'switch_func',          'Formulas',     2.5,  'SWITCH function'),
    ('conditional formula','cond_formula',         'Formulas',     2.5,  'Conditional formulas'),
    ('logical function',   'logical_funcs',        'Formulas',     2.0,  'Logical functions (AND, OR, NOT)'),

    # -- Text functions --
    ('text function',      'text_funcs',           'Formulas',     2.0,  'Text functions'),
    ('concatenate',        'concat',               'Formulas',     1.5,  'CONCATENATE function'),
    ('textjoin',           'textjoin',             'Formulas',     2.0,  'TEXTJOIN function'),
    ('left function',      'left_right',           'Formulas',     1.5,  'LEFT function'),
    ('right function',     'left_right',           'Formulas',     1.5,  'RIGHT function'),
    ('mid function',       'mid_func',             'Formulas',     1.5,  'MID function'),
    ('text to columns',    'text_to_columns',      'Formulas',     2.0,  'Text to Columns'),
    ('flash fill',         'flash_fill',           'Formulas',     2.0,  'Flash Fill'),
    ('substitute',         'substitute',           'Formulas',     2.0,  'SUBSTITUTE function'),

    # -- Date functions --
    ('date function',      'date_funcs',           'Formulas',     2.0,  'Date functions'),
    ('datedif',            'datedif',              'Formulas',     2.5,  'DATEDIF function'),
    ('edate',              'edate',                'Formulas',     2.0,  'EDATE function'),
    ('eomonth',            'eomonth',              'Formulas',     2.0,  'EOMONTH function'),
    ('networkdays',        'networkdays',          'Formulas',     2.5,  'NETWORKDAYS function'),
    ('workday',            'workday',              'Formulas',     2.5,  'WORKDAY function'),

    # -- Dynamic array functions (Advanced → Expert) --
    ('array formula',      'array_formula',        'Formulas',     3.5,  'Array formula usage'),
    ('dynamic array',      'dynamic_array',        'Formulas',     3.5,  'Dynamic array function'),
    ('filter function',    'filter_func',          'Formulas',     3.0,  'FILTER function'),
    ('sort function',      'sort_func',            'Formulas',     3.0,  'SORT function'),
    ('sortby function',    'sortby_func',          'Formulas',     3.0,  'SORTBY function'),
    ('unique function',    'unique_func',          'Formulas',     3.0,  'UNIQUE function'),
    ('sequence function',  'sequence_func',        'Formulas',     3.0,  'SEQUENCE function'),
    ('spill range',        'spill_range',          'Formulas',     3.0,  'Spill range / # operator'),
    ('spill',              'spill_range',          'Formulas',     2.5,  'Spill range formula'),

    # -- Expert-tier functions --
    ('lambda',             'lambda',               'Formulas',     4.0,  'LAMBDA function'),
    ('let function',       'let',                  'Formulas',     3.5,  'LET function'),
    ('map function',       'map_func',             'Formulas',     4.0,  'MAP function'),
    ('reduce function',    'reduce_func',          'Formulas',     4.0,  'REDUCE function'),
    ('scan function',      'scan_func',            'Formulas',     4.0,  'SCAN function'),
    ('byrow',              'byrow',                'Formulas',     4.0,  'BYROW function'),
    ('bycol',              'bycol',                'Formulas',     4.0,  'BYCOL function'),
    ('makearray',          'makearray',            'Formulas',     4.0,  'MAKEARRAY function'),
    ('hstack',             'hstack',               'Formulas',     3.5,  'HSTACK function'),
    ('vstack',             'vstack',               'Formulas',     3.5,  'VSTACK function'),

    # -- Financial functions --
    ('financial function', 'financial_funcs',      'Formulas',     3.0,  'Financial functions'),
    ('pmt function',       'pmt',                  'Formulas',     3.0,  'PMT function'),
    ('npv',                'npv',                  'Formulas',     3.5,  'NPV function'),
    ('irr',                'irr',                  'Formulas',     3.5,  'IRR function'),
    ('xnpv',               'xnpv',                'Formulas',     4.0,  'XNPV function'),
    ('xirr',               'xirr',                'Formulas',     4.0,  'XIRR function'),
    ('loan calculation',   'loan_calc',            'Formulas',     3.0,  'Loan calculations'),
    ('amortisation',       'amortisation',         'Formulas',     3.5,  'Amortisation schedule'),
    ('amortization',       'amortisation',         'Formulas',     3.5,  'Amortization schedule'),
    ('depreciation',       'depreciation',         'Formulas',     3.0,  'Depreciation calculations'),

    # -- Statistical functions --
    ('statistical function', 'stat_funcs',         'Formulas',     3.0,  'Statistical functions'),
    ('regression',         'regression',           'Formulas',     4.0,  'Regression analysis'),
    ('forecast',           'forecast',             'Formulas',     3.5,  'FORECAST function'),
    ('trend analysis',     'trend',                'Formulas',     3.5,  'Trend analysis'),
    ('correlation',        'correlation',          'Formulas',     3.5,  'CORREL function'),
    ('standard deviation', 'stdev',                'Formulas',     3.0,  'Standard deviation'),
    ('variance',           'variance_calc',        'Formulas',     3.0,  'Variance calculation'),
    ('percentile',         'percentile',           'Formulas',     3.0,  'PERCENTILE function'),
    ('quartile',           'quartile',             'Formulas',     3.0,  'QUARTILE function'),
    ('frequency',          'frequency',            'Formulas',     3.0,  'FREQUENCY function'),
    ('hypothesis test',    'hypothesis',           'Formulas',     4.0,  'Hypothesis testing'),

    # -- Database functions --
    ('database function',  'db_funcs',             'Formulas',     3.0,  'Database functions'),
    ('dsum',               'dsum',                 'Formulas',     2.5,  'DSUM function'),
    ('dget',               'dget',                 'Formulas',     2.5,  'DGET function'),
    ('dcount',             'dcount',               'Formulas',     2.5,  'DCOUNT function'),
    ('daverage',           'daverage',             'Formulas',     2.5,  'DAVERAGE function'),

    # -- Reference techniques --
    ('absolute reference', 'abs_ref',              'Formulas',     2.0,  'Absolute references ($)'),
    ('relative reference', 'rel_ref',              'Formulas',     1.5,  'Relative references'),
    ('mixed reference',    'mixed_ref',            'Formulas',     2.5,  'Mixed references'),
    ('structured reference', 'struct_ref',         'Formulas',     3.0,  'Structured references (Table[@Col])'),
    ('table reference',    'struct_ref',           'Formulas',     2.5,  'Table references'),
    ('3d reference',       '3d_ref',               'Formulas',     3.0,  '3D references across sheets'),
    ('indirect',           'indirect',             'Formulas',     3.5,  'INDIRECT function'),
    ('offset',             'offset',               'Formulas',     3.5,  'OFFSET function'),

    # ═══════════════════════════════════════════════════════════════════
    # Chart family
    # ═══════════════════════════════════════════════════════════════════
    ('chart',              'chart',                'Charts',       2.0,  'Chart creation'),
    ('graph',              'chart',                'Charts',       2.0,  'Graph creation'),
    ('bar chart',          'bar_chart',            'Charts',       2.0,  'Bar chart'),
    ('column chart',       'column_chart',         'Charts',       2.0,  'Column chart'),
    ('line chart',         'line_chart',           'Charts',       2.0,  'Line chart'),
    ('pie chart',          'pie_chart',            'Charts',       2.0,  'Pie chart'),
    ('scatter chart',      'scatter_chart',        'Charts',       2.5,  'Scatter chart'),
    ('scatter plot',       'scatter_chart',        'Charts',       2.5,  'Scatter plot'),
    ('area chart',         'area_chart',           'Charts',       2.0,  'Area chart'),
    ('histogram',          'histogram',            'Charts',       2.5,  'Histogram'),
    ('box plot',           'box_plot',             'Charts',       3.0,  'Box and whisker plot'),
    ('waterfall chart',    'waterfall',            'Charts',       3.0,  'Waterfall chart'),
    ('treemap',            'treemap',              'Charts',       3.0,  'Treemap chart'),
    ('sunburst',           'sunburst',             'Charts',       3.0,  'Sunburst chart'),
    ('funnel chart',       'funnel',               'Charts',       2.5,  'Funnel chart'),
    ('map chart',          'map_chart',            'Charts',       3.0,  'Map chart'),
    ('stock chart',        'stock_chart',          'Charts',       3.0,  'Stock chart'),
    ('radar chart',        'radar_chart',          'Charts',       2.5,  'Radar chart'),
    ('dashboard',          'dashboard',            'Charts',       3.5,  'Dashboard design'),
    ('visualization',      'visualization',        'Charts',       2.5,  'Data visualization'),
    ('sparkline',          'sparkline',            'Charts',       2.0,  'Sparkline usage'),
    ('combo chart',        'combo_chart',          'Charts',       3.0,  'Combo chart'),
    ('secondary axis',     'secondary_axis',       'Charts',       2.5,  'Secondary axis'),
    ('chart title',        'chart_title',          'Charts',       1.5,  'Chart titles'),
    ('axis label',         'axis_label',           'Charts',       1.5,  'Axis labels'),
    ('data label',         'data_label',           'Charts',       1.5,  'Data labels'),
    ('trendline',          'trendline',            'Charts',       2.5,  'Trendline'),
    ('error bars',         'error_bars',           'Charts',       2.5,  'Error bars'),
    ('chart formatting',   'chart_format',         'Charts',       2.0,  'Chart formatting'),
    ('dynamic chart',      'dynamic_chart',        'Charts',       3.5,  'Dynamic chart'),

    # ═══════════════════════════════════════════════════════════════════
    # VBA / macro family (Expert)
    # ═══════════════════════════════════════════════════════════════════
    ('vba',                'vba_code',             'VBA',          4.0,  'VBA programming'),
    ('macro',              'macro',                'VBA',          3.0,  'Macro recording/editing'),
    ('userform',           'userform',             'VBA',          4.0,  'UserForm creation'),
    ('automate',           'automation',           'VBA',          3.0,  'Task automation'),
    ('sub procedure',      'sub_proc',             'VBA',          3.5,  'Sub procedure'),
    ('function procedure', 'func_proc',            'VBA',          3.5,  'Function procedure'),
    ('vba loop',           'vba_loop',             'VBA',          3.0,  'VBA loops (For/Do/While)'),
    ('for loop',           'vba_loop',             'VBA',          3.0,  'For loop'),
    ('do while',           'vba_loop',             'VBA',          3.0,  'Do While loop'),
    ('vba error handling', 'vba_error',            'VBA',          3.5,  'VBA error handling'),
    ('on error',           'vba_error',            'VBA',          3.5,  'On Error statement'),
    ('msgbox',             'vba_msgbox',           'VBA',          2.5,  'MsgBox function'),
    ('inputbox',           'vba_inputbox',         'VBA',          2.5,  'InputBox function'),
    ('vba variable',       'vba_var',              'VBA',          3.0,  'VBA variables (Dim)'),
    ('option explicit',    'option_explicit',      'VBA',          2.5,  'Option Explicit'),
    ('class module',       'class_module',         'VBA',          4.5,  'VBA class module'),
    ('event procedure',    'vba_event',            'VBA',          4.0,  'VBA event procedures'),
    ('worksheet_change',   'vba_event',            'VBA',          4.0,  'Worksheet_Change event'),
    ('workbook_open',      'vba_event',            'VBA',          3.5,  'Workbook_Open event'),
    ('vba array',          'vba_array',            'VBA',          3.5,  'VBA arrays'),
    ('vba dictionary',     'vba_dictionary',       'VBA',          4.0,  'VBA Dictionary object'),
    ('vba collection',     'vba_collection',       'VBA',          3.5,  'VBA Collection'),
    ('file system object', 'vba_fso',              'VBA',          4.0,  'FileSystemObject'),
    ('vba sql',            'vba_sql',              'VBA',          4.5,  'VBA SQL / ADO'),
    ('regular expression', 'vba_regex',            'VBA',          4.5,  'VBA Regular Expressions'),

    # ═══════════════════════════════════════════════════════════════════
    # Power Query family (Advanced → Expert)
    # ═══════════════════════════════════════════════════════════════════
    ('power query',        'power_query',          'PowerQuery_M', 4.0,  'Power Query usage'),
    ('get & transform',    'power_query',          'PowerQuery_M', 3.5,  'Get & Transform'),
    ('get and transform',  'power_query',          'PowerQuery_M', 3.5,  'Get and Transform'),
    ('m language',         'm_language',           'PowerQuery_M', 4.0,  'M language'),
    ('m code',             'm_language',           'PowerQuery_M', 4.0,  'M code'),
    ('query editor',       'query_editor',         'PowerQuery_M', 3.0,  'Query Editor steps'),
    ('merge queries',      'merge_query',          'PowerQuery_M', 3.5,  'Merge queries'),
    ('merge query',        'merge_query',          'PowerQuery_M', 3.5,  'Merge query'),
    ('append queries',     'append_query',         'PowerQuery_M', 3.0,  'Append queries'),
    ('append query',       'append_query',         'PowerQuery_M', 3.0,  'Append query'),
    ('etl',                'etl',                  'PowerQuery_M', 3.0,  'ETL process'),
    ('unpivot',            'unpivot',              'PowerQuery_M', 3.5,  'Unpivot columns'),
    ('pivot column',       'pq_pivot',             'PowerQuery_M', 3.5,  'Pivot column in PQ'),
    ('group by',           'pq_group_by',          'PowerQuery_M', 3.0,  'Group By in Power Query'),
    ('custom column',      'pq_custom_col',        'PowerQuery_M', 3.0,  'Custom column in PQ'),
    ('conditional column', 'pq_cond_col',          'PowerQuery_M', 3.0,  'Conditional column in PQ'),
    ('replace values',     'pq_replace',           'PowerQuery_M', 2.5,  'Replace values in PQ'),
    ('split column',       'pq_split',             'PowerQuery_M', 2.5,  'Split column in PQ'),
    ('change type',        'pq_type',              'PowerQuery_M', 2.0,  'Change data type in PQ'),
    ('remove duplicates',  'pq_dedup',             'PowerQuery_M', 2.5,  'Remove duplicates in PQ'),
    ('fill down',          'pq_fill',              'PowerQuery_M', 2.5,  'Fill down in PQ'),
    ('data source',        'pq_source',            'PowerQuery_M', 2.5,  'Data source connection'),
    ('import data',        'pq_import',            'PowerQuery_M', 2.5,  'Import external data'),
    ('transform data',     'pq_transform',         'PowerQuery_M', 3.0,  'Data transformation'),
    ('data cleansing',     'pq_cleanse',           'PowerQuery_M', 3.0,  'Data cleansing'),
    ('data cleaning',      'pq_cleanse',           'PowerQuery_M', 3.0,  'Data cleaning'),
    ('clean data',         'pq_cleanse',           'PowerQuery_M', 3.0,  'Clean data'),
    ('pq parameter',       'pq_param',             'PowerQuery_M', 3.5,  'Power Query parameters'),
    ('custom function',    'pq_custom_fn',         'PowerQuery_M', 4.0,  'Power Query custom function'),
    ('error handling in m', 'pq_error',            'PowerQuery_M', 4.0,  'M language error handling'),
    ('try otherwise',      'pq_try',               'PowerQuery_M', 4.0,  'M try/otherwise'),

    # ═══════════════════════════════════════════════════════════════════
    # Formatting family
    # ═══════════════════════════════════════════════════════════════════
    ('conditional format', 'cond_format',          'Formatting',   2.5,  'Conditional formatting'),
    ('conditional formatting', 'cond_format',      'Formatting',   2.5,  'Conditional formatting'),
    ('data validation',    'data_validation',      'Formatting',   2.5,  'Data validation rules'),
    ('dropdown list',      'dropdown',             'Formatting',   2.0,  'Dropdown list'),
    ('drop-down list',     'dropdown',             'Formatting',   2.0,  'Drop-down list'),
    ('dropdown',           'dropdown',             'Formatting',   2.0,  'Dropdown'),
    ('named range',        'named_range',          'Formatting',   2.0,  'Named ranges'),
    ('name manager',       'named_range',          'Formatting',   2.0,  'Name Manager'),
    ('table style',        'table_style',          'Formatting',   1.5,  'Table styling'),
    ('format as table',    'format_table',         'Formatting',   2.0,  'Format as Table'),
    ('cell formatting',    'cell_format',          'Formatting',   1.0,  'Cell formatting'),
    ('number format',      'number_format',        'Formatting',   1.5,  'Number formatting'),
    ('custom number format', 'custom_number_fmt',  'Formatting',   3.0,  'Custom number format codes'),
    ('currency format',    'currency_fmt',         'Formatting',   1.5,  'Currency formatting'),
    ('percentage format',  'pct_fmt',              'Formatting',   1.5,  'Percentage formatting'),
    ('date format',        'date_fmt',             'Formatting',   1.5,  'Date formatting'),
    ('data bars',          'data_bars',            'Formatting',   2.0,  'Data bars'),
    ('color scale',        'color_scale',          'Formatting',   2.0,  'Color scales'),
    ('colour scale',       'color_scale',          'Formatting',   2.0,  'Colour scales'),
    ('icon set',           'icon_set',             'Formatting',   2.0,  'Icon sets'),
    ('freeze panes',       'freeze_panes',         'Formatting',   1.5,  'Freeze panes'),
    ('merge cells',        'merge_cells',          'Formatting',   1.0,  'Merge cells'),
    ('wrap text',          'wrap_text',            'Formatting',   1.0,  'Wrap text'),
    ('protection',         'protection',           'Formatting',   2.0,  'Sheet/workbook protection'),
    ('protect sheet',      'protection',           'Formatting',   2.0,  'Protect sheet'),
    ('protect workbook',   'protection',           'Formatting',   2.0,  'Protect workbook'),
    ('page layout',        'page_layout',          'Formatting',   1.5,  'Page layout'),
    ('print area',         'print_area',           'Formatting',   1.5,  'Print area'),
    ('header and footer',  'header_footer',        'Formatting',   1.5,  'Header and footer'),
    ('form control',       'form_control',         'Formatting',   2.5,  'Form controls'),
    ('checkbox',           'form_control',         'Formatting',   2.0,  'Checkbox control'),
    ('button',             'form_control',         'Formatting',   2.0,  'Button control'),
    ('sort data',          'sorting',              'Formatting',   1.5,  'Sorting'),
    ('filter data',        'filtering',            'Formatting',   1.5,  'Filtering'),
    ('autofilter',         'filtering',            'Formatting',   1.5,  'AutoFilter'),
    ('advanced filter',    'adv_filter',           'Formatting',   2.5,  'Advanced Filter'),
    ('subtotal',           'subtotal',             'Formatting',   2.0,  'Subtotals and outlining'),
    ('group and outline',  'outlining',            'Formatting',   2.0,  'Grouping and outlining'),

    # ═══════════════════════════════════════════════════════════════════
    # Data Analysis & What-If Tools (Advanced)
    # ═══════════════════════════════════════════════════════════════════
    ('what-if analysis',   'what_if',              'Formulas',     3.5,  'What-If Analysis'),
    ('what if analysis',   'what_if',              'Formulas',     3.5,  'What-If Analysis'),
    ('goal seek',          'goal_seek',            'Formulas',     3.0,  'Goal Seek'),
    ('solver',             'solver',               'Formulas',     4.0,  'Solver optimisation'),
    ('scenario manager',   'scenario',             'Formulas',     3.5,  'Scenario Manager'),
    ('scenario',           'scenario',             'Formulas',     3.0,  'Scenario analysis'),
    ('data table',         'data_table',           'Formulas',     3.0,  'Data Table (What-If)'),
    ('one-variable data table', 'data_table_1v',   'Formulas',     3.0,  'One-variable Data Table'),
    ('two-variable data table', 'data_table_2v',   'Formulas',     3.5,  'Two-variable Data Table'),
    ('sensitivity analysis', 'sensitivity',        'Formulas',     3.5,  'Sensitivity analysis'),
    ('consolidation',      'consolidation',        'Formulas',     3.0,  'Data Consolidation'),

    # ═══════════════════════════════════════════════════════════════════
    # Theory / reflection
    # ═══════════════════════════════════════════════════════════════════
    ('explain',            'theoretical',          'Completeness', 2.0,  'Theoretical explanation'),
    ('justify',            'theoretical',          'Completeness', 2.0,  'Justification'),
    ('reflection',         'theoretical',          'Completeness', 2.0,  'Theoretical reflection'),
    ('describe the process', 'process_desc',       'Completeness', 1.5,  'Process description'),
    ('outline the steps',  'process_desc',         'Completeness', 1.5,  'Step-by-step outline'),
    ('compare',            'comparison',           'Completeness', 2.0,  'Comparison analysis'),
    ('benefit',            'benefit_analysis',     'Completeness', 1.5,  'Benefit analysis'),
    ('disadvantage',       'disadvantage',         'Completeness', 1.5,  'Disadvantage analysis'),
    ('advantage',          'advantage',            'Completeness', 1.5,  'Advantage analysis'),
    ('research',           'research',             'Completeness', 2.0,  'Research component'),
    ('written response',   'written_response',     'Completeness', 2.0,  'Written response'),
    ('discussion',         'discussion',           'Completeness', 2.0,  'Discussion'),
    ('analysis',           'analysis_task',        'Completeness', 2.0,  'Analysis task'),
    ('interpret',          'interpret',            'Completeness', 2.0,  'Interpretation task'),
    ('evaluate',           'evaluate',             'Completeness', 2.0,  'Evaluation task'),
    ('critical thinking',  'critical_thinking',    'Completeness', 2.5,  'Critical thinking'),
]


class RubricGenerator:
    """
    Generates a structured rubric from assignment instructions.

    The generated rubric has the same format as ``instructor_rubric``
    accepted by ``GradingEngine``, so it plugs in transparently.
    """

    def __init__(self, max_points: float = 100.0):
        self.max_points = max_points

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def generate(
        self,
        assignment_title: str,
        assignment_description: str,
        assignment_instructions: str,
        module_title: str = '',
        module_description: str = '',
        module_objectives: str = '',
        points_possible: float = 100.0,
    ) -> Dict[str, Any]:
        """
        Generate a rubric from assignment text.

        Returns a dict with:
          - criteria: list of {name, description, max_points, expected_elements}
          - total_points: float
          - parts: list of detected assignment parts
          - scope: {scope_formulas, scope_pivots, …}  flags
          - generation_method: 'instruction_analysis'
        """
        self.max_points = points_possible or 100.0

        # Combine all text sources
        all_text = '\n'.join(filter(None, [
            assignment_title or '',
            assignment_description or '',
            assignment_instructions or '',
            module_title or '',
            module_description or '',
            module_objectives or '',
        ]))

        if not all_text.strip():
            return self._empty_rubric()

        # Step 1: Detect structural parts (Part 1, Part 2, …)
        parts = self._detect_parts(assignment_instructions or assignment_description or '')

        # Step 2: Detect numbered tasks within each part (or globally)
        tasks = self._detect_tasks(assignment_instructions or assignment_description or '')

        # Step 3: Concept extraction from instructions
        concepts = self._extract_concepts(all_text)

        # Step 4: Build criteria from parts + tasks + concepts
        criteria = self._build_criteria(parts, tasks, concepts)

        # Step 5: Assign weights / max points
        criteria = self._assign_weights(criteria, self.max_points)

        # Step 6: Derive scope flags from criteria categories
        scope = self._derive_scope(criteria)

        # Step 7: Build the rubric dict (compatible with GradingEngine)
        total_pts = sum(c['max_points'] for c in criteria)
        rubric = {
            'criteria': criteria,
            'total_points': round(total_pts, 1),
            'parts': parts,
            'scope': scope,
            'generation_method': 'instruction_analysis',
            'task_count': len(tasks),
            'concept_count': len(concepts),
        }

        logger.info(
            f"Generated rubric for '{assignment_title}': "
            f"{len(criteria)} criteria, {len(parts)} parts, "
            f"{len(tasks)} tasks, {round(total_pts, 1)} total pts"
        )

        return rubric

    # ------------------------------------------------------------------
    # Step 1: Detect parts
    # ------------------------------------------------------------------

    def _detect_parts(self, text: str) -> List[Dict[str, Any]]:
        """
        Detect multi-part structure like:
          Part 1: Calculated Item Implementation (Variance Analysis)
          Part 2: Data Model and Relationship Setup
          Part 3: Report Construction and Analysis
        """
        parts = []

        # Pattern: "Part N:" or "Part N —" or "Section N:" etc.
        part_pattern = re.compile(
            r'(?:^|\n)\s*(?:Part|Section|Phase)\s+(\d+)\s*[:\-—–]\s*(.+?)(?=\n|$)',
            re.IGNORECASE | re.MULTILINE,
        )

        for match in part_pattern.finditer(text):
            part_num = int(match.group(1))
            part_title = match.group(2).strip()
            part_start = match.end()

            parts.append({
                'number': part_num,
                'title': part_title,
                'start_pos': match.start(),
                'end_pos': part_start,
            })

        # Set each part's text range
        for i, part in enumerate(parts):
            if i + 1 < len(parts):
                part['text'] = text[part['end_pos']:parts[i + 1]['start_pos']]
            else:
                part['text'] = text[part['end_pos']:]

        return parts

    # ------------------------------------------------------------------
    # Step 2: Detect numbered tasks
    # ------------------------------------------------------------------

    def _detect_tasks(self, text: str) -> List[Dict[str, Any]]:
        """
        Detect numbered tasks/questions like:
          1. Define the goal: Calculate the 'Variance' ...
          2. Explain the critical distinction: ...
          8. Theoretical Reflection: Based on ...
        """
        tasks = []

        # Pattern: "N." or "N)" at start of line, followed by task text
        task_pattern = re.compile(
            r'(?:^|\n)\s*(\d+)\s*[.)]\s*(.+?)(?=\n\s*\d+\s*[.)]|\n\s*(?:Part|Section)\s+\d|\Z)',
            re.IGNORECASE | re.DOTALL,
        )

        for match in task_pattern.finditer(text):
            task_num = int(match.group(1))
            task_text = match.group(2).strip()
            # Clean up multi-line continuations
            task_text = re.sub(r'\s+', ' ', task_text)

            # Determine task type
            task_type = self._classify_task(task_text)

            # Extract expected elements from the task text
            expected = self._extract_expected_elements(task_text)

            tasks.append({
                'number': task_num,
                'text': task_text[:300],  # truncate for storage
                'type': task_type,
                'expected_elements': expected,
                'complexity': self._estimate_complexity(task_text),
            })

        return tasks

    # ------------------------------------------------------------------
    # Step 3: Extract concepts
    # ------------------------------------------------------------------

    def _extract_concepts(self, text: str) -> List[Dict[str, Any]]:
        """Extract Excel concepts mentioned in the text using vocabulary."""
        text_lower = text.lower()
        found_concepts: Dict[str, Dict[str, Any]] = {}

        for keyword, concept_id, category, weight, label in _CONCEPT_VOCABULARY:
            if keyword in text_lower:
                if concept_id not in found_concepts:
                    found_concepts[concept_id] = {
                        'id': concept_id,
                        'category': category,
                        'weight': weight,
                        'label': label,
                        'keywords_matched': [keyword],
                    }
                else:
                    # Already found — add keyword but don't duplicate
                    if keyword not in found_concepts[concept_id]['keywords_matched']:
                        found_concepts[concept_id]['keywords_matched'].append(keyword)
                    # Boost weight slightly for multiple keyword matches
                    found_concepts[concept_id]['weight'] = min(
                        found_concepts[concept_id]['weight'] + 0.5,
                        6.0,
                    )

        return list(found_concepts.values())

    # ------------------------------------------------------------------
    # Step 4: Build criteria
    # ------------------------------------------------------------------

    def _build_criteria(
        self,
        parts: List[Dict],
        tasks: List[Dict],
        concepts: List[Dict],
    ) -> List[Dict[str, Any]]:
        """
        Build rubric criteria by merging parts, tasks, and concepts.

        Strategy:
          - If parts are detected, create one criterion per part.
          - Sub-tasks within parts add expected elements and increase weight.
          - Concepts not covered by tasks are added as additional criteria.
          - Always add Formatting and Completeness criteria.
        """
        criteria = []

        if parts:
            # ── Part-based criteria ────────────────────────────
            for part in parts:
                part_text = (part.get('text', '') + ' ' + part.get('title', '')).lower()
                part_concepts = [
                    c for c in concepts
                    if any(kw in part_text for kw in c.get('keywords_matched', []))
                ]

                # Find tasks that belong to this part
                part_tasks = self._tasks_for_part(tasks, part, parts)

                # Determine primary category from concepts
                category = self._primary_category(part_concepts) or 'Completeness'

                expected = []
                for t in part_tasks:
                    expected.extend(t.get('expected_elements', []))
                for c in part_concepts:
                    expected.append(c['label'])
                expected = list(dict.fromkeys(expected))  # dedupe, preserve order

                complexity = sum(t.get('complexity', 1.0) for t in part_tasks) + \
                             sum(c.get('weight', 1.0) for c in part_concepts)

                criteria.append({
                    'name': f"Part {part['number']}: {part['title'][:60]}",
                    'description': part.get('title', ''),
                    'category': category,
                    'expected_elements': expected,
                    'task_count': len(part_tasks),
                    'concept_count': len(part_concepts),
                    'raw_weight': complexity,
                    'max_points': 0,  # assigned in step 5
                })
        elif tasks:
            # ── Task-based criteria (no parts detected) ────────
            for task in tasks:
                task_concepts = [
                    c for c in concepts
                    if any(kw in task['text'].lower() for kw in c.get('keywords_matched', []))
                ]
                category = self._primary_category(task_concepts) or self._category_from_task_type(task['type'])

                criteria.append({
                    'name': f"Task {task['number']}: {task['text'][:50]}",
                    'description': task['text'][:200],
                    'category': category,
                    'expected_elements': task.get('expected_elements', []),
                    'task_count': 1,
                    'concept_count': len(task_concepts),
                    'raw_weight': task.get('complexity', 1.0) + sum(c.get('weight', 1.0) for c in task_concepts),
                    'max_points': 0,
                })
        else:
            # ── Concept-based criteria (no structure) ──────────
            by_category: Dict[str, List[Dict]] = {}
            for c in concepts:
                by_category.setdefault(c['category'], []).append(c)

            for category, cat_concepts in by_category.items():
                criteria.append({
                    'name': category.replace('_', ' '),
                    'description': ', '.join(c['label'] for c in cat_concepts),
                    'category': category,
                    'expected_elements': [c['label'] for c in cat_concepts],
                    'task_count': 0,
                    'concept_count': len(cat_concepts),
                    'raw_weight': sum(c['weight'] for c in cat_concepts),
                    'max_points': 0,
                })

        # ── Always add Formatting criterion if not present ─────
        has_formatting = any(c['category'] == 'Formatting' for c in criteria)
        if not has_formatting:
            criteria.append({
                'name': 'Formatting & Presentation',
                'description': 'Professional formatting, layout, and readability.',
                'category': 'Formatting',
                'expected_elements': ['Clear layout', 'Proper formatting', 'Professional presentation'],
                'task_count': 0,
                'concept_count': 0,
                'raw_weight': 2.0,
                'max_points': 0,
            })

        # ── Always add Completeness criterion ──────────────────
        criteria.append({
            'name': 'Overall Completeness',
            'description': 'All required parts and tasks attempted; file structure.',
            'category': 'Completeness',
            'expected_elements': ['All parts attempted', 'File structure correct'],
            'task_count': 0,
            'concept_count': 0,
            'raw_weight': 2.0,
            'max_points': 0,
        })

        return criteria

    # ------------------------------------------------------------------
    # Step 5: Assign weights
    # ------------------------------------------------------------------

    def _assign_weights(self, criteria: List[Dict], total_pts: float) -> List[Dict]:
        """Distribute total_pts across criteria proportional to raw_weight."""
        total_weight = sum(c.get('raw_weight', 1.0) for c in criteria)
        if total_weight == 0:
            total_weight = len(criteria) or 1

        for criterion in criteria:
            raw = criterion.get('raw_weight', 1.0)
            pts = round((raw / total_weight) * total_pts, 1)
            # Minimum 2 points per criterion
            criterion['max_points'] = max(2.0, pts)

        # Normalize so sum == total_pts exactly
        actual_total = sum(c['max_points'] for c in criteria)
        if actual_total > 0 and abs(actual_total - total_pts) > 0.5:
            factor = total_pts / actual_total
            for c in criteria:
                c['max_points'] = round(c['max_points'] * factor, 1)

        return criteria

    # ------------------------------------------------------------------
    # Step 6: Derive scope flags
    # ------------------------------------------------------------------

    def _derive_scope(self, criteria: List[Dict]) -> Dict[str, bool]:
        """Derive scope_* flags from the categories present in criteria."""
        categories = {c['category'] for c in criteria if c.get('max_points', 0) > 0}

        return {
            'scope_formulas':    True,  # Formulas always in scope for Excel grading
            'scope_pivots':      'PivotTables' in categories,
            'scope_charts':      'Charts' in categories,
            'scope_vba':         'VBA' in categories,
            'scope_power_query': 'PowerQuery_M' in categories,
            'scope_formatting':  True,  # Formatting always in scope for Excel grading
        }

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _classify_task(self, task_text: str) -> str:
        """Classify a task into a type category."""
        text = task_text.lower()

        if any(kw in text for kw in ['explain', 'justify', 'describe', 'reflection', 'compare', 'benefit']):
            return 'theoretical'
        if any(kw in text for kw in ['create', 'build', 'design', 'construct', 'implement']):
            return 'practical_build'
        if any(kw in text for kw in ['define', 'specify', 'identify', 'outline']):
            return 'definition'
        if any(kw in text for kw in ['calculate', 'compute', 'formula', 'function']):
            return 'calculation'
        if any(kw in text for kw in ['format', 'style', 'layout']):
            return 'formatting'
        return 'general'

    def _extract_expected_elements(self, task_text: str) -> List[str]:
        """Extract specific expected elements from task text."""
        elements = []
        text = task_text.lower()

        # Look for quoted terms (column names, labels, etc.)
        quoted = re.findall(r"['\"]([^'\"]+)['\"]", task_text)
        for q in quoted:
            if len(q) < 60:
                elements.append(q)

        # Look for specific formulas or expressions
        formula_match = re.findall(r'=\s*[A-Za-z]+\([^)]*\)', task_text)
        elements.extend(formula_match[:5])

        # Look for "named X" patterns
        named_pattern = re.findall(r'named?\s+["\']?(\w[\w\s]+\w)["\']?', text)
        for n in named_pattern:
            if len(n) < 40:
                elements.append(f"Named: {n.strip()}")

        return elements[:10]  # cap at 10

    def _estimate_complexity(self, task_text: str) -> float:
        """Estimate task complexity on a 1.0 – 5.0 scale."""
        text = task_text.lower()
        score = 1.0

        # Length suggests more work
        if len(text) > 200:
            score += 0.5
        if len(text) > 400:
            score += 0.5

        # Multiple sub-steps
        step_count = len(re.findall(r'\d+[.)]\s', text))
        score += min(step_count * 0.3, 1.5)

        # Advanced concepts
        advanced = ['data model', 'calculated item', 'calculated field',
                     'relationship', 'vba', 'power query', 'lambda', 'dynamic array']
        for kw in advanced:
            if kw in text:
                score += 0.5

        # Theoretical questions are generally lighter in grading weight
        if any(kw in text for kw in ['explain', 'justify', 'reflection']):
            score = max(score - 0.3, 1.0)

        return min(score, 5.0)

    def _tasks_for_part(
        self,
        tasks: List[Dict],
        part: Dict,
        all_parts: List[Dict],
    ) -> List[Dict]:
        """Find tasks that belong to a specific part by number sequencing."""
        part_num = part['number']
        part_idx = next((i for i, p in enumerate(all_parts) if p['number'] == part_num), -1)

        if part_idx < 0:
            return []

        # Find the task number range for this part
        # The first task after the part header, up to the next part
        part_text = part.get('text', '')
        task_nums_in_text = [int(m) for m in re.findall(r'(?:^|\s)(\d+)\s*[.)]', part_text)]

        if task_nums_in_text:
            return [t for t in tasks if t['number'] in task_nums_in_text]

        # Fallback: split tasks evenly across parts
        if not all_parts:
            return tasks

        tasks_per_part = max(1, len(tasks) // len(all_parts))
        start = part_idx * tasks_per_part
        end = start + tasks_per_part if part_idx < len(all_parts) - 1 else len(tasks)
        return tasks[start:end]

    def _primary_category(self, concepts: List[Dict]) -> Optional[str]:
        """Get the dominant category from a list of concepts."""
        if not concepts:
            return None

        category_weights: Dict[str, float] = {}
        for c in concepts:
            cat = c['category']
            category_weights[cat] = category_weights.get(cat, 0) + c.get('weight', 1.0)

        return max(category_weights, key=category_weights.get)

    def _category_from_task_type(self, task_type: str) -> str:
        """Map task type to rubric category."""
        mapping = {
            'theoretical': 'Completeness',
            'practical_build': 'PivotTables',
            'definition': 'Completeness',
            'calculation': 'Formulas',
            'formatting': 'Formatting',
        }
        return mapping.get(task_type, 'Completeness')

    def _empty_rubric(self) -> Dict[str, Any]:
        """Return a minimal rubric when no instructions are available."""
        return {
            'criteria': [
                {'name': 'Formulas', 'description': 'Formula usage', 'category': 'Formulas', 'max_points': 30, 'expected_elements': []},
                {'name': 'Formatting', 'description': 'Formatting quality', 'category': 'Formatting', 'max_points': 20, 'expected_elements': []},
                {'name': 'Completeness', 'description': 'Overall completeness', 'category': 'Completeness', 'max_points': 50, 'expected_elements': []},
            ],
            'total_points': 100.0,
            'parts': [],
            'scope': {
                'scope_formulas': True,
                'scope_pivots': False,
                'scope_charts': False,
                'scope_vba': False,
                'scope_power_query': False,
                'scope_formatting': True,
            },
            'generation_method': 'fallback_empty',
            'task_count': 0,
            'concept_count': 0,
        }
