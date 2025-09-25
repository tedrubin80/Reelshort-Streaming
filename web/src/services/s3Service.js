const AWS = require('aws-sdk');
const fs = require('fs').promises;
const path = require('path');

// Configure AWS
const s3 = new AWS.S3({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION || 'us-east-1'
});

class S3Service {
    constructor() {
        this.bucketName = process.env.S3_BUCKET_NAME || 'southernshortfilms';
        this.cdnUrl = process.env.BUNNY_CDN_URL || 'https://southernshortfilms.b-cdn.net';
    }

    /**
     * Upload file to S3
     * @param {string} filePath - Local file path
     * @param {string} s3Key - S3 object key
     * @param {object} metadata - Optional metadata
     */
    async uploadFile(filePath, s3Key, metadata = {}) {
        try {
            const fileContent = await fs.readFile(filePath);
            const contentType = this.getContentType(filePath);

            const params = {
                Bucket: this.bucketName,
                Key: s3Key,
                Body: fileContent,
                ContentType: contentType,
                Metadata: metadata,
                // Make files publicly readable for CDN
                ACL: 'public-read',
                // Cache control for CDN
                CacheControl: 'max-age=31536000, public',
                // Enable server-side encryption
                ServerSideEncryption: 'AES256'
            };

            const result = await s3.upload(params).promise();
            console.log(`✅ Uploaded to S3: ${result.Location}`);
            
            // Return CDN URL instead of S3 URL
            const cdnUrl = this.getCdnUrl(s3Key);
            return {
                s3Url: result.Location,
                cdnUrl: cdnUrl,
                key: s3Key,
                etag: result.ETag
            };
        } catch (error) {
            console.error('S3 upload error:', error);
            throw error;
        }
    }

