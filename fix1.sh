#!/bin/bash

echo "Adding HTTP-only server block for reelshorts.live..."

# Add the HTTP-only server block to the existing nginx config
sudo tee -a /etc/nginx/sites-available/southernshortfilms.com > /dev/null << 'EOF'

# HTTP-only server for reelshorts.live
server {
    listen 80;
    listen [::]:80;
    server_name reelshorts.live www.reelshorts.live;

    # Document root for static files
    root /home/southerns/southernshortfilms/web/dist;
    index index.html;

    client_max_body_size 20G;
    client_body_timeout 300s;
    client_header_timeout 300s;

    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml text/javascript application/json application/javascript application/xml+rss application/atom+xml image/svg+xml;

    # Serve static files first, then proxy to app if not found
    location / {
        try_files $uri $uri/ @app;
    }

    location @app {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300;
        proxy_connect_timeout 300;
        proxy_send_timeout 300;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300;
    }

    location /uploads/ {
        alias /home/southerns/southernshortfilms/web/uploads/;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    location /health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }
}
EOF

echo "Testing nginx configuration..."
sudo nginx -t

if [ $? -eq 0 ]; then
    echo "Configuration is valid. Restarting nginx..."
    sudo systemctl restart nginx
    echo "Done! reelshorts.live should now work over HTTP without SSL issues."
else
    echo "Configuration test failed. Please check the error messages above."
fi