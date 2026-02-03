# Football English Training Web App

## Setup

### 1. Install Dependencies
```bash
cd football-trainer
npm install
```

### 2. Configure Environment Variables
Create a `.env.local` file in the `football-trainer` directory based on the template:

```env
# OpenAI
OPENAI_API_KEY=your_openai_key

# Supabase (Storage bucket: 'tal-audio')
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_anon_key

# Google Sheets
GOOGLE_SERVICE_ACCOUNT_EMAIL=your_service_account_email
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n..."
GOOGLE_SHEET_ID=your_sheet_id
```

> **Note**: For Google Sheets, ensure the Sheet is shared with the Service Account Email and has a sheet named "Attempts" (or it will use the first sheet).

### 3. Run Locally
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

## Features

### Player Mode (`/train`)
- Displays a situational scenario and target English phrase.
- **Record**: Captures audio using MediaRecorder.
- **Submit**: 
  1. Uploads audio to Supabase Storage.
  2. Transcribes using OpenAI Whisper.
  3. Calculates AI Score (accuracy).
  4. Saves attempt to Google Sheets.

### Admin Mode (`/admin`)
- Lists all attempts from Google Sheets.
- Plays audio directly in the browser.
- Allows Coach Feedback & Score updates (saved back to Sheets).

## Deployment

For detailed Vercel deployment instructions (required for mobile support), please see [DEPLOYMENT.md](./DEPLOYMENT.md).

1. Push this folder to a GitHub repository.
2. Import the project into Vercel.
3. During import, add the **Environment Variables** defined in `.env.local`.
4. Deploy!
