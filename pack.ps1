# 一键打包：构建 + 压缩成 homeland-defense.zip
# 用法（在项目根目录打开 PowerShell）： powershell -ExecutionPolicy Bypass -File pack.ps1
$ErrorActionPreference = "Stop"

Write-Host "==> 1/3 安装依赖"
npm install

Write-Host "==> 2/3 构建"
npm run build

Write-Host "==> 3/3 打包"
if (Test-Path homeland-defense.zip) { Remove-Item homeland-defense.zip }
# 注意 dist\* ：压缩的是 dist 里的内容，不含 dist 目录本身
Compress-Archive -Path dist\* -DestinationPath homeland-defense.zip

Write-Host ""
Write-Host "完成！生成了 homeland-defense.zip"
Write-Host "解压后是 index.html / _headers / _redirects，可直接上传到 Cloudflare Pages。"
