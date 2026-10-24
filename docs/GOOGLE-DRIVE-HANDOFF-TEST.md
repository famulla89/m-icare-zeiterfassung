# M-iCare 1.2.1 – Google Drive Übergabe testen (Android ↔ Windows)

**Wichtig: Dies ist die funktionsfähige TESTPHASE für verschlüsselte Dateien. Sie ist NICHT die automatische Google-Drive-Synchronisierung.**

Du brauchst **kein M-iCare-Adminportal**, **keine Anmeldung beim Entwickler**, **keine zusätzliche M-iCare-E-Mail-Lizenz** und gibst niemandem dein Google-Passwort. Die in der App hinterlegte E-Mail ist nur ein lokaler Hinweis, der hilft, nicht versehentlich Daten verschiedener Kunden zu mischen. Google Drive verlangt eine eigene Anmeldung im Betriebssystem bzw. Google Drive. Die App bekommt keine Gmail-Rechte.

## Voraussetzungen

- Google-Konto mit freiem Google-Drive-Speicher.
- Android: Google Drive App installiert/eingeloggt, Drive muss im Android-Dateidialog als Speicheranbieter auswählbar sein (geräteabhängig).
- Windows: Google Drive für Desktop installiert **oder** Google Drive im Browser (`drive.google.com`) öffnen und die Dateien manuell herunterladen/hochladen.
- Auf **beiden Geräten die gleiche M-iCare-Version** und die gleiche **Verschlüsselungs-Passphrase** (mindestens 12 Zeichen).
- **Android-Schutz:** Die APK heißt **M-iCare Cloud TEST** und hat absichtlich eine **eigene Paket-ID**. Sie installiert sich zusätzlich zur alten M-iCare-App, statt deren lokale Daten wegen wechselnder Android-Debug-Signaturen zu gefährden. Die Test-App startet mit leerem Datenbestand; zum Testen zunächst synthetische Testkunden anlegen oder vorhandene Daten bewusst per JSON importieren. Die alte App bleibt separat erhalten.
- **Am Anfang nur Testdaten.** Vor jeder Übernahme vorhandene M-iCare-Daten zusätzlich als normale JSON-Vollsicherung exportieren.

## Testablauf: Handy → PC

1. Auf dem Handy **M-iCare → Datensicherung → Google Drive – Handy ↔ Windows**.
2. Optional deine eigene Google-E-Mail hinterlegen (dies ist *keine* Google-Anmeldung).
3. Eigene Passphrase wählen (mindestens 12 Zeichen), zur Erstellung zweimal eingeben und sicher außerhalb des Handys aufbewahren.
4. **„Verschlüsselte Sicherung erstellen“**. Im Android-Systemdialog **Google Drive** und einen passenden Ordner (z. B. `M-iCare`) auswählen. Falls Drive nicht angeboten wird: Datei zunächst auf dem Gerät speichern und anschließend über die Google-Drive-App hochladen.
5. Kontrollieren, dass `M-iCare_Cloud_YYYY-MM-DD_XXXXXXXX.json` wirklich im eigenen Google Drive angekommen ist. Ältere Sicherungen NICHT löschen.
6. Am Windows-PC mit demselben Google-Konto Google Drive öffnen. Sicherungsdatei im Google-Drive-Ordner finden oder im Browser herunterladen.
7. **M-iCare für Windows → Datensicherung → Cloud-Datei zum Prüfen auswählen**. Die zuvor gespeicherte verschlüsselte Datei auswählen, dieselbe Passphrase eingeben.
8. M-iCare zeigt die **Unterschiede**: Kunden, Geschäftsstellen, AK, Arbeitszeiten – jeweils neu, geändert, auf diesem Stand fehlend.
9. Nur wenn die Vorschau stimmt, Kontrollfeld aktivieren und **„Geprüfte Sicherung übernehmen“** bestätigen. **Vorsicht: Vollständiger Ersatz, keine automatische Zusammenführung!**
10. Falls etwas nicht stimmt: **„Vorherigen lokalen Stand wiederherstellen“**. Dies nutzt eine zusätzliche lokale IndexedDB-Rücksprungversion.

**PC → Handy:** Genau die gleichen Schritte in umgekehrter Richtung. Unter Windows kann die verschlüsselte Datei über den Google-Drive-Desktop-Ordner synchronisiert werden; sonst im Browser manuell in Google Drive hochladen. Auf Android M-iCare über Dateiauswahl wieder einlesen.

## Schutzmechanismen

- Die gesamte Sicherung ist mit **AES-256-GCM** verschlüsselt; Schlüsselableitung **PBKDF2-SHA256 / 310.000 Iterationen** mit individuellem zufälligem Salt. Die Passphrase wird nicht gespeichert. Falsche Passphrase oder manipulierte Sicherung → Import abgelehnt.
- JSON wird vor dem Import geprüft (Datensatzgrenzen, IDs, Referenzen). Die bestehende DB wird **bei der Vorschau nicht verändert**.
- Die App erlaubt das Ersetzen nur nach bewusstem Bestätigen; sie erstellt zuvor einen lokalen Rücksprung. Bei Änderung des lokalen Datenstands nach der Vorschau ist ein neuer Vergleich erforderlich.
- Sicherungen enthalten **keine Google-Zugangsdaten**.
- Die App speichert ihre **laufenden** lokalen Daten weiterhin in IndexedDB. Diese lokale Datenbank ist in dieser Testversion **nicht verschlüsselt**. Die Verschlüsselung schützt nur die exportierte Cloud-Datei.

## Noch NICHT enthalten

- Keine direkte Google-Drive-API-Anbindung, keine automatische App-internen Anmeldung bei Google, keine automatische Übertragung im Hintergrund. Dafür braucht das Projekt verifizierte OAuth-Client-IDs und native Google-Anmeldung auf Android/Windows.
- Keine Zusammenführung zweier gleichzeitig bearbeiteter Versionen derselben AK.
- Keine manipulationssichere App-Lizenz oder Sperre für kopierte APK/EXE.
- Die E-Mail in M-iCare ist **keine Identitätsprüfung**. Vertraue nur deinem eigenen Google-Drive-Konto.

**Wichtig für deinen Kollegen:** Er benutzt **sein eigenes** Google Drive und sein eigenes Konto. Du brauchst dessen Passwort oder Drive-Dateien nicht und musst seine Backups nicht verwalten.

## Tests im Projekt

- `node tests/cloud-transfer-smoke.cjs` – Ver- und Entschlüsselung, falsche Passphrase, Manipulation, Datenintegrität, Datensatzvergleich, archivierte AK.
- `node tests/browser-e2e.cjs` – exportierte verschlüsselte Datei, Vorschau/Änderungen und Rücksprung.
- `node tests/windows-electron-e2e.cjs` – Verschlüsselung im **installierten** Windows-Electron-Renderer.
- Android APK wird in GitHub CI kompiliert. Der Google-Drive-Dateidialog kann wegen Android-/Drive-Anbieterunterschieden erst auf einem echten Handy vollständig geprüft werden.
