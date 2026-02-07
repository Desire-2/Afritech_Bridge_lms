# Maintenance Mode Feature - Implementation Guide

## Overview

A comprehensive maintenance mode system has been implemented for the Afritec Bridge LMS, allowing administrators to temporarily restrict access to the platform while performing system updates, upgrades, or maintenance tasks.

## Features

### Backend Features

1. **Maintenance Mode Middleware**
   - Automatically blocks non-admin users when maintenance mode is active
   - Admins can bypass maintenance mode to manage settings
   - Exempt routes for authentication and public endpoints
   - Returns 503 Service Unavailable status during maintenance

2. **Maintenance Settings**
   - `maintenance_mode` - Enable/disable maintenance mode
   - `maintenance_message` - Custom message displayed to users
   - `maintenance_start_time` - When maintenance started (ISO 8601 format)
   - `maintenance_end_time` - Estimated completion time (ISO 8601 format)
   - `maintenance_show_countdown` - Show/hide countdown timer

3. **Public API Endpoints**
   - `GET /api/v1/maintenance/status` - Check if system is in maintenance
   - `GET /api/v1/maintenance/info` - Get detailed maintenance information

### Frontend Features

1. **Maintenance Mode Page**
   - Beautiful, responsive maintenance page with modern design
   - Displays custom maintenance message
   - Shows maintenance schedule (start/end times)
   - Live countdown timer to estimated completion
   - Auto-refresh to check when maintenance ends
   - Contact information for urgent support

2. **Automatic Redirection**
   - Non-admin users automatically redirected to maintenance page
   - Checks maintenance status every 2 minutes
   - Admins bypass maintenance mode automatically

3. **Enhanced Admin Settings Panel**
   - Toggle maintenance mode on/off
   - Configure maintenance message
   - Set start and end times with datetime pickers
   - Toggle countdown timer display
   - Visual warning about admin bypass

## Usage Instructions

### For Administrators

#### Enabling Maintenance Mode

1. **Login as Admin**
   - Navigate to Admin Dashboard → Settings

2. **Configure Maintenance Settings**
   - Go to the "General" tab
   - Toggle "Maintenance Mode" ON
   - Configure the following (optional but recommended):
     - **Maintenance Message**: Custom message for users (10-500 characters)
     - **Start Time**: When maintenance began (auto-filled with current time recommended)
     - **Estimated End Time**: When you expect to complete maintenance
     - **Show Countdown**: Whether to display a countdown timer

3. **Save Settings**
   - Click "Save All Changes"
   - System will immediately enter maintenance mode
   - Regular users will be redirected to the maintenance page
   - You (as admin) can continue accessing the system

#### Disabling Maintenance Mode

1. **Login as Admin** (you can still access during maintenance)
2. **Navigate to Settings → General Tab**
3. **Toggle "Maintenance Mode" OFF**
4. **Save Changes**
5. Users can now access the system normally

### For Developers

#### Backend Implementation

**Middleware Registration** (in `main.py`):
```python
from src.middleware.maintenance_mode import MaintenanceMode

# After blueprint registration
maintenance_mode = MaintenanceMode(app)
```

**Exempt Specific Routes** (if needed):
```python
from src.middleware.maintenance_mode import maintenance_mode_exempt

@blueprint.route('/special-endpoint')
@maintenance_mode_exempt
def special_endpoint():
    return jsonify({"message": "This works even in maintenance mode"})
```

**Check Maintenance Status**:
```python
from src.models.system_settings_models import SystemSettingsManager

settings_manager = SystemSettingsManager()
is_maintenance = settings_manager.get_setting('maintenance_mode', False, 'general')
```

#### Frontend Implementation

**Check Maintenance Status**:
```typescript
import { maintenanceService } from '@/services/maintenance.service';

const status = await maintenanceService.checkMaintenanceMode();
if (status.maintenance_mode) {
  // Handle maintenance mode
}
```

**Get Detailed Info**:
```typescript
const info = await maintenanceService.getMaintenanceInfo();
console.log(info.message);
console.log(info.estimated_end_time);
```

**Check if User is Admin**:
```typescript
const isAdmin = maintenanceService.isAdminUser();
```

## Architecture

### Backend Components

```
backend/src/
├── middleware/
│   ├── __init__.py
│   └── maintenance_mode.py          # Middleware implementation
├── routes/
│   └── maintenance_routes.py        # Public maintenance endpoints
├── models/
│   └── system_settings_models.py    # Maintenance settings (updated)
└── utils/
    └── settings_validator.py        # Validation rules (updated)
```

### Frontend Components

```
frontend/src/
├── app/
│   └── maintenance/
│       └── page.tsx                 # Maintenance page component
├── components/
│   ├── admin/
│   │   └── EnhancedSettingsPanel.tsx # Settings UI (updated)
│   ├── layout/
│   │   └── ClientLayout.tsx         # Wrapper integration (updated)
│   └── MaintenanceModeWrapper.tsx   # Route guard component
├── services/
│   └── maintenance.service.ts       # API service
└── utils/
    └── settingsValidator.ts          # Frontend validation (updated)
```

## Flow Diagram

```
User Request
     ↓
MaintenanceModeWrapper (Frontend)
     ↓
Check localStorage for admin role
     ↓
Check maintenance API
     ↓
Is maintenance ON?
     ├── Yes → Is user admin?
     │         ├── Yes → Allow access
     │         └── No  → Redirect to /maintenance
     └── No  → Allow access
```

