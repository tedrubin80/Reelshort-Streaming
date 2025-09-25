const { query, transaction } = require('../config/database');
const { cache } = require('../config/redis');
const { v4: uuidv4 } = require('uuid');
const emailService = require('../services/emailService');
const { validateInput, sanitizeInput } = require('../utils/validation');

class WaiverController {
    // Submit festival award for verification
    async submitAward(req, res) {
        try {
            const userId = req.user.id;
            const {
                film_id,
                festival_name,
                award_category,
                award_type,
                award_year,
                verification_document_url
            } = req.body;

            // Validate input
            if (!festival_name || !award_category || !award_type || !award_year) {
                return res.status(400).json({
                    error: 'Missing required fields',
                    required: ['festival_name', 'award_category', 'award_type', 'award_year']
                });
            }

            // Check if award year is valid
            const currentYear = new Date().getFullYear();
            if (award_year < 2000 || award_year > currentYear) {
                return res.status(400).json({
                    error: 'Invalid award year',
                    message: `Award year must be between 2000 and ${currentYear}`
                });
            }

            // Check if user already has a pending/verified award for this festival and year
            const existingAward = await query(`
                SELECT id FROM festival_awards 
                WHERE user_id = $1 AND festival_name ILIKE $2 AND award_year = $3 
                AND verification_status IN ('pending', 'verified')
            `, [userId, festival_name, award_year]);

            if (existingAward.rows.length > 0) {
                return res.status(409).json({
                    error: 'Award already exists',
                    message: 'You already have a pending or verified award for this festival and year'
                });
            }

            // If film_id provided, verify user owns the film
            if (film_id) {
                const filmCheck = await query(`
                    SELECT v.id FROM videos v
                    JOIN channels c ON v.channel_id = c.id
                    WHERE v.id = $1 AND c.user_id = $2
                `, [film_id, userId]);

                if (filmCheck.rows.length === 0) {
                    return res.status(403).json({
                        error: 'Film not found or access denied'
                    });
                }
            }

            // Create award record
            const awardId = uuidv4();
            await query(`
                INSERT INTO festival_awards (
                    id, user_id, film_id, festival_name, award_category, 
                    award_type, award_year, verification_document_url
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            `, [
                awardId, userId, film_id, sanitizeInput(festival_name),
                sanitizeInput(award_category), sanitizeInput(award_type),
                award_year, verification_document_url
            ]);

            res.status(201).json({
                success: true,
                awardId,
                message: 'Award submitted for verification',
                status: 'pending'
            });

        } catch (error) {
            console.error('Submit award error:', error);
            res.status(500).json({ error: 'Failed to submit award' });
        }
    }

    // Request subscription waiver based on verified award
    async requestWaiver(req, res) {
        try {
            const userId = req.user.id;
            const { award_id, waiver_type = 'full_waiver' } = req.body;

            if (!award_id) {
                return res.status(400).json({ error: 'Award ID is required' });
            }

            // Verify award belongs to user and is verified
            const awardResult = await query(`
                SELECT fa.*, fd.email as director_email, fd.director_name,
                       u.username, u.email as user_email, u.display_name,
                       v.title as film_title
                FROM festival_awards fa
                LEFT JOIN festival_directors fd ON fa.festival_name ILIKE fd.festival_name
                LEFT JOIN users u ON fa.user_id = u.id
                LEFT JOIN videos v ON fa.film_id = v.id
                WHERE fa.id = $1 AND fa.user_id = $2 AND fa.verification_status = 'verified'
            `, [award_id, userId]);

            if (awardResult.rows.length === 0) {
                return res.status(404).json({
                    error: 'Award not found or not verified',
                    message: 'Only verified awards are eligible for waivers'
                });
            }

            const award = awardResult.rows[0];

            // Check if waiver already exists for this award
            const existingWaiver = await query(`
                SELECT id, status FROM subscription_waivers 
                WHERE award_id = $1 AND status NOT IN ('rejected', 'expired')
            `, [award_id]);

            if (existingWaiver.rows.length > 0) {
                return res.status(409).json({
                    error: 'Waiver already exists',
                    message: 'A waiver request already exists for this award',
                    existingStatus: existingWaiver.rows[0].status
                });
            }

            // Generate unique waiver code
            const waiverCode = this.generateWaiverCode(award.festival_name, award.award_year);
            
            // Set discount percentage based on award type
            const discountPercentage = this.getDiscountPercentage(award.award_type, waiver_type);
            
            // Set expiry date (1 year from now)
            const expiresAt = new Date();
            expiresAt.setFullYear(expiresAt.getFullYear() + 1);

            // Create waiver record
            const waiverId = uuidv4();
            await query(`
                INSERT INTO subscription_waivers (
                    id, user_id, award_id, waiver_type, discount_percentage,
                    waiver_code, requested_by, festival_director_email, expires_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            `, [
                waiverId, userId, award_id, waiver_type, discountPercentage,
                waiverCode, userId, award.director_email, expiresAt
            ]);

            // Check if this festival has auto-approval
            const directorResult = await query(`
                SELECT auto_approve_waivers FROM festival_directors 
                WHERE festival_name ILIKE $1 AND is_active = true
            `, [award.festival_name]);

            const autoApprove = directorResult.rows[0]?.auto_approve_waivers || false;

            if (autoApprove) {
                // Auto-approve waiver
                await this.approveWaiver(waiverId, null, 'Auto-approved for verified festival');
                
                res.json({
                    success: true,
                    waiverId,
                    waiverCode,
                    status: 'approved',
                    message: 'Waiver automatically approved!',
                    discountPercentage,
                    expiresAt: expiresAt.toISOString()
                });
            } else {
                // Send email to festival director
                if (award.director_email) {
                    await emailService.sendWaiverRequestToDirector({
                        directorEmail: award.director_email,
                        directorName: award.director_name,
                        filmmakerName: award.display_name || award.username,
                        filmmakerEmail: award.user_email,
                        filmTitle: award.film_title,
                        festivalName: award.festival_name,
                        awardCategory: award.award_category,
                        awardType: award.award_type,
                        awardYear: award.award_year,
                        discountPercentage,
                        waiverId
                    });

                    // Update notification timestamp
                    await query(`
                        UPDATE subscription_waivers 
                        SET festival_director_notified_at = NOW()
                        WHERE id = $1
                    `, [waiverId]);
                }

                res.json({
                    success: true,
                    waiverId,
                    status: 'pending',
                    message: 'Waiver request submitted. Festival director has been notified.',
                    discountPercentage,
                    expiresAt: expiresAt.toISOString(),
                    directorNotified: !!award.director_email
                });
            }

        } catch (error) {
            console.error('Request waiver error:', error);
            res.status(500).json({ error: 'Failed to request waiver' });
        }
    }

