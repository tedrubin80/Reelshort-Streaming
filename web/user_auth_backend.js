// ============================================
// USER AUTHENTICATION BACKEND IMPLEMENTATION
// ============================================

// backend/models/User.js - User model with PostgreSQL
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

class UserModel {
  constructor(dbPool) {
    this.db = dbPool;
  }

  // Create new user
  async createUser(userData) {
    const {
      username, email, password, firstName, lastName, 
      displayName, bio, dateOfBirth, location, website
    } = userData;

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);
    
    const query = `
      INSERT INTO users (
        username, email, password_hash, first_name, last_name,
        display_name, bio, date_of_birth, location, website,
        status, role
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING id, username, email, first_name, last_name, 
               display_name, role, status, created_at
    `;

    const values = [
      username, email, passwordHash, firstName, lastName,
      displayName, bio, dateOfBirth, location, website,
      'pending_verification', 'user'
    ];

    const result = await this.db.query(query, values);
    return result.rows[0];
  }

  // Find user by email or username
  async findByEmailOrUsername(identifier) {
    const query = `
      SELECT id, username, email, password_hash, first_name, last_name,
             display_name, avatar_url, role, status, email_verified,
             failed_login_attempts, account_locked_until, last_login,
             created_at, updated_at
      FROM users 
      WHERE (email = $1 OR username = $1) 
        AND deleted_at IS NULL
    `;
    
    const result = await this.db.query(query, [identifier]);
    return result.rows[0] || null;
  }

  // Find user by ID
  async findById(userId) {
    const query = `
      SELECT id, username, email, first_name, last_name, display_name,
             bio, avatar_url, cover_image_url, date_of_birth, location,
             website, role, status, email_verified, phone_verified,
             profile_public, email_notifications, push_notifications,
             last_login, login_count, created_at, updated_at
      FROM users 
      WHERE id = $1 AND deleted_at IS NULL
    `;
    
    const result = await this.db.query(query, [userId]);
    return result.rows[0] || null;
  }

  // Verify password
  async verifyPassword(password, hash) {
    return await bcrypt.compare(password, hash);
  }

  // Update login info
  async updateLoginInfo(userId, ipAddress, userAgent) {
    const query = `
      UPDATE users 
      SET 
        last_login = CURRENT_TIMESTAMP,
        login_count = login_count + 1,
        failed_login_attempts = 0,
        account_locked_until = NULL,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING last_login, login_count
    `;
    
    const result = await this.db.query(query, [userId]);
    
    // Log successful login
    await this.logActivity(userId, 'login_success', 'User logged in successfully', ipAddress, userAgent);
    
    return result.rows[0];
  }

  // Handle failed login
  async handleFailedLogin(userId, ipAddress, userAgent) {
    const query = `
      UPDATE users 
      SET 
        failed_login_attempts = failed_login_attempts + 1,
        last_failed_login = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING failed_login_attempts
    `;
    
    const result = await this.db.query(query, [userId]);
    const attempts = result.rows[0]?.failed_login_attempts || 0;
    
    // Lock account after 5 failed attempts
    if (attempts >= 5) {
      await this.lockAccount(userId, '30 minutes');
    }
    
    await this.logActivity(userId, 'login_failed', `Failed login attempt (${attempts}/5)`, ipAddress, userAgent, null, false);
    
    return attempts;
  }

  // Lock user account
  async lockAccount(userId, duration = '30 minutes') {
    const query = `
      UPDATE users 
      SET 
        account_locked_until = CURRENT_TIMESTAMP + INTERVAL '${duration}',
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING account_locked_until
    `;
    
    const result = await this.db.query(query, [userId]);
    await this.logActivity(userId, 'account_locked', `Account locked for ${duration}`);
    
    return result.rows[0];
  }

  // Check if account is locked
  async isAccountLocked(userId) {
    const query = `
      SELECT account_locked_until
      FROM users 
      WHERE id = $1
    `;
    
    const result = await this.db.query(query, [userId]);
    const lockUntil = result.rows[0]?.account_locked_until;
    
    return lockUntil && new Date(lockUntil) > new Date();
  }

  // Create user session
  async createSession(userId, tokenHash, refreshTokenHash, deviceInfo, ipAddress, userAgent, expiresAt) {
    const query = `
      INSERT INTO user_sessions (
        user_id, token_hash, refresh_token_hash, device_info,
        ip_address, user_agent, expires_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, created_at
    `;
    
    const values = [userId, tokenHash, refreshTokenHash, deviceInfo, ipAddress, userAgent, expiresAt];
    const result = await this.db.query(query, values);
    
    return result.rows[0];
  }

  // Find active session
  async findActiveSession(tokenHash) {
    const query = `
      SELECT s.*, u.username, u.role, u.status
      FROM user_sessions s
      JOIN users u ON s.user_id = u.id
      WHERE s.token_hash = $1 
        AND s.is_active = true 
        AND s.expires_at > CURRENT_TIMESTAMP
        AND u.deleted_at IS NULL
    `;
    
    const result = await this.db.query(query, [tokenHash]);
    return result.rows[0] || null;
  }

  // Update session activity
  async updateSessionActivity(sessionId, ipAddress = null) {
    const query = `
      UPDATE user_sessions 
      SET 
        last_activity = CURRENT_TIMESTAMP,
        ip_address = COALESCE($2, ip_address)
      WHERE id = $1
    `;
    
    await this.db.query(query, [sessionId, ipAddress]);
  }

  // Deactivate session
  async deactivateSession(tokenHash) {
    const query = `
      UPDATE user_sessions 
      SET is_active = false 
      WHERE token_hash = $1
    `;
    
    await this.db.query(query, [tokenHash]);
  }

  // Create email verification
  async createEmailVerification(userId, email, type = 'email') {
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    
    const query = `
      INSERT INTO email_verifications (
        user_id, email, token, verification_type, expires_at
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING id, token, expires_at
    `;
    
    const result = await this.db.query(query, [userId, email, token, type, expiresAt]);
    return result.rows[0];
  }

  // Verify email token
  async verifyEmailToken(token) {
    const query = `
      UPDATE email_verifications 
      SET 
        verified = true,
        verified_at = CURRENT_TIMESTAMP,
        attempts = attempts + 1
      WHERE token = $1 
        AND NOT verified 
        AND expires_at > CURRENT_TIMESTAMP
      RETURNING user_id, email, verification_type
    `;
    
    const result = await this.db.query(query, [token]);
    
    if (result.rows.length > 0) {
      const verification = result.rows[0];
      
      // Update user email verification status
      if (verification.verification_type === 'email') {
        await this.db.query(
          'UPDATE users SET email_verified = true, status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
          ['active', verification.user_id]
        );
      }
      
      return verification;
    }
    
    return null;
  }

  // Create password reset token
  async createPasswordResetToken(userId, ipAddress, userAgent) {
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    
    const query = `
      INSERT INTO password_reset_tokens (
        user_id, token, expires_at, ip_address, user_agent
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING id, token, expires_at
    `;
    
    const result = await this.db.query(query, [userId, token, expiresAt, ipAddress, userAgent]);
    await this.logActivity(userId, 'password_reset_requested', 'Password reset token created', ipAddress, userAgent);
    
    return result.rows[0];
  }

  // Use password reset token
  async usePasswordResetToken(token, newPassword, ipAddress, userAgent) {
    // Find valid token
    const tokenQuery = `
      SELECT user_id
      FROM password_reset_tokens 
      WHERE token = $1 
        AND NOT used 
        AND expires_at > CURRENT_TIMESTAMP
    `;
    
    const tokenResult = await this.db.query(tokenQuery, [token]);
    
    if (tokenResult.rows.length === 0) {
      return null;
    }
    
    const userId = tokenResult.rows[0].user_id;
    
    // Hash new password
    const passwordHash = await bcrypt.hash(newPassword, 12);
    
    // Update password and mark token as used
    await this.db.query('BEGIN');
    
    try {
      // Update user password
      await this.db.query(
        `UPDATE users 
         SET password_hash = $1, password_changed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP 
         WHERE id = $2`,
        [passwordHash, userId]
      );
      
      // Mark token as used
      await this.db.query(
        `UPDATE password_reset_tokens 
         SET used = true, used_at = CURRENT_TIMESTAMP 
         WHERE token = $1`,
        [token]
      );
      
      await this.db.query('COMMIT');
      
      await this.logActivity(userId, 'password_reset', 'Password reset successfully', ipAddress, userAgent);
      
      return { userId };
    } catch (error) {
      await this.db.query('ROLLBACK');
      throw error;
    }
  }

  // Update user profile
  async updateProfile(userId, updates) {
    const allowedFields = [
      'first_name', 'last_name', 'display_name', 'bio', 
      'location', 'website', 'avatar_url', 'cover_image_url',
      'profile_public', 'email_notifications', 'push_notifications'
    ];
    
    const setClause = [];
    const values = [];
    let paramCount = 1;
    
    Object.keys(updates).forEach(key => {
      if (allowedFields.includes(key) && updates[key] !== undefined) {
        setClause.push(`${key} = $${paramCount}`);
        values.push(updates[key]);
        paramCount++;
      }
    });
    
    if (setClause.length === 0) {
      throw new Error('No valid fields to update');
    }
    
    setClause.push('updated_at = CURRENT_TIMESTAMP');
    values.push(userId);
    
    const query = `
      UPDATE users 
      SET ${setClause.join(', ')}
      WHERE id = $${paramCount}
      RETURNING id, username, display_name, bio, avatar_url, updated_at
    `;
    
    const result = await this.db.query(query, values);
    return result.rows[0];
  }

  // Log user activity
  async logActivity(userId, activityType, description = null, ipAddress = null, userAgent = null, metadata = null, success = true) {
    const query = `
      INSERT INTO user_activity_log (
        user_id, activity_type, description, ip_address, 
        user_agent, metadata, success
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    `;
    
    await this.db.query(query, [userId, activityType, description, ipAddress, userAgent, metadata, success]);
  }

  // Get user statistics
  async getUserStats(userId) {
    const query = `SELECT get_user_stats($1) as stats`;
    const result = await this.db.query(query, [userId]);
    return result.rows[0]?.stats || {};
  }

  // Search users
  async searchUsers(searchTerm, limit = 20, offset = 0) {
    const query = `
      SELECT id, username, display_name, avatar_url, bio
      FROM users 
      WHERE to_tsvector('english', 
          COALESCE(username, '') || ' ' || 
          COALESCE(display_name, '') || ' ' || 
          COALESCE(first_name, '') || ' ' || 
          COALESCE(last_name, '')
      ) @@ plainto_tsquery('english', $1)
        AND status = 'active' 
        AND is_active = true 
        AND deleted_at IS NULL
        AND profile_public = true
      ORDER BY 
          ts_rank(to_tsvector('english', 
              COALESCE(username, '') || ' ' || 
              COALESCE(display_name, '')
          ), plainto_tsquery('english', $1)) DESC
      LIMIT $2 OFFSET $3
    `;
    
    const result = await this.db.query(query, [searchTerm, limit, offset]);
    return result.rows;
  }

  // Cleanup expired tokens
  async cleanupExpiredTokens() {
    const query = `SELECT cleanup_expired_tokens() as deleted_count`;
    const result = await this.db.query(query);
    return result.rows[0]?.deleted_count || 0;
  }
}

