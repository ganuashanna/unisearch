<?php
require_once __DIR__ . '/config.php';
set_cors_headers();

$q = qp('q');
$department_id = qp('department_id');
$admission_year = qp('admission_year');
$graduation_year = qp('graduation_year');
$current_year = qp('current_year');
$enrollment_status = qp('enrollment_status');
$semester = qp('semester');
$student_id = qp('student_id');
$phone = qp('phone');
$gender = qp('gender');
$page = (int)qp('page', 1);
$limit = (int)qp('limit', 25);
$sort_by = qp('sort_by', 'full_name');
$sort_dir = qp('sort_dir', 'asc');

// Calculate offsets for Range header
$start = ($page - 1) * $limit;
$end = $start + $limit - 1;

// Build query
$endpoint = "/rest/v1/students?select=*,semesters(*)&order=$sort_by.$sort_dir";

// Add filters
if ($q) {
    // using 'or' for simple multi-column text search
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
if ($student_id) $endpoint .= "&student_id=eq.$student_id";
if ($phone) $endpoint .= "&phone_number=ilike.*$phone*";
if ($gender) $endpoint .= "&gender=eq.$gender";

// Supabase headers
$key = SUPABASE_ANON_KEY;
$url = SUPABASE_URL . $endpoint;
$ch  = curl_init($url);

$headers = [
    'apikey: ' . $key,
    'Authorization: Bearer ' . $key,
    'Content-Type: application/json',
    'Prefer: count=exact',
    "Range: $start-$end"
];

curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER     => $headers,
    CURLOPT_HEADER         => true,
    CURLOPT_SSL_VERIFYPEER => true,
    CURLOPT_TIMEOUT        => 30,
]);

$response = curl_exec($ch);
$header_size = curl_getinfo($ch, CURLINFO_HEADER_SIZE);
$header_str = substr($response, 0, $header_size);
$body_str = substr($response, $header_size);
$http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

$students = json_decode($body_str, true) ?: [];
$total = 0;

// Parse headers for total count from Content-Range: 0-24/150
if (preg_match('/content-range: \d+-\d+\/(\d+)/i', $header_str, $matches)) {
    $total = (int)$matches[1];
}

// Add computed fields
foreach ($students as &$s) {
    $admYear = (int)$s['admission_year'];
    $gradYear = $s['graduation_year'] ? (int)$s['graduation_year'] : null;
    
    $s['batch'] = $gradYear ? "$admYear-$gradYear" : "$admYear-Enrolled";
    
    if ($s['enrollment_status'] === 'graduated') {
        $s['academic_year_label'] = "Graduated $gradYear";
    } else {
        $year_suff = ["th", "st", "nd", "rd", "th", "th", "th"][(int)$s['current_year']] ?? "th";
        $s['academic_year_label'] = $s['current_year'] . $year_suff . " Year";
    }
    
    // Most recent semester for display
    if (!empty($s['semesters'])) {
        usort($s['semesters'], fn($a, $b) => $b['semester_number'] <=> $a['semester_number']);
        $latest = $s['semesters'][0];
        $s['semester_display'] = "Sem " . $latest['semester_number'] . " | " . $latest['academic_year'];
        $s['cgpa_latest'] = $latest['cgpa'];
    } else {
        $s['semester_display'] = "N/A";
        $s['cgpa_latest'] = 0;
    }
    
    // Status color
    $statusColors = [
        'active' => 'emerald',
        'graduated' => 'indigo',
        'dropped' => 'rose',
        'suspended' => 'amber',
        'transferred' => 'cyan'
    ];
    $s['status_color'] = $statusColors[$s['enrollment_status']] ?? 'gray';
}

json_response([
    'data' => $students,
    'total' => $total,
    'page' => $page,
    'limit' => $limit,
    'totalPages' => ceil($total / $limit),
    'filters_applied' => array_filter($_GET)
]);
?>
