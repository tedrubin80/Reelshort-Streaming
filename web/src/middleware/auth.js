const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { cache } = require('../config/redis');

// Verify JWT token
const authenticateToken = async (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

        if (!token) {
            return res.status(401).json({ 
                error: 'Access token required',
                message: 'Please provide a valid access token'
            });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Check if user session exists in cache first
        const cachedSession = await cache.get(`user_session:${decoded.userId}`);
        if (!cachedSession) {
            return res.status(401).json({
                error: 'Session expired',
                message: 'Your session has expired. Please log in again.'
            });
        }

        // Get user from database to ensure user still exists and is active
        const user = await User.findById(decoded.userId);
        if (!user) {
            return res.status(401).json({ 
                error: 'Invalid token',
                message: 'User not found'
            });
        }

        req.user = {
            id: user.id,
            username: user.username,
            email: user.email,
            displayName: user.display_name,
            verified: user.verified,
            isAdmin: user.is_admin || false
        };

        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ 
                error: 'Token expired',
                message: 'Your session has expired. Please log in again.'
            });
        } else if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ 
                error: 'Invalid token',
                message: 'The provided token is invalid'
            });
        }
        
        console.error('Authentication error:', error);
        res.status(500).json({ 
            error: 'Authentication failed',
            message: 'An error occurred during authentication'
        });
    }
};

// Require admin privileges
const requireAdmin = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ 
            error: 'Authentication required',
            message: 'Please log in to access this resource'
        });
    }

    if (!req.user.isAdmin) {
        return res.status(403).json({ 
            error: 'Admin access required',
            message: 'You need administrator privileges to access this resource'
        });
    }

    next();
};

// Require verified user
const requireVerified = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ 
            error: 'Authentication required',
            message: 'Please log in to access this resource'
        });
    }

    if (!req.user.verified) {
        return res.status(403).json({ 
            error: 'Account verification required',
            message: 'Please verify your account to access this feature'
        });
    }

    next();
};

// Optional authentication (doesn't fail if no token)
const optionalAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        if (token) {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            
            const userResult = await query(
                'SELECT id, username, email, display_name, verified, is_admin FROM users WHERE id = $1',
                [decoded.userId]
            );

            if (userResult.rows.length > 0) {
                req.user = {
                    id: decoded.userId,
                    username: userResult.rows[0].username,
                    email: userResult.rows[0].email,
                    displayName: userResult.rows[0].display_name,
                    verified: userResult.rows[0].verified,
                    isAdmin: userResult.rows[0].is_admin
                };
            }
        }

        next();
    } catch (error) {
        // Don't fail for optional auth, just continue without user
        next();
    }
};

// Check if user owns resource
const checkResourceOwnership = (resourceType) => {
    return async (req, res, next) => {
        try {
            const userId = req.user.id;
            const resourceId = req.params.id || req.params.filmId || req.params.videoId;

            if (!resourceId) {
                return res.status(400).json({ 
                    error: 'Resource ID required' 
                });
            }

            let ownershipQuery;
            let queryParams = [resourceId, userId];

            switch (resourceType) {
                case 'video':
                case 'film':
                    ownershipQuery = `
                        SELECT v.id FROM videos v
                        JOIN channels c ON v.channel_id = c.id
                        WHERE v.id = $1 AND c.user_id = $2
                    `;
                    break;
                case 'channel':
                    ownershipQuery = `
                        SELECT id FROM channels 
                        WHERE id = $1 AND user_id = $2
                    `;
                    break;
                case 'playlist':
                    ownershipQuery = `
                        SELECT id FROM playlists 
                        WHERE id = $1 AND user_id = $2
                    `;
                    break;
                default:
                    return res.status(400).json({ 
                        error: 'Invalid resource type' 
                    });
            }

            const result = await query(ownershipQuery, queryParams);

            if (result.rows.length === 0) {
                return res.status(404).json({ 
                    error: 'Resource not found or access denied',
                    message: `You don't have permission to access this ${resourceType}`
                });
            }

            next();
        } catch (error) {
            console.error('Resource ownership check error:', error);
            res.status(500).json({ 
                error: 'Failed to verify resource ownership' 
            });
        }
    };
};

// Rate limiting middleware
const createRateLimit = (windowMs, maxRequests, message) => {
    return async (req, res, next) => {
        try {
            const identifier = req.user ? req.user.id : req.ip;
            const routePath = req.route ? req.route.path : req.path;
            const key = `rate_limit:${routePath}:${identifier}`;
            
            const current = await cache.get(key) || 0;
            
            if (current >= maxRequests) {
                return res.status(429).json({
                    success: false,
                    error: 'Rate limit exceeded',
                    message: message || 'Too many requests. Please try again later.',
                    retryAfter: Math.ceil(windowMs / 1000)
                });
            }
            
            await cache.incr(key);
            if (current === 0) {
                await cache.set(key, 1, Math.ceil(windowMs / 1000));
            }
            
            next();
        } catch (error) {
            console.error('Rate limiting error:', error);
            // Don't fail the request if rate limiting fails
            next();
        }
    };
};

// Premium subscription check
const requirePremium = async (req, res, next) => {
    try {
        if (!req.user) {
            return res.status(401).json({ 
                error: 'Authentication required' 
            });
        }

        // Check if user has active premium subscription
        const subscriptionResult = await query(`
            SELECT us.*, sp.name as plan_name 
            FROM user_subscriptions us
            JOIN subscription_plans sp ON us.plan_id = sp.id
            WHERE us.user_id = $1 AND us.status = 'active' AND us.expires_at > NOW()
            ORDER BY us.expires_at DESC
            LIMIT 1
        `, [req.user.id]);

        if (subscriptionResult.rows.length === 0) {
            return res.status(403).json({
                error: 'Premium subscription required',
                message: 'This feature requires an active premium subscription',
                upgradeUrl: '/account/subscription'
            });
        }

        req.user.subscription = subscriptionResult.rows[0];
        next();
    } catch (error) {
        console.error('Premium check error:', error);
        res.status(500).json({ 
            error: 'Failed to verify subscription status' 
        });
    }
};

module.exports = {
    authenticateToken,
    requireAdmin,
    requireVerified,
    optionalAuth,
    checkResourceOwnership,
    createRateLimit,
    requirePremium
};