#!/usr/bin/env bash
# ============================================================================
# build-ipa.sh —— 在 macOS 上把「太空打飞机」iOS 工程打成 .ipa
#
# 用法：
#   bash build-ipa.sh                     # 打「未签名」ipa：给 Sideloadly / AltStore 自签安装
#   DEVELOPMENT_TEAM=ABCDE12345 bash build-ipa.sh --sign   # 用你自己的 Apple 账号签名
#
# 产物：ios/build/太空打飞机.ipa
# ============================================================================
set -euo pipefail
cd "$(dirname "$0")"

PROJECT="SpaceShooter.xcodeproj"
TARGET="SpaceShooter"
CONFIG="Release"
BUILD_DIR="build"
OUT_IPA="${BUILD_DIR}/太空打飞机.ipa"

SIGN=0
[ "${1:-}" = "--sign" ] && SIGN=1

echo "==> 1/5 检查环境"
if ! command -v xcodebuild >/dev/null 2>&1; then
  echo "!! 未找到 xcodebuild —— 本脚本必须在 macOS + Xcode 上运行。"
  echo "   没有 Mac？可以用仓库里的 GitHub Actions 工作流自动出包（见 README-iOS.md）。"
  exit 1
fi
xcodebuild -version | head -n 2

if command -v xcodegen >/dev/null 2>&1; then
  echo "==> 检测到 xcodegen，按 project.yml 重新生成工程（保持与配置一致）"
  xcodegen generate >/dev/null
fi

echo "==> 2/5 构建（${CONFIG}）"
rm -rf "${BUILD_DIR}"
if [ "${SIGN}" = "1" ]; then
  : "${DEVELOPMENT_TEAM:?请设置 DEVELOPMENT_TEAM=你的团队ID（Apple Developer 后台可查）}"
  SIGN_ARGS=(CODE_SIGN_STYLE=Automatic DEVELOPMENT_TEAM="${DEVELOPMENT_TEAM}" -allowProvisioningUpdates)
  echo "    使用 ${DEVELOPMENT_TEAM} 自动签名（需要已登录 Xcode 的 Apple 账号；"
  echo "    免费账号只能装到已在账号里注册过的设备，有效期 7 天）"
else
  SIGN_ARGS=(CODE_SIGNING_ALLOWED=NO CODE_SIGNING_REQUIRED=NO CODE_SIGN_IDENTITY="")
  echo "    生成未签名包（随后用 Sideloadly / AltStore 自签即可装到 iPhone）"
fi

xcodebuild \
  -project "${PROJECT}" \
  -target "${TARGET}" \
  -configuration "${CONFIG}" \
  -sdk iphoneos \
  SYMROOT="${BUILD_DIR}" \
  IPHONEOS_DEPLOYMENT_TARGET=13.0 \
  "${SIGN_ARGS[@]}" \
  build

APP_PATH="${BUILD_DIR}/${CONFIG}-iphoneos/${TARGET}.app"
if [ ! -d "${APP_PATH}" ]; then
  echo "!! 构建失败：找不到 ${APP_PATH}"
  exit 1
fi

echo "==> 3/5 组装 Payload"
rm -rf "${BUILD_DIR}/Payload"
mkdir -p "${BUILD_DIR}/Payload"
cp -R "${APP_PATH}" "${BUILD_DIR}/Payload/"

echo "==> 4/5 压缩成 .ipa"
rm -f "${OUT_IPA}"
( cd "${BUILD_DIR}" && zip -qry "$(basename "${OUT_IPA}")" Payload )

echo "==> 5/5 完成"
ls -lh "${OUT_IPA}"
echo
echo "下一步："
echo "  · 未签名 ipa → 用 Sideloadly / AltStore 自签安装（免费 Apple ID 即可）"
echo "  · 已签名 ipa → 直接发给设备已注册的朋友，用「文件」App / Xcode 安装"
