const express = require('express');
const waiverController = require('../controllers/waiverController');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// All waiver routes require authentication
router.use(authenticateToken);

/**
 * @route POST /api/waivers/submit-award
 * @desc Submit festival award for verification
 * @access Private
 */
router.post('/submit-award', waiverController.submitAward);

/**
 * @route POST /api/waivers/request
 * @desc Request subscription waiver based on verified award
 * @access Private
 */
router.post('/request', waiverController.requestWaiver);

/**
 * @route POST /api/waivers/redeem
 * @desc Redeem waiver code for subscription discount
 * @access Private
 */
router.post('/redeem', waiverController.redeemWaiver);

/**
 * @route GET /api/waivers/my-waivers
 * @desc Get user's waivers
 * @access Private
 */
router.get('/my-waivers', waiverController.getUserWaivers);

/**
 * @route POST /api/waivers/director-response/:waiverId
 * @desc Festival director response to waiver request
 * @access Public (with token validation from email link)
 */
router.post('/director-response/:waiverId', waiverController.directorResponse);

/**
 * @route GET /api/waivers/verify-award/:awardId
 * @desc Verify award (admin only)
 * @access Private (Admin)
 */
router.get('/verify-award/:awardId', requireAdmin, async (req, res) => {
    try {
        const { awardId } = req.params;
        const { query } = require('../config/database');

        const result = await query(`
            SELECT fa.*, u.username, u.email, v.title as film_title
            FROM festival_awards fa
            JOIN users u ON fa.user_id = u.id
            LEFT JOIN videos v ON fa.film_id = v.id
            WHERE fa.id = $1
        `, [awardId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Award not found' });
        }

        res.json({ award: result.rows[0] });
    } catch (error) {
        console.error('Verify award error:', error);
        res.status(500).json({ error: 'Failed to get award details' });
    }
});

/**
 * @route POST /api/waivers/verify-award/:awardId
 * @desc Verify or reject award (admin only)
 * @access Private (Admin)
 */
router.post('/verify-award/:awardId', requireAdmin, async (req, res) => {
    try {
        const { awardId } = req.params;
        const { action, notes } = req.body; // action: 'verify' | 'reject'
        const adminId = req.user.id;

        if (!['verify', 'reject'].includes(action)) {
            return res.status(400).json({
                error: 'Invalid action',
                validActions: ['verify', 'reject']
            });
        }

        const { query } = require('../config/database');
        
        const status = action === 'verify' ? 'verified' : 'rejected';
        
        await query(`
            UPDATE festival_awards 
            SET verification_status = $1, verified_by = $2, verified_at = NOW(), notes = $3, updated_at = NOW()
            WHERE id = $4
        `, [status, adminId, notes, awardId]);

        res.json({
            success: true,
            message: `Award ${status} successfully`,
            status
        });

    } catch (error) {
        console.error('Verify award error:', error);
        res.status(500).json({ error: 'Failed to verify award' });
    }
});

/**
 * @route GET /api/waivers/admin/pending-awards
 * @desc Get pending award verifications (admin only)
 * @access Private (Admin)
 */
router.get('/admin/pending-awards', requireAdmin, async (req, res) => {
    try {
        const { query } = require('../config/database');
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const offset = (page - 1) * limit;

        const result = await query(`
            SELECT fa.*, u.username, u.email, u.display_name, v.title as film_title
            FROM festival_awards fa
            JOIN users u ON fa.user_id = u.id
            LEFT JOIN videos v ON fa.film_id = v.id
            WHERE fa.verification_status = 'pending'
            ORDER BY fa.created_at DESC
            LIMIT $1 OFFSET $2
        `, [limit, offset]);

        const countResult = await query(`
            SELECT COUNT(*) as total FROM festival_awards WHERE verification_status = 'pending'
        `);

        const total = parseInt(countResult.rows[0].total);

        res.json({
            awards: result.rows,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        });

    } catch (error) {
        console.error('Get pending awards error:', error);
        res.status(500).json({ error: 'Failed to get pending awards' });
    }
});

/**
 * @route GET /api/waivers/admin/pending-waivers
 * @desc Get pending waiver requests (admin only)
 * @access Private (Admin)
 */
router.get('/admin/pending-waivers', requireAdmin, async (req, res) => {
    try {
        const { query } = require('../config/database');
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const offset = (page - 1) * limit;

        const result = await query(`
            SELECT sw.*, fa.festival_name, fa.award_category, fa.award_type, fa.award_year,
                   u.username, u.email, u.display_name
            FROM subscription_waivers sw
            JOIN festival_awards fa ON sw.award_id = fa.id
            JOIN users u ON sw.user_id = u.id
            WHERE sw.status = 'pending'
            ORDER BY sw.created_at DESC
            LIMIT $1 OFFSET $2
        `, [limit, offset]);

        const countResult = await query(`
            SELECT COUNT(*) as total FROM subscription_waivers WHERE status = 'pending'
        `);

        const total = parseInt(countResult.rows[0].total);

        res.json({
            waivers: result.rows,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        });

    } catch (error) {
        console.error('Get pending waivers error:', error);
        res.status(500).json({ error: 'Failed to get pending waivers' });
    }
});

/**
 * @route POST /api/waivers/admin/approve/:waiverId
 * @desc Manually approve waiver (admin only)
 * @access Private (Admin)
 */
router.post('/admin/approve/:waiverId', requireAdmin, async (req, res) => {
    try {
        const { waiverId } = req.params;
        const { notes } = req.body;
        const adminId = req.user.id;

        await waiverController.approveWaiver(waiverId, adminId, notes);

        res.json({
            success: true,
            message: 'Waiver approved successfully'
        });

    } catch (error) {
        console.error('Admin approve waiver error:', error);
        res.status(500).json({ error: 'Failed to approve waiver' });
    }
});

/**
 * @route GET /api/waivers/check-code/:code
 * @desc Check if waiver code is valid
 * @access Private
 */
router.get('/check-code/:code', async (req, res) => {
    try {
        const { code } = req.params;
        const { query } = require('../config/database');

        const result = await query(`
            SELECT sw.*, fa.festival_name, fa.award_category, fa.award_type
            FROM subscription_waivers sw
            JOIN festival_awards fa ON sw.award_id = fa.id
            WHERE sw.waiver_code = $1 AND sw.status = 'approved' AND sw.expires_at > NOW()
        `, [code]);

        if (result.rows.length === 0) {
            return res.json({
                valid: false,
                message: 'Invalid or expired waiver code'
            });
        }

        const waiver = result.rows[0];

        // Check if already used
        const usedCheck = await query(`
            SELECT id FROM waiver_redemptions WHERE waiver_id = $1
        `, [waiver.id]);

        if (usedCheck.rows.length > 0) {
            return res.json({
                valid: false,
                message: 'Waiver code has already been used'
            });
        }

        res.json({
            valid: true,
            waiver: {
                code: waiver.waiver_code,
                discountPercentage: waiver.discount_percentage,
                festivalName: waiver.festival_name,
                awardCategory: waiver.award_category,
                expiresAt: waiver.expires_at
            }
        });

    } catch (error) {
        console.error('Check waiver code error:', error);
        res.status(500).json({ error: 'Failed to check waiver code' });
    }
});

module.exports = router;