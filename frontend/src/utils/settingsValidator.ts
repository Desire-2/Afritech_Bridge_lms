// Settings Validation Service for Frontend
// Matches backend validation rules

export interface ValidationRule {
  type: 'string' | 'integer' | 'float' | 'boolean' | 'email' | 'url' | 'json';
  required?: boolean;
  min_length?: number;
  max_length?: number;
  min?: number;
  max?: number;
  pattern?: string;
  description?: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export interface CrossFieldRule {
  fields: string[];
  rule: string;
  message: string;
}

export class SettingsValidator {
  // Email regex pattern
  private static readonly EMAIL_PATTERN = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  
  // URL regex pattern
  private static readonly URL_PATTERN = /^https?:\/\/(?:(?:[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?\.)+[A-Z]{2,6}\.?|localhost|\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})(?::\d+)?(?:\/?|[/?]\S+)$/i;

  // Setting validation rules by key
  private static readonly VALIDATION_RULES: Record<string, ValidationRule> = {
    // General settings
    site_name: {
      type: 'string',
      required: true,
      min_length: 1,
      max_length: 100,
      description: 'Site name must be between 1 and 100 characters'
    },
    site_url: {
      type: 'url',
      required: true,
      description: 'Site URL must be a valid HTTP/HTTPS URL'
    },
    support_email: {
      type: 'email',
      required: true,
      description: 'Support email must be a valid email address'
    },
    maintenance_mode: {
      type: 'boolean',
      description: 'Maintenance mode must be true or false'
    },
    maintenance_message: {
      type: 'string',
      required: false,
      min_length: 10,
      max_length: 500,
      description: 'Maintenance message must be between 10 and 500 characters'
    },
    maintenance_start_time: {
      type: 'string',
      required: false,
      description: 'Maintenance start time (ISO 8601 format)'
    },
    maintenance_end_time: {
      type: 'string',
      required: false,
      description: 'Maintenance end time (ISO 8601 format)'
    },
    maintenance_show_countdown: {
      type: 'boolean',
      description: 'Show countdown timer on maintenance page'
    },
    analytics_enabled: {
      type: 'boolean',
      description: 'Analytics enabled must be true or false'
    },
    
    // Email settings
    smtp_host: {
      type: 'string',
      required: false,
      min_length: 3,
      max_length: 255,
      description: 'SMTP host must be between 3 and 255 characters'
    },
    smtp_port: {
      type: 'integer',
      min: 1,
      max: 65535,
      description: 'SMTP port must be between 1 and 65535'
    },
    from_email: {
      type: 'email',
      required: false,
      description: 'From email must be a valid email address'
    },
    from_name: {
      type: 'string',
      required: false,
      min_length: 1,
      max_length: 100,
      description: 'From name must be between 1 and 100 characters'
    },
    enable_tls: {
      type: 'boolean',
      description: 'Enable TLS must be true or false'
    },
    
    // Course settings
    max_students_per_course: {
      type: 'integer',
      min: 1,
      max: 10000,
      description: 'Maximum students per course must be between 1 and 10000'
    },
    min_quiz_duration: {
      type: 'integer',
      min: 1,
      max: 1440,
      description: 'Minimum quiz duration must be between 1 and 1440 minutes'
    },
    max_quiz_duration: {
      type: 'integer',
      min: 1,
      max: 1440,
      description: 'Maximum quiz duration must be between 1 and 1440 minutes'
    },
    require_certificate: {
      type: 'boolean',
      description: 'Require certificate must be true or false'
    },
    enable_forum_moderation: {
      type: 'boolean',
      description: 'Enable forum moderation must be true or false'
    },
    
    // User settings
    enable_user_registration: {
      type: 'boolean',
      description: 'Enable user registration must be true or false'
    },
    require_email_verification: {
      type: 'boolean',
      description: 'Require email verification must be true or false'
    },
    max_login_attempts: {
      type: 'integer',
      min: 1,
      max: 100,
      description: 'Maximum login attempts must be between 1 and 100'
    },
    session_timeout: {
      type: 'integer',
      min: 1,
      max: 10080,
      description: 'Session timeout must be between 1 and 10080 minutes'
    },
    enable_oauth: {
      type: 'boolean',
      description: 'Enable OAuth must be true or false'
    },
    
    // Security settings
    password_min_length: {
      type: 'integer',
      min: 4,
      max: 128,
      description: 'Password minimum length must be between 4 and 128 characters'
    },
    password_require_uppercase: {
      type: 'boolean',
      description: 'Password require uppercase must be true or false'
    },
    password_require_numbers: {
      type: 'boolean',
      description: 'Password require numbers must be true or false'
    },
    password_require_special: {
      type: 'boolean',
      description: 'Password require special characters must be true or false'
    },
    enable_two_factor: {
      type: 'boolean',
      description: 'Enable two-factor authentication must be true or false'
    },
    
    // AI settings
    ai_agent_enabled: {
      type: 'boolean',
      description: 'AI agent enabled must be true or false'
    },
    ai_max_requests_per_day: {
      type: 'integer',
      min: 1,
      max: 10000,
      description: 'AI max requests per day must be between 1 and 10000'
    },
  };

