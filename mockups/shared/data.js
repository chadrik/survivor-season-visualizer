/*
 * Sample data for the layout mockups.
 * The seasons, tribes and castaways are fictional. They exist only to
 * exercise the layout: tribe swaps, a 3-to-2 tribe shuffle, merges,
 * every exit type, and players who return in later seasons.
 *
 * immunity: individual immunity wins, day -> winner name.
 * tribeImmunity: tribe immunity wins, day -> winning tribe names.
 * cast row: [name, tribe per phase, exit day, how, age, occupation, hometown]
 * "tribe per phase" has one entry for each phase the castaway reached.
 */
const SEASONS = [
  {
    num: 1, name: 'Isla Verde', days: 39,
    tribes: { Kona: '#e07a2f', Ravu: '#2f7fd0', Tamu: '#8b5cc4' },
    phases: [{ day: 1, label: 'Start' }, { day: 19, label: 'Merge' }],
    juryDay: 23,
    tribeImmunity: { 3: ['Ravu'], 6: ['Kona'], 9: ['Ravu'], 14: ['Kona'], 17: ['Ravu'] },
    immunity: { 21: 'Maya Chen', 23: 'Nia Okafor', 26: 'Dev Patel', 29: 'Maya Chen', 32: 'Priya Rao', 35: 'Nia Okafor', 38: 'Maya Chen' },
    cast: [
      ['Maya Chen',    ['Kona', 'Tamu'], 39, 'winner',   29, 'ER nurse',           'Portland, OR'],
      ['Dev Patel',    ['Kona', 'Tamu'], 38, 'voted',    34, 'Software sales',     'Austin, TX'],
      ['Rosa Alvarez', ['Kona', 'Tamu'], 32, 'voted',    41, 'Firefighter',        'Tucson, AZ'],
      ['Jada Brooks',  ['Kona', 'Tamu'], 37, 'medevac',  26, 'Grad student',       'Atlanta, GA'],
      ['Luis Ortega',  ['Kona', 'Tamu'], 23, 'voted',    38, 'Contractor',         'San Diego, CA'],
      ['Wendy Park',   ['Kona'],          9, 'voted',    52, 'Retired teacher',    'Columbus, OH'],
      ['Tom Becker',   ['Kona'],         17, 'voted',    45, 'Dairy farmer',       'Eau Claire, WI'],
      ['Gus Hall',     ['Kona'],          3, 'voted',    61, 'Fishing guide',      'Ketchikan, AK'],
      ['Nia Okafor',   ['Ravu', 'Tamu'], 39, 'finalist', 31, 'Attorney',           'Houston, TX'],
      ['Ben Archer',   ['Ravu', 'Tamu'], 29, 'voted',    27, 'Bartender',          'Boston, MA'],
      ['Priya Rao',    ['Ravu', 'Tamu'], 35, 'voted',    33, 'Pediatrician',       'Edison, NJ'],
      ['Tess Ward',    ['Ravu', 'Tamu'], 26, 'voted',    24, 'Lifeguard',          'Honolulu, HI'],
      ['Omar Haddad',  ['Ravu', 'Tamu'], 21, 'voted',    36, 'Chef',               'Dearborn, MI'],
      ['Carmen Lowe',  ['Ravu'],         11, 'quit',     47, 'Real estate agent',  'Miami, FL'],
      ['Eli Stone',    ['Ravu'],         14, 'voted',    22, 'College student',    'Boulder, CO'],
      ['Hank Mullins', ['Ravu'],          6, 'voted',    58, 'Long-haul trucker',  'Amarillo, TX'],
    ],
  },
  {
    num: 2, name: 'Coral Reach', days: 39,
    tribes: { Sela: '#2e9e6a', Moto: '#d64561', Lumo: '#d9a21b' },
    phases: [{ day: 1, label: 'Start' }, { day: 12, label: 'Tribe swap' }, { day: 19, label: 'Merge' }],
    juryDay: 23,
    tribeImmunity: { 3: ['Moto'], 8: ['Sela'], 11: ['Moto'], 14: ['Moto'], 17: ['Sela'] },
    immunity: { 21: 'Kai Turner', 23: 'Grace Obi', 26: 'Kai Turner', 28: 'Tess Ward', 31: 'Dev Patel', 33: 'Kai Turner', 38: 'Grace Obi' },
    cast: [
      ['Dev Patel',    ['Sela', 'Sela', 'Lumo'], 39, 'finalist', 36, 'Software sales',     'Austin, TX'],
      ['Ava Kim',      ['Sela', 'Sela', 'Lumo'], 28, 'rocks',    30, 'UX designer',        'Seattle, WA'],
      ['Marcus Reed',  ['Sela', 'Moto', 'Lumo'], 26, 'voted',    42, 'Police sergeant',    'Baltimore, MD'],
      ['June Holt',    ['Sela', 'Moto', 'Lumo'], 33, 'voted',    28, 'Nanny',              'Nashville, TN'],
      ['Raf Silva',    ['Sela', 'Moto'],         17, 'voted',    25, 'Surf instructor',    'Santa Cruz, CA'],
      ['Cole Byrne',   ['Sela', 'Sela'],         14, 'voted',    39, 'Airline pilot',      'Denver, CO'],
      ['Lena Fox',     ['Sela'],                 11, 'voted',    23, 'Barista',            'Brooklyn, NY'],
      ['Pete Novak',   ['Sela'],                  3, 'voted',    55, 'Mechanic',           'Pittsburgh, PA'],
      ['Tess Ward',    ['Moto', 'Moto', 'Lumo'], 39, 'winner',   26, 'Lifeguard',          'Honolulu, HI'],
      ['Kai Turner',   ['Moto', 'Sela', 'Lumo'], 38, 'fire',     29, 'Personal trainer',   'Los Angeles, CA'],
      ['Sam Ellis',    ['Moto', 'Moto', 'Lumo'], 23, 'voted',    35, 'Accountant',         'Chicago, IL'],
      ['Grace Obi',    ['Moto', 'Sela', 'Lumo'], 39, 'finalist', 44, 'Pastor',             'Charlotte, NC'],
      ['Noah Pratt',   ['Moto', 'Sela', 'Lumo'], 21, 'voted',    21, 'Student',            'Provo, UT'],
      ['Bea Santos',   ['Moto', 'Moto', 'Lumo'], 31, 'voted',    50, 'Bakery owner',       'El Paso, TX'],
      ['Zeke Romero',  ['Moto'],                  8, 'voted',    32, 'Rodeo clown',        'Cheyenne, WY'],
      ['Ivy Lund',     ['Moto'],                  5, 'medevac',  27, 'Marine biologist',   'Key West, FL'],
    ],
  },
  {
    num: 3, name: 'Ashfall', days: 39,
    tribes: { Ash: '#6b7785', Ember: '#e2603f', Cinder: '#c49a2c', Phoenix: '#2b93a3' },
    phases: [{ day: 1, label: 'Start' }, { day: 9, label: 'Tribe shuffle' }, { day: 17, label: 'Merge' }],
    juryDay: 21,
    tribeImmunity: { 2: ['Ember', 'Cinder'], 4: ['Ash', 'Ember'], 6: ['Ash', 'Cinder'], 8: ['Ash', 'Ember'], 11: ['Ash'], 13: ['Ember'], 15: ['Ash'] },
    immunity: { 19: 'Quinn Shaw', 21: 'Sofia Bianchi', 23: 'Maya Chen', 26: 'Dev Patel', 29: 'Ana Reyes', 32: 'Maya Chen', 35: 'Sofia Bianchi', 38: 'Maya Chen' },
    cast: [
      ['Maya Chen',    ['Ash', 'Ash', 'Phoenix'],      39, 'winner',   32, 'ER nurse',           'Portland, OR'],
      ['Owen Hart',    ['Ash', 'Ember', 'Phoenix'],    23, 'voted',    40, 'High school coach',  'Omaha, NE'],
      ['Lily Tran',    ['Ash', 'Ash', 'Phoenix'],      26, 'rocks',    27, 'Nail salon owner',   'Garden Grove, CA'],
      ['Fern Adler',   ['Ash', 'Ember'],               11, 'voted',    35, 'Park ranger',        'Bozeman, MT'],
      ['Theo Lin',     ['Ash', 'Ash', 'Phoenix'],      21, 'voted',    31, 'Data scientist',     'San Francisco, CA'],
      ['Rex Doyle',    ['Ash'],                         2, 'voted',    49, 'Bail bondsman',      'Las Vegas, NV'],
      ['Dev Patel',    ['Ember', 'Ash', 'Phoenix'],    35, 'voted',    37, 'Software sales',     'Austin, TX'],
      ['Sofia Bianchi',['Ember', 'Ember', 'Phoenix'],  39, 'finalist', 29, 'Opera singer',       'New York, NY'],
      ['Ray Kwan',     ['Ember', 'Ash'],               13, 'voted',    46, 'Dentist',            'Sacramento, CA'],
      ['Holly Dunn',   ['Ember'],                       6, 'voted',    24, 'Influencer',         'Scottsdale, AZ'],
      ['Vic Mora',     ['Ember', 'Ember'],             15, 'voted',    53, 'Longshoreman',       'Oakland, CA'],
      ['Ana Reyes',    ['Ember', 'Ember', 'Phoenix'],  39, 'finalist', 33, 'Social worker',      'San Antonio, TX'],
      ['Tess Ward',    ['Cinder', 'Ember', 'Phoenix'], 38, 'fire',     27, 'Lifeguard',          'Honolulu, HI'],
      ['Omar Haddad',  ['Cinder'],                      8, 'voted',    39, 'Chef',               'Dearborn, MI'],
      ['Quinn Shaw',   ['Cinder', 'Ash', 'Phoenix'],   32, 'voted',    28, 'Paramedic',          'Spokane, WA'],
      ['Bo Jensen',    ['Cinder'],                      4, 'voted',    60, 'Retired Marine',     'Duluth, MN'],
      ['Mila Ross',    ['Cinder', 'Ash', 'Phoenix'],   29, 'voted',    25, 'Pro gamer',          'Orlando, FL'],
      ['Ezra Cole',    ['Cinder', 'Ember', 'Phoenix'], 19, 'voted',    38, 'Carpenter',          'Asheville, NC'],
    ],
  },
];
