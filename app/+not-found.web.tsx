import React from 'react';
import { Icon } from '@iconify/react';

// Ported from `export-react/404-page.tsx`.
// Minimal compile fixes applied (function name + alt).
export default function NotFoundWeb() {
  return (
    <div className="relative min-h-screen w-full bg-black text-foreground flex flex-col items-center justify-center px-8 text-center">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[400px] h-[400px] bg-primary/20 blur-[120px] rounded-full" />
        <div className="absolute bottom-1/4 left-1/2 -translate-x-1/2 w-[300px] h-[300px] bg-secondary/10 blur-[100px] rounded-full" />
      </div>
      <div className="relative z-10 w-full max-w-xs space-y-8 animate-in fade-in zoom-in duration-700">
        <div className="relative w-48 h-48 mx-auto">
          <img
            alt="404"
            src="https://ggrhecslgdflloszjkwl.supabase.co/storage/v1/object/public/user-assets/DBD4kZdQWoF/components/8BTJpFPEM8C.png"
            className="w-full h-full object-contain"
          />
          <div className="absolute top-0 left-0 w-full h-full animate-pulse-slow">
            <Icon
              icon="solar:ghost-bold"
              className="text-[120px] text-primary/10 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
            />
          </div>
        </div>
        <div className="space-y-4 text-white">
          <h1 className="text-6xl font-black font-heading tracking-tighter">404</h1>
          <h2 className="text-2xl font-black font-heading tracking-tight uppercase">LOST IN SPACE</h2>
          <p className="text-sm text-muted-foreground font-medium leading-relaxed">
            The page you're looking for has vanished into the digital void.
          </p>
        </div>
        <div className="pt-6">
          <button className="w-full h-16 rounded-full bg-white text-black font-black text-sm uppercase tracking-widest hover:scale-105 active:scale-95 shadow-[0_20px_50px_rgba(255,255,255,0.15)] transition-all flex items-center justify-center gap-3">
            <Icon icon="solar:home-2-bold" className="text-xl" />
            BACK TO HOME
          </button>
        </div>
      </div>
    </div>
  );
}

