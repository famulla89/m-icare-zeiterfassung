# M-iCare 1.3.1 – Bedienhilfe zum Angebotsrechner

## 1. Unbedingt zuerst: Was wird wirklich gereinigt?

**Objektart** = Was ist das Gebäude? (Büro, Praxis, Industrie, Treppenhaus, Privathaus usw.).

**Leistungsart** = Was hat der Kunde tatsächlich beauftragt?

| Leistungsart | Räume/Boden in m² | Fensterarten/m² | Mitarbeiterstunden |
| --- | --- | --- | --- |
| **Nur Räume/Gebäude** | werden kalkuliert | werden NICHT berechnet | falls 0: aus Raumfläche/m² pro Stunde |
| **Nur Fenster/Glas** | werden NICHT berechnet | werden einzeln kalkuliert | Kostenprüfung; von dir schätzen |
| **Räume und Fenster** | werden kalkuliert | zusätzlich einzeln | für Raumleistung schätzen; Fensterverkaufspreis inkl. Fensterarbeit |
| **Sonstige Leistung** | werden NICHT automatisch berechnet | werden NICHT berechnet | eigene Stunden angeben |

**Beispiel:** Ein Büro mit 200 m² beauftragt nur zehn Fenster à 1,5 m². Wähle **Nur Fenster/Glas**. Es werden 15 m² Glas mit deinem eigenen €/m²-Preis berechnet – die 200 m² Büro sind **keine** Reinigungsleistung. Für ein anderes Beispiel „Sonderreinigung der Maschine“ wähle **Sonstige Leistung** und erfasse die Stunden.

**AK-Verknüpfung:** Bei einer Glas-/Fenster-AK wird der Modus „Nur Fenster“ automatisch vorgeschlagen. Bei anderen Aufträgen bleibt die Wahl jederzeit änderbar.

## 2. Kostenbasis – alle Eingaben erklärt

- **Betrieb/Personal**: Stundenlohn deiner Mitarbeiter plus angesetzte Lohnnebenkosten.
- **Solo**: Du arbeitest allein; dein eigener angesetzter Stundenlohn gilt, ohne Mitarbeiter-Lohnnebenkostenaufschlag. Das ist eine Planannahme, keine steuerliche Beratung.
- **Reinigungseinsätze im Abrechnungszeitraum**: Wenn eine monatliche Reinigung zweimal pro Woche stattfindet, rechnest du beispielhaft 8 Termine/Monat; bei einem einmaligen Fensterputzen 1 Termin. Fensterpreise werden pro Einsatz berücksichtigt.
- **Arbeitsstunden pro Einsatz**: **2** steht für 2 Stunden, **0,5** für 30 Minuten. **50** bedeutet tatsächlich 50 Stunden, **nicht 50 Minuten**. Falls die Arbeitsleistung von mehreren Mitarbeitern zusammenkommt, die Summe der Arbeitsstunden passend angeben.
- **Leistung m²/Stunde**: Nur für Räume relevant, wenn du bei Stunden 0 einträgst. Beispiel: 200 m²/100 m² pro Stunde = 2 Stunden. Bei „Nur Fenster“ und „Sonstige Leistung“ spielt die Raumflächenleistung keine Rolle; es muss nicht 0 eingetragen werden, das Feld wird ausgeblendet.
- **Bruttostundenlohn (€)**: Kostenansatz pro Arbeitsstunde; **nicht** der Preis, den du dem Kunden berechnest.
- **Lohnnebenkosten (%)**: angenommener Zuschlag, z. B. 20 %. Bei Solo im aktuellen Rechenmodell nicht berücksichtigt.
- **Gemeinkosten/Verwaltung (%)**: Zuschlag für Organisation, Versicherungen usw. auf die kalkulierten Einsatzkosten.
- **Produktivität (%)**: Bei 90 % wird mehr Arbeitszeit kalkuliert als reine produktive Reinigung (Arbeitskosten / 0,90).
- **Materialkosten pro Einsatz (€)**: z. B. Reiniger und Tücher; bei 8 Einsätzen achtmal.
- **Anfahrt einfach (km)** und **Kosten je gefahrenem km (€)**: 8 km einfache Strecke × 2 Fahrtrichtungen × 0,70 €/km = 11,20 € pro Einsatz.
- **Rüst- und Abbauzeit (Minuten)**: z. B. 15 Minuten werden als 0,25 Stunden pro Einsatz mit deinem Stundensatz kalkuliert.
- **Hebebühnenmiete (€)**: optionaler separater Betrag, zusätzlich zu den Arbeitskosten.
- **Mindestpreis pro m² (€)**: bei Räumen je Raum-m², bei „Nur Fenster“ je Gesamt-Glas-m². Wird mit der Einsatzzahl berücksichtigt. Bei sonstiger Stundenarbeit nicht relevant.
- **Gewinnaufschlag (%)**: Zuschlag auf interne Kostenschätzung. Alternativ fester Gewinnaufschlag +50/+75/+100 € oder frei; „Prozentual“ stellt wieder auf den Prozentsatz.
- **Mindestpreis netto (€)**: absolute Preisuntergrenze für den gewählten Abrechnungszeitraum, 0 = keine.
- **Eigener Netto-Gesamtpreis (€)**: wenn nicht 0, entscheidet DEIN Preis; M-iCare verteilt ihn in PDF-Positionen. Aufschläge sind dann nur Kalkulationshilfen, kein zusätzlicher Rechnungsbetrag.
- **Umsatzsteuer**: erst auf den Nettobetrag gerechnet. 7 % / 0 % nur mit rechtlich zutreffendem Grund wählen.

