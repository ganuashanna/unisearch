<?php
require_once __DIR__ . '/config.php';
set_cors_headers();

$q = qp('q');
$department_id = qp('department_id');
$admission_year = qp('admission_year');
$graduation_year = qp('graduation_year');
$current_year = qp('current_year');
$enrollment_status = qp('enrollment_status');
$gender = qp('gender');
$format = qp('format', 'csv');

// Build query
$endpoint = "/rest/v1/students?select=*,semesters(cgpa)&order=full_name.asc";

if ($q) {
    $q_encoded = rawurlencode($q);
    $endpoint .= "&or=(full_name.ilike.*$q_encoded*,student_id.ilike.*$q_encoded*,email.ilike.*$q_encoded*,department_name.ilike.*$q_encoded*)";
}
if ($department_id) $endpoint .= "&department_id=eq.$department_id";
if ($admission_year) $endpoint .= "&admission_year=eq.$admission_year";
if ($graduation_year) {
    if ($graduation_year === 'enrolled') {
        $endpoint .= "&graduation_year=is.null";
    } else {
        $endpoint .= "&graduation_year=eq.$graduation_year";
    }
}
if ($current_year) $endpoint .= "&current_year=eq.$current_year";
if ($enrollment_status) $endpoint .= "&enrollment_status=eq.$enrollment_status";
if ($gender) $endpoint .= "&gender=eq.$gender";

// Fetch ALL matching students (limit=10000 for export)
$url = SUPABASE_URL . $endpoint . "&limit=10000";
$key = SUPABASE_ANON_KEY;
$ch = curl_init($url);
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER     => [
        'apikey: ' . $key,
        'Authorization: Bearer ' . $key,
    ],
    CURLOPT_SSL_VERIFYPEER => true,
]);
$response = curl_exec($ch);
curl_close($ch);

$students = json_decode($response, true) ?: [];

if ($format === 'csv') {
    $filename = "unisearch-export-" . date('Y-m-d') . ".csv";
    header('Content-Type: text/csv');
    header('Content-Disposition: attachment; filename="' . $filename . '"');
    
    $out = fopen('php://output', 'w');
    
    // Header row
    fputcsv($out, [
        'Full Name', 'Student ID', 'Email', 'Phone Number', 
        'Department Name', 'Admission Year', 'Graduation Year', 
        'Current Year', 'Current Semester', 'Enrollment Status', 
        'Gender', 'Latest CGPA', 'Date of Birth', 'Address', 
        'Account Number'
    ]);
    
    foreach ($students as $s) {
        $latest_cgpa = 0;
        if (!empty($s['semesters'])) {
            usort($s['semesters'], fn($a, $b) => $b['semester_number'] <=> $a['semester_number']);
            $latest_cgpa = $s['semesters'][0]['cgpa'] ?? 0;
        }
        
        fputcsv($out, [
            $s['full_name'], $s['student_id'], $s['email'], $s['phone_number'],
            $s['department_name'], $s['admission_year'], $s['graduation_year'] ?? 'Enrolled',
            $s['current_year'], $s['current_semester'], $s['enrollment_status'],
            $s['gender'], $latest_cgpa, $s['date_of_birth'], $s['address'], 
            $s['account_number']
        ]);
    }
    fclose($out);
    exit;
} else {
    json_response($students);
}
?>
