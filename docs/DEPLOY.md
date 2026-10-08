# Deploying MoneyMap on Render

MoneyMap deploys as one service: the API, the API docs and the customer app.

## Steps

1. Sign in at render.com and connect your GitHub account.
2. Choose **New → Blueprint** and select the `moneymap` repository.
3. Pick the branch that contains the code (currently `claude/wonderful-lovelace-627jwh`, or `main` once it's merged).
4. Render reads `render.yaml` and creates a web service called **moneymap** from the Dockerfile. It also generates `MONEYMAP_SECRET` automatically.
5. Wait for the first build to finish (a few minutes). Your service gets a public address like `https://moneymap-xxxx.onrender.com`.

Then check:

- `https://…onrender.com/` — the customer app
- `https://…onrender.com/docs` — the API documentation (judges can try endpoints here)
- `https://…onrender.com/api/v1/health` — should return `"status":"ok"`

## Things to know about the free plan

- **It sleeps when unused.** After a period with no visits the service spins down, and the next visit can take close to a minute to wake it. **Open the link a few minutes before you present.**
- **Data resets on every restart or redeploy.** The free plan has no persistent disk, so the SQLite database starts fresh with the seeded customers and products. For a demo this is useful: you always start clean. Use Demo Mode → Reset everything to reset mid-demo.
- **Paid plans:** add a persistent disk mounted at `/data` if you want data to survive restarts.

## Backup plan

If the venue internet fails, run it on a laptop:

```bash
npm install
npm run build:server-app
npm start            # http://localhost:8080
```

Or use the single-page version (no server needed), linked in the README.
