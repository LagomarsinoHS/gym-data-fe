// ══════════════════════════════════════════════════
// ── DB SQL Templates ───────────────────────────────
// ══════════════════════════════════════════════════

const DB_SQL = {
  mssql: `CREATE TABLE exercises (
  id                NVARCHAR(10)  PRIMARY KEY,
  name              NVARCHAR(255) NOT NULL,
  category          NVARCHAR(100),
  body_part         NVARCHAR(100),
  equipment         NVARCHAR(100),
  instructions_en   NVARCHAR(MAX),
  instructions_es   NVARCHAR(MAX),
  instructions_it   NVARCHAR(MAX),
  instructions_tr   NVARCHAR(MAX),
  instructions_ru   NVARCHAR(MAX),
  instructions_zh   NVARCHAR(MAX),
  instructions_hi   NVARCHAR(MAX),
  instructions_pl   NVARCHAR(MAX),
  instructions_ko   NVARCHAR(MAX),
  muscle_group      NVARCHAR(100),
  secondary_muscles NVARCHAR(MAX),  -- JSON array stored as string
  target            NVARCHAR(100),
  image             NVARCHAR(500),
  gif_url           NVARCHAR(500),
  created_at        DATETIME2
);`,
  postgresql: `CREATE TABLE exercises (
  id                VARCHAR(10)  PRIMARY KEY,
  name              VARCHAR(255) NOT NULL,
  category          VARCHAR(100),
  body_part         VARCHAR(100),
  equipment         VARCHAR(100),
  instructions_en   TEXT,
  instructions_es   TEXT,
  instructions_it   TEXT,
  instructions_tr   TEXT,
  instructions_ru   TEXT,
  instructions_zh   TEXT,
  instructions_hi   TEXT,
  instructions_pl   TEXT,
  instructions_ko   TEXT,
  muscle_group      VARCHAR(100),
  secondary_muscles JSONB,
  target            VARCHAR(100),
  image             VARCHAR(500),
  gif_url           VARCHAR(500),
  created_at        TIMESTAMPTZ
);`,
  mysql: `CREATE TABLE exercises (
  id                VARCHAR(10)  PRIMARY KEY,
  name              VARCHAR(255) NOT NULL,
  category          VARCHAR(100),
  body_part         VARCHAR(100),
  equipment         VARCHAR(100),
  instructions_en   TEXT,
  instructions_es   TEXT,
  instructions_it   TEXT,
  instructions_tr   TEXT,
  instructions_ru   TEXT,
  instructions_zh   TEXT,
  instructions_hi   TEXT,
  instructions_pl   TEXT,
  instructions_ko   TEXT,
  muscle_group      VARCHAR(100),
  secondary_muscles JSON,
  target            VARCHAR(100),
  image             VARCHAR(500),
  gif_url           VARCHAR(500),
  created_at        DATETIME
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,
  sqlite: `CREATE TABLE exercises (
  id                TEXT PRIMARY KEY,
  name              TEXT NOT NULL,
  category          TEXT,
  body_part         TEXT,
  equipment         TEXT,
  instructions_en   TEXT,
  instructions_es   TEXT,
  instructions_it   TEXT,
  instructions_tr   TEXT,
  instructions_ru   TEXT,
  instructions_zh   TEXT,
  instructions_hi   TEXT,
  instructions_pl   TEXT,
  instructions_ko   TEXT,
  muscle_group      TEXT,
  secondary_muscles TEXT,  -- JSON array stored as string
  target            TEXT,
  image             TEXT,
  gif_url           TEXT,
  created_at        TEXT
);`
};

// ══════════════════════════════════════════════════
// ── API Code Templates ─────────────────────────────
// ══════════════════════════════════════════════════

const API_TEMPLATES = {
  curl: {
    getOne: (base) =>
`# GET single exercise by ID
curl -s "${base}/exercises/0001"

# Pretty-print the response (Python 3 built-in)
curl -s "${base}/exercises/0001" | python3 -m json.tool`,

    getAll: (base) =>
`# GET all exercises — page 1, 20 per page
curl -s "${base}/exercises?page=1&limit=20"

# Page 2, 50 per page
curl -s "${base}/exercises?page=2&limit=50"

# Response shape:
# {
#   "data": [ ...exercises ],
#   "total": 1324,
#   "page": 1,
#   "limit": 20,
#   "totalPages": 67
# }`,

    getFiltered: (base) =>
`# Filter by category
curl -s "${base}/exercises?category=Strength&page=1&limit=20"

# Filter by body part
curl -s "${base}/exercises?body_part=Chest&page=1&limit=20"

# Combine filters
curl -s "${base}/exercises?category=Strength&body_part=Chest&page=1&limit=20"

# With equipment filter
curl -s "${base}/exercises?equipment=Barbell&target=Pectorals&page=1&limit=20"`,
  },

  js: {
    getOne: (base) =>
`const BASE_URL = '${base}';

// GET /exercises/:id — fetch a single exercise
async function getExercise(id) {
  const res = await fetch(\`\${BASE_URL}/exercises/\${id}\`);
  if (!res.ok) throw new Error(\`HTTP \${res.status}\`);
  return res.json();
}

// Usage
const exercise = await getExercise('0001');
console.log(exercise.name);        // "Barbell Bench Press"
console.log(exercise.category);    // "Strength"
console.log(exercise.gif_url);     // "videos/0001.gif"`,

    getAll: (base) =>
`const BASE_URL = '${base}';

// GET /exercises?page=&limit= — paginated list
async function getExercises({ page = 1, limit = 20 } = {}) {
  const params = new URLSearchParams({ page, limit });
  const res = await fetch(\`\${BASE_URL}/exercises?\${params}\`);
  if (!res.ok) throw new Error(\`HTTP \${res.status}\`);
  return res.json();
}

// Usage
const result = await getExercises({ page: 1, limit: 20 });
console.log(result.data);       // Array of exercises
console.log(result.total);      // 1324
console.log(result.page);       // 1
console.log(result.totalPages); // 67`,

    getFiltered: (base) =>
`const BASE_URL = '${base}';

// GET /exercises with filters
async function getExercisesFiltered({
  page = 1,
  limit = 20,
  category,
  bodyPart,
  equipment,
  target,
} = {}) {
  const params = new URLSearchParams({ page, limit });
  if (category)  params.set('category', category);
  if (bodyPart)  params.set('body_part', bodyPart);
  if (equipment) params.set('equipment', equipment);
  if (target)    params.set('target', target);

  const res = await fetch(\`\${BASE_URL}/exercises?\${params}\`);
  if (!res.ok) throw new Error(\`HTTP \${res.status}\`);
  return res.json();
}

// Usage
const result = await getExercisesFiltered({
  category: 'Strength',
  bodyPart: 'Chest',
  page: 1,
  limit: 20,
});
console.log(result.data[0].name); // e.g. "Barbell Bench Press"`,
  },

  python: {
    getOne: (base) =>
`import requests

BASE_URL = "${base}"

# GET /exercises/:id — fetch a single exercise
def get_exercise(exercise_id: str) -> dict:
    res = requests.get(f"{BASE_URL}/exercises/{exercise_id}")
    res.raise_for_status()
    return res.json()

# Usage
exercise = get_exercise("0001")
print(exercise["name"])      # Barbell Bench Press
print(exercise["category"])  # Strength
print(exercise["gif_url"])   # videos/0001.gif`,

    getAll: (base) =>
`import requests

BASE_URL = "${base}"

# GET /exercises?page=&limit= — paginated list
def get_exercises(page: int = 1, limit: int = 20) -> dict:
    res = requests.get(f"{BASE_URL}/exercises", params={
        "page": page,
        "limit": limit,
    })
    res.raise_for_status()
    return res.json()

# Usage
result = get_exercises(page=1, limit=20)
print(result["data"])        # list of exercises
print(result["total"])       # 1324
print(result["page"])        # 1
print(result["totalPages"])  # 67`,

    getFiltered: (base) =>
`import requests

BASE_URL = "${base}"

# GET /exercises with filters
def get_exercises_filtered(
    page: int = 1,
    limit: int = 20,
    category: str = None,
    body_part: str = None,
    equipment: str = None,
    target: str = None,
) -> dict:
    params = {"page": page, "limit": limit}
    if category:  params["category"]  = category
    if body_part: params["body_part"] = body_part
    if equipment: params["equipment"] = equipment
    if target:    params["target"]    = target

    res = requests.get(f"{BASE_URL}/exercises", params=params)
    res.raise_for_status()
    return res.json()

# Usage
result = get_exercises_filtered(
    category="Strength",
    body_part="Chest",
    page=1,
    limit=20,
)
print(result["data"][0]["name"])  # e.g. Barbell Bench Press`,
  },

  csharp: {
    getOne: (base) =>
`using System.Net.Http.Json;

var client = new HttpClient { BaseAddress = new Uri("${base}") };

// GET /exercises/:id — fetch a single exercise
async Task<Exercise?> GetExerciseAsync(string id)
{
    var res = await client.GetAsync($"/exercises/{id}");
    res.EnsureSuccessStatusCode();
    return await res.Content.ReadFromJsonAsync<Exercise>();
}

// Usage
var exercise = await GetExerciseAsync("0001");
Console.WriteLine(exercise?.Name);     // Barbell Bench Press
Console.WriteLine(exercise?.Category); // Strength
Console.WriteLine(exercise?.GifUrl);   // videos/0001.gif

// Model
record Exercise(
    string Id, string Name, string Category, string BodyPart,
    string Equipment, string? InstructionsEn, string? InstructionsEs, string? InstructionsIt, string? InstructionsTr, string? InstructionsRu,
    string MuscleGroup, string[] SecondaryMuscles, string Target,
    string Image, string GifUrl, string? CreatedAt
);`,

    getAll: (base) =>
`using System.Net.Http.Json;

var client = new HttpClient { BaseAddress = new Uri("${base}") };

// GET /exercises?page=&limit= — paginated list
async Task<PagedResult<Exercise>> GetExercisesAsync(int page = 1, int limit = 20)
{
    return await client.GetFromJsonAsync<PagedResult<Exercise>>(
        $"/exercises?page={page}&limit={limit}"
    ) ?? throw new Exception("Null response");
}

// Usage
var result = await GetExercisesAsync(page: 1, limit: 20);
Console.WriteLine(result.Total);      // 1324
Console.WriteLine(result.TotalPages); // 67

// Models
record Exercise(string Id, string Name, string Category, string BodyPart,
    string Equipment, string? InstructionsEn, string Target, string GifUrl);
record PagedResult<T>(T[] Data, int Total, int Page, int Limit, int TotalPages);`,

    getFiltered: (base) =>
`using System.Net.Http.Json;
using System.Web;

var client = new HttpClient { BaseAddress = new Uri("${base}") };

// GET /exercises with filters
async Task<PagedResult<Exercise>> GetExercisesFilteredAsync(
    int page = 1, int limit = 20,
    string? category = null, string? bodyPart = null,
    string? equipment = null, string? target = null)
{
    var qs = HttpUtility.ParseQueryString(string.Empty);
    qs["page"]  = page.ToString();
    qs["limit"] = limit.ToString();
    if (category  != null) qs["category"]  = category;
    if (bodyPart  != null) qs["body_part"] = bodyPart;
    if (equipment != null) qs["equipment"] = equipment;
    if (target    != null) qs["target"]    = target;

    return await client.GetFromJsonAsync<PagedResult<Exercise>>(
        $"/exercises?{qs}"
    ) ?? throw new Exception("Null response");
}

// Usage
var result = await GetExercisesFilteredAsync(
    category: "Strength", bodyPart: "Chest", page: 1, limit: 20);
Console.WriteLine(result.Data[0].Name); // e.g. Barbell Bench Press`,
  },

  java: {
    getOne: (base) =>
`import java.net.URI;
import java.net.http.*;

HttpClient client = HttpClient.newHttpClient();
String BASE_URL = "${base}";

// GET /exercises/:id — fetch a single exercise
String getExercise(String id) throws Exception {
    HttpRequest request = HttpRequest.newBuilder()
        .uri(URI.create(BASE_URL + "/exercises/" + id))
        .header("Accept", "application/json")
        .GET()
        .build();

    HttpResponse<String> response =
        client.send(request, HttpResponse.BodyHandlers.ofString());

    if (response.statusCode() != 200)
        throw new RuntimeException("HTTP " + response.statusCode());

    return response.body(); // parse with Jackson/Gson
}

// Usage (with Jackson ObjectMapper)
// ObjectMapper mapper = new ObjectMapper();
// Map<?,?> exercise = mapper.readValue(getExercise("0001"), Map.class);`,

    getAll: (base) =>
`import java.net.URI;
import java.net.http.*;

HttpClient client = HttpClient.newHttpClient();
String BASE_URL = "${base}";

// GET /exercises?page=&limit= — paginated list
String getExercises(int page, int limit) throws Exception {
    String url = BASE_URL + "/exercises?page=" + page + "&limit=" + limit;

    HttpRequest request = HttpRequest.newBuilder()
        .uri(URI.create(url))
        .header("Accept", "application/json")
        .GET()
        .build();

    HttpResponse<String> response =
        client.send(request, HttpResponse.BodyHandlers.ofString());

    return response.body();
    // { "data": [...], "total": 1324, "page": 1, "limit": 20, "totalPages": 67 }
}

// Usage
String json = getExercises(1, 20);`,

    getFiltered: (base) =>
`import java.net.URI;
import java.net.URLEncoder;
import java.net.http.*;
import java.nio.charset.StandardCharsets;

HttpClient client = HttpClient.newHttpClient();
String BASE_URL = "${base}";

// GET /exercises with filters
String getExercisesFiltered(
    int page, int limit,
    String category, String bodyPart, String equipment
) throws Exception {
    StringBuilder url = new StringBuilder(
        BASE_URL + "/exercises?page=" + page + "&limit=" + limit
    );
    if (category  != null)
        url.append("&category=").append(URLEncoder.encode(category, StandardCharsets.UTF_8));
    if (bodyPart  != null)
        url.append("&body_part=").append(URLEncoder.encode(bodyPart, StandardCharsets.UTF_8));
    if (equipment != null)
        url.append("&equipment=").append(URLEncoder.encode(equipment, StandardCharsets.UTF_8));

    HttpRequest request = HttpRequest.newBuilder()
        .uri(URI.create(url.toString()))
        .header("Accept", "application/json")
        .GET()
        .build();

    return client.send(request, HttpResponse.BodyHandlers.ofString()).body();
}

// Usage
String json = getExercisesFiltered(1, 20, "Strength", "Chest", null);`,
  },

  php: {
    getOne: (base) =>
`<?php

define('BASE_URL', '${base}');

// GET /exercises/:id — fetch a single exercise
function getExercise(string $id): array
{
    $url  = BASE_URL . '/exercises/' . urlencode($id);
    $json = file_get_contents($url);
    if ($json === false) throw new RuntimeException("Request failed");
    return json_decode($json, true);
}

// Usage
$exercise = getExercise('0001');
echo $exercise['name'];      // Barbell Bench Press
echo $exercise['category'];  // Strength
echo $exercise['gif_url'];   // videos/0001.gif`,

    getAll: (base) =>
`<?php

define('BASE_URL', '${base}');

// GET /exercises?page=&limit= — paginated list
function getExercises(int $page = 1, int $limit = 20): array
{
    $params = http_build_query(['page' => $page, 'limit' => $limit]);
    $json   = file_get_contents(BASE_URL . '/exercises?' . $params);
    if ($json === false) throw new RuntimeException("Request failed");
    return json_decode($json, true);
}

// Usage
$result = getExercises(1, 20);
print_r($result['data']);       // array of exercises
echo $result['total'];          // 1324
echo $result['totalPages'];     // 67`,

    getFiltered: (base) =>
`<?php

define('BASE_URL', '${base}');

// GET /exercises with filters
function getExercisesFiltered(
    int $page = 1,
    int $limit = 20,
    ?string $category  = null,
    ?string $bodyPart  = null,
    ?string $equipment = null,
    ?string $target    = null
): array {
    $params = ['page' => $page, 'limit' => $limit];
    if ($category)  $params['category']  = $category;
    if ($bodyPart)  $params['body_part'] = $bodyPart;
    if ($equipment) $params['equipment'] = $equipment;
    if ($target)    $params['target']    = $target;

    $json = file_get_contents(BASE_URL . '/exercises?' . http_build_query($params));
    if ($json === false) throw new RuntimeException("Request failed");
    return json_decode($json, true);
}

// Usage
$result = getExercisesFiltered(1, 20, 'Strength', 'Chest');
echo $result['data'][0]['name']; // e.g. Barbell Bench Press`,
  },

  go: {
    getOne: (base) =>
`package main

import (
    "encoding/json"
    "fmt"
    "net/http"
)

const baseURL = "${base}"

// GetExercise fetches a single exercise by ID
func GetExercise(id string) (map[string]any, error) {
    resp, err := http.Get(baseURL + "/exercises/" + id)
    if err != nil {
        return nil, err
    }
    defer resp.Body.Close()

    if resp.StatusCode != 200 {
        return nil, fmt.Errorf("HTTP %d", resp.StatusCode)
    }

    var result map[string]any
    return result, json.NewDecoder(resp.Body).Decode(&result)
}

// Usage
func main() {
    exercise, err := GetExercise("0001")
    if err != nil { panic(err) }
    fmt.Println(exercise["name"])     // Barbell Bench Press
    fmt.Println(exercise["category"]) // Strength
}`,

    getAll: (base) =>
`package main

import (
    "encoding/json"
    "fmt"
    "net/http"
    "net/url"
    "strconv"
)

const baseURL = "${base}"

// GetExercises fetches paginated exercises
func GetExercises(page, limit int) (map[string]any, error) {
    params := url.Values{
        "page":  {strconv.Itoa(page)},
        "limit": {strconv.Itoa(limit)},
    }
    resp, err := http.Get(baseURL + "/exercises?" + params.Encode())
    if err != nil {
        return nil, err
    }
    defer resp.Body.Close()

    var result map[string]any
    return result, json.NewDecoder(resp.Body).Decode(&result)
}

// Usage
func main() {
    result, err := GetExercises(1, 20)
    if err != nil { panic(err) }
    fmt.Println(result["total"])      // 1324
    fmt.Println(result["totalPages"]) // 67
}`,

    getFiltered: (base) =>
`package main

import (
    "encoding/json"
    "fmt"
    "net/http"
    "net/url"
    "strconv"
)

const baseURL = "${base}"

// GetExercisesFiltered fetches exercises with optional filters
func GetExercisesFiltered(page, limit int, category, bodyPart, equipment string) (map[string]any, error) {
    params := url.Values{
        "page":  {strconv.Itoa(page)},
        "limit": {strconv.Itoa(limit)},
    }
    if category  != "" { params.Set("category",  category) }
    if bodyPart  != "" { params.Set("body_part", bodyPart) }
    if equipment != "" { params.Set("equipment", equipment) }

    resp, err := http.Get(baseURL + "/exercises?" + params.Encode())
    if err != nil {
        return nil, err
    }
    defer resp.Body.Close()

    var result map[string]any
    return result, json.NewDecoder(resp.Body).Decode(&result)
}

// Usage
func main() {
    result, err := GetExercisesFiltered(1, 20, "Strength", "Chest", "")
    if err != nil { panic(err) }
    data := result["data"].([]any)
    fmt.Println(data[0].(map[string]any)["name"]) // e.g. Barbell Bench Press
}`,
  },
};

