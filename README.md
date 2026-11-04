# Host Grabber MV3 1.5.0

Regelbasierter Originalbild-Downloader mit eigenständigem Download-Manager.

## Download-Manager

Der Manager öffnet sich als eigenständiges Chrome-Fenster im dunklen Design. Jeder Scan oder Toolbar-Klick erzeugt eine eigene, am Ende angehängte Gruppe. Der Gruppentitel entspricht dem Webseitentitel.

Die Tabelle enthält Name, Url, Fortschritt und Grösse. Gruppen lassen sich mit `+` beziehungsweise `−` auf- und zuklappen und besitzen einen eigenen Fortschrittsbalken.

## Downloadsteuerung

- Alle oder ausgewählte Downloads pausieren
- Pausierte Downloads starten
- Fehlgeschlagene oder abgeschlossene Downloads neu starten
- Einträge aus der Liste entfernen
- Neue Downloads sofort starten oder pausiert hinzufügen
- Fortschritt und Größe pro Datei verfolgen
- Abgeschlossene Datei per Doppelklick im Windows-Standardprogramm öffnen
- Beim Schließen des Managers abgeschlossene Einträge entfernen

## Automatik

Unter Optionen → Automatik kann der Toolbar-Klick automatisch scannen. Zusätzlich kann das automatische Scannen beim Laden einer Seite auf eine Whitelist beschränkt werden. Eine Zeile entspricht dabei einer URL oder einem regulären Ausdruck.

## Installation

1. Repository als ZIP herunterladen und entpacken.
2. `chrome://extensions` öffnen.
3. Entwicklermodus aktivieren.
4. Alte Host-Grabber-Version entfernen oder deaktivieren.
5. „Entpackte Erweiterung laden“ wählen und den Ordner mit `manifest.json` auswählen.
6. Chrome neu starten oder die Zielseite neu laden.
