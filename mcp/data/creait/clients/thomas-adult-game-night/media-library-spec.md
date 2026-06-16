# Media Library — Folder Structure Spec

**State:** CreateOS media library is empty (`/medias/files` returns 0 files). API supports listing but **upload requires multipart** which CreateOS hasn't exposed in a simple way. Spec the structure here so when Maurice bulk-uploads in the UI, organization is consistent.

**API verified:**
- ✅ `GET /medias/files?altId={loc}&altType=location&type=file|folder|all` — list works
- 🟡 `POST /medias/upload-file` — exists but needs multipart form-data (out of scope for Track A; UI bulk upload is faster anyway)

## Recommended folder structure

```
/Adult Game Nights Media Library/
│
├── Brand/
│   ├── Logos/                       (PNG, SVG, transparent BG variants)
│   ├── Fonts/                       (if custom)
│   └── Style guide PDFs/
│
├── Products/
│   ├── Liquor Store Game/
│   │   ├── Box shots/
│   │   ├── Cards-spread/
│   │   ├── In-action lifestyle/
│   │   └── App screenshots/
│   ├── 3D Prints/
│   │   ├── NFC keychains/
│   │   ├── Game pieces/
│   │   └── Wine holders/
│   └── Future games/                (smoking section, sex store, etc.)
│
├── Service/
│   ├── Past events/                 (sortable by event name)
│   ├── Setup shots/
│   └── Thomas hosting/
│
├── Game Show/
│   ├── Pilot footage/
│   ├── Stage / studio/
│   └── Sponsor logos/
│
├── Events/
│   ├── 2026-07-03 Russell Center/
│   ├── (per-event subfolder going forward)
│   └── Event flyers/
│
├── Email assets/
│   └── (used in /email-templates/*.html — hero images, CTAs)
│
├── Social media/
│   ├── Posts/
│   │   ├── Reels/
│   │   ├── Stories/
│   │   └── Statics/
│   └── User-generated/
│
└── Internal/
    ├── Press kits/
    ├── Pitch decks/                 (sponsorship, wholesale)
    └── Contracts and templates/
```

## Naming convention

- Use **kebab-case** for filenames: `liquor-store-box-front.png`, `russell-center-flyer-v2.pdf`
- Date-stamp time-sensitive content: `2026-05-russell-center-flyer.png`
- Version when iterating: `-v1`, `-v2`
- Resolution suffix when relevant: `-2x.png`, `-thumb.jpg`

## What to upload first (priority)

If Thomas can drop these into the right folders, the AI agents and email templates immediately level up:

1. **Brand logos** — both light and dark, transparent BG. Used in email headers (currently the email shell uses a text badge "ADULT GAME NIGHTS" — could swap to logo image once available).
2. **Liquor Store box hero** — used in cart abandonment emails, social hero post.
3. **One photo of Thomas hosting** — used in service-tier social post + sponsor pitch deck.
4. **Russell Center event flyer** — gets used in the event-template landing page + reminder emails.
5. **Sponsor pitch deck PDF** — referenced by the `sponsor_pitch` email's "media kit" link.

## Folder creation in UI

CreateOS UI: **Media Library → + New Folder**. Replicate the structure above. Should take 5 minutes.

## After folders exist

The 7 launch posts in [`config/social-launch-posts.json`](../config/social-launch-posts.json) currently have `media_recommendation` text fields (e.g., "Top-down shot of the box w/ cards spread"). Once those photos are in the media library, Maurice can attach them in CreateOS Social Planner before scheduling.

The 20 email templates in [`/email-templates/`](../email-templates/) currently have no embedded images (text-only with brand-color badges). Maurice can replace the text badge with an `<img>` tag pointing at `/Brand/Logos/agn-logo-dark-on-yellow.png` once uploaded.
