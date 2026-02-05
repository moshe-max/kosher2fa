# kosher2fa

A kosher-friendly way to get 2FA authentication codes over phone systems like [call2all.co.il](https://call2all.co.il).

## Ready endpoint (your Netlify permalink)

Base URL:

```text
https://6984fdddfc90826c6497b6a2--dreamy-griffin-7c104b.netlify.app
```

## Endpoints

### 1) Get 2FA code

```text
GET /api/2fa
```

Parameters:
- `phone` (required)
- `service` (optional, recommended)
- `key` or header `x-api-key` (if `API_KEY` is set)
- `response=text` (optional plain text mode for IVR)
- `speak=true` (optional spaced digits for TTS)

Example for Call2All voice:

```text
https://6984fdddfc90826c6497b6a2--dreamy-griffin-7c104b.netlify.app/api/2fa?phone={{phone}}&service=gmail&response=text&speak=true&key=YOUR_KEY
```

### 2) Set/update a user value (new)

```text
POST /api/set-user
```

Body (JSON or form):

```json
{
  "phone": "0501234567",
  "service": "gmail",
  "secret": "JBSWY3DPEHPK3PXP"
}
```

Auth for set endpoint:
- Header: `x-admin-key: YOUR_ADMIN_KEY`
- Or body/query: `adminKey=YOUR_ADMIN_KEY`

This endpoint updates the live in-memory config on the running function instance (fast for immediate use). For permanent storage, also update `USERS_CONFIG` in Netlify environment settings.

## Environment variables

- `API_KEY` - protects `/api/2fa` (recommended)
- `ADMIN_KEY` - required for `/api/set-user`
- `USERS_CONFIG` - bootstrap/persistent JSON config loaded when function starts

Example `USERS_CONFIG`:

```json
{
  "0501234567": {
    "gmail": "JBSWY3DPEHPK3PXP"
  }
}
```

## Local test

```bash
npm test
```
