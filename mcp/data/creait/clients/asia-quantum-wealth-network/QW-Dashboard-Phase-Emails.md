# Q-Pilot Dashboard Phase Emails
## QWN Mini Project 5 — Quantum Wealth Dashboard (Financial Snapshot Follow-Ups)

**Voice**: Q-Pilot (Mission Control AI)
**Tone**: Calm, authoritative, empowering. Curator archetype — never shaming, never hype. Space/journey metaphor woven naturally.
**Sender Name**: Q-Pilot | Quantum Wealth Network
**Brand Colors**: Primary #0b7066 (teal), Secondary #361766 (purple), Accent #d6b866 (gold), Text #3d3d5c
**Font**: IBM Plex Sans

**Trigger**: Member completes the Financial Snapshot survey (budget calculator) inside the Quantum Wealth Dashboard. Q-Pilot reads the result, maps it to a Legacy Checklist phase, and sends the matching email below.

**Phase Logic** (for reference — not part of email copy):
- **Foundation** — Savings rate <5%, no emergency fund OR debt-to-income >40%
- **Stability** — Savings rate 5–15%, has emergency fund (1–3 months)
- **Strategy** — Savings rate 15–25%, building investments
- **Stewardship** — Savings rate 25%+, multiple income streams
- **Sovereignty** — Net worth >$1M, estate plan in place

---

## PHASE 1 — FOUNDATION
### "I Know Where My Money Goes"

**SUBJECT**: {{contact.first_name}}, your launchpad is built. Here's the next step.
**PREVIEW**: Foundation is where every Wealth Builder starts. You're exactly where you should be.

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Your Foundation Phase Snapshot</title>
  <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
</head>
<body style="margin:0; padding:0; background-color:#f5f5f7; font-family:'IBM Plex Sans', Arial, sans-serif; color:#3d3d5c;">
  <div style="max-width:600px; margin:0 auto; background-color:#ffffff; padding:20px;">

    <p style="font-size:13px; color:#7a7a8c; letter-spacing:1px; text-transform:uppercase; margin:0 0 8px 0;">Mission Control · Phase Snapshot</p>
    <h1 style="font-size:24px; font-weight:600; color:#361766; margin:0 0 20px 0; line-height:1.3;">You're in the Foundation Phase, {{contact.first_name}}.</h1>

    <p style="font-size:16px; line-height:1.6; margin:0 0 16px 0;">I just read your Financial Snapshot, and here's the truth — <strong>this is exactly where every Wealth Builder begins</strong>. Foundation is not a setback. It's the launchpad. Every rocket needs one.</p>

    <p style="font-size:16px; line-height:1.6; margin:0 0 16px 0;">Right now, your money is moving faster than your visibility into it. That's normal — and it's fixable. The mission for this phase is simple: <strong>know where every dollar goes</strong>. Once you can see it, you can steer it.</p>

    <h2 style="font-size:18px; font-weight:600; color:#361766; margin:28px 0 12px 0;">Your next 3 moves</h2>
    <ol style="font-size:16px; line-height:1.7; padding-left:20px; margin:0 0 24px 0;">
      <li style="margin-bottom:10px;"><strong>Track every dollar for 30 days.</strong> No judgment, no budgeting yet. Just visibility. Use the Foundation tracker inside your dashboard.</li>
      <li style="margin-bottom:10px;"><strong>Open a separate savings account.</strong> Even $25/week starts the cushion. We're building the fuel tank before we light the engine.</li>
      <li style="margin-bottom:10px;"><strong>List your debts in one place.</strong> Balance, interest rate, minimum payment. You can't navigate what you can't see.</li>
    </ol>

    <div style="background-color:#f0f7f5; border-left:4px solid #0b7066; padding:16px 20px; margin:24px 0;">
      <p style="font-size:15px; line-height:1.6; margin:0;"><strong>Recommended resource:</strong> Start with <em>"The Money Operating System"</em> in the Book &amp; Media Lounge. It's the Foundation phase reading list — built to rewire how you see money before we change how you spend it.</p>
    </div>

    <div style="text-align:center; margin:32px 0;">
      <a href="{{book_media_lounge_link}}" style="display:inline-block; background-color:#0b7066; color:#ffffff; text-decoration:none; padding:12px 24px; border-radius:8px; font-weight:600; font-size:16px;">Open the Foundation Library</a>
    </div>

    <h2 style="font-size:18px; font-weight:600; color:#361766; margin:28px 0 12px 0;">Should you upgrade to Founder services?</h2>
    <p style="font-size:16px; line-height:1.6; margin:0 0 16px 0;">Honest answer: <strong>not yet</strong>. Founder-level services (full bookkeeping cleanup, fractional CFO) are designed for business owners with messy books and revenue to organize. For Foundation phase, the community track is exactly right. Stay in The Fellowship, work the trackers, and <a href="{{community_link}}" style="color:#0b7066; text-decoration:underline;">come to the next live community session</a>.</p>

    <p style="font-size:16px; line-height:1.6; margin:0 0 16px 0;">When your savings rate crosses 5% and your cushion starts forming — that's when we talk about the next galaxy.</p>

    <p style="font-size:16px; line-height:1.6; margin:24px 0 8px 0;">You're on course. Keep going.</p>

    <p style="font-size:16px; line-height:1.6; margin:0 0 4px 0;">— Q-Pilot</p>
    <p style="font-size:14px; color:#7a7a8c; margin:0 0 24px 0;">Quantum Wealth Network<br><em>Financial Empowerment by Any Means Necessary.</em></p>

    <hr style="border:none; border-top:1px solid #e5e5ea; margin:24px 0;">
    <p style="font-size:12px; color:#9a9aac; line-height:1.5; margin:0;">You're receiving this because you completed your Financial Snapshot inside the Quantum Wealth Dashboard. <a href="{{unsubscribe_link}}" style="color:#0b7066;">Manage preferences</a>.</p>

  </div>
