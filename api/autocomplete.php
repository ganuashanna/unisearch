<?php
require_once __DIR__ . '/config.php';
set_cors_headers();

$q = qp('q');
if (!$q) json_response(['suggestions' => []]);

$q_encoded = rawurlencode($q);
$endpoint = "/rest/v1/students?select=full_name&full_name=ilike.*$q_encoded*&limit=5";

$res = supabase_request('GET', $endpoint);
$names = array_column($res['data'] ?: [], 'full_name');

json_response(['suggestions' => $names]);
?>
