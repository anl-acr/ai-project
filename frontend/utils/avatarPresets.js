// Telifsiz (Kamu Malı & Özgün Sinema Arketipleri) + Hazır Avatar Koleksiyonu

const svgToDataUri = (svg) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(svg.trim().replace(/\s+/g, " "))}`;

export const CINEMA_AVATARS = [
  {
    id: "cinema-sherlock",
    label: "Sherlock Holmes (Dedektif)",
    category: "cinema",
    url: svgToDataUri(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
        <rect width="120" height="120" rx="28" fill="#1e293b"/>
        <circle cx="60" cy="60" r="48" fill="#334155" opacity="0.55"/>
        <!-- Trench coat & collar -->
        <path d="M20 120 C24 92 40 84 60 84 C80 84 96 92 100 120 Z" fill="#78350f"/>
        <path d="M44 84 L60 106 L76 84 L68 80 L60 94 L52 80 Z" fill="#fef3c7"/>
        <path d="M36 86 L50 108 L42 120 L24 120 Z" fill="#92400e"/>
        <path d="M84 86 L70 108 L78 120 L96 120 Z" fill="#92400e"/>
        <!-- Neck & Head -->
        <rect x="52" y="72" width="16" height="14" rx="6" fill="#f1c27d"/>
        <ellipse cx="60" cy="56" rx="22" ry="25" fill="#fbd38d"/>
        <!-- Eyes & Brows -->
        <path d="M46 49 Q51 46 55 49" stroke="#451a03" stroke-width="2.5" fill="none" stroke-linecap="round"/>
        <path d="M65 49 Q69 46 74 49" stroke="#451a03" stroke-width="2.5" fill="none" stroke-linecap="round"/>
        <circle cx="51" cy="54" r="2.6" fill="#1e293b"/>
        <circle cx="69" cy="54" r="2.6" fill="#1e293b"/>
        <!-- Nose & confident smile -->
        <path d="M60 53 L58 62 L62 62" stroke="#d97706" stroke-width="2" fill="none" stroke-linecap="round"/>
        <path d="M53 69 Q60 73 67 69" stroke="#78350f" stroke-width="2.2" fill="none" stroke-linecap="round"/>
        <!-- Deerstalker Hat -->
        <path d="M30 42 Q60 34 90 42 Q78 47 60 47 Q42 47 30 42 Z" fill="#92400e"/>
        <path d="M37 41 C37 20 83 20 83 41 Z" fill="#b45309"/>
        <path d="M60 21 L60 41 M46 25 L46 41 M74 25 L74 41" stroke="#78350f" stroke-width="2" opacity="0.6"/>
        <ellipse cx="60" cy="20" rx="7" ry="2.5" fill="#78350f"/>
        <!-- Magnifying glass -->
        <circle cx="85" cy="75" r="10" fill="#bae6fd" fill-opacity="0.45" stroke="#fbbf24" stroke-width="3.5"/>
        <line x1="92" y1="82" x2="101" y2="93" stroke="#78350f" stroke-width="4.5" stroke-linecap="round"/>
      </svg>
    `)
  },
  {
    id: "cinema-secret-agent",
    label: "Gizli Ajan (Smokin)",
    category: "cinema",
    url: svgToDataUri(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
        <rect width="120" height="120" rx="28" fill="#0f172a"/>
        <circle cx="60" cy="58" r="46" fill="#1e293b"/>
        <!-- Tuxedo -->
        <path d="M18 120 C22 90 40 83 60 83 C80 83 98 90 102 120 Z" fill="#090d16"/>
        <path d="M47 83 L60 116 L73 83 Z" fill="#f8fafc"/>
        <!-- Bowtie -->
        <path d="M51 87 L60 91 L51 95 Z M69 87 L60 91 L69 95 Z" fill="#e11d48"/>
        <circle cx="60" cy="91" r="2.3" fill="#be123c"/>
        <!-- Pocket square -->
        <path d="M75 103 L83 99 L85 105 Z" fill="#e11d48"/>
        <!-- Head & slick hair -->
        <rect x="52" y="72" width="16" height="13" rx="5" fill="#eab38f"/>
        <ellipse cx="60" cy="54" rx="22" ry="25" fill="#f5cba7"/>
        <path d="M38 48 C37 27 52 22 65 24 C78 26 84 35 82 48 C77 37 68 34 56 35 C46 36 41 41 38 48 Z" fill="#1e293b"/>
        <!-- Aviator Sunglasses -->
        <rect x="41" y="47" width="16" height="11" rx="4" fill="#020617" stroke="#94a3b8" stroke-width="1.6"/>
        <rect x="63" y="47" width="16" height="11" rx="4" fill="#020617" stroke="#94a3b8" stroke-width="1.6"/>
        <line x1="57" y1="50" x2="63" y2="50" stroke="#94a3b8" stroke-width="1.8"/>
        <line x1="44" y1="50" x2="50" y2="55" stroke="#38bdf8" stroke-width="1.5" opacity="0.65"/>
        <line x1="66" y1="50" x2="72" y2="55" stroke="#38bdf8" stroke-width="1.5" opacity="0.65"/>
        <!-- Smirk & earpiece -->
        <path d="M54 68 Q61 72 67 67" stroke="#7c2d12" stroke-width="2.2" fill="none" stroke-linecap="round"/>
        <circle cx="38" cy="56" r="2.8" fill="#38bdf8"/>
        <path d="M38 59 Q38 72 46 82" stroke="#cbd5e1" stroke-width="1.4" fill="none"/>
      </svg>
    `)
  },
  {
    id: "cinema-cyber-one",
    label: "Siber Seçilmiş (Bilim-Kurgu)",
    category: "cinema",
    url: svgToDataUri(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
        <rect width="120" height="120" rx="28" fill="#022c22"/>
        <!-- Digital rain lines -->
        <g stroke="#10b981" stroke-width="2" stroke-linecap="round" opacity="0.35">
          <line x1="20" y1="14" x2="20" y2="44"/>
          <line x1="32" y1="24" x2="32" y2="62"/>
          <line x1="88" y1="16" x2="88" y2="54"/>
          <line x1="100" y1="28" x2="100" y2="70"/>
        </g>
        <!-- High collar trench coat -->
        <path d="M18 120 C22 88 38 82 60 82 C82 82 98 88 102 120 Z" fill="#090d16"/>
        <path d="M36 74 L48 96 L48 120 L30 120 Z" fill="#111827"/>
        <path d="M84 74 L72 96 L72 120 L90 120 Z" fill="#111827"/>
        <!-- Head -->
        <rect x="52" y="72" width="16" height="14" rx="5" fill="#e5b899"/>
        <ellipse cx="60" cy="53" rx="21" ry="24" fill="#f3cfb6"/>
        <path d="M39 48 C39 27 81 27 81 48 C77 36 43 36 39 48 Z" fill="#090d16"/>
        <!-- Rimless dark cyber glasses -->
        <ellipse cx="50" cy="52" rx="8.5" ry="5" fill="#020617" stroke="#34d399" stroke-width="1.2"/>
        <ellipse cx="70" cy="52" rx="8.5" ry="5" fill="#020617" stroke="#34d399" stroke-width="1.2"/>
        <line x1="58.5" y1="52" x2="61.5" y2="52" stroke="#34d399" stroke-width="1.5"/>
        <path d="M54 67 L66 67" stroke="#7c2d12" stroke-width="2.2" stroke-linecap="round"/>
      </svg>
    `)
  },
  {
    id: "cinema-dracula",
    label: "Kont Drakula (Klasik Sinema)",
    category: "cinema",
    url: svgToDataUri(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
        <rect width="120" height="120" rx="28" fill="#2e1065"/>
        <circle cx="90" cy="26" r="11" fill="#fef08a" opacity="0.85"/>
        <!-- High red-lined cape -->
        <path d="M22 54 L60 88 L98 54 L106 120 L14 120 Z" fill="#991b1b"/>
        <path d="M18 120 C24 90 40 84 60 84 C80 84 96 90 102 120 Z" fill="#0f172a"/>
        <path d="M50 84 L60 106 L70 84 Z" fill="#f8fafc"/>
        <circle cx="60" cy="92" r="4" fill="#dc2626" stroke="#fbbf24" stroke-width="1.5"/>
        <!-- Pale face & widow's peak -->
        <ellipse cx="60" cy="54" rx="21" ry="24" fill="#e2e8f0"/>
        <path d="M39 48 C39 24 81 24 81 48 C76 35 65 34 60 41 C55 34 44 35 39 48 Z" fill="#090d16"/>
        <!-- Eyes & Fangs -->
        <path d="M45 48 L55 51 M75 48 L65 51" stroke="#0f172a" stroke-width="2.3" stroke-linecap="round"/>
        <circle cx="51" cy="54" r="2.6" fill="#dc2626"/>
        <circle cx="69" cy="54" r="2.6" fill="#dc2626"/>
        <path d="M51 66 Q60 70 69 66" stroke="#1e293b" stroke-width="2.2" fill="none" stroke-linecap="round"/>
        <polygon points="54,67 56,73 58,67" fill="#ffffff"/>
        <polygon points="62,67 64,73 66,67" fill="#ffffff"/>
      </svg>
    `)
  },
  {
    id: "cinema-chaplin",
    label: "Şarlo (Sessiz Sinema)",
    category: "cinema",
    url: svgToDataUri(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
        <rect width="120" height="120" rx="28" fill="#334155"/>
        <circle cx="60" cy="60" r="46" fill="#475569"/>
        <!-- Vintage suit -->
        <path d="M22 120 C26 92 42 84 60 84 C78 84 94 92 98 120 Z" fill="#1e293b"/>
        <path d="M49 84 L60 112 L71 84 Z" fill="#f1f5f9"/>
        <path d="M54 88 L66 93 M66 88 L54 93" stroke="#0f172a" stroke-width="4" stroke-linecap="round"/>
        <!-- Face -->
        <ellipse cx="60" cy="58" rx="21" ry="23" fill="#f8fafc"/>
        <!-- Expressive arched brows & eyes -->
        <path d="M46 49 Q51 44 55 49" stroke="#0f172a" stroke-width="2.5" fill="none" stroke-linecap="round"/>
        <path d="M65 49 Q69 44 74 49" stroke="#0f172a" stroke-width="2.5" fill="none" stroke-linecap="round"/>
        <circle cx="51" cy="54" r="2.8" fill="#0f172a"/>
        <circle cx="69" cy="54" r="2.8" fill="#0f172a"/>
        <!-- Iconic toothbrush mustache & smile -->
        <rect x="54" y="62" width="12" height="5" rx="1.5" fill="#0f172a"/>
        <path d="M52 70 Q60 74 68 70" stroke="#334155" stroke-width="2" fill="none" stroke-linecap="round"/>
        <!-- Bowler Hat -->
        <ellipse cx="60" cy="39" rx="31" ry="5.5" fill="#0f172a"/>
        <path d="M38 39 C38 16 82 16 82 39 Z" fill="#1e293b"/>
        <rect x="38" y="34" width="44" height="4" fill="#090d16"/>
      </svg>
    `)
  },
  {
    id: "cinema-zorro",
    label: "Maskeli Süvari (Zorro)",
    category: "cinema",
    url: svgToDataUri(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
        <rect width="120" height="120" rx="28" fill="#451a03"/>
        <circle cx="60" cy="60" r="46" fill="#78350f" opacity="0.6"/>
        <!-- Cape -->
        <path d="M18 120 C22 90 38 83 60 83 C82 83 98 90 102 120 Z" fill="#0f172a"/>
        <path d="M44 84 Q60 95 76 84" stroke="#f59e0b" stroke-width="3" fill="none"/>
        <!-- Face -->
        <ellipse cx="60" cy="57" rx="21" ry="23" fill="#f1c27d"/>
        <!-- Domino Mask -->
        <path d="M38 47 Q60 44 82 47 L81 59 Q70 62 60 56 Q50 62 39 59 Z" fill="#090d16"/>
        <ellipse cx="51" cy="53" rx="4" ry="2.6" fill="#ffffff"/>
        <ellipse cx="69" cy="53" rx="4" ry="2.6" fill="#ffffff"/>
        <circle cx="51" cy="53" r="1.8" fill="#0f172a"/>
        <circle cx="69" cy="53" r="1.8" fill="#0f172a"/>
        <!-- Thin mustache & grin -->
        <path d="M50 66 Q56 63 60 66 Q64 63 70 66" stroke="#090d16" stroke-width="2.2" fill="none" stroke-linecap="round"/>
        <path d="M54 71 Q60 75 66 71" stroke="#78350f" stroke-width="2" fill="none" stroke-linecap="round"/>
        <!-- Flat Cordobes Hat -->
        <ellipse cx="60" cy="36" rx="36" ry="5" fill="#090d16"/>
        <rect x="40" y="21" width="40" height="15" rx="4" fill="#1e293b"/>
        <rect x="40" y="31" width="40" height="3.5" fill="#f59e0b"/>
      </svg>
    `)
  },
  {
    id: "cinema-space-knight",
    label: "Galaksi Şövalyesi (Uzay)",
    category: "cinema",
    url: svgToDataUri(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
        <rect width="120" height="120" rx="28" fill="#090d16"/>
        <!-- Starfield & neon saber glow -->
        <circle cx="24" cy="26" r="1.5" fill="#e2e8f0"/>
        <circle cx="96" cy="22" r="2" fill="#38bdf8"/>
        <circle cx="92" cy="48" r="1.3" fill="#e2e8f0"/>
        <line x1="22" y1="104" x2="98" y2="18" stroke="#38bdf8" stroke-width="5" stroke-linecap="round" opacity="0.28"/>
        <!-- Armor shoulders -->
        <path d="M16 120 C20 90 38 84 60 84 C82 84 100 90 104 120 Z" fill="#334155"/>
        <rect x="46" y="92" width="28" height="18" rx="4" fill="#1e293b" stroke="#38bdf8" stroke-width="1.5"/>
        <!-- Beskar / Sci-fi Visor Helmet -->
        <path d="M35 50 C35 24 85 24 85 50 L82 78 Q60 86 38 78 Z" fill="#94a3b8"/>
        <path d="M39 50 C39 28 81 28 81 50" fill="#cbd5e1"/>
        <!-- T-Visor -->
        <path d="M42 47 H78 L75 55 H64 V75 H56 V55 H45 Z" fill="#020617"/>
        <path d="M45 50 H75" stroke="#38bdf8" stroke-width="1.5" opacity="0.7"/>
      </svg>
    `)
  },
  {
    id: "cinema-night-guardian",
    label: "Gece Koruyucusu (Kahraman)",
    category: "cinema",
    url: svgToDataUri(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
        <rect width="120" height="120" rx="28" fill="#0f172a"/>
        <circle cx="60" cy="46" r="36" fill="#facc15" opacity="0.16"/>
        <!-- Heroic dark cape -->
        <path d="M16 120 C22 86 38 80 60 80 C82 80 98 86 104 120 Z" fill="#1e293b"/>
        <path d="M34 83 L60 98 L86 83 L96 120 L24 120 Z" fill="#334155"/>
        <!-- Jaw & Mask -->
        <ellipse cx="60" cy="56" rx="21" ry="24" fill="#f1c27d"/>
        <path d="M38 56 C38 28 82 28 82 56 L77 62 L60 56 L43 62 Z" fill="#1e1b4b"/>
        <!-- Glowing white hero eyes -->
        <polygon points="45,50 56,53 47,56" fill="#f8fafc"/>
        <polygon points="75,50 64,53 73,56" fill="#f8fafc"/>
        <path d="M53 69 Q60 67 67 69" stroke="#78350f" stroke-width="2.2" fill="none" stroke-linecap="round"/>
      </svg>
    `)
  },
  {
    id: "cinema-wizard",
    label: "Gri Büyücü (Fantastik)",
    category: "cinema",
    url: svgToDataUri(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
        <rect width="120" height="120" rx="28" fill="#1e1b4b"/>
        <circle cx="92" cy="30" r="3" fill="#fde047"/>
        <circle cx="26" cy="38" r="2" fill="#bae6fd"/>
        <!-- Robe -->
        <path d="M20 120 C25 90 42 84 60 84 C78 84 95 90 100 120 Z" fill="#475569"/>
        <!-- Face -->
        <ellipse cx="60" cy="58" rx="20" ry="21" fill="#fbd38d"/>
        <circle cx="52" cy="54" r="2.5" fill="#1e293b"/>
        <circle cx="68" cy="54" r="2.5" fill="#1e293b"/>
        <path d="M45 49 L55 50 M75 49 L65 50" stroke="#f8fafc" stroke-width="3" stroke-linecap="round"/>
        <!-- Long flowing silver beard -->
        <path d="M39 60 Q60 68 81 60 Q84 92 60 112 Q36 92 39 60 Z" fill="#e2e8f0"/>
        <path d="M48 64 Q60 60 72 64" stroke="#cbd5e1" stroke-width="3.5" fill="none" stroke-linecap="round"/>
        <!-- Pointed Wizard Hat -->
        <ellipse cx="60" cy="42" rx="34" ry="6.5" fill="#334155"/>
        <polygon points="36,42 63,8 84,42" fill="#475569"/>
        <path d="M40 39 Q60 43 80 39" stroke="#fbbf24" stroke-width="3" fill="none"/>
      </svg>
    `)
  },
  {
    id: "cinema-sheriff",
    label: "Batı Şerifi (Western)",
    category: "cinema",
    url: svgToDataUri(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
        <rect width="120" height="120" rx="28" fill="#7c2d12"/>
        <circle cx="60" cy="56" r="44" fill="#fb923c" opacity="0.25"/>
        <!-- Vest & Red bandana -->
        <path d="M20 120 C24 90 40 84 60 84 C80 84 96 90 100 120 Z" fill="#78350f"/>
        <polygon points="44,83 76,83 60,103" fill="#dc2626"/>
        <!-- Gold Sheriff Star -->
        <circle cx="76" cy="104" r="6" fill="#facc15"/>
        <!-- Face -->
        <ellipse cx="60" cy="58" rx="21" ry="22" fill="#f1c27d"/>
        <circle cx="51" cy="54" r="2.6" fill="#1e293b"/>
        <circle cx="69" cy="54" r="2.6" fill="#1e293b"/>
        <path d="M49 65 Q60 61 71 65" stroke="#78350f" stroke-width="3.5" fill="none" stroke-linecap="round"/>
        <!-- Cowboy Hat -->
        <path d="M22 39 Q60 48 98 39 Q88 33 60 35 Q32 33 22 39 Z" fill="#92400e"/>
        <path d="M39 37 C40 18 53 20 60 25 C67 20 80 18 81 37 Z" fill="#b45309"/>
        <rect x="40" y="33" width="40" height="4" rx="2" fill="#451a03"/>
      </svg>
    `)
  },
  {
    id: "cinema-robin-hood",
    label: "Robin Hood (Okçu Efsane)",
    category: "cinema",
    url: svgToDataUri(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
        <rect width="120" height="120" rx="28" fill="#064e3b"/>
        <circle cx="60" cy="60" r="46" fill="#047857" opacity="0.45"/>
        <!-- Tunic -->
        <path d="M20 120 C25 90 40 84 60 84 C80 84 95 90 100 120 Z" fill="#15803d"/>
        <path d="M48 84 L60 102 L72 84 Z" fill="#78350f"/>
        <!-- Face & Goatee -->
        <ellipse cx="60" cy="58" rx="21" ry="23" fill="#fbd38d"/>
        <circle cx="51" cy="54" r="2.6" fill="#1e293b"/>
        <circle cx="69" cy="54" r="2.6" fill="#1e293b"/>
        <path d="M53 67 Q60 72 67 67" stroke="#92400e" stroke-width="2.2" fill="none" stroke-linecap="round"/>
        <polygon points="56,74 64,74 60,82" fill="#92400e"/>
        <!-- Feathered Bycocket Hat -->
        <path d="M32 43 L68 18 L88 41 Q60 47 32 43 Z" fill="#16a34a"/>
        <path d="M28 44 Q60 36 90 43" stroke="#14532d" stroke-width="5" fill="none" stroke-linecap="round"/>
        <path d="M72 34 C82 18 94 14 96 22 C90 28 80 34 72 34 Z" fill="#ef4444"/>
      </svg>
    `)
  },
  {
    id: "cinema-frankenstein",
    label: "Frankenstein (Bilim-Kurgu Klasik)",
    category: "cinema",
    url: svgToDataUri(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
        <rect width="120" height="120" rx="28" fill="#1e293b"/>
        <circle cx="60" cy="58" r="46" fill="#0f766e" opacity="0.35"/>
        <!-- Dark jacket -->
        <path d="M20 120 C24 92 40 85 60 85 C80 85 96 92 100 120 Z" fill="#0f172a"/>
        <!-- Neck bolts -->
        <rect x="30" y="68" width="9" height="6" rx="1.5" fill="#94a3b8"/>
        <rect x="81" y="68" width="9" height="6" rx="1.5" fill="#94a3b8"/>
        <!-- Blocky green head -->
        <rect x="38" y="28" width="44" height="52" rx="10" fill="#84cc16"/>
        <path d="M38 38 V28 H82 V38 L76 34 L70 39 L64 34 L58 39 L52 34 L44 39 Z" fill="#0f172a"/>
        <!-- Stitch & eyes -->
        <line x1="46" y1="43" x2="58" y2="45" stroke="#365314" stroke-width="2"/>
        <line x1="50" y1="41" x2="50" y2="46" stroke="#365314" stroke-width="1.6"/>
        <line x1="54" y1="42" x2="54" y2="47" stroke="#365314" stroke-width="1.6"/>
        <circle cx="51" cy="55" r="3" fill="#1e293b"/>
        <circle cx="69" cy="55" r="3" fill="#1e293b"/>
        <line x1="52" y1="69" x2="68" y2="69" stroke="#365314" stroke-width="2.5" stroke-linecap="round"/>
      </svg>
    `)
  },
  {
    id: "cinema-samurai",
    label: "Efsane Samuray",
    category: "cinema",
    url: svgToDataUri(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
        <rect width="120" height="120" rx="28" fill="#450a0a"/>
        <circle cx="60" cy="56" r="42" fill="#dc2626" opacity="0.35"/>
        <!-- Armor -->
        <path d="M18 120 C24 90 40 84 60 84 C80 84 96 90 102 120 Z" fill="#1e293b"/>
        <path d="M42 84 L60 108 L78 84" stroke="#ef4444" stroke-width="4" fill="none"/>
        <!-- Kabuto Helmet Flaps -->
        <path d="M26 48 L36 74 L44 74 L38 48 Z" fill="#0f172a"/>
        <path d="M94 48 L84 74 L76 74 L82 48 Z" fill="#0f172a"/>
        <!-- Face -->
        <ellipse cx="60" cy="58" rx="19" ry="21" fill="#f5cba7"/>
        <path d="M46 51 L55 53 M74 51 L65 53" stroke="#0f172a" stroke-width="2.4" stroke-linecap="round"/>
        <circle cx="51" cy="56" r="2.4" fill="#0f172a"/>
        <circle cx="69" cy="56" r="2.4" fill="#0f172a"/>
        <path d="M54 68 L66 68" stroke="#7c2d12" stroke-width="2.2" stroke-linecap="round"/>
        <!-- Kabuto Dome & Gold Crescent -->
        <path d="M34 47 C34 22 86 22 86 47 Z" fill="#1e293b"/>
        <path d="M44 26 Q60 40 76 26 Q68 43 60 43 Q52 43 44 26 Z" fill="#facc15"/>
      </svg>
    `)
  },
  {
    id: "cinema-pirate-captain",
    label: "Korsan Kaptan (Macera)",
    category: "cinema",
    url: svgToDataUri(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
        <rect width="120" height="120" rx="28" fill="#0c4a6e"/>
        <circle cx="60" cy="60" r="46" fill="#0284c7" opacity="0.35"/>
        <!-- Captain Coat -->
        <path d="M18 120 C24 90 40 84 60 84 C80 84 96 90 102 120 Z" fill="#7f1d1d"/>
        <path d="M48 84 L60 110 L72 84 Z" fill="#fef3c7"/>
        <!-- Face, beard & eyepatch -->
        <ellipse cx="60" cy="58" rx="21" ry="22" fill="#f1c27d"/>
        <path d="M40 62 Q60 88 80 62 Q77 82 60 84 Q43 82 40 62 Z" fill="#451a03"/>
        <line x1="40" y1="47" x2="80" y2="57" stroke="#090d16" stroke-width="2.2"/>
        <circle cx="51" cy="54" r="5.5" fill="#090d16"/>
        <circle cx="69" cy="54" r="2.6" fill="#0f172a"/>
        <path d="M54 68 Q60 72 66 68" stroke="#fef3c7" stroke-width="2" fill="none" stroke-linecap="round"/>
        <!-- Tricorn Hat -->
        <path d="M22 43 Q60 18 98 43 Q60 49 22 43 Z" fill="#1e293b"/>
        <path d="M24 42 Q60 22 96 42" stroke="#facc15" stroke-width="2.5" fill="none"/>
      </svg>
    `)
  },
  {
    id: "cinema-fantasy-elf",
    label: "Orman Elfi (Fantastik)",
    category: "cinema",
    url: svgToDataUri(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
        <rect width="120" height="120" rx="28" fill="#064e3b"/>
        <circle cx="60" cy="58" r="46" fill="#10b981" opacity="0.25"/>
        <!-- Long golden hair back -->
        <path d="M34 44 L28 96 L92 96 L86 44 Z" fill="#fde047"/>
        <!-- Emerald cloak -->
        <path d="M20 120 C25 90 42 84 60 84 C78 84 95 90 100 120 Z" fill="#047857"/>
        <circle cx="60" cy="91" r="4.5" fill="#fbbf24"/>
        <!-- Pointed elf ears & face -->
        <polygon points="39,52 27,46 39,62" fill="#fde68a"/>
        <polygon points="81,52 93,46 81,62" fill="#fde68a"/>
        <ellipse cx="60" cy="55" rx="20" ry="23" fill="#fef3c7"/>
        <!-- Hair bangs & circlet crown -->
        <path d="M39 46 C42 26 78 26 81 46 C72 36 48 36 39 46 Z" fill="#facc15"/>
        <path d="M40 43 Q60 49 80 43" stroke="#f59e0b" stroke-width="2.5" fill="none"/>
        <polygon points="60,38 63,44 60,48 57,44" fill="#34d399"/>
        <!-- Eyes & gentle smile -->
        <circle cx="52" cy="54" r="2.6" fill="#065f46"/>
        <circle cx="68" cy="54" r="2.6" fill="#065f46"/>
        <path d="M54 66 Q60 70 66 66" stroke="#b45309" stroke-width="2" fill="none" stroke-linecap="round"/>
      </svg>
    `)
  },
  {
    id: "cinema-cyber-android",
    label: "Sibernetik Android (Sci-Fi)",
    category: "cinema",
    url: svgToDataUri(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
        <rect width="120" height="120" rx="28" fill="#090d16"/>
        <circle cx="60" cy="58" r="46" fill="#1e293b"/>
        <!-- Metallic shoulders -->
        <path d="M18 120 C22 90 40 84 60 84 C80 84 98 90 102 120 Z" fill="#475569"/>
        <circle cx="60" cy="100" r="7" fill="#ef4444"/>
        <!-- Titanium Dome -->
        <rect x="38" y="28" width="44" height="52" rx="18" fill="#cbd5e1"/>
        <line x1="60" y1="28" x2="60" y2="44" stroke="#64748b" stroke-width="2"/>
        <!-- Glowing Cybernetic Optic Visor -->
        <rect x="43" y="46" width="34" height="11" rx="5.5" fill="#0f172a"/>
        <circle cx="52" cy="51.5" r="3.5" fill="#ef4444"/>
        <circle cx="68" cy="51.5" r="3.5" fill="#38bdf8"/>
        <rect x="50" y="66" width="20" height="4" rx="2" fill="#475569"/>
      </svg>
    `)
  }
];

export const CLASSIC_AND_ILLUSTRATED_AVATARS = [
  // Klasik & Kurumsal
  { id: "av-anil", label: "Anıl", category: "classic", url: "https://api.dicebear.com/7.x/avataaars/svg?seed=Anil" },
  { id: "av-can", label: "Can", category: "classic", url: "https://api.dicebear.com/7.x/avataaars/svg?seed=Can" },
  { id: "av-sara", label: "Sara", category: "classic", url: "https://api.dicebear.com/7.x/avataaars/svg?seed=Sara" },
  { id: "av-adrian", label: "Adrian", category: "classic", url: "https://api.dicebear.com/7.x/avataaars/svg?seed=Adrian" },
  { id: "av-jack", label: "Jack", category: "classic", url: "https://api.dicebear.com/7.x/avataaars/svg?seed=Jack" },
  { id: "av-felix", label: "Felix", category: "classic", url: "https://api.dicebear.com/7.x/avataaars/svg?seed=Felix" },
  { id: "av-elif", label: "Elif", category: "classic", url: "https://api.dicebear.com/7.x/avataaars/svg?seed=Elif" },
  { id: "av-zeynep", label: "Zeynep", category: "classic", url: "https://api.dicebear.com/7.x/avataaars/svg?seed=Zeynep" },
  { id: "av-murat", label: "Murat", category: "classic", url: "https://api.dicebear.com/7.x/avataaars/svg?seed=Murat" },
  { id: "av-selin", label: "Selin", category: "classic", url: "https://api.dicebear.com/7.x/avataaars/svg?seed=Selin" },
  { id: "av-burak", label: "Burak", category: "classic", url: "https://api.dicebear.com/7.x/avataaars/svg?seed=Burak" },
  { id: "av-deniz", label: "Deniz", category: "classic", url: "https://api.dicebear.com/7.x/avataaars/svg?seed=Deniz" },
  // Çizim & Robotik
  { id: "av-emre", label: "Emre (Macera)", category: "illustrated", url: "https://api.dicebear.com/7.x/adventurer/svg?seed=Emre" },
  { id: "av-ayse", label: "Ayşe (Macera)", category: "illustrated", url: "https://api.dicebear.com/7.x/adventurer/svg?seed=Ayse" },
  { id: "av-kaan", label: "Kaan (Macera)", category: "illustrated", url: "https://api.dicebear.com/7.x/adventurer/svg?seed=Kaan" },
  { id: "av-defne", label: "Defne (Macera)", category: "illustrated", url: "https://api.dicebear.com/7.x/adventurer/svg?seed=Defne" },
  { id: "av-merve", label: "Merve (İllüstrasyon)", category: "illustrated", url: "https://api.dicebear.com/7.x/lorelei/svg?seed=Merve" },
  { id: "av-kerem", label: "Kerem (İllüstrasyon)", category: "illustrated", url: "https://api.dicebear.com/7.x/lorelei/svg?seed=Kerem" },
  { id: "av-cem", label: "Cem (Minimalist)", category: "illustrated", url: "https://api.dicebear.com/7.x/micah/svg?seed=Cem" },
  { id: "av-ece", label: "Ece (Minimalist)", category: "illustrated", url: "https://api.dicebear.com/7.x/micah/svg?seed=Ece" },
  { id: "av-bora", label: "Bora (Notion)", category: "illustrated", url: "https://api.dicebear.com/7.x/notionists/svg?seed=Bora" },
  { id: "av-pelin", label: "Pelin (Notion)", category: "illustrated", url: "https://api.dicebear.com/7.x/notionists/svg?seed=Pelin" },
  { id: "av-alpha", label: "Agent Alpha (Bot)", category: "illustrated", url: "https://api.dicebear.com/7.x/bottts/svg?seed=AgentAlpha" },
  { id: "av-nova", label: "Agent Nova (Bot)", category: "illustrated", url: "https://api.dicebear.com/7.x/bottts/svg?seed=AgentNova" }
];

export const AVATAR_CATEGORIES = [
  { id: "all", label: "Tümü" },
  { id: "cinema", label: "Sinema & Efsaneler" },
  { id: "classic", label: "Klasik & Kurumsal" },
  { id: "illustrated", label: "Çizim & Robotik" }
];

export const ALL_AVATAR_ITEMS = [
  ...CINEMA_AVATARS,
  ...CLASSIC_AND_ILLUSTRATED_AVATARS
];

export const PRESET_AVATARS = [
  ...CLASSIC_AND_ILLUSTRATED_AVATARS.map((a) => a.url),
  ...CINEMA_AVATARS.map((a) => a.url)
];
