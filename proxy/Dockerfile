FROM node:20-alpine
WORKDIR /app

# Copy workspace root + shared schema + proxy source
COPY package.json ./
COPY packages/atp-schema ./packages/atp-schema
COPY proxy ./proxy

# Install all workspace deps from root
RUN npm install --workspace=proxy --workspace=packages/atp-schema --include-workspace-root

# Build atp-schema first so dist/ exists for TypeScript
WORKDIR /app/packages/atp-schema
RUN npx tsc

# Now compile proxy
WORKDIR /app/proxy
RUN npx tsc

CMD ["node", "dist/index.js"]
