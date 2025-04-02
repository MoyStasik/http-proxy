FROM node:18-alpine

WORKDIR /app

RUN apk add --no-cache openssl

COPY package.json .
RUN npm install

COPY . .

RUN mkdir -p /app/certs && \
    openssl genrsa -out /app/certs/ca.key 2048 && \
    openssl req -new -x509 -days 3650 -key /app/certs/ca.key -out /app/certs/ca.crt \
    -subj "/C=US/ST=California/L=San Francisco/O=Proxy Scanner/CN=Proxy Scanner CA"

EXPOSE 8000 8080

CMD ["node", "src/proxy.js"]
