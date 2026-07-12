# Language Stats

A community site for learning languages where **the whole page is a dictionary**:
every word in every piece of content is a language-tagged, clickable element,
and clicking it takes you to its translation in *your* native locale. On top of
that sit data-driven learning **cards**, community **tips**, and a per-language
**chat** — all built from the same clickable-word primitive.

First language: **German**.

## Core idea

Every rendered word is conceptually `<span data-lang="de-DE">ich</span>` — it
knows its locale and is a link. A global tokenizer (`public/js/render.js`) turns
all prose into these word elements; clicking one calls the API to resolve the
translation into your chosen **native locale** and navigates there, where every
word is again clickable.

- **Locales, not just languages** — a "language" is a locale (`de-DE`, `de-CH`,
  `en-US`, `es-ES`), so dialects are first-class (Swiss `Grüezi` links to
  `hello`/`Hallo`).
- **Graph dictionary** — words are nodes, translations/synonyms are typed edges
  (stored in SQLite as an adjacency list; see "Database" below).
- **Native-relative content** — cards are shown in the learner's native
  language (an English speaker and a Spanish speaker learning German see
  different cards).

## Features

- Sign up / sign in / sign out (JWT httpOnly cookie).
- Clickable, language-tagged words everywhere → click to translate to your
  native locale; create/link missing words.
- **Cards** (articles) per language — official or user-authored, **upvotable**,
  filtered to your native language. Authored in a small, safe markup language.
- Official card **"Gender in German"** with two interactive widgets built on
  **real data**:
  - `[coverage]` — buttons for 50 / 75 / 90 / 95% showing how many of the most
    frequent words make up that share of everyday German (e.g. ~83 words = 50%).
  - `[gender-stats]` — POS breakdown of those words + noun-gender-by-ending
    analysis (majority-predicted gender per ending and the exception rate).
- Community **tips** and per-language **chat**, both fully clickable/translatable.
- **Personal progress**: mark words known/learning; a dashboard shows what % of
  everyday conversation your known words cover, with milestones and a
  "learn these next" list.
- **Flashcards (SRS)**: import decks from CSV/TSV (incl. Anki "Notes in Plain
  Text" export), study with an SM-2 scheduler (again/hard/good/easy), and track
  spaced-repetition maturity per word.
- **Familiarity colouring**: every word is tinted red→green, with a top-bar
  **👁 Seen / 🎴 Studied** toggle choosing the meaning — how often you've
  encountered the word (a versioned, swappable "seen" policy in
  `server/lib/seenPolicy.js`) or its flashcard study maturity. Words in a study
  deck also get an underline. Green comes slowly (studied maturity needs real
  reviews; seen is capped high).
- **Language exchange (Tandem-style):**
  - **Profiles** — native/learning languages, bio, interests.
  - **Community / partner finder** — browse and match members (native in what
    you learn, learning what you speak), filter, search, **follow**.
  - **Direct messages** — 1-on-1 threads, fully clickable/translatable.
  - **Corrections** — the recipient proposes a corrected version of a message,
    shown inline (Tandem's signature feature).
  - **Translate** — a partner's message is translated by a **small local AI
    model** (OPUS-MT via transformers.js, runs on-device, no Python/API), with
    an instant dictionary word-gloss as fallback. Models lazy-load per language
    pair on first use (~150MB download, then cached).

## Architecture

Frontend and backend are decoupled; the frontend only talks to `/api/*`.

```
server/                 Node + Express REST API (better-sqlite3)
  index.js              mounts routes, serves the frontend
  db/schema.sql         tables (graph dictionary, lexicon, articles, votes, chat…)
  db/seed.js            loads data + seeds official cards   (npm run seed)
  models/               all SQL, one module per concern
  routes/               /api/{auth,languages,words,tips,articles,frequency,messages}
  seed-data/            the datasets (see "Data & licensing")
public/                 static frontend, no build step
  js/render.js          the word tokenizer + click-to-translate
  js/articleMarkup.js   the card markup language
  js/views/             one module per screen (articles, article, chat, tips, wordPage…)
data/                   SQLite database file (git-ignored)
```

## Card markup

User-authored cards use a small, safe (non-HTML) markup:

```
# Heading
- bullet
{{de-DE|der Tisch}}     text tagged with a locale (clickable as German)
[coverage]              the % of conversation widget
[gender-stats]          the POS + noun-gender widget

blank line = new paragraph
```

## Database

SQLite (relational), storing a **graph model**: `words` are nodes, `word_links`
are typed edges. One-hop lookups (a word's translations) are simple JOINs; this
is deliberately kept graph-shaped so it can migrate to a native graph DB
(Neo4j / KùzuDB) later if multi-hop traversal becomes central. See the models
layer — swapping engines touches `models/`, not the routes.

## Data & licensing

- **Word frequencies** — `server/seed-data/opensubtitles/{de,en,es,fr,it,pt}_50k.txt`,
  from `hermitdave/FrequencyWords` (MIT), derived from **OpenSubtitles**
  (opensubtitles.org). 50k words per language. Distributed lowercased; correct
  German casing is restored from the UD treebank at seed time (see `SOURCE.md`).
- **Word definitions** — fetched from **Wiktionary** (CC BY-SA) by a
  re-runnable scraper: `npm run scrape -- [langCode] [limit]`. It pulls
  definitions for the most frequent words and stores them on the dictionary
  entries; incremental (skips recently-scraped words unless `--force`), so you
  can re-run it any time to add more or refresh. Run `npm run seed` first, then
  `npm run scrape`.
- **POS + gender** — `server/seed-data/ud/*.conllu`, the **Universal
  Dependencies German-GSD** treebank (CC BY-SA). Aggregated to a dominant POS
  and (for nouns) dominant gender per word form.
- spaCy is a candidate future supplement for tagging rarer words.

## Getting started

```bash
npm install
npm run seed     # loads frequencies + UD lexicon, seeds official cards
npm run dev      # or: npm start   → http://localhost:3000
```

Copy `.env.example` to `.env` and set a real `JWT_SECRET` before deploying.

## API overview

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/auth/{signup,login,logout}` | session |
| GET | `/api/languages` | locales (sidebar) |
| GET | `/api/words/entry?lang&text` | a word element + its links |
| GET | `/api/words/resolve?text&from&to` | where a click lands (native translation) |
| POST | `/api/words[/:id/links]` | create/link words |
| GET/POST | `/api/articles` | cards (list filtered by `native`, create) |
| POST | `/api/articles/:id/vote` | upvote toggle |
| GET | `/api/frequency/coverage?lang&t` | words covering t% of speech |
| GET | `/api/frequency/analysis?lang&t` | POS + noun-gender-by-ending |
| GET/POST | `/api/tips`, `/api/messages` | tips, chat |
| GET/PUT | `/api/profile`, GET `/api/users/:username` | profiles |
| GET | `/api/community?speaks&learning&q&match` | partner finder |
| POST | `/api/users/:username/follow` | follow toggle |
| GET/POST | `/api/dm`, `/api/dm/:username` | direct messages |
| POST | `/api/dm/messages/:id/correct` | correct a message |
| GET | `/api/progress?lang`, POST `/api/progress/mark` | progress/coverage |
| POST | `/api/translate` | dictionary word-gloss |
| POST | `/api/translate/ai` | local AI (OPUS-MT) sentence translation |
```
