$ErrorActionPreference = "Stop"
$BASE = "http://localhost:8080/api/v1"

# ─── helpers ───────────────────────────────────────────────────────────────────
function apiGet($path, $token) {
    $h = @{}; if ($token) { $h["Authorization"] = "Bearer $token" }
    try { return Invoke-RestMethod -Uri "$BASE$path" -Method GET -Headers $h }
    catch {
        $raw = $_.ErrorDetails.Message
        if ($raw) { try { return $raw | ConvertFrom-Json } catch {} }
        return [PSCustomObject]@{ success=$false; error=$_.Exception.Message }
    }
}
function apiPost($path, $body, $token) {
    $h = @{"Content-Type"="application/json"}
    if ($token) { $h["Authorization"] = "Bearer $token" }
    try { return Invoke-RestMethod -Uri "$BASE$path" -Method POST -Headers $h -Body $body }
    catch {
        $raw = $_.ErrorDetails.Message
        if ($raw) { try { return $raw | ConvertFrom-Json } catch {} }
        return [PSCustomObject]@{ success=$false; error=$_.Exception.Message }
    }
}
function apiPut($path, $body, $token) {
    $h = @{"Content-Type"="application/json"}
    if ($token) { $h["Authorization"] = "Bearer $token" }
    try { return Invoke-RestMethod -Uri "$BASE$path" -Method PUT -Headers $h -Body $body }
    catch {
        $raw = $_.ErrorDetails.Message
        if ($raw) { try { return $raw | ConvertFrom-Json } catch {} }
        return [PSCustomObject]@{ success=$false; error=$_.Exception.Message }
    }
}
function apiDelete($path, $token) {
    $h = @{}; if ($token) { $h["Authorization"] = "Bearer $token" }
    return Invoke-RestMethod -Uri "$BASE$path" -Method DELETE -Headers $h -ErrorAction SilentlyContinue
}
function apiStatusCode($method, $path, $body, $token) {
    try {
        $h = @{"Content-Type"="application/json"}
        if ($token) { $h["Authorization"] = "Bearer $token" }
        $job = Start-Job -ScriptBlock {
            param($m,$u,$h,$b)
            try { (Invoke-WebRequest -Uri $u -Method $m -Headers $h -Body $b -TimeoutSec 5 -ErrorAction Stop).StatusCode }
            catch { $_.Exception.Response.StatusCode.value__ }
        } -ArgumentList $method,"$BASE$path",$h,$body
        $result = Wait-Job $job -Timeout 8 | Receive-Job
        Remove-Job $job -Force
        return $result
    } catch { return 0 }
}
function psql($sql) {
    return docker exec outreach-postgres psql -U outreach -d outreach -t -A -c $sql 2>$null
}

# ─── setup ─────────────────────────────────────────────────────────────────────
Write-Host "=== Register + verify test user ==="
$regBody = '{"email":"t9test@example.com","password":"TestPass123!"}'
try { $reg = apiPost "/auth/register" $regBody; Write-Host "  Register success=$($reg.success)" }
catch { Write-Host "  Register: already exists (re-run)" }
# Dev shortcut: set is_email_verified directly (no email service in dev)
psql "UPDATE users SET is_email_verified=true WHERE email='t9test@example.com';" | Out-Null
Write-Host "  Email verified via DB update (dev shortcut)"

Write-Host "`n=== Login ==="
$loginBody = '{"email":"t9test@example.com","password":"TestPass123!"}'
$login = apiPost "/auth/login" $loginBody
$ACCESS = $login.data.accessToken
Write-Host "  Login OK, token acquired"

# Clean up any leftover application data from previous runs
$userId = docker exec outreach-postgres psql -U outreach -d outreach -t -A -c "SELECT id FROM users WHERE email='t9test@example.com';" 2>$null
if ($userId) {
    docker exec outreach-postgres psql -U outreach -d outreach -t -A -c "DELETE FROM applications WHERE user_id='$userId';" 2>$null | Out-Null
    Write-Host "  Cleaned up leftover test applications"
}

# ─── TEST 1: Canonicalization ───────────────────────────────────────────────────
Write-Host "`n=== TEST 1: Add 'Google India Pvt Ltd / Software Development Engineer' ==="
$b1 = '{"company":"Google India Pvt Ltd","role":"Software Development Engineer","appliedDate":"2026-06-20"}'
$app1 = apiPost "/applications" $b1 $ACCESS
$APP1_ID = $app1.data.application.id
Write-Host "  companyCanonical = '$($app1.data.application.companyCanonical)'"
Write-Host "  roleCanonical    = '$($app1.data.application.roleCanonical)'"
Write-Host "  App1 ID: $APP1_ID"

# ─── TEST 2: Dedup detection ────────────────────────────────────────────────────
Write-Host "`n=== TEST 2: 'Google / SDE' same-ish date → possibleDuplicate? ==="
$b2 = '{"company":"Google","role":"SDE","appliedDate":"2026-06-21"}'
$dup = apiPost "/applications" $b2 $ACCESS
Write-Host "  possibleDuplicate = $($dup.data.possibleDuplicate)"
if ($dup.data.possibleDuplicate) {
    Write-Host "  existingMatch.companyCanonical = $($dup.data.existingMatch.companyCanonical)"
    Write-Host "  PASS: dedup correctly flagged"
} else {
    Write-Host "  FAIL: expected possibleDuplicate=true"
}

