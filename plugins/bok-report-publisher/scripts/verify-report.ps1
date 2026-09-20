param([Parameter(Mandatory=$true)][string]$Repo,[ValidateSet("build","report","zip")][string]$Mode="build")
if(-not(Test-Path -LiteralPath (Join-Path $Repo "package.json"))){throw "package.json not found: $Repo"}
Push-Location -LiteralPath $Repo
try { if($Mode -eq "build"){npm run build}elseif($Mode -eq "report"){npm run build;if($LASTEXITCODE -eq 0){npm run build:report:single}}else{npm run build;if($LASTEXITCODE -eq 0){npm run build:report:zip}};if($LASTEXITCODE -ne 0){exit $LASTEXITCODE}}finally{Pop-Location}
