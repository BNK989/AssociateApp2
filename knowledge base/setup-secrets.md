# Setting Up Supabase Secrets

To ensure the Edge Functions (like `generate-daily-hints`) can access external APIs (like Gemini), you must set the environment variables (secrets) in your Supabase project.

## 1. Get your API Key
Ensure you have your **Gemini API Key** ready. You can find this in your local `.env` file under `GEMINI_KEY` or `NEXT_PUBLIC_GEMINI_KEY` (ensure you use the server-side one if distinct).

## 2. Set the Secret via CLI
If you have the Supabase CLI installed and linked to your project:

```bash
supabase secrets set GEMINI_KEY=your_api_key_here
```

## 3. Set the Secret via Dashboard
1. Go to your [Supabase Dashboard](https://supabase.com/dashboard).
2. Select your project.
3. Navigate to **Edge Functions** (or **Settings** -> **Edge Functions**).
4. Look for **Secrets** or **Environment Variables**.
5. Click **Add new secret**.
6. **Name**: `GEMINI_KEY`
7. **Value**: Paste your API key.
8. Click **Save**.

## Verification
To verify the secret is set (via CLI):
```bash
supabase secrets list
```

> **Note**: The `generate-daily-hints` function will fail if this key is missing.
