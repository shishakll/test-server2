#!/bin/bash

# External Tool Dependencies Setup Script
# This script downloads and configures all required security tools

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TOOLS_DIR="${SCRIPT_DIR}/../tools"
BIN_DIR="${TOOLS_DIR}/bin"
CONFIG_DIR="${TOOLS_DIR}/config"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Create directories
create_dirs() {
    log_info "Creating tool directories..."
    mkdir -p "${BIN_DIR}"
    mkdir -p "${CONFIG_DIR}"
    mkdir -p "${TOOLS_DIR}/nuclei-templates"
    mkdir -p "${TOOLS_DIR}/zap"
}

# Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Download tool if not exists
download_tool() {
    local name="$1"
    local url="$2"
    local dest="$3"
    local expected_hash="$4"

    if [ -f "${dest}" ]; then
        log_info "${name} already exists at ${dest}"
        return 0
    fi

    log_info "Downloading ${name}..."
    curl -fsSL -o "${dest}" "${url}"

    if [ -n "${expected_hash}" ]; then
        local actual_hash=$(sha256sum "${dest}" | cut -d' ' -f1)
        if [ "${actual_hash}" != "${expected_hash}" ]; then
            log_error "Hash mismatch for ${name}"
            rm -f "${dest}"
            return 1
        fi
    fi

    chmod +x "${dest}"
    log_info "Downloaded ${name} to ${dest}"
}

# Install ZAP (OWASP ZAP)
install_zap() {
    log_info "Setting up OWASP ZAP..."

    if command_exists zap.sh; then
        log_info "ZAP is already installed via system"
        return 0
    fi

    # Check for Docker
    if command_exists docker; then
        log_info "Docker found. ZAP will run via Docker container."
        return 0
    fi

    # Download ZAP if Docker not available
    local zap_version="2.15.0"
    local zap_url="https://github.com/zaproxy/zaproxy/releases/download/v${zap_version}/ZAP_${zap_version}_Linux.tar.gz"
    local zap_archive="${BIN_DIR}/zap.tar.gz"

    if [ ! -d "${TOOLS_DIR}/zap" ]; then
        download_tool "ZAP" "${zap_url}" "${zap_archive}" ""
        tar -xzf "${zap_archive}" -C "${TOOLS_DIR}"
        rm "${zap_archive}"
    fi

    log_info "ZAP installed at ${TOOLS_DIR}/zap"
}

# Install Nuclei
install_nuclei() {
    log_info "Setting up Nuclei..."

    if command_exists nuclei; then
        log_info "Nuclei is already installed via system"
        return 0
    fi

    local nuclei_version="v3.3.0"
    local nuclei_url="https://github.com/projectdiscovery/nuclei/releases/download/${nuclei_version}/nuclei-linux-amd64.zip"
    local nuclei_zip="${BIN_DIR}/nuclei.zip"

    download_tool "Nuclei" "${nuclei_url}" "${nuclei_zip}" ""
    unzip -o "${nuclei_zip}" -d "${BIN_DIR}"
    rm "${nuclei_zip}"

    log_info "Nuclei installed at ${BIN_DIR}/nuclei"
}