    // Admin/Director approve waiver
    async approveWaiver(waiverId, approverId = null, notes = '') {
        try {
            await transaction(async (client) => {
                // Update waiver status
                await client.query(`
                    UPDATE subscription_waivers 
                    SET status = 'approved', approved_by = $1, admin_notes = $2, updated_at = NOW()
                    WHERE id = $3
                `, [approverId, notes, waiverId]);

                // Get waiver details for notification
                const waiverResult = await client.query(`
                    SELECT sw.*, fa.festival_name, fa.award_category, u.email, u.display_name
                    FROM subscription_waivers sw
                    JOIN festival_awards fa ON sw.award_id = fa.id
                    JOIN users u ON sw.user_id = u.id
                    WHERE sw.id = $1
                `, [waiverId]);

                if (waiverResult.rows.length > 0) {
                    const waiver = waiverResult.rows[0];
                    
                    // Send approval notification email
                    await emailService.sendWaiverApprovalNotification({
                        userEmail: waiver.email,
                        filmmakerName: waiver.display_name,
                        waiverCode: waiver.waiver_code,
                        discountPercentage: waiver.discount_percentage,
                        expiresAt: waiver.expires_at,
                        festivalName: waiver.festival_name,
                        awardCategory: waiver.award_category
                    });
                }
            });

            return true;
        } catch (error) {
            console.error('Approve waiver error:', error);
            throw error;
        }
    }

    // Festival director response endpoint
    async directorResponse(req, res) {
        try {
            const { waiverId } = req.params;
            const { action, response_text } = req.body; // action: 'approve' | 'reject'

            if (!['approve', 'reject'].includes(action)) {
                return res.status(400).json({
                    error: 'Invalid action',
                    validActions: ['approve', 'reject']
                });
            }

            // Verify waiver exists and is pending
            const waiverResult = await query(`
                SELECT * FROM subscription_waivers 
                WHERE id = $1 AND status = 'pending'
            `, [waiverId]);

            if (waiverResult.rows.length === 0) {
                return res.status(404).json({
                    error: 'Waiver not found or not pending'
                });
            }

            if (action === 'approve') {
                await this.approveWaiver(waiverId, null, `Festival director approved: ${response_text}`);
                
                // Update director response
                await query(`
                    UPDATE subscription_waivers 
                    SET festival_director_response = $1, festival_director_responded_at = NOW()
                    WHERE id = $2
                `, [response_text, waiverId]);

                res.json({
                    success: true,
                    message: 'Waiver approved successfully',
                    status: 'approved'
                });
            } else {
                // Reject waiver
                await query(`
                    UPDATE subscription_waivers 
                    SET status = 'rejected', festival_director_response = $1, 
                        festival_director_responded_at = NOW(), updated_at = NOW()
                    WHERE id = $2
                `, [response_text, waiverId]);

                res.json({
                    success: true,
                    message: 'Waiver rejected',
                    status: 'rejected'
                });
            }

        } catch (error) {
            console.error('Director response error:', error);
            res.status(500).json({ error: 'Failed to process director response' });
        }
    }

