#!/bin/bash
# 一键打包：构建 + 压缩成 homeland-defense.zip
# 用法： bash pack.sh
set -e

echo "==> 1/3 安装依赖"
npm install

echo "==> 2/3 构建"
npm run build

echo "==> 3/3 打包"
rm -f homeland-defense.zip
cd dist
# -r 递归，把 dist 里的内容（不含 dist 目录本身）压进去
zip -r ../homeland-defense.zip . -x ".DS_Store"
cd ..

echo ""
echo "完成！生成了 homeland-defense.zip"
echo "解压后是 index.html / _headers / _redirects，可直接上传到 Cloudflare Pages。"
