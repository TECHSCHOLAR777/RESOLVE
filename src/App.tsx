/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  Wand2,
  Clock,
  Settings,
  Lightbulb,
  Download,
  Upload,
  RotateCcw,
  Maximize2,
  Minimize2,
  ZoomIn,
  ZoomOut,
  Map,
  FileImage,
  Layers,
  Sparkles,
  Link as LinkIcon,
  Check,
  SplitSquareHorizontal,
  Columns,
  Minus,
  Square,
  X,
} from 'lucide-react';

// Default agricultural road corridor scene matching screen.png
const DEFAULT_IMAGE =
  'https://upload.wikimedia.org/wikipedia/commons/thumb/8/82/Agricultural_landscape_in_Belgium_aerial_view.jpg/1280px-Agricultural_landscape_in_Belgium_aerial_view.jpg';

export default function App() {
  const [activeNav, setActiveNav] = useState<'enhance' | 'recent' | 'settings'>('enhance');
  const [viewMode, setViewMode] = useState<'side-by-side' | 'split'>('side-by-side');
  
  // Imagery state
  const [imageName, setImageName] = useState<string>('Agricultural Farmland & Road Corridor Scene');
  const [imageUrl, setImageUrl] = useState<string>(DEFAULT_IMAGE);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [hotlinkInput, setHotlinkInput] = useState<string>('');
  const [showHotlinkInput, setShowHotlinkInput] = useState<boolean>(false);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [splitPos, setSplitPos] = useState<number>(50); // percentage for split slider
  const [isSplitDragging, setIsSplitDragging] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [isSaved, setIsSaved] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const viewerContainerRef = useRef<HTMLDivElement>(null);

  // Handle local file upload
  const handleFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Please upload a valid image file (GeoTIFF, TIFF, PNG, or JPEG).');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      setImageUrl(result);
      setImageName(file.name.replace(/\.[^/.]+$/, ''));
      setZoomLevel(1);
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleHotlinkSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!hotlinkInput.trim()) return;
    setImageUrl(hotlinkInput.trim());
    setImageName('Hotlinked Remote Scene');
    setShowHotlinkInput(false);
    setHotlinkInput('');
    setZoomLevel(1);
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

  // Download enhanced image
  const handleSaveImagery = () => {
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = `${imageName}_enhanced_2.5m.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2500);
  };

  // Handle split slider drag
  const handleSplitMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isSplitDragging) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percent = Math.max(5, Math.min(95, (x / rect.width) * 100));
    setSplitPos(percent);
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#F8FAFC] text-slate-800 antialiased font-sans select-none">
      {/* Top Application Bar */}
      <header className="h-13 bg-white border-b border-slate-200 px-4 flex items-center justify-between z-30 shrink-0">
        {/* Left: Brand Identity */}
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-md bg-[#2563EB] flex items-center justify-center text-white shadow-xs">
            <svg
              className="w-4 h-4 fill-white"
              viewBox="0 0 24 24"
            >
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14.5v-9l6 4.5-6 4.5z" />
            </svg>
          </div>
          <span className="text-base font-bold text-slate-900 tracking-tight">resolve</span>
          <span className="text-slate-300 font-light">|</span>
          <span className="text-xs text-slate-500 font-normal">Satellite Imagery Enhancer</span>
        </div>

        {/* Right: User Avatar & Window Controls */}
        <div className="flex items-center gap-4">
          <div className="w-7 h-7 rounded-full bg-[#EEF2FF] border border-[#C7D2FE] flex items-center justify-center text-[#4F46E5] text-[11px] font-semibold">
            JS
          </div>
          <div className="flex items-center gap-2 text-slate-400 pl-1 border-l border-slate-200">
            <button className="p-1 hover:text-slate-700 hover:bg-slate-100 rounded transition-colors" title="Minimize">
              <Minus className="w-3.5 h-3.5" />
            </button>
            <button className="p-1 hover:text-slate-700 hover:bg-slate-100 rounded transition-colors" title="Maximize">
              <Square className="w-3 h-3" />
            </button>
            <button className="p-1 hover:text-rose-600 hover:bg-slate-100 rounded transition-colors" title="Close">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Layout Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Workspace Navigation Sidebar */}
        <aside className="w-56 bg-white border-r border-slate-200 p-3 flex flex-col justify-between shrink-0">
          <div>
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-3 mb-2">
              Workspace
            </div>

            <nav className="space-y-1">
              <button
                onClick={() => setActiveNav('enhance')}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${
                  activeNav === 'enhance'
                    ? 'bg-[#2563EB] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Wand2 className="w-4 h-4 stroke-[2.2]" />
                <span>Enhance</span>
              </button>

              <button
                onClick={() => setActiveNav('recent')}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                  activeNav === 'recent'
                    ? 'bg-[#2563EB] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Clock className="w-4 h-4 stroke-[1.8]" />
                <span>Recent Tasks</span>
              </button>

              <button
                onClick={() => setActiveNav('settings')}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                  activeNav === 'settings'
                    ? 'bg-[#2563EB] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Settings className="w-4 h-4 stroke-[1.8]" />
                <span>Settings</span>
              </button>
            </nav>
          </div>

          {/* Bottom Pro Tip Box matching screen.png */}
          <div className="bg-[#FEFCE8] border border-[#FEF08A] rounded-xl p-3">
            <div className="flex items-center gap-1.5 text-xs font-bold text-[#1D4ED8]">
              <Lightbulb className="w-3.5 h-3.5 text-[#2563EB]" />
              <span>Pro Tip</span>
            </div>
            <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
              Drag and drop any Sentinel or GeoTIFF image to run high-fidelity super-resolution.
            </p>
          </div>
        </aside>

        {/* Main Content Workspace */}
        <main className="flex-1 flex flex-col p-5 overflow-y-auto bg-[#F8FAFC]">
          {/* Header Row: Title & Actions */}
          <div className="flex items-center justify-between mb-4 shrink-0">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Enhance Satellite Imagery
            </h1>

            <div className="flex items-center gap-2.5">
              {/* View Toggle */}
              <div className="inline-flex bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                <button
                  onClick={() => setViewMode('side-by-side')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                    viewMode === 'side-by-side'
                      ? 'bg-[#2563EB] text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Columns className="w-3.5 h-3.5" />
                  <span>Side-by-Side</span>
                </button>

                <button
                  onClick={() => setViewMode('split')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                    viewMode === 'split'
                      ? 'bg-[#2563EB] text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <SplitSquareHorizontal className="w-3.5 h-3.5" />
                  <span>Split Slider</span>
                </button>
              </div>

              {/* Export GeoTIFF Button */}
              <button
                onClick={handleSaveImagery}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-semibold shadow-xs transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export GeoTIFF</span>
              </button>
            </div>
          </div>

          {/* Two-Column Grid: Left Controls & Right Viewer */}
          <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 items-start min-h-0">
            {/* Left Column (4 cols / ~33%) */}
            <div className="lg:col-span-4 space-y-4">
              {/* 1. Source Imagery Card */}
              <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 uppercase font-mono tracking-wider">
                    <FileImage className="w-3.5 h-3.5 text-[#2563EB]" />
                    <span>Source Imagery</span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded">
                    Max 250 MB
                  </span>
                </div>

                {/* Drop Area */}
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-5 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                    isDragging
                      ? 'border-[#2563EB] bg-blue-50/40'
                      : 'border-amber-300/80 bg-[#FFFDF5] hover:bg-amber-50/30'
                  }`}
                >
                  <div className="w-9 h-9 rounded-full bg-blue-50 text-[#2563EB] flex items-center justify-center mb-2">
                    <Upload className="w-4 h-4" />
                  </div>
                  <div className="text-xs font-semibold text-slate-800">
                    Drop satellite file or click to browse
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    Supports GeoTIFF, TIFF, PNG, or JPEG
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      fileInputRef.current?.click();
                    }}
                    className="mt-3 px-3 py-1 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium rounded-lg border border-slate-200 shadow-2xs transition-colors"
                  >
                    Browse Local File
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handleFile(e.target.files[0]);
                      }
                    }}
                    className="hidden"
                  />
                </div>

                {/* Hotlink Image URL Accordion / Button */}
                <div className="mt-2.5 pt-2.5 border-t border-slate-100">
                  {!showHotlinkInput ? (
                    <button
                      onClick={() => setShowHotlinkInput(true)}
                      className="text-[11px] text-[#2563EB] hover:text-[#1D4ED8] flex items-center gap-1 font-medium transition-colors"
                    >
                      <LinkIcon className="w-3 h-3" />
                      <span>Or paste image URL (hotlink)</span>
                    </button>
                  ) : (
                    <form onSubmit={handleHotlinkSubmit} className="space-y-1.5">
                      <div className="flex gap-1.5">
                        <input
                          type="url"
                          placeholder="https://.../satellite.jpg"
                          value={hotlinkInput}
                          onChange={(e) => setHotlinkInput(e.target.value)}
                          className="flex-1 text-xs font-mono px-2 py-1 border border-slate-300 rounded focus:outline-none focus:border-[#2563EB]"
                        />
                        <button
                          type="submit"
                          className="px-2.5 py-1 text-xs font-semibold bg-[#2563EB] text-white rounded hover:bg-[#1D4ED8]"
                        >
                          Load
                        </button>
                      </div>
                      <div className="flex justify-between items-center text-[10px] text-slate-400">
                        <span>Direct image link</span>
                        <button
                          type="button"
                          onClick={() => setShowHotlinkInput(false)}
                          className="text-slate-500 hover:text-slate-700"
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              </div>

              {/* 2. How It Works Card matching screen.png */}
              <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 uppercase font-mono tracking-wider">
                    <Layers className="w-3.5 h-3.5 text-[#2563EB]" />
                    <span>How It Works</span>
                  </div>
                  <span className="text-[10px] font-mono text-[#2563EB] bg-blue-50 border border-blue-100 px-2 py-0.5 rounded font-medium">
                    5 Stages
                  </span>
                </div>

                <div className="space-y-2">
                  {/* Stage 1 */}
                  <div className="border border-slate-200/90 rounded-lg p-2.5 bg-white flex items-start gap-2.5">
                    <div className="w-5 h-5 rounded-full bg-[#2563EB] text-white text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                      1
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900 leading-tight">
                        Input Satellite Data
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                        Reads original 10m bands alongside reference context for preprocessing.
                      </div>
                    </div>
                  </div>

                  {/* Stage 2 */}
                  <div className="border border-slate-200/90 rounded-lg p-2.5 bg-white flex items-start gap-2.5">
                    <div className="w-5 h-5 rounded-full bg-[#2563EB] text-white text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                      2
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900 leading-tight">
                        Detail & Texture Enhancement
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                        Restores crisp boundaries, roadways, vegetation, and natural contours.
                      </div>
                    </div>
                  </div>

                  {/* Stage 3 */}
                  <div className="border border-slate-200/90 rounded-lg p-2.5 bg-white flex items-start gap-2.5">
                    <div className="w-5 h-5 rounded-full bg-[#2563EB] text-white text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                      3
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900 leading-tight">
                        Precision Measurement Lock
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                        Locks enhancement so pixel values strictly adhere to authentic physical sensor data.
                      </div>
                    </div>
                  </div>

                  {/* Stage 4 */}
                  <div className="border border-slate-200/90 rounded-lg p-2.5 bg-white flex items-start gap-2.5">
                    <div className="w-5 h-5 rounded-full bg-[#2563EB] text-white text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                      4
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900 leading-tight">
                        Trust & Confidence Verification
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                        Validates per-pixel certainty and filters out hallucinations and noise artifacts.
                      </div>
                    </div>
                  </div>

                  {/* Stage 5 (Active Highlighted) */}
                  <div className="border border-blue-200 rounded-lg p-2.5 bg-blue-50/50 flex items-start gap-2.5">
                    <div className="w-5 h-5 rounded-full bg-[#2563EB] text-white text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                      5
                    </div>
                    <div>
                      <div className="text-xs font-bold text-[#1D4ED8] leading-tight">
                        High-Resolution Output
                      </div>
                      <div className="text-[11px] text-blue-900/70 mt-0.5 leading-snug">
                        Produces 2.5m imagery ready for land-cover classification, boundary maps, and GeoTIFF export.
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column (8 cols / ~67%): High-Resolution Interactive Viewer */}
            <div
              ref={viewerContainerRef}
              className="lg:col-span-8 bg-white rounded-xl border border-slate-200 p-4 shadow-2xs flex flex-col"
            >
              {/* Card Title & Viewport Controls */}
              <div className="flex items-center justify-between mb-3 shrink-0">
                <div className="flex items-center gap-2">
                  <Map className="w-4 h-4 text-[#2563EB]" />
                  <span className="text-xs font-bold text-slate-900 truncate max-w-md">
                    {imageName}
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setZoomLevel((prev) => (prev >= 2 ? 1 : prev + 0.5))}
                    title="Zoom Level"
                    className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors"
                  >
                    <ZoomIn className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => setZoomLevel(1)}
                    title="Reset Zoom"
                    className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={toggleFullscreen}
                    title="Toggle Fullscreen"
                    className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors"
                  >
                    {isFullscreen ? (
                      <Minimize2 className="w-3.5 h-3.5" />
                    ) : (
                      <Maximize2 className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>

              {/* Imagery Display Viewport */}
              <div className="relative w-full rounded-lg overflow-hidden bg-[#10141F] min-h-[480px] lg:min-h-[520px] flex items-center justify-center select-none">
                {viewMode === 'side-by-side' ? (
                  /* Side-by-Side Dual Viewports */
                  <div className="w-full h-full grid grid-cols-2 gap-2 p-2">
                    {/* Left: Original Input (10m GSD) */}
                    <div className="relative rounded overflow-hidden bg-[#0D111A] flex flex-col justify-between p-3 border border-slate-800/80">
                      {/* Top Badge */}
                      <div className="z-10 self-start">
                        <div className="bg-white/95 text-slate-900 text-xs font-semibold px-2.5 py-1 rounded-md shadow-xs flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-[#F59E0B]" />
                          <span>Original Input (10m GSD)</span>
                        </div>
                      </div>

                      {/* Center Image: Simulated native 10m resolution (blur/pixelate) */}
                      <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
                        <img
                          src={imageUrl}
                          alt="Original Satellite Input"
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover pointer-events-none transition-transform duration-200"
                          style={{
                            transform: `scale(${zoomLevel})`,
                            filter: 'blur(1.6px) brightness(96%) contrast(92%)',
                          }}
                        />
                      </div>

                      {/* Bottom Badge */}
                      <div className="z-10 self-start">
                        <div className="bg-black/80 text-white font-mono text-[10px] px-2 py-0.5 rounded backdrop-blur-xs">
                          Sentinel-2 L2A
                        </div>
                      </div>
                    </div>

                    {/* Right: Enhanced Output (2.5m resolve) */}
                    <div className="relative rounded overflow-hidden bg-[#0D111A] flex flex-col justify-between p-3 border border-slate-800/80">
                      {/* Top Badge */}
                      <div className="z-10 self-start">
                        <div className="bg-[#2563EB] text-white text-xs font-semibold px-2.5 py-1 rounded-md shadow-xs flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 stroke-[2.2]" />
                          <span>Enhanced Output (2.5m resolve)</span>
                        </div>
                      </div>

                      {/* Center Image: Super-resolved crisp detail */}
                      <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
                        <img
                          src={imageUrl}
                          alt="Enhanced Satellite Output"
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover pointer-events-none transition-transform duration-200"
                          style={{
                            transform: `scale(${zoomLevel})`,
                            filter: 'contrast(108%) saturate(106%) sharpness(1.5)',
                          }}
                        />
                      </div>

                      {/* Bottom Badges */}
                      <div className="z-10 flex items-center justify-between w-full">
                        <div className="bg-black/80 text-white font-mono text-[10px] px-2 py-0.5 rounded backdrop-blur-xs">
                          4-Band Multispectral
                        </div>
                        <div className="bg-black/80 text-[#C7D2FE] font-mono text-[9px] px-2 py-0.5 rounded backdrop-blur-xs">
                          Resolution: 2.5m/pixel
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Split Slider Mode */
                  <div
                    onMouseDown={() => setIsSplitDragging(true)}
                    onMouseUp={() => setIsSplitDragging(false)}
                    onMouseMove={handleSplitMouseMove}
                    className="relative w-full h-full overflow-hidden cursor-ew-resize min-h-[480px] lg:min-h-[520px]"
                  >
                    {/* Background: Enhanced Image */}
                    <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
                      <img
                        src={imageUrl}
                        alt="Enhanced Satellite View"
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover pointer-events-none"
                        style={{
                          transform: `scale(${zoomLevel})`,
                          filter: 'contrast(108%) saturate(106%)',
                        }}
                      />
                    </div>

                    {/* Top Right Enhanced Badge */}
                    <div className="absolute top-3 right-3 z-10">
                      <div className="bg-[#2563EB] text-white text-xs font-semibold px-2.5 py-1 rounded-md shadow-xs flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Enhanced (2.5m)</span>
                      </div>
                    </div>

                    {/* Foreground Clipped: Original Image */}
                    <div
                      className="absolute inset-0 overflow-hidden"
                      style={{ clipPath: `inset(0 ${100 - splitPos}% 0 0)` }}
                    >
                      <img
                        src={imageUrl}
                        alt="Original Satellite View"
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover pointer-events-none"
                        style={{
                          transform: `scale(${zoomLevel})`,
                          filter: 'blur(1.6px) brightness(96%) contrast(92%)',
                        }}
                      />

                      {/* Top Left Original Badge */}
                      <div className="absolute top-3 left-3 z-10">
                        <div className="bg-white/95 text-slate-900 text-xs font-semibold px-2.5 py-1 rounded-md shadow-xs flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-[#F59E0B]" />
                          <span>Original Input (10m)</span>
                        </div>
                      </div>
                    </div>

                    {/* Draggable Divider Handle */}
                    <div
                      className="absolute top-0 bottom-0 w-0.5 bg-white shadow-xl z-20 pointer-events-none"
                      style={{ left: `${splitPos}%` }}
                    >
                      <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-7 h-7 rounded-full bg-white text-slate-700 shadow-lg flex items-center justify-center border border-slate-200">
                        <SplitSquareHorizontal className="w-4 h-4 text-[#2563EB]" />
                      </div>
                    </div>

                    {/* Bottom Info Badges */}
                    <div className="absolute bottom-3 left-3 z-10">
                      <div className="bg-black/80 text-white font-mono text-[10px] px-2 py-0.5 rounded backdrop-blur-xs">
                        Sentinel-2 L2A
                      </div>
                    </div>
                    <div className="absolute bottom-3 right-3 z-10">
                      <div className="bg-black/80 text-white font-mono text-[10px] px-2 py-0.5 rounded backdrop-blur-xs">
                        4-Band Multispectral (2.5m)
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Bottom Action Button matching screen.png */}
              <div className="mt-3.5 flex items-center gap-3">
                <button
                  onClick={handleSaveImagery}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-semibold shadow-xs transition-colors"
                >
                  {isSaved ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-300" />
                      <span>Saved to Downloads</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-3.5 h-3.5" />
                      <span>Save Imagery</span>
                    </>
                  )}
                </button>

                <span className="text-[11px] text-slate-500">
                  Ready for GIS land-cover classification and vectorization
                </span>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
