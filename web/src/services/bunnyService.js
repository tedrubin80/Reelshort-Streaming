const axios = require('axios');
const fs = require('fs');
const FormData = require('form-data');
const path = require('path');

/**
 * Bunny.net Stream API Integration
 * Handles video uploads, encoding, and CDN delivery
 */

class BunnyService {
    constructor() {
        this.libraryId = process.env.BUNNY_LIBRARY_ID;
        this.apiKey = process.env.BUNNY_API_KEY;
        this.cdnHostname = process.env.CDN_HOSTNAME;
        this.baseUrl = process.env.BUNNY_STREAM_API_URL || 'https://video.bunnycdn.com/library';
        this.enabled = process.env.USE_CDN === 'true' && this.apiKey;

        if (!this.enabled) {
            console.warn('⚠️  Bunny.net CDN is disabled or API key is missing');
        } else {
            console.log(`✅ Bunny.net CDN enabled - Library: ${this.libraryId}`);
        }
    }

    /**
     * Check if Bunny.net is enabled
     */
    isEnabled() {
        return this.enabled;
    }

    /**
     * Create a new video in Bunny.net library
     */
    async createVideo(title, collectionId = null) {
        try {
            if (!this.enabled) {
                throw new Error('Bunny.net is not enabled');
            }

            const response = await axios.post(
                `${this.baseUrl}/${this.libraryId}/videos`,
                {
                    title: title,
                    collectionId: collectionId
                },
                {
                    headers: {
                        'AccessKey': this.apiKey,
                        'Content-Type': 'application/json'
                    }
                }
            );

            console.log(`✅ Created Bunny video: ${response.data.guid}`);
            return response.data;
        } catch (error) {
            console.error('Error creating Bunny video:', error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Upload video file to Bunny.net
     */
    async uploadVideo(videoId, filePath) {
        try {
            if (!this.enabled) {
                throw new Error('Bunny.net is not enabled');
            }

            if (!fs.existsSync(filePath)) {
                throw new Error(`File not found: ${filePath}`);
            }

            const fileStream = fs.createReadStream(filePath);
            const fileStats = fs.statSync(filePath);

            console.log(`📤 Uploading to Bunny.net: ${path.basename(filePath)} (${(fileStats.size / 1024 / 1024).toFixed(2)} MB)`);

            const response = await axios.put(
                `${this.baseUrl}/${this.libraryId}/videos/${videoId}`,
                fileStream,
                {
                    headers: {
                        'AccessKey': this.apiKey,
                        'Content-Type': 'application/octet-stream'
                    },
                    maxBodyLength: Infinity,
                    maxContentLength: Infinity,
                    onUploadProgress: (progressEvent) => {
                        const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                        if (percentCompleted % 10 === 0) {
                            console.log(`Upload progress: ${percentCompleted}%`);
                        }
                    }
                }
            );

            console.log(`✅ Video uploaded to Bunny.net successfully`);
            return response.data;
        } catch (error) {
            console.error('Error uploading to Bunny.net:', error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Get video information from Bunny.net
     */
    async getVideo(videoId) {
        try {
            if (!this.enabled) {
                throw new Error('Bunny.net is not enabled');
            }

            const response = await axios.get(
                `${this.baseUrl}/${this.libraryId}/videos/${videoId}`,
                {
                    headers: {
                        'AccessKey': this.apiKey
                    }
                }
            );

            return response.data;
        } catch (error) {
            console.error('Error getting Bunny video info:', error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Delete video from Bunny.net
     */
    async deleteVideo(videoId) {
        try {
            if (!this.enabled) {
                throw new Error('Bunny.net is not enabled');
            }

            await axios.delete(
                `${this.baseUrl}/${this.libraryId}/videos/${videoId}`,
                {
                    headers: {
                        'AccessKey': this.apiKey
                    }
                }
            );

            console.log(`🗑️  Deleted Bunny video: ${videoId}`);
            return true;
        } catch (error) {
            console.error('Error deleting Bunny video:', error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Get video playback URLs
     */
    getPlaybackUrls(videoId) {
        if (!this.enabled) {
            return null;
        }

        return {
            hls: `https://${this.cdnHostname}/${videoId}/playlist.m3u8`,
            thumbnail: `https://${this.cdnHostname}/${videoId}/thumbnail.jpg`,
            preview: `https://${this.cdnHostname}/${videoId}/preview.webp`
        };
    }

    /**
     * Get HLS manifest URL for adaptive streaming
     */
    getHlsUrl(videoId) {
        if (!this.enabled) {
            return null;
        }

        return `https://${this.cdnHostname}/${videoId}/playlist.m3u8`;
    }

    /**
     * Get thumbnail URL
     */
    getThumbnailUrl(videoId, time = 0) {
        if (!this.enabled) {
            return null;
        }

        // Bunny.net allows fetching thumbnails at specific times
        return `https://${this.cdnHostname}/${videoId}/thumbnail.jpg?time=${time}`;
    }

    /**
     * Update video metadata
     */
    async updateVideo(videoId, updates) {
        try {
            if (!this.enabled) {
                throw new Error('Bunny.net is not enabled');
            }

            const response = await axios.post(
                `${this.baseUrl}/${this.libraryId}/videos/${videoId}`,
                updates,
                {
                    headers: {
                        'AccessKey': this.apiKey,
                        'Content-Type': 'application/json'
                    }
                }
            );

            console.log(`✅ Updated Bunny video metadata: ${videoId}`);
            return response.data;
        } catch (error) {
            console.error('Error updating Bunny video:', error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Set video thumbnail from specific timestamp
     */
    async setThumbnail(videoId, time) {
        try {
            if (!this.enabled) {
                throw new Error('Bunny.net is not enabled');
            }

            await axios.post(
                `${this.baseUrl}/${this.libraryId}/videos/${videoId}/thumbnail?thumbnailTime=${time}`,
                {},
                {
                    headers: {
                        'AccessKey': this.apiKey
                    }
                }
            );

            console.log(`✅ Set thumbnail for video ${videoId} at ${time}s`);
            return true;
        } catch (error) {
            console.error('Error setting thumbnail:', error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Get video encoding status
     */
    async getEncodingStatus(videoId) {
        try {
            const videoInfo = await this.getVideo(videoId);

            return {
                status: videoInfo.status, // 0 = Queued, 1 = Processing, 2 = Encoding, 3 = Finished, 4 = Error
                progress: videoInfo.encodeProgress || 0,
                availableResolutions: videoInfo.availableResolutions || [],
                duration: videoInfo.length || 0
            };
        } catch (error) {
            console.error('Error getting encoding status:', error.message);
            throw error;
        }
    }

    /**
     * Wait for video encoding to complete
     */
    async waitForEncoding(videoId, maxWaitMinutes = 30) {
        const startTime = Date.now();
        const maxWaitMs = maxWaitMinutes * 60 * 1000;

        console.log(`⏳ Waiting for video encoding: ${videoId}`);

        while (Date.now() - startTime < maxWaitMs) {
            const status = await this.getEncodingStatus(videoId);

            console.log(`Encoding status: ${status.status}, Progress: ${status.progress}%`);

            if (status.status === 3) {
                // Finished
                console.log(`✅ Video encoding completed: ${videoId}`);
                return status;
            } else if (status.status === 4) {
                // Error
                throw new Error('Video encoding failed');
            }

            // Wait 10 seconds before checking again
            await new Promise(resolve => setTimeout(resolve, 10000));
        }

        throw new Error('Video encoding timeout');
    }
}

module.exports = new BunnyService();
