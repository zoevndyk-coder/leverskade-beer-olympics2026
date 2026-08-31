# Leverskade 2026

The weekend site: welcome page, General Info, Planning, and the live Beer
Olympics tracker.

---

## Updating the site

Everything here replaces what's currently in the repo. Easiest way:

1. Unzip this folder.
2. Go to your GitHub repo.
3. Click **Add file → Upload files**.
4. Select **everything inside** the unzipped folder (not the folder itself)
   and drag it in. GitHub will overwrite the files that already exist.
5. Scroll down and **Commit changes**.

Netlify rebuilds automatically, usually within a minute or two.

### Files in this update

```
index.html            package.json          tailwind.config.js
netlify.toml          package-lock.json     postcss.config.js
vite.config.js        .gitignore            README.md

src/App.jsx           the whole app + routing
src/GeneralInfo.jsx   General Info section
src/Planning.jsx      Planning section
src/ui.jsx            shared bits (colours, Card, SectionTitle)
src/main.jsx          entry point
src/index.css         Tailwind entry

netlify/functions/storage.mjs   the database function
```

---

## How the pages fit together

- **`/`** — opens the **Beer Olympics rules**. The QR on the printed passes
  points at the bare URL, so this is deliberate.
- **`/#home`** — the Welcome page with the three sections. Reachable from the
  "Leverskade" link in the header of any section.
- **`/#info`** — General Info
- **`/#planning`** — Planning
- **`/#beer/leaderboard`** (or `log`, `beerpong`, `roster`, `info`) — jumps
  straight to a Beer Olympics tab.

Those hash links are shareable — you can paste `/#planning` into the group
chat and it opens right there.

---

## How the scoreboard syncs

Data lives in **Netlify Blobs**, a database built into Netlify. Nothing to set
up, no account, no API keys.

Changes are sent as small actions (*give Yoyo +1 in Darts*) rather than
uploading the whole scoreboard. The server applies each one on top of whatever
is saved, so if two people tap at the same moment both taps count. Uploading
the whole scoreboard instead would mean whoever saved last silently wiped out
the other person.

Each phone refreshes every 4 seconds. If a connection drops, the header shows
"offline — retrying" and it recovers on its own.

The list of games always comes from the code, never from saved data — that way
renaming a game works immediately, and any scores logged under an old name are
migrated across automatically.

---

## Making changes later

Edit the file on GitHub and Netlify redeploys itself.

- Wording, sections, rules, game rules → `src/App.jsx`, `src/GeneralInfo.jsx`,
  `src/Planning.jsx`
- Participants, games, tournament logic → `netlify/functions/storage.mjs`

If you change a game's name, change it in **both** `src/App.jsx` and
`netlify/functions/storage.mjs`, or the chip won't match its rules.
