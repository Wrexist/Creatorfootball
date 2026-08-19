import type { NameBankDef } from '../../schema';

/**
 * The name bank for the fictional universe.
 *
 * Every entry here is original fiction or an ordinary given/family name that
 * belongs to no one in particular. Nations are invented outright — the game
 * ships no real country names, so that a generated squad can never read as a
 * claim about a real place. Weights exist so a save has a recognisable
 * demographic texture instead of a uniform sample.
 */

const w = (value: string, weight = 1) => ({ value, weight });

const FIRST_NAMES: readonly { value: string; weight?: number }[] = [
  w('Adrian', 3), w('Aksel'), w('Alden'), w('Alek', 2), w('Aleric'), w('Amari', 2),
  w('Ander', 2), w('Ansel'), w('Anton', 3), w('Arlo', 2), w('Armand'), w('Arvid'),
  w('Ashwin'), w('Aurelio'), w('Bardo'), w('Basil'), w('Bastien', 2), w('Bekir'),
  w('Benedikt'), w('Beniam'), w('Bertil'), w('Bilal', 2), w('Bram', 2), w('Brennan', 2),
  w('Caius'), w('Caleb', 3), w('Callum', 3), w('Casimir'), w('Cato'), w('Cedric', 2),
  w('Cesar', 2), w('Cillian'), w('Ciro'), w('Conrad', 2), w('Corin'), w('Cyrus', 2),
  w('Damir', 2), w('Danilo', 2), w('Dario', 2), w('Davor'), w('Declan', 2), w('Demir'),
  w('Denys'), w('Dimitri', 2), w('Dorian', 2), w('Duarte'), w('Eamon'), w('Edvin'),
  w('Efraim'), w('Eli', 2), w('Elias', 3), w('Elian'), w('Emeka', 2), w('Emil', 3),
  w('Enzo', 2), w('Erian'), w('Esben'), w('Ezra', 2), w('Fabian', 3), w('Faron'),
  w('Federico', 2), w('Felix', 3), w('Fenn'), w('Ferran'), w('Filip', 2), w('Finlay', 2),
  w('Finn', 2), w('Florian', 2), w('Fyodor'), w('Gabriel', 3), w('Galen'), w('Garrick'),
  w('Gaspar'), w('Gideon'), w('Gil'), w('Gilles'), w('Giorgi'), w('Gjert'), w('Goran'),
  w('Gustav', 2), w('Hadrian'), w('Hakim', 2), w('Hale'), w('Halvor'), w('Hamza', 2),
  w('Harel'), w('Haruki'), w('Hasan', 2), w('Hector', 2), w('Henrik', 2), w('Hugo', 3),
  w('Iago'), w('Ibrahim', 2), w('Idan'), w('Idris', 2), w('Ilias'), w('Ilya', 2),
  w('Imran', 2), w('Inigo'), w('Ioan'), w('Isak', 2), w('Ivar'), w('Ivo'), w('Jarek'),
  w('Jarno'), w('Javier', 2), w('Jem'), w('Jerome', 2), w('Joaquim'), w('Jonas', 3),
  w('Jorin'), w('Josip'), w('Julen'), w('Kabir'), w('Kacper', 2), w('Kadir'), w('Kai', 3),
  w('Kalle'), w('Karim', 3), w('Kasper', 2), w('Kazim'), w('Keiran', 2), w('Kenji'),
  w('Kevan'), w('Kian', 2), w('Kiril'), w('Klaus'), w('Kofi', 2), w('Konrad', 2),
  w('Lars', 2), w('Laszlo'), w('Lauri'), w('Leander'), w('Leif'), w('Lennart'),
  w('Leonel'), w('Levi', 2), w('Liam', 3), w('Lorcan'), w('Lorenz', 2), w('Loris'),
  w('Luca', 3), w('Ludvig'), w('Lukas', 3), w('Mads', 2), w('Mahdi'), w('Malik', 2),
  w('Marek', 2), w('Mario', 2), w('Marius', 2), w('Marko', 2), w('Mateo', 3),
  w('Mathis', 2), w('Matteo', 3), w('Maxim', 2), w('Mehdi'), w('Melker'), w('Milen', 2),
  w('Milos'), w('Mirko'), w('Mohan'), w('Nabil'), w('Nasir', 2), w('Nathan', 3),
  w('Nikola', 2), w('Nils', 2), w('Noah', 3), w('Nuno'), w('Odin'), w('Olav'), w('Oleg'),
  w('Omar', 3), w('Oriol'), w('Orrin'), w('Osric'), w('Oskar', 2), w('Otto', 2),
  w('Ozan'), w('Paavo'), w('Pablo', 2), w('Pascal', 2), w('Patrik', 2), w('Pavel', 2),
  w('Pelle'), w('Petar', 2), w('Pierce'), w('Quentin'), w('Quill'), w('Radek'),
  w('Rafferty'), w('Rahim'), w('Raoul'), w('Rasmus', 2), w('Ravi', 2), w('Reidar'),
  w('Remi', 2), w('Rene', 2), w('Ricardo', 2), w('Rikard'), w('Rion'), w('Robin', 2),
  w('Rocco', 2), w('Roderic'), w('Rohan', 2), w('Roman', 2), w('Ronin'), w('Rory', 2),
  w('Ruben', 3), w('Rufus'), w('Rune'), w('Sacha'), w('Salim'), w('Samir', 2),
  w('Sander', 2), w('Santi', 2), w('Sasha'), w('Seamus'), w('Sebastian', 3), w('Selim'),
  w('Senna'), w('Serge'), w('Sergei', 2), w('Silas', 2), w('Simeon'), w('Sindre'),
  w('Soren', 2), w('Stefan', 3), w('Stellan'), w('Sven', 2), w('Taavi'), w('Tadeo'),
  w('Talin'), w('Tamas'), w('Tarik', 2), w('Tavish'), w('Teodor', 2), w('Thaddeus'),
  w('Theo', 3), w('Thiago', 2), w('Thom', 2), w('Tiago', 2), w('Tobias', 3), w('Tomas', 2),
  w('Torin'), w('Tristan', 2), w('Tuomas'), w('Ulrik'), w('Umar', 2), w('Uriel'),
  w('Valen'), w('Valter'), w('Vasco'), w('Veit'), w('Vidar'), w('Viggo', 2), w('Viktor', 3),
  w('Vincent', 2), w('Vito'), w('Vlad'), w('Wilhelm'), w('Wren'), w('Xander', 2),
  w('Yannick', 2), w('Yaro'), w('Yusuf', 3), w('Yves'), w('Zaid'), w('Zane', 2),
  w('Zeno'), w('Zoran'), w('Zubair'),
];