# ─── TEST 3: Force-create ───────────────────────────────────────────────────────
Write-Host "`n=== TEST 3: Force-create (bypass dedup) ==="
$app2 = apiPost "/applications?force=true" $b2 $ACCESS
$APP2_ID = $app2.data.application.id
Write-Host "  Force-created ID: $APP2_ID"

# ─── TEST 4: Status transitions ─────────────────────────────────────────────────
Write-Host "`n=== TEST 4: Status transitions ==="
$st1 = apiPut "/applications/$APP1_ID/status" '{"status":"interview_scheduled","notes":"Recruiter called"}' $ACCESS
Write-Host "  → $($st1.data.currentStatus)"
Start-Sleep 1
$st2 = apiPut "/applications/$APP1_ID/status" '{"status":"offer_received","notes":"Offer extended"}' $ACCESS
Write-Host "  → $($st2.data.currentStatus)"

# ─── TEST 5: Append-only timeline ───────────────────────────────────────────────
Write-Host "`n=== TEST 5: Timeline is append-only (expect 3 entries) ==="
$tl = apiGet "/applications/$APP1_ID/timeline" $ACCESS
Write-Host "  Count = $($tl.data.Count) (expect 3)"
foreach ($e in $tl.data) {
    Write-Host "    [$($e.occurredAt.Substring(0,19))] $($e.status.PadRight(25)) notes='$($e.notes)'"
}

# ─── TEST 6: Block terminal→any ─────────────────────────────────────────────────
Write-Host "`n=== TEST 6: Block transition from terminal state ==="
# Advance APP1 to a terminal state first (offer_accepted)
$ta = apiPut "/applications/$APP1_ID/status" '{"status":"offer_accepted","notes":"Accepted!"}' $ACCESS
Write-Host "  → $($ta.data.currentStatus) (moved to terminal)"
# Now try to go back — must fail
$termResp = apiPut "/applications/$APP1_ID/status" '{"status":"applied","notes":"try back"}' $ACCESS
Write-Host "  success=$($termResp.success), error=$($termResp.error)"
if (-not $termResp.success) {
    Write-Host "  PASS: terminal-state transition correctly blocked (success=false)"
} else { Write-Host "  FAIL: expected success=false for terminal block" }

# ─── TEST 7: Follow-ups ─────────────────────────────────────────────────────────
Write-Host "`n=== TEST 7: Follow-ups (set next_action_due to past via API) ==="
# Use the update endpoint to set nextActionDue to a past date (app2 is status=applied)
$pastDate = "2026-06-20T00:00:00Z"
$updBody = "{`"nextActionDue`":`"$pastDate`"}"
apiPut "/applications/$APP2_ID" $updBody $ACCESS | Out-Null
$fu = apiGet "/applications/follow-ups" $ACCESS
Write-Host "  Follow-up count: $($fu.data.Count) (expect >= 1)"
foreach ($f in $fu.data) {
    Write-Host "    $($f.company) / $($f.role)"
}

# ─── TEST 8: Soft-delete ────────────────────────────────────────────────────────
Write-Host "`n=== TEST 8: Soft-delete APP2 ==="
$del = apiDelete "/applications/$APP2_ID" $ACCESS
Write-Host "  DELETE success=$($del.success)"
$list = apiGet "/applications" $ACCESS
Write-Host "  Apps visible after delete: $($list.data.Count)"
$dbRow = psql "SELECT deleted_at IS NOT NULL FROM applications WHERE id='$APP2_ID';"
$tlCount = psql "SELECT COUNT(*) FROM application_timeline WHERE application_id='$APP2_ID';"
Write-Host "  deleted_at IS NOT NULL in DB: $dbRow (expect t)"
Write-Host "  Timeline rows in DB: $tlCount (expect >= 1)"

# ─── TEST 9: Analytics ──────────────────────────────────────────────────────────
Write-Host "`n=== TEST 9: Analytics ==="
$ana = apiGet "/applications/analytics" $ACCESS
Write-Host "  total=$($ana.data.totalApplications) replyRate=$($ana.data.replyRatePct)% conversion=$($ana.data.conversionRatePct)%"
Write-Host "  stageCounts=$($ana.data.stageCounts | ConvertTo-Json -Compress)"

# ─── TEST 10: Outcome recording ─────────────────────────────────────────────────
Write-Host "`n=== TEST 10: Record outcome ==="
$out = apiPost "/applications/$APP1_ID/outcome" '{"outcome":"offer_got"}' $ACCESS
Write-Host "  success=$($out.success)"
$dbOut = psql "SELECT outcome,score_at_time FROM application_outcomes WHERE application_id='$APP1_ID';"
Write-Host "  DB outcome: $dbOut"

Write-Host "`n=== ALL TESTS COMPLETE ==="
