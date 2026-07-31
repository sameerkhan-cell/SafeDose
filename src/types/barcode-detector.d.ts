// Minimal TypeScript declarations for the BarcodeDetector Web API (Shape Detection API).
// Native in Chrome/Edge on Android & Desktop since Chrome 83; not available in Safari/Firefox.
// Full spec: https://wicg.github.io/shape-detection-api/#barcode-detection-api

interface DetectedBarcode {
  readonly boundingBox: DOMRectReadOnly;
  readonly rawValue: string;
  readonly format: BarcodeFormat;
  readonly cornerPoints: ReadonlyArray<{ x: number; y: number }>;
}

type BarcodeFormat =
  | "aztec"
  | "code_128"
  | "code_39"
  | "code_93"
  | "codabar"
  | "data_matrix"
  | "ean_13"
  | "ean_8"
  | "itf"
  | "pdf417"
  | "qr_code"
  | "upc_a"
  | "upc_e"
  | "unknown";

interface BarcodeDetectorOptions {
  formats?: BarcodeFormat[];
}

declare class BarcodeDetector {
  constructor(options?: BarcodeDetectorOptions);
  static getSupportedFormats(): Promise<BarcodeFormat[]>;
  detect(image: ImageBitmapSource | HTMLVideoElement | HTMLCanvasElement | HTMLImageElement): Promise<DetectedBarcode[]>;
}
