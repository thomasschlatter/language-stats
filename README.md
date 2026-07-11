# Language Stats

A community website for learning languages. People sign up, share their
tricks and tips for learning a language (stats-related or not), and build a
shared, **clickable dictionary** where every word links to its translations in
other languages. Words are stored as a **graph** — words are nodes, links
(translations / synonyms / related) are edges — so you can click your way from
one word to another across languages, and add missing links as you go.

First language: **German**.

## Architecture

Frontend and backend are decoupled and talk only over a JSON REST API.

```
language-stats/
├── server/                 # Node + Express REST API
│   ├── index.js            # app entry: mounts /api routes, serves frontend
│   ├── db/
│   │   ├── schema.sql      # tables (graph model: words + word_links)
│   │   ├── index.js        # SQLite connection + schema init
│   │   └── seed.js         # starter German/English words  (npm run seed)
│   ├── models/             # all SQL lives here (languages, users, words, tips)
│   ├── middleware/auth.js  # JWT cookie auth (signup/login/logout)
│   └── routes/             # /api/auth, /api/languages, /api/words, /api/tips
├── public/                 # static frontend (no build step)
│   ├── index.html
│   ├── css/styles.css
│   └── js/
│       ├── api.js          # the single place that calls the REST API
│       ├── app.js          # bootstrap + sidebar
│       ├── router.js       # hash router
│       ├── auth.js, store.js, dom.js
│       └── views/          # words, wordDetail, tips
└── data/                   # SQLite database file (git-ignored)
```

**Why these choices**

- **REST API + static frontend** — the frontend only knows the `/api/*`
  endpoints (`public/js/api.js`), so either side can change independently.
- **Graph model in SQLite** — `words` (nodes) + `word_links` (typed, edges)
  captures the "click any word to reach its translation" idea with zero extra
  infrastructure. It can migrate to a dedicated graph DB later without
  rethinking the data model.
- **Modular** — SQL is isolated in `models/`, each API resource is its own
  route file, each frontend screen is its own view module. Adding a feature
  usually means one new model + one route + one view.

## Getting started

```bash
npm install      # installs express, better-sqlite3, bcryptjs, jsonwebtoken, cookie-parser
npm run seed     # creates German + English and a few linked starter words
npm run dev      # start with auto-reload  (or: npm start)
```

Then open http://localhost:3000

Copy `.env.example` to `.env` to set the port and (importantly) a real
`JWT_SECRET` before deploying anywhere.

## API overview

| Method | Endpoint                | Auth | Purpose                                   |
|--------|-------------------------|------|-------------------------------------------|
| POST   | `/api/auth/signup`      | –    | create account, returns cookie session    |
| POST   | `/api/auth/login`       | –    | sign in                                    |
| POST   | `/api/auth/logout`      | –    | sign out                                   |
| GET    | `/api/auth/me`          | ✓    | current user                               |
| GET    | `/api/languages`        | –    | list languages (sidebar)                   |
| POST   | `/api/languages`        | ✓    | add a language                             |
| GET    | `/api/words?lang=de`    | –    | list/search words for a language           |
| GET    | `/api/words/:id`        | –    | a word + its linked translations           |
| POST   | `/api/words`            | ✓    | create a word                              |
| POST   | `/api/words/:id/links`  | ✓    | link a word to another (creating it if new)|
| GET    | `/api/tips?lang=de`     | –    | list tips for a language                   |
| POST   | `/api/tips`             | ✓    | share a tip                                |

## Status

This is the **barebone**: sign up / in / out, per-language word lists,
clickable words with cross-language links you can create, and community tips.
Next candidates: richer German word data, word graph visualisation,
tip voting, and per-user progress stats.
