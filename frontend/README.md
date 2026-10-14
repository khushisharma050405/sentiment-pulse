# Sentiment Pulse · frontend

React + Vite frontend with three pages in a dark brown + dusty rose theme (Newsreader + DM Sans).

## Run
```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build in dist/
```

## Pages (hash routes)
- `#/`       Landing page
- `#/login`  Sign in / Create account
- `#/app`    Analyzer: Text Sentiment Analysis and Social Media tabs

## Structure
- `src/pages/`      Landing, Login, Dashboard
- `src/lib/sentiment.js`  Demo lexicon scorer. Replace `analyze()` with an API call to your model
- `src/lib/art.js`  Inline SVG illustrations (theme-aware)
- `src/styles/`     global tokens and one scoped stylesheet per page
- `src/components/` Logo (waveform mark) and Icons

## Connect a backend
- Login: see the `TODO` in `src/pages/Login.jsx` (POST to `/auth/login` or `/auth/register`)
- Analysis: make `analyze(text)` call `POST /api/sentiment` and return `{ n, label, hits, toks }`
  (`n` from -1 to 1, `label` Positive, Negative or Neutral)

## Real generated images
Put PNG/WebP files in `src/assets/` and import them in the pages, in place of the SVG art.
