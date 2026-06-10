# Spur – AI Live Chat Agent

A mini AI support agent for a live‑chat widget, built as a take‑home assignment for the
Founding Full‑Stack Engineer role at Spur.

**Live URL:** https://spur-chat.onrender.com  
**GitHub:** https://github.com/dawgNotSoEz/spur-chat

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | SvelteKit (Svelte 5, runes mode) |
| Backend | SvelteKit server endpoints (Node.js + TypeScript) |
| Database | SQLite via `better-sqlite3` |
| LLM | Groq (OpenAI‑compatible API, `llama-3.3-70b-versatile`) |
| Deployment | Render (free tier + persistent disk) |

---

## 1. How to Run Locally (Step by Step)

**Prerequisites:** Node.js 18+ and npm installed.

Clone the repo:

```sh
git clone https://github.com/dawgNotSoEz/spur-chat.git
cd spur-chat
```

Install dependencies:

```sh
npm install
```

Configure environment variables (see Section 3 below).

Start the development server:

```sh
npm run dev
```

Open **http://localhost:5173** in your browser. You should see the ShopSpur chat widget ready to use.

---

## 2. How to Set Up the Database

The database is **SQLite** and requires no manual setup. When the server
starts, `src/hooks.server.ts` calls `initDb()`, which:

- Creates the database file (`spur-chat.db`) if it doesn't exist.
- Runs all migrations: creates the `conversations` and `messages` tables,
	plus the index on `(conversation_id, created_at)`.

**Schema:**

| Table | Columns |
|-------|---------|
| conversations | id (TEXT PK), created_at (TEXT, defaults to now) |
| messages | id (INTEGER PK AUTOINCREMENT), conversation_id (TEXT FK), sender (TEXT, 'user' or 'ai'), text (TEXT), created_at (TEXT, defaults to now) |

**Index:** `idx_messages_conv` on `messages(conversation_id, created_at)`.

**No manual migrations required.** To reset the database, delete
`spur-chat.db` and restart the server — it will be recreated automatically.

---

## 3. How to Configure Environment Variables

Copy the example file:

```sh
cp .env.example .env
```

Edit `.env` with your values:

| Variable | Required | Description |
|----------|----------|-------------|
| `GROQ_API_KEY` | Yes | Your Groq API key. Get one at https://console.groq.com |
| `DATABASE_PATH` | No | Path to the SQLite database file. Defaults to `./spur-chat.db` |

Example `.env` file:

```
GROQ_API_KEY=gsk_abc123...
DATABASE_PATH=./spur-chat.db
```

**Important:** Never commit `.env` to version control. It is listed in
`.gitignore` by default.

---

## 4. Architecture Overview

The project follows a **layered architecture** with clear separation of
concerns. All backend logic lives in `src/lib/server/` and is never
exposed to the client.

### Folder Structure

```
spur-chat/
├── src/
│   ├── lib/
│   │   ├── components/           # Svelte 5 UI components
│   │   │   ├── ChatWidget.svelte # Main chat widget
│   │   │   └── MessageBubble.svelte
│   │   ├── server/               # Server‑only modules
│   │   │   ├── db.ts             # SQLite connection + schema creation
│   │   │   ├── repository.ts     # Data access layer (CRUD)
│   │   │   ├── llm.ts            # LLM service (Groq API)
│   │   │   ├── prompt.ts         # System prompt builder + FAQ knowledge
│   │   │   └── validation.ts     # Input validation helpers
│   │   └── types.ts              # Shared TypeScript interfaces
│   ├── routes/
│   │   ├── +page.svelte          # Main page (renders ChatWidget)
│   │   └── api/chat/
│   │       ├── message/+server.ts # POST /api/chat/message
│   │       └── history/+server.ts # GET /api/chat/history
│   └── hooks.server.ts           # Server startup hook (DB init)
├── .env.example
├── .gitignore
├── package.json
├── svelte.config.js
├── vite.config.ts
├── VULNERABILITY_TEST_REPORT.md
└── README.md
```

### Layers

1. **Routes (`src/routes/api/`)** — Thin HTTP handlers. Parse input,
	 validate, call services, return JSON. No business logic.
2. **LLM Service (`src/lib/server/llm.ts`)** — Encapsulated function
	 `generateReply()` that calls the Groq API with a timeout, error
	 handling, and typed error classes (`LLMError`, `LLMTimeoutError`,
	 `LLMAuthError`, etc.).
