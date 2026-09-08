/**
 * The CREAiT Growth & AI Diagnostic — facilitation copy.
 *
 * What this file is: everything the person running the engagement says out
 * loud, plus the rules for turning what they heard into a score. It is written
 * so that someone with no consulting background can run a four-hour session
 * with the owner of a substantial company and score it correctly afterwards.
 *
 * Two exports, two moments:
 *
 *  1. `SESSION_BLOCK_SCRIPTS` — the live four-hour Diagnostic Intensive, in the
 *     five blocks the Facilitator Guide defines. Keyed by the `BlockId` in
 *     `lib/assessment-session.ts`, which owns the block STRUCTURE (labels,
 *     minute budgets, pillar mapping, where notes are stored). This file owns
 *     only the COPY, so the script can be rewritten without touching the shape.
 *     Prompts appear in the order the guide walks them.
 *
 *  2. `FACILITATION` — the after-the-fact scoring layer, one entry per
 *     indicator in `lib/assessment-instrument.ts`. The guide has the advisor
 *     score all thirty indicators the same day, from the session notes. These
 *     entries say what in the notes signals each level and how to choose
 *     between adjacent scores. `askIfMissing` is the short request to send when
 *     the notes are silent on an indicator.
 *
 * PROVENANCE — read this before changing any string:
 *   `source: "guide"`     the line is transcribed from the stress-tested
 *                         product source and is Maurice's own method:
 *                         02-Delivery-System/Facilitator-Guide.md,
 *                         01-Product-Design/Master-Intake-Questionnaire.md
 *                         (the 🪞 Mirror instruments, which that document says
 *                         to ask exactly as written), or 04-Website/snapshot.html
 *                         (the Snapshot screener, where the plainest
 *                         owner-facing phrasing already lives). Each carries a
 *                         comment naming its file.
 *   `source: "authored"`  written for this workbench to fill a gap the product
 *                         source leaves open. Not yet client-approved.
 *
 * VOICE RULES, which edits must keep:
 *  - One question per `ask`. Never stack two.
 *  - Curious and specific. Never quizzing, never consultant jargon.
 *  - Prefer questions that surface a number, a last-time story, or an artifact
 *    you can look at. Opinions do not make a $7,500 report defensible.
 *  - `listenFor` bullets are observable — what was said, not what it means.
 *  - Never promise an outcome, never sell, never editorialize about AI. The
 *    guide's posture: curious operator, not interrogator; no verdict on the day.
 *
 * SCORING CONVENTIONS these entries assume:
 *  - Anchors live at every level 0–4 in `assessment-instrument.ts` (rubric v2
 *    wrote 1 and 3 out); the `scoreHint`s still name the 2-to-3 line because
 *    that is the boundary facilitators get wrong most often.
 *  - "Not currently known" is a valid answer and is never scored as zero — it
 *    is a low score with a reason, or N/A, which leaves the denominator.
 *  - Evidence confidence (Reported / Demonstrated / Documented) is logged
 *    separately and never changes the score; it widens the financial ranges.
 *    Prompts that ask to see something are how Reported becomes Documented.
 */

import type { IndicatorKey } from "@/lib/assessment-instrument";

/** Where a line came from. See the PROVENANCE note above. */
export type FacilitationSource = "guide" | "authored";

/**
 * The five blocks of the intensive. Deliberately declared here rather than
 * imported, so this file carries no dependencies and can ship on its own.
 * It is the same union as `BlockId` in `lib/assessment-session.ts`, which owns
 * the block structure — indexing `SESSION_BLOCK_SCRIPTS` with a `BlockId` type
 * checks fine. Keep the two in sync if a block is ever added or removed.
 */
export type BlockKey = "b1" | "b2" | "b3" | "b4" | "b5";

export interface SessionPrompt {
  /** Stable slug — safe to key notes and UI state from. */
  id: string;
  /**
   * The time box, in minutes. Every block's prompts sum exactly to that block's
   * budget in `SESSION_BLOCKS` (b1 30, b2 60, b3 60, b4 45, b5 30), which
   * `validateSessionScripts()` in lib/assessment-session.ts asserts. Weighting
   * follows what the guide says earns the minutes: the live four-week test and
   * the systems tour are the two longest questions in the day; mechanical
   * one-answer questions get two or three minutes and no more.
   */
  minutes: number;
  /**
   * On the triage list — the questions a facilitator drops when the block is
   * running over. Every prompt marked here feeds only indicators that another,
   * unmarked prompt also feeds, so dropping the whole list costs coverage of no
   * indicator. See `TRIAGE_PROMPT_IDS` below.
   */
  cutWhenLong?: boolean;
  /** Read aloud, verbatim. One question. */
  ask: string;
  /** One line for the facilitator only: why this question earns its minutes. */
  why: string;
  /** 2–3 observable signals in the answer. */
  listenFor: string[];
  /** One probe when the answer is vague. */
  followUp?: string;
  /** The number or artifact to write down before moving on. */
  capture?: string;
  source: FacilitationSource;
  /** Indicator keys this answer will later be scored into. */
  feedsIndicators: string[];
}

export interface BlockScript {
  /** One sentence orienting the facilitator before the block starts. */
  purpose: string;
  /** Read aloud to open the block. */
  openWith: string;
  /** The working questions, in the order the guide walks them. */
  prompts: SessionPrompt[];
  /** The guide's 🪞 key moments, repeated here for quick reference. */
  keyMoments: string[];
  /** What must be written down before the block ends. */
  capture: string[];
  /** Read aloud to close the session. Block 5 only. */
  closeWith?: string;
}

