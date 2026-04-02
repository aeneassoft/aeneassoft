FROM node:20-alpine
WORKDIR /app

# Copy workspace root + shared schema + backend source
COPY package.json ./
COPY packages/atp-schema ./packages/atp-schema
COPY backend ./backend

# Install all workspace deps from root
RUN npm install --workspace=backend --workspace=packages/atp-schema --include-workspace-root

# Build atp-schema first so dist/ exists for TypeScript
WORKDIR /app/packages/atp-schema
RUN npx tsc

# Generate Prisma client + compile backend
WORKDIR /app/backend
RUN npx prisma generate 2>/dev/null || true
RUN npx tsc

CMD ["node", "dist/index.js"]
