# Contributing to AeneasSoft

Thanks for your interest in contributing to AeneasSoft — the open source kill switch for AI agents.

## Quick Links

- **Website:** [aeneassoft.com](https://aeneassoft.com)
- **Docs:** [aeneassoft.com/docs](https://aeneassoft.com/en/docs)
- **Issues:** [GitHub Issues](https://github.com/aeneassoft/aeneassoft/issues)

## How to Contribute

### Reporting Bugs

Open an issue with:
- What you expected to happen
- What actually happened
- Steps to reproduce
- Python/Node.js version + SDK version

### Feature Requests

Open an issue with the `enhancement` label. Describe:
- The problem you're trying to solve
- Your proposed solution
- Why this benefits other users

### Code Contributions

1. Fork the repo
2. Create a branch: `git checkout -b feat/your-feature`
3. Make your changes
4. Run tests: `cd sdks/python && python -m pytest tests/ -v`
5. Submit a PR

### What We're Looking For

- **New AI provider support** (add to `interceptor.py` provider registry)
- **Framework-specific examples** (LangChain, CrewAI, AutoGen, etc.)
- **Bug fixes** in the circuit breaker or interceptor
- **Documentation improvements**
- **Performance optimizations**

### What We Won't Accept

- Changes that add external dependencies to the core SDK
- Features that require a cloud connection for the open source version
- Anything that breaks the 2-line setup promise

## Architecture

```
sdks/python/agentwatch/     ← Python SDK (MIT License)
  interceptor.py            ← HTTP transport patching (Layer 2)
  patcher.py                ← SDK method patching (Layer 1)
  circuit_breaker.py        ← Active Defense (budget/error/loop)
  context.py                ← Trace context propagation

sdks/node/src/              ← Node.js SDK (MIT License)
  interceptor.ts            ← HTTP core patching
  patcher.ts                ← SDK method patching

backend/src/                ← Backend API (Fastify + ClickHouse)
frontend/                   ← Dashboard (Next.js)
```

## Development Setup

```bash
# Clone
git clone https://github.com/aeneassoft/aeneassoft.git
cd aeneassoft

# Backend + Dashboard (local mode)
docker compose -f docker-compose.local.yml up -d

# Python SDK development
cd sdks/python
pip install -e ".[dev]"
python -m pytest tests/ -v

# Frontend development
cd frontend
npm install
npm run dev
```

## Code Style

- **TypeScript:** Follow existing patterns. Kebab-case filenames.
- **Python:** PEP 8. Snake_case. Type hints where helpful.
- **React:** Functional components. Tailwind CSS.
- **Tests:** Every new feature needs tests. No exceptions.

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

The **method** (Dual-Layer Telemetry Interception and Active Defense) is protected by a USPTO Provisional Patent. Contributing code does not grant patent rights.
