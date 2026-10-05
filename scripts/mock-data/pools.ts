// Name and place pools for the demo dataset. Names are common given names and surnames heard
// across Bengaluru (Kannada, Tamil, Telugu, Malayalam, North Indian, Bengali, Konkani, Muslim,
// Christian and Parsi families); combinations are generated, never taken from real records.
// Localities and PIN codes are real Bengaluru areas; streets and buildings are fictional.

export const FIRST_NAMES: { name: string; w: number }[] = [
  // Kannada / Karnataka
  ...['Ananya', 'Kavya', 'Shreya', 'Deepika', 'Ramya', 'Sahana', 'Bhavana', 'Spoorthi', 'Pooja', 'Divya', 'Sindhu', 'Akshatha', 'Harini', 'Nandini', 'Prerana'].map((name) => ({ name, w: 3 })),
  ...['Karthik', 'Rakesh', 'Pavan', 'Chethan', 'Manjunath', 'Sudeep', 'Vinay', 'Prajwal', 'Abhishek', 'Darshan', 'Shashank', 'Nikhil', 'Varun', 'Sachin', 'Kiran'].map((name) => ({ name, w: 3 })),
  // Tamil / Telugu / Malayalam
  ...['Lakshmi', 'Meera', 'Priya', 'Janani', 'Swathi', 'Keerthana', 'Anjali', 'Sneha', 'Aishwarya', 'Gayathri', 'Revathi', 'Nithya', 'Sruthi', 'Amrita', 'Parvathy'].map((name) => ({ name, w: 2 })),
  ...['Arjun', 'Vikram', 'Srinivas', 'Ravi', 'Hari', 'Siddharth', 'Rohan', 'Aravind', 'Naveen', 'Ashwin', 'Sanjay', 'Gautham', 'Rahul', 'Vishnu', 'Anand'].map((name) => ({ name, w: 2 })),
  // North Indian / Bengali / Konkani
  ...['Neha', 'Riya', 'Aditi', 'Ishita', 'Tanvi', 'Shruti', 'Sakshi', 'Megha', 'Pallavi', 'Ritika', 'Payal', 'Sohini', 'Ankita'].map((name) => ({ name, w: 2 })),
  ...['Aditya', 'Kunal', 'Rajat', 'Mohit', 'Saurabh', 'Ankur', 'Arnav', 'Dhruv', 'Kabir', 'Vivek', 'Abhay', 'Sourav', 'Amit'].map((name) => ({ name, w: 2 })),
  // Muslim / Christian / Parsi
  ...['Ayesha', 'Fatima', 'Sana', 'Zoya', 'Nazia', 'Rehana'].map((name) => ({ name, w: 1.5 })),
  ...['Imran', 'Faisal', 'Sameer', 'Arif', 'Zaid', 'Irfan'].map((name) => ({ name, w: 1.5 })),
  ...['Maria', 'Sneha', 'Teresa', 'Anita', 'Joyce', 'Rachel', 'Shirin', 'Freya'].map((name) => ({ name, w: 1.2 })),
  ...['Joseph', 'Thomas', 'Kevin', 'Allen', 'Sunil', 'Jerome', 'Cyrus', 'Darius'].map((name) => ({ name, w: 1.2 })),
];

export const LAST_NAMES: { name: string; w: number }[] = [
  ...['Gowda', 'Hegde', 'Rao', 'Shetty', 'Bhat', 'Kulkarni', 'Patil', 'Murthy', 'Prasad', 'Kamath', 'Shenoy', 'Acharya', 'Naik', 'Pai', 'Desai'].map((name) => ({ name, w: 3 })),
  ...['Iyer', 'Iyengar', 'Krishnan', 'Subramanian', 'Raman', 'Venkatesh', 'Reddy', 'Naidu', 'Chowdary', 'Menon', 'Nair', 'Pillai', 'Varma', 'Kurian', 'Thomas'].map((name) => ({ name, w: 2 })),
  ...['Sharma', 'Verma', 'Gupta', 'Agarwal', 'Mehta', 'Jain', 'Kapoor', 'Malhotra', 'Singh', 'Chatterjee', 'Banerjee', 'Das', 'Mukherjee', 'Sen', 'Bose'].map((name) => ({ name, w: 1.8 })),
  ...['Khan', 'Sheikh', 'Ahmed', 'Siddiqui', 'Pasha', "D'Souza", 'Fernandes', 'Pinto', 'Lobo', 'Mathew', 'George', 'Irani', 'Mistry'].map((name) => ({ name, w: 1.2 })),
];