  // Cross-field validation rules
  private static readonly CROSS_FIELD_RULES: CrossFieldRule[] = [
    {
      fields: ['min_quiz_duration', 'max_quiz_duration'],
      rule: 'min_quiz_duration <= max_quiz_duration',
      message: 'Minimum quiz duration must be less than or equal to maximum quiz duration'
    },
  ];

  static validateSetting(key: string, value: any): ValidationResult {
    const rule = this.VALIDATION_RULES[key];
    if (!rule) {
      return { isValid: true, errors: [] };
    }

    const errors: string[] = [];

    // Check required fields
    if (rule.required && (value === null || value === undefined || value === '')) {
      errors.push(`${key} is required`);
      return { isValid: false, errors };
    }

    // Allow empty/null values for non-required fields
    if (value === null || value === undefined || value === '') {
      return { isValid: true, errors: [] };
    }

    // Type-specific validation
    switch (rule.type) {
      case 'string':
        this.validateString(value, rule, errors);
        break;
      case 'integer':
        this.validateInteger(value, rule, errors);
        break;
      case 'float':
        this.validateFloat(value, rule, errors);
        break;
      case 'boolean':
        this.validateBoolean(value, rule, errors);
        break;
      case 'email':
        this.validateEmail(value, rule, errors);
        break;
      case 'url':
        this.validateUrl(value, rule, errors);
        break;
      case 'json':
        this.validateJson(value, rule, errors);
        break;
    }

    return { isValid: errors.length === 0, errors };
  }

  static validateSettings(settings: Record<string, any>): Record<string, string[]> {
    const errors: Record<string, string[]> = {};

    // Validate individual settings
    for (const [key, value] of Object.entries(settings)) {
      const result = this.validateSetting(key, value);
      if (!result.isValid) {
        errors[key] = result.errors;
      }
    }

    // Validate cross-field rules
    for (const rule of this.CROSS_FIELD_RULES) {
      if (rule.fields.every(field => field in settings)) {
        if (!this.evaluateCrossFieldRule(settings, rule)) {
          for (const field of rule.fields) {
            if (!errors[field]) errors[field] = [];
            errors[field].push(rule.message);
          }
        }
      }
    }

    return errors;
  }

  private static validateString(value: any, rule: ValidationRule, errors: string[]): void {
    const strValue = String(value);

    if (rule.min_length && strValue.length < rule.min_length) {
      errors.push(`Must be at least ${rule.min_length} characters long`);
    }

    if (rule.max_length && strValue.length > rule.max_length) {
      errors.push(`Must be no more than ${rule.max_length} characters long`);
    }

    if (rule.pattern && !new RegExp(rule.pattern).test(strValue)) {
      errors.push(rule.description || 'Invalid format');
    }
  }

