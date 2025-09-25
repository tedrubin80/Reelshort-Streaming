#!/bin/bash

# Southerns Short Films Server Setup Script
# Run with: sudo bash setup-server.sh

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🎬 Setting up Southerns Short Films Server...${NC}"

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   echo -e "${RED}This script must be run as root (use sudo)${NC}" 
   exit 1
fi

# Get server IP
SERVER_IP=$(curl -s ipinfo.io/ip || hostname -I | awk '{print $1}')
echo -e "${YELLOW}Server IP detected: $SERVER_IP${NC}"

# Update system
echo -e "${GREEN}📦 Updating system packages...${NC}"
apt update && apt upgrade -y

# Install required packages
echo -e "${GREEN}🔧 Installing NGINX, FTP, and security tools...${NC}"
apt install -y nginx vsftpd ufw fail2ban certbot python3-certbot-nginx openssl

# Enable services
echo -e "${GREEN}⚡ Enabling auto-start services...${NC}"
systemctl enable nginx
systemctl enable vsftpd
systemctl enable fail2ban

# Configure FTP server
echo -e "${GREEN}📁 Configuring FTP server...${NC}"
cp /etc/vsftpd.conf /etc/vsftpd.conf.backup

cat > /etc/vsftpd.conf << EOF
listen=NO
listen_ipv6=YES
anonymous_enable=NO
local_enable=YES
write_enable=YES
local_umask=022
dirmessage_enable=YES
use_localtime=YES
xferlog_enable=YES
connect_from_port_20=YES
chroot_local_user=YES
allow_writeable_chroot=YES
secure_chroot_dir=/var/run/vsftpd/empty
pam_service_name=vsftpd
userlist_enable=YES
userlist_file=/etc/vsftpd.userlist
userlist_deny=NO
local_max_rate=1000000
anon_max_rate=1000000
pasv_enable=YES
pasv_min_port=40000
pasv_max_port=40100
pasv_address=$SERVER_IP
log_ftp_protocol=YES
xferlog_file=/var/log/vsftpd.log
vsftpd_log_file=/var/log/vsftpd.log
ssl_enable=YES
allow_anon_ssl=NO
force_local_data_ssl=YES
force_local_logins_ssl=YES
ssl_tlsv1=YES
ssl_sslv2=NO
ssl_sslv3=NO
rsa_cert_file=/etc/ssl/certs/vsftpd.crt
rsa_private_key_file=/etc/ssl/private/vsftpd.key
EOF

# Create FTP user
echo -e "${GREEN}👤 Creating FTP user 'southerns'...${NC}"
if ! id "southerns" &>/dev/null; then
    useradd -m -s /bin/bash southerns
    echo -e "${YELLOW}Please set password for 'southerns' user:${NC}"
    passwd southerns
fi

echo "southerns" >> /etc/vsftpd.userlist

# Create directories
mkdir -p /home/southerns/public_html
chown southerns:southerns /home/southerns/public_html
chmod 755 /home/southerns/public_html

# Generate FTP SSL certificate
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout /etc/ssl/private/vsftpd.key \
    -out /etc/ssl/certs/vsftpd.crt \
    -subj "/C=US/ST=State/L=City/O=SouthernsShortFilms/CN=southernshortfilms.com"

# Configure NGINX
echo -e "${GREEN}🌐 Configuring NGINX...${NC}"
rm -f /etc/nginx/sites-enabled/default

cat > /etc/nginx/sites-available/southernshortfilms.com << 'EOF'
upstream app_server {
    server 127.0.0.1:3000;
    keepalive 32;
}

limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
limit_req_zone $binary_remote_addr zone=upload:10m rate=1r/s;

server {
    listen 80;
    listen [::]:80;
    server_name southernshortfilms.com www.southernshortfilms.com _;
    
    # Allow certbot
    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }
    
    location / {
        return 301 https://$server_name$request_uri;
    }
}

