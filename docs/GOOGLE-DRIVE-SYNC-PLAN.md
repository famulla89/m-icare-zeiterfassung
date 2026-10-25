# M-iCare: Google-Drive-Sicherung und Handy/Windows-Datenaustausch

**Status:** Architektur- und Testplan, **keine** bereits implementierte Cloud-Anbindung.  
**Ausgangspunkt:** Testbranch `feature/auftragskennungen-20261024`, Web-Oberfläche `index.html`, Android-WebView, Windows/Electron.  
**Ziele:** Lokal/offline nutzbar; vollständige Arbeitskarten-/Kunden-/Mitarbeiterdaten sicher sichern; kontrolliert auf zweitem Gerät übernehmen; keine stillen Überschreibungen; später echte bidirektionale Synchronisierung.

## Verbindliche Anforderung – Kunden-Self-Service statt Lizenzverwaltung (letzte Klarstellung)

**Diese Anforderung ersetzt die weiter unten dokumentierte, inzwischen verworfene Idee einer zentral vom M-iCare-Hersteller gepflegten Lizenz-/Freigabeliste.**

Der Hersteller konfiguriert bei der Einrichtung optional die gewünschte **Google-E-Mail-Adresse** des einzelnen Kollegen in dessen Android- und Windows-App (oder der Kollege wählt sie selbst). **Danach verwaltet der Kollege Google Drive und seine Backups eigenständig.** Der Hersteller braucht keine Drive-Freigabe, keinen Zugriff auf dessen Gmail, keine Passwörter und keinen zentralen Lizenz-/Cloud-Benutzerverwaltungsdienst.

**Richtiger Ablauf:**
1. Der Kollege hat oder erstellt selbst ein Google-Konto.
2. Android und Windows zeigen unter `Einstellungen → Google Drive` die konfigurierte E-Mail als Anmeldehinweis (kein gespeichertes Google-Passwort). Der Kollege öffnet mit `Google-Konto verbinden` die Google-eigene Anmeldung auf **jedem Gerät** und erteilt die Drive-Berechtigung selbst. Die OAuth-Antwort identifiziert das **tatsächlich** verbundene Konto; wenn eine E-Mail vorgegeben wurde, muss die App es damit abgleichen. Bloßes Eintippen der E-Mail liefert **keine** Berechtigung, auf den Google Drive zuzugreifen.
3. Nach Zustimmung sucht M-iCare im Drive des **angemeldeten Kollegen** einen eigenen, von M-iCare erstellten Ordner `M-iCare Sicherungen` bzw. erstellt ihn selbst. Im Ordner liegen verschlüsselte, versionierte Sicherungen der **Daten dieses Kollegen**.
4. Beide Geräte erkennen ihren eigenen verknüpften Google-Account-/Workspace-Stand und zeigen Datum/Anzahl der Backups; Sicherung, Abruf und Restore laufen mit dem Benutzerkonto des Kollegen. Es gibt **keinen** globalen M-iCare-Administrator mit Zugriff auf diese Dateien.
5. Offlinebetrieb bleibt lokal. Stufe A: Sicherung und Übernahme mit Cloudstand-/Konfliktprüfung. Erst Stufe B bietet automatischen, revisionsbasierten bidirektionalen Sync ohne Überschreiben paralleler Änderungen.

**Grenzen:** Eine voreingestellte E-Mail ist kein sicheres Lizenzsystem und verhindert das Weiterkopieren der EXE/APK nicht zuverlässig. Wenn ein separater App-Kopierschutz doch benötigt wird, ist das ein anderes Projekt. Google-Zugangstoken müssen auf beiden Geräten sicher gespeichert werden, **nicht** in Konfigurationsdateien. Für geschäftliche personenbezogene Daten braucht es die datenschutzrechtliche Prüfung und eine geeignete Konto-/Speicherumgebung.

---

## 1. Bestehende Architektur und konkrete Risiken