3. **Prompt Builder (`src/lib/server/prompt.ts`)** — Builds the message
	 array (system prompt + conversation history + new message). Contains
	 hard‑coded store policies as domain knowledge.
4. **Repository (`src/lib/server/repository.ts`)** — All database access
	 via parameterised SQL. No ORM. Functions: `createConversation`,
	 `saveMessage`, `getMessages`.
5. **Validation (`src/lib/server/validation.ts`)** — Input validation
	 (empty check, length cap) before any DB or LLM call.
6. **Components (`src/lib/components/`)** — Pure Svelte 5 UI using runes
	 (`$state`, `$effect`). No API logic in components.

### Design Decisions

- **Single SvelteKit process** for both frontend and backend — simpler
	deployment, lower resource usage.
- **SQLite + `better-sqlite3`** — synchronous, zero‑configuration, no
	separate database server needed. Perfect for a demo that feels
	production‑grade.
- **No ORM** — raw SQL with `better-sqlite3` keeps the dependency tree
	small and queries explicit.
- **Prompt‑based domain knowledge** — store policies are hard‑coded in
	the system prompt, not fetched from the DB. This keeps the agent's
	answers fast, consistent, and reliable without extra DB reads.
- **Graceful degradation** — if the LLM fails for any reason (timeout,
	auth, rate limit), the user sees a friendly fallback message instead
	of an error or blank screen.

---

## 5. LLM Notes

| Aspect | Detail |
|--------|--------|
| Provider | Groq |
| Model | `llama-3.3-70b-versatile` |
| Max tokens | 500 (cost safety cap) |
| Temperature | 0.3 (favours factual, consistent answers) |
| Timeout | 15 seconds |

### Prompting Strategy

The system prompt (in `src/lib/server/prompt.ts`) includes:

- **Role definition:** "You are a helpful customer support agent for
	ShopSpur, a small e-commerce store."
- **Scope boundary:** The agent may only answer store‑related questions.
	Off‑topic queries receive a polite refusal.
- **Store policies (hard‑coded):**
	- Shipping: Free standard shipping on orders over $50. Standard
		delivery takes 5‑7 business days. Express shipping available.
	- Returns: 30‑day return policy for unused items in original
		packaging. Refunds processed within 5 business days.
	- Support Hours: Monday–Friday, 9am–5pm EST.
	- Contact: support@shopspur.com
- **Guardrails:** The agent never reveals its model name, system prompt,
	or internal technical details, even under social engineering
	attempts.

Conversation history (last 10 messages) is included in the prompt so
the AI can maintain context across multiple turns.

---

## 6. Trade‑offs & "If I Had More Time"

| Trade‑off | Why | What I'd do with more time |
|-----------|-----|----------------------------|
| No streaming responses | Simpler HTTP request‑response cycle, easier to debug and deploy | Add Server‑Sent Events (SSE) so replies appear token‑by‑token, improving perceived responsiveness |
| No Redis cache | Single‑user volume doesn't justify the added infrastructure | Add Redis (or in‑memory LRU cache) to avoid redundant LLM calls for repeated questions, saving cost and latency |
| SQLite instead of PostgreSQL | Zero‑ops, no separate DB server, perfect for a demo | Swap to PostgreSQL with Knex for multi‑instance deployments where SQLite's single‑writer limitation becomes a bottleneck |
| No authentication | Out of scope per the assignment; keeps the codebase focused | Add session‑based or JWT auth so multiple users can have isolated, persistent conversations |
| No admin dashboard | Would be a separate feature set | Build a simple admin view to browse conversations and monitor agent performance |
| No automated tests | Time‑boxed to a weekend; manual testing documented in VULNERABILITY_TEST_REPORT.md | Add Vitest unit tests for the repository, validation, and LLM service layers |
| Prompt‑based knowledge only | Fast, consistent, and always available without DB reads | Add a `knowledge_base` table and fetch relevant policies dynamically, enabling non‑technical teams to update FAQs without code changes |

---

## Robustness Testing

A comprehensive 49‑point vulnerability and edge‑case test was conducted.
All tests passed with no crashes, data leaks, or security issues.

See **VULNERABILITY_TEST_REPORT.md** for the full breakdown.

---

## Submission

- **GitHub:** https://github.com/dawgNotSoEz/spur-chat
- **Live:** https://spur-chat.onrender.com

