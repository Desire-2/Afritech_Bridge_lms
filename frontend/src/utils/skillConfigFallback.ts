/**
 * Frontend fallback skill config resolver.
 *
 * Mirrors the keyword-matching logic from backend/src/config/course_skill_profiles.py
 * so the frontend can display the correct Section 3 questions even when the API
 * response doesn't include skill_assessment_config (e.g. cached data or network race).
 */

import type { SkillAssessmentConfig } from '@/types/api';

const FALLBACK_PROFILES: Record<string, Omit<SkillAssessmentConfig, 'profile_key'>> = {
  excel: {
    subject_label: 'Microsoft Excel',
    tool_name: 'Excel',
    prior_use_question: 'Have you used Microsoft Excel before?',
    skill_level_label: 'What is your current Excel skill level?',
    skill_level_options: [
      'Never used it',
      'Beginner (basic data entry)',
      'Intermediate (formulas, charts)',
      'Advanced (pivot tables, VLOOKUP, macros)',
      'Expert (VBA, Power Query, dashboards)',
    ],
    tasks_label: 'Which of these have you done in Excel? (select all that apply)',
    tasks_options: [
      'Entered and organized data',
      'Used basic formulas (SUM, AVERAGE)',
      'Created charts or graphs',
      'Used VLOOKUP or HLOOKUP',
      'Created pivot tables',
      'Used conditional formatting',
      'Wrote macros or VBA code',
      'Built dashboards',
    ],
    open_question_label: 'Describe a time you used Excel to solve a problem (optional)',
    open_question_placeholder: 'e.g. I tracked monthly expenses for my family business...',
  },
  python: {
    subject_label: 'Python Programming',
    tool_name: 'Python',
    prior_use_question: 'Have you written code in Python before?',
    skill_level_label: 'What is your current Python skill level?',
    skill_level_options: [
      'Never programmed before',
      'Beginner (variables, loops, basic syntax)',
      'Intermediate (functions, files, OOP basics)',
      'Advanced (libraries, APIs, data structures)',
      'Expert (frameworks, testing, deployment)',
    ],
    tasks_label: 'Which of these have you done in Python? (select all that apply)',
    tasks_options: [
      'Written and run a Python script',
      'Used loops and conditionals',
      'Written functions',
      'Worked with files (read/write)',
      'Used pip and installed libraries',
      'Built a small project or script',
      'Used pandas or numpy',
      'Connected to an API',
      'Built a web app with Flask or Django',
    ],
    open_question_label: 'Describe a Python project you\'ve worked on (optional)',
    open_question_placeholder: 'e.g. I built a script to automate downloading files...',
  },
  web_development: {
    subject_label: 'Web Development',
    tool_name: 'HTML/CSS/JavaScript',
    prior_use_question: 'Have you built a website or web page before?',
    skill_level_label: 'What is your current web development skill level?',
    skill_level_options: [
      'No experience at all',
      'Beginner (HTML basics, seen some CSS)',
      'Intermediate (HTML + CSS, basic JavaScript)',
      'Advanced (JavaScript frameworks, responsive design)',
      'Expert (full-stack, deployment, APIs)',
    ],
    tasks_label: 'Which of these have you done? (select all that apply)',
    tasks_options: [
      'Written HTML to build a webpage',
      'Styled a page with CSS',
      'Used JavaScript to add interactivity',
      'Built a responsive/mobile-friendly layout',
      'Used a CSS framework (Bootstrap, Tailwind)',
      'Used a JavaScript framework (React, Vue)',
      'Built a backend with Node.js or Python',
      'Deployed a website online',
      'Connected a frontend to an API or database',
    ],
    open_question_label: 'Share a link to a website or project you\'ve built (optional)',
    open_question_placeholder: 'e.g. https://myproject.netlify.app or \'I built a personal blog...\'',
  },
  graphic_design: {
    subject_label: 'Graphic Design',
    tool_name: 'Design Tools',
    prior_use_question: 'Have you used any graphic design software before?',
    skill_level_label: 'What is your current graphic design skill level?',
    skill_level_options: [
      'No design experience',
      'Beginner (Canva, basic editing)',
      'Intermediate (Photoshop or Illustrator basics)',
      'Advanced (professional tools, typography, layout)',
      'Expert (brand identity, print + digital design)',
    ],
    tasks_label: 'Which of these have you done? (select all that apply)',
    tasks_options: [
      'Created a poster or flyer',
      'Designed a social media post',
      'Edited or retouched a photo',
      'Created a logo',
      'Worked with typography and fonts',
      'Designed print materials (brochure, business card)',
      'Used Canva',
      'Used Adobe Photoshop or Illustrator',
      'Used Figma or Sketch for UI design',
    ],
    open_question_label: 'Describe a design project you are proud of (optional)',
    open_question_placeholder: 'e.g. I designed a logo for a local NGO...',
  },
  data_analysis: {
    subject_label: 'Data Analysis',
    tool_name: 'Data Tools',
    prior_use_question: 'Have you analyzed data or worked with datasets before?',
    skill_level_label: 'What is your current data analysis skill level?',
    skill_level_options: [
      'No experience with data',
      'Beginner (spreadsheets, basic charts)',
      'Intermediate (Excel/Sheets analysis, some SQL or Python)',
      'Advanced (pandas, SQL queries, data visualization)',
      'Expert (statistical modeling, dashboards, BI tools)',
    ],
    tasks_label: 'Which of these have you done? (select all that apply)',
    tasks_options: [
      'Cleaned or organized a dataset',
      'Created charts or visualizations',
      'Used formulas to summarize data',
      'Written SQL queries',
      'Used pandas or Excel for analysis',
      'Built a dashboard (Power BI, Tableau, Looker)',
      'Applied statistics (mean, median, regression)',
      'Worked with real-world datasets',
      'Presented data insights to others',
    ],
    open_question_label: 'Describe a data analysis you performed (optional)',
    open_question_placeholder: 'e.g. I analyzed student attendance data to find trends...',
  },
  backend_development: {
    subject_label: 'Backend Development',
    tool_name: 'Backend/Server-Side Programming',
    prior_use_question: 'Have you built server-side applications or APIs before?',
    skill_level_label: 'What is your current backend development skill level?',
    skill_level_options: [
      'No backend experience',
      'Beginner (understand client-server concept)',
      'Intermediate (built simple APIs, used a framework)',
      'Advanced (databases, authentication, deployment)',
      'Expert (microservices, scalability, DevOps)',
    ],
    tasks_label: 'Which of these have you done? (select all that apply)',
    tasks_options: [
      'Built a REST API',
      'Used a web framework (Flask, Django, Express, Laravel)',
      'Connected an app to a database',
      'Implemented user authentication',
      'Written SQL or used an ORM',
      'Deployed a backend to a server or cloud',
      'Used environment variables and secrets management',
      'Written unit or integration tests',
    ],
    open_question_label: 'Describe a backend project you\'ve built (optional)',
    open_question_placeholder: 'e.g. I built a REST API for a student management system...',
  },
  digital_marketing: {
    subject_label: 'Digital Marketing',
    tool_name: 'Digital Marketing Tools',
    prior_use_question: 'Have you done any digital marketing or online promotion before?',
    skill_level_label: 'What is your current digital marketing skill level?',
    skill_level_options: [
      'No experience',
      'Beginner (social media posts, basic ads)',
      'Intermediate (campaigns, SEO basics, analytics)',
      'Advanced (paid ads, email marketing, funnels)',
      'Expert (full strategy, automation, attribution)',
    ],
    tasks_label: 'Which of these have you done? (select all that apply)',
    tasks_options: [
      'Managed a social media page or account',
      'Run a paid ad (Facebook, Google, Instagram)',
      'Written content for a blog or website',
      'Used Google Analytics or Meta Insights',
      'Done keyword research or basic SEO',
      'Built an email marketing campaign',
      'Created and tracked a marketing funnel',
      'Worked with a brand or business on promotion',
    ],
    open_question_label: 'Describe a campaign or marketing project you\'ve worked on (optional)',
    open_question_placeholder: 'e.g. I managed Instagram for a local restaurant and grew followers by 40%...',
  },
  general: {
    subject_label: 'Digital Skills',
    tool_name: 'Computers & Digital Tools',
    prior_use_question: 'Have you used a computer or digital tools for work or learning before?',
    skill_level_label: 'What is your current digital skill level?',
    skill_level_options: [
      'No experience with computers',
      'Beginner (basic typing, internet browsing)',
      'Intermediate (email, office tools, video calls)',
      'Advanced (multiple tools, online collaboration)',
      'Expert (technical/professional digital skills)',
    ],
    tasks_label: 'Which of these have you done? (select all that apply)',
    tasks_options: [
      'Used email professionally',
      'Used Google Docs, Sheets, or Slides',
      'Attended an online class or video call',
      'Used social media for professional purposes',
      'Created or edited a document or presentation',
      'Used a smartphone for work or learning',
      'Done online research for a project',
    ],
    open_question_label: 'Describe how you currently use digital tools in your daily life (optional)',
    open_question_placeholder: 'e.g. I use my phone and Google Docs to manage my small business...',
  },
};

