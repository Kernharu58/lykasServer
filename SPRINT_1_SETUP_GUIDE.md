# Sprint 1 Deployment & Setup Guide

## Quick Start

### 1. Install Dependencies
```bash
cd lykasServer
npm install
```

### 2. Configure Environment
```bash
# Copy template
cp .env.example .env

# Edit .env with your values
# Minimum required:
# - DATABASE connection
# - JWT_SECRET (strong, unique)
# - Email service credentials
# - FRONTEND_URL for email links
```

### 3. Email Service Setup (Gmail Recommended)

**For Gmail:**
1. Go to https://myaccount.google.com/security
2. Enable 2-Factor Authentication
3. Generate App Password at https://myaccount.google.com/apppasswords
4. In `.env`, set:
   ```
   EMAIL_SERVICE=gmail
   EMAIL_USER=your_email@gmail.com
   EMAIL_PASSWORD=<app_password_from_step_3>
   ```

**For Production Email Services:**
- SendGrid: https://sendgrid.com/
- AWS SES: https://aws.amazon.com/ses/
- Mailgun: https://www.mailgun.com/

### 4. Test Email Sending
```bash
# You can test with a simple script or make API call
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "displayName": "Test User",
    "email": "test@example.com",
    "password": "TestPassword123!"
  }'

# Check your email inbox (or spam folder)
```

### 5. Run Server
```bash
npm run dev
```

---

## API Endpoints Quick Reference

### Authentication
```
POST   /api/auth/register                    - Register new user
POST   /api/auth/login                       - Login user
POST   /api/auth/logout                      - Logout and blacklist token [PROTECTED]
POST   /api/auth/verify-email                - Verify email with token
POST   /api/auth/forgot-password             - Request password reset
POST   /api/auth/reset-password              - Reset password with token
```

### Rate Limits
- **Login:** 5 attempts per 15 minutes per IP
- **Register:** 3 attempts per 1 hour per IP
- **Forgot Password:** 3 attempts per 1 hour per IP

---

## Frontend Integration Required

### 1. Add Email Verification Page
```typescript
// app/verify-email.tsx (or similar)
import { useSearchParams } from 'react-router-dom';

export default function VerifyEmailPage() {
  const [params] = useSearchParams();
  const token = params.get('token');
  
  useEffect(() => {
    if (token) {
      verifyEmail(token);
    }
  }, [token]);
}

async function verifyEmail(token: string) {
  const response = await fetch('/api/auth/verify-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token })
  });
  
  if (response.ok) {
    // Show success message
    // Redirect to dashboard or home
  } else {
    // Show error: token expired or invalid
  }
}
```

### 2. Add Password Reset Page
```typescript
// app/reset-password.tsx
import { useSearchParams } from 'react-router-dom';

export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get('token');
  const [password, setPassword] = useState('');
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const response = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token,
        newPassword: password,
        confirmPassword: password
      })
    });
    
    if (response.ok) {
      // Show success
      // Redirect to login
    }
  };
}
```

### 3. Add Logout Functionality
```typescript
// In AuthContext or similar
async function logout() {
  await fetch('/api/auth/logout', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('token')}`
    }
  });
  
  // Clear token
  localStorage.removeItem('token');
  
  // Redirect to login
  navigate('/login');
}
```

### 4. Handle emailVerified Flag
```typescript
// Show banner if email not verified
if (!user.emailVerified) {
  return <EmailVerificationBanner />;
}
```

---

## Testing Endpoints

### Using cURL

**Register:**
```bash
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "displayName": "John Doe",
    "email": "john@example.com",
    "password": "Secure123!@"
  }'
```

**Verify Email:**
```bash
curl -X POST http://localhost:3001/api/auth/verify-email \
  -H "Content-Type: application/json" \
  -d '{"token": "token_from_email"}'
```

**Login:**
```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "password": "Secure123!@"
  }'
