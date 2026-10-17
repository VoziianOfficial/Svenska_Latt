<div align="center">

<h1>🌸 Svenska Lätt</h1>

<p><strong>A little Swedish every day. A little more confidence for life.</strong></p>

<p>An interactive learning space for Swedish SFI A–D.<br>
Explore vocabulary, understand grammar, and build a daily learning habit.</p>

<p>
  <a href="https://voziianofficial.github.io/Svenska_Latt/"><strong>Explore the Live Demo ↗</strong></a>
  &nbsp; · &nbsp;
  <a href="#run-locally">Run locally</a>
  &nbsp; · &nbsp;
  <a href="#project-status">Project status</a>
</p>

<p>
  <img src="https://img.shields.io/badge/SFI-A%E2%80%93D-20677A?style=flat-square" alt="SFI levels A–D">
  <img src="https://img.shields.io/badge/Vocabulary-1%2C006_words-537B65?style=flat-square" alt="1,006 vocabulary entries">
  <img src="https://img.shields.io/badge/Lessons-50-8B6B9D?style=flat-square" alt="50 lessons">
  <img src="https://img.shields.io/badge/Reading-12_books-B47C69?style=flat-square" alt="12 mini books">
</p>
<p>
  <img src="https://img.shields.io/badge/HTML5_%C2%B7_CSS3_%C2%B7_JavaScript-20677A?style=flat-square" alt="Built with HTML5, CSS3 and JavaScript">
  <img src="https://img.shields.io/badge/Local_server-Python-537B65?style=flat-square" alt="Python local server">
  <img src="https://img.shields.io/badge/Status-Active_development-8B6B9D?style=flat-square" alt="Under active development">
</p>

</div>

---

## Swedish, one small step at a time

**Svenska Lätt** brings lessons, photo flashcards, grammar references, practice sessions, and short stories into a responsive web app. It is an independent educational project for learners working through **SFI A–D**, from first words to more confident everyday communication.

Start learning as a guest, save useful words, and follow your progress through XP, study streaks, and activity statistics. The interface supports **English, Swedish, Ukrainian, and Russian**; some learning text may fall back to Russian where a translation is missing.

## ✨ Learning experience

| Feature | What you can do |
| --- | --- |
| **Photo flashcards & dictionary** | Explore 1,006 vocabulary entries with photographs, translations, examples, and pronunciation; filter words, save favorites, and mark words as known. |
| **SFI lessons** | Work through 50 lessons with explanations, examples, reading passages, and questions across levels A–D. |
| **Grammar & foundations** | Consult grammar tables and examples, learn the 29-letter Swedish alphabet, and practice numbers. |
| **Practice sessions** | Choose from 14 modes, including translation, verb forms, en/ett articles, listening, sentence building, spelling, dialogues, and reading. |
| **Scheduled review** | Revisit vocabulary using due dates and review intervals. |
| **Mini books** | Read 12 short Swedish stories with comprehension questions and track books read. |
| **Listening & video** | Hear Swedish text through browser speech synthesis and open selected learning videos on their publishers’ websites. |
| **XP & statistics** | Track XP, accuracy, completed lessons, known words, study streaks, and activity. Reach a new account level every 500 XP. |
| **Responsive navigation & search** | Find words and lessons, and study across desktop, tablet, and mobile layouts. |

Swedish voices and speech quality depend on your browser and device. External videos may have regional or service-specific availability restrictions.

### Content at a glance

Counts below are verified against [words.json](words.json), [lessons.json](lessons.json), and [books.json](books.json) in this checkout.

| SFI level | Lessons | Mini books |
| --- | ---: | ---: |
| A | 12 | 3 |
| B | 14 | 4 |
| C | 12 | 3 |
| D | 12 | 2 |
| **Total** | **50** | **12** |

The **1,006 vocabulary entries** form a shared dictionary; individual words are not assigned an SFI level in `words.json`.

## Project status

**Active development.** The learning tools run in the browser, with progress saved locally by default. Guest progress and signed-in account progress use separate browser storage. Signing in alone does **not** make learning progress available on another device.

| Area | Current behavior in this checkout |
| --- | --- |
| **Guest learning** | Available without a Supabase account; progress is stored in this browser. |
| **Supabase authentication** | Sign-up, email confirmation, sign-in, session restoration, and sign-out are integrated; they require a configured Supabase project. |
| **Cloud progress reads** | After sign-in, the app can request and validate a cloud snapshot through RPC when the backend is configured. In the default mode, this snapshot does not replace local learning progress. |
| **Experimental cloud writes** | Disabled by default and restricted to an explicit loopback development mode. Only favorites and marking words as known are connected; other progress changes are blocked in that mode. |
| **Cross-device synchronization & import** | Still in development. There is no complete production synchronization flow or automatic import of existing local progress. |

The experimental write path has mock-based checks; real Supabase RPC and multi-device behavior still require validation. See the [cloud progress notes](docs/SUPABASE_PROGRESS_READ.md), [import preview notes](docs/SUPABASE_IMPORT_PREVIEW.md), and [experimental event queue](docs/SUPABASE_EVENT_QUEUE.md).

## Technology

| Layer | Implementation |
| --- | --- |
| **Frontend** | HTML5, CSS3, and vanilla JavaScript; no frontend build step or npm installation required. |
| **Learning content** | JSON datasets with JavaScript localization and media mappings. |
| **Browser APIs** | Web Speech API for pronunciation; localStorage for normal progress and preferences; IndexedDB and Web Locks for the experimental cloud event queue. |
| **Local server** | Python standard library HTTP server with SQLite account/state API endpoints. The current frontend uses Supabase Auth and browser-local progress by default. |
| **Cloud integration** | Supabase Auth and PostgreSQL RPC adapters; the JavaScript SDK is loaded from jsDelivr when needed. |
| **Static hosting** | GitHub Pages, with a web app manifest and service worker for asset caching. |

