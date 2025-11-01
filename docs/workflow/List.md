 🎯 Core Workflow Skills

  1. using-superpowers

  Was: Dein Pflicht-Startpunkt für jeden neuen Chat - stellt sicher, dass du die richtigen Skills zur richtigen Zeit einsetzt.

  Beispiel: Du startest einen neuen Thread und willst ein Feature implementieren. Der Skill checkt: "Gibt es spezielle Skills für diese Aufgabe?" und verhindert, dass du blind loscodest.

  Warum: Ohne diesen Check vergisst man leicht bewährte Methoden und macht vermeidbare Fehler.

  ---
  2. brainstorming

  Was: Verwandelt deine vage Idee ("Ich will ein Login-System") durch gezielte Fragen in ein durchdachtes Design ("OAuth2 mit JWT-Tokens, Refresh-Mechanismus, Rate-Limiting").

  Beispiel: User sagt "Ich brauche eine Bookmark-Funktion". Der Skill fragt nach: "Wie viele Bookmarks erwartest du? Müssen sie synchronisiert werden? Offline-Fähigkeit?" - daraus entsteht ein konkreter Plan.

  Warum: Verhindert, dass du Code schreibst, der die falschen Probleme löst oder wichtige Anforderungen ignoriert.

  ---
  3. writing-plans

  Was: Erstellt einen detaillierten Schritt-für-Schritt-Plan mit exakten Dateipfaden, Code-Beispielen und Verifikations-Schritten - als würdest du einem Entwickler ohne Projekt-Kontext erklären, was zu tun ist.

  Beispiel: Aus "Video API Endpoints implementieren" wird: "1. Erstelle backend/app/api/videos.py mit GET/POST/DELETE Routen, 2. Füge Schema in schemas/video.py hinzu (Code-Beispiel), 3. Teste mit pytest..."

  Warum: Ein Plan mit präzisen Details verhindert Missverständnisse und macht Fortschritt messbar.

  ---
  4. executing-plans

  Was: Arbeitet einen fertigen Plan in kontrollierten Häppchen ab - nach jedem Batch gibt's eine Review-Pause statt blindem Durcharbeiten.

  Beispiel: Du hast einen 12-Task-Plan. Der Skill macht Tasks 1-3, stoppt, zeigt Ergebnisse, wartet auf OK vom User, dann weiter mit 4-6.

  Warum: Verhindert, dass du in die falsche Richtung rennst und erst nach Stunden merkst, dass etwas grundlegend falsch ist.

  ---
  5. subagent-driven-development

  Was: Startet für jede unabhängige Aufgabe einen frischen "Sub-Claude", der die Aufgabe löst und danach von einem Code-Reviewer gecheckt wird.

  Beispiel: Du hast 3 API Endpoints zu bauen. Der Skill startet 3 separate Agents (können parallel laufen), jeder baut einen Endpoint + Tests, danach Code-Review.

  Warum: Frische Agents haben keinen "Kontext-Bias" und Code-Review zwischen Tasks fängt Fehler früh.

  ---
  🧪 Development & Testing Skills

  6. test-driven-development

  Was: Zwingt dich, den Test zu schreiben BEVOR du den eigentlichen Code schreibst - und sicherzustellen, dass der Test erst rot (fails) ist.

  Beispiel: Du willst eine create_bookmark() Funktion bauen. TDD sagt: "Schreibe zuerst test_create_bookmark(), lasse ihn fehlschlagen, dann schreibe die Funktion so, dass der Test grün wird."

  Warum: Wenn du den Test nach dem Code schreibst, weißt du nicht, ob der Test wirklich funktioniert - er könnte immer grün sein, egal was der Code macht.

  ---
  7. testing-anti-patterns

  Was: Verhindert typische Test-Fehler wie "Mocks testen statt echtem Code" oder "Test-Code in Produktions-Code einbauen".

  Beispiel: Du willst eine Datenbank-Funktion testen und denkst "Ich mocke die DB". Der Skill sagt: "STOP - wenn du die DB mockst, testest du nur deinen Mock, nicht die echte Logik."

  Warum: Schlechte Tests geben falsches Vertrauen - sie sind grün, aber der Code ist trotzdem buggy.

  ---
  8. testing-skills-with-subagents

  Was: Testet deine selbst-geschriebenen Skills/Workflows mit Subagents, um sicherzustellen, dass sie auch unter Druck funktionieren.

  Beispiel: Du hast einen neuen Skill "API-Testing-Workflow" geschrieben. Der Skill startet einen Subagent, gibt ihm eine realistische Aufgabe und checkt, ob der Workflow standhält.

  Warum: Skills, die nur theoretisch gut klingen, versagen oft in der Praxis - Testing zeigt das.

  ---
  9. condition-based-waiting

  Was: Wartet auf echte Bedingungen ("Ist Element X sichtbar?") statt auf feste Zeitintervalle ("Warte 5 Sekunden").

  Beispiel: Test wartet mit sleep(5) auf API-Response. Der Skill sagt: "Nein! Warte, bis response.status == 'ready' oder timeout nach 10s."

  Warum: Feste Timeouts sind entweder zu kurz (flaky tests) oder zu lang (langsame Tests). Conditions sind präzise.

  ---
  🔍 Debugging & Analysis Skills

  10. systematic-debugging

  Was: 4-Phasen-Framework: 1) Root Cause finden, 2) Muster erkennen, 3) Hypothese testen, 4) Fix implementieren - keine Quick Fixes ohne Verständnis!

  Beispiel: Test schlägt fehl mit "500 Server Error". Der Skill sagt: "Nicht raten! Trace den Error zurück, finde die Ursache (z.B. DB-Connection fehlt), verstehe WARUM, dann fixe."

  Warum: Quick Fixes beheben Symptome, nicht Ursachen - der Bug kommt zurück oder erzeugt neue Probleme.

  ---
  11. root-cause-tracing

  Was: Verfolgt einen Fehler rückwärts durch den gesamten Code-Ablauf bis zur ursprünglichen Quelle.

  Beispiel: Fehler passiert in Funktion D, die von C aufgerufen wird, die von B aufgerufen wird. Der Skill traced zurück: D → C → B → A und findet, dass A falsche Daten schickt.

  Warum: Fehler tief im Code haben oft ihren Ursprung weit oben - wenn du nur tief fixst, versteckst du das Problem nur.

  ---
  12. defense-in-depth

  Was: Validiert Daten an JEDER Schicht des Systems (Input, Business Logic, DB, Output) statt nur an einer Stelle.

  Beispiel: User-Input wird im Frontend validiert, nochmal in der API, nochmal vor DB-Zugriff. So kann eine Schicht versagen, ohne dass das System crasht.

  Warum: Single-Point-Validation ist gefährlich - überspringt jemand eine Schicht (z.B. API direkt aufrufen), kommen invalide Daten durch.

  ---
  📝 Code Review & Quality Skills

  13. requesting-code-review

  Was: Startet automatisch einen Code-Reviewer-Agent, nachdem du eine Aufgabe abgeschlossen hast, um Code gegen Plan/Requirements zu prüfen.

  Beispiel: Du hast Video API Endpoints fertig implementiert. Der Skill startet einen Reviewer, der checkt: "Wurden alle Endpoints aus dem Plan implementiert? Folgt der Code Best Practices?"

  Warum: Selbst-Review übersieht oft eigene Fehler - ein frischer Blick findet Lücken und Verbesserungen.

  ---
  14. receiving-code-review

  Was: Zwingt dich, Review-Feedback technisch rigoros zu prüfen statt blind zu akzeptieren - manche Vorschläge sind falsch oder nicht anwendbar!

  Beispiel: Reviewer sagt "Nutze Caching für diese API". Der Skill sagt: "Prüfe: Macht Caching hier Sinn? Gibt es Stale-Data Probleme? Ist der Aufwand gerechtfertigt?"

  Warum: Blindes Umsetzen von Review-Feedback kann Code verschlechtern - technische Rigorosität verhindert das.

  ---
  15. verification-before-completion

  Was: Verbietet dir zu sagen "fertig" oder "sollte funktionieren" - du MUSST Tests/Builds ausführen und Output zeigen!

  Beispiel: Du sagst "API Endpoint ist fertig". Der Skill sagt: "Zeig mir die pytest-Ausgabe, zeig mir curl-Request, zeig mir dass es wirklich funktioniert."

  Warum: "Sollte funktionieren" ist die Quelle von 90% aller Bugs - Evidence before Claims!

  ---
  🔧 Git & Workflow Skills

  16. using-git-worktrees

  Was: Erstellt isolierte Git-Arbeitsverzeichnisse für Features, sodass du an mehreren Branches gleichzeitig arbeiten kannst ohne ständig zu switchen.

  Beispiel: Du arbeitest an Feature A, musst aber schnell Bugfix B machen. Worktree erstellt separates Verzeichnis für B, du kannst sofort wechseln ohne A zu committen.

  Warum: Branch-Switching verwirft uncommitted Changes oder erzeugt Merge-Chaos - Worktrees sind sauber getrennt.

  ---
  17. finishing-a-development-branch

  Was: Gibt dir strukturierte Optionen, wie du fertigen Code integrierst: Merge, Pull Request, oder Cleanup - mit Checks und Safety-Verification.

  Beispiel: Feature ist fertig, alle Tests grün. Der Skill fragt: "Merge zu main? PR erstellen? Branch löschen?" und führt Git-Safety-Checks durch.

  Warum: Verhindert Force-Push zu main, vergessene Commits oder schlampige PR-Beschreibungen.

  ---
  🚀 Advanced Skills

  18. dispatching-parallel-agents

  Was: Startet mehrere unabhängige Agents gleichzeitig, um unabhängige Probleme parallel zu lösen.

  Beispiel: 5 Tests schlagen fehl in komplett verschiedenen Modulen. Der Skill startet 5 Agents, jeder fixxt einen Test - parallel statt sequenziell.

  Warum: Unabhängige Probleme sequenziell zu lösen verschwendet Zeit - Parallelisierung ist 5x schneller.

  ---
  19. writing-skills

  Was: Wendet TDD auf Prozess-Dokumentation an - testet Skills mit Subagents BEVOR du sie schreibst, iteriert bis bulletproof.

  Beispiel: Du willst einen Skill "Database-Migration-Workflow" schreiben. Der Skill sagt: "Teste erst mit Subagent, sieh wo er scheitert, schreibe dann den Skill."

  Warum: Ungetestete Skills klingen gut, versagen aber in der Praxis - Testing zeigt Lücken.

  ---
  20. sharing-skills

  Was: Führt dich durch den Prozess, einen selbst-entwickelten Skill via Pull Request zum offiziellen Repository beizutragen.

  Beispiel: Du hast einen nützlichen "API-Documentation-Generator" Skill gebaut. Der Skill hilft dir, Branch zu erstellen, PR zu schreiben, upstream zu pushen.

  Warum: Gute Skills sollten der Community helfen - strukturierter PR-Prozess macht Sharing einfach.

  ---