```

**Logout:**
```bash
curl -X POST http://localhost:3001/api/auth/logout \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Forgot Password:**
```bash
curl -X POST http://localhost:3001/api/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email": "john@example.com"}'
```

**Reset Password:**
```bash
curl -X POST http://localhost:3001/api/auth/reset-password \
  -H "Content-Type: application/json" \
  -d '{
    "token": "token_from_email",
    "newPassword": "NewPassword123!",
    "confirmPassword": "NewPassword123!"
  }'
```

---

## Environment Variables Reference

```env
# DATABASE
MONGODB_URI=mongodb://localhost:27017/lykas

# JWT
JWT_SECRET=your_long_random_string_minimum_32_characters
JWT_EXPIRES_IN=7d

# EMAIL (Gmail App Password recommended)
EMAIL_SERVICE=gmail
EMAIL_USER=your.email@gmail.com
EMAIL_PASSWORD=your_app_password_from_google

# Frontend URLs (for email links)
FRONTEND_URL=http://localhost:3000
MOBILE_APP_URL=lykas://

# Google OAuth (if using Google login)
GOOGLE_CLIENT_ID=your_client_id.apps.googleusercontent.com
ANDROID_CLIENT_ID=your_android_client_id
IOS_CLIENT_ID=your_ios_client_id

# Server
PORT=3001
NODE_ENV=development

# Cloudinary (existing)
CLOUDINARY_CLOUD_NAME=xxx
CLOUDINARY_API_KEY=xxx
CLOUDINARY_API_SECRET=xxx
```

---

## Troubleshooting

### Email Not Sending
- [ ] Check EMAIL_USER and EMAIL_PASSWORD in .env
- [ ] For Gmail: Ensure app password is used (not regular password)
- [ ] For Gmail: Check if 2FA is enabled
- [ ] Check email service status: `npm test` (or manual test)
- [ ] Look for error logs in server console

### Token Verification Failed
- [ ] Check JWT_SECRET in .env
- [ ] Token may have expired (7 days)
- [ ] Token may be blacklisted (check TokenBlacklist collection)

### Rate Limiting Too Strict
- [ ] Modify limits in `src/middleware/rateLimitMiddleware.js`
- [ ] For development, increase limits or disable
- [ ] Remember to re-enable for production

### Database Connection Issues
- [ ] Verify MONGODB_URI in .env
- [ ] Ensure MongoDB is running
- [ ] Check network connectivity to database

---

## Security Checklist

- [ ] JWT_SECRET is strong and unique (32+ chars, mixed case, symbols)
- [ ] Email credentials not committed to git
- [ ] HTTPS enabled in production
- [ ] CORS properly configured
- [ ] Rate limiting enabled
- [ ] Audit logging operational
- [ ] Email service tested and working
- [ ] Token blacklist cleanup running (TTL index on MongoDB)

---

## Performance Considerations

### Current Limitations
1. **Rate Limiting:** In-memory storage - doesn't work across multiple servers
   - Solution: Use Redis for production clusters
   
2. **Email Service:** Synchronous operation blocks request
   - Solution: Use job queue (Bull, RabbitMQ) for production

3. **Token Blacklist:** Queries MongoDB on every request
   - Solution: Add caching layer (Redis) for high traffic

---

## Deployment to Production

### Before Going Live
1. Use professional email service (SendGrid, AWS SES)
2. Configure Redis for rate limiting and caching
3. Set strong JWT_SECRET (use environment)
4. Enable HTTPS/TLS
5. Configure proper CORS for production domains
6. Set up monitoring and error tracking (Sentry)
7. Enable database backups
8. Configure firewall/WAF rules

### Environment Variables
- Move all secrets to secure vault (AWS Secrets Manager, HashiCorp Vault)
- Never commit .env file
- Rotate secrets regularly

---

## Next Sprint (Sprint 2)

- Implement refresh tokens
- Add 2FA for admin accounts
- Build account management UI
- Implement notification system
- Add email verification resend option
