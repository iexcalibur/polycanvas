<div align="center">
  <img src="./polycanvas-logo.svg" width="96" alt="PolyCanvas" />
  <h1>PolyCanvas</h1>
  <p>A local-first infinite canvas for sketching, diagramming and thinking visually.</p>
</div>

PolyCanvas is the edgeless canvas from [Polymind](https://github.com/iexcalibur/polymind)
(itself derived from AFFiNE / BlockSuite) shipped as its own product. Open it and you are
on a canvas. There are no page-mode documents, journals, tags or AI assistants around it.
Everything is stored on your device.

## Run it

```bash
yarn install
yarn polycanvas dev -p @polycanvas/web
```

Then open <http://localhost:8090>.

Desktop app (optional, macOS arm64 binaries are prebuilt):

```bash
yarn polycanvas dev -p @polycanvas/electron
```

## Where things live

| Path | What |
| --- | --- |
| `blockmind/` | The canvas engine (BlockSuite fork): surface, shapes, connectors, mindmaps, toolbar, frames |
| `packages/frontend/core/` | App shell: workspace, routing, settings, the editor host |
| `packages/frontend/apps/web/` | Web entry |
| `packages/frontend/apps/electron/` | Desktop entry |
| `docs/POLYCANVAS_PLAN.md` | The separation plan from Polymind, phase by phase, with what has landed |
| `scripts/generate-icons.py` | Regenerates every favicon and app icon from the logo definition |

Internal package scopes are `@polycanvas/*` and `@blockmind/*`; see the
plan's Phase 5 for the rename.

## Building and contributing

See [docs/BUILDING.md](./docs/BUILDING.md). Node 22 and Yarn 4 are required. Rust is only
needed to rebuild the native module for the desktop app.

## License

MIT, see [LICENSE](./LICENSE). Derived from AFFiNE and BlockSuite by toeverything.
