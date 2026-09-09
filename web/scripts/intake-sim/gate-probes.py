#!/usr/bin/env python3
"""Emit the SQL for the delivery / lock / validation probes for one persona.
usage: gate-probes.py <n> <deliver|probes>
- deliver: mark the seeded practice engagement delivered exactly as the server action would
           (reviewer, timestamps, snapshot from the harness result).
- probes:  statements that MUST be refused by the database once delivered
           (each is run separately; a success is a finding), then the reopen path.
"""
import json, os, sys
SIM = os.path.dirname(os.path.abspath(__file__))
n = int(sys.argv[1]); mode = sys.argv[2]
shell = [s for s in json.load(open(os.path.join(SIM, "shells.json"))) if s["n"] == n][0]
res = json.load(open(os.path.join(SIM, "results", f"facilitate-{n:02d}.json")))
aid = shell["id"]
if mode == "deliver":
    snap = json.dumps({"sim": n, "computed": res["computed"], "readiness": res["gate"]["withReviewer"], "portfolio": res["portfolio"], "at": "2026-09-09T12:00:00Z"})
    print(f"""UPDATE cc_assessments SET status='delivered', reviewed_by='Sim Reviewer', reviewed_at=now(), delivered_at='2026-09-09', delivered_snapshot=$j${snap}$j$::jsonb WHERE id='{aid}' AND status <> 'delivered' RETURNING id, status, reviewed_by;""")
elif mode == "probes":
    probes = {
        "score_update_locked": f"UPDATE cc_assessment_scores SET score = LEAST(4, COALESCE(score,0)+1) WHERE assessment_id='{aid}' AND indicator_key='P1' RETURNING id;",
        "score_insert_locked": f"INSERT INTO cc_assessment_scores (assessment_id, indicator_key, pillar, score) VALUES ('{aid}','P1','profit',2) ON CONFLICT DO NOTHING RETURNING id;",
        "opportunity_delete_locked": f"DELETE FROM cc_assessment_opportunities WHERE assessment_id='{aid}' RETURNING id;",
        "opportunity_insert_locked": f"INSERT INTO cc_assessment_opportunities (assessment_id, title) VALUES ('{aid}','Sneaked in after delivery') RETURNING id;",
        "parent_constraint_locked": f"UPDATE cc_assessments SET primary_constraint = primary_constraint || ' (edited after delivery)' WHERE id='{aid}' RETURNING id;",
        "parent_overlap_locked": f"UPDATE cc_assessments SET overlap_factor = 1.0 WHERE id='{aid}' RETURNING id;",
        "parent_pnl_locked": f"UPDATE cc_assessments SET pnl_on_file = NOT pnl_on_file WHERE id='{aid}' RETURNING id;",
        "outcomes_allowed": f"UPDATE cc_assessments SET outcomes = '{{\"day30\":{{\"reviewed_on\":\"2026-10-09\",\"reviewer\":\"Sim Reviewer\",\"items\":[],\"summary\":\"probe\"}}}}'::jsonb WHERE id='{aid}' RETURNING id;",
        "meeting_link_allowed": f"UPDATE cc_assessments SET meeting_id = NULL WHERE id='{aid}' RETURNING id;",
        "reopen_allowed": f"UPDATE cc_assessments SET status='review', reviewed_by=NULL, reviewed_at=NULL WHERE id='{aid}' RETURNING id, status;",
        "score_update_after_reopen_allowed": f"UPDATE cc_assessment_scores SET notes = notes WHERE assessment_id='{aid}' AND indicator_key='P1' RETURNING id;",
        "redeliver_allowed": f"UPDATE cc_assessments SET status='delivered', reviewed_by='Sim Reviewer 2', reviewed_at=now() WHERE id='{aid}' RETURNING id, reviewed_by;",
    }
    print(json.dumps(probes, indent=1))