/** Children's and loved ones' names for cake messages. */
export const MESSAGE_NAMES = ['Aarav', 'Vihaan', 'Ira', 'Anvi', 'Kiaan', 'Myra', 'Advik', 'Saanvi', 'Reyansh', 'Aadhya', 'Ishaan', 'Kiara', 'Rudra', 'Navya', 'Ayaan', 'Zara', 'Dhruv', 'Siya', 'Arjun', 'Diya', 'Amma', 'Appa', 'Nani', 'Paati', 'Thatha', 'Didi', 'Bhaiya', 'Maa'];

/** Bengaluru localities with real PIN codes, weighted by how near they are to the bakery in Indiranagar. */
export const LOCALITIES: { name: string; pin: string; w: number; roads: string[] }[] = [
  { name: 'Indiranagar', pin: '560038', w: 14, roads: ['12th Main', '100 Feet Road', 'CMH Road', '80 Feet Road', 'Double Road'] },
  { name: 'HAL 2nd Stage', pin: '560008', w: 6, roads: ['17th Cross', 'Defence Colony', '13th Main'] },
  { name: 'Domlur', pin: '560071', w: 7, roads: ['Domlur Layout', '1st Main', 'Amarjyothi Layout'] },
  { name: 'Ulsoor', pin: '560008', w: 5, roads: ['Kensington Road', 'Murphy Road', 'Gangadhar Chetty Road'] },
  { name: 'Koramangala', pin: '560034', w: 9, roads: ['5th Block', '80 Feet Road', '1st Block', '6th Block'] },
  { name: 'Jeevan Bima Nagar', pin: '560075', w: 5, roads: ['LIC Colony', '7th Main', 'Old Airport Road'] },
  { name: 'CV Raman Nagar', pin: '560093', w: 5, roads: ['Kaggadasapura Main Road', 'DRDO Township', 'Suranjan Das Road'] },
  { name: 'Frazer Town', pin: '560005', w: 4, roads: ['Mosque Road', 'Coles Road', 'Wheeler Road'] },
  { name: 'Richmond Town', pin: '560025', w: 3, roads: ['Richmond Road', 'Langford Road', 'Hosur Road'] },
  { name: 'HSR Layout', pin: '560102', w: 5, roads: ['Sector 2', '27th Main', 'Sector 6'] },
  { name: 'Ejipura', pin: '560047', w: 3, roads: ['Intermediate Ring Road', 'Ejipura Main Road'] },
  { name: 'Murugeshpalya', pin: '560017', w: 3, roads: ['Old Airport Road', 'Wind Tunnel Road'] },
  { name: 'Marathahalli', pin: '560037', w: 3, roads: ['Outer Ring Road', 'Kundalahalli Gate'] },
  { name: 'Jayanagar', pin: '560041', w: 2, roads: ['4th Block', '9th Block', '11th Main'] },
  { name: 'Malleshwaram', pin: '560003', w: 2, roads: ['Sampige Road', '8th Cross', 'Margosa Road'] },
  { name: 'Whitefield', pin: '560066', w: 2, roads: ['ITPL Main Road', 'Varthur Road', 'Hope Farm'] },
  { name: 'Sadashivanagar', pin: '560080', w: 1, roads: ['Sankey Road', 'Palace Cross Road'] },
];

/** Generic, fictional apartment names. */
export const BUILDINGS = ['Lakeview Residency', 'Palm Grove Apartments', 'Silver Oak Enclave', 'Green Glen Homes', 'Sunrise Court', 'Maple Heights', 'Garden View Apartments', 'Cedar Park', 'Banyan Residency', 'Orchid Terraces', 'Laburnum Court', 'Gulmohar Apartments'];

export const EMAIL_DOMAINS = ['example.com', 'example.net', 'example.org'];
