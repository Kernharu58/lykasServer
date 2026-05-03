# Sprint 1: Authentication & Security Features - API Documentation

## Overview
Sprint 1 implements four critical security and authentication features:
1. **Email Verification** - Users must verify their email after registration
2. **Password Reset Flow** - Users can reset forgotten passwords via email
3. **Session Management** - Tokens are blacklisted on logout/account status changes
4. **Rate Limiting** - Brute force protection on auth endpoints

---

## 1. EMAIL VERIFICATION

### Context
- Automatically triggered on user registration
- Users receive verification email with time-limited token
- Email verification valid for 24 hours
- User can login immediately but features may be limited until verified

### Flow
```
User Registration → Email Sent → User Clicks Link → Email Verified ✓
```

### Endpoint: POST `/api/auth/register`

**Request:**
```json
{
  "displayName": "John Doe",
  "email": "john@example.com",
  "password": "SecurePass123!"
}
```

**Response (201 Created):**
```json
{
  "message": "User registered successfully. Please check your email to verify your account.",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "displayName": "John Doe",
    "email": "john@example.com",
    "role": "user",
    "emailVerified": false
  }
}
```

**What happens:**
1. Backend validates strong password requirements
2. Generates 24-hour verification token
3. Creates user with `emailVerified: false`
4. Sends verification email to user
5. Returns JWT token (user can start using app)

---

### Endpoint: POST `/api/auth/verify-email`

**Request:**
```json
{
  "token": "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6"
}
```

**Response (200 OK):**
```json
{
  "message": "Email verified successfully",
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "displayName": "John Doe",
    "email": "john@example.com",
    "emailVerified": true
  }
}
```

**Error Responses:**
```json
{
  "message": "Invalid or expired verification token"
}
```

**Frontend Integration:**
```typescript
// 1. On app load, check emailVerified status
const user = await fetch('/api/auth/me', {
  headers: { 'Authorization': `Bearer ${token}` }
});

if (!user.emailVerified) {
  // Show "Verify your email" banner
  // Option to resend verification email
}

// 2. When user clicks email link with token
const result = await fetch('/api/auth/verify-email', {
  method: 'POST',
  body: JSON.stringify({ token })
});

if (result.ok) {
  // Email verified! Show success message
}
```

---

## 2. PASSWORD RESET FLOW

### Context
- User forgets their password
- Requests password reset via email
- Receives reset link with time-limited token (1 hour)
- Sets new password by clicking link and entering new password

### Flow
```
User Forgot Password → Requests Reset → Email Sent → User Clicks Link → Sets New Password ✓
```

### Endpoint: POST `/api/auth/forgot-password`

**Request:**
```json
{
  "email": "john@example.com"
}
```

**Response (200 OK):**
```json
{
  "message": "If an account exists with this email, a password reset link has been sent"
}
```

**Important:** Response is identical whether email exists or not (security measure)

**Backend Action:**
- If email exists: Generates 1-hour reset token and sends email
- If email doesn't exist: No action (for security)

---

### Endpoint: POST `/api/auth/reset-password`

**Request:**
```json
{
  "token": "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6",
  "newPassword": "NewSecurePass456!",
  "confirmPassword": "NewSecurePass456!"
}
```

**Response (200 OK):**
```json
{
  "message": "Password reset successfully. Please login with your new password."
}
```

**Error Responses:**
```json
{
  "message": "Invalid or expired password reset token"
}
```

```json
{
  "message": "Passwords do not match"
}
```

```json
{
  "message": "Password must be at least 8 characters and contain uppercase, lowercase, numbers, and symbols."
}
```

**Backend Action:**
- Validates token and expiration (1 hour)
- Validates strong password requirements
- Hashes new password
- Clears reset token
- **Blacklists all existing tokens** (forces user to re-login on all devices)

---

### Frontend Implementation

```typescript
// Step 1: User enters email
const handleForgotPassword = async (email: string) => {
  const response = await fetch('/api/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email })
  });
  
  // Always show same message (security)
  alert('Check your email for password reset instructions');
};

// Step 2: User clicks email link with token=abc123
// Frontend detects token in URL and shows reset form
const handleResetPassword = async (token: string, newPassword: string) => {
  const response = await fetch('/api/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({
      token,
      newPassword,
      confirmPassword: newPassword
    })
  });
  
  if (response.ok) {
    // Password reset successful
    // Redirect to login page
    // All old sessions are invalidated
  }
};
```

---

## 3. SESSION MANAGEMENT & LOGOUT

### Context
- Users can logout and have their token blacklisted
- Tokens are also blacklisted when:
  - Account is suspended
  - Account is locked
  - Password is reset
  - Admin takes action on account

### Endpoint: POST `/api/auth/logout`

