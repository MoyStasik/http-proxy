FROM node:18-alpine

WORKDIR /app

COPY package.json .
RUN npm install

COPY . .

EXPOSE 8000 8080

CMD ["node", "src/proxy.js"]
