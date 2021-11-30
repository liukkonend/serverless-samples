FROM node:14

WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install
COPY app.js ./
EXPOSE 80
CMD [ "node", "app.js" ]