**Request:**
```bash
POST /api/auth/logout
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response (200 OK):**
```json
{
  "message": "Logged out successfully"
}
```

**Backend Action:**
1. Extracts JWT token from Authorization header
2. Decodes to get expiration time
3. Adds token to TokenBlacklist collection with expiration
4. Logs audit event
5. Returns success

**Important:** After logout, the token cannot be used for authenticated requests

---

### How Token Blacklist Works

**Example Flow:**
```
1. User logs in → Token: abc123 (expires in 7 days)
2. User clicks logout → abc123 added to TokenBlacklist with expiration
3. User tries to use old token → Middleware checks blacklist → Request denied
4. Token expires naturally → MongoDB TTL index auto-deletes blacklist entry
```

**Middleware Check (in authMiddleware.js):**
```javascript
const protect = async (req, res, next) => {
  const token = req.headers.authorization.split(" ")[1];
  
  // 1. Check if token is blacklisted
  const blacklistedToken = await TokenBlacklist.findOne({ token });
  if (blacklistedToken) {
    return res.status(401).json({ message: "Token has been revoked" });
  }
  
  // 2. If not blacklisted, proceed with verification
  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  // ... rest of middleware
};
```

---

## 4. RATE LIMITING

### Context
Prevents brute force attacks by limiting repeated login/registration attempts

### Configuration

| Endpoint | Limit | Window |
|----------|-------|--------|
| `/api/auth/login` | 5 attempts | 15 minutes |
| `/api/auth/register` | 3 attempts | 1 hour |
| `/api/auth/forgot-password` | 3 attempts | 1 hour |

### Response When Rate Limited

**HTTP 429 Too Many Requests:**
```json
{
  "message": "Too many login attempts, please try again after 15 minutes"
}
```

**Headers:**
```
RateLimit-Limit: 5
RateLimit-Remaining: 0
RateLimit-Reset: 1234567890
```

### Implementation Details
- Rate limits are per IP address
- Requests without required fields are not counted
- Resets after specified time window
- Uses in-memory store (consider Redis for production with multiple servers)

---

## 5. UPDATED LOGIN RESPONSE

### Enhanced Login Response

**POST `/api/auth/login` Response (200 OK):**
```json
{
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "displayName": "John Doe",
    "email": "john@example.com",
    "role": "user",
    "emailVerified": false
  }
}
```

**New Checks in Login:**
1. ✅ Account is not suspended
2. ✅ Account is not locked
3. ✅ Password matches
4. ✅ Returns emailVerified status

---

## 6. ERROR HANDLING

### Common Error Responses

**Invalid Password:**
```json
{
  "message": "Invalid credentials"
}
```

**Account Suspended:**
```json
{
  "message": "Account is suspended. Please contact support."
}
```

**Account Locked:**
```json
{
  "message": "Account locked until 2024-05-10T14:30:00.000Z"
}
```

**Email Already Exists:**
```json
{
  "message": "User already exists"
}
```

**Weak Password:**
```json
{
  "message": "Password must be at least 8 characters and contain uppercase, lowercase, numbers, and symbols."
}
```

**Token Invalid/Expired:**
```json
{
  "message": "Invalid or expired verification token"
}
```

---

## 7. ENVIRONMENT VARIABLES REQUIRED

Create a `.env` file in `lykasServer/` with:

```env
# Email Configuration
EMAIL_SERVICE=gmail
EMAIL_USER=your_email@gmail.com
EMAIL_PASSWORD=your_app_password

# Frontend URLs (for email links)
FRONTEND_URL=http://localhost:3000
MOBILE_APP_URL=lykas://

# JWT
JWT_SECRET=your_super_secret_key_min_32_chars
JWT_EXPIRES_IN=7d

# MongoDB
MONGODB_URI=mongodb://localhost:27017/lykas

# Other existing vars...
```

---

## 8. TESTING GUIDE

### Manual Testing Checklist

**Email Verification:**
- [ ] Register new account → verify email in console/mailhog
- [ ] Click verification link → email marked as verified
- [ ] Try to verify with expired token → error message
- [ ] Verify endpoint blocks duplicate verification

**Password Reset:**
- [ ] Click "Forgot Password" → check email for link
- [ ] Click reset link → form appears
- [ ] Enter weak password → error message
- [ ] Enter mismatched passwords → error message
- [ ] Enter valid new password → success
- [ ] Try to login with old password → fails
- [ ] Login with new password → succeeds

**Logout & Token Blacklist:**
- [ ] Login → get token
- [ ] Call logout endpoint → success
- [ ] Try to use same token → "Token has been revoked" error
- [ ] Create new token → works normally

**Rate Limiting:**
- [ ] Try to login 5+ times → rate limited after 5
- [ ] Wait 15 minutes → can try again
- [ ] Attempt registration 3+ times → rate limited
- [ ] Wait 1 hour → can register again

---

## 9. PRODUCTION CONSIDERATIONS

### Email Service
- **Development:** Use Gmail app password or Mailhog
- **Production:** Use professional service (SendGrid, AWS SES, Mailgun)
- Set EMAIL_SERVICE and credentials in production .env

### Token Blacklist
- **Current:** In-memory MongoDB TTL collection
- **Scalability Issue:** With multiple servers, need shared store
- **Solution:** Switch to Redis for production clusters

### Rate Limiting
- **Current:** In-memory store via `express-rate-limit`
- **Scalability Issue:** Doesn't work across multiple servers
- **Solution:** Use Redis store with `rate-limit-redis` package

### HTTPS
- Always use HTTPS in production
- Email links must be HTTPS to prevent MITM attacks

---

## 10. DEPLOYMENT CHECKLIST

- [ ] All environment variables set in production
- [ ] Email service tested and configured
- [ ] JWT_SECRET is strong and unique
- [ ] Database backups configured
- [ ] HTTPS enabled
- [ ] CORS properly configured for frontend domains
- [ ] Rate limiting working with Redis (if multi-server)
- [ ] Audit logs configured
- [ ] Error monitoring (Sentry/Rollbar) integrated

---

## Next Steps (Sprint 2-3)

- Implement refresh tokens for better security
- Add 2FA for admin accounts
- Build admin dashboard for account management
- Implement notification system for email delivery verification
- Add password strength indicator on frontend