const LAST_NAMES: readonly { value: string; weight?: number }[] = [
  w('Abernathy'), w('Acheson'), w('Adeyemi', 2), w('Ahlgren'), w('Albrecht', 2),
  w('Almeida', 2), w('Alvarsson'), w('Amado'), w('Andric', 2), w('Ansell'), w('Arbelo'),
  w('Ashcombe'), w('Aubert', 2), w('Avram'), w('Badeau'), w('Bakke'), w('Balder'),
  w('Balint'), w('Baptiste', 2), w('Barlow', 2), w('Barros', 2), w('Bassey', 2),
  w('Baumann', 2), w('Beckwith'), w('Belenko'), w('Benedek'), w('Beringer'), w('Bernal', 2),
  w('Bexley'), w('Birkeland'), w('Bjornsen'), w('Blackwood'), w('Blanchet'), w('Bodnar'),
  w('Bolander'), w('Boone'), w('Borisov', 2), w('Bouchard', 2), w('Bracknell'),
  w('Brandt', 2), w('Bregovic'), w('Brennan', 2), w('Bright'), w('Brockway'), w('Broz'),
  w('Bruns'), w('Buckley', 2), w('Burkhart'), w('Cadogan'), w('Caldera'), w('Calloway'),
  w('Cardoso', 2), w('Carew'), w('Castellan'), w('Cavanaugh'), w('Cerny'), w('Chandra', 2),
  w('Charbonneau'), w('Chevalier'), w('Chirico'), w('Clayborne'), w('Coetzee', 2),
  w('Colombo', 2), w('Conteh', 2), w('Cortez', 2), w('Costa', 3), w('Crane'),
  w('Crossley'), w('Dalgaard'), w('Dallimore'), w('Damek'), w('Danvers'), w('Darroch'),
  w('Davenport'), w('Delacroix'), w('Devereux'), w('Dhaliwal', 2), w('Dinescu'),
  w('Dobrev'), w('Donnelly', 2), w('Dragos'), w('Drummond', 2), w('Dubois', 2),
  w('Dukes'), w('Duvall'), w('Eberhardt'), w('Eklund', 2), w('Elmore'), w('Engstrom', 2),
  w('Esposito', 2), w('Fabron'), w('Fairweather'), w('Falk', 2), w('Farkas'),
  w('Faulkner', 2), w('Fenwick'), w('Ferreira', 3), w('Fiorelli'), w('Flanagan', 2),
  w('Fontaine', 2), w('Forsberg', 2), w('Fournier', 2), w('Freeland'), w('Gadd'),
  w('Gallardo', 2), w('Garrity'), w('Gauthier', 2), w('Gehring'), w('Ghosh', 2),
  w('Gillespie', 2), w('Girard', 2), w('Gjertsen'), w('Goodwin', 2), w('Granger'),
  w('Grimshaw'), w('Gronda'), w('Guerrero', 2), w('Haddad', 2), w('Hagen', 2),
  w('Halloran'), w('Halvorsen', 2), w('Hammond', 2), w('Hanley'), w('Harkness'),
  w('Hartley', 2), w('Havel'), w('Hedlund'), w('Heinonen', 2), w('Hendricks', 2),
  w('Hollis'), w('Holtz'), w('Horvath', 2), w('Hoxha'), w('Ibarra', 2), w('Ilic', 2),
  w('Ingram', 2), w('Iversen', 2), w('Jablonski'), w('Jager'), w('Jancic'), w('Jarvis', 2),
  w('Jelinek'), w('Jensen', 3), w('Kaminski', 2), w('Karlsen', 2), w('Kastelic'),
  w('Kaur', 2), w('Kavanagh', 2), w('Keldar'), w('Keller', 2), w('Kendrick'),
  w('Khouri', 2), w('Kilbride'), w('Kingsley'), w('Kirilov'), w('Kjaer', 2), w('Kolar'),
  w('Kovac', 2), w('Kramer', 2), w('Krause', 2), w('Kristiansen', 2), w('Kruger', 2),
  w('Laakso'), w('Lachance'), w('Lambert', 2), w('Landry'), w('Larkin', 2), w('Larsen', 3),
  w('Latimer'), w('Laurent', 2), w('Leclair'), w('Lehtinen', 2), w('Lennox'), w('Leone', 2),
  w('Lindqvist', 2), w('Linnell'), w('Ljung'), w('Lockhart'), w('Lombardi', 2),
  w('Loveridge'), w('Lund', 2), w('Macarthur'), w('Madsen', 2), w('Magnusson', 2),
  w('Maher'), w('Malik', 2), w('Mancuso'), w('Marchetti', 2), w('Marsh', 2), w('Martel'),
  w('Mascarenhas'), w('Mateus'), w('Mattsson', 2), w('Maxwell', 2), w('Mbaye', 2),
  w('Medina', 2), w('Mehta', 2), w('Melnyk'), w('Mercier', 2), w('Merrick'),
  w('Mikkelsen', 2), w('Milanovic'), w('Millward'), w('Moldovan'), w('Molina', 2),
  w('Monteiro', 2), w('Moreau', 2), w('Mortensen', 2), w('Mowbray'), w('Munoz', 2),
  w('Murtagh'), w('Nadeau'), w('Nagy', 2), w('Nakamura', 2), w('Navarro', 2), w('Neagu'),
  w('Nesbitt'), w('Nilsson', 3), w('Norberg'), w('Novak', 2), w('Nyland'), w('Oakes'),
  w('Obermann'), w('Odhiambo', 2), w('Ogilvie'), w('Okafor', 2), w('Olander'),
  w('Oliveira', 3), w('Olsen', 3), w('Orlov', 2), w('Ortega', 2), w('Osei', 2),
  w('Ostrowski'), w('Paavola'), w('Pacheco', 2), w('Palmer', 2), w('Panetta'),
  w('Papadakis', 2), w('Parrish'), w('Pastore'), w('Pavlenko'), w('Pedersen', 3),
  w('Pellegrini', 2), w('Pereira', 3), w('Petrov', 2), w('Pham', 2), w('Pichler'),
  w('Piotrowski'), w('Polanco'), w('Prakash', 2), w('Prieto'), w('Quintero', 2),
  w('Rademaker'), w('Radu', 2), w('Rasmussen', 2), w('Rautio'), w('Ravenscroft'),
  w('Redmond', 2), w('Reinhart'), w('Renard', 2), w('Ribeiro', 2), w('Richter', 2),
  w('Rios', 2), w('Rivas', 2), w('Rodrigo', 2), w('Rojas', 2), w('Rosales'),
  w('Rowntree'), w('Rudnicki'), w('Ruiz', 2), w('Rutherford'), w('Saldana'),
  w('Salinas', 2), w('Sandoval', 2), w('Sarkis'), w('Savu'), w('Sawyer', 2),
  w('Schreiber'), w('Sekulic'), w('Serrano', 2), w('Sharpe', 2), w('Sidorov'),
  w('Silvestri'), w('Sinclair', 2), w('Skov'), w('Slater', 2), w('Sobek'), w('Solberg', 2),
  w('Sorensen', 2), w('Spellman'), w('Stafford', 2), w('Stanek'), w('Steinberg'),
  w('Stern'), w('Stjepanovic'), w('Strand'), w('Sundqvist'), w('Suzuki', 2),
  w('Sweeney', 2), w('Szabo', 2), w('Takahashi', 2), w('Talbot', 2), w('Tanaka', 2),
  w('Tandy'), w('Tavares', 2), w('Teixeira', 2), w('Thackeray'), w('Thorne', 2),
  w('Tikkanen'), w('Tobar'), w('Toivonen', 2), w('Torrance'), w('Trevino', 2),
  w('Tudor'), w('Ulmer'), w('Underwood', 2), w('Vaccaro'), w('Valdez', 2), w('Vance'),
  w('Vanterpool'), w('Varga', 2), w('Vasquez', 2), w('Veldman'), w('Verhoeven', 2),
  w('Vermeulen', 2), w('Vidmar'), w('Villanueva', 2), w('Vinter'), w('Volkov', 2),
  w('Vranic'), w('Wachter'), w('Wainwright'), w('Waldron'), w('Wallis'), w('Warburton'),
  w('Weaver', 2), w('Weiss', 2), w('Wexford'), w('Whitlock'), w('Wickham'), w('Wilding'),
  w('Winslow'), w('Wojcik', 2), w('Wren'), w('Yalcin', 2), w('Yamada', 2), w('Yates', 2),
  w('Yilmaz', 2), w('Zaharia'), w('Zajac'), w('Zamora', 2), w('Zeller'), w('Ziegler', 2),
  w('Zimmer'), w('Zoric'), w('Zuniga', 2), w('Zwart'),
];

