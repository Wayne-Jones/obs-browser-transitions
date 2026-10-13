/* Screenshare scene: small camera frame in a corner plus a nameplate.
   Corner codes: br = bottom right, bl = bottom left, tr = top right, tl = top left. */

const CAMERA_CORNERS = ['br', 'bl', 'tr', 'tl'];
const DEFAULT_CAMERA_CORNER = 'br';

const requestedCorner = urlParams.get('pos');
const cameraCorner = CAMERA_CORNERS.includes(requestedCorner) ? requestedCorner : DEFAULT_CAMERA_CORNER;
CAMERA_CORNERS.forEach(corner => document.body.classList.remove('pos-' + corner));
document.body.classList.add('pos-' + cameraCorner);

if (urlParams.get('cam') === '0') document.body.classList.add('nocam');

const nameElement = getById('name');
const titleElement = getById('title');
if (urlParams.get('name') && nameElement) nameElement.textContent = urlParams.get('name');
if (urlParams.get('title') && titleElement) titleElement.textContent = urlParams.get('title');