- `index.html` speichert `state` unter Schlüssel `app` in IndexedDB. `saveState()` mutiert `lastSave` und schreibt den kompletten Zustand; bestehende dateibasierte Backups sind optional.
- Das native Android `MainActivity.java` bietet `MiCareNative.saveJson/saveExport` und den Android-Dateidialog, aber **noch keine Drive-API-/Google-OAuth-Anmeldung**.
- Windows `windows-app/main.js` lädt `micare://app/index.html` in einem sandboxed Electron-Fenster mit `nodeIntegration:false` und `contextIsolation:true`. Derzeit fehlt eine minimal begrenzte Cloud-IPC-Schnittstelle.
- `importJson(ev)` validiert einige Pflichtfelder, verlangt Bestätigung und **ersetzt danach den gesamten lokalen Zustand**. Das darf nicht unverändert als automatische Synchronisation benutzt werden.
- `ensureOrderIdentifiers()` vergibt kurze numerische `AK`-Nummern lokal. Zwei Geräte können offline dieselbe Nummer vergeben. Maßgebliche technische Datensatz-ID muss die stabile UUID bleiben. Kein stilles Überschreiben/Umnummerieren.
- AK-Termine, Ist-Arbeitszeiten, Mitarbeiter, Kunden, Standorte und Korrekturprotokolle müssen gemeinsam übertragen werden. Nur `entries` zu übertragen würde Aufträge und Zuordnungen beschädigen.

## Präzisierung: Lizenzfreigabe per Kunden-E-Mail – genaues gewünschtes Produktverhalten

**Ziel:** Der M-iCare-Eigentümer kann die App an Kunden/Kollegen verteilen, deren **Google-E-Mail-Adressen** in einem ausschließlich für ihn freigeschalteten Admin-Bereich hinterlegen und Freigaben widerrufen. Die bloße Kopie der APK/EXE auf einen anderen Rechner oder an eine fremde Adresse soll **nicht** zur regulären App-Nutzung berechtigen. Die Drive-Synchronisierung ist davon getrennt.

### Gewünschter Ablauf

1. Admin meldet sich mit einem **eigenen Admin-Konto** plus Admin-Passwort an (ggf. zweiter Faktor). Die Zugangsdaten werden **außerhalb der ausgelieferten EXE/APK** sicher verifiziert – ein fest in der App eingebautes Passwort wäre auslesbar und ist **nicht ausreichend**.
2. Unter `Verwaltung → Lizenzen` trägt er `kunde@gmail.com` ein. Er sieht Einladung/Freigabe, zuletzt geprüften Zugriff, Geräte, Lizenzstatus (aktiv/gesperrt), optional Ablaufdatum. Die Oberfläche setzt beim Erstellen/Ändern **serverseitige** Berechtigungen durch.
3. Bei der ersten Installation meldet sich der Kunde mit **Google-Login** an. Das System prüft die von Google bestätigte E-Mail (`email_verified`), bindet die Freigabe möglichst an die stabile Google/Firebase UID und schreibt die Gerätregistrierung. Eine bloß frei eintragbare E-Mail in einem Textfeld ist **kein** Lizenznachweis.
4. App wird erst nach erfolgreicher Online-Aktivierung für normalen Betrieb freigegeben. Für den Offlinebetrieb dient ein **kurzlebiger signierter Aktivierungsnachweis**, der zur Benutzer-/Geräteidentität und zum Ablauf passt. Signaturschlüssel bzw. Server-Admin-Geheimnis befinden sich **nie** im Client. Nach Ablauf muss online erneuert werden. Bei Widerruf endet die Berechtigung spätestens mit Ende der Offline-Frist.
5. Spätere Änderungen im Admin-Bereich werden beim nächsten Onlinecheck übernommen. Falls der Kunde die EXE/APK weitergibt, kann die andere Person mit nicht freigegebener Identität regulär nicht starten. **Keine absolute Kopierschutzgarantie**: Ein Angreifer kann Offline-Clientcode patchen oder bestehende Dateien kopieren. Geschützte Kunden-/Cloud-Daten sind deshalb zusätzlich zu verschlüsseln.

### Technische Variante für kleines Budget (ca. zehn Kunden)

