# Build Scripts for AfriTec Bridge LMS Frontend

This directory contains several build scripts to help manage dependency issues and ensure successful builds, particularly when deploying to environments like Vercel.

## Available Scripts

### 1. vercel-build.sh (Recommended for Production)

This is the most comprehensive build script, designed specifically for Vercel deployments. It:

- Creates proper `.npmrc` configuration
- Updates `package.json` to enforce correct dependency versions
- Cleans existing installations
- Installs dependencies with all necessary flags
- Verifies critical dependencies
- Builds the Next.js application

```bash
# To run manually
chmod +x vercel-build.sh
./vercel-build.sh
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

The project is configured to use `vercel-build.sh` for Vercel deployments via the `vercel.json` configuration.

## Local Development

For local development, you can use the standard Next.js commands:

```bash
npm run dev
```

If you encounter dependency issues locally, you can run `./vercel-build.sh` to reset your environment.