## Database Schema

New settings in `system_settings` table:

| Key | Value Type | Category | Description |
|-----|-----------|----------|-------------|
| `maintenance_mode` | boolean | general | Enable/disable maintenance |
| `maintenance_message` | string | general | Custom message for users |
| `maintenance_start_time` | string | general | ISO 8601 timestamp |
| `maintenance_end_time` | string | general | ISO 8601 timestamp |
| `maintenance_show_countdown` | boolean | general | Show countdown timer |

## API Reference

### GET /api/v1/maintenance/status

**Description**: Check current maintenance status (public endpoint)

**Response**:
```json
{
  "maintenance_mode": true,
  "message": "The system is currently undergoing maintenance...",
  "start_time": "2025-02-07T10:00:00Z",
  "estimated_end_time": "2025-02-07T14:00:00Z",
  "current_time": "2025-02-07T11:30:00Z"
}
```

### GET /api/v1/maintenance/info

**Description**: Get detailed maintenance information (public endpoint)

**Response**:
```json
{
  "maintenance_mode": true,
  "message": "The system is currently undergoing maintenance...",
  "start_time": "2025-02-07T10:00:00Z",
  "estimated_end_time": "2025-02-07T14:00:00Z",
  "show_countdown": true,
  "allow_admin_bypass": true,
  "current_time": "2025-02-07T11:30:00Z"
}
```

## Security Considerations

1. **Admin Bypass**: Only users with 'admin' role can bypass maintenance mode
2. **Public Endpoints**: Maintenance status endpoints are public (no auth required)
3. **Settings Protection**: Only admins can modify maintenance settings
4. **JWT Validation**: Admin status verified via JWT tokens

## Best Practices

### Before Enabling Maintenance Mode

1. ✅ Announce maintenance to users in advance
2. ✅ Choose low-traffic time windows
3. ✅ Set realistic estimated end time
4. ✅ Craft clear, informative maintenance message
5. ✅ Test maintenance page appearance
6. ✅ Ensure admin access works
7. ✅ Have rollback plan ready

### During Maintenance

1. ✅ Monitor for unexpected issues
2. ✅ Update estimated end time if needed
3. ✅ Keep maintenance message current
4. ✅ Document changes made

### After Maintenance

1. ✅ Disable maintenance mode promptly
2. ✅ Verify system functionality
3. ✅ Monitor for issues
4. ✅ Notify users that system is back online

## Troubleshooting

### Users Can Still Access During Maintenance

**Possible Causes**:
- Frontend not checking maintenance status
- User has admin role
- Maintenance mode not saved properly

**Solutions**:
1. Verify maintenance_mode is `true` in settings
2. Check user role in database
3. Clear browser cache
4. Check backend logs for middleware errors

### Admin Cannot Access During Maintenance

**Possible Causes**:
- JWT token expired
- User role not set to 'admin'
- Middleware blocking admin routes

**Solutions**:
1. Re-login to refresh token
2. Verify user role in database
3. Check EXEMPT_ROUTES in middleware

### Maintenance Page Not Showing

**Possible Causes**:
- MaintenanceModeWrapper not integrated
- Frontend build cache
- API endpoint not responding

**Solutions**:
1. Verify ClientLayout includes MaintenanceModeWrapper
2. Clear Next.js build cache (`npm run dev` or rebuild)
3. Test `/api/v1/maintenance/status` endpoint directly

### Countdown Timer Not Working

**Possible Causes**:
- `maintenance_end_time` not set
- `maintenance_show_countdown` is false
- Invalid datetime format

**Solutions**:
1. Set estimated end time in settings
2. Ensure show_countdown is enabled
3. Use ISO 8601 format: `YYYY-MM-DDTHH:mm:ss`

## Future Enhancements

Potential improvements for future versions:

1. **Scheduled Maintenance**
   - Auto-enable maintenance at scheduled time
   - Auto-disable when maintenance window ends
   - Multiple maintenance windows

2. **Partial Maintenance**
   - Restrict specific routes/features only
   - Read-only mode
   - Module-specific maintenance

3. **Multi-Language Support**
   - Maintenance messages in multiple languages
   - Auto-detect user language

4. **Notifications**
   - Email notifications about upcoming maintenance
   - SMS alerts for critical users
   - In-app notifications before maintenance

5. **Status Page**
   - Public status page showing system health
   - Historical uptime data
   - Incident reports

6. **API Rate Limiting**
   - Prevent status endpoint abuse
   - Cache maintenance status

## Testing Checklist

- [ ] Enable maintenance mode as admin
- [ ] Verify non-admin users redirected to maintenance page
- [ ] Verify admin can still access all admin routes
- [ ] Check maintenance message displays correctly
- [ ] Verify countdown timer works (if enabled)
- [ ] Test auto-refresh after maintenance ends
- [ ] Test with different browsers
- [ ] Test on mobile devices
- [ ] Verify datetime pickers work correctly
- [ ] Test disabling maintenance mode
- [ ] Check API endpoints respond correctly
- [ ] Verify settings validation works
- [ ] Test with invalid datetime formats

## Support

For issues or questions:
- Email: afritech.bridge@yahoo.com
- Check backend logs for middleware errors
- Check browser console for frontend errors
- Review maintenance settings in admin panel

---

**Last Updated**: February 7, 2026
**Version**: 1.0.0