module.exports = UserModel;

// ============================================
// USER AUTHENTICATION ROUTES
// ============================================

// backend/routes/userAuth.js
const express = require('express');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const UserModel = require('../models/User');
const db = require('../config/database');
const { sendEmail } = require('../utils/email'); // You'll need to implement this
const router = express.Router();

// Initialize user model
const User = new UserModel(db.connection);

// Rate limiting
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts per window
  message: { error: 'Too many authentication attempts, please try again later.' }
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 registrations per hour per IP
  message: { error: 'Too many registration attempts, please try again later.' }
});

// Validation rules
const registerValidation = [
  body('username')
    .trim()
    .isLength({ min: 3, max: 50 })
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username must be 3-50 characters and contain only letters, numbers, and underscores'),
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
  body('password')
    .isLength({ min: 8 })
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must be at least 8 characters with uppercase, lowercase, and number'),
  body('firstName')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('First name must be less than 100 characters'),
  body('lastName')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Last name must be less than 100 characters')
];

const loginValidation = [
  body('identifier')
    .trim()
    .notEmpty()
    .withMessage('Username or email is required'),
  body('password')
    .notEmpty()
    .withMessage('Password is required')
];

// Helper functions
function generateTokens(payload) {
  const accessToken = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '15m' });
  const refreshToken = jwt.sign(payload, process.env.JWT_REFRESH_SECRET, { expiresIn: '7d' });
  return { accessToken, refreshToken };
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function getClientInfo(req) {
  return {
    ipAddress: req.ip || req.connection.remoteAddress,
    userAgent: req.get('User-Agent') || '',
    deviceInfo: {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      acceptLanguage: req.get('Accept-Language'),
      timestamp: new Date().toISOString()
    }
  };
}

