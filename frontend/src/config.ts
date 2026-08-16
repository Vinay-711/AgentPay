export const CONTRACT_ADDRESS = '0xeBf18776D53DF4370be8F5B4C4795671854b21DE';
export const MONAD_RPC_URL = 'https://testnet-rpc.monad.xyz';
export const CHAIN_ID = 10143;
export const EXPLORER_URL = 'https://testnet.monadscan.com';

// Default funded private key for demo agent wallet
export const DEMO_PRIVATE_KEY = '0xb493c00c7c99432a7d4d1a5c765b420c7b908fbe9bf05a2276d7e7f449b68792';

export interface SpecialistAgent {
  name: string;
  description: string;
  priceCents: number;
  priceUsd: string;
  serviceType: 'flight' | 'hotel' | 'activity' | 'weather' | 'budget' | 'research';
  recipient: string;
}

export const SPECIALIST_POOL: SpecialistAgent[] = [
  {
    name: 'FlightFinder',
    description: 'Finds flight options and prices',
    priceCents: 2,
    priceUsd: '$0.02',
    serviceType: 'flight',
    recipient: '0x1111111111111111111111111111111111111111',
  },
  {
    name: 'HotelFinder',
    description: 'Finds hotel options and prices',
    priceCents: 3,
    priceUsd: '$0.03',
    serviceType: 'hotel',
    recipient: '0x2222222222222222222222222222222222222222',
  },
  {
    name: 'ActivityFinder',
    description: 'Finds local activities and attractions',
    priceCents: 2,
    priceUsd: '$0.02',
    serviceType: 'activity',
    recipient: '0x3333333333333333333333333333333333333333',
  },
  {
    name: 'WeatherAgent',
    description: 'Checks weather forecasts for a location/date',
    priceCents: 1,
    priceUsd: '$0.01',
    serviceType: 'weather',
    recipient: '0x4444444444444444444444444444444444444444',
  },
  {
    name: 'BudgetAgent',
    description: 'Breaks down a budget across categories',
    priceCents: 2,
    priceUsd: '$0.02',
    serviceType: 'budget',
    recipient: '0x5555555555555555555555555555555555555555',
  },
  {
    name: 'ResearchAgent',
    description: 'General web research / fact lookup for a task',
    priceCents: 2,
    priceUsd: '$0.02',
    serviceType: 'research',
    recipient: '0x6666666666666666666666666666666666666666',
  },
];

export const AGENT_WALLET_ABI = [
  'function createAgent() external payable',
  'function pay(address payable to, uint256 amountCents, string memory label) external returns (bool)',
  'function getAgent(address owner) external view returns (uint256 balance, uint256 spent, uint8 reputation, bool exists)',
  'function bumpReputation(address owner, uint8 newScore) external',
  'event AgentCreated(address indexed owner, uint256 balance, uint8 reputation)',
  'event PaymentExecuted(address indexed from, address indexed to, uint256 amountCents, uint256 valueWei, string label)',
  'event ReputationBumped(address indexed owner, uint8 oldScore, uint8 newScore)',
];
