export const US_STATES = [
  { label: 'Select State', value: '' },
  { label: 'Alabama (AL)', value: 'AL' },
  { label: 'Alaska (AK)', value: 'AK' },
  { label: 'Arizona (AZ)', value: 'AZ' },
  { label: 'Arkansas (AR)', value: 'AR' },
  { label: 'California (CA)', value: 'CA' },
  { label: 'Colorado (CO)', value: 'CO' },
  { label: 'Connecticut (CT)', value: 'CT' },
  { label: 'Delaware (DE)', value: 'DE' },
  { label: 'Florida (FL)', value: 'FL' },
  { label: 'Georgia (GA)', value: 'GA' },
  { label: 'Hawaii (HI)', value: 'HI' },
  { label: 'Idaho (ID)', value: 'ID' },
  { label: 'Illinois (IL)', value: 'IL' },
  { label: 'Indiana (IN)', value: 'IN' },
  { label: 'Iowa (IA)', value: 'IA' },
  { label: 'Kansas (KS)', value: 'KS' },
  { label: 'Kentucky (KY)', value: 'KY' },
  { label: 'Louisiana (LA)', value: 'LA' },
  { label: 'Maine (ME)', value: 'ME' },
  { label: 'Maryland (MD)', value: 'MD' },
  { label: 'Massachusetts (MA)', value: 'MA' },
  { label: 'Michigan (MI)', value: 'MI' },
  { label: 'Minnesota (MN)', value: 'MN' },
  { label: 'Mississippi (MS)', value: 'MS' },
  { label: 'Missouri (MO)', value: 'MO' },
  { label: 'Montana (MT)', value: 'MT' },
  { label: 'Nebraska (NE)', value: 'NE' },
  { label: 'Nevada (NV)', value: 'NV' },
  { label: 'New Hampshire (NH)', value: 'NH' },
  { label: 'New Jersey (NJ)', value: 'NJ' },
  { label: 'New Mexico (NM)', value: 'NM' },
  { label: 'New York (NY)', value: 'NY' },
  { label: 'North Carolina (NC)', value: 'NC' },
  { label: 'North Dakota (ND)', value: 'ND' },
  { label: 'Ohio (OH)', value: 'OH' },
  { label: 'Oklahoma (OK)', value: 'OK' },
  { label: 'Oregon (OR)', value: 'OR' },
  { label: 'Pennsylvania (PA)', value: 'PA' },
  { label: 'Rhode Island (RI)', value: 'RI' },
  { label: 'South Carolina (SC)', value: 'SC' },
  { label: 'South Dakota (SD)', value: 'SD' },
  { label: 'Tennessee (TN)', value: 'TN' },
  { label: 'Texas (TX)', value: 'TX' },
  { label: 'Utah (UT)', value: 'UT' },
  { label: 'Vermont (VT)', value: 'VT' },
  { label: 'Virginia (VA)', value: 'VA' },
  { label: 'Washington (WA)', value: 'WA' },
  { label: 'West Virginia (WV)', value: 'WV' },
  { label: 'Wisconsin (WI)', value: 'WI' },
  { label: 'Wyoming (WY)', value: 'WY' },
];

export const GENDERS = [
  { label: 'Select Gender', value: '' },
  { label: 'Female', value: 'Female' },
  { label: 'Male', value: 'Male' },
  { label: 'Non-binary', value: 'Non-binary' },
  { label: 'Prefer not to say', value: 'Prefer not to say' },
];

export const formatDateForDisplay = (date) => {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${month}/${day}/${date.getFullYear()}`;
};

export const formatDateForDB = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Parses a YYYY-MM-DD string from Supabase as local time (avoids UTC drift)
export const parseDateFromDB = (str) => {
  const [year, month, day] = str.split('-').map(Number);
  return new Date(year, month - 1, day);
};
