#!/bin/bash

echo "🚀 Setting up Southerns Short Films Service"
echo "==========================================="

# Check if running with sudo
if [ "$EUID" -ne 0 ]; then 
    echo "❗ Please run with sudo: sudo ./deploy-service.sh"
    exit 1
fi

# Copy service file
echo "📋 Copying service file..."
cp /home/southerns/public_html/southerns-app.service /etc/systemd/system/

# Reload systemd
echo "🔄 Reloading systemd daemon..."
systemctl daemon-reload

# Enable service
echo "⚙️  Enabling service..."
systemctl enable southerns-app.service

# Stop any existing Node.js processes
echo "🛑 Stopping any existing Node.js processes..."
pkill -f "node.*server-static.js" || true

# Start service
echo "▶️  Starting service..."
systemctl start southerns-app.service

# Check status
echo "📊 Checking service status..."
systemctl status southerns-app.service --no-pager

echo ""
echo "✅ Service deployed successfully!"
echo ""
echo "Useful commands:"
echo "  sudo systemctl status southerns-app   # Check status"
echo "  sudo systemctl restart southerns-app  # Restart service"
echo "  sudo systemctl stop southerns-app     # Stop service"
echo "  sudo journalctl -u southerns-app -f   # View logs"