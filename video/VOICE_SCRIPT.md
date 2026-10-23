# RetailPulse AI — voiceover script (2:00)

Timestamps are where each line starts in `out/RetailPulseAI.mp4`. A natural pace (about 150 words a minute) fits every slot.
Say "₹80,000" as "eighty thousand rupees", "FastAPI" as "Fast A-P-I", and "pgvector" as "P-G vector".

## 01 — The vision (0:00–0:14)

| Cue | Line |
|---|---|
| 0:00.6 | Retail is evolving. |
| 0:02.5 | But disconnected data, inconsistent customer experiences, and inventory challenges still slow businesses down. |
| 0:10.3 | Meet RetailPulse AI. |

## 02 — Intelligent shopping (0:14–0:41)

| Cue | Line |
|---|---|
| 0:14.4 | RetailPulse AI turns natural-language requests into personalized recommendations, grounded in real product data and store availability. |
| 0:23.9 | Ask for a laptop for Java development, under eighty thousand rupees, that you can pick up today. |
| 0:30.4 | The assistant turns your words into filters, ranks only real products from the catalog, and pulls live prices and stock straight from the database. |

## 03 — Trustworthy AI (0:41–1:05)

| Cue | Line |
|---|---|
| 0:41.9 | Answers are grounded in approved retail policies, with traceable sources: the document, the section, and the version. |
| 0:50.1 | Retrieval filters by country, membership tier, and effective date, so customers only see the rules that apply to them. |
| 0:56.7 | And when the evidence is missing, RetailPulse says so clearly, with safeguards instead of guesses. |

## 04 — AI-powered operations (1:05–1:36)

| Cue | Line |
|---|---|
| 1:05.9 | From inventory insights to support workflows, AI proposes actions, while secure backend controls enforce permissions and confirmation. |
| 1:14.7 | A cracked screen becomes a high-priority support ticket, created only when the customer presses Confirm. |
| 1:21.5 | Store managers get low-stock alerts and approve AI-proposed stock updates, scoped to their own store. |
| 1:28.6 | And every proposal, confirmation, and denial lands in an append-only audit trail. |

## 05 — Closing (1:36–2:00)

| Cue | Line |
|---|---|
| 1:36.0 | *(montage — music only)* |
| 1:42.0 | One modular platform: React, FastAPI, and PostgreSQL with pgvector, with every AI output validated on the server. |
| 1:51.6 | RetailPulse AI. |
| 1:54.1 | Smarter shopping. *(pause)* Connected operations. *(pause)* AI you can trust. |

## Recording your own voice

Save each line as a 16-bit WAV named by its id and put it in `public/voice/`, replacing the generated file:
`v01–v03` (vision), `s01–s03` (shopping), `t01–t03` (trust), `o01–o04` (operations), `c01–c03` (closing), in the order above.
Then run `../backend/.venv/bin/python scripts/voiceover.py` from `video/`: it keeps existing clips (no OpenAI call) and
re-measures them so the captions follow your timing. Render again with `npx remotion render RetailPulseAI out/RetailPulseAI.mp4`.
