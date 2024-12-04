@echo off

echo Checking for Node.js...

node -v >nul 2>&1

IF %ERRORLEVEL% EQU 0 (

    echo Node.js is installed.
   
    cls
) ELSE (

    echo Node.js is not installed.
    echo Downloading and installing Node.js...

    powershell -command "& { $url = 'https://nodejs.org/dist/v20.17.0/node-v20.17.0-x64.msi'; $file = 'nodejs.msi'; Invoke-WebRequest $url -OutFile $file; Start-Process msiexec.exe -ArgumentList '/i', $file, '/passive' -Wait; Remove-Item $file -Force; }"
    
    echo Node.js installation complete.
    cls
)

echo Installing dependencies.
call npm i
echo Dependencies installed.

cls
echo Running the botting script.
cls
call node src/index.js
pause
