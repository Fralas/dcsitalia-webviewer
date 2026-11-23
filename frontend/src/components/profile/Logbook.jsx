// DCS unit type -> readable name; unknown types fall back to the raw name without underscores.
const AIRCRAFT_NAMES = {
  'F-16C_50': 'F-16C Viper',
  'FA-18C_hornet': 'F/A-18C Hornet',
  'F-14B': 'F-14B Tomcat',
  'F-14A-135-GR': 'F-14A Tomcat',
  'F-15ESE': 'F-15E Strike Eagle',
  'F-15C': 'F-15C Eagle',
  'A-10C_2': 'A-10C II',
  'A-10C': 'A-10C',
  'AV8BNA': 'AV-8B Harrier',
  'AH-64D_BLK_II': 'AH-64D Apache',
  'Ka-50_3': 'Ka-50 III',
  'Mi-24P': 'Mi-24P Hind',
  'Mi-8MT': 'Mi-8MTV2',
  'UH-1H': 'UH-1H Huey',
  'OH58D': 'OH-58D Kiowa',
  'CH-47Fbl1': 'CH-47F Chinook',
  'M-2000C': 'Mirage 2000C',
  'JF-17': 'JF-17 Thunder',
  'MiG-29 Fulcrum': 'MiG-29',
  'Su-25T': 'Su-25T',
  'AJS37': 'AJS37 Viggen',
  'F-5E-3': 'F-5E Tiger II',
  'C-130J-30': 'C-130J',
};

export function aircraftName(type) {
  return AIRCRAFT_NAMES[type] || String(type || '?').replace(/_/g, ' ');
}
