/* Screenshare sidebar scene: camera sidebar on the right, or on the left with ?side=left. */

if (urlParams.get('side') === 'left') document.body.classList.add('flip');

const nameElement = getById('name');
const titleElement = getById('title');
if (urlParams.get('name') && nameElement) nameElement.textContent = urlParams.get('name');
if (urlParams.get('title') && titleElement) titleElement.textContent = urlParams.get('title');
