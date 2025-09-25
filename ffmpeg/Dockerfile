FROM alpine:latest

# Install FFMPEG and dependencies
RUN apk add --no-cache \
    ffmpeg \
    bash \
    curl \
    python3 \
    py3-pip \
    nodejs \
    npm

# Create working directory
WORKDIR /app

# Copy scripts
COPY ../scripts /scripts
RUN chmod +x /scripts/*.sh

# Create media directory
RUN mkdir -p /media/input /media/output /media/thumbnails

# Keep container running
CMD ["tail", "-f", "/dev/null"]