// Register endpoint
router.post('/register', registerLimiter, registerValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { username, email, password, firstName, lastName, displayName, bio } = req.body;
    const { ipAddress, userAgent } = getClientInfo(req);

    // Check if user already exists
    const existingUser = await User.findByEmailOrUsername(email);
    if (existingUser) {
      return res.status(409).json({
        error: 'User already exists',
        code: 'USER_EXISTS'
      });
    }

    // Check username separately
    const existingUsername = await User.findByEmailOrUsername(username);
    if (existingUsername) {
      return res.status(409).json({
        error: 'Username already taken',
        code: 'USERNAME_TAKEN'
      });
    }

    // Create user
    const userData = {
      username,
      email,
      password,
      firstName,
      lastName,
      displayName: displayName || `${firstName} ${lastName}`.trim() || username,
      bio
    };

    const newUser = await User.createUser(userData);

    // Create email verification token
    const verification = await User.createEmailVerification(newUser.id, email, 'email');

    // Send verification email (implement this function)
    // await sendEmail({
    //   to: email,
    //   subject: 'Verify your email address',
    //   template: 'email-verification',
    //   data: {
    //     username: newUser.username,
    //     verificationUrl: `${process.env.FRONTEND_URL}/verify-email?token=${verification.token}`
    //   }
    // });

    await User.logActivity(newUser.id, 'user_registered', 'User account created', ipAddress, userAgent);

    res.status(201).json({
      success: true,
      message: 'Account created successfully. Please check your email to verify your account.',
      user: {
        id: newUser.id,
        username: newUser.username,
        email: newUser.email,
        status: newUser.status
      }
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      error: 'Registration failed',
      code: 'REGISTRATION_ERROR'
    });
  }
});

