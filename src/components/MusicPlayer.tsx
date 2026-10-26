import { useEffect, useRef, useState } from "react";
import { Pause, Play, SkipBack, SkipForward } from "lucide-react";

// Non-stop Hindi romantic song channels (unlimited songs).
const TRACKS = [
  { title: "Bollywood Love", url: "https://drive.uber.radio/uber/bollywoodlove/icecast.audio" },
  { title: "Love Hindi", url: "https://drive.uber.radio/uber/lrbollywood/icecast.audio" },
  { title: "Radio Madhoshi", url: "https://stream.zeno.fm/7rsl8fsccf8uv" },
  { title: "Radio Gaana", url: "https://sp14.instainternet.com/8044/stream" },
];

const btn = "grid h-9 w-9 shrink-0 place-items-center rounded-full bg-background/20 hover:bg-background/30 active:scale-90 transition";
const fmt = (s: number) => (Number.isFinite(s) ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}` : "0:00");

export function MusicPlayer() {
  const ref = useRef<HTMLAudioElement | null>(null);
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [dur, setDur] = useState(0);
  const wantRef = useRef(false); // user pressed Play
  const awayRef = useRef(false); // paused because page hidden
  const first = useRef(true);

  const isAway = () => document.visibilityState !== "visible";
  const play = () => { const a = ref.current; if (a && wantRef.current && !isAway()) a.play().catch(() => {}); };

  // Track change: load new song, keep playing if user wants music.
  useEffect(() => {
    const a = ref.current;
    if (!a) return;
    a.src = TRACKS[i]!.url;
    setTime(0); setDur(0);
    if (first.current) { first.current = false; return; }
    play();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i]);

  // Pause when minimised / tab changed, resume on return.
  useEffect(() => {
    const onVis = () => {
      const a = ref.current;
      if (!a) return;
      if (isAway()) { if (!a.paused) { awayRef.current = true; a.pause(); } }
      else if (awayRef.current) { awayRef.current = false; play(); }
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("pagehide", onVis);
    return () => { document.removeEventListener("visibilitychange", onVis); window.removeEventListener("pagehide", onVis); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const go = (d: number) => setI((x) => (x + d + TRACKS.length) % TRACKS.length);
  const toggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    const a = ref.current;
    if (!a) return;
    if (!a.paused) { wantRef.current = false; awayRef.current = false; a.pause(); }
    else { wantRef.current = true; play(); }
  };
  const step = (d: number) => (e: React.MouseEvent) => { e.stopPropagation(); wantRef.current = true; go(d); };

  return (
    <div className="relative z-20 flex h-full shrink-0 items-center gap-1 bg-foreground px-2 text-background">
      <audio
        ref={ref}
        preload="none"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDur(e.currentTarget.duration)}
        onEnded={() => go(1)}
        onError={() => { setPlaying(false); if (wantRef.current) go(1); }}
      />
      <button type="button" aria-label="Previous song" onClick={step(-1)} className={btn}><SkipBack className="h-4 w-4" /></button>
      <button type="button" aria-label={playing ? "Pause" : "Play"} onClick={toggle} className={btn}>
        {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
      </button>
      <button type="button" aria-label="Next song" onClick={step(1)} className={btn}><SkipForward className="h-4 w-4" /></button>
      <div className="ml-1 hidden w-28 flex-col sm:flex">
        <span className="truncate text-[11px] font-medium">{TRACKS[i]!.title}</span>
        {Number.isFinite(dur) && dur > 0 && <input
          type="range" aria-label="Song position" min={0} max={dur || 0} step={1} value={time}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => { const a = ref.current; if (a) a.currentTime = Number(e.target.value); }}
          className="h-1 w-full accent-primary"
        />}
        <span className="text-[10px] opacity-70">{fmt(time)}</span>
      </div>
    </div>
  );
}
