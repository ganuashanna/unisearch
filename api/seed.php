<?php
require_once __DIR__ . '/config.php';
set_cors_headers();

// WARNING: ONLY RUN THIS ONCE DURING SETUP
// In production, you should disable this or use a secure key

$departments = [
    ['name' => 'Computer Science', 'code' => 'CS', 'total_years' => 4],
    ['name' => 'Electronics Engineering', 'code' => 'EC', 'total_years' => 4],
    ['name' => 'Mechanical Engineering', 'code' => 'ME', 'total_years' => 4],
    ['name' => 'Civil Engineering', 'code' => 'CE', 'total_years' => 4],
    ['name' => 'MBA', 'code' => 'MBA', 'total_years' => 2],
    ['name' => 'BBA', 'code' => 'BBA', 'total_years' => 3],
    ['name' => 'Law', 'code' => 'LAW', 'total_years' => 5],
    ['name' => 'Medicine', 'code' => 'MBBS', 'total_years' => 5],
    ['name' => 'Architecture', 'code' => 'ARCH', 'total_years' => 5],
    ['name' => 'Data Science', 'code' => 'DS', 'total_years' => 4]
];

// Helper to get random Indian names
$firstNames = ['Aarav', 'Ishani', 'Vihaan', 'Ananya', 'Siddharth', 'Prisha', 'Arjun', 'Myra', 'Zayan', 'Kyra', 'Advait', 'Saanvi', 'Vivaan', 'Aavya', 'Reyansh', 'Diya', 'Rudra', 'Anvi', 'Aryan', 'Ishita'];
$lastNames = ['Sharma', 'Patel', 'Verma', 'Gupta', 'Singh', 'Reddy', 'Iyer', 'Kapoor', 'Joshi', 'Chopra', 'Malhotra', 'Bose', 'Das', 'Chatterjee', 'Dubey', 'Yadav', 'Khan', 'Mishra', 'Pandey', 'Goel'];

$statuses = ['active', 'graduated', 'dropped', 'suspended', 'transferred'];
$genders = ['Male', 'Female', 'Other'];

$students = [];
for ($i = 0; $i < 60; $i++) {
    $fn = $firstNames[array_rand($firstNames)];
    $ln = $lastNames[array_rand($lastNames)];
    $fullName = "$fn $ln";
    $studentId = "S" . (2020 + rand(0, 5)) . str_pad($i + 1, 3, '0', STR_PAD_LEFT);
    $admYear = (int)substr($studentId, 1, 4);
    $status = $statuses[0]; // Default active
    if ($i > 30) $status = $statuses[1]; // Graduated
    if ($i > 45) $status = $statuses[rand(2,4)]; // Other
    
    $gradYear = $status === 'graduated' ? $admYear + 4 : null;
    $currYear = $status === 'active' ? (2025 - $admYear) : null;
    if ($currYear > 4) $currYear = 4;
    if ($currYear < 1) $currYear = 1;
    
    $students[] = [
        'full_name' => $fullName,
        'student_id' => $studentId,
        'email' => strtolower($fn . "." . $ln) . "@university.edu",
        'phone_number' => '+91 ' . rand(7000, 9999) . rand(100000, 999999),
        'department_name' => $departments[array_rand($departments)]['name'],
        'admission_year' => $admYear,
        'graduation_year' => $gradYear,
        'current_year' => $currYear,
        'current_semester' => $currYear ? ($currYear * 2 - rand(0, 1)) : null,
        'enrollment_status' => $status,
        'gender' => $genders[array_rand($genders)],
        'blood_group' => ['A+', 'B+', 'O+', 'AB+'][rand(0,3)],
        'date_of_birth' => (2000 + rand(0, 5)) . '-' . str_pad(rand(1,12), 2, '0', STR_PAD_LEFT) . '-' . str_pad(rand(1,28), 2, '0', STR_PAD_LEFT)
    ];
}

// Batch insert students
$res = supabase_request('POST', '/rest/v1/students', $students, true);

if ($res['status'] >= 200 && $res['status'] < 300) {
    echo "Successfully seeded " . count($students) . " students.\n";
} else {
    echo "Seed failed: " . json_encode($res['data']) . "\n";
}
?>
