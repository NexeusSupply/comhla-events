FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev --no-audit --no-fund
COPY . .
ENV PORT=3050 DB_PATH=/app/data/comhla-events.sqlite TZ=Pacific/Auckland
EXPOSE 3050
CMD ["node", "--no-warnings", "src/server.js"]
