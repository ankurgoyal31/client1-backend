# Photo upload setup (Render + Google Cloud Storage)

Admin uploads need a GCS bucket. Replit sidecar is **not** used on Render.

## 1. Create GCS bucket

1. [Google Cloud Console](https://console.cloud.google.com/) → **Cloud Storage** → **Create bucket**
2. Name example: `unique-builders-uploads` (globally unique)
3. Region: near your users (e.g. `asia-south1`)

## 2. Service account

1. **IAM & Admin** → **Service Accounts** → **Create**
2. Role: **Storage Object Admin** (on that bucket) or **Storage Admin**
3. **Keys** → **Add key** → JSON → download file

## 3. Bucket CORS (required for browser upload)

Bucket → **Configuration** → **CORS** → add:

```json
[
  {
    "origin": [
      "https://builder-client-admin.vercel.app",
      "https://builder-client-admin-ls4i.vercel.app",
      "http://localhost:3002",
      "http://localhost:5173"
    ],
    "method": ["GET", "PUT", "HEAD"],
    "responseHeader": ["Content-Type", "Content-Length"],
    "maxAgeSeconds": 3600
  }
]
```

(Add your real admin Vercel URLs.)

## 4. Render environment variables

On **client1-backend-1** (api-server), add:

| Variable | Example |
|----------|---------|
| `GCS_SERVICE_ACCOUNT_JSON` | Paste **entire** JSON key file (one line on Render) |
| `PRIVATE_OBJECT_DIR` | `/unique-builders-uploads/private` |
| `PUBLIC_OBJECT_SEARCH_PATHS` | `/unique-builders-uploads/public` |

Replace `unique-builders-uploads` with your bucket name.

Keep existing: `DATABASE_URL`, `JWT_SECRET`, `PORT`

## 5. Deploy

Push code → Render **Redeploy** → test admin upload.

## 6. Test

1. Admin login → Projects → upload image
2. If fail: Render **Logs** → search `Failed to generate upload URL`
