export interface HotelDetails {
  name: string;
  stars: number;
  address: string;
  city: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  roomType: string;
  pricePerNight: string;
  totalPrice: string;
  rating: string;
  amenities: string[];
  bookingRef: string;
  confirmationCode: string;
  mapsQuery: string; // URL-encoded query for Google Maps
  txHash?: string;
}

interface HotelCardProps {
  hotel: HotelDetails;
}

export default function HotelCard({ hotel }: HotelCardProps) {
  const starFill = Array.from({ length: 5 }, (_, i) => i < hotel.stars);
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${hotel.mapsQuery}`;

  return (
    <div
      className="relative w-full max-w-2xl mx-auto rounded-2xl overflow-hidden animate-in fade-in duration-500"
      style={{
        background: 'linear-gradient(135deg, #0f1f30 0%, #0a1520 50%, #102030 100%)',
        boxShadow: '0 0 50px rgba(16, 185, 129, 0.25), 0 0 120px rgba(16, 185, 129, 0.08)',
        border: '1px solid rgba(16, 185, 129, 0.35)',
      }}
    >
      {/* Top Header Strip — teal/emerald theme for hotels */}
      <div className="h-1.5 w-full bg-gradient-to-r from-emerald-500 via-teal-300 to-emerald-500 opacity-90" />

      {/* Header Row */}
      <div className="px-7 pt-6 pb-4 flex items-start justify-between border-b border-white/10 gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-emerald-400 text-[22px]">hotel</span>
          </div>
          <div>
            <div className="text-lg font-black text-white tracking-tight leading-tight">{hotel.name}</div>
            <div className="flex items-center gap-1 mt-0.5">
              {starFill.map((filled, i) => (
                <span key={i} className={`text-[13px] ${filled ? 'text-amber-400' : 'text-white/20'}`}>★</span>
              ))}
              <span className="ml-1.5 text-[11px] font-mono text-white/50">{hotel.rating} / 5.0</span>
            </div>
          </div>
        </div>

        <div className="text-right shrink-0">
          <div className="text-[10px] font-mono text-white/40 uppercase">Booking Ref</div>
          <div className="text-base font-black font-mono text-emerald-400 tracking-widest">{hotel.bookingRef}</div>
          <div className="text-[10px] font-mono text-white/30 mt-0.5">Conf: {hotel.confirmationCode}</div>
        </div>
      </div>

      {/* Address & Map Row */}
      <div className="px-7 py-4 flex items-start justify-between gap-4 border-b border-white/10">
        <div className="flex items-start gap-2.5 flex-1">
          <span className="material-symbols-outlined text-emerald-400 text-[18px] mt-0.5 shrink-0">location_on</span>
          <div>
            <div className="text-sm font-semibold text-white">{hotel.address}</div>
            <div className="text-xs text-white/50 mt-0.5 font-mono">{hotel.city}</div>
          </div>
        </div>

        {/* Google Maps Button */}
        <a
          href={mapsUrl}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold font-mono transition-all shrink-0 group"
          style={{
            background: 'linear-gradient(135deg, rgba(66, 133, 244, 0.2) 0%, rgba(52, 168, 83, 0.2) 100%)',
            border: '1px solid rgba(66, 133, 244, 0.4)',
            color: '#a8c7fa',
            boxShadow: '0 0 12px rgba(66, 133, 244, 0.2)',
          }}
          onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 0 20px rgba(66, 133, 244, 0.45)')}
          onMouseLeave={e => (e.currentTarget.style.boxShadow = '0 0 12px rgba(66, 133, 244, 0.2)')}
        >
          {/* Google Maps "G" pin icon (inline SVG) */}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="#EA4335"/>
            <circle cx="12" cy="9" r="2.5" fill="white"/>
          </svg>
          <span>View on Maps</span>
          <span className="material-symbols-outlined text-[13px] opacity-70 group-hover:translate-x-0.5 transition-transform">open_in_new</span>
        </a>
      </div>

      {/* Stay Details Grid */}
      <div className="px-7 py-5 grid grid-cols-2 sm:grid-cols-4 gap-4 border-b border-white/10">
        <div>
          <div className="text-[10px] font-mono text-white/40 uppercase tracking-wider">Check-In</div>
          <div className="text-sm font-bold text-white mt-0.5">{hotel.checkIn}</div>
          <div className="text-[10px] text-white/30 font-mono">From 14:00</div>
        </div>
        <div>
          <div className="text-[10px] font-mono text-white/40 uppercase tracking-wider">Check-Out</div>
          <div className="text-sm font-bold text-white mt-0.5">{hotel.checkOut}</div>
          <div className="text-[10px] text-white/30 font-mono">By 11:00</div>
        </div>
        <div>
          <div className="text-[10px] font-mono text-white/40 uppercase tracking-wider">Nights</div>
          <div className="text-2xl font-black font-mono text-emerald-400 mt-0.5">{hotel.nights}</div>
        </div>
        <div>
          <div className="text-[10px] font-mono text-white/40 uppercase tracking-wider">Room Type</div>
          <div className="text-sm font-bold text-white mt-0.5">{hotel.roomType}</div>
        </div>
      </div>

      {/* Pricing Row */}
      <div className="px-7 py-4 flex items-center justify-between border-b border-white/10 gap-4">
        <div className="flex items-center gap-6">
          <div>
            <div className="text-[10px] font-mono text-white/40 uppercase">Per Night</div>
            <div className="text-lg font-black font-mono text-white">{hotel.pricePerNight}</div>
          </div>
          <div className="text-white/20">×</div>
          <div>
            <div className="text-[10px] font-mono text-white/40 uppercase">Nights</div>
            <div className="text-lg font-black font-mono text-white">{hotel.nights}</div>
          </div>
          <div className="text-white/20">=</div>
          <div>
            <div className="text-[10px] font-mono text-white/40 uppercase">Total</div>
            <div className="text-xl font-black font-mono text-emerald-400">{hotel.totalPrice}</div>
          </div>
        </div>

        {hotel.txHash && (
          <div className="text-right shrink-0">
            <div className="text-[10px] font-mono text-white/40 uppercase">Paid on Monad</div>
            <div className="text-[11px] font-mono text-emerald-400 mt-0.5">
              {hotel.txHash.slice(0, 8)}...{hotel.txHash.slice(-6)}
            </div>
          </div>
        )}
      </div>

      {/* Amenities */}
      <div className="px-7 py-4 flex flex-wrap gap-2 border-b border-white/10">
        <span className="text-[10px] font-mono text-white/40 uppercase tracking-wider self-center mr-1">Amenities:</span>
        {hotel.amenities.map((am) => (
          <span
            key={am}
            className="text-[11px] font-mono px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/25 text-emerald-300"
          >
            {am}
          </span>
        ))}
      </div>

      {/* Footer Strip */}
      <div className="px-7 py-3 bg-emerald-500/10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs font-mono text-emerald-400 font-semibold">
            RESERVATION CONFIRMED · Paid autonomously via Monad Testnet
          </span>
        </div>
        <span className="text-[10px] font-mono text-white/30">AgentPay · Chain 10143</span>
      </div>
    </div>
  );
}
