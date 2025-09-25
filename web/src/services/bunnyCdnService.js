const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const FormData = require('form-data');

class BunnyCDNService {
    constructor() {
        this.apiKey = process.env.BUNNY_API_KEY;
        this.storageZone = process.env.BUNNY_STORAGE_ZONE;
        this.storagePassword = process.env.BUNNY_STORAGE_PASSWORD;
        this.pullZoneId = process.env.BUNNY_PULL_ZONE_ID;
        this.cdnUrl = process.env.BUNNY_CDN_URL || 'https://southernshortfilms.b-cdn.net';
        
        // Bunny.net API endpoints
        this.apiBaseUrl = 'https://api.bunny.net';
        this.storageApiUrl = `https://storage.bunnycdn.com/${this.storageZone}`;
    }

    /**
     * Upload file to Bunny Storage
     * @param {string} localPath - Local file path
     * @param {string} remotePath - Remote path in storage zone
     */
    async uploadFile(localPath, remotePath) {
        try {
            const fileContent = await fs.readFile(localPath);
            const fileSize = (await fs.stat(localPath)).size;
            
            const response = await axios.put(
                `${this.storageApiUrl}/${remotePath}`,
                fileContent,
                {
                    headers: {
                        'AccessKey': this.storagePassword,
                        'Content-Type': this.getContentType(localPath),
                        'Content-Length': fileSize
                    },
                    maxBodyLength: Infinity,
                    maxContentLength: Infinity
                }
            );

            console.log(`✅ Uploaded to Bunny CDN: ${remotePath}`);
            
            return {
                success: true,
                cdnUrl: `${this.cdnUrl}/${remotePath}`,
                storageUrl: `${this.storageApiUrl}/${remotePath}`,
                size: fileSize
            };
        } catch (error) {
            console.error('Bunny CDN upload error:', error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Upload video and all its variants
     * @param {string} videoId - Video ID
     * @param {string} processedDir - Directory with processed files
     */
    async uploadVideoFiles(videoId, processedDir) {
        const uploads = [];
        
        try {
            const files = await fs.readdir(processedDir);
            
            for (const file of files) {
                const filePath = path.join(processedDir, file);
                const stats = await fs.stat(filePath);
                
                if (stats.isFile()) {
                    let remotePath;
                    
                    if (file.endsWith('.mp4')) {
                        remotePath = `videos/${videoId}/${file}`;
                    } else if (file.endsWith('.jpg') || file.endsWith('.png')) {
                        remotePath = `thumbnails/${videoId}/${file}`;
                    } else if (file.endsWith('.m3u8') || file.endsWith('.ts')) {
                        remotePath = `videos/${videoId}/hls/${file}`;
                    } else {
                        remotePath = `videos/${videoId}/${file}`;
                    }
                    
                    const result = await this.uploadFile(filePath, remotePath);
                    uploads.push(result);
                }
            }
            
            // Handle HLS directory if exists
            const hlsDir = path.join(processedDir, 'hls');
            try {
                const hlsFiles = await fs.readdir(hlsDir);
                for (const file of hlsFiles) {
                    const filePath = path.join(hlsDir, file);
                    const remotePath = `videos/${videoId}/hls/${file}`;
                    
                    const result = await this.uploadFile(filePath, remotePath);
                    uploads.push(result);
                }
            } catch (error) {
                console.log('No HLS directory found');
            }
            
            return uploads;
        } catch (error) {
            console.error('Error uploading video files:', error);
            throw error;
        }
    }

    /**
     * Delete file from Bunny Storage
     * @param {string} remotePath - Remote path in storage zone
     */
    async deleteFile(remotePath) {
        try {
            await axios.delete(
                `${this.storageApiUrl}/${remotePath}`,
                {
                    headers: {
                        'AccessKey': this.storagePassword
                    }
                }
            );
            
            console.log(`✅ Deleted from Bunny CDN: ${remotePath}`);
            return true;
        } catch (error) {
            console.error('Bunny CDN delete error:', error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Delete all files for a video
     * @param {string} videoId - Video ID
     */
    async deleteVideoFiles(videoId) {
        try {
            // Delete video files
            await this.deleteDirectory(`videos/${videoId}`);
            
            // Delete thumbnails
            await this.deleteDirectory(`thumbnails/${videoId}`);
            
            console.log(`✅ Deleted all files for video ${videoId}`);
            return true;
        } catch (error) {
            console.error('Error deleting video files:', error);
            throw error;
        }
    }

    /**
     * Delete entire directory
     * @param {string} directoryPath - Directory path in storage zone
     */
    async deleteDirectory(directoryPath) {
        try {
            // List all files in directory
            const files = await this.listFiles(directoryPath);
            
            // Delete each file
            for (const file of files) {
                await this.deleteFile(file.path);
            }
            
            return true;
        } catch (error) {
            console.error('Error deleting directory:', error);
            throw error;
        }
    }

    /**
     * List files in directory
     * @param {string} directoryPath - Directory path in storage zone
     */
    async listFiles(directoryPath) {
        try {
            const response = await axios.get(
                `${this.storageApiUrl}/${directoryPath}/`,
                {
                    headers: {
                        'AccessKey': this.storagePassword
                    }
                }
            );
            
            // Parse the response (Bunny returns HTML listing)
            // You might need to adjust this based on actual response format
            return response.data;
        } catch (error) {
            console.error('Error listing files:', error.response?.data || error.message);
            return [];
        }
    }

    /**
     * Purge CDN cache for specific URLs
     * @param {string[]} urls - Array of URLs to purge
     */
    async purgeCache(urls) {
        try {
            const response = await axios.post(
                `${this.apiBaseUrl}/pullzone/${this.pullZoneId}/purgeCache`,
                { urls },
                {
                    headers: {
                        'AccessKey': this.apiKey,
                        'Content-Type': 'application/json'
                    }
                }
            );
            
            console.log(`✅ Purged CDN cache for ${urls.length} URLs`);
            return response.data;
        } catch (error) {
            console.error('Cache purge error:', error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Get CDN statistics
     */
    async getStatistics() {
        try {
            const response = await axios.get(
                `${this.apiBaseUrl}/pullzone/${this.pullZoneId}/statistics`,
                {
                    headers: {
                        'AccessKey': this.apiKey
                    }
                }
            );
            
            return response.data;
        } catch (error) {
            console.error('Error getting statistics:', error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Create a new pull zone
     * @param {string} name - Pull zone name
     * @param {string} originUrl - Origin URL
     */
    async createPullZone(name, originUrl) {
        try {
            const response = await axios.post(
                `${this.apiBaseUrl}/pullzone`,
                {
                    Name: name,
                    OriginUrl: originUrl,
                    StorageZoneId: this.storageZone,
                    EnableGeoZoneUS: true,
                    EnableGeoZoneEU: true,
                    EnableGeoZoneASIA: true,
                    EnableGeoZoneSA: true,
                    EnableGeoZoneAF: true,
                    DisableCookies: false,
                    EnableCacheSlice: true,
                    EnableWebPVary: true,
                    EnableAvifVary: true,
                    EnableSmartCache: true,
                    CacheControlMaxAge: 31536000, // 1 year
                    CacheControlPublicMaxAge: 31536000
                },
                {
                    headers: {
                        'AccessKey': this.apiKey,
                        'Content-Type': 'application/json'
                    }
                }
            );
            
            console.log(`✅ Created pull zone: ${name}`);
            return response.data;
        } catch (error) {
            console.error('Error creating pull zone:', error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Configure edge rules for optimization
     */
    async configureEdgeRules() {
        try {
            const rules = [
                {
                    // Cache video files for 1 year
                    ActionType: 1, // Set Response Header
                    TriggerMatchingType: 1, // Match File Extension
                    Triggers: ['mp4', 'webm', 'ogg'],
                    ActionParameter1: 'Cache-Control',
                    ActionParameter2: 'public, max-age=31536000'
                },
                {
                    // Cache HLS segments for 1 hour
                    ActionType: 1,
                    TriggerMatchingType: 1,
                    Triggers: ['m3u8', 'ts'],
                    ActionParameter1: 'Cache-Control',
                    ActionParameter2: 'public, max-age=3600'
                },
                {
                    // Enable CORS for all video files
                    ActionType: 1,
                    TriggerMatchingType: 1,
                    Triggers: ['mp4', 'webm', 'm3u8', 'ts'],
                    ActionParameter1: 'Access-Control-Allow-Origin',
                    ActionParameter2: '*'
                }
            ];

            for (const rule of rules) {
                await axios.post(
                    `${this.apiBaseUrl}/pullzone/${this.pullZoneId}/edgerules`,
                    rule,
                    {
                        headers: {
                            'AccessKey': this.apiKey,
                            'Content-Type': 'application/json'
                        }
                    }
                );
            }

            console.log('✅ Edge rules configured');
            return true;
        } catch (error) {
            console.error('Error configuring edge rules:', error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Get content type based on file extension
     */
    getContentType(filePath) {
        const ext = path.extname(filePath).toLowerCase();
        const contentTypes = {
            '.mp4': 'video/mp4',
            '.webm': 'video/webm',
            '.ogg': 'video/ogg',
            '.m3u8': 'application/x-mpegURL',
            '.ts': 'video/MP2T',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.gif': 'image/gif',
            '.svg': 'image/svg+xml'
        };
        
        return contentTypes[ext] || 'application/octet-stream';
    }

    /**
     * Get CDN URL for a file
     * @param {string} path - File path
     */
    getCdnUrl(path) {
        return `${this.cdnUrl}/${path}`;
    }

    /**
     * Test connection to Bunny CDN
     */
    async testConnection() {
        try {
            const response = await axios.get(
                `${this.apiBaseUrl}/pullzone/${this.pullZoneId}`,
                {
                    headers: {
                        'AccessKey': this.apiKey
                    }
                }
            );
            
            console.log('✅ Bunny CDN connection successful');
            console.log(`Pull Zone: ${response.data.Name}`);
            console.log(`Monthly Bandwidth Used: ${response.data.MonthlyBandwidthUsed / (1024 * 1024 * 1024)} GB`);
            console.log(`Storage Used: ${response.data.StorageUsed / (1024 * 1024 * 1024)} GB`);
            
            return true;
        } catch (error) {
            console.error('❌ Bunny CDN connection failed:', error.response?.data || error.message);
            return false;
        }
    }
}

module.exports = new BunnyCDNService();