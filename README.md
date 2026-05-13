# lykasServer — Technical Documentation

> **Repository:** [Kernharu58/lykasServer @ branch 2.0](https://github.com/Kernharu58/lykasServer/tree/2.0)  
> **Project:** Lykas — Pet Adoption & Shelter Volunteer Management Backend  
> **Runtime:** Node.js · Express 5 · MongoDB (Mongoose)

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Technology Stack](#2-technology-stack)
3. [Project Structure](#3-project-structure)
4. [Getting Started](#4-getting-started)
5. [Environment Variables](#5-environment-variables)
6. [Authentication](#6-authentication)
7. [API Reference](#7-api-reference)
   - [Auth Endpoints](#auth-endpoints)
   - [Pet Endpoints](#pet-endpoints)
   - [Adoption Endpoints](#adoption-endpoints)
   - [Appointment / Volunteer Shift Endpoints](#appointment--volunteer-shift-endpoints)
   - [Manual Payment Recording Endpoints](#manual-payment-recording-endpoints)
   - [User Identity Verification Endpoints](#user-identity-verification-endpoints)
   - [Settings Endpoints](#settings-endpoints)
8. [Middleware](#8-middleware)
9. [Background Jobs (Cron)](#9-background-jobs-cron)
10. [Image Uploads (Cloudinary)](#10-image-uploads-cloudinary)
11. [Security Features](#11-security-features)
12. [Error Reference](#12-error-reference)
13. [Production Considerations](#13-production-considerations)
14. [Deployment Checklist](#14-deployment-checklist)

---

## 1. Project Overview

**lykasServer** is the Express-based REST API backend for the **Lykas** mobile application — a pet adoption and shelter volunteer management platform. It handles:

- User registration, login, and identity via JWT
- Email verification and password reset flows
- Pet listings with search and filtering
- Adoption applications with admin review/approval
- Volunteer shift scheduling (appointments)
- Image storage via Cloudinary
- Audit logging for all critical actions
- Google OAuth sign-in (Web, Android, iOS)

---

## 2. Technology Stack

| Category | Package | Version |
|---|---|---|
| Runtime | Node.js | 18+ |
| Framework | Express | ^5.2.1 |
| Database | MongoDB via Mongoose | ^9.3.1 |
| Authentication | jsonwebtoken | ^9.0.3 |
| Password hashing | bcryptjs | ^3.0.3 |
| Google OAuth | google-auth-library | ^10.6.2 |
| Email | nodemailer | ^6.9.7 |
| Image storage | cloudinary + multer-storage-cloudinary | ^2.9.0 / ^4.0.0 |
| File uploads | multer | ^2.1.1 |
| Rate limiting | express-rate-limit | ^8.3.2 |
| Scheduled jobs | node-cron | ^4.2.1 |
| Real-time | socket.io | ^4.8.3 |
| HTTP client | axios | ^1.15.2 |
| Security headers | helmet | ^8.1.0 |
| CORS | cors | ^2.8.6 |
| Environment | dotenv | ^17.3.1 |
| Dev server | nodemon | ^3.1.14 |

---

## 3. Project Structure

```
lykasServer/
├── src/
│   ├── server.js                       # Entry point — Express app setup
│   ├── cronJob.js                      # Scheduled background tasks
│   ├── config/
│   │   ├── db.js                       # MongoDB connection
│   │   └── cloudinary.js              # Cloudinary + Multer upload middleware
│   ├── controllers/
│   │   ├── authController.js          # Register, login, logout, OAuth, email flows
│   │   ├── petController.js           # Pet CRUD + adoption applications
│   │   ├── appointmentController.js   # Volunteer shift management
│   │   ├── settingsController.js      # Shelter settings (address, phone, email)
│   │   ├── applicationCtrl.js         # (stub) Adoption application controller
│   │   └── volunteerCtrl.js           # (stub) Volunteer controller
│   ├── middleware/
│   │   ├── authMiddleware.js          # JWT protect + role-based access (restrictTo)
│   │   └── rateLimitMiddleware.js     # Per-IP rate limiting for auth routes
│   ├── models/
│   │   ├── User.js                    # User schema (includes identityVerified, identityStatus)
│   │   ├── Pet.js                     # Pet schema
│   │   ├── Appointment.js             # Volunteer shift schema
│   │   ├── Application.js             # Adoption application schema
│   │   ├── AuditLog.js                # Audit trail schema
│   │   ├── Donation.js                # Manual payment record schema
│   │   ├── IdentityVerification.js    # User identity submission schema
│   │   ├── TokenBlacklist.js          # Revoked JWT storage (TTL)
│   │   └── Settings.js                # Shelter-wide settings schema
│   ├── routes/
│   │   └── (route files per resource)
│   └── utils/
│       └── emailService.js            # nodemailer helpers (verification, reset)
├── .env.example                        # Environment variable template
├── .gitignore
├── package.json
├── SPRINT_1_API_DOCS.md               # Sprint 1 auth/security API reference
└── SPRINT_1_SETUP_GUIDE.md           # Sprint 1 setup and deployment guide
```

---

## 4. Getting Started

### Prerequisites

- Node.js 18+
- A running MongoDB instance (local or Atlas)
- A Gmail account with an App Password (or another SMTP provider)
- A Cloudinary account (for image uploads)

### Installation

```bash
# Clone the repository and switch to branch 2.0
git clone https://github.com/Kernharu58/lykasServer.git
cd lykasServer
git checkout 2.0

# Install dependencies
npm install

# Copy environment template
cp .env.example .env
# Edit .env with your real values (see Environment Variables section)
```

### Running the Server

```bash
# Development (auto-restart on file changes)
npm run dev

# Production
npm start
```

The server listens on the port defined by `PORT` in `.env` (default: `3001`).

---

## 5. Environment Variables

Copy `.env.example` to `.env` and fill in every value before starting the server.

```env
# ============ DATABASE ============
MONGODB_URI=mongodb://localhost:27017/lykas

# ============ JWT & SECURITY ============
JWT_SECRET=your_super_secret_jwt_key_here_min_32_chars
JWT_EXPIRES_IN=7d

# ============ CLOUDINARY (Image Storage) ============
CLOUDINARY_CLOUD_NAME=your_cloudinary_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret

# ============ EMAIL SERVICE ============
# For Gmail: enable 2FA, then generate an App Password at
# https://myaccount.google.com/apppasswords
EMAIL_SERVICE=gmail
EMAIL_USER=your_email@gmail.com
EMAIL_PASSWORD=your_app_password_here

# ============ FRONTEND URLs (used in email links) ============
FRONTEND_URL=http://localhost:3000
MOBILE_APP_URL=lykas://

# ============ GOOGLE OAUTH ============
GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
ANDROID_CLIENT_ID=your_android_client_id.apps.googleusercontent.com
IOS_CLIENT_ID=your_ios_client_id.apps.googleusercontent.com

# ============ SERVER ============
PORT=3001
NODE_ENV=development
BACKEND_URL=https://your-app.onrender.com   # Used by cron ping job
```

| Variable | Required | Description |
|---|---|---|
| `MONGODB_URI` | Yes | Full MongoDB connection string |
| `JWT_SECRET` | Yes | Minimum 32 characters, kept secret |
| `JWT_EXPIRES_IN` | Yes | e.g. `7d`, `24h` |
| `CLOUDINARY_*` | Yes | Cloudinary account credentials |
| `EMAIL_SERVICE` | Yes | `gmail`, `yahoo`, `sendgrid`, etc. |
| `EMAIL_USER` | Yes | SMTP sending address |
| `EMAIL_PASSWORD` | Yes | App password (not your login password) |
| `FRONTEND_URL` | Yes | Base URL for email verification links |
| `MOBILE_APP_URL` | Yes | Deep link scheme for mobile email links |
| `GOOGLE_CLIENT_ID` | OAuth only | Web Google client ID |
| `ANDROID_CLIENT_ID` | OAuth only | Android Google client ID |
| `IOS_CLIENT_ID` | OAuth only | iOS Google client ID |
| `PORT` | No | Server port, defaults to `3001` |
| `BACKEND_URL` | No | Used by cron health-ping job |

---

## 6. Authentication

### Strategy

All protected routes use **JWT Bearer tokens**. Include the token in every request:

```
Authorization: Bearer <token>
```

Tokens are signed with `JWT_SECRET` and expire after `JWT_EXPIRES_IN`. On logout, the token is stored in a MongoDB `TokenBlacklist` collection with a TTL index — expired tokens are deleted automatically by MongoDB.

### User Roles

| Role | Description |
|---|---|
| `user` | Standard registered user / adopter |
| `staff` | Shelter staff — can manage pets and shifts |
| `admin` | Full admin access |
| `super_admin` | Unrestricted access |

### Account Statuses

| Status | Effect |
|---|---|
| `active` | Normal access |
| `suspended` | All authenticated requests blocked (403) |
| `locked` | Blocked until `lockedUntil` timestamp; auto-unlocks when time passes |

---

## 7. API Reference

Base URL: `http://localhost:3001` (development)  
All request and response bodies use `Content-Type: application/json` unless uploading a file (multipart/form-data).

---

### Auth Endpoints

#### POST `/api/auth/register`

Register a new user. Sends an email verification link.

**Request body:**

```json
{
  "displayName": "Jane Doe",
  "email": "jane@example.com",
  "password": "SecurePass123!"
}
```

> Password must contain uppercase, lowercase, a number, and a symbol (minimum 8 characters).

**Response `201`:**

```json
{
  "message": "Signup successful! Please check your email to verify your account.",
  "token": "<jwt>",
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "displayName": "Jane Doe",
    "email": "jane@example.com",
    "role": "user",
    "emailVerified": false
  }
}
```

**Rate limit:** 3 attempts per IP per hour.

---

#### POST `/api/auth/login`

Authenticate and receive a JWT token.

**Request body:**

```json
{
  "email": "jane@example.com",
  "password": "SecurePass123!"
}
```

**Response `200`:**

```json
{
  "message": "Login successful",
  "token": "<jwt>",
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "displayName": "Jane Doe",
    "email": "jane@example.com",
    "role": "user",
    "emailVerified": false
  }
}
```

**Rate limit:** 5 attempts per IP per 15 minutes.

---

#### POST `/api/auth/logout` 🔒

Blacklist the current token, invalidating it immediately on all devices.

**Headers:** `Authorization: Bearer <token>`

**Response `200`:**

```json
{ "message": "Logged out successfully" }
```

---

#### POST `/api/auth/verify-email`

Verify a user's email address using the token sent in the registration email.

**Request body:**

```json
{ "token": "a1b2c3d4..." }
```

**Response `200`:**

```json
{
  "message": "Email verified successfully",
  "user": { "id": "...", "emailVerified": true }
}
```

The token is valid for 24 hours.

---

#### POST `/api/auth/forgot-password`

Request a password reset email. Always returns the same response regardless of whether the email exists (prevents account enumeration).

**Request body:**

```json
{ "email": "jane@example.com" }
```

**Response `200`:**

```json
{
  "message": "If an account exists with this email, a password reset link has been sent"
}
```

**Rate limit:** 3 attempts per IP per hour.

---

#### POST `/api/auth/reset-password`

Set a new password using the token from the reset email. Invalidates all existing sessions.

**Request body:**

```json
{
  "token": "a1b2c3d4...",
  "newPassword": "NewSecurePass456!",
  "confirmPassword": "NewSecurePass456!"
}
```

**Response `200`:**

```json
{
  "message": "Password reset successfully. Please login with your new password."
}
```

The reset token expires after 1 hour. On success, all existing JWT tokens for that account are blacklisted.

---

### Pet Endpoints

#### GET `/api/pets`

List available and pending pets. Supports optional filters.

**Query parameters:**

| Param | Description | Example |
|---|---|---|
| `category` | Filter by species | `category=Dog` |
| `search` | Keyword search on name and breed | `search=labrador` |

**Response `200`:** Array of pet objects.

---

#### GET `/api/pets/:id`

Fetch a single pet by its MongoDB ID.

**Response `200`:** Pet object  
**Response `404`:** `{ "message": "Pet not found" }`

---

#### POST `/api/pets` 🔒 (staff/admin)

Create a new pet listing. Accepts `multipart/form-data` for image upload.

**Form fields:**

| Field | Type | Description |
|---|---|---|
| `name` | string | Pet's name |
| `species` or `type` | string | e.g. `Dog`, `Cat` |
| `breed` | string | Breed |
| `age` | number | Age |
| `status` | string | `Available`, `Pending`, `Adopted` |
| `image` | file | Pet photo (JPG/PNG, max 5 MB) |

**Response `201`:** Created pet object.

---

#### PUT `/api/pets/:id` 🔒 (staff/admin)

Update a pet's details. Accepts `multipart/form-data`.

**Response `200`:** Updated pet object.

---

#### DELETE `/api/pets/:id` 🔒 (staff/admin)

Permanently remove a pet from the system.

**Response `200`:** `{ "message": "Pet successfully removed from shelter." }`

---

#### GET `/api/pets/my` 🔒

Return all pets owned or adopted by the currently authenticated user.

**Response `200`:** Array of pet objects.

---

### Adoption Endpoints

#### POST `/api/pets/:id/adopt` 🔒

Submit an adoption application for a pet.

**Request body:**

```json
{
  "phone": "555-1234",
  "address": "123 Main St, City",
  "experience": "I have owned dogs before and have a fenced yard."
}
```

**Response `201`:**

```json
{
  "message": "Application submitted for Buddy!",
  "application": { ... }
}
```

Returns `400` if the pet is already adopted or if a pending application already exists from this user.

---

#### GET `/api/pets/adoptions/pending` 🔒 (staff/admin)

List all pending adoption applications, with applicant and pet details populated.

**Response `200`:** Array of application objects sorted by creation date.

---

#### PUT `/api/pets/adoptions/:id/status` 🔒 (staff/admin)

Approve or reject an adoption application.

**Request body:**

```json
{ "status": "approved" }
```

`status` must be `"approved"` or `"rejected"`.

**Approval side effects:**
- Sets pet status to `Adopted`
- Sets pet owner to the applicant
- Rejects all other pending applications for the same pet

**Rejection side effects:**
- Sets pet status back to `Available`
- Clears the pet owner

**Response `200`:** Updated application object.

---

### Appointment / Volunteer Shift Endpoints

#### GET `/api/appointments` 🔒

List all volunteer shifts sorted by date.

- **Admins/staff** see full details including enrolled user information.
- **Regular users** receive the shift list without the `enrolledUsers` field.

**Response `200`:** Array of appointment objects.

---

#### POST `/api/appointments` 🔒 (staff/admin)

Create a new volunteer shift.

**Request body:**

```json
{
  "title": "Morning Dog Walking",
  "date": "2026-06-01T08:00:00.000Z",
  "durationHours": 2,
  "capacity": 5,
  "status": "Open"
}
```

**Response `201`:** Created appointment object.

---

#### POST `/api/appointments/:id/enroll` 🔒

Enroll the current user in a shift.

**Request body:**

```json
{
  "phone": "555-9876",
  "emergencyContact": "Mom — 555-1111",
  "notes": "Allergic to cats, fine with dogs."
}
```

Returns `400` if:
- The shift is not `Open`
- The user already has a shift at an overlapping time
- The shift is full or the user is already enrolled

**Response `200`:**

```json
{
  "message": "Successfully enrolled!",
  "appointment": { ... }
}
```

When capacity is reached, the shift status automatically changes to `"Full"`.

---

#### DELETE `/api/appointments/:id/enroll` 🔒

Cancel the current user's enrollment in a shift. If the shift was `Full`, its status reverts to `Open`.

**Response `200`:** `{ "message": "You have dropped this shift." }`

---

#### GET `/api/appointments/my` 🔒

Return all shifts the current user is enrolled in.

**Response `200`:** Array of appointment objects.

---

#### PUT `/api/appointments/:id` 🔒 (staff/admin)

Update a shift's details (title, date, capacity, status, etc.).

**Response `200`:** Updated appointment object.

---

#### DELETE `/api/appointments/:id` 🔒 (staff/admin)

Delete a shift permanently.

**Response `200`:** `{ "message": "Shift successfully deleted." }`

---

### Manual Payment Recording Endpoints

#### GET `/api/donations` 🔒 (staff/admin)

List all recorded donation/payment entries, sorted by date descending.

**Query parameters:**

| Param | Description | Example |
|---|---|---|
| `status` | Filter by verification status | `status=pending` |
| `donorName` | Filter by donor name | `donorName=Juan` |

**Response `200`:** Array of donation record objects.

---

#### POST `/api/donations` 🔒 (staff/admin)

Manually record a new donation or payment received in-person or via bank transfer.

**Request body:**

```json
{
  "donorName": "Maria Santos",
  "amount": 500.00,
  "currency": "PHP",
  "paymentMethod": "bank_transfer",
  "referenceNumber": "BT-20260513-001",
  "notes": "Donated for food supplies",
  "date": "2026-05-13T10:00:00.000Z"
}
```

**Fields:**

| Field | Type | Required | Description |
|---|---|---|---|
| `donorName` | string | Yes | Name of the donor |
| `amount` | number | Yes | Donation amount |
| `currency` | string | No | Default `"PHP"` |
| `paymentMethod` | string | Yes | `cash`, `bank_transfer`, `gcash`, `other` |
| `referenceNumber` | string | No | Bank or e-wallet reference number |
| `notes` | string | No | Additional notes |
| `date` | ISO string | Yes | Date the payment was received |

**Response `201`:** Created donation record object.

---

#### PUT `/api/donations/:id` 🔒 (staff/admin)

Update an existing donation record.

**Response `200`:** Updated donation record object.

---

#### DELETE `/api/donations/:id` 🔒 (admin)

Permanently remove a donation record.

**Response `200`:** `{ "message": "Donation record deleted." }`

---

### User Identity Verification Endpoints

#### POST `/api/auth/verify-identity` 🔒

Submit a government-issued ID for identity verification. Accepts `multipart/form-data`.

**Form fields:**

| Field | Type | Description |
|---|---|---|
| `idType` | string | Type of ID: `national_id`, `passport`, `drivers_license`, `philsys` |
| `idNumber` | string | The ID number on the document |
| `idFront` | file | Front image of the ID (JPG/PNG, max 5 MB) |
| `idBack` | file | Back image of the ID (optional for passport) |
| `selfie` | file | Selfie photo holding the ID (optional but recommended) |

**Response `201`:**

```json
{
  "message": "Identity verification submitted. Awaiting admin review.",
  "verificationId": "507f1f77bcf86cd799439099",
  "status": "pending"
}
```

Returns `400` if a pending or approved submission already exists for the user.

---

#### GET `/api/auth/verify-identity/status` 🔒

Check the current user's identity verification status.

**Response `200`:**

```json
{
  "status": "pending",
  "submittedAt": "2026-05-13T09:00:00.000Z",
  "reviewedAt": null,
  "rejectionReason": null
}
```

Possible `status` values: `not_submitted`, `pending`, `approved`, `rejected`.

---

#### GET `/api/admin/identity-verifications` 🔒 (staff/admin)

List all pending and historical identity verification submissions.

**Query parameters:**

| Param | Description |
|---|---|
| `status` | Filter by `pending`, `approved`, `rejected` |

**Response `200`:** Array of verification objects with user info and uploaded image URLs.

---

#### PUT `/api/admin/identity-verifications/:id/status` 🔒 (staff/admin)

Approve or reject a user's identity verification submission.

**Request body:**

```json
{
  "status": "approved",
  "rejectionReason": null
}
```

`status` must be `"approved"` or `"rejected"`. `rejectionReason` is required when rejecting.

**Approval side effects:**
- Sets `user.identityVerified = true` on the User document
- Sends a confirmation email to the user

**Rejection side effects:**
- Leaves `user.identityVerified = false`
- Sends a rejection email with the reason so the user can resubmit

**Response `200`:** Updated verification object.

---

### Settings Endpoints

#### GET `/api/settings`

Fetch the shelter's public settings (address, phone, email). Creates a default document if none exists.

**Response `200`:**

```json
{
  "address": "123 Shelter Lane",
  "phone": "555-0000",
  "email": "shelter@example.com"
}
```

---

#### PUT `/api/settings` 🔒 (admin)

Update the shelter's contact settings.

**Request body:**

```json
{
  "address": "456 New Street",
  "phone": "555-9999",
  "email": "newcontact@example.com"
}
```

**Response `200`:** Updated settings object.

---

## 8. Middleware

### `protect` — JWT Authentication

Applied to all 🔒 routes. Validates the Bearer token, checks the token blacklist, loads the user from the database, and enforces account status.

```
Request → Check Authorization header → Check blacklist → Verify JWT → Load user → Check status → next()
```

Possible rejections:

| Status | Message |
|---|---|
| 401 | `Not authorized, no token provided` |
| 401 | `Not authorized, token failed` |
| 401 | `Token has been revoked` |
| 403 | `Account is suspended.` |
| 403 | `Account locked until <date>` |

### `restrictTo(...roles)` — Role-Based Access

Placed after `protect`. Blocks the request if the authenticated user's role is not in the allowed list.

```javascript
router.delete('/pets/:id', protect, restrictTo('admin', 'staff'), deletePet);
```

Returns `403` with `"You do not have permission to perform this action."` if the role check fails.

### Rate Limiters

All limiters use per-IP in-memory storage (not shared across multiple server instances — use Redis for clustered production).

| Limiter | Route | Limit | Window |
|---|---|---|---|
| `loginLimiter` | `POST /api/auth/login` | 5 requests | 15 minutes |
| `registerLimiter` | `POST /api/auth/register` | 3 requests | 1 hour |
| `passwordResetLimiter` | `POST /api/auth/forgot-password` | 3 requests | 1 hour |

Requests that are missing required body fields are not counted toward the limit.

**Rate limit response `429`:**

```json
{ "message": "Too many login attempts, please try again after 15 minutes" }
```

---

## 9. Background Jobs (Cron)

Located in `src/cronJob.js`. Jobs are initialized when the server starts.

### Health Ping (every 14 minutes)

Prevents the free-tier Render dyno from sleeping by making a `GET /health` request to `BACKEND_URL`.

```
*/14 * * * *
```

### Daily Cleanup (midnight)

Placeholder for scheduled maintenance tasks (e.g. removing unverified accounts older than 3 days).

```
0 0 * * *
```

---

## 10. Image Uploads (Cloudinary)

Configured in `src/config/cloudinary.js`. Pet photos (and profile pictures) are uploaded directly to Cloudinary via the `multer-storage-cloudinary` storage engine.

**Storage settings:**

| Setting | Value |
|---|---|
| Folder | `carepaws_profiles` |
| Allowed formats | jpg, png, jpeg |
| Transformation | Resized to 500×500 (limit crop) |
| Max file size | `MAX_FILE_SIZE` env var, default 5 MB |

The uploaded file URL is returned in `req.file.path` and stored as `imageUrl` on the pet or user document.

---

## 11. Security Features

### Token Blacklist

After logout or a password reset, the current JWT is stored in the `TokenBlacklist` collection. Every authenticated request checks this collection before proceeding. MongoDB's TTL index removes entries automatically when the token's natural expiry is reached.

### Audit Log

All write operations create an entry in the `AuditLog` collection. Logged events include:

| Event | Trigger |
|---|---|
| `PET_CREATE` | New pet listing created |
| `PET_UPDATE` | Pet details updated |
| `PET_DELETE` | Pet removed |
| `ADOPTION_APPLICATION_SUBMITTED` | User applies to adopt |
| `SHIFT_CREATE` | New volunteer shift created |
| `SHIFT_UPDATE` | Shift details changed |
| `SHIFT_DELETE` | Shift removed |
| `DONATION_RECORD_CREATE` | Manual payment/donation entry recorded |
| `DONATION_RECORD_UPDATE` | Donation record edited |
| `IDENTITY_VERIFICATION_SUBMITTED` | User submits government ID for verification |
| `IDENTITY_VERIFICATION_APPROVED` | Admin approves user identity |
| `IDENTITY_VERIFICATION_REJECTED` | Admin rejects user identity submission |

Each log entry records the actor's user ID, the target user (if applicable), and relevant metadata.

### Password Requirements

Passwords are validated before hashing. They must be at least 8 characters and contain at minimum one uppercase letter, one lowercase letter, one number, and one symbol.

### Helmet

The `helmet` package is applied at the server level to set secure HTTP headers (Content-Security-Policy, X-Frame-Options, etc.).

### Google OAuth

Google ID tokens (from Web, Android, or iOS clients) are verified server-side via `google-auth-library`. The server accepts tokens from the configured client IDs only.

---

## 12. Error Reference

| HTTP Status | Typical Message | Cause |
|---|---|---|
| 400 | `Name, email, and password are required` | Missing registration fields |
| 400 | `User already exists` | Duplicate email on registration |
| 400 | `Password must be at least 8 characters…` | Weak password |
| 400 | `Pet is no longer available` | Adopting a pet that is Pending/Adopted |
| 400 | `You already have a pending application for this pet` | Duplicate adoption application |
| 400 | `Shift is full or you are already signed up` | Enrollment conflict |
| 400 | `You already have a shift during this time` | Overlapping shift enrollment |
| 401 | `Invalid credentials` | Wrong password on login |
| 401 | `Token has been revoked` | Using a blacklisted token |
| 401 | `Not authorized, token failed` | JWT signature/expiry invalid |
| 403 | `Account is suspended.` | Suspended account |
| 403 | `Account locked until <date>` | Locked account |
| 403 | `You do not have permission…` | Insufficient role |
| 404 | `Pet not found` | Invalid or deleted pet ID |
| 404 | `Application not found` | Invalid application ID |
| 409 | `This email is already registered` | Duplicate key on email |
| 422 | `Invalid or expired verification token` | Bad or expired email token |
| 422 | `Invalid or expired password reset token` | Bad or expired reset token |
| 422 | `Passwords do not match` | Mismatched confirm password |
| 429 | `Too many login attempts…` | Rate limit exceeded |
| 400 | `Identity verification already submitted` | Duplicate pending/approved submission |
| 400 | `idType is required` | Missing ID type on submission |
| 404 | `Verification not found` | Invalid verification ID |
| 500 | `Server Error` / `Server error during signup` | Unhandled server exception |

---

## 13. Production Considerations

### Email

| Environment | Recommended service |
|---|---|
| Development | Gmail App Password or Mailhog |
| Production | SendGrid, AWS SES, or Mailgun |

### Rate Limiting

Current implementation uses in-memory storage. **Not suitable for multi-instance deployments.** Replace with [`rate-limit-redis`](https://www.npmjs.com/package/rate-limit-redis) when running more than one server process.

### Token Blacklist

Current implementation queries MongoDB on every authenticated request. For high-traffic deployments, add a Redis caching layer to avoid the repeated DB round-trip.

### HTTPS

Always enable HTTPS in production. All email links (verification, password reset) must use HTTPS to prevent man-in-the-middle attacks.

### CORS

Configure `cors` to allow only your known frontend and mobile app origins in production. Do not leave it open to all origins.

---

## 14. Deployment Checklist

- [ ] All environment variables configured in the hosting platform (not in `.env` in version control)
- [ ] `JWT_SECRET` is at least 32 characters, randomly generated, and unique per environment
- [ ] Email service tested end-to-end (registration email, password reset email)
- [ ] Cloudinary credentials set and tested with a file upload
- [ ] MongoDB Atlas connection string set and IP whitelist configured
- [ ] `HTTPS` enabled and certificates valid
- [ ] `CORS` restricted to production frontend/app domains only
- [ ] Rate limiting tested; Redis store configured if multi-instance
- [ ] `BACKEND_URL` set for the cron health-ping job
- [ ] Cloudinary folder for identity documents configured separately (e.g. `carepaws_identity_docs`)
- [ ] Identity verification email templates tested (approval and rejection)
- [ ] Error monitoring integrated (e.g. Sentry)
- [ ] Database backups scheduled
- [ ] Audit log collection indexed and monitored
- [ ] `NODE_ENV=production` set

---

*Generated from source: [Kernharu58/lykasServer @ 2.0](https://github.com/Kernharu58/lykasServer/tree/2.0)*
