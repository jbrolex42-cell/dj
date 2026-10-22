# DJ's Adult Family Home — Full-stack website

A responsive public website and starter admin dashboard built with plain HTML/CSS/JavaScript, Node.js, Express, and MongoDB.

## Features
- Responsive home page, care services, amenities, gallery, contact and inquiry form.
- Express REST API with MongoDB models for inquiries, rooms, services and administrators.
- Admin login using bcrypt password hashing and JWT in an HttpOnly cookie.
- Admin dashboard to view/update inquiries and manage room availability.
- Basic security middleware: Helmet, rate limiting, input validation, cookie protections and compression.

## Requirements
- Node.js 18+
- MongoDB local install or a MongoDB Atlas database

## Setup
1. Install Node.js and MongoDB, or create a MongoDB Atlas cluster.
2. In this folder run `npm install`.
3. Copy `.env.example` to `.env` and configure `MONGODB_URI`, `JWT_SECRET`, and admin details.
4. Run `npm run create-admin` once to create the initial administrator account.
5. Run `npm run dev` for development or `npm start` for production.
6. Open `http://localhost:3000`.

## Important before publishing
- Replace sample text, phone/email, address, services, availability and stock photos with verified business information.
- Do not claim a service, certification, license, or room availability unless it is accurate.
- Use a strong unique `JWT_SECRET` and strong admin password.
- Deploy behind HTTPS. Configure your hosting provider's environment variables; do not upload `.env`.
- Set `NODE_ENV=production` in production.
- This starter stores inquiry details; publish an appropriate privacy notice and limit access to the admin account.
- Consider adding email notifications, spam protection, image hosting, backups, audit logs and a password reset flow before production use.
- The initial admin creation script refuses to overwrite an existing account with the same email.

## API overview
Public:
- `GET /api/public/site` — public site content, room availability and care services
- `POST /api/inquiries` — submit an inquiry

Admin (requires login):
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `GET /api/admin/inquiries`
- `PATCH /api/admin/inquiries/:id`
- `GET /api/admin/rooms`
- `POST /api/admin/rooms`
- `PATCH /api/admin/rooms/:id`
- `DELETE /api/admin/rooms/:id`

This is a working foundation, not a substitute for a production security review. No real business contact details or claims have been fabricated.

## Enhanced care-finding homepage

The homepage now includes a location prompt, care-type selector, direct-contact trust strip, dynamic room cards, a three-question care-orientation quiz, a care-setting comparison guide, payment-program questions/disclaimer, and a family guidance section. The location prompt is informational and only the DJ's Adult Family Home listing is currently supported; it does not search a regional multi-provider directory. The quiz provides general orientation only and does not assess medical needs or eligibility. Payment program acceptance and room availability must be confirmed with the home. Public resident registration/login is not implemented; `/admin.html` is for authorized administrators only.

After replacing project files, run `npm run dev` again. If the server is already running under nodemon, it should restart after changes; refresh the browser with Ctrl+F5 to clear cached assets.


## Public family accounts (added)
- `/register.html` lets families create a public account; passwords are hashed with bcrypt.
- `/login.html` signs users in and sets an HttpOnly, SameSite cookie.
- `/account.html` is a basic protected account page.
- Public accounts are stored separately from administrator accounts. Admin login remains `/admin.html`.
- Registration/login endpoints: `POST /api/accounts/register`, `POST /api/accounts/login`, `POST /api/accounts/logout`, `GET /api/accounts/me`.

Before public launch: use a strong unique `JWT_SECRET`, ensure HTTPS in production, configure email verification and password reset, add privacy/terms pages, and run end-to-end security tests. Public accounts currently do not save favorites or bookings; those need additional backend models and UI.


## Admin photo uploads and website updates

Sign in at `/admin.html` to upload room photos, publish gallery photos, and post website updates or announcements. Supported image types are JPG, PNG, WEBP, and GIF, up to 5 MB each. Uploaded files are stored in the local `uploads/` directory, while captions and posts are stored in MongoDB. Back up both MongoDB and `uploads/`. The hosting environment must allow persistent disk storage; for serverless hosting, use object storage instead. Only upload photos you have permission to publish, and do not post identifiable resident photos or private care information without appropriate consent.

The upload dependency is `multer`; run `npm install` after replacing project files. These features have been syntax-checked, but still need end-to-end testing on your computer with MongoDB running.
