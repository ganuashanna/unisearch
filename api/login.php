<?php
require_once __DIR__ . '/config.php';
set_cors_headers();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_response(['error' => 'POST required'], 405);

$body = json_decode(file_get_contents('php://input'), true);
$password = $body['password'] ?? '';

if (hash_equals(ADMIN_PASSWORD, $password)) {
    $token = jwt_encode([
        'admin' => true,
        'exp' => time() + 86400,
        'iat' => time()
    ]);
    json_response(['success' => true, 'token' => $token]);
} else {
    json_response(['error' => 'Invalid password'], 401);
}
?>
