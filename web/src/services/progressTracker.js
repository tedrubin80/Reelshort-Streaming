const { cache } = require('../config/redis');

class ProgressTracker {
    constructor(io) {
        this.io = io;
        this.setupProgressMonitoring();
    }

    /**
     * Set up Redis subscriber for progress updates
     */
    setupProgressMonitoring() {
        // For now, skip Redis pub/sub and use polling approach
        // This can be enhanced later with proper Redis pub/sub setup
        console.log('📊 Progress tracking initialized (polling mode)');
        
        // Set up periodic progress checking
        this.progressCheckInterval = setInterval(() => {
            this.checkForProgressUpdates();
        }, 2000); // Check every 2 seconds
    }

    /**
     * Check for progress updates (polling mode)
     */
    async checkForProgressUpdates() {
        // This method can be used for polling-based progress updates
        // For now, it's just a placeholder for future enhancement
    }

    /**
     * Update progress for a specific video
     */
    async updateProgress(filmId, status, progress, message = '') {
        try {
            const progressData = {
                status,
                progress,
                message,
                updatedAt: new Date().toISOString()
            };

            // Store in Redis with expiration
            await cache.set(`transcode_progress:${filmId}`, progressData, 3600);
            
            // Also emit directly via socket.io for immediate delivery
            this.io.emit('upload-progress', {
                filmId,
                ...progressData
            });

            return true;
            
        } catch (error) {
            console.error(`Error updating progress for ${filmId}:`, error);
            return false;
        }
    }

    /**
     * Get current progress for a video
     */
    async getProgress(filmId) {
        try {
            const progressStr = await cache.get(`transcode_progress:${filmId}`);
            return progressStr ? JSON.parse(progressStr) : null;
        } catch (error) {
            console.error(`Error getting progress for ${filmId}:`, error);
            return null;
        }
    }

    /**
     * Clear progress data for a video
     */
    async clearProgress(filmId) {
        try {
            await cache.del(`transcode_progress:${filmId}`);
            
            // Emit final update
            this.io.emit('upload-progress', {
                filmId,
                status: 'completed',
                progress: 100,
                message: 'Processing completed',
                updatedAt: new Date().toISOString()
            });
            
            return true;
            
        } catch (error) {
            console.error(`Error clearing progress for ${filmId}:`, error);
            return false;
        }
    }

    /**
     * Handle user joining upload progress room
     */
    handleUserJoinProgress(socket, filmId) {
        socket.join(`upload-${filmId}`);
        
        // Send current progress if available
        this.getProgress(filmId).then(progress => {
            if (progress) {
                socket.emit('upload-progress', {
                    filmId,
                    ...progress
                });
            }
        });
    }

    /**
     * Handle user leaving upload progress room
     */
    handleUserLeaveProgress(socket, filmId) {
        socket.leave(`upload-${filmId}`);
    }

    /**
     * Emit upload status to specific user
     */
    emitToUser(userId, event, data) {
        this.io.to(`user-${userId}`).emit(event, data);
    }

    /**
     * Emit upload status to all users in a room
     */
    emitToRoom(roomId, event, data) {
        this.io.to(roomId).emit(event, data);
    }

    /**
     * Get all active progress tracking sessions
     */
    async getActiveProgress() {
        try {
            const keys = await cache.keys('transcode_progress:*');
            const activeProgress = [];
            
            for (const key of keys) {
                const filmId = key.replace('transcode_progress:', '');
                const progressStr = await cache.get(key);
                
                if (progressStr) {
                    const progress = JSON.parse(progressStr);
                    activeProgress.push({
                        filmId,
                        ...progress
                    });
                }
            }
            
            return activeProgress;
            
        } catch (error) {
            console.error('Error getting active progress:', error);
            return [];
        }
    }
}

module.exports = ProgressTracker;