# Enhanced Application Search - Quick Reference

## Overview
The enhanced application search system provides comprehensive search and filtering capabilities for course applications, including text search, advanced filters, analytics, and similar application detection.

## 🔍 Search Endpoints

### 1. Basic Application List with Enhanced Search
```http
GET /api/v1/applications
Authorization: Bearer <token>
```

**Query Parameters:**
- `search` - Text search across name, email, phone, motivation, field_of_study, etc.
- `course_id` - Filter by course
- `status` - Filter by application status (pending, approved, rejected, waitlisted)
- `country` - Filter by country
- `city` - Filter by city
- `education_level` - Filter by education level
- `current_status` - Filter by current employment status
- `excel_skill_level` - Filter by Excel skill level
- `referral_source` - Filter by referral source
- `date_from` - Start date (YYYY-MM-DD)
- `date_to` - End date (YYYY-MM-DD)
- `min_score` / `max_score` - Score range filtering
- `score_type` - Which score to filter (application_score, final_rank_score, etc.)
- `sort_by` - Field to sort by
- `sort_order` - Sort order (asc, desc)
- `page` / `per_page` - Pagination

**Example:**
```bash
curl "localhost:5000/api/v1/applications?search=data%20analysis&country=United%20States&min_score=70&score_type=application_score&sort_by=final_rank_score&sort_order=desc" \
  -H "Authorization: Bearer <token>"
```

### 2. Search Statistics
```http
GET /api/v1/applications/search-stats
Authorization: Bearer <token>
```

**Returns filter options and statistics:**
- Available countries, cities, education levels, etc.
- Status distribution counts
- Score statistics (min, max, average)
- Date ranges
- Total application counts

### 3. Advanced Search with Analytics
```http
POST /api/v1/applications/advanced-search
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "text_search": "data analysis",
  "filters": {
    "course_id": 1,
    "country": "United States",
    "education_level": "bachelors"
  },
  "score_ranges": {
    "application_score": {"min": 50, "max": 90},
    "final_rank_score": {"min": 70}
  },
  "date_ranges": {
    "created_from": "2024-01-01",
    "created_to": "2024-12-31"
  },
  "sort_config": {
    "field": "final_rank_score",
    "order": "desc"
  },
  "pagination": {
    "page": 1,
    "per_page": 20
  },
  "include_analytics": true,
  "save_search": false,
  "search_name": "High Score US Applicants"
}
```

### 4. Find Similar Applications
```http
GET /api/v1/applications/{app_id}/similar?limit=10
Authorization: Bearer <token>
```

**Returns applications similar to the target based on:**
- Excel skill level
- Education level
- Country/Location
- Score ranges
- Current status

**Response includes similarity scores and factors.**

### 5. Export Search Results
```http
POST /api/v1/applications/search-export
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "search_config": { /* same as advanced search */ },
  "format": "excel", // or "csv"
  "fields": ["full_name", "email", "country", "final_rank_score"],
  "include_analytics": true,
  "filename": "applications_export_2024"
}
```

## 🎯 Search Features

### Text Search Capabilities
- **Full Name** - Search by applicant name
- **Email** - Search by email address
- **Phone** - Search by phone number
- **Motivation** - Search within motivation text
- **Field of Study** - Search by academic field
- **Learning Outcomes** - Search within learning goals
- **Career Impact** - Search within career impact descriptions
- **Referral Source** - Search by referral source

### Advanced Filters
- **Geographic**: Country, City
- **Demographic**: Gender, Age Range
- **Educational**: Education Level, Field of Study
- **Professional**: Current Status, Excel Skill Level
- **Technical**: Has Computer, Internet Access Type
- **Referral**: Referral Source

### Score Filtering
- **Application Score** - Overall application quality
- **Final Rank Score** - Composite ranking score
- **Readiness Score** - Learning readiness assessment
- **Commitment Score** - Commitment level evaluation
- **Risk Score** - Dropout risk assessment

