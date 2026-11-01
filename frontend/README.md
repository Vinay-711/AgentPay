# AgentPay Dashboard

The React dashboard presents wallets, agents, marketplace services and policy decisions. It depends on the separately configured backend and testnet contracts.

## Develop

Run from this directory with Node.js compatible with the dependency versions in [package.json](package.json):

```sh
npm ci
npm run dev
```

Use the local address printed by Vite. Configuration and backend startup are described in the [project README](../README.md); start those services in separate terminals.

## Available checks

```sh
npm run lint
npm run build
npm run preview
```

These are the scripts present in the manifest. A successful bundle build is not a backend integration test. Check the API-offline state, failed requests, keyboard navigation and small-screen layout when changing the client. Never place private provider keys or wallet secrets in browser-visible environment values.
