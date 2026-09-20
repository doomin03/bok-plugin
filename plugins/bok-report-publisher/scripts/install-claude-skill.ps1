param([Parameter(Mandatory=$true)][string]$Project)
& (Join-Path $PSScriptRoot 'install-project-skills.ps1') -Project $Project -Agent Claude
