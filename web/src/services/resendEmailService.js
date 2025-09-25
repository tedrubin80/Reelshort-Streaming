const { Resend } = require('resend');
const { query } = require('../config/database');

class ResendEmailService {
    constructor() {
        this.resend = null;
        this.isConfigured = false;
        this.initialize();
    }

    async initialize() {
        try {
            if (process.env.RESEND_API_KEY) {
                this.resend = new Resend(process.env.RESEND_API_KEY);
                this.isConfigured = true;
                console.log('✅ Resend email service connected successfully');
            } else {
                console.log('⚠️ Resend email service not configured (missing API key)');
            }
        } catch (error) {
            console.error('❌ Resend email service initialization failed:', error);
        }
    }

    // Get email template from database
    async getEmailTemplate(templateName) {
        try {
            const result = await query(`
                SELECT subject_template, body_template, template_variables
                FROM email_templates
                WHERE template_name = $1 AND is_active = true
            `, [templateName]);

            if (result.rows.length === 0) {
                throw new Error(`Email template '${templateName}' not found`);
            }

            return result.rows[0];
        } catch (error) {
            console.error('Error getting email template:', error);
            throw error;
        }
    }

    // Replace template variables
    replaceTemplateVariables(template, variables) {
        let result = template;

        for (const [key, value] of Object.entries(variables)) {
            const regex = new RegExp(`{{${key}}}`, 'g');
            result = result.replace(regex, value || '');
        }

        return result;
    }

    // Send email using Resend
    async sendEmail(to, subject, textContent, htmlContent = null, from = null) {
        try {
            if (!this.isConfigured) {
                console.log('📧 Resend email service not available - email not sent');
                return false;
            }

            const fromEmail = from || process.env.FROM_EMAIL || 'noreply@reelshorts.live';

            const emailData = {
                from: fromEmail,
                to: Array.isArray(to) ? to : [to],
                subject: subject,
                text: textContent,
            };

            if (htmlContent) {
                emailData.html = htmlContent;
            } else {
                emailData.html = this.convertToHtml(textContent);
            }

            const result = await this.resend.emails.send(emailData);
            console.log(`📧 Email sent via Resend to ${to}:`, result.data?.id);

            return true;
        } catch (error) {
            console.error('❌ Failed to send email via Resend:', error);
            return false;
        }
    }

    // Send waiver request to festival director
    async sendWaiverRequestToDirector(data) {
        try {
            if (!this.isConfigured) {
                console.log('📧 Email service not available - waiver request not sent');
                return false;
            }

            const template = await this.getEmailTemplate('waiver_request_to_director');

            const variables = {
                filmmaker_name: data.filmmakerName,
                filmmaker_email: data.filmmakerEmail,
                film_title: data.filmTitle || 'Not specified',
                festival_name: data.festivalName,
                award_category: data.awardCategory,
                award_type: data.awardType,
                award_year: data.awardYear,
                director_name: data.directorName || 'Festival Director',
                verification_url: `${process.env.CLIENT_URL}/admin/verify-waiver/${data.waiverId}`,
                discount_percentage: data.discountPercentage,
                platform_contact_email: process.env.PLATFORM_CONTACT_EMAIL || 'support@reelshorts.live'
            };

            const subject = this.replaceTemplateVariables(template.subject_template, variables);
            const body = this.replaceTemplateVariables(template.body_template, variables);

            return await this.sendEmail(
                data.directorEmail,
                subject,
                body,
                null,
                `"ReelShorts" <${process.env.FROM_EMAIL || 'noreply@reelshorts.live'}>`
            );
        } catch (error) {
            console.error('❌ Failed to send waiver request email:', error);
            return false;
        }
    }

    // Send waiver approval notification to user
    async sendWaiverApprovalNotification(data) {
        try {
            if (!this.isConfigured) {
                console.log('📧 Email service not available - approval notification not sent');
                return false;
            }

            const template = await this.getEmailTemplate('waiver_approved_notification');

            const variables = {
                filmmaker_name: data.filmmakerName,
                waiver_code: data.waiverCode,
                discount_percentage: data.discountPercentage,
                expires_at: new Date(data.expiresAt).toLocaleDateString(),
                festival_name: data.festivalName,
                award_category: data.awardCategory,
                redemption_url: `${process.env.CLIENT_URL}/account/subscription?waiver=${data.waiverCode}`
            };

            const subject = this.replaceTemplateVariables(template.subject_template, variables);
            const body = this.replaceTemplateVariables(template.body_template, variables);

            return await this.sendEmail(
                data.userEmail,
                subject,
                body,
                null,
                `"ReelShorts" <${process.env.FROM_EMAIL || 'noreply@reelshorts.live'}>`
            );
        } catch (error) {
            console.error('❌ Failed to send approval notification:', error);
            return false;
        }
    }

