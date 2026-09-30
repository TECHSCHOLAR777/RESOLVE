import React, { useState, useRef } from 'react';
import { SatelliteScene } from '../types';
import { SAMPLE_SCENES } from '../data/sampleScenes';
import { Upload, Link as LinkIcon, Image as ImageIcon, X, CheckCircle, AlertCircle } from 'lucide-react';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectScene: (scene: SatelliteScene) => void;
}

export const UploadModal: React.FC<UploadModalProps> = ({
  isOpen,
  onClose,
  onSelectScene,
}) => {
  const [activeTab, setActiveTab] = useState<'file' | 'url' | 'samples'>('file');
  const [urlInput, setUrlInput] = useState('');
  const [urlName, setUrlName] = useState('');
  const [urlError, setUrlError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileProcess = (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file (PNG, JPEG, WebP, TIFF).');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      const img = new Image();
      img.onload = () => {
        const customScene: SatelliteScene = {
          id: `upload-${Date.now()}`,
          name: file.name.replace(/\.[^/.]+$/, ''),
          location: 'Custom Ortho Surface',
          sensor: 'User Raster Upload (Local)',
          acquisitionDate: new Date().toISOString().split('T')[0],
          cloudCover: '< 1%',
          resolution: '1.0m / px (Native)',
          coordinates: {
            lat: 34.0522,
            lng: -118.2437,
            zoom: 12,
          },
          bounds: {
            north: "34°08'10\" N",
            south: "33°58'20\" N",
            east: "118°10'00\" W",
            west: "118°25'40\" W",
          },
          imageUrl: result,
          source: 'upload',
          dimensions: `${img.width} × ${img.height}`,
          fileSize: `${(file.size / (1024 * 1024)).toFixed(2)} MB`,
        };

        onSelectScene(customScene);
        onClose();
      };
      img.src = result;
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileProcess(e.dataTransfer.files[0]);
    }
  };

  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput.trim()) return;

    setUrlError(null);
    const testImg = new Image();
    testImg.onload = () => {
      const customScene: SatelliteScene = {
        id: `hotlink-${Date.now()}`,
        name: urlName.trim() || 'Hotlinked Raster Source',
        location: 'Remote Earth Observation Stream',
        sensor: 'Remote Sensor / Web Hotlink',
        acquisitionDate: new Date().toISOString().split('T')[0],
        cloudCover: '0.00%',
        resolution: 'Standard Resolution',
        coordinates: {
          lat: 27.9881,
          lng: 86.9250,
          zoom: 12,
        },
        bounds: {
          north: "28°05'00\" N",
          south: "27°50'00\" N",
          east: "87°00'00\" E",
          west: "86°45'00\" E",
        },
        imageUrl: urlInput.trim(),
        source: 'hotlink',
        dimensions: `${testImg.width} × ${testImg.height}`,
      };

      onSelectScene(customScene);
      onClose();
    };
    testImg.onerror = () => {
      setUrlError('Could not load image from this URL. Please ensure it allows cross-origin access or direct linking.');
    };
    testImg.src = urlInput.trim();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0D2E68]/30 backdrop-blur-xs">
      <div className="bg-[#FFFFFF] border border-[#0D2E68]/12 rounded-xl w-full max-w-xl shadow-[0_16px_36px_-6px_rgba(13,46,104,0.16)] overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#0D2E68]/8 bg-[#FBFBF7]">
          <div>
            <h2 className="text-base font-semibold text-[#0D2E68] font-display">
              Load & Inspect Imagery
            </h2>
            <p className="text-xs text-[#5A6070] mt-0.5">
              Upload local raster frames, hotlink external image URLs, or select satellite benchmarks
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded hover:bg-[#F9ECC2]/50 text-[#5A6070] hover:text-[#0D2E68] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-[#0D2E68]/8 bg-[#F1F3FF] p-1.5 gap-1.5 px-5">
          <button
            onClick={() => setActiveTab('file')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded transition-all ${
              activeTab === 'file'
                ? 'bg-white text-[#1254EB] shadow-xs'
                : 'text-[#434655] hover:text-[#0D2E68]'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload Image</span>
          </button>

          <button
            onClick={() => setActiveTab('url')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded transition-all ${
              activeTab === 'url'
                ? 'bg-white text-[#1254EB] shadow-xs'
                : 'text-[#434655] hover:text-[#0D2E68]'
            }`}
          >
            <LinkIcon className="w-3.5 h-3.5" />
            <span>Hotlink URL</span>
          </button>

          <button
            onClick={() => setActiveTab('samples')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded transition-all ${
              activeTab === 'samples'
                ? 'bg-white text-[#1254EB] shadow-xs'
                : 'text-[#434655] hover:text-[#0D2E68]'
            }`}
          >
            <ImageIcon className="w-3.5 h-3.5" />
            <span>Sample Satellite Scenes</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5">
          {activeTab === 'file' && (
            <div className="space-y-4">
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-lg p-8 flex flex-col items-center justify-center cursor-pointer transition-all ${
                  isDragging
                    ? 'border-[#1254EB] bg-[#1254EB]/5'
                    : 'border-[#0D2E68]/15 hover:border-[#1254EB] bg-[#FBFBF7] hover:bg-[#F1F3FF]'
                }`}
              >
                <div className="w-12 h-12 rounded-full bg-[#1254EB]/10 flex items-center justify-center text-[#1254EB] mb-3">
                  <Upload className="w-6 h-6 stroke-[1.8]" />
                </div>
                <div className="text-sm font-semibold text-[#0D2E68] text-center">
                  Drag and drop satellite or aerial image here
                </div>
                <div className="text-xs text-[#5A6070] mt-1 text-center">
                  or <span className="text-[#1254EB] underline font-medium">browse local files</span> from your computer
                </div>
                <div className="text-[11px] font-mono text-[#737687] mt-3 bg-white px-2.5 py-1 rounded border border-[#0D2E68]/8">
                  PNG · JPEG · WEBP · TIFF
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleFileProcess(e.target.files[0]);
                    }
                  }}
                  className="hidden"
                />
              </div>
            </div>
          )}

          {activeTab === 'url' && (
            <form onSubmit={handleUrlSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-[#0D2E68] mb-1">
                  Image Direct URL (Hotlink)
                </label>
                <input
                  type="url"
                  placeholder="https://images.example.com/satellite-ortho.jpg"
                  value={urlInput}
                  onChange={(e) => {
                    setUrlInput(e.target.value);
                    setUrlError(null);
                  }}
                  required
                  className="w-full text-xs font-mono px-3 py-2 border border-[#0D2E68]/15 rounded focus:outline-none focus:border-[#1254EB] focus:ring-1 focus:ring-[#1254EB] bg-[#FBFBF7]"
                />
                <p className="text-[11px] text-[#5A6070] mt-1">
                  You can paste any hotlinked public image URL from Wikimedia, USGS, ESA, or your CDN.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#0D2E68] mb-1">
                  Scene Title (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Amazon Basin Deforestation Track"
                  value={urlName}
                  onChange={(e) => setUrlName(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-[#0D2E68]/15 rounded focus:outline-none focus:border-[#1254EB] bg-[#FBFBF7]"
                />
              </div>

              {urlError && (
                <div className="flex items-center gap-2 p-2.5 bg-rose-50 border border-rose-200 rounded text-xs text-rose-700">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{urlError}</span>
                </div>
              )}

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={!urlInput.trim()}
                  className="px-4 py-2 text-xs font-semibold text-white bg-[#1254EB] hover:bg-[#003EBB] disabled:opacity-50 rounded shadow-sm transition-colors"
                >
                  Load Image URL
                </button>
              </div>
            </form>
          )}

          {activeTab === 'samples' && (
            <div className="grid grid-cols-2 gap-2.5 max-h-[320px] overflow-y-auto pr-1">
              {SAMPLE_SCENES.map((scene) => (
                <div
                  key={scene.id}
                  onClick={() => {
                    onSelectScene(scene);
                    onClose();
                  }}
                  className="border border-[#0D2E68]/10 hover:border-[#1254EB] rounded-lg p-2.5 bg-[#FBFBF7] hover:bg-[#F1F3FF] cursor-pointer transition-all group"
                >
                  <div className="h-24 w-full rounded overflow-hidden mb-2 bg-[#DDE2F5] relative">
                    <img
                      src={scene.imageUrl}
                      alt={scene.name}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute top-1.5 right-1.5 bg-[#0D2E68]/80 text-white font-mono text-[9px] px-1.5 py-0.5 rounded">
                      {scene.resolution}
                    </div>
                  </div>
                  <div className="text-xs font-semibold text-[#0D2E68] truncate">
                    {scene.name}
                  </div>
                  <div className="text-[11px] text-[#5A6070] truncate mt-0.5">
                    {scene.location}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Modal Footer info */}
        <div className="px-5 py-3 bg-[#FBFBF7] border-t border-[#0D2E68]/8 flex items-center justify-between text-xs text-[#5A6070]">
          <div className="flex items-center gap-1.5">
            <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
            <span>High-dynamic range raster viewer active</span>
          </div>
          <button
            onClick={onClose}
            className="text-xs text-[#5A6070] hover:text-[#0D2E68]"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
