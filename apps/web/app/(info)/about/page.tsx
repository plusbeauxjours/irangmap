import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "소개·데이터 출처 — 아이랑맵",
  description: "아이랑맵이 어떤 데이터를 어디서 가져와 어떻게 보여주는지, 정보를 볼 때 알아둘 점",
};

const SOURCES: { name: string; provider: string; fields: string; cycle: string }[] = [
  { name: "전국어린이놀이시설정보", provider: "행정안전부 · 공공데이터포털", fields: "놀이제공영업소(키즈카페) 위치, 실내·실외, 공공·민간", cycle: "매일" },
  { name: "문화_테마파크업(기타) 인허가", provider: "행정안전부 · 공공데이터포털", fields: "유기기구 설치 업소의 영업상태·주소·전화", cycle: "매일" },
  { name: "식품_휴게음식점 인허가", provider: "행정안전부 · 공공데이터포털", fields: "업태 '키즈카페'인 휴게음식점의 영업상태·주소", cycle: "매주" },
  { name: "서울형 키즈카페 이용안내", provider: "서울특별시 우리동네키움포털", fields: "이용 연령·아동 요금·보호자·양말 규정·운영시간·예약 링크", cycle: "매일" },
  { name: "브랜드 공식 사이트", provider: "각 프랜차이즈 운영사(바운스·뽀로로파크 등)", fields: "매장별 요금·이용 기준·영업시간, 확인일 표기", cycle: "월 1회" },
];

export default function AboutPage() {
  return (
    <article>
      <h1>아이랑맵 소개</h1>
      <p>
        아이랑맵은 전국의 키즈카페를 한 지도에 모으고, 부모가 가장 먼저 확인하는 <strong>이용 연령·아동 요금·보호자 요금·양말 규정·예약·주차</strong>를
        후기 대신 <strong>출처와 확인일이 붙은 정보</strong>로 보여주는 서비스입니다. 위치는 정부 공공데이터에서, 이용 정보는 운영 주체가 직접 공개한 자료에서만
        가져옵니다.
      </p>

      <h2>데이터 출처</h2>
      <table>
        <thead>
          <tr>
            <th>데이터</th>
            <th>제공</th>
            <th>쓰는 항목</th>
            <th>갱신</th>
          </tr>
        </thead>
        <tbody>
          {SOURCES.map((s) => (
            <tr key={s.name}>
              <td>{s.name}</td>
              <td>{s.provider}</td>
              <td>{s.fields}</td>
              <td>{s.cycle}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>
        지도 배경은 <a href="https://apis.map.kakao.com/" target="_blank" rel="noopener noreferrer">카카오맵</a>이며, 대체 지도와 주소 좌표 변환에는
        국토교통부 <a href="https://www.vworld.kr/" target="_blank" rel="noopener noreferrer">브이월드</a>를 사용합니다. 공공데이터는{" "}
        <a href="https://www.data.go.kr/" target="_blank" rel="noopener noreferrer">공공데이터포털</a> 이용약관에 따라 이용하며, 원본의 저작권과 출처 표시 의무를
        지킵니다.
      </p>

      <h2>정보를 다루는 원칙</h2>
      <ul>
        <li>이용 정보 값마다 출처와 확인일을 표시합니다. 확인되지 않은 항목은 임의로 채우지 않고 &ldquo;미확인&rdquo;으로 둡니다.</li>
        <li>브랜드 공통 안내만 있는 매장은 &ldquo;브랜드 공통 안내&rdquo;로 구분해, 매장별 실제 요금과 다를 수 있음을 알립니다.</li>
        <li>외부 리뷰·사진·평점은 저장하지 않습니다. 네이버·카카오·구글·인스타그램은 검색 링크로만 연결합니다.</li>
        <li>수집은 각 사이트의 robots.txt와 요청 간격 규칙을 지키며, 로그인이 필요한 정보는 가져오지 않습니다.</li>
      </ul>

      <h2>이용 전 알아둘 점</h2>
      <ul>
        <li>모든 정보는 참고용입니다. 요금·운영시간·이용 규정은 예고 없이 바뀔 수 있으니 방문 전 업소나 예약 페이지에서 다시 확인해 주세요.</li>
        <li>예약·결제는 아이랑맵이 아니라 각 운영 주체의 페이지에서 이루어집니다.</li>
        <li>인허가 데이터의 폐업 반영이 늦어 이미 문을 닫은 곳이 남아 있을 수 있습니다.</li>
      </ul>

      <h2>정보 수정·삭제 요청과 제보</h2>
      <p>
        잘못된 정보, 폐업, 사업자 본인의 정보 수정·삭제 요청은{" "}
        <a href="mailto:plusbeauxjours@gmail.com">plusbeauxjours@gmail.com</a>으로 보내 주세요. 업소명과 주소, 수정할 내용을 적어 주시면 확인 후 반영합니다.
        사업자 확인과 이용자 제보 기능은 준비 중입니다.
      </p>
    </article>
  );
}
