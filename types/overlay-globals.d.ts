// Ambient globals the overlay and stinger pages expose on `window`.
//
// Declared once here so both the Playwright suite and the preview generator can
// drive the pages without repeating (and drifting from) the shape in each file.
export {};

declare global {
  interface Window {
    overlay: {
      alert: (kind: string, username: string, detail?: string) => void;
      lower: (show?: boolean) => void;
      scene: (name: string | null, minutes: number) => void;
      setGoal: (value: number, max?: number) => void;
      setLower: (name?: string | null, title?: string | null) => void;
    };
    stinger: {
      render: (progress: number, transitionPoint?: number) => void;
    };
    // Injected by the preview generator's in-browser GIF encoder.
    __gifAddFrame: (dataUrl: string, width: number, height: number, delay: number) => Promise<void>;
    __gifFinish: () => string;
  }
}
