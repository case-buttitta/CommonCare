#!/bin/sh
# Only substitute ${BACKEND_URL} — leave all other nginx $ variables untouched
envsubst '${BACKEND_URL}' < /etc/nginx/nginx.conf.template > /etc/nginx/conf.d/default.conf
exec nginx -g "daemon off;"
