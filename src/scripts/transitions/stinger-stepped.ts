import { startStinger } from './stinger-core.js';
import { steppedWipe } from './stinger-wipes.js';
/* ============================================================
   Stinger transition for the "Browser Transition" OBS plugin.
   A sweep snapped to visible steps.
   ============================================================ */

startStinger(steppedWipe);
