#!/usr/bin/env bash
# Install dependencies
npm install

# Generate Prisma Client
npx prisma generate

# The start command will be handled by Render