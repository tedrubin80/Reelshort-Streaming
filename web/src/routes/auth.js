const express = require('express');
const AuthController = require('../controllers/authController');
const { authenticateToken, optionalAuth, createRateLimit } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validation');
const { body } = require('express-validator');

const router = express.Router();

// Validation rules
const registerValidation = [
    body('username')
        .isLength({ min: 3, max: 30 })
        .withMessage('Username must be between 3 and 30 characters')
        .matches(/^[a-zA-Z0-9_-]+$/)
        .withMessage('Username can only contain letters, numbers, underscores, and hyphens'),
    
    body('email')
        .isEmail()
        .withMessage('Please provide a valid email address')
        .normalizeEmail(),
    
    body('password')
        .isLength({ min: 8 })
        .withMessage('Password must be at least 8 characters long')
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
        .withMessage('Password must contain at least one lowercase letter, one uppercase letter, and one number'),
    
    body('displayName')
        .optional()
        .isLength({ min: 1, max: 100 })
        .withMessage('Display name must be between 1 and 100 characters')
];

const loginValidation = [
    body('email')
        .isEmail()
        .withMessage('Please provide a valid email address')
        .normalizeEmail(),
    
    body('password')
        .notEmpty()
        .withMessage('Password is required')
];

const changePasswordValidation = [
    body('currentPassword')
        .notEmpty()
        .withMessage('Current password is required'),
    
    body('newPassword')
        .isLength({ min: 8 })
        .withMessage('New password must be at least 8 characters long')
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
        .withMessage('New password must contain at least one lowercase letter, one uppercase letter, and one number')
];

const profileUpdateValidation = [
    body('displayName')
        .optional()
        .isLength({ min: 1, max: 100 })
        .withMessage('Display name must be between 1 and 100 characters'),
    
    body('bio')
        .optional()
        .isLength({ max: 500 })
        .withMessage('Bio must not exceed 500 characters')
];

// Rate limiting for auth endpoints
const authRateLimit = createRateLimit(15 * 60 * 1000, 5, 'Too many authentication attempts'); // 5 attempts per 15 minutes
const generalRateLimit = createRateLimit(60 * 1000, 10, 'Too many requests'); // 10 requests per minute

/**
 * @route POST /api/auth/register
 * @desc Register a new user
 * @access Public
 */
router.post('/register', 
    authRateLimit,
    validateRequest(registerValidation),
    AuthController.register
);

/**
 * @route POST /api/auth/login
 * @desc Login user
 * @access Public
 */
router.post('/login',
    authRateLimit,
    validateRequest(loginValidation),
    AuthController.login
);

/**
 * @route POST /api/auth/logout
 * @desc Logout user
 * @access Private
 */
router.post('/logout',
    authenticateToken,
    AuthController.logout
);

/**
 * @route POST /api/auth/refresh
 * @desc Refresh access token
 * @access Public
 */
router.post('/refresh',
    generalRateLimit,
    AuthController.refreshToken
);

/**
 * @route GET /api/auth/profile
 * @desc Get current user profile
 * @access Private
 */
router.get('/profile',
    authenticateToken,
    AuthController.getProfile
);

/**
 * @route PUT /api/auth/profile
 * @desc Update user profile
 * @access Private
 */
router.put('/profile',
    authenticateToken,
    generalRateLimit,
    validateRequest(profileUpdateValidation),
    AuthController.updateProfile
);

/**
 * @route PUT /api/auth/password
 * @desc Change user password
 * @access Private
 */
router.put('/password',
    authenticateToken,
    authRateLimit,
    validateRequest(changePasswordValidation),
    AuthController.changePassword
);

/**
 * @route GET /api/auth/verify-token
 * @desc Verify if token is valid (useful for frontend)
 * @access Private
 */
router.get('/verify-token',
    authenticateToken,
    (req, res) => {
        res.json({
            success: true,
            data: {
                user: req.user,
                valid: true
            }
        });
    }
);

/**
 * @route GET /api/auth/me
 * @desc Get current user info (optional auth)
 * @access Public/Private
 */
router.get('/me',
    optionalAuth,
    (req, res) => {
        if (!req.user) {
            return res.json({
                success: true,
                data: {
                    user: null,
                    authenticated: false
                }
            });
        }

        res.json({
            success: true,
            data: {
                user: req.user,
                authenticated: true
            }
        });
    }
);

module.exports = router;