// ============================================
// BACKEND - Enhanced Admin Authentication
// ============================================

// backend/middleware/auth.js
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');

// Rate limiting for login attempts
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per windowMs
  message: {
    error: 'Too many login attempts, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Admin authentication middleware
const authenticateAdmin = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ 
      error: 'Access denied. No token provided.',
      code: 'NO_TOKEN'
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    if (decoded.role !== 'admin') {
      return res.status(403).json({ 
        error: 'Access denied. Admin privileges required.',
        code: 'INSUFFICIENT_PRIVILEGES'
      });
    }
    
    // Check token expiration
    if (decoded.exp < Date.now() / 1000) {
      return res.status(401).json({ 
        error: 'Token expired. Please login again.',
        code: 'TOKEN_EXPIRED'
      });
    }
    
    req.user = decoded;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        error: 'Token expired. Please login again.',
        code: 'TOKEN_EXPIRED'
      });
    }
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        error: 'Invalid token.',
        code: 'INVALID_TOKEN'
      });
    }
    
    res.status(400).json({ 
      error: 'Token validation failed.',
      code: 'TOKEN_VALIDATION_FAILED'
    });
  }
};

// Optional admin middleware (doesn't fail if no token)
const optionalAdmin = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  
  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      if (decoded.role === 'admin' && decoded.exp >= Date.now() / 1000) {
        req.user = decoded;
      }
    } catch (error) {
      // Silently fail for optional middleware
    }
  }
  
  next();
};

module.exports = {
  authenticateAdmin,
  optionalAdmin,
  loginLimiter
};

// backend/routes/auth.js
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { loginLimiter, authenticateAdmin } = require('../middleware/auth');
const db = require('../config/database');
const router = express.Router();

// Validation rules
const loginValidation = [
  body('username')
    .trim()
    .isLength({ min: 3, max: 50 })
    .withMessage('Username must be between 3 and 50 characters')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username can only contain letters, numbers, and underscores'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long')
];

// Admin login endpoint
router.post('/login', loginLimiter, loginValidation, async (req, res) => {
  try {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array(),
        code: 'VALIDATION_ERROR'
      });
    }

    const { username, password, rememberMe = false } = req.body;

    // For initial setup, use environment variables
    // Later this can be moved to database with proper user management
    const validUsername = process.env.ADMIN_USERNAME;
    const validPassword = process.env.ADMIN_PASSWORD;

    if (!validUsername || !validPassword) {
      return res.status(500).json({
        error: 'Admin credentials not configured',
        code: 'ADMIN_NOT_CONFIGURED'
      });
    }

    // Verify credentials
    if (username !== validUsername) {
      return res.status(401).json({
        error: 'Invalid username or password',
        code: 'INVALID_CREDENTIALS'
      });
    }

    // For environment-based auth, do direct comparison
    // In production with database, use bcrypt.compare()
    let passwordValid = false;
    
    if (validPassword.startsWith('$2a$') || validPassword.startsWith('$2b$')) {
      // Password is already hashed
      passwordValid = await bcrypt.compare(password, validPassword);
    } else {
      // Plain text password (development only)
      passwordValid = password === validPassword;
    }

    if (!passwordValid) {
      return res.status(401).json({
        error: 'Invalid username or password',
        code: 'INVALID_CREDENTIALS'
      });
    }

    // Generate JWT token
    const tokenExpiry = rememberMe ? '30d' : '24h';
    const token = jwt.sign(
      { 
        username,
        role: 'admin',
        loginTime: new Date().toISOString(),
        rememberMe
      },
      process.env.JWT_SECRET,
      { expiresIn: tokenExpiry }
    );

    // Log successful login (optional)
    console.log(`Admin login successful: ${username} at ${new Date().toISOString()}`);

    // Send response
    res.json({
      success: true,
      token,
      user: {
        username,
        role: 'admin',
        loginTime: new Date().toISOString()
      },
      expiresIn: tokenExpiry,
      message: 'Login successful'
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
});

