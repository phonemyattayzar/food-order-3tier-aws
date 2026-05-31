# syntax=docker/dockerfile:1

# ---- Build stage ----
    FROM node:20-alpine AS build
    WORKDIR /app
    
    COPY package*.json ./
    RUN npm ci
    
    COPY . .
    
    # Relative URL works with nginx proxy in the Helm chart
    ARG VITE_API_BASE=/api/v1
    ENV VITE_API_BASE=$VITE_API_BASE
    
    RUN npm run build
    
    # ---- Runtime stage ----
    FROM nginx:1.27-alpine
    
    # Non-root nginx on port 8080 (matches Helm chart)
    RUN sed -i 's/listen       80;/listen       8080;/' /etc/nginx/conf.d/default.conf \
        && sed -i 's/listen  \[::\]:80;/listen  [::]:8080;/' /etc/nginx/conf.d/default.conf \
        && chown -R nginx:nginx /var/cache/nginx /var/log/nginx /etc/nginx/conf.d
    
    COPY --from=build /app/dist /usr/share/nginx/html
    
    USER nginx
    EXPOSE 8080
    
    HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
      CMD wget -qO- http://127.0.0.1:8080/healthz || exit 1
    
    CMD ["nginx", "-g", "daemon off;"]
    