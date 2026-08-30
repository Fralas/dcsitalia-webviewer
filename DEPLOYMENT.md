# DCS Warehouse Viewer - Deployment Guide

## Security Features Implemented

✅ **Authentication & Authorization**
- JWT-based authentication
- Token expiration (24h default)
- Admin role verification
- Protected API endpoints

✅ **Security Headers**
- Helmet.js for HTTP security headers
- CORS configuration per environment

✅ **Rate Limiting**
- 100 requests per 15 minutes per IP (configurable)
- Protection against brute force attacks

✅ **Environment Variables**
- Sensitive configuration in .env files
- .gitignore configured to exclude secrets

✅ **Error Handling**
- Global error handler
- Structured logging
- Production-safe error messages

✅ **Input Validation**
- Request validation
- Authentication checks on all protected routes

## Production Deployment Checklist

### 1. Environment Variables

Create a `.env` file in the `backend/` directory:

```bash
# Server Configuration
NODE_ENV=production
PORT=3001

# Security - CHANGE THESE IN PRODUCTION!
JWT_SECRET=<generate-a-strong-random-secret>
ADMIN_PASSWORD=<your-secure-admin-password>

# CORS
FRONTEND_URL=https://your-production-domain.com

# Session
SESSION_TIMEOUT=24h

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

Create a `.env` file in the `frontend/` directory:

```bash
VITE_API_URL=https://your-api-domain.com/api
VITE_WS_URL=https://your-api-domain.com
```

### 2. Generate Secure JWT Secret

Run this command to generate a secure random secret:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Copy the output to your `JWT_SECRET` in the backend `.env` file.

### 3. Change Admin Password

⚠️ **IMPORTANT**: Change the default admin password in the backend `.env` file:

```bash
ADMIN_PASSWORD=your-very-secure-password-here
```

### 4. HTTPS/SSL Configuration

**REQUIRED FOR PRODUCTION**

You must use HTTPS in production. Options:

1. **Reverse Proxy (Recommended)**
   - Use Nginx or Apache with SSL certificates
   - Let backend run on localhost
   - Proxy requests through SSL

2. **Direct HTTPS**
   - Add SSL certificates to Express
   - Configure HTTPS in server.js

Example Nginx configuration:

```nginx
server {
    listen 443 ssl;
    server_name your-domain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 5. Install Dependencies

```bash
# Backend
cd backend
npm install --production

# Frontend
cd ../frontend
npm install
npm run build
```

### 6. Start the Application

**Backend:**
```bash
cd backend
NODE_ENV=production node src/server.js
```

Or use PM2 for process management:
```bash
npm install -g pm2
pm2 start src/server.js --name dcs-warehouse-api
pm2 save
pm2 startup
```

**Frontend:**
Serve the built `dist/` folder with a web server (Nginx, Apache, etc.)

### 7. Firewall Configuration

- Open port 443 (HTTPS)
- Block direct access to backend port (3001)
- Allow only localhost connections to backend

### 8. Database Backups

The application stores mutable state in `data/app.sqlite` (WAL mode). Run an online-consistent snapshot with:

```bash
npm run data:backup
# optional destination file or directory
npm run data:backup -- /backups/dcs-app.sqlite
```

Restore only while the server is stopped:

```bash
npm run data:restore -- /path/to/app-backup.sqlite
```

Imported legacy JSON is moved to `data/legacy-json/` and is not live data. DCS export files (`Export_*.json`, CSV, `frontlineZones.json`) stay in place.

`node:sqlite` is experimental in current Node: pin a Node 22.13+ LTS before upgrading the runtime.

Run a single Node process against a given `SQLITE_PATH`. In-memory caches (map snapshot, ATC board) are not synchronized across multiple processes.

### 9. Monitoring & Logging

- Monitor application logs
- Set up alerts for security events
- Track failed login attempts
- Monitor rate limit hits

### 10. Security Best Practices

✅ Keep dependencies updated:
```bash
npm audit
npm audit fix
```

✅ Regular security scans:
```bash
npm install -g snyk
snyk test
```

✅ Review logs regularly for suspicious activity

✅ Use strong passwords (min 16 characters, mixed case, numbers, symbols)

✅ Consider implementing:
- Two-factor authentication
- IP whitelisting for admin panel
- Additional rate limiting on login endpoint

## Testing the Deployment

1. **Test Authentication:**
   ```bash
   curl -X POST https://your-domain.com/api/admin/login \
     -H "Content-Type: application/json" \
     -d '{"password":"your-password"}'
   ```

2. **Test Protected Endpoints:**
   ```bash
   curl https://your-domain.com/api/admin/config/rules \
     -H "Authorization: Bearer YOUR_TOKEN"
   ```

3. **Test Rate Limiting:**
   Make 100+ requests quickly and verify 429 responses

4. **Test HTTPS:**
   Verify SSL certificate is valid and all requests use HTTPS

## Troubleshooting

### JWT_SECRET not defined
```
Error: JWT_SECRET is not defined in environment variables
```
**Solution:** Add JWT_SECRET to backend/.env file

### CORS errors in browser
**Solution:** Update FRONTEND_URL in backend/.env to match your frontend domain

### Admin login not working
**Solution:** Check ADMIN_PASSWORD in backend/.env matches login attempt

### Rate limit too restrictive
**Solution:** Adjust RATE_LIMIT_MAX_REQUESTS and RATE_LIMIT_WINDOW_MS in .env

## Security Incident Response

If you suspect a security breach:

1. Immediately change ADMIN_PASSWORD
2. Regenerate JWT_SECRET (will invalidate all active sessions)
3. Review logs for suspicious activity
4. Check for unauthorized data access
5. Update all dependencies

## Support

For security issues, please report privately to the repository maintainer.
