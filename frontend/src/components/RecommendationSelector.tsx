import type { HotelOption, FlightOption, ActivityOption } from '../orchestrator';

interface RecommendationSelectorProps {
  specialistName: string;
  destination: string;
  hotelOptions?: HotelOption[];
  flightOptions?: FlightOption[];
  activityOptions?: ActivityOption[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onConfirm: () => void;
}

export default function RecommendationSelector({
  specialistName,
  destination,
  hotelOptions,
  flightOptions,
  activityOptions,
  selectedId,
  onConfirm,
  onSelect,
}: RecommendationSelectorProps) {
  const isHotel = specialistName === 'HotelFinder' && hotelOptions && hotelOptions.length > 0;
  const isFlight = specialistName === 'FlightFinder' && flightOptions && flightOptions.length > 0;
  const isActivity = specialistName === 'ActivityFinder' && activityOptions && activityOptions.length > 0;

  return (
    <div className="p-6 rounded-2xl bg-gradient-to-br from-[#120e24] via-[#0b0914] to-[#120e24] border-2 border-[#8352ff]/60 shadow-[0_0_40px_rgba(131,82,255,0.25)] flex flex-col gap-5 animate-in fade-in duration-400">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/10 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#8352ff]/20 border border-[#8352ff]/40 flex items-center justify-center text-[#cebdff]">
            <span className="material-symbols-outlined text-[18px]">
              {isHotel ? 'hotel' : isFlight ? 'flight_takeoff' : 'attractions'}
            </span>
          </div>
          <div>
            <h3 className="text-sm font-bold font-mono text-white uppercase tracking-wide">
              {specialistName}: Top 5 Recommended {isHotel ? 'Hotels' : isFlight ? 'Flights' : 'Attractions'} in {destination}
            </h3>
            <p className="text-xs text-white/50">
              Select your preferred option. TravelAgent will autonomously lock in and pay for the chosen booking.
            </p>
          </div>
        </div>
        <span className="text-[11px] font-mono bg-[#8352ff]/20 text-[#cebdff] px-2.5 py-1 rounded-full border border-[#8352ff]/30 shrink-0 self-start sm:self-auto font-semibold">
          Step 1: User Choice
        </span>
      </div>

      {/* ── HOTEL RECOMMENDATIONS LIST (5 OPTIONS) ── */}
      {isHotel && (
        <div className="grid grid-cols-1 gap-2.5">
          {hotelOptions.map((h, idx) => {
            const isSelected = selectedId === h.id || (!selectedId && idx === 0);
            const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${h.mapsQuery}`;

            return (
              <div
                key={h.id}
                onClick={() => onSelect(h.id)}
                className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                  isSelected
                    ? 'bg-[#8352ff]/15 border-[#8352ff] shadow-[0_0_20px_rgba(131,82,255,0.3)] ring-1 ring-[#8352ff]/50'
                    : 'bg-white/[0.02] border-white/10 hover:bg-white/[0.05] hover:border-white/20'
                }`}
              >
                <div className="flex items-start gap-3 flex-1">
                  {/* Radio / Selection Circle */}
                  <div className="pt-0.5">
                    <div
                      className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all ${
                        isSelected
                          ? 'border-[#8352ff] bg-[#8352ff] text-white'
                          : 'border-white/30 bg-black/40'
                      }`}
                    >
                      {isSelected && <span className="text-xs font-bold">✓</span>}
                    </div>
                  </div>

                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-bold text-white tracking-tight">{h.name}</span>
                      <span className="text-xs text-amber-400">{'★'.repeat(h.stars)}</span>
                      <span className="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                        {h.rating} / 5.0
                      </span>
                      {h.badge && (
                        <span className="text-[10px] font-mono uppercase bg-[#8352ff]/20 text-[#cebdff] px-2 py-0.5 rounded font-semibold">
                          {h.badge}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-xs text-white/60 mt-1 font-sans">
                      <span className="material-symbols-outlined text-[14px] text-emerald-400">location_on</span>
                      <span>{h.address}, {h.city}</span>
                    </div>

                    {/* Amenities pills */}
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {h.amenities.map((am) => (
                        <span
                          key={am}
                          className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/5 text-white/70 border border-white/10"
                        >
                          {am}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Price & Maps Column */}
                <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2 shrink-0 border-t sm:border-t-0 border-white/5 pt-2 sm:pt-0">
                  <div className="text-right">
                    <span className="text-base font-black font-mono text-white">{h.pricePerNight}</span>
                    <span className="text-[10px] font-mono text-white/40 block">/ night</span>
                  </div>

                  <a
                    href={mapsUrl}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-300 border border-blue-500/30 text-[11px] font-mono transition-colors"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="#EA4335" />
                      <circle cx="12" cy="9" r="2.5" fill="white" />
                    </svg>
                    <span>Maps</span>
                    <span className="material-symbols-outlined text-[10px]">open_in_new</span>
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── FLIGHT RECOMMENDATIONS LIST (5 OPTIONS) ── */}
      {isFlight && (
        <div className="grid grid-cols-1 gap-2.5">
          {flightOptions.map((f, idx) => {
            const isSelected = selectedId === f.id || (!selectedId && idx === 0);

            return (
              <div
                key={f.id}
                onClick={() => onSelect(f.id)}
                className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                  isSelected
                    ? 'bg-[#8352ff]/15 border-[#8352ff] shadow-[0_0_20px_rgba(131,82,255,0.3)] ring-1 ring-[#8352ff]/50'
                    : 'bg-white/[0.02] border-white/10 hover:bg-white/[0.05] hover:border-white/20'
                }`}
              >
                <div className="flex items-start gap-3 flex-1">
                  <div className="pt-0.5">
                    <div
                      className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all ${
                        isSelected
                          ? 'border-[#8352ff] bg-[#8352ff] text-white'
                          : 'border-white/30 bg-black/40'
                      }`}
                    >
                      {isSelected && <span className="text-xs font-bold">✓</span>}
                    </div>
                  </div>

                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-bold text-white tracking-tight">{f.airline}</span>
                      <span className="text-xs font-mono text-[#cebdff] bg-[#8352ff]/20 px-2 py-0.5 rounded">
                        {f.flightNumber}
                      </span>
                      {f.badge && (
                        <span className="text-[10px] font-mono uppercase bg-emerald-500/15 text-emerald-300 px-2 py-0.5 rounded border border-emerald-500/30 font-semibold">
                          {f.badge}
                        </span>
                      )}
                    </div>

                    {/* Flight Schedule */}
                    <div className="flex items-center gap-3 text-xs text-white/80 mt-1.5 font-mono">
                      <span className="font-bold text-white">{f.departure} ({f.fromCode})</span>
                      <span className="text-white/40">➔</span>
                      <span className="font-bold text-white">{f.arrival} ({f.toCode})</span>
                      <span className="text-white/40">·</span>
                      <span className="text-white/60">{f.duration}</span>
                      <span className="text-white/40">·</span>
                      <span className="text-emerald-400 font-semibold">{f.stops}</span>
                    </div>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="text-base font-black font-mono text-white">{f.price}</span>
                  <span className="text-[10px] font-mono text-white/40 block">est. fare</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── ACTIVITY RECOMMENDATIONS LIST (5 OPTIONS) ── */}
      {isActivity && (
        <div className="grid grid-cols-1 gap-2.5">
          {activityOptions.map((a, idx) => {
            const isSelected = selectedId === a.id || (!selectedId && idx === 0);

            return (
              <div
                key={a.id}
                onClick={() => onSelect(a.id)}
                className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                  isSelected
                    ? 'bg-[#8352ff]/15 border-[#8352ff] shadow-[0_0_20px_rgba(131,82,255,0.3)] ring-1 ring-[#8352ff]/50'
                    : 'bg-white/[0.02] border-white/10 hover:bg-white/[0.05] hover:border-white/20'
                }`}
              >
                <div className="flex items-start gap-3 flex-1">
                  <div className="pt-0.5">
                    <div
                      className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all ${
                        isSelected
                          ? 'border-[#8352ff] bg-[#8352ff] text-white'
                          : 'border-white/30 bg-black/40'
                      }`}
                    >
                      {isSelected && <span className="text-xs font-bold">✓</span>}
                    </div>
                  </div>

                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-bold text-white tracking-tight">{a.title}</span>
                      {a.badge && (
                        <span className="text-[10px] font-mono uppercase bg-[#8352ff]/20 text-[#cebdff] px-2 py-0.5 rounded font-semibold">
                          {a.badge}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-white/60 mt-1">
                      <span className="material-symbols-outlined text-[14px] text-amber-400">tour</span>
                      <span>{a.location} · {a.duration} · ⭐ {a.rating}</span>
                    </div>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="text-base font-black font-mono text-white">{a.price}</span>
                  <span className="text-[10px] font-mono text-white/40 block">per person</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Confirm Selection Button */}
      <div className="flex items-center justify-between border-t border-white/10 pt-3">
        <span className="text-xs font-mono text-white/50">
          Click any card to select · Confirmed selection will be paid autonomously
        </span>

        <button
          type="button"
          onClick={onConfirm}
          className="px-6 py-2.5 bg-[#8352ff] hover:bg-[#6b34e6] text-white rounded-xl text-xs font-bold font-mono tracking-wide shadow-[0_0_20px_rgba(131,82,255,0.4)] flex items-center gap-2 transition-all cursor-pointer"
        >
          <span>Confirm Selection &amp; Proceed to Payment</span>
          <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
        </button>
      </div>
    </div>
  );
}