// Login endpoint
router.post('/login', authLimiter, loginValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { identifier, password, rememberMe = false } = req.body;
    const { ipAddress, userAgent, deviceInfo } = getClientInfo(req);

    // Find user
    const user = await User.findByEmailOrUsername(identifier);
    if (!user) {
      return res.status(401).json({
        error: 'Invalid credentials',
        code: 'INVALID_CREDENTIALS'
      });
    }

    // Check if account is locked
    const isLocked = await User.isAccountLocked(user.id);
    if (isLocked) {
      return res.status(423).json({
        error: 'Account is temporarily locked due to too many failed login attempts',
        code: 'ACCOUNT_LOCKED'
      });
    }

    // Verify password
    const isValidPassword = await User.verifyPassword(password, user.password_hash);
    if (!isValidPassword) {
      await User.handleFailedLogin(user.id, ipAddress, userAgent);
      return res.status(401).json({
        error: 'Invalid credentials',
        code: 'INVALID_CREDENTIALS'
      });
    }

    // Check if user is active
    if (user.status !== 'active') {
      return res.status(403).json({
        error: 'Account not activated. Please verify your email address.',
        code: 'ACCOUNT_NOT_ACTIVE'
      });
    }

    // Generate tokens
    const tokenPayload = {
      userId: user.id,
      username: user.username,
      role: user.role,
      type: 'access'
    };

    const { accessToken, refreshToken } = generateTokens(tokenPayload);
    
    // Hash tokens for storage
    const tokenHash = hashToken(accessToken);
    const refreshTokenHash = hashToken(refreshToken);
    
    // Create session
    const expiresAt = new Date(Date.now() + (rememberMe ? 7 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000));
    const session = await User.createSession(
      user.id, 
      tokenHash, 
      refreshTokenHash, 
      deviceInfo, 
      ipAddress, 
      userAgent, 
      expiresAt
    );

    // Update login info
    await User.updateLoginInfo(user.id, ipAddress, userAgent);

    res.json({
      success: true,
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        displayName: user.display_name,
        avatar: user.avatar_url,
        role: user.role,
        emailVerified: user.email_verified
      },
      expiresIn: rememberMe ? '7d' : '1d'
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      error: 'Login failed',
      code: 'LOGIN_ERROR'
    });
  }
});

// Email verification endpoint
router.post('/verify-email', async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        error: 'Verification token is required'
      });
    }

    const verification = await User.verifyEmailToken(token);
    
    if (!verification) {
      return res.status(400).json({
        error: 'Invalid or expired verification token',
        code: 'INVALID_TOKEN'
      });
    }

    res.json({
      success: true,
      message: 'Email verified successfully'
    });

  } catch (error) {
    console.error('Email verification error:', error);
    res.status(500).json({
      error: 'Email verification failed'
    });
  }
});

