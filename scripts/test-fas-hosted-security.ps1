# Explicitly authorized synthetic fixtures in the named FAS development project.
# No arbitrary project, URL, key arguments, production target or secret output.
$ErrorActionPreference = 'Stop'
$fasTestExit = 1
Push-Location (Join-Path $PSScriptRoot '..')
try {
  $fasDevKeys = npx.cmd --yes supabase@2.120.0 projects api-keys --project-ref oqmmvjjycpyxvxipcyli --output json | ConvertFrom-Json
  if ($LASTEXITCODE -ne 0) { throw 'Development key lookup failed' }
  $fasClientKey = $fasDevKeys | Where-Object { $_.type -eq 'publishable' -and -not $_.disabled } | Select-Object -First 1
  if (-not $fasClientKey) { $fasClientKey = $fasDevKeys | Where-Object { $_.name -eq 'anon' -and -not $_.disabled } | Select-Object -First 1 }
  $fasFixtureKey = $fasDevKeys | Where-Object { $_.name -eq 'service_role' -and $_.type -eq 'legacy' -and -not $_.disabled } | Select-Object -First 1
  if (-not $fasClientKey.api_key -or -not $fasFixtureKey.api_key) { throw 'Expected development client and fixture keys' }
  $env:FAS_TEST_ANON_KEY = $fasClientKey.api_key
  $env:FAS_TEST_SERVICE_KEY = $fasFixtureKey.api_key
  $env:FAS_TEST_CONFIRM = 'fas-community-dev:oqmmvjjycpyxvxipcyli'
  node scripts/test-fas-security-api.mjs --hosted-dev
  $fasTestExit = $LASTEXITCODE
} finally {
  Remove-Item Env:FAS_TEST_ANON_KEY,Env:FAS_TEST_SERVICE_KEY,Env:FAS_TEST_CONFIRM -ErrorAction SilentlyContinue
  Remove-Variable fasDevKeys,fasClientKey,fasFixtureKey -ErrorAction SilentlyContinue
  Pop-Location
}
exit $fasTestExit
