FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

RUN mkdir -p logs && chown -R node:node logs

USER node

EXPOSE 3000

CMD ["npm", "start"]
