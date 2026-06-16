# Form-to-Workflow Wiring Checklist

_Generated: 2026-05-04T04:31:21.876Z_

**Why a checklist instead of automation:** GHL exposes no PUT/PATCH endpoint for forms via the PIT. Form submission triggers (tags, opportunity creation, workflow firing) must be configured in the UI.

**State of the world:**
- Forms built: 0/6
- Workflows built: 0/8
- Pipelines built: 0/4

**Open dependencies (build first):**

- Form not yet built: Game Night Service Booking
- Workflow not yet built: Game Night Service Booking
- Pipeline not yet built: Game Night Service
- Form not yet built: Sponsorship Inquiry
- Workflow not yet built: Sponsor Pipeline (B2B)
- Pipeline not yet built: Sponsorship/B2B
- Form not yet built: Event Registration
- Workflow not yet built: Event Registration & Follow-Up
- Pipeline not yet built: Event Attendees
- Form not yet built: Wholesale Inquiry
- Workflow not yet built: Wholesale Response
- Form not yet built: Affiliate Creator Application
- Workflow not yet built: Affiliate Application Review
- Form not yet built: 3D Print Custom Order
- Workflow not yet built: 3D Print Quote Flow

---


## Game Night Service Booking

**Form ID:** 🟡 not yet built
**Triggers workflow:** Game Night Service Booking 🟡 not yet built
**Pipeline target:** Game Night Service → Inquiry 🟡 not yet built

**Tags on submit:** `source-game-night-booking`, `service-booker`
**Internal notification:** adultgamenights@gmail.com

### UI steps
1. Open **Sites → Forms** → click **Game Night Service Booking**
2. Click **Settings** (gear icon) or **Integrations**
3. **On Submission → Add Tag**: `source-game-night-booking`, `service-booker`
4. **On Submission → Create Opportunity**: pipeline `Game Night Service`, stage `Inquiry`
5. **On Submission → Send Internal Email**: `adultgamenights@gmail.com`
6. **On Submission → Trigger Workflow**: `Game Night Service Booking`
7. Save

## Sponsorship Inquiry

**Form ID:** 🟡 not yet built
**Triggers workflow:** Sponsor Pipeline (B2B) 🟡 not yet built
**Pipeline target:** Sponsorship/B2B → Lead 🟡 not yet built

**Tags on submit:** `source-sponsor-inquiry`, `sponsor-lead`
**Internal notification:** adultgamenights@gmail.com

### UI steps
1. Open **Sites → Forms** → click **Sponsorship Inquiry**
2. Click **Settings** (gear icon) or **Integrations**
3. **On Submission → Add Tag**: `source-sponsor-inquiry`, `sponsor-lead`
4. **On Submission → Create Opportunity**: pipeline `Sponsorship/B2B`, stage `Lead`
5. **On Submission → Send Internal Email**: `adultgamenights@gmail.com`
6. **On Submission → Trigger Workflow**: `Sponsor Pipeline (B2B)`
7. Save

## Event Registration

**Form ID:** 🟡 not yet built
**Triggers workflow:** Event Registration & Follow-Up 🟡 not yet built
**Pipeline target:** Event Attendees → Registered 🟡 not yet built

**Tags on submit:** `source-event`
**Internal notification:** adultgamenights@gmail.com

### UI steps
1. Open **Sites → Forms** → click **Event Registration**
2. Click **Settings** (gear icon) or **Integrations**
3. **On Submission → Add Tag**: `source-event`
4. **On Submission → Create Opportunity**: pipeline `Event Attendees`, stage `Registered`
5. **On Submission → Send Internal Email**: `adultgamenights@gmail.com`
6. **On Submission → Trigger Workflow**: `Event Registration & Follow-Up`
7. Save

## Wholesale Inquiry

**Form ID:** 🟡 not yet built
**Triggers workflow:** Wholesale Response 🟡 not yet built

**Tags on submit:** `wholesale-inquiry`
**Internal notification:** adultgamenights@gmail.com

### UI steps
1. Open **Sites → Forms** → click **Wholesale Inquiry**
2. Click **Settings** (gear icon) or **Integrations**
3. **On Submission → Add Tag**: `wholesale-inquiry`
4. **On Submission → Send Internal Email**: `adultgamenights@gmail.com`
5. **On Submission → Trigger Workflow**: `Wholesale Response`
6. Save

## Affiliate Creator Application

**Form ID:** 🟡 not yet built
**Triggers workflow:** Affiliate Application Review 🟡 not yet built

**Tags on submit:** `affiliate-applicant`
**Internal notification:** adultgamenights@gmail.com

### UI steps
1. Open **Sites → Forms** → click **Affiliate Creator Application**
2. Click **Settings** (gear icon) or **Integrations**
3. **On Submission → Add Tag**: `affiliate-applicant`
4. **On Submission → Send Internal Email**: `adultgamenights@gmail.com`
5. **On Submission → Trigger Workflow**: `Affiliate Application Review`
6. Save

## 3D Print Custom Order

**Form ID:** 🟡 not yet built
**Triggers workflow:** 3D Print Quote Flow 🟡 not yet built

**Tags on submit:** `source-3d-print-inquiry`
**Internal notification:** adultgamenights@gmail.com

### UI steps
1. Open **Sites → Forms** → click **3D Print Custom Order**
2. Click **Settings** (gear icon) or **Integrations**
3. **On Submission → Add Tag**: `source-3d-print-inquiry`
4. **On Submission → Send Internal Email**: `adultgamenights@gmail.com`
5. **On Submission → Trigger Workflow**: `3D Print Quote Flow`
6. Save


---

After completing all 6, run:
```bash
node scripts/10-wire-form-submissions.js
```
to refresh `/logs/form-wiring-spec.json` with the latest IDs (it re-reads forms/workflows/pipelines outputs).