# Install Nuclei Templates
install_nuclei_templates() {
    log_info "Setting up Nuclei Templates..."

    # Try using nuclei-update-templates first
    if [ -f "${BIN_DIR}/nuclei" ]; then
        "${BIN_DIR}/nuclei" -update-templates -ut "${TOOLS_DIR}/nuclei-templates" 2>/dev/null && {
            log_info "Nuclei templates installed via nuclei command"
            return 0
        }
    fi

    # Fallback: Download templates manually
    local templates_url="https://github.com/projectdiscovery/nuclei-templates/releases/download/latest/templates.zip"
    local templates_zip="${TOOLS_DIR}/templates.zip"

    if [ ! -d "${TOOLS_DIR}/nuclei-templates/.git" ]; then
        download_tool "Nuclei Templates" "${templates_url}" "${templates_zip}" ""

        # Backup existing custom templates if any
        if [ -d "${TOOLS_DIR}/nuclei-templates" ]; then
            mv "${TOOLS_DIR}/nuclei-templates" "${TOOLS_DIR}/nuclei-templates-backup" 2>/dev/null || true
        fi

        unzip -o "${templates_zip}" -d "${TOOLS_DIR}/nuclei-templates"
        rm "${templates_zip}"

        # Restore custom templates
        if [ -d "${TOOLS_DIR}/nuclei-templates-backup" ]; then
            cp -r "${TOOLS_DIR}/nuclei-templates-backup"/* "${TOOLS_DIR}/nuclei-templates/" 2>/dev/null || true
            rm -rf "${TOOLS_DIR}/nuclei-templates-backup"
        fi
    fi

    log_info "Nuclei templates installed at ${TOOLS_DIR}/nuclei-templates"
}

# Install Subfinder
install_subfinder() {
    log_info "Setting up Subfinder..."

    if command_exists subfinder; then
        log_info "Subfinder is already installed via system"
        return 0
    fi

    local subfinder_version="v2.7.0"
    local subfinder_url="https://github.com/projectdiscovery/subfinder/releases/download/${subfinder_version}/subfinder-linux-amd64.zip"
    local subfinder_zip="${BIN_DIR}/subfinder.zip"

    download_tool "Subfinder" "${subfinder_url}" "${subfinder_zip}" ""
    unzip -o "${subfinder_zip}" -d "${BIN_DIR}"
    rm "${subfinder_zip}"

    log_info "Subfinder installed at ${BIN_DIR}/subfinder"
}

# Install Amass
install_amass() {
    log_info "Setting up Amass..."

    if command_exists amass; then
        log_info "Amass is already installed via system"
        return 0
    fi

    local amass_version="v3.25.0"
    local amass_url="https://github.com/owasp-amass/amass/releases/download/${amass_version}/amass_linux_amd64.zip"
    local amass_zip="${BIN_DIR}/amass.zip"

    download_tool "Amass" "${amass_url}" "${amass_zip}" ""
    unzip -o "${amass_zip}" -d "${BIN_DIR}"
    rm "${amass_zip}"

    log_info "Amass installed at ${BIN_DIR}/amass"
}

# Install Trivy
install_trivy() {
    log_info "Setting up Trivy..."

    if command_exists trivy; then
        log_info "Trivy is already installed via system"
        return 0
    fi

    local trivy_version="v0.53.0"
    local trivy_url="https://github.com/aquasecurity/trivy/releases/download/${trivy_version}/trivy_${trivy_version}_Linux-64bit.tar.gz"
    local trivy_archive="${BIN_DIR}/trivy.tar.gz"

    download_tool "Trivy" "${trivy_url}" "${trivy_archive}" ""
    tar -xzf "${trivy_archive}" -C "${BIN_DIR}"
    rm "${trivy_archive}"

    log_info "Trivy installed at ${BIN_DIR}/trivy"
}

# Install Nmap
install_nmap() {
    log_info "Setting up Nmap..."

    if command_exists nmap; then
        log_info "Nmap is already installed via system"
        return 0
    fi

    log_warn "Nmap not found. Please install Nmap manually:"
    log_warn "  Ubuntu/Debian: sudo apt-get install nmap"
    log_warn "  macOS: brew install nmap"
}

# Create wrapper scripts
create_wrappers() {
    log_info "Creating wrapper scripts..."

    # ZAP wrapper
    cat > "${BIN_DIR}/zap.sh" << 'WRAPPER'
#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TOOLS_DIR="$(dirname "${SCRIPT_DIR}")"

if command -v zap.sh &>/dev/null; then
    exec zap.sh "$@"
elif [ -d "${TOOLS_DIR}/zap" ]; then
    exec java -jar "${TOOLS_DIR}/zap/zap.jar" "$@"
else
    echo "ZAP not found. Please install ZAP or use Docker."
    exit 1
fi
WRAPPER
    chmod +x "${BIN_DIR}/zap.sh"

    log_info "Wrapper scripts created"
}

# Create config file
create_config() {
    log_info "Creating configuration file..."

    cat > "${CONFIG_DIR}/tools.json" << 'CONFIG'
{
  "version": "1.0.0",
  "tools": {
    "zap": {
      "name": "OWASP ZAP",
      "version": "2.15.0",
      "description": "Dynamic Application Security Testing tool",
      "installMethod": "docker_or_manual",
      "defaultPort": 8080,
      "apiPort": 8080
    },
    "nuclei": {
      "name": "Nuclei",
      "version": "3.3.0",
      "description": "Template-based vulnerability scanner",
      "templatePath": "../tools/nuclei-templates",
      "defaultRateLimit": 150,
      "defaultConcurrency": 25
    },
    "subfinder": {
      "name": "Subfinder",
      "version": "2.7.0",
      "description": "Passive subdomain enumeration tool"
    },
    "amass": {
      "name": "Amass",
      "version": "3.25.0",
      "description": "Comprehensive subdomain enumeration"
    },
    "trivy": {
      "name": "Trivy",
      "version": "0.53.0",
      "description": "Container and filesystem vulnerability scanner"
    },
    "nmap": {
      "name": "Nmap",
      "description": "Network exploration and security auditing"
    }
  }
}
CONFIG

    log_info "Configuration file created at ${CONFIG_DIR}/tools.json"
}

# Verify installation
verify_installation() {
    log_info "Verifying installation..."

    local all_ok=true

    # Check ZAP
    if command -v zap.sh &>/dev/null || [ -d "${TOOLS_DIR}/zap" ] || command -v docker &>/dev/null; then
        log_info "  ZAP: OK"
    else
        log_warn "  ZAP: Not found (will use Docker if available)"
    fi

    # Check Nuclei
    if [ -f "${BIN_DIR}/nuclei" ] || command -v nuclei &>/dev/null; then
        log_info "  Nuclei: OK"
    else
        log_warn "  Nuclei: Not found"
        all_ok=false
    fi

    # Check Nuclei Templates
    if [ -d "${TOOLS_DIR}/nuclei-templates" ]; then
        log_info "  Nuclei Templates: OK"
    else
        log_warn "  Nuclei Templates: Not found"
    fi

    # Check Subfinder
    if [ -f "${BIN_DIR}/subfinder" ] || command -v subfinder &>/dev/null; then
        log_info "  Subfinder: OK"
    else
        log_warn "  Subfinder: Not found"
    fi

    # Check Trivy
    if [ -f "${BIN_DIR}/trivy" ] || command -v trivy &>/dev/null; then
        log_info "  Trivy: OK"
    else
        log_warn "  Trivy: Not found"
    fi

    if [ "$all_ok" = true ]; then
        log_info "All core tools are installed!"
    else
        log_warn "Some tools are missing. Run this script again after installing dependencies."
    fi
}

# Main
main() {
    log_info "Starting tool dependencies setup..."
    log_info "Tools directory: ${TOOLS_DIR}"

    create_dirs
    create_config
    install_nuclei
    install_nuclei_templates
    install_subfinder
    install_amass
    install_trivy
    install_nmap
    install_zap
    create_wrappers
    verify_installation

    log_info "Setup complete!"
    log_info "Add ${BIN_DIR} to your PATH if needed"
}

main "$@"