- **Firebase Authentication** mit Google-Login für Kunden und separatem starken Admin-Login; **Cloud Firestore** als kleine Lizenzliste (E-Mail-Einladung, gebundene UID, Status, freigegebene Geräte, Zeitstempel). Firestore Security Rules erzwingen, dass **nur die festgelegte Admin-UID** Freigaben verändert. Keine allgemein lesbare Kundenliste, keine clientseitig frei schreibbaren Rollen.
- Inhaber kann **innerhalb von M-iCare** Lizenzen verwalten; das Backend authentifiziert jede schreibende Aktion. E-Mail wird nicht als geheimes Passwort missbraucht.
- Google Drive bleibt für **verschlüsselte Kundendaten-Backups**; die Firebase-Lizenzverwaltung verwaltet **nur Berechtigungen** und nicht sämtliche Kundendaten.
- Google/Firebase **Spark** mit kostenfreien Kontingenten kann bei dieser Größe ohne Abonnement ausreichen. Vor Freigabe Cloud-Funktionen, Login-Mechanismus, offline signierte Nachweise, Kontingente und mögliche kostenpflichtige Abhängigkeiten gesondert prüfen. Falls signierte Offline-Nachweise einen kostenpflichtigen Vertrauensdienst erfordern, Preis/Alternative vor Umsetzung entscheiden.
- Ein reiner clientseitiger Schutz mit `adminPassword` in `config.js`, `index.html`, Electron-ASAR oder Android-APK **darf nicht als wirksame Lizenzsperre vermarktet werden**. Das gilt auch bei privatem GitHub-Repository.

### Kleine Akzeptanzliste

- Nicht freigegebene Google-Adresse → Aktivierung verweigert; keine Produktdaten lesen.
- Freigegebene, verifizierte Adresse → Lizenz aktiv; in App nach Anmeldung nutzbar.
- Google-Adresse vorgetäuscht (nur Eingabetext) → verweigert.
- Installer an fremdes Google-Konto weitergereicht → verweigert.
- Benutzer sperren → spätestens nach festgelegter Offline-Frist blockiert.
- Person ohne Adminrolle ruft API direkt auf/ändert Browseroberfläche → Berechtigungsänderung serverseitig verweigert.
- Admin-Passwort/Schlüssel aus ASAR/APK extrahieren → kein Freigabegeheimnis vorhanden.
- Backup/Restore, Google-Drive-Sync und Kundendaten getrennt von Lizenzidentität; kein Datenverlust beim Lizenzablauf.
- App ohne Netzwerk startet nur mit gültigem befristeten Offline-Nachweis; danach Meldung zur Online-Verifizierung; lokale Daten bleiben sicher erhalten.

Quellen:
- https://firebase.google.com/docs/rules/rules-and-auth
- https://firebase.google.com/docs/firestore/security/rules-conditions
- https://firebase.google.com/pricing
- https://www.electronjs.org/docs/latest/tutorial/asar-archives

---

## Ergänzung: Geschützter Adminbereich, Google-Konto und Weitergabeschutz (Anforderung 24.10.2026)

**Nutzerwunsch:** Zuerst mit eigenem Google-Konto testen; anschließend M-iCare an Kollegen mit wenigen Kunden geben. Nur der Eigentümer soll Cloud-/Benutzer-/Geräteeinstellungen verwalten können. Eine kopierte EXE/APK soll nicht ohne Berechtigung Zugang zu seinen Kundendaten geben.

### Bedienoberfläche und Rollen

