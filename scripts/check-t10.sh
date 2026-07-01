#!/usr/bin/env bash
BASE="http://localhost:8080/api/v1"
EMAIL="t10verify2@outreach.dev"
PASS="T10Pass1!"

echo "=== Registering user ==="
curl -s -X POST "$BASE/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\",\"name\":\"T10 Test\"}" | python3 -m json.tool 2>/dev/null || echo "(parse error)"

echo ""
echo "=== Verifying email in DB ==="
docker exec outreach-postgres psql -U outreach -d outreach -c "UPDATE users SET is_email_verified=true WHERE email='$EMAIL'"

echo ""
echo "=== Logging in ==="
LOGIN=$(curl -s -X POST "$BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}")
echo "$LOGIN" | python3 -m json.tool 2>/dev/null || echo "$LOGIN"
TOKEN=$(echo "$LOGIN" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['accessToken'])" 2>/dev/null)

echo ""
echo "=== Getting forwarding address ==="
FA=$(curl -s "$BASE/settings/forwarding" -H "Authorization: Bearer $TOKEN")
echo "$FA" | python3 -m json.tool 2>/dev/null
ADDR=$(echo "$FA" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['address'])" 2>/dev/null)
echo "Address: $ADDR"

echo ""
echo "=== TEST: Webhook WITHOUT secret (expect 401) ==="
curl -s -w "\nHTTP_STATUS:%{http_code}" -X POST "$BASE/inbound-email/webhook" \
  -H "Content-Type: application/json" \
  -d "{\"to\":\"$ADDR\",\"from\":\"hr@google.com\",\"subject\":\"Application for Software Engineer at Google\",\"bodyText\":\"Thank you for applying to Software Engineer at Google on 2026-06-27.\"}"

echo ""
echo ""
echo "=== TEST: Webhook WITH WRONG secret (expect 401) ==="
curl -s -w "\nHTTP_STATUS:%{http_code}" -X POST "$BASE/inbound-email/webhook" \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Secret: wrong-secret" \
  -d "{\"to\":\"$ADDR\",\"from\":\"hr@google.com\",\"subject\":\"Application for Software Engineer at Google\",\"bodyText\":\"Thank you for applying to Software Engineer at Google.\"}"

echo ""
echo ""
echo "=== TEST: Webhook WITH CORRECT secret (expect 200 + draft) ==="
SECRET="local-dev-webhook-secret-change-me"
curl -s -X POST "$BASE/inbound-email/webhook" \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Secret: $SECRET" \
  -d "{\"to\":\"$ADDR\",\"from\":\"hr@google.com\",\"subject\":\"Application for Software Engineer at Google\",\"bodyText\":\"Thank you for applying to the Software Engineer position at Google. Applied on 2026-06-27.\"}" | python3 -m json.tool 2>/dev/null

sleep 1

echo ""
echo "=== Listing drafts ==="
DRAFTS=$(curl -s "$BASE/inbound-email/drafts" -H "Authorization: Bearer $TOKEN")
echo "$DRAFTS" | python3 -m json.tool 2>/dev/null
DRAFT_ID=$(echo "$DRAFTS" | python3 -c "import sys,json; d=json.load(sys.stdin)['data']; print(d[0]['id'] if d else '')" 2>/dev/null)
echo "Draft ID: $DRAFT_ID"

echo ""
echo "=== Confirming draft ==="
if [ -n "$DRAFT_ID" ]; then
  CONFIRM=$(curl -s -X POST "$BASE/inbound-email/drafts/$DRAFT_ID/confirm" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d "{\"company\":\"Google\",\"role\":\"Software Engineer\",\"appliedDate\":\"2026-06-27\"}")
  echo "$CONFIRM" | python3 -m json.tool 2>/dev/null
fi

echo ""
echo "=== Checking pending drafts after confirm ==="
curl -s "$BASE/inbound-email/drafts" -H "Authorization: Bearer $TOKEN" | python3 -m json.tool 2>/dev/null

echo ""
echo "=== Seeding follow-up app with past due date ==="
USER_ID=$(docker exec outreach-postgres psql -U outreach -d outreach -t -c "SELECT id FROM users WHERE email='$EMAIL'" | tr -d ' \n')
echo "UserID: $USER_ID"
docker exec outreach-postgres psql -U outreach -d outreach -c "INSERT INTO applications(id,user_id,company,company_canonical,role,role_canonical,source,applied_date,current_status,next_action_due,created_at,updated_at) VALUES(gen_random_uuid(),'$USER_ID','Stripe Inc','stripe','Backend Eng','backend eng','manual','2026-06-01','applied','2026-06-05 00:00:00+00',NOW(),NOW()) ON CONFLICT DO NOTHING"

echo ""
echo "=== Testing no_channel: set notif_channel=whatsapp (no number) ==="
curl -s -X PUT "$BASE/notifications/preferences" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"channel":"whatsapp"}' | python3 -m json.tool 2>/dev/null

CHANNEL=$(docker exec outreach-postgres psql -U outreach -d outreach -t -c "SELECT notif_channel FROM users WHERE email='$EMAIL'" | tr -d ' \n')
echo "Saved notif_channel: '$CHANNEL'"

echo ""
echo "=== Inserting test notification directly ==="
NOTIF_ID=$(python3 -c "import uuid; print(uuid.uuid4())")
docker exec outreach-postgres psql -U outreach -d outreach -c "INSERT INTO notifications(id,user_id,type,title,body,is_read,channels,delivery_status,created_at) VALUES('$NOTIF_ID','$USER_ID','test','Test Notif','Test body',false,'{in_app}','sent',NOW())"

echo ""
echo "=== GET /notifications ==="
NOTIFS=$(curl -s "$BASE/notifications" -H "Authorization: Bearer $TOKEN")
echo "$NOTIFS" | python3 -m json.tool 2>/dev/null
NOTIF_FROM_API=$(echo "$NOTIFS" | python3 -c "import sys,json; d=json.load(sys.stdin)['data']; items=d['content'] if isinstance(d,dict) and 'content' in d else d; print(items[0]['id'] if items else 'none')" 2>/dev/null)
echo "First notif ID from API: $NOTIF_FROM_API"

echo ""
echo "=== Mark read ==="
if [ "$NOTIF_FROM_API" != "none" ]; then
  curl -s -X PUT "$BASE/notifications/$NOTIF_FROM_API/read" \
    -H "Authorization: Bearer $TOKEN" | python3 -m json.tool 2>/dev/null
fi

echo ""
echo "=== DB check: users with recent data ==="
docker exec outreach-postgres psql -U outreach -d outreach -c "SELECT email, notif_channel FROM users ORDER BY created_at DESC LIMIT 5"
docker exec outreach-postgres psql -U outreach -d outreach -c "SELECT parsed_company, parsed_role, status FROM inbound_email_drafts ORDER BY created_at DESC LIMIT 5"

echo ""
echo "DONE"
