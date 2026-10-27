# M-iCare Zeiterfassung – Entwicklungsstand 1.9.15

## Flexible Kunden-Erinnerung vor Vertragsende (1.9.15)

Im **Angebots- und Rechnungsrechner → Auftragsplanung → Kunden-Erinnerung vor Vertragsende** gibt es jetzt:

- **Automatisch passend zur Auftragsdauer (Standard):** bei Aufträgen mit höchstens 14 Tagen Laufzeit bis zu 2 Tage vorher, bei 15–30 Tagen 7 Tage, bei 31–60 Tagen 14 Tage, darüber 30 Tage vor dem Ende.
- **Feste Auswahl:** 1, 2, 3, 7, 14, 30 oder 60 Tage vorher, außerdem letzter Auftragstag und keine Erinnerung.
- **Eigener Zeitraum:** beliebige ganze Zahl im Rahmen von 1–730 Tagen, 1–104 Wochen oder 1–24 **Kalendermonaten**. Beispiel: Ein Monat vor dem 31. März ist der 28. bzw. 29. Februar.
- **Schutz bei kurzen Aufträgen:** Wenn der gewünschte Vorlauf länger als der Vertrag ist, wird die Erinnerung auf den **ersten geplanten Einsatztag** begrenzt; ein Hinweis erscheint in der Vorschau.
- **Terminvorschau:** zeigt den konkreten Erinnerungstag und eine Warnung, wenn der Vorlauf angepasst wurde. Bei Kundenannahme wird der berechnete Tag als `reminderDays` und `reminderDate` gespeichert.
- **Keine rückwirkende Migration:** Bereits angenommene Aufträge behalten ihre gespeicherten Erinnerungen. Vorhandene Entwürfe mit 7/14/30/60 Tagen bleiben bearbeitbar.

**Beispiel:** Zweiwöchiger Auftrag 02.–16.11.2026 → automatische Erinnerung am 14.11.2026. Bei manuell gewähltem „1 Tag vorher“ erfolgt sie am 15.11.2026.

**Wichtig:** Es handelt sich weiterhin um eine **In-App-Erinnerung** auf der Startseite, sobald die App geöffnet bzw. verwendet wird – **keine** Android-/Windows-Pushmeldung bei geschlossener App. Eine sichere JSON-Datensicherung bleibt vor Neuinstallationen nötig. Die Version 1.9.15 erhöht den Android-`versionCode` auf 207.

---

# M-iCare Zeiterfassung – Testversion 1.9.1

## PDF-Layout direkt in der App (Version 1.9.4)

Im **Kostenvoranschlagsrechner** gibt es oben **„So sieht das fertige PDF aus“** und unter dem berechneten Gesamtbetrag die aufklappbare **„Dokumentvorschau im Original-PDF-Layout“**.

- Kundendaten und Leistungen eingeben: Die Vorschau aktualisiert sich nach kurzer Eingabepause automatisch.
- Die Vorschau benutzt **denselben Zeichen-/Canvas-Code** wie die eigentliche PDF-Datei. Logo, Schrift, Absender, Empfänger, Positionen und Summen entsprechen der ersten Seite des Downloads; dies wurde im Browser-Praxistest mit byte-identischen JPG-Seitendaten überprüft.
- Auf Smartphone und PC wird die Vorschau als Bild dargestellt (funktioniert also auch dort, wo kein integrierter PDF-Reader vorhanden ist).
- Bei mehrseitigen Dokumenten wird die erste Seite gezeigt: alle PDF-Seiten bitte über **„PDF-Entwurf erstellen“** kontrollieren.
- Die Vorschau speichert und versendet **keine** Rechnung.
- Nach Änderung eines Kundendatensatzes wird das alte Vorschaubild sofort entfernt, damit nicht versehentlich die falsche Kundenanschrift sichtbar bleibt.


## Fehlerkorrekturen und Teilrechnung – Testversion 1.9.1