- Unter **Einstellungen → Verwaltung (🔒)** einen Adminbereich vorsehen. Zugriff nach Entsperrung mit eigener **Admin-Passphrase**, auf Wunsch zusätzlich Windows Hello oder Android-Gerätesperre. Nach Inaktivität automatisch sperren; Sperren auch beim Wechsel der Google-Identität, nach Systemneustart und nach Benutzerwechsel.
- Im Adminbereich: **„Google-Konto verbinden“** (Google-Dialog im Systembrowser), verifizierte E-Mail **nur anzeigen**, Workspace/Drive-Berechtigungen, Nutzer und freigegebene Geräte, Cloud-Sicherungen, Verschlüsselungs-Schlüsselzustand, Wiederherstellung, Zugriffs-/Backup-Logs und Kontoverbindung trennen.
- Mitarbeiterrolle: Kunden und Aufträge gemäß Freigaben bearbeiten, Auswertung lesen; **keine** Kontowechsel, Cloud-Berechtigungen, Benutzereinladungen, Verschlüsselungs-/Backup-Schlüssel oder Löschung sämtlicher Sicherungen. Einzelheiten durch spätere Rollen-Tests absichern.
- Für erste Tests eigene E-Mail nur über Google OAuth **verifizieren**. **Kein Formular, das Google-Passwort oder OAuth-Token direkt in M-iCare abfragt.** Eine eingetippte E-Mail ist kein Identitätsbeweis. Intern die bei Google verifizierte stabile `sub`-ID als Kontoreferenz verwenden; E-Mail für Bedienungsanzeige.
- Die **Admin-Passphrase** ist nicht das **Google-Passwort** und nicht zwangsläufig die **Datenverschlüsselungs-Passphrase**. Passphrase nicht im Code, GitHub, HTML oder lokalen Klartext speichern. Kein fest einprogrammiertes Master-Passwort.
- Admin-Schutz muss die echten Operationen absichern, nicht nur den Menüpunkt verstecken: Drive-Verknüpfung, Import/Überschreiben, Backup löschen, Nutzer/Device ändern durch vertrauenswürdigen nativen Code oder Server prüfen. UI-Check allein ist umgehbar.
- **Aktueller IST-Stand:** IndexedDB enthält Klartext-Geschäftsdaten. Vor Auslieferung einer Version, die ihren lokalen Datenbestand gegen unbefugten Zugriff absichern soll: at-rest-Verschlüsselung/Migrationspfad mit Wiederherstellungstest, starkem KDF und verschlüsselten Backups entwickeln. Ein separater PIN-Screen auf unverschlüsselter IndexedDB wäre kein Datenzugriffsschutz.

### Was man mit Kopierschutz tatsächlich erreichen kann

1. **Cloud-Zugriff sperren:** App an autorisiertes Google-Konto und Workspace binden, zulässige Konten/Scopes prüfen. Wer die EXE/APK weiterleitet, erlangt dadurch keinen Google-Drive-Zugriff auf fremde Daten.
2. **Lokale Daten schützen:** Clientseitige Verschlüsselung mit Passphrase + sicher verwahrten Geräteschlüsseln. Kopierte Programmdateien enthalten keine Kunden- oder Cloud-Passwörter. Google-Sicherungen nur für berechtigte Benutzer mit Schlüssel entschlüsselbar.
3. **Unberechtigte *App-Nutzung* wirksam begrenzen:** Für individuelle Benutzer-/Gerätefreigaben, Abmelden anderer Geräte, Sperren und jederzeitigen Widerruf wird ein **vertrauenswürdiger Lizenz-/Identitätsdienst auf einem Server** benötigt. Lokale Passwort-/Lizenzprüfungen in einer kopierbaren Offline-App sind manipulierbar; absolute Weitergabeverhinderung ist nicht möglich. Offlinebetrieb benötigt befristete, signierte Zugriffsnachweise mit bewusst gewählter Frist; ein solcher Nachweis lässt sich bis zum Ablauf nicht sofort aus der Ferne widerrufen.
4. **Privatbetrieb mit einem Kollegen:** Zunächst nur Admin + ein Benutzer, Google-Konto des Eigentümers für dessen private **synthetische** Tests. Später Kollege mit eigenem Google-Konto und **eigenem Workspace**, niemals das private Google-Passwort weitergeben. Ob echte geschäftliche Daten in privatem Drive erlaubt sind, vorher organisatorisch/DSGVO-rechtlich prüfen.

### Akzeptanztests für den Admin-/App-Schutz

