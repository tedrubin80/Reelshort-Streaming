const videoProcessingService = require('./videoProcessingService');

class ProcessingDaemon {
    constructor() {
        this.isRunning = false;
        this.maxConcurrent = parseInt(process.env.MAX_CONCURRENT_PROCESSING) || 3;
        this.activeJobs = new Map();
        this.shouldStop = false;
    }

    /**
     * Start the processing daemon
     */
    async start() {
        if (this.isRunning) {
            console.log('Processing daemon already running');
            return;
        }

        this.isRunning = true;
        this.shouldStop = false;
        
        console.log(`Starting video processing daemon with max ${this.maxConcurrent} concurrent jobs`);

        // Start multiple worker processes
        const workers = [];
        for (let i = 0; i < this.maxConcurrent; i++) {
            workers.push(this.startWorker(`worker-${i}`));
        }

        // Wait for all workers to complete
        await Promise.all(workers);
        
        this.isRunning = false;
        console.log('Video processing daemon stopped');
    }

    /**
     * Stop the processing daemon
     */
    stop() {
        console.log('Stopping video processing daemon...');
        this.shouldStop = true;
    }

    /**
     * Individual worker process
     */
    async startWorker(workerId) {
        console.log(`Starting worker: ${workerId}`);
        
        while (!this.shouldStop) {
            try {
                // Check if we can process another job
                if (this.activeJobs.size >= this.maxConcurrent) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    continue;
                }

                // Process next video in queue
                const filmId = await videoProcessingService.processNextVideo();
                
                if (filmId) {
                    this.activeJobs.set(filmId, {
                        workerId,
                        startTime: Date.now()
                    });
                    
                    console.log(`Worker ${workerId} completed processing: ${filmId}`);
                    this.activeJobs.delete(filmId);
                } else {
                    // No jobs available, wait a bit
                    await new Promise(resolve => setTimeout(resolve, 5000));
                }
                
            } catch (error) {
                console.error(`Worker ${workerId} error:`, error);
                
                // Wait before retrying
                await new Promise(resolve => setTimeout(resolve, 10000));
            }
        }
        
        console.log(`Worker ${workerId} stopped`);
    }

    /**
     * Get daemon status
     */
    getStatus() {
        return {
            isRunning: this.isRunning,
            maxConcurrent: this.maxConcurrent,
            activeJobs: this.activeJobs.size,
            workers: Array.from(this.activeJobs.entries()).map(([filmId, job]) => ({
                filmId,
                workerId: job.workerId,
                duration: Date.now() - job.startTime
            }))
        };
    }
}

// Create singleton instance
const daemon = new ProcessingDaemon();

// Graceful shutdown handling
process.on('SIGTERM', () => {
    console.log('Received SIGTERM, shutting down gracefully');
    daemon.stop();
});

process.on('SIGINT', () => {
    console.log('Received SIGINT, shutting down gracefully');
    daemon.stop();
});

module.exports = daemon;