const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs').promises;

class HLSService {
    constructor() {
        this.hlsSegmentDuration = 10; // 10 seconds per segment
        this.hlsQualities = [
            { name: '360p', width: 640, height: 360, bitrate: '800k', audioBitrate: '96k' },
            { name: '480p', width: 854, height: 480, bitrate: '1400k', audioBitrate: '128k' },
            { name: '720p', width: 1280, height: 720, bitrate: '2800k', audioBitrate: '128k' },
            { name: '1080p', width: 1920, height: 1080, bitrate: '5000k', audioBitrate: '192k' }
        ];
    }

    /**
     * Generate HLS streams for a video
     * @param {string} inputPath - Path to input video file
     * @param {string} outputDir - Directory to save HLS files
     * @param {string} videoId - Video ID for naming
     * @returns {Promise<Object>} - HLS manifest information
     */
    async generateHLS(inputPath, outputDir, videoId) {
        try {
            // Create HLS directory
            const hlsDir = path.join(outputDir, 'hls');
            await fs.mkdir(hlsDir, { recursive: true });

            // Generate master playlist
            const masterPlaylistPath = path.join(hlsDir, 'master.m3u8');
            const variantPlaylists = [];

            // Process each quality
            for (const quality of this.hlsQualities) {
                const qualityDir = path.join(hlsDir, quality.name);
                await fs.mkdir(qualityDir, { recursive: true });

                const playlistPath = path.join(qualityDir, 'playlist.m3u8');
                const segmentPattern = path.join(qualityDir, 'segment%03d.ts');

                await this.generateHLSVariant(inputPath, quality, playlistPath, segmentPattern);

                variantPlaylists.push({
                    quality: quality.name,
                    bandwidth: parseInt(quality.bitrate) * 1000,
                    resolution: `${quality.width}x${quality.height}`,
                    playlistPath: `${quality.name}/playlist.m3u8`
                });
            }

            // Create master playlist
            await this.createMasterPlaylist(masterPlaylistPath, variantPlaylists);

            return {
                masterPlaylist: masterPlaylistPath,
                variants: variantPlaylists,
                hlsDirectory: hlsDir
            };

        } catch (error) {
            console.error('HLS generation error:', error);
            throw error;
        }
    }

    /**
     * Generate a single HLS variant
     */
    generateHLSVariant(inputPath, quality, playlistPath, segmentPattern) {
        return new Promise((resolve, reject) => {
            const command = ffmpeg(inputPath)
                .outputOptions([
                    '-c:v libx264',
                    '-c:a aac',
                    `-b:v ${quality.bitrate}`,
                    `-b:a ${quality.audioBitrate}`,
                    `-s ${quality.width}x${quality.height}`,
                    '-preset fast',
                    '-profile:v main',
                    '-level 3.1',
                    '-start_number 0',
                    `-hls_time ${this.hlsSegmentDuration}`,
                    '-hls_list_size 0',
                    '-hls_segment_filename', segmentPattern,
                    '-hls_playlist_type vod',
                    '-f hls'
                ])
                .output(playlistPath);

            command.on('start', (cmd) => {
                console.log(`🎬 Starting HLS ${quality.name} generation...`);
            });

            command.on('progress', (progress) => {
                if (progress.percent) {
                    console.log(`⏳ HLS ${quality.name}: ${Math.round(progress.percent)}%`);
                }
            });

            command.on('end', () => {
                console.log(`✅ HLS ${quality.name} generation complete`);
                resolve();
            });

            command.on('error', (err) => {
                console.error(`❌ HLS ${quality.name} generation failed:`, err);
                reject(err);
            });

            command.run();
        });
    }

    /**
     * Create HLS master playlist
     */
    async createMasterPlaylist(masterPath, variants) {
        let content = '#EXTM3U\n#EXT-X-VERSION:3\n\n';

        for (const variant of variants) {
            content += `#EXT-X-STREAM-INF:BANDWIDTH=${variant.bandwidth},RESOLUTION=${variant.resolution}\n`;
            content += `${variant.playlistPath}\n\n`;
        }

        await fs.writeFile(masterPath, content);
        console.log('✅ Master playlist created');
    }

    /**
     * Generate DASH manifest for adaptive streaming
     */
    async generateDASH(inputPath, outputDir, videoId) {
        const dashDir = path.join(outputDir, 'dash');
        await fs.mkdir(dashDir, { recursive: true });

        const manifestPath = path.join(dashDir, 'manifest.mpd');

        return new Promise((resolve, reject) => {
            const command = ffmpeg(inputPath)
                .outputOptions([
                    '-c:v libx264',
                    '-c:a aac',
                    '-b:v:0 800k',
                    '-b:v:1 1400k',
                    '-b:v:2 2800k',
                    '-b:a:0 96k',
                    '-b:a:1 128k',
                    '-b:a:2 192k',
                    '-s:v:0 640x360',
                    '-s:v:1 854x480',
                    '-s:v:2 1280x720',
                    '-map 0:v',
                    '-map 0:v',
                    '-map 0:v',
                    '-map 0:a',
                    '-map 0:a',
                    '-map 0:a',
                    '-f dash',
                    '-seg_duration 10',
                    '-use_template 1',
                    '-use_timeline 1',
                    '-adaptation_sets "id=0,streams=v id=1,streams=a"'
                ])
                .output(manifestPath);

            command.on('end', () => {
                console.log('✅ DASH manifest created');
                resolve({ manifestPath, dashDirectory: dashDir });
            });

            command.on('error', (err) => {
                console.error('❌ DASH generation failed:', err);
                reject(err);
            });

            command.run();
        });
    }

    /**
     * Create preview thumbnails for video scrubbing
     */
    async generatePreviewThumbnails(inputPath, outputDir, videoId) {
        const thumbDir = path.join(outputDir, 'thumbnails');
        await fs.mkdir(thumbDir, { recursive: true });

        return new Promise((resolve, reject) => {
            ffmpeg(inputPath)
                .screenshots({
                    count: 100, // Generate 100 thumbnails
                    folder: thumbDir,
                    filename: 'thumb_%i.jpg',
                    size: '160x90' // Small thumbnails for preview
                })
                .on('end', () => {
                    console.log('✅ Preview thumbnails generated');
                    resolve(thumbDir);
                })
                .on('error', reject);
        });
    }
}

module.exports = new HLSService();