  private static validateInteger(value: any, rule: ValidationRule, errors: string[]): void {
    const numValue = parseInt(String(value), 10);

    if (isNaN(numValue)) {
      errors.push(rule.description || 'Must be a valid integer');
      return;
    }

    if (rule.min !== undefined && numValue < rule.min) {
      errors.push(`Must be at least ${rule.min}`);
    }

    if (rule.max !== undefined && numValue > rule.max) {
      errors.push(`Must be no more than ${rule.max}`);
    }
  }

  private static validateFloat(value: any, rule: ValidationRule, errors: string[]): void {
    const numValue = parseFloat(String(value));

    if (isNaN(numValue)) {
      errors.push(rule.description || 'Must be a valid number');
      return;
    }

    if (rule.min !== undefined && numValue < rule.min) {
      errors.push(`Must be at least ${rule.min}`);
    }

    if (rule.max !== undefined && numValue > rule.max) {
      errors.push(`Must be no more than ${rule.max}`);
    }
  }

  private static validateBoolean(value: any, rule: ValidationRule, errors: string[]): void {
    if (typeof value === 'boolean') return;

    if (typeof value === 'string') {
      const lowerValue = value.toLowerCase();
      if (['true', '1', 'yes', 'on', 'false', '0', 'no', 'off'].includes(lowerValue)) {
        return;
      }
    }

    if (typeof value === 'number' && (value === 0 || value === 1)) {
      return;
    }

    errors.push(rule.description || 'Must be true or false');
  }

  private static validateEmail(value: any, rule: ValidationRule, errors: string[]): void {
    const strValue = String(value);

    if (!this.EMAIL_PATTERN.test(strValue)) {
      errors.push(rule.description || 'Must be a valid email address');
    }
  }

  private static validateUrl(value: any, rule: ValidationRule, errors: string[]): void {
    const strValue = String(value);

    if (!this.URL_PATTERN.test(strValue)) {
      errors.push(rule.description || 'Must be a valid HTTP/HTTPS URL');
      return;
    }

    try {
      const url = new URL(strValue);
      if (!['http:', 'https:'].includes(url.protocol)) {
        errors.push('URL must use HTTP or HTTPS protocol');
      }
    } catch {
      errors.push(rule.description || 'Must be a valid URL');
    }
  }

  private static validateJson(value: any, rule: ValidationRule, errors: string[]): void {
    if (typeof value === 'object' && value !== null) return;

    if (typeof value === 'string') {
      try {
        JSON.parse(value);
        return;
      } catch {
        errors.push(rule.description || 'Must be valid JSON');
      }
    }

    errors.push(rule.description || 'Must be valid JSON');
  }

  private static evaluateCrossFieldRule(settings: Record<string, any>, rule: CrossFieldRule): boolean {
    if (rule.rule === 'min_quiz_duration <= max_quiz_duration') {
      const minDuration = parseInt(String(settings.min_quiz_duration), 10);
      const maxDuration = parseInt(String(settings.max_quiz_duration), 10);

      if (!isNaN(minDuration) && !isNaN(maxDuration)) {
        return minDuration <= maxDuration;
      }
    }

    return true;
  }

  static getSettingRule(key: string): ValidationRule | null {
    return this.VALIDATION_RULES[key] || null;
  }

  static getSettingDescription(key: string): string {
    const rule = this.VALIDATION_RULES[key];
    return rule?.description || `Setting: ${key}`;
  }

  static isValidSettingKey(key: string): boolean {
    return key in this.VALIDATION_RULES;
  }

  static getAllSettingKeys(): string[] {
    return Object.keys(this.VALIDATION_RULES);
  }