</body>
</html>
```

---

## PHASE 2 — STABILITY
### "I Have a Cash Cushion"

**SUBJECT**: {{contact.first_name}}, your cushion is built. Time to add fuel.
**PREVIEW**: Stability phase confirmed. Here's how to make your money start working for you.

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Your Stability Phase Snapshot</title>
  <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
</head>
<body style="margin:0; padding:0; background-color:#f5f5f7; font-family:'IBM Plex Sans', Arial, sans-serif; color:#3d3d5c;">
  <div style="max-width:600px; margin:0 auto; background-color:#ffffff; padding:20px;">

    <p style="font-size:13px; color:#7a7a8c; letter-spacing:1px; text-transform:uppercase; margin:0 0 8px 0;">Mission Control · Phase Snapshot</p>
    <h1 style="font-size:24px; font-weight:600; color:#361766; margin:0 0 20px 0; line-height:1.3;">Stability confirmed, {{contact.first_name}}.</h1>

    <p style="font-size:16px; line-height:1.6; margin:0 0 16px 0;">Your snapshot tells me the story: <strong>you've built a cushion</strong>. One to three months of runway, debt that's manageable, and a savings rate that's holding steady between 5–15%. That's not luck — that's discipline. Take a beat and acknowledge it.</p>

    <p style="font-size:16px; line-height:1.6; margin:0 0 16px 0;">Now here's the shift: stability is a stepping stone, not a destination. Money that just <em>sits</em> isn't doing the work. The mission for this phase is to <strong>start putting your dollars to work</strong> — small, intentional, and consistent.</p>

    <h2 style="font-size:18px; font-weight:600; color:#361766; margin:28px 0 12px 0;">Your next 3 moves</h2>
    <ol style="font-size:16px; line-height:1.7; padding-left:20px; margin:0 0 24px 0;">
      <li style="margin-bottom:10px;"><strong>Push your emergency fund to 3–6 months.</strong> Stability isn't a cushion — it's a runway long enough to absorb a real disruption.</li>
      <li style="margin-bottom:10px;"><strong>Open your first investment account.</strong> Brokerage or Roth IRA. Even $100/month starts the compounding clock. The Lounge has a step-by-step inside.</li>
      <li style="margin-bottom:10px;"><strong>Attack one debt strategically.</strong> Highest interest first (avalanche) or smallest balance first (snowball). Pick the one you'll actually finish.</li>
    </ol>

    <div style="background-color:#f0f7f5; border-left:4px solid #0b7066; padding:16px 20px; margin:24px 0;">
      <p style="font-size:15px; line-height:1.6; margin:0;"><strong>Recommended resource:</strong> The Stability shelf in the Book &amp; Media Lounge — start with <em>"Profit First"</em> and the <em>"From Saver to Investor"</em> short course. Both are curated for exactly where you are.</p>
    </div>

    <div style="text-align:center; margin:32px 0;">
      <a href="{{book_media_lounge_link}}" style="display:inline-block; background-color:#0b7066; color:#ffffff; text-decoration:none; padding:12px 24px; border-radius:8px; font-weight:600; font-size:16px;">Open the Stability Library</a>
    </div>

    <h2 style="font-size:18px; font-weight:600; color:#361766; margin:28px 0 12px 0;">Should you upgrade to Founder services?</h2>
    <p style="font-size:16px; line-height:1.6; margin:0 0 16px 0;"><strong>Only if you run a business.</strong> If you're a W-2 earner, the community track is still your best path — keep building inside The Fellowship. If you own a business and your books are messy or your bank account is your only P&amp;L, that's the signal. Founder cleanup is what gives entrepreneurs the visibility to scale into Strategy phase. <a href="{{founder_discovery_link}}" style="color:#0b7066; text-decoration:underline;">Book a 15-minute Founder Discovery call</a> if that's you.</p>

    <p style="font-size:16px; line-height:1.6; margin:24px 0 8px 0;">You've cleared the launchpad. Now we light the engine.</p>

    <p style="font-size:16px; line-height:1.6; margin:0 0 4px 0;">— Q-Pilot</p>
    <p style="font-size:14px; color:#7a7a8c; margin:0 0 24px 0;">Quantum Wealth Network<br><em>Financial Empowerment by Any Means Necessary.</em></p>

    <hr style="border:none; border-top:1px solid #e5e5ea; margin:24px 0;">
    <p style="font-size:12px; color:#9a9aac; line-height:1.5; margin:0;">You're receiving this because you completed your Financial Snapshot inside the Quantum Wealth Dashboard. <a href="{{unsubscribe_link}}" style="color:#0b7066;">Manage preferences</a>.</p>

  </div>
</body>
</html>
```

