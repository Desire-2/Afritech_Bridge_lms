import type { MetadataRoute } from 'next';
import { SITE_URL, fetchPublicCourses, safeDate } from '@/utils/seo';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [
    { url: SITE_URL, changeFrequency: 'weekly', priority: 1 },
    { url: `${SITE_URL}/courses`, changeFrequency: 'daily', priority: 0.9 },
    { url: `${SITE_URL}/opportunities`, changeFrequency: 'weekly', priority: 0.6 },
  ];

  try {
    const courses = await fetchPublicCourses();
    for (const course of courses) {
      entries.push({
        url: `${SITE_URL}/courses/${course.id}`,
        lastModified: safeDate(course.updated_at),
        changeFrequency: 'weekly',
        priority: 0.8,
      });
    }
  } catch {
    // Keep the static entries even if the course API is unreachable at build time.
  }

  return entries;
}
