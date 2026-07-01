#!/usr/bin/env bash
# Task 11 verification — tracker UI flows via API (mirrors what the UI does)
BASE="http://localhost:8080/api/v1"
EMAIL="t11ui@outreach.dev"
PASS="T11Pass1!"
SECRET="local-dev-webhook-secret-change-me"

pass=0; fail=0
ok() { echo "  PASS: $1"; pass=$((pass+1)); }
bad() { echo "  FAIL: $1"; fail=$((fail+1)); }

echo "=== SETUP ==="
curl -s -X POST "$BASE/auth/register" -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}" > /dev/null 2>&1 || true
PGPASSWORD=outreach psql -h localhost -p 5432 -U outreach -d outreach \
  -c "UPDATE users SET is_email_verified=true WHERE email='$EMAIL'" > /dev/null

LOGIN=$(curl -s -X POST "$BASE/auth/login" -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}")
TOKEN=$(echo "$LOGIN" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['accessToken'])" 2>/dev/null)
AUTH="Authorization: Bearer $TOKEN"
[ -n "$TOKEN" ] && ok "Logged in" || { bad "Login failed"; exit 1; }

echo ""
echo "=== TEST 1: Add application -> list ==="
ADD=$(curl -s -X POST "$BASE/applications" -H "Content-Type: application/json" -H "$AUTH" \
  -d '{"company":"Microsoft","role":"SDE Intern","source":"manual","appliedDate":"2026-06-27","priority":"high"}')
APP_ID=$(echo "$ADD" | python3 -c "import sys,json; d=json.load(sys.stdin)['data']; print(d['application']['id'] if d.get('application') else '')" 2>/dev/null)
[ -n "$APP_ID" ] && ok "Application created id=$APP_ID" || bad "Create failed: $ADD"

LIST=$(curl -s "$BASE/applications" -H "$AUTH")
COUNT=$(echo "$LIST" | python3 -c "import sys,json; d=json.load(sys.stdin).get('data',[]); print(len(d['content'] if isinstance(d,dict) and 'content' in d else d))" 2>/dev/null)
[ "$COUNT" -ge 1 ] && ok "List shows $COUNT application(s)" || bad "List empty"

echo ""
echo "=== TEST 2: Duplicate prompt (fuzzy match) ==="
DUP=$(curl -s -X POST "$BASE/applications" -H "Content-Type: application/json" -H "$AUTH" \
  -d '{"company":"Microsoft India Pvt Ltd","role":"Software Development Engineer","source":"manual","appliedDate":"2026-06-26"}')
IS_DUP=$(echo "$DUP" | python3 -c "import sys,json; print(json.load(sys.stdin)['data'].get('possibleDuplicate',False))" 2>/dev/null)
[ "$IS_DUP" = "True" ] && ok "Duplicate detected (possibleDuplicate=true)" || bad "Duplicate not detected: $DUP"

echo ""
echo "=== TEST 3: Status change -> timeline append ==="
STATUS=$(curl -s -X PUT "$BASE/applications/$APP_ID/status" -H "Content-Type: application/json" -H "$AUTH" \
  -d '{"status":"interview_scheduled","notes":"Phone screen booked"}')
TLEN=$(echo "$STATUS" | python3 -c "
import sys,json
d=json.load(sys.stdin)['data']
tl=d.get('timeline') or []
print(len(tl))
" 2>/dev/null)
[ "$TLEN" -ge 1 ] && ok "Timeline has $TLEN entries after status change" || bad "Timeline missing: $STATUS"

echo ""
echo "=== TEST 4: Follow-up indicator data ==="
USER_ID=$(PGPASSWORD=outreach psql -h localhost -p 5432 -U outreach -d outreach -t \
  -c "SELECT id FROM users WHERE email='$EMAIL'" | tr -d ' \n')
PGPASSWORD=outreach psql -h localhost -p 5432 -U outreach -d outreach -c \
  "INSERT INTO applications(id,user_id,company,company_canonical,role,role_canonical,source,applied_date,current_status,next_action_due,created_at,updated_at) VALUES(gen_random_uuid(),'$USER_ID','Stripe','stripe','Backend Eng','backend eng','manual','2026-06-01','applied','2026-06-05 00:00:00+00',NOW(),NOW())" > /dev/null
FUPS=$(curl -s "$BASE/applications/follow-ups" -H "$AUTH")
FCOUNT=$(echo "$FUPS" | python3 -c "import sys,json; d=json.load(sys.stdin).get('data',[]); print(len(d['content'] if isinstance(d,dict) and 'content' in d else d))" 2>/dev/null)
[ "$FCOUNT" -ge 1 ] && ok "Follow-ups endpoint returns $FCOUNT due app(s)" || bad "No follow-ups"

echo ""
echo "=== TEST 5: Draft -> confirm -> application ==="
FA=$(curl -s "$BASE/settings/forwarding" -H "$AUTH")
ADDR=$(echo "$FA" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['address'])" 2>/dev/null)
[ -n "$ADDR" ] && ok "Forwarding address: $ADDR" || bad "No forwarding address"

curl -s -X POST "$BASE/inbound-email/webhook" -H "Content-Type: application/json" \
  -H "X-Webhook-Secret: $SECRET" \
  -d "{\"to\":\"$ADDR\",\"from\":\"hr@amazon.com\",\"subject\":\"SDE at Amazon\",\"bodyText\":\"Thank you for applying to SDE at Amazon on 2026-06-27.\"}" > /dev/null

DRAFTS=$(curl -s "$BASE/inbound-email/drafts" -H "$AUTH")
DRAFT_ID=$(echo "$DRAFTS" | python3 -c "import sys,json; d=json.load(sys.stdin)['data']; print(d[0]['id'] if d else '')" 2>/dev/null)
[ -n "$DRAFT_ID" ] && ok "Draft created $DRAFT_ID" || bad "No draft"

CONF=$(curl -s -X POST "$BASE/inbound-email/drafts/$DRAFT_ID/confirm" -H "Content-Type: application/json" -H "$AUTH" \
  -d '{"company":"Amazon","role":"SDE","appliedDate":"2026-06-27"}')
CONF_OK=$(echo "$CONF" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('success',False))" 2>/dev/null)
[ "$CONF_OK" = "True" ] && ok "Draft confirmed -> application created" || bad "Confirm failed: $CONF"

echo ""
echo "=== TEST 6: Soft delete removes from list ==="
DEL=$(curl -s -X DELETE "$BASE/applications/$APP_ID" -H "$AUTH")
LIST2=$(curl -s "$BASE/applications" -H "$AUTH")
STILL=$(echo "$LIST2" | python3 -c "
import sys,json
d=json.load(sys.stdin).get('data',[])
items=d['content'] if isinstance(d,dict) and 'content' in d else d
ids=[a['id'] for a in items]
print('$APP_ID' in ids)
" 2>/dev/null)
[ "$STILL" = "False" ] && ok "Soft-deleted app removed from list" || bad "Deleted app still in list"

echo ""
echo "=== TEST 7: Frontend routes ==="
for route in /tracker /tracker/add /settings; do
  CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:3000$route" 2>/dev/null || echo 000)
  [ "$CODE" = "200" ] && ok "Frontend $route -> 200" || bad "Frontend $route -> $CODE"
done

echo ""
echo "========================================"
echo "TASK 11 VERIFICATION: PASSED=$pass FAILED=$fail"
echo "========================================"