- Ohne Admin-Entsperrung keine Änderung der Cloud-Verbindung, keine Rolle zuweisen, keine Sicherung löschen, keine gefährliche Datenübernahme.
- Falsche Passphrase, wiederholte Versuche und gesperrter Bildschirm: kein Zugriff auf geschützte Funktionen; legitimes Zurücksetzen nur über dokumentierten Recovery-Flow.
- Falsche Google-Identität trotz eingetragener E-Mail: Ablehnung. Kein Google-Passwort in M-iCare, nicht in Logs, Quelltext, Crashreport, IndexedDB oder Sicherung.
- Dateiübertragung EXE/APK an ein unberechtigtes Gerät: **kein** Zugriff auf Cloud-Workspace oder verschlüsselte lokale Kundendaten; die bloße Ausführbarkeit der weitergegebenen App bleibt technisch möglich.
- Fremder Nutzer kann nicht per Renderer-DOM/DevTools die Freigaben allein durch UI-Manipulation umgehen.
- Windows-Konto bzw. Android-Gerät gewechselt: Schlüsselmaterial nicht still wiederverwendbar; nach Account-Wechsel Backup-Workspace überprüfen.
- Zwei Offline-Geräte bearbeiten dieselbe AK: keine Überschreibung, unabhängig von Admin-Status; Cloud- und Sperrzustand sauber getrennt.
- Vorhandene lokale Kundendaten bei Migration zur Verschlüsselung zuerst separat und wiederherstellbar sichern; Migration atomar, Rückfall ohne Datenverlust.

**Reihenfolge:** Admin-/Rollenmodell und sichere Backup-Migration im selben Design abschließen, bevor behauptet wird, die kopierte App sei vor Weitergabe geschützt. Phase A (manuelle Drive-Sicherung) kann zunächst ohne Lizenzdienst entwickelt werden; Zugriffs-/Gerätefreigabe ist eine getrennte spätere Phase.


## 2. Produktentscheidung: zwei ausdrücklich getrennte Phasen

### Phase A — sichere Cloud-Sicherung / manuelle Übergabe (MVP)

**Ziel-UX:** „Google Drive verbinden“, „Verschlüsselt sichern“, „Cloud-Stand prüfen“, „Daten vergleichen“, „Auf diesem Gerät übernehmen“, „Ältere Sicherungen“, „Google-Konto trennen“.

**Ein Schreibgerät zur gleichen Zeit** ist für die erste Version die kommunizierte Regel. Bevor die App ein neues Backup hochlädt, liest sie die Cloud-Metadaten erneut. Wenn sich der Cloud-Stand seit dem letzten bekannten lokalen Basisstand geändert hat, wird nicht hochgeladen: „Anderes Gerät hat neuere Änderungen; bitte zuerst vergleichen.“

Bei „Übernehmen“ werden lokale Daten zuerst als **unveränderlicher lokaler Wiederherstellungspunkt** gespeichert. Cloud-Daten werden heruntergeladen, entschlüsselt, vollständig validiert und gegen lokale Daten verglichen. Eine Übersicht zeigt Datum, Gerät, Anzahl Kunden/Standorte/AK/Arbeitszeiten/Korrekturen sowie hinzugefügte/geänderte/fehlende Datensätze; erst ein bewusster, bestätigter Benutzerbefehl darf ersetzen. Wenn seit dem letzten gleichen Basisstand **beide Geräte verändert** wurden, nicht automatisch ersetzen oder zusammenführen, sondern einen Konflikt anzeigen und beide Stände bewahren. „Meine lokalen Daten behalten“, „Cloud-Daten auf diesem Gerät übernehmen“ (nur nach expliziter Bestätigung) und „Beide sichern und Konflikt später bearbeiten“ als klare Möglichkeiten. Keine Auto-Downloads in produktiven State.

Backup nach erfolgreicher Online-Sicherung erst dann als „gesichert“ kennzeichnen, wenn der Upload bestätigt und seine Inhalte/Hash plausibilisiert sind. Bei Ausfall bleibt der letzte gültige Cloud-Stand erhalten. Etwa 20 versionierte Sicherungen plus monatliche längerfristige Wiederherstellungspunkte, konfigurierbare Aufbewahrung. Keine automatische Löschung ohne geprüfte Retention-/Recovery-Strategie.

### Phase B — echte bidirektionale Synchronisierung (separater Release)

