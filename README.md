# Codal Recall

A flashcard and spaced-repetition reader for Philippine codals: the Civil Code, Revised Penal Code, 1987 Constitution, Rules of Court, Family Code, and any other law you import.

- **Browse** codals provision by provision, with search across all of them.
- **Fill-in-the-blank cards.** Tap the words to hide, or let the app auto-pick the key terms.
- **"What article is this?" cards.** You see the text and type the number. Answers like `1156`, `art 3 sec 2` or `Rule 110 sec 1` are all accepted, and Roman numerals work.
- **Spaced repetition (SM-2).** Cards you miss come back in 10 minutes and then more often; cards you know drift out to days and months. There is also a **Drill weak provisions** mode.
- **Progress view** with a streak, recall rate, a 7-day review forecast and your weakest provisions.
- **Import:** paste a whole codal (from the Official Gazette, lawphil.net or the SC E-Library) and it is split automatically at `Article N.`, `Section N.`, `RULE N` and `ARTICLE III`, with BOOK, TITLE and CHAPTER lines kept as headings.
- **Offline-first.** Works with no account; progress is saved in the browser. Cloud sync across devices through Supabase is optional.

> The included starter set (45 key provisions) is for getting started. Verify it against the official text and import full codals for serious study.

---

## Tech stack and architecture

| Layer | Choice | Why |
|---|---|---|
| UI | React 18 + Vite | Fast and simple; builds to static files |
| Local data | `localStorage` (via a small store with `useSyncExternalStore`) | Works offline and needs no backend |
| Codal content | `src/data/seed.js` + user imports, and optionally the Supabase `provisions` table | Statutes are public domain and rarely change |
| Cloud (optional) | Supabase: Postgres, email magic-link auth, Row Level Security | Free tier, no server code |
| Hosting | Vercel (or Netlify / Cloudflare Pages) | Free static hosting with auto-deploy from GitHub |

```
src/
  data/seed.js          starter provisions
  lib/srs.js            SM-2 scheduler
  lib/text.js           tokenizer, auto-blanks, typo-tolerant answer checking, article-number matching
  lib/parser.js         splits pasted codal text into provisions
  lib/store.js          local-first state, library merging, review queue
  lib/sync.js           optional Supabase sync (last-write-wins per card)
  components/           Browse, Review, Progress, Import, Settings, ClozeEditor
supabase/schema.sql     tables + RLS policies
supabase/seed.sql       generated library data (npm run seed-sql)
```

### Database structure

```
codes        id (pk) · name · short · law
provisions   id (pk, "civ:art-1156") · code_id → codes · label · heading · text · note · sort
cards        id (pk) · user_id → auth.users · provision_id · type (cloze|identify) · blanks int[]
             · ease · interval_days · reps · lapses · due · last_reviewed · updated_at · deleted
reviews      id (pk) · user_id · card_id · grade (1/3/4/5) · reviewed_at
```

`codes` and `provisions` are a shared library that anyone can read. `cards` and `reviews` are private: Row Level Security limits each user to their own rows.

---

## Run locally

```bash
npm install
npm run dev          # http://localhost:5173
```

## Deploy for free

### 1. Frontend on Vercel (required, about 5 minutes)

1. Push this folder to a GitHub repository.
2. Go to [vercel.com](https://vercel.com), sign in with GitHub, click **Add New → Project**, and pick the repo.
3. Vercel detects Vite automatically (build command `npm run build`, output `dist`). Click **Deploy**.

You get a URL like `codal-recall.vercel.app`. Every `git push` redeploys.
*(Netlify and Cloudflare Pages work the same way: build `npm run build`, publish `dist`.)*

### 2. Cloud sync with Supabase (optional)

1. Create a free project at [supabase.com](https://supabase.com).
2. In **SQL Editor**, run `supabase/schema.sql`, then `supabase/seed.sql`.
3. In **Authentication → URL Configuration**, set **Site URL** to your Vercel URL.
4. In **Project Settings → API**, copy the Project URL and the `anon` public key.
5. In Vercel, go to **Settings → Environment Variables** and add:
   - `VITE_SUPABASE_URL` = your project URL
   - `VITE_SUPABASE_ANON_KEY` = your anon key

   Then redeploy. For local development, copy `.env.example` to `.env`.
6. In the app, open **Settings**, enter your email, open the magic link, and click **Sync now**.

**Free-tier note:** Supabase pauses free projects after a week with little database activity. Because this app is offline-first, studying keeps working; only sync waits until you restore the project from the Supabase dashboard.

### Adding full codals to the shared library

1. In the app, go to **Import**, paste the full codal text, split it, and save.
2. Under **Your imports**, click **Export JSON** and save the file to `codals/` in this repo.
3. Run `npm run seed-sql`, then run the regenerated `supabase/seed.sql` in the Supabase SQL Editor.

Every user then gets the codal through **Settings → Update codal library**, which also runs automatically on load.

## Other commands

```bash
npm run build          # static site in dist/
npm run build:single   # one self-contained HTML file in dist-single/ (works offline, easy to share)
npm run seed-sql       # regenerate supabase/seed.sql
```

## Ideas for next versions

- PWA install and offline caching (`vite-plugin-pwa`)
- Shared class decks: a professor or org publishes card sets
- Amendment tracker that shows old and new text side by side
- Bar-subject tagging and a syllabus mode
- Audio mode with text-to-speech, for review during commutes
>>>>>>> 37ad1d2 (Initial commit)
