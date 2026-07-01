#!/usr/bin/env bash
BASE="http://localhost:8080/api/v1"
EMAIL="t10verify2@outreach.dev"
PASS="T10Pass1!"

TOKEN=$(curl -s -X POST "$BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['accessToken'])" 2>/dev/null)

echo "Token obtained: ${TOKEN:0:30}..."

echo ""
echo "=== GET /notifications ==="
NOTIFS=$(curl -s "$BASE/notifications" -H "Authorization: Bearer $TOKEN")
echo "$NOTIFS"
NOTIF_ID=$(echo "$NOTIFS" | python3 -c "import sys,json; d=json.load(sys.stdin)['data']; items=d['content'] if isinstance(d,dict) and 'content' in d else d; print(items[0]['id'] if items else 'none')" 2>/dev/null)
echo "Notif ID: $NOTIF_ID"

if [ "$NOTIF_ID" != "none" ]; then
    echo ""
    echo "=== PUT /notifications/$NOTIF_ID/read ==="
    curl -s -X PUT "$BASE/notifications/$NOTIF_ID/read" -H "Authorization: Bearer $TOKEN"
    
    echo ""
    echo ""
    echo "=== PUT /notifications/read-all ==="
    curl -s -X PUT "$BASE/notifications/read-all" -H "Authorization: Bearer $TOKEN"
fi

echo ""
echo ""
echo "=== DB: notifications state ==="
PGPASSWORD=outreach psql -h localhost -p 5432 -U outreach -d outreach \
    -c "SELECT type, is_read, delivery_status FROM notifications ORDER BY created_at DESC LIMIT 3"

echo ""
echo "=== DB: Draft raw_payload nil after confirm ==="
PGPASSWORD=outreach psql -h localhost -p 5432 -U outreach -d outreach \
    -c "SELECT status, raw_payload IS NULL as payload_null FROM inbound_email_drafts WHERE status='confirmed' LIMIT 3"
