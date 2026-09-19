import { render, screen } from "@testing-library/react";

import { Placeholder } from "./Placeholder";

test("renders the service name", () => {
  render(<Placeholder />);
  expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("키즈카페 지도");
});
