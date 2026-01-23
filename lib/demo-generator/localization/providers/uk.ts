import { BaseLocalizationProvider } from '../base';

export class UKProvider extends BaseLocalizationProvider {
  country = 'GB';
  countryName = 'United Kingdom';
  timezone = 'Europe/London';
  currency = 'GBP';
  phonePrefix = '+44';

  protected firstNamesMale = [
    'Oliver', 'George', 'Harry', 'Jack', 'Noah', 'Charlie', 'Jacob', 'Alfie',
    'Freddie', 'Oscar', 'Leo', 'Archie', 'Henry', 'Thomas', 'William', 'James',
    'Joshua', 'Alexander', 'Arthur', 'Edward', 'Sebastian', 'Joseph', 'Daniel',
    'Max', 'Samuel', 'Ethan', 'Lucas', 'Isaac', 'Benjamin', 'Theodore',
    'Matthew', 'Harrison', 'Finley', 'Adam', 'Ryan', 'Dylan', 'Jake', 'Connor',
    'Callum', 'Nathan', 'Jamie', 'Luke', 'Cameron', 'Liam', 'Michael', 'David',
    'Robert', 'Richard', 'Christopher', 'Andrew', 'Stephen', 'Simon', 'Mark',
  ];

  protected firstNamesFemale = [
    'Olivia', 'Amelia', 'Isla', 'Ava', 'Emily', 'Sophia', 'Grace', 'Mia',
    'Poppy', 'Ella', 'Lily', 'Evie', 'Charlotte', 'Freya', 'Isabelle', 'Daisy',
    'Sophie', 'Ivy', 'Florence', 'Willow', 'Rosie', 'Sienna', 'Alice', 'Jessica',
    'Millie', 'Ruby', 'Phoebe', 'Matilda', 'Evelyn', 'Emilia', 'Emma', 'Hannah',
    'Lucy', 'Chloe', 'Lauren', 'Bethany', 'Eleanor', 'Imogen', 'Jasmine', 'Maya',
    'Amber', 'Georgia', 'Scarlett', 'Victoria', 'Elizabeth', 'Rebecca', 'Sarah',
    'Katie', 'Abigail', 'Holly', 'Eleanor', 'Zoe', 'Harriet', 'Molly',
  ];

  protected lastNames = [
    'Smith', 'Jones', 'Williams', 'Taylor', 'Brown', 'Davies', 'Evans', 'Wilson',
    'Thomas', 'Roberts', 'Johnson', 'Lewis', 'Walker', 'Robinson', 'Wood', 'Thompson',
    'White', 'Watson', 'Jackson', 'Wright', 'Green', 'Harris', 'Cooper', 'King',
    'Lee', 'Martin', 'Clarke', 'James', 'Morgan', 'Hughes', 'Edwards', 'Hill',
    'Moore', 'Clark', 'Harrison', 'Scott', 'Young', 'Morris', 'Hall', 'Ward',
    'Turner', 'Carter', 'Phillips', 'Mitchell', 'Patel', 'Adams', 'Campbell',
    'Anderson', 'Allen', 'Cook', 'Bailey', 'Parker', 'Miller', 'Davis', 'Murphy',
  ];

  protected cities = [
    { name: 'London', state: 'Greater London', postalCode: 'EC1A 1BB' },
    { name: 'Birmingham', state: 'West Midlands', postalCode: 'B1 1AA' },
    { name: 'Manchester', state: 'Greater Manchester', postalCode: 'M1 1AA' },
    { name: 'Leeds', state: 'West Yorkshire', postalCode: 'LS1 1AA' },
    { name: 'Glasgow', state: 'Scotland', postalCode: 'G1 1AA' },
    { name: 'Liverpool', state: 'Merseyside', postalCode: 'L1 1AA' },
    { name: 'Bristol', state: 'Bristol', postalCode: 'BS1 1AA' },
    { name: 'Sheffield', state: 'South Yorkshire', postalCode: 'S1 1AA' },
    { name: 'Edinburgh', state: 'Scotland', postalCode: 'EH1 1AA' },
    { name: 'Leicester', state: 'Leicestershire', postalCode: 'LE1 1AA' },
    { name: 'Coventry', state: 'West Midlands', postalCode: 'CV1 1AA' },
    { name: 'Bradford', state: 'West Yorkshire', postalCode: 'BD1 1AA' },
    { name: 'Cardiff', state: 'Wales', postalCode: 'CF1 1AA' },
    { name: 'Belfast', state: 'Northern Ireland', postalCode: 'BT1 1AA' },
    { name: 'Nottingham', state: 'Nottinghamshire', postalCode: 'NG1 1AA' },
    { name: 'Newcastle', state: 'Tyne and Wear', postalCode: 'NE1 1AA' },
    { name: 'Southampton', state: 'Hampshire', postalCode: 'SO1 1AA' },
    { name: 'Brighton', state: 'East Sussex', postalCode: 'BN1 1AA' },
    { name: 'Cambridge', state: 'Cambridgeshire', postalCode: 'CB1 1AA' },
    { name: 'Oxford', state: 'Oxfordshire', postalCode: 'OX1 1AA' },
  ];

  protected streetTypes = [
    'Street', 'Road', 'Lane', 'Avenue', 'Drive', 'Close', 'Way', 'Court',
    'Gardens', 'Place', 'Terrace', 'Grove', 'Crescent', 'Square', 'Mews',
  ];

  protected companySuffixes = [
    'Ltd', 'PLC', 'LLP', 'Group', 'Holdings', 'Partners', 'UK', 'International',
  ];

  protected companyWords = [
    'British', 'Royal', 'United', 'Imperial', 'National', 'Crown', 'Windsor',
    'Sterling', 'Capital', 'Premier', 'Elite', 'Heritage', 'Classic', 'Modern',
    'Global', 'Apex', 'Summit', 'Thames', 'Atlantic', 'Northern', 'Southern',
    'Eastern', 'Western', 'Central', 'Metropolitan', 'City', 'Cross', 'Bridge',
  ];

  protected emailDomains = [
    'gmail.com', 'yahoo.co.uk', 'outlook.com', 'hotmail.co.uk', 'btinternet.com',
    'sky.com', 'virginmedia.com', 'talktalk.net', 'mail.com', 'icloud.com',
  ];

  phone(): string {
    const areaCodes = [
      '20', '121', '131', '141', '151', '161', '113', '114', '115', '116',
      '117', '118', '191', '1onal61', '1onal71', '1onal81', '1onal91',
    ];
    const areaCode = this.rng.pick(areaCodes.filter(c => !c.includes('onal')));
    const part1 = this.rng.int(1000, 9999);
    const part2 = this.rng.int(1000, 9999);
    return `+44 ${areaCode} ${part1} ${part2}`;
  }

  postalCode(): string {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const outward = this.rng.pick(this.cities).postalCode.split(' ')[0];
    const inward = `${this.rng.int(1, 9)}${this.rng.pick(letters.split(''))}${this.rng.pick(letters.split(''))}`;
    return `${outward} ${inward}`;
  }

  streetAddress(): string {
    const number = this.rng.int(1, 200);
    const streetNames = [
      'High', 'Church', 'Mill', 'Park', 'Station', 'Main', 'London', 'Victoria',
      'Green', 'Manor', 'King', 'Queen', 'North', 'South', 'East', 'West',
    ];
    const streetName = this.rng.pick(streetNames);
    const streetType = this.rng.pick(this.streetTypes);
    return `${number} ${streetName} ${streetType}`;
  }
}
