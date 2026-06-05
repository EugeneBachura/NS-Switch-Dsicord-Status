!macro customInstall
  RMDir /r "$APPDATA\NS Switch Discord Status"
  CreateDirectory "$APPDATA\NS Switch Discord Status"

  ${If} $LANGUAGE == ${LANG_RUSSIAN}
    FileOpen $0 "$APPDATA\NS Switch Discord Status\installer-language.txt" w
    FileWrite $0 "ru"
    FileClose $0
    FileOpen $0 "$APPDATA\NS Switch Discord Status\settings.json" w
    FileWrite $0 "{$\r$\n  $\"language$\": $\"ru$\",$\r$\n  $\"theme$\": $\"soft$\"$\r$\n}$\r$\n"
    FileClose $0
  ${ElseIf} $LANGUAGE == ${LANG_POLISH}
    FileOpen $0 "$APPDATA\NS Switch Discord Status\installer-language.txt" w
    FileWrite $0 "pl"
    FileClose $0
    FileOpen $0 "$APPDATA\NS Switch Discord Status\settings.json" w
    FileWrite $0 "{$\r$\n  $\"language$\": $\"pl$\",$\r$\n  $\"theme$\": $\"soft$\"$\r$\n}$\r$\n"
    FileClose $0
  ${Else}
    FileOpen $0 "$APPDATA\NS Switch Discord Status\installer-language.txt" w
    FileWrite $0 "en"
    FileClose $0
    FileOpen $0 "$APPDATA\NS Switch Discord Status\settings.json" w
    FileWrite $0 "{$\r$\n  $\"language$\": $\"en$\",$\r$\n  $\"theme$\": $\"soft$\"$\r$\n}$\r$\n"
    FileClose $0
  ${EndIf}
!macroend
