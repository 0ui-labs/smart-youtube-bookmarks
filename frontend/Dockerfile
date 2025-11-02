FROM node:20-alpine

WORKDIR /app

# Create non-root user and set ownership
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app

COPY package*.json ./
RUN npm ci

COPY . .

EXPOSE 5173

# Switch to non-root user
USER nodejs
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
