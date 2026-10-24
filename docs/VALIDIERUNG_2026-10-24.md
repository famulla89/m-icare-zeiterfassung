# M-iCare – Funktions- und Ablaufvalidierung (24.10.2026)

**Prüfstand:** Feature-Branch `feature/audited-order-corrections-20261024` (PR #24, basiert auf den noch offenen PRs #20, #22 und #23).  
**Wichtig:** Automatisierte Tests mit synthetischen Daten sind **keine vollständige Produktivfreigabe**.

## 1. Prüfziele und Methodik

- **Quelltext-/Regressionsprüfung:** Inline-JavaScript-Syntax, eindeutige IDs, Datenaggregation und Filter.
- **Funktionale Unit-Tests:** Datum, Zeit, Pausen, Nachtschicht und alle Termin-Wiederholungsmuster.
- **Auftragskorrektur-Tests:** vorhandenen Auftrag korrigieren, Pflichtgrund, Vorher-/Nachher-Werte, mehrmalige Korrekturen, Doppelanlage verhindern.
- **Echter Chromium-Test:** Benutzeroberfläche über einen lokalen Webserver öffnen, echte Klicks/Eingaben durchführen und Zustandsänderungen kontrollieren, CSV und PDF erzeugen, JSON sichern/wiederherstellen.
- **Windows-Paketierung und Sicherheitsstatus:** der Windows-Workflow mit Electron 45 hat `npm audit` mit 0 gemeldeten Sicherheitslücken abgeschlossen. Das ist keine Malware- oder Signaturfreigabe.

## 2. Bestätigte Prüfungen

| Modul | Testfälle | Ergebnis |
|---|---|---|
| App-Start und Navigation | Start, Kundenübersicht, Kundenverwaltung, Reporting, Sicherung | ✅ Automatischer Chromium-Test |
| Kundenstamm | Testkunden anzeigen, neuen Kunden mit Adresse erstellen, Kundennummer, Kontakte bearbeiten | ✅ Chromium-Test |
| Geschäftsstellen | Objekt beim Kunden anlegen, Kundenzuordnung und Objektnummer | ✅ Chromium-Test |
| Terminplanung | Neuen Termin über Formular anlegen; Serien, Wiederholungsintervalle, Verschiebung, Absage | ✅ Chromium + Unit |
| Datum/Zeit | Gültige/ungültige Datumswerte, Uhrzeit, Pause, Start/Ende, Nachtschicht | ✅ Unit |
| Freie Arbeitszeit | Freien Einsatz eintragen, Netto-Minuten kontrollieren | ✅ Chromium-Test |
| Kalender | Freie Arbeitszeit im Monatskalender/Tagesdetail anzeigen | ✅ Chromium-Test |
| Abgeschlossener Auftrag | Vorhandenen Eintrag öffnen, Status ändern, ohne Korrekturgrund blockieren | ✅ Chromium + Unit |
| Korrekturprotokoll | Pflichtgrund, Vorher-/Nachher, Korrekturzeit, weitere Korrekturen, keine Doppelanlage | ✅ Chromium + Unit |
| Reporting | Berichte öffnen, Kunde suchen/auswählen, filterbasierte Aggregation | ✅ Chromium + Unit |
| Exporte | Berichtstabellen-CSV laden, Print/PDF über Chromium erzeugen | ✅ Chromium-Test |
| Datensicherung | Vollsicherung als JSON herunterladen, später wiederherstellen, Änderungshistorie in Sicherung | ✅ Chromium-Test |
| Datenintegrität | Gleiche Kundennamen nicht zusammenfassen, Minuten korrekt summieren, Überschneidungen erkennen | ✅ Unit |
| Quelltextstruktur | Syntax und eindeutige HTML-IDs | ✅ automatisiert |

Automatisierte Nachweise:

- [Reporting- und Kernzeit-Regressionen](https://github.com/famulla89/m-icare-zeiterfassung/actions/runs/40098555710)
- [Chromium-E2E einschließlich Kunden, Terminen, CSV/PDF, Auftragskorrekturen und JSON-Restore](https://github.com/famulla89/m-icare-zeiterfassung/actions/runs/40099707664)
- [PR #24 – Änderungen und Tests](https://github.com/famulla89/m-icare-zeiterfassung/pull/24)

## 3. Bei der Validierung gefundene und korrigierte Probleme

1. **Bereits dokumentierte Aufträge:** Korrektur ohne nachvollziehbaren Grund beziehungsweise Fehlermeldung wegen bestehendem Eintrag. Jetzt den ursprünglichen Eintrag bearbeiten, Pflichtgrund auswählen und alte/neue Werte protokollieren. Kein zweiter Arbeitszeiteintrag.
2. **Kunden nach Neuanlage:** Die frisch angelegte Kundennummer war im Auswahlfeld noch nicht zuverlässig verfügbar. Der Kundeneditor wird jetzt **vor** der asynchronen Speicherung richtig zugeordnet. Damit funktionieren unmittelbare Folgeänderungen.
3. **Testautomatisierung:** Ein anfänglicher Kalender-Check verwendete den Browser-Text einer ausgeblendeten Ansicht und lieferte einen Fehlalarm; der korrekte DOM-Inhalt bestätigte, dass die freie Arbeitszeit angezeigt wurde. Der Test wurde entsprechend berichtigt.
4. **PDF-Druck des Reportings:** Druckregeln auf A4 Hochformat und nur den geöffneten Bericht beschränkt. Erzeugung im Chromium-Test bestätigt, aber Druckerabhängigkeit bleibt zu prüfen.

## 4. Noch nicht vollständig freigegeben

- **Android-Smartphones/iPhone:** Spracheingabe, nativer Android-Speicherdialog, Datum-/Uhrzeit-Picker, Berechtigungen und Bildschirmdarstellung auf mehreren realen Geräten.
- **Windows Electron-Installer:** Nach dem Electron-Upgrade gebaut, aber **nicht digital signiert**; Chrome hatte den bisherigen ZIP/EXE-Download als schädlich gemeldet. Ein erfolgreicher Sicherheitscheck allein entkräftet diese Einstufung nicht. Ausführung erst nach sicherer Freigabe.
- **Echter Drucker und PDF-Layout:** Berichte müssen auf mindestens einem Windows-PC in Druckvorschau und A4 geprüft werden; unübersichtliche lange Tabellen und Seitenwechsel können weiterhin vom Datenumfang abhängen.
- **Extremfälle:** Sehr große JSON-Sicherungen, tausende Terminserien, Datenschutz-/Backup-Berechtigungen, Gerätedefekte und Wiederherstellung unter Speicherplatzmangel.
- **Geräte-Synchronisation:** **Nicht vorhanden.** Jeder lokale Datenbestand ist zunächst eigenständig. JSON-Export/Import ist nur ein manueller Datentransfer.
- **Audit-Identität:** Das Korrekturprotokoll hält Zeitpunkt, betroffenen Mitarbeiter, Korrekturgrund und Wertänderungen fest. Da keine Anmeldung existiert, lässt sich die tatsächlich bedienende Person **nicht sicher nachweisen**. Ein manipulationsgeschütztes serverseitiges Audit-Log gibt es nicht.

## 5. Manuelle Abnahme vor echten Kunden- und Arbeitszeitdaten

1. Testdaten als JSON sichern und anschließend auf einem zweiten Browserprofil wieder einspielen.
2. Einen Kunden mit vier Geschäftsstellen anlegen, Telefonnummer und E-Mail ändern, archvieren und reaktivieren.
3. Drei Termine am selben Tag anlegen, auch mit Überschneidung; einen verschieben, einen absagen.
4. Freie Arbeitszeit eintragen; Kalender und Tagesübersicht sowie Monatsbericht abgleichen.
5. Geplanten Auftrag abschließen, danach **„Aus Versehen abgeschlossen“** wählen, Status und Zeiten ändern; Korrekturverlauf kontrollieren.
6. Bericht für nur einen Kunden/Mitarbeiter/Objekt filtern; CSV und PDF unter Windows vergleichen.
7. PDF-Vorschau auf einer und mehreren Seiten prüfen, auf Papier A4 Hochformat testen.
8. Das signierte/freigegebene Windows-Installationspaket und den nativen Android-Export separat abnehmen.

## 6. Nächste Ausbaustufe

Die **Kostenrechnung** (Vertragspreise, Personalnebenkosten, Wege, Material, Geräte/Verschleiß, Fensterflächen) beginnt **erst nach** den offenen manuellen Freigabetests. Kosten werden ausdrücklich nicht aus bloßen Zeitangaben oder ohne belegte Mengen und Preisstammdaten geschätzt.


## 7. Zweite unabhängige Prüfrunde (24.10.2026)

Nach der ersten erfolgreichen Funktionsprüfung wurden weitere kritische Grenzfälle untersucht und korrigiert:

1. **Geplanten Auftrag auf einen anderen tatsächlichen Arbeitstag korrigieren:** Die Auftragsverknüpfung mit der ursprünglichen Terminserie bleibt bestehen. Datum/Uhrzeit-Abweichungen werden begründungspflichtig und im Korrekturprotokoll gespeichert.
2. **Kalender nach geänderter Ist-Datierung:** Das ursprüngliche Terminereignis bleibt im Kalender; die dokumentierte Arbeitszeit erscheint zusätzlich auf ihrem tatsächlichen Arbeitstag und wird nicht am selben Tag doppelt gezählt.
3. **Doppelte Speicheraktionen:** Während eines laufenden Speichervorgangs wird die Speichern-Schaltfläche deaktiviert. Weitere zeitgleiche Aufrufe werden ignoriert. Der Test wartet auf den tatsächlichen Abschluss vorheriger asynchroner Speichervorgänge, um reproduzierbare Ergebnisse zu liefern.
4. **Nachtschichtüberschneidungen:** Arbeitszeiten werden anhand von Start- und Enddatum einschließlich Uhrzeit verglichen. Eine Schicht 23:00–02:00 überschneidet sich beispielsweise mit 01:00–03:00 am Folgetag; direkt angrenzende Zeiten lösen keine Fehlwarnung aus.
5. **Ungespeicherte Formulardaten:** Telefonnummern, E-Mail, Kunden-/Objektauswahl, Auftragskorrekturbegründung und weitere neue Eingabefelder werden jetzt bei der Warnung vor nicht gespeicherten Änderungen berücksichtigt.
6. **Regressionstests erweitert:** Die Chromium-End-to-End-Prüfung testet Datumskorrektur bei zugeordneten Aufträgen, Anzeige am tatsächlichen Kalendertag, paralleles Speichern sowie das Erkennen ungespeicherter Kontaktdaten/Korrekturbegründungen. Der Kernzeittest prüft Schichten über Mitternacht und angrenzende Intervalle.

**Bestätigte GitHub-Nachweise für diesen Code-Stand:**

- [Chromium-Browser-E2E: erfolgreich](https://github.com/famulla89/m-icare-zeiterfassung/actions/runs/40102447247)
- [Reporting-, Zeiten- und Korrektur-Regressionen: erfolgreich](https://github.com/famulla89/m-icare-zeiterfassung/actions/runs/40102447292)

**Weiterhin keine Vollfreigabe:** Die Tests ersetzen weder echte Android-Geräte und native Speicherberechtigungen noch eine signierte Windows-Installation, Malware-Reputationsprüfung, realen mehrseitigen A4-Papierdruck oder Belastungsprüfungen mit sämtlichen denkbaren großen/fehlerhaften JSON-Datensätzen. Insbesondere ist das Audit-Protokoll ohne Benutzeranmeldung nicht manipulationssicher und kann die tatsächlich bedienende Person nicht verifizieren. Eine erfolgreiche Browserprüfung ist keine pauschale Aussage zur Sicherheit eines EXE-Downloads.
