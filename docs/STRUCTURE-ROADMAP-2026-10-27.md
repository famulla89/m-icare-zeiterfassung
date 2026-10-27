# M-iCare Struktur-Umbau – Plan und Freigabekriterien (27.10.2026)

**Status:** Entwicklung, nicht produktiv freigegeben. Der bestehende Datenbestand und die bisherigen Masken werden zunächst nicht migriert oder gelöscht.

## Zielablauf
Kunde → Geschäftsstelle → Angebot → Annahme → Auftrag/Terminserie → offene Arbeitskarten → dokumentierte Arbeit → Teil-/Schlussrechnung → Zahlung → Controlling.

## Phase 1 – Arbeitszentrale (in Umsetzung)
- Startseite: Kunden-, Termin-, Arbeitszeit- und AK-Kennzahlen sowie Direktaktionen.
- Bestehende Kunden-, Angebots-, Kalender- und Rechnungsfunktionen bleiben erreichbar.
- Freigabe: Browser-E2E, Navigation, Datensicherung und Bestandsdaten ohne Regression.

## Phase 2 – Kundenakte / Objekte
- Alle Angebote, Aufträge, Termine, Rechnungen und Kontakte über stabile Kunden- und Objekt-IDs auf einer Ansicht.
- Datenübernahme aus Kundenanschrift, Duplikat-/Datenqualitätskontrolle, archivierte Kunden korrekt behandeln.
- Freigabe: Anlegen/Bearbeiten mehrerer Geschäftsstellen, Archiv, Import/Export, Filtertests.

## Phase 3 – Mitarbeiteransicht / Arbeitskarten
- Eigene reduzierte Sicht für „Meine heutigen Einsätze“; Status, Plan-/Ist-Zeit, Leistungsnachweis.
- **Wichtig:** Eine reine UI-Umschaltung ist keine Berechtigungskontrolle. Erst Datenzugriffs-/Rollenprüfung bauen, bevor Mitarbeiter Zugriff auf dieselben Daten bekommen.
- Freigabe: Nicht berechtigte Felder server-/datenmodellseitig gesperrt, Offline-Einträge konfliktfrei.

## Phase 4 – Aufträge, Kalender und Fortschritt
- Auftrag als Elternobjekt mit 1..n AK, direkter Termin-/AK-Navigation, Fortschritt fertig/gesamt.
- Serientermine und Verschiebung mit Änderungsprotokoll; vereinbarte Leistung und Ist-Leistung getrennt.
- Freigabe: Wiederholungen, Feiertags-/Zeitzonenfälle, Überschneidungen, Doppel-Abschluss verhindert.

## Phase 5 – Rechnungen / Finanzen
- Eigene Statusmaschine: Entwurf → erstellt → versendet → offen/teilbezahlt → bezahlt bzw. storniert.
- Teilrechnung und Schlussrechnung mit nachvollziehbarer Referenz; niemals doppelt fakturieren.
- Freigabe: steuerliche Felder, Rechnungsnummern, Zahlungseingänge, Gegenbuchungen, PDF, Centgenauigkeit.

## Phase 6 – Vorlagen und Reporting
- Wiederverwendbare Leistungspakete; keine Preis-/Zeitänderung bestehender angenommener Angebote.
- Soll-/Ist-Analyse und (nur mit echten Kostendaten) Deckungsbeiträge.
- Freigabe: Kostenarten, Filter, CSV- und PDF-Parität, keine erfundenen Margen.

## Phase 7 – Sicherung, Sicherheit, Synchronisierung
- Offline-Backup mit Versionsformat, Importvorschau, Validierung und Rollback.
- Geräteübergreifende Synchronisierung erst mit Authentifizierung, Konfliktauflösung, Idempotenz und zentraler Rechnungsnummernvergabe.
- Lokale Anmeldung ist **keine Datenverschlüsselung**; vertrauenswürdige Geräte und Biometrie gesondert prüfen.
- Freigabe: Datenverlust-/Konflikt-/Manipulations-/Offline-Tests, Android und Windows Ende-zu-Ende.

## Testmatrix vor Freigabe
- Neuinstallation und Update ohne Datenverlust
- Kunden/Objekte/Angebote/AK/Rechnungen vollständig durchspielen
- PDF/CSV, Datensicherung und Wiederherstellung
- Dateiansichten, mobile Eingabefelder, Android WebView, Windows Installer
- Fehlerhafte Eingaben, doppelte Klicks, Offline/Online-Wechsel
- Echter Praxistest auf Samsung und Windows – ein grüner CI-Lauf ersetzt diesen nicht

**Nicht enthalten:** Ein fertiger Sync-Server, echte Rollenberechtigungen, eine vollständige Finanzbuchhaltung oder garantierte Push-Benachrichtigungen. Diese Komponenten müssen vor produktiver Nutzung gesondert implementiert und validiert werden.
