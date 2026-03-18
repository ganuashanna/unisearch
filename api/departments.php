<?php
require_once __DIR__ . '/config.php';
set_cors_headers();

$endpoint = "/rest/v1/departments?select=*&order=name.asc";
$res = supabase_request('GET', $endpoint);

json_response(['departments' => $res['data'] ?: []]);
?>
