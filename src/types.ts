export type SpectralBand = 'rgb' | 'nir' | 'ndvi' | 'swir' | 'pan';

export interface SatelliteScene {
  id: string;
  name: string;
  location: string;
  sensor: string;
  acquisitionDate: string;
  cloudCover: string;
  resolution: string;
  coordinates: {
    lat: number;
    lng: number;
    zoom: number;
  };
  bounds: {
    north: string;
    south: string;
    east: string;
    west: string;
  };
  imageUrl: string;
  source: 'preset' | 'upload' | 'hotlink';
  fileSize?: string;
  dimensions?: string;
}

export interface ViewportTransform {
  scale: number;
  offsetX: number;
  offsetY: number;
}
