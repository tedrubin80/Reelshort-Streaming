#!/bin/bash
# Update ReelShorts nginx configuration to use port 3001

sed 's|http://127.0.0.1:3000|http://127.0.0.1:3001|g' /etc/nginx/sites-available/reelshorts.live > /tmp/reelshorts.live.new

# Move the updated config
sudo mv /tmp/reelshorts.live.new /etc/nginx/sites-available/reelshorts.live

# Test nginx configuration
sudo nginx -t

# Reload nginx if configuration is valid
if [ $? -eq 0 ]; then
    sudo systemctl reload nginx
    echo "✅ Nginx configuration updated and reloaded successfully"
else
    echo "❌ Nginx configuration test failed"
    exit 1
fi
