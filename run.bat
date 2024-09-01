@echo off

echo Checking for Node.js...
powershell -Command "Start-Sleep -Milliseconds 500"

node -v >nul 2>&1

IF %ERRORLEVEL% EQU 0 (

    echo Node.js is installed.
    powershell -Command "Start-Sleep -Milliseconds 500"
    cls
) ELSE (

    echo Node.js is not installed.

    echo Downloading and installing Node.js...

    powershell -command "& { \$url = 'https://nodejs.org/dist/v14.17.0/node-v14.17.0-x64.msi'; \$file = 'nodejs.msi'; \iwr $url -OutFile $file; \Start-Process $file -ArgumentList '/quiet' -Wait; \Remove-Item $file -Force; \}"

    echo Node.js installation complete.
    cls
)

echo Installing dependencies.
call npm i
echo Dependencies installed.
timeout /t 1 /nobreak > NUL
cls
echo Running the botting script.
timeout /t 1 /nobreak > NUL
cls
call node src/index.js
pause
