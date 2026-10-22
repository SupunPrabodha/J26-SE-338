import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach } from "vitest";
afterEach(cleanup);

// jsdom has no native modal implementation; real focus containment is browser-verified.
HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };

// Model the browser's same-origin exclusive Web Lock without persisting auth state.
beforeEach(() => {
  let tail: Promise<unknown> = Promise.resolve();
  Object.defineProperty(navigator, "locks", { configurable: true, value: {
    request: (_name: string, _options: unknown, callback: () => Promise<unknown>) => {
      const result = tail.then(callback); tail = result.catch(() => {}); return result;
    },
  } });
});
