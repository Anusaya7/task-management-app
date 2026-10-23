$ErrorActionPreference = 'Stop'
$root = 'C:\Users\Anu\Downloads\taskmanager-master (1)\taskmanager-master'
Set-Location $root

# Kill old dev/mongod instances for this project only
Get-CimInstance Win32_Process | Where-Object {
  $_.CommandLine -and ($_.CommandLine -match 'next dev|start-server|taskmanager-master\\node_modules\\next|mongod-x64-win32')
} | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
Start-Sleep 2

# Start mongod DETACHED (survives parent exit)
$mongo = Start-Process 'C:\Users\Anu\.cache\mongodb-binaries\mongod-x64-win32-8.2.6.exe' `
  -ArgumentList @('--dbpath', "$root\.mongo-data", '--port','27017','--bind_ip','127.0.0.1') `
  -PassThru -WindowStyle Hidden
Write-Output "MONGOD started pid=$($mongo.Id)"
Start-Sleep 8

# Clean corrupted/stale next cache
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue

# Start Next dev detached via cmd wrapper
$env:MONGODB_URI = 'mongodb://127.0.0.1:27017/taskmanager'
$env:JWT_SECRET = 'taskmanager_local_dev_secret_2026'
$next = Start-Process cmd -ArgumentList '/c','node --max-old-space-size=4096 node_modules\next\dist\bin\next dev -p 3010 > dev-3010-live.log 2>&1' `
  -WorkingDirectory $root -PassThru -WindowStyle Hidden
Write-Output "NEXT started pid=$($next.Id)"
