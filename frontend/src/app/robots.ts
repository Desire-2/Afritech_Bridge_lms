import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/utils/seo';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/auth/',
        '/student/',
        '/instructor/',
        '/admin/',
        '/api/',
        '/payment/',
        '/verify/',
        '/unsubscribe/',
        '/test-login/',
        '/api-test/',
        '/token-test/',
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
