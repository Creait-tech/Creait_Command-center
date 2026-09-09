#!/usr/bin/env python3
"""Normalise persona files against the current intake schema:
- q3 rows: 'Secondary' duplicates → 'Secondary 1', 'Secondary 2' (form fix of 9 Sep)
- report option/row/column mismatches so they can be corrected before driving.
"""
import json, glob, os, sys
SIM = os.path.dirname(os.path.abspath(__file__))
schema = json.load(open(os.path.join(SIM, "intake-schema.json")))
qs = {q["id"]: q for q in (schema["questions"] if isinstance(schema, dict) else schema)}
ROW = "row"
problems = {}
for f in sorted(glob.glob(os.path.join(SIM, "personas", "sim[0-9][0-9].json"))):
    p = json.load(open(f))
    intake = p.get("intake", {})
    fixed = False
    probs = []
    # q3 relabel
    q3 = intake.get("q3")
    if isinstance(q3, list):
        seen = 0
        for r in q3:
            if isinstance(r, dict) and r.get(ROW) == "Secondary":
                seen += 1
                r[ROW] = f"Secondary {seen}"
                fixed = True
    for qid, ans in intake.items():
        q = qs.get(qid)
        if not q:
            probs.append(f"{qid}: not in schema"); continue
        t = q["type"]
        if ans == "unknown":
            if not q.get("allowUnknown"): probs.append(f"{qid}: 'unknown' but allowUnknown is false")
            continue
        if t == "single":
            if ans not in (q.get("options") or []): probs.append(f"{qid}: option {ans!r} not in options")
        elif t == "multi":
            if not isinstance(ans, list): probs.append(f"{qid}: multi must be a list")
            else:
                for a in ans:
                    if a not in (q.get("options") or []): probs.append(f"{qid}: option {a!r} not in options")
        elif t == "table":
            if not isinstance(ans, list): probs.append(f"{qid}: table must be a list"); continue
            cols = {c["key"]: c for c in (q.get("columns") or [])}
            rows = q.get("rows")
            for r in ans:
                if not isinstance(r, dict): probs.append(f"{qid}: row is not an object"); continue
                for k, v in r.items():
                    if k == ROW:
                        if rows and v not in rows: probs.append(f"{qid}: row label {v!r} not in {rows}")
                        continue
                    if k not in cols: probs.append(f"{qid}: column {k!r} not in {list(cols)}"); continue
                    c = cols[k]
                    if c.get("type") == "single" and v not in (c.get("options") or []) and v != "unknown":
                        probs.append(f"{qid}.{k}: option {v!r} not in column options")
                if rows and ROW not in r: probs.append(f"{qid}: fixed-row table row missing '{ROW}' label")
        elif t in ("short", "long", "number", "currency", "percent", "upload_note"):
            if not isinstance(ans, str): probs.append(f"{qid}: expected string, got {type(ans).__name__}")
    # required coverage (skip for incomplete personas)
    if not p.get("intake_incomplete"):
        for qid, q in qs.items():
            if q.get("required") and qid not in intake and not qid.startswith("e"):
                probs.append(f"{qid}: required but missing")
    if fixed:
        json.dump(p, open(f, "w"), indent=1, ensure_ascii=False)
    problems[os.path.basename(f)] = probs
for k, v in problems.items():
    print(k, "OK" if not v else f"{len(v)} problem(s)")
    for x in v[:15]: print("   ", x)
