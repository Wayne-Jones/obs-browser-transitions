/* Webcam scene: hollow camera frame with a nameplate. */

if (urlParams.has('solid')) document.body.classList.add('solid');

const nameElement = getById('name');
const titleElement = getById('title');
if (urlParams.get('name') && nameElement) nameElement.textContent = urlParams.get('name');
if (urlParams.get('title') && titleElement) titleElement.textContent = urlParams.get('title');
