// ============================================================
//  Icônes dessinées en SVG, aux couleurs du jeu (orange et vert).
//  Elles remplacent les emojis, qui changent d'un appareil à l'autre.
// ============================================================

const O = '#ff8c1a', G = '#22c55e', D = '#15131c', W = '#ffffff';
const svg = (body, view = '0 0 32 32') => `<svg class="icon" viewBox="${view}" aria-hidden="true">${body}</svg>`;

export const ICONS = {
    // Modes de jeu
    race: svg(`<path d="M7 4v25" stroke="${D}" stroke-width="2.4" stroke-linecap="round"/><path d="M8 5h17l-3 5 3 5H8z" fill="${W}" stroke="${D}" stroke-width="1.6"/><path d="M8 5h4.25v3.3H8zm8.5 0h4.25v3.3H16.5zM12.25 8.3h4.25v3.4h-4.25zm8.5 0H23l-1.4 2.2.4 1.2h-1.25zM8 11.7h4.25V15H8zm8.5 0h4.25V15H16.5z" fill="${D}"/>`),
    champ: svg(`<path d="M9 4h14v7a7 7 0 0 1-14 0z" fill="${O}"/><path d="M9 6H5a4 4 0 0 0 4 6m14-6h4a4 4 0 0 1-4 6" fill="none" stroke="${O}" stroke-width="2.2"/><path d="M14 17h4v5h-4z" fill="${O}"/><rect x="9" y="22" width="14" height="5" rx="1.5" fill="${G}"/><path d="M16 7l1.2 2.4 2.6.4-1.9 1.8.5 2.6-2.4-1.3-2.4 1.3.5-2.6-1.9-1.8 2.6-.4z" fill="${W}"/>`),
    tt: svg(`<circle cx="16" cy="18" r="10" fill="${W}" stroke="${D}" stroke-width="2.2"/><path d="M13 4h6M16 4v4M24 9l2-2" stroke="${D}" stroke-width="2.4" stroke-linecap="round"/><path d="M16 18V12" stroke="${O}" stroke-width="2.6" stroke-linecap="round"/><path d="M16 18l5 3" stroke="${G}" stroke-width="2.6" stroke-linecap="round"/><circle cx="16" cy="18" r="1.8" fill="${D}"/>`),
    duel: svg(`<circle cx="11" cy="10" r="5" fill="${O}"/><path d="M2 27c0-6 4-9 9-9s9 3 9 9z" fill="${O}"/><circle cx="22" cy="11" r="4.5" fill="${G}"/><path d="M14 27c0-5.5 3.5-8 8-8s8 2.5 8 8z" fill="${G}"/>`),
    // Biomes
    plaine: svg(`<circle cx="22" cy="9" r="5" fill="#ffc94d"/><path d="M1 27c5-9 10-11 15-6 4-5 10-4 15 6z" fill="${G}"/><path d="M1 27c6-5 12-5 30 0v3H1z" fill="#3d8532"/><path d="M8 20v-4M8 15c-2 0-3-2-1.5-3 1.5 1 1.5 3 1.5 3s0-2 1.5-3c1.5 1 .5 3-1.5 3" stroke="#2f6b2c" stroke-width="1.4" fill="${G}"/>`),
    glace: svg(`<g stroke="#2f7fd6" stroke-width="2.4" stroke-linecap="round"><path d="M16 3v26M5 9.5l22 13M5 22.5l22-13"/><path d="M12 5l4 3 4-3M12 27l4-3 4 3M4 14l5 0-1-4M28 18l-5 0 1 4M4 18l5 0-1 4M28 14l-5 0 1-4"/></g><circle cx="16" cy="16" r="2.6" fill="#bfe8ff"/>`),
    jungle: svg(`<path d="M15 29c0-8 1-14 3-19" stroke="#8a6a44" stroke-width="2.6" fill="none" stroke-linecap="round"/><path d="M18 10C13 5 7 6 4 10c5-1 9 0 14 0zM18 10c2-6 8-8 12-6-4 2-7 4-12 6zM18 10c6-1 10 2 11 7-4-3-7-4-11-7zM18 10c-5 1-9 5-9 10 3-4 5-6 9-10z" fill="${G}"/><circle cx="18" cy="11" r="1.6" fill="#7a5a34"/>`),
    desert: svg(`<circle cx="24" cy="8" r="5" fill="${O}"/><path d="M0 28c8-5 16-5 32 0v4H0z" fill="#e2b46e"/><path d="M12 28V11a3 3 0 0 1 6 0v17z" fill="#3c8a44"/><path d="M12 19H9a2 2 0 0 1-2-2v-4a1.5 1.5 0 0 1 3 0v3h2m6 0h3v-5a1.5 1.5 0 0 1 3 0v5a2 2 0 0 1-2 2h-4" fill="#3c8a44"/>`),
    auto: svg(`<circle cx="16" cy="16" r="12" fill="none" stroke="${D}" stroke-width="2.2"/><path d="M16 4a12 12 0 0 1 0 24z" fill="${O}"/><path d="M16 4a12 12 0 0 0 0 24" fill="${G}" opacity=".85"/><text x="16" y="21" font-size="13" font-weight="900" text-anchor="middle" fill="${W}" font-family="sans-serif">A</text>`),
    // Les 10 objets
    turbo: svg(`<path d="M16 2c5 4 7 10 7 15l-3 4h-8l-3-4c0-5 2-11 7-15z" fill="${W}" stroke="${D}" stroke-width="1.5"/><circle cx="16" cy="12" r="2.8" fill="#2f8fff" stroke="${D}" stroke-width="1.2"/><path d="M9 17l-4 5 5-1M23 17l4 5-5-1" fill="${O}"/><path d="M12 21c0 4 2 7 4 9 2-2 4-5 4-9z" fill="${O}"/><path d="M14 21c0 3 1 5 2 6 1-1 2-3 2-6z" fill="#ffd23f"/>`),
    shield: svg(`<path d="M16 2l11 4v8c0 8-5 13-11 16C10 27 5 22 5 14V6z" fill="${G}" stroke="${D}" stroke-width="1.6"/><path d="M16 6l7 2.6V14c0 5-3 8.5-7 10.6z" fill="#7dffb4"/><path d="M11 15l3.5 3.5L21 11" stroke="${W}" stroke-width="2.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`),
    oil: svg(`<ellipse cx="16" cy="25" rx="13" ry="4" fill="#202028"/><ellipse cx="13" cy="24.4" rx="4" ry="1.2" fill="#5a5a70" opacity=".8"/><path d="M16 3c4 6 7 10 7 14a7 7 0 0 1-14 0c0-4 3-8 7-14z" fill="#202028" stroke="${O}" stroke-width="1.5"/><path d="M13 15c0 2 1 3 2.5 3.5" stroke="#8888a8" stroke-width="1.6" fill="none" stroke-linecap="round"/>`),
    missile: svg(`<g transform="rotate(-35 16 16)"><path d="M10 13h12l5 3-5 3H10z" fill="${W}" stroke="${D}" stroke-width="1.4"/><path d="M22 13l5 3-5 3z" fill="#ff3b1f"/><path d="M10 13l-3-4h4l2 4M10 19l-3 4h4l2-4" fill="${O}"/><rect x="15" y="13" width="2.2" height="6" fill="${G}"/><path d="M10 14.5L3 16l7 1.5z" fill="#ffd23f"/></g>`),
    bomb: svg(`<circle cx="14" cy="19" r="10" fill="${D}"/><circle cx="10.5" cy="15.5" r="2.6" fill="#55556a"/><rect x="11.5" y="7" width="5" height="3.4" rx="1" fill="#777"/><path d="M14 7c0-3 3-4 6-3" stroke="#d9c48a" stroke-width="1.8" fill="none"/><path d="M22 4l1-3 1 3 3 1-3 1-1 3-1-3-3-1z" fill="${O}"/><path d="M5 20.5h18" stroke="${O}" stroke-width="2.4"/>`),
    zap: svg(`<path d="M19 2L6 18h8l-3 12 15-18h-9z" fill="#ffd23f" stroke="${O}" stroke-width="1.6" stroke-linejoin="round"/><path d="M16 9l-4 6h5" stroke="${W}" stroke-width="1.4" fill="none" stroke-linecap="round"/>`),
    magnet: svg(`<path d="M6 4h6v12a4 4 0 0 0 8 0V4h6v12a10 10 0 0 1-20 0z" fill="#e32222"/><rect x="6" y="4" width="6" height="5" fill="#dcdce4"/><rect x="20" y="4" width="6" height="5" fill="#dcdce4"/><path d="M4 30c3-2 5-2 8 0M20 30c3-2 5-2 8 0" stroke="${G}" stroke-width="2" fill="none" stroke-linecap="round"/>`),
    ghost: svg(`<path d="M6 28V14a10 10 0 0 1 20 0v14l-3.4-2.6L19.2 28l-3.2-2.6L12.8 28l-3.4-2.6z" fill="#eafff3" stroke="${G}" stroke-width="1.8"/><ellipse cx="12.5" cy="14" rx="2" ry="2.6" fill="${D}"/><ellipse cx="19.5" cy="14" rx="2" ry="2.6" fill="${D}"/><ellipse cx="16" cy="20" rx="2" ry="1.4" fill="${D}"/>`),
    tornado: svg(`<g stroke="#8a95a6" stroke-width="2.6" stroke-linecap="round" fill="none"><path d="M3 5h26"/><path d="M6 10h20"/><path d="M9 15h14"/><path d="M12 20h9"/><path d="M14 25h5"/></g><path d="M16 28l1 2" stroke="${O}" stroke-width="2.6" stroke-linecap="round"/><circle cx="25" cy="13" r="1.6" fill="${O}"/><circle cx="7" cy="19" r="1.3" fill="${G}"/>`),
    spring: svg(`<rect x="7" y="25" width="18" height="4" rx="1.5" fill="${O}"/><path d="M9 23c0-2 14-2 14-4s-14-2-14-4 14-2 14-4-14-2-14-4 14-2 14-4" stroke="#9aa3b2" stroke-width="2.6" fill="none" stroke-linecap="round"/><path d="M16 1l3 4h-6z" fill="${G}"/>`),
    // Divers
    news: svg(`<path d="M16 3l3.4 7 7.6 1.1-5.5 5.4 1.3 7.6L16 20.5l-6.8 3.6 1.3-7.6L5 11.1 12.6 10z" fill="${O}"/><circle cx="26" cy="25" r="5" fill="${G}"/><path d="M26 22.5v5M23.5 25h5" stroke="${W}" stroke-width="1.8" stroke-linecap="round"/>`),
    keys: svg(`<rect x="2" y="8" width="28" height="17" rx="3" fill="${W}" stroke="${D}" stroke-width="1.8"/><g fill="${D}"><rect x="6" y="12" width="3" height="3" rx=".6"/><rect x="11" y="12" width="3" height="3" rx=".6"/><rect x="16" y="12" width="3" height="3" rx=".6"/><rect x="21" y="12" width="5" height="3" rx=".6"/><rect x="8" y="18" width="16" height="3" rx=".6" fill="${O}"/></g>`),
    settings: svg(`<path d="M5 9h12M23 9h4M5 23h4M15 23h12" stroke="#9aa8a0" stroke-width="2.6" stroke-linecap="round"/><circle cx="20" cy="9" r="3.4" fill="${O}" stroke="${D}" stroke-width="1.6"/><circle cx="12" cy="23" r="3.4" fill="${G}" stroke="${D}" stroke-width="1.6"/>`),
};

/** Remplace chaque <span data-icon="nom"> par son icône. */
export function hydrateIcons(root = document) {
    root.querySelectorAll('[data-icon]').forEach(el => { if (ICONS[el.dataset.icon]) el.innerHTML = ICONS[el.dataset.icon]; });
}
