#!/usr/bin/env bash
set -euo pipefail
BASE=http://localhost:8080/api/v1

psql_cmd() {
  docker exec outreach-postgres psql -U outreach -d outreach -t -A -c "$1" 2>/dev/null
}

jq_or_python() {
  python3 -c "import sys,json; d=json.load(sys.stdin); $1"
}

echo "=== Setup: login ==="
psql_cmd "UPDATE users SET is_email_verified=true WHERE email='t7test@example.com';" || true
LOGIN=$(curl -s -X POST "$BASE/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"email":"t7test@example.com","password":"TestPass123!"}' \
  -c /tmp/c-t9.txt)
ACCESS=$(echo "$LOGIN" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['accessToken'])")
echo "Login OK"

H="Authorization: Bearer $ACCESS"
echo ""

echo "=== TEST 1: Add 'Google India Pvt Ltd / Software Development Engineer' ==="
APP1=$(curl -s -X POST "$BASE/applications" \
  -H "$H" -H 'Content-Type: application/json' \
  -d '{"company":"Google India Pvt Ltd","role":"Software Development Engineer","appliedDate":"2026-06-20"}')
echo "Response: $APP1"
APP1_ID=$(echo "$APP1" | python3 -c "import sys,json; d=json.load(sys.stdin)['data']; print(d['application']['id'])")
COMPANY_CANON=$(echo "$APP1" | python3 -c "import sys,json; d=json.load(sys.stdin)['data']; print(d['application']['companyCanonical'])")
ROLE_CANON=$(echo "$APP1" | python3 -c "import sys,json; d=json.load(sys.stdin)['data']; print(d['application']['roleCanonical'])")
echo "  App ID: $APP1_ID"
echo "  companyCanonical: '$COMPANY_CANON'"
echo "  roleCanonical: '$ROLE_CANON'"
echo ""

echo "=== TEST 2: Add 'Google / SDE' on same-ish date — should flag as POSSIBLE DUPLICATE ==="
DUP=$(curl -s -X POST "$BASE/applications" \
  -H "$H" -H 'Content-Type: application/json' \
  -d '{"company":"Google","role":"SDE","appliedDate":"2026-06-21"}')
echo "Response: $DUP"
IS_DUP=$(echo "$DUP" | python3 -c "import sys,json; d=json.load(sys.stdin)['data']; print(d['possibleDuplicate'])")
echo "  possibleDuplicate: $IS_DUP"
echo ""

echo "=== TEST 3: Force-create the Google/SDE anyway ==="
APP2=$(curl -s -X POST "$BASE/applications?force=true" \
  -H "$H" -H 'Content-Type: application/json' \
  -d '{"company":"Google","role":"SDE","appliedDate":"2026-06-21"}')
APP2_ID=$(echo "$APP2" | python3 -c "import sys,json; d=json.load(sys.stdin)['data']; print(d['application']['id'])")
echo "  Force-created App ID: $APP2_ID"
echo ""

echo "=== TEST 4: Status transition — applied → interview_scheduled → offer_received ==="
ST1=$(curl -s -X PUT "$BASE/applications/$APP1_ID/status" \
  -H "$H" -H 'Content-Type: application/json' \
  -d '{"status":"interview_scheduled","notes":"Got a call from recruiter"}')
echo "  → interview_scheduled: $(echo "$ST1" | python3 -c "import sys,json; d=json.load(sys.stdin)['data']; print(d['currentStatus'])")"
sleep 1

ST2=$(curl -s -X PUT "$BASE/applications/$APP1_ID/status" \
  -H "$H" -H 'Content-Type: application/json' \
  -d '{"status":"offer_received","notes":"Got the offer!"}')
echo "  → offer_received: $(echo "$ST2" | python3 -c "import sys,json; d=json.load(sys.stdin)['data']; print(d['currentStatus'])")"
echo ""

echo "=== TEST 5: Verify TWO timeline entries exist (append-only, not overwritten) ==="
TIMELINE=$(curl -s "$BASE/applications/$APP1_ID/timeline" -H "$H")
COUNT=$(echo "$TIMELINE" | python3 -c "import sys,json; d=json.load(sys.stdin)['data']; print(len(d['content'] if isinstance(d,dict) and 'content' in d else d))")
echo "  Timeline count: $COUNT (expect 3 — initial + 2 transitions)"
echo "$TIMELINE" | python3 -c "
import sys,json
d=json.load(sys.stdin)['data']
entries=d['content'] if isinstance(d,dict) and 'content' in d else d
for e in entries:
    print(f'    [{e[\"occurredAt\"][:19]}] {e[\"status\"]:25} notes={e[\"notes\"]}')
"
echo ""

echo "=== TEST 6: offer_received is NON-terminal — can still reach offer_accepted ==="
ST3=$(curl -s -X PUT "$BASE/applications/$APP1_ID/status" \
  -H "$H" -H 'Content-Type: application/json' \
  -d '{"status":"offer_accepted","notes":"Accepted the offer!"}')
echo "  → offer_accepted: $(echo "$ST3" | python3 -c "import sys,json; d=json.load(sys.stdin)['data']; print(d['currentStatus'])")"
echo ""

echo "=== TEST 7: Block transition OUT of terminal state (offer_accepted) ==="
TERM=$(curl -s -o /dev/null -w '%{http_code}' -X PUT "$BASE/applications/$APP1_ID/status" \
  -H "$H" -H 'Content-Type: application/json' \
  -d '{"status":"applied","notes":"try to go back"}')
echo "  HTTP status for offer_accepted→applied: $TERM (expect 400)"
echo ""

echo "=== TEST 8: Follow-ups — set next_action_due to past ==="
psql_cmd "UPDATE applications SET next_action_due = NOW() - INTERVAL '2 days' WHERE id='$APP2_ID';"
FOLLOWUPS=$(curl -s "$BASE/applications/follow-ups" -H "$H")
FU_COUNT=$(echo "$FOLLOWUPS" | python3 -c "import sys,json; d=json.load(sys.stdin)['data']; print(len(d['content'] if isinstance(d,dict) and 'content' in d else d))")
echo "  Follow-ups count: $FU_COUNT (expect >= 1)"
echo "$FOLLOWUPS" | python3 -c "
import sys,json
d=json.load(sys.stdin)['data']
for f in (d['content'] if isinstance(d,dict) and 'content' in d else d):
    print(f'    {f[\"company\"]} / {f[\"role\"]} — nextActionDue={f[\"nextActionDue\"][:19]}')
"
echo ""

echo "=== TEST 9: Soft-delete APP2 — disappears from list but DB row + timeline preserved ==="
DEL=$(curl -s -X DELETE "$BASE/applications/$APP2_ID" -H "$H")
echo "  DELETE response: $DEL"
LIST_AFTER=$(curl -s "$BASE/applications" -H "$H")
LIST_COUNT=$(echo "$LIST_AFTER" | python3 -c "import sys,json; d=json.load(sys.stdin)['data']; print(len(d['content'] if isinstance(d,dict) and 'content' in d else d))")
echo "  Applications in list after delete: $LIST_COUNT"
DB_COUNT=$(psql_cmd "SELECT COUNT(*) FROM applications WHERE id='$APP2_ID';")
TIMELINE_COUNT=$(psql_cmd "SELECT COUNT(*) FROM application_timeline WHERE application_id='$APP2_ID';")
echo "  DB row still exists: $DB_COUNT (expect 1)"
echo "  Timeline rows preserved: $TIMELINE_COUNT (expect >= 1)"
echo ""

echo "=== TEST 10: Analytics ==="
ANALYTICS=$(curl -s "$BASE/applications/analytics" -H "$H")
echo "$ANALYTICS" | python3 -c "
import sys,json
d=json.load(sys.stdin)['data']
print(f'  total={d[\"totalApplications\"]} replyRate={d[\"replyRatePct\"]}% conversion={d[\"conversionRatePct\"]}%')
print(f'  stageCounts={d[\"stageCounts\"]}')
"
echo ""

echo "=== TEST 10: Record an outcome ==="
OUTCOME=$(curl -s -X POST "$BASE/applications/$APP1_ID/outcome" \
  -H "$H" -H 'Content-Type: application/json' \
  -d '{"outcome":"offer_got"}')
echo "  Outcome: $OUTCOME"
DB_OUTCOME=$(psql_cmd "SELECT outcome,score_at_time FROM application_outcomes WHERE application_id='$APP1_ID';")
echo "  DB outcome row: $DB_OUTCOME"
echo ""

echo "=== DONE ==="
