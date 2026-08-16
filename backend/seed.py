"""Seed demo specialist agents and marketplace services on Monad testnet and local DB."""

import asyncio
import logging
import sys
from pathlib import Path

# Add backend directory to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from backend.chain import chain_client
from backend.db.database import SessionLocal, init_db, save_agent, save_service

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger("seed")

DEMO_AGENTS = [
    {
        "name": "FlightFinder",
        "description": "Autonomous flight aggregation and booking agent specialized in EMEA and APAC routes.",
        "capabilities": ["flights", "aviation", "airline-booking", "fare-comparison"],
        "metadata_uri": "ipfs://bafkreiflightfinder001",
        "service": {
            "name": "Dubai Flight Search & Ticket Booking",
            "category": "flight",
            "price_eth": 0.05,
            "endpoint_uri": "https://api.agentpay.dev/agents/flight-finder/v1",
        },
    },
    {
        "name": "HotelFinder",
        "description": "Hospitality concierge agent with real-time room availability and corporate discounts.",
        "capabilities": ["hotels", "hospitality", "luxury-stays", "resort-booking"],
        "metadata_uri": "ipfs://bafkreihotelfinder002",
        "service": {
            "name": "Dubai Marina & Downtown Hotel Reservation",
            "category": "hotel",
            "price_eth": 0.08,
            "endpoint_uri": "https://api.agentpay.dev/agents/hotel-finder/v1",
        },
    },
    {
        "name": "ActivityFinder",
        "description": "Local experience curation and attraction ticket issuing agent.",
        "capabilities": ["activities", "tours", "excursions", "desert-safari", "tickets"],
        "metadata_uri": "ipfs://bafkreiactivityfinder003",
        "service": {
            "name": "Dubai Desert Safari & Burj Khalifa Fast-Track",
            "category": "activity",
            "price_eth": 0.04,
            "endpoint_uri": "https://api.agentpay.dev/agents/activity-finder/v1",
        },
    },
]


def seed_data():
    """Register demo agents and list services on Monad testnet."""
    init_db()
    db = SessionLocal()

    logger.info("🚀 Starting demo seed script for Monad testnet...")

    for agent_data in DEMO_AGENTS:
        try:
            logger.info(f"Registering on-chain agent: {agent_data['name']}...")
            reg_res = chain_client.register_agent(
                metadata_uri=agent_data["metadata_uri"],
                capabilities=agent_data["capabilities"],
            )
            agent_id = reg_res["agent_id"] or 1
            logger.info(f"✅ Agent {agent_data['name']} registered on Monad testnet (ID #{agent_id}, tx: {reg_res['tx_hash']})")

            # Save in DB
            save_agent(
                db=db,
                agent_id=agent_id,
                owner=chain_client.sender_address,
                name=agent_data["name"],
                description=agent_data["description"],
                capabilities=agent_data["capabilities"],
                metadata_uri=agent_data["metadata_uri"],
                reputation_score=50,
                wallet_address=chain_client.wallet_address or "",
            )

            # List service on-chain
            svc_data = agent_data["service"]
            logger.info(f"Listing service: '{svc_data['name']}' ({svc_data['price_eth']} ETH)...")
            svc_res = chain_client.list_service(
                agent_id=agent_id,
                name=svc_data["name"],
                price_eth=svc_data["price_eth"],
                endpoint_uri=svc_data["endpoint_uri"],
            )
            service_id = svc_res["service_id"] or agent_id
            logger.info(f"✅ Service #{service_id} listed on-chain (tx: {svc_res['tx_hash']})")

            # Save service in DB
            save_service(
                db=db,
                service_id=service_id,
                agent_id=agent_id,
                name=svc_data["name"],
                category=svc_data["category"],
                price_eth=svc_data["price_eth"],
                endpoint_uri=svc_data["endpoint_uri"],
            )

        except Exception as e:
            logger.error(f"Error seeding agent {agent_data['name']}: {e}")

    db.close()
    logger.info("✨ Demo seeding complete!")


if __name__ == "__main__":
    seed_data()
