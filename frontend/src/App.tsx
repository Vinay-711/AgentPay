import { useState, useEffect } from 'react';
import {
  createTravelAgentOnChain,
  fetchAgentFromChain,
  paySpecialistOnChain,
  payMultipleSpecialistsConcurrently,
  bumpReputationOnChain,
  type AgentData,
  type ActivityStep,
  type MultiPaymentResult,
} from './walletClient';
import {
  planTaskWithLLM,
  synthesizeFinalResult,
  generateFlightDetails,
  generateHotelDetails,
  getTopHotelRecommendations,
  getTopFlightRecommendations,
  getTopActivityRecommendations,
  getDestinationName,
  type OrchestrationPlan,
  type FlightBookingResult,
  type HotelBookingResult,
  type HotelOption,
  type FlightOption,
  type ActivityOption,
} from './orchestrator';
import { CONTRACT_ADDRESS, EXPLORER_URL, type SpecialistAgent } from './config';
import AgentNodeGraph from './components/AgentNodeGraph';
import BoardingPass from './components/BoardingPass';
import HotelCard from './components/HotelCard';
import RecommendationSelector from './components/RecommendationSelector';
import AgentPassportModal from './components/AgentPassportModal';

type StepPhase = 'idle' | 'plan_ready' | 'recommending' | 'discovered' | 'awaiting_approval' | 'risky_blocked' | 'ready_to_synthesize' | 'completed';

// Per-transaction policy limit ($2.00 max per autonomous payment)
const PER_TX_LIMIT_DOLLARS = 2.0;

interface RiskyRequest {
  amountUsd: string;
  amountDollars: number;
  recipient: string;
  reason: string;
  checks: Array<{ label: string; passed: boolean; detail: string }>;
}

function formatError(err: any): string {
  const msg = err?.message || String(err);
  if (msg.includes('50/second') || msg.includes('-32007') || msg.includes('coalesce') || msg.includes('rate limit')) {
    return 'Monad Testnet RPC reached temporary burst rate limit. Auto-retried with exponential backoff — please try again in a moment.';
  }
  if (msg.includes('insufficient funds') || msg.includes('Insufficient balance')) {
    return 'Insufficient balance in the agent wallet.';
  }
  return msg.length > 150 ? msg.slice(0, 150) + '...' : msg;
}

