const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'ReelShorts API Documentation',
      version: '1.0.0',
      description: 'Comprehensive API documentation for ReelShorts - A YouTube-style short film platform',
      contact: {
        name: 'ReelShorts Support',
        email: 'support@reelshorts.live',
        url: 'https://reelshorts.live'
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT'
      }
    },
    servers: [
      {
        url: 'http://37.27.220.18:3001',
        description: 'Production server'
      },
      {
        url: 'http://localhost:3001',
        description: 'Development server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter your JWT token'
        }
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            username: { type: 'string' },
            email: { type: 'string', format: 'email' },
            role: {
              type: 'string',
              enum: ['user', 'creator', 'moderator', 'admin']
            },
            created_at: { type: 'string', format: 'date-time' },
            is_banned: { type: 'boolean' }
          }
        },
        Video: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            title: { type: 'string' },
            description: { type: 'string' },
            uploader_id: { type: 'string', format: 'uuid' },
            file_path: { type: 'string' },
            thumbnail_url: { type: 'string' },
            duration: { type: 'integer' },
            file_size: { type: 'integer' },
            view_count: { type: 'integer' },
            like_count: { type: 'integer' },
            upload_status: {
              type: 'string',
              enum: ['pending', 'processing', 'completed', 'failed']
            },
            moderation_status: {
              type: 'string',
              enum: ['pending', 'approved', 'rejected']
            },
            created_at: { type: 'string', format: 'date-time' },
            cdn_enabled: { type: 'boolean' },
            bunny_video_id: { type: 'string' },
            bunny_hls_url: { type: 'string' }
          }
        },
        Comment: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            video_id: { type: 'string', format: 'uuid' },
            user_id: { type: 'string', format: 'uuid' },
            parent_comment_id: { type: 'string', format: 'uuid', nullable: true },
            content: { type: 'string' },
            created_at: { type: 'string', format: 'date-time' }
          }
        },
        Rating: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            video_id: { type: 'string', format: 'uuid' },
            user_id: { type: 'string', format: 'uuid' },
            rating: { type: 'integer', minimum: 1, maximum: 5 },
            created_at: { type: 'string', format: 'date-time' }
          }
        },
        Playlist: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            description: { type: 'string' },
            user_id: { type: 'string', format: 'uuid' },
            is_public: { type: 'boolean' },
            created_at: { type: 'string', format: 'date-time' }
          }
        },
        Analytics: {
          type: 'object',
          properties: {
            video_id: { type: 'string', format: 'uuid' },
            date: { type: 'string', format: 'date' },
            views_count: { type: 'integer' },
            unique_viewers: { type: 'integer' },
            avg_watch_duration: { type: 'integer' },
            completion_rate: { type: 'number', format: 'float' },
            engagement_rate: { type: 'number', format: 'float' }
          }
        },
        Error: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' },
            statusCode: { type: 'integer' }
          }
        }
      },
      responses: {
        UnauthorizedError: {
          description: 'Access token is missing or invalid',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' }
            }
          }
        },
        ForbiddenError: {
          description: 'User does not have required permissions',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' }
            }
          }
        },
        NotFoundError: {
          description: 'Resource not found',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' }
            }
          }
        },
        ValidationError: {
          description: 'Validation error',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' }
            }
          }
        }
      }
    },
    tags: [
      {
        name: 'Authentication',
        description: 'User authentication and registration'
      },
      {
        name: 'Videos',
        description: 'Video upload, retrieval, and management'
      },
      {
        name: 'Comments',
        description: 'Video comments and replies'
      },
      {
        name: 'Ratings',
        description: 'Video ratings and likes'
      },
      {
        name: 'Playlists',
        description: 'User playlists management'
      },
      {
        name: 'Search',
        description: 'Search functionality'
      },
      {
        name: 'Analytics',
        description: 'Creator analytics and insights'
      },
      {
        name: 'Admin',
        description: 'Admin and moderation endpoints'
      },
      {
        name: 'Recommendations',
        description: 'Video recommendation engine'
      },
      {
        name: 'CDN',
        description: 'Bunny.net CDN integration'
      },
      {
        name: 'Channels',
        description: 'User channels and profiles'
      },
      {
        name: 'Categories',
        description: 'Video categories'
      },
      {
        name: 'Festival',
        description: 'Film festival submissions'
      }
    ]
  },
  apis: ['./src/routes/*.js'] // Path to API routes
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;
