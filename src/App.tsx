/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  Home,
  FolderKanban,
  HelpCircle,
  Settings,
  Upload,
  Download,
  RotateCcw,
  Maximize2,
  Minimize2,
  ZoomIn,
  Sparkles,
  ArrowRight,
  ChevronDown,
  Layers,
  MapPin,
  Clock,
  Check,
  SplitSquareHorizontal,
  Columns,
  FileImage,
  Sparkle
} from 'lucide-react';
import { absUrl, listSamples, outputTifUrl, superresSample, superresUpload, type SuperresResult, type Sample } from './api';

interface RecentItem {
  id: string;
  title: string;
  timeAgo: string;
  badge: string;
  imgUrl: string;
  sampleId?: string;
}

export default function App() {
  const [activeNav, setActiveNav] = useState<'enhance' | 'results' | 'help' | 'settings'>('enhance');
  const [viewMode, setViewMode] = useState<'split' | 'side-by-side'>('split');
  const [resolutionMode, setResolutionMode] = useState<string>('2.5 m/pixel (4×)');

  // Imagery state
  const [imageName, setImageName] = useState<string>('Agricultural Farmland & Road Corridor Scene');
  const [result, setResult] = useState<SuperresResult | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [splitPos, setSplitPos] = useState<number>(50); // percentage for split slider
  const [isSplitDragging, setIsSplitDragging] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [isSaved, setIsSaved] = useState<boolean>(false);

  // Available backend samples & recent activity items
  const [samplesList, setSamplesList] = useState<Sample[]>([]);
  const [recentItems, setRecentItems] = useState<RecentItem[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const viewerContainerRef = useRef<HTMLDivElement>(null);
  const requestSeq = useRef(0);

  const inputSrc = result ? absUrl(result.input.png) : undefined;
  const outputSrc = result ? absUrl(result.output.png) : undefined;

  // Tile shape drives the layout: clearly portrait tiles go side by side, everything else stacks.
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(null);
  const dims = result ? { w: result.input.width, h: result.input.height } : naturalSize;
  const aspect = dims && dims.w > 0 && dims.h > 0 ? dims.w / dims.h : 1;
  const isPortrait = aspect < 0.8;
  const panelStyle: React.CSSProperties = {
    aspectRatio: String(aspect),
    width: `min(100%, calc(${isPortrait ? 70 : 65}vh * ${aspect}))`,
  };
  const handleNaturalSize = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const { naturalWidth: w, naturalHeight: h } = e.currentTarget;
    if (w > 0 && h > 0) setNaturalSize({ w, h });
  };

  // Run one backend job; only the latest request may update the UI.
  const runJob = async (label: string, job: () => Promise<SuperresResult>) => {
    const seq = ++requestSeq.current;
    setIsLoading(true);
    setError(null);
    try {
      const res = await job();
      if (seq !== requestSeq.current) return;
      setResult(res);
      setImageName(label);
      setZoomLevel(1);

      // Dynamically add to recent items
      setRecentItems((prev) => {
        const existing = prev.filter((item) => item.title !== label);
        return [
          {
            id: res.id,
            title: label,
            timeAgo: 'Just now',
            badge: '4×',
            imgUrl: absUrl(res.output.png),
          },
          ...existing,
        ].slice(0, 8);
      });
    } catch (err) {
      if (seq !== requestSeq.current) return;
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      if (seq === requestSeq.current) setIsLoading(false);
    }
  };

  // Load the first bundled sample on startup.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const samples = await listSamples();
        if (cancelled) return;
        setSamplesList(samples);
        if (samples.length > 0) {
          // Populate dynamic recent activity from backend samples
          const initialRecent: RecentItem[] = samples.map((s, idx) => ({
            id: s.id,
            title: s.name || `Scene ${s.id}`,
            timeAgo: `${(idx + 1) * 2} hours ago`,
            badge: '4×',
            imgUrl: absUrl(`/api/samples/${encodeURIComponent(s.id)}/input.png`),
            sampleId: s.id,
          }));
          setRecentItems(initialRecent);

          const first = samples[0];
          await runJob(first.name || 'Agricultural Farmland & Road Corridor Scene', () => superresSample(first.id));
        } else {
          setIsLoading(false);
        }
      } catch (err) {
        if (cancelled) return;
        setIsLoading(false);
        console.warn('Backend offline:', err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Handle local file upload
  const handleFile = (file: File) => {
    void runJob(file.name.replace(/\.[^/.]+$/, ''), () => superresUpload(file));
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  // Fullscreen toggle
  const toggleFullscreen = () => {
    if (!viewerContainerRef.current) return;
    if (!document.fullscreenElement) {
      viewerContainerRef.current.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  // Download the real 2.5 m GeoTIFF or enhanced preview
  const handleSaveImagery = async () => {
    if (!result) {
      const a = document.createElement('a');
      a.href = outputSrc;
      a.download = `${imageName || 'enhanced'}_2.5m.png`;
      a.click();
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2500);
      return;
    }
    try {
      const res = await fetch(outputTifUrl(result));
      if (!res.ok) throw new Error(`Download failed (${res.status})`);
      const href = URL.createObjectURL(await res.blob());
      const link = document.createElement('a');
      link.href = href;
      link.download = `${imageName || 'scene'}_enhanced_2.5m.tif`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(href);
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  // Handle split slider drag
  const handleSplitMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isSplitDragging) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percent = Math.max(5, Math.min(95, (x / rect.width) * 100));
    setSplitPos(percent);
  };

  const handleEnhanceClick = () => {
    if (samplesList.length > 0) {
      const randomSample = samplesList[Math.floor(Math.random() * samplesList.length)];
      void runJob(randomSample.name, () => superresSample(randomSample.id));
    } else if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleSelectRecent = (item: RecentItem) => {
    setImageName(item.title);
    if (item.sampleId) {
      void runJob(item.title, () => superresSample(item.sampleId!));
    } else if (samplesList.length > 0) {
      const matched = samplesList.find(s => s.name.toLowerCase().includes(item.id.toLowerCase())) || samplesList[0];
      void runJob(item.title, () => superresSample(matched.id));
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#F4F7FC] text-[#1E293B] font-sans select-none antialiased">
      {/* Left Workspace Navigation Sidebar with Seamless Earth Theme */}
      <aside className="w-64 relative shrink-0 z-20 flex flex-col justify-between overflow-hidden bg-gradient-to-b from-[#060D1E] via-[#09152F] to-[#030712] text-white border-r border-slate-800/80 shadow-[4px_0_24px_rgba(0,0,0,0.15)]">
        {/* Seamless Earth Background Atmosphere & Curved Horizon */}
        <div className="absolute inset-0 pointer-events-none select-none overflow-hidden">
          {/* Earth image blended seamlessly into the sidebar */}
          <img
            src="/assets/earth_bottom_left.jpg"
            alt="Earth Horizon"
            className="absolute -bottom-10 -left-12 w-[340px] h-[340px] object-cover opacity-60 mix-blend-screen pointer-events-none"
            onError={(e) => {
              (e.target as HTMLElement).src = '/assets/earth_sidebar.jpg';
            }}
          />
          {/* Ambient radial atmospheric glows */}
          <div className="absolute -top-24 -left-24 w-60 h-60 rounded-full bg-blue-500/10 blur-3xl pointer-events-none" />
          <div className="absolute bottom-16 -right-16 w-52 h-52 rounded-full bg-cyan-400/15 blur-2xl pointer-events-none" />
          <div className="absolute inset-0 bg-gradient-to-b from-[#060D1E]/80 via-transparent to-[#030712]/90 pointer-events-none" />
        </div>

        {/* Top: Logo & Main Navigation */}
        <div className="p-5 flex flex-col relative z-10">
          {/* RESOLVE Brand Logo with Orbital Ring */}
          <div className="flex items-center gap-3 mb-8 cursor-pointer select-none">
            <div className="relative w-10 h-10 rounded-full overflow-hidden shrink-0 shadow-lg border border-cyan-400/30 flex items-center justify-center bg-[#0B1528] ring-2 ring-blue-500/20">
              <img
                src="/assets/logo_earth.png"
                alt="Resolve Earth Logo"
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <span className="text-white text-xs font-bold drop-shadow">🛰️</span>
              </div>
            </div>
            <div className="flex flex-col">
              <span className="text-[17px] font-black tracking-tight text-white leading-tight flex items-center gap-1 drop-shadow-sm">
                RESOLVE
              </span>
              <span className="text-[10px] text-blue-200/70 font-medium leading-tight">
                Satellite Super-Resolution
              </span>
              <span className="text-[10px] text-blue-200/50 font-medium leading-tight">
                for Sharper Earth Insights
              </span>
            </div>
          </div>

          {/* Navigation Links with Glassmorphism */}
          <nav className="space-y-1.5">
            <button
              onClick={() => setActiveNav('enhance')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                activeNav === 'enhance'
                  ? 'bg-blue-600/30 text-white border border-blue-400/40 shadow-sm backdrop-blur-md'
                  : 'text-slate-300 hover:text-white hover:bg-white/5'
              }`}
            >
              <Home className={`w-4 h-4 ${activeNav === 'enhance' ? 'text-cyan-400' : 'text-slate-400'}`} />
              <span>Enhance</span>
            </button>

            <button
              onClick={() => setActiveNav('results')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer ${
                activeNav === 'results'
                  ? 'bg-blue-600/30 text-white border border-blue-400/40 shadow-sm backdrop-blur-md'
                  : 'text-slate-300 hover:text-white hover:bg-white/5'
              }`}
            >
              <FolderKanban className="w-4 h-4 text-slate-400" />
              <span>My Results</span>
            </button>

            <div className="pt-4 pb-1">
              <div className="h-px bg-white/10 mb-4" />
            </div>

            <button
              onClick={() => setActiveNav('help')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer ${
                activeNav === 'help'
                  ? 'bg-blue-600/30 text-white border border-blue-400/40 shadow-sm backdrop-blur-md'
                  : 'text-slate-300 hover:text-white hover:bg-white/5'
              }`}
            >
              <HelpCircle className="w-4 h-4 text-slate-400" />
              <span>Help & Support</span>
            </button>

            <button
              onClick={() => setActiveNav('settings')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer ${
                activeNav === 'settings'
                  ? 'bg-blue-600/30 text-white border border-blue-400/40 shadow-sm backdrop-blur-md'
                  : 'text-slate-300 hover:text-white hover:bg-white/5'
              }`}
            >
              <Settings className="w-4 h-4 text-slate-400" />
              <span>Settings</span>
            </button>
          </nav>
        </div>

        {/* Seamless Lower Earth Caption Integration (without isolated card box) */}
        <div className="p-5 relative z-10 select-none">
          <div className="flex items-center gap-1.5 mb-1 text-[11px] font-semibold text-cyan-300 tracking-wider uppercase">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
            <span>Earth Observation</span>
          </div>
          <p className="text-[11px] text-slate-300/80 leading-relaxed font-normal">
            From satellite imagery to sharper insights for a better tomorrow.
          </p>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-y-auto">
        {/* Top Header */}
        <header className="h-16 px-8 flex items-center justify-end gap-3 shrink-0">
          <button
            onClick={() => setActiveNav('help')}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-600 hover:text-slate-900 hover:bg-white border border-transparent hover:border-slate-200 transition-all cursor-pointer"
            title="Help"
          >
            <HelpCircle className="w-5 h-5 text-slate-500" />
          </button>

          {/* User Profile Avatar with dropdown arrow */}
          <div className="flex items-center gap-1.5 pl-1 cursor-pointer">
            <div className="w-8 h-8 rounded-full bg-[#2563EB] text-white flex items-center justify-center font-bold text-xs shadow-sm">
              RS
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
          </div>
        </header>

        {/* Content Body Container */}
        <main className="flex-1 px-8 pb-8 max-w-7xl w-full mx-auto flex flex-col justify-between">
          <div>
            {/* Headline Banner */}
            <div className="mb-6">
              <h1 className="text-3xl lg:text-4xl font-extrabold text-[#0F172A] tracking-tight">
                Enhance Satellite Imagery <span className="text-[#2563EB]">with AI</span>
              </h1>
              <p className="text-sm text-slate-500 mt-1.5">
                Upload a Sentinel-2 image and get 4× higher resolution (2.5 m) while preserving real-world fidelity.
              </p>
            </div>

            {/* Top Workspace Grid: Upload Card (Left) & Compare Viewer (Right) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
              {/* Upload Card */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                className={`lg:col-span-4 bg-white rounded-2xl border-2 ${
                  isDragging ? 'border-[#2563EB] bg-blue-50/30' : 'border-dashed border-slate-200'
                } p-6 flex flex-col items-center justify-center text-center shadow-xs transition-all relative group min-h-[320px]`}
              >
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="w-16 h-16 rounded-full bg-[#EEF2FF] text-[#2563EB] flex items-center justify-center mb-4 cursor-pointer hover:scale-105 transition-transform shadow-xs"
                >
                  <Upload className="w-7 h-7 stroke-[2.2]" />
                </div>

                <h3 className="text-base font-bold text-[#0F172A] mb-1">
                  Upload Sentinel-2 Image
                </h3>
                <p className="text-xs text-slate-500 mb-1">
                  Drag and drop a file here, or click to browse
                </p>
                <p className="text-[11px] text-slate-400 font-mono mb-5">
                  Supports .tif, .jp2, .png (Sentinel-2 L2A)
                </p>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-semibold shadow-sm hover:shadow transition-all cursor-pointer"
                >
                  <FileImage className="w-4 h-4" />
                  <span>Choose Image</span>
                </button>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".tif,.tiff,.jp2,.png,.jpg,.jpeg,image/*"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleFile(e.target.files[0]);
                    }
                  }}
                  className="hidden"
                />
              </div>

              {/* Comparison Viewer */}
              <div
                ref={viewerContainerRef}
                className="lg:col-span-8 bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs flex flex-col justify-between"
              >
                {/* Header inside viewer card */}
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-slate-400">🗺️</span>
                    <span className="text-xs font-bold text-slate-800 truncate">
                      {imageName}
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setZoomLevel((z) => (z >= 2.5 ? 1 : z + 0.5))}
                      title="Zoom"
                      className="w-7 h-7 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition-colors cursor-pointer"
                    >
                      <ZoomIn className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setZoomLevel(1)}
                      title="Reset"
                      className="w-7 h-7 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition-colors cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={toggleFullscreen}
                      title="Fullscreen"
                      className="w-7 h-7 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition-colors cursor-pointer"
                    >
                      {isFullscreen ? (
                        <Minimize2 className="w-3.5 h-3.5" />
                      ) : (
                        <Maximize2 className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Viewport Area */}
                <div className="relative my-3 rounded-xl overflow-hidden bg-slate-900 aspect-[16/9] max-h-[360px] flex items-center justify-center select-none">
                  {viewMode === 'split' ? (
                    <div
                      onMouseDown={() => setIsSplitDragging(true)}
                      onMouseUp={() => setIsSplitDragging(false)}
                      onMouseLeave={() => setIsSplitDragging(false)}
                      onMouseMove={handleSplitMouseMove}
                      className="relative w-full h-full cursor-ew-resize overflow-hidden"
                    >
                      <img
                        src={outputSrc}
                        alt="Enhanced Satellite Scene"
                        onLoad={handleNaturalSize}
                        className="absolute inset-0 w-full h-full object-cover transition-transform duration-100"
                        style={{ transform: `scale(${zoomLevel})` }}
                      />

                      <div
                        className="absolute inset-0 overflow-hidden"
                        style={{ clipPath: `inset(0 ${100 - splitPos}% 0 0)` }}
                      >
                        <img
                          src={inputSrc}
                          alt="Original Satellite Scene"
                          className="absolute inset-0 w-full h-full object-cover transition-transform duration-100"
                          style={{
                            transform: `scale(${zoomLevel})`,
                            imageRendering: 'pixelated',
                          }}
                        />
                      </div>

                      {/* Floating Labels */}
                      <div className="absolute top-3 left-3 z-10 pointer-events-none">
                        <div className="bg-black/65 backdrop-blur-md text-white text-[11px] font-medium px-2.5 py-1 rounded-md flex items-center gap-1.5 shadow-sm border border-white/10">
                          <span className="w-2 h-2 rounded-full bg-amber-400" />
                          <span>Original Input (10 m GSD)</span>
                        </div>
                      </div>

                      <div className="absolute top-3 right-3 z-10 pointer-events-none">
                        <div className="bg-[#2563EB]/90 backdrop-blur-md text-white text-[11px] font-semibold px-2.5 py-1 rounded-md flex items-center gap-1.5 shadow-sm border border-white/10">
                          <Sparkle className="w-3 h-3 fill-white" />
                          <span>Enhanced Output (2.5 m)</span>
                        </div>
                      </div>

                      {/* Draggable Divider */}
                      <div
                        className="absolute top-0 bottom-0 w-0.5 bg-white shadow-[0_0_8px_rgba(0,0,0,0.5)] z-20 pointer-events-none"
                        style={{ left: `${splitPos}%` }}
                      >
                        <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-7 h-7 rounded-full bg-white text-slate-700 shadow-md flex items-center justify-center border border-slate-300 pointer-events-auto cursor-ew-resize">
                          <div className="flex items-center text-[10px] font-bold text-slate-500 tracking-tighter">
                            ‹›
                          </div>
                        </div>
                      </div>

                      {/* Bottom Info Badges */}
                      <div className="absolute bottom-3 left-3 z-10 pointer-events-none">
                        <span className="bg-black/70 backdrop-blur-md text-slate-200 text-[10px] font-mono px-2 py-0.5 rounded shadow-sm">
                          Sentinel-2 L2A
                        </span>
                      </div>

                      <div className="absolute bottom-3 right-3 z-10 pointer-events-none">
                        <span className="bg-black/70 backdrop-blur-md text-slate-200 text-[10px] font-mono px-2 py-0.5 rounded shadow-sm">
                          4-Band Multispectral
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 w-full h-full gap-1 p-1 bg-slate-950">
                      <div className="relative w-full h-full overflow-hidden rounded">
                        <img
                          src={inputSrc}
                          alt="Original"
                          className="w-full h-full object-cover"
                          style={{
                            transform: `scale(${zoomLevel})`,
                            imageRendering: 'pixelated',
                          }}
                        />
                        <div className="absolute top-2 left-2 bg-black/60 text-white text-[10px] px-2 py-0.5 rounded">
                          Original (10m)
                        </div>
                      </div>
                      <div className="relative w-full h-full overflow-hidden rounded">
                        <img
                          src={outputSrc}
                          alt="Enhanced"
                          className="w-full h-full object-cover"
                          style={{ transform: `scale(${zoomLevel})` }}
                        />
                        <div className="absolute top-2 left-2 bg-[#2563EB]/90 text-white text-[10px] px-2 py-0.5 rounded">
                          Enhanced (2.5m)
                        </div>
                      </div>
                    </div>
                  )}

                  {isLoading && (
                    <div className="absolute inset-0 z-30 bg-slate-900/60 backdrop-blur-xs flex flex-col items-center justify-center text-white">
                      <div className="w-10 h-10 rounded-full border-3 border-white/30 border-t-[#2563EB] animate-spin mb-2" />
                      <span className="text-xs font-semibold tracking-wide">
                        Enhancing Satellite Resolution...
                      </span>
                    </div>
                  )}
                </div>

                {/* View Mode Toggle */}
                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center gap-1.5 text-xs text-slate-400">
                    <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />
                    <span>Real-time High Fidelity Preview</span>
                  </div>

                  <div className="inline-flex bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                    <button
                      onClick={() => setViewMode('split')}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${
                        viewMode === 'split'
                          ? 'bg-white text-[#2563EB] shadow-2xs'
                          : 'text-slate-500 hover:text-slate-900'
                      }`}
                    >
                      <SplitSquareHorizontal className="w-3 h-3" />
                      <span>Split</span>
                    </button>
                    <button
                      onClick={() => setViewMode('side-by-side')}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${
                        viewMode === 'side-by-side'
                          ? 'bg-white text-[#2563EB] shadow-2xs'
                          : 'text-slate-500 hover:text-slate-900'
                      }`}
                    >
                      <Columns className="w-3 h-3" />
                      <span>Side-by-Side</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Control Bar */}
            <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-[#2563EB] shadow-2xs">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-[11px] text-slate-400 font-medium">Output Resolution</div>
                  <div className="relative inline-block mt-0.5">
                    <select
                      value={resolutionMode}
                      onChange={(e) => setResolutionMode(e.target.value)}
                      className="appearance-none bg-white border border-slate-200 text-xs font-semibold text-slate-800 py-1.5 pl-3 pr-8 rounded-lg shadow-2xs cursor-pointer focus:outline-none focus:border-[#2563EB]"
                    >
                      <option value="2.5 m/pixel (4×)">2.5 m/pixel (4×)</option>
                      <option value="5.0 m/pixel (2×)">5.0 m/pixel (2×)</option>
                      <option value="1.25 m/pixel (8× - Experimental)">1.25 m/pixel (8×)</option>
                    </select>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3">
                <button
                  onClick={handleEnhanceClick}
                  disabled={isLoading}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#6366F1] to-[#2563EB] hover:from-[#4F46E5] hover:to-[#1D4ED8] text-white text-xs font-bold shadow-sm hover:shadow-md transition-all active:scale-98 disabled:opacity-50 cursor-pointer"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Enhance Image</span>
                  <ArrowRight className="w-3.5 h-3.5 ml-1" />
                </button>

                <button
                  onClick={handleSaveImagery}
                  disabled={isLoading}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#EEF2FF] hover:bg-[#E0E7FF] text-[#2563EB] text-xs font-semibold border border-[#C7D2FE]/60 transition-all active:scale-98 shadow-2xs cursor-pointer"
                >
                  {isSaved ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-600" />
                      <span className="text-emerald-700">Downloaded</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      <span>Save Image</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Recent Activity Section (Only shown when items exist) */}
          {recentItems.length > 0 && (
            <div className="mt-8">
              <div className="flex items-center justify-between mb-3.5">
                <h2 className="text-base font-bold text-[#0F172A]">
                  Recent Activity
                </h2>
                <button
                  onClick={() => setActiveNav('results')}
                  className="text-xs font-semibold text-[#2563EB] hover:text-[#1D4ED8] flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <span>View All</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Dynamic Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {recentItems.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => handleSelectRecent(item)}
                    className="group bg-white rounded-xl border border-slate-200/90 overflow-hidden shadow-2xs hover:shadow-md transition-all cursor-pointer flex flex-col justify-between"
                  >
                    <div className="relative aspect-[16/10] overflow-hidden bg-slate-100">
                      <img
                        src={item.imgUrl}
                        alt={item.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      <div className="absolute top-2 right-2 bg-amber-50/90 text-amber-900 border border-amber-200/60 font-bold text-[10px] px-1.5 py-0.5 rounded shadow-2xs backdrop-blur-xs">
                        {item.badge}
                      </div>
                    </div>

                    <div className="p-3 flex items-center justify-between">
                      <div>
                        <div className="text-xs font-bold text-slate-800 group-hover:text-[#2563EB] transition-colors truncate max-w-[150px]">
                          {item.title}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          {item.timeAgo}
                        </div>
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const a = document.createElement('a');
                          a.href = item.imgUrl;
                          a.download = `${item.id}_enhanced.png`;
                          a.click();
                        }}
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-[#2563EB] hover:bg-blue-50 transition-colors"
                        title="Download image"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
