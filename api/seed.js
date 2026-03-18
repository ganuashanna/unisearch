import { supabaseRequest, setCors } from './_supabase.js';

export default async function handler(req, res) {
  setCors(res);
  const url = new URL(req.url, `http://${req.headers.host}`);
  const key = url.searchParams.get('key');

  if (key !== 'bamu2024seed') {
    return res.status(403).json({ error: 'Invalid seed key' });
  }

  const deptData = [
    { n: 'Computer Science', c: 'CS', y: 4 },
    { n: 'Electronics Engineering', c: 'EC', y: 4 },
    { n: 'Mechanical Engineering', c: 'ME', y: 4 },
    { n: 'Civil Engineering', c: 'CE', y: 4 },
    { n: 'MBA', c: 'MBA', y: 2 },
    { n: 'BBA', c: 'BBA', y: 3 },
    { n: 'Law', c: 'LAW', y: 5 },
    { n: 'MBBS', c: 'MBBS', y: 5 },
    { n: 'Architecture', c: 'ARCH', y: 5 },
    { n: 'Data Science', c: 'DS', y: 4 },
    { n: 'Chemistry', c: 'CHEM', y: 2 },
    { n: 'Physics', c: 'PHYS', y: 2 },
    { n: 'Commerce', c: 'BCOM', y: 3 },
    { n: 'Arts', c: 'BA', y: 3 },
    { n: 'Agriculture', c: 'AGRI', y: 4 }
  ];

  const firstNames = ['Ganesh', 'Priya', 'Rahul', 'Sneha', 'Amit', 'Kavita', 'Suresh', 'Pooja', 'Akash', 'Sunita', 'Vijay', 'Anjali', 'Rajesh', 'Meera', 'Ravi', 'Nisha', 'Sanjay', 'Rekha', 'Deepak', 'Seema', 'Mahesh', 'Lata', 'Anil', 'Varsha', 'Nilesh', 'Padma', 'Santosh', 'Shubhangi', 'Abhijit', 'Manisha', 'Pravin', 'Archana', 'Sachin', 'Jyoti', 'Dilip', 'Smita'];
  const lastNames = ['Shinde', 'Patel', 'Jadhav', 'Deshmukh', 'Kulkarni', 'More', 'Kadam', 'Pawar', 'Gaikwad', 'Lokhande', 'Dhage', 'Munde', 'Bhosale', 'Sawant', 'Kale', 'Waghmare', 'Shirke', 'Deshpande', 'Nair', 'Bansode', 'Thakre', 'Kamble', 'Salve'];

  const statuses = ['active', 'graduated', 'dropped', 'transferred', 'suspended'];
  const genders = ['Male', 'Female'];
  const bloodGroups = ['A+', 'B+', 'O+', 'AB+', 'A-', 'B-'];
  const districts = ['Chhatrapati Sambhajinagar', 'Aurangabad', 'Jalna', 'Beed', 'Dharashiv', 'Pune', 'Mumbai', 'Nashik'];

  let insertedCount = 0;

  for (let i = 0; i < 100; i++) {
    const fn = firstNames[Math.floor(Math.random() * firstNames.length)];
    const ln = lastNames[Math.floor(Math.random() * lastNames.length)];
    const dept = deptData[Math.floor(Math.random() * deptData.length)];
    const admYear = 2018 + Math.floor(Math.random() * 7);
    const gradYear = admYear + dept.y;
    const status = (admYear < 2021) ? 'graduated' : (Math.random() > 0.85 ? statuses[Math.floor(Math.random() * 3 + 2)] : 'active');
    
    let current_year = null;
    let curr_sem = null;
    if (status === 'active') {
        current_year = 2025 - admYear;
        if (current_year > dept.y) current_year = dept.y;
        if (current_year < 1) current_year = 1;
        curr_sem = current_year * 2 - (Math.random() > 0.5 ? 0 : 1);
    }

    const student = {
      full_name: `${fn} ${ln}`,
      student_id: `${dept.c}${admYear}${String(i + 1).padStart(3, '0')}`,
      email: `${fn.toLowerCase()}.${ln.toLowerCase()}@bamu.ac.in`,
      phone_number: `+91 ${700000000 + Math.floor(Math.random() * 299999999)}`,
      department_name: dept.n,
      admission_year: admYear,
      graduation_year: status === 'graduated' ? gradYear : null,
      current_year: current_year,
      current_semester: curr_sem,
      enrollment_status: status,
      gender: genders[Math.floor(Math.random() * genders.length)],
      blood_group: bloodGroups[Math.floor(Math.random() * bloodGroups.length)],
      guardian_name: `${firstNames[Math.floor(Math.random() * firstNames.length)]} ${ln}`,
      guardian_phone: `+91 ${800000000 + Math.floor(Math.random() * 199999999)}`,
      address: `${100 + i}, MG Road, ${districts[Math.floor(Math.random() * districts.length)]}, Maharashtra`,
      account_number: `ACC${10000000 + Math.floor(Math.random() * 89999999)}`,
      date_of_birth: `${1995 + Math.floor(Math.random() * 10)}-${String(Math.floor(Math.random() * 12) + 1).padStart(2, '0')}-${String(Math.floor(Math.random() * 28) + 1).padStart(2, '0')}`,
    };

    const sRes = await supabaseRequest('POST', '/rest/v1/students', student, true);
    if (sRes.status < 300) {
      insertedCount++;
      const stuID = sRes.data[0].id; // Get the generated UUID
      
      // Insert semesters
      const maxSem = status === 'graduated' ? dept.y * 2 : (curr_sem || 1);
      const semesters = [];
      let lastCGPA = 0;
      for (let sNum = 1; sNum <= maxSem; sNum++) {
          const sgpa = (5.5 + Math.random() * 4.3).toFixed(2);
          lastCGPA = lastCGPA ? ((parseFloat(lastCGPA) + parseFloat(sgpa)) / 2).toFixed(2) : sgpa;
          semesters.push({
              student_id: stuID,
              semester_number: sNum,
              academic_year: `${admYear + Math.floor((sNum-1)/2)}-${String(admYear + Math.floor((sNum-1)/2) + 1).slice(2)}`,
              sgpa: parseFloat(sgpa),
              cgpa: parseFloat(lastCGPA),
              attendance_pct: (75 + Math.random() * 23).toFixed(1),
              result: Math.random() > 0.9 ? 'backlog' : 'pass'
          });
      }
      await supabaseRequest('POST', '/rest/v1/semesters', semesters, true);
    }
  }

  res.json({ success: true, inserted: insertedCount });
}