Ein revisions- und datensatzbasiertes Synchronisationsmodell mit stabilem `workspaceId`, `deviceId`, unveränderlicher Datensatz-UUID, `operationId`, `baseRevision`/`baseHash`, pro Datensatz aktueller Revision, echten Tombstones für Löschungen und append-only Korrekturen. Kein „letzter Zeitstempel gewinnt“ für Kundendaten, AK, Arbeitszeiten oder Korrekturgründe.

Alle Geräte laden neue Revisionen herunter und führen einen **3-Wege-Vergleich** mit ihrer letzten gemeinsamen Basis durch. Änderungen an **verschiedenen** Datensätzen können automatisch zusammengeführt werden; konkurrierende Änderungen am **gleichen** Datensatz müssen benutzerseitig aufgelöst werden. Korrektur- und Ereignislogs append-only und idempotent (pro `operationId` einmal). Im Zweifel beide konfliktbehafteten Varianten und Snapshots erhalten. Neue gelöschte/archivierte Arbeitskarten dürfen auf keinem Gerät durch einen veralteten Datensatz wieder auftauchen.

**AK 1, AK 2 …:** Rein offline und ohne zentral atomare Nummernvergabe lässt sich weltweite bzw. geräteübergreifende numerische Eindeutigkeit nicht garantieren. Bis eine sichere Nummernvergabe existiert, gibt es eine administrative Konfliktprüfung bzw. pro Gerät temporäre sichtbare Kennung bei Offline-Neuanlage. Niemals zwei verschiedene UUIDs wegen derselben AK-Nummer still zusammenführen; alte Referenzen/Reports müssen konsistent bleiben. Für garantierte fortlaufende globale Nummern unter gleichzeitigen Offline-Edits ist eine zentrale Vergabe oder Vorreservierung mit transaktionsfähiger Gegenstelle erforderlich, Google Drive allein bietet diese nicht als fertige Funktion.

## 3. Google-Drive-Zugriff

- Ein **Google-Cloud-Projekt** für M-iCare, Drive API eingeschaltet, Android OAuth-Client (Package/SHA-Zertifikat) und Desktop OAuth-Client unter **demselben** Projekt; für Test-/Produktionskonfiguration kontrollierte Freigabe.
- Autorisierung nach dem Prinzip minimaler Rechte: `https://www.googleapis.com/auth/drive.file`, damit nur von M-iCare erstellte bzw. ausdrücklich gewählte Dateien zugänglich sind, nicht die gesamte Drive-Ablage. Ein eigener Benutzer-sichtbarer Ordner „M-iCare Sicherungen“ ermöglicht zusätzlich die manuelle Wiederherstellung. `drive.appdata` ist eine mögliche Alternative für unsichtbare interne Zustände, aber **nicht** für den einzigen lebenswichtigen Backupstand: in Drive nicht sichtbar und bei Entfernen der App-Daten löschbar.
- Android: **Google Identity Services Authorization** nativ in `MainActivity`, Drive-Aufrufe außerhalb der WebView; nur allowgelistete `MiCareNative`-Methoden. Kein OAuth innerhalb des eingebetteten WebView.
- Windows: Google-OAuth-Desktop-Autorisierung im **Systembrowser** mit PKCE/Loopback, nicht in `BrowserWindow`. Credential-/Refresh-Token ausschließlich geschützt in der OS-nativen sicheren Speicherung (`safeStorage` oder Windows Credential Manager), kein Klartexttoken, kein Client-Secret oder Service-Account-Schlüssel in HTML, GitHub oder Logdateien. Streng begrenzter `preload`/`contextBridge`-IPC-Vertrag und Validierung aller vom Renderer kommenden Argumente.
- Gleiches **Google-Konto** und gleiche M-iCare-Workspace-ID auf beiden Geräten; Kontowechsel erfordert explizite Bestätigung. Keine Arbeit mit fremdem Cloudstand wegen gleichlautender Dateinamen.
- APIs: `files.list` (mit `fields`, `pageToken`), `files.create` (versionierte Snapshots), `files.get` Download. Bei größeren Dateien `uploadType=resumable`, sichere Retries und Abbruchunterstützung. Ein fehlgeschlagener Upload darf nie die letzte gute Sicherung löschen.

