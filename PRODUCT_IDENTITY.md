# AeneasSoft — Produktidentität

## Was wir sind

AeneasSoft ist ein AI Agent Observability Tool. Wir machen das Unsichtbare sichtbar: Was passiert in deinen KI-Agenten, warum treffen sie welche Entscheidungen, was kosten sie, und sind sie bereit für den EU AI Act?

Wir sind kein Framework. Wir sind kein LLM-Wrapper. Wir sind die Röntgenaufnahme deiner KI-Systeme.

---

## Was wir konkret machen

### Das Kernprodukt in einem Satz
Zwei Zeilen Code in dein Python- oder Node.js-Projekt — und du siehst jeden API-Call, den jeder deiner AI-Agenten jemals macht, in einem interaktiven Dashboard mit kausalen Graphen, Kostenaufschlüsselung und EU AI Act Article 12 Reports.

### Die Technologie (patentiert)
Unser System arbeitet auf zwei Ebenen gleichzeitig:

**Ebene 1 — SDK-Level:** Wir ersetzen zur Laufzeit die `create()`-Methoden von OpenAI, Anthropic und anderen SDKs. Bevor der echte API-Call passiert, setzen wir ein Deduplication-Flag. Nach dem Call extrahieren wir strukturierte Daten (Modell, Tokens, Kosten, Antwortinhalt) aus dem SDK-Response-Objekt.

**Ebene 2 — HTTP-Transport-Level:** Wir ersetzen zur Laufzeit die `send()`-Methoden von httpx, requests und aiohttp (Python) bzw. `http.request()` (Node.js). Jeder ausgehende HTTP-Call zu einem KI-Provider wird automatisch erfasst — egal welches Framework darüber liegt. Das Deduplication-Flag verhindert, dass derselbe Call doppelt gezählt wird.

**Active Defense (Circuit Breaker):** Bevor ein HTTP-Request das Netzwerk verlässt, prüft unser System: Ist das Budget überschritten? Ist die Fehlerrate zu hoch? Steckt der Agent in einer Endlosschleife? Wenn ja, wird der Call im Arbeitsspeicher blockiert — nicht erst am Gateway, nicht erst in der Cloud. Eine `CircuitBreakerException` stoppt den Agent bevor er Geld verbrennt.

### Was uns einzigartig macht
Kein anderes Tool kombiniert diese drei Dinge:

1. **Zero-Code-Change HTTP-Interception** — kein base_url ändern (wie Helicone), keine Callbacks registrieren (wie LangSmith), keine Decorators schreiben (wie OpenTelemetry). Zwei Zeilen, alles automatisch.

2. **In-Process Active Defense** — andere Tools beobachten nur. Wir blockieren. Und zwar im Prozessspeicher, bevor der Request das Netzwerk verlässt. Das ist schneller und granularer als jeder API-Gateway.

3. **Dual-Layer Dedup** — SDK-Patcher und HTTP-Interceptor arbeiten koordiniert. Thread-lokale und ContextVar-basierte Flags verhindern, dass derselbe Call zweimal als Span erscheint. Das klingt trivial, aber ohne diesen Mechanismus verdoppelt sich dein Datenvolumen.

---

## Welchen Nutzen wir für den User darstellen

### Für den Entwickler
- **"Was hat mein Agent gerade getan?"** — Statt durch Logs zu scrollen, siehst du einen kausalen Graphen: Agent A hat Agent B aufgerufen, der hat GPT-4 gefragt, die Antwort war X, das hat $0.003 gekostet, und es hat 1.2 Sekunden gedauert.
- **"Warum ist mein Agent kaputt?"** — Du siehst sofort: Span 5 hat Status ERROR, die Fehlermeldung war "context_length_exceeded", der Input war 15.000 Tokens lang. Root Cause in 10 Sekunden statt 2 Stunden.
- **"Wie teuer ist mein Agent?"** — Per-Agent, Per-Modell, Per-Tag Kostenaufschlüsselung. Du siehst: "ResearchBot kostet $27/Tag, davon $18 für GPT-4 und $9 für Claude."

### Für den CTO
- **Transparenz über KI-Ausgaben** — Dashboard mit Echtzeit-Kosten. Kein "Am Ende des Monats kam die Rechnung und wir waren bei $15.000."
- **Risikokontrolle** — Budget-Limits pro Agent, pro Stunde. Wenn ein Agent durchdreht, wird er gestoppt bevor er $100 verbrennt.
- **Compliance-Vorbereitung** — EU AI Act Article 12 verlangt automatische Protokollierung. Unser System tut genau das — ohne dass Entwickler etwas ändern müssen. PDF-Reports auf Knopfdruck.

### Für den Compliance Officer
- **Article 12 Readiness Score** — Automatische Bewertung: "Ihr System erfüllt 87% der Anforderungen."
- **Signierte PDF-Reports** — RSA-2048 signiert, mit SHA-256 Integrity Hash. Exportierbar, verifizierbar, auditfähig.
- **Zero Data Retention** — Im ZDR-Modus werden Prompts und Antworten nicht gespeichert. Nur Metadaten. DSGVO-konform by Design.

---

## Wie die Kundenerfahrung ist

### Minute 0-1: Erste Berührung
Der Kunde findet aeneassoft.com. Er sieht: "Understand AI agents. Catch risks instantly." Er klickt auf den Playground und sieht einen interaktiven kausalen Graphen mit simulierten Multi-Agenten-Traces. Er denkt: "Das will ich für meine Agenten."

### Minute 1-3: Registration
Er klickt "Start for free". Registriert sich mit Email + Passwort. Bekommt sofort einen API Key. Eine Welcome-Email kommt an. Er ist jetzt im Dashboard — das ist leer, aber ein Onboarding-Guide zeigt drei Schritte:

```
Step 1: pip install aeneas-agentwatch
Step 2: export AGENTWATCH_API_KEY=aw_xxxxx
Step 3: import agentwatch; agentwatch.init()
```

### Minute 3-5: Integration
Er öffnet sein Python-Projekt, führt die drei Schritte aus. Ruft `agentwatch.verify()` auf — "[OK] AeneasSoft connection successful". Er macht einen normalen OpenAI-Call. Im Hintergrund passiert: unser SDK ersetzt die `create()`-Methode, fängt den Call ab, extrahiert Tokens/Kosten/Modell/Latenz, und sendet einen ATP-Span an unser Backend. Fire-and-forget in einem Daemon-Thread, 0.5ms Overhead.

### Minute 5-6: Erster Trace
Er geht zurück zum Dashboard. Der Onboarding-Guide ist verschwunden — stattdessen sieht er KPI-Karten: 1 Trace, 847 Tokens, $0.003 Cost. Er klickt auf den Trace und sieht den kausalen Graphen: ein einzelner Node mit seinem OpenAI-Call. Er sieht Input, Output, Modell, Latenz, Status.

### Tag 1-7: Integration in Produktion
Er wrapped seine Multi-Agenten-Pipeline mit `agentwatch.trace("my-pipeline")`. Jetzt sieht er im Dashboard: der Orchestrator-Agent ruft 3 Sub-Agenten auf, die jeweils verschiedene LLMs nutzen. Der kausale Graph zeigt die Delegationsketten. Die Kostenaufschlüsselung zeigt: "Agent C ist 10x teurer als Agent A — vielleicht sollte C ein kleineres Modell nutzen."

### Tag 7-30: Wertschöpfung
- Er setzt Budget-Limits: $10/Stunde, Email-Alert wenn überschritten.
- Er generiert seinen ersten Monthly Report: PDF mit allen Traces, Kosten pro Agent, Fehlerquoten, Compliance Score.
- Er exportiert CSVs für sein Finance-Team.
- Sein CTO fragt: "Sind wir bereit für den EU AI Act?" Er klickt auf "Download Article 12 Report" und hat ein RSA-signiertes PDF.

### Tag 30+: Upgrade
Er hat 8.000 von 10.000 freien Traces verbraucht. Im Dashboard sieht er die Usage-Bar. Er geht zu Billing, sieht die drei Pläne nebeneinander, klickt "Upgrade to Pro" ($99/month). Stripe Checkout. 30 Sekunden später hat er 100.000 Traces/month.

---

## Die Architektur in einem Bild

```
Entwickler-Code
      |
      v
[agentwatch.init()]
      |
      +---> SDK-Patcher (OpenAI, Anthropic)
      |         |
      |         v  set_sdk_active(True)
      |         |
      +---> HTTP-Interceptor (httpx, requests, aiohttp)
                |
                v  is_sdk_active()? → Skip Logging (Dedup)
                |
                v  Active Defense → Budget/Error/Loop Check
                |
                v  Fire-and-forget Span → Backend API
                                              |
                                              v
                                        ClickHouse DB
                                              |
                                              v
                                        Dashboard
                                     (Traces, Graphs,
                                      Costs, Reports)
```

---

## Positionierung im Markt

| | AeneasSoft | LangSmith | Helicone | Langfuse |
|---|---|---|---|---|
| Setup | 2 Zeilen | 5+ Zeilen + Callbacks | base_url ändern | SDK-spezifisch |
| Framework-Lock | Keiner | LangChain | Keiner (Proxy) | Teilweise |
| Active Defense | Ja (in-process) | Nein | Nein | Nein |
| EU AI Act PDF | Ja (RSA-signiert) | Nein | Nein | Nein |
| Zero Data Retention | Ja | Nein | Teilweise | Self-host |
| Kausal-Graph | DAG | Tree | Keiner | Tree |
| Patent | Provisional (USPTO) | Keines | Keines | Keines |

---

## Das Patent

**Titel:** Dual-Layer Telemetry Interception and Active Defense System for Artificial Intelligence Agents

**Filing:** USPTO Provisional Patent, April 2026

**8 Claims** die drei Kernbereiche abdecken:

1. **Claims 1, 3-5:** Dual-Layer Interception mit Deduplication — die Koordination zwischen SDK-Patcher und HTTP-Interceptor über Thread-lokale + ContextVar Flags.

2. **Claims 2, 6-8:** Active Defense Circuit Breaker — In-Process Blocking via `CircuitBreakerException` bevor der HTTP-Request das Netzwerk verlässt. Budget, Error Rate, Loop Detection über Sliding Windows.

3. **Claim 1 (implizit):** Framework-agnostisches HTTP-Transport-Patching — erkennt KI-Provider automatisch via URL-Pattern-Matching, funktioniert mit jedem Framework.

**Stärkster Patentaspekt:** Kein Prior Art kombiniert In-Process Active Defense (Blocking im Arbeitsspeicher) mit Dual-Layer Deduplication (SDK + HTTP koordiniert). OpenTelemetry hat kein KI-Bewusstsein. Helicone blockt erst am Proxy. LangSmith ist Framework-locked.

---

## Zusammenfassung

AeneasSoft ist die Röntgenaufnahme für KI-Agenten. Wir zeigen dir was deine Agenten tun, was sie kosten, und ob sie bereit für den EU AI Act sind. In zwei Zeilen Code, ohne dein Framework zu wechseln, mit Patent-geschützter Technologie die aktiv eingreift wenn etwas schiefläuft.

Kein anderes Tool kann das in dieser Kombination. Das ist unser Produkt.