// ══════════════════════════════════════════════════
// ── LLM Prompt Templates ───────────────────────────
// ══════════════════════════════════════════════════

const FRAMEWORK_META = {
  express:  { name: 'Express.js (Node.js)', lang: 'JavaScript', pkg: 'express, pg / mysql2 / better-sqlite3', run: 'node index.js' },
  fastapi:  { name: 'FastAPI (Python)',      lang: 'Python',     pkg: 'fastapi, uvicorn, sqlalchemy, psycopg2-binary', run: 'uvicorn main:app --reload' },
  aspnet:   { name: 'ASP.NET Core (C#)',     lang: 'C#',         pkg: 'Npgsql / MySql.Data / Microsoft.Data.Sqlite', run: 'dotnet run' },
  spring:   { name: 'Spring Boot (Java)',    lang: 'Java',       pkg: 'spring-web, spring-data-jpa, db driver', run: 'mvn spring-boot:run' },
  laravel:  { name: 'Laravel (PHP)',         lang: 'PHP',        pkg: 'laravel/laravel, db driver', run: 'php artisan serve' },
  gin:      { name: 'Gin (Go)',              lang: 'Go',         pkg: 'gin-gonic/gin, database/sql + db driver', run: 'go run main.go' },
};

const DB_META = {
  postgresql: { name: 'PostgreSQL' },
  mysql:      { name: 'MySQL' },
  mssql:      { name: 'SQL Server' },
  sqlite:     { name: 'SQLite' },
};

