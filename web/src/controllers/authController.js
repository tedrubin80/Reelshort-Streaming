const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { cache } = require('../config/redis');

class AuthController {
    // Generate JWT token
    static generateToken(userId) {
        return jwt.sign(
            { userId },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
        );
    }

    // Generate refresh token
    static generateRefreshToken(userId) {
        return jwt.sign(
            { userId, type: 'refresh' },
            process.env.JWT_SECRET,
            { expiresIn: '30d' }
        );
    }

    // Register new user
    static async register(req, res) {
        try {
            const { username, email, password, displayName } = req.body;

            // Basic validation
            if (!username || !email || !password) {
                return res.status(400).json({
                    success: false,
                    message: 'Username, email, and password are required'
                });
            }

            // Password strength validation
            if (password.length < 8) {
                return res.status(400).json({
                    success: false,
                    message: 'Password must be at least 8 characters long'
                });
            }

            // Create user
            const user = await User.create({
                username: username.toLowerCase().trim(),
                email: email.toLowerCase().trim(),
                password,
                displayName
            });

            // Generate tokens
            const token = AuthController.generateToken(user.id);
            const refreshToken = AuthController.generateRefreshToken(user.id);

            // Cache user session
            await cache.set(`user_session:${user.id}`, {
                userId: user.id,
                username: user.username,
                email: user.email,
                loginTime: new Date().toISOString()
            }, 7 * 24 * 3600); // 7 days

            // Store refresh token in cache
            await cache.set(`refresh_token:${user.id}`, refreshToken, 30 * 24 * 3600); // 30 days

            res.status(201).json({
                success: true,
                message: 'User registered successfully',
                data: {
                    user: {
                        id: user.id,
                        username: user.username,
                        email: user.email,
                        displayName: user.display_name,
                        verified: user.verified,
                        createdAt: user.created_at
                    },
                    token,
                    refreshToken
                }
            });

        } catch (error) {
            console.error('Registration error:', error);
            
            if (error.message.includes('already exists')) {
                return res.status(409).json({
                    success: false,
                    message: error.message
                });
            }

            res.status(500).json({
                success: false,
                message: 'Registration failed',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }

    // Login user
    static async login(req, res) {
        try {
            const { email, password } = req.body;

            if (!email || !password) {
                return res.status(400).json({
                    success: false,
                    message: 'Email and password are required'
                });
            }

            // Find user by email
            const user = await User.findByEmail(email.toLowerCase().trim());
            if (!user) {
                return res.status(401).json({
                    success: false,
                    message: 'Invalid email or password'
                });
            }

            // Validate password
            const isValidPassword = await User.validatePassword(password, user.password_hash);
            if (!isValidPassword) {
                return res.status(401).json({
                    success: false,
                    message: 'Invalid email or password'
                });
            }

            // Update last login
            await User.updateLastLogin(user.id);

            // Generate tokens
            const token = AuthController.generateToken(user.id);
            const refreshToken = AuthController.generateRefreshToken(user.id);

            // Cache user session
            await cache.set(`user_session:${user.id}`, {
                userId: user.id,
                username: user.username,
                email: user.email,
                loginTime: new Date().toISOString()
            }, 7 * 24 * 3600); // 7 days

            // Store refresh token
            await cache.set(`refresh_token:${user.id}`, refreshToken, 30 * 24 * 3600); // 30 days

            res.json({
                success: true,
                message: 'Login successful',
                data: {
                    user: {
                        id: user.id,
                        username: user.username,
                        email: user.email,
                        displayName: user.display_name,
                        verified: user.verified,
                        avatarUrl: user.avatar_url,
                        bio: user.bio,
                        role: user.role || 'user'
                    },
                    token,
                    refreshToken
                }
            });

        } catch (error) {
            console.error('Login error:', error);
            res.status(500).json({
                success: false,
                message: 'Login failed',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }

    // Logout user
    static async logout(req, res) {
        try {
            const userId = req.user.id;

            // Remove user session from cache
            await cache.del(`user_session:${userId}`);
            await cache.del(`refresh_token:${userId}`);

            res.json({
                success: true,
                message: 'Logout successful'
            });

        } catch (error) {
            console.error('Logout error:', error);
            res.status(500).json({
                success: false,
                message: 'Logout failed'
            });
        }
    }

    // Refresh token
    static async refreshToken(req, res) {
        try {
            const { refreshToken } = req.body;

            if (!refreshToken) {
                return res.status(400).json({
                    success: false,
                    message: 'Refresh token is required'
                });
            }

            // Verify refresh token
            const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);
            
            if (decoded.type !== 'refresh') {
                return res.status(401).json({
                    success: false,
                    message: 'Invalid token type'
                });
            }

            // Check if refresh token exists in cache
            const cachedToken = await cache.get(`refresh_token:${decoded.userId}`);
            if (cachedToken !== refreshToken) {
                return res.status(401).json({
                    success: false,
                    message: 'Invalid or expired refresh token'
                });
            }

            // Get user
            const user = await User.findById(decoded.userId);
            if (!user) {
                return res.status(401).json({
                    success: false,
                    message: 'User not found'
                });
            }

            // Generate new tokens
            const newToken = AuthController.generateToken(user.id);
            const newRefreshToken = AuthController.generateRefreshToken(user.id);

            // Update refresh token in cache
            await cache.set(`refresh_token:${user.id}`, newRefreshToken, 30 * 24 * 3600);

            res.json({
                success: true,
                message: 'Token refreshed successfully',
                data: {
                    token: newToken,
                    refreshToken: newRefreshToken
                }
            });

        } catch (error) {
            console.error('Token refresh error:', error);
            res.status(401).json({
                success: false,
                message: 'Invalid or expired refresh token'
            });
        }
    }

    // Get current user profile
    static async getProfile(req, res) {
        try {
            const user = await User.findById(req.user.id);
            
            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: 'User not found'
                });
            }

            res.json({
                success: true,
                data: {
                    user: {
                        id: user.id,
                        username: user.username,
                        email: user.email,
                        displayName: user.display_name,
                        bio: user.bio,
                        avatarUrl: user.avatar_url,
                        verified: user.verified,
                        subscriberCount: user.subscriber_count,
                        totalViews: user.total_views,
                        createdAt: user.created_at,
                        channelId: user.channel_id,
                        channelName: user.channel_name
                    }
                }
            });

        } catch (error) {
            console.error('Get profile error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to get user profile'
            });
        }
    }

    // Update user profile
    static async updateProfile(req, res) {
        try {
            const { displayName, bio } = req.body;
            const updates = {};

            if (displayName !== undefined) updates.display_name = displayName;
            if (bio !== undefined) updates.bio = bio;

            const updatedUser = await User.updateProfile(req.user.id, updates);

            // Update cached session
            const cachedSession = await cache.get(`user_session:${req.user.id}`);
            if (cachedSession) {
                cachedSession.displayName = updatedUser.display_name;
                await cache.set(`user_session:${req.user.id}`, cachedSession, 7 * 24 * 3600);
            }

            res.json({
                success: true,
                message: 'Profile updated successfully',
                data: {
                    user: {
                        id: updatedUser.id,
                        username: updatedUser.username,
                        email: updatedUser.email,
                        displayName: updatedUser.display_name,
                        bio: updatedUser.bio,
                        avatarUrl: updatedUser.avatar_url,
                        verified: updatedUser.verified,
                        createdAt: updatedUser.created_at,
                        updatedAt: updatedUser.updated_at
                    }
                }
            });

        } catch (error) {
            console.error('Update profile error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to update profile',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }

    // Change password
    static async changePassword(req, res) {
        try {
            const { currentPassword, newPassword } = req.body;

            if (!currentPassword || !newPassword) {
                return res.status(400).json({
                    success: false,
                    message: 'Current password and new password are required'
                });
            }

            if (newPassword.length < 8) {
                return res.status(400).json({
                    success: false,
                    message: 'New password must be at least 8 characters long'
                });
            }

            await User.changePassword(req.user.id, currentPassword, newPassword);

            res.json({
                success: true,
                message: 'Password changed successfully'
            });

        } catch (error) {
            console.error('Change password error:', error);
            
            if (error.message.includes('incorrect')) {
                return res.status(400).json({
                    success: false,
                    message: error.message
                });
            }

            res.status(500).json({
                success: false,
                message: 'Failed to change password'
            });
        }
    }
}

module.exports = AuthController;