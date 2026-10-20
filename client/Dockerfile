# Development image: runs the Vite dev server with hot reload.
# (A production image would build static files and serve them with nginx.)
FROM node:22-alpine

WORKDIR /app
RUN chown node:node /app
USER node

# Install dependencies first so this layer is cached until package files change.
COPY --chown=node:node package.json package-lock.json ./
RUN npm ci

COPY --chown=node:node . .

EXPOSE 5173

CMD ["npm", "run", "dev"]
