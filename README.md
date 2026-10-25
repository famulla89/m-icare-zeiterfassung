# M-iCare Zeiterfassung – Testversion 1.7.0

## Angebot → Annahme → Arbeitskarten → Zeiterfassung → Rechnung (Version 1.7.0)

1. **Angebots- & Rechnungsrechner:** Kunden/Geschäftsstelle und Leistung auswählen, Einsätze/Preis kalkulieren, Wunschtermin und Uhrzeit, Wiederholung (täglich/wöchentlich/14-tägig), Mitarbeiter eintragen. Erst als Kostenvoranschlag speichern oder PDF exportieren; damit wird **noch kein Termin angelegt**.
2. **Kunde sagt zu:** In der Dokumentenübersicht das Angebot mit **„Kunde hat angenommen · AK planen“** bestätigen. Bis 52 Einzeltermine werden als **offene Arbeitskarten** im Kalender erzeugt (ohne geleistete Arbeitszeit). Das angenommene Angebot wird gegen nachträgliche Bearbeitung gesperrt.
3. **Kalender:** Auf einen Tag klicken → Kunde, Objekt, **AK-Nummer** und Status sehen. **AK bearbeiten** passt Datum und Beginn/Ende an. **Arbeit dokumentieren** erfasst den realen Mitarbeiter-Einsatz.
4. **Mitarbeiter:** Bei neuer Arbeitszeiterfassung ist Status zunächst **„In Bearbeitung“**, niemals automatisch „Erledigt“. Mehr- oder Minderzeit benötigt einen Grund. Bereits gespeicherte Dokumentation erfordert bei Korrektur den Bearbeitenden und einen Korrekturgrund.
5. **Rechnung:** Erst bei wirklich erledigtem Einsatz wird **„Rechnung erstellen“** eingeblendet. Der Rechner übernimmt den ursprünglichen Angebotsumfang und teilt den vereinbarten Nettobetrag centgenau auf die geplante Einsatzanzahl auf. Beispielsweise 5 × Fensterreinigung zu 500 € netto: jede einzelne AK mit 100 € netto; nach Abschluss zunächst nur 100 € abrechnen. Die Rechnungs-PDF zeigt ursprüngliche Angebotsnummer, AK und Einsatznummer.
6. **E-Mail:** Erst nach finaler Rechnung kann eine E-Mail mit PDF-Anhang vorbereitet werden; kein automatischer Versand.

**Grenzen:** Wochentage/Termine können nach der Planung pro AK verschoben werden. Diese Fassung erstellt pro angenommenem Angebot höchstens 52 einmalige AKs; kein Vertragsmodul mit automatischer Rechnungsbündelung. Die app-lokale Rechnungsnummernvergabe ist noch nicht geräteübergreifend abgesichert und sollte vor produktivem Parallelbetrieb zentralisiert werden. Bei regulärer Besteuerung können durch Cent-Rundung über mehrere Einzelrechnungen Abweichungen zum Angebots-USt-Gesamtwert entstehen – vor Freigabe steuerlich prüfen. Bestehende AKs und Angebote bleiben erhalten.


Eigenständige Offline-PWA für M-iCare Gebäudereinigung. **Nicht** verbunden mit dem Repository malteser-dienstnachweis.

## Funktionen
- Monat, Mitarbeiter, Reinigungsleistung (12 Kategorien), optional Kunde/Objekt und Notiz
- Arbeitsbeginn, Arbeitsende inklusive Enddatum für Nachtschichten, manuelle Pause, Netto-Stundenberechnung
- Dateneingabe über Sprachfunktion, sofern der Browser die Web Speech API unterstützt (kann Netzwerk benötigen)
- Historie aller Monate, einschließlich Bearbeiten und Löschen
- Offline-PWA mit Service Worker und lokaler Speicherung in IndexedDB
- Echter Excel-Export (.xlsx) ohne externe Bibliotheken, Vorschau als Monatstabelle
- JSON-Gesamtsicherung inklusive Mitarbeiterdaten; Backup-Wiederherstellung mit Validierung
- Nach jeder Änderung lokale Speicherung; sofern ein unterstützter Browser und ein beschreibbarer Ordner verbunden sind: vollständiges JSON-Backup mit Zeitstempel in Backups/ sowie aktuelle XLSX-Datei je Monat