## Project structure

```text
Svenska_Latt/
├── index.html                # App entry point
├── app.js                    # Learning views, navigation, quizzes, and state
├── style.css                 # Base styles
├── studio.css / atelier.css  # Additional visual styles
├── learning-polish.css       # Learning interface refinements
├── atelier.js                # Interface enhancements
├── learning-polish.js        # Learning interaction enhancements
├── custom-controls.js        # Custom interface controls
├── locale-content.js         # Localized learning content
├── words.json                # 1,006 vocabulary entries
├── lessons.json              # 50 SFI A–D lessons
├── books.json                # 12 mini books
├── flashcard-media.js        # Word-to-photo mappings
├── word-icons.js             # Vocabulary icon mappings
├── assets/                   # Flashcard photos, icons, and avatars
├── supabase-config.js        # Public Supabase configuration
├── supabase-client.js        # SDK loading and client initialization
├── supabase-auth.js          # Authentication and session handling
├── supabase-rpc.js           # Cloud RPC adapter
├── supabase-progress.js      # Snapshot validation and experimental writes
├── supabase/                 # SQL migrations and database checks
├── server.py                 # Local HTTP server and SQLite API
├── scripts/                  # Validation, media, and packaging utilities
├── tests/                    # Frontend, server, and integration checks
├── docs/                     # Technical notes and integration status
├── reports/                  # Media audits and preparation reports
├── sw.js                     # Service worker
├── manifest.webmanifest      # Web app metadata
├── photo-credits.html        # Third-party photo attribution
└── LICENSE                   # Project usage terms
```

## Run locally

Use **Python 3.9 or newer** with the `Europe/Stockholm` time zone available. No third-party Python packages are required on a system with that time zone installed.

```bash
git clone https://github.com/VoziianOfficial/Svenska_Latt.git
cd Svenska_Latt
python3 server.py
```

Open **[http://127.0.0.1:8765/](http://127.0.0.1:8765/)**. Stop the server with `Ctrl+C`.

If the default port is occupied, choose another port on macOS or Linux:

```bash
PORT=8766 python3 server.py
```

Then open `http://127.0.0.1:8766/`. Use the HTTP server instead of opening `index.html` directly, because the app fetches its JSON datasets.

The server creates a local `svenska.sqlite3` database for its SQLite API; this database is ignored by Git. The current frontend’s normal learning progress lives in browser storage. Changing the hostname or port creates a different browser storage origin, so existing local progress will not appear there. See [local HTTP diagnostics](docs/LOCAL_HTTP_DIAGNOSTICS.md) for troubleshooting.

## Supabase configuration

**Supabase is optional for guest learning.** To use your own Supabase project, edit [supabase-config.js](supabase-config.js) with your project’s public values:

```js
window.SV_SUPABASE = {
  url: 'https://YOUR-PROJECT-REF.supabase.co',
  publishableKey: 'sb_publishable_YOUR_PUBLIC_KEY'
};
```

These are placeholders. The current client accepts a **public publishable key beginning with `sb_publishable_`**; legacy JWT-style keys are rejected. To keep the app in unconfigured guest mode, set both fields to empty strings.

This file is served to every visitor. Never put a secret key (`sb_secret_`), `service_role` key, database password, personal access token, or other private credential in it. Public keys rely on the backend’s permissions and Row Level Security for data access control.

Configure Supabase Auth’s site URL and allowed redirect URLs for the exact local or hosted address you use. Public configuration alone does not install the database schema, enable cloud writes, or import local progress. Consult the [authentication notes](docs/SUPABASE_AUTH_PREPARATION.md), [database architecture](docs/SUPABASE_STAGE1.md), and [RPC integration notes](docs/SUPABASE_STAGE2.md) before setting up the backend; this README does not apply SQL or change remote services.

## GitHub Pages

The public demo is available at **[voziianofficial.github.io/Svenska_Latt](https://voziianofficial.github.io/Svenska_Latt/)**.

GitHub Pages serves the static frontend and learning assets. It does not execute `server.py` or provide its SQLite API. Supabase authentication connects to an independently configured backend; the experimental progress writer cannot be enabled on GitHub Pages.

The repository includes `.nojekyll` and [scripts/build_deploy.py](scripts/build_deploy.py), which prepares a runtime copy in a new output directory. It does not publish the site. Local changes may differ from the public demo until a separate deployment occurs.

## Author & usage terms

Created and maintained by **[VoziianOfficial](https://github.com/VoziianOfficial)**.

**© 2026 Svenska Lätt. All rights reserved.** This is a proprietary educational project, publicly viewable as a portfolio repository. It does not grant an open-source license. Reuse, modification, redistribution, or commercial exploitation of protected original materials requires prior written permission, subject to applicable law. See [LICENSE](LICENSE) for the existing terms; contact the owner through the [repository](https://github.com/VoziianOfficial/Svenska_Latt) for permission or collaboration inquiries.

Third-party photographs, videos, fonts, icons, and libraries remain subject to their own licenses and terms. See [photo credits](photo-credits.html), [icon attribution](assets/word-icons/README.md), and [avatar notes](assets/avatars/README.md).

---

<div align="center">

<p><strong>Lite svenska varje dag — stora framsteg med tiden.</strong><br>
A little Swedish every day leads to big progress over time.</p>

<p>Built with care for everyone finding their voice in Swedish.</p>

</div>
