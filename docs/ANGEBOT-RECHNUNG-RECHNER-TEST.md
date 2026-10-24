# M-iCare 1.3.0: Kalkulationsrechner – Anleitung & Prüffälle

**Zweck:** Für die Reinigungsfirma eine **unverbindliche Preis-/Kostenkalkulation** je Kunde und Arbeitskarte durchführen. Daraus einen **PDF-Kostenvoranschlag** oder ausdrücklich gekennzeichneten **Rechnungsentwurf** machen. Alles bleibt auf dem Gerät gespeichert und wird bei JSON-Vollsicherungen mitgenommen.

## Wo finde ich den Rechner?

Startseite → **🧮 Angebot & Rechnung**.

### 1. Kunde, Geschäftsstelle und Arbeitskarte
- Kunde wählen, dann passende Geschäftsstelle/Objekt wählen.
- Optional eine bereits vorhandene Arbeitskarte auswählen; die Reinigungsleistung und das Datum werden übernommen.
- Art des Objekts (Büro, Praxis, Treppenhaus, Industrie, Privathaus, Einzelhandel, Andere) bestimmen und Fläche in m² eingeben. Schnellwahlen 50 / 100 / 200 / 500 / 1000 m².
- WC / Sanitär, Küche und hohe Frequentierung als separate Aufwandfaktoren ankreuzen.

### 2. Eigene Preis- und Kostenannahmen
- Betriebsmodus **Betrieb/Personal** oder **Solo** (Solo lässt die angesetzten Lohnnebenkosten auf den eigenen Arbeitslohn bei der Schätzung weg).
- Anzahl Einsätze im Abrechnungszeitraum, Stunden je Einsatz (oder 0 = Flächenleistung m²/h), Bruttostundenlohn, Lohnnebenkosten %, Gemeinkosten %, Produktivität %, Materialkosten je Einsatz.
- Anfahrt einfach (km), Kostensatz/km, Rüst- und Abbauzeit pro Einsatz in Minuten sowie optionaler Hebebühnen-Mietpreis.
- Gewinn als **Prozentaufschlag** oder als fester Betrag **+50 €, +75 €, +100 €**, oder frei eingeben.
- Mindestpreis pro m² und Mindest-Gesamt-Netto-Preis.
- Individueller **Netto-Gesamtpreis** überschreibt den Preisvorschlag, damit der Inhaber die angebotene Summe selbst bestimmt.

**Kalkulationswerte sind Vorschläge und keine gesetzlichen oder brancheneinheitlich verbindlichen Preise.** Für geringfügige Beschäftigung, Solo-Unternehmertum und Personalkosten sind tatsächliche Kosten selbst zu prüfen.

### 3. Fensterarten – wie auf den Beispiel-Screenshots
Fensterart hinzufügen: Standardfenster, große Glasflächen, Schiebeelemente, Sprossenfenster, Wintergarten oder Glasüberdachung. **Bis zu acht Fensterpositionen**.
Je Fensterposition separat:
- **Stückzahl** (ganze Zahl), **Fläche pro Fenster m²** (beliebig einstellbar), **Preis/m²/Seite**.
- **Einseitige oder beidseitige** Reinigung.
- **Normal, erhöht, stark** verschmutzt.
- **Rahmen & Falz**, **Leiter** und **Hebebühne** als unabhängige Zuschläge, auch kombiniert.
- Löschen einzelner Positionen ist möglich. Alle Positionen, Größen und Zuschläge werden im gespeicherten Entwurf wiederhergestellt.

### 4. Angebot oder Rechnung
- Dokumenttyp **Kostenvoranschlag** oder **Rechnungsentwurf** wählen.
- Dokumentnummer, Leistungsdatum / Zeitraum, Gültigkeit/Zahlungsziel, Firmenname, Anschrift, Steuernummer/USt-ID, Kontaktdaten und ggf. IBAN ergänzen.
- Standardmäßig 19 % USt.; 7 % oder 0 % nur auswählen, wenn steuerlich korrekt.
- **Entwurf speichern** speichert alle Preisannahmen, Fensterpositionen, Kunde/Objekt/Arbeitskarte und Berechnung in `state.quotes`. Entwurf kann später erneut geöffnet werden.
- **PDF-Entwurf erstellen** erzeugt PDF mit Kundenzuordnung, AK, Leistungen, Fensterpositionen, Netto/USt/Brutto und einem Hinweis auf noch nötige Prüfung. Bei mehreren Fensterpositionen mehrseitig.
- Rechnungen werden **nicht** automatisch an Kunden gesendet. Sie sind **nur Rechnungsentwürfe**. Kein GoBD-System, kein E-Rechnungsformat, keine verbindliche steuerliche Prüfung.

## Wichtige Tests
1. 200 m² Büro + WC, Küche, starke Nutzung: Zeit-/Kostenänderung prüfen.
2. 5 Standardfenster à **1,8 m²**, einseitig, normal, Rahmen/Falz; plus 2 große Glasflächen à **4,0 m²**, beidseitig, erhöht, Leiter; beide Positionen getrennt sichtbar.
3. +75 € Festgewinn aktivieren; danach eigenen Nettopreis von 950 € setzen. Umsatzsteuer und Gesamtbetrag kontrollieren.
4. Kunde, Geschäftsstelle und optional AK auswählen; Entwurf speichern, Rechner verlassen und erneut öffnen. Fenstergrößen müssen gleich sein.
5. PDF mit mehreren Fensterarten exportieren; Dateiname, PDF-Signatur, alle Positionen und Beträge kontrollieren.
6. JSON-Vollsicherung exportieren und auf Testgerät einlesen: `quotes` und `quoteSettings` müssen erhalten bleiben.
7. Android-Test-App ist **separat** installiert, nicht über die bisherige reguläre Android-App.
8. Windows-Installer ist **nicht signiert**; erst mit synthetischen Kundendaten testen.

## Aktueller Stand
M-iCare 1.3.0 Testfunktion, gespeichert lokal, keine automatische Google-Drive-Synchronisierung und keine produktive Buchhaltung.
