FROM node:18-alpine

WORKDIR /app

RUN apk add --no-cache \
    iputils \
    nmap \
    curl \
    wget

COPY package*.json ./

RUN npm install --only=production

COPY . .

EXPOSE 3001

USER node

CMD ["npm", "start"]