# 🎬 ReelShorts.live - Video Streaming Platform

A complete, production-ready video streaming platform built with modern web technologies. Upload, process, and stream videos with automatic compression, multiple quality outputs, and real-time user interactions.

## 🎬 Features

### User Management
- User registration and authentication
- JWT-based session management
- User profiles and dashboards

### Content Platform
- Film browsing and discovery
- Category filtering and search
- Video metadata management
- Creator dashboard with analytics

### Upload System
- Drag & drop file upload interface
- Form validation and metadata collection
- Authentication-required uploads

### Technical Stack
- **Frontend:** React 18 with React Router
- **Backend:** Node.js with Express
- **Database:** PostgreSQL
- **Authentication:** JWT tokens
- **Email:** Resend API integration
- **Deployment:** Nginx reverse proxy with SSL

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL 16+
- Nginx
- Redis (for session storage)

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/tedrubin80/Reelshort-Private.git
cd Reelshort-Private
```

2. **Install dependencies**
```bash
cd web
npm install
```

3. **Database Setup**
```bash
# Create database
createdb southerns_db

# Import schema
psql -d southerns_db -f database/schema.sql

# Import sample data (optional)
psql -d southerns_db -f database/sample_data.sql
```

4. **Environment Configuration**
```bash
cp web/.env.example web/.env
# Edit .env with your configuration
```

5. **Build frontend**
```bash
npm run build
```

6. **Start the server**
```bash
node server.js
```

## 🔧 Configuration

### Environment Variables (.env)
```bash
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/southerns_db

# Email Service
RESEND_API_KEY=your_resend_api_key
FROM_EMAIL=noreply@reelshorts.live
PLATFORM_CONTACT_EMAIL=support@reelshorts.live

# JWT
JWT_SECRET=your_jwt_secret
JWT_EXPIRES_IN=7d

# Application
NODE_ENV=production
PORT=3000
DOMAIN=reelshorts.live
```

### Nginx Configuration
See `nginx-site.conf` for the complete Nginx configuration including SSL setup.

## 📁 Project Structure

```
reelshorts.live/
├── web/                      # Main application
│   ├── client/               # React frontend
│   │   ├── src/
│   │   │   ├── components/   # React components
│   │   │   ├── pages/        # Route pages
│   │   │   └── styles/       # CSS styles
│   │   └── public/           # Static assets
│   ├── src/                  # Node.js backend
│   │   ├── controllers/      # Route controllers
│   │   ├── middleware/       # Express middleware
│   │   ├── models/          # Database models
│   │   ├── routes/          # API routes
│   │   └── services/        # Business logic
│   └── dist/                # Built frontend
├── database/                # Database files
├── scripts/                 # Utility scripts
└── nginx-site.conf         # Nginx configuration
```

## 🛠️ Development

### Available Scripts
- `npm run build` - Build production frontend
- `npm run dev` - Start development server
- `npm test` - Run tests

### API Endpoints

#### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/refresh` - Refresh JWT token

#### Films
- `GET /api/films` - Get all films
- `GET /api/films/:id` - Get single film
- `GET /api/films/user` - Get user's films
- `POST /api/upload/film` - Upload new film

#### User Management
- `GET /api/user/profile` - Get user profile
- `PUT /api/user/profile` - Update user profile

## 🔐 Security Features

- JWT authentication with refresh tokens
- Password hashing with bcrypt
- Rate limiting on API endpoints
- CORS protection
- Helmet security headers
- Input validation and sanitization

## 📊 Database Schema

The database includes tables for:
- Users and authentication
- Films and metadata
- Comments and interactions
- Upload tracking
- Email templates

See `database/schema.sql` for complete schema.

## 🚀 Deployment

### Production Checklist
- [ ] Configure environment variables
- [ ] Set up SSL certificates
- [ ] Configure Nginx reverse proxy
- [ ] Set up database backups
- [ ] Configure email service
- [ ] Set up monitoring and logs

### Backup System
Automated weekly backups include:
- Complete application code
- Database dump
- Configuration files
- Processing scripts
- System logs

## 📞 Support

For support and questions, contact: support@reelshorts.live

## 📄 License

Private repository - All rights reserved.

---

**Built with ❤️ for filmmakers and film enthusiasts**