- **AK bearbeiten funktioniert in der installierten Windows-App:** Der alte `prompt()`-Dialog wurde durch eine eigene Eingabemaske ersetzt. Geplantes Datum, Beginn/Ende, zuständiger Mitarbeiter und Arbeitsanweisung können dort geändert werden. Eine bestehende Arbeitszeiterfassung sperrt nachträgliche Terminänderungen; Ist-Zeit-Korrekturen laufen weiterhin über den nachvollziehbaren Korrekturgrund.
- **Aufklappen/Zuklappen:** In der Arbeitszeiterfassung kann der gesamte Bereich „Geplanten Auftrag zuordnen“ aufgeklappt oder zugeklappt werden. Auch „Angenommene Aufträge – mit Arbeitskarten“ ist als Klappbereich nutzbar. Die AK-Einzelliste bleibt unabhängig aufklappbar.
- **Keine unbemerkte „Erledigt“-Vorauswahl:** Ein neu übernommener Auftrag beginnt zunächst mit Status „In Bearbeitung“. Erst die bewusste Auswahl „Erledigt“ schließt den tatsächlichen Einsatz ab.
- **Nach erstmaligem Abschluss:** Die App bietet unmittelbar an, die Rechnung oder **Teilrechnung** für die erledigte AK zu *vorbereiten*. Das erstellt keine ungeprüfte endgültige Rechnung und verschickt keine E-Mail. Wenn eine AK später korrigiert und erneut als erledigt markiert wird, kommt keine zweite automatische Rechnungsfrage.
- **Teilrechnung 1 von 10:** Aus einem angenommenen Angebot über zehn Einsätze und 1.000 € netto wird die einzelne AK mit 100 € netto berechnet. Die Rechnung zeigt Angebot, AK und Teilrechnungsnummer innerhalb der Serie. Das PDF trägt in diesem Fall die Überschrift „TEILRECHNUNG“ (final) bzw. „TEILRECHNUNGSENTWURF“ (zur Prüfung). Doppeltes endgültiges Abrechnen derselben AK wird verhindert.
- **Sichtbarkeit:** Im Bereich „Angenommene Aufträge“ kann jede noch offene AK bearbeitet/dokumentiert, eine erledigte AK abgerechnet und eine bereits abgerechnete AK-PDF wieder geöffnet werden.
- **Speichersicherheit:** Der AK-Bearbeitungsdialog schließt erst, wenn die Änderungen dauerhaft in IndexedDB gespeichert sind; ein schneller App-Neustart darf die Daten nicht verlieren.
- **Automatisierte Prüfungen:** Benutzer- und Auftragsanlage, Kalender, AK-Bearbeitungsformular mit Neustart, fünfteiliger Auftrag sowie zehnteiliges Angebot mit einer Teilrechnung über 100 €, Rechnungs-PDF, Reporting und unzulässige Eingaben.

**Wichtig:** Dies bleibt eine Testversion. Die lokale Benutzeranmeldung ersetzt keine Datenverschlüsselung; parallele Rechnungsnummernvergabe auf mehreren Geräten ist noch nicht zentral abgesichert. Vor produktiver Nutzung echte Steuernummer/IBAN, Zahlungsbedingungen und Rechnungsanforderungen prüfen.


## Angenommene Angebote und Arbeitskarten – Version 1.9.0

- Im **Angebots- & Rechnungsrechner** das Angebot wie gewohnt speichern. Ohne Kundenannahme wird nichts verbindlich gebucht.
- Mit **„Kunde hat angenommen · AK planen“** öffnet sich ein Dialog mit der konkreten **AK-Liste**. Für jede zukünftige Arbeitskarte werden Datum, geplante Start-/Endzeit und verantwortlicher Mitarbeiter angezeigt und vor dem Anlegen anpassbar. Der kalkulierte Leistungsumfang und die Positionen sowie Angebotsnotizen füllen die editierbare **Arbeitsanweisung für Mitarbeiter**.
- Der Nutzer bestätigt **„Arbeitskarten verbindlich anlegen“**. Erst jetzt speichert M-iCare eine offene AK für jeden angenommenen Termin, mit Original-Angebotsnummer, Leistung, Kunden- und Objektzuordnung, Mitarbeiter, Arbeitsanweisung und centgenauem Anteil des Angebotsbetrags. Kein Mitarbeiter erhält dadurch geleistete Arbeitszeit oder den Status „Erledigt“.
- Direkt danach erscheint **Aufträge & Reinigungstermine → Angenommene Aufträge**. Die Aufträge sind nach Kunde und Angebotsnummer durchsuchbar und nach Bearbeitungsstand filterbar. Jeder Auftrag zeigt den Gesamtstatus; die aufklappbaren AKs erlauben **AK bearbeiten**, **Arbeit dokumentieren** und erst nach Abschluss **Rechnung erstellen**.
- Auf dem PDF-Angebotsarchiv gibt es außerdem **„Angenommenen Auftrag öffnen“** als direkte Verknüpfung.
- Für die Zeiterfassung wird der ursprüngliche Auftragstext oberhalb der Mitarbeiter-Eingabemaske eingeblendet. Tatsächliche Zeiten und durchgeführte Arbeiten werden getrennt erfasst, um Angebot und Ist-Leistung nicht zu verwechseln.
- Ein zweiter Annahmeversuch wird unterbunden; bereits angenommene Angebote bleiben geschützt. Vor der Annahme erkennt der Dialog Konflikte mit vorhandenen Terminen und zwischen neu geplanten AKs.
- **Regression:** Kundenanlage, mehrere Geschäftsstellen, acht/fünf/18 Termine, Angebot, pro-AK-Vorschau mit editierbarer Uhrzeit, AK-Status, Kalendersicht, Rechnung, E-Mail mit PDF, Datensicherung, Reporting, 12 Hauptmasken mit Pflichtfeldern sowie Windows/Android-Installationspakete.