    /**
     * Upload video and its variants to S3
     * @param {string} videoId - Video ID
     * @param {string} processedDir - Directory containing processed files
     */
    async uploadVideoFiles(videoId, processedDir) {
        const uploads = [];
        
        try {
            // Read all files in processed directory
            const files = await fs.readdir(processedDir);
            
            for (const file of files) {
                const filePath = path.join(processedDir, file);
                const stats = await fs.stat(filePath);
                
                if (stats.isFile()) {
                    // Determine S3 key based on file type
                    let s3Key;
                    if (file.endsWith('.mp4')) {
                        // Video files
                        s3Key = `videos/${videoId}/${file}`;
                    } else if (file.endsWith('.jpg') || file.endsWith('.png')) {
                        // Thumbnail
                        s3Key = `thumbnails/${videoId}/${file}`;
                    } else if (file.endsWith('.m3u8')) {
                        // HLS playlist
                        s3Key = `videos/${videoId}/hls/${file}`;
                    } else if (file.endsWith('.ts')) {
                        // HLS segments
                        s3Key = `videos/${videoId}/hls/${file}`;
                    } else {
                        s3Key = `videos/${videoId}/${file}`;
                    }
                    
                    const uploadResult = await this.uploadFile(filePath, s3Key, {
                        videoId: videoId,
                        uploadDate: new Date().toISOString()
                    });
                    
                    uploads.push(uploadResult);
                }
            }
            
            // Upload HLS files if they exist
            const hlsDir = path.join(processedDir, 'hls');
            try {
                const hlsFiles = await fs.readdir(hlsDir);
                for (const file of hlsFiles) {
                    const filePath = path.join(hlsDir, file);
                    const s3Key = `videos/${videoId}/hls/${file}`;
                    
                    const uploadResult = await this.uploadFile(filePath, s3Key, {
                        videoId: videoId,
                        type: 'hls'
                    });
                    
                    uploads.push(uploadResult);
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
     * Delete file from S3
     * @param {string} s3Key - S3 object key
     */
    async deleteFile(s3Key) {
        try {
            const params = {
                Bucket: this.bucketName,
                Key: s3Key
            };
            
            await s3.deleteObject(params).promise();
            console.log(`✅ Deleted from S3: ${s3Key}`);
            return true;
        } catch (error) {
            console.error('S3 delete error:', error);
            throw error;
        }
    }

    /**
     * Delete all files for a video
     * @param {string} videoId - Video ID
     */
    async deleteVideoFiles(videoId) {
        try {
            // List all objects with the video prefix
            const params = {
                Bucket: this.bucketName,
                Prefix: `videos/${videoId}/`
            };
            
            const objects = await s3.listObjectsV2(params).promise();
            
            if (objects.Contents.length === 0) {
                console.log('No files to delete');
                return;
            }
            
            // Prepare delete params
            const deleteParams = {
                Bucket: this.bucketName,
                Delete: {
                    Objects: objects.Contents.map(obj => ({ Key: obj.Key }))
                }
            };
            
            await s3.deleteObjects(deleteParams).promise();
            console.log(`✅ Deleted ${objects.Contents.length} files for video ${videoId}`);
            
            // Also delete thumbnails
            await this.deleteFile(`thumbnails/${videoId}/thumbnail.jpg`);
            
            return true;
        } catch (error) {
            console.error('Error deleting video files:', error);
            throw error;
        }
    }

    /**
     * Generate presigned URL for private content
     * @param {string} s3Key - S3 object key
     * @param {number} expiresIn - Expiration in seconds (default: 1 hour)
     */
    async getPresignedUrl(s3Key, expiresIn = 3600) {
        try {
            const params = {
                Bucket: this.bucketName,
                Key: s3Key,
                Expires: expiresIn
            };
            
            const url = await s3.getSignedUrlPromise('getObject', params);
            return url;
        } catch (error) {
            console.error('Error generating presigned URL:', error);
            throw error;
        }
    }

    /**
     * Get CDN URL for a file
     * @param {string} s3Key - S3 object key
     */
    getCdnUrl(s3Key) {
        return `${this.cdnUrl}/${s3Key}`;
    }

    /**
     * Get content type based on file extension
     * @param {string} filePath - File path
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
            '.svg': 'image/svg+xml',
            '.json': 'application/json',
            '.xml': 'application/xml',
            '.mpd': 'application/dash+xml'
        };
        
        return contentTypes[ext] || 'application/octet-stream';
    }

    /**
     * Create S3 bucket if it doesn't exist
     */
    async ensureBucket() {
        try {
            await s3.headBucket({ Bucket: this.bucketName }).promise();
            console.log(`✅ Bucket ${this.bucketName} exists`);
        } catch (error) {
            if (error.statusCode === 404) {
                console.log(`Creating bucket ${this.bucketName}...`);
                
                const params = {
                    Bucket: this.bucketName,
                    ACL: 'public-read'
                };
                
                // Add LocationConstraint for non-us-east-1 regions
                if (process.env.AWS_REGION && process.env.AWS_REGION !== 'us-east-1') {
                    params.CreateBucketConfiguration = {
                        LocationConstraint: process.env.AWS_REGION
                    };
                }
                
                await s3.createBucket(params).promise();
                
                // Configure CORS for browser uploads
                await this.configureCORS();
                
                console.log(`✅ Bucket ${this.bucketName} created`);
            } else {
                throw error;
            }
        }
    }

    /**
     * Configure CORS for the bucket
     */
    async configureCORS() {
        const corsParams = {
            Bucket: this.bucketName,
            CORSConfiguration: {
                CORSRules: [{
                    AllowedHeaders: ['*'],
                    AllowedMethods: ['GET', 'PUT', 'POST', 'DELETE', 'HEAD'],
                    AllowedOrigins: ['*'], // In production, specify your domain
                    ExposeHeaders: ['ETag'],
                    MaxAgeSeconds: 3000
                }]
            }
        };
        
        await s3.putBucketCors(corsParams).promise();
        console.log('✅ CORS configured for bucket');
    }

    /**
     * Get bucket storage statistics
     */
    async getBucketStats() {
        try {
            const params = {
                Bucket: this.bucketName
            };
            
            const objects = await s3.listObjectsV2(params).promise();
            
            let totalSize = 0;
            let fileCount = 0;
            
            for (const obj of objects.Contents) {
                totalSize += obj.Size;
                fileCount++;
            }
            
            return {
                fileCount,
                totalSize,
                totalSizeGB: (totalSize / (1024 * 1024 * 1024)).toFixed(2),
                bucketName: this.bucketName
            };
        } catch (error) {
            console.error('Error getting bucket stats:', error);
            throw error;
        }
    }
}

module.exports = new S3Service();