const TITLE_KEYWORD_TO_PROFILE: Record<string, string> = {
  excel: 'excel',
  python: 'python',
  web: 'web_development',
  html: 'web_development',
  css: 'web_development',
  react: 'web_development',
  design: 'graphic_design',
  figma: 'graphic_design',
  photoshop: 'graphic_design',
  data: 'data_analysis',
  sql: 'data_analysis',
  analytics: 'data_analysis',
  flask: 'backend_development',
  django: 'backend_development',
  backend: 'backend_development',
  api: 'backend_development',
  marketing: 'digital_marketing',
  seo: 'digital_marketing',
};

const CATEGORY_TO_PROFILE: Record<string, string> = {
  excel: 'excel',
  spreadsheet: 'excel',
  'microsoft office': 'excel',
  python: 'python',
  programming: 'python',
  'web development': 'web_development',
  'web dev': 'web_development',
  frontend: 'web_development',
  'full stack': 'web_development',
  'graphic design': 'graphic_design',
  design: 'graphic_design',
  'ui/ux': 'graphic_design',
  'data analysis': 'data_analysis',
  'data science': 'data_analysis',
  data: 'data_analysis',
  backend: 'backend_development',
  'backend development': 'backend_development',
  'digital marketing': 'digital_marketing',
  marketing: 'digital_marketing',
};

