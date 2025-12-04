const puppeteer = require('puppeteer');
const { PuppeteerScreenRecorder } = require('puppeteer-screen-recorder');
const path = require('path');
const fs = require('fs');

// Configuration
const CONFIG = {
    baseUrl: 'http://localhost:3001',
    adminEmail: 'test@example.com',
    adminPassword: 'Demo2024Pass',
    screenshotDir: path.join(__dirname, 'screenshots'),
    videoDir: path.join(__dirname, 'video'),
    viewport: { width: 1920, height: 1080 }
};

// Ensure directories exist
if (!fs.existsSync(CONFIG.screenshotDir)) {
    fs.mkdirSync(CONFIG.screenshotDir, { recursive: true });
}
if (!fs.existsSync(CONFIG.videoDir)) {
    fs.mkdirSync(CONFIG.videoDir, { recursive: true });
}

async function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function takeScreenshot(page, name, description) {
    const filename = `${name}.png`;
    const filepath = path.join(CONFIG.screenshotDir, filename);
    await page.screenshot({ path: filepath, fullPage: false });
    console.log(`Screenshot: ${name} - ${description}`);
    return { name, filename, description };
}

async function runWalkthrough() {
    console.log('Starting ReelShorts Platform Walkthrough...\n');

    const browser = await puppeteer.launch({
        headless: 'new',
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--window-size=1920,1080'
        ]
    });

    const page = await browser.newPage();
    await page.setViewport(CONFIG.viewport);

    // Set up screen recorder
    const recorderConfig = {
        followNewTab: false,
        fps: 30,
        ffmpeg_Path: null,
        videoFrame: {
            width: 1920,
            height: 1080
        },
        aspectRatio: '16:9'
    };

    const recorder = new PuppeteerScreenRecorder(page, recorderConfig);
    const videoPath = path.join(CONFIG.videoDir, 'walkthrough.mp4');

    const screenshots = [];

    try {
        // Start recording
        await recorder.start(videoPath);
        console.log('Video recording started...\n');

        // 1. Homepage (Public View)
        console.log('1. Navigating to Homepage...');
        await page.goto(CONFIG.baseUrl, { waitUntil: 'networkidle2', timeout: 30000 });
        await delay(2500);
        screenshots.push(await takeScreenshot(page, '01-homepage', 'Main homepage with video grid and category navigation'));

        // 2. Scroll down to show video grid
        console.log('2. Scrolling to show video grid...');
        await page.evaluate(() => window.scrollBy(0, 400));
        await delay(2000);
        screenshots.push(await takeScreenshot(page, '02-video-grid', 'Video grid showing available short films'));

        // 3. Navigate to Backstage login FIRST
        console.log('3. Navigating to Backstage (Admin Login)...');
        await page.goto(`${CONFIG.baseUrl}/backstage`, { waitUntil: 'networkidle2' });
        await delay(2000);
        screenshots.push(await takeScreenshot(page, '03-backstage-login', 'Admin backstage login portal'));

        // 4. Login as admin
        console.log('4. Logging in as admin...');
        await page.type('input[type="email"]', CONFIG.adminEmail, { delay: 30 });
        await delay(300);
        await page.type('input[type="password"]', CONFIG.adminPassword, { delay: 30 });
        await delay(500);
        screenshots.push(await takeScreenshot(page, '04-login-filled', 'Admin login form with credentials'));

        // Submit and wait for navigation
        console.log('5. Submitting login...');

        // Use keyboard to submit form (more reliable than click)
        await page.keyboard.press('Enter');

        // Wait for login to process and redirect
        await delay(4000);

        // Check current URL and take screenshot
        const currentUrl = page.url();
        console.log(`   Current URL after login: ${currentUrl}`);
        screenshots.push(await takeScreenshot(page, '05-admin-dashboard', 'Admin dashboard after successful login'));

        // 6. Click on different admin tabs if available
        console.log('6. Exploring admin moderation queue...');
        const moderationTab = await page.$('.admin-tabs button:nth-child(2)');
        if (moderationTab) {
            await moderationTab.click();
            await delay(2000);
        }
        screenshots.push(await takeScreenshot(page, '06-admin-moderation', 'Admin moderation queue for content review'));

        // 7. Check user management
        console.log('7. Exploring user management...');
        const usersTab = await page.$('.admin-tabs button:nth-child(3)');
        if (usersTab) {
            await usersTab.click();
            await delay(2000);
        }
        screenshots.push(await takeScreenshot(page, '07-admin-users', 'User management interface'));

        // 8. Navigate to Upload page (now logged in - should show full form)
        console.log('8. Navigating to Upload page (authenticated)...');
        await page.goto(`${CONFIG.baseUrl}/upload`, { waitUntil: 'networkidle2' });
        await delay(2000);
        screenshots.push(await takeScreenshot(page, '08-upload-page', 'Video upload interface for creators'));

        // 9. Fill in some upload form fields to show functionality
        console.log('9. Demonstrating upload form...');
        const titleInput = await page.$('#title');
        if (titleInput) {
            await page.type('#title', 'My Short Film Demo', { delay: 20 });
            await page.type('#director', 'Demo Director', { delay: 20 });
            await page.type('#duration', '5:30', { delay: 20 });

            // Select genre
            const genreSelect = await page.$('#genre');
            if (genreSelect) {
                await page.select('#genre', 'drama');
            }

            await page.type('#description', 'A compelling story about human connection and the power of cinema.', { delay: 10 });
            await delay(1000);
        }
        screenshots.push(await takeScreenshot(page, '09-upload-form-filled', 'Upload form with film details'));

        // 10. Navigate to Dashboard
        console.log('10. Navigating to Creator Dashboard...');
        await page.goto(`${CONFIG.baseUrl}/dashboard`, { waitUntil: 'networkidle2' });
        await delay(2000);
        screenshots.push(await takeScreenshot(page, '10-dashboard', 'Creator dashboard overview'));

        // 11. Return to homepage (now with user logged in)
        console.log('11. Returning to homepage (authenticated)...');
        await page.goto(CONFIG.baseUrl, { waitUntil: 'networkidle2' });
        await delay(2000);
        screenshots.push(await takeScreenshot(page, '11-homepage-authenticated', 'Homepage with authenticated user'));

        // 12. Test mobile responsive view
        console.log('12. Testing mobile responsive view...');
        await page.setViewport({ width: 375, height: 812 });
        await delay(1500);
        screenshots.push(await takeScreenshot(page, '12-mobile-homepage', 'Mobile responsive design'));

        // 13. Show mobile menu
        console.log('13. Opening mobile navigation...');
        const hamburger = await page.$('.hamburger-button, .hamburger, .mobile-menu-btn, [class*="hamburger"]');
        if (hamburger) {
            await hamburger.click();
            await delay(1500);
            screenshots.push(await takeScreenshot(page, '13-mobile-menu', 'Mobile navigation menu'));
        }

        // Reset viewport
        await page.setViewport(CONFIG.viewport);

        // Stop recording
        await recorder.stop();
        console.log(`\nVideo saved to: ${videoPath}`);

        // Generate screenshots manifest
        const manifest = {
            generated: new Date().toISOString(),
            baseUrl: CONFIG.baseUrl,
            screenshots: screenshots
        };

        fs.writeFileSync(
            path.join(CONFIG.screenshotDir, 'manifest.json'),
            JSON.stringify(manifest, null, 2)
        );
        console.log('\nScreenshot manifest saved.');

        console.log(`\nWalkthrough complete!`);
        console.log(`Screenshots: ${CONFIG.screenshotDir}`);
        console.log(`Video: ${videoPath}`);
        console.log(`Total screenshots: ${screenshots.length}`);

    } catch (error) {
        console.error('Error during walkthrough:', error);
        try {
            await recorder.stop();
        } catch (e) {}
    } finally {
        await browser.close();
    }

    return screenshots;
}

// Run if executed directly
if (require.main === module) {
    runWalkthrough()
        .then(() => process.exit(0))
        .catch(err => {
            console.error(err);
            process.exit(1);
        });
}

module.exports = { runWalkthrough, CONFIG };