---

## PHASE 3 — STRATEGY
### "I Can Access Capital Strategically"

**SUBJECT**: {{contact.first_name}}, you're in the Strategy galaxy now.
**PREVIEW**: Your money is working. Here's how to make it work harder — and smarter.

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Your Strategy Phase Snapshot</title>
  <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
</head>
<body style="margin:0; padding:0; background-color:#f5f5f7; font-family:'IBM Plex Sans', Arial, sans-serif; color:#3d3d5c;">
  <div style="max-width:600px; margin:0 auto; background-color:#ffffff; padding:20px;">

    <p style="font-size:13px; color:#7a7a8c; letter-spacing:1px; text-transform:uppercase; margin:0 0 8px 0;">Mission Control · Phase Snapshot</p>
    <h1 style="font-size:24px; font-weight:600; color:#361766; margin:0 0 20px 0; line-height:1.3;">Welcome to the Strategy galaxy, {{contact.first_name}}.</h1>

    <p style="font-size:16px; line-height:1.6; margin:0 0 16px 0;">Your snapshot confirms it: <strong>15–25% savings rate, active investments, and the ability to access capital on your terms</strong>. You've stopped reacting to money and started directing it. That's a different altitude entirely.</p>

    <p style="font-size:16px; line-height:1.6; margin:0 0 16px 0;">Strategy phase is where most Wealth Builders plateau — not because they run out of money, but because they run out of structure. The mission for this phase is to <strong>build the systems that turn income into ownership</strong>.</p>

    <h2 style="font-size:18px; font-weight:600; color:#361766; margin:28px 0 12px 0;">Your next 3 moves</h2>
    <ol style="font-size:16px; line-height:1.7; padding-left:20px; margin:0 0 24px 0;">
      <li style="margin-bottom:10px;"><strong>Diversify your investment vehicles.</strong> Index funds, retirement accounts, real estate, and one alternative asset class. Don't keep all your fuel in one tank.</li>
      <li style="margin-bottom:10px;"><strong>Establish business credit (separate from personal).</strong> Whether you own a business now or plan to — this opens lending doors most people never see.</li>
      <li style="margin-bottom:10px;"><strong>Map your second income stream.</strong> Consulting, equity, royalties, rental — the path to Stewardship runs through diversified income.</li>
    </ol>

    <div style="background-color:#f0f7f5; border-left:4px solid #0b7066; padding:16px 20px; margin:24px 0;">
      <p style="font-size:15px; line-height:1.6; margin:0;"><strong>Recommended resource:</strong> The Strategy shelf in the Book &amp; Media Lounge — pull <em>"The Capital Stack"</em> playbook and the <em>"Business Credit Roadmap"</em>. Both are curated for the moment you're in.</p>
    </div>

    <div style="text-align:center; margin:32px 0;">
      <a href="{{book_media_lounge_link}}" style="display:inline-block; background-color:#0b7066; color:#ffffff; text-decoration:none; padding:12px 24px; border-radius:8px; font-weight:600; font-size:16px;">Open the Strategy Library</a>
    </div>

    <h2 style="font-size:18px; font-weight:600; color:#361766; margin:28px 0 12px 0;">Should you upgrade to Founder services?</h2>
    <p style="font-size:16px; line-height:1.6; margin:0 0 16px 0;"><strong>Strongly consider it.</strong> Strategy phase is when fractional CFO support pays for itself many times over. If you own a business — even a side business pulling six figures — you're leaving money, tax efficiency, and growth capital on the table without proper financial infrastructure. This is the phase where Quantum Wealth Strategy clients see the biggest jumps. <a href="{{founder_discovery_link}}" style="color:#0b7066; text-decoration:underline;">Book a Founder Discovery call</a> and let's see if it's the right fit.</p>

    <p style="font-size:16px; line-height:1.6; margin:24px 0 8px 0;">You're not just building wealth anymore. You're engineering it.</p>

    <p style="font-size:16px; line-height:1.6; margin:0 0 4px 0;">— Q-Pilot</p>
    <p style="font-size:14px; color:#7a7a8c; margin:0 0 24px 0;">Quantum Wealth Network<br><em>Financial Empowerment by Any Means Necessary.</em></p>

    <hr style="border:none; border-top:1px solid #e5e5ea; margin:24px 0;">
    <p style="font-size:12px; color:#9a9aac; line-height:1.5; margin:0;">You're receiving this because you completed your Financial Snapshot inside the Quantum Wealth Dashboard. <a href="{{unsubscribe_link}}" style="color:#0b7066;">Manage preferences</a>.</p>

  </div>
