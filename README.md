# Agent System

Based on the [Architecture Design](./docs/architecture_design.md).

## Structure

- **agent-core/**: TypeScript-based Agent Core (ReAct Engine, Planner, etc.)
- **mcp-servers/**: Python-based MCP Servers (Tools)
  - **python-sandbox/**: Python code execution environment
  - **data-processor/**: (Planned) Data processing tools

## Getting Started

### Agent Core

```bash
cd agent-core
npm install
npm run build
```

### Python Sandbox

```bash
cd mcp-servers/python-sandbox
pip install -r requirements.txt
python server.py
```
