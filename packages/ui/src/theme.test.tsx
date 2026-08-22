import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MtThemeProvider } from "./theme";

describe("MtThemeProvider", () => {
  it("渲染子元素", () => {
    render(
      <MtThemeProvider>
        <div>child</div>
      </MtThemeProvider>
    );
    expect(screen.getByText("child")).toBeTruthy();
  });
});
