FROM alpine:latest
MAINTAINER Marcel Aust
RUN apk update && apk add nodejs && apk add git
RUN mkdir /var/app
WORKDIR /var/app
RUN git clone https://github.com/Marcel2508/MinecraftPEStats.git .
RUN npm install
RUN mkdir /mnt/db && ln -s /mnt/db ./db
VOLUME ["/mnt/db"]
EXPOSE 3085
CMD node .