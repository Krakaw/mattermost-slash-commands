FROM node:10.15-alpine

WORKDIR /app
COPY . ./
RUN npm install
CMD ["npm",  "run",  "start"]
