# M-iCare – Gesamttest-Checkliste (Android / Windows)

Stand: 2026-10-23. Alle Tests auf **beiden Geräten** mit einer separaten JSON-Testdatei durchführen. Testergebnis jeweils: PASS / FAIL / NICHT GETESTET, Screenshot und Versions-/Commitnummer notieren.

## Installation und Start
- [ ] APK/EXE vom gleichen Commit; Offline-Start; Navigation aller Startseiten-Buttons; Zurück/Home
- [ ] App beenden/neustarten: Daten bleiben erhalten
- [ ] Update über vorhandene Installation ohne Datenverlust; bei Versionswechsel keine neuen leeren Datenbanken

## Kundenverwaltung
- [ ] Kunde neu anlegen: automatische eindeutige K-Nummer, unveränderliche technische UUID
- [ ] Kunde bearbeiten: gleiche K-Nummer, Name und Adresse korrekt
- [ ] Neue Geschäftsstelle: eindeutige O-Nummer; zweite/dritte Geschäftsstelle dem richtigen Kunden zugeordnet
- [ ] Objektadresse mit PLZ/Ort korrekt übernehmen; Objekt bearbeiten ohne Nummernwechsel
- [ ] Archivieren, Filter Aktiv/Archiviert/Alle, Reaktivieren, Löschen mit verknüpften Terminen
- [ ] Suche nach Kundenname/K-Nummer/Objekt/O-Nummer/Ort; Spezialzeichen; leerer Treffer
- [ ] Kundenliste-PDF mit 1, 10, 50 Kunden und langen Adressen; Seitenumbruch; Filter stimmt

## Termine und Kalender
- [ ] Einzel-, Wochen-, Monats-, Arbeitstags- und Wochentagsserie; Enddatum und Intervall
- [ ] Verschobener Einzeltermin, abgesagter Termin, Überschneidung gleicher Mitarbeiter
- [ ] Zeitfelder: manuelle Eingabe, Uhr-Picker, Übernehmen, Änderung tatsächlich gespeichert
- [ ] Kalenderfarben: grau ohne, grün nur offen, blau nur erledigt, orange gemischt; Anzahl pro Tag
- [ ] Archivierter Kunde und mehrere Objekte: Auswahl und vorhandene Termine korrekt

## Arbeitszeiten und Auftragsstatus
- [ ] Neuen Arbeitszeiteintrag speichern, ändern, löschen; Pausenberechnung; Datum-/Nachtüberlauf
- [ ] Status Offen/Erledigt/In Bearbeitung/Abgebrochen/Kunde nicht da und Mitarbeiterzuweisung
- [ ] Eindeutige Terminverknüpfung und keine doppelte Abrechnung derselben Wiederholung
- [ ] Zeiten und Mitarbeiter in den PDFs entsprechen den gespeicherten Daten

## Auswertung/PDF
- [ ] Tag/Monat/Jahr; kompletter Monat/Jahr; jeweilige Grenzen; Jahreswechsel
- [ ] Alle Kunden vs. Einzelkunde; Alle Status vs. Einzelstatus; Summen = angezeigte Datensätze
- [ ] Status-PDF enthält alle gefilterten Termine, keine abgesagten Wiederholungen; 0/1/12/13/50 Datensätze
- [ ] Kunde, Geschäftsstelle, Straße, PLZ/Ort aus dem passenden Objekt
- [ ] PDF A4-Querformat, Datum/Uhrzeit lesbar, keine abgeschnittenen Spalten, Seitenanzahl und Tabellenkopf
- [ ] Arbeitszeiten-PDF und Kundenlisten-PDF getrennt, jeweils druckbar unter Android und Windows

## Sicherung und Sicherheit
- [ ] JSON-Vollsicherung exportieren und importieren; gleiche Anzahl Kunden/Objekte/Termine/Einträge
- [ ] Nummern und UUID-Verweise bleiben nach Export/Import erhalten
- [ ] Archivierte Datensätze, Historie und Termin-Ausnahmen werden mitgesichert
- [ ] Vor Überschreiben Warnung und eigene Sicherung; Abbruch ändert nichts
- [ ] Ungültiges JSON, übergroße Datei, manipulierter HTML-Text, defekte Objektverweise sicher behandeln
- [ ] Offline testen und danach Browser/App wieder öffnen

## Ergebnis
| Bereich | Android | Windows | Fehler / Screenshot |
|---|---|---|---|
| Installation / Start | NICHT GETESTET | NICHT GETESTET | |
| Kunden / Objekte | NICHT GETESTET | NICHT GETESTET | |
| Termine / Kalender | NICHT GETESTET | NICHT GETESTET | |
| Arbeitszeiten / Status | NICHT GETESTET | NICHT GETESTET | |
| PDFs | NICHT GETESTET | NICHT GETESTET | |
| JSON / Offline | NICHT GETESTET | NICHT GETESTET | |

**Hinweis:** Syntaxprüfung ist kein Funktions- oder Geräte-Endtest. Testdaten niemals ungeprüft in produktive Kundendaten importieren.
