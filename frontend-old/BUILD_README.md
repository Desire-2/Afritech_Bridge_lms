# Build Scripts for AfriTec Bridge LMS Frontend

This directory contains build scripts to help manage the Next.js application build process.

## Available Scripts

### 1. npm run build (Recommended for Production)

The standard Next.js build command that:

- Uses the prebuild script to configure `.npmrc`
- Installs dependencies with legacy peer deps support
- Builds the Next.js application optimized for production

```bash
# To run manually
npm run build
```

### 2. fix-all-and-build.sh

A simpler script that forcefully installs dependencies and builds the application:

```bash
# To run manually
chmod +x fix-all-and-build.sh
./fix-all-and-build.sh
```

### 3. fix-deps-and-build.sh

The original script that focuses on fixing the cmdk dependency issue:

```bash
# To run manually
chmod +x fix-deps-and-build.sh
./fix-deps-and-build.sh
```

### 4. pre-build-fix.sh

Sets up the npm configuration and updates package.json:

```bash
# To run manually
chmod +x pre-build-fix.sh
./pre-build-fix.sh
```

## Common Issues

### CMDK Version Problems

The most common issue is with the `cmdk` package. Our scripts ensure version 1.1.1 is installed and properly configured in package.json.

### Peer Dependency Issues

We use the `--legacy-peer-deps` flag to bypass peer dependency issues, which are common when working with React 19 and Next.js.

### Missing or Incorrect Tailwind Configuration

The build scripts verify that TailwindCSS is properly installed.

## Vercel Deployment

The project is configured to use `npm run build` for Vercel deployments via the `vercel.json` configuration.

## Local Development

For local development, you can use the standard Next.js commands:

```bash
npm run dev
```

If you encounter dependency issues locally, you can run `npm run build` to reset your environment.