# Deploying CivicResolve for free

CivicResolve ships as **one Docker container**: an Express API that also serves the built React app. Every service below has a free tier. Pick **one** hosting option.

## 1. Get the AI keys

| Key                  | Where                                                                         | Required?         |
| -------------------- | ----------------------------------------------------------------------------- | ----------------- |
| `GEMINI_API_KEY`     | https://aistudio.google.com/apikey: create a key in a new or existing project | Yes, for real AI  |
| `OPENROUTER_API_KEY` | https://openrouter.ai/keys                                                    | Optional fallback |

- **Gemini model:** `GEMINI_MODEL=gemini-2.5-flash` is the default. Check the **Rate limits** page in AI Studio for your project's free limits, then set `GEMINI_RPM` and `GEMINI_RPD` a little **below** them. The defaults of 8 per minute and 200 per day are conservative.
- **OpenRouter model:** pick any model whose id ends in `:free` at https://openrouter.ai/models?max_price=0 and set it as `OPENROUTER_MODEL`. Set `OPENROUTER_VISION=true` only if that model accepts images.

## 2. Database: Firestore (Firebase Spark plan, free, no card)

1. Go to https://console.firebase.google.com and click **Add project**. You can reuse the Google Cloud project behind your Gemini key.
2. Under **Build → Firestore Database → Create database**, choose **Production mode** and the region **asia-south1 (Mumbai)**.
3. No indexes or security rules are needed for the app. Only the server reads Firestore, through the Admin SDK, and the default rules deny direct client access. Leave them as they are.
4. Set `FIRESTORE_ENABLED=true` and `FIREBASE_PROJECT_ID=<your project id>`.

> If you skip Firestore, the app uses its in-memory store with demo data. That is fine for a demo, but data resets on every restart.

## 3a. Option A: Google Cloud Run (recommended)

Cloud Run's free tier covers this app. It needs a billing account attached, but stays at $0 at hackathon traffic.

```bash
# one-time
gcloud auth login
gcloud config set project <PROJECT_ID>
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com firestore.googleapis.com

# Let the Cloud Run runtime service account use Firestore (no key file needed)
PROJECT_NUMBER=$(gcloud projects describe <PROJECT_ID> --format='value(projectNumber)')
gcloud projects add-iam-policy-binding <PROJECT_ID> \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/datastore.user"

# deploy from the repo root (builds the Dockerfile with Cloud Build)
gcloud run deploy civicresolve --source . --region asia-south1 --allow-unauthenticated \
  --memory 512Mi --max-instances 2 \
  --set-env-vars "FIRESTORE_ENABLED=true,FIREBASE_PROJECT_ID=<PROJECT_ID>,GEMINI_MODEL=gemini-2.5-flash,GEMINI_RPM=8,GEMINI_RPD=200" \
  --set-env-vars "GEMINI_API_KEY=<key>,ADMIN_PASSWORD=<long passphrase>,JWT_SECRET=<48+ random chars>"
```

**Keep the API key out of the env list:** for better hygiene, store `GEMINI_API_KEY`, `ADMIN_PASSWORD` and `JWT_SECRET` in **Secret Manager** and pass them with `--set-secrets GEMINI_API_KEY=gemini-key:latest,...` instead.

`--max-instances 2` keeps costs bounded and makes the in-process AI budget meaningful.

## 3b. Option B: Render (no credit card)

1. Go to https://render.com, click **New → Web Service**, connect the GitHub repo, and choose **Runtime: Docker**.
2. Choose the **Free** instance type and set the **health check path** to `/api/health`.
3. Add these environment variables:
   - `GEMINI_API_KEY`, `ADMIN_PASSWORD`, `JWT_SECRET`
   - `FIRESTORE_ENABLED=true`, `FIREBASE_PROJECT_ID=<id>`
   - `FIREBASE_SERVICE_ACCOUNT_B64`: generate it in Firebase console → Project settings → Service accounts → **Generate new private key**, then base64-encode the JSON file:
     - PowerShell: `[Convert]::ToBase64String([IO.File]::ReadAllBytes("key.json"))`
     - bash: `base64 -w0 key.json`
     - Delete the JSON file afterwards and **never commit it**.
4. Free instances sleep after 15 minutes idle. The first request after that takes about 30–60 s, so open the URL once before judging.

## 4. After deploying

- Open `https://<your-url>/api/health`. It should return `{"status":"ok","storage":"firestore","ai":"gemini"}`.
- Submit a test complaint and check the AI card says **Google Gemini**.
- Sign in at `/admin` and check the "AI calls left today" counter.

## Generating secrets

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"   # JWT_SECRET
```
