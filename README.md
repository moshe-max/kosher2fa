# kosher2fa

A kosher-friendly way to get 2FA authentication codes over phone systems like [call2all.co.il](https://call2all.co.il).

## What this project provides

This repo now includes a Netlify Function endpoint that:

- Accepts a phone number (`phone`) and optional service name (`service`)
- Supports multiple users by phone number
- Generates TOTP codes (Google Authenticator format) for configured services (for example `gmail`)
- Can be protected with an API key (`x-api-key` header or `key` query param)

Endpoint path after deploy:

- `GET /api/2fa?phone=972501234567`
- `GET /api/2fa?phone=972501234567&service=gmail`

## 1) Configure Netlify environment variables

In Netlify site settings, add:

### `USERS_CONFIG`

JSON object where keys are phone numbers and values are service-to-secret maps.

Example:

```json
{
  "972501234567": {
    "gmail": "JBSWY3DPEHPK3PXP",
    "github": "NB2W45DFOIZA===="
  },
  "972541112233": {
    "gmail": "MZXW6YTBOI======"
  }
}
```

> Secrets must be Base32 TOTP secrets from the account setup QR/secret.

### `API_KEY` (recommended)

Set a strong value. Requests must include this key:

- Header: `x-api-key: YOUR_KEY`
- Or query param: `?key=YOUR_KEY`

## 2) Deploy to Netlify

1. Push this repo to GitHub.
2. In Netlify, **Add new site** → **Import from Git**.
3. Select this repo.
4. Deploy (no build command required).
5. Add environment variables (`USERS_CONFIG`, `API_KEY`) and redeploy.

## 3) Connect Call2All

Use Call2All webhook/integration to call:

```text
https://YOUR_NETLIFY_SITE/api/2fa?phone={{phone}}&service=gmail&key=YOUR_KEY
```

Replace `{{phone}}` with Call2All's caller phone variable.

## Local test

```bash
npm test
```
