# AgentPay Contracts

Solidity contracts for the AgentPay testnet prototype, built with Foundry. The source is under [src](src); active deployment scripts are under [script](script). Legacy tests are kept under [old_tests](old_tests) and may require updating to match the active contract.

## Local checks

From this directory, with Foundry installed:

```sh
forge build
forge test
forge fmt --check
```

`forge test` only exercises tests discovered by the configured Foundry paths; a zero-test result is not coverage. Read [foundry.toml](foundry.toml) for compiler/remapping configuration and the [project README](../README.md) for the relationship between registry, wallets, marketplace and reputation. Generic Foundry Counter deployment commands do not deploy AgentPay.

## Deployment boundary

[deploy-monad.sh](deploy-monad.sh) is an explicit testnet deployment helper. Inspect the script, network and required environment values before invoking it. Deployment broadcasts transactions and is separate from the local build/test commands above. Do not paste private keys into README commands or commit wallet credentials. Existing addresses in [deployed-addresses.json](deployed-addresses.json) must be verified against the intended network before use.

This is not an audited mainnet payment system. A passing contract test suite does not prove economic safety or successful backend settlement.