function buildLlmPrompt(fwKey, dbKey) {
  const fw = FRAMEWORK_META[fwKey];
  const db = DB_META[dbKey];
  const schema = DB_SQL[dbKey];

  return `You are a senior ${fw.lang} developer. Build a complete REST API using ${fw.name} for an exercise/fitness database.

## Dataset Overview
- 1,324 fitness exercises
- Fields: id (string, e.g. "0001"), name, category, body_part, equipment, instructions_en (full text), instructions_es (Spanish text), instructions_it (Italian text), instructions_tr (Turkish text), instructions_ru (Russian text), instructions_zh (Chinese text), instructions_hi (Hindi text), instructions_pl (Polish text), instructions_ko (Korean text), instructions_fr (French text), muscle_group, secondary_muscles (JSON array of strings), target, image (relative path like "images/0001.jpg"), gif_url (relative path like "videos/0001.gif"), created_at

## Database Schema (${db.name})
\`\`\`sql
${schema}
\`\`\`

## Required Endpoints

### 1. GET /exercises/:id
- Return a single exercise by its id
- Return 404 JSON error if not found: { "error": "Exercise not found" }

### 2. GET /exercises
Query parameters (all optional):
- page (integer, default: 1)
- limit (integer, default: 20, max: 100)
- category (string, case-insensitive partial match)
- body_part (string, case-insensitive partial match)
- equipment (string, case-insensitive partial match)
- muscle_group (string, case-insensitive partial match)
- target (string, case-insensitive partial match)

Response format:
\`\`\`json
{
  "data": [ /* array of exercise objects */ ],
  "total": 1324,
  "page": 1,
  "limit": 20,
  "totalPages": 67
}
\`\`\`

### 3. GET /exercises/random
- Return 1 random exercise object

### 4. GET /categories
- Return sorted array of unique category strings

### 5. GET /body-parts
- Return sorted array of unique body_part strings

### 6. GET /equipment
- Return sorted array of unique equipment strings

## Technical Requirements
- Read DB connection string from an environment variable
- Use parameterized queries (never interpolate user input into SQL)
- Return JSON with Content-Type: application/json
- Enable CORS for all origins (or read allowed origins from env var \`ALLOWED_ORIGINS\`)
- Validate page/limit: must be positive integers; reject with 400 if invalid
- Return 500 with { "error": "Internal server error" } on unexpected errors
- Log each request: method, path, status code, duration in ms

## Packages to use
${fw.pkg}

## Deliverables
1. Complete, runnable source code (not pseudocode — every file needed)
2. Brief setup instructions:
   - Install dependencies
   - Run: \`${fw.run}\`

Write clean, production-quality code. Do not skip error handling.`;
}

