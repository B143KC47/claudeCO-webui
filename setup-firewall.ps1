# Windows Firewall Configuration for Claude Code Web UI
# Run this script as Administrator in PowerShell

Write-Host "Configuring Windows Firewall for Claude Code Web UI..." -ForegroundColor Cyan

# Check if running as Administrator
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host "ERROR: This script must be run as Administrator!" -ForegroundColor Red
    Write-Host "Right-click PowerShell and select 'Run as Administrator', then run this script again." -ForegroundColor Yellow
    exit 1
}

# Get WSL IP address
Write-Host "`nDetecting WSL IP address..." -ForegroundColor Yellow
$wslIP = bash -c "ip addr show eth0 | grep 'inet ' | awk '{print `$2}' | cut -d/ -f1"

if ([string]::IsNullOrWhiteSpace($wslIP)) {
    Write-Host "ERROR: Could not detect WSL IP address!" -ForegroundColor Red
    exit 1
}

Write-Host "WSL IP detected: $wslIP" -ForegroundColor Green

# Backend port
$backendPort = 8080
$frontendPort = 3000

# Remove existing rules if they exist
Write-Host "`nRemoving existing firewall rules..." -ForegroundColor Yellow
Remove-NetFirewallRule -DisplayName "Claude Web UI - Backend (WSL)" -ErrorAction SilentlyContinue
Remove-NetFirewallRule -DisplayName "Claude Web UI - Frontend (WSL)" -ErrorAction SilentlyContinue

# Add new inbound rules
Write-Host "Creating firewall rule for backend (port $backendPort)..." -ForegroundColor Yellow
New-NetFirewallRule -DisplayName "Claude Web UI - Backend (WSL)" `
    -Direction Inbound `
    -Protocol TCP `
    -LocalPort $backendPort `
    -Action Allow `
    -Profile Private,Domain `
    -Description "Allow access to Claude Code Web UI backend API from local network"

Write-Host "Creating firewall rule for frontend (port $frontendPort)..." -ForegroundColor Yellow
New-NetFirewallRule -DisplayName "Claude Web UI - Frontend (WSL)" `
    -Direction Inbound `
    -Protocol TCP `
    -LocalPort $frontendPort `
    -Action Allow `
    -Profile Private,Domain `
    -Description "Allow access to Claude Code Web UI frontend from local network"

# Configure WSL port forwarding
Write-Host "`nConfiguring WSL port forwarding..." -ForegroundColor Yellow

# Get Windows IP on the same network as phone
$windowsIP = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object {
    $_.InterfaceAlias -notlike "*Loopback*" -and
    $_.InterfaceAlias -notlike "*Bluetooth*" -and
    $_.IPAddress -like "192.168.*" -or $_.IPAddress -like "10.*"
} | Select-Object -First 1).IPAddress

if ([string]::IsNullOrWhiteSpace($windowsIP)) {
    Write-Host "WARNING: Could not detect Windows IP address on local network!" -ForegroundColor Yellow
    Write-Host "You may need to manually configure port forwarding." -ForegroundColor Yellow
} else {
    Write-Host "Windows IP detected: $windowsIP" -ForegroundColor Green

    # Remove existing port forwarding rules
    netsh interface portproxy delete v4tov4 listenport=$backendPort listenaddress=0.0.0.0 | Out-Null
    netsh interface portproxy delete v4tov4 listenport=$frontendPort listenaddress=0.0.0.0 | Out-Null

    # Add port forwarding rules
    Write-Host "Adding port forwarding: Windows:$backendPort -> WSL:$backendPort" -ForegroundColor Yellow
    netsh interface portproxy add v4tov4 listenport=$backendPort listenaddress=0.0.0.0 connectport=$backendPort connectaddress=$wslIP

    Write-Host "Adding port forwarding: Windows:$frontendPort -> WSL:$frontendPort" -ForegroundColor Yellow
    netsh interface portproxy add v4tov4 listenport=$frontendPort listenaddress=0.0.0.0 connectport=$frontendPort connectaddress=$wslIP
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "Configuration Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan

Write-Host "`nConnection URLs for your phone:" -ForegroundColor Yellow
if (-not [string]::IsNullOrWhiteSpace($windowsIP)) {
    Write-Host "  Frontend: http://$windowsIP`:$frontendPort" -ForegroundColor White
    Write-Host "  Backend:  http://$windowsIP`:$backendPort" -ForegroundColor White
}
Write-Host "`nAlternative (WSL direct):" -ForegroundColor Yellow
Write-Host "  Frontend: http://$wslIP`:$frontendPort" -ForegroundColor White
Write-Host "  Backend:  http://$wslIP`:$backendPort" -ForegroundColor White

Write-Host "`nNext Steps:" -ForegroundColor Cyan
Write-Host "1. Restart your backend server: cd backend && deno task dev" -ForegroundColor White
Write-Host "2. On your phone, navigate to the frontend URL above" -ForegroundColor White
Write-Host "3. If still not working, check Windows Defender Firewall settings" -ForegroundColor White

Write-Host "`nTo view current port forwarding rules:" -ForegroundColor Yellow
Write-Host "  netsh interface portproxy show v4tov4" -ForegroundColor Gray

Write-Host "`nTo remove these rules later:" -ForegroundColor Yellow
Write-Host "  Remove-NetFirewallRule -DisplayName 'Claude Web UI*'" -ForegroundColor Gray
Write-Host "  netsh interface portproxy delete v4tov4 listenport=$backendPort" -ForegroundColor Gray
Write-Host "  netsh interface portproxy delete v4tov4 listenport=$frontendPort" -ForegroundColor Gray
