FROM node:20.20.2-slim

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run prisma:generate && npm run build

EXPOSE 3000
CMD ["sh", "-c", "npx prisma migrate deploy && npm run start"]