// ══════════════════════════════════════════════════
// ── State ──────────────────────────────────────────
// ══════════════════════════════════════════════════

let currentDb   = 'mssql';
let currentLang = 'curl';
let currentFw   = 'express';
let currentLlmDb = 'postgresql';
let currentBaseUrl = 'https://api.yourapp.com';
let EXERCISES = null; // lazy-loaded when generate is clicked

// ══════════════════════════════════════════════════
// ── DB Setup ───────────────────────────────────────
// ══════════════════════════════════════════════════

const createSqlEl   = document.getElementById('create-table-sql');
const copyCreateBtn = document.getElementById('copy-create-btn');
const generateBtn   = document.getElementById('generate-sql-btn');
const generateStatus = document.getElementById('generate-status');

function switchDbTab(db) {
  currentDb = db;
  document.querySelectorAll('#db-tabs .tab-btn').forEach(t => {
    t.classList.toggle('active', t.dataset.db === db);
  });
  createSqlEl.textContent = DB_SQL[db];
}

function copyToClipboard(text, btn, resetLabel = 'Copy') {
  navigator.clipboard.writeText(text).then(() => {
    btn.textContent = 'Copied!';
    btn.classList.add('copied');
    setTimeout(() => {
      btn.textContent = resetLabel;
      btn.classList.remove('copied');
    }, 2000);
  });
}

