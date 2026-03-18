<?php
require_once __DIR__ . '/config.php';
set_cors_headers();

$id = qp('id');
if (!$id) json_response(['error' => 'ID is required'], 400);

$endpoint = "/rest/v1/students?id=eq.$id&select=*,semesters(*),departments(name,code,total_years)";
$res = supabase_request('GET', $endpoint);

if (empty($res['data'])) json_response(['error' => 'Student not found'], 404);

$student = $res['data'][0];

// Sort semesters
if (!empty($student['semesters'])) {
    usort($student['semesters'], fn($a, $b) => (int)$a['semester_number'] <=> (int)$b['semester_number']);
}

// Add computed status info
$statusColors = [
    'active' => 'emerald',
    'graduated' => 'indigo',
    'dropped' => 'rose',
    'suspended' => 'amber',
    'transferred' => 'cyan'
];
$student['status_color'] = $statusColors[$student['enrollment_status']] ?? 'gray';

json_response($student);
?>
