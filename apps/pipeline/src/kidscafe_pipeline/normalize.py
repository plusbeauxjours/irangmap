"""좌표·주소 정규화.

인허가 데이터의 CRD_INFO_X/Y는 메타데이터상
"보정계수 안 들어간 Bessel 중부원점 TM(EPSG:5174)".
2026-09-19 VWorld 지오코딩 40곳과 비교해 **5174로 확정**(중앙값 13m; 5181은 ~318m,
5173은 시도가 틀림). 상세: docs/spike-data.md. src_crs는 테스트·재검증용으로만 바꾼다.
"""

from functools import lru_cache

from pyproj import Transformer

DEFAULT_SRC_CRS = "EPSG:5174"
# 대한민국 대략 범위(제주·울릉도 포함). 변환 결과 sanity check용.
KOREA_BBOX = (124.5, 33.0, 132.0, 38.7)


@lru_cache
def _transformer(src_crs: str) -> Transformer:
    return Transformer.from_crs(src_crs, "EPSG:4326", always_xy=True)


def tm_to_wgs84(
    x: float, y: float, src_crs: str = DEFAULT_SRC_CRS
) -> tuple[float, float]:
    """(X, Y) → (lon, lat)."""
    lon, lat = _transformer(src_crs).transform(x, y)
    return float(lon), float(lat)


def in_korea(lon: float, lat: float) -> bool:
    w, s, e, n = KOREA_BBOX
    return w <= lon <= e and s <= lat <= n


def parse_coord(
    item: dict, x_key: str = "CRD_INFO_X", y_key: str = "CRD_INFO_Y"
) -> tuple[float, float] | None:
    """인허가 레코드의 좌표 문자열을 (lon, lat)로. 결측·비수치·국외는 None."""
    try:
        x, y = (
            float(str(item.get(x_key, "")).strip()),
            float(str(item.get(y_key, "")).strip()),
        )
    except ValueError:
        return None
    lon, lat = tm_to_wgs84(x, y)
    return (lon, lat) if in_korea(lon, lat) else None