export const SESSION_BLOCK_SCRIPTS: Record<BlockKey, BlockScript> = {
  // ── BLOCK 1 · Story & Destination · 30 min ────────────────────────────────
  b1: {
    purpose:
      "Get their story, their destination, and their own words for the bottleneck — before any evidence has a chance to contradict them.",
    openWith:
      "Before we dig into anything, I want the story. Take me from the start — how did this business come to exist?",
    prompts: [
      {
        id: "b1-role-today",
        minutes: 4,
        cutWhenLong: true,
        ask: "Walk me through a normal Tuesday for you — what do you actually spend the day doing?",
        why: "The gap between the role they describe and the role they perform is the first sighting of owner dependence.",
        listenFor: [
          "Names tasks a manager or a coordinator would normally do",
          "Says 'it depends on the day' and cannot land on a pattern",
          "Describes putting out fires rather than planned work",
        ],
        capture: "Hours per week, and the two or three tasks that fill them.",
        source: "authored",
        feedsIndicators: ["S1", "L4"],
      },
      {
        // Master-Intake-Questionnaire.md Q4, verbatim.
        id: "b1-twelve-month",
        minutes: 5,
        ask: "What three measurable outcomes would make the next twelve months a success?",
        why: "Everything in the results session gets measured against this answer, so it has to be in their words and it has to carry numbers.",
        listenFor: [
          "Gives targets with numbers attached, not adjectives",
          "Names a personal outcome alongside the business ones",
          "Struggles to get to three",
        ],
        followUp: "What would that look like as a number?",
        capture: "Three outcomes, each with a target. Verbatim.",
        source: "guide",
        feedsIndicators: [],
      },
      {
        // Master-Intake-Questionnaire.md Q5, verbatim.
        id: "b1-three-year",
        minutes: 5,
        ask: "Describe the business you want to own three years from now — size, profit, team, systems, and your role in it.",
        why: "The destination. Their role in it is the part that matters most, and the part they answer last.",
        listenFor: [
          "Describes a role noticeably smaller than the one they hold today",
          "Names a person they expect to be running it",
          "Answers only in revenue terms and skips their own role",
        ],
        followUp: "And where are you in that picture?",
        capture: "Their words for the three-year role. Verbatim.",
        source: "guide",
        feedsIndicators: [],
      },
      {
        id: "b1-stakeholders",
        minutes: 2,
        ask: "Who else has a stake in that answer?",
        why: "Surfaces partners, family and managers whose agreement the ninety-day plan will quietly need.",
        listenFor: [
          "Names a co-owner or spouse with a different view",
          "Says 'just me' in a business with a leadership team",
          "Mentions someone whose buy-in they are unsure of",
        ],
        source: "authored",
        feedsIndicators: ["S4"],
      },
      {
        id: "b1-why-now",
        minutes: 3,
        ask: "What's changed in the last year that made now the moment to do this?",
        why: "The trigger event tells you what they will actually act on, and what they will let slide.",
        listenFor: [
          "Names a specific incident — a lost account, a health scare, a resignation",
          "Says 'it's been building for a while' with no event",
          "Names a deadline of their own",
        ],
        source: "authored",
        feedsIndicators: [],
      },
      {
        // Master-Intake-Questionnaire.md Q7 🪞, verbatim.
        id: "b1-pull-back",
        minutes: 4,
        ask: "What pulls you back in when you try to step away?",
        why: "The Mirror opening. Owners name their own bottleneck here more honestly than anywhere else in the session.",
        listenFor: [
          "Names specific tasks — quoting, approvals, one customer",
          "Names a person who cannot decide without them",
          "Laughs and says 'everything'",
        ],
        capture: "The exact tasks and names given.",
        source: "guide",
        feedsIndicators: ["S1", "S2"],
      },
      {
        id: "b1-longest-away",
        minutes: 2,
        cutWhenLong: true,
        ask: "What's the longest you've been completely away from the business in the past year?",
        why: "A number rather than a feeling, and it sets up the four-week test in Block 3.",
        listenFor: [
          "Gives a number of days without hesitating",
          "Qualifies it — 'away, but I was on my phone'",
          "Cannot recall a stretch longer than a long weekend",
        ],
        capture: "Days away, when, and whether they were genuinely unreachable.",
        source: "authored",
        feedsIndicators: ["S2"],
      },
      {
        // Facilitator-Guide.md Block 1 🪞, verbatim.
        id: "b1-bottleneck-live",
        minutes: 5,
        ask: "Before we dig in — say it again in your own words: what do you believe is really holding this business back?",
        why: "The sentence the entire results session pivots on. Write it down where they can see you writing it.",
        listenFor: [
          "Names an external cause — the market, competitors, leads",
          "Names themselves",
          "Gives a different answer than they gave in the intake",
        ],
        capture:
          "Their exact words, verbatim. This is compared against the finding at the results session.",
        source: "guide",
        feedsIndicators: [],
      },
    ],
    keyMoments: [
      "What pulls you back in when you try to step away? — guide",
      "Before we dig in — say it again in your own words: what do you believe is really holding this business back? — guide (write it down visibly)",
    ],
    capture: [
      "Their three twelve-month outcomes, with targets",
      "The three-year picture, especially their role in it",
      "The bottleneck sentence, verbatim",
    ],
  },

  // ── BLOCK 2 · The Growth Engine · 60 min ──────────────────────────────────
  b2: {
    purpose:
      "Walk the money path end to end — lead, first hour, follow-up, quote, close, price, delivery, invoice, payment, repeat — and leave with four numbers: leads, conversion, average value, response time.",
    openWith:
      "Now I want to follow the money all the way through, from the moment someone first hears about you to the moment they pay you and come back. We'll go step by step.",
    prompts: [
      {
        id: "b2-lead-sources",
        minutes: 6,
        ask: "Take me through where last month's new leads came from.",
        why: "Opens the money path and tests immediately whether anything is being counted.",
        listenFor: [
          "Names sources with numbers attached, without looking anything up",
          "Says 'mostly word of mouth' and stops",
          "Reaches for a spreadsheet, a CRM or a dashboard",
        ],
        followUp: "How many came from your biggest source last month?",
        capture: "Leads per month by source, and cost per source where known.",
        source: "authored",
        feedsIndicators: ["P1"],
      },
      {
        // snapshot.html Q1, verbatim.
        id: "b2-first-hour",
        minutes: 7,
        ask: "If a new lead comes in at 9am, what usually happens?",
        why: "The single most diagnostic question in the Profit pillar. Response time and single capture both fall out of the answer.",
        listenFor: [
          "Names one system and a time — 'it hits the CRM and someone calls within the hour'",
          "Says 'it depends who sees it', or lists several inboxes",
          "Uses 'usually' or 'we try to' more than once",
        ],
        followUp:
          "If I asked to see every inquiry that came in last week, where would you look?",
        capture: "Typical first-response time, and whether one system holds them all.",
        source: "guide",
        feedsIndicators: ["P2"],
      },
      {
        id: "b2-follow-up",
        minutes: 5,
        ask: "When a lead doesn't buy right away, what happens after that first conversation?",
        why: "Separates follow-up that survives a busy week from follow-up that depends on someone remembering.",
        listenFor: [
          "Describes touch two and touch three, and what sends them",
          "Says 'if I remember' or 'when things slow down'",
          "Credits a person rather than a system",
        ],
        followUp: "Out of ten leads that go quiet, how many hear from you again?",
        capture: "Share of leads receiving two or more touches.",
        source: "authored",
        feedsIndicators: ["P3"],
      },
      {
        // Facilitator-Guide.md Block 2 🪞, verbatim.
        id: "b2-lost-lead",
        minutes: 7,
        ask: "Walk me through the last lead you lost — what happened?",
        why: "A story, not an opinion. It exposes the sales process, the loss reason and whether anyone records either.",
        listenFor: [
          "Names the stage it died at, not just the outcome",
          "Gives a loss reason that sounds like a pattern",
          "Cannot recall a specific one",
        ],
        followUp: "Out of ten quotes you send, how many close?",
        capture: "Close rate as a number, and the most common loss reason.",
        source: "guide",
        feedsIndicators: ["P4"],
      },
      {
        id: "b2-quote-build",
        minutes: 5,
        cutWhenLong: true,
        ask: "Who builds a quote, start to finish?",
        why: "Quoting is where owner dependence and manual load meet in most service businesses. It usually names itself here.",
        listenFor: [
          "Names the owner",
          "Says nobody else can price a job",
          "Describes a template or a pricing tool",
        ],
        followUp: "How long does one take?",
        capture: "Minutes per quote and quotes per week — the automation math runs on this.",
        source: "authored",
        feedsIndicators: ["P4", "L4"],
      },
      {
        // snapshot.html Q2, verbatim; the follow-up is the second clause of
        // the Facilitator-Guide.md Block 2 🪞 key moment.
        id: "b2-price-change",
        minutes: 5,
        ask: "When did you last raise your prices?",
        why: "A date is harder to soften than an opinion, and the answer usually arrives with the reasoning attached.",
        listenFor: [
          "Gives a date or a season without hesitating",
          "Describes a partial change — a surcharge, one product — and calls it an increase",
          "Answers with a competitor rather than with their own numbers",
        ],
        followUp: "And what happened when you did?",
        capture: "Date of the last real price change, and what it was based on.",
        source: "guide",
        feedsIndicators: ["P5"],
      },
      {
        id: "b2-price-authority",
        minutes: 3,
        cutWhenLong: true,
        ask: "When a customer pushes back on price, who decides whether to discount?",
        why: "Tests whether pricing is a rule the team can hold or an exception that walks back to the owner.",
        listenFor: [
          "Names a limit someone else can work within",
          "Says 'they come to me'",
          "Says it depends who is in front of the customer",
        ],
        source: "authored",
        feedsIndicators: ["P5", "S1"],
      },
      {
        id: "b2-offer-ladder",
        minutes: 4,
        ask: "When someone buys your main service, what else do you routinely offer them?",
        why: "Distinguishes a deliberate ladder from add-ons that get mentioned when someone thinks of it.",
        listenFor: [
          "Names a second tier or bundle by name",
          "Says 'we've been meaning to' or 'we've talked about it for years'",
          "Says every customer gets essentially the same thing",
        ],
        followUp: "When did a customer last buy more than one thing from you?",
        source: "authored",
        feedsIndicators: ["P6"],
      },
      {
        id: "b2-invoice-lag",
        minutes: 4,
        ask: "Once a job is finished, how long until the invoice goes out?",
        why: "The end of the money path, and usually the cheapest cash win in the report. It also reveals an approval bottleneck.",
        listenFor: [
          "Gives a number of days",
          "Names an approval step that waits on one person",
          "Says it depends how busy the office is",
        ],
        followUp: "And how long until it's paid?",
        capture: "Days from job complete to invoice sent, and days to payment.",
        source: "authored",
        feedsIndicators: ["P10", "L4", "S5"],
      },
      {
        id: "b2-repeat-customers",
        minutes: 5,
        ask: "Of the customers who bought from you two years ago, how many still buy from you?",
        why: "Retention as a number rather than a feeling, and it surfaces the dormant list nobody has contacted.",
        listenFor: [
          "Gives a percentage and says where it came from",
          "Splits it by customer type",
          "Mentions a list of past customers nobody talks to",
        ],
        followUp: "How would you find out which customers have gone quiet?",
        capture: "Repeat rate, renewal rate, and whether an inactive list exists.",
        source: "authored",
        feedsIndicators: ["P7"],
      },
      {
        id: "b2-margin",
        minutes: 6,
        ask: "Which of your jobs makes the most money — not the biggest, the most profitable?",
        why: "Forces margin knowledge into the open. Owners who only track revenue answer with their largest job.",
        listenFor: [
          "Names a service or customer type and a margin figure",
          "Answers with the biggest revenue line instead",
          "Says margin bounces around by month",
        ],
        followUp: "How do you know that?",
        capture: "Gross margin overall, and whether it is tracked by job or service.",
        source: "authored",
        feedsIndicators: ["P9"],
      },
      {
        id: "b2-growth-owner",
        minutes: 3,
        ask: "Who is accountable for how many leads come in each month?",
        why: "Closes the block on ownership. If the answer is the owner, the growth engine has no operator.",
        listenFor: [
          "Names someone other than the owner, with a number they own",
          "Says 'me, when I have time'",
          "Names marketing and sales separately with no shared number",
        ],
        followUp:
          "When did sales and marketing numbers last get looked at side by side?",
        capture: "Marketing budget per month, and who owns which number.",
        source: "authored",
        feedsIndicators: ["P8"],
      },
    ],
    keyMoments: [
      "Walk me through the last lead you lost — what happened? — guide",
      "When did you last raise prices, and what happened? — guide",
    ],
    capture: [
      "Leads per month, by source",
      "Conversion rate — quotes sent versus quotes won",
      "Average first sale and average annual customer value",
      "First-response time on a new inquiry",
    ],
  },

  // ── BLOCK 3 · Operations & the Machine · 60 min ───────────────────────────
  b3: {
    purpose:
      "Inventory the machine workflow by workflow — owner, documented, followed, what breaks — then test who decides when the owner is gone.",
    openWith:
      "Let's look at how the work actually gets done. I want to list the workflows that matter, and for each one I'm going to ask the same few things.",
    prompts: [
      {
        id: "b3-workflow-list",
        minutes: 6,
        ask: "Which workflows does this business genuinely depend on?",
        why: "The inventory the rest of the block hangs on. Push for the ones that make money, deliver work, collect cash and hold quality.",
        listenFor: [
          "Names eight to ten and can order them by importance",
          "Names three or four and stops",
          "Names a workflow with no obvious owner",
        ],
        capture: "The list, with an owner beside each.",
        source: "authored",
        feedsIndicators: ["S5", "S7"],
      },
      {
        id: "b3-workflow-owner",
        minutes: 3,
        cutWhenLong: true,
        ask: "For the one that touches the most money, who owns it end to end?",
        why: "Ownership of a whole workflow, not a step, is what separates a real manager from a coordinator.",
        listenFor: [
          "Names one person for the whole thing",
          "Names a different person for each stage",
          "Says the handoffs are tribal knowledge",
        ],
        source: "authored",
        feedsIndicators: ["S5", "S4"],
      },
      {
        id: "b3-what-breaks",
        minutes: 5,
        ask: "Where in that chain do things most often go wrong?",
        why: "The guide's 'what breaks?' question. The failure they name first is usually the one that costs the most.",
        listenFor: [
          "Names a specific handoff",
          "Says the owner has to step in",
          "Names rework, missed information or a late invoice",
        ],
        followUp: "Which of those costs you the most?",
        capture: "The named failure, and roughly how often it happens.",
        source: "authored",
        feedsIndicators: ["S5", "S7"],
      },
      {
        // snapshot.html Q6, verbatim.
        id: "b3-documentation",
        minutes: 5,
        ask: "How much of your critical work is written down and actually followed?",
        why: "The two halves matter separately: written down is common, actually followed is rare.",
        listenFor: [
          "Gives a percentage and distinguishes written from followed",
          "Says the documents exist but are out of date",
          "Says it lives in people's heads",
        ],
        followUp:
          "If someone started Monday in your busiest role, what would you hand them on day one?",
        capture:
          "Whether a real document exists and when it was last updated. Ask to see one — that makes it Documented evidence.",
        source: "guide",
        feedsIndicators: ["S5"],
      },
      {
        id: "b3-weekly-numbers",
        minutes: 4,
        ask: "What numbers does your team look at every week?",
        why: "The scoreboard half of the rhythm. A team with no weekly numbers cannot self-correct.",
        listenFor: [
          "Names a short list, each with an owner",
          "Says they look at revenue monthly",
          "Names numbers nobody has a target for",
        ],
        capture: "The KPIs named, and whether each has one owner and a target.",
        source: "authored",
        feedsIndicators: ["S6"],
      },
      {
        id: "b3-weekly-meeting",
        minutes: 3,
        ask: "What does the first meeting of the week look like?",
        why: "The rhythm half. Ask about the meeting rather than 'do you have a rhythm' and you get the truth.",
        listenFor: [
          "Names a day, a length and who is in the room",
          "Describes scheduling logistics rather than performance",
          "Says there isn't a leadership meeting",
        ],
        source: "authored",
        feedsIndicators: ["S6"],
      },
      {
        // Master-Intake-Questionnaire.md Q40, verbatim.
        id: "b3-unresolved",
        minutes: 3,
        ask: "What happens to unresolved issues?",
        why: "The shortest test of accountability in the whole session. 'They come to me' is the answer to listen for.",
        listenFor: [
          "Says they come to the owner",
          "Names a place issues are tracked",
          "Says they resurface later as a bigger problem",
        ],
        source: "guide",
        feedsIndicators: ["S6", "S1"],
      },
      {
        id: "b3-missed-number",
        minutes: 3,
        cutWhenLong: true,
        ask: "When someone misses a number or a deadline, who has that conversation with them?",
        why: "Separates managers who assign work from leaders who hold outcomes.",
        listenFor: [
          "Names a manager rather than the owner",
          "Says 'it comes back to me eventually'",
          "Cannot recall the last time it happened",
        ],
        followUp: "Tell me about the last time that happened.",
        source: "authored",
        feedsIndicators: ["S4"],
      },
      {
        // Facilitator-Guide.md Block 3 🪞, verbatim (first of three).
        id: "b3-who-else-closes",
        minutes: 3,
        ask: "Who besides you can close a sale?",
        why: "Sales independence, asked in five words. The hedge in the answer is the finding.",
        listenFor: [
          "Names people and the deal size each can close alone",
          "Says 'they can start it, I finish it'",
          "Says the big customers only want to talk to them",
        ],
        followUp:
          "When did someone other than you last close a deal without pulling you in?",
        source: "guide",
        feedsIndicators: ["S3"],
      },
      {
        // Facilitator-Guide.md Block 3 🪞, verbatim (second of three).
        id: "b3-who-else-approves",
        minutes: 2,
        ask: "Who besides you can approve an invoice?",
        why: "Approval authority is where owner dependence hides in businesses that believe they have delegated.",
        listenFor: [
          "Names a person and a dollar limit",
          "Says nobody",
          "Says they could but never do",
        ],
        source: "guide",
        feedsIndicators: ["S1"],
      },
      {
        // Facilitator-Guide.md Block 3 🪞, verbatim (third of three).
        id: "b3-who-else-escalation",
        minutes: 3,
        ask: "Who besides you can calm an angry customer?",
        why: "Escalations are the last thing owners hand over, and the answer tells you whether the relationships are institutional.",
        listenFor: [
          "Names someone the customers know by name",
          "Says the customer asks for the owner by name",
          "Names someone, then adds that they check afterwards anyway",
        ],
        source: "guide",
        feedsIndicators: ["S1", "S4"],
      },
      {
        // Master-Intake-Questionnaire.md Q31 🪞, verbatim.
        id: "b3-capacity-20",
        minutes: 4,
        ask: "If sales jumped 20% in the next 90 days, what breaks first?",
        why: "The capacity Mirror. Owners answer this one honestly because it flatters them to have thought about it.",
        listenFor: [
          "Names one specific bottleneck — a person, a step, a machine",
          "Names themselves",
          "Says 'we'd figure it out'",
        ],
        followUp: "What would be the first sign that quality had slipped?",
        capture: "The named bottleneck.",
        source: "guide",
        feedsIndicators: ["S7"],
      },
      {
        // Facilitator-Guide.md Block 3 🪞, verbatim. The guide runs this live.
        id: "b3-four-week",
        minutes: 16,
        ask: "You're unreachable for four weeks starting tomorrow. Walk me through week one, day by day.",
        why: "The most revealing question in the engagement. Let them talk. Week one always sounds fine — the finding arrives later.",
        listenFor: [
          "Week one sounds confident and calm",
          "Names the specific thing that stops, not just 'it'd be tough'",
          "Names something nobody else can reach — a login, a phone, a contact list",
        ],
        followUp: "And week three?",
        capture:
          "What stops, in which week; who decides in their absence; what nobody else can access.",
        source: "guide",
        feedsIndicators: ["S2", "S1", "S3"],
      },
    ],
    keyMoments: [
      "Who besides you can close a sale / approve an invoice / calm an angry customer? — guide",
      "The four-week test, live: You're unreachable for four weeks starting tomorrow. Walk me through week one, day by day. — guide",
    ],
    capture: [
      "The workflow list, with an owner beside each",
      "Percentage of critical work documented, and whether it is followed",
      "KPIs reviewed weekly, and who owns each",
      "The four-week test answer — what stops, who decides, what is locked to the owner",
    ],
  },

  // ── BLOCK 4 · Time, Tools & AI · 45 min ───────────────────────────────────
  b4: {
    purpose:
      "Build the repetitive-work inventory with hours attached, then watch the systems actually get used and note every place data is retyped.",
    openWith:
      "This part is about where the hours go. I want to build a list of the repetitive work — task by task, who does it, how often, how long — and then I'd like to watch a couple of things happen on screen.",
    prompts: [
      {
        // snapshot.html Q8, verbatim.
        id: "b4-repetitive-share",
        minutes: 2,
        cutWhenLong: true,
        ask: "How much of your team's week goes to repetitive manual tasks — data entry, chasing, copying between systems?",
        why: "Frames the block and gets a first estimate before you test it task by task. The estimate is usually low.",
        listenFor: [
          "Gives a share and names an example unprompted",
          "Says 'it's most of the job some days'",
          "Says very little, then contradicts it during the inventory",
        ],
        source: "guide",
        feedsIndicators: ["L4"],
      },
      {
        id: "b4-most-repetitive",
        minutes: 5,
        ask: "What is the most repetitive task anyone here does every week?",
        why: "Starts the inventory at the top. Whatever they name first is usually the strongest automation case in the report.",
        listenFor: [
          "Names the task, the person and roughly how long it takes",
          "Names something the owner does personally",
          "Names several before you finish asking",
        ],
        followUp: "How many hours a week does that one take?",
        capture:
          "Task · who does it · times per week · minutes each · tools used. One row per task, top five.",
        source: "authored",
        feedsIndicators: ["L4"],
      },
      {
        // Facilitator-Guide.md Block 4, verbatim. Ask of each key person.
        id: "b4-hours-go",
        minutes: 6,
        ask: "Where do the hours actually go?",
        why: "Asked of each key person in turn. The guide's phrasing is deliberately open — people volunteer work they would never list on a form.",
        listenFor: [
          "Names work that appears on nobody's job description",
          "Names time spent waiting on someone else",
          "Accounts for well under their actual working week",
        ],
        capture: "Add every task named to the inventory rows.",
        source: "guide",
        feedsIndicators: ["L4"],
      },
      {
        id: "b4-systems-list",
        minutes: 4,
        ask: "What software does the business actually run on day to day?",
        why: "Coverage, not brand names. Walk the core areas mentally: leads, quoting, scheduling, delivery, invoicing, reporting.",
        listenFor: [
          "Names a tool for each area",
          "Names a spreadsheet as the system for something core",
          "Names a tool, then says nobody really uses it",
        ],
        followUp: "Which part of the work has no system behind it at all?",
        capture: "One tool name per core area, or 'none'.",
        source: "authored",
        feedsIndicators: ["L1"],
      },
      {
        // Facilitator-Guide.md Block 4 instructs a systems tour — "watch them
        // create a quote, an invoice, a report" — but supplies no wording.
        id: "b4-systems-tour",
        minutes: 12,
        ask: "Could you build me a quote right now, the way you normally would?",
        why: "The Demonstrated-evidence moment. Watching beats asking: you see the swivel-chair double entry rather than hearing a summary of it.",
        listenFor: [
          "Opens more than one application to finish one task",
          "Retypes something that already exists elsewhere",
          "Apologises for how it works",
        ],
        followUp: "And could you show me an invoice going out?",
        capture:
          "Every place data gets retyped, and the wall-clock time from start to finish. Log this indicator's evidence as Demonstrated.",
        source: "authored",
        feedsIndicators: ["L1", "L2", "L4"],
      },
      {
        id: "b4-double-entry",
        minutes: 4,
        ask: "Where does the same information get typed in more than once?",
        why: "Names the integration gaps in the owner's own words, and usually names the person acting as the glue.",
        listenFor: [
          "Names the exact hop between two systems",
          "Names the person who does the retyping",
          "Says 'not really', then describes it two minutes later",
        ],
        followUp: "Who does that retyping?",
        capture: "Each duplicate-entry hop, and who performs it.",
        source: "authored",
        feedsIndicators: ["L2"],
      },
      {
        id: "b4-data-trust",
        minutes: 3,
        ask: "When two of your systems disagree on a number, which one do you believe?",
        why: "Gets at data trust without asking whether they trust their data, which everyone answers yes to.",
        listenFor: [
          "Names one system as the source of truth without hesitating",
          "Says they do not fully trust either",
          "Describes cleaning a report up before showing anyone",
        ],
        followUp:
          "How long does it take to get a report you'd be comfortable showing a banker?",
        source: "authored",
        feedsIndicators: ["L3"],
      },
      {
        id: "b4-automations",
        minutes: 3,
        ask: "What happens in the business without anyone touching it?",
        why: "Asks for automation without using the word, so you get what is real rather than what was bought.",
        listenFor: [
          "Names specific automations — reminders, invoices, sequences",
          "Pauses, then says 'nothing, really'",
          "Mentions something that used to run and quietly broke",
        ],
        followUp: "When one of those last broke, how did you find out?",
        capture: "Each automation, and whether it is trusted.",
        source: "authored",
        feedsIndicators: ["L5"],
      },
      {
        // snapshot.html Q9, verbatim.
        id: "b4-ai-today",
        minutes: 2,
        ask: "Is AI doing real work in your business today?",
        why: "Record what exists. Do not coach, correct or promote anything here — the brand's position is that we show the math before they spend a dollar.",
        listenFor: [
          "Names people and what each uses it for",
          "Says 'I've played with it'",
          "Names a workflow rather than a person",
        ],
        followUp: "Show me the last thing it was used for.",
        capture: "Tools in use, who uses them, and any result they can point to.",
        source: "guide",
        feedsIndicators: ["L6"],
      },
      {
        id: "b4-ai-review",
        minutes: 2,
        ask: "Before something automated goes out to a customer, who checks it?",
        why: "Discipline, asked concretely. A named checker is the difference between a 2 and a 3 on L7.",
        listenFor: [
          "Names a person and the check they perform",
          "Says 'it just sends'",
          "Says nobody has thought about it",
        ],
        followUp: "How would you know if one of those stopped working?",
        source: "authored",
        feedsIndicators: ["L7"],
      },
      {
        id: "b4-team-rollout",
        minutes: 2,
        ask: "The last time you rolled out a new tool or process, how did the team take it?",
        why: "Judges readiness on a real event rather than on how the owner describes the team's attitude.",
        listenFor: [
          "Names who adopted it and who did not",
          "Says people still do it the old way",
          "Describes the training that happened, or the absence of any",
        ],
        followUp: "Who never ended up using it?",
        source: "authored",
        feedsIndicators: ["L9"],
      },
    ],
    keyMoments: [
      "Where do the hours actually go? — guide (ask of each key person)",
      "Systems tour — watch them create a quote, an invoice, a report. Note every swivel-chair double-entry moment. — guide",
    ],
    capture: [
      "Top five repetitive tasks: task · who · frequency · minutes each · tools",
      "Every duplicate-entry hop observed during the tour",
      "Which automations exist and whether they are trusted",
      "AI tools in use, by whom, with what result",
    ],
  },

  // ── BLOCK 5 · Risk & Close · 30 min ───────────────────────────────────────
  b5: {
    purpose:
      "Sweep the five risk areas the guide names — concentration, key people, contracts, cash pressure, data hygiene — then close the session without giving a verdict.",
    openWith:
      "Last stretch. These are the questions I ask every business, and they're the ones owners are usually glad someone finally asked.",
    prompts: [
      {
        // snapshot.html Q10, verbatim.
        id: "b5-largest-customer",
        minutes: 4,
        ask: "Your largest customer is what share of revenue?",
        why: "Concentration is scored and separately flagged on the overlay, so get the number rather than a characterisation.",
        listenFor: [
          "Gives a percentage immediately",
          "Names the customer before the number",
          "Estimates in dollars and has to divide",
        ],
        followUp: "And the top five together?",
        capture:
          "Largest customer as a percentage, and the top five combined. Above 25% raises the concentration overlay flag.",
        source: "guide",
        feedsIndicators: ["S8"],
      },
      {
        // snapshot.html Q3, verbatim.
        id: "b5-recurring-revenue",
        minutes: 4,
        ask: "How much of your revenue repeats or renews without a new sales push?",
        why: "Predictability. Owners routinely count customers who happen to come back as recurring revenue, so listen for what is actually contracted.",
        listenFor: [
          "Splits contract, repeat and one-off with rough percentages",
          "Says 'we start from zero every month'",
          "Calls repeat business recurring with no agreement behind it",
        ],
        followUp: "On January 1, how much of this year's revenue was already booked?",
        capture: "Percentage contracted versus percentage that simply repeats.",
        source: "guide",
        feedsIndicators: ["S9"],
      },
      {
        id: "b5-key-person",
        minutes: 4,
        ask: "Who is the person this business could not lose right now?",
        why: "Key-person risk, asked so it is easy to answer honestly. The owner naming themselves is a finding, not an admission.",
        listenFor: [
          "Names someone other than the owner",
          "Names themselves",
          "Names what that person knows that nobody else does",
        ],
        followUp: "What do they know or hold that nobody else does?",
        capture: "Each key person, and the specific knowledge or access at risk.",
        source: "authored",
        feedsIndicators: ["S10"],
      },
      {
        id: "b5-contracts",
        minutes: 3,
        cutWhenLong: true,
        ask: "Which customer relationships are on paper, and which are on a handshake?",
        why: "Transferability in one question. 'Probably transferable, we've never checked' is the most common answer and scores a 2.",
        listenFor: [
          "Knows roughly what the agreements say",
          "Says they have never checked whether they transfer",
          "Names one person who holds the relationship",
        ],
        followUp: "If the person who owns that relationship left, what happens to it?",
        source: "authored",
        feedsIndicators: ["S10"],
      },
      {
        // snapshot.html Q7, verbatim.
        id: "b5-financials",
        minutes: 4,
        ask: "How often do you see reliable financials?",
        why: "Cadence and trust in one question. The follow-up converts it into a hard number you can score against.",
        listenFor: [
          "Says monthly and that they use them",
          "Says the reports exist but nobody opens them",
          "Says tax time",
        ],
        followUp: "What's the most recent month you have closed financials for?",
        capture:
          "Days from month-end to numbers ready. If they open the report on screen, log the evidence as Documented.",
        source: "guide",
        feedsIndicators: ["P10"],
      },
      {
        id: "b5-cash",
        minutes: 4,
        ask: "How tight is cash, honestly?",
        why: "Cash distress is an overlay flag and it gates every growth initiative in the plan. Ask it plainly and do not soften it.",
        listenFor: [
          "Names a season or a customer payment cycle",
          "Says profitable but tight",
          "Mentions debt payments or a large expense coming",
        ],
        followUp: "How long do your customers take to pay?",
        capture:
          "Days to payment, seasonality, debt pressure. Raise the cash overlay flag if distress is real.",
        source: "authored",
        feedsIndicators: ["P10"],
      },
      {
        id: "b5-access",
        minutes: 3,
        ask: "When someone leaves the company, what happens to their access?",
        why: "Data hygiene, asked through an event rather than a policy question. Policies get described; events get remembered.",
        listenFor: [
          "Describes a checklist, or the person who handles it",
          "Mentions a shared login several people use",
          "Says accounts sit under someone's personal email",
        ],
        followUp: "When did anyone last restore something from a backup?",
        capture: "Shared logins, backup status, and where sensitive data lives.",
        source: "authored",
        feedsIndicators: ["L8"],
      },
      {
        id: "b5-change-capacity",
        minutes: 3,
        ask: "What's the last improvement you decided to make that never actually happened?",
        why: "Change capacity measured by evidence rather than by appetite. Stated willingness is not capacity.",
        listenFor: [
          "Names it specifically and says how long ago",
          "Names why it stalled — money, time, or nobody to run it",
          "Names themselves as the reason",
        ],
        followUp: "What would it cost — in money or in hours — to make the next one stick?",
        capture: "Implementation budget, owner hours per week, team hours per week.",
        source: "authored",
        feedsIndicators: ["L10"],
      },
      {
        id: "b5-legal",
        minutes: 1,
        ask: "Is there anything legal, tax, insurance or compliance-related I should know about?",
        why: "A referral question, not a diagnostic one. The guide's hard rule: anything legal, tax, HR or security goes to a professional.",
        listenFor: [
          "Names an open matter or an unfiled return",
          "Mentions a lapsed licence or insurance",
          "Says no, quickly, then adds something",
        ],
        capture: "Anything named. Raise the legal-exposure overlay flag and refer out.",
        source: "authored",
        feedsIndicators: [],
      },
    ],
    keyMoments: [
      "Name two or three patterns you noticed today — openly, as questions, not verdicts. Give no verdict on the day. — guide",
    ],
    capture: [
      "Largest customer and top five as percentages of revenue",
      "Key people and what is locked to each",
      "Financial cadence, cash pressure, days to payment",
      "Implementation budget and available hours",
      "Every overlay flag triggered today",
    ],
    // Facilitator-Guide.md Block 5 close, verbatim.
    closeWith:
      "Here's what happens next. I've heard several patterns today — [name 2–3 openly, as questions, not verdicts]. I'll now score all thirty factors, run the numbers on every opportunity we've touched, and pressure-test what the real constraint is. We meet [date] for 90 minutes. I'll show you the whole picture — and the plan. Between now and then, you don't need to do anything.",
  },
};