## 3. Fensterarten und Größen wie auf den Screenshots

Du kannst mehrere Fensterarten hinzufügen. Je Fensterart: Anzahl, **m² pro Stück selbst bestimmen**, Preis pro m²/Seite, ein- oder beidseitig, Verschmutzungsgrad (normal/erhöht/stark), Rahmen und Falz, Leiter, Hebebühne. Weitere Art hinzufügen, bei Bedarf entfernen, maximal acht Positionen. Jede Position taucht im gespeicherten Kostenvoranschlag auf.

**Wichtig zur Preislogik:** Der **Fensterpreis in €/m²** ist ein **Verkaufspreis**, der das Fensterputzen bereits abdecken soll. Die eingetragenen Arbeitsstunden schätzen die **internen Kosten** und können den nötigen Mindestpreis sichtbar machen. Bei „Nur Fenster“ wird das Büro NICHT mitberechnet und der Fensterlohn NICHT als zweite Reinigungsposition berechnet. Wenn die intern erforderlichen Kosten höher als der m²-Preis liegen, wird ein Kalkulationsausgleich bis zur Kosten-/Gewinnuntergrenze ausgewiesen. Mit „eigener Nettopreis“ bleibt jederzeit ein bewusst bestimmter Festpreis möglich.

## 4. PDF, Kunde und Arbeitskarte

Kunde → Objekt → optional Arbeitskarte auswählen, Leistung erklären, Preis prüfen, Kostenvoranschlag/Rechnungsentwurf mit Firmendaten erstellen. PDF enthält Positionen, Netto, Steuer und Gesamtpreis. **Rechnungsentwurf ist keine rechtlich geprüfte Rechnung**. Vor Versand müssen Dokumentangaben/steuerliche Pflichten geprüft werden.

## 5. Prüfen

1. Büro (200 m²) + Auftrag nur zehn Fenster à 1,5 m² mit 4 €/m² einseitig → ohne interne Zusatzkosten **60 € netto** für Glas, **keine Raumreinigung**.
2. Gleicher Auftrag, Arbeitszeit/Anfahrt/Material eingeben → App prüft, ob 60 € zur Deckung deiner eigenen Kosten reichen.
3. Räume: 200 m², 100 m²/h, Stunden 0 → 2 Stunden vor Rüstzeit/Produktivität.
4. Sonstige Leistung: 3 Stunden, 15 Minuten Rüstzeit → 3,25 Stunden.
5. Räume und Fenster → beide Leistungsarten separat im PDF.
6. Eigenen Netto-Gesamtpreis setzen, PDF prüfen, speichern, später wieder öffnen.
7. Vor Android-Update bestehende Daten extern als JSON sichern. Google-Drive-Backup ist weiterhin keine automatische Hintergrundsynchronisierung.