// Refresh token endpoint
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(401).json({
        error: 'Refresh token required'
      });
    }

    // Verify refresh token
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const tokenHash = hashToken(refreshToken);

    // Find active session
    const session = await User.findActiveSession(tokenHash);
    if (!session) {
      return res.status(401).json({
        error: 'Invalid refresh token'
      });
    }

    // Generate new tokens
    const tokenPayload = {
      userId: decoded.userId,
      username: decoded.username,
      role: decoded.role,
      type: 'access'
    };

    const { accessToken, refreshToken: newRefreshToken } = generateTokens(tokenPayload);

    // Update session with new token hashes
    const newTokenHash = hashToken(accessToken);
    const newRefreshTokenHash = hashToken(newRefreshToken);
    
    await User.db.query(
      'UPDATE user_sessions SET token_hash = $1, refresh_token_hash = $2 WHERE id = $3',
      [newTokenHash, newRefreshTokenHash, session.id]
    );

    res.json({
      success: true,
      accessToken,
      refreshToken: newRefreshToken
    });

  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(401).json({
      error: 'Token refresh failed'
    });
  }
});

// Logout endpoint
router.post('/logout', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const tokenHash = hashToken(token);
      
      await User.deactivateSession(tokenHash);
    }

    res.json({
      success: true,
      message: 'Logged out successfully'
    });

  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      error: 'Logout failed'
    });
  }
});

module.exports = router;

// ============================================
// USER AUTHENTICATION MIDDLEWARE
// ============================================

// backend/middleware/userAuth.js
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const UserModel = require('../models/User');
const db = require('../config/database');

const User = new UserModel(db.connection);

// Helper function to hash token
function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// Authenticate user middleware
const authenticateUser = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Access denied. Token required.',
        code: 'NO_TOKEN'
      });
    }

    const token = authHeader.substring(7);
    const tokenHash = hashToken(token);

    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Find active session
    const session = await User.findActiveSession(tokenHash);
    if (!session) {
      return res.status(401).json({
        error: 'Invalid or expired session',
        code: 'INVALID_SESSION'
      });
    }

    // Update session activity
    await User.updateSessionActivity(session.id, req.ip);

    // Attach user info to request
    req.user = {
      id: session.user_id,
      username: session.username,
      role: session.role,
      status: session.status,
      sessionId: session.id
    };

    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'Token expired',
        code: 'TOKEN_EXPIRED'
      });
    }

    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        error: 'Invalid token',
        code: 'INVALID_TOKEN'
      });
    }

    console.error('Authentication error:', error);
    res.status(500).json({
      error: 'Authentication failed'
    });
  }
};

// Optional user authentication (doesn't fail if no token)
const optionalUser = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const tokenHash = hashToken(token);

      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const session = await User.findActiveSession(tokenHash);
        
        if (session) {
          await User.updateSessionActivity(session.id, req.ip);
          req.user = {
            id: session.user_id,
            username: session.username,
            role: session.role,
            status: session.status,
            sessionId: session.id
          };
        }
      } catch (error) {
        // Silently fail for optional middleware
      }
    }

    next();
  } catch (error) {
    next();
  }
};

// Role-based authorization
const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required'
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'Insufficient permissions',
        required: roles,
        current: req.user.role
      });
    }

    next();
  };
};

module.exports = {
  authenticateUser,
  optionalUser,
  requireRole
};

// ============================================
// EXAMPLE INTEGRATION
// ============================================

/*
// In your main server.js file:

const userAuthRoutes = require('./routes/userAuth');
const { authenticateUser, optionalUser, requireRole } = require('./middleware/userAuth');

// User authentication routes
app.use('/api/auth', userAuthRoutes);

// Example protected routes
app.get('/api/user/profile', authenticateUser, async (req, res) => {
  const User = new UserModel(db.connection);
  const user = await User.findById(req.user.id);
  res.json({ user });
});

app.get('/api/videos', optionalUser, async (req, res) => {
  // Videos endpoint that works for both authenticated and non-authenticated users
  // req.user will be set if user is logged in, null otherwise
});

app.post('/api/admin/videos', authenticateUser, requireRole('admin', 'moderator'), (req, res) => {
  // Only admin and moderator can access this endpoint
});

// Environment variables needed:
JWT_SECRET=your-super-secret-jwt-key-for-access-tokens
JWT_REFRESH_SECRET=your-super-secret-jwt-key-for-refresh-tokens
*/