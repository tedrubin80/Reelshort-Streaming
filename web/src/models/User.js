const { query, transaction } = require('../config/database');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

class User {
    static async create({ username, email, password, displayName = null }) {
        return transaction(async (client) => {
            // Check if user already exists
            const existingUser = await client.query(
                'SELECT id FROM users WHERE email = $1 OR username = $2',
                [email, username]
            );

            if (existingUser.rows.length > 0) {
                throw new Error('User with this email or username already exists');
            }

            // Hash password
            const saltRounds = 12;
            const passwordHash = await bcrypt.hash(password, saltRounds);

            // Create user
            const result = await client.query(`
                INSERT INTO users (username, email, password_hash, display_name)
                VALUES ($1, $2, $3, $4)
                RETURNING id, username, email, display_name, verified, created_at
            `, [username, email, passwordHash, displayName || username]);

            // Create default channel for user
            await client.query(`
                INSERT INTO channels (user_id, name, description, is_active)
                VALUES ($1, $2, $3, true)
            `, [result.rows[0].id, `${username}'s Channel`, `Welcome to ${username}'s channel`]);

            return result.rows[0];
        });
    }

    static async findByEmail(email) {
        const result = await query(
            'SELECT * FROM users WHERE email = $1',
            [email]
        );
        return result.rows[0] || null;
    }

    static async findByUsername(username) {
        const result = await query(
            'SELECT * FROM users WHERE username = $1',
            [username]
        );
        return result.rows[0] || null;
    }

    static async findById(id) {
        const result = await query(`
            SELECT u.*, c.id as channel_id, c.name as channel_name
            FROM users u
            LEFT JOIN channels c ON u.id = c.user_id AND c.is_active = true
            WHERE u.id = $1
        `, [id]);
        return result.rows[0] || null;
    }

    static async validatePassword(plainPassword, hashedPassword) {
        return bcrypt.compare(plainPassword, hashedPassword);
    }

    static async updateLastLogin(userId) {
        await query(
            'UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = $1',
            [userId]
        );
    }

    static async updateProfile(userId, updates) {
        const allowedFields = ['display_name', 'bio', 'avatar_url'];
        const fields = [];
        const values = [];
        let paramIndex = 1;

        for (const [key, value] of Object.entries(updates)) {
            if (allowedFields.includes(key) && value !== undefined) {
                fields.push(`${key} = $${paramIndex}`);
                values.push(value);
                paramIndex++;
            }
        }

        if (fields.length === 0) {
            throw new Error('No valid fields to update');
        }

        values.push(userId);
        const result = await query(`
            UPDATE users 
            SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP
            WHERE id = $${paramIndex}
            RETURNING id, username, email, display_name, bio, avatar_url, verified, created_at, updated_at
        `, values);

        return result.rows[0];
    }

    static async changePassword(userId, currentPassword, newPassword) {
        return transaction(async (client) => {
            // Get current password hash
            const user = await client.query(
                'SELECT password_hash FROM users WHERE id = $1',
                [userId]
            );

            if (!user.rows[0]) {
                throw new Error('User not found');
            }

            // Validate current password
            const isValid = await bcrypt.compare(currentPassword, user.rows[0].password_hash);
            if (!isValid) {
                throw new Error('Current password is incorrect');
            }

            // Hash new password
            const saltRounds = 12;
            const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

            // Update password
            await client.query(
                'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
                [newPasswordHash, userId]
            );

            return true;
        });
    }

    static async deleteAccount(userId) {
        return transaction(async (client) => {
            // Soft delete - mark user as inactive and anonymize data
            await client.query(`
                UPDATE users 
                SET 
                    email = $1,
                    username = $2,
                    display_name = 'Deleted User',
                    bio = null,
                    avatar_url = null,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $3
            `, [`deleted_${userId}@deleted.com`, `deleted_${userId}`, userId]);

            // Deactivate channels
            await client.query(
                'UPDATE channels SET is_active = false WHERE user_id = $1',
                [userId]
            );

            return true;
        });
    }

    static async getPublicProfile(userId) {
        const result = await query(`
            SELECT 
                u.id,
                u.username,
                u.display_name,
                u.bio,
                u.avatar_url,
                u.verified,
                u.subscriber_count,
                u.total_views,
                u.created_at,
                c.id as channel_id,
                c.name as channel_name,
                c.description as channel_description,
                c.banner_url as channel_banner_url,
                c.subscriber_count as channel_subscribers,
                c.total_views as channel_views
            FROM users u
            LEFT JOIN channels c ON u.id = c.user_id AND c.is_active = true
            WHERE u.id = $1
        `, [userId]);

        return result.rows[0] || null;
    }

    static async searchUsers(searchTerm, limit = 20, offset = 0) {
        const result = await query(`
            SELECT 
                u.id,
                u.username,
                u.display_name,
                u.avatar_url,
                u.verified,
                u.subscriber_count,
                c.name as channel_name
            FROM users u
            LEFT JOIN channels c ON u.id = c.user_id AND c.is_active = true
            WHERE 
                u.username ILIKE $1 
                OR u.display_name ILIKE $1
            ORDER BY u.subscriber_count DESC, u.username ASC
            LIMIT $2 OFFSET $3
        `, [`%${searchTerm}%`, limit, offset]);

        return result.rows;
    }
}

module.exports = User;