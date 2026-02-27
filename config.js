/* ───────── CONFIG & DATA ───────── */
let library = []; 
let config = {
  theme: '#B8B6BF',
  saveInterval: 30,
  dimReady: true,
  emuVersion: 'stable',
  enableDebug: false,
  enableThreads: true,
  autoUnzip: true,
  autoHash: true,
  resScale: 1.0,
  metadataSource: 'hasheous',
  fullscreenOnLoad: false,
  netplayUrl: '',
  dontExtractBios: false,
  forceLegacyCores: false,
  hideSettings: false,
  gDriveClientId: '',
  gDriveApiKey: '',
  storeUrl: 'https://cdn.jsdelivr.net/gh/boopdooboopdoo-stack/emudb-store@master/store.json?v=' + Date.now(),
  // Video Filters
  videoFilters: {
      hue: 0,
      saturation: 100,
      brightness: 100,
      contrast: 100,
      sepia: 0,
      blur: 0,
      blendMode: 'normal'
  },
  customCss: '', 
  customPaths: '', 
  loaderPath: '', 
  autoLoadSave: true,
  saveOnExit: true,
  controlMapping: '', 
  customCores: [] 
};

const coreGroups = {
 "Nintendo": {
    "fceumm": "NES (FCEUmm)",
    "nestopia": "NES (Nestopia)",
    "snes": "SNES (Snes9x)",
    "mupen64plus_next": "Nintendo 64 (Mupen64)",
    "parallel_n64": "Nintendo 64 (Parallel)", 
    "gb": "Game Boy (Gambatte)",
    "gbc": "Game Boy Color (Gambatte)",
    "gba": "Game Boy Advance (mGBA)",
    "nds": "Nintendo DS (MelonDS)",
    "desmume": "Nintendo DS (DeSmuME)",
    "virtualboy": "Virtual Boy (Beetle VB)",
    "pokemini": "Pokemon Mini"
  },
  "Sega": {
    "sms": "Master System (Genesis Plus GX)",
    "gg": "Game Gear (Genesis Plus GX)",
    "segaMD": "Genesis (Genesis Plus GX)",
    "picodrive": "Genesis (PicoDrive)",
    "segaCD": "Sega CD (Genesis Plus GX)",
    "sega32x": "Sega 32X (Picodrive)",
    "saturn": "Sega Saturn (Yabause)",
    "sg1000": "SG-1000"
  },
  "PlayStation": {
    "psx": "PlayStation (Beetle PSX HW)",
    "pcsx_rearmed": "PlayStation (PCSX ReARMed)",
    "psp": "PSP (PPSSPP)"
  },
  "Web / Modern": {
      "flash": "Flash (Ruffle)",
      "unity": "Unity (Web Build)",
      "godot": "Godot (Web Build)",
      "clickteam": "Clickteam Fusion (HTML5)",
      "emscripten": "Emscripten / HTML5",
      "webretro": "WebRetro (Standalone)"
  },
  "Arcade": {
    "mame2003": "Arcade (MAME 2003)",
    "mame2003_plus": "Arcade (MAME 2003 +)",
    "fbneo": "Arcade (FinalBurn Neo)",
  },
  "Atari": {
    "atari2600": "Atari 2600 (Stella)",
    "atari5200": "Atari 5200 (Atari800)",
    "atari7800": "Atari 7800 (ProSystem)",
    "atari800": "Atari 800/XE",
    "lynx": "Atari Lynx (Handy)",
    "jaguar": "Atari Jaguar (Virtual Jaguar)"
  },
  "NEC": {
    "pce": "PC Engine / TG16 (Beetle PCE)",
    "pcecd": "PC Engine CD (Beetle PCE)",
    "pcfx": "PC-FX (Beetle PC-FX)"
  },
  "Computers / Other": {
    "amiga": "Amiga (P-UAE)",
    "c64": "Commodore 64 (Vice)",
    "dosbox_pure": "DOS (DOSBox Pure)",
    "msx": "MSX (fMSX)",
    "zxspectrum": "ZX Spectrum (Fuse)",
    "x68000": "Sharp X68000",
    "3do": "3DO (Opera)",
    "wswan": "WonderSwan (Beetle Cygne)",
    "coleco": "ColecoVision",
    "ngp": "Neo Geo Pocket (Beetle NGP)"
  }
};

const ALIAS_MAP = {
    "snes": "snes9x", "gb": "gambatte", "gbc": "gambatte", "gba": "mgba", "nds": "melonds",
    "virtualboy": "beetle_vb", "sms": "genesis_plus_gx", "gg": "genesis_plus_gx",
    "segaMD": "segaMD", "segaCD": "genesis_plus_gx", "psx": "mednafen_psx_hw",
    "psp": "ppsspp", "pce": "mednafen_pce_fast", "pcecd": "mednafen_pce_fast",
    "pcfx": "mednafen_pcfx", "ngp": "mednafen_ngp", "wswan": "mednafen_wswan",
    "amiga": "puae", "c64": "vice_x64", "coleco": "gearcoleco", "x68000": "px68k"
};

const EXT_MAP = {
  nes: 'fceumm', fds: 'nestopia',
  snes: 'snes', sfc: 'snes', smc: 'snes',
  gba: 'gba', gb: 'gb', gbc: 'gbc',
  n64: 'mupen64plus_next', z64: 'mupen64plus_next',
  nds: 'nds',
  md: 'segaMD', gen: 'segaMD', smd: 'segaMD',
  sms: 'sms', gg: 'gg',
  pce: 'pce',
  psx: 'psx', bin: 'psx', cue: 'psx', pbp: 'psx', chd: 'psx', iso: 'psx',
  psp: 'psp', cso: 'psp',
  zip: 'fbneo',
  jag: 'jaguar', j64: 'jaguar',
  a26: 'atari2600', a52: 'atari5200', a78: 'atari7800',
  ngp: 'ngp', ngc: 'ngp',
  ws: 'wswan', wsc: 'wswan',
  lnx: 'lynx',
  vb: 'virtualboy',
  swf: 'flash'
};

const AMBIGUOUS_EXTS = ['zip', 'iso', 'bin', 'cue', 'chd', 'img', 'm3u'];

const LIBRETRO_MAP = {
  'fceumm': 'Nintendo_-_Nintendo_Entertainment_System',
  'nestopia': 'Nintendo_-_Nintendo_Entertainment_System',
  'snes': 'Nintendo_-_Super_Nintendo_Entertainment_System',
  'gba': 'Nintendo_-_Game_Boy_Advance',
  'gb': 'Nintendo_-_Game_Boy',
  'mupen64plus_next': 'Nintendo_-_Nintendo_64',
  'parallel_n64': 'Nintendo_-_Nintendo_64',
  'nds': 'Nintendo_-_Nintendo_DS',
  'psx': 'Sony_-_PlayStation',
  'psp': 'Sony_-_PlayStation_Portable',
  'segaMD': 'Sega_-_Mega_Drive_-_Genesis',
  'sms': 'Sega_-_Master_System_-_Mark_III',
  'gg': 'Sega_-_Game_Gear',
  'pce': 'NEC_-_PC_Engine_-_TurboGrafx_16',
};