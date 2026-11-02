# ACCT 2301 · Ch 6–8 live review

A one-hour review deck for Wild, *Financial Accounting*, chapters 6–8, with live phone polls and a timed final game.

- `/` is the phone page. Students scan the QR code on screen, pick a name, and answer.
- `/present` is the slideshow. Enter the presenter key once to turn on live answers.

## How it works

`public/index.html` holds the slides, phone page and game. Phones and the presenter talk through one Vercel function, `api/live.js`, which keeps the current slide state and each phone's answer in Postgres (Neon). Phones check in about once a second; only the presenter key can change what is on screen.

## Setup

1. Connect a Neon database to the Vercel project (Storage tab). It provides `DATABASE_URL`.
2. Set `PRESENTER_KEY` in the project's environment variables.
3. Deploy. Tables are created on the first request.

## Presenting

→ / space / click: next · ←: back · R: reveal a poll · F: full screen (Esc to leave). "Reset answers" clears the room before class.