// Token validation endpoint
router.post('/validate', async (req, res) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({
      valid: false,
      error: 'No token provided',
      code: 'NO_TOKEN'
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    if (decoded.role !== 'admin') {
      return res.status(403).json({
        valid: false,
        error: 'Insufficient privileges',
        code: 'INSUFFICIENT_PRIVILEGES'
      });
    }

    res.json({
      valid: true,
      user: {
        username: decoded.username,
        role: decoded.role,
        loginTime: decoded.loginTime
      },
      expiresAt: new Date(decoded.exp * 1000).toISOString()
    });

  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        valid: false,
        error: 'Token expired',
        code: 'TOKEN_EXPIRED'
      });
    }

    res.status(401).json({
      valid: false,
      error: 'Invalid token',
      code: 'INVALID_TOKEN'
    });
  }
});

// Logout endpoint (for token blacklisting in future)
router.post('/logout', authenticateAdmin, async (req, res) => {
  // In a production system, you might want to blacklist the token
  // For now, we'll just return success
  console.log(`Admin logout: ${req.user.username} at ${new Date().toISOString()}`);
  
  res.json({
    success: true,
    message: 'Logged out successfully'
  });
});

// Change password endpoint
router.post('/change-password', authenticateAdmin, [
  body('currentPassword')
    .notEmpty()
    .withMessage('Current password is required'),
  body('newPassword')
    .isLength({ min: 8 })
    .withMessage('New password must be at least 8 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('New password must contain at least one lowercase letter, one uppercase letter, and one number')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { currentPassword, newPassword } = req.body;
    
    // Verify current password
    const validPassword = process.env.ADMIN_PASSWORD;
    
    let currentPasswordValid = false;
    if (validPassword.startsWith('$2a$') || validPassword.startsWith('$2b$')) {
      currentPasswordValid = await bcrypt.compare(currentPassword, validPassword);
    } else {
      currentPasswordValid = currentPassword === validPassword;
    }

    if (!currentPasswordValid) {
      return res.status(401).json({
        error: 'Current password is incorrect'
      });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 12);
    
    // In production, save to database
    // For now, just return success with instruction to update .env
    res.json({
      success: true,
      message: 'Password changed successfully',
      newHashedPassword: hashedPassword,
      instruction: 'Update your .env file with the new hashed password'
    });

  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      error: 'Failed to change password'
    });
  }
});

module.exports = router;

// ============================================
// FRONTEND - Admin Login Component (HTML/JS)
// ============================================

