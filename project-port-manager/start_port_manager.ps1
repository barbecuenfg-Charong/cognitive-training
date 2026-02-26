# Set encoding to UTF-8 for output
$OutputEncoding = [System.Text.Encoding]::UTF8

$PROJECT_ROOT = $PSScriptRoot

Write-Host "=== Project Port Manager Startup Script ===" -ForegroundColor Cyan
Write-Host "Initializing environment..." -ForegroundColor Gray

# 1. Clean up port 5555
function Kill-PortProcess {
    param([int]$port)
    $connections = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
    
    if ($null -ne $connections) {
        foreach ($conn in $connections) {
            try {
                $processId = $conn.OwningProcess
                $process = Get-Process -Id $processId -ErrorAction SilentlyContinue
                
                if ($null -ne $process -and $process.Id -ne 0 -and $process.Id -ne 4) {
                    Write-Host "Stopping process on port $port (PID: $($process.Id))..." -ForegroundColor Yellow
                    Stop-Process -Id $processId -Force -ErrorAction Stop
                }
            }
            catch {
                Write-Host "Could not stop process on port $port. Please close it manually." -ForegroundColor Red
            }
        }
    }
}

Kill-PortProcess 5555

# 2. Determine Python Command
$pyCommand = "python"
if (Get-Command "py" -ErrorAction SilentlyContinue) {
    $pyCommand = "py -3.11"
} elseif (Get-Command "python3" -ErrorAction SilentlyContinue) {
    $pyCommand = "python3"
}

# 3. Start Port Manager Service
Write-Host "Starting Port Manager Service (Port 5555)..." -ForegroundColor Cyan
$cmd = "cd '$PROJECT_ROOT'; $pyCommand -m uvicorn app:app --host 127.0.0.1 --port 5555 --reload"
Start-Process -FilePath "powershell" -ArgumentList "-NoExit", "-Command", $cmd -WindowStyle Minimized

# 4. Wait for service to be ready
Write-Host "Waiting for service to start (approx. 3-5 seconds)..." -ForegroundColor Green

$retries = 10
$ready = $false
while ($retries -gt 0) {
    try {
        $conn = Test-NetConnection -ComputerName 127.0.0.1 -Port 5555 -InformationLevel Quiet
        if ($conn) {
            $ready = $true
            break
        }
    } catch {}
    Start-Sleep -Seconds 1
    $retries--
    Write-Host "." -NoNewline -ForegroundColor Gray
}
Write-Host ""

if ($ready) {
    Write-Host "Service is ready! Opening browser..." -ForegroundColor Green
    Start-Process "http://127.0.0.1:5555"
} else {
    Write-Host "Warning: Service startup timed out. Please try accessing manually." -ForegroundColor Yellow
    Write-Host "URL: http://127.0.0.1:5555" -ForegroundColor Magenta
}

Write-Host "=== Startup Complete ===" -ForegroundColor Cyan
Write-Host "The Port Manager service is running in a minimized window." -ForegroundColor Green
Write-Host "This window will close automatically in 5 seconds." -ForegroundColor Gray
Start-Sleep -Seconds 5