**Hinweis:** Die Freigabe in PR #39 bleibt ein Teststand. Vor produktivem Rechnungsversand und geräteübergreifender Benutzung bitte Rechnungsnummern-Vergabe, steuerliche Angaben, Signierung, Kunden-Datenschutz und Datensynchronisierung gesondert absichern.


## Auftragsplanung mit Wochentagen und Kunden-Erinnerung (Testversion 1.9.0)

**Beispiel:** Ein Kunde bucht vom 03.11. bis 31.12.2026 jeweils dienstags und mittwochs eine Fensterreinigung. Im Angebots- und Rechnungsrechner „Zeitraum mit festen Wochentagen“ auswählen, Anfang/Ende, **Di** und **Mi**, Mitarbeiter und Uhrzeiten eintragen. M-iCare berechnet 18 Einsätze. Bei 900 € netto entstehen nach Annahme 18 offene AK zu je 50 € netto.

- **Unverbindlicher Entwurf:** „Termine und Überschneidungen prüfen“ zeigt alle Tage mit Warnhinweisen bei Kollisionen. Noch nicht angenommene gespeicherte Angebote erscheinen im Kalender **lila** als „ANGEBOTSENTWURF – noch KEINE Arbeitskarte“. Diese Entwürfe blockieren keine Mitarbeitenden.
- **Verbindlich:** Erst „Kunde hat angenommen · AK planen“ verwandelt die angebotenen Einsätze in echte offene Arbeitskarten. Mitarbeiter kann Termine dokumentieren und erst nach Erledigung abrechnen.
- **Einstellungen:** Wiederholung jede Woche oder alle 2/3/4 Wochen, Wochentage Mo–So; alternativ feste Einsatzanzahl mit täglichem/wöchentlichem Abstand. Das Planungsmodul begrenzt diese Testfassung auf 104 AK pro angenommenem Angebot und maximal zwei Jahre im Datumsbereich.
- **Vertragsende:** Standardmäßig 30 Tage vorher, alternativ 60/14/7/0 Tage oder aus. Auf der Startseite unter **„Vertragsende & Kundenpflege“** erscheint der fällige Vorgang mit Kundenkontakt, Vertragsende und den Aktionen „Kunde kontaktiert“ / „In 7 Tagen erneut erinnern“.
- **WICHTIGE GRENZE:** Dies sind **In-App-Erinnerungen, die beim Öffnen und Verwenden von M-iCare geprüft werden**. Sie sind **keine garantierten Android-/Windows-Pushbenachrichtigungen bei geschlossener App**. Für zuverlässige Meldungen bei geschlossener App wäre ein zusätzlicher, vom Betriebssystem geplanter Benachrichtigungsdienst bzw. eine serverseitige Überwachung nötig.
- **Daten & Steuer:** Bestehende Angebote/Arbeitskarten bleiben erhalten. Rechnungsnummern müssen für echten Parallelbetrieb mehrerer Geräte zentral koordiniert werden. Preise bei Teilabrechnung und Umsatzsteuer ggf. fachlich prüfen.


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
