param(
 [Parameter(Mandatory=$true)][string]$Repo,
 [Parameter(Mandatory=$true)][string]$Change,
 [Parameter(Mandatory=$true)][string]$SourceImage
)
$ErrorActionPreference='Stop'
if($Change -notmatch '^[a-z0-9][a-z0-9-]*$'){throw 'Invalid OpenSpec change ID'}
$repoRoot=(Resolve-Path -LiteralPath $Repo).Path
$evidenceRoot=Join-Path $repoRoot "openspec/changes/$Change/evidence/source-images"
# Reject junctions/symlinks in every existing destination ancestor.
$cursor=$evidenceRoot
while($cursor -and $cursor -ne $repoRoot){
 if(Test-Path -LiteralPath $cursor){
  if((Get-Item -LiteralPath $cursor -Force).Attributes -band [IO.FileAttributes]::ReparsePoint){throw 'Evidence path contains a reparse point'}
 }
 $cursor=Split-Path -Parent $cursor
}
if($cursor -ne $repoRoot){throw 'Evidence path escaped repository'}
$sourcePath=(Resolve-Path -LiteralPath $SourceImage).Path
$extension=[IO.Path]::GetExtension($sourcePath)
if($extension -notmatch '^\.(wmf|emf|png|jpg|jpeg|gif|bmp|tif|tiff)$'){throw 'Unsupported comparison image'}
Add-Type -AssemblyName System.Drawing
New-Item -ItemType Directory -Force -Path $evidenceRoot | Out-Null
$dest=Join-Path $evidenceRoot ([IO.Path]::GetFileNameWithoutExtension($sourcePath)+'.png')
if(Test-Path -LiteralPath $dest){throw 'Comparison already exists; preserve it or select a new review change'}
$image=[System.Drawing.Image]::FromFile($sourcePath)
try{
 $width=if($extension -match '^\.(wmf|emf)$'){1600}else{$image.Width}
 $height=[Math]::Max(1,[int]($width*$image.Height/$image.Width))
 $bitmap=New-Object System.Drawing.Bitmap $width,$height
 try{
  $graphics=[System.Drawing.Graphics]::FromImage($bitmap)
  try{$graphics.Clear([System.Drawing.Color]::White);$graphics.DrawImage($image,0,0,$width,$height);$bitmap.Save($dest,[System.Drawing.Imaging.ImageFormat]::Png)}
  finally{$graphics.Dispose()}
 }finally{$bitmap.Dispose()}
}finally{$image.Dispose()}
Write-Output $dest
