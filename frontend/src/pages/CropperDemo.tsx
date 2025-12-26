import { useState } from 'react';
import { PreviewLayoutWithCropper } from '../components/cropper';
import { CropCoordinates, NormalizedCropCoordinates } from '../components/cropper/types';
import { TemplateType } from '../components/TemplateSelector';

// Simple colored placeholder image
const SAMPLE_IMAGE = 'data:image/svg+xml,' + encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080">
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#667eea"/>
      <stop offset="100%" stop-color="#f093fb"/>
    </linearGradient>
  </defs>
  <rect fill="url(#g)" width="1920" height="1080"/>
  <text x="960" y="500" text-anchor="middle" font-size="80" fill="white" opacity="0.5">DRAG TO CROP</text>
  <text x="960" y="600" text-anchor="middle" font-size="40" fill="white" opacity="0.3">1920 x 1080</text>
</svg>
`);

const CropperDemo = () => {
  const [template, setTemplate] = useState<TemplateType>('1-frame');
  const [coordinates, setCoordinates] = useState<CropCoordinates[]>([]);
  const [normalizedCoords, setNormalizedCoords] = useState<NormalizedCropCoordinates[]>([]);

  return (
    <div className="max-w-7xl mx-auto p-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">
          PreviewLayout Demo
        </h1>
        <p className="text-gray-400">
          Drag the crop rectangles on the left to see live updates in the 9:16 preview on the right.
        </p>
      </div>

      {/* Main cropper with preview */}
      <div className="bg-gray-800 rounded-xl p-6 mb-8">
        <PreviewLayoutWithCropper
          src={SAMPLE_IMAGE}
          srcType="image"
          initialTemplate="1-frame"
          previewWidth={270}
          onTemplateChange={(t) => {
            console.log('Template changed:', t);
            setTemplate(t);
          }}
          onCropChange={(c) => {
            console.log('Crop changed:', c);
            setCoordinates(c);
          }}
          onNormalizedCropChange={(n) => {
            console.log('Normalized:', n);
            setNormalizedCoords(n);
          }}
        />
      </div>

      {/* Current state display */}
      <div className="bg-gray-800 rounded-xl p-6 mb-8">
        <h2 className="text-lg font-semibold text-white mb-4">Current State</h2>
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <span className="text-gray-400">Template:</span>
            <span className="text-white ml-2">{template}</span>
          </div>
          <div>
            <span className="text-gray-400">Crop areas:</span>
            <span className="text-white ml-2">{coordinates.length}</span>
          </div>
          <div>
            <span className="text-gray-400">Normalized:</span>
            <span className="text-white ml-2">{normalizedCoords.length}</span>
          </div>
        </div>
      </div>

      {/* Debug output */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-gray-800 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4">
            Raw Coordinates (pixels)
          </h2>
          <pre className="bg-gray-900 rounded-lg p-4 text-sm text-gray-300 overflow-auto max-h-64">
            {JSON.stringify(coordinates, null, 2) || '[]'}
          </pre>
        </div>

        <div className="bg-gray-800 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4">
            Normalized Coordinates (0-1)
          </h2>
          <pre className="bg-gray-900 rounded-lg p-4 text-sm text-gray-300 overflow-auto max-h-64">
            {JSON.stringify(normalizedCoords, null, 2) || '[]'}
          </pre>
        </div>
      </div>
    </div>
  );
};

export default CropperDemo;
