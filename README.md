# Host Grabber MV3 1.4.0

## Änderungen

- Regelimporte werden immer zu den vorhandenen Regeln hinzugefügt; sie ersetzen nichts.
- Bei ID-Konflikten erhält die importierte Regel automatisch eine neue ID.
- Der DOM-Scan prüft zuerst aktive Match-RegEx auf `linkUrl`, `imageUrl` und `pageUrl`; fremde URLs gelangen nicht in die Resolver-Phase oder ins Debug-Protokoll.
- Lazy-Load-Quellen aus `data-src`, `data-original`, `data-lazy-src`, `srcset` und `data-srcset` werden berücksichtigt.
- Integrierte IMX.to- und Pixhost-Regeln; Pixhost unterstützt `.cc`, `.to` und `pixho.st`.
- Doppelt maskierte RegEx wie `\\.` werden als Fehler angezeigt.
- Debug-Protokoll enthält Vorfilterstatistik und nur hosterrelevante Kandidaten.

## Installation

ZIP entpacken, `chrome://extensions` öffnen, Entwicklermodus aktivieren und den Ordner über „Entpackte Erweiterung laden“ auswählen. Bestehende benutzerdefinierte Regeln werden im Chrome-Speicher beibehalten. Um die neuen Standardregeln sofort zu verwenden, kann die beiliegende `imx-pixhost-rules.json` importiert werden; der Import fügt sie hinzu.
