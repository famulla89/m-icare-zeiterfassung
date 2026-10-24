# M-iCare 1.3.0 – Angebotsrechner in der normalen Android-App

**Neuer APK-Paketname:** `de.micare.zeiterfassung`  
**Angezeigter Name:** **M-iCare**  
**Versionsname:** **1.3.0**, **Android versionCode:** 130

Die vorherige Version „M-iCare Rechner TEST“ mit Paket-ID `de.micare.zeiterfassung.cloudtest` ist eine **separate App**. Die hier gebaute APK richtet sich dagegen an die eigentliche M-iCare-App und enthält den **Angebots- und Rechnungsrechner mit Fenstergrößen, Objektarten, Kosten und PDF**.

## Vor der Installation: Daten sichern!

1. Öffne die **bisherige** M-iCare-App, in der deine Kunden und Arbeitskarten gespeichert sind.
2. Öffne **Datensicherung & Export → Vollsicherung herunterladen**.
3. Speichere die `.json` **außerhalb der App**, am besten zusätzlich in Google Drive.
4. **Prüfe in „Eigene Dateien“ / Google Drive, dass die Datei existiert.** Bewahre sie bis nach erfolgreicher Migration auf.
5. Installiere die neue `M-iCare-1.3.0-Hauptapp-Angebotsrechner.apk` und versuche zunächst die **Aktualisierung ohne Deinstallation**.

**Wichtig zur Android-Signatur:** Bisherige GitHub-CI-APKs sind **Debug-Builds** mit potenziell wechselndem Signaturzertifikat. Android kann deshalb „App nicht installiert“ oder „Paket steht mit vorhandener App in Konflikt“ anzeigen. **Niemals die alte App deinstallieren, bevor eine externe JSON-Sicherung überprüft wurde.** Eine Neuinstallation nach dem Deinstallieren löscht sonst die lokale IndexedDB samt Kunden/Aufträgen. Bei Signaturkonflikt kann nur eine kompatibel signierte APK direkt upgraden; alternativ nach geprüfter Vollsicherung deinstallieren, aktuelle App installieren und JSON über **Vollsicherung wiederherstellen** importieren. Die neue App kann nicht automatisch lokale Daten der separaten Test-App lesen.

## In der normalen App

Auf der Startseite **🧮 Angebot & Rechnung** wählen:

1. Kunde → Geschäftsstelle → Arbeitskarte auswählen.
2. Objektart/Fläche, Kosten, Betrieb/Solo, Fahrt, Gewinn festlegen.
3. Fensterarten hinzufügen: Standardfenster, große Glasflächen, Schiebeelemente, Sprossenfenster, Wintergarten, Glasüberdachung.
4. Für jede Art unabhängig **Stückzahl, Größe je Fenster, Preis/m², ein-/beidseitig, Verschmutzung, Rahmen/Falz, Leiter, Hebebühne** einstellen.
5. Als **Kostenvoranschlag** oder **Rechnungsentwurf** speichern und PDF ausgeben.

**Hinweis:** Nicht mit einer produktiven steuerlich geprüften Rechnung verwechseln; kein XRechnung/ZUGFeRD. Der Rechner ist eine Testfunktion.

## Validierung

GitHub Actions prüft den tatsächlichen APK-Paketnamen und App-Label, die Einbindung der drei Assets `quote-calculator.js`, `quote-ui.js` und `cloud-transfer.js`, sowie Rechenregeln und Verschlüsselung (Node). Im Chromium-E2E werden Erstellung, Speicherung und PDF eines Angebots mit mehreren Fensterarten geprüft. Ein echter Gerätetest auf dem Samsung bleibt erforderlich. Für künftige **verlustfreie Updates** wird eine dauerhafte Android-Release-Signatur benötigt.
