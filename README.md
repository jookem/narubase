# NaruBase

ESL teaching app for Japanese students. Built with React 19 + Vite + TypeScript + Supabase.

## Stack

- React 19 + Vite + TypeScript
- React Router v7
- Tailwind CSS v4
- shadcn/ui
- Supabase (auth + database + storage)
- Vercel (hosting)

## Development

```bash
npm install
npm run dev
```

Requires a `.env.local` file with:

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

## Deploy

Auto-deploys to Vercel on push to `main`.
