FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY index.js db.js ./
COPY routes/ ./routes/
COPY lib/ ./lib/
COPY dist/ ./dist/
EXPOSE 3001
CMD ["node", "index.js"]
