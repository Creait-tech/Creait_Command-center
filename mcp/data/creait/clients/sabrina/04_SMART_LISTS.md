# Smart Lists (Saved Segments)

Save these in **Contacts → Smart Lists** for fast segmenting + reporting.

| List Name | Filter |
|---|---|
| Cyber — Active Nurture | `product:cyber` AND `seq:cyber-nurture` AND NOT `flag:reply-stop` |
| Pro-Liab — Active Nurture | `product:pro-liab` AND `seq:pro-liab-nurture` AND NOT `flag:reply-stop` |
| Surety — Active Nurture | `product:surety` AND `seq:surety-nurture` AND NOT `flag:reply-stop` |
| Hot Leads — 7 Days | `stage:warm-lead` OR `stage:contacted` AND created in last 7 days |
| Quoted — Awaiting Decision | `stage:quoted` AND quote sent >0 days ago |
| Clients — All | `stage:client-active` |
| Clients — Cyber Only (cross-sell pro-liab) | `stage:client-active` AND `product:cyber` AND NOT `product:pro-liab` |
| Clients — Pro-Liab Only (cross-sell cyber) | `stage:client-active` AND `product:pro-liab` AND NOT `product:cyber` |
| Renewals — Next 60 Days | Policy Expiration in next 60 days |
| Medicare/Medicaid Retention (10-yr) | `compliance:medicare-medicaid` |
| Business Cards — Last Event | `source:business-card` sorted by last event tag |
| Unsubscribed — Review | `unsubscribed:email` OR `unsubscribed:sms` |
| Networking — All Contacts | `source:networking-event` |
| Referrals — All | `source:referral` |

## Reporting Dashboards

1. **Source ROI** — new contacts by `source:*` per week/month
2. **Product Funnel** — contacts → quoted → bound per product
3. **Response Times** — avg time from form submit to first outbound
4. **Sequence Health** — reply rate, unsubscribe rate per sequence (flag any >2% unsubscribe)