/**
 * The triage list, in the order a facilitator would drop them.
 *
 * A four-hour session with a talkative owner runs long in Block 2 or Block 3
 * every time, and the rigor review found facilitators improvising the cut. That
 * improvisation is where coverage gets lost: drop the wrong question and an
 * indicator arrives at scoring with no evidence behind it, which is a 0 with no
 * reason rather than a low score with one.
 *
 * So the cut is decided here, not in the room. Every id below is a prompt whose
 * `feedsIndicators` are each fed by at least one prompt that is NOT on this
 * list — verified for the list as a whole, not one at a time, by
 * `validateSessionScripts()` in lib/assessment-session.ts. Drop all eight and
 * every one of the thirty indicators still has a source.
 *
 * Nothing the Facilitator Guide marks as a 🪞 key moment appears here. Those are
 * the questions the engagement is built on; if the clock has eaten them, the
 * block was mismanaged and the fix is not a shorter Mirror.
 *
 * Typed as an eight-tuple so the list cannot quietly grow or shrink.
 */
export const TRIAGE_PROMPT_IDS: readonly [
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
] = [
  // Fed elsewhere: S1 by four remaining prompts, L4 by three.
  "b1-role-today",
  // S2 also comes from b1-pull-back and the four-week test.
  "b1-longest-away",
  // P5 survives in b2-price-change; S1 is fed all through Block 3.
  "b2-price-authority",
  // P4 survives in b2-lost-lead; L4 in the Block 4 inventory.
  "b2-quote-build",
  // S5 has four other sources, S4 two.
  "b3-workflow-owner",
  // S4 survives in b1-stakeholders and b3-who-else-escalation.
  "b3-missed-number",
  // The warm-up estimate for L4 — the task inventory that follows supersedes it.
  "b4-repetitive-share",
  // S10 survives in b5-key-person.
  "b5-contracts",
] as const;

