Unicode true
!include "MUI2.nsh"
!define APP "Braquet"
!ifndef VERSION
!define VERSION "1.0.0"
!endif
!ifndef OUTFILE
!define OUTFILE "out/Braquet-Installation.exe"
!endif
!ifndef SRCDIR
!define SRCDIR "dist/win-unpacked"
!endif
!define UNKEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\Braquet"
Name "${APP}"
OutFile "${OUTFILE}"
InstallDir "$LOCALAPPDATA\Programs\Braquet"
RequestExecutionLevel user
SetCompressor /SOLID lzma
SetCompressorDictSize 64
BrandingText "Braquet · analyse et coaching cycliste"
VIProductVersion "${VERSION}.0"
VIAddVersionKey "ProductName" "Braquet"
VIAddVersionKey "FileDescription" "Installation de Braquet"
VIAddVersionKey "FileVersion" "${VERSION}"
VIAddVersionKey "LegalCopyright" "Braquet"
!define MUI_ICON "build-icon.ico"
!define MUI_UNICON "build-icon.ico"
!define MUI_WELCOMEPAGE_TITLE "Bienvenue dans Braquet"
!define MUI_WELCOMEPAGE_TEXT "Braquet lit ton compteur Garmin et analyse chacune de tes sorties.$\r$\n$\r$\nClique sur Installer pour commencer."
!define MUI_FINISHPAGE_RUN "$INSTDIR\Braquet.exe"
!define MUI_FINISHPAGE_RUN_TEXT "Lancer Braquet"
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "French"

Section "Braquet"
  nsExec::Exec 'taskkill /F /IM Braquet.exe'
  Sleep 600
  RMDir /r "$INSTDIR"
  SetOutPath "$INSTDIR"
  File /r "${SRCDIR}/*.*"
  File "/oname=braquet.ico" "build-icon.ico"
  CreateShortCut "$DESKTOP\Braquet.lnk" "$INSTDIR\Braquet.exe" "" "$INSTDIR\braquet.ico" 0
  CreateShortCut "$SMPROGRAMS\Braquet.lnk" "$INSTDIR\Braquet.exe" "" "$INSTDIR\braquet.ico" 0
  WriteUninstaller "$INSTDIR\Desinstaller Braquet.exe"
  WriteRegStr HKCU "${UNKEY}" "DisplayName" "Braquet"
  WriteRegStr HKCU "${UNKEY}" "DisplayVersion" "${VERSION}"
  WriteRegStr HKCU "${UNKEY}" "Publisher" "Braquet"
  WriteRegStr HKCU "${UNKEY}" "DisplayIcon" "$INSTDIR\braquet.ico"
  WriteRegStr HKCU "${UNKEY}" "InstallLocation" "$INSTDIR"
  WriteRegStr HKCU "${UNKEY}" "UninstallString" '"$INSTDIR\Desinstaller Braquet.exe"'
  WriteRegDWORD HKCU "${UNKEY}" "NoModify" 1
  WriteRegDWORD HKCU "${UNKEY}" "NoRepair" 1
SectionEnd

Function .onInstSuccess
  IfSilent 0 +2
  Exec '"$INSTDIR\Braquet.exe"'
FunctionEnd

Section "Uninstall"
  nsExec::Exec 'taskkill /F /IM Braquet.exe'
  Sleep 600
  Delete "$DESKTOP\Braquet.lnk"
  Delete "$SMPROGRAMS\Braquet.lnk"
  RMDir /r "$INSTDIR"
  DeleteRegKey HKCU "${UNKEY}"
SectionEnd
