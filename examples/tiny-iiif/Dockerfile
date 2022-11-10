FROM node:16-slim
ENV IIIF_IMAGE_PATH=/data
RUN apt-get update -qq && apt-get install -y curl && apt-get clean
COPY --chown=node:node . /var/app
USER node
WORKDIR /var/app
RUN npm i --omit=dev
CMD ./index.js
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=2s \
  CMD curl -s http://localhost:3000/iiif/2 | grep OK
