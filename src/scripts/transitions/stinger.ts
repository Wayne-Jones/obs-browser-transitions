import { startStinger } from './stinger-core.js';
import { horizontalWipe } from './stinger-wipes.js';
/* ============================================================
   Stinger transition for the "Browser Transition" OBS plugin.

   A left-to-right sweep. The diagonal and diamond pages reuse
   this script and skew / rotate the layers in their own CSS.
   ============================================================ */

startStinger(horizontalWipe);
