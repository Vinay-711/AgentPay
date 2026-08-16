"""Quick local DB seed for Team Lunch Service (Restaurant B)."""
from backend.db.database import SessionLocal, init_db, save_agent, save_service
from backend.chain import chain_client

init_db()
db = SessionLocal()

# Save LunchAgent
save_agent(
    db=db,
    agent_id=10,
    owner=chain_client.sender_address,
    name="LunchAgent Pro",
    description="Autonomous meal and corporate catering procurement agent.",
    capabilities=["lunch", "food", "catering", "restaurants", "meals"],
    metadata_uri="ipfs://bafkreilunchagent010",
    reputation_score=99,
    wallet_address=chain_client.wallet_address or "0x06706878Dd25c00E4C99A83c8A0ef8d91358523D",
)

# Save Restaurant B Service
save_service(
    db=db,
    service_id=10,
    agent_id=10,
    name="Team Lunch Catering & Delivery (Restaurant B)",
    category="lunch",
    price_eth=0.035,
    endpoint_uri="https://api.agentpay.dev/catering/v1",
)

db.close()
print("✅ Seeded Restaurant B service locally in DB!")
