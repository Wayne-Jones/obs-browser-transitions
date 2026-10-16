import { easeInOutCubic, STRIPE_WIDTH, type StingerWipe } from './stinger-core.js';
/* ============================================================
   The stinger wipes.

   Each wipe returns the clip-path for the ink layer and for the
   accent stripe that trails it. `progress` and `transitionPoint`
   are 0–1, and the screen is fully covered at the transition
   point (the moment OBS swaps scenes).
   ============================================================ */

function horizontalSlice(left: number, right: number): string {
  return `inset(0 ${(1 - right) * 100}% 0 ${left * 100}%)`;
}

function verticalSlice(top: number, bottom: number): string {
  return `inset(${top * 100}% 0 ${(1 - bottom) * 100}% 0)`;
}

function circle(radius: number): string {
  return `circle(${Math.max(0, radius) * 100}% at 50% 50%)`;
}

/**
 * Left-to-right sweep. Also the base for the diagonal and diamond pages, which
 * skew or rotate the layers with an inline CSS transform.
 */
export const horizontalWipe: StingerWipe = {
  clipPaths(progress, transitionPoint) {
    let left = 0, right = 0, stripeLeft = 0, stripeRight = 0;
    if (progress <= transitionPoint) {
      const wipe = easeInOutCubic(progress / transitionPoint);
      right = wipe;
      stripeRight = Math.min(1, wipe + STRIPE_WIDTH * Math.min(1, wipe * 10));
    } else {
      const wipe = easeInOutCubic((progress - transitionPoint) / (1 - transitionPoint)) * (1 + STRIPE_WIDTH);
      left = Math.min(1, wipe);
      right = 1;
      stripeLeft = Math.max(0, wipe - STRIPE_WIDTH);
      stripeRight = 1;
    }
    return { ink: horizontalSlice(left, right), stripe: horizontalSlice(stripeLeft, stripeRight) };
  },
};

/** Top-to-bottom sweep. */
export const verticalWipe: StingerWipe = {
  clipPaths(progress, transitionPoint) {
    let top = 0, bottom = 0, stripeTop = 0, stripeBottom = 0;
    if (progress <= transitionPoint) {
      const wipe = easeInOutCubic(progress / transitionPoint);
      bottom = wipe;
      stripeBottom = Math.min(1, wipe + STRIPE_WIDTH * Math.min(1, wipe * 10));
    } else {
      const wipe = easeInOutCubic((progress - transitionPoint) / (1 - transitionPoint)) * (1 + STRIPE_WIDTH);
      top = Math.min(1, wipe);
      bottom = 1;
      stripeTop = Math.max(0, wipe - STRIPE_WIDTH);
      stripeBottom = 1;
    }
    return { ink: verticalSlice(top, bottom), stripe: verticalSlice(stripeTop, stripeBottom) };
  },
};

/** Symmetric open from the middle outwards. */
export const irisWipe: StingerWipe = {
  clipPaths(progress, transitionPoint) {
    let half = 0, stripeHalf = 0;
    if (progress <= transitionPoint) {
      const wipe = easeInOutCubic(progress / transitionPoint);
      half = wipe * 0.5;
      stripeHalf = Math.min(0.5, half + STRIPE_WIDTH * 0.5 * Math.min(1, wipe * 10));
    } else {
      const wipe = easeInOutCubic((progress - transitionPoint) / (1 - transitionPoint));
      half = (1 - wipe) * 0.5;
      stripeHalf = half + STRIPE_WIDTH * 0.5;
    }
    return {
      ink: horizontalSlice(0.5 - half, 0.5 + half),
      stripe: horizontalSlice(0.5 - stripeHalf, 0.5 + stripeHalf),
    };
  },
};

/** Expanding circle. */
export const radialWipe: StingerWipe = {
  clipPaths(progress, transitionPoint) {
    const maxRadius = 1.5;
    let inkRadius = 0, stripeRadius = 0;
    if (progress <= transitionPoint) {
      const wipe = easeInOutCubic(progress / transitionPoint);
      inkRadius = wipe * maxRadius;
      stripeRadius = Math.min(maxRadius + STRIPE_WIDTH, inkRadius + STRIPE_WIDTH * Math.min(1, wipe * 10));
    } else {
      const wipe = easeInOutCubic((progress - transitionPoint) / (1 - transitionPoint));
      inkRadius = (1 - wipe) * maxRadius;
      stripeRadius = inkRadius + STRIPE_WIDTH * (1 - wipe);
    }
    return { ink: circle(inkRadius), stripe: circle(stripeRadius) };
  },
};

/** Sweep snapped to visible steps. */
export const steppedWipe: StingerWipe = {
  quantize(progress) {
    return Math.round(progress * 12) / 12;
  },
  clipPaths(progress, transitionPoint) {
    let left = 0, right = 0, stripeLeft = 0, stripeRight = 0;
    if (progress <= transitionPoint) {
      const wipe = easeInOutCubic(progress / transitionPoint);
      left = 1 - wipe;
      right = 1;
      stripeLeft = Math.max(0, 1 - wipe - STRIPE_WIDTH * Math.min(1, wipe * 10));
      stripeRight = 1;
    } else {
      const wipe = easeInOutCubic((progress - transitionPoint) / (1 - transitionPoint)) * (1 + STRIPE_WIDTH);
      left = 0;
      right = Math.max(0, 1 - wipe);
      stripeLeft = 0;
      stripeRight = Math.min(1, 1 - wipe + STRIPE_WIDTH);
    }
    return { ink: horizontalSlice(left, right), stripe: horizontalSlice(stripeLeft, stripeRight) };
  },
};