// admin-login.html
const adminLoginHTML = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Admin Login - VideoTube</title>
    
    <!-- Bootstrap CSS -->
    <link href="https://cdnjs.cloudflare.com/ajax/libs/bootstrap/5.3.2/css/bootstrap.min.css" rel="stylesheet">
    <!-- Bootstrap Icons -->
    <link href="https://cdnjs.cloudflare.com/ajax/libs/bootstrap-icons/1.11.1/font/bootstrap-icons.min.css" rel="stylesheet">
    
    <style>
        :root {
            --primary-red: #ff4444;
            --primary-red-hover: #ff6666;
            --dark-bg: #1a1a1a;
            --dark-secondary: #2a2a2a;
            --dark-border: #333;
        }

        body {
            background: linear-gradient(135deg, var(--dark-bg) 0%, #2d2d2d 100%);
            color: white;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .login-container {
            background: var(--dark-secondary);
            border-radius: 12px;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
            overflow: hidden;
            width: 100%;
            max-width: 400px;
            border: 1px solid var(--dark-border);
        }

        .login-header {
            background: var(--primary-red);
            color: white;
            padding: 2rem;
            text-align: center;
        }

        .login-header h2 {
            margin: 0;
            font-weight: 600;
        }

        .login-header .subtitle {
            opacity: 0.9;
            font-size: 0.9rem;
            margin-top: 0.5rem;
        }

        .login-body {
            padding: 2rem;
        }

        .form-control {
            background: var(--dark-bg);
            border: 1px solid var(--dark-border);
            color: white;
            padding: 0.75rem 1rem;
            border-radius: 8px;
            transition: all 0.2s;
        }

        .form-control:focus {
            background: var(--dark-bg);
            border-color: var(--primary-red);
            color: white;
            box-shadow: 0 0 0 0.2rem rgba(255, 68, 68, 0.25);
        }

        .form-control::placeholder {
            color: #888;
        }

        .btn-login {
            background: var(--primary-red);
            border: none;
            color: white;
            padding: 0.75rem;
            border-radius: 8px;
            font-weight: 500;
            transition: all 0.2s;
            width: 100%;
        }

        .btn-login:hover:not(:disabled) {
            background: var(--primary-red-hover);
            transform: translateY(-1px);
        }

        .btn-login:disabled {
            background: #666;
            cursor: not-allowed;
            transform: none;
        }

        .alert {
            border-radius: 8px;
            border: none;
        }

        .form-check-input:checked {
            background-color: var(--primary-red);
            border-color: var(--primary-red);
        }

        .form-check-input:focus {
            box-shadow: 0 0 0 0.2rem rgba(255, 68, 68, 0.25);
        }

        .loading-spinner {
            display: inline-block;
            width: 1rem;
            height: 1rem;
            border: 2px solid transparent;
            border-top: 2px solid currentColor;
            border-radius: 50%;
            animation: spin 1s linear infinite;
        }

        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }

        .login-footer {
            padding: 1rem 2rem;
            border-top: 1px solid var(--dark-border);
            text-align: center;
            color: #888;
            font-size: 0.85rem;
        }

        .password-toggle {
            position: absolute;
            right: 10px;
            top: 50%;
            transform: translateY(-50%);
            background: none;
            border: none;
            color: #888;
            cursor: pointer;
            padding: 0;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .password-toggle:hover {
            color: white;
        }

        .input-group {
            position: relative;
        }

        .strength-meter {
            height: 4px;
            background: var(--dark-border);
            border-radius: 2px;
            margin-top: 0.5rem;
            overflow: hidden;
        }

        .strength-fill {
            height: 100%;
            border-radius: 2px;
            transition: all 0.3s ease;
            width: 0%;
        }

        .strength-weak { background: #ff4444; }
        .strength-medium { background: #ffa500; }
        .strength-strong { background: #4caf50; }
    </style>
</head>
<body>
    <div class="login-container">
        <div class="login-header">
            <i class="bi bi-shield-lock display-4 mb-2"></i>
            <h2>Admin Login</h2>
            <p class="subtitle">Access the admin dashboard</p>
        </div>

        <div class="login-body">
            <form id="loginForm">
                <div class="mb-3">
                    <label for="username" class="form-label">Username</label>
                    <input 
                        type="text" 
                        class="form-control" 
                        id="username" 
                        name="username"
                        placeholder="Enter your username"
                        required
                        autocomplete="username"
                        autofocus
                    >
                    <div class="invalid-feedback"></div>
                </div>

                <div class="mb-3">
                    <label for="password" class="form-label">Password</label>
                    <div class="input-group">
                        <input 
                            type="password" 
                            class="form-control" 
                            id="password" 
                            name="password"
                            placeholder="Enter your password"
                            required
                            autocomplete="current-password"
                        >
                        <button type="button" class="password-toggle" id="togglePassword">
                            <i class="bi bi-eye"></i>
                        </button>
                    </div>
                    <div class="invalid-feedback"></div>
                </div>

                <div class="mb-3 form-check">
                    <input 
                        type="checkbox" 
                        class="form-check-input" 
                        id="rememberMe" 
                        name="rememberMe"
                    >
                    <label class="form-check-label" for="rememberMe">
                        Remember me for 30 days
                    </label>
                </div>

                <div id="alertContainer"></div>

                <button type="submit" class="btn btn-login" id="loginBtn">
                    <span class="btn-text">Login</span>
                    <span class="loading-spinner d-none"></span>
                </button>
            </form>
        </div>

        <div class="login-footer">
            <small>
                <i class="bi bi-info-circle me-1"></i>
                Authorized personnel only
            </small>
        </div>
    </div>

    <!-- Bootstrap JS -->
    <script src="https://cdnjs.cloudflare.com/ajax/libs/bootstrap/5.3.2/js/bootstrap.bundle.min.js"></script>

    <script>
        class AdminLogin {
            constructor() {
                this.form = document.getElementById('loginForm');
                this.usernameInput = document.getElementById('username');
                this.passwordInput = document.getElementById('password');
                this.rememberMeInput = document.getElementById('rememberMe');
                this.loginBtn = document.getElementById('loginBtn');
                this.alertContainer = document.getElementById('alertContainer');
                this.togglePasswordBtn = document.getElementById('togglePassword');
                
                this.apiUrl = '/api/auth'; // Adjust based on your API endpoint
                this.isLoading = false;
                
                this.init();
            }

            init() {
                this.bindEvents();
                this.checkExistingSession();
            }

            bindEvents() {
                this.form.addEventListener('submit', this.handleSubmit.bind(this));
                this.togglePasswordBtn.addEventListener('click', this.togglePassword.bind(this));
                
                // Real-time validation
                this.usernameInput.addEventListener('input', this.validateUsername.bind(this));
                this.passwordInput.addEventListener('input', this.validatePassword.bind(this));
                
                // Clear errors on focus
                [this.usernameInput, this.passwordInput].forEach(input => {
                    input.addEventListener('focus', () => this.clearFieldError(input));
                });
            }

            async handleSubmit(event) {
                event.preventDefault();
                
                if (this.isLoading) return;
                
                const formData = {
                    username: this.usernameInput.value.trim(),
                    password: this.passwordInput.value,
                    rememberMe: this.rememberMeInput.checked
                };

                // Client-side validation
                if (!this.validateForm(formData)) {
                    return;
                }

                this.setLoading(true);
                this.clearAlert();

                try {
                    const response = await fetch(\`\${this.apiUrl}/login\`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(formData)
                    });

                    const data = await response.json();

                    if (response.ok) {
                        this.handleLoginSuccess(data);
                    } else {
                        this.handleLoginError(data);
                    }

                } catch (error) {
                    console.error('Login error:', error);
                    this.showAlert('Network error. Please check your connection and try again.', 'error');
                } finally {
                    this.setLoading(false);
                }
            }

            validateForm(formData) {
                let isValid = true;

                // Username validation
                if (!formData.username) {
                    this.setFieldError(this.usernameInput, 'Username is required');
                    isValid = false;
                } else if (formData.username.length < 3) {
                    this.setFieldError(this.usernameInput, 'Username must be at least 3 characters');
                    isValid = false;
                } else if (!/^[a-zA-Z0-9_]+$/.test(formData.username)) {
                    this.setFieldError(this.usernameInput, 'Username can only contain letters, numbers, and underscores');
                    isValid = false;
                }

                // Password validation
                if (!formData.password) {
                    this.setFieldError(this.passwordInput, 'Password is required');
                    isValid = false;
                } else if (formData.password.length < 6) {
                    this.setFieldError(this.passwordInput, 'Password must be at least 6 characters');
                    isValid = false;
                }

                return isValid;
            }

            validateUsername() {
                const username = this.usernameInput.value.trim();
                
                if (username && !/^[a-zA-Z0-9_]+$/.test(username)) {
                    this.setFieldError(this.usernameInput, 'Only letters, numbers, and underscores allowed');
                } else {
                    this.clearFieldError(this.usernameInput);
                }
            }

            validatePassword() {
                const password = this.passwordInput.value;
                
                if (password && password.length < 6) {
                    this.setFieldError(this.passwordInput, 'Password must be at least 6 characters');
                } else {
                    this.clearFieldError(this.passwordInput);
                }
            }

            setFieldError(input, message) {
                input.classList.add('is-invalid');
                const feedback = input.parentNode.querySelector('.invalid-feedback');
                if (feedback) {
                    feedback.textContent = message;
                }
            }

            clearFieldError(input) {
                input.classList.remove('is-invalid');
                const feedback = input.parentNode.querySelector('.invalid-feedback');
                if (feedback) {
                    feedback.textContent = '';
                }
            }

            handleLoginSuccess(data) {
                // Store token
                localStorage.setItem('adminToken', data.token);
                localStorage.setItem('adminUser', JSON.stringify(data.user));
                
                this.showAlert('Login successful! Redirecting...', 'success');
                
                // Redirect to admin dashboard
                setTimeout(() => {
                    window.location.href = '/admin/dashboard'; // Adjust URL as needed
                }, 1500);
            }

            handleLoginError(data) {
                const errorMessages = {
                    'INVALID_CREDENTIALS': 'Invalid username or password',
                    'VALIDATION_ERROR': 'Please check your input and try again',
                    'TOO_MANY_ATTEMPTS': 'Too many login attempts. Please try again later',
                    'ADMIN_NOT_CONFIGURED': 'Admin account not properly configured',
                    'INTERNAL_ERROR': 'Server error. Please try again later'
                };

                const message = errorMessages[data.code] || data.error || 'Login failed';
                this.showAlert(message, 'error');

                // Handle specific error codes
                if (data.code === 'VALIDATION_ERROR' && data.details) {
                    data.details.forEach(detail => {
                        const field = detail.param;
                        if (field === 'username') {
                            this.setFieldError(this.usernameInput, detail.msg);
                        } else if (field === 'password') {
                            this.setFieldError(this.passwordInput, detail.msg);
                        }
                    });
                }
            }

            setLoading(loading) {
                this.isLoading = loading;
                const btnText = this.loginBtn.querySelector('.btn-text');
                const spinner = this.loginBtn.querySelector('.loading-spinner');
                
                if (loading) {
                    this.loginBtn.disabled = true;
                    btnText.textContent = 'Logging in...';
                    spinner.classList.remove('d-none');
                } else {
                    this.loginBtn.disabled = false;
                    btnText.textContent = 'Login';
                    spinner.classList.add('d-none');
                }
            }

            showAlert(message, type = 'info') {
                const alertClass = type === 'error' ? 'alert-danger' : 
                                 type === 'success' ? 'alert-success' : 'alert-info';
                
                const icon = type === 'error' ? 'bi-exclamation-triangle' :
                            type === 'success' ? 'bi-check-circle' : 'bi-info-circle';

                this.alertContainer.innerHTML = \`
                    <div class="alert \${alertClass} alert-dismissible fade show" role="alert">
                        <i class="bi \${icon} me-2"></i>
                        \${message}
                        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
                    </div>
                \`;
            }

            clearAlert() {
                this.alertContainer.innerHTML = '';
            }

            togglePassword() {
                const isPassword = this.passwordInput.type === 'password';
                this.passwordInput.type = isPassword ? 'text' : 'password';
                
                const icon = this.togglePasswordBtn.querySelector('i');
                icon.className = isPassword ? 'bi bi-eye-slash' : 'bi bi-eye';
            }

            async checkExistingSession() {
                const token = localStorage.getItem('adminToken');
                if (!token) return;

                try {
                    const response = await fetch(\`\${this.apiUrl}/validate\`, {
                        headers: {
                            'Authorization': \`Bearer \${token}\`
                        }
                    });

                    if (response.ok) {
                        // User is already logged in, redirect
                        window.location.href = '/admin/dashboard';
                    } else {
                        // Invalid token, clear storage
                        localStorage.removeItem('adminToken');
                        localStorage.removeItem('adminUser');
                    }
                } catch (error) {
                    console.error('Session check error:', error);
                }
            }
        }

        // Initialize the login system when DOM is loaded
        document.addEventListener('DOMContentLoaded', () => {
            new AdminLogin();
        });
    </script>
</body>
</html>
`;

// ============================================
// INTEGRATION WITH EXISTING BOOTSTRAP PAGE
// ============================================

// Add this JavaScript to your existing Bootstrap page to handle admin login
const adminLoginIntegration = \`
// Admin Authentication Manager for existing Bootstrap page
class AdminAuth {
    constructor() {
        this.apiUrl = '/api/auth';
        this.token = localStorage.getItem('adminToken');
        this.user = JSON.parse(localStorage.getItem('adminUser') || 'null');
        
        this.init();
    }

    init() {
        this.updateAdminButton();
        this.checkTokenExpiry();
    }

    updateAdminButton() {
        const adminBtn = document.querySelector('.btn-admin');
        if (!adminBtn) return;

        if (this.isLoggedIn()) {
            adminBtn.innerHTML = \`
                <i class="bi bi-person-circle me-1"></i>
                \${this.user.username}
                <span class="ms-2 badge bg-success">Admin</span>
            \`;
            adminBtn.onclick = () => this.showAdminMenu();
        } else {
            adminBtn.innerHTML = '<i class="bi bi-gear me-1"></i>Admin';
            adminBtn.onclick = () => this.showLoginModal();
        }
    }

    isLoggedIn() {
        return this.token && this.user;
    }

    async validateToken() {
        if (!this.token) return false;

        try {
            const response = await fetch(\`\${this.apiUrl}/validate\`, {
                headers: {
                    'Authorization': \`Bearer \${this.token}\`
                }
            });

            if (response.ok) {
                const data = await response.json();
                return data.valid;
            }
        } catch (error) {
            console.error('Token validation error:', error);
        }

        return false;
    }

    checkTokenExpiry() {
        if (!this.token) return;

        // Check token every 5 minutes
        setInterval(async () => {
            const isValid = await this.validateToken();
            if (!isValid) {
                this.logout();
                this.showAlert('Session expired. Please login again.', 'warning');
            }
        }, 5 * 60 * 1000);
    }

    showLoginModal() {
        // Create login modal
        const modalHtml = \`
            <div class="modal fade" id="adminLoginModal" tabindex="-1">
                <div class="modal-dialog">
                    <div class="modal-content bg-dark border-secondary">
                        <div class="modal-header border-secondary">
                            <h5 class="modal-title text-white">
                                <i class="bi bi-shield-lock me-2"></i>Admin Login
                            </h5>
                            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <form id="modalLoginForm">
                                <div class="mb-3">
                                    <label class="form-label text-white">Username</label>
                                    <input type="text" class="form-control bg-dark border-secondary text-white" 
                                           id="modalUsername" required>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label text-white">Password</label>
                                    <input type="password" class="form-control bg-dark border-secondary text-white" 
                                           id="modalPassword" required>
                                </div>
                                <div class="mb-3 form-check">
                                    <input type="checkbox" class="form-check-input" id="modalRememberMe">
                                    <label class="form-check-label text-white">Remember me</label>
                                </div>
                                <div id="modalAlert"></div>
                                <button type="submit" class="btn btn-danger w-100" id="modalLoginBtn">
                                    Login
                                </button>
                            </form>
                        </div>
                    </div>
                </div>
            </div>
        \`;

        // Remove existing modal if any
        const existingModal = document.getElementById('adminLoginModal');
        if (existingModal) {
            existingModal.remove();
        }

        // Add modal to page
        document.body.insertAdjacentHTML('beforeend', modalHtml);

        // Show modal
        const modal = new bootstrap.Modal(document.getElementById('adminLoginModal'));
        modal.show();

        // Handle form submission
        document.getElementById('modalLoginForm').addEventListener('submit', (e) => {
            this.handleModalLogin(e, modal);
        });
    }

    async handleModalLogin(event, modal) {
        event.preventDefault();
        
        const username = document.getElementById('modalUsername').value;
        const password = document.getElementById('modalPassword').value;
        const rememberMe = document.getElementById('modalRememberMe').checked;
        const btn = document.getElementById('modalLoginBtn');
        const alert = document.getElementById('modalAlert');

        btn.disabled = true;
        btn.innerHTML = 'Logging in...';

        try {
            const response = await fetch(\`\${this.apiUrl}/login\`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, password, rememberMe })
            });

            const data = await response.json();

            if (response.ok) {
                this.token = data.token;
                this.user = data.user;
                localStorage.setItem('adminToken', this.token);
                localStorage.setItem('adminUser', JSON.stringify(this.user));
                
                modal.hide();
                this.updateAdminButton();
                this.showAlert('Login successful!', 'success');
                
                // Show admin section
                setTimeout(() => this.showAdminSection(), 1000);
            } else {
                alert.innerHTML = \`
                    <div class="alert alert-danger">
                        <i class="bi bi-exclamation-triangle me-2"></i>
                        \${data.error || 'Login failed'}
                    </div>
                \`;
            }
        } catch (error) {
            alert.innerHTML = \`
                <div class="alert alert-danger">
                    <i class="bi bi-exclamation-triangle me-2"></i>
                    Network error. Please try again.
                </div>
            \`;
        }

        btn.disabled = false;
        btn.innerHTML = 'Login';
    }

    showAdminMenu() {
        // Create dropdown menu for logged-in admin
        const dropdownHtml = \`
            <div class="dropdown">
                <button class="btn btn-admin dropdown-toggle" type="button" data-bs-toggle="dropdown">
                    <i class="bi bi-person-circle me-1"></i>\${this.user.username}
                </button>
                <ul class="dropdown-menu dropdown-menu-dark dropdown-menu-end">
                    <li><a class="dropdown-item" href="#" onclick="adminAuth.showAdminSection()">
                        <i class="bi bi-speedometer2 me-2"></i>Dashboard
                    </a></li>
                    <li><a class="dropdown-item" href="#" onclick="adminAuth.showConfigSection()">
                        <i class="bi bi-gear me-2"></i>Configuration
                    </a></li>
                    <li><hr class="dropdown-divider"></li>
                    <li><a class="dropdown-item" href="#" onclick="adminAuth.logout()">
                        <i class="bi bi-box-arrow-right me-2"></i>Logout
                    </a></li>
                </ul>
            </div>
        \`;

        // Replace admin button with dropdown
        const adminBtn = document.querySelector('.btn-admin');
        if (adminBtn) {
            adminBtn.outerHTML = dropdownHtml;
        }
    }

    async logout() {
        try {
            await fetch(\`\${this.apiUrl}/logout\`, {
                method: 'POST',
                headers: {
                    'Authorization': \`Bearer \${this.token}\`
                }
            });
        } catch (error) {
            console.error('Logout error:', error);
        }

        this.token = null;
        this.user = null;
        localStorage.removeItem('adminToken');
        localStorage.removeItem('adminUser');
        
        this.updateAdminButton();
        this.showAlert('Logged out successfully', 'info');
        
        // Return to home if on admin section
        const adminSection = document.getElementById('adminSection');
        if (adminSection && !adminSection.classList.contains('d-none')) {
            showHome();
        }
    }

    showAdminSection() {
        if (!this.isLoggedIn()) {
            this.showLoginModal();
            return;
        }
        
        showSection('adminSection');
        this.loadAdminDashboard();
    }

    showConfigSection() {
        if (!this.isLoggedIn()) {
            this.showLoginModal();
            return;
        }
        
        // Implementation for config section
        this.showAlert('Configuration panel coming soon!', 'info');
    }

    async loadAdminDashboard() {
        // Load admin dashboard content
        const adminSection = document.getElementById('adminSection');
        if (!adminSection) return;

        adminSection.innerHTML = \`
            <div class="container">
                <div class="d-flex justify-content-between align-items-center mb-4">
                    <h1>Admin Dashboard</h1>
                    <small class="text-muted">Welcome, \${this.user.username}</small>
                </div>
                
                <div class="row">
                    <div class="col-md-4">
                        <div class="card bg-dark border-secondary mb-3">
                            <div class="card-body">
                                <h5 class="card-title">
                                    <i class="bi bi-camera-video me-2"></i>Total Videos
                                </h5>
                                <h2 class="text-primary">0</h2>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-4">
                        <div class="card bg-dark border-secondary mb-3">
                            <div class="card-body">
                                <h5 class="card-title">
                                    <i class="bi bi-eye me-2"></i>Total Views
                                </h5>
                                <h2 class="text-success">0</h2>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-4">
                        <div class="card bg-dark border-secondary mb-3">
                            <div class="card-body">
                                <h5 class="card-title">
                                    <i class="bi bi-hdd me-2"></i>Storage Used
                                </h5>
                                <h2 class="text-warning">0 GB</h2>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="card bg-dark border-secondary">
                    <div class="card-header">
                        <h5 class="mb-0">Recent Activity</h5>
                    </div>
                    <div class="card-body">
                        <p class="text-muted">No recent activity</p>
                    </div>
                </div>
            </div>
        \`;
    }

    showAlert(message, type = 'info') {
        const alertHtml = \`
            <div class="alert alert-\${type === 'error' ? 'danger' : type} alert-dismissible fade show position-fixed" 
                 style="top: 20px; right: 20px; z-index: 9999; min-width: 300px;">
                <i class="bi bi-\${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-triangle' : 'info-circle'} me-2"></i>
                \${message}
                <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
            </div>
        \`;

        document.body.insertAdjacentHTML('beforeend', alertHtml);

        // Auto-remove after 5 seconds
        setTimeout(() => {
            const alerts = document.querySelectorAll('.alert');
            if (alerts.length > 0) {
                alerts[alerts.length - 1].remove();
            }
        }, 5000);
    }
}

// Initialize admin auth when page loads
let adminAuth;
document.addEventListener('DOMContentLoaded', () => {
    adminAuth = new AdminAuth();
});
\`;

module.exports = {
    authMiddleware: require('./middleware/auth'),
    authRoutes: router,
    adminLoginHTML,
    adminLoginIntegration
};
