const validator = require('validator');

// Sanitize input to prevent XSS
function sanitizeInput(input) {
    if (typeof input !== 'string') return input;
    return validator.escape(input.trim());
}

// Validate film upload data
function validateFilm(data) {
    const errors = [];
    const sanitized = {};

    // Title validation
    if (!data.title || data.title.length < 1) {
        errors.push('Title is required');
    } else if (data.title.length > 255) {
        errors.push('Title must be less than 255 characters');
    } else {
        sanitized.title = data.title;
    }

    // Description validation
    if (data.description && data.description.length > 5000) {
        errors.push('Description must be less than 5000 characters');
    } else {
        sanitized.description = data.description || '';
    }

    // Category validation
    if (!data.category_id || !validator.isUUID(data.category_id)) {
        errors.push('Valid category is required');
    } else {
        sanitized.category_id = data.category_id;
    }

    // Tags validation
    if (data.tags && Array.isArray(data.tags)) {
        const validTags = data.tags
            .filter(tag => typeof tag === 'string' && tag.length > 0 && tag.length <= 50)
            .slice(0, 10); // Maximum 10 tags
        sanitized.tags = validTags;
    } else {
        sanitized.tags = [];
    }

    // Cast validation
    if (data.cast && data.cast.length > 1000) {
        errors.push('Cast information must be less than 1000 characters');
    } else {
        sanitized.cast = data.cast || '';
    }

    // Crew validation
    if (data.crew && data.crew.length > 1000) {
        errors.push('Crew information must be less than 1000 characters');
    } else {
        sanitized.crew = data.crew || '';
    }

    // Production year validation
    const currentYear = new Date().getFullYear();
    if (data.production_year) {
        if (!Number.isInteger(data.production_year) || 
            data.production_year < 1900 || 
            data.production_year > currentYear + 1) {
            errors.push(`Production year must be between 1900 and ${currentYear + 1}`);
        } else {
            sanitized.production_year = data.production_year;
        }
    }

    return {
        isValid: errors.length === 0,
        errors,
        data: sanitized
    };
}

// Validate user registration
function validateUserRegistration(data) {
    const errors = [];
    const sanitized = {};

    // Username validation
    if (!data.username || data.username.length < 3) {
        errors.push('Username must be at least 3 characters long');
    } else if (data.username.length > 50) {
        errors.push('Username must be less than 50 characters');
    } else if (!/^[a-zA-Z0-9_-]+$/.test(data.username)) {
        errors.push('Username can only contain letters, numbers, underscores, and hyphens');
    } else {
        sanitized.username = data.username.toLowerCase();
    }

    // Email validation
    if (!data.email || !validator.isEmail(data.email)) {
        errors.push('Valid email address is required');
    } else {
        sanitized.email = data.email.toLowerCase();
    }

    // Password validation
    if (!data.password || data.password.length < 8) {
        errors.push('Password must be at least 8 characters long');
    } else if (data.password.length > 128) {
        errors.push('Password must be less than 128 characters');
    } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(data.password)) {
        errors.push('Password must contain at least one lowercase letter, one uppercase letter, and one number');
    } else {
        sanitized.password = data.password;
    }

    // Display name validation
    if (data.display_name) {
        if (data.display_name.length > 100) {
            errors.push('Display name must be less than 100 characters');
        } else {
            sanitized.display_name = sanitizeInput(data.display_name);
        }
    }

    return {
        isValid: errors.length === 0,
        errors,
        data: sanitized
    };
}

// Validate channel creation
function validateChannel(data) {
    const errors = [];
    const sanitized = {};

    // Channel name validation
    if (!data.name || data.name.length < 1) {
        errors.push('Channel name is required');
    } else if (data.name.length > 100) {
        errors.push('Channel name must be less than 100 characters');
    } else {
        sanitized.name = sanitizeInput(data.name);
    }

    // Description validation
    if (data.description && data.description.length > 2000) {
        errors.push('Channel description must be less than 2000 characters');
    } else {
        sanitized.description = sanitizeInput(data.description || '');
    }

    return {
        isValid: errors.length === 0,
        errors,
        data: sanitized
    };
}

// Validate comment
function validateComment(data) {
    const errors = [];
    const sanitized = {};

    // Content validation
    if (!data.content || data.content.trim().length < 1) {
        errors.push('Comment content is required');
    } else if (data.content.length > 2000) {
        errors.push('Comment must be less than 2000 characters');
    } else {
        sanitized.content = sanitizeInput(data.content);
    }

    // Parent ID validation (for replies)
    if (data.parent_id) {
        if (!validator.isUUID(data.parent_id)) {
            errors.push('Invalid parent comment ID');
        } else {
            sanitized.parent_id = data.parent_id;
        }
    }

    return {
        isValid: errors.length === 0,
        errors,
        data: sanitized
    };
}

// Validate search parameters
function validateSearchParams(data) {
    const sanitized = {
        query: '',
        category: null,
        sortBy: 'relevance',
        duration: null,
        page: 1,
        limit: 20
    };

    // Search query
    if (data.query && typeof data.query === 'string') {
        sanitized.query = sanitizeInput(data.query).substring(0, 100);
    }

    // Category filter
    if (data.category && validator.isUUID(data.category)) {
        sanitized.category = data.category;
    }

    // Sort by
    const validSortOptions = ['relevance', 'views', 'recent', 'rating', 'duration'];
    if (data.sortBy && validSortOptions.includes(data.sortBy)) {
        sanitized.sortBy = data.sortBy;
    }

    // Duration filter
    const validDurations = ['short', 'medium', 'long']; // <10min, 10-20min, 20-30min
    if (data.duration && validDurations.includes(data.duration)) {
        sanitized.duration = data.duration;
    }

    // Pagination
    if (data.page && Number.isInteger(Number(data.page)) && Number(data.page) > 0) {
        sanitized.page = Math.min(Number(data.page), 1000); // Max 1000 pages
    }

    if (data.limit && Number.isInteger(Number(data.limit)) && Number(data.limit) > 0) {
        sanitized.limit = Math.min(Number(data.limit), 100); // Max 100 results per page
    }

    return sanitized;
}

// Validate playlist creation
function validatePlaylist(data) {
    const errors = [];
    const sanitized = {};

    // Title validation
    if (!data.title || data.title.length < 1) {
        errors.push('Playlist title is required');
    } else if (data.title.length > 255) {
        errors.push('Playlist title must be less than 255 characters');
    } else {
        sanitized.title = sanitizeInput(data.title);
    }

    // Description validation
    if (data.description && data.description.length > 1000) {
        errors.push('Playlist description must be less than 1000 characters');
    } else {
        sanitized.description = sanitizeInput(data.description || '');
    }

    // Privacy validation
    sanitized.is_private = Boolean(data.is_private);

    return {
        isValid: errors.length === 0,
        errors,
        data: sanitized
    };
}

// Rate limiting helpers
function createRateLimitKey(type, identifier) {
    return `rate_limit:${type}:${identifier}`;
}

function createUploadLimitKey(userId, date) {
    return `upload_limit:${userId}:${date}`;
}

module.exports = {
    sanitizeInput,
    validateFilm,
    validateUserRegistration,
    validateChannel,
    validateComment,
    validateSearchParams,
    validatePlaylist,
    createRateLimitKey,
    createUploadLimitKey
};