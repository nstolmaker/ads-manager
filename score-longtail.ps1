$json = Get-Content "C:\Users\THECLA~1\.openclaw\workspace\aironage\ads-manager\autocomplete-longtail.json" -Raw | ConvertFrom-Json

$intentPatterns = @(
  'for business','small business','enterprise','consulting','consultant','services','service',
  'accounting','bookkeeping','attorneys','lawyers','doctors','healthcare','construction','finance','financial advisors',
  'hr','developers','app development','workflow','automation'
)
$ignorePatterns = @(
  'free','course','courses','certification','specialization','dummies','pdf','book','coursera','by andrew ng',
  'download','chrome','extension','android','iphone','mac','windows','apple watch','desktop',
  'students','teachers','educators','college','homework','jobs','salary','reddit','youtube'
)

function Score([string]$s) {
  $t = $s.ToLower()
  foreach ($p in $ignorePatterns) { if ($t -match [regex]::Escape($p)) { return 'ignore' } }
  foreach ($p in $intentPatterns) { if ($t -match [regex]::Escape($p)) { return 'intent' } }
  if ($t -match 'for (everyone|beginners|all|humans|good)') { return 'ignore' }
  return 'maybe'
}

$out = @{}
foreach ($seed in @('ai','llm','chatgpt','claude')) {
  $arr = @($json.$seed)
  $tiers = [ordered]@{ intent=@(); maybe=@(); ignore=@() }
  foreach ($q in $arr) {
    $tier = Score $q
    $tiers[$tier] += $q
  }
  $out[$seed] = $tiers
}

# write markdown report
$lines = @('# Longtail Tiering (Heuristic)','')
foreach ($seed in @('ai','llm','chatgpt','claude')) {
  $tiers = $out[$seed]
  $lines += "## $seed"
  $lines += "- intent: $($tiers.intent.Count)"
  $lines += "- maybe: $($tiers.maybe.Count)"
  $lines += "- ignore: $($tiers.ignore.Count)"
  $lines += ''
  $lines += 'Top intent examples:'
  $tiers.intent | Select-Object -First 20 | ForEach-Object { $lines += "- $_" }
  $lines += ''
}
$report = "C:\Users\THECLA~1\.openclaw\workspace\aironage\ads-manager\autocomplete-longtail-tiered.md"
[IO.File]::WriteAllLines($report, $lines, [Text.UTF8Encoding]::new($false))

# console summary
foreach ($seed in @('ai','llm','chatgpt','claude')) {
  $tiers = $out[$seed]
  Write-Host "$seed :: intent=$($tiers.intent.Count) maybe=$($tiers.maybe.Count) ignore=$($tiers.ignore.Count)"
}
Write-Host "REPORT: $report"
