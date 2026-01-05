# Module Release Settings Feature

## Overview

This feature enables instructors to control when course modules become visible and accessible to students. Instead of showing all modules from day one, instructors can configure a gradual release schedule.

## Features Implemented

### 1. Course-Level Module Release Settings

Instructors can configure:
- **Course Start Date**: The date from which module releases are calculated
- **Initial Module Release Count**: Number of modules available from the start (e.g., "Release 3 modules initially")
- **Release Interval** (future enhancement ready):
  - Manual release only
  - Weekly (1 module per week)
  - Bi-weekly (1 module every 2 weeks)
  - Monthly (1 module per month)
  - Custom interval (X days)

### 2. Manual Module Release Override

Instructors can:
- View the release status of all modules
- Manually release individual modules at any time
- Revoke manual releases to return modules to automatic scheduling

### 3. Student Experience

Students see:
- Only released modules in the learning sidebar
- A progress indicator showing "X of Y modules available"
- Clear indication that more modules exist but are not yet released

### 4. Access Control

- Unreleased modules are not accessible via direct URL (returns "not available yet")
- Instructors always see all modules regardless of release settings
- Late enrollees see modules based on course start date, not enrollment date

## Files Changed

### Backend

#### Models (`backend/src/models/course_models.py`)

Added to `Course` model:
- `start_date`: DateTime - Course start date for release calculations
- `module_release_count`: Integer - Number of modules to release initially (null = all)
- `module_release_interval`: String - Release schedule type ('weekly', 'bi-weekly', 'monthly', 'custom', null for manual)
- `module_release_interval_days`: Integer - Custom interval in days

Added methods:
- `get_released_module_count()`: Calculates how many modules should be released based on settings and current date
- `get_released_modules()`: Returns list of modules that should be visible to students

Updated `to_dict()`: Added `for_student` parameter to filter modules based on release settings

Added to `Module` model:
- `is_released`: Boolean - Manual release override flag
- `released_at`: DateTime - Timestamp of manual release

#### Routes (`backend/src/routes/course_routes.py`)

New endpoints:
- `GET /courses/<id>/module-release-status`: Get module release status for instructor dashboard
- `PUT /courses/<id>/module-release-settings`: Update module release settings
- `POST /modules/<id>/release`: Manually release a module
- `POST /modules/<id>/unrelease`: Revoke manual release

Updated endpoints:
- `GET /courses/<id>`: Now returns only released modules for students, all for instructors
- `GET /courses/<id>/modules`: Same filtering logic applied
- `GET /modules/<id>`: Blocks access to unreleased modules for students
- `PUT /courses/<id>`: Accepts module release settings fields

#### Migration (`backend/migrate_module_release.py`)

Database migration script that adds:
- Course table: `start_date`, `module_release_count`, `module_release_interval`, `module_release_interval_days`
- Module table: `is_released`, `released_at`

### Frontend

#### Types (`frontend/src/types/api.ts`)

Updated `Course` interface with module release settings fields.
Updated `Module` interface with `is_released` and `released_at` fields.

#### Types (`frontend/src/app/(learn)/learn/[id]/types.ts`)

Updated `ModuleData` and `CourseData` interfaces with release metadata.

#### Course Settings Component (`frontend/src/components/instructor/course-creation/CourseSettings.tsx`)

New component providing:
- Enable/disable controlled module release toggle
- Course start date picker
- Initial module count selector
- Release schedule dropdown (with custom interval option)
- Summary of current configuration
- Module release status overview with manual release controls

#### Instructor Course Page (`frontend/src/app/instructor/courses/[courseId]/page.tsx`)

- Integrated the new `CourseSettings` component in the Settings tab

#### Learning Sidebar (`frontend/src/app/(learn)/learn/[id]/components/LearningSidebar.tsx`)

- Added props for `totalModuleCount` and `releasedModuleCount`
- Shows "X of Y modules available" indicator when modules are restricted

#### Learning Page (`frontend/src/app/(learn)/learn/[id]/page.tsx`)

- Passes module release metadata to LearningSidebar component

## How to Use

### For Instructors

1. Navigate to your course details page
2. Click the "Settings" tab
3. Enable "Controlled Module Release"
4. Set the course start date
5. Choose how many modules to release initially
6. Optionally configure automatic release intervals
7. Save settings
8. Use the "Module Release Status" section to manually release modules at any time

### For Developers

Run the migration:
```bash
cd backend
source venv/bin/activate
python migrate_module_release.py
```

## API Examples

### Get Module Release Status
```http
GET /api/v1/courses/1/module-release-status
Authorization: Bearer <token>
```

### Update Module Release Settings
```http
PUT /api/v1/courses/1/module-release-settings
Authorization: Bearer <token>
Content-Type: application/json

{
  "start_date": "2024-01-15",
  "module_release_count": 3,
  "module_release_interval": "weekly",
  "module_release_interval_days": null
}
```

### Manually Release a Module
```http
POST /api/v1/modules/5/release
Authorization: Bearer <token>
```

### Revoke Module Release
```http
POST /api/v1/modules/5/unrelease
Authorization: Bearer <token>
```

## Edge Cases Handled

1. **No start date set**: Uses course creation date as fallback
2. **Course hasn't started**: No modules are released (returns 0)
3. **Module release count is null**: All modules are released (default behavior)
4. **Instructor changes settings after course starts**: Visibility adjusts accordingly
5. **Late enrollment**: Students see modules based on course start date, not enrollment date
6. **Manual release + auto release**: Manual releases are preserved even when automatic scheduling releases fewer modules

## Future Enhancements

1. Email notifications when new modules are released
2. Student-facing "upcoming modules" preview
3. Module dependencies (release based on completion of previous modules)
4. Scheduled release dates per module
5. Analytics on module release impact on engagement
