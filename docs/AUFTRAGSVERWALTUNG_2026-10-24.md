# M-iCare – Neue Auftragsverwaltung und Jahresverträge

Stand: 24. Oktober 2026 · Entwicklungsbranch `feature/order-management-progress-followups-20261024` · [Pull Request #25](https://github.com/famulla89/m-icare-zeiterfassung/pull/25)

## Grundprinzip

- **Kunde / Geschäftsstelle**: Wer beauftragt die Arbeit, und wo wird sie geleistet?
- **Arbeitsauftrag**: Was wurde vereinbart? Beispiel: „Fensterreinigung innen und außen“, einmalig oder ein Jahr lang jeden Dienstag.
- **Geplante Termine / Terminserie**: Wann wird gereinigt? Ein Dauerauftrag speichert eine Serie, keine 52 kopierten Auftragseinträge.
- **Arbeitszeiteinträge**: Welche tatsächlichen Arbeitszeiten, Pausen, Arbeiten und Auftragsstatus wurden dokumentiert?
- **Controlling / Reporting**: Geplante Einsätze, erledigte Einsätze, tatsächliche Stunden, Ausfälle, Kundenkontakte.

Die alten Kunden, Termine und Arbeitszeiten werden beim Update **nicht neu nummeriert oder überschrieben**. Alte Terminserien können einem Auftrag derselben Geschäftsstelle zugeordnet werden.

## 1. Auftrag anlegen

Startseite → **Aufträge verwalten** → **Neuen Auftrag erstellen**. Wähle Kunde, Geschäftsstelle, Leistung, Mitarbeiter, Auftragsname sowie Art:

- **Einmalauftrag**: Datum und Uhrzeit; genau ein geplanter Einsatz.
- **Dauerauftrag**: erster Termin, Enddatum, Wiederholung (wöchentlich / bestimmte Wochentage / monatlich / alle X Kalendertage / alle X Arbeitstage). Das Enddatum ist verpflichtend. Für sehr lange Verträge begrenzen wir die aktuelle Vorschau auf maximal zwei Jahre; danach Folgeauftrag anlegen.

Bei Terminkollisionen erfolgt eine Warnung. Bestehende Termine können in der Terminverwaltung später einem Auftrag zugeordnet werden.

## 2. Termin dokumentieren

Beim geplanten Termin können tatsächlich geleistete Zeiten, Auftragsstatus, ausgeführte Tätigkeiten und Bemerkungen erfasst werden. Ein abgeschlossener Einsatz lässt sich nicht heimlich doppelt speichern; Korrekturen brauchen weiterhin einen Grund und erhalten einen Änderungsverlauf.

Eine freie Arbeitszeit darf zusätzlich einem Auftrag zugeordnet werden, ohne damit einen vereinbarten Termin abzuschließen. Das ist für Zusatzarbeiten sinnvoll.

## 3. Fortschrittsanzeige

Formel:

**Erfüllung in % = (als „Erledigt“ dokumentierte vereinbarte Einsätze ÷ sämtliche vereinbarten Einsätze) × 100**

Beispiel: 52 geplante Dienstage, davon 37 erledigt → **71,2 %**. Ab einer eingestellten Schwelle von 70 % erscheint die Kunden-Nachbetreuung als **fällig**, sofern kein Kontakt bereits dokumentiert ist.

- Ausfall / Absage wird separat angezeigt und **nicht automatisch aus dem Nenner entfernt**.
- „In Bearbeitung“ zählt noch nicht als vollständig erledigt.
- Zusätzlich erfasste Arbeitsstunden erhöhen die Ist-Stunden des Auftrags, aber **nicht** die Anzahl erledigter Termine.
- Ein Auftrag kann organisatorisch als pausiert/abgebrochen/geschlossen markiert werden. Diese Kennzeichnung ändert keine historischen Arbeitszeiteinträge und macht die Quote nicht künstlich zu 100 %.

**Wichtig:** Bei einem abgebrochenen Auftrag bleiben frühere Termine aus Nachvollziehbarkeitsgründen gespeichert. Zukünftige Termine müssen bei Bedarf zusätzlich im Terminplaner abgesagt werden.

## 4. Kundennachbetreuung

Auftrag öffnen → **Kunden-Nachbetreuung**. Telefonnummer/E-Mail werden aus der Kundenverwaltung angezeigt. Kontaktstatus auswählen:

1. Noch nicht kontaktiert
2. Kunde kontaktiert
3. Neues Angebot gewünscht
4. Derzeit kein Interesse

Optional Gesprächsnotiz speichern. Die Kontaktänderung wird mit Zeitstempel im Auftragsverlauf erfasst. **Die App ruft niemanden automatisch an und versendet keine Werbung.**

## 5. Reporting

Laptop → **Reporting & Controlling** → **Auftragsfortschritt & Kunden-Nachbetreuung**:

- Auftrag, Kunde, Geschäftsstelle, Vertragszeitraum und Art
- Geplante / erledigte / ausgefallene Termine
- Tatsächliche Arbeitsstunden und Erfüllungsquote
- Nachbetreuungsstatus und Liste der fälligen Kontakte
- Bericht als CSV sowie A4-Druck/PDF

Der Vertragsbericht berücksichtigt **alle Vertragslaufzeiten**, damit längerfristige Verträge nicht bei Monatswechsel verschwinden. Kunden, Mitarbeiter, Objekte und Leistungsarten können weiterhin gefiltert werden.

## 6. Datensicherung, Tests, offene Punkte

Die JSON-Vollsicherung enthält `orders` zusätzlich zu `appointments`, `entries`, `customers` und `objects`. Der Import prüft die Auftrags-ID, Kunden- und Objektzuordnungen, Status und Terminverknüpfungen. Alte Backups ohne Auftragsdaten bleiben einlesbar.

Automatisierte Tests decken wöchentliche Jahresverträge (52 Termine), monatliche Wiederholung, Einmalauftrag, Werktagslogik, abgesagte Termine, 70-%-Erinnerung, freie Zusatzstunden, den Abschlussstatus, das Reporting und den JSON-Export/Import ab.

**Noch nicht enthalten:**
- Kein Angebotsgenerator, keine Kundenpreise, Lohn-/Material-/Fahrtkosten oder Gewinnberechnung.
- Kein automatischer Versand, keine CRM-Integration und keine Handy-PC-Synchronisierung.
- Kein manipulationssicheres Mitarbeiter-Login-Protokoll.
- Der reguläre Windows-Electron-Installer bleibt mangels digitaler Signatur bzw. aufgrund bisheriger Chrome-Malwarewarnung ohne Freigabe für reguläre Installation. Ein erfolgreicher GitHub-Build ist keine Malware-Freigabe.

**Vor Installation:** Bestehenden lokalen Datenbestand immer erst als JSON sichern. Diesen PR erst nach erfolgreichen Funktionstests und Abnahme in `main` zusammenführen.
