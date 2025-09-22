import { NextConfig } from 'next'

const nextConfig: NextConfig = {
  /* config options here */
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  output: 'standalone',
  trailingSlash: false,
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    domains: ['localhost'],
    unoptimized: process.env.NODE_ENV === 'production'
  }
}

export default nextConfig
