# Production Email Tracking Setup Guide

## Overview

This guide explains how to set up email tracking (open/click notifications) for production deployment.

## Why Email Tracking Requires Special Configuration

Email tracking works by embedding:
1. **Tracking Pixel** - A 1x1 transparent image that fires when email is opened
2. **Tracked Links** - Links that redirect through your server before going to the destination

For this to work in production:
- The tracking URLs must be publicly accessible
- The domain should be trusted (related to your email sending domain)
- HTTPS is required for most email clients

## Quick Setup Checklist

- [ ] Set `TRACKING_BASE_URL` to your production API domain
- [ ] Ensure your API domain has valid SSL certificate
- [ ] Match tracking domain to email sending domain (recommended)
- [ ] Test by sending an email and opening it

## Configuration Steps

### Step 1: Update Environment Variables

In your production `.env` or PM2 ecosystem config:

```env
# Use your production API URL
TRACKING_BASE_URL=https://api.yourdomain.com
```

**Important:** The tracking URL should ideally match your email sending domain to avoid spam filters.

| Email Sent From | Recommended Tracking URL |
|-----------------|-------------------------|
| `@appnox.ai` | `https://api.appnox.ai` or `https://track.appnox.ai` |
| `@engineersarmy.com` | `https://api.engineersarmy.com` |

### Step 2: Verify Routes Are Accessible

Your backend must expose these endpoints publicly (no authentication):

```
GET /api/emails/track/open/:emailId    → Returns 1x1 GIF, logs open
GET /api/emails/track/click/:emailId   → Logs click, redirects to original URL
```

Test them:
```bash
# Should return a GIF image
curl -I https://api.yourdomain.com/api/emails/track/open/test-id

# Should return 302 redirect
curl -I "https://api.yourdomain.com/api/emails/track/click/test-id?url=aHR0cHM6Ly9nb29nbGUuY29t"
```

### Step 3: WebSocket for Real-Time Notifications

For real-time notifications when emails are opened:

1. Ensure WebSocket server is running on production
2. Frontend connects to WebSocket on page load
3. Backend sends notification when tracking pixel is hit

**Frontend `.env.production:**
```env
VITE_APP_WS_URL=https://api.yourdomain.com
```

## Best Practices for Avoiding Spam Filters

### ✅ DO:
- Use a domain related to your email sending address
- Use HTTPS with valid SSL
- Keep tracking pixel small and styled like a footer element
- Use cache-busting timestamps on pixel URLs

### ❌ DON'T:
- Use `localhost` or ngrok URLs
- Use unrelated third-party domains
- Use `display:none` on tracking images (triggers some filters)
- Track every single link (looks suspicious)

## How Tracking Works Internally

### Email Sending Flow:
```
1. User composes email with tracking enabled
2. EnhancedEmailComposer.composeEmail() injects:
   - Tracking pixel before </body>
   - Wrapped links with tracking redirects
3. Email is sent via SMTP/Gmail API
```

### Email Open Tracking:
```
1. Recipient opens email in their client
2. Email client loads the tracking pixel image
3. Backend receives GET request to /api/emails/track/open/:emailId
4. EmailTrackingController.trackOpen():
   - Increments `opens` counter in database
   - Logs tracking event with IP/UserAgent
   - Sends WebSocket notification to sender
5. Sender sees real-time notification in CRM
```

### Link Click Tracking:
```
1. Recipient clicks a link in the email
2. Browser goes to /api/emails/track/click/:emailId?url=...
3. EmailTrackingController.trackClick():
   - Increments `clicks` counter
   - Logs event with clicked URL
   - Sends WebSocket notification
4. User is redirected to original destination URL
```

## Troubleshooting

### Tracking Not Working

1. **Check TRACKING_BASE_URL** is set correctly
2. **Verify SSL certificate** is valid
3. **Test the tracking endpoint** manually with curl
4. **Check backend logs** for errors

### Notifications Not Appearing

1. **Check WebSocket connection** in browser DevTools → Network → WS
2. **Verify user is authenticated** via WebSocket
3. **Check backend logs** for socket events
4. **Ensure same user ID** between email sender and logged-in user

### Gmail/Outlook Blocking Pixels

Google and Outlook proxy/cache images. This means:
- Opens may be delayed or aggregated
- IP address will be Google's/Microsoft's proxy
- Multiple "opens" may register from proxies

This is normal behavior and cannot be fully prevented.

## Production Deployment Commands

```bash
# Build for production
npm run build

# Start with PM2
pm2 start ecosystem.config.js

# View logs
pm2 logs mini-crm-backend
```

## Security Notes

- Tracking pixels are public endpoints (no auth required)
- Email IDs are UUIDs (not guessable)
- No sensitive data is exposed via tracking endpoints
- All events are logged with timestamps for auditing
