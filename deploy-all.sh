#!/bin/bash

echo "🚀 Deploying Southerns Short Films Complete Setup"
echo "================================================="

# Check if running with sudo
if [ "$EUID" -ne 0 ]; then 
    echo "❗ Please run with sudo: sudo ./deploy-all.sh"
    exit 1
fi

echo "1️⃣ Setting up systemd service..."
# Copy service file
cp /home/southerns/public_html/southerns-app.service /etc/systemd/system/

# Reload systemd
systemctl daemon-reload

# Stop any existing Node.js processes
echo "🛑 Stopping existing Node.js processes..."
pkill -f "node.*server-static.js" || true

# Enable and start service
systemctl enable southerns-app.service
systemctl start southerns-app.service

echo "2️⃣ Setting up nginx configuration..."
# Backup existing config
if [ -f /etc/nginx/sites-available/southernshortfilms.com ]; then
    cp /etc/nginx/sites-available/southernshortfilms.com /etc/nginx/sites-available/southernshortfilms.com.backup
fi

# Copy new configuration
cp /home/southerns/public_html/nginx-site.conf /etc/nginx/sites-available/southerns

# Remove old symlink and create new one
rm -f /etc/nginx/sites-enabled/southernshortfilms.com
rm -f /etc/nginx/sites-enabled/default
ln -sf /etc/nginx/sites-available/southerns /etc/nginx/sites-enabled/southerns

echo "3️⃣ Testing configurations..."
# Test nginx configuration
nginx -t

if [ $? -eq 0 ]; then
    echo "✅ Nginx configuration test passed!"
    
    # Reload nginx
    systemctl reload nginx
    
    echo "4️⃣ Checking service status..."
    systemctl status southerns-app.service --no-pager -l
    
    echo ""
    echo "✅ Deployment completed successfully!"
    echo ""
    echo "🎬 Southerns Short Films is now live!"
    echo "🌐 Access the site at: http://37.27.220.18"
    echo "📡 API health check: http://37.27.220.18/api/health"
    echo "📊 Service status: sudo systemctl status southerns-app"
    echo "📝 View logs: sudo journalctl -u southerns-app -f"
    
else
    echo "❌ Nginx configuration test failed"
    exit 1
fi