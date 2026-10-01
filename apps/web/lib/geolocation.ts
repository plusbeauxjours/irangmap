// 첫 진입 시 현재 위치를 한 번 묻는다. 거부·실패·시간 초과·국외 위치면 null(→ 전국 뷰 유지).
export function getStartPosition(): Promise<{ lat: number; lon: number } | null> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const { latitude: lat, longitude: lon } = coords;
        const inKorea = lat >= 33 && lat <= 38.7 && lon >= 124.5 && lon <= 132;
        resolve(inKorea ? { lat, lon } : null);
      },
      () => resolve(null),
      { timeout: 8000, maximumAge: 5 * 60 * 1000 },
    );
  });
}
