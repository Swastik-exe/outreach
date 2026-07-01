#!/usr/bin/env bash
# Verify the 2 items that need DB access via the native WSL postgres
BASE="http://localhost:8080/api/v1"
EMAIL="t10verify2@outreach.dev"

PSQL="psql -h localhost -p 5432 -U outreach -d outreach"

echo "=== DB: Check notif_channel was saved ==="
PGPASSWORD=outreach $PSQL -t -c "SELECT email, notif_channel FROM users WHERE email='$EMAIL'"

echo ""
echo "=== DB: Get user ID ==="
USER_ID=$(PGPASSWORD=outreach $PSQL -t -c "SELECT id FROM users WHERE email='$EMAIL'" | tr -d ' \n')
echo "UserID: $USER_ID"

echo ""
echo "=== DB: Insert test notification ==="
PGPASSWORD=outreach $PSQL -c "INSERT INTO notifications(id,user_id,type,title,body,is_read,channels,delivery_status,created_at) VALUES(gen_random_uuid(),'$USER_ID','test','T10 Test Notif','Test body for T10',false,'{in_app}','sent',NOW())"

echo ""
echo "=== DB: Verify inbound_email_drafts ==="
PGPASSWORD=outreach $PSQL -c "SELECT parsed_company, parsed_role, parsed_date, confidence, status FROM inbound_email_drafts ORDER BY created_at DESC LIMIT 5"

echo ""
echo "=== DB: Verify forwarding_addresses ==="
PGPASSWORD=outreach $PSQL -c "SELECT address, created_at FROM forwarding_addresses ORDER BY created_at DESC LIMIT 3"

echo ""
echo "=== DB: Verify applications created from inbound ==="
PGPASSWORD=outreach $PSQL -c "SELECT company, role, source, applied_date FROM applications WHERE user_id='$USER_ID' ORDER BY created_at DESC LIMIT 5"

echo ""
echo "=== DB: Check no_channel scenario (whatsapp without number) ==="
PGPASSWORD=outreach $PSQL -c "SELECT email, notif_channel, whatsapp_number FROM users WHERE email='$EMAIL'"
