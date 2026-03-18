<?php
require_once __DIR__ . '/config.php';
set_cors_headers();

// Client will delete the token from localStorage
json_response(['success' => true]);
?>