/** Invented settlements. The twelve league cities come first. */
const CITIES: readonly string[] = [
  'Ironhollow', 'Saltpine', 'Marrowgate', 'Duskford', 'Cinderwick', 'Verrow',
  'Lowmarket', 'Halcyon Reach', 'Redmere', 'Aurelia', 'Larkspur', 'Emberfield',
  'Ashvale', 'Northgate', 'Kestrel Bay', 'Highmarsh', 'Stonecleft', 'Thornbury',
  'Halloway', 'Wren Hollow', 'Bracken Hill', 'Coldharbour', 'Foxgate', 'Garrowdale',
  'Hallowmere', 'Ivyport', 'Junehill', 'Kirkfell', 'Longstrand', 'Millbrook',
  'Netherfield', 'Oakhaven', 'Pinecross', 'Quarrytown', 'Ravensmoor', 'Sablewick',
  'Tallowford', 'Underhill', 'Vellacourt', 'Westhollow', 'Yarrowfield', 'Zephyr Point',
  'Amberdown', 'Bellcastle', 'Cliffholt', 'Drakemoor', 'Elmshade', 'Farrowgate',
  'Glasswater', 'Hearthstone', 'Inglemoor', 'Jasperfield', 'Keldmoor', 'Lanternhill',
  'Moorcross', 'Nightvale', 'Orchardgate', 'Pelbury', 'Quillon', 'Rushmere',
  'Steepleford', 'Tinderbrook', 'Umberfell', 'Vaunt Harbour', 'Whitmarsh', 'Yewbridge',
  'Ashenford', 'Brimhaven', 'Dunmere', 'Everly', 'Fallowmoor', 'Grimhold', 'Hollowmere',
];