server {
    listen 443 ssl http2 default_server;
    listen [::]:443 ssl http2 default_server;
    server_name southernshortfilms.com www.southernshortfilms.com _;

    # Temporary self-signed certificate (will be replaced by Let's Encrypt)
    ssl_certificate /etc/nginx/ssl/nginx-selfsigned.crt;
    ssl_certificate_key /etc/nginx/ssl/nginx-selfsigned.key;
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;

    client_max_body_size 20G;
    client_body_timeout 300s;
    client_header_timeout 300s;

    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml text/javascript application/json application/javascript application/xml+rss application/atom+xml image/svg+xml;

    location / {
        proxy_pass http://app_server;
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
        limit_req zone=api burst=20 nodelay;
        proxy_pass http://app_server;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300;
    }

    location /api/upload/ {
        limit_req zone=upload burst=5 nodelay;
        proxy_pass http://app_server;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_request_buffering off;
        proxy_read_timeout 600;
        proxy_connect_timeout 600;
        proxy_send_timeout 600;
    }

    location /uploads/ {
        alias /home/southerns-short-films/web/uploads/;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    location /stream/ {
        proxy_pass http://127.0.0.1:8080/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    location /health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }
}
EOF

# Create SSL directory and self-signed cert
mkdir -p /etc/nginx/ssl
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout /etc/nginx/ssl/nginx-selfsigned.key \
    -out /etc/nginx/ssl/nginx-selfsigned.crt \
    -subj "/C=US/ST=State/L=City/O=SouthernsShortFilms/CN=southernshortfilms.com"

# Enable site
ln -sf /etc/nginx/sites-available/southernshortfilms.com /etc/nginx/sites-enabled/

# Test NGINX config
nginx -t

# Configure firewall
echo -e "${GREEN}🛡️ Configuring firewall...${NC}"
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw allow 21/tcp
ufw allow 40000:40100/tcp
ufw allow 1935/tcp
ufw allow 8080/tcp
ufw --force enable

# Create systemd service for auto-start
echo -e "${GREEN}🚀 Creating auto-start service...${NC}"
cat > /etc/systemd/system/southerns-short-films.service << 'EOF'
[Unit]
Description=Southerns Short Films Application
Requires=docker.service nginx.service
After=docker.service nginx.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/home/southerns-short-films
ExecStart=/usr/bin/docker-compose -f docker-compose.prod.yml up -d
ExecStop=/usr/bin/docker-compose -f docker-compose.prod.yml down
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
EOF

systemctl enable southerns-short-films.service
systemctl daemon-reload

# Create deployment script
echo -e "${GREEN}📝 Creating deployment script...${NC}"
cat > /home/southerns-short-films/deploy.sh << 'EOF'
#!/bin/bash
set -e
echo "🎬 Deploying Southerns Short Films..."
cd /home/southerns-short-films
docker-compose -f docker-compose.prod.yml down
docker-compose -f docker-compose.prod.yml build --no-cache
docker-compose -f docker-compose.prod.yml up -d
echo "⏳ Waiting for services..."
sleep 30
docker-compose -f docker-compose.prod.yml ps
sudo nginx -t && sudo systemctl reload nginx
echo "✅ Deployment complete!"
EOF

chmod +x /home/southerns-short-films/deploy.sh

# Create production docker-compose
echo -e "${GREEN}🐳 Creating production Docker Compose...${NC}"
cat > /home/southerns-short-films/docker-compose.prod.yml << 'EOF'
version: '3.8'

services:
  postgres:
    image: postgres:15
    container_name: southerns_postgres
    environment:
      POSTGRES_DB: southerns_db
      POSTGRES_USER: southerns_user
      POSTGRES_PASSWORD: southerns_password
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./sql/init.sql:/docker-entrypoint-initdb.d/init.sql
    networks:
      - southerns_network
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    container_name: southerns_redis
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data
    networks:
      - southerns_network
    restart: unless-stopped

  srs:
    image: ossrs/srs:5
    container_name: southerns_srs
    ports:
      - "127.0.0.1:1935:1935"
      - "127.0.0.1:8080:8080"
      - "127.0.0.1:1985:1985"
      - "127.0.0.1:8000:8000"
    volumes:
      - ./srs/srs.conf:/usr/local/srs/conf/srs.conf
      - srs_logs:/usr/local/srs/logs
    networks:
      - southerns_network
    restart: unless-stopped

  web:
    build:
      context: ./web
      dockerfile: Dockerfile
    container_name: southerns_web
    ports:
      - "127.0.0.1:3000:3000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://southerns_user:southerns_password@postgres:5432/southerns_db
      - REDIS_URL=redis://redis:6379
      - SRS_API_URL=http://srs:8080/api/v1
    depends_on:
      - postgres
      - redis
      - srs
    volumes:
      - ./web/uploads:/app/uploads
      - ./web/.env:/app/.env
    networks:
      - southerns_network
    restart: unless-stopped

  ffmpeg:
    build:
      context: ./ffmpeg
      dockerfile: Dockerfile
    container_name: southerns_ffmpeg
    volumes:
      - ./media:/media
      - ./scripts:/scripts
      - ./web/uploads:/uploads
    depends_on:
      - srs
    networks:
      - southerns_network
    restart: unless-stopped

volumes:
  postgres_data:
  redis_data:
  srs_logs:

networks:
  southerns_network:
    driver: bridge
EOF

# Set permissions
chown -R southerns:southerns /home/southerns-short-films
chmod +x /home/southerns-short-films/deploy.sh

# Start services
echo -e "${GREEN}🎯 Starting services...${NC}"
systemctl start nginx
systemctl start vsftpd
systemctl start fail2ban

echo -e "${GREEN}✅ Server setup complete!${NC}"
echo -e "${YELLOW}🌐 Your server is ready at:${NC}"
echo -e "   • Domain: http://southernshortfilms.com (redirects to HTTPS)"
echo -e "   • IP: http://$SERVER_IP (redirects to domain)"
echo -e "   • FTP: sftp://southerns@southernshortfilms.com"
echo ""
echo -e "${YELLOW}📋 Next steps:${NC}"
echo -e "   1. Point southernshortfilms.com DNS to $SERVER_IP"
echo -e "   2. Run: sudo certbot --nginx -d southernshortfilms.com -d www.southernshortfilms.com"
echo -e "   3. Deploy app: cd /home/southerns-short-films && ./deploy.sh"
echo ""
echo -e "${GREEN}🎬 Southerns Short Films is ready to roll!${NC}"