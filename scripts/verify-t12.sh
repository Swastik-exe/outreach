#!/usr/bin/env bash
# Task 12 verification — Razorpay billing + quotas
BASE="http://localhost:8080/api/v1"
EMAIL="t12bill@outreach.dev"
PASS="T12Pass1!"
WEBHOOK_SECRET="${RAZORPAY_WEBHOOK_SECRET:-test-webhook-secret-for-dev}"

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
USER_ID=$(PGPASSWORD=outreach psql -h localhost -p 5432 -U outreach -d outreach -t \
  -c "SELECT id FROM users WHERE email='$EMAIL'" | tr -d ' \n')
[ -n "$TOKEN" ] && ok "Logged in user=$USER_ID" || { bad "Login failed"; exit 1; }

echo ""
echo "=== TEST 1: Pricing endpoint (public) ==="
PRICE=$(curl -s "$BASE/subscription/pricing")
AMT=$(echo "$PRICE" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['seasonPass']['amountInr'])" 2>/dev/null)
[ "$AMT" = "499" ] && ok "Pricing API returns seasonPass=499 INR" || bad "Pricing: $PRICE"

echo ""
echo "=== TEST 2: Checkout (sandbox) ==="
CHECKOUT=$(curl -s -X POST "$BASE/subscription/checkout" -H "Content-Type: application/json" -H "$AUTH" \
  -d '{"plan":"seasonPass"}')
ORDER_ID=$(echo "$CHECKOUT" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['orderId'])" 2>/dev/null)
SANDBOX=$(echo "$CHECKOUT" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['sandbox'])" 2>/dev/null)
[ -n "$ORDER_ID" ] && ok "Checkout orderId=$ORDER_ID sandbox=$SANDBOX" || bad "Checkout failed: $CHECKOUT"

echo ""
echo "=== TEST 3: Invalid webhook signature -> 401 ==="
BODY='{"event":"payment.captured","id":"evt_bad"}'
CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/webhooks/razorpay" \
  -H "Content-Type: application/json" \
  -H "X-Razorpay-Signature: deadbeef" \
  -d "$BODY")
[ "$CODE" = "401" ] && ok "Invalid signature rejected (401)" || bad "Expected 401 got $CODE"

