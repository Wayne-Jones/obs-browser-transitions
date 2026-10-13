/* Stream Ending scene: thank-you headline, next stream time and social links. */

if (urlParams.get('msg')) getById('msg').textContent = urlParams.get('msg');
if (urlParams.get('next')) getById('next').textContent = urlParams.get('next');

/* ?socials=twitter/you,youtube/you becomes one line per link. */
const socialsParam = urlParams.get('socials') || urlParams.get('channel') || 'yourchannel';
const socialLinks = socialsParam.split(',').map(link => link.trim()).filter(Boolean);
getById('socials').innerHTML = socialLinks.map(removeHtmlCharacters).join('<br>');

fillMarquee(['Thanks for watching', urlParams.get('channel') || 'yourchannel', 'See you next time', 'Follow for more']);
