#!/bin/bash

echo "🚀 Deploying Southerns Short Films Nginx Configuration"
echo "=================================================="

# Check if running with sudo
if [ "$EUID" -ne 0 ]; then 
    echo "❗ Please run with sudo: sudo ./deploy-nginx.sh"
    exit 1
fi

# Copy nginx configuration
echo "📋 Copying nginx configuration..."
cp /home/southerns/public_html/nginx-site.conf /etc/nginx/sites-available/southerns

# Create symbolic link
echo "🔗 Creating symbolic link..."
ln -sf /etc/nginx/sites-available/southerns /etc/nginx/sites-enabled/southerns

# Test nginx configuration
echo "🧪 Testing nginx configuration..."
nginx -t

if [ $? -eq 0 ]; then
    echo "✅ Configuration test passed!"
    
    # Reload nginx
    echo "🔄 Reloading nginx..."
    systemctl reload nginx
    
    if [ $? -eq 0 ]; then
        echo "✅ Nginx reloaded successfully!"
        echo ""
        echo "🎬 Southerns Short Films is now deployed!"
        echo "🌐 Access the site at: http://37.27.220.18"
        echo "📡 API endpoint: http://37.27.220.18/api/health"
    else
        echo "❌ Failed to reload nginx"
        exit 1
    fi
else
    echo "❌ Nginx configuration test failed"
    exit 1
fi