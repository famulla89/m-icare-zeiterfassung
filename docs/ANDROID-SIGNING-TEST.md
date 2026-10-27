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

## Aktualisierte Build-Absicherung (27.10.2026)

Der Android-Workflow unterscheidet jetzt eindeutig zwei Fälle:

- **Ohne Repository-Secret:** Artefakt `M-iCare-TEST-1.9.14-NEUINSTALLATION`. Ein temporärer Runner-Schlüssel wird verwendet. Kein verlässliches Update über zuvor installierte APKs. Nur nach vollständiger externer JSON-Sicherung eine Neuinstallation vornehmen.
- **Mit korrektem Repository-Secret:** Artefakt `M-iCare-UPDATE-1.9.14-FESTE-SIGNATUR`. Der Schlüssel wird vor dem Build gegen den festgelegten Zertifikat-Fingerabdruck überprüft. Zusätzlich verifiziert der Workflow die tatsächliche APK-Signatur mit `apksigner` und gleicht sie mit dem Keystore ab.
- **Mit falschem/anderem Keystore:** Der Workflow bricht bewusst ab. So kann nicht unbemerkt ein neuer Schlüssel die Updatefähigkeit zerstören.

Der festgelegte **Testzertifikat-SHA-256-Fingerabdruck** lautet:
`422d32cd1b257b9519ca63d6c16dd7b736a8f02671e1010843d02ae450c1c5a5`

Zu jedem Artefakt gehört jetzt `M-iCare-APK-Signaturstatus.txt` mit Signaturstatus, Zertifikat-Fingerabdruck und SHA-256 der erzeugten APK. Der Status muss vor Installation kontrolliert werden.

### Einrichtung auf GitHub

1. GitHub → `famulla89/m-icare-zeiterfassung` → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**.
2. Name genau `MICARE_DEBUG_KEYSTORE_BASE64`. Als Wert die Base64-Zeichenfolge des **zu obigem Fingerabdruck gehörenden** Test-Keystores einsetzen, ohne Anführungszeichen oder zusätzlichen Erklärungstext.
3. Secret speichern. Den Original-Keystore getrennt und sicher langfristig aufbewahren, samt geprüftem Backup.
4. GitHub → **Actions** → **M-iCare Android APK** → **Run workflow** → Branch `feature/structured-workflow-dashboard-20261027` → Run workflow.
5. Nach erfolgreichem Lauf das Artefakt `M-iCare-UPDATE-1.9.14-FESTE-SIGNATUR` herunterladen und `M-iCare-APK-Signaturstatus.txt` prüfen. Erst diese Version gehört zur neuen stabilen Test-Updatekette.
6. Alte mit anderem Zertifikat installierte APK: Erst **vollständige JSON-Datensicherung** außerhalb der App verifizieren, dann alte APK deinstallieren, neue installieren und Daten zurückspielen. Spätere Updates mit derselben Signatur und korrekt erhöhtem `versionCode` benötigen normalerweise keine Deinstallation mehr.

**Sicherheit:** Nur ein Testschlüssel. Der Keystore oder dessen Base64 darf **nie** in öffentliche GitHub-Dateien, Kommentare, Logs oder Tickets kopiert werden. Auch ein öffentlich geteilter Download-Link zur Schlüsseldatei ist ungeeignet. Bei kommerzieller Veröffentlichung einen neuen, separat geschützten Release-Schlüssel und einen echten Release-Build verwenden.

**Wichtige Grenze:** Der Workflow kann das Secret lesen, aber **nicht selbst anlegen**. Dieser einmalige Schritt muss durch jemanden mit Repository-Zugriff in den GitHub-Einstellungen erfolgen.