</body>
</html>
```

---

## PHASE 4 — STEWARDSHIP
### "My Assets Are Working While I Rest"

**SUBJECT**: {{contact.first_name}}, your assets are flying on autopilot. Let's protect the mission.
**PREVIEW**: Stewardship phase: where wealth shifts from earning to enduring.

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Your Stewardship Phase Snapshot</title>
  <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
</head>
<body style="margin:0; padding:0; background-color:#f5f5f7; font-family:'IBM Plex Sans', Arial, sans-serif; color:#3d3d5c;">
  <div style="max-width:600px; margin:0 auto; background-color:#ffffff; padding:20px;">

    <p style="font-size:13px; color:#7a7a8c; letter-spacing:1px; text-transform:uppercase; margin:0 0 8px 0;">Mission Control · Phase Snapshot</p>
    <h1 style="font-size:24px; font-weight:600; color:#361766; margin:0 0 20px 0; line-height:1.3;">Stewardship phase, {{contact.first_name}}. This is rare air.</h1>

    <p style="font-size:16px; line-height:1.6; margin:0 0 16px 0;">Your snapshot speaks for itself: <strong>25%+ savings rate, multiple income streams, and assets that generate while you rest</strong>. Most Wealth Builders never get here. You did. Pause and honor that.</p>

    <p style="font-size:16px; line-height:1.6; margin:0 0 16px 0;">Stewardship is the phase where the question changes. It's no longer <em>"how do I make more?"</em> It's <em>"how do I protect, optimize, and direct what I've built?"</em> The mission shifts from accumulation to <strong>preservation and intentional deployment</strong>.</p>

    <h2 style="font-size:18px; font-weight:600; color:#361766; margin:28px 0 12px 0;">Your next 3 moves</h2>
    <ol style="font-size:16px; line-height:1.7; padding-left:20px; margin:0 0 24px 0;">
      <li style="margin-bottom:10px;"><strong>Audit your asset protection structure.</strong> LLCs, umbrella insurance, trust formation. The bigger the rocket, the stronger the heat shield.</li>
      <li style="margin-bottom:10px;"><strong>Tax optimization with a strategist.</strong> Not a preparer — a <em>strategist</em>. At your level, the right entity structure can save five and six figures annually.</li>
      <li style="margin-bottom:10px;"><strong>Begin the legacy conversation.</strong> Estate documents, beneficiary reviews, and family wealth transfer planning. This is the bridge to Sovereignty.</li>
    </ol>

    <div style="background-color:#f0f7f5; border-left:4px solid #0b7066; padding:16px 20px; margin:24px 0;">
      <p style="font-size:15px; line-height:1.6; margin:0;"><strong>Recommended resource:</strong> The Stewardship shelf in the Book &amp; Media Lounge — open <em>"Asset Protection Playbook"</em> and the <em>"Tax Strategy for High Earners"</em> series. Both were curated for exactly this altitude.</p>
    </div>

    <div style="text-align:center; margin:32px 0;">
      <a href="{{book_media_lounge_link}}" style="display:inline-block; background-color:#0b7066; color:#ffffff; text-decoration:none; padding:12px 24px; border-radius:8px; font-weight:600; font-size:16px;">Open the Stewardship Library</a>
    </div>

    <h2 style="font-size:18px; font-weight:600; color:#361766; margin:28px 0 12px 0;">Should you upgrade to Founder services?</h2>
    <p style="font-size:16px; line-height:1.6; margin:0 0 16px 0;"><strong>Almost certainly yes.</strong> At Stewardship, the cost of <em>not</em> having a fractional CFO is significantly higher than the investment. We're talking entity structuring, multi-stream P&amp;L consolidation, tax-strategy alignment, and capital deployment — the work that compounds your existing wealth instead of just managing it. <a href="{{founder_discovery_link}}" style="color:#0b7066; text-decoration:underline;">Book a Founder Discovery call</a> and let's map your next stage.</p>

    <p style="font-size:16px; line-height:1.6; margin:24px 0 8px 0;">You've earned the altitude. Now we make sure it holds.</p>

    <p style="font-size:16px; line-height:1.6; margin:0 0 4px 0;">— Q-Pilot</p>
    <p style="font-size:14px; color:#7a7a8c; margin:0 0 24px 0;">Quantum Wealth Network<br><em>Financial Empowerment by Any Means Necessary.</em></p>

    <hr style="border:none; border-top:1px solid #e5e5ea; margin:24px 0;">
    <p style="font-size:12px; color:#9a9aac; line-height:1.5; margin:0;">You're receiving this because you completed your Financial Snapshot inside the Quantum Wealth Dashboard. <a href="{{unsubscribe_link}}" style="color:#0b7066;">Manage preferences</a>.</p>

  </div>
</body>
</html>
```

