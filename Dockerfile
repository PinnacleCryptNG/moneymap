# MoneyMap — API + customer app in one container.
FROM node:22-slim
WORKDIR /app
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build:server-app
ENV NODE_ENV=production \
    PORT=8080 \
    MONEYMAP_DB=/data/moneymap.db
VOLUME /data
EXPOSE 8080
# Set MONEYMAP_SECRET in your host's environment so sign-in tokens survive restarts.
CMD ["npm", "start"]