  static validateSettingType(key: string, value: any): boolean {
    const rule = this.VALIDATION_RULES[key];
    if (!rule) return true;

    switch (rule.type) {
      case 'string':
        return typeof value === 'string' || value == null;
      case 'integer':
        return typeof value === 'number' || !isNaN(parseInt(String(value), 10));
      case 'float':
        return typeof value === 'number' || !isNaN(parseFloat(String(value)));
      case 'boolean':
        return typeof value === 'boolean' || 
               ['true', 'false', '1', '0', 1, 0].includes(value);
      case 'email':
      case 'url':
        return typeof value === 'string' || value == null;
      case 'json':
        return typeof value === 'object' || typeof value === 'string' || value == null;
    }

    return true;
  }
}

export class SettingsSecurityValidator {
  private static readonly SENSITIVE_SETTINGS = [
    'smtp_host', 'smtp_port', 'from_email',
    'password_min_length', 'max_login_attempts',
    'session_timeout', 'enable_two_factor'
  ];

  private static readonly CRITICAL_SETTINGS = [
    'maintenance_mode', 'enable_user_registration',
    'require_email_verification', 'ai_agent_enabled'
  ];

  static isSensitiveSetting(key: string): boolean {
    return this.SENSITIVE_SETTINGS.includes(key);
  }

  static isCriticalSetting(key: string): boolean {
    return this.CRITICAL_SETTINGS.includes(key);
  }

  static validateSecurityImplications(settings: Record<string, any>): string[] {
    const warnings: string[] = [];

    // Check for weak security configurations
    if ((settings.password_min_length || 8) < 8) {
      warnings.push("Password minimum length below 8 characters may compromise security");
    }

    if ((settings.max_login_attempts || 5) > 10) {
      warnings.push("High maximum login attempts may allow brute force attacks");
    }

    if ((settings.session_timeout || 30) > 1440) { // 24 hours
      warnings.push("Long session timeout may increase security risk");
    }

    if (!settings.require_email_verification) {
      warnings.push("Disabled email verification may allow fake accounts");
    }

    if (settings.maintenance_mode) {
      warnings.push("Maintenance mode will prevent user access to the system");
    }

    // Check password requirements
    if (!settings.password_require_uppercase) {
      warnings.push("Not requiring uppercase letters weakens password security");
    }

    if (!settings.password_require_numbers) {
      warnings.push("Not requiring numbers weakens password security");
    }

    if (!settings.password_require_special) {
      warnings.push("Not requiring special characters weakens password security");
    }

    return warnings;
  }

  static requiresAdminConfirmation(key: string, oldValue: any, newValue: any): boolean {
    if (key === 'maintenance_mode' && newValue) {
      return true;
    }

    if (key === 'enable_user_registration' && !newValue) {
      return true;
    }

    if (key === 'max_login_attempts' && newValue < 3) {
      return true;
    }

    if (key === 'password_min_length' && newValue < 6) {
      return true;
    }

    return false;
  }
}

// Utility functions for common validation tasks
export const ValidationUtils = {
  /**
   * Validate multiple settings and return user-friendly error messages
   */
  validateSettingsWithMessages(settings: Record<string, any>): {
    isValid: boolean;
    errors: Record<string, string>;
    warnings: string[];
  } {
    const validationErrors = SettingsValidator.validateSettings(settings);
    const securityWarnings = SettingsSecurityValidator.validateSecurityImplications(settings);
    
    // Convert array errors to single string messages
    const errors: Record<string, string> = {};
    Object.entries(validationErrors).forEach(([key, errorList]) => {
      errors[key] = errorList[0]; // Take first error for UI display
    });

    return {
      isValid: Object.keys(errors).length === 0,
      errors,
      warnings: securityWarnings
    };
  },

  /**
   * Get validation rule information for UI help text
   */
  getSettingHelpText(key: string): string {
    return SettingsValidator.getSettingDescription(key);
  },

  /**
   * Check if a value change would trigger security warnings
   */
  hasSecurityImplications(key: string, oldValue: any, newValue: any): boolean {
    return SettingsSecurityValidator.isSensitiveSetting(key) ||
           SettingsSecurityValidator.isCriticalSetting(key) ||
           SettingsSecurityValidator.requiresAdminConfirmation(key, oldValue, newValue);
  }
};