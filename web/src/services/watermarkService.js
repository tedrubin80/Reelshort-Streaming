const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const util = require('util');
const execPromise = util.promisify(exec);

/**
 * Video Watermarking Service using FFmpeg
 * Adds text or image watermarks to videos for copyright protection
 */

class WatermarkService {
    constructor() {
        this.processingDir = process.env.PROCESSING_DRIVE || '/tmp';
        this.watermarkEnabled = process.env.ENABLE_WATERMARK !== 'false';
        this.defaultPosition = process.env.WATERMARK_POSITION || 'bottom-right';
        this.defaultOpacity = parseFloat(process.env.WATERMARK_OPACITY || '0.7');
        this.watermarkLogoPath = process.env.WATERMARK_LOGO_PATH || null;
    }

    /**
     * Add text watermark to video
     */
    async addTextWatermark(inputPath, outputPath, options = {}) {
        try {
            const {
                text = 'ReelShorts.live',
                fontSize = 24,
                fontColor = 'white',
                position = this.defaultPosition,
                opacity = this.defaultOpacity,
                fontFile = null
            } = options;

            if (!fs.existsSync(inputPath)) {
                throw new Error(`Input file not found: ${inputPath}`);
            }

            // Calculate position coordinates
            const positionFilter = this.getPositionFilter(position, fontSize);

            // Build FFmpeg filter for text overlay
            const fontPath = fontFile || '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf';

            let filterComplex = `drawtext=text='${text.replace(/'/g, "\\'")}':` +
                `fontfile=${fontPath}:` +
                `fontsize=${fontSize}:` +
                `fontcolor=${fontColor}@${opacity}:` +
                `${positionFilter}:` +
                `shadowcolor=black@0.5:shadowx=2:shadowy=2`;

            console.log(`🖊️  Adding text watermark: "${text}"`);

            const command = `ffmpeg -i "${inputPath}" ` +
                `-vf "${filterComplex}" ` +
                `-c:v libx264 -preset medium -crf 23 ` +
                `-c:a copy ` +
                `"${outputPath}" -y`;

            await execPromise(command);

            console.log(`✅ Text watermark added successfully`);
            return outputPath;

        } catch (error) {
            console.error('Error adding text watermark:', error);
            throw error;
        }
    }

    /**
     * Add image/logo watermark to video
     */
    async addLogoWatermark(inputPath, outputPath, logoPath, options = {}) {
        try {
            const {
                position = this.defaultPosition,
                opacity = this.defaultOpacity,
                scale = 0.15 // Logo will be 15% of video width
            } = options;

            if (!fs.existsSync(inputPath)) {
                throw new Error(`Input file not found: ${inputPath}`);
            }

            if (!fs.existsSync(logoPath)) {
                throw new Error(`Logo file not found: ${logoPath}`);
            }

            // Get video dimensions
            const dimensions = await this.getVideoDimensions(inputPath);
            const logoWidth = Math.floor(dimensions.width * scale);

            // Calculate position
            const positionFilter = this.getLogoPositionFilter(position, 20); // 20px padding

            console.log(`🖼️  Adding logo watermark from: ${path.basename(logoPath)}`);

            // Build filter complex
            const filterComplex =
                `[1:v]scale=${logoWidth}:-1,format=rgba,colorchannelmixer=aa=${opacity}[logo];` +
                `[0:v][logo]overlay=${positionFilter}`;

            const command = `ffmpeg -i "${inputPath}" -i "${logoPath}" ` +
                `-filter_complex "${filterComplex}" ` +
                `-c:v libx264 -preset medium -crf 23 ` +
                `-c:a copy ` +
                `"${outputPath}" -y`;

            await execPromise(command);

            console.log(`✅ Logo watermark added successfully`);
            return outputPath;

        } catch (error) {
            console.error('Error adding logo watermark:', error);
            throw error;
        }
    }

    /**
     * Add combined text and logo watermark
     */
    async addCombinedWatermark(inputPath, outputPath, options = {}) {
        try {
            const {
                text = 'ReelShorts.live',
                logoPath = this.watermarkLogoPath,
                channelName = null
            } = options;

            // First add logo if provided
            let tempPath = inputPath;

            if (logoPath && fs.existsSync(logoPath)) {
                tempPath = path.join(
                    this.processingDir,
                    `temp_logo_${Date.now()}_${path.basename(inputPath)}`
                );
                await this.addLogoWatermark(inputPath, tempPath, logoPath, {
                    position: 'top-right',
                    opacity: 0.8,
                    scale: 0.12
                });
            }

            // Add text watermark
            const watermarkText = channelName
                ? `${channelName} • ${text}`
                : text;

            await this.addTextWatermark(tempPath, outputPath, {
                text: watermarkText,
                fontSize: 20,
                position: 'bottom-right',
                opacity: 0.7
            });

            // Clean up temp file
            if (tempPath !== inputPath && fs.existsSync(tempPath)) {
                fs.unlinkSync(tempPath);
            }

            console.log(`✅ Combined watermark added successfully`);
            return outputPath;

        } catch (error) {
            console.error('Error adding combined watermark:', error);
            throw error;
        }
    }

