#!/usr/bin/env bash
set -euo pipefail

# ─────────────────────────────────────────────────
# Hearth — One-line installer
# curl -fsSL https://raw.githubusercontent.com/warrence/openclaw-hearth/main/install.sh | bash
# ─────────────────────────────────────────────────

HEARTH_REPO="https://github.com/warrence/openclaw-hearth.git"
HEARTH_DIR="${HEARTH_DIR:-$HOME/hearth}"
NODE_VERSION="22"
PG_VERSION="16"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

info()  { echo -e "  ${GREEN}✓${NC} $1"; }
warn()  { echo -e "  ${YELLOW}→${NC} $1"; }
fail()  { echo -e "  ${RED}✗${NC} $1"; exit 1; }
step()  { echo -e "\n${CYAN}${BOLD}$1${NC}"; }

# ─────────────────────────────────────────────────
# Detect OS
# ─────────────────────────────────────────────────
detect_os() {
  case "$(uname -s)" in
    Darwin) OS="macos" ;;
    Linux)
      if [ -f /etc/debian_version ] || grep -qi "ubuntu\|debian" /etc/os-release 2>/dev/null; then
        OS="debian"
      elif [ -f /etc/redhat-release ] || grep -qi "fedora\|rhel\|centos" /etc/os-release 2>/dev/null; then
        OS="redhat"
      else
        OS="linux"
      fi
      ;;
    *) fail "Unsupported OS: $(uname -s). Hearth supports macOS and Linux." ;;
  esac
}

# ─────────────────────────────────────────────────
# Check if a command exists
# ─────────────────────────────────────────────────
has() { command -v "$1" &>/dev/null; }

# ─────────────────────────────────────────────────
# Install Homebrew (macOS)
# ─────────────────────────────────────────────────
ensure_brew() {
  if [ "$OS" != "macos" ]; then return; fi
  if has brew; then
    info "Homebrew found"
    return
  fi
  warn "Installing Homebrew..."
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
  # Add to PATH for Apple Silicon
  if [ -f /opt/homebrew/bin/brew ]; then
    eval "$(/opt/homebrew/bin/brew shellenv)"
  fi
  info "Homebrew installed"
}

# ─────────────────────────────────────────────────
# Install git
# ─────────────────────────────────────────────────
ensure_git() {
  if has git; then
    info "git found ($(git --version | head -c 20))"
    return
  fi
  warn "Installing git..."
  case "$OS" in
    macos)  xcode-select --install 2>/dev/null || brew install git ;;
    debian) sudo apt-get update -qq && sudo apt-get install -yqq git ;;
    redhat) sudo dnf install -y git ;;
    *)      fail "Please install git manually" ;;
  esac
  has git || fail "git installation failed"
  info "git installed"
}

# ─────────────────────────────────────────────────
# Install Node.js via nvm
# ─────────────────────────────────────────────────
ensure_node() {
  if has node; then
    local ver
    ver=$(node -v | sed 's/v//' | cut -d. -f1)
    if [ "$ver" -ge "$NODE_VERSION" ]; then
      info "Node.js found ($(node -v))"
      return
    fi
    warn "Node.js $(node -v) is too old — need v${NODE_VERSION}+"
  fi

  # Install nvm if not present
  if [ -z "${NVM_DIR:-}" ] || [ ! -s "$NVM_DIR/nvm.sh" ]; then
    export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
    if [ ! -s "$NVM_DIR/nvm.sh" ]; then
      warn "Installing nvm..."
      curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
    fi
  fi

  export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
  # shellcheck disable=SC1091
  [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"

  warn "Installing Node.js ${NODE_VERSION}..."
  nvm install "$NODE_VERSION"
  nvm use "$NODE_VERSION"

  has node || fail "Node.js installation failed"
  info "Node.js $(node -v) installed"
}

# ─────────────────────────────────────────────────
# Install PostgreSQL
# ─────────────────────────────────────────────────
ensure_postgres() {
  # Check if postgres is running (not just installed)
  if has psql && (pg_isready -q 2>/dev/null || pg_isready 2>/dev/null | grep -q "accepting"); then
    info "PostgreSQL found and running"
    return
  fi

  if has psql; then
    warn "PostgreSQL installed but not running"
  else
    warn "PostgreSQL not found"
  fi

  echo ""
  echo "  PostgreSQL is required. How would you like to set it up?"
  echo ""
  echo "    1) Install locally (recommended)"
  echo "    2) Use Docker container"
  echo "    3) Skip — I'll set it up myself"
  echo ""
  read -rp "  Choose [1/2/3]: " pg_choice
  echo ""

  case "${pg_choice:-1}" in
    1) install_postgres_local ;;
    2) install_postgres_docker ;;
    3)
      warn "Skipping PostgreSQL — make sure it's running before you start Hearth"
      return
      ;;
    *) fail "Invalid choice" ;;
  esac
}

