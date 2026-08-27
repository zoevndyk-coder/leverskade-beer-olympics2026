# Leverskade 2026 — Beer Olympics Tracker

A live scoreboard: log wins per game, track Overall Champion / Best
Sprinter / Trick Shot Champion, and run the Beer Pong bracket. Everyone
who opens the site sees the same live data — no login needed.

---

## Putting it online (start to finish)

### 1. Create a fresh GitHub repository

- Go to https://github.com/new
- Name it something like `leverskade-beer-olympics-v2`
- Set it to **Public**
- **Do not** tick "Add a README" — leave the repo empty
- Click **Create repository**

### 2. Upload these files

On the empty repo page, click **"uploading an existing file"**.

**Important:** unzip this project, open the folder, then select
**everything INSIDE it** (index.html, package.json, netlify.toml, the
`src` folder, the `netlify` folder, etc.) and drag that selection in.

Do **not** drag the outer folder itself — the files need to sit at the
top level of the repo, not inside a subfolder.

When it looks right, GitHub will show `netlify` and `src` as folders,
alongside the loose files. Scroll down and click **Commit changes**.

### 3. Connect Netlify

- Go to https://app.netlify.com
- **Add new site** → **Import an existing project** → **GitHub**
- Pick your new repository
- Leave all build settings exactly as they are (they come from
  `netlify.toml`) — **Base directory must stay empty**
- Click **Deploy**

Wait a minute or two for it to build.

### 4. Check it worked

Visit `https://YOUR-SITE-NAME.netlify.app/api/storage`

You should see a wall of JSON containing names (Yoyo, Brett, ...). That
means the database is alive.

Then open the site itself, log a win, and refresh the page. If the score
is still there, everything works.

To get a nicer web address: **Site configuration → Change site name**.

---

## How the syncing works

Data lives in **Netlify Blobs**, a database built into Netlify — there is
nothing to set up, no account to create, no keys to paste.

Changes are sent as small "actions" (e.g. *give Yoyo +1 in Darts*) rather
than uploading the whole scoreboard. The server applies each action on top
of whatever is currently saved, so if two people tap at the same moment,
both taps count. (Uploading the whole scoreboard instead would mean
whoever saved last silently wiped out the other person's tap.)

Each phone refreshes every 4 seconds, so scores logged by others show up
on their own. If a connection drops, the header shows "offline — retrying"
and it recovers by itself.

## Making changes later

The whole app is in `src/App.jsx`. The database logic is in
`netlify/functions/storage.mjs`. Edit either on GitHub and Netlify
redeploys automatically.
