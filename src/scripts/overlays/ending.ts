import { getById, urlParams, fillMarquee, removeHtmlCharacters } from '../base.js';

if (urlParams.get('msg')) (getById('msg') as HTMLElement).textContent = urlParams.get('msg');
if (urlParams.get('next')) (getById('next') as HTMLElement).textContent = urlParams.get('next')!;

const socialsParam = urlParams.get('socials') || urlParams.get('channel') || 'yourchannel';
const socialLinks = socialsParam.split(',').map(link => link.trim()).filter(Boolean);
(getById('socials') as HTMLElement).innerHTML = socialLinks.map(removeHtmlCharacters).join('<br>');

fillMarquee(['Thanks for watching', urlParams.get('channel') || 'yourchannel', 'See you next time', 'Follow for more']);