<?php
// Environment variables
define('SUPABASE_URL',              getenv('SUPABASE_URL'));
define('SUPABASE_ANON_KEY',         getenv('SUPABASE_ANON_KEY'));
define('SUPABASE_SERVICE_ROLE_KEY', getenv('SUPABASE_SERVICE_ROLE_KEY'));
define('ADMIN_PASSWORD',            getenv('ADMIN_PASSWORD') ?: 'admin123');
define('JWT_SECRET',                getenv('JWT_SECRET') ?: 'change-me-in-prod');

// CORS headers — call at top of every endpoint
function set_cors_headers() {
    header('Content-Type: application/json');
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
    header('Access-Control-Allow-Headers: Authorization, Content-Type');
    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }
}

// Supabase REST call
function supabase_request(
    string $method,
    string $endpoint,
    array  $body = [],
    bool   $use_service_role = false
): array {
    $key = $use_service_role
        ? SUPABASE_SERVICE_ROLE_KEY
        : SUPABASE_ANON_KEY;

    $url = SUPABASE_URL . $endpoint;
    $ch  = curl_init($url);

    $headers = [
        'apikey: '        . $key,
        'Authorization: Bearer ' . $key,
        'Content-Type: application/json',
        'Prefer: return=representation',
    ];

    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CUSTOMREQUEST  => $method,
        CURLOPT_HTTPHEADER     => $headers,
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_TIMEOUT        => 15,
    ]);

    if (!empty($body)) {
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($body));
    }

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    
    // For pagination and total counts, extract Content-Range header if present
    $headers_out = [];
    if($method === 'GET') {
        // Need to capture headers for count
        curl_setopt($ch, CURLOPT_HEADER, true);
        $response = curl_exec($ch);
        $header_size = curl_getinfo($ch, CURLINFO_HEADER_SIZE);
        $header_str = substr($response, 0, $header_size);
        $body_str = substr($response, $header_size);
        
        foreach (explode("\r\n", $header_str) as $i => $line) {
            if ($i === 0) continue;
            if (empty($line)) continue;
            $parts = explode(': ', $line, 2);
            if (count($parts) === 2) {
                $headers_out[strtolower($parts[0])] = $parts[1];
            }
        }
        $data = json_decode($body_str, true) ?? [];
    } else {
        $data = json_decode($response, true) ?? [];
    }
    
    curl_close($ch);

    return [
        'data' => $data, 
        'status' => $httpCode, 
        'headers' => $headers_out
    ];
}

// JWT handling
function jwt_encode(array $payload): string {
    $header  = base64url_encode(json_encode(['alg'=>'HS256','typ'=>'JWT']));
    $payload = base64url_encode(json_encode($payload));
    $sig     = base64url_encode(hash_hmac('sha256', "$header.$payload", JWT_SECRET, true));
    return "$header.$payload.$sig";
}

function jwt_decode(string $token): ?array {
    $parts = explode('.', $token);
    if (count($parts) !== 3) return null;
    [$header, $payload, $sig] = $parts;
    $expected = base64url_encode(hash_hmac('sha256', "$header.$payload", JWT_SECRET, true));
    if (!hash_equals($expected, $sig)) return null;
    $data = json_decode(base64url_decode($payload), true);
    if (!$data || (isset($data['exp']) && $data['exp'] < time())) return null;
    return $data;
}

function base64url_encode(string $data): string {
    return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
}

function base64url_decode(string $data): string {
    return base64_decode(strtr($data, '-_', '+/'));
}

function verify_admin_token(): bool {
    $auth = $_SERVER['HTTP_AUTHORIZATION']
         ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION']
         ?? '';
    if (!preg_match('/Bearer\s+(.+)/', $auth, $m)) return false;
    $payload = jwt_decode($m[1]);
    return $payload && isset($payload['admin']) && $payload['admin'] === true;
}

function json_response(mixed $data, int $code = 200): void {
    http_response_code($code);
    echo json_encode($data);
    exit;
}

function qp(string $key, mixed $default = ''): mixed {
    return $_GET[$key] ?? $default;
}
?>
