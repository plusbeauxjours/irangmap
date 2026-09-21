import { render } from "@testing-library/react";

import { RichText } from "./RichText";

test("splits comma-joined fee items into lines and bolds amounts", () => {
  const { container } = render(<RichText text="[APP]3시간(키즈/평일)16,800원, [현장]3시간(키즈/평일)21,000원, 자유이용권4시간 32,000원" />);
  expect(container.querySelectorAll("li")).toHaveLength(3);
  expect(container.querySelectorAll("strong")).toHaveLength(3);
});

test("renders bullets and bold leading labels", () => {
  const { container } = render(<RichText text={"- 미끄럼 방지 양말 반드시 착용\n아동: 1명당 5,000원\n보호자: 무료"} />);
  expect(container.querySelectorAll("li")).toHaveLength(3);
  expect(container.textContent).toContain("아동:");
  expect(container.querySelector("strong")?.textContent).toBe("아동:");
});
