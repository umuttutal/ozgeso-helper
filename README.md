# Spectroscopy Experiment Diary - Setup Guide

## Project Files Created

- `index.html` - Main page structure
- `style.css` - All styling
- `app.js` - Application logic

## Quick Start

### 1. Set Up Supabase

1. Go to [supabase.com](https://supabase.com) and create a new project
2. In your Supabase dashboard, go to **SQL Editor**
3. Run this SQL to create the table:

```sql
create table experiments (
  id uuid primary key default gen_random_uuid(),
  created_at timestamp default now(),
  title text not null,
  absorption_data jsonb not null,
  emission_data jsonb not null
);

-- Create index for faster queries
create index idx_experiments_created_at on experiments(created_at);
```

### 2. Get Your Credentials

1. Go to **Settings → API** in your Supabase dashboard
2. Copy your **Project URL** and **anon public key**

### 3. Update Configuration

In `app.js`, replace:
```javascript
const SUPABASE_URL = 'https://your-project.supabase.co';
const SUPABASE_ANON_KEY = 'your-anon-key-here';
```

With your actual credentials from Supabase.

### 4. Run Locally

Option A - Simple HTTP Server (Python):
```bash
cd /Users/umuttutal/Desktop/ozgesohelper
python3 -m http.server 8000
# Visit http://localhost:8000
```

Option B - Using Node.js:
```bash
npx http-server
```

### 5. Deploy to GitHub Pages (Optional)

1. Create a GitHub repository named `ozgesohelper`
2. Push these three files to the repo
3. Go to **Settings → Pages** and enable GitHub Pages
4. Your app will be live at `https://yourusername.github.io/ozgesohelper`

## Features Implemented

✅ Single-page application  
✅ New entry modal form  
✅ CSV parsing (handles scientific notation like 1.91E+03)  
✅ Supabase integration for persistence  
✅ Dual Chart.js plots (absorption + emission)  
✅ Responsive design  
✅ Smooth animations  
✅ Mobile-friendly  

## How It Works

1. **Page loads** → Fetches experiments from Supabase
2. **User clicks "New Entry"** → Modal opens for CSV upload
3. **Files uploaded** → Browser parses CSV into JSON array
4. **Save clicked** → Data inserted into Supabase
5. **New entry renders** → Charts display live

## CSV Format

Your CSV files should look like this:

```
wavelength,intensity
400,1.91E+03
401,2.04E+03
402,2.15E+03
```

The header row is optional and will be auto-detected.

## Troubleshooting

**"Supabase Not Configured" error?**
- Make sure you updated SUPABASE_URL and SUPABASE_ANON_KEY in app.js

**Charts not showing?**
- Check browser console for errors (F12)
- Ensure CSV data is being parsed correctly
- Verify Supabase table is created

**Can't connect to Supabase?**
- Check your Project URL is correct
- Verify your anon key is valid
- Ensure table exists in your database

## Architecture Notes

- **No build step required** - just open in browser
- **No backend server** - Supabase handles all data
- **Single JS file** - all logic in app.js
- **Chart.js library** - loaded from CDN
- **Supabase JS client** - loaded from CDN

Everything works directly in the browser!
