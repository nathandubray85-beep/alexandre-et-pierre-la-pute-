FROM nginx:alpine
COPY index.html /usr/share/nginx/html/index.html
COPY style.css /usr/share/nginx/html/style.css
COPY game.js /usr/share/nginx/html/game.js
EXPOSE 80
CMD ["nginx","-g","daemon off;"]
