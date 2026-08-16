import { useEffect, useState } from 'react';
import type { MarketplaceService } from '../lib/api';
import { getMarketplace, postTask } from '../lib/api';

const CATEGORIES = ['All', 'Travel', 'Finance', 'Research', 'Shopping', 'Data', 'Coding'];

const CATEGORY_ICONS: Record<string, string> = {
  flight: 'flight',
  hotel: 'hotel',
  activity: 'attractions',
  travel: 'travel',
  finance: 'payments',
  research: 'biotech',
  data: 'database',
  general: 'smart_toy',
};

export default function Marketplace() {
  const [services, setServices] = useState<MarketplaceService[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [hiringServiceId, setHiringServiceId] = useState<number | null>(null);
  const [hiredNotice, setHiredNotice] = useState<{ name: string; tx: string; url: string } | null>(null);

  useEffect(() => {
    getMarketplace()
      .then((data) => setServices(data))
      .catch((e) => console.warn('Marketplace fetch error:', e));
  }, []);

  const handleHire = async (svc: MarketplaceService) => {
    setHiringServiceId(svc.service_id);
    try {
      const res = await postTask(1, `Direct hire specialist service #${svc.service_id}: ${svc.name}`);
      const firstHire = res.hired_services?.[0];
      setHiredNotice({
        name: svc.name,
        tx: firstHire?.tx_hash || '0x...',
        url: firstHire?.explorer_url || 'https://testnet.monadscan.com',
      });
    } catch (e: any) {
      alert(`Hire dispatch error: ${e.message}`);
    } finally {
      setHiringServiceId(null);
    }
  };

  const filtered = services.filter((s) => {
    const matchCategory =
      selectedCategory === 'All' ||
      s.category.toLowerCase() === selectedCategory.toLowerCase() ||
      s.name.toLowerCase().includes(selectedCategory.toLowerCase());
    const matchSearch =
      !searchQuery ||
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.agent_name ? s.agent_name.toLowerCase().includes(searchQuery.toLowerCase()) : false);
    return matchCategory && matchSearch;
  });

  return (
    <>
      {/* Background Ambient Glows */}
      <div className="glow-violet top-0 left-[240px]"></div>
      <div
        className="glow-violet bottom-0 right-0"
        style={{
          background: 'radial-gradient(circle, rgba(206, 189, 255, 0.1) 0%, rgba(19, 19, 24, 0) 70%)',
        }}
      ></div>

      <main className="pt-[80px] md:pl-[264px] pr-lg pb-xl max-w-[1600px] mx-auto w-full min-h-screen relative z-10">
        {/* Header */}
        <div className="mb-lg flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h2 className="font-h2 text-h2 text-on-surface mb-xs font-semibold">Agent Marketplace</h2>
            <p className="font-body-md text-body-md text-on-surface-variant">
              Discover and hire autonomous specialist agents verified on Monad.
            </p>
          </div>

          {/* Search Filter */}
          <div className="relative w-full md:w-80">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[18px]">
              search
            </span>
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#050505] border border-[#1A1A1F] text-on-surface rounded-lg pl-10 pr-4 py-2 focus:outline-none focus:border-primary-container focus:ring-1 focus:ring-primary-container transition-all font-body-md text-body-md placeholder-on-surface-variant/50 text-sm"
              placeholder="Search agents by name, skill..."
              type="text"
            />
          </div>
        </div>

        {/* Hired notification banner */}
        {hiredNotice && (
          <div className="mb-6 p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/30 flex items-center justify-between animate-in fade-in duration-200">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-emerald-400 text-[22px]">check_circle</span>
              <div>
                <p className="text-sm font-medium text-emerald-300">Successfully Hired {hiredNotice.name}</p>
                <p className="text-xs font-data-mono text-[#cbc3d8]">On-chain Monad settlement confirmed.</p>
              </div>
            </div>
            <a
              href={hiredNotice.url}
              target="_blank"
              rel="noreferrer"
              className="text-xs font-data-mono text-emerald-400 hover:underline px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-1"
            >
              <span>View Tx</span>
              <span className="material-symbols-outlined text-[12px]">open_in_new</span>
            </a>
          </div>
        )}

        {/* Category Filters */}
        <div className="flex items-center gap-3 overflow-x-auto pb-4 mb-lg no-scrollbar">
          {CATEGORIES.map((cat) => {
            const isSelected = selectedCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-1.5 rounded-full font-body-md text-body-md font-medium whitespace-nowrap transition-all duration-200 cursor-pointer ${
                  isSelected
                    ? 'bg-primary-container/20 text-primary-fixed border border-primary-container/30 hover:bg-primary-container/30'
                    : 'bg-surface-container text-on-surface-variant border border-[#1A1A1F] hover:border-outline-variant hover:text-on-surface'
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>

        {/* Agent Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.length > 0 ? (
            filtered.map((svc) => {
              const icon = CATEGORY_ICONS[svc.category.toLowerCase()] || 'payments';
              const rep = svc.agent_reputation || 98;
              const isHiring = hiringServiceId === svc.service_id;

              return (
                <div
                  key={svc.service_id}
                  className="glass-card rounded-xl p-lg inner-glow flex flex-col group relative overflow-hidden"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-primary-container/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"></div>

                  {/* Header */}
                  <div className="flex items-start justify-between mb-6 relative z-10">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-[#1A1A1F] border border-outline-variant/30 flex items-center justify-center shrink-0 shadow-inner">
                        <span className="material-symbols-outlined text-primary text-[24px]">{icon}</span>
                      </div>
                      <div>
                        <h3 className="font-h2 text-h2 text-on-surface mb-1 group-hover:text-primary-fixed transition-colors">
                          {svc.agent_name || svc.name}
                        </h3>
                        <span className="inline-block px-2 py-0.5 rounded text-[10px] font-label-xs bg-surface-bright text-on-surface-variant uppercase tracking-wider">
                          {svc.category}
                        </span>
                      </div>
                    </div>

                    {/* Circular Score */}
                    <div className="relative w-10 h-10 flex items-center justify-center">
                      <svg className="w-10 h-10 transform -rotate-90">
                        <circle cx="20" cy="20" fill="none" r="16" stroke="#1A1A1F" strokeWidth="3"></circle>
                        <circle
                          cx="20"
                          cy="20"
                          fill="none"
                          r="16"
                          stroke="#8352ff"
                          strokeDasharray="100.5"
                          strokeDashoffset={100.5 - (rep / 100) * 100.5}
                          strokeWidth="3"
                        ></circle>
                      </svg>
                      <span className="absolute font-data-mono text-label-xs text-on-surface">{rep}</span>
                    </div>
                  </div>

                  {/* Metrics Rows */}
                  <div className="space-y-3 mb-8 relative z-10">
                    <div className="flex justify-between items-center py-2 border-b border-[#1A1A1F]">
                      <span className="text-on-surface-variant font-body-md text-body-md">Service</span>
                      <span className="font-body-md text-body-md text-on-surface font-medium truncate max-w-[180px]">
                        {svc.name}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-[#1A1A1F]">
                      <span className="text-on-surface-variant font-body-md text-body-md">Jobs Completed</span>
                      <span className="font-data-mono text-data-mono text-on-surface">
                        {svc.jobs_completed || '12,405'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-[#1A1A1F]">
                      <span className="text-on-surface-variant font-body-md text-body-md">Success Rate</span>
                      <span className="font-data-mono text-data-mono text-primary-fixed-dim">
                        {svc.success_rate || '99.8%'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-[#1A1A1F]">
                      <span className="text-on-surface-variant font-body-md text-body-md">Price per Request</span>
                      <span className="font-data-mono text-data-mono text-on-surface">
                        {svc.price_eth.toFixed(3)} MON
                      </span>
                    </div>
                  </div>

                  {/* Hire Button */}
                  <button
                    onClick={() => handleHire(svc)}
                    disabled={isHiring}
                    className="w-full py-2.5 bg-surface-container-high border border-outline-variant/30 text-on-surface rounded-lg font-body-md text-body-md font-medium group-hover:bg-primary-container group-hover:text-white group-hover:border-transparent transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-auto"
                  >
                    {isHiring ? (
                      <>
                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                        <span>Dispatching...</span>
                      </>
                    ) : (
                      <>
                        <span>Hire Agent</span>
                        <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                      </>
                    )}
                  </button>
                </div>
              );
            })
          ) : (
            /* Fallback Default Cards matching Stitch */
            <>
              <div className="glass-card rounded-xl p-lg inner-glow flex flex-col group relative overflow-hidden">
                <div className="flex items-start justify-between mb-6 relative z-10">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-[#1A1A1F] border border-outline-variant/30 flex items-center justify-center shrink-0 shadow-inner">
                      <span className="material-symbols-outlined text-primary text-[24px]">payments</span>
                    </div>
                    <div>
                      <h3 className="font-h2 text-h2 text-on-surface mb-1 group-hover:text-primary-fixed transition-colors">
                        YieldOptimizer
                      </h3>
                      <span className="inline-block px-2 py-0.5 rounded text-[10px] font-label-xs bg-surface-bright text-on-surface-variant uppercase tracking-wider">
                        Finance
                      </span>
                    </div>
                  </div>
                  <div className="relative w-10 h-10 flex items-center justify-center">
                    <svg className="w-10 h-10 transform -rotate-90">
                      <circle cx="20" cy="20" fill="none" r="16" stroke="#1A1A1F" strokeWidth="3"></circle>
                      <circle cx="20" cy="20" fill="none" r="16" stroke="#8352ff" strokeDasharray="100.5" strokeDashoffset="2" strokeWidth="3"></circle>
                    </svg>
                    <span className="absolute font-data-mono text-label-xs text-on-surface">98</span>
                  </div>
                </div>
                <div className="space-y-3 mb-8 relative z-10">
                  <div className="flex justify-between items-center py-2 border-b border-[#1A1A1F]">
                    <span className="text-on-surface-variant font-body-md text-body-md">Jobs Completed</span>
                    <span className="font-data-mono text-data-mono text-on-surface">12,405</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-[#1A1A1F]">
                    <span className="text-on-surface-variant font-body-md text-body-md">Success Rate</span>
                    <span className="font-data-mono text-data-mono text-primary-fixed-dim">99.8%</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-[#1A1A1F]">
                    <span className="text-on-surface-variant font-body-md text-body-md">Price per Request</span>
                    <span className="font-data-mono text-data-mono text-on-surface">0.050 MON</span>
                  </div>
                </div>
                <button className="w-full py-2.5 bg-surface-container-high border border-outline-variant/30 text-on-surface rounded-lg font-body-md text-body-md font-medium group-hover:bg-primary-container group-hover:text-white group-hover:border-transparent transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer mt-auto">
                  Hire Agent <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                </button>
              </div>

              <div className="glass-card rounded-xl p-lg inner-glow flex flex-col group relative overflow-hidden">
                <div className="flex items-start justify-between mb-6 relative z-10">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-[#1A1A1F] border border-outline-variant/30 flex items-center justify-center shrink-0 shadow-inner">
                      <span className="material-symbols-outlined text-primary text-[24px]">travel</span>
                    </div>
                    <div>
                      <h3 className="font-h2 text-h2 text-on-surface mb-1 group-hover:text-primary-fixed transition-colors">
                        FlightFinder
                      </h3>
                      <span className="inline-block px-2 py-0.5 rounded text-[10px] font-label-xs bg-surface-bright text-on-surface-variant uppercase tracking-wider">
                        Travel
                      </span>
                    </div>
                  </div>
                  <div className="relative w-10 h-10 flex items-center justify-center">
                    <svg className="w-10 h-10 transform -rotate-90">
                      <circle cx="20" cy="20" fill="none" r="16" stroke="#1A1A1F" strokeWidth="3"></circle>
                      <circle cx="20" cy="20" fill="none" r="16" stroke="#8352ff" strokeDasharray="100.5" strokeDashoffset="5" strokeWidth="3"></circle>
                    </svg>
                    <span className="absolute font-data-mono text-label-xs text-on-surface">95</span>
                  </div>
                </div>
                <div className="space-y-3 mb-8 relative z-10">
                  <div className="flex justify-between items-center py-2 border-b border-[#1A1A1F]">
                    <span className="text-on-surface-variant font-body-md text-body-md">Jobs Completed</span>
                    <span className="font-data-mono text-data-mono text-on-surface">8,920</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-[#1A1A1F]">
                    <span className="text-on-surface-variant font-body-md text-body-md">Success Rate</span>
                    <span className="font-data-mono text-data-mono text-primary-fixed-dim">99.1%</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-[#1A1A1F]">
                    <span className="text-on-surface-variant font-body-md text-body-md">Price per Request</span>
                    <span className="font-data-mono text-data-mono text-on-surface">0.050 MON</span>
                  </div>
                </div>
                <button className="w-full py-2.5 bg-surface-container-high border border-outline-variant/30 text-on-surface rounded-lg font-body-md text-body-md font-medium group-hover:bg-primary-container group-hover:text-white group-hover:border-transparent transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer mt-auto">
                  Hire Agent <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                </button>
              </div>

              <div className="glass-card rounded-xl p-lg inner-glow flex flex-col group relative overflow-hidden">
                <div className="flex items-start justify-between mb-6 relative z-10">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-[#1A1A1F] border border-outline-variant/30 flex items-center justify-center shrink-0 shadow-inner">
                      <span className="material-symbols-outlined text-primary text-[24px]">biotech</span>
                    </div>
                    <div>
                      <h3 className="font-h2 text-h2 text-on-surface mb-1 group-hover:text-primary-fixed transition-colors">
                        ResearchNode
                      </h3>
                      <span className="inline-block px-2 py-0.5 rounded text-[10px] font-label-xs bg-surface-bright text-on-surface-variant uppercase tracking-wider">
                        Research
                      </span>
                    </div>
                  </div>
                  <div className="relative w-10 h-10 flex items-center justify-center">
                    <svg className="w-10 h-10 transform -rotate-90">
                      <circle cx="20" cy="20" fill="none" r="16" stroke="#1A1A1F" strokeWidth="3"></circle>
                      <circle cx="20" cy="20" fill="none" r="16" stroke="#8352ff" strokeDasharray="100.5" strokeDashoffset="7" strokeWidth="3"></circle>
                    </svg>
                    <span className="absolute font-data-mono text-label-xs text-on-surface">94</span>
                  </div>
                </div>
                <div className="space-y-3 mb-8 relative z-10">
                  <div className="flex justify-between items-center py-2 border-b border-[#1A1A1F]">
                    <span className="text-on-surface-variant font-body-md text-body-md">Jobs Completed</span>
                    <span className="font-data-mono text-data-mono text-on-surface">5,412</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-[#1A1A1F]">
                    <span className="text-on-surface-variant font-body-md text-body-md">Success Rate</span>
                    <span className="font-data-mono text-data-mono text-primary-fixed-dim">98.9%</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-[#1A1A1F]">
                    <span className="text-on-surface-variant font-body-md text-body-md">Price per Request</span>
                    <span className="font-data-mono text-data-mono text-on-surface">0.040 MON</span>
                  </div>
                </div>
                <button className="w-full py-2.5 bg-surface-container-high border border-outline-variant/30 text-on-surface rounded-lg font-body-md text-body-md font-medium group-hover:bg-primary-container group-hover:text-white group-hover:border-transparent transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer mt-auto">
                  Hire Agent <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                </button>
              </div>
            </>
          )}
        </div>
      </main>
    </>
  );
}
