#!/bin/bash
# Fabrique une version : ./release.sh 1.0.1 "Notes de version"
set -e
V="$1"; NOTES="$2"; cd /home/claude/braquet-desktop
node -e "const f='package.json';const p=require('./'+f);p.version='$V';require('fs').writeFileSync(f,JSON.stringify(p,null,1))"
R="rel/$V"; mkdir -p "$R"
timeout 600 npx electron-builder --win dir --x64 -c.directories.output="$R/build" 2>&1 | grep -E "⨯" || true
node seticon.js "$R/build/win-unpacked/Braquet.exe" >/dev/null
N=/root/.cache/electron-builder/nsis/nsis-3.0.4.1
NSISDIR=$N $N/linux/makensis -V1 -DVERSION="$V" -DOUTFILE="$R/Braquet-Installation.exe" -DSRCDIR="$R/build/win-unpacked" installer.nsi
timeout 600 npx electron-builder --mac zip --arm64 -c.directories.output="$R/mac" 2>&1 | grep -E "⨯ (?!Cannot read properties of null)" || true
cp "$R/mac/Braquet-$V-arm64-mac.zip" "$R/Braquet-Mac.zip"
(cd "$R" && zip -q -9 Braquet-Windows.zip Braquet-Installation.exe)
SHA=$(sha256sum "$R/Braquet-Installation.exe" | cut -d' ' -f1); SIZE=$(stat -c%s "$R/Braquet-Installation.exe")
node -e "require('fs').writeFileSync('$R/version.json',JSON.stringify({version:'$V',notes:process.argv[1],page:'https://github.com/Matnel9/braquet/tree/main/versions',win:{url:'https://raw.githubusercontent.com/Matnel9/braquet/main/versions/Braquet-Installation-$V.exe',sha256:'$SHA',size:$SIZE},mac:{url:'https://raw.githubusercontent.com/Matnel9/braquet/main/versions/Braquet-Mac-$V.zip'}},null,1))" "$NOTES"
ls -la "$R"