    /**
     * Add timestamp watermark (for live streams/recordings)
     */
    async addTimestampWatermark(inputPath, outputPath, options = {}) {
        try {
            const {
                position = 'top-left',
                fontSize = 16,
                format = '%Y-%m-%d %H\\:%M\\:%S'
            } = options;

            const positionFilter = this.getPositionFilter(position, fontSize);

            const filterComplex = `drawtext=text='%{localtime\\:${format}}':` +
                `fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf:` +
                `fontsize=${fontSize}:` +
                `fontcolor=white@0.8:` +
                `${positionFilter}:` +
                `box=1:boxcolor=black@0.5:boxborderw=5`;

            console.log(`⏰ Adding timestamp watermark`);

            const command = `ffmpeg -i "${inputPath}" ` +
                `-vf "${filterComplex}" ` +
                `-c:v libx264 -preset medium -crf 23 ` +
                `-c:a copy ` +
                `"${outputPath}" -y`;

            await execPromise(command);

            console.log(`✅ Timestamp watermark added`);
            return outputPath;

        } catch (error) {
            console.error('Error adding timestamp watermark:', error);
            throw error;
        }
    }

    /**
     * Get video dimensions
     */
    async getVideoDimensions(videoPath) {
        try {
            const command = `ffprobe -v error -select_streams v:0 ` +
                `-show_entries stream=width,height ` +
                `-of csv=p=0 "${videoPath}"`;

            const { stdout } = await execPromise(command);
            const [width, height] = stdout.trim().split(',').map(Number);

            return { width, height };
        } catch (error) {
            console.error('Error getting video dimensions:', error);
            return { width: 1920, height: 1080 }; // Default fallback
        }
    }

    /**
     * Get position filter for text watermark
     */
    getPositionFilter(position, fontSize) {
        const padding = 20;

        const positions = {
            'top-left': `x=${padding}:y=${padding}`,
            'top-right': `x=w-tw-${padding}:y=${padding}`,
            'bottom-left': `x=${padding}:y=h-th-${padding}`,
            'bottom-right': `x=w-tw-${padding}:y=h-th-${padding}`,
            'center': `x=(w-tw)/2:y=(h-th)/2`,
            'top-center': `x=(w-tw)/2:y=${padding}`,
            'bottom-center': `x=(w-tw)/2:y=h-th-${padding}`
        };

        return positions[position] || positions['bottom-right'];
    }

    /**
     * Get position filter for logo watermark
     */
    getLogoPositionFilter(position, padding = 20) {
        const positions = {
            'top-left': `${padding}:${padding}`,
            'top-right': `W-w-${padding}:${padding}`,
            'bottom-left': `${padding}:H-h-${padding}`,
            'bottom-right': `W-w-${padding}:H-h-${padding}`,
            'center': `(W-w)/2:(H-h)/2`,
            'top-center': `(W-w)/2:${padding}`,
            'bottom-center': `(W-w)/2:H-h-${padding}`
        };

        return positions[position] || positions['bottom-right'];
    }

    /**
     * Process video with watermark based on channel settings
     */
    async processVideoWatermark(videoId, videoPath, channelSettings = {}) {
        try {
            if (!this.watermarkEnabled) {
                console.log('⚠️  Watermarking is disabled');
                return videoPath;
            }

            const outputPath = videoPath.replace(
                path.extname(videoPath),
                `_watermarked${path.extname(videoPath)}`
            );

            const {
                watermarkType = 'text',
                watermarkText = null,
                watermarkLogo = null,
                channelName = null,
                enableTimestamp = false
            } = channelSettings;

            switch (watermarkType) {
                case 'text':
                    await this.addTextWatermark(videoPath, outputPath, {
                        text: watermarkText || channelName || 'ReelShorts.live'
                    });
                    break;

                case 'logo':
                    if (watermarkLogo) {
                        await this.addLogoWatermark(videoPath, outputPath, watermarkLogo);
                    } else {
                        throw new Error('Logo path required for logo watermark');
                    }
                    break;

                case 'combined':
                    await this.addCombinedWatermark(videoPath, outputPath, {
                        text: watermarkText,
                        logoPath: watermarkLogo,
                        channelName
                    });
                    break;

                case 'timestamp':
                    await this.addTimestampWatermark(videoPath, outputPath);
                    break;

                default:
                    // Default: text watermark
                    await this.addTextWatermark(videoPath, outputPath, {
                        text: channelName || 'ReelShorts.live'
                    });
            }

            // If timestamp is enabled, add it
            if (enableTimestamp && watermarkType !== 'timestamp') {
                const timestampPath = outputPath.replace('.mp4', '_ts.mp4');
                await this.addTimestampWatermark(outputPath, timestampPath);
                fs.unlinkSync(outputPath); // Remove intermediate file
                return timestampPath;
            }

            return outputPath;

        } catch (error) {
            console.error('Error processing video watermark:', error);
            throw error;
        }
    }

    /**
     * Check if watermarking is enabled
     */
    isEnabled() {
        return this.watermarkEnabled;
    }
}

module.exports = new WatermarkService();
