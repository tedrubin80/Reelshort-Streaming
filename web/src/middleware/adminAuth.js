const pool = require('../config/database');

/**
 * Middleware to check if user is an admin or moderator
 * Must be used after the auth middleware
 */
const requireAdmin = async (req, res, next) => {
    try {
        if (!req.user || !req.user.id) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        // Get user role from database
        const result = await pool.query(
            'SELECT role, is_banned FROM users WHERE id = $1',
            [req.user.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const user = result.rows[0];

        // Check if user is banned
        if (user.is_banned) {
            return res.status(403).json({ error: 'Account is banned' });
        }

        // Check if user is admin or moderator
        if (user.role !== 'admin' && user.role !== 'moderator') {
            return res.status(403).json({ error: 'Admin or moderator access required' });
        }

        // Add role to request object
        req.user.role = user.role;
        next();
    } catch (error) {
        console.error('Admin auth middleware error:', error);
        res.status(500).json({ error: 'Server error during authorization check' });
    }
};

/**
 * Middleware to check if user is strictly an admin (not just moderator)
 */
const requireStrictAdmin = async (req, res, next) => {
    try {
        if (!req.user || !req.user.id) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const result = await pool.query(
            'SELECT role, is_banned FROM users WHERE id = $1',
            [req.user.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const user = result.rows[0];

        if (user.is_banned) {
            return res.status(403).json({ error: 'Account is banned' });
        }

        if (user.role !== 'admin') {
            return res.status(403).json({ error: 'Admin access required' });
        }

        req.user.role = user.role;
        next();
    } catch (error) {
        console.error('Strict admin auth middleware error:', error);
        res.status(500).json({ error: 'Server error during authorization check' });
    }
};

/**
 * Log admin activity
 */
const logAdminActivity = async (adminId, actionType, targetType, targetId, details = {}, ipAddress = null) => {
    try {
        await pool.query(
            `INSERT INTO admin_activity_log
             (admin_id, action_type, target_type, target_id, details, ip_address)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [adminId, actionType, targetType, targetId, JSON.stringify(details), ipAddress]
        );
    } catch (error) {
        console.error('Error logging admin activity:', error);
        // Don't throw error - logging failure shouldn't block admin actions
    }
};

module.exports = {
    requireAdmin,
    requireStrictAdmin,
    logAdminActivity
};
