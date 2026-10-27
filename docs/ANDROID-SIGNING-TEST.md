# Android-Updates: fester Signaturschlüssel

## Befund vom 27.10.2026
Die APKs 1.9.13 und 1.9.14 wurden als Debug-Builds auf unterschiedlichen GitHub-Runnern signiert.
Die X.509-SHA-256-Fingerabdrücke der APK-Signatur sind verschieden:
- 1.9.13: `d2e8b70b3e91eae8e9da532853501e3366d64f56c725f63dfaa677dffb7b1e24`
- 1.9.14: `b0c6fd38601b0ed7d8a9098187ee8cdbdaec838906795ee0239be14bcc8a138c`

Android kann eine bereits installierte App mit demselben Paketnamen `de.micare.zeiterfassung` nicht über eine APK mit anderer Signatur aktualisieren. Ein Build-Erfolg allein beweist deshalb keine Updatefähigkeit. Deinstallation löscht normalerweise die lokal gespeicherten Daten: zuerst eine vollständige JSON-Sicherung außerhalb der App ablegen.

## Künftige stabile Debug-Test-Updates
Einmalig auf einem sicheren Rechner mit Java keytool erstellen (Beispiel für Testzwecke, **nicht für öffentliche Produktion**):

```bash
keytool -genkeypair -keystore micare-debug.keystore -alias androiddebugkey -keyalg RSA -keysize 3072 -validity 10000 -storepass android -keypass android -dname "CN=M-iCare Testing,OU=Development,O=M-iCare,C=DE"
base64 -w0 micare-debug.keystore
```

Unter Windows kann die Base64-Ausgabe per PowerShell erzeugt werden:
```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("micare-debug.keystore"))
```

1. Im GitHub-Repository unter Settings → Secrets and variables → Actions ein *Repository secret* `MICARE_DEBUG_KEYSTORE_BASE64` mit dem vollständigen Base64-Inhalt anlegen.
2. Die originale `micare-debug.keystore` und eine sichere Kopie dauerhaft aufbewahren. **Keinesfalls die Keystore-Datei oder Base64-Daten in Git/GitHub-Code hochladen.**
3. Die Android-Workflowdatei installiert diesen Schlüssel als `~/.android/debug.keystore`, bevor `gradle assembleDebug` ausgeführt wird.
4. Ab dann erzeugte Debug-APKs sind gegeneinander updatefähig, sofern die Schlüsseldatei identisch bleibt. **Ein direktes Update von den älteren zufällig signierten APKs ist weiterhin nicht möglich.** Nach JSON-Sicherung ist einmaliges Deinstallieren/Neuinstallieren nötig.
5. Vor jedem neuen Update Signatur prüfen, damit kein falsch signiertes APK verteilt wird.

Für einen öffentlichen/kommerziellen Release sind stattdessen ein separater sicher verwahrter Release-Keystore, restriktive CI-Berechtigungen und ein signierter Release-Build erforderlich.

## Status
CI unterstützt den optionalen GitHub-Secret-Schlüssel und warnt, wenn er fehlt. **Das Repository-Secret wurde nicht automatisch eingerichtet.** Ohne Secret entstehen weiterhin neue temporäre Debug-Schlüssel.
