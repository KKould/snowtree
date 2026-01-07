#!/bin/bash
set -e

REPO="BohuTANG/snowtree"
APP_NAME="snowtree"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

info() { echo -e "${GREEN}[INFO]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() {
	echo -e "${RED}[ERROR]${NC} $1"
	exit 1
}

# Detect OS and architecture
detect_platform() {
	OS="$(uname -s)"
	ARCH="$(uname -m)"

	case "$OS" in
	Darwin)
		PLATFORM="macos"
		EXT="dmg"
		ARTIFACT_PATTERN="macOS-universal.dmg"
		;;
	Linux)
		PLATFORM="linux"
		if command -v dpkg &>/dev/null; then
			EXT="deb"
			ARTIFACT_PATTERN="linux-x64.deb"
		else
			EXT="AppImage"
			ARTIFACT_PATTERN="linux-x64.AppImage"
		fi
		;;
	*)
		error "Unsupported OS: $OS"
		;;
	esac

	info "Detected platform: $PLATFORM ($ARCH)"
}

# Get latest release version
get_latest_version() {
	info "Fetching latest release..."
	LATEST_RELEASE=$(curl -s "https://api.github.com/repos/$REPO/releases/latest")
	VERSION=$(echo "$LATEST_RELEASE" | grep '"tag_name":' | sed -E 's/.*"([^"]+)".*/\1/')

	if [ -z "$VERSION" ]; then
		error "Failed to get latest version. Check if releases exist at https://github.com/$REPO/releases"
	fi

	info "Latest version: $VERSION"
}

# Download and install
install() {
	DOWNLOAD_URL="https://github.com/$REPO/releases/download/$VERSION/${APP_NAME}-${VERSION#v}-${ARTIFACT_PATTERN}"
	TEMP_DIR=$(mktemp -d)
	DOWNLOAD_PATH="$TEMP_DIR/${APP_NAME}.${EXT}"

	info "Downloading from: $DOWNLOAD_URL"
	curl -L -o "$DOWNLOAD_PATH" "$DOWNLOAD_URL" || error "Download failed"

	case "$PLATFORM" in
	macos)
		info "Mounting DMG..."
		MOUNT_POINT=$(hdiutil attach "$DOWNLOAD_PATH" -nobrowse | tail -1 | awk '{print $3}')

		info "Installing to /Applications..."
		rm -rf "/Applications/${APP_NAME}.app" 2>/dev/null || true
		cp -R "$MOUNT_POINT/${APP_NAME}.app" /Applications/

		hdiutil detach "$MOUNT_POINT" -quiet
		info "Installed to /Applications/${APP_NAME}.app"
		;;
	linux)
		if [ "$EXT" = "deb" ]; then
			info "Installing .deb package..."
			sudo dpkg -i "$DOWNLOAD_PATH" || sudo apt-get install -f -y
		else
			info "Installing AppImage..."
			INSTALL_DIR="$HOME/.local/bin"
			mkdir -p "$INSTALL_DIR"
			mv "$DOWNLOAD_PATH" "$INSTALL_DIR/$APP_NAME"
			chmod +x "$INSTALL_DIR/$APP_NAME"
			info "Installed to $INSTALL_DIR/$APP_NAME"

			if [[ ":$PATH:" != *":$INSTALL_DIR:"* ]]; then
				warn "Add $INSTALL_DIR to your PATH: export PATH=\"\$PATH:$INSTALL_DIR\""
			fi
		fi
		;;
	esac

	rm -rf "$TEMP_DIR"
	echo ""
	info "Installation complete! Run '$APP_NAME' to start."
}

main() {
	echo ""
	echo "  ╔═══════════════════════════════════════╗"
	echo "  ║       Snowtree Installer              ║"
	echo "  ╚═══════════════════════════════════════╝"
	echo ""

	detect_platform
	get_latest_version
	install
}

main