### Date Range Filtering
- **Created Date** - When application was submitted
- **Reviewed Date** - When application was reviewed
- Support for any date range with YYYY-MM-DD format

## 📊 Analytics Features

### Search Analytics
When `include_analytics: true`:
- **Status Distribution** - Count by application status
- **Excel Skill Distribution** - Skill level breakdown
- **Country Distribution** - Top countries represented
- **Score Statistics** - Min, max, average for all score types

### Similar Application Detection
- **Similarity Score** - 0-100% similarity rating
- **Similarity Factors** - Explanation of matching criteria
- **Weighted Matching** - Excel skill (25%), Education (20%), Location (15%), Scores (20%), etc.

## 🔧 Frontend Integration

### Enhanced Application Service
```typescript
import { applicationService } from '@/services/api/application.service';

// Basic enhanced search
const results = await applicationService.listApplications({
  search: "data analysis",
  country: "United States",
  min_score: 70,
  score_type: "application_score",
  page: 1,
  per_page: 20
});

// Get search statistics
const stats = await applicationService.getSearchStatistics(courseId);

// Advanced search with analytics
const advancedResults = await applicationService.advancedSearch({
  text_search: "excel",
  filters: { country: "United States" },
  include_analytics: true
});

// Find similar applications
const similar = await applicationService.findSimilarApplications(appId, 5);

// Quick search with suggestions
const quickResults = await applicationService.quickSearch("alice", {
  course_id: 1,
  limit: 10
});
```

### TypeScript Types
```typescript
import {
  ApplicationSearchFilters,
  ApplicationSearchStatistics,
  AdvancedSearchConfig,
  SimilarApplication,
  ApplicationExportConfig
} from '@/services/api/types';
```

## 🚀 Performance Considerations

### Optimizations
- **Database Indexes** - Ensure indexes on searchable fields
- **Query Optimization** - Use appropriate joins and filters
- **Pagination** - Limit result sets with pagination
- **Caching** - Cache search statistics and filter options

### Limits
- **Text Search** - Use specific terms for better performance
- **Score Filtering** - Specify score type to optimize queries
- **Date Ranges** - Use reasonable date ranges
- **Similar Applications** - Limit similarity search results

## 🔐 Security & Permissions

### Authentication Required
- All search endpoints require JWT authentication
- Only admin and instructor roles can access application data
- Course instructors can only see applications for their courses

### Data Privacy
- Sensitive fields are filtered based on user permissions
- Search logs should not store personal information
- Export functionality respects data privacy settings

## 🐛 Troubleshooting

### Common Issues
1. **No Results Found**
   - Check search terms and filters
   - Verify course_id parameter
   - Check user permissions

2. **Performance Issues**
   - Use more specific search terms
   - Add appropriate database indexes
   - Limit result set size

3. **Filter Options Empty**
   - Ensure applications exist for the course
   - Check data consistency
   - Verify enum values match database

### Error Responses
- `400` - Invalid parameters or date format
- `401` - Authentication required
- `403` - Insufficient permissions
- `404` - Application or course not found
- `500` - Server error (check logs)

## 📈 Usage Examples

### Find All Excel Beginners in US
```bash
curl "localhost:5000/api/v1/applications?country=United%20States&excel_skill_level=beginner&sort_by=final_rank_score&sort_order=desc" \
  -H "Authorization: Bearer <token>"
```

### Search for Specific Motivation
```bash
curl "localhost:5000/api/v1/applications?search=career%20change&min_score=60&score_type=application_score" \
  -H "Authorization: Bearer <token>"
```

### Get Recent High-Score Applications
```bash
curl "localhost:5000/api/v1/applications?date_from=2024-11-01&min_score=80&score_type=final_rank_score&sort_by=created_at&sort_order=desc" \
  -H "Authorization: Bearer <token>"
```

### Find Applications Needing Review
```bash
curl "localhost:5000/api/v1/applications?status=pending&sort_by=created_at&sort_order=asc&per_page=50" \
  -H "Authorization: Bearer <token>"
```