const CLUB_PREFIXES: readonly string[] = [
  'FC', 'AC', 'SC', 'Sporting', 'Athletic', 'Union', 'Club', 'Racing', 'Vale',
  'North', 'South', 'East', 'West', 'Old', 'New', 'Royal', 'Free', 'Iron',
  'Crown', 'Signal',
];

const CLUB_SUFFIXES: readonly string[] = [
  'United', 'City', 'Rovers', 'Wanderers', 'Athletic', 'Town', 'Anvil', 'Harbour',
  'Forge', 'Republic', 'Collective', 'Union', 'Wharf', 'Star', 'Park', 'Hollow',
  'Gate', 'Works', 'Vale', 'Point', 'Nine', 'Row', 'Sons', 'Guild',
];

/** Social handles for generated fans, pundits and bit-part creators. */
const HANDLES: readonly string[] = [
  'boxtoboxbrando', 'thefinalthird', 'lowblocklad', 'xgobsessed', 'terracetalk',
  'kitnerd', 'gafferbrain', 'offsidetrapped', 'setpieceszn', 'thirdyellow',
  'nilnilnation', 'thebackpost', 'pressresistant', 'tikitakatoby', 'roundtheback',
  'halfspacehenri', 'chalkboardchris', 'inswingerinc', 'longthrowlore', 'notaphoto',
  'frontfootfc', 'grassrootsgav', 'thepitchinvader', 'sixyardsermon', 'ultratsunami',
  'awaydaysonly', 'seasonticketsam', 'thescoutsnotes', 'transferbin', 'itkorbust',
  'onlyxgmatters', 'pressurecooker', 'thetunnelcam', 'gegenpressgran', 'lastditchlou',
  'wingerwatch', 'clipboardcult', 'thebadgekiss', 'stoppagetimes', 'flairmerchant',
  'gafferwatch', 'thefanzine', 'thelowdownfc', 'matchdaymarrow', 'ninetyplusfive',
  'squadgoalpost', 'benchmobbing', 'thefullback', 'holdingmid', 'falseninefiles',
  'topbinsonly', 'thewoodwork', 'cleansheetcult', 'keeperunion', 'greenandgone',
  'thecornerflag', 'noisyend', 'northstandnat', 'southstandsid', 'awayendecho',
  'tacticstuesday', 'analyticsanya', 'scoutedout', 'wonderkidwatch', 'academyarc',
  'contractclause', 'agentcalls', 'deadlinedread', 'medicalbooked', 'herewegoagain',
  'thelockerroom', 'dressingdownfc', 'moraleboost', 'trainingtopmenu', 'coneworkonly',
  'thephysioroom', 'strappedup', 'minutesmanaged', 'rotationriot', 'benchwarmerbrand',
  'thehypeman', 'creatorcorner', 'streamsniped', 'clipchaser', 'vodreview',
  'thepundit', 'hotmicmoment', 'presserpanic', 'quoteunquotefc', 'headlinehunter',
];