const TRIAGE_ID_SET = new Set<string>(TRIAGE_PROMPT_IDS);

/** Is this prompt on the triage list? */
export function isTriagePrompt(id: string): boolean {
  return TRIAGE_ID_SET.has(id);
}

export interface FacilitationScript {
  /**
   * The question, read aloud. Also the question to ask if this indicator never
   * came up — the workbench's indicator card renders it beside the anchors.
   */
  ask: string;
  /** 2–4 short bullets: what to listen for, phrased as observable signals. */
  listenFor: string[];
  /** One probe when the answer is vague or evasive. */
  followUp?: string;
  /** How to turn what you heard into a 0–4 score, fast. */
  scoreHint: string;
  /**
   * The short request to send after the session when the notes are silent on
   * this indicator. Written to ask for a number or an artifact, so answering it
   * also upgrades the evidence confidence.
   */
  askIfMissing: string;
  /** Whether the eliciting question is the guide's or authored here. */
  source: FacilitationSource;
}

/**
 * Keyed by IndicatorKey rather than string: a mistyped or stale indicator key
 * here used to render an empty card in the middle of a scoring session. Now it
 * fails the typecheck, and a new indicator cannot ship without its script.
 */
export const FACILITATION: Record<IndicatorKey, FacilitationScript> = {
  // ── PROFIT ────────────────────────────────────────────────────────────────
  P1: {
    ask: "Take me through where last month's new leads came from.",
    listenFor: [
      "Names sources in order with numbers attached — '30 referrals, 25 from Google' — without looking anything up",
      "Says 'mostly word of mouth' and stops there",
      "Reaches for a spreadsheet, a CRM or a dashboard to answer",
      "Can name sources but not volumes, or volumes but not what they cost",
    ],
    followUp: "How many came from your biggest source last month?",
    scoreHint:
      "0 if they cannot name sources or volumes at all. 2 if sources are known and volume is roughly tracked — 'a few dozen a month, mostly referrals.' The 2-to-3 line is a real record: at 3 the numbers come from something you could look at, not from memory. 4 needs all four — source, volume, cost and quality — reviewed monthly. Cost per lead is usually the missing one; without it, cap at 3.",
    askIfMissing:
      "Could you send me last month's lead count broken out by source, with the cost of any paid sources?",
    source: "authored",
  },
  P2: {
    ask: "If a new lead comes in at 9am, what usually happens?",
    listenFor: [
      "Names one system by name and a response time — 'it hits the CRM and someone calls within the hour'",
      "Says 'it depends who sees it', or lists several inboxes — voicemail, email, the Facebook page",
      "Uses 'usually' or 'we try to' more than once",
      "Admits some inquiries slip",
    ],
    followUp:
      "If I asked to see every inquiry that came in last week, where would you look?",
    scoreHint:
      "Two facts decide this: whether there is one place every inquiry lands, and how fast the first response is. 0 if inquiries sit or get lost across several inboxes. 2 if most get answered the same day but capture is scattered. The 2-to-3 line is single capture: at 3 everything lands in one system even if response time is uneven; at 2 a person is patching the holes. 4 needs one system, under an hour, and something automated doing the catching.",
    askIfMissing:
      "Where does a new inquiry land, and what's your typical time to first response?",
    source: "guide",
  },
  P3: {
    ask: "When a lead doesn't buy right away, what happens after that first conversation?",
    listenFor: [
      "Describes touch two and touch three specifically, and what sends them",
      "Says 'if I remember' or 'when things slow down'",
      "Credits a person rather than a system for follow-up happening",
      "Volunteers a share of leads that get a second touch",
    ],
    followUp: "Out of ten leads that go quiet, how many hear from you again?",
    scoreHint:
      "0 if the honest answer is one touch and then nothing. 2 if follow-up happens but depends on who is holding it that week. The 2-to-3 line is whether follow-up survives a busy week: at 3 a sequence or a task fires on its own even if it does not cover every lead; at 2 it stops when people get busy. 4 is 2+ systematic touches on every lead with nobody having to remember.",
    askIfMissing:
      "Roughly what share of your leads get a second follow-up, and is anything sending it automatically?",
    source: "authored",
  },
  P4: {
    ask: "Walk me through the last lead you lost — what happened?",
    listenFor: [
      "Names the stage it died at, not just the outcome",
      "Gives a loss reason that sounds like a pattern — 'they always go with whoever quotes first'",
      "Cannot recall a specific one, or says 'I'd have to think about it'",
      "Can state a close rate as a number when asked",
    ],
    followUp: "Out of ten quotes you send, how many close?",
    scoreHint:
      "0 if there is no defined process and the close rate is unknown. 2 if the process is loose but the rate is roughly known — 'about a third.' The 2-to-3 line is whether losses are recorded anywhere: at 3 there are named stages and someone could tell you why the last five were lost; at 2 the reasons live only in the owner's head. 4 needs defined stages, a tracked close rate, and loss reasons logged where they can be counted.",
    askIfMissing:
      "Of the last ten quotes you sent, how many closed — and do you know why the others didn't?",
    source: "guide",
  },
  P5: {
    ask: "When did you last raise your prices?",
    listenFor: [
      "Gives a date or a season without hesitating",
      "Describes a partial change — a fuel surcharge, one product — and calls it a price increase",
      "Answers with a competitor: 'we're in line with what everyone else charges'",
      "Volunteers what the increase was based on",
    ],
    followUp:
      "When a customer pushes back on price, who decides whether to discount?",
    scoreHint:
      "0 if pricing is gut or competitor-based and unchanged for two or more years. 2 if there is some job economics behind the numbers and prices get looked at occasionally. The 2-to-3 line is a rule someone else can follow: at 3 there are discount limits and the team can hold a price without escalating; at 2 every exception comes back to the owner. 4 adds an annual review and value-based rather than cost-plus logic.",
    askIfMissing:
      "What month was your last real price change, and what was the increase based on?",
    source: "guide",
  },
  P6: {
    ask: "When someone buys your main service, what else do you routinely offer them?",
    listenFor: [
      "Names a second product or tier, not 'we'd do it if they asked'",
      "Says 'we've been meaning to' or 'we've talked about it for years'",
      "Mentions an entry-level option and a premium option unprompted",
      "Says every customer gets essentially the same thing",
    ],
    followUp: "When did a customer last buy more than one thing from you?",
    scoreHint:
      "0 if there is one offer and no upsell. 2 if add-ons exist but get offered when someone thinks of it. The 2-to-3 line is deliberateness: at 3 at least one packaged tier or bundle is offered the same way every time; at 2 it depends who is in front of the customer. 4 needs a real ladder — entry, core, premium — with upsells built into the standard sale.",
    askIfMissing:
      "Could you list everything a customer can buy from you, and what share of customers buy more than one of them?",
    source: "authored",
  },
  P7: {
    ask: "Of the customers who bought from you two years ago, how many still buy from you?",
    listenFor: [
      "Gives a percentage and says where the number came from",
      "Splits it by customer type — 'commercial renews, residential doesn't'",
      "Says the number would be hard to get out of their system",
      "Mentions a list of past customers nobody has contacted",
    ],
    followUp: "How would you find out which customers have gone quiet?",
    scoreHint:
      "0 if customers leave without anyone noticing. 2 if the repeat rate is roughly known but nothing is done with it. The 2-to-3 line is action: at 3 someone actually works retention — a renewal call, a check-in, a win-back — even if it is not on a schedule; at 2 the number is known and nothing happens. 4 needs retention measured and inactive customers reactivated on a cadence.",
    askIfMissing:
      "What share of your customers buy again, and has anyone ever contacted the ones who've gone quiet?",
    source: "authored",
  },
  P8: {
    ask: "Who is accountable for how many leads come in each month?",
    listenFor: [
      "Names someone other than the owner, with a number that person owns",
      "Says 'me, when I have time'",
      "Names one person for marketing and another for sales with no shared number",
      "States a marketing budget without checking",
    ],
    followUp:
      "When did sales and marketing numbers last get looked at side by side?",
    scoreHint:
      "0 if nobody owns marketing or sales and no numbers are reviewed. 2 if owners are named but numbers get looked at sometimes. The 2-to-3 line is a standing review: at 3 there is a recurring slot where those numbers get read and someone answers for them; at 2 it happens when something feels wrong. 4 requires leads, conversion, acquisition cost and customer value reviewed together rather than one at a time.",
    askIfMissing:
      "Who owns the lead number and the close rate, and where do those two get reviewed together?",
    source: "authored",
  },
  P9: {
    ask: "Which of your jobs makes the most money — not the biggest, the most profitable?",
    listenFor: [
      "Names a specific service or customer type and a margin figure",
      "Answers with the largest revenue line instead of the most profitable one",
      "Says margin 'bounces around' month to month",
      "Says the answer would come from a report rather than a feel",
    ],
    followUp: "How do you know that?",
    scoreHint:
      "0 if gross margin is unknown. 2 if there is an overall margin number but nothing job-level or service-level. The 2-to-3 line is granularity: at 3 they can rank services or job types by profitability, even roughly; at 2 it is one blended company number. 4 means margin is tracked by job, service or customer and changes decisions — they can name work they stopped taking because of it.",
    askIfMissing:
      "What's your gross margin, and can you break it out by service or job type?",
    source: "authored",
  },
  P10: {
    ask: "How often do you see reliable financials?",
    listenFor: [
      "Names a month and it lands within about two weeks of today",
      "Says 'my accountant handles it' without naming a month",
      "Names a month two or more months behind",
      "Says the reports exist but nobody opens them",
    ],
    followUp: "What's the most recent month you have closed financials for?",
    scoreHint:
      "Count the days from month-end to when the numbers were ready — that one number does most of the work. 0 is tax-time-only. 2 is roughly monthly but late and lightly used. The 2-to-3 line is use: at 3 financials arrive monthly and someone actually reads them; at 2 they arrive and sit. 4 needs a close within 15 days, a real review, and targets to compare against. If they open the report on screen, log the evidence as Documented.",
    askIfMissing:
      "What's the most recent month you have a closed P&L for, and could you send it over?",
    source: "guide",
  },

  // ── SYSTEMS ───────────────────────────────────────────────────────────────
  S1: {
    ask: "Who besides you can approve an invoice?",
    listenFor: [
      "Names a person and a dollar limit they can work within",
      "Says nobody, or says they could but never do",
      "Names small-dollar approvals that still route to the owner — purchases, discounts, schedule changes",
      "Calls something routine 'just my job'",
    ],
    followUp: "What decisions came to you yesterday that you wish hadn't?",
    scoreHint:
      "0 if nearly everything routes through them. 2 if several areas are genuinely delegated but money, hiring and exceptions are still owner-only. The 2-to-3 line is whether the limits are written or merely felt: at 3 people know their spending and decision limits without asking; at 2 they ask because they are not sure. 4 means the owner is left with strategy and the routine decisions have owners and thresholds.",
    askIfMissing:
      "Which decisions can be made without you, and up to what dollar amount?",
    source: "guide",
  },
  S2: {
    ask: "You're unreachable for four weeks starting tomorrow. Walk me through week one, day by day.",
    listenFor: [
      "Week one sounds fine and confident — nearly everyone's does",
      "Names the specific thing that stops, not just 'it'd be tough'",
      "Names something nobody else can reach — a bank login, a phone, a contact list",
      "Names who would decide, or admits nobody would",
    ],
    followUp: "And week three?",
    scoreHint:
      "Week one is not the test — week three is. 0 if things stop or bleed within days. 2 if it runs short-term but slows while decisions stack up. The 2-to-3 line is whether anyone decides in their absence: at 3 someone has real authority and the business keeps moving with friction; at 2 the work continues but nothing new gets decided. 4 requires four full weeks, a named decision-maker, and nothing critical locked behind the owner's access.",
    askIfMissing:
      "If you were unreachable for a month, what stops first — and who has authority to decide while you're gone?",
    source: "guide",
  },
  S3: {
    ask: "Who besides you can close a sale?",
    listenFor: [
      "Names people and the deal size each can close alone",
      "Says 'they can start it, I finish it'",
      "Says the big customers only want to talk to them",
      "Volunteers a share of revenue tied to their personal relationships",
    ],
    followUp:
      "When did someone other than you last close a deal without pulling you in?",
    scoreHint:
      "0 if the owner closes everything and the relationships are personally theirs. 2 if the team sells but the owner gets pulled in on anything large. The 2-to-3 line is the size of deal the team carries alone: at 3 they close ordinary deals unaided and the owner appears only on the biggest; at 2 the rescue is routine. 4 means the team sells without the owner and the relationships belong to the company.",
    askIfMissing:
      "What share of last year's sales closed without you in the room?",
    source: "guide",
  },
  S4: {
    ask: "When someone misses a number or a deadline, who has that conversation with them?",
    listenFor: [
      "Names a manager rather than the owner",
      "Says 'it comes back to me eventually'",
      "Describes managers who assign work but do not hold outcomes",
      "Cannot recall the last time such a conversation happened",
    ],
    followUp: "Tell me about the last time that happened.",
    scoreHint:
      "0 if there are no managers, or managers in title only. 2 if some managers are real but accountability is patchy and depends which manager. The 2-to-3 line is whether the conversation happens without the owner starting it: at 3 leaders spot and handle misses themselves; at 2 the owner has to notice first. 4 means leaders own outcomes and a miss triggers action on its own.",
    askIfMissing:
      "Who on your team holds other people to an outcome, and what happens when someone misses one?",
    source: "authored",
  },
  S5: {
    ask: "How much of your critical work is written down and actually followed?",
    listenFor: [
      "Distinguishes what is written from what is followed",
      "Says 'they'd shadow someone for a few weeks'",
      "Says documentation exists but is out of date",
      "Offers to show it to you",
    ],
    followUp:
      "If someone started Monday in your busiest role, what would you hand them on day one?",
    scoreHint:
      "0 if it lives in people's heads and training is shadowing. 2 if some things are written down but loosely followed or stale. The 2-to-3 line is currency and use: at 3 the documents are current enough that people genuinely train from them; at 2 they exist and everyone works from memory anyway. 4 means documented, current, trained-from and actually followed — you should be able to see one and have it match what they just described. Seeing it makes this Documented evidence.",
    askIfMissing:
      "Could you send me one of your written procedures — whichever is most used?",
    source: "guide",
  },
  S6: {
    ask: "What numbers does your team look at every week?",
    listenFor: [
      "Names a short list, each with an owner beside it",
      "Says they look at revenue monthly",
      "Says issues raised in the meeting 'come to me afterwards'",
      "Mentions targets that are visible to everyone",
    ],
    followUp: "What happens to unresolved issues?",
    scoreHint:
      "0 if there is no regular meeting and no KPIs. 2 if meetings happen but there are few numbers and follow-through is loose. The 2-to-3 line is whether the meeting has a scoreboard: at 3 the same handful of numbers appear every week with an owner beside each; at 2 the meeting is about what is happening, not what the numbers say. 4 adds visible targets and a miss that triggers action inside the meeting.",
    askIfMissing:
      "Could you send me the agenda or the scorecard from your last leadership meeting?",
    source: "authored",
  },
  S7: {
    ask: "If sales jumped 20% in the next 90 days, what breaks first?",
    listenFor: [
      "Names one specific bottleneck — a person, a machine, a step",
      "Says 'we'd figure it out' or 'we'd just hire'",
      "Names themselves as the thing that breaks",
      "References a capacity number — crews, seats, machine hours",
    ],
    followUp: "What would be the first sign that quality had slipped?",
    scoreHint:
      "0 if quality already varies and 20% would break it. 2 if delivery is mostly consistent but growth would take heroics — long nights, the owner covering. The 2-to-3 line is whether absorbing growth needs a hero: at 3 they could take it with planned overtime or a known hire and quality holds; at 2 it only holds because someone burns out. 4 needs consistent quality, a capacity plan they can describe, and 20% absorbed without drama.",
    askIfMissing:
      "How much more volume could you deliver next quarter without hiring, and what would give first?",
    source: "guide",
  },
  S8: {
    ask: "Your largest customer is what share of revenue?",
    listenFor: [
      "Gives a percentage immediately",
      "Estimates in dollars and has to do the division",
      "Names the customer before the number",
      "Says they would have to check",
    ],
    followUp: "And the top five together?",
    scoreHint:
      "This one is arithmetic, so get both numbers before scoring. 0 if any single customer is above 30%. 4 if no customer is above 10–15% and the base is broad. In between, use the top five: 2 if they total 40–60%. The 2-to-3 line is the single-customer figure — at 3 the largest is comfortably under 20% even if the top five still cluster; at 2 the largest sits in the 20s. Anything above 25% also raises the concentration overlay flag, whatever this score ends up being.",
    askIfMissing:
      "What percentage of last year's revenue came from your largest customer, and from your top five?",
    source: "guide",
  },
  S9: {
    ask: "How much of your revenue repeats or renews without a new sales push?",
    listenFor: [
      "Splits revenue into contract, repeat and one-off with rough percentages",
      "Says 'we start from zero every month'",
      "Calls repeat business recurring when there is no agreement behind it",
      "Can say what is already committed for this year",
    ],
    followUp: "On January 1, how much of this year's revenue was already booked?",
    scoreHint:
      "Separate contracted revenue from customers who simply come back — owners blend the two routinely, and it is the most common overscore in this pillar. 0 if it is all one-shot work restarting every month. 2 if there is some repeat or contract revenue but the year still starts near zero. The 2-to-3 line is forecastability: at 3 a meaningful share is contracted and they can say what next quarter looks like; at 2 they can only say it usually works out. 4 means the recurring base is large enough that the forecast holds.",
    askIfMissing:
      "What share of revenue is under contract or on a renewal, as opposed to customers who happen to come back?",
    source: "guide",
  },
  S10: {
    ask: "Which customer relationships are on paper, and which are on a handshake?",
    listenFor: [
      "Knows roughly what the written agreements say",
      "Says 'probably transferable, we've never checked'",
      "Names one person who holds the relationship",
      "Cites renewal dates or terms without looking them up",
    ],
    followUp: "If the person who owns that relationship left, what happens to it?",
    scoreHint:
      "0 if the important relationships are handshakes and the knowledge sits in one head with no plan. 2 if some agreements are written and the key-person gaps are known but untouched. The 2-to-3 line is whether anything has been done about the gap: at 3 there are written agreements plus at least one deliberate step — a second contact, a shared account, a documented handover; at 2 the risk is named and nothing has changed. 4 needs written transferable contracts, cross-training and a continuity plan someone could actually execute.",
    askIfMissing:
      "Are your major customer agreements in writing, and would they transfer if the business changed hands?",
    source: "authored",
  },

  // ── LEVERAGE ──────────────────────────────────────────────────────────────
  L1: {
    ask: "What software does the business actually run on day to day?",
    listenFor: [
      "Names tools by name across sales, delivery and money",
      "Names a spreadsheet as the system for something core",
      "Says 'email' or 'my phone' for a core function",
      "Names a tool, then admits nobody really uses it",
    ],
    followUp: "Which part of the work has no system behind it at all?",
    scoreHint:
      "Walk the list mentally: leads, quoting, scheduling, delivery, invoicing, reporting. 0 if it is spreadsheets and memory. 2 if the key tools exist with real gaps — a CRM but no reporting, scheduling but no quoting. The 2-to-3 line is how many core areas are uncovered: at 3 one area is missing or weak; at 2 two or more are. 4 means every core area has a real system that people use, not one that was bought and abandoned.",
    askIfMissing:
      "Could you list the software you use for leads, quoting, scheduling, delivery, invoicing and reporting?",
    source: "authored",
  },
  L2: {
    ask: "Where does the same information get typed in more than once?",
    listenFor: [
      "Names the exact hop — 'the quote sheet into the field app into QuickBooks'",
      "Names the person who does the retyping",
      "Says 'not really', then describes it two minutes later",
      "Knows which duplicate entry causes the most errors",
    ],
    followUp: "Who does that retyping?",
    scoreHint:
      "0 if the same data goes into multiple places and a person is the glue holding the systems together. 2 if some integrations exist alongside some double entry. The 2-to-3 line is whether any core hop still needs a human: at 3 the main systems pass data on their own and double entry is confined to something minor; at 2 someone still retypes something that matters every week. 4 means core systems share data cleanly and nobody's job depends on copying.",
    askIfMissing:
      "Which of your systems talk to each other automatically, and where does someone have to retype between them?",
    source: "authored",
  },
  L3: {
    ask: "When two of your systems disagree on a number, which one do you believe?",
    listenFor: [
      "Names one system as the source of truth without hesitating",
      "Says 'honestly, I don't fully trust either'",
      "Describes cleaning a report up before showing it to anyone",
      "Says different people define the same metric differently",
    ],
    followUp:
      "How long does it take to get a report you'd be comfortable showing a banker?",
    scoreHint:
      "0 if numbers conflict and reports are hand-built every time. 2 if the data is mostly right after someone cleans it up. The 2-to-3 line is agreed definitions: at 3 everyone means the same thing by 'a lead' or 'a closed job' and reports come out with light touch-up; at 2 the definitions drift and cleanup is standard procedure. 4 means agreed definitions and reports available on demand with no manual assembly.",
    askIfMissing:
      "Could you send me whatever report you'd use to check how the business did last month?",
    source: "authored",
  },
  L4: {
    ask: "How much of your team's week goes to repetitive manual tasks — data entry, chasing, copying between systems?",
    listenFor: [
      "Names the task, the person and roughly how long it takes",
      "Names something the owner does personally",
      "Says 'that's just how it is'",
      "Names several before you have finished asking",
    ],
    followUp: "How many hours a week does that one take?",
    scoreHint:
      "This indicator reads like every other one: more manual work eliminated scores HIGHER. 0 if repetitive manual work is everywhere and nothing has been fixed. 2 if the load is real but a few things have been cleaned up. The 2-to-3 line is whether the worst offender has been addressed: at 3 the big ones are handled and what remains is minor; at 2 the biggest task is still fully manual. 4 means little manual repetition and work that moves without someone pushing it. Always get the hours-per-week number — the report's capacity math runs on it.",
    askIfMissing:
      "Could you list your five most repetitive weekly tasks, with who does each and how long it takes?",
    source: "guide",
  },
  L5: {
    ask: "What happens in the business without anyone touching it?",
    listenFor: [
      "Names specific automations — reminders, invoices, sequences",
      "Pauses, then says 'nothing, really'",
      "Names one automation and stops",
      "Mentions something that used to run and quietly broke",
    ],
    followUp: "When one of those last broke, how did you find out?",
    scoreHint:
      "0 if nothing runs on its own. 2 if a few automations exist and reliability is mixed — some work, some stopped without anyone noticing. The 2-to-3 line is reliability and reach: at 3 what exists is trusted and covers more than one function; at 2 it covers one narrow thing or people work around it. 4 means reliable automations across several functions with someone maintaining them. 'A customer told us it had stopped' is the tell for a 2.",
    askIfMissing:
      "Which parts of your process run automatically today, and have any of them failed recently?",
    source: "authored",
  },
  L6: {
    ask: "Is AI doing real work in your business today?",
    listenFor: [
      "Names people and what each uses it for",
      "Says 'I've played with it'",
      "Names a workflow rather than a person",
      "Can point to a result — time saved, work produced",
    ],
    followUp: "Show me the last thing it was used for.",
    scoreHint:
      "0 if nobody uses it. 2 if individuals use it on their own initiative with no shared purpose. The 2-to-3 line is whether it is attached to a defined workflow: at 3 at least one process has AI in it by design rather than by one person's habit; at 2 it is whoever happens to like the tool. 4 means deliberate use inside defined workflows with a result they can name. Record what exists — do not coach, correct or promote anything here.",
    askIfMissing:
      "Which AI tools are in use, who uses them, and for what part of the work?",
    source: "guide",
  },
  L7: {
    ask: "Before something automated goes out to a customer, who checks it?",
    listenFor: [
      "Names a person and the specific check they perform",
      "Says 'it just sends'",
      "Describes a rule about what AI is not allowed to touch",
      "Says nobody has thought about it",
    ],
    followUp: "How would you know if one of those stopped working?",
    scoreHint:
      "0 if there are no rules, no review and no measurement. 2 if some practices exist but vary by person or tool. The 2-to-3 line is a named owner: at 3 each automation or AI use has someone responsible and a review step, even if results are never measured; at 2 the practices are informal. 4 requires use cases picked by business impact, owners, human-review rules and measured results. If nothing is automated and no AI is in use, score this low alongside L5 and L6 rather than marking N/A — an honest zero is a finding, not a hole in the interview.",
    askIfMissing:
      "For anything automated or AI-assisted, who owns it and what gets reviewed before it reaches a customer?",
    source: "authored",
  },
  L8: {
    ask: "When someone leaves the company, what happens to their access?",
    listenFor: [
      "Describes a checklist, or the person who handles it",
      "Says 'we'd change the password'",
      "Mentions a shared login several people use",
      "Says accounts sit under someone's personal email",
    ],
    followUp: "When did anyone last restore something from a backup?",
    scoreHint:
      "0 if there are shared passwords, no backups and no clear picture of who has access to what. 2 if hygiene is partial and the gaps are known. The 2-to-3 line is backups: at 3 access is controlled and backups exist even if nobody has tested a restore; at 2 either access or backups is still wide open. 4 needs controlled access, a backup someone has actually restored from, and a clear map of where sensitive data lives. 'We've never tested it' caps this at 3.",
    askIfMissing:
      "Are any logins shared, and when was a backup last restored to check that it works?",
    source: "authored",
  },
  L9: {
    ask: "The last time you rolled out a new tool or process, how did the team take it?",
    listenFor: [
      "Names who adopted it and who did not",
      "Says 'we still have people doing it the old way'",
      "Describes the training that happened, or the absence of any",
      "Names someone on the team who pushes for improvements",
    ],
    followUp: "Who never ended up using it?",
    scoreHint:
      "Judge the last real rollout, not how they describe the team's attitude. 0 if the team is resistant or has had no training. 2 if capability is uneven — some people are strong, others were never brought along. The 2-to-3 line is whether adoption survives without pressure: at 3 most of the team picked it up and kept using it after the attention moved on; at 2 usage decayed once nobody was watching. 4 means a trained team that adopts new things and suggests improvements of their own.",
    askIfMissing:
      "What's the most recent tool or process you introduced, and is the team still using it?",
    source: "authored",
  },
  L10: {
    ask: "What's the last improvement you decided to make that never actually happened?",
    listenFor: [
      "Names it specifically and says how long ago",
      "Names why it stalled — money, time, or nobody to run it",
      "Says 'nothing, we finish what we start'",
      "Names themselves as the reason it stalled",
    ],
    followUp: "What would it cost — in money or in hours — to make the next one stick?",
    scoreHint:
      "Score what has actually happened, not stated enthusiasm; appetite on its own is not capacity. 0 if there is no budget, no time and no appetite. 2 if it is limited but real — some money, a few hours a week, genuine willingness. The 2-to-3 line is whether anyone other than the owner has hours to give: at 3 there is a budget figure, owner hours and a person who could run the work; at 2 it all rests on the owner's spare time. 4 means budget, time and appetite are all committed and a recent change proves it. Cross-check against the budget and hours given in the intake.",
    askIfMissing:
      "What implementation budget could you commit over the next 90 days, and how many hours a week from you and from the team?",
    source: "authored",
  },
};
