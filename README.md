# Trivia Board

A local trivia board for game night. Write your own questions, keep them on this
machine, and play as many rounds as the party wants.

## Party day — start it

Either run it with Docker (below) or straight from Node:

```bash
npm run build && npm start
```

Then open **http://localhost:3737**.

> Runs on port **3737**, not the usual 3000.

Use `npm run dev` while editing code; use `npm run build && npm start` for the
actual party (faster, and no dev-server overhead mid-game).

### Playing from a second computer

Both machines need to be on the same wifi. Find this machine's LAN address — on
macOS, for example:

```bash
ipconfig getifaddr en0
```

Then browse to `http://<that-address>:3737`.

The second computer sees **the same questions** (they live in the database on this
machine) but keeps **its own scoreboard**, because scores are stored in each
browser. Run the game from one machine and the numbers stay in one place.

## Docker

```bash
docker-compose up -d --build      # start (or apply code changes)
docker-compose logs -f            # watch it boot
docker-compose down               # stop, keep your games
docker-compose down -v            # stop and wipe the database
```

Open **http://localhost:3737**.

> **Always pass `--build` after a `git pull`.** Plain `docker-compose up -d`
> reuses the existing `trivia-board:latest` image and silently skips the
> rebuild, so you keep running the old code and any fix you just pulled appears
> not to work.
>
> Every boot prints the time the image was built:
>
> ```
> → image built at 2026-08-23T02:19:51Z
> ```
>
> If that timestamp predates your last rebuild, the container is stale. When a
> rebuild genuinely isn't taking, force it:
>
> ```bash
> docker-compose down
> docker rmi trivia-board:latest
> docker-compose build --no-cache
> docker-compose up -d
> ```

Or without compose:

```bash
docker build -t trivia-board .
docker run -d --name trivia-board -p 3737:3737 -v jeopardy-data:/data trivia-board
```

**Your games live in the `/data` volume**, not in the image — rebuilding or
upgrading the container keeps them. `docker-compose down -v` is the only thing
that deletes them.

On first boot the container applies the database migrations, then the app loads
the bundled sample game because the library is empty. Set `SEED_ON_EMPTY=false` to
start with an empty library instead.

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `3737` | Port inside the container |
| `DATABASE_URL` | `file:/data/jeopardy.db` | Where the SQLite file lives |
| `SEED_ON_EMPTY` | `true` | Load the bundled sample game into an empty library |

> **This app has no login.** Anyone who can reach it can edit or delete your
> games, so keep it on a network you trust.

### A note on migrations in the image

The container applies migrations with `docker/migrate.mjs` rather than the
Prisma CLI. The CLI would drag ~290MB of transitive dependencies into the
runtime image just to run one command against plain `.sql` files, and
better-sqlite3 is already in the bundle. The `_prisma_migrations` bookkeeping it
writes is identical to the CLI's, so `npx prisma migrate status` against the
container's database still reports correctly. Locally, keep using the normal
`npx prisma migrate dev`.

## How it's organised

**Dashboard** (`/`) — your library of games. Each one shows how many clues are
written and whether Final Jeopardy is filled in.

- **Play** — run the game
- **Edit** — write questions
- **Duplicate** — the fastest way to build the next game: clone one and rewrite the clues
- **Export / Import** — save a game to a `.json` file and load it back later

**Editor** (`/games/<id>/edit`) — a 5×5 grid mirroring the real board, one tab per
round. Click any tile to write its clue, its correct response, and to flag it as a
Daily Double. Everything saves automatically; watch for "Saved ✓" at the top left.

**Board** (`/play/<id>`) — name the teams, then click tiles to play.

## Running the board

| Key | Does |
| --- | --- |
| `Space` | Start / pause the 30-second timer |
| `Enter` | Reveal the answer |
| `Esc` | Back to the board |

- **Daily Doubles** ask who found it and take a wager before showing the clue. The
  wager is capped at the greater of that team's score or the round's top value.
- **Double Jeopardy →** switches rounds at any time — you don't have to finish the
  first board first, because parties never do.
- **Final Jeopardy** takes hidden wagers (masked on screen so nobody peeks), reveals
  the clue, then you mark each team right or wrong and it works out the standings.
- **Edit scores** fixes any mistake by hand.
- **Reset** clears that game's scores and used tiles so it can be replayed.

Scores, team names, and which tiles are spent survive a refresh or an accidentally
closed laptop — they're saved continuously in the browser. Each game keeps its own
scoreboard, so you can play game one, play game two, and go back to game one with
its scores untouched.

## The sample game

One ready-to-play general-knowledge game, **General Trivia — Sample Game**, ships
with the app.

Edit it, duplicate it, or delete it — it's an ordinary game. To restore it:

```bash
npm run seed
```

That's safe to re-run; it replaces the sample game by name and leaves anything
you've written alone.

## Backups

The whole library lives in one SQLite file at `prisma/dev.db`, which is not in git.
Use **Export** on the dashboard to save a game as JSON if you want a copy that
outlives this machine.

## Stack

Next.js 16 (App Router) · React 19 · Prisma 7 + SQLite · Tailwind 4.

Content lives on the server (`Game` → `Category` → `Clue` in `prisma/schema.prisma`);
the live scoreboard lives in the browser (`src/lib/session.ts`).

## License

[MIT](LICENSE)
