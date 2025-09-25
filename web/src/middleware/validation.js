const { body, validationResult } = require('express-validator');

const validateRequest = (validations) => {
    return async (req, res, next) => {
        // If validations is a function (single middleware), execute it
        if (typeof validations === 'function') {
            return validations(req, res, next);
        }
        
        // If validations is an array, run all validations
        if (Array.isArray(validations)) {
            await Promise.all(validations.map(validation => validation.run(req)));
        }

        const errors = validationResult(req);
        if (errors.isEmpty()) {
            return next();
        }

        const errorMessages = errors.array().map(error => ({
            field: error.path || error.param,
            message: error.msg,
            value: error.value
        }));

        return res.status(400).json({
            success: false,
            message: 'Validation failed',
            errors: errorMessages
        });
    };
};

const filmUploadValidation = [
    body('title')
        .notEmpty()
        .withMessage('Film title is required')
        .isLength({ min: 1, max: 255 })
        .withMessage('Title must be between 1 and 255 characters'),
    
    body('description')
        .optional()
        .isLength({ max: 2000 })
        .withMessage('Description must not exceed 2000 characters'),
    
    body('category')
        .optional()
        .isUUID()
        .withMessage('Category must be a valid UUID'),
    
    body('tags')
        .optional()
        .isArray()
        .withMessage('Tags must be an array'),
    
    body('isPrivate')
        .optional()
        .isBoolean()
        .withMessage('isPrivate must be a boolean')
];

const waiverValidation = [
    body('firstName')
        .notEmpty()
        .withMessage('First name is required')
        .isLength({ min: 1, max: 100 })
        .withMessage('First name must be between 1 and 100 characters'),
    
    body('lastName')
        .notEmpty()
        .withMessage('Last name is required')
        .isLength({ min: 1, max: 100 })
        .withMessage('Last name must be between 1 and 100 characters'),
    
    body('email')
        .isEmail()
        .withMessage('Valid email is required')
        .normalizeEmail(),
    
    body('phone')
        .optional()
        .isMobilePhone()
        .withMessage('Valid phone number required'),
    
    body('dateOfBirth')
        .isISO8601()
        .withMessage('Valid date of birth is required'),
    
    body('parentName')
        .if(body('isMinor').equals(true))
        .notEmpty()
        .withMessage('Parent name is required for minors'),
    
    body('parentEmail')
        .if(body('isMinor').equals(true))
        .isEmail()
        .withMessage('Valid parent email is required for minors')
];

module.exports = {
    validateRequest,
    filmUploadValidation,
    waiverValidation
};