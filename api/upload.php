<?php
require_once __DIR__ . '/config.php';
set_cors_headers();

if (!verify_admin_token()) json_response(['error' => 'Unauthorized'], 401);

if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_response(['error' => 'POST required'], 405);

if (empty($_FILES['file'])) json_response(['error' => 'No file uploaded'], 400);

$file = $_FILES['file'];
$ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));

if (!in_array($ext, ['csv', 'xlsx', 'xls'])) {
    json_response(['error' => 'Invalid file type. Only CSV and XLSX supported.'], 400);
}

$rows = [];

if ($ext === 'csv') {
    if (($handle = fopen($file['tmp_name'], 'r')) !== FALSE) {
        $headers = fgetcsv($handle, 1000, ",");
        while (($data = fgetcsv($handle, 1000, ",")) !== FALSE) {
            $rows[] = array_combine($headers, $data);
        }
        fclose($handle);
    }
} elseif ($ext === 'xlsx') {
    // Basic XLSX parsing using ZipArchive and SimpleXML
    $zip = new ZipArchive;
    if ($zip->open($file['tmp_name']) === TRUE) {
        $sharedStrings = [];
        if ($ss = $zip->getFromName('xl/sharedStrings.xml')) {
            $xml = simplexml_load_string($ss);
            foreach ($xml->si as $si) {
                $sharedStrings[] = (string)($si->t ?? $si->r->t);
            }
        }
        
        if ($sheet = $zip->getFromName('xl/worksheets/sheet1.xml')) {
            $xml = simplexml_load_string($sheet);
            $sheetRows = [];
            foreach ($xml->sheetData->row as $row) {
                $rowData = [];
                foreach ($row->c as $c) {
                    $v = (string)$c->v;
                    if (isset($c['t']) && (string)$c['t'] === 's') {
                        $v = $sharedStrings[(int)$v] ?? '';
                    }
                    $rowData[] = $v;
                }
                $sheetRows[] = $rowData;
            }
            
            if (!empty($sheetRows)) {
                $headers = array_shift($sheetRows);
                foreach ($sheetRows as $r) {
                    if (count($r) == count($headers)) {
                        $rows[] = array_combine($headers, $r);
                    }
                }
            }
        }
        $zip->close();
    }
}

if (empty($rows)) json_response(['error' => 'No rows found in file'], 400);

// Map columns case-insensitively and normalize
$mappedRows = [];
foreach ($rows as $row) {
    if (empty($row)) continue;
    $norm = [];
    foreach ($row as $k => $v) {
        $key = strtolower(trim($k));
        if (in_array($key, ['name', 'full_name', 'fullname'])) $norm['full_name'] = $v;
        elseif (in_array($key, ['id', 'student_id', 'studentid'])) $norm['student_id'] = $v;
        elseif (in_array($key, ['email', 'mail'])) $norm['email'] = $v;
        elseif (in_array($key, ['phone', 'phone_number', 'mobile'])) $norm['phone_number'] = $v;
        elseif (in_array($key, ['dept', 'department', 'department_name'])) $norm['department_name'] = $v;
        elseif (in_array($key, ['admission_year', 'admissionyear', 'adm_year'])) $norm['admission_year'] = (int)$v;
        elseif (in_array($key, ['graduation_year', 'graduationyear', 'grad_year'])) $norm['graduation_year'] = $v ? (int)$v : null;
        elseif (in_array($key, ['current_year', 'year'])) $norm['current_year'] = (int)$v;
        elseif (in_array($key, ['current_semester', 'semester', 'sem'])) $norm['current_semester'] = (int)$v;
        elseif (in_array($key, ['status', 'enrollment_status', 'enrollmentstatus'])) $norm['enrollment_status'] = $v ?: 'active';
        elseif (in_array($key, ['gender'])) $norm['gender'] = $v;
        elseif (in_array($key, ['dob', 'date_of_birth'])) $norm['date_of_birth'] = $v;
        elseif (in_array($key, ['address'])) $norm['address'] = $v;
        elseif (in_array($key, ['account', 'account_number'])) $norm['account_number'] = $v;
        elseif (in_array($key, ['guardian', 'guardian_name'])) $norm['guardian_name'] = $v;
        elseif (in_array($key, ['guardian_phone'])) $norm['guardian_phone'] = $v;
    }
    
    if (!empty($norm['full_name']) && !empty($norm['student_id'])) {
        $mappedRows[] = $norm;
    }
}

// Batch upsert to Supabase
$imported = 0;
$errors = [];
$chunkSize = 50;
$chunks = array_chunk($mappedRows, $chunkSize);

foreach ($chunks as $chunk) {
    // POST /rest/v1/students?on_conflict=student_id
    // Prefer: resolution=merge-duplicates header
    $res = supabase_request('POST', '/rest/v1/students?on_conflict=student_id', $chunk, true);
    if ($res['status'] >= 200 && $res['status'] < 300) {
        $imported += count($chunk);
    } else {
        $errors[] = "Failed chunk import: " . json_encode($res['data']);
    }
}

json_response([
    'imported' => $imported,
    'total_processed' => count($rows),
    'errors' => $errors
]);
?>