/**
 * Resolve the skill assessment config for a course from title + category.
 * This is a client-side fallback — the backend also computes this and returns
 * it as `skill_assessment_config` on the course detail endpoint.
 */
/**
 * Map a skill_profile_key (e.g. "python", "web_development") to its human-readable
 * subject label (e.g. "Python Programming", "Web Development").
 * Returns "Excel" as the default/fallback for legacy applications.
 */
export function getSkillProfileLabel(profileKey?: string | null): string {
  if (!profileKey) return 'Excel';
  const profile = FALLBACK_PROFILES[profileKey];
  return profile?.subject_label || 'Excel';
}

export function getDefaultSkillConfig(
  courseTitle?: string | null,
  courseCategory?: string | null,
): SkillAssessmentConfig {
  const titleLower = (courseTitle || '').toLowerCase();
  const categoryLower = (courseCategory || '').toLowerCase().trim();

  // 1. Title keyword match (highest priority)
  for (const [keyword, profileKey] of Object.entries(TITLE_KEYWORD_TO_PROFILE)) {
    if (titleLower.includes(keyword)) {
      return { profile_key: profileKey, ...FALLBACK_PROFILES[profileKey] } as SkillAssessmentConfig;
    }
  }

  // 2. Category match
  for (const [catKey, profileKey] of Object.entries(CATEGORY_TO_PROFILE)) {
    if (categoryLower.includes(catKey)) {
      return { profile_key: profileKey, ...FALLBACK_PROFILES[profileKey] } as SkillAssessmentConfig;
    }
  }

  // 3. Fallback
  return { profile_key: 'general', ...FALLBACK_PROFILES.general } as SkillAssessmentConfig;
}
