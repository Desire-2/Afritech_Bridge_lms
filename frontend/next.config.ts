import { NextConfig } from 'next'

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  // Remove standalone output for Vercel
  trailingSlash: false,
  reactStrictMode: false,
  poweredByHeader: false,
  // Add empty turbopack config to silence warning
  turbopack: {},
  // Optimize for Vercel deployment
  experimental: {
    optimizePackageImports: ['@radix-ui/react-icons', '@radix-ui/react-slot'],
  },
  webpack: (config, { isServer, dev }) => {
    // Improve chunk loading reliability for production
    if (!isServer && !dev) {
      config.output.chunkLoadTimeout = 60000; // Increase timeout for Vercel
      config.output.crossOriginLoading = 'anonymous';
      
      // Optimize chunk splitting for better caching
      config.optimization.splitChunks = {
        chunks: 'all',
        maxInitialRequests: 25,
        minSize: 20000,
        cacheGroups: {
          framework: {
            chunks: 'all',
            name: 'framework',
            test: /(?<!node_modules.*)[\\/\\]node_modules[\\/\\](react|react-dom|scheduler|prop-types|use-subscription)[\\/\\]/,
            priority: 40,
            enforce: true,
          },
          lib: {
            test: /[\\/]node_modules[\\/]/,
            name: 'commons',
            priority: 30,
            minChunks: 2,
            reuseExistingChunk: true,
          },
          shared: {
            name: 'shared',
            minChunks: 2,
            priority: 10,
            reuseExistingChunk: true,
          },
        },
      };
    }
    return config;
  },
  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
      },
      {
        protocol: 'https',
        hostname: 'localhost',
      }
    ],
    unoptimized: process.env.NODE_ENV === 'production'
  },
  // Add this to silence hydration warnings in production
  onDemandEntries: {
    // period (in ms) where the server will keep pages in the buffer
    maxInactiveAge: 25 * 1000,
    // number of pages that should be kept simultaneously without being disposed
    pagesBufferLength: 2,
  }
}

export default nextConfig
