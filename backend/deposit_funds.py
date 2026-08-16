"""Deposit 0.5 MON into Agent #1 and Agent #10 on Monad testnet."""
from backend.chain import chain_client

print("Depositing 0.5 MON into Agent #1 on Monad testnet...")
res1 = chain_client.deposit(agent_id=1, amount_eth=0.5)
print(f"✅ Deposited into Agent #1! Tx: {res1['tx_hash']} | Explorer: {res1['explorer_url']}")

print("Depositing 0.2 MON into Agent #10 on Monad testnet...")
res2 = chain_client.deposit(agent_id=10, amount_eth=0.2)
print(f"✅ Deposited into Agent #10! Tx: {res2['tx_hash']} | Explorer: {res2['explorer_url']}")

bal1 = chain_client.get_wallet_balance(1)
bal10 = chain_client.get_wallet_balance(10)
print(f"Current on-chain balances: Agent #1 = {bal1} MON, Agent #10 = {bal10} MON")
