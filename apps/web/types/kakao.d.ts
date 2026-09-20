/** 카카오맵 JS SDK 중 우리가 쓰는 부분만 선언한다 (공식 타입 패키지 없음). */
declare namespace kakao.maps {
  function load(cb: () => void): void;

  class LatLng {
    constructor(lat: number, lng: number);
    getLat(): number;
    getLng(): number;
  }
  class LatLngBounds {
    getSouthWest(): LatLng;
    getNorthEast(): LatLng;
  }
  class Size {
    constructor(width: number, height: number);
  }
  class Point {
    constructor(x: number, y: number);
  }
  interface MapOptions {
    center: LatLng;
    level?: number;
  }
  class Map {
    constructor(container: HTMLElement, options: MapOptions);
    getBounds(): LatLngBounds;
    getLevel(): number;
    setLevel(level: number, options?: { anchor?: LatLng; animate?: boolean | { duration: number } }): void;
    panTo(latlng: LatLng): void;
    setCenter(latlng: LatLng): void;
    setMinLevel(level: number): void;
    setMaxLevel(level: number): void;
    relayout(): void;
  }
  class MarkerImage {
    constructor(src: string, size: Size, options?: { offset?: Point });
  }
  interface MarkerOptions {
    position: LatLng;
    image?: MarkerImage;
    clickable?: boolean;
    zIndex?: number;
    title?: string;
  }
  class Marker {
    constructor(options: MarkerOptions);
    setMap(map: Map | null): void;
    getPosition(): LatLng;
    setImage(image: MarkerImage): void;
    setZIndex(z: number): void;
  }
  interface CustomOverlayOptions {
    position?: LatLng;
    content: HTMLElement | string;
    xAnchor?: number;
    yAnchor?: number;
    zIndex?: number;
    clickable?: boolean;
  }
  class CustomOverlay {
    constructor(options: CustomOverlayOptions);
    setMap(map: Map | null): void;
    setPosition(position: LatLng): void;
    setContent(content: HTMLElement | string): void;
  }
  interface MarkerClustererOptions {
    map: Map;
    averageCenter?: boolean;
    minLevel?: number;
    minClusterSize?: number;
    gridSize?: number;
    disableClickZoom?: boolean;
    styles?: Record<string, string>[];
    calculator?: number[];
  }
  class MarkerClusterer {
    constructor(options: MarkerClustererOptions);
    addMarkers(markers: Marker[]): void;
    removeMarkers(markers: Marker[]): void;
    clear(): void;
    redraw(): void;
  }
  namespace event {
    function addListener(target: object, type: string, handler: (...args: unknown[]) => void): void;
    function removeListener(target: object, type: string, handler: (...args: unknown[]) => void): void;
  }
}
