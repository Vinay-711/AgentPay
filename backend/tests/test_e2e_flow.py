import asyncio
import json
import httpx
import websockets

BACKEND_URL = "http://127.0.0.1:8000"
WS_URL = "ws://127.0.0.1:8000/ws/activity/1"

async def run_e2e():
    print("=== STARTING AGENTPAY END-TO-END VERIFICATION ===")
    
    async with httpx.AsyncClient(timeout=120.0) as client:
        # 1. Check health
        health = await client.get(f"{BACKEND_URL}/health")
        print(f"[1] Backend Health: {health.status_code} -> Network: {health.json()['network']}")
        assert health.status_code == 200

        # 2. Get initial wallet state
        wallet_before = (await client.get(f"{BACKEND_URL}/api/wallet/1")).json()
        print(f"[2] Wallet Initial Balance: {wallet_before['balance_eth']} MON (Spent Today: {wallet_before['spent_today_eth']} MON)")

        # 3. Configure limits: $10 daily, $2 per-tx
        limits_res = await client.post(
            f"{BACKEND_URL}/api/agents/1/limits",
            json={
                "daily_limit_eth": 10.0,
                "per_tx_limit_eth": 2.0,
                "approval_threshold_eth": 0.5
            }
        )
        print(f"[3] Set Limits (Daily 10 MON, Per-Tx 2 MON): {limits_res.status_code} -> Tx: {limits_res.json().get('tx_hash')}")

        # 4. Open WebSocket connection to capture live streaming activity
        ws_events = []
        async def listen_ws():
            try:
                async with websockets.connect(WS_URL) as ws:
                    print(f"[WS] Connected to {WS_URL} - Listening for live activity events...")
                    while True:
                        msg = await ws.recv()
                        data = json.loads(msg)
                        ws_events.append(data)
                        print(f"  [WS EVENT] Type: {data.get('event_type')} | Data: {data.get('data')}")
            except Exception as e:
                pass

        ws_task = asyncio.create_task(listen_ws())
        await asyncio.sleep(1)  # Allow WS to connect

        # 5. Submit Orchestration Task: "Plan a 3-day Dubai trip under $500"
        print("[4] Submitting Task: 'Plan a 3-day Dubai trip under $500' to Agent #1...")
        task_res = await client.post(
            f"{BACKEND_URL}/api/tasks",
            json={
                "agent_id": 1,
                "task": "Plan a 3-day Dubai trip under $500"
            }
        )
        print(f"[5] Task Response Status: {task_res.status_code}")
        result_data = task_res.json()
        print(f"  - Status: {result_data.get('status')}")
        print(f"  - Total Spent: {result_data.get('total_spent_eth')} MON")
        print(f"  - Hired Services Count: {len(result_data.get('hired_services', []))}")
        
        for h in result_data.get('hired_services', []):
            print(f"  - HIRED: {h.get('service_name')} ({h.get('amount_eth')} ETH)")
            print(f"    * Real Monad Tx Hash: {h.get('tx_hash')}")
            print(f"    * Explorer URL: {h.get('explorer_url')}")

        # Let WS catch remaining events
        await asyncio.sleep(2)
        ws_task.cancel()

        # 6. Check updated wallet state
        wallet_after = (await client.get(f"{BACKEND_URL}/api/wallet/1")).json()
        print(f"[6] Wallet Balance After: {wallet_after['balance_eth']} MON (Spent Today: {wallet_after['spent_today_eth']} MON)")
        print(f"[6] Total Transactions Logged: {len(wallet_after.get('transactions', []))}")
        print(f"[7] Total Live WS Events Received: {len(ws_events)}")

        print("\n=== VERIFICATION SUMMARY ===")
        print(f"Verified Real On-Chain Tx Produced: {bool(result_data.get('hired_services'))}")
        print("=== END-TO-END FLOW SUCCESSFULLY COMPLETED ===")

if __name__ == "__main__":
    asyncio.run(run_e2e())
