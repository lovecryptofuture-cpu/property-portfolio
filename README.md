# Property portfolio

A simple Progressive Web App (PWA) for tracking your property portfolio. Deploy to your own GitHub Pages, install on your phone like a native app.

## How it works

- The **app code** lives in your GitHub repo and gets served as a static site via GitHub Pages.
- Your **portfolio data** lives only in your phone's local storage. It never gets uploaded, never goes to GitHub, never touches a server.
- No passwords, no login screens, no accounts. Just open the app and your data is there.
- The phone's own lock (Face ID / passcode) is the only security barrier — same as any other personal app on your phone.

## What's online vs what's not

| Item                       | Where it lives           | Visible to others?              |
|----------------------------|--------------------------|---------------------------------|
| The app's code (HTML/JS)   | Your GitHub repo (public)| Yes — but it's just app code, no numbers |
| Your portfolio data        | Phone's local storage    | No — never leaves your device   |
| Your backups (if exported) | Wherever you save them   | Depends where you put them      |

So when you set up a public GitHub repo, the only thing on the internet is the empty app shell. Anyone who visits the URL sees a blank "Get started" screen — your actual numbers exist only inside your phone.

## Deployment (one-time, ~5 minutes)

### 1. Create the GitHub repository

1. Go to [github.com/new](https://github.com/new).
2. Name it `property-portfolio`.
3. Choose **Public** (free tier).
4. Click **Create repository**.

### 2. Upload the files

1. On the new repo page, click **uploading an existing file**.
2. Drag every file and folder from this `property-portfolio` folder into the upload area.
3. Write a commit message ("Initial commit") and click **Commit changes**.

### 3. Enable GitHub Pages

1. In your repo, go to **Settings → Pages**.
2. Under **Build and deployment**, set **Source** to `Deploy from a branch`.
3. Select branch `main`, folder `/ (root)`. Click **Save**.
4. Wait 1–2 minutes. Refresh until you see: *"Your site is live at `https://YOUR-USERNAME.github.io/property-portfolio/`"*

### 4. Install on your phone

**iPhone (Safari):**
1. Open the URL in Safari.
2. Tap Share → Add to Home Screen → Add.

**Android (Chrome):**
1. Open the URL in Chrome.
2. Menu → Install app → Confirm.

### 5. Load your data

1. Open the app from your home screen.
2. Tap **Import from JSON**.
3. Choose the `portfolio-data.json` file (or paste it in).
4. Done — your portfolio is now in the app.

## Using the app

- **Tap any number** to edit it. Auto-saves on blur.
- **Settings** (top right gear icon) → Export to back up, Import to restore, Clear all to wipe.
- **Add / edit properties** via the + buttons and the small gear icon on each property card.

## Backup recommendation

Local storage *should* persist forever, but it can be wiped if you:
- Clear Safari/Chrome's site data
- Uninstall the PWA from your home screen
- Lose or factory-reset the phone

So **export a backup occasionally** — Settings → Export → Download. Stick the JSON file in iCloud Drive / Google Drive / a password manager. That way you can re-import to a new device anytime.

## Project structure

```
property-portfolio/
├── index.html       # PWA shell
├── styles.css       # Mobile-first dark theme
├── app.js           # Application logic
├── sw.js            # Service worker (offline support)
├── manifest.json    # PWA manifest
└── icons/           # App icons
```

No build step, no dependencies, no framework. Plain HTML/CSS/JS that runs in any modern browser.

## License

Personal use. Build whatever you want with it.
