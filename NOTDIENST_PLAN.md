# Notprofi24 – Erweiterung Notdienstzentrale (Entwurf)

## Bereits umgesetzt
- `properties`: Liegenschaften mit Zuordnung zur Hausverwaltung, Objektadresse und Notdienstanweisungen.
- `emergency_calls`: Anrufe auch ohne kostenpflichtigen Auftrag, inklusive Status, Rückrufnummer, Objektbezug und optionaler Verknüpfung mit einem Einsatz.
- Bestehende Tabellen und bestehende Abrechnungslogik bleiben unverändert.

## Vor produktivem Einsatz noch erforderlich
1. Geschützte CRUD-API mit serverseitiger Eingabeprüfung, Authentifizierung und Berechtigungen.
2. Benutzeroberfläche für Liegenschaften und Anrufannahme, inklusive Suchfunktion.
3. Zuordnung eines Einsatzes zu einem Objekt und spätere Zuweisung des Partnerbetriebs; bestehende Job-Erstellung darf dabei nicht brechen.
4. Provisionshöhe (59 EUR brutto oder netto?) verbindlich klären; momentan gibt es widersprüchliche Defaults (Schema 49 EUR, API 49 EUR, Settings 60 EUR).
5. Abrechnungsintervall und fortlaufende Rechnungsnummern fachlich und steuerlich prüfen.
6. Telefonweiterleitung: Erkennung der Verwaltung, Rückfallroute, Besetztfall und Nichterreichbarkeit.
7. Datenbankänderungen erst nach Backup in einer Testumgebung anwenden. `npm run db:push` nicht ungeprüft auf Produktion ausführen.
8. Datenschutz, Zugriffskontrolle, Backups und Löschfristen prüfen.

Diese Änderung ist absichtlich **nicht** als fertige Notdienstzentrale zu verstehen. Sie erweitert nur das Datenmodell und soll vor dem Merge überprüft werden.
