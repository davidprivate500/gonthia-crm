import { BaseLocalizationProvider } from '../index';

export class DEProvider extends BaseLocalizationProvider {
  country = 'DE';
  countryName = 'Germany';
  timezone = 'Europe/Berlin';
  currency = 'EUR';
  phonePrefix = '+49';

  protected firstNamesMale = [
    'Lukas', 'Leon', 'Finn', 'Paul', 'Jonas', 'Felix', 'Noah', 'Elias',
    'Ben', 'Luis', 'Maximilian', 'Luca', 'Alexander', 'Julian', 'Moritz',
    'Jan', 'Tim', 'David', 'Niklas', 'Simon', 'Tom', 'Max', 'Philipp',
    'Erik', 'Fabian', 'Sebastian', 'Daniel', 'Michael', 'Thomas', 'Christian',
    'Markus', 'Stefan', 'Andreas', 'Martin', 'Tobias', 'Patrick', 'Marco',
    'Florian', 'Kevin', 'Marcel', 'Dennis', 'Dominik', 'Benjamin', 'Matthias',
    'Johannes', 'Peter', 'Frank', 'Klaus', 'Wolfgang', 'Hans', 'Juergen',
  ];

  protected firstNamesFemale = [
    'Emma', 'Mia', 'Hannah', 'Sofia', 'Anna', 'Lea', 'Emilia', 'Marie',
    'Lena', 'Leonie', 'Amelie', 'Luisa', 'Johanna', 'Laura', 'Lina', 'Clara',
    'Sophie', 'Charlotte', 'Mila', 'Ella', 'Nele', 'Paula', 'Ida', 'Julia',
    'Sarah', 'Lisa', 'Jana', 'Katharina', 'Christina', 'Sabine', 'Petra',
    'Monika', 'Andrea', 'Nicole', 'Stefanie', 'Melanie', 'Claudia', 'Susanne',
    'Martina', 'Birgit', 'Kerstin', 'Heike', 'Silke', 'Anja', 'Katja',
    'Franziska', 'Simone', 'Daniela', 'Sandra', 'Tanja', 'Jennifer', 'Vanessa',
  ];

  protected lastNames = [
    'Mueller', 'Schmidt', 'Schneider', 'Fischer', 'Weber', 'Meyer', 'Wagner',
    'Becker', 'Schulz', 'Hoffmann', 'Schaefer', 'Koch', 'Bauer', 'Richter',
    'Klein', 'Wolf', 'Schroeder', 'Neumann', 'Schwarz', 'Zimmermann', 'Braun',
    'Krueger', 'Hofmann', 'Hartmann', 'Lange', 'Schmitt', 'Werner', 'Schmitz',
    'Krause', 'Meier', 'Lehmann', 'Schmid', 'Schulze', 'Maier', 'Koehler',
    'Herrmann', 'Koenig', 'Walter', 'Mayer', 'Huber', 'Kaiser', 'Fuchs',
    'Peters', 'Lang', 'Scholz', 'Moeller', 'Weiss', 'Jung', 'Hahn', 'Vogel',
  ];

  protected cities = [
    { name: 'Berlin', state: 'Berlin', postalCode: '10115' },
    { name: 'Hamburg', state: 'Hamburg', postalCode: '20095' },
    { name: 'Munich', state: 'Bayern', postalCode: '80331' },
    { name: 'Cologne', state: 'Nordrhein-Westfalen', postalCode: '50667' },
    { name: 'Frankfurt', state: 'Hessen', postalCode: '60311' },
    { name: 'Stuttgart', state: 'Baden-Wuerttemberg', postalCode: '70173' },
    { name: 'Duesseldorf', state: 'Nordrhein-Westfalen', postalCode: '40213' },
    { name: 'Dortmund', state: 'Nordrhein-Westfalen', postalCode: '44135' },
    { name: 'Essen', state: 'Nordrhein-Westfalen', postalCode: '45127' },
    { name: 'Leipzig', state: 'Sachsen', postalCode: '04109' },
    { name: 'Bremen', state: 'Bremen', postalCode: '28195' },
    { name: 'Dresden', state: 'Sachsen', postalCode: '01067' },
    { name: 'Hanover', state: 'Niedersachsen', postalCode: '30159' },
    { name: 'Nuremberg', state: 'Bayern', postalCode: '90402' },
    { name: 'Duisburg', state: 'Nordrhein-Westfalen', postalCode: '47051' },
    { name: 'Bochum', state: 'Nordrhein-Westfalen', postalCode: '44787' },
    { name: 'Wuppertal', state: 'Nordrhein-Westfalen', postalCode: '42103' },
    { name: 'Bielefeld', state: 'Nordrhein-Westfalen', postalCode: '33602' },
    { name: 'Bonn', state: 'Nordrhein-Westfalen', postalCode: '53111' },
    { name: 'Muenster', state: 'Nordrhein-Westfalen', postalCode: '48143' },
  ];

  protected streetTypes = [
    'Strasse', 'Weg', 'Allee', 'Platz', 'Ring', 'Gasse', 'Damm', 'Ufer',
  ];

  protected companySuffixes = [
    'GmbH', 'AG', 'KG', 'OHG', 'e.K.', 'GmbH & Co. KG', 'SE', 'UG',
  ];

  protected companyWords = [
    'Deutsche', 'Erste', 'Europa', 'Global', 'Inter', 'Multi', 'Nord', 'Sued',
    'Ost', 'West', 'Zentral', 'Technik', 'Handel', 'Industrie', 'Beratung',
    'Service', 'System', 'Gruppe', 'Consulting', 'Solutions', 'Engineering',
    'Finanz', 'Immobilien', 'Medien', 'Digital', 'Software', 'Data', 'Netz',
  ];

  protected emailDomains = [
    'gmail.com', 'gmx.de', 'web.de', 'outlook.de', 't-online.de', 'freenet.de',
    'yahoo.de', 'posteo.de', 'mail.de', 'arcor.de', '1und1.de', 'vodafone.de',
  ];

  phone(): string {
    const areaCodes = [
      '30', '40', '69', '89', '221', '211', '711', '341', '351', '421',
      '511', '231', '201', '911', '203', '234', '202', '228', '251', '941',
    ];
    const areaCode = this.rng.pick(areaCodes);
    const length = this.rng.int(6, 8);
    const number = Array.from({ length }, () => this.rng.int(0, 9)).join('');
    return `+49 ${areaCode} ${number}`;
  }

  postalCode(): string {
    // German postal codes are 5 digits
    const baseZip = parseInt(this.rng.pick(this.cities).postalCode);
    const variation = this.rng.int(-500, 500);
    const zip = Math.max(1000, Math.min(99999, baseZip + variation));
    return zip.toString().padStart(5, '0');
  }

  streetAddress(): string {
    const streetNames = [
      'Haupt', 'Bahnhof', 'Kirch', 'Schul', 'Markt', 'Berg', 'Wald', 'Garten',
      'Linden', 'Eichen', 'Birken', 'Ring', 'Park', 'Schloss', 'Brunnen', 'Bach',
    ];
    const streetName = this.rng.pick(streetNames);
    const streetType = this.rng.pick(this.streetTypes);
    const number = this.rng.int(1, 150);

    // German addresses have number after street name
    return `${streetName}${streetType} ${number}`;
  }

  fullName(gender?: 'male' | 'female'): string {
    const firstName = this.firstName(gender);
    const lastName = this.lastName();
    return `${firstName} ${lastName}`;
  }
}