## 4. Verschlüsselung, Datenvertrag und Datenschutz

- **Vor dem Upload auf dem Gerät verschlüsseln**: Authenticated Encryption `AES-256-GCM`, zufälliger neuer Nonce je Sicherung, versioniertes `encryptionEnvelope`, KDF mit verifiziertem Argon2id/PBKDF2-Profil, hoher Entropie der eigenständigen Sync-Passphrase. Verschlüsselungs-Passphrase wird nicht in Drive gespeichert. Gleiche Passphrase beim Einrichten des zweiten Geräts; verlorene Passphrase bedeutet ohne lokalen Wiederherstellungspunkt keine Entschlüsselung. Sicherheitsparameter vor Umsetzung gezielt benchtesten.
- Transport ausschließlich HTTPS/TLS. Tokens nie als Queryparameter, Logs/Crashreports mit Redaction, keine Kundennamen in Cloud-Dateinamen/Diagnoseereignissen.
- Minimales unverschlüsseltes Manifest nur mit technischen IDs/Schema-Version/Hash/Uploadstatus; persönliche Kundendaten und Änderungen liegen ausschließlich im verschlüsselten Payload. Zeitstempel und Dateigrößen können trotzdem Metadaten offenlegen.
- Beispiel `backupEnvelope`: `format="M-iCareCloud"`, `schemaVersion`, `workspaceId`, `snapshotId`, `parentSnapshotId`, `deviceId`, `createdAt`, `payloadHashSha256`, `encryptedPayload`, `kdfParams`, `nonce`.
- Validierung **nach Entschlüsselung und vor lokaler Änderung**: zulässige JSON-Größe/Datensatzgrenzen; eindeutige IDs; gültige Beziehungen Kunde→Objekt→Auftrag→Ist-Eintrag; Zeiten und Wiederholungsregeln; Korrekturhistorie und Status; keine Prototype-Pollution/HTML-Execution; Checksums und Auth-Tag. Nur bewusst versionierte Migration; unbekannte Schema-Version sperrt Übernahme statt Wegwerfen von Feldern.
- Kundendaten, Mitarbeiter und Arbeitszeiten sind personenbezogene Geschäftsdaten. Vor Realbetrieb Datenschutzzulässigkeit/Verträge/AVV mit Google, Zugriffsrechte, Speicherort und Aufbewahrung mit Verantwortlichen klären. Für einen Firmenbetrieb ggf. Google Workspace mit administrativen Richtlinien statt privatem Drive nutzen. Cloud-Sicherung **nicht** ohne Freigabe mit echten personenbezogenen Daten testen.

## 5. Akzeptanz- und Regressionstests (Pflicht vor Freigabe)

| Test | Erwartung |
| --- | --- |
| Erster Drive-Login Android und Windows | Ausschließlich benötigte Berechtigung, richtiges Konto, keine Tokens im JS |
| Offline AK erfassen und Handy neu starten | Daten in IndexedDB lokal erhalten; Cloudstatus „nicht synchronisiert“ |
| Handy sichern → Windows herunterladen | Kunden, Objekte, AK, Termine, Ist-Stunden und Korrekturen 1:1 erhalten |
| Import und erneuter Export | Gleiche UUIDs, AK-Nummern, Korrekturgründe und Datenverweise |
| PC und Handy ändern dieselbe AK offline | Deutlicher Konflikt; **keine** stille Überschreibung |
| Beide Geräte legen unabhängig „AK 20“ an | Beide UUIDs bleiben vorhanden; AK-Namenskonflikt wird aufgelöst/gesperrt |
| Kunde auf Gerät A archiviert; B ältere Daten | Keine unbemerkte Reaktivierung |
| Korrigierte erledigte AK, inkl. Bearbeiter | Korrektur- und Statushistorie vollständig erhalten |
| Upload bricht ab/Token abgelaufen/Drive voll | Alte gültige Sicherung bleibt erhalten; verständlicher Retry |
| Verschlüsselungs-Passphrase falsch / Payload manipuliert | Import abgewiesen, lokale Daten unberührt |
| Große/malformierte JSON, XSS, doppelte IDs | Validierung blockiert, kein Skript ausgeführt, State unverändert |
| Offline→Online, mehrfach Sync, App-Absturz im Import | Idempotent, atomare lokale Übernahme oder Rollback |
| Google-Konto getrennt/anderes Konto | Keine unerwartete Datenübernahme; lokale Daten bleiben |
| Restore einer älteren Version | Vorher Rettungsbackup, Vorschau und bewusste Rückfrage |
| PDF/CSV/XLSX vor/nach Übernahme | Gleiche erfasste Stunden, Status, Kunden, AK und Berichte |
| Echte Samsung-/Android- und Windows-Installation | Google OAuth, Dateitransfer und native Berechtigungen funktionieren |