echo ""
echo "=== TEST 4: Valid webhook -> plan activates ==="
EVENT_ID="evt_t12_$(date +%s)"
WEBHOOK_BODY=$(python3 -c "
import json
print(json.dumps({
  'event': 'payment.captured',
  'id': '$EVENT_ID',
  'payload': {
    'payment': {
      'entity': {
        'id': 'pay_t12_test',
        'order_id': '$ORDER_ID',
        'amount': 49900
      }
    }
  }
}))
")

SIG=$(python3 -c "
import hmac, hashlib, os
secret = os.environ.get('RAZORPAY_WEBHOOK_SECRET', '$WEBHOOK_SECRET')
body = '''$WEBHOOK_BODY'''
print(hmac.new(secret.encode(), body.encode(), hashlib.sha256).hexdigest())
")

WH1=$(curl -s -X POST "$BASE/webhooks/razorpay" \
  -H "Content-Type: application/json" \
  -H "X-Razorpay-Signature: $SIG" \
  -d "$WEBHOOK_BODY")
WH1_OK=$(echo "$WH1" | python3 -c "import sys,json; print(json.load(sys.stdin).get('success',False))" 2>/dev/null)
TIER=$(PGPASSWORD=outreach psql -h localhost -p 5432 -U outreach -d outreach -t \
  -c "SELECT plan_tier FROM users WHERE id='$USER_ID'" | tr -d ' \n')
[ "$WH1_OK" = "True" ] && [ "$TIER" = "pass_holder" ] && ok "Webhook activated pass_holder" || bad "Activation failed tier=$TIER resp=$WH1"

PE_COUNT=$(PGPASSWORD=outreach psql -h localhost -p 5432 -U outreach -d outreach -t \
  -c "SELECT COUNT(*) FROM payment_events WHERE provider_event_id='$EVENT_ID'" | tr -d ' \n')
[ "$PE_COUNT" = "1" ] && ok "payment_events row inserted" || bad "payment_events count=$PE_COUNT"

echo ""
echo "=== TEST 5: Duplicate webhook -> idempotent (no double activation) ==="
WH2=$(curl -s -X POST "$BASE/webhooks/razorpay" \
  -H "Content-Type: application/json" \
  -H "X-Razorpay-Signature: $SIG" \
  -d "$WEBHOOK_BODY")
WH2_OK=$(echo "$WH2" | python3 -c "import sys,json; print(json.load(sys.stdin).get('success',False))" 2>/dev/null)
PE_COUNT2=$(PGPASSWORD=outreach psql -h localhost -p 5432 -U outreach -d outreach -t \
  -c "SELECT COUNT(*) FROM payment_events WHERE provider_event_id='$EVENT_ID'" | tr -d ' \n')
[ "$WH2_OK" = "True" ] && [ "$PE_COUNT2" = "1" ] && ok "Duplicate webhook idempotent (still 1 event row)" || bad "Duplicate not idempotent count=$PE_COUNT2"

echo ""
echo "=== TEST 6: Lazy expiry (period_end in past) ==="
PGPASSWORD=outreach psql -h localhost -p 5432 -U outreach -d outreach -c \
  "UPDATE subscriptions SET period_end='2020-01-01 00:00:00+00' WHERE user_id='$USER_ID'" > /dev/null
SUB=$(curl -s "$BASE/subscription" -H "$AUTH")
EXPIRED=$(echo "$SUB" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['expired'])" 2>/dev/null)
TIER2=$(PGPASSWORD=outreach psql -h localhost -p 5432 -U outreach -d outreach -t \
  -c "SELECT plan_tier FROM users WHERE id='$USER_ID'" | tr -d ' \n')
[ "$EXPIRED" = "True" ] && [ "$TIER2" = "free" ] && ok "Lazy expiry: expired=true, demoted to free" || bad "Lazy expiry failed expired=$EXPIRED tier=$TIER2"

echo ""
echo "=== TEST 7: Free quota blocks 4th analysis ==="
# Reset user to free and set quota at limit
PGPASSWORD=outreach psql -h localhost -p 5432 -U outreach -d outreach -c \
  "UPDATE users SET plan_tier='free' WHERE id='$USER_ID';
   INSERT INTO usage_quotas(id,user_id,metric,used,quota_limit,resets_at)
   VALUES(gen_random_uuid(),'$USER_ID','resume_analyses',3,3,NOW()+INTERVAL '30 days')
   ON CONFLICT (user_id,metric) DO UPDATE SET used=3, quota_limit=3;" > /dev/null

# Create a minimal resume row for analyze endpoint
PGPASSWORD=outreach psql -h localhost -p 5432 -U outreach -d outreach -c \
  "UPDATE resumes SET is_active=false WHERE user_id='$USER_ID'" > /dev/null

RES_ID=$(PGPASSWORD=outreach psql -h localhost -p 5432 -U outreach -d outreach -A -t -c \
  "INSERT INTO resumes(id,user_id,file_name,raw_text,is_active,analysis_status,created_at)
   VALUES(gen_random_uuid(),'$USER_ID','test.pdf',
   'Sample resume text for quota test with enough characters to pass validation and parsing requirements here.',
   true,'pending',NOW())
   RETURNING id" | head -1 | tr -d ' \n\r')

ANALYZE_CODE=$(curl -s -o /tmp/t12_analyze.json -w "%{http_code}" -X POST "$BASE/resumes/$RES_ID/analyze" -H "$AUTH")
# GlobalExceptionHandler returns 429 for TooManyRequestsException
[ "$ANALYZE_CODE" = "429" ] && ok "4th analysis blocked with 429" || bad "Expected 429 got $ANALYZE_CODE $(cat /tmp/t12_analyze.json)"

echo ""
echo "=== TEST 8: Frontend /pricing ==="
PCODE=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:3000/pricing" 2>/dev/null || echo 000)
[ "$PCODE" = "200" ] && ok "Frontend /pricing -> 200" || bad "Frontend /pricing -> $PCODE"

echo ""
echo "========================================"
echo "TASK 12 VERIFICATION: PASSED=$pass FAILED=$fail"
echo "========================================"
