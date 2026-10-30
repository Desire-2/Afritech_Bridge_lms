import type { Metadata } from 'next';
import CourseListClient from './CourseListClient';
import type { Course } from '@/types/api';
import { SITE_NAME, SITE_URL, fetchPublicCourses, jsonLd, truncate } from '@/utils/seo';

export const metadata: Metadata = {
  title: 'Courses & Programs',
  description: `Browse instructor-led tech courses on ${SITE_NAME} — software development, data, design and more, with cohorts, scholarships and career support.`,
  alternates: { canonical: '/courses' },
  openGraph: {
    type: 'website',
    url: '/courses',
    siteName: SITE_NAME,
    title: `Courses & Programs | ${SITE_NAME}`,
    description: `Browse instructor-led tech courses on ${SITE_NAME} — software development, data, design and more, with cohorts, scholarships and career support.`,
    locale: 'en_US',
  },
  twitter: {
    card: 'summary',
    title: `Courses & Programs | ${SITE_NAME}`,
    description: `Browse instructor-led tech courses on ${SITE_NAME} — software development, data, design and more, with cohorts, scholarships and career support.`,
  },
};

export default async function CoursesPage() {
  const courses = await fetchPublicCourses();

  const listGraph = courses.length
    ? [
        {
          '@type': 'CollectionPage',
          name: `Courses & Programs | ${SITE_NAME}`,
          url: `${SITE_URL}/courses`,
          inLanguage: 'en',
          description: truncate(
            `Browse instructor-led tech courses on ${SITE_NAME} — software development, data, design and more.`,
            155
          ),
          mainEntity: {
            '@type': 'ItemList',
            numberOfItems: courses.length,
            itemListElement: courses.slice(0, 100).map((course, index) => ({
              '@type': 'ListItem',
              position: index + 1,
              name: course.title,
              url: `${SITE_URL}/courses/${course.id}`,
            })),
          },
        },
      ]
    : null;

  return (
    <>
      {listGraph && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLd({ '@context': 'https://schema.org', '@graph': listGraph }) }}
        />
      )}
      <CourseListClient initialCourses={courses as unknown as Course[]} />
    </>
  );
}
