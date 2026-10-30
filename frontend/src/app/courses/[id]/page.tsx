import type { Metadata } from 'next';
import CourseDetailClient from './CourseDetailClient';
import type { CourseDetailData } from './CourseDetailClient';
import {
  SITE_NAME,
  SITE_URL,
  absoluteAssetUrl,
  fetchPublicCourse,
  jsonLd,
  truncate,
} from '@/utils/seo';

interface CoursePageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: CoursePageProps): Promise<Metadata> {
  const { id } = await params;
  const course = await fetchPublicCourse(id);

  if (!course) {
    return {
      title: 'Course not found',
      robots: { index: false, follow: false },
    };
  }

  const title = course.title || 'Course';
  const description = truncate(
    course.description || `${title} — an instructor-led course at ${SITE_NAME}.`,
    155
  );
  const canonical = `/courses/${id}`;
  const image = absoluteAssetUrl(course.thumbnail_url);
  const images = image ? [{ url: image, alt: title }] : undefined;

  return {
    title,
    description,
    keywords: [
      title,
      course.difficulty_level || '',
      'online course',
      'tech training',
      SITE_NAME,
    ].filter(Boolean),
    alternates: { canonical },
    openGraph: {
      type: 'article',
      url: canonical,
      siteName: SITE_NAME,
      title,
      description,
      images,
      locale: 'en_US',
    },
    twitter: {
      card: images ? 'summary_large_image' : 'summary',
      title,
      description,
      images,
    },
  };
}

export default async function CoursePage({ params }: CoursePageProps) {
  const { id } = await params;
  const course = await fetchPublicCourse(id);

  const canonical = `${SITE_URL}/courses/${id}`;
  const graph = course
    ? [
        {
          '@type': 'Course',
          name: course.title || undefined,
          description: truncate(course.description || '', 500) || undefined,
          url: canonical,
          inLanguage: 'en',
          provider: {
            '@type': 'Organization',
            name: SITE_NAME,
            url: SITE_URL,
          },
          publisher: {
            '@type': 'Organization',
            name: SITE_NAME,
            url: SITE_URL,
          },
          instructor: course.instructor_name
            ? { '@type': 'Person', name: course.instructor_name }
            : undefined,
          image: absoluteAssetUrl(course.thumbnail_url),
          level: course.difficulty_level || undefined,
          isAccessibleForFree: !(course.price && course.price > 0),
          offers:
            course.price && course.price > 0
              ? {
                  '@type': 'Offer',
                  price: course.price,
                  priceCurrency: (course.currency || 'USD').toUpperCase(),
                  url: canonical,
                  availability: 'https://schema.org/InStock',
                  seller: { '@type': 'Organization', name: SITE_NAME },
                }
              : undefined,
        },
        {
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/` },
            { '@type': 'ListItem', position: 2, name: 'Courses', item: `${SITE_URL}/courses` },
            { '@type': 'ListItem', position: 3, name: course.title || 'Course', item: canonical },
          ],
        },
      ].filter(Boolean)
    : null;

  const initialCourse: CourseDetailData | null = course
    ? ({
        success: true,
        course,
        progress: { overall_progress: 0, current_module: null, modules: [] },
      } as unknown as CourseDetailData)
    : null;

  return (
    <>
      {graph && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLd({ '@context': 'https://schema.org', '@graph': graph }) }}
        />
      )}
      <CourseDetailClient params={params} initialCourse={initialCourse} />
    </>
  );
}
