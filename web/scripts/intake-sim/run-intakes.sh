#!/bin/bash
# Run persona intakes through the local harness (real form bundle + real
# sanitize/merge/submit logic), one server per persona, and keep the stored
# state so it can be persisted to the database as the server action would.
#   bash run-intakes.sh 1 2 3 …   (persona numbers)
set -u
SIM="$(cd "$(dirname "$0")" && pwd)"
mkdir -p "$SIM/results" "$SIM/shots"
PORT=4400
for n in "$@"; do
  nn=$(printf '%02d' "$n")
  persona="$SIM/personas/sim$nn.json"
  [ -f "$persona" ] || { echo "sim$nn: no persona"; continue; }
  token=$(python3 -c "import json;print([s for s in json.load(open('$SIM/shells.json')) if s['n']==$n][0]['token'])")
  PORT=$((PORT+1))
  node "$SIM/harness/server.js" "$PORT" "$token" > "$SIM/results/server-$nn.log" 2>&1 &
  spid=$!
  sleep 1
  start=$(date +%s)
  INTAKE_BASE="http://127.0.0.1:$PORT" node "$SIM/intake-driver.js" "$token" "$persona" > "$SIM/results/driver-$nn.log" 2>&1
  rc=$?
  curl -s "http://127.0.0.1:$PORT/api/dump" > "$SIM/results/intake-dump-$nn.json"
  kill $spid 2>/dev/null; wait $spid 2>/dev/null
  end=$(date +%s)
  echo "sim$nn: driver rc=$rc in $((end-start))s; stored keys=$(python3 -c "import json;d=json.load(open('$SIM/results/intake-dump-$nn.json'));print(len(d.get('intake',{})), 'submitted' if d.get('submittedAt') else 'NOT submitted', 'writes', d.get('writes'))")"
done