Testdaten **nur synthetisch**, mindestens 5 Kunden/20 Objekte/36 gemischte Aufträge sowie Dauerauftrag, Storno, 3 parallele AKs, verschobene Termine und Korrekturhistorie.

## 6. Implementierung nach bestehender Codebasis

| Komponente | Eingriff |
| --- | --- |
| `index.html` | Cloud-Bildschirm mit Accountstatus, Backup/Übernahme/Vergleich, Konfliktliste, schreibgeschütztem Preview. Refactor `saveState` und `importJson` in separate `validateState`/`snapshotState`/`applyStateAtomically` |
| `android-app/.../MainActivity.java` | GIS Authorization, Drive REST client, Android Keystore, native Bridge mit `connect/list/upload/download/disconnect`; externe Google-Anmeldemaske |
| `windows-app/main.js` + `preload.js` | Systembrowser-OAuth, PKCE, geschützte Tokens, Drive REST, origin-geprüfte IPC mit explizitem Methodenset |
| `shared/` (neu) | Kanonische Datenvalidierung, Versionsmigration, AES-GCM-Envelope, Hashes, Snapshot-/Revision-/Diff-Vertrag; Plattformadapter separat |
| `tests/` | Node Unit-Tests für Diff, Schema, Kryptohüllen, Konfliktlogik; Browser-E2E; nativer Windows-E2E; Android-Instrumentation |
| `.github/workflows/` | Cloud-Sync-Tests und Installer-Tests als Merge-Gates; **keine** produktiven Tokens in Pull-Request-CI |

**Entscheidung für den ersten Release:** Phase A priorisieren, Auto-Merge und gleichzeitige Offline-Bearbeitung ausdrücklich nicht als „synchronisiert“ darstellen. Backup/Restore über Drive mit Versions-/Konfliktschutz testen, bevor Daten mehrerer Geräte gemischt werden. Erst danach Phase B freigeben.

## 7. Noch notwendige extern einzurichtende Voraussetzungen

1. Google-Cloud-Projekt, Drive API, OAuth-Zustimmungsbildschirm und zwei Client-IDs (Android/Windows), Testnutzer und ggf. Google-Freigabe; keine API-Secrets im Chat posten.
2. Für Android sind das endgültige App-Paket und das Signaturzertifikat (SHA-Fingerprints) festzulegen. Debug- und Release-Signaturen getrennt berücksichtigen.
3. Entscheidung zum zulässigen geschäftlichen Google-Konto und Einwilligung/Vertrag für personenbezogene Kundendaten.
4. Eine separate **Cloud-Passphrase** und ein dokumentierter Offline-Wiederherstellungsplan.

## Verifizierte Grundlagen

- Google Drive least-privilege scopes: https://developers.google.com/workspace/drive/api/guides/api-specific-auth
- Benutzer-sichtbare Dateien vs. verstecktes appDataFolder: https://developers.google.com/workspace/drive/api/guides/appdata
- Google OAuth Desktop Systembrowser: https://developers.google.com/identity/protocols/oauth2/native-app
- Android Google Identity Services Authorization: https://developer.android.com/identity/authorization
- Drive Upload- und Retryverfahren: https://developers.google.com/workspace/drive/api/guides/manage-uploads
- Electron safeStorage: https://electronjs.org/docs/latest/api/safe-storage
