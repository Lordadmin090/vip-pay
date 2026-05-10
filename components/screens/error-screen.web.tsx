import React from 'react';
import { Icon } from '@iconify/react';

// Ported from `export-react/error-page.tsx`.
export default function ErrorWeb() {
  return (
    <div className="relative h-screen w-full bg-black text-white flex flex-col items-center justify-center px-8 text-center overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-destructive/10 via-transparent to-transparent opacity-50" />
      <div className="relative z-10 flex flex-col items-center max-w-xs">
        <div className="relative mb-8 group">
          <div className="w-24 h-24 bg-card/60 rounded-[2rem] border border-white/10 flex items-center justify-center -rotate-6 group-hover:rotate-0 transition-transform duration-500">
            <Icon icon="solar:shield-warning-bold-duotone" className="text-destructive text-5xl" />
          </div>
          <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-destructive rounded-full border-4 border-black flex items-center justify-center shadow-lg">
            <Icon icon="solar:close-circle-bold" className="text-white text-xl" />
          </div>
        </div>
        <h2 className="text-3xl font-heading font-extrabold tracking-tight mb-4">Something went wrong</h2>
        <p className="text-muted-foreground text-sm leading-relaxed mb-10">
          We encountered an unexpected error while processing your request. Please check your internet connection and try
          again.
        </p>
        <div className="w-full space-y-4">
          <button className="w-full bg-white text-black font-extrabold py-5 rounded-full shadow-2xl hover:scale-105 active:scale-95 transition-all duration-300">
            TRY AGAIN
          </button>
          <button className="w-full bg-transparent text-muted-foreground font-bold py-3 hover:text-white transition-colors">
            CONTACT SUPPORT
          </button>
        </div>
        <div className="mt-16 flex items-center gap-2 opacity-30">
          <Icon icon="solar:bug-bold" className="text-xs" />
          <span className="text-[8px] font-mono tracking-widest uppercase">Error Code: ERR_CON_REFUSED</span>
        </div>
      </div>
    </div>
  );
}

