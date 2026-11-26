# Pre-event testing checklist

Run through this on the **production URL** with the real Supabase backend, then reset data.

## Backend
- [ ] `config` action returns JSON (README §2b curl).
- [ ] REST probe is denied: `GET /rest/v1/question_options?select=*` with the publishable key returns `[]` or a permission error — **never** rows with `is_correct`.
- [ ] Same for `participants`, `attempts`, `participant_answers`.
- [ ] Admin user exists in `admin_users`; a non-admin Auth user sees "This account does not have admin access".

## Participant flow (test on Android + iPhone)
- [ ] QR opens the landing page; theme toggle switches all 3 themes.
- [ ] Register with invalid email / missing fields → inline errors.
- [ ] Register without consent → blocked.
- [ ] Register succeeds → Instructions show the configured numbers.
- [ ] Re-register with the same email (also `Name+x@gmail.com`, dots variant) → "already used".
- [ ] Start quiz → timer counts down; progress bar and navigator update.
- [ ] Answer, refresh the page mid-quiz → answers and remaining time are preserved.
- [ ] Airplane mode mid-quiz → "Offline" banner; answer more; reconnect → "All answers saved".
- [ ] Keyboard (desktop): 1–4 / A–D select, ← → navigate.
- [ ] Submit dialog lists unanswered questions; submit → result page with rank.
- [ ] Let the timer hit 0 on a second test account → "Time's up" → auto-submitted result.
- [ ] Close the browser mid-quiz and never return → attempt is auto-finalised within ~40 s of the deadline (appears on admin leaderboard).
- [ ] Revisiting `/quiz` after submitting → redirected to result (no second attempt).

## Leaderboard
- [ ] Podium + top 10; ordering = score ↓, time ↑, earliest submission.
- [ ] Day 1 / Day 2 / Overall tabs filter correctly; counts update.
- [ ] New submission appears within ~5 s.
- [ ] No emails or phone numbers visible anywhere.
- [ ] Full screen on the booth monitor; `?rotate=1` alternates views; unplug network → "Reconnecting…" → recovers.

## Admin
- [ ] Dashboard stats match reality; toggles (quiz live / registration / active day) take effect on the public site.
- [ ] Create, edit, deactivate, delete a question; CSV import with template; CSV export.
- [ ] Deleting a question that was already used → archived message.
- [ ] Settings: change duration/question count → new attempts use them.
- [ ] Participants: search, department/day/status filters, detail drawer with answers, CSV export opens correctly in Excel.
- [ ] Disqualify → disappears from public leaderboard; reinstate → returns.
- [ ] Reset data requires typing `RESET`.

## Responsiveness
- [ ] 360 px phone, tablet, laptop, 1080p and 4K monitor: no horizontal overflow, text readable.

## Final
- [ ] Reset rehearsal data.
- [ ] Set **Active day = Day 1**, Quiz live ON, Registration ON on the morning of Nov 28.
- [ ] Switch to **Day 2** on Nov 29.