/**
 * Invented nations. Weights make the league feel like it sits inside one
 * region — Valkiran and Ostrean players dominate — while the long tail keeps
 * squads from reading as a monoculture.
 */
const NATIONALITIES: readonly { code: string; name: string; weight: number }[] = [
  { code: 'VLK', name: 'Valkiran', weight: 22 },
  { code: 'OST', name: 'Ostrean', weight: 15 },
  { code: 'ANT', name: 'Antaran', weight: 11 },
  { code: 'KRS', name: 'Korshavi', weight: 9 },
  { code: 'MRD', name: 'Meridic', weight: 8 },
  { code: 'TBR', name: 'Tiberran', weight: 7 },
  { code: 'SLV', name: 'Selvani', weight: 6 },
  { code: 'DRA', name: 'Dravian', weight: 6 },
  { code: 'NHV', name: 'Norhavi', weight: 5 },
  { code: 'ZAM', name: 'Zamoran', weight: 5 },
  { code: 'ELD', name: 'Eldish', weight: 4.5 },
  { code: 'PAL', name: 'Palvorian', weight: 4 },
  { code: 'CST', name: 'Castelan', weight: 4 },
  { code: 'AKR', name: 'Akrothi', weight: 3.5 },
  { code: 'BLN', name: 'Balunese', weight: 3 },
  { code: 'VRD', name: 'Verdanian', weight: 3 },
  { code: 'HRK', name: 'Harkoni', weight: 2.5 },
  { code: 'SUN', name: 'Sundari', weight: 2.5 },
  { code: 'TOL', name: 'Tolmec', weight: 2 },
  { code: 'KAI', name: 'Kaiyari', weight: 2 },
  { code: 'GRM', name: 'Grimsdaler', weight: 1.8 },
  { code: 'LTH', name: 'Lithran', weight: 1.6 },
  { code: 'OMB', name: 'Ombrian', weight: 1.4 },
  { code: 'NKA', name: 'Nkasi', weight: 1.2 },
  { code: 'QIR', name: 'Qirani', weight: 1 },
];

export const BASE_NAME_BANK: NameBankDef = {
  firstNames: FIRST_NAMES,
  lastNames: LAST_NAMES,
  clubPrefixes: CLUB_PREFIXES,
  clubSuffixes: CLUB_SUFFIXES,
  cities: CITIES,
  handles: HANDLES,
  nationalities: NATIONALITIES,
};

/** Lookup used by the UI and by media/social copy. */
export const NATIONALITY_NAMES: Readonly<Record<string, string>> = Object.fromEntries(
  NATIONALITIES.map((n) => [n.code, n.name]),
);
