<#
  把 GitHub Actions 上「最新一次成功构建」的 .ipa 下载到本目录（在 Windows 上运行）。

  用法：
      powershell -ExecutionPolicy Bypass -File .\fetch-ipa.ps1 -Token ghp_你的令牌

  令牌怎么来（约 1 分钟，用完可立刻删除）：
      1. 打开 https://github.com/settings/tokens -> Generate new token (classic)
      2. 勾选 repo 权限，Expiration 选 7 days，生成后复制 ghp_ 开头的那串
      3. 下载完回页面 Delete 掉即可

  说明：构建产物（Artifacts）在 GitHub 上必须登录才能下载，这是平台限制；
       不想用脚本，也可以在 Actions 页面点 Artifacts 手动下载。
#>
param(
  [Parameter(Mandatory = $true)][string]$Token,
  [string]$Owner  = 'chenzqi',
  [string]$Repo   = 'game402',
  [string]$OutDir = $PSScriptRoot
)

$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$OutDir = (Resolve-Path -LiteralPath $OutDir).Path

$apiBase = "https://api.github.com/repos/$Owner/$Repo"
$headers = @{
  Accept                 = 'application/vnd.github+json'
  'User-Agent'           = 'fetch-ipa'
  'X-GitHub-Api-Version' = '2022-11-28'
}
$headers['Authorization'] = 'Bearer ' + $Token
Write-Host '[1/5] 查询最新构建 ...' -ForegroundColor Cyan
$runs = Invoke-RestMethod -Headers $headers -Uri "$apiBase/actions/runs?per_page=30&status=completed"
$run  = $runs.workflow_runs | Where-Object { $_.conclusion -eq 'success' -and $_.name -match 'ipa' } | Select-Object -First 1
if (-not $run) { throw "没找到成功的构建，先去 https://github.com/$Owner/$Repo/actions 看失败原因" }
Write-Host ("      run #{0}  {1}  {2}" -f $run.run_number, $run.display_title, $run.created_at)

Write-Host '[2/5] 查询产物 ...' -ForegroundColor Cyan
$arts = Invoke-RestMethod -Headers $headers -Uri "$apiBase/actions/runs/$($run.id)/artifacts"
$art  = $arts.artifacts | Where-Object { $_.name -eq 'SpaceShooter-ipa' } | Select-Object -First 1
if (-not $art) { throw '这次构建没有 .ipa 产物（构建失败或产物已过期）' }
Write-Host ("      {0}  {1:N1} MB" -f $art.name, ($art.size_in_bytes / 1MB))
Write-Host '[3/5] 下载 ...' -ForegroundColor Cyan
$work = Join-Path $OutDir '.ipa-tmp'
$zip  = Join-Path $work 'artifact.zip'
if (Test-Path -LiteralPath $work) {
  $resolved = (Resolve-Path -LiteralPath $work).Path
  if ($resolved.StartsWith($OutDir, [StringComparison]::OrdinalIgnoreCase)) {
    Remove-Item -LiteralPath $resolved -Recurse -Force
  }
}
New-Item -ItemType Directory -Path $work -Force | Out-Null

$hdr = 'Authorization: Bearer ' + $Token
$url = "$apiBase/actions/artifacts/$($art.id)/zip"
& curl.exe -sS -L -H $hdr -H 'Accept: application/vnd.github+json' -o $zip $url
if (-not (Test-Path -LiteralPath $zip)) { throw '下载失败' }
$magic = [System.Text.Encoding]::ASCII.GetString([System.IO.File]::ReadAllBytes($zip)[0..1])
if ($magic -ne 'PK') { throw '下载到的不是压缩包：令牌可能没有 repo 权限或已过期' }
Write-Host '[4/5] 解压 ...' -ForegroundColor Cyan
$ex = Join-Path $work 'x'
Expand-Archive -LiteralPath $zip -DestinationPath $ex -Force
$ipa = Get-ChildItem -LiteralPath $ex -Recurse -Filter *.ipa | Select-Object -First 1
if (-not $ipa) { throw '压缩包里没有 .ipa' }

Write-Host '[5/5] 放到项目目录 ...' -ForegroundColor Cyan
$dest = Join-Path $OutDir 'SpaceShooter-unsigned.ipa'
Copy-Item -LiteralPath $ipa.FullName -Destination $dest -Force
Write-Host ("完成：{0}  ({1:N1} MB)" -f $dest, ((Get-Item -LiteralPath $dest).Length / 1MB)) -ForegroundColor Green
Write-Host '临时目录 .ipa-tmp 可以手动删掉'
Write-Host '下一步：把这个 .ipa 拖进 Sideloadly，填 Apple ID，点 Start，即可装到 iPhone。'