install_postgres_local() {
  case "$OS" in
    macos)
      ensure_brew
      warn "Installing PostgreSQL ${PG_VERSION}..."
      brew install "postgresql@${PG_VERSION}"
      brew services start "postgresql@${PG_VERSION}"
      sleep 2
      ;;
    debian)
      warn "Installing PostgreSQL..."
      sudo apt-get update -qq
      sudo apt-get install -yqq postgresql postgresql-contrib
      sudo systemctl enable postgresql
      sudo systemctl start postgresql
      sleep 2
      ;;
    redhat)
      warn "Installing PostgreSQL..."
      sudo dnf install -y postgresql-server postgresql-contrib
      sudo postgresql-setup --initdb 2>/dev/null || true
      sudo systemctl enable postgresql
      sudo systemctl start postgresql
      sleep 2
      ;;
    *)
      fail "Auto-install not supported for this OS. Please install PostgreSQL manually."
      ;;
  esac

  # Create hearth database and user
  create_hearth_database
  info "PostgreSQL installed and running"
}

install_postgres_docker() {
  if ! has docker; then
    fail "Docker not found. Install Docker first: https://docs.docker.com/get-docker/"
  fi

  warn "Starting PostgreSQL in Docker..."
  docker run -d --name hearth-db \
    -e POSTGRES_DB=hearth \
    -e POSTGRES_USER=hearth \
    -e POSTGRES_PASSWORD=hearth \
    -p 5432:5432 \
    --restart unless-stopped \
    "postgres:${PG_VERSION}-alpine" || {
      # Container might already exist
      docker start hearth-db 2>/dev/null || fail "Failed to start PostgreSQL container"
    }
  sleep 3

  if docker exec hearth-db pg_isready -U hearth -d hearth &>/dev/null; then
    info "PostgreSQL running in Docker (port 5432)"
  else
    fail "PostgreSQL container failed to start"
  fi
}

create_hearth_database() {
  # Try to create user and database (may fail if they exist — that's OK)
  if [ "$OS" = "macos" ]; then
    createuser hearth 2>/dev/null || true
    createdb -O hearth hearth 2>/dev/null || true
    psql -d hearth -c "ALTER USER hearth WITH PASSWORD 'hearth';" 2>/dev/null || true
  else
    sudo -u postgres createuser hearth 2>/dev/null || true
    sudo -u postgres createdb -O hearth hearth 2>/dev/null || true
    sudo -u postgres psql -c "ALTER USER hearth WITH PASSWORD 'hearth';" 2>/dev/null || true
  fi
  info "Database 'hearth' ready"
}

# ─────────────────────────────────────────────────
# Clone repo
# ─────────────────────────────────────────────────
clone_repo() {
  if [ -d "$HEARTH_DIR/.git" ]; then
    info "Hearth already cloned at $HEARTH_DIR"
    cd "$HEARTH_DIR"
    git pull --ff-only 2>/dev/null || true
    return
  fi

  if [ -d "$HEARTH_DIR" ] && [ "$(ls -A "$HEARTH_DIR" 2>/dev/null)" ]; then
    fail "$HEARTH_DIR already exists and is not empty. Remove it or set HEARTH_DIR to a different path."
  fi

  warn "Cloning Hearth to $HEARTH_DIR..."
  git clone "$HEARTH_REPO" "$HEARTH_DIR"
  cd "$HEARTH_DIR"
  info "Cloned to $HEARTH_DIR"
}

# ─────────────────────────────────────────────────
# Run setup wizard
# ─────────────────────────────────────────────────
run_setup() {
  cd "$HEARTH_DIR"

  # Install CLI dependencies first
  warn "Installing Hearth CLI..."
  cd packages/hearth-cli && npm install --silent 2>/dev/null && npm run build --silent 2>/dev/null && cd ../..

  # Run the interactive setup wizard
  npx hearth setup
}

# ─────────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────────
main() {
  echo ""
  echo -e "${BOLD}🏠  Hearth Installer${NC}"
  echo "─────────────────────────────────────────"
  echo ""

  detect_os
  info "Detected OS: $OS"

  step "Step 1: Prerequisites"
  ensure_git
  ensure_node
  ensure_postgres

  step "Step 2: Clone"
  clone_repo

  step "Step 3: Setup"
  run_setup

  echo ""
  echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${GREEN}${BOLD}✅  Hearth is installed!${NC}"
  echo ""
  echo -e "  Start:   ${CYAN}cd $HEARTH_DIR && npx hearth start${NC}"
  echo -e "  Open:    ${CYAN}http://localhost:9100${NC}"
  echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""
}

main "$@"
