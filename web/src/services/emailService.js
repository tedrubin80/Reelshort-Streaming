// Use the new Resend-based email service
const resendEmailService = require('./resendEmailService');

// Export the resend service as the default email service
module.exports = resendEmailService;