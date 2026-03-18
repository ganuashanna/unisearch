<?php
require_once __DIR__ . '/config.php';
set_cors_headers();

// 1. Total students
$key = SUPABASE_ANON_KEY;
$headers = [
    'apikey: ' . $key,
    'Authorization: Bearer ' . $key,
    'Prefer: count=exact'
];

function get_count($endpoint, $headers) {
    $url = SUPABASE_URL . $endpoint . (str_contains($endpoint, '?') ? '&' : '?') . 'limit=1';
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER     => $headers,
        CURLOPT_HEADER         => true,
        CURLOPT_SSL_VERIFYPEER => true,
    ]);
    $response = curl_exec($ch);
    $header_size = curl_getinfo($ch, CURLINFO_HEADER_SIZE);
    $header_str = substr($response, 0, $header_size);
    curl_close($ch);
    
    if (preg_match('/content-range: \d+-\d+\/(\d+)/i', $header_str, $matches)) {
        return (int)$matches[1];
    }
    return 0;
}

$totalStudents = get_count("/rest/v1/students?select=*", $headers);
$activeStudents = get_count("/rest/v1/students?select=*&enrollment_status=eq.active", $headers);
$graduatedStudents = get_count("/rest/v1/students?select=*&enrollment_status=eq.graduated", $headers);
$departmentsCount = get_count("/rest/v1/departments?select=*", $headers);

// 5. Batch years (admission years)
$res_batches = supabase_request('GET', "/rest/v1/students?select=admission_year");
$batches = array_unique(array_column($res_batches['data'] ?: [], 'admission_year'));
sort($batches);

// 7. Avg CGPA (from semesters table)
$res_cgpa = supabase_request('GET', "/rest/v1/semesters?select=cgpa");
$cgpas = array_column($res_cgpa['data'] ?: [], 'cgpa');
$avg_cgpa = count($cgpas) > 0 ? array_sum($cgpas)/count($cgpas) : 0;

json_response([
    'total_students' => $totalStudents,
    'active_students' => $activeStudents,
    'graduated_students' => $graduatedStudents,
    'departments_count' => $departmentsCount,
    'batches' => $batches,
    'latest_admission_year' => $batches ? max($batches) : null,
    'avg_cgpa' => round($avg_cgpa, 2)
]);
?>
