import { ParticleWave } from '@/components/ui/particle-wave';

const DemoOne = () => {
  return (
    <div className="relative w-full h-screen bg-background overflow-hidden">
      <ParticleWave />
      <div className="absolute top-4 left-4 z-10 text-foreground/80 text-sm font-mono">
        <p>Particle Wave Animation</p>
        <p className="text-xs opacity-60 mt-1">Move your mouse to interact</p>
      </div>
    </div>
  );
};

export { DemoOne };
