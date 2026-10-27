# M-iCare 1.9.13 – Betriebszentrale und sichere Arbeitsabläufe

**Stand 27.10.2026 · Testversion (PR #41), noch keine Produktivfreigabe.**

## Was neu ist

### 1. Tagesübersicht und Kennzahlen
Die Startseite zeigt tatsächliche geplante AK-Einsätze von heute inklusive Uhrzeit, Kunde, Objekt, AK-Nummer und Status. Jeder Eintrag führt zur Dokumentation oder Auftragsakte. Die Kennzahl **Termine · 30 Tage** zählt reale Terminereignisse in den nächsten 30 Kalendertagen, nicht bloß gespeicherte Serien. Kunden und Objekte werden als aktive Datensätze gezählt. Die bisherigen klickbaren Kennzahlen bleiben erhalten.

### 2. Auftragsakte
Unter **Aufträge & Kalender → Auftragsakte öffnen** lassen sich angenommene Angebote und ihre AKs suchen. Die Akte zeigt vereinbarte Leistungen, Kunden, Objekt, erledigte und offene AKs, Leistungen sowie bereits erstellte Rechnungen. Bestehende Bearbeitung, Kalender und Rechnungserstellung werden verlinkt – **keine neue, parallele Datenbank**. Nicht angenommene Angebote sind keine Aufträge.

### 3. Zahlungsjournal / offene Posten
**Rechnungen & Finanzen → Zahlungen und offene Posten öffnen**. Die separate Maske zeigt nur endgültig erstellte Rechnungen. Jeder manuell bestätigte Geldzufluss bekommt Datum, Betrag und optionalen Buchungstext. Centgenaue Teilzahlungen sind möglich; die Summe darf den offenen Bruttobetrag niemals überschreiten. Ein Storno erfordert einen Grund, der ursprüngliche Datensatz bleibt als Historie erhalten.

Zahlungsstatus: **Offen, Überfällig, Teilbezahlt, Bezahlt**. *Rechnung erstellt* ist nicht *Zahlung erhalten*. Zahlungsstatus wird aus Buchungen berechnet und verändert das unveränderbare Rechnungsdokument nicht.

Bei überfälligen Beträgen erscheint **Zahlungserinnerung**. Diese öffnet **nur eine kopierbare Textvorlage** mit Rechnungsnummer, Fälligkeit und aktuellem Restbetrag. **Kein automatischer Mailversand.** Zahlungsdetails stets gegen Kontoauszüge prüfen. M-iCare ist kein direkter Bankabgleich oder vollständiges Buchhaltungssystem.

### 4. Kalender
Bestehende Farben bleiben: Frei (hellblau), Offen (grün), Erledigt (blau), gemischt (orange), unverbindlicher Angebotsentwurf (lila). Die Legende erklärt sie. Geplante Zeitüberschneidungen desselben Mitarbeiters bekommen zusätzlich eine rote Umrandung mit Ausrufezeichen. Das ist **kein Nachweis** für tatsächlich doppelte Arbeit; die Ist-Zeiten separat kontrollieren. Terminserien und Datumskorrekturen weiterhin über die vorhandene AK-Bearbeitung vornehmen.

### 5. Arbeitskarten-Checkliste
Eine geplante AK öffnen, den Bereich **Leistungscheckliste ausfüllen** aufklappen, tatsächlich erledigte Aufgaben markieren und **Ausgewählte Arbeiten übernehmen**. Die Angaben werden in das bestehende Feld *Durchgeführte Arbeiten* übernommen und erst beim Speichern dauerhaft dokumentiert. Jede Angabe vor Abschluss prüfen. Die bisherige Korrekturhistorie bleibt erhalten.

**Noch nicht umgesetzt:** Fotobelege und digitale Kundenunterschriften. Sie benötigen eigene Größen-, Datenschutz-, Langzeitarchivierungs- und PDF-Tests und gehören nicht ungeprüft in Kundendaten.

### 6. Leistungsvorlagen
Unter **Kostenvoranschläge → Leistungsvorlagen** können Leistungsart, Beschreibung, Objektart, Fläche sowie Start-/Enduhrzeit gespeichert und erneut übernommen werden. *Kunden, Preise, Steuern und tatsächliche vereinbarte Termine werden niemals ungeprüft aus einer Vorlage übernommen.* Vor jeder Erstellung Angebot erneut kalkulieren und prüfen. Vorlagen verändern keine bereits angenommenen Aufträge.

### 7. Sicherungen und Wiederherstellung
Die Startseite zeigt, ob eine neue externe Sicherung nötig ist. Eine vollständige JSON-Sicherung enthält nun zusätzlich:
- `payments`: bestätigte Zahlungen samt Storno-Historie;
- `quoteTemplates`: eigene Leistungsvorlagen.

Beim JSON-Import werden diese Daten inklusive Rechnungsreferenzen, Centwerten und Vorlagen vor der Übernahme validiert. Der verschlüsselte Sicherungsimport zeigt nun auch Unterschiede in **Zahlungen** und **Leistungsvorlagen**. Frühere, ältere Sicherungen ohne diese zwei Felder bleiben kompatibel, setzen diese neuen Bereiche jedoch leer. Deshalb vor jedem Restore eine aktuelle **Vollsicherung der aktiven App** erstellen und das Ergebnis prüfen.

**Keine automatische Synchronisierung, keine gemeinsame zentrale Rechnungsnummernvergabe, kein Cloud-Abgleich.** Die bereits vorhandene manuelle verschlüsselte Dateiübergabe bleibt optional. Nicht auf zwei Geräten gleichzeitig unabhängige Rechnungen für denselben Auftrag erzeugen.

## Beispiel: Kunde bis Zahlung
1. Kunde und zugehöriges Reinigungsobjekt anlegen.
2. Optional eine Leistungsvorlage laden; Preise, Umfang und Termine **neu prüfen**.
3. Kostenvoranschlag erstellen, vom Kunden bestätigen lassen, Angebot annehmen.
4. Im Kalender die daraus erzeugten offenen AKs prüfen; rote Konflikte beheben.
5. Am Einsatztag die AK aus der Tagesübersicht öffnen, Zeiten, Checkliste und Durchführungsbericht erfassen und abschließen.
6. In **Rechnungen** eine abrechenbare Teilrechnung oder am Ende die Schlussrechnung mit vollem Leistungsnachweis prüfen und **bewusst endgültig erstellen**.
7. Erst wenn das Geld tatsächlich eingegangen ist, unter **Zahlungen und offene Posten** buchen. Teilzahlungen werden aufaddiert, eine Überzahlung abgewehrt.
8. Vollständige JSON-Sicherung oder verschlüsselte Datei exportieren. Den Backup-Import mit **Testdaten** überprüfen.

## Tests und Freigabe
Automatisierte Tests: `tests/operations-core-smoke.cjs`, `tests/operations-ui-e2e.cjs` sowie die vorhandenen Authentifizierungs-, Abrechnungs-, AK-, Kalender-, PDF-, Reporting- und Backup-Tests. Windows-Installer und Android-Debug-APK werden in GitHub Actions gebaut; Artifact-ZIPs stehen in den jeweiligen Runs.

**Vor produktivem Einsatz am Windows-PC und Android-Handy manuell testen:** echte Geräteoberflächen, Kalenderfarbe, Login/Sperren, Arbeitskarten, Datenherkunft, PDF-Druck, Export und Wiederherstellung, Zahlungen und Storno, große Datenbestände, Tastatur und mobile Eingabefelder. Unsigned Windows-Testbuild und Debug-APK sind **nicht signierte Produktiv-Releases**. Für echte Steuerrechnungen steuerliche Pflichtangaben gegen geltende Vorschriften prüfen.

GitHub-Entwicklungszweig: `feature/structured-workflow-dashboard-20261027`. PR: https://github.com/famulla89/m-icare-zeiterfassung/pull/41