## Benutzerkonto, Passwort und Fingerabdruck (Version 1.6.0)
- Beim allerersten Start auf jedem einzelnen Gerät wird lokal ein Benutzername (3–64 Zeichen) und ein Passwort (mindestens 10 Zeichen) festgelegt und bestätigt.
- Jeder spätere Neustart erfordert eine erneute Anmeldung. Die Schaltfläche **Sperren** blendet Kundendaten sofort aus.
- Das Passwort wird lokal nur als gesalzener PBKDF2-SHA256-Prüfwert mit 310.000 Iterationen abgelegt, nie im Klartext. Nach fünf falschen Eingaben wird die Anmeldung zeitweise gesperrt.
- Auf Android mit eingerichteter Gerätebiometrie: zuerst einmal mit Passwort anmelden, danach im App-Kopf **Fingerabdruck aktivieren** auswählen und den Android-Systemdialog erfolgreich bestätigen. Beim nächsten Öffnen auf **Mit Fingerabdruck anmelden** tippen. Das Passwort funktioniert weiterhin.
- Auf Windows und im Web erfolgt die Anmeldung mit Benutzername und Passwort.
- **Wichtig:** Es handelt sich zunächst um eine lokale Zugriffssperre, **keine Verschlüsselung** der IndexedDB-Daten, JSON-Sicherungen oder PDFs. Vor unberechtigtem Dateizugriff schützt weiterhin die Geräteverschlüsselung und der Windows-/Android-Sperrbildschirm. Vor produktiver Verwendung sensibler Kundendaten Datenverschlüsselung separat bewerten.
- Profile werden auf jedem Gerät separat eingerichtet. Sie synchronisieren keine Passwörter und stellen keinen Cloud-Benutzeraccount dar.
- Es gibt keinen Passwort-Vergessen-Online-Dienst. Passwort daher sicher verwahren, regelmäßige JSON-Sicherungen in einem geschützten Ordner anlegen. Bestehende Kunden-/Auftragsdaten bleiben beim Upgrade erhalten.
- Keine Zugangsdaten in PDF oder JSON-Vollsicherungen ablegen.

## Inbetriebnahme
Unter Repository Settings → Pages: Deploy from branch → main / (root) auswählen. Anschließend die GitHub-Pages-URL mit Chrome auf Android öffnen und über Browsermenü als App installieren.

Einmal in "Sicherung & Excel" den Sicherungsordner auswählen. Auf nicht kompatiblen Browsern müssen JSON und XLSX über die Download-Schaltflächen exportiert werden. **Die Statusanzeige unterscheidet zwischen lokal gespeichert und tatsächlich extern gesichert.** Browser-/PWA-Daten sind allein keine vollständige Sicherung.

## Wichtige Hinweise
- **Keine Datenbank, keine Konten, keine geräteübergreifende Synchronisation.** Mitarbeiterdaten bleiben jeweils nur auf dem Gerät.
- Ein externer Ordnerzugriff kann vom Browser zurückgenommen werden und benötigt möglicherweise erneute Berechtigung. Ohne Ordnerzugriff ist ein automatisches externes Backup nicht möglich.
- Der angebotene Sprachdienst kann browserabhängig online erfolgen.
- GitHub-Repository ist öffentlich: keine Mitarbeiterdaten oder JSON-Backups einchecken.
- Mitarbeitende sollten Arbeitszeiten und Backups auf firmeneigenen Geräten bzw. nach abgestimmten Datenschutzregeln verwenden.
- Logo: zunächst ein neu gezeichnetes, an den eingereichten Screenshot angelehntes SVG. Für ein exakt offizielles Firmenlogo später eine originale transparente Bilddatei austauschen.
- Die App muss vor produktiver Nutzung auf den tatsächlichen Geräten getestet werden.

## Spätere Cloud-Anbindung
Datenobjekte verwenden individuelle IDs und ISO-Datumsfelder. Später kann ein synchronisierender Backend-Adapter ergänzt werden, ohne die Eingabemaske neu zu entwickeln.