    // Send general notification email
    async sendNotification(to, subject, message, options = {}) {
        try {
            const fromEmail = options.from || `"ReelShorts" <${process.env.FROM_EMAIL || 'noreply@reelshorts.live'}>`;

            return await this.sendEmail(to, subject, message, options.html, fromEmail);
        } catch (error) {
            console.error('❌ Failed to send notification:', error);
            return false;
        }
    }

    // Send welcome email to new users
    async sendWelcomeEmail(userEmail, userName) {
        try {
            const subject = 'Welcome to ReelShorts! 🎬';
            const message = `
Dear ${userName},

Welcome to ReelShorts - the premier platform for short film enthusiasts and creators!

We're excited to have you join our community of passionate filmmakers and film lovers. Here's what you can do:

🎥 Upload and share your short films (up to 30 minutes)
📺 Discover amazing short films from talented creators
🏆 Participate in film festivals and competitions
💬 Connect with fellow filmmakers and audiences
📊 Track your film's performance with detailed analytics

Getting Started:
1. Complete your profile at ${process.env.CLIENT_URL}/profile
2. Explore featured films at ${process.env.CLIENT_URL}/explore
3. Upload your first film at ${process.env.CLIENT_URL}/upload

Have questions? Our support team is here to help at ${process.env.PLATFORM_CONTACT_EMAIL || 'support@reelshorts.live'}

Happy filmmaking!

The ReelShorts Team
            `;

            return await this.sendNotification(userEmail, subject, message);
        } catch (error) {
            console.error('Failed to send welcome email:', error);
            return false;
        }
    }

    // Convert plain text to basic HTML
    convertToHtml(text) {
        return text
            .replace(/\n\n/g, '</p><p>')
            .replace(/\n/g, '<br>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/^/, '<p>')
            .replace(/$/, '</p>')
            .replace(/- (.*?)(<br>|$)/g, '<li>$1</li>')
            .replace(/(<li>.*<\/li>)/g, '<ul>$1</ul>');
    }

    // Bulk email sending for newsletters/announcements
    async sendBulkEmail(recipients, subject, message, options = {}) {
        try {
            if (!this.isConfigured) {
                console.log('📧 Email service not available - bulk email not sent');
                return false;
            }

            const batchSize = 50; // Send in batches to respect rate limits
            const batches = [];

            for (let i = 0; i < recipients.length; i += batchSize) {
                batches.push(recipients.slice(i, i + batchSize));
            }

            const results = [];
            for (const batch of batches) {
                const promises = batch.map(async (recipient) => {
                    try {
                        const personalizedSubject = this.replaceTemplateVariables(subject, recipient);
                        const personalizedMessage = this.replaceTemplateVariables(message, recipient);

                        const success = await this.sendEmail(
                            recipient.email,
                            personalizedSubject,
                            personalizedMessage,
                            options.html ? this.replaceTemplateVariables(options.html, recipient) : null
                        );

                        return {
                            success,
                            email: recipient.email,
                            messageId: success ? 'resend-bulk-' + Date.now() : null
                        };
                    } catch (error) {
                        console.error(`Failed to send email to ${recipient.email}:`, error);
                        return { success: false, email: recipient.email, error: error.message };
                    }
                });

                const batchResults = await Promise.all(promises);
                results.push(...batchResults);

                // Wait between batches to respect rate limits
                if (batches.indexOf(batch) < batches.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }

            const successful = results.filter(r => r.success).length;
            const failed = results.filter(r => !r.success).length;

            console.log(`📧 Bulk email completed: ${successful} sent, ${failed} failed`);

            return {
                successful,
                failed,
                results
            };
        } catch (error) {
            console.error('❌ Bulk email sending failed:', error);
            return false;
        }
    }

    // Test email configuration
    async testConnection() {
        try {
            if (!this.isConfigured) {
                throw new Error('Resend email service not configured');
            }

            // Send a test email to verify the service works
            const testEmail = await this.sendEmail(
                process.env.PLATFORM_CONTACT_EMAIL || 'test@reelshorts.live',
                'ReelShorts Email Service Test',
                'This is a test email to verify that the Resend email service is working correctly.'
            );

            if (testEmail) {
                console.log('✅ Resend email service test successful');
                return true;
            } else {
                throw new Error('Test email failed to send');
            }
        } catch (error) {
            console.error('❌ Resend email service test failed:', error);
            return false;
        }
    }
}

// Singleton instance
const resendEmailService = new ResendEmailService();

module.exports = resendEmailService;