#!/bin/sh
# Read the container's DNS resolver so nginx can resolve internal hostnames (e.g. *.railway.internal)
NAMESERVER=$(grep nameserver /etc/resolv.conf | awk '{print $2}' | head -1)
export NAMESERVER
# Only substitute these two vars — leave all other nginx $ variables untouched
envsubst '${BACKEND_URL} ${NAMESERVER}' < /etc/nginx/nginx.conf.template > /etc/nginx/conf.d/default.conf
exec nginx -g "daemon off;"