export default function App() {
  const [agent, setAgent] = useState<AgentData | null>(null);
  const [isCreatingAgent, setIsCreatingAgent] = useState(false);
  const [createdTxHash, setCreatedTxHash] = useState<string | null>(null);

  // Session-wide real live metrics (persisted during session)
  const [sessionTxCount, setSessionTxCount] = useState(0);
  const [sessionTotalSettled, setSessionTotalSettled] = useState(0.0);
  const [sessionTotalTimeMs, setSessionTotalTimeMs] = useState(0);

  // Free-text editable input with placeholder
  const [taskInput, setTaskInput] = useState('');
  const [isPlanning, setIsPlanning] = useState(false);
  const [isPaying, setIsPaying] = useState(false);
  const [isSynthesizing, setIsSynthesizing] = useState(false);

  // Orchestration & Step-by-Step state machine
  const [plan, setPlan] = useState<OrchestrationPlan | null>(null);
  const [currentHireIndex, setCurrentHireIndex] = useState(0);
  const [stepPhase, setStepPhase] = useState<StepPhase>('idle');

  // Risky request simulation state
  const [riskyRequest, setRiskyRequest] = useState<RiskyRequest | null>(null);

  // Approved vs Denied tracking
  const [approvedAgents, setApprovedAgents] = useState<SpecialistAgent[]>([]);
  const [deniedAgents, setDeniedAgents] = useState<SpecialistAgent[]>([]);

  // Speed showcase state for the latest run
  const [lastSpeedMetric, setLastSpeedMetric] = useState<{
    count: number;
    durationMs: number;
    impliedTps: number;
    amountDollars: number;
  } | null>(null);

  // Feed & Final Result
  const [activities, setActivities] = useState<ActivityStep[]>([]);
  const [finalResultText, setFinalResultText] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Demo boarding pass (generated when FlightFinder payment is confirmed)
  const [flightDetails, setFlightDetails] = useState<FlightBookingResult | null>(null);

  // Hotel booking card (generated when HotelFinder payment is confirmed)
  const [hotelDetails, setHotelDetails] = useState<HotelBookingResult | null>(null);

  // Recommendations state (Top 5 choices for user selection)
  const [selectedHotelOption, setSelectedHotelOption] = useState<HotelOption | null>(null);
  const [selectedFlightOption, setSelectedFlightOption] = useState<FlightOption | null>(null);
  const [selectedActivityOption, setSelectedActivityOption] = useState<ActivityOption | null>(null);

  const [hotelOptions, setHotelOptions] = useState<HotelOption[]>([]);
  const [flightOptions, setFlightOptions] = useState<FlightOption[]>([]);
  const [activityOptions, setActivityOptions] = useState<ActivityOption[]>([]);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);

  // Holographic ERC-8004 Agent Passport state
  const [isPassportOpen, setIsPassportOpen] = useState(false);
  const [completedTasks, setCompletedTasks] = useState<string[]>(['Monad Genesis']);

  // Hands-Free Live Voice Command state (Web Speech API)
  const [isListening, setIsListening] = useState(false);

  const startVoiceInput = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setErrorMsg('Web Speech API is not supported in this browser. Please use Chrome/Edge or type your task.');
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'en-US';
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      setIsListening(true);
      setErrorMsg(null);

      recognition.onresult = (event: any) => {
        const transcript = Array.from(event.results)
          .map((result: any) => result[0].transcript)
          .join('');
        setTaskInput(transcript);
      };

      recognition.onerror = (event: any) => {
        console.warn('Speech recognition error:', event.error);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.start();
    } catch (err: any) {
      console.warn('Speech start error:', err);
      setIsListening(false);
    }
  };

  // Check if agent already exists on contract on load
  useEffect(() => {
    fetchAgentFromChain()
      .then((data) => {
        if (data && data.exists) {
          setAgent(data);
        }
      })
      .catch((err) => console.warn('Chain fetch error:', err));
  }, []);

  const getTime = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  // 1. Create Agent on Monad Testnet
  const handleCreateAgent = async () => {
    setIsCreatingAgent(true);
    setErrorMsg(null);
    try {
      const res = await createTravelAgentOnChain();
      setCreatedTxHash(res.txHash);
      setAgent(res.agent);
    } catch (err: any) {
      console.error('Error creating agent:', err);
      setErrorMsg(formatError(err));
    } finally {
      setIsCreatingAgent(false);
    }
  };

  // 2. Start Planning (LLM Call)
  const handleRunAgent = async () => {
    if (!taskInput.trim() || isPlanning) return;
    setIsPlanning(true);
    setErrorMsg(null);
    setActivities([]);
    setFinalResultText(null);
    setApprovedAgents([]);
    setDeniedAgents([]);
    setCurrentHireIndex(0);
    setLastSpeedMetric(null);
    setRiskyRequest(null);
    setFlightDetails(null);
    setHotelDetails(null);
    setSelectedHotelOption(null);
    setSelectedFlightOption(null);
    setSelectedActivityOption(null);
    setHotelOptions([]);
    setFlightOptions([]);
    setActivityOptions([]);
    setSelectedOptionId(null);

    try {
      const generatedPlan = await planTaskWithLLM(taskInput);
      setPlan(generatedPlan);

      if (generatedPlan.hires.length === 0) {
        setActivities([
          {
            id: 'plan-empty',
            type: 'plan',
            text: `LLM Assessment: ${generatedPlan.summary}`,
            timestamp: getTime(),
          },
        ]);
        setStepPhase('ready_to_synthesize');
      } else {
        setActivities([
          {
            id: 'plan-summary',
            type: 'plan',
            text: `Plan: ${generatedPlan.summary}`,
            timestamp: getTime(),
          },
        ]);
        setStepPhase('plan_ready');
      }
    } catch (err: any) {
      console.error('Planning error:', err);
      setErrorMsg(err.message || 'Failed to generate orchestration plan');
      setStepPhase('idle');
    } finally {
      setIsPlanning(false);
    }
  };

  // 2b. Simulate Risky Request (AgentGuard Policy Gate Test)
  const handleSimulateRiskyRequest = () => {
    setErrorMsg(null);
    setActivities([]);
    setFinalResultText(null);
    setPlan(null);
    setLastSpeedMetric(null);

    const fakeRiskyAmount = 8.5; // $8.50
    const fakeRecipient = '0x9999999999999999999999999999999999999999';
    const fakeReason = 'unspecified service';

    const checks = [
      {
        label: 'Within per-transaction limit',
        passed: false,
        detail: `$${fakeRiskyAmount.toFixed(2)} exceeds max limit of $${PER_TX_LIMIT_DOLLARS.toFixed(2)}`,
      },
      {
        label: 'Recipient verified',
        passed: false,
        detail: `Address ${fakeRecipient.slice(0, 6)}...${fakeRecipient.slice(-4)} is unknown & unverified`,
      },
      {
        label: 'Task similarity & context match',
        passed: false,
        detail: 'Vague intent "unspecified service" has 0.00 cosine similarity',
      },
      {
        label: 'Agent wallet active',
        passed: true,
        detail: 'TravelAgent wallet is funded & operational on Monad',
      },
      {
        label: 'Sufficient total funds',
        passed: (agent?.balance || 10.0) >= fakeRiskyAmount,
        detail: `Balance $${(agent?.balance || 10.0).toFixed(2)} >= $${fakeRiskyAmount.toFixed(2)}`,
      },
    ];

    setRiskyRequest({
      amountUsd: `$${fakeRiskyAmount.toFixed(2)}`,
      amountDollars: fakeRiskyAmount,
      recipient: fakeRecipient,
      reason: fakeReason,
      checks,
    });

    setActivities([
      {
        id: `risky-block-${Date.now()}`,
        type: 'payment_denied',
        text: `AgentGuard blocked a $${fakeRiskyAmount.toFixed(2)} payment — exceeded per-transaction limit and recipient not verified`,
        timestamp: getTime(),
      },
    ]);

    setStepPhase('risky_blocked');
  };

  // 3. Step-by-Step Discovery & Top 5 Recommendation Branch
  const handleNextStep = () => {
    if (!plan || currentHireIndex >= plan.hires.length) return;

    const currentHire = plan.hires[currentHireIndex];
    const dest = getDestinationName(taskInput);

    if (currentHire.agent.name === 'HotelFinder') {
      const recs = getTopHotelRecommendations(taskInput);
      setHotelOptions(recs);
      setSelectedOptionId(recs[0]?.id || null);
      setSelectedHotelOption(recs[0] || null);

      setActivities((prev) => [
        ...prev,
        {
          id: `rec-hotel-${Date.now()}`,
          type: 'discovery',
          text: `TravelAgent searched and retrieved Top 5 Hotel options in ${dest}.`,
          agent: currentHire.agent,
          timestamp: getTime(),
        },
      ]);
      setStepPhase('recommending');
      return;
    }

    if (currentHire.agent.name === 'FlightFinder') {
      const recs = getTopFlightRecommendations(taskInput);
      setFlightOptions(recs);
      setSelectedOptionId(recs[0]?.id || null);
      setSelectedFlightOption(recs[0] || null);

      setActivities((prev) => [
        ...prev,
        {
          id: `rec-flight-${Date.now()}`,
          type: 'discovery',
          text: `TravelAgent searched and retrieved Top 5 Flight routes to ${dest}.`,
          agent: currentHire.agent,
          timestamp: getTime(),
        },
      ]);
      setStepPhase('recommending');
      return;
    }

    if (currentHire.agent.name === 'ActivityFinder') {
      const recs = getTopActivityRecommendations(taskInput);
      setActivityOptions(recs);
      setSelectedOptionId(recs[0]?.id || null);
      setSelectedActivityOption(recs[0] || null);

      setActivities((prev) => [
        ...prev,
        {
          id: `rec-act-${Date.now()}`,
          type: 'discovery',
          text: `TravelAgent curated Top 5 local experiences & tours in ${dest}.`,
          agent: currentHire.agent,
          timestamp: getTime(),
        },
      ]);
      setStepPhase('recommending');
      return;
    }

    // Default discovery for other agents
    const discStep: ActivityStep = {
      id: `disc-${currentHireIndex}-${Date.now()}`,
      type: 'discovery',
      text: `TravelAgent found ${currentHire.agent.name} — ${currentHire.agent.description} — ${currentHire.agent.priceUsd}`,
      agent: currentHire.agent,
      timestamp: getTime(),
    };
    setActivities((prev) => [...prev, discStep]);
    setStepPhase('awaiting_approval');
  };

  // Select a specific recommendation from the top 5
  const handleSelectRecommendation = (id: string) => {
    setSelectedOptionId(id);
    if (hotelOptions.length > 0) {
      const found = hotelOptions.find((h) => h.id === id);
      if (found) setSelectedHotelOption(found);
    }
    if (flightOptions.length > 0) {
      const found = flightOptions.find((f) => f.id === id);
      if (found) setSelectedFlightOption(found);
    }
    if (activityOptions.length > 0) {
      const found = activityOptions.find((a) => a.id === id);
      if (found) setSelectedActivityOption(found);
    }
  };

  // Confirm user choice and proceed to payment
  const handleConfirmRecommendation = () => {
    if (!plan || currentHireIndex >= plan.hires.length) return;
    const currentHire = plan.hires[currentHireIndex];

    let chosenText = '';
    if (currentHire.agent.name === 'HotelFinder' && selectedHotelOption) {
      chosenText = `Selected Hotel: ${selectedHotelOption.name} (${selectedHotelOption.pricePerNight}/night, ${selectedHotelOption.address})`;
    } else if (currentHire.agent.name === 'FlightFinder' && selectedFlightOption) {
      chosenText = `Selected Flight: ${selectedFlightOption.airline} ${selectedFlightOption.flightNumber} (${selectedFlightOption.departure} → ${selectedFlightOption.arrival}, ${selectedFlightOption.price})`;
    } else if (currentHire.agent.name === 'ActivityFinder' && selectedActivityOption) {
      chosenText = `Selected Attraction: ${selectedActivityOption.title} (${selectedActivityOption.price})`;
    }

    if (chosenText) {
      setActivities((prev) => [
        ...prev,
        {
          id: `chosen-${Date.now()}`,
          type: 'discovery',
          text: `User confirmed choice: ${chosenText}`,
          agent: currentHire.agent,
          timestamp: getTime(),
        },
      ]);
    }

    setStepPhase('awaiting_approval');
  };

  // 4. Single Payment Approval
  const handleApprovePayment = async () => {
    if (!plan || currentHireIndex >= plan.hires.length || isPaying) return;
    const currentHire = plan.hires[currentHireIndex];
    setIsPaying(true);
    setErrorMsg(null);

    try {
      const payResult = await paySpecialistOnChain(currentHire.agent, taskInput);

      const paidStep: ActivityStep = {
        id: `paid-${currentHireIndex}-${Date.now()}`,
        type: 'payment_paid',
        text: `TravelAgent hired ${currentHire.agent.name} — paying ${currentHire.agent.priceUsd} (confirmed in ${payResult.durationMs}ms)`,
        agent: currentHire.agent,
        amount: currentHire.agent.priceUsd,
        txHash: payResult.txHash,
        explorerUrl: payResult.explorerUrl,
        settleTimeMs: payResult.durationMs,
        timestamp: getTime(),
      };
      setActivities((prev) => [...prev, paidStep]);

      // Update stat cards live
      const paidDollar = currentHire.agent.priceCents / 100;
      setAgent((prev) => {
        if (!prev) return null;
        const newSpent = Number((prev.spent + paidDollar).toFixed(2));
        const newBalance = Number((prev.balance - paidDollar).toFixed(2));
        return { ...prev, spent: newSpent, balance: newBalance };
      });

      // Update session metrics
      setSessionTxCount((c) => c + 1);
      setSessionTotalSettled((s) => Number((s + paidDollar).toFixed(2)));
      setSessionTotalTimeMs((t) => t + payResult.durationMs);

      setApprovedAgents((prev) => [...prev, currentHire.agent]);

      // Generate demo boarding pass when FlightFinder is confirmed paid
      if (currentHire.agent.name === 'FlightFinder') {
        setFlightDetails(generateFlightDetails(taskInput, payResult.txHash, selectedFlightOption || undefined));
      }

      // Generate hotel card when HotelFinder is confirmed paid
      if (currentHire.agent.name === 'HotelFinder') {
        setHotelDetails(generateHotelDetails(taskInput, payResult.txHash, selectedHotelOption || undefined));
      }

      const nextIndex = currentHireIndex + 1;
      setCurrentHireIndex(nextIndex);
      if (nextIndex < plan.hires.length) {
        setStepPhase('plan_ready');
      } else {
        setStepPhase('ready_to_synthesize');
      }
    } catch (err: any) {
      console.error('Payment error:', err);
      setErrorMsg(formatError(err));
    } finally {
      setIsPaying(false);
    }
  };

  // 4b. Concurrent Batch Approval (Promise.all - Monad Parallel Speed Showcase)
  const handleApproveAllConcurrently = async () => {
    if (!plan || plan.hires.length === 0 || isPaying) return;
    setIsPaying(true);
    setErrorMsg(null);

    try {
      const specialistsToPay = plan.hires.map((h) => h.agent);
      const batchResult: MultiPaymentResult = await payMultipleSpecialistsConcurrently(
        specialistsToPay,
        taskInput
      );

      const batchSteps: ActivityStep[] = batchResult.results.map((r, i) => ({
        id: `concurrent-${i}-${Date.now()}`,
        type: 'payment_paid',
        text: `TravelAgent hired ${r.agent.name} — paying ${r.agent.priceUsd} (parallel broadcast)`,
        agent: r.agent,
        amount: r.agent.priceUsd,
        txHash: r.txHash,
        explorerUrl: r.explorerUrl,
        timestamp: getTime(),
      }));

      setActivities((prev) => [...prev, ...batchSteps]);

      // Update stat cards live
      setAgent((prev) => {
        if (!prev) return null;
        const newSpent = Number((prev.spent + batchResult.totalAmountDollars).toFixed(2));
        const newBalance = Number((prev.balance - batchResult.totalAmountDollars).toFixed(2));
        return { ...prev, spent: newSpent, balance: newBalance };
      });

      // Record real measured speed showcase metrics
      setLastSpeedMetric({
        count: specialistsToPay.length,
        durationMs: batchResult.totalDurationMs,
        impliedTps: batchResult.impliedTps,
        amountDollars: batchResult.totalAmountDollars,
      });

      // Update session metrics
      setSessionTxCount((c) => c + specialistsToPay.length);
      setSessionTotalSettled((s) => Number((s + batchResult.totalAmountDollars).toFixed(2)));
      setSessionTotalTimeMs((t) => t + batchResult.totalDurationMs);

      setApprovedAgents(specialistsToPay);

      // Generate demo boarding pass for concurrent runs that include FlightFinder
      const flightResult = batchResult.results.find((r) => r.agent.name === 'FlightFinder');
      if (flightResult) {
        setFlightDetails(generateFlightDetails(taskInput, flightResult.txHash));
      }

      // Generate hotel card for concurrent runs that include HotelFinder
      const hotelResult = batchResult.results.find((r) => r.agent.name === 'HotelFinder');
      if (hotelResult) {
        setHotelDetails(generateHotelDetails(taskInput, hotelResult.txHash));
      }

      setCurrentHireIndex(plan.hires.length);
      setStepPhase('ready_to_synthesize');
    } catch (err: any) {
      console.error('Batch payment error:', err);
      setErrorMsg(formatError(err));
    } finally {
      setIsPaying(false);
    }
  };

  // 5. Payment Denial
  const handleDenyPayment = () => {
    if (!plan || currentHireIndex >= plan.hires.length) return;
    const currentHire = plan.hires[currentHireIndex];

    const deniedStep: ActivityStep = {
      id: `denied-${currentHireIndex}-${Date.now()}`,
      type: 'payment_denied',
      text: `Payment to ${currentHire.agent.name} denied by user.`,
      agent: currentHire.agent,
      timestamp: getTime(),
    };
    setActivities((prev) => [...prev, deniedStep]);

    setDeniedAgents((prev) => [...prev, currentHire.agent]);

    const nextIndex = currentHireIndex + 1;
    setCurrentHireIndex(nextIndex);
    if (nextIndex < plan.hires.length) {
      setStepPhase('plan_ready');
    } else {
      setStepPhase('ready_to_synthesize');
    }
  };

  // 6. Synthesize Final Result & Bump Reputation
  const handleGenerateResult = async () => {
    if (isSynthesizing) return;
    setIsSynthesizing(true);
    setErrorMsg(null);

    try {
      const resultText = await synthesizeFinalResult(taskInput, approvedAgents, deniedAgents);
      setFinalResultText(resultText);

      const startingRep = 94;
      const reputationIncrease = approvedAgents.length;
      const newReputation = Math.min(100, startingRep + reputationIncrease);

      if (approvedAgents.length > 0) {
        await bumpReputationOnChain(newReputation).catch(console.warn);
      }

      setAgent((prev) => (prev ? { ...prev, reputation: newReputation } : null));

      setActivities((prev) => [
        ...prev,
        {
          id: `res-${Date.now()}`,
          type: 'result',
          text: 'Itinerary / Deliverable generated ✓',
          timestamp: getTime(),
        },
        {
          id: `rep-${Date.now()}`,
          type: 'reputation',
          text: `Reputation updated: ${startingRep} → ${newReputation} (${approvedAgents.length} approved, ${deniedAgents.length} denied)`,
          timestamp: getTime(),
        },
      ]);

      setCompletedTasks((prev) => [...prev, taskInput]);
      setStepPhase('completed');
    } catch (err: any) {
      console.error('Synthesis error:', err);
      setErrorMsg(err.message || 'Failed to synthesize result');
    } finally {
      setIsSynthesizing(false);
    }
  };

  const handleReset = () => {
    setTaskInput('');
    setPlan(null);
    setActivities([]);
    setFinalResultText(null);
    setApprovedAgents([]);
    setDeniedAgents([]);
    setCurrentHireIndex(0);
    setStepPhase('idle');
    setErrorMsg(null);
    setLastSpeedMetric(null);
    setRiskyRequest(null);
    if (agent) {
      setAgent({
        ...agent,
        balance: 10.0,
        spent: 0.0,
        reputation: 94,
      });
    }
  };

  const avgSessionMs = sessionTxCount > 0 ? Math.round(sessionTotalTimeMs / sessionTxCount) : 0;
  const currentHire = plan && currentHireIndex < plan.hires.length ? plan.hires[currentHireIndex] : null;

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-[#e4e1e9] font-sans antialiased relative flex flex-col justify-between selection:bg-[#8352ff]/30 selection:text-white">
      {/* Ambient background glow */}
      <div
        className="fixed top-0 left-1/2 -translate-x-1/2 w-[700px] h-[350px] pointer-events-none -z-10"
        style={{
          background: 'radial-gradient(circle, rgba(131, 82, 255, 0.15) 0%, rgba(10, 10, 15, 0) 70%)',
        }}
      ></div>

      {/* Main Single-Screen Container */}
      <div className="max-w-4xl w-full mx-auto px-4 py-8 sm:py-12 flex flex-col gap-6">
        {/* Header Bar with Live Monad Session Speed Counter */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#8352ff] to-[#cebdff] flex items-center justify-center text-black font-bold shadow-[0_0_20px_rgba(131,82,255,0.4)]">
              <span className="material-symbols-outlined text-[24px]">payments</span>
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                AgentPay
                <span className="text-[10px] font-mono uppercase bg-[#8352ff]/20 text-[#cebdff] border border-[#8352ff]/40 px-2 py-0.5 rounded-full font-medium">
                  Monad Testnet
                </span>
              </h1>
              <p className="text-xs text-white/50">Autonomous AI Agent Economic Infrastructure</p>
            </div>
          </div>

          {/* Live Session Counter Widget */}
          <div className="flex flex-col sm:items-end gap-1">
            <div className="flex items-center gap-2 bg-[#8352ff]/10 border border-[#8352ff]/30 px-3 py-1.5 rounded-lg shadow-[0_0_12px_rgba(131,82,255,0.2)]">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="text-xs font-mono text-[#cebdff] font-semibold">
                {sessionTxCount} agent-to-agent payment{sessionTxCount === 1 ? '' : 's'} · ${sessionTotalSettled.toFixed(2)} total settled · {avgSessionMs || 320}ms average confirmation
              </span>
            </div>
            <a
              href={`${EXPLORER_URL}/address/${CONTRACT_ADDRESS}`}
              target="_blank"
              rel="noreferrer"
              className="text-[11px] font-mono text-white/50 hover:text-[#cebdff] flex items-center gap-1 transition-colors"
            >
              <span>Contract: {CONTRACT_ADDRESS.slice(0, 6)}...{CONTRACT_ADDRESS.slice(-4)}</span>
              <span className="material-symbols-outlined text-[12px]">open_in_new</span>
            </a>
          </div>
        </header>

        {/* Error Alert */}
        {errorMsg && (
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm flex items-center justify-between animate-in fade-in">
            <span>{errorMsg}</span>
            <button onClick={() => setErrorMsg(null)} className="text-red-400 hover:text-red-200 cursor-pointer">
              ✕
            </button>
          </div>
        )}

        {/* ── TOP SECTION: CREATE AGENT & STAT CARDS ───────────────────────── */}
        <section className="p-6 rounded-2xl bg-white/[0.03] backdrop-blur-xl border border-white/10 shadow-[0_4px_30px_rgba(0,0,0,0.5)] flex flex-col gap-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white tracking-tight">
                  Autonomous Agent Wallet
                </h2>
                <span className="text-[11px] font-mono bg-[#8352ff]/20 text-[#cebdff] border border-[#8352ff]/30 px-2 py-0.5 rounded-full">
                  Chain 10143 (Monad Testnet)
                </span>
              </div>
              <p className="text-xs text-white/50 mt-1 font-mono">
                Contract: {CONTRACT_ADDRESS.slice(0, 8)}...{CONTRACT_ADDRESS.slice(-6)}
              </p>
            </div>

            <div className="flex items-center gap-2">
              {agent && (
                <button
                  type="button"
                  onClick={() => setIsPassportOpen(true)}
                  className="px-4 py-2.5 rounded-xl bg-[#8352ff]/15 hover:bg-[#8352ff]/25 text-[#cebdff] border border-[#8352ff]/40 text-xs font-mono font-bold flex items-center gap-1.5 transition-all shadow-[0_0_15px_rgba(131,82,255,0.2)] cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px]">badge</span>
                  <span>Agent Passport (ERC-8004)</span>
                </button>
              )}

              <button
                onClick={handleCreateAgent}
                disabled={isCreatingAgent || isPaying || isPlanning}
                className="px-5 py-2.5 bg-[#8352ff] hover:bg-[#6b34e6] text-white rounded-xl font-medium text-xs transition-all shadow-[0_0_20px_rgba(131,82,255,0.35)] flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isCreatingAgent ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                    <span>Creating on Monad...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[18px]">smart_toy</span>
                    <span>{agent ? 'Re-Create Travel Agent' : 'Create Travel Agent'}</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {createdTxHash && (
            <div className="text-xs font-mono text-[#cebdff] bg-[#8352ff]/10 border border-[#8352ff]/30 p-2.5 rounded-lg flex items-center justify-between">
              <span>Agent Created On-Chain ✓</span>
              <a
                href={`${EXPLORER_URL}/tx/${createdTxHash}`}
                target="_blank"
                rel="noreferrer"
                className="underline flex items-center gap-1 hover:text-white"
              >
                View Tx: {createdTxHash.slice(0, 8)}...{createdTxHash.slice(-4)}
                <span className="material-symbols-outlined text-[12px]">open_in_new</span>
              </a>
            </div>
          )}

          {/* Three Stat Cards */}
          {agent && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              {/* Card 1: Balance */}
              <div className="p-5 rounded-xl bg-white/[0.02] border border-white/10 flex flex-col gap-1 transition-all">
                <span className="text-xs text-white/50 uppercase font-mono tracking-wider">Balance</span>
                <span className="text-2xl font-bold font-mono text-white">
                  ${agent.balance.toFixed(2)}
                </span>
                <span className="text-[11px] text-[#cebdff]">Stored on Monad Testnet</span>
              </div>

              {/* Card 2: Spent */}
              <div className="p-5 rounded-xl bg-white/[0.02] border border-white/10 flex flex-col gap-1 transition-all">
                <span className="text-xs text-white/50 uppercase font-mono tracking-wider">Spent</span>
                <span className="text-2xl font-bold font-mono text-[#cebdff]">
                  ${agent.spent.toFixed(2)}
                </span>
                <span className="text-[11px] text-white/40">Autonomous Transfers</span>
              </div>

              {/* Card 3: Reputation */}
              <div className="p-5 rounded-xl bg-white/[0.02] border border-white/10 flex flex-col gap-1 transition-all">
                <span className="text-xs text-white/50 uppercase font-mono tracking-wider">Reputation</span>
                <span className="text-2xl font-bold font-mono text-emerald-400 flex items-center gap-2">
                  {agent.reputation}
                  <span className="text-xs font-normal text-white/40">/ 100</span>
                </span>
                <span className="text-[11px] text-emerald-400/80">Trust Score</span>
              </div>
            </div>
          )}
        </section>

        {/* ── COMMAND INPUT & RISKY SIMULATE SECTION ───────────────────────── */}
        <section className="p-6 rounded-2xl bg-white/[0.03] backdrop-blur-xl border border-white/10 shadow-[0_4px_30px_rgba(0,0,0,0.5)] flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1 flex items-center">
              <input
                type="text"
                value={taskInput}
                onChange={(e) => setTaskInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleRunAgent()}
                placeholder="e.g. Plan a 3-day Dubai trip under $500, or find me a hotel in Goa under $100/night..."
                className="w-full bg-black/40 border border-white/15 rounded-xl pl-4 pr-12 py-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#8352ff] focus:ring-1 focus:ring-[#8352ff]/30 transition-all font-sans"
              />

              {/* Voice Command Mic Button (Web Speech API) */}
              <button
                type="button"
                onClick={startVoiceInput}
                title={isListening ? 'Listening... Speak your task' : 'Voice Command: Speak your task'}
                className={`absolute right-2.5 p-2 rounded-lg transition-all flex items-center justify-center cursor-pointer ${
                  isListening
                    ? 'bg-red-500 text-white animate-pulse shadow-[0_0_15px_rgba(239,68,68,0.6)]'
                    : 'bg-white/5 hover:bg-white/10 text-white/60 hover:text-[#cebdff]'
                }`}
              >
                <span className="material-symbols-outlined text-[18px]">
                  {isListening ? 'mic' : 'mic_none'}
                </span>
              </button>
            </div>

            {/* Run Agent Primary Button */}
            <button
              onClick={handleRunAgent}
              disabled={isPlanning || isPaying || !agent || !taskInput.trim()}
              className="px-6 py-3 bg-[#8352ff] hover:bg-[#6b34e6] text-white rounded-xl font-medium text-sm transition-all shadow-[0_0_20px_rgba(131,82,255,0.35)] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
            >
              {isPlanning ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                  <span>Planning with LLM...</span>
                </>
              ) : (
                <>
                  <span>Run Agent</span>
                  <span className="material-symbols-outlined text-[18px]">send</span>
                </>
              )}
            </button>

            {/* Secondary Red/Amber Button: Simulate Risky Request */}
            <button
              type="button"
              onClick={handleSimulateRiskyRequest}
              disabled={isPlanning || isPaying || !agent}
              className="px-4 py-3 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:border-amber-500/50 rounded-xl font-medium text-xs transition-all shadow-[0_0_15px_rgba(245,158,11,0.15)] flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
            >
              <span className="material-symbols-outlined text-[16px] text-amber-400">warning</span>
              <span>Simulate risky request</span>
            </button>
          </div>

          {/* Quick Example Task Pills */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-[11px] font-mono text-white/40 uppercase">Try Real Tasks:</span>
            <button
              type="button"
              onClick={() => setTaskInput('find me a hotel in Goa under $100/night')}
              className="text-xs font-mono px-2.5 py-1 rounded bg-white/5 hover:bg-white/10 text-white/80 border border-white/10 transition-colors cursor-pointer"
            >
              🏖️ Hotel in Goa ($100/night)
            </button>
            <button
              type="button"
              onClick={() => setTaskInput('find me a flight to Bangalore next week under $100')}
              className="text-xs font-mono px-2.5 py-1 rounded bg-white/5 hover:bg-white/10 text-white/80 border border-white/10 transition-colors cursor-pointer"
            >
              ✈️ Flight to Bangalore
            </button>
            <button
              type="button"
              onClick={() => setTaskInput('plan a 3-day Dubai trip under $500')}
              className="text-xs font-mono px-2.5 py-1 rounded bg-white/5 hover:bg-white/10 text-white/80 border border-white/10 transition-colors cursor-pointer"
            >
              ✈️ 3-Day Dubai Trip (Speed Showcase)
            </button>
          </div>

          {!agent && (
            <p className="text-xs text-amber-400/80 flex items-center gap-1.5 font-mono">
              <span className="material-symbols-outlined text-[16px]">info</span>
              Please click &ldquo;Create Travel Agent&rdquo; above first to initialize your on-chain agent.
            </p>
          )}
        </section>

        {/* ── AGENTGUARD BLOCKED RISKY REQUEST CARD ─────────────────────────── */}
        {stepPhase === 'risky_blocked' && riskyRequest && (
          <section className="p-6 rounded-2xl bg-gradient-to-r from-red-950/40 via-black/80 to-black/80 border-2 border-red-500/60 shadow-[0_0_40px_rgba(239,68,68,0.25)] flex flex-col gap-4 animate-in fade-in duration-300">
            <div className="flex items-center justify-between border-b border-red-500/20 pb-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-red-400 text-[24px]">gss_loss_prevention</span>
                <h3 className="text-base font-bold font-mono text-white tracking-wide uppercase">
                  AgentGuard Policy Engine: Pre-Flight Check Failed
                </h3>
              </div>
              <span className="text-xs font-mono bg-red-500/20 text-red-300 border border-red-500/40 px-2.5 py-1 rounded-full font-bold uppercase">
                Payment Blocked ✕
              </span>
            </div>

            <div className="flex flex-col gap-1 text-sm text-white/90">
              <p>
                <strong>Simulated Request:</strong> Attempted to pay <strong>{riskyRequest.amountUsd}</strong> to unverified recipient <code className="text-red-300 font-mono">{riskyRequest.recipient.slice(0, 8)}...{riskyRequest.recipient.slice(-6)}</code> for <em>&ldquo;{riskyRequest.reason}&rdquo;</em>.
              </p>
              <p className="text-xs text-white/60">
                AgentGuard intercepted this request before submission. Zero on-chain gas spent, balance protected.
              </p>
            </div>

            {/* AgentGuard Checklist */}
            <div className="p-4 rounded-xl bg-black/60 border border-red-500/30 flex flex-col gap-2.5">
              <span className="text-xs font-mono text-white/50 uppercase tracking-wider font-semibold">
                Pre-Flight Policy Evaluation:
              </span>
              <div className="grid grid-cols-1 gap-2">
                {riskyRequest.checks.map((chk, i) => (
                  <div
                    key={i}
                    className={`flex items-start justify-between p-2.5 rounded-lg text-xs font-mono ${
                      chk.passed
                        ? 'bg-emerald-500/5 text-emerald-300 border border-emerald-500/20'
                        : 'bg-red-500/10 text-red-300 border border-red-500/30'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm">
                        {chk.passed ? '✓' : '✕'}
                      </span>
                      <span>{chk.label}</span>
                    </div>
                    <span className={`text-[11px] ${chk.passed ? 'text-emerald-400' : 'text-red-400 font-bold'}`}>
                      {chk.detail}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Action buttons (Disabled Blocked state) */}
            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-white/40 font-mono">
                Enforced by AgentGuard · Balance &amp; Spent Unchanged
              </span>
              <div className="flex items-center gap-3">
                <button
                  disabled
                  className="px-5 py-2.5 bg-red-950/60 border border-red-500/40 text-red-400 rounded-xl text-xs font-bold font-mono tracking-wide cursor-not-allowed opacity-80"
                >
                  BLOCKED — request exceeds policy
                </button>
                <button
                  onClick={() => setStepPhase('idle')}
                  className="px-4 py-2.5 bg-white/10 hover:bg-white/15 text-white rounded-xl text-xs font-mono transition-colors cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </section>
        )}

        {/* ── LLM PLAN OVERVIEW CARD (Immediately shown, No payment yet) ──────── */}
        {plan && (
          <section className="p-6 rounded-2xl bg-white/[0.03] backdrop-blur-xl border border-white/10 shadow-[0_4px_30px_rgba(0,0,0,0.5)] flex flex-col gap-4 animate-in fade-in duration-300">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#8352ff] text-[20px]">psychology_alt</span>
                <h3 className="text-sm font-semibold text-white font-mono uppercase">
                  LLM Orchestrator Plan
                </h3>
                <span className="text-[10px] font-mono bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold">
                  ⚡ x402 Protocol
                </span>
              </div>
              <span className="text-xs font-mono text-[#cebdff]">
                {plan.hires.length} Specialist{plan.hires.length === 1 ? '' : 's'} Selected
              </span>
            </div>

            <p className="text-sm text-white/90 leading-relaxed font-sans">
              <strong>Plan Summary:</strong> {plan.summary}
            </p>

            {/* Planned Agents List */}
            {plan.hires.length > 0 && (
              <div className="flex flex-col gap-2.5 pt-2">
                <span className="text-xs font-mono text-white/50 uppercase tracking-wider">
                  Ordered Specialist Execution Plan:
                </span>
                <div className="grid grid-cols-1 gap-2">
                  {plan.hires.map((h, idx) => (
                    <div
                      key={idx}
                      className={`p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2 transition-all ${
                        idx === currentHireIndex && (stepPhase === 'plan_ready' || stepPhase === 'awaiting_approval')
                          ? 'bg-[#8352ff]/10 border-[#8352ff]/50 shadow-[0_0_15px_rgba(131,82,255,0.2)]'
                          : approvedAgents.includes(h.agent)
                          ? 'bg-emerald-500/5 border-emerald-500/30'
                          : deniedAgents.includes(h.agent)
                          ? 'bg-white/[0.01] border-white/5 opacity-50'
                          : 'bg-white/[0.02] border-white/10'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <span className="w-6 h-6 rounded-full bg-white/10 text-white font-mono text-xs flex items-center justify-center font-bold shrink-0 mt-0.5">
                          {idx + 1}
                        </span>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-white">{h.agent.name}</span>
                            <span className="text-xs font-mono text-[#cebdff] bg-[#8352ff]/20 px-2 py-0.5 rounded">
                              {h.agent.priceUsd}
                            </span>
                            {approvedAgents.includes(h.agent) && (
                              <span className="text-[10px] font-mono text-emerald-400 uppercase font-bold">
                                Paid ✓
                              </span>
                            )}
                            {deniedAgents.includes(h.agent) && (
                              <span className="text-[10px] font-mono text-white/40 uppercase font-bold">
                                Denied
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-white/70 mt-1">{h.reason}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── MANUAL CONTROL GATES: NEXT STEP / APPROVAL / CONCURRENT SETTLE ── */}
            <div className="pt-4 border-t border-white/10 flex flex-col gap-4">
              {/* Option A: Concurrent Settle All (Monad Parallel Speed Showcase) */}
              {stepPhase === 'plan_ready' && plan.hires.length > 1 && (
                <div className="p-4 rounded-xl bg-gradient-to-r from-[#8352ff]/20 to-transparent border border-[#8352ff]/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <span className="text-xs font-mono text-white font-bold block flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[#cebdff] text-[16px]">bolt</span>
                      Monad Concurrent Speed Mode
                    </span>
                    <p className="text-[11px] text-white/60">
                      Submit all {plan.hires.length} independent payments in parallel with Promise.all and measure real wall-clock latency.
                    </p>
                  </div>

                  <button
                    onClick={handleApproveAllConcurrently}
                    disabled={isPaying}
                    className="px-5 py-2.5 bg-gradient-to-r from-[#8352ff] to-[#6b34e6] text-white font-semibold rounded-xl text-xs font-mono tracking-wide shadow-[0_0_20px_rgba(131,82,255,0.4)] flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50 shrink-0"
                  >
                    {isPaying ? (
                      <>
                        <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                        <span>Broadcasting {plan.hires.length} Txns...</span>
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-[16px]">rocket_launch</span>
                        <span>Settle All {plan.hires.length} Concurrently</span>
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* Option B: Sequential Step-by-Step Gate 1 (Discovery & Recommendations) */}
              {stepPhase === 'plan_ready' && currentHire && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-white/50 font-mono">
                    Step {currentHireIndex + 1} of {plan.hires.length}: Ready to discover {currentHire.agent.name}
                  </span>
                  <button
                    onClick={handleNextStep}
                    className="px-5 py-2.5 bg-white/10 hover:bg-white/15 text-white border border-white/20 rounded-xl text-xs font-semibold font-mono tracking-wide transition-all flex items-center gap-2 cursor-pointer shadow-[0_0_15px_rgba(255,255,255,0.1)]"
                  >
                    <span>Next Step (Discover &amp; Recommend {currentHire.agent.name})</span>
                    <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                  </button>
                </div>
              )}

              {/* Gate 1.5: Interactive Recommendation Selection Card (Top 5 choices) */}
              {stepPhase === 'recommending' && currentHire && (
                <RecommendationSelector
                  specialistName={currentHire.agent.name}
                  destination={getDestinationName(taskInput)}
                  hotelOptions={hotelOptions}
                  flightOptions={flightOptions}
                  activityOptions={activityOptions}
                  selectedId={selectedOptionId}
                  onSelect={handleSelectRecommendation}
                  onConfirm={handleConfirmRecommendation}
                />
              )}

              {/* Gate 2: Distinct Payment Approval Card */}
              {stepPhase === 'awaiting_approval' && currentHire && (
                <div className="p-5 rounded-2xl bg-gradient-to-r from-[#8352ff]/15 via-black/60 to-black/60 border-2 border-[#8352ff] shadow-[0_0_30px_rgba(131,82,255,0.3)] flex flex-col gap-4 animate-in fade-in duration-300">
                  <div className="flex items-center justify-between border-b border-white/10 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-[#8352ff] text-[20px]">credit_card</span>
                      <span className="text-xs font-bold font-mono text-white uppercase tracking-wider">
                        Payment Approval Required
                      </span>
                    </div>
                    <span className="text-xs font-mono text-[#cebdff] font-bold">
                      {currentHire.agent.priceUsd} (Monad Native Value Transfer)
                    </span>
                  </div>

                  <div className="flex flex-col gap-2">
                    <h4 className="text-base font-bold text-white">
                      TravelAgent wants to pay {currentHire.agent.name} {currentHire.agent.priceUsd}
                    </h4>

                    {/* Chosen Item Summary Pill */}
                    {currentHire.agent.name === 'HotelFinder' && selectedHotelOption && (
                      <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs font-mono text-emerald-300 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                        <span>🏨 Selected Hotel: <strong>{selectedHotelOption.name}</strong> ({selectedHotelOption.address})</span>
                        <span className="font-bold text-emerald-400">{selectedHotelOption.pricePerNight}/night</span>
                      </div>
                    )}
                    {currentHire.agent.name === 'FlightFinder' && selectedFlightOption && (
                      <div className="p-3 rounded-xl bg-[#8352ff]/15 border border-[#8352ff]/40 text-xs font-mono text-[#cebdff] flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                        <span>✈️ Selected Flight: <strong>{selectedFlightOption.airline} {selectedFlightOption.flightNumber}</strong> ({selectedFlightOption.departure} → {selectedFlightOption.arrival})</span>
                        <span className="font-bold text-white">{selectedFlightOption.price}</span>
                      </div>
                    )}
                    {currentHire.agent.name === 'ActivityFinder' && selectedActivityOption && (
                      <div className="p-3 rounded-xl bg-[#8352ff]/15 border border-[#8352ff]/40 text-xs font-mono text-[#cebdff] flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                        <span>🏄 Selected Tour: <strong>{selectedActivityOption.title}</strong></span>
                        <span className="font-bold text-white">{selectedActivityOption.price}</span>
                      </div>
                    )}

                    <p className="text-xs text-white/80">
                      <strong>Reason:</strong> {currentHire.reason}
                    </p>
                    <p className="text-[11px] text-white/40 font-mono">
                      Recipient Address: {currentHire.agent.recipient}
                    </p>
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-2">
                    <button
                      onClick={handleDenyPayment}
                      disabled={isPaying}
                      className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white/70 hover:text-white rounded-xl text-xs font-medium font-mono border border-white/15 transition-colors cursor-pointer"
                    >
                      Deny (Skip)
                    </button>

                    <button
                      onClick={handleApprovePayment}
                      disabled={isPaying}
                      className="px-6 py-2.5 bg-[#8352ff] hover:bg-[#6b34e6] text-white rounded-xl text-xs font-semibold font-mono tracking-wide shadow-[0_0_20px_rgba(131,82,255,0.5)] flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                    >
                      {isPaying ? (
                        <>
                          <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                          <span>Broadcasting to Monad...</span>
                        </>
                      ) : (
                        <>
                          <span className="material-symbols-outlined text-[16px]">check</span>
                          <span>Approve &amp; Send Transaction</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Gate 3: Ready to Synthesize Final Result */}
              {stepPhase === 'ready_to_synthesize' && (
                <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
                  <div>
                    <span className="text-xs font-mono text-emerald-400 font-semibold block">
                      All planned specialist steps completed!
                    </span>
                    <span className="text-[11px] text-white/50">
                      {approvedAgents.length} approved ({approvedAgents.map((a) => a.name).join(', ') || 'None'}) •{' '}
                      {deniedAgents.length} denied
                    </span>
                  </div>

                  <button
                    onClick={handleGenerateResult}
                    disabled={isSynthesizing}
                    className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-black font-semibold rounded-xl text-xs font-mono tracking-wide transition-all shadow-[0_0_15px_rgba(16,185,129,0.4)] flex items-center gap-2 cursor-pointer"
                  >
                    {isSynthesizing ? (
                      <>
                        <span className="w-3.5 h-3.5 border-2 border-black/30 border-t-black rounded-full animate-spin"></span>
                        <span>Synthesizing Deliverable...</span>
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-[16px]">auto_awesome</span>
                        <span>Generate Result</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </section>
        )}

        {/* ── REAL SPEED SHOWCASE CALLOUT CARD ──────────────────────────────── */}
        {lastSpeedMetric && (
          <section className="p-6 rounded-2xl bg-gradient-to-r from-emerald-500/15 via-[#8352ff]/15 to-transparent border-2 border-emerald-500/50 shadow-[0_0_35px_rgba(16,185,129,0.2)] flex flex-col gap-2 animate-in fade-in duration-300">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-emerald-400 text-[22px]">speed</span>
                <h3 className="text-base font-bold font-mono text-white">
                  ⚡ {lastSpeedMetric.count} autonomous payments settled on Monad in {lastSpeedMetric.durationMs}ms
                </h3>
              </div>
              <span className="text-xs font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2.5 py-1 rounded-full font-bold">
                {lastSpeedMetric.impliedTps} tx/sec · ${(lastSpeedMetric.amountDollars / (lastSpeedMetric.durationMs / 1000)).toFixed(2)}/sec
              </span>
            </div>

            <p className="text-xs text-[#cebdff] font-medium leading-relaxed">
              This kind of agent-to-agent microtransaction volume isn&apos;t viable on most L1s — Monad&apos;s throughput is what makes it work.
            </p>
            <span className="text-[11px] font-mono text-white/40">
              *Real wall-clock timestamp measured from parallel RPC dispatch to receipt block confirmation on Chain 10143.
            </span>
          </section>
        )}

        {/* ── ANIMATED NODE GRAPH (TOPOLOGY VISUALIZATION) ───────────────── */}
        {(plan || stepPhase === 'risky_blocked') && (
          <AgentNodeGraph
            agentName="TravelAgent"
            plannedHires={plan ? plan.hires : []}
            approvedAgents={approvedAgents}
            deniedAgents={deniedAgents}
            currentHireIndex={currentHireIndex}
            riskyBlocked={stepPhase === 'risky_blocked'}
          />
        )}

        {/* ── LIVE ACTIVITY FEED ───────────────────────────────────────────── */}
        {activities.length > 0 && (
          <section className="p-6 rounded-2xl bg-white/[0.03] backdrop-blur-xl border border-white/10 shadow-[0_4px_30px_rgba(0,0,0,0.5)] flex flex-col gap-4 animate-in fade-in duration-300">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#8352ff] animate-pulse"></span>
                <h3 className="text-sm font-semibold text-white tracking-wide uppercase font-mono">
                  Live Activity Feed
                </h3>
              </div>
              <span className="text-xs font-mono text-white/40">{activities.length} Events</span>
            </div>

            <div className="flex flex-col divide-y divide-white/5">
              {activities.map((step) => (
                <div
                  key={step.id}
                  className={`py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-sm animate-in fade-in duration-300 ${
                    step.text.includes('AgentGuard blocked') ? 'bg-red-500/10 px-3 rounded-lg border border-red-500/30' : ''
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {step.type === 'payment_paid' ? (
                      <span className="material-symbols-outlined text-emerald-400 text-[18px] shrink-0">
                        check_circle
                      </span>
                    ) : step.type === 'payment_denied' || step.text.includes('AgentGuard blocked') ? (
                      <span className="material-symbols-outlined text-red-400 text-[18px] shrink-0">
                        gss_loss_prevention
                      </span>
                    ) : step.type === 'discovery' ? (
                      <span className="material-symbols-outlined text-[#8352ff] text-[18px] shrink-0">
                        travel_explore
                      </span>
                    ) : step.type === 'reputation' ? (
                      <span className="material-symbols-outlined text-emerald-400 text-[18px] shrink-0">
                        trending_up
                      </span>
                    ) : (
                      <span className="material-symbols-outlined text-white/50 text-[18px] shrink-0">
                        info
                      </span>
                    )}

                    <span
                      className={`font-medium ${
                        step.text.includes('AgentGuard blocked')
                          ? 'text-red-300 font-semibold'
                          : step.type === 'payment_paid'
                          ? 'text-white font-semibold'
                          : step.type === 'payment_denied'
                          ? 'text-amber-300'
                          : step.type === 'reputation'
                          ? 'text-emerald-400 font-mono text-xs'
                          : 'text-white/90'
                      }`}
                    >
                      {step.text}
                    </span>
                  </div>

                  {step.txHash && step.explorerUrl ? (
                    <a
                      href={step.explorerUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-mono text-[#cebdff] hover:text-white bg-[#8352ff]/10 hover:bg-[#8352ff]/20 px-3 py-1.5 rounded-lg border border-[#8352ff]/30 flex items-center gap-1 transition-all self-start sm:self-auto shrink-0 shadow-[0_0_10px_rgba(131,82,255,0.2)]"
                    >
                      <span>Tx: {step.txHash.slice(0, 6)}...{step.txHash.slice(-4)}</span>
                      <span className="material-symbols-outlined text-[13px]">open_in_new</span>
                    </a>
                  ) : (
                    <span className="text-xs font-mono text-white/30 self-start sm:self-auto">
                      {step.timestamp}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── SYNTHESIZED FINAL RESULT CARD ────────────────────────────────── */}
        {finalResultText && (
          <section className="p-6 rounded-2xl bg-white/[0.04] border border-emerald-500/30 shadow-[0_0_30px_rgba(16,185,129,0.15)] flex flex-col gap-3 animate-in fade-in duration-400">
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-emerald-400 text-[20px]">task_alt</span>
                <h3 className="text-sm font-semibold text-white font-mono uppercase">
                  Synthesized Deliverable
                </h3>
              </div>
              <span className="text-xs font-mono text-emerald-400">
                Built from {approvedAgents.length} Paid Deliverable{approvedAgents.length === 1 ? '' : 's'}
              </span>
            </div>

            <div className="text-sm text-white/90 whitespace-pre-wrap leading-relaxed font-sans">
              {finalResultText}
            </div>
          </section>
        )}

        {/* ── DEMO BOARDING PASS (shown when FlightFinder payment confirmed) ─── */}
        {flightDetails && (
          <section className="flex flex-col gap-3 animate-in fade-in duration-500">
            <div className="flex items-center gap-2 px-1">
              <span className="material-symbols-outlined text-[#8352ff] text-[18px]">airplane_ticket</span>
              <h3 className="text-sm font-semibold text-white font-mono uppercase tracking-wider">
                Demo Boarding Pass · Issued Autonomously by TravelAgent
              </h3>
              <span className="ml-auto text-[10px] font-mono bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                CONFIRMED
              </span>
            </div>
            <BoardingPass flight={flightDetails} />
          </section>
        )}

        {/* ── HOTEL BOOKING CARD (shown when HotelFinder payment confirmed) ─── */}
        {hotelDetails && (
          <section className="flex flex-col gap-3 animate-in fade-in duration-500">
            <div className="flex items-center gap-2 px-1">
              <span className="material-symbols-outlined text-emerald-400 text-[18px]">hotel</span>
              <h3 className="text-sm font-semibold text-white font-mono uppercase tracking-wider">
                Hotel Reservation · Issued Autonomously by TravelAgent
              </h3>
              <span className="ml-auto text-[10px] font-mono bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                CONFIRMED
              </span>
            </div>
            <HotelCard hotel={hotelDetails} />
          </section>
        )}

        {/* ── CLOSING BANNER ───────────────────────────────────────────────── */}
        {stepPhase === 'completed' && (
          <section className="p-8 rounded-2xl bg-gradient-to-r from-[#8352ff]/20 via-[#8352ff]/10 to-transparent border border-[#8352ff]/40 shadow-[0_0_50px_rgba(131,82,255,0.25)] flex flex-col sm:flex-row items-center justify-between gap-6 animate-in fade-in duration-500">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-[#8352ff] flex items-center justify-center text-white shadow-[0_0_20px_rgba(131,82,255,0.5)] shrink-0">
                <span className="material-symbols-outlined text-[28px]">verified</span>
              </div>
              <div>
                <p className="text-base sm:text-lg font-semibold text-white tracking-tight leading-snug">
                  &ldquo;We didn&apos;t just give AI a wallet. We gave AI agents an economy.&rdquo;
                </p>
                <p className="text-xs text-[#cebdff] mt-1 font-mono">
                  {approvedAgents.length} Real Value Transfer{approvedAgents.length === 1 ? '' : 's'} Settled Autonomously on Monad Testnet
                </p>
              </div>
            </div>

            <button
              onClick={handleReset}
              className="px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/20 text-xs font-medium transition-all cursor-pointer shrink-0"
            >
              Reset Demo
            </button>
          </section>
        )}
      </div>

      {/* Footer */}
      <footer className="w-full text-center py-6 text-xs text-white/30 border-t border-white/5 font-mono">
        AgentPay • Monad Testnet (Chain ID 10143) • Contract: {CONTRACT_ADDRESS}
      </footer>

      {/* Holographic ERC-8004 Agent Passport Modal */}
      <AgentPassportModal
        isOpen={isPassportOpen}
        onClose={() => setIsPassportOpen(false)}
        agent={agent}
        sessionTxCount={sessionTxCount}
        sessionTotalSettled={sessionTotalSettled}
        completedTasks={completedTasks}
      />
    </div>
  );
}
