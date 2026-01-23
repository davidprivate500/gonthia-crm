import { BaseLocalizationProvider } from '../base';

export class USProvider extends BaseLocalizationProvider {
  country = 'US';
  countryName = 'United States';
  timezone = 'America/New_York';
  currency = 'USD';
  phonePrefix = '+1';

  protected firstNamesMale = [
    'James', 'John', 'Robert', 'Michael', 'William', 'David', 'Richard', 'Joseph',
    'Thomas', 'Christopher', 'Charles', 'Daniel', 'Matthew', 'Anthony', 'Mark',
    'Donald', 'Steven', 'Paul', 'Andrew', 'Joshua', 'Kenneth', 'Kevin', 'Brian',
    'George', 'Timothy', 'Ronald', 'Edward', 'Jason', 'Jeffrey', 'Ryan',
    'Jacob', 'Gary', 'Nicholas', 'Eric', 'Jonathan', 'Stephen', 'Larry', 'Justin',
    'Scott', 'Brandon', 'Benjamin', 'Samuel', 'Raymond', 'Gregory', 'Frank',
    'Alexander', 'Patrick', 'Jack', 'Dennis', 'Jerry', 'Tyler', 'Aaron', 'Jose',
  ];

  protected firstNamesFemale = [
    'Mary', 'Patricia', 'Jennifer', 'Linda', 'Elizabeth', 'Barbara', 'Susan',
    'Jessica', 'Sarah', 'Karen', 'Lisa', 'Nancy', 'Betty', 'Margaret', 'Sandra',
    'Ashley', 'Kimberly', 'Emily', 'Donna', 'Michelle', 'Dorothy', 'Carol',
    'Amanda', 'Melissa', 'Deborah', 'Stephanie', 'Rebecca', 'Sharon', 'Laura',
    'Cynthia', 'Kathleen', 'Amy', 'Angela', 'Shirley', 'Anna', 'Brenda',
    'Pamela', 'Emma', 'Nicole', 'Helen', 'Samantha', 'Katherine', 'Christine',
    'Debra', 'Rachel', 'Carolyn', 'Janet', 'Catherine', 'Maria', 'Heather',
  ];

  protected lastNames = [
    'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis',
    'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson',
    'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Perez', 'Thompson',
    'White', 'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson',
    'Walker', 'Young', 'Allen', 'King', 'Wright', 'Scott', 'Torres', 'Nguyen',
    'Hill', 'Flores', 'Green', 'Adams', 'Nelson', 'Baker', 'Hall', 'Rivera',
    'Campbell', 'Mitchell', 'Carter', 'Roberts', 'Turner', 'Phillips', 'Evans',
    'Parker', 'Edwards', 'Collins', 'Stewart', 'Morris', 'Murphy', 'Cook',
  ];

  protected cities = [
    { name: 'New York', state: 'NY', postalCode: '10001' },
    { name: 'Los Angeles', state: 'CA', postalCode: '90001' },
    { name: 'Chicago', state: 'IL', postalCode: '60601' },
    { name: 'Houston', state: 'TX', postalCode: '77001' },
    { name: 'Phoenix', state: 'AZ', postalCode: '85001' },
    { name: 'Philadelphia', state: 'PA', postalCode: '19101' },
    { name: 'San Antonio', state: 'TX', postalCode: '78201' },
    { name: 'San Diego', state: 'CA', postalCode: '92101' },
    { name: 'Dallas', state: 'TX', postalCode: '75201' },
    { name: 'San Jose', state: 'CA', postalCode: '95101' },
    { name: 'Austin', state: 'TX', postalCode: '78701' },
    { name: 'Jacksonville', state: 'FL', postalCode: '32099' },
    { name: 'Fort Worth', state: 'TX', postalCode: '76101' },
    { name: 'Columbus', state: 'OH', postalCode: '43085' },
    { name: 'Charlotte', state: 'NC', postalCode: '28201' },
    { name: 'San Francisco', state: 'CA', postalCode: '94102' },
    { name: 'Indianapolis', state: 'IN', postalCode: '46201' },
    { name: 'Seattle', state: 'WA', postalCode: '98101' },
    { name: 'Denver', state: 'CO', postalCode: '80201' },
    { name: 'Boston', state: 'MA', postalCode: '02101' },
    { name: 'Nashville', state: 'TN', postalCode: '37201' },
    { name: 'Detroit', state: 'MI', postalCode: '48201' },
    { name: 'Portland', state: 'OR', postalCode: '97201' },
    { name: 'Las Vegas', state: 'NV', postalCode: '89101' },
    { name: 'Miami', state: 'FL', postalCode: '33101' },
    { name: 'Atlanta', state: 'GA', postalCode: '30301' },
  ];

  protected streetTypes = [
    'St', 'Ave', 'Blvd', 'Dr', 'Ln', 'Way', 'Rd', 'Ct', 'Pl', 'Cir',
  ];

  protected companySuffixes = [
    'Inc', 'LLC', 'Corp', 'Co', 'Group', 'Holdings', 'Partners', 'Enterprises',
  ];

  protected companyWords = [
    'Global', 'National', 'American', 'United', 'First', 'Capital', 'Prime',
    'Elite', 'Premier', 'Strategic', 'Innovative', 'Dynamic', 'Advanced',
    'Summit', 'Apex', 'Pinnacle', 'Vanguard', 'Horizon', 'Frontier', 'Pacific',
    'Atlantic', 'Continental', 'Heritage', 'Legacy', 'Venture', 'Titan',
    'Stellar', 'Quantum', 'Nexus', 'Synergy', 'Catalyst', 'Insight', 'Vision',
  ];

  protected emailDomains = [
    'gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'aol.com',
    'icloud.com', 'mail.com', 'protonmail.com', 'zoho.com', 'fastmail.com',
  ];

  phone(): string {
    const areaCodes = [
      '212', '310', '312', '415', '617', '713', '202', '404', '305', '702',
      '213', '323', '469', '972', '214', '818', '949', '619', '858', '510',
    ];
    const areaCode = this.rng.pick(areaCodes);
    const exchange = this.rng.int(200, 999);
    const subscriber = this.rng.int(1000, 9999);
    return `+1 (${areaCode}) ${exchange}-${subscriber}`;
  }

  postalCode(): string {
    // Generate realistic 5-digit ZIP code
    const baseZip = this.rng.pick(this.cities).postalCode;
    const variation = this.rng.int(-100, 100);
    const zip = Math.max(10000, Math.min(99999, parseInt(baseZip) + variation));
    return zip.toString().padStart(5, '0');
  }
}
