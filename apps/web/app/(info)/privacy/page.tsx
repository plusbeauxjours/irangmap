import type { Metadata } from "next";

export const metadata: Metadata = { title: "개인정보처리방침 — 아이랑맵" };

export default function PrivacyPage() {
  return (
    <article>
      <h1>개인정보처리방침</h1>
      <p className="text-sm text-neutral-500">시행일 2026년 9월 21일</p>

      <h2>1. 수집하는 개인정보</h2>
      <p>
        아이랑맵은 현재 회원가입·로그인·입력 폼이 없으며, <strong>이용자의 개인정보를 직접 수집하지 않습니다.</strong> 검색어와 지도 조작은 이용자의 브라우저 안에서만
        처리되고 서버로 전송되지 않습니다.
      </p>
      <p>서비스 운영을 위해 자동으로 생성되는 정보는 다음과 같습니다.</p>
      <ul>
        <li>접속 기록: 호스팅 사업자(Vercel Inc.)의 서버가 접속 IP 주소, 브라우저 정보, 접속 시각을 보안과 장애 대응 목적으로 기록합니다. 보존 기간은 Vercel의 정책에 따릅니다.</li>
        <li>성능 진단: 주소에 <code>?perf=1</code>을 붙여 접속한 경우에만 페이지 로딩 시간 측정값과 브라우저 종류가 서버 로그로 전송됩니다. 개인을 식별하는 정보는 포함하지 않습니다.</li>
      </ul>

      <h2>2. 쿠키</h2>
      <p>아이랑맵은 자체 쿠키를 사용하지 않습니다. 아래 외부 서비스가 자체 정책에 따라 쿠키를 설정할 수 있습니다.</p>

      <h2>3. 외부 서비스로 전송되는 정보</h2>
      <p>페이지를 열면 브라우저가 다음 서비스에 직접 접속하며, 이때 IP 주소 등 접속 정보가 해당 사업자에게 전달됩니다.</p>
      <ul>
        <li>
          카카오맵 API(카카오): 지도 표시 —{" "}
          <a href="https://www.kakao.com/policy/privacy" target="_blank" rel="noopener noreferrer">카카오 개인정보처리방침</a>
        </li>
        <li>
          jsDelivr CDN: 글꼴(Pretendard) 제공 —{" "}
          <a href="https://www.jsdelivr.com/terms/privacy-policy" target="_blank" rel="noopener noreferrer">jsDelivr 개인정보정책</a>
        </li>
        <li>
          Vercel Inc.: 웹 호스팅 —{" "}
          <a href="https://vercel.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer">Vercel 개인정보정책</a>
        </li>
      </ul>
      <p>외부 링크(네이버·구글·인스타그램·각 업소 예약 페이지)를 누르면 해당 사이트의 개인정보 정책이 적용됩니다.</p>

      <h2>4. 앞으로 도입할 기능</h2>
      <p>
        이용자 제보와 사업자 확인 기능을 도입할 때는 수집 항목(예: 이메일 주소), 목적, 보존 기간을 이 방침에 먼저 반영하고 시행일 전에 공지합니다.
      </p>

      <h2>5. 이용자의 권리</h2>
      <p>이용자는 자신에 관한 정보의 열람·정정·삭제를 요청할 수 있습니다. 현재는 수집하는 개인정보가 없어 요청 대상이 없으나, 문의는 아래 연락처로 받습니다.</p>

      <h2>6. 개인정보 보호책임자</h2>
      <p>
        아이랑맵 운영자 · <a href="mailto:plusbeauxjours@gmail.com">plusbeauxjours@gmail.com</a>
      </p>

      <h2>7. 방침의 변경</h2>
      <p>이 방침이 바뀌면 시행일 7일 전부터 서비스에 공지합니다.</p>
    </article>
  );
}