function escStr(val, db) {
  if (val === null || val === undefined) return 'NULL';
  const s = String(val).replace(/'/g, "''");
  return db === 'mssql' ? `N'${s}'` : `'${s}'`;
}

function buildInserts(exercises, db) {
  const lines = [];
  const header = db === 'mssql' ? 'BEGIN TRANSACTION;\nGO\n' : 'BEGIN;\n';
  const footer = db === 'mssql' ? '\nCOMMIT;\nGO' : '\nCOMMIT;';
  lines.push(header);

  exercises.forEach((ex, i) => {
    const muscles = JSON.stringify(Array.isArray(ex.secondary_muscles) ? ex.secondary_muscles : []);
    const instrEn = ex.instructions && ex.instructions.en
      ? ex.instructions.en
      : (Array.isArray(ex.instruction_steps) ? ex.instruction_steps.join(' ') : (ex.instructions || ''));
    const instrEs = ex.instructions && ex.instructions.es ? ex.instructions.es : '';
    const instrIt = ex.instructions && ex.instructions.it ? ex.instructions.it : '';
    const instrTr = ex.instructions && ex.instructions.tr ? ex.instructions.tr : '';
    const instrRu = ex.instructions && ex.instructions.ru ? ex.instructions.ru : '';
    const instrZh = ex.instructions && ex.instructions.zh ? ex.instructions.zh : '';
    const instrHi = ex.instructions && ex.instructions.hi ? ex.instructions.hi : '';
    const instrPl = ex.instructions && ex.instructions.pl ? ex.instructions.pl : '';
    const instrKo = ex.instructions && ex.instructions.ko ? ex.instructions.ko : '';

    const vals = [
      escStr(ex.id, db),
      escStr(ex.name, db),
      escStr(ex.category, db),
      escStr(ex.body_part, db),
      escStr(ex.equipment, db),
      escStr(instrEn, db),
      escStr(instrEs, db),
      escStr(instrIt, db),
      escStr(instrTr, db),
      escStr(instrRu, db),
      escStr(instrZh, db),
      escStr(instrHi, db),
      escStr(instrPl, db),
      escStr(instrKo, db),
      escStr(ex.muscle_group, db),
      escStr(muscles, db),
      escStr(ex.target, db),
      escStr(ex.image, db),
      escStr(ex.gif_url, db),
      escStr(ex.created_at, db),
    ].join(', ');

    lines.push(`INSERT INTO exercises (id, name, category, body_part, equipment, instructions_en, instructions_es, instructions_it, instructions_tr, instructions_ru, instructions_zh, instructions_hi, instructions_pl, instructions_ko, muscle_group, secondary_muscles, target, image, gif_url, created_at) VALUES (${vals});`);

    if (db === 'mssql' && (i + 1) % 50 === 0 && i + 1 < exercises.length) {
      lines.push('GO');
    }
  });

  lines.push(footer);
  return lines.join('\n');
}

async function generateInsertSql() {
  generateBtn.disabled = true;

  try {
    if (!EXERCISES) {
      generateStatus.textContent = 'Loading exercise data…';
      const res = await fetch('/api/exercises');
      if (!res.ok) throw new Error('Could not load exercises');
      EXERCISES = await res.json();
    }

    generateStatus.textContent = 'Generating…';

    await new Promise(r => setTimeout(r, 10));

    const sql  = buildInserts(EXERCISES, currentDb);
    const blob = new Blob([sql], { type: 'text/plain;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `exercises_insert_${currentDb}.sql`;
    a.click();
    URL.revokeObjectURL(url);
    generateStatus.textContent = `✓ Downloaded exercises_insert_${currentDb}.sql`;
  } catch (e) {
    generateStatus.textContent = 'Error generating file.';
    console.error(e);
  }

  generateBtn.disabled = false;
}

// Wire DB tab events
document.querySelectorAll('#db-tabs .tab-btn').forEach(tab => {
  tab.addEventListener('click', () => switchDbTab(tab.dataset.db));
});
copyCreateBtn.addEventListener('click', () => copyToClipboard(createSqlEl.textContent, copyCreateBtn));
generateBtn.addEventListener('click', generateInsertSql);

// Init
switchDbTab('mssql');

// ══════════════════════════════════════════════════
// ── API Integration ────────────────────────────────
// ══════════════════════════════════════════════════

const baseUrlInput = document.getElementById('base-url-input');

function renderApiCode() {
  const templates = API_TEMPLATES[currentLang];
  const base = currentBaseUrl || 'https://api.yourapp.com';
  document.getElementById('code-getOne').textContent      = templates.getOne(base);
  document.getElementById('code-getAll').textContent      = templates.getAll(base);
  document.getElementById('code-getFiltered').textContent = templates.getFiltered(base);
}

function switchLangTab(lang) {
  currentLang = lang;
  document.querySelectorAll('#lang-tabs .tab-btn').forEach(t => {
    t.classList.toggle('active', t.dataset.lang === lang);
  });
  renderApiCode();
}

baseUrlInput.addEventListener('input', () => {
  currentBaseUrl = baseUrlInput.value.trim() || 'https://api.yourapp.com';
  renderApiCode();
});

document.querySelectorAll('#lang-tabs .tab-btn').forEach(tab => {
  tab.addEventListener('click', () => switchLangTab(tab.dataset.lang));
});

// Copy button for code blocks
function copyBlock(btn) {
  const pre = btn.nextElementSibling;
  copyToClipboard(pre.textContent, btn);
}

// Init
renderApiCode();

// ══════════════════════════════════════════════════
// ── Ask Your LLM ───────────────────────────────────
// ══════════════════════════════════════════════════

const llmPromptBox  = document.getElementById('llm-prompt');
const copyPromptBtn = document.getElementById('copy-prompt-btn');

function renderLlmPrompt() {
  llmPromptBox.value = buildLlmPrompt(currentFw, currentLlmDb);
}

document.querySelectorAll('#framework-tabs .selector-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    currentFw = btn.dataset.fw;
    document.querySelectorAll('#framework-tabs .selector-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderLlmPrompt();
  });
});

document.querySelectorAll('#llm-db-tabs .selector-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    currentLlmDb = btn.dataset.llmdb;
    document.querySelectorAll('#llm-db-tabs .selector-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderLlmPrompt();
  });
});

copyPromptBtn.addEventListener('click', () => {
  navigator.clipboard.writeText(llmPromptBox.value).then(() => {
    copyPromptBtn.textContent = '✓ Copied!';
    copyPromptBtn.classList.add('copied');
    setTimeout(() => {
      copyPromptBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="9" height="11" rx="1.5"/><path d="M11 4V3a1 1 0 0 0-1-1H3a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h1"/></svg> Copy Prompt`;
      copyPromptBtn.classList.remove('copied');
    }, 2500);
  });
});

// Init
renderLlmPrompt();

// ══════════════════════════════════════════════════
// ── Scrollspy ──────────────────────────────────────
// ══════════════════════════════════════════════════

const sections = document.querySelectorAll('section[id]');
const navLinks = document.querySelectorAll('.nav-link[data-section]');

const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      navLinks.forEach(link => {
        link.classList.toggle('active', link.dataset.section === entry.target.id);
      });
    }
  });
}, { rootMargin: '-20% 0px -70% 0px', threshold: 0 });

sections.forEach(s => observer.observe(s));
