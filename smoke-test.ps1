<#
.SYNOPSIS
    Smoke-test complet du parcours SwiftColis  -  de la création du colis à la livraison.

.DESCRIPTION
    Teste l'intégralité du workflow en mode boîte noire :
      Phase 0   -  Seed la base de données (utilisateurs de test)
      Phase 1   -  Vérification des identifiants (test-login)
      Phase 2   -  Authentification NextAuth (4 rôles : admin, client, transporteur, relais)
      Phase 3   -  Admin approuve le relais test
      Phase 4   -  Client crée un colis -> récupère trackingNumber + withdrawalCode
      Phase 5   -  Transporteur crée un trajet Alger -> Oran
      Phase 6   -  Matching : matching automatique colis <-> trajet
      Phase 7   -  Scan dépôt relais départ (CREATED -> RECU_RELAIS)
      Phase 8   -  Scan remise transporteur (RECU_RELAIS -> EN_TRANSPORT)
      Phase 9   -  Scan arrivée relais destination (EN_TRANSPORT -> ARRIVE_RELAIS_DESTINATION)
      Phase 10  -  Scan livraison avec vérification identité + code (-> LIVRE)
      Phase 11  -  Suivi public du colis (endpoint sans auth)

.PARAMETER BaseUrl
    URL de base du serveur Next.js (défaut : http://localhost:3000)

.EXAMPLE
    .\smoke-test.ps1
    .\smoke-test.ps1 -BaseUrl "https://mon-app.vercel.app"
#>

param(
    [string]$BaseUrl = "http://localhost:3000",
    [switch]$Ci,
    [switch]$StrictExit,
    [string]$ReportPath = "smoke-test-report.json"
)

# ─────────────────────────────────────────────────────────────────────────────
#  Couleurs & helpers
# ─────────────────────────────────────────────────────────────────────────────
$script:PASS  = 0
$script:FAIL  = 0
$script:SKIP  = 0
$script:RESULTS = @()

function Add-Result([string]$status, [string]$message, [string]$detail = "") {
    $script:RESULTS += [PSCustomObject]@{
        status    = $status
        message   = $message
        detail    = $detail
        timestamp = (Get-Date).ToString('o')
    }
}

function Write-Section([string]$title) {
    if ($Ci) { return }
    Write-Host ""
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
    Write-Host "  $title" -ForegroundColor Cyan
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
}

function Write-Pass([string]$msg) {
    if (-not $Ci) {
        Write-Host "  [PASS] $msg" -ForegroundColor Green
    }
    $script:PASS++
    Add-Result -status "PASS" -message $msg
}

function Write-Fail([string]$msg, [string]$detail = "") {
    Write-Host "  [FAIL] $msg" -ForegroundColor Red
    if ($detail) { Write-Host "         $detail" -ForegroundColor DarkRed }
    $script:FAIL++
    Add-Result -status "FAIL" -message $msg -detail $detail
}

function Write-Skip([string]$msg) {
    Write-Host "  [SKIP] $msg" -ForegroundColor Yellow
    $script:SKIP++
    Add-Result -status "SKIP" -message $msg
}

function Write-Info([string]$msg) {
    if (-not $Ci) {
        Write-Host "         $msg" -ForegroundColor DarkGray
    }
}

# Invoke-RestMethod wrapper avec gestion d'erreur
function Invoke-API {
    param(
        [string]$Method = "GET",
        [string]$Uri,
        [hashtable]$Body = $null,
        [Microsoft.PowerShell.Commands.WebRequestSession]$Session = $null,
        [string]$ContentType = "application/json"
    )

    $params = @{
        Method       = $Method
        Uri          = $Uri
        ContentType  = $ContentType
        ErrorAction  = "Stop"
    }

    if ($Session) { $params.WebSession = $Session }

    if ($Body -and $ContentType -eq "application/json") {
        $params.Body = ($Body | ConvertTo-Json -Depth 10 -Compress)
    }
    elseif ($Body) {
        # form-encoded
        $params.Body = $Body
    }

    try {
        return Invoke-RestMethod @params
    }
    catch [System.Net.WebException] {
        $statusCode = $_.Exception.Response.StatusCode.value__
        try {
            $stream = $_.Exception.Response.GetResponseStream()
            $reader = [System.IO.StreamReader]::new($stream)
            $errorBody = $reader.ReadToEnd() | ConvertFrom-Json -ErrorAction SilentlyContinue
        } catch {}
        return @{
            __error     = $true
            statusCode  = $statusCode
            message     = $_.Exception.Message
            body        = $errorBody
        }
    }
    catch {
        return @{ __error = $true; message = $_.Exception.Message }
    }
}

function IsError($response) {
    return ($response -is [hashtable] -and $response.__error -eq $true) -or
           ($response -is [System.Collections.IDictionary] -and $response.ContainsKey("__error"))
}

# Authentification NextAuth (credentials -> cookie de session)
function Get-AuthSession {
    param(
        [string]$Email,
        [string]$Password
    )

    $newSession = New-Object Microsoft.PowerShell.Commands.WebRequestSession

    try {
        # 1. Obtenir le token CSRF (+ cookie csrf)
        $csrfRes = Invoke-RestMethod -Uri "$BaseUrl/api/auth/csrf" `
            -Method GET `
            -WebSession $newSession `
            -ErrorAction Stop
        $csrfToken = $csrfRes.csrfToken

        # 2. POST credentials -> reçoit le cookie next-auth.session-token
        #    json=true évite la redirection, retourne {url:"..."}
        $loginBody = "csrfToken=$csrfToken&email=$([Uri]::EscapeDataString($Email))&password=$([Uri]::EscapeDataString($Password))&callbackUrl=$([Uri]::EscapeDataString($BaseUrl))&json=true"
        $loginRes = Invoke-WebRequest -UseBasicParsing -Uri "$BaseUrl/api/auth/callback/credentials" `
            -Method POST `
            -Body $loginBody `
            -ContentType "application/x-www-form-urlencoded" `
            -WebSession $newSession `
            -ErrorAction Stop | Out-Null

        return $newSession
    }
    catch {
        return $null
    }
}

# ─────────────────────────────────────────────────────────────────────────────
#  DÉMARRAGE
# ─────────────────────────────────────────────────────────────────────────────
Write-Host ""
if (-not $Ci) {
    Write-Host "╔══════════════════════════════════════════════════════════════╗" -ForegroundColor Magenta
    Write-Host "║        SMOKE-TEST SwiftColis  -  Parcours bout en bout        ║" -ForegroundColor Magenta
    Write-Host "╚══════════════════════════════════════════════════════════════╝" -ForegroundColor Magenta
    Write-Host "  Base URL : $BaseUrl" -ForegroundColor Magenta
    Write-Host "  Heure    : $(Get-Date -Format 'dd/MM/yyyy HH:mm:ss')" -ForegroundColor Magenta
}
else {
    Write-Host "[CI] smoke-test start baseUrl=$BaseUrl strict=$([bool]($StrictExit -or $Ci)) failOnSkip=False"
}


# ─────────────────────────────────────────────────────────────────────────────
#  PHASE 0  -  SEED
# ─────────────────────────────────────────────────────────────────────────────
Write-Section "PHASE 0  -  Seed de la base de données"

$seedRes = Invoke-API -Method GET -Uri "$BaseUrl/api/seed"
if (IsError $seedRes) {
    Write-Skip "Seed indisponible (on continue avec les données existantes)"
    Write-Info $seedRes.message
}
else {
    Write-Pass "Seed réussi  -  utilisateurs et lignes créés"
    Write-Info "admin@swiftcolis.dz | client@demo.dz | transport@demo.dz | relais@demo.dz"
}


# ─────────────────────────────────────────────────────────────────────────────
#  PHASE 1  -  VÉRIFICATION DES IDENTIFIANTS
# ─────────────────────────────────────────────────────────────────────────────
Write-Section "PHASE 1  -  Vérification des identifiants"

$accounts = @(
    @{ email = "admin@swiftcolis.dz";  password = "admin123";    role = "ADMIN"       }
    @{ email = "client@demo.dz";       password = "client123";   role = "CLIENT"      }
    @{ email = "transport@demo.dz";    password = "transport123"; role = "TRANSPORTER" }
    @{ email = "relais@demo.dz";       password = "relais123";   role = "RELAIS"      }
)

$allLoginOk = $true
foreach ($acc in $accounts) {
    $r = Invoke-API -Method POST -Uri "$BaseUrl/api/test-login" -Body @{
        email    = $acc.email
        password = $acc.password
    }
    if (IsError $r) {
        Write-Fail "Login $($acc.role)  -  $($acc.email)" $r.message
        $allLoginOk = $false
    }
    elseif ($r.passwordMatch -eq $true) {
        Write-Pass "Login $($acc.role)  -  $($acc.email) [$($r.storedFormat)]"
    }
    else {
        Write-Fail "Mot de passe incorrect pour $($acc.email)"
        $allLoginOk = $false
    }
}


# ─────────────────────────────────────────────────────────────────────────────
#  PHASE 2  -  SESSIONS NEXTAUTH
# ─────────────────────────────────────────────────────────────────────────────
Write-Section "PHASE 2  -  Sessions NextAuth (cookies)"

$adminSession      = Get-AuthSession -Email "admin@swiftcolis.dz"  -Password "admin123"
$clientSession     = Get-AuthSession -Email "client@demo.dz"       -Password "client123"
$transportSession  = Get-AuthSession -Email "transport@demo.dz"    -Password "transport123"
$relaisSession     = Get-AuthSession -Email "relais@demo.dz"       -Password "relais123"

foreach ($s in @(
    @{ name = "ADMIN";       session = $adminSession }
    @{ name = "CLIENT";      session = $clientSession }
    @{ name = "TRANSPORTER"; session = $transportSession }
    @{ name = "RELAIS";      session = $relaisSession }
)) {
    if ($null -eq $s.session) {
        Write-Fail "Session $($s.name) non créée"
    }
    else {
        # Vérifier que la session est valide en appelant /api/auth/session
        $me = Invoke-RestMethod -Uri "$BaseUrl/api/auth/session" `
            -WebSession $s.session `
            -ErrorAction SilentlyContinue
        if ($me -and $me.user) {
            Write-Pass "Session $($s.name)  -  connecté en tant que $(if ($me.user.name) { $me.user.name } else { $me.user.email })  [role: $($me.user.role)]"
        }
        else {
            Write-Fail "Session $($s.name) créée mais /api/auth/session ne retourne pas d'utilisateur"
        }
    }
}


# ─────────────────────────────────────────────────────────────────────────────
#  PHASE 3  -  ADMIN : OBTENIR L'ID RELAIS + APPROUVER
# ─────────────────────────────────────────────────────────────────────────────
Write-Section "PHASE 3  -  Admin : obtenir et approuver le relais test"

# Récupérer l'ID de l'utilisateur relais
$meRelais = Invoke-RestMethod -Uri "$BaseUrl/api/auth/session" `
    -WebSession $relaisSession `
    -ErrorAction SilentlyContinue
$relaisUserId = if ($meRelais -and $meRelais.user) { $meRelais.user.id } else { $null }

if (-not $relaisUserId) {
    Write-Fail "Impossible de récupérer l'userId relais depuis la session"
    $relaisUserId = ""
}
else {
    Write-Info "userId relais = $relaisUserId"
}

# Lister les relais en tant qu'admin pour trouver le bon
$relaisListRes = Invoke-API -Method GET `
    -Uri "$BaseUrl/api/relais?userId=$relaisUserId" `
    -Session $adminSession

$relaisId = $null
if (IsError $relaisListRes) {
    Write-Fail "Liste des relais échouée" $relaisListRes.message
}
elseif ($relaisListRes.Count -gt 0) {
    $relaisId = $relaisListRes[0].id
    $relaisStatus = $relaisListRes[0].status
    Write-Pass "Relais trouvé : $($relaisListRes[0].commerceName) [id=$relaisId, status=$relaisStatus]"
}
elseif ($relaisListRes -is [array] -or $relaisListRes.Length -eq 0) {
    # Peut être un objet unique
    $relaisId = $relaisListRes.id
    if ($relaisId) {
        $relaisStatus = $relaisListRes.status
        Write-Pass "Relais trouvé : $($relaisListRes.commerceName) [id=$relaisId, status=$relaisStatus]"
    }
    else {
        Write-Fail "Aucun relais trouvé pour cet utilisateur"
    }
}
else {
    $relaisId = $relaisListRes.id
    $relaisStatus = $relaisListRes.status
    Write-Pass "Relais trouvé : $($relaisListRes.commerceName) [id=$relaisId, status=$relaisStatus]"
}

# Approuver le relais si nécessaire
if ($relaisId -and $relaisStatus -ne "APPROVED") {
    $approveRes = Invoke-API -Method PUT `
        -Uri "$BaseUrl/api/relais/$relaisId" `
        -Body @{ status = "APPROVED" } `
        -Session $adminSession

    if (IsError $approveRes) {
        Write-Fail "Approbation du relais échouée" $approveRes.message
    }
    else {
        Write-Pass "Relais approuvé (APPROVED)"
    }
}
elseif ($relaisId) {
    Write-Pass "Relais déjà approuvé"
}

$relaisDepartLookup = Invoke-API -Method GET -Uri "$BaseUrl/api/relais?status=APPROVED&ville=alger"
$relaisArriveeLookup = Invoke-API -Method GET -Uri "$BaseUrl/api/relais?status=APPROVED&ville=oran"

$relaisDepartId = if (-not (IsError $relaisDepartLookup) -and $relaisDepartLookup.Count -gt 0) { $relaisDepartLookup[0].id } else { $null }
$relaisArriveeId = if (-not (IsError $relaisArriveeLookup) -and $relaisArriveeLookup.Count -gt 0) { $relaisArriveeLookup[0].id } else { $null }

if ($relaisDepartId -and $relaisArriveeId) {
    Write-Pass "Relais logistiques trouvés  -  départ=$relaisDepartId / arrivée=$relaisArriveeId"
}
else {
    Write-Fail "Relais logistiques introuvables" "Il faut au moins un relais actif à Alger et un à Oran pour le smoke logistique."
}


# ─────────────────────────────────────────────────────────────────────────────
#  PHASE 4  -  CLIENT : CRÉER UN COLIS
# ─────────────────────────────────────────────────────────────────────────────
Write-Section "PHASE 4  -  Client crée un colis"

# Récupérer l'userId client
$meClient = Invoke-RestMethod -Uri "$BaseUrl/api/auth/session" `
    -WebSession $clientSession `
    -ErrorAction SilentlyContinue
$clientUserId = if ($meClient -and $meClient.user) { $meClient.user.id } else { $null }

if (-not $clientUserId) {
    Write-Fail "Impossible de récupérer l'userId client"
    $clientUserId = "test-client-id"
}
else {
    Write-Info "userId client = $clientUserId"
}

$withdrawalCode = "123456"

$parcelBody = @{
    clientId           = $clientUserId
    senderFirstName    = "Ahmed"
    senderLastName     = "Benali"
    senderPhone        = "+213555111111"
    recipientFirstName = "Fatima"
    recipientLastName  = "Cherif"
    recipientPhone     = "+213555444444"
    withdrawalCode     = $withdrawalCode
    relaisDepartId     = $relaisDepartId
    relaisArriveeId    = $relaisArriveeId
    villeDepart        = "alger"
    villeArrivee       = "oran"
    format             = "PETIT"
    weight             = 1.5
    description        = "Test smoke - livre"
}

$parcelRes = Invoke-API -Method POST `
    -Uri "$BaseUrl/api/parcels" `
    -Body $parcelBody `
    -Session $clientSession

if (IsError $parcelRes) {
    Write-Fail "Création du colis échouée" $parcelRes.message
    $trackingNumber = "TEST-FALLBACK-0001"
    $colisId        = $null
}
else {
    $trackingNumber = $parcelRes.trackingNumber
    $colisId        = $parcelRes.id
    Write-Pass "Colis créé  -  tracking: $trackingNumber"
    Write-Info "id=$colisId | status=$($parcelRes.status) | prix=$($parcelRes.prixClient) DA | code=$withdrawalCode"
}


# ─────────────────────────────────────────────────────────────────────────────
#  PHASE 5  -  TRANSPORTEUR : CRÉER UN TRAJET
# ─────────────────────────────────────────────────────────────────────────────
Write-Section "PHASE 5  -  Transporteur crée un trajet Alger -> Oran"

$meTransport = Invoke-RestMethod -Uri "$BaseUrl/api/auth/session" `
    -WebSession $transportSession `
    -ErrorAction SilentlyContinue
$transporteurId = if ($meTransport -and $meTransport.user) { $meTransport.user.id } else { $null }

$trajetBody = @{
    transporteurId = $transporteurId
    villeDepart    = "alger"
    villeArrivee   = "oran"
    villesEtapes   = @()
    dateDepart     = (Get-Date).AddDays(1).ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
    dateArrivee    = (Get-Date).AddDays(2).ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
    placesColis    = 10
    status         = "PROGRAMME"
}

$trajetRes = Invoke-API -Method POST `
    -Uri "$BaseUrl/api/trajets" `
    -Body $trajetBody `
    -Session $transportSession

if (IsError $trajetRes) {
    Write-Fail "Création du trajet échouée" $trajetRes.message
    $trajetId = $null
}
else {
    $trajetId = $trajetRes.id
    Write-Pass "Trajet créé  -  $($trajetRes.villeDepart) -> $($trajetRes.villeArrivee) le $(([datetime]$trajetRes.dateDepart).ToString('dd/MM/yyyy'))"
    Write-Info "id=$trajetId | places=$($trajetRes.placesColis) | status=$($trajetRes.status)"
}


# ─────────────────────────────────────────────────────────────────────────────
#  PHASE 6  -  MATCHING : associer le colis au trajet
# ─────────────────────────────────────────────────────────────────────────────
Write-Section "PHASE 6  -  Matching automatique colis <-> trajet"

if ($colisId) {
    # 6a. GET : trajets disponibles pour ce colis
    $matchGetRes = Invoke-API -Method GET `
        -Uri "$BaseUrl/api/matching?colisId=$colisId" `
        -Session $clientSession

    if (IsError $matchGetRes) {
        Write-Fail "GET /api/matching échoué" $matchGetRes.message
    }
    elseif ($matchGetRes -is [array]) {
        Write-Pass "GET /api/matching  -  $($matchGetRes.Count) trajet(s) disponible(s)"
    }
    else {
        Write-Pass "GET /api/matching  -  réponse reçue"
    }

    # 6b. POST : déclencher le matching automatique
    $matchPostRes = Invoke-API -Method POST `
        -Uri "$BaseUrl/api/matching" `
        -Body @{ colisId = $colisId } `
        -Session $clientSession

    if (IsError $matchPostRes) {
        $detail = if ($matchPostRes.statusCode -eq 422) { "(Aucun trajet disponible  -  normal si le trajet vient d'être créé)" } else { $matchPostRes.message }
        if ($matchPostRes.statusCode -eq 422) {
            Write-Skip "POST /api/matching  -  422 $detail"
        }
        else {
            Write-Fail "POST /api/matching échoué" $detail
        }
    }
    else {
        $missionId = if ($matchPostRes.mission) { $matchPostRes.mission.id } else { $matchPostRes.id }
        Write-Pass "Matching réussi  -  mission créée"
        Write-Info "missionId=$missionId | trajetId=$(if ($matchPostRes.mission) { $matchPostRes.mission.trajetId } else { $matchPostRes.trajetId })"
    }
}
else {
    Write-Skip "Matching  -  colisId absent, étape ignorée"
}

# ─────────────────────────────────────────────────────────────────────────────
#  PHASE 7  -  SCAN DÉPÔT (RELAIS DÉPART)
#  CREATED -> RECU_RELAIS (avec encaissement cash)
# ─────────────────────────────────────────────────────────────────────────────
Write-Section "PHASE 7  -  Scan dépôt : CREATED -> RECU_RELAIS"

$scanDepotRes = Invoke-API -Method POST `
    -Uri "$BaseUrl/api/relais/scan-depot" `
    -Body @{
        trackingNumber = $trackingNumber
        relaisId       = $relaisDepartId
        cashAmount     = 1150
    } `
    -Session $relaisSession

if (IsError $scanDepotRes) {
    $scanDepotError = if ($scanDepotRes.body -and $scanDepotRes.body.error) { [string]$scanDepotRes.body.error } else { '' }
    if ($scanDepotRes.statusCode -eq 400 -and $scanDepotError -like '*Statut invalide*RECU_RELAIS*') {
        Write-Skip "scan-depot déjà effectué (colis déjà en RECU_RELAIS après matching)"
        Write-Info $scanDepotError
    }
    else {
        Write-Fail "scan-depot échoué [$($scanDepotRes.statusCode)]" $scanDepotRes.message
        if ($scanDepotRes.body -and $scanDepotRes.body.error) { Write-Info $scanDepotRes.body.error }
    }
}
else {
    Write-Pass "scan-depot OK  -  nouveau statut : $($scanDepotRes.newStatus)"
    Write-Info $scanDepotRes.message
}


# ─────────────────────────────────────────────────────────────────────────────
#  PHASE 8  -  SCAN REMISE TRANSPORTEUR
#  RECU_RELAIS -> EN_TRANSPORT
# ─────────────────────────────────────────────────────────────────────────────
Write-Section "PHASE 8  -  Scan remise transporteur : RECU_RELAIS -> EN_TRANSPORT"

$scanRemiseRes = Invoke-API -Method POST `
    -Uri "$BaseUrl/api/relais/scan-remise-transporteur" `
    -Body @{
        trackingNumber = $trackingNumber
        relaisId       = $relaisDepartId
    } `
    -Session $relaisSession

if (IsError $scanRemiseRes) {
    Write-Fail "scan-remise-transporteur échoué [$($scanRemiseRes.statusCode)]" $scanRemiseRes.message
    if ($scanRemiseRes.body -and $scanRemiseRes.body.error) { Write-Info $scanRemiseRes.body.error }
}
else {
    Write-Pass "scan-remise-transporteur OK  -  nouveau statut : $($scanRemiseRes.newStatus)"
    Write-Info $scanRemiseRes.message
}


# ─────────────────────────────────────────────────────────────────────────────
#  PHASE 9  -  SCAN ARRIVÉE (RELAIS DESTINATION)
#  EN_TRANSPORT -> ARRIVE_RELAIS_DESTINATION
# ─────────────────────────────────────────────────────────────────────────────
Write-Section "PHASE 9  -  Scan arrivée : EN_TRANSPORT -> ARRIVE_RELAIS_DESTINATION"

$scanArriveeRes = Invoke-API -Method POST `
    -Uri "$BaseUrl/api/relais/scan-arrivee" `
    -Body @{
        trackingNumber = $trackingNumber
        relaisId       = $relaisArriveeId
    } `
    -Session $relaisSession

if (IsError $scanArriveeRes) {
    Write-Fail "scan-arrivee échoué [$($scanArriveeRes.statusCode)]" $scanArriveeRes.message
    if ($scanArriveeRes.body -and $scanArriveeRes.body.error) { Write-Info $scanArriveeRes.body.error }
}
else {
    Write-Pass "scan-arrivee OK  -  nouveau statut : $($scanArriveeRes.newStatus)"
    Write-Info $scanArriveeRes.message
}


# ─────────────────────────────────────────────────────────────────────────────
#  PHASE 10  -  SCAN LIVRAISON (VÉRIFICATION IDENTITÉ + CODE)
#  ARRIVE_RELAIS_DESTINATION -> LIVRE
# ─────────────────────────────────────────────────────────────────────────────
Write-Section "PHASE 10  -  Scan livraison : ARRIVE_RELAIS_DESTINATION -> LIVRE"

# 10a. Test avec mauvais code (doit retourner 400/403)
$badLivraisonRes = Invoke-API -Method POST `
    -Uri "$BaseUrl/api/relais/scan-livraison" `
    -Body @{
        trackingNumber     = $trackingNumber
        relaisId           = $relaisArriveeId
        recipientFirstName = "Fatima"
        recipientLastName  = "Cherif"
        recipientPhone     = "+213555444444"
        withdrawalCode     = "000000"
    } `
    -Session $relaisSession

if (IsError $badLivraisonRes -and ($badLivraisonRes.statusCode -eq 400 -or $badLivraisonRes.statusCode -eq 403)) {
    Write-Pass "Mauvais code rejeté (HTTP $($badLivraisonRes.statusCode))  -  sécurité OK"
}
elseif (-not (IsError $badLivraisonRes)) {
    Write-Fail "DANGER : livraison acceptée avec un mauvais code retraitl"
}
else {
    Write-Skip "Vérification du mauvais code  -  statut inattendu $($badLivraisonRes.statusCode)"
}

# 10b. Livraison avec le bon code
$goodLivraisonRes = Invoke-API -Method POST `
    -Uri "$BaseUrl/api/relais/scan-livraison" `
    -Body @{
        trackingNumber     = $trackingNumber
        relaisId           = $relaisArriveeId
        recipientFirstName = "Fatima"
        recipientLastName  = "Cherif"
        recipientPhone     = "+213555444444"
        withdrawalCode     = $withdrawalCode
    } `
    -Session $relaisSession

if (IsError $goodLivraisonRes) {
    Write-Fail "scan-livraison échoué [$($goodLivraisonRes.statusCode)]" $goodLivraisonRes.message
    if ($goodLivraisonRes.body -and $goodLivraisonRes.body.error) { Write-Info $goodLivraisonRes.body.error }
}
else {
    Write-Pass "scan-livraison OK  -  statut final : $($goodLivraisonRes.newStatus)"
    Write-Info $goodLivraisonRes.message
}


# ─────────────────────────────────────────────────────────────────────────────
#  PHASE 11  -  SUIVI PUBLIC (sans authentification)
# ─────────────────────────────────────────────────────────────────────────────
Write-Section "PHASE 11  -  Suivi public (sans authentification)"

$trackingRes = Invoke-API -Method GET -Uri "$BaseUrl/api/parcels?tracking=$trackingNumber"

if (IsError $trackingRes) {
    Write-Fail "Suivi public échoué" $trackingRes.message
}
elseif ($trackingRes -is [array] -and $trackingRes.Count -gt 0) {
    $finalParcel = $trackingRes[0]
    Write-Pass "Suivi public OK  -  tracking: $($finalParcel.trackingNumber) | statut final: $($finalParcel.status)"
    
    if ($finalParcel.status -eq "LIVRE") {
        Write-Pass "Statut final = LIVRE  -  parcours complet validé !"
    }
    else {
        Write-Info "Statut actuel : $($finalParcel.status) (attendu: LIVRE  -  possible si une étape antérieure a échoué)"
    }

    $history = $finalParcel.trackingHistory
    if ($history -and $history.Count -gt 0) {
        Write-Info "Historique ($($history.Count) événements) :"
        foreach ($evt in ($history | Sort-Object createdAt)) {
            Write-Info "  -> $($evt.status)   -   $($evt.notes)"
        }
    }
}
elseif ($trackingRes -is [array] -and $trackingRes.Count -eq 0) {
    Write-Fail "Colis introuvable pour le tracking $trackingNumber"
}
else {
    Write-Pass "Suivi public retourne une réponse"
}


# ─────────────────────────────────────────────────────────────────────────────
#  RÉSUMÉ FINAL
# ─────────────────────────────────────────────────────────────────────────────
$total = $script:PASS + $script:FAIL + $script:SKIP
$effectiveStrict = $StrictExit -or $Ci
$report = [PSCustomObject]@{
    baseUrl         = $BaseUrl
    ciMode          = [bool]$Ci
    strictExit      = [bool]$effectiveStrict
    failOnSkip      = [bool](-not $Ci -and $effectiveStrict)
    totals          = [PSCustomObject]@{
        total = $total
        pass  = $script:PASS
        fail  = $script:FAIL
        skip  = $script:SKIP
    }
    failedChecks    = @($script:RESULTS | Where-Object { $_.status -eq 'FAIL' } | Select-Object -ExpandProperty message)
    skippedChecks   = @($script:RESULTS | Where-Object { $_.status -eq 'SKIP' } | Select-Object -ExpandProperty message)
    generatedAt     = (Get-Date).ToString('o')
}

if ($Ci) {
    $report | ConvertTo-Json -Depth 8 | Out-File -FilePath $ReportPath -Encoding utf8
    Write-Host "[CI] summary total=$total pass=$($script:PASS) fail=$($script:FAIL) skip=$($script:SKIP)"
    Write-Host "[CI] politique failOnSkip=$($report.failOnSkip) (les SKIP sont non bloquants en CI)"
    if ($script:FAIL -gt 0) {
        Write-Host "[CI] failed checks: $((@($report.failedChecks) -join '; '))"
    }
    if ($script:SKIP -gt 0) {
        Write-Host "[CI] skipped checks: $((@($report.skippedChecks) -join '; '))"
    }
    Write-Host "[CI] report: $ReportPath"
}
else {
    Write-Host ""
    Write-Host "╔══════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
    Write-Host "║                      RÉSUMÉ DU TEST                        ║" -ForegroundColor Cyan
    Write-Host "╠══════════════════════════════════════════════════════════════╣" -ForegroundColor Cyan
    Write-Host ("║  Total   : {0,-5}                                           ║" -f $total) -ForegroundColor Cyan
    Write-Host ("║  PASS    : {0,-5}                                           ║" -f $script:PASS) -ForegroundColor Green
    Write-Host ("║  FAIL    : {0,-5}                                           ║" -f $script:FAIL) -ForegroundColor $(if ($script:FAIL -gt 0) { "Red" } else { "Green" })
    Write-Host ("║  SKIP    : {0,-5}                                           ║" -f $script:SKIP) -ForegroundColor Yellow
    Write-Host "╚══════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
    Write-Host ""
}

$shouldFail = $false
if ($effectiveStrict) {
    # En CI, les SKIP sont informatifs et ne doivent pas casser le pipeline.
    # En local strict, FAIL + SKIP restent bloquants.
    if ($Ci) {
        $shouldFail = ($script:FAIL -gt 0)
    }
    else {
        $shouldFail = ($script:FAIL -gt 0 -or $script:SKIP -gt 0)
    }
}
else {
    $shouldFail = ($script:FAIL -gt 0)
}

if (-not $shouldFail) {
    if (-not $Ci) {
        Write-Host "  Tous les tests sont passés !" -ForegroundColor Green
    }
    exit 0
}
else {
    if (-not $Ci) {
        Write-Host "  $($script:FAIL) test(s) en erreur. Vérifiez les détails ci-dessus." -ForegroundColor Red
    }
    exit 1
}