    // Redeem waiver code
    async redeemWaiver(req, res) {
        try {
            const userId = req.user.id;
            const { waiver_code, plan_id } = req.body;

            if (!waiver_code || !plan_id) {
                return res.status(400).json({
                    error: 'Waiver code and plan ID are required'
                });
            }

            // Verify waiver code
            const waiverResult = await query(`
                SELECT sw.*, sp.price_monthly, sp.price_yearly, sp.name as plan_name
                FROM subscription_waivers sw
                CROSS JOIN subscription_plans sp
                WHERE sw.waiver_code = $1 AND sp.id = $2
                AND sw.status = 'approved' AND sw.expires_at > NOW()
            `, [waiver_code, plan_id]);

            if (waiverResult.rows.length === 0) {
                return res.status(400).json({
                    error: 'Invalid or expired waiver code'
                });
            }

            const waiver = waiverResult.rows[0];

            // Check if waiver already used
            const usedCheck = await query(`
                SELECT id FROM waiver_redemptions WHERE waiver_id = $1
            `, [waiver.id]);

            if (usedCheck.rows.length > 0) {
                return res.status(409).json({
                    error: 'Waiver code already used'
                });
            }

            // Calculate discount
            const originalPrice = waiver.price_monthly;
            const discountAmount = (originalPrice * waiver.discount_percentage) / 100;
            const finalPrice = Math.max(0, originalPrice - discountAmount);

            await transaction(async (client) => {
                // Create subscription
                const subscriptionId = uuidv4();
                const expiresAt = new Date();
                expiresAt.setMonth(expiresAt.getMonth() + 1); // 1 month subscription

                await client.query(`
                    INSERT INTO user_subscriptions (id, user_id, plan_id, expires_at)
                    VALUES ($1, $2, $3, $4)
                `, [subscriptionId, userId, plan_id, expiresAt]);

                // Record waiver redemption
                await client.query(`
                    INSERT INTO waiver_redemptions (
                        waiver_id, user_id, subscription_id, 
                        discount_amount, original_amount, final_amount
                    ) VALUES ($1, $2, $3, $4, $5, $6)
                `, [waiver.id, userId, subscriptionId, discountAmount, originalPrice, finalPrice]);

                // Mark waiver as used
                await client.query(`
                    UPDATE subscription_waivers 
                    SET status = 'used', used_at = NOW(), updated_at = NOW()
                    WHERE id = $1
                `, [waiver.id]);
            });

            res.json({
                success: true,
                message: 'Waiver redeemed successfully!',
                subscription: {
                    planName: waiver.plan_name,
                    originalPrice,
                    discountAmount,
                    finalPrice,
                    discountPercentage: waiver.discount_percentage
                }
            });

        } catch (error) {
            console.error('Redeem waiver error:', error);
            res.status(500).json({ error: 'Failed to redeem waiver' });
        }
    }

    // Get user's waivers
    async getUserWaivers(req, res) {
        try {
            const userId = req.user.id;

            const result = await query(`
                SELECT sw.*, fa.festival_name, fa.award_category, fa.award_type, fa.award_year
                FROM subscription_waivers sw
                JOIN festival_awards fa ON sw.award_id = fa.id
                WHERE sw.user_id = $1
                ORDER BY sw.created_at DESC
            `, [userId]);

            res.json({
                waivers: result.rows
            });

        } catch (error) {
            console.error('Get user waivers error:', error);
            res.status(500).json({ error: 'Failed to get waivers' });
        }
    }

    // Helper method to generate waiver code
    generateWaiverCode(festivalName, year) {
        const festivalCode = festivalName.substring(0, 3).toUpperCase();
        const randomString = Math.random().toString(36).substring(2, 8).toUpperCase();
        return `${festivalCode}${year}${randomString}`;
    }

    // Helper method to get discount percentage based on award type
    getDiscountPercentage(awardType, waiverType) {
        const awardTypeMap = {
            'winner': 100,
            'first_place': 100,
            'best_film': 100,
            'finalist': 50,
            'runner_up': 75,
            'honorable_mention': 25,
            'official_selection': 25
        };

        if (waiverType === 'full_waiver') {
            return awardTypeMap[awardType.toLowerCase()] || 50;
        }

        return Math.min(awardTypeMap[awardType.toLowerCase()] || 25, 50);
    }
}

module.exports = new WaiverController();