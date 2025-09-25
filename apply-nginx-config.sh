#!/bin/bash

# Script to apply nginx configuration for Southern Short Films
# This script requires sudo privileges

echo "=== Nginx Configuration Update Script ==="
echo "This script will update the nginx configuration to serve from /home/southerns/public_html/"
echo ""

# Check if running with sudo
if [ "$EUID" -ne 0 ]; then 
    echo "Please run this script with sudo:"
    echo "sudo bash $0"
    exit 1
fi

echo "Step 1: Backing up current configuration..."
cp /etc/nginx/sites-available/southernshortfilms.com /etc/nginx/sites-available/southernshortfilms.com.backup.$(date +%Y%m%d_%H%M%S)

echo "Step 2: Copying new configuration..."
cp /home/southerns/public_html/nginx-southernshortfilms.conf /etc/nginx/sites-available/southernshortfilms.com

echo "Step 3: Testing nginx configuration..."
nginx -t

if [ $? -eq 0 ]; then
    echo "Step 4: Configuration test passed. Reloading nginx..."
    systemctl reload nginx
    echo "✓ Nginx configuration updated successfully!"
    echo ""
    echo "The website is now configured to serve from:"
    echo "  - Root: /home/southerns/public_html/web/dist"
    echo "  - Uploads: /home/southerns/public_html/web/uploads/"
    echo ""
    echo "All HTTP and HTTPS traffic will now be served from the /home/southerns/ directory."
else
    echo "✗ Configuration test failed. Please check the configuration."
    echo "The original configuration has been preserved."
    exit 1
fi