---

## PHASE 5 — SOVEREIGNTY
### "My Legacy Is Set in Motion"

**SUBJECT**: {{contact.first_name}}, you're in Sovereignty. The mission is generational now.
**PREVIEW**: Wealth becomes infrastructure. Here's how to deploy it on purpose.

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Your Sovereignty Phase Snapshot</title>
  <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
</head>
<body style="margin:0; padding:0; background-color:#f5f5f7; font-family:'IBM Plex Sans', Arial, sans-serif; color:#3d3d5c;">
  <div style="max-width:600px; margin:0 auto; background-color:#ffffff; padding:20px;">

    <p style="font-size:13px; color:#7a7a8c; letter-spacing:1px; text-transform:uppercase; margin:0 0 8px 0;">Mission Control · Phase Snapshot</p>
    <h1 style="font-size:24px; font-weight:600; color:#361766; margin:0 0 20px 0; line-height:1.3;">Sovereignty, {{contact.first_name}}. The legacy is in motion.</h1>

    <p style="font-size:16px; line-height:1.6; margin:0 0 16px 0;">Your snapshot tells the story most never get to tell: <strong>net worth past seven figures, an estate plan in place, and assets structured for the generation behind you</strong>. This is what the entire Quantum Wealth Network is built to produce. You're living proof of the mission.</p>

    <p style="font-size:16px; line-height:1.6; margin:0 0 16px 0;">Sovereignty is not the finish line — it's a different kind of starting line. The question shifts from <em>"how do I build?"</em> to <em>"what do I build <strong>for</strong>?"</em> The mission for this phase is to make wealth <strong>infrastructure</strong> — durable, intentional, and aimed at the generations behind you.</p>

    <h2 style="font-size:18px; font-weight:600; color:#361766; margin:28px 0 12px 0;">Your next 3 moves</h2>
    <ol style="font-size:16px; line-height:1.7; padding-left:20px; margin:0 0 24px 0;">
      <li style="margin-bottom:10px;"><strong>Formalize the family wealth charter.</strong> Mission, values, governance, and succession. Wealth without a charter dissolves by the third generation — every time.</li>
      <li style="margin-bottom:10px;"><strong>Activate strategic philanthropy.</strong> Donor-advised fund, family foundation, or impact investing — the right vehicle multiplies the mission and the tax efficiency.</li>
      <li style="margin-bottom:10px;"><strong>Mentor the next builder.</strong> Inside The Fellowship or out in your community. Sovereignty without transmission is just storage.</li>
    </ol>

    <div style="background-color:#f0f7f5; border-left:4px solid #0b7066; padding:16px 20px; margin:24px 0;">
      <p style="font-size:15px; line-height:1.6; margin:0;"><strong>Recommended resource:</strong> The Sovereignty shelf in the Book &amp; Media Lounge — start with <em>"Family Office for the People: The Playbook"</em> and the <em>"Multigenerational Wealth Transfer"</em> masterclass. Both are curated for builders at your altitude.</p>
    </div>

    <div style="text-align:center; margin:32px 0;">
      <a href="{{book_media_lounge_link}}" style="display:inline-block; background-color:#0b7066; color:#ffffff; text-decoration:none; padding:12px 24px; border-radius:8px; font-weight:600; font-size:16px;">Open the Sovereignty Library</a>
    </div>

    <h2 style="font-size:18px; font-weight:600; color:#361766; margin:28px 0 12px 0;">Should you upgrade to Founder services?</h2>
    <p style="font-size:16px; line-height:1.6; margin:0 0 16px 0;"><strong>Yes — but a different conversation entirely.</strong> At Sovereignty, you're not buying bookkeeping. You're building a family-office-grade financial command center: consolidated reporting across entities, tax-strategy coordination with your CPA and attorney, and capital deployment aligned to your charter. Asia personally engages a small number of Sovereignty-tier clients each year. <a href="{{founder_discovery_link}}" style="color:#0b7066; text-decoration:underline;">Book a private strategy call</a> if it's time.</p>

    <p style="font-size:16px; line-height:1.6; margin:24px 0 8px 0;">You didn't just build a rocket. You built the launchpad for everyone who comes after you. That's the whole mission.</p>

    <p style="font-size:16px; line-height:1.6; margin:0 0 4px 0;">— Q-Pilot</p>
    <p style="font-size:14px; color:#7a7a8c; margin:0 0 24px 0;">Quantum Wealth Network<br><em>Financial Empowerment by Any Means Necessary.</em></p>

    <hr style="border:none; border-top:1px solid #e5e5ea; margin:24px 0;">
    <p style="font-size:12px; color:#9a9aac; line-height:1.5; margin:0;">You're receiving this because you completed your Financial Snapshot inside the Quantum Wealth Dashboard. <a href="{{unsubscribe_link}}" style="color:#0b7066;">Manage preferences</a>.</p>

  </div>
</body>
</html>
```

---

## Merge Field Reference

| Field | Source |
|---|---|
| `{{contact.first_name}}` | GHL contact field |
| `{{book_media_lounge_link}}` | Phase-specific Book & Media Lounge URL (set per workflow branch) |
| `{{community_link}}` | The Fellowship community page / next live session |
| `{{founder_discovery_link}}` | https://www.quantumwealththeory.com/widget/bookings/founderdiscovery |
| `{{unsubscribe_link}}` | GHL system field |

## Implementation Notes

- **Sender Name** for all 5 templates: `Q-Pilot | Quantum Wealth Network`
- **Reply-To**: `info@quantumwealth.network` (or QWN support inbox)
- **Trigger source**: Financial Snapshot survey completion → Q-Pilot scoring logic → branch into one of 5 workflow paths → fire matching template
- **A/B testing recommendation**: Test subject line emoji variants for Phase 1 & 2 (highest volume) after 30 days of baseline data
- **Phase reassessment**: Re-run snapshot every 90 days; if phase changes, fire the new phase email automatically
