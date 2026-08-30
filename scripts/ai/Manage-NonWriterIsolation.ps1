[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('Create', 'ValidateIsolation', 'Cleanup', 'ControllerAssign', 'ControllerVerify', 'WriterComplete', 'ControllerRelease', 'InspectWriter')]
    [string]$Action,

    # `UntrackedPath` is retained solely to reject an ambiguous legacy/new
    # invocation.  Create accepts paths only through this one payload.
    [string[]]$UntrackedPath = @(),
    [string]$UntrackedPathPayload,
    [string]$IsolationRoot,
    [ValidateSet('', 'EXPLORER', 'REVIEWER', 'VERIFIER')]
    [string]$IsolationPurpose = '',
    [switch]$EnableVerifierScratch,

    [string]$TaskId,
    [string]$WriterLeaseId,
    [string]$PlannedWriterInstanceId,
    [string]$AcquirerRuntimeSessionId,
    [string]$WriterAgentId,
    [string]$WriterTaskName,
    [string]$WriterRuntimeSessionId,
    [int]$WriterRuntimePid,
    [string]$PrimaryRuntimeSessionId,
    [string]$AuthorityId,
    [string]$AssignmentId,
    [string]$OperationId
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$script:LegacyUntrackedPathProvided = $PSBoundParameters.ContainsKey('UntrackedPath')
$script:UntrackedPathPayloadProvided = $PSBoundParameters.ContainsKey('UntrackedPathPayload')

$script:ManifestName = 'non-writer-isolation.manifest.json'
$script:CreationMarkerName = '.creation-owner-v1.json'
$script:CreationMarkerMagic = 'syncgmaildrivesheet.non-writer-creation-marker/v1'
$script:ManifestMagic = 'syncgmaildrivesheet.non-writer-isolation/v2'
$script:WriterLeaseName = 'non-writer-isolation.writer-authority-v3.json'
$script:LegacyWriterLeaseName = 'non-writer-isolation.writer-lease.json'
$script:WriterLeaseMagic = 'syncgmaildrivesheet.writer-authority/v3'
$script:WriterLeaseSchemaVersion = 3
$script:WriterTransitionLockMagic = 'syncgmaildrivesheet.writer-transition-lock/v3'
$script:ActiveIsolationRegistryName = 'non-writer-isolation.active-v3.json'
$script:IsolationLayout = 'windows-short-v1'
$script:IsolationBaseName = 'SGDS-NI'
$script:PathBudgetLimit = 240
$script:GitWorktreeTargetLimit = 180
$script:VerifierNestedReserve = 96
$script:TempBase = [System.IO.Path]::GetFullPath((Join-Path ([System.IO.Path]::GetTempPath()) $script:IsolationBaseName))

function Write-Result {
    param([System.Collections.Specialized.OrderedDictionary]$Values)
    foreach ($key in $Values.Keys) {
        Write-Output ('{0}={1}' -f $key, [string]$Values[$key])
    }
}

function Throw-Failure {
    param([Parameter(Mandatory = $true)][string]$Code)
    throw [System.InvalidOperationException]::new($Code)
}

function Get-FullPath {
    param([Parameter(Mandatory = $true)][string]$Path)
    return [System.IO.Path]::GetFullPath($Path)
}

function Get-NormalizedPath {
    param([Parameter(Mandatory = $true)][string]$Path)
    return (Get-FullPath $Path).TrimEnd([System.IO.Path]::DirectorySeparatorChar, [System.IO.Path]::AltDirectorySeparatorChar).ToLowerInvariant()
}

function Get-TextSha256 {
    param([AllowEmptyString()][string]$Text)
    $sha = [System.Security.Cryptography.SHA256]::Create()
    try {
        $bytes = [System.Text.Encoding]::UTF8.GetBytes([string]$Text)
        return 'sha256:' + (($sha.ComputeHash($bytes) | ForEach-Object { $_.ToString('x2') }) -join '')
    }
    finally {
        $sha.Dispose()
    }
}

function Get-FileSha256 {
    param([Parameter(Mandatory = $true)][string]$Path)
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
        Throw-Failure 'FILE_IDENTITY_UNAVAILABLE'
    }
    $sha = [System.Security.Cryptography.SHA256]::Create()
    $stream = $null
    try {
        $stream = [System.IO.File]::Open($Path, [System.IO.FileMode]::Open, [System.IO.FileAccess]::Read, [System.IO.FileShare]::Read)
        return 'sha256:' + (($sha.ComputeHash($stream) | ForEach-Object { $_.ToString('x2') }) -join '')
    }
    finally { if ($null -ne $stream) { $stream.Dispose() }; $sha.Dispose() }
}

function Test-PathWithinRoot {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][string]$Root
    )
    $fullPath = Get-FullPath $Path
    $fullRoot = Get-FullPath $Root
    $comparison = [System.StringComparison]::OrdinalIgnoreCase
    if ([string]::Equals($fullPath, $fullRoot, $comparison)) {
        return $true
    }
    $rootWithSeparator = $fullRoot.TrimEnd([System.IO.Path]::DirectorySeparatorChar, [System.IO.Path]::AltDirectorySeparatorChar) + [System.IO.Path]::DirectorySeparatorChar
    return $fullPath.StartsWith($rootWithSeparator, $comparison)
}

function Assert-NoReparsePoint {
    param([Parameter(Mandatory = $true)][string]$Path)
    $cursor = Get-FullPath $Path
    while (-not (Test-Path -LiteralPath $cursor)) {
        $parent = [System.IO.Directory]::GetParent($cursor)
        if ($null -eq $parent) {
            Throw-Failure 'PATH_HAS_NO_EXISTING_ANCESTOR'
        }
        $cursor = $parent.FullName
    }
    while ($true) {
        $item = Get-Item -LiteralPath $cursor -Force
        if (($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) {
            Throw-Failure 'REPARSE_POINT_REJECTED'
        }
        $parent = [System.IO.Directory]::GetParent($cursor)
        if ($null -eq $parent) { break }
        $cursor = $parent.FullName
    }
}

function Assert-NoReparsePointsUnderRoot {
    param([Parameter(Mandatory = $true)][string]$Root)
    Assert-NoReparsePoint $Root
    $queue = New-Object System.Collections.Generic.Queue[string]
    $queue.Enqueue((Get-FullPath $Root))
    while ($queue.Count -gt 0) {
        $directory = $queue.Dequeue()
        foreach ($item in @(Get-ChildItem -LiteralPath $directory -Force)) {
            if (($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) {
                Throw-Failure 'REPARSE_POINT_REJECTED'
            }
            if ($item.PSIsContainer) { $queue.Enqueue($item.FullName) }
        }
    }
}

function Get-GitResult {
    param(
        [Parameter(Mandatory = $true)][string[]]$Arguments,
        [Parameter(Mandatory = $true)][string]$WorkingDirectory
    )
    $processInfo = New-Object System.Diagnostics.ProcessStartInfo
    $processInfo.FileName = 'git.exe'
    $processInfo.Arguments = (($Arguments | ForEach-Object {
                if ($_ -match '[\s"]') {
                    '"' + ($_ -replace '(\\*)"', '$1$1\\"' -replace '(\\*)$', '$1$1') + '"'
                }
                else { $_ }
            }) -join ' ')
    $processInfo.WorkingDirectory = $WorkingDirectory
    $processInfo.UseShellExecute = $false
    $processInfo.RedirectStandardOutput = $true
    $processInfo.RedirectStandardError = $true
    $processInfo.CreateNoWindow = $true
    $processInfo.StandardOutputEncoding = [System.Text.UTF8Encoding]::new($false)
    $processInfo.StandardErrorEncoding = [System.Text.UTF8Encoding]::new($false)
    $process = New-Object System.Diagnostics.Process
    $process.StartInfo = $processInfo
    if (-not $process.Start()) { Throw-Failure 'GIT_START_FAILED' }
    $standardOutput = $process.StandardOutput.ReadToEnd()
    $standardError = $process.StandardError.ReadToEnd()
    $process.WaitForExit()
    return [pscustomobject]@{ ExitCode = $process.ExitCode; StandardOutput = $standardOutput; StandardError = $standardError }
}

function Get-RequiredGitOutput {
    param(
        [Parameter(Mandatory = $true)][string[]]$Arguments,
        [Parameter(Mandatory = $true)][string]$WorkingDirectory,
        [Parameter(Mandatory = $true)][string]$FailureCode
    )
    $result = Get-GitResult -Arguments $Arguments -WorkingDirectory $WorkingDirectory
    if ($result.ExitCode -ne 0) { Throw-Failure $FailureCode }
    return $result.StandardOutput.Trim()
}

function Get-RepositoryContext {
    $sourceRoot = Get-RequiredGitOutput -Arguments @('rev-parse', '--show-toplevel') -WorkingDirectory (Get-Location).Path -FailureCode 'NOT_INSIDE_GIT_WORKTREE'
    $sourceRoot = Get-FullPath $sourceRoot
    Assert-NoReparsePoint $sourceRoot
    $commonValue = Get-RequiredGitOutput -Arguments @('-C', $sourceRoot, 'rev-parse', '--git-common-dir') -WorkingDirectory $sourceRoot -FailureCode 'GIT_COMMON_DIRECTORY_RESOLUTION_FAILED'
    $commonDirectory = if ([System.IO.Path]::IsPathRooted($commonValue)) { Get-FullPath $commonValue } else { Get-FullPath (Join-Path $sourceRoot $commonValue) }
    if (-not (Test-Path -LiteralPath $commonDirectory -PathType Container)) { Throw-Failure 'GIT_COMMON_DIRECTORY_MISSING' }
    Assert-NoReparsePoint $commonDirectory
    $workspaceIdentity = Get-TextSha256 ((Get-NormalizedPath $sourceRoot) + "`n" + (Get-NormalizedPath $commonDirectory))
    return [pscustomobject]@{ SourceRoot = $sourceRoot; CommonDirectory = $commonDirectory; WorkspaceIdentity = $workspaceIdentity }
}

function Get-GitIndexPath {
    param([Parameter(Mandatory = $true)][string]$WorkingDirectory)
    $value = Get-RequiredGitOutput -Arguments @('-C', $WorkingDirectory, 'rev-parse', '--git-path', 'index') -WorkingDirectory $WorkingDirectory -FailureCode 'GIT_INDEX_PATH_RESOLUTION_FAILED'
    if ([System.IO.Path]::IsPathRooted($value)) { return Get-FullPath $value }
    return Get-FullPath (Join-Path $WorkingDirectory $value)
}

function Get-OptionalFileSha256 {
    param([Parameter(Mandatory = $true)][string]$Path)
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { return 'missing' }
    return Get-FileSha256 $Path
}

function Get-GitStatusSha256 {
    param([Parameter(Mandatory = $true)][string]$WorkingDirectory)
    $status = Get-RequiredGitOutput -Arguments @('-C', $WorkingDirectory, '-c', 'core.quotePath=true', 'status', '--porcelain=v1', '--untracked-files=all') -WorkingDirectory $WorkingDirectory -FailureCode 'GIT_STATUS_FAILED'
    return Get-TextSha256 $status
}

function Get-RepositoryStateSha256 {
    param([Parameter(Mandatory = $true)][string]$WorkingDirectory)
    $head = Get-RequiredGitOutput -Arguments @('-C', $WorkingDirectory, 'rev-parse', 'HEAD') -WorkingDirectory $WorkingDirectory -FailureCode 'HEAD_RESOLUTION_FAILED'
    return Get-TextSha256 ($head + "`n" + (Get-GitStatusSha256 $WorkingDirectory))
}

function Get-IsolationPathBudget {
    param(
        [Parameter(Mandatory = $true)][string]$SourceRoot,
        [Parameter(Mandatory = $true)][string]$CommonDirectory,
        [Parameter(Mandatory = $true)][string]$Head,
        [Parameter(Mandatory = $true)][string]$WorktreePath,
        [AllowEmptyString()][string]$ScratchPath
    )
    $tree = Get-GitResult -Arguments @('-C', $SourceRoot, '-c', 'core.quotePath=false', 'ls-tree', '-r', '--name-only', $Head) -WorkingDirectory $SourceRoot
    if ($tree.ExitCode -ne 0) { Throw-Failure 'PATH_BUDGET_TREE_ENUMERATION_FAILED' }
    $longestTrackedRelativePath = 0
    foreach ($line in @($tree.StandardOutput -split "`r?`n")) {
        if ($line.Length -gt $longestTrackedRelativePath) { $longestTrackedRelativePath = $line.Length }
    }
    $worktreeLength = (Get-FullPath $WorktreePath).Length
    $scratchLength = if ([string]::IsNullOrWhiteSpace($ScratchPath)) { 0 } else { (Get-FullPath $ScratchPath).Length }
    $checkoutMaximum = $worktreeLength + 1 + $longestTrackedRelativePath
    $gitAdminMaximum = (Get-FullPath $CommonDirectory).Length + 64
    $worktreeGitFileMaximum = $worktreeLength + 5
    $verifierNestedMaximum = if ($scratchLength -eq 0) { 0 } else { $scratchLength + $script:VerifierNestedReserve }
    $observedMaximum = (@($checkoutMaximum, $gitAdminMaximum, $worktreeGitFileMaximum, $verifierNestedMaximum) | Measure-Object -Maximum).Maximum
    $remaining = $script:PathBudgetLimit - $observedMaximum
    $safe = ($worktreeLength -le $script:GitWorktreeTargetLimit -and $observedMaximum -le $script:PathBudgetLimit)
    return [pscustomobject]@{
        Safe = $safe
        Limit = $script:PathBudgetLimit
        ObservedMaximum = $observedMaximum
        Remaining = $remaining
        WorktreePathLength = $worktreeLength
        ScratchPathLength = $scratchLength
        LongestTrackedRelativePath = $longestTrackedRelativePath
        CheckoutMaximum = $checkoutMaximum
        GitAdminMaximum = $gitAdminMaximum
        VerifierNestedMaximum = $verifierNestedMaximum
    }
}

function Assert-ValidTaskId {
    param([string]$Value)
    if ([string]::IsNullOrWhiteSpace($Value) -or $Value.Length -gt 128 -or $Value -notmatch '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$') { Throw-Failure 'TASK_ID_INVALID' }
}

function Assert-ValidLeaseId {
    param([string]$Value, [string]$Code)
    if ([string]::IsNullOrWhiteSpace($Value) -or $Value -notmatch '^[0-9a-fA-F]{32}$') { Throw-Failure $Code }
}

function Assert-ValidIdentityText {
    param([string]$Value, [string]$Code)
    if ([string]::IsNullOrWhiteSpace($Value) -or $Value.Length -gt 256 -or $Value -notmatch '^[A-Za-z0-9][A-Za-z0-9._:/-]{0,255}$') { Throw-Failure $Code }
}

function Assert-ValidOperationId {
    param([string]$Value, [string]$Code)
    if ([string]::IsNullOrWhiteSpace($Value) -or $Value.Length -gt 128 -or $Value -notmatch '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$') { Throw-Failure $Code }
}

function Get-CanonicalUtcMilliseconds {
    return [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
}

function Get-WriterLeasePath {
    param([Parameter(Mandatory = $true)][string]$CommonDirectory)
    $leasePath = Get-FullPath (Join-Path $CommonDirectory $script:WriterLeaseName)
    if (-not (Test-PathWithinRoot -Path $leasePath -Root $CommonDirectory)) { Throw-Failure 'WRITER_LEASE_PATH_OUTSIDE_COMMON_DIRECTORY' }
    return $leasePath
}

function Get-LegacyWriterLeasePath {
    param([Parameter(Mandatory = $true)][string]$CommonDirectory)
    return Get-FullPath (Join-Path $CommonDirectory $script:LegacyWriterLeaseName)
}

function Get-ActiveIsolationRegistryPath {
    param([Parameter(Mandatory = $true)][string]$CommonDirectory)
    return Get-FullPath (Join-Path $CommonDirectory $script:ActiveIsolationRegistryName)
}

function Get-LeaseTransitionLockPath {
    param([Parameter(Mandatory = $true)][string]$LeasePath)
    return $LeasePath + '.transition.lock'
}

function Get-GovernanceTransitionLockTestSetting {
    param(
        [Parameter(Mandatory = $true)][string]$LockPath,
        [Parameter(Mandatory = $true)][string]$Name,
        [ValidateSet('Milliseconds', 'Token')][string]$Kind
    )
    $value = [Environment]::GetEnvironmentVariable($Name)
    if ([string]::IsNullOrWhiteSpace($value)) { return $null }
    if ([Environment]::GetEnvironmentVariable('SGDS_GOVERNANCE_TEST_MODE') -cne 'OWNERSHIP_LOCK_V2') {
        Throw-Failure 'GOVERNANCE_TEST_HOOK_MODE_REQUIRED'
    }
    $tempRoot = Get-FullPath ([System.IO.Path]::GetTempPath())
    if (-not (Test-PathWithinRoot -Path $LockPath -Root $tempRoot)) {
        Throw-Failure 'GOVERNANCE_TEST_HOOK_OUTSIDE_TEMP_REJECTED'
    }
    if ($Kind -eq 'Token') {
        Assert-ValidLeaseId $value 'GOVERNANCE_TEST_LOCK_TOKEN_INVALID'
        return $value.ToLowerInvariant()
    }
    $milliseconds = 0
    if (-not [int]::TryParse($value, [ref]$milliseconds) -or $milliseconds -lt 0 -or $milliseconds -gt 5000) {
        Throw-Failure 'GOVERNANCE_TEST_LOCK_DELAY_INVALID'
    }
    return $milliseconds
}

function Enter-LeaseTransitionLock {
    param([Parameter(Mandatory = $true)][string]$LeasePath)
    $lockPath = Get-LeaseTransitionLockPath $LeasePath
    $stream = $null
    $token = [Guid]::NewGuid().ToString('N')
    try {
        $options = [System.IO.FileOptions]::DeleteOnClose -bor [System.IO.FileOptions]::WriteThrough
        $stream = New-Object System.IO.FileStream($lockPath, [System.IO.FileMode]::CreateNew, [System.IO.FileAccess]::ReadWrite, [System.IO.FileShare]::None, 4096, $options)
        $metadata = [ordered]@{
            magic = $script:WriterTransitionLockMagic
            ownership_token = $token
            lock_path = Get-FullPath $lockPath
            created_utc_ms = Get-CanonicalUtcMilliseconds
        }
        $bytes = [System.Text.UTF8Encoding]::new($false).GetBytes(($metadata | ConvertTo-Json -Compress))
        $stream.Write($bytes, 0, $bytes.Length)
        $stream.Flush($true)
        return [pscustomobject]@{
            ownership_token = $token
            lock_path = Get-FullPath $lockPath
            stream = $stream
        }
    }
    catch [System.IO.IOException] {
        if ($null -ne $stream) { $stream.Dispose() }
        Throw-Failure 'WRITER_LEASE_TRANSITION_LOCKED'
    }
    catch {
        if ($null -ne $stream) { $stream.Dispose() }
        throw
    }
}

function Exit-LeaseTransitionLock {
    param($Lock, [Parameter(Mandatory = $true)][string]$LeasePath)
    if ($null -eq $Lock) { return }
    $lockPath = Get-FullPath (Get-LeaseTransitionLockPath $LeasePath)
    if ($null -eq $Lock.stream -or
        [string]$Lock.lock_path -cne $lockPath -or
        [string]$Lock.ownership_token -notmatch '^[0-9a-f]{32}$') {
        Throw-Failure 'WRITER_LEASE_TRANSITION_LOCK_OWNERSHIP_INVALID'
    }
    $expectedToken = [string]$Lock.ownership_token
    $testToken = Get-GovernanceTransitionLockTestSetting -LockPath $lockPath -Name 'SGDS_GOVERNANCE_TEST_LOCK_EXPECTED_TOKEN' -Kind Token
    if ($null -ne $testToken) { $expectedToken = [string]$testToken }
    $stream = $Lock.stream
    if (-not $stream.CanRead -or -not $stream.CanWrite) { Throw-Failure 'WRITER_LEASE_TRANSITION_LOCK_HANDLE_INVALID' }
    $stream.Flush($true)
    [void]$stream.Seek(0, [System.IO.SeekOrigin]::Begin)
    $bytes = New-Object byte[] ([int]$stream.Length)
    $offset = 0
    while ($offset -lt $bytes.Length) {
        $read = $stream.Read($bytes, $offset, $bytes.Length - $offset)
        if ($read -le 0) { Throw-Failure 'WRITER_LEASE_TRANSITION_LOCK_METADATA_UNREADABLE' }
        $offset += $read
    }
    try { $metadata = [System.Text.Encoding]::UTF8.GetString($bytes) | ConvertFrom-Json }
    catch { Throw-Failure 'WRITER_LEASE_TRANSITION_LOCK_METADATA_INVALID' }
    if ([string]$metadata.magic -cne $script:WriterTransitionLockMagic -or
        [string]$metadata.ownership_token -cne $expectedToken -or
        [string]$metadata.lock_path -cne $lockPath) {
        Throw-Failure 'WRITER_LEASE_TRANSITION_LOCK_OWNERSHIP_MISMATCH'
    }
    $preReleaseHold = Get-GovernanceTransitionLockTestSetting -LockPath $lockPath -Name 'SGDS_GOVERNANCE_TEST_LOCK_PRE_RELEASE_HOLD_MS' -Kind Milliseconds
    if ($null -ne $preReleaseHold -and [int]$preReleaseHold -gt 0) { Start-Sleep -Milliseconds ([int]$preReleaseHold) }
    $stream.Dispose()
    $Lock.stream = $null
    $postReleaseHold = Get-GovernanceTransitionLockTestSetting -LockPath $lockPath -Name 'SGDS_GOVERNANCE_TEST_LOCK_POST_RELEASE_HOLD_MS' -Kind Milliseconds
    if ($null -ne $postReleaseHold -and [int]$postReleaseHold -gt 0) { Start-Sleep -Milliseconds ([int]$postReleaseHold) }
}

function Write-NewJsonFile {
    param([Parameter(Mandatory = $true)][string]$Path, [Parameter(Mandatory = $true)]$Value)
    $bytes = [System.Text.UTF8Encoding]::new($false).GetBytes(($Value | ConvertTo-Json -Depth 12))
    try {
        $stream = New-Object System.IO.FileStream($Path, [System.IO.FileMode]::CreateNew, [System.IO.FileAccess]::Write, [System.IO.FileShare]::None)
        try { $stream.Write($bytes, 0, $bytes.Length); $stream.Flush($true) } finally { $stream.Dispose() }
    }
    catch [System.IO.IOException] { Throw-Failure 'ATOMIC_CREATE_FAILED' }
}

function Replace-JsonFile {
    param([Parameter(Mandatory = $true)][string]$Path, [Parameter(Mandatory = $true)]$Value)
    $directory = Split-Path -Parent $Path
    $temp = Join-Path $directory ('.writer-lease-' + [Guid]::NewGuid().ToString('N') + '.tmp')
    $backup = Join-Path $directory ('.writer-lease-' + [Guid]::NewGuid().ToString('N') + '.bak')
    try {
        [System.IO.File]::WriteAllText($temp, ($Value | ConvertTo-Json -Depth 12), [System.Text.UTF8Encoding]::new($false))
        [System.IO.File]::Replace($temp, $Path, $backup, $true)
        if (Test-Path -LiteralPath $backup -PathType Leaf) { [System.IO.File]::Delete($backup) }
    }
    catch {
        if (Test-Path -LiteralPath $temp -PathType Leaf) { [System.IO.File]::Delete($temp) }
        Throw-Failure 'ATOMIC_REPLACE_FAILED'
    }
}

function Read-WriterLease {
    param([Parameter(Mandatory = $true)][string]$LeasePath)
    if (-not (Test-Path -LiteralPath $LeasePath -PathType Leaf)) { Throw-Failure 'WRITER_LEASE_MISSING' }
    Assert-NoReparsePoint $LeasePath
    try { return [System.IO.File]::ReadAllText($LeasePath, [System.Text.UTF8Encoding]::new($false)) | ConvertFrom-Json }
    catch { Throw-Failure 'WRITER_LEASE_INVALID' }
}

function Test-CompleteWriterLeaseV2 {
    param($Lease, [Parameter(Mandatory = $true)]$Context)
    try {
        if ($Lease.magic -cne $script:WriterLeaseMagic -or [int]$Lease.schema_version -ne $script:WriterLeaseSchemaVersion) { return $false }
        if ([string]$Lease.lease_state -notin @('RESERVED', 'ACTIVE', 'COMPLETED')) { return $false }
        Assert-ValidTaskId ([string]$Lease.task_id)
        Assert-ValidLeaseId ([string]$Lease.lease_id) 'WRITER_LEASE_ID_INVALID'
        Assert-ValidLeaseId ([string]$Lease.planned_writer_instance_id) 'PLANNED_WRITER_INSTANCE_ID_INVALID'
        Assert-ValidIdentityText ([string]$Lease.acquirer_runtime_session_id) 'ACQUIRER_RUNTIME_SESSION_ID_INVALID'
        [void][DateTime]::Parse([string]$Lease.created_utc, [Globalization.CultureInfo]::InvariantCulture, [Globalization.DateTimeStyles]::RoundtripKind)
        if (-not [string]::Equals((Get-NormalizedPath ([string]$Lease.source_root)), (Get-NormalizedPath $Context.SourceRoot), [System.StringComparison]::OrdinalIgnoreCase)) { return $false }
        if (-not [string]::Equals((Get-NormalizedPath ([string]$Lease.git_common_directory)), (Get-NormalizedPath $Context.CommonDirectory), [System.StringComparison]::OrdinalIgnoreCase)) { return $false }
        if ([string]$Lease.workspace_identity -cne [string]$Context.WorkspaceIdentity) { return $false }
        if ([string]$Lease.lease_state -in @('ACTIVE', 'COMPLETED')) {
            if ($null -eq $Lease.writer) { return $false }
            Assert-ValidIdentityText ([string]$Lease.writer.agent_id) 'WRITER_AGENT_ID_INVALID'
            Assert-ValidIdentityText ([string]$Lease.writer.task_name) 'WRITER_TASK_NAME_INVALID'
            Assert-ValidIdentityText ([string]$Lease.writer.runtime_session_id) 'WRITER_RUNTIME_SESSION_ID_INVALID'
            if ([int]$Lease.writer.pid -le 0 -or [int]$Lease.writer.parent_pid -le 0) { return $false }
            [void][DateTime]::Parse([string]$Lease.writer.process_start_utc, [Globalization.CultureInfo]::InvariantCulture, [Globalization.DateTimeStyles]::RoundtripKind)
            [void][DateTime]::Parse([string]$Lease.writer.parent_process_start_utc, [Globalization.CultureInfo]::InvariantCulture, [Globalization.DateTimeStyles]::RoundtripKind)
            [void][DateTime]::Parse([string]$Lease.claimed_utc, [Globalization.CultureInfo]::InvariantCulture, [Globalization.DateTimeStyles]::RoundtripKind)
            if ([string]::IsNullOrWhiteSpace([string]$Lease.writer.executable_sha256) -or [string]::IsNullOrWhiteSpace([string]$Lease.writer.parent_executable_sha256)) { return $false }
        }
        if ([string]$Lease.lease_state -eq 'COMPLETED') {
            [void][DateTime]::Parse([string]$Lease.completed_utc, [Globalization.CultureInfo]::InvariantCulture, [Globalization.DateTimeStyles]::RoundtripKind)
        }
    }
    catch { return $false }
    return $true
}

function Get-ExactProcessIdentity {
    param([Parameter(Mandatory = $true)][int]$ProcessId)
    if ($ProcessId -le 0) { Throw-Failure 'WRITER_RUNTIME_PID_INVALID' }
    $process = Get-CimInstance Win32_Process -Filter ('ProcessId=' + $ProcessId) -ErrorAction SilentlyContinue
    if ($null -eq $process) { return $null }
    if ($null -eq $process.CreationDate -or [string]::IsNullOrWhiteSpace([string]$process.ExecutablePath)) { Throw-Failure 'WRITER_PROCESS_IDENTITY_UNAVAILABLE' }
    $startValue = if ($process.CreationDate -is [DateTime]) {
        ([DateTime]$process.CreationDate).ToUniversalTime()
    }
    else {
        [Management.ManagementDateTimeConverter]::ToDateTime([string]$process.CreationDate).ToUniversalTime()
    }
    $start = $startValue.ToString('o')
    $executable = Get-FullPath ([string]$process.ExecutablePath)
    return [pscustomobject]@{
        pid = [int]$process.ProcessId
        parent_pid = [int]$process.ParentProcessId
        process_start_utc = $start
        executable_path = $executable
        executable_class = [System.IO.Path]::GetFileName($executable).ToLowerInvariant()
        executable_sha256 = Get-FileSha256 $executable
    }
}

function Test-IsAncestorProcess {
    param([Parameter(Mandatory = $true)][int]$AncestorPid, [Parameter(Mandatory = $true)][int]$ChildPid)
    $cursor = $ChildPid
    $seen = @{}
    for ($i = 0; $i -lt 32; $i++) {
        if ($cursor -le 0 -or $seen.ContainsKey([string]$cursor)) { return $false }
        $seen[[string]$cursor] = $true
        if ($cursor -eq $AncestorPid) { return $true }
        $current = Get-CimInstance Win32_Process -Filter ('ProcessId=' + $cursor) -ErrorAction SilentlyContinue
        if ($null -eq $current) { return $false }
        $cursor = [int]$current.ParentProcessId
    }
    return $false
}

function Get-ClaimedWriterIdentity {
    if ($WriterRuntimePid -le 0) { Throw-Failure 'WRITER_RUNTIME_PID_REQUIRED' }
    if ($WriterRuntimePid -eq $PID) { Throw-Failure 'HELPER_TRANSIENT_PID_REJECTED' }
    Assert-ValidIdentityText $WriterAgentId 'WRITER_AGENT_ID_INVALID'
    Assert-ValidIdentityText $WriterTaskName 'WRITER_TASK_NAME_INVALID'
    Assert-ValidIdentityText $WriterRuntimeSessionId 'WRITER_RUNTIME_SESSION_ID_INVALID'
    if (-not (Test-IsAncestorProcess -AncestorPid $WriterRuntimePid -ChildPid $PID)) { Throw-Failure 'WRITER_RUNTIME_NOT_HELPER_ANCESTOR' }
    $writer = Get-ExactProcessIdentity $WriterRuntimePid
    if ($null -eq $writer) { Throw-Failure 'WRITER_RUNTIME_PROCESS_MISSING' }
    $parent = Get-ExactProcessIdentity ([int]$writer.parent_pid)
    if ($null -eq $parent) { Throw-Failure 'WRITER_PARENT_PROCESS_MISSING' }
    return [ordered]@{
        agent_id = $WriterAgentId
        task_name = $WriterTaskName
        runtime_session_id = $WriterRuntimeSessionId
        pid = [int]$writer.pid
        process_start_utc = [string]$writer.process_start_utc
        executable_class = [string]$writer.executable_class
        executable_sha256 = [string]$writer.executable_sha256
        parent_pid = [int]$parent.pid
        parent_process_start_utc = [string]$parent.process_start_utc
        parent_executable_class = [string]$parent.executable_class
        parent_executable_sha256 = [string]$parent.executable_sha256
    }
}

function Test-WriterIdentityExact {
    param($Expected, $Actual)
    foreach ($name in @('agent_id', 'task_name', 'runtime_session_id', 'pid', 'process_start_utc', 'executable_class', 'executable_sha256', 'parent_pid', 'parent_process_start_utc', 'parent_executable_class', 'parent_executable_sha256')) {
        if ([string]$Expected.$name -cne [string]$Actual[$name]) { return $false }
    }
    return $true
}

function Get-WriterInspection {
    param($Lease)
    if ([string]$Lease.lease_state -eq 'RESERVED' -or $null -eq $Lease.writer) { return 'NOT_PROVEN' }
    try {
        $actual = Get-ExactProcessIdentity ([int]$Lease.writer.pid)
        if ($null -eq $actual) { return 'PROVEN_TERMINATED' }
        if ([string]$actual.process_start_utc -cne [string]$Lease.writer.process_start_utc -or
            [string]$actual.executable_sha256 -cne [string]$Lease.writer.executable_sha256 -or
            [int]$actual.parent_pid -ne [int]$Lease.writer.parent_pid) { return 'PROVEN_TERMINATED' }
        $parent = Get-ExactProcessIdentity ([int]$actual.parent_pid)
        if ($null -eq $parent) { return 'NOT_PROVEN' }
        if ([string]$parent.process_start_utc -cne [string]$Lease.writer.parent_process_start_utc -or [string]$parent.executable_sha256 -cne [string]$Lease.writer.parent_executable_sha256) { return 'PROVEN_TERMINATED' }
        if ([string]$Lease.lease_state -eq 'ACTIVE') { return 'PROVEN_ACTIVE' }
        return 'NOT_PROVEN'
    }
    catch { return 'NOT_PROVEN' }
}

function Assert-LeaseMatches {
    param($Lease, $Context)
    if (-not (Test-CompleteWriterLeaseV2 -Lease $Lease -Context $Context) -or [string]$Lease.task_id -cne $TaskId -or [string]$Lease.lease_id -cne $WriterLeaseId) { Throw-Failure 'WRITER_LEASE_MISMATCH' }
    if (-not [string]::IsNullOrWhiteSpace($PlannedWriterInstanceId) -and [string]$Lease.planned_writer_instance_id -cne $PlannedWriterInstanceId) { Throw-Failure 'PLANNED_WRITER_INSTANCE_MISMATCH' }
}

# V3 is controller-scoped cooperative orchestration.  The identifiers below
# fence accidental cross-assignment/replay; they are not security credentials.
function New-WriterState {
    param($Context)
    return [ordered]@{
        magic = $script:WriterLeaseMagic; schema_version = $script:WriterLeaseSchemaVersion
        source_root = $Context.SourceRoot; git_common_directory = $Context.CommonDirectory
        workspace_identity = $Context.WorkspaceIdentity; revision = 0
        slot = [ordered]@{ state = 'NONE'; authority_id = $null; assignment_id = $null; writer_id = $null; assigned_at_utc_ms = $null; verified_at_utc_ms = $null; completed_at_utc_ms = $null }
        operations = @()
    }
}

function Assert-ExactObjectProperties {
    param($Value, [string[]]$Expected, [string]$Code)
    if ($null -eq $Value) { Throw-Failure $Code }
    $actual = if ($Value -is [System.Collections.IDictionary]) { @($Value.Keys | ForEach-Object { [string]$_ } | Sort-Object) } else { @($Value.PSObject.Properties | ForEach-Object { [string]$_.Name } | Sort-Object) }
    $wanted = @($Expected | Sort-Object)
    if ($actual.Count -ne $wanted.Count) { Throw-Failure $Code }
    for ($i = 0; $i -lt $wanted.Count; $i++) { if ($actual[$i] -cne $wanted[$i]) { Throw-Failure $Code } }
}

function Assert-NonNegativeIntegral {
    param($Value, [string]$Code, [switch]$AllowNull)
    if ($null -eq $Value) { if ($AllowNull) { return }; Throw-Failure $Code }
    if ($Value -isnot [Int64] -and $Value -isnot [Int32]) { Throw-Failure $Code }
    if ([Int64]$Value -lt 0) { Throw-Failure $Code }
}

function Assert-WriterSlot {
    param($Slot)
    Assert-ExactObjectProperties $Slot @('state', 'authority_id', 'assignment_id', 'writer_id', 'assigned_at_utc_ms', 'verified_at_utc_ms', 'completed_at_utc_ms') 'WRITER_STATE_SLOT_SHAPE_INVALID'
    $state = [string]$Slot.state
    if ($state -notin @('NONE', 'ASSIGNED', 'ACTIVE', 'COMPLETED')) { Throw-Failure 'WRITER_STATE_SLOT_STATE_INVALID' }
    if ($state -eq 'NONE') {
        foreach ($name in @('authority_id', 'assignment_id', 'writer_id', 'assigned_at_utc_ms', 'verified_at_utc_ms', 'completed_at_utc_ms')) { if ($null -ne $Slot.$name) { Throw-Failure 'WRITER_STATE_NONE_SLOT_CONTRADICTORY' } }
        return
    }
    Assert-ValidIdentityText ([string]$Slot.authority_id) 'WRITER_STATE_AUTHORITY_INVALID'
    Assert-ValidIdentityText ([string]$Slot.assignment_id) 'WRITER_STATE_ASSIGNMENT_INVALID'
    Assert-ValidIdentityText ([string]$Slot.writer_id) 'WRITER_STATE_WRITER_INVALID'
    Assert-NonNegativeIntegral $Slot.assigned_at_utc_ms 'WRITER_STATE_ASSIGNED_TIMESTAMP_INVALID'
    if ($state -eq 'ASSIGNED') {
        if ($null -ne $Slot.verified_at_utc_ms -or $null -ne $Slot.completed_at_utc_ms) { Throw-Failure 'WRITER_STATE_ASSIGNED_SLOT_CONTRADICTORY' }
        return
    }
    Assert-NonNegativeIntegral $Slot.verified_at_utc_ms 'WRITER_STATE_VERIFIED_TIMESTAMP_INVALID'
    if ([Int64]$Slot.verified_at_utc_ms -lt [Int64]$Slot.assigned_at_utc_ms) { Throw-Failure 'WRITER_STATE_TIMESTAMP_ORDER_INVALID' }
    if ($state -eq 'ACTIVE') {
        if ($null -ne $Slot.completed_at_utc_ms) { Throw-Failure 'WRITER_STATE_ACTIVE_SLOT_CONTRADICTORY' }
        return
    }
    Assert-NonNegativeIntegral $Slot.completed_at_utc_ms 'WRITER_STATE_COMPLETED_TIMESTAMP_INVALID'
    if ([Int64]$Slot.completed_at_utc_ms -lt [Int64]$Slot.verified_at_utc_ms) { Throw-Failure 'WRITER_STATE_TIMESTAMP_ORDER_INVALID' }
}

function Assert-WriterState {
    param($State, $Context)
    Assert-ExactObjectProperties $State @('magic', 'schema_version', 'source_root', 'git_common_directory', 'workspace_identity', 'revision', 'slot', 'operations') 'WRITER_STATE_SHAPE_INVALID'
    if ([string]$State.magic -cne $script:WriterLeaseMagic -or $State.schema_version -isnot [Int64] -and $State.schema_version -isnot [Int32] -or [Int64]$State.schema_version -ne $script:WriterLeaseSchemaVersion) { Throw-Failure 'WRITER_STATE_VERSION_INVALID' }
    if ([string]$State.workspace_identity -cne [string]$Context.WorkspaceIdentity -or
        -not [string]::Equals((Get-NormalizedPath ([string]$State.source_root)), (Get-NormalizedPath $Context.SourceRoot), [System.StringComparison]::OrdinalIgnoreCase) -or
        -not [string]::Equals((Get-NormalizedPath ([string]$State.git_common_directory)), (Get-NormalizedPath $Context.CommonDirectory), [System.StringComparison]::OrdinalIgnoreCase)) { Throw-Failure 'WRITER_STATE_REPOSITORY_BINDING_INVALID' }
    Assert-NonNegativeIntegral $State.revision 'WRITER_STATE_REVISION_INVALID'
    Assert-WriterSlot $State.slot
    if ($State.operations -is [string] -or $null -eq $State.operations) { Throw-Failure 'WRITER_STATE_OPERATIONS_INVALID' }
    $operations = @($State.operations); if ([Int64]$State.revision -ne $operations.Count) { Throw-Failure 'WRITER_STATE_REVISION_SEQUENCE_INVALID' }
    $seen = @{}; $expectedKinds = @('ASSIGN', 'VERIFY', 'COMPLETE', 'RELEASE'); $expectedPrior = @('NONE', 'ASSIGNED', 'ACTIVE', 'COMPLETED'); $expectedResult = @('ASSIGNED', 'ACTIVE', 'COMPLETED', 'NONE')
    $authority = $null; $assignment = $null; $writer = $null; [Int64]$lastCommittedUtcMs = -1
    for ($i = 0; $i -lt $operations.Count; $i++) {
        $receipt = $operations[$i]; $phase = $i % 4
        Assert-ExactObjectProperties $receipt @('operation_id', 'kind', 'authority_id', 'assignment_id', 'writer_id', 'prior_state', 'result_state', 'revision', 'outcome', 'committed_at_utc_ms') 'WRITER_RECEIPT_SHAPE_INVALID'
        Assert-ValidOperationId ([string]$receipt.operation_id) 'WRITER_RECEIPT_OPERATION_ID_INVALID'
        if ($seen.ContainsKey([string]$receipt.operation_id)) { Throw-Failure 'WRITER_RECEIPT_OPERATION_ID_DUPLICATE' }; $seen[[string]$receipt.operation_id] = $true
        if ([string]$receipt.kind -cne $expectedKinds[$phase] -or [string]$receipt.prior_state -cne $expectedPrior[$phase] -or [string]$receipt.result_state -cne $expectedResult[$phase] -or [string]$receipt.outcome -cne 'COMMITTED') { Throw-Failure 'WRITER_RECEIPT_SEQUENCE_INVALID' }
        Assert-ValidIdentityText ([string]$receipt.authority_id) 'WRITER_RECEIPT_AUTHORITY_INVALID'; Assert-ValidIdentityText ([string]$receipt.assignment_id) 'WRITER_RECEIPT_ASSIGNMENT_INVALID'; Assert-ValidIdentityText ([string]$receipt.writer_id) 'WRITER_RECEIPT_WRITER_INVALID'
        Assert-NonNegativeIntegral $receipt.revision 'WRITER_RECEIPT_REVISION_INVALID'; Assert-NonNegativeIntegral $receipt.committed_at_utc_ms 'WRITER_RECEIPT_TIMESTAMP_INVALID'
        if ([Int64]$receipt.committed_at_utc_ms -lt $lastCommittedUtcMs) { Throw-Failure 'WRITER_RECEIPT_TIMESTAMP_SEQUENCE_INVALID' }; $lastCommittedUtcMs = [Int64]$receipt.committed_at_utc_ms
        if ([Int64]$receipt.revision -ne ($i + 1)) { Throw-Failure 'WRITER_RECEIPT_REVISION_SEQUENCE_INVALID' }
        if ($phase -eq 0) { $authority = [string]$receipt.authority_id; $assignment = [string]$receipt.assignment_id; $writer = [string]$receipt.writer_id }
        elseif ([string]$receipt.authority_id -cne $authority -or [string]$receipt.assignment_id -cne $assignment -or [string]$receipt.writer_id -cne $writer) { Throw-Failure 'WRITER_RECEIPT_ASSIGNMENT_CONTRADICTORY' }
    }
    if ($operations.Count -gt 0 -and [string]$State.slot.state -cne $expectedResult[($operations.Count - 1) % 4]) { Throw-Failure 'WRITER_STATE_SLOT_RECEIPT_CONTRADICTORY' }
    if ([string]$State.slot.state -ne 'NONE' -and ([string]$State.slot.authority_id -cne $authority -or [string]$State.slot.assignment_id -cne $assignment -or [string]$State.slot.writer_id -cne $writer)) { Throw-Failure 'WRITER_STATE_SLOT_RECEIPT_CONTRADICTORY' }
}

function Read-WriterState {
    param([string]$Path, $Context)
    if (Test-Path -LiteralPath $Path) {
        if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { Throw-Failure 'WRITER_STATE_PATH_AMBIGUOUS' }
    }
    else { return (New-WriterState $Context) }
    Assert-NoReparsePoint $Path
    try { $value = [System.IO.File]::ReadAllText($Path, [System.Text.UTF8Encoding]::new($false)) | ConvertFrom-Json } catch { Throw-Failure 'WRITER_STATE_INVALID' }
    Assert-WriterState $value $Context
    return $value
}

function Publish-JsonAtomically {
    param([string]$Path, [string]$Candidate, [scriptblock]$ValidateCommitted)
    $directory = Get-FullPath (Split-Path -Parent $Path); Assert-NoReparsePoint $directory
    if ((Test-Path -LiteralPath $Path) -and -not (Test-Path -LiteralPath $Path -PathType Leaf)) { Throw-Failure 'CONTROL_PLANE_PATH_AMBIGUOUS' }
    if (Test-Path -LiteralPath $Path) { Assert-NoReparsePoint $Path }
    $temp = Join-Path $directory ('.sgds-v3-' + [Guid]::NewGuid().ToString('N') + '.tmp')
    $backup = Join-Path $directory ('.sgds-v3-' + [Guid]::NewGuid().ToString('N') + '.bak')
    $bytes = [System.Text.UTF8Encoding]::new($false).GetBytes($Candidate); $candidateSha = Get-TextSha256 $Candidate; $stream = $null
    try {
        $options = [System.IO.FileOptions]::WriteThrough
        $stream = New-Object System.IO.FileStream($temp, [System.IO.FileMode]::CreateNew, [System.IO.FileAccess]::Write, [System.IO.FileShare]::None, 4096, $options)
        $stream.Write($bytes, 0, $bytes.Length); $stream.Flush($true); $stream.Dispose(); $stream = $null
        if (Test-Path -LiteralPath $Path -PathType Leaf) { [System.IO.File]::Replace($temp, $Path, $backup, $true) }
        else { [System.IO.File]::Move($temp, $Path) }
        if ((Get-FileSha256 $Path) -cne $candidateSha) { Throw-Failure 'ATOMIC_PUBLICATION_IDENTITY_INVALID' }
        & $ValidateCommitted
    }
    catch { if ($null -ne $stream) { $stream.Dispose() }; throw }
    finally {
        foreach ($transient in @($temp, $backup)) {
            if (Test-Path -LiteralPath $transient -PathType Leaf) { Assert-NoReparsePoint $transient; [System.IO.File]::Delete($transient) }
            if (Test-Path -LiteralPath $transient) { Throw-Failure 'ATOMIC_PUBLICATION_CLEANUP_UNVERIFIED' }
        }
    }
}

function Write-WriterStateAtomic {
    param([string]$Path, $State, $Context)
    Assert-WriterState $State $Context
    $candidate = $State | ConvertTo-Json -Depth 16
    Publish-JsonAtomically -Path $Path -Candidate $candidate -ValidateCommitted { $committed = Read-WriterState -Path $Path -Context $Context; Assert-WriterState $committed $Context }
    return (Read-WriterState -Path $Path -Context $Context)
}

function Assert-NoLegacyWriterState {
    param($Context)
    if (Test-Path -LiteralPath (Get-LegacyWriterLeasePath $Context.CommonDirectory) -PathType Leaf) { Throw-Failure 'LEGACY_V2_WRITER_STATE_BLOCKS_MUTATION' }
}

function Get-OperationReceipt {
    param($State, [string]$Id)
    $matches = @($State.operations | Where-Object { [string]$_.operation_id -ceq $Id })
    if ($matches.Count -eq 0) { return $null }
    if ($matches.Count -ne 1) { Throw-Failure 'WRITER_RECEIPT_OPERATION_ID_DUPLICATE' }
    return $matches[0]
}

function Assert-ReplayReceipt {
    param($Receipt, [string]$OperationId, [string]$Kind, [string]$Authority, [string]$Assignment, [string]$Writer, [string]$PriorState, [string]$ResultState)
    if ($null -eq $Receipt -or [string]$Receipt.operation_id -cne $OperationId -or [string]$Receipt.kind -cne $Kind -or [string]$Receipt.authority_id -cne $Authority -or [string]$Receipt.assignment_id -cne $Assignment -or [string]$Receipt.writer_id -cne $Writer -or [string]$Receipt.prior_state -cne $PriorState -or [string]$Receipt.result_state -cne $ResultState -or [string]$Receipt.outcome -cne 'COMMITTED') { Throw-Failure 'OPERATION_ID_COLLISION_OR_CONTRADICTORY_REPLAY' }
}

function Add-OperationReceipt {
    param($State, [string]$Id, [string]$Kind, [string]$Authority, [string]$Assignment, [string]$Writer, [string]$PriorState, [string]$ResultState)
    $list = New-Object System.Collections.Generic.List[object]
    foreach ($item in @($State.operations)) { $list.Add($item) }
    $list.Add([ordered]@{ operation_id = $Id; kind = $Kind; authority_id = $Authority; assignment_id = $Assignment; writer_id = $Writer; prior_state = $PriorState; result_state = $ResultState; revision = [Int64]$State.revision; outcome = 'COMMITTED'; committed_at_utc_ms = Get-CanonicalUtcMilliseconds })
    $State.operations = @($list.ToArray())
}

function Read-ActiveIsolationRegistry {
    param($Context)
    $path = Get-ActiveIsolationRegistryPath $Context.CommonDirectory
    if (Test-Path -LiteralPath $path) { if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { Throw-Failure 'ISOLATION_REGISTRY_AMBIGUOUS' } } else { return $null }
    Assert-NoReparsePoint $path
    try { $value = [System.IO.File]::ReadAllText($path, [System.Text.UTF8Encoding]::new($false)) | ConvertFrom-Json } catch { Throw-Failure 'ISOLATION_REGISTRY_AMBIGUOUS' }
    Assert-ExactObjectProperties $value @('magic', 'workspace_identity', 'isolation_root', 'registered_at_utc_ms') 'ISOLATION_REGISTRY_AMBIGUOUS'
    if ([string]$value.magic -cne 'syncgmaildrivesheet.active-isolation/v3' -or [string]$value.workspace_identity -cne [string]$Context.WorkspaceIdentity -or [string]::IsNullOrWhiteSpace([string]$value.isolation_root)) { Throw-Failure 'ISOLATION_REGISTRY_AMBIGUOUS' }
    Assert-NonNegativeIntegral $value.registered_at_utc_ms 'ISOLATION_REGISTRY_AMBIGUOUS'; $root = Get-FullPath ([string]$value.isolation_root); if (Test-Path -LiteralPath $root) { Assert-NoReparsePoint $root }
    return $value
}

function Write-ActiveIsolationRegistry {
    param($Context, [string]$Root)
    $value = [ordered]@{ magic = 'syncgmaildrivesheet.active-isolation/v3'; workspace_identity = $Context.WorkspaceIdentity; isolation_root = Get-FullPath $Root; registered_at_utc_ms = Get-CanonicalUtcMilliseconds }
    $path = Get-ActiveIsolationRegistryPath $Context.CommonDirectory; $candidate = $value | ConvertTo-Json -Depth 8
    Publish-JsonAtomically -Path $path -Candidate $candidate -ValidateCommitted { [void](Read-ActiveIsolationRegistry $Context) }
}

function Clear-ActiveIsolationRegistry {
    param($Context, [string]$Root)
    $current = Read-ActiveIsolationRegistry $Context
    if ($null -eq $current -or -not [string]::Equals((Get-FullPath ([string]$current.isolation_root)), (Get-FullPath $Root), [System.StringComparison]::OrdinalIgnoreCase)) { Throw-Failure 'ISOLATION_REGISTRY_MISMATCH' }
    $path = Get-ActiveIsolationRegistryPath $Context.CommonDirectory; Assert-NoReparsePoint $path; [System.IO.File]::Delete($path)
    if (Test-Path -LiteralPath $path) { Throw-Failure 'ISOLATION_REGISTRY_CLEANUP_UNVERIFIED' }
}

function Assert-WriterIsolationInterlock {
    param($Context, [string]$Direction)
    Assert-NoLegacyWriterState $Context
    $state = Read-WriterState -Path (Get-WriterLeasePath $Context.CommonDirectory) -Context $Context
    $registry = Read-ActiveIsolationRegistry $Context
    if ($Direction -ceq 'ISOLATION' -and [string]$state.slot.state -in @('ASSIGNED', 'ACTIVE', 'COMPLETED')) { Throw-Failure 'LIVE_WRITER_STATE_BLOCKS_ISOLATION' }
    if ($Direction -ceq 'ISOLATION' -and $null -ne $registry) { Throw-Failure 'ACTIVE_ISOLATION_ALREADY_REGISTERED' }
    if ($Direction -ceq 'WRITER' -and $null -ne $registry) { Throw-Failure 'ACTIVE_ISOLATION_BLOCKS_WRITER' }
    return $state
}

function Invoke-WriterResponseLoss {
    param([string]$Operation)
    if ([Environment]::GetEnvironmentVariable('SGDS_WRITER_AUTHORITY_V3_TEST_MODE') -ceq 'RESPONSE_LOSS_AFTER_COMMIT' -and [Environment]::GetEnvironmentVariable('SGDS_WRITER_AUTHORITY_V3_TEST_OPERATION') -ceq $Operation) { Throw-Failure 'RESPONSE_LOSS_AFTER_COMMIT_RECONCILE_WITH_OPERATION_ID' }
}

function Invoke-ControllerAssign {
    $lock = $null; $path = $null
    try {
        Assert-ValidIdentityText $AuthorityId 'AUTHORITY_ID_INVALID'; Assert-ValidIdentityText $AssignmentId 'ASSIGNMENT_ID_INVALID'; Assert-ValidIdentityText $TaskId 'WRITER_ID_INVALID'; Assert-ValidOperationId $OperationId 'OPERATION_ID_INVALID'
        $context = Get-RepositoryContext; $path = Get-WriterLeasePath $context.CommonDirectory; $lock = Enter-LeaseTransitionLock $path
        $state = Assert-WriterIsolationInterlock $context 'WRITER'; $prior = Get-OperationReceipt $state $OperationId
        if ($null -ne $prior) { Assert-ReplayReceipt $prior $OperationId 'ASSIGN' $AuthorityId $AssignmentId $TaskId 'NONE' 'ASSIGNED'; Write-Result ([ordered]@{ ACTION='CONTROLLERASSIGN'; STATUS='RECONCILED'; OPERATION_ID=$OperationId; SLOT_STATE=$state.slot.state; ASSIGNMENT_ID=$AssignmentId }); return }
        if ([string]$state.slot.state -ne 'NONE') { Throw-Failure 'WRITER_SLOT_BLOCKED' }
        $state.slot = [ordered]@{ state='ASSIGNED'; authority_id=$AuthorityId; assignment_id=$AssignmentId; writer_id=$TaskId; assigned_at_utc_ms=Get-CanonicalUtcMilliseconds; verified_at_utc_ms=$null; completed_at_utc_ms=$null }; $state.revision=[Int64]$state.revision+1; Add-OperationReceipt $state $OperationId 'ASSIGN' $AuthorityId $AssignmentId $TaskId 'NONE' 'ASSIGNED'; [void](Write-WriterStateAtomic $path $state $context); Invoke-WriterResponseLoss $OperationId
        Write-Result ([ordered]@{ ACTION='CONTROLLERASSIGN'; STATUS='ASSIGNED'; OPERATION_ID=$OperationId; SLOT_STATE='ASSIGNED'; ASSIGNMENT_ID=$AssignmentId; AUTHORITY_ID=$AuthorityId })
    } catch { Write-Result ([ordered]@{ ACTION='CONTROLLERASSIGN'; STATUS='FAILED'; ERROR=$_.Exception.Message; OPERATION_ID=$OperationId }); exit 1 } finally { if($null -ne $path){Exit-LeaseTransitionLock $lock $path} }
}

function Invoke-ControllerVerify {
    $lock=$null; $path=$null
    try {
        Assert-ValidIdentityText $AuthorityId 'AUTHORITY_ID_INVALID'; Assert-ValidIdentityText $AssignmentId 'ASSIGNMENT_ID_INVALID'; Assert-ValidIdentityText $TaskId 'WRITER_ID_INVALID'; Assert-ValidOperationId $OperationId 'OPERATION_ID_INVALID'
        $context=Get-RepositoryContext; $path=Get-WriterLeasePath $context.CommonDirectory; $lock=Enter-LeaseTransitionLock $path; $state=Assert-WriterIsolationInterlock $context 'WRITER'; $prior=Get-OperationReceipt $state $OperationId
        if($null -ne $prior){Assert-ReplayReceipt $prior $OperationId 'VERIFY' $AuthorityId $AssignmentId $TaskId 'ASSIGNED' 'ACTIVE';Write-Result ([ordered]@{ACTION='CONTROLLERVERIFY';STATUS='RECONCILED';OPERATION_ID=$OperationId;SLOT_STATE=$state.slot.state});return}
        if([string]$state.slot.state -ne 'ASSIGNED' -or [string]$state.slot.authority_id -cne $AuthorityId -or [string]$state.slot.assignment_id -cne $AssignmentId -or [string]$state.slot.writer_id -cne $TaskId){Throw-Failure 'WRITER_ASSIGNMENT_MISMATCH'}
        $state.slot.state='ACTIVE';$state.slot.verified_at_utc_ms=Get-CanonicalUtcMilliseconds;$state.revision=[Int64]$state.revision+1;Add-OperationReceipt $state $OperationId 'VERIFY' $AuthorityId $AssignmentId $TaskId 'ASSIGNED' 'ACTIVE';[void](Write-WriterStateAtomic $path $state $context);Invoke-WriterResponseLoss $OperationId
        Write-Result ([ordered]@{ACTION='CONTROLLERVERIFY';STATUS='VERIFIED';OPERATION_ID=$OperationId;SLOT_STATE='ACTIVE';ASSIGNMENT_ID=$AssignmentId})
    }catch{Write-Result ([ordered]@{ACTION='CONTROLLERVERIFY';STATUS='FAILED';ERROR=$_.Exception.Message;OPERATION_ID=$OperationId});exit 1}finally{if($null -ne $path){Exit-LeaseTransitionLock $lock $path}}
}

function Invoke-WriterComplete {
    $lock=$null;$path=$null
    try {
        Assert-ValidIdentityText $AuthorityId 'AUTHORITY_ID_INVALID';Assert-ValidIdentityText $AssignmentId 'ASSIGNMENT_ID_INVALID';Assert-ValidIdentityText $TaskId 'WRITER_ID_INVALID';Assert-ValidOperationId $OperationId 'OPERATION_ID_INVALID'
        $context=Get-RepositoryContext;$path=Get-WriterLeasePath $context.CommonDirectory;$lock=Enter-LeaseTransitionLock $path;$state=Assert-WriterIsolationInterlock $context 'WRITER';$prior=Get-OperationReceipt $state $OperationId
        if($null -ne $prior){Assert-ReplayReceipt $prior $OperationId 'COMPLETE' $AuthorityId $AssignmentId $TaskId 'ACTIVE' 'COMPLETED';Write-Result ([ordered]@{ACTION='WRITERCOMPLETE';STATUS='RECONCILED';OPERATION_ID=$OperationId;SLOT_STATE=$state.slot.state});return}
        if([string]$state.slot.state -ne 'ACTIVE' -or [string]$state.slot.authority_id -cne $AuthorityId -or [string]$state.slot.assignment_id -cne $AssignmentId -or [string]$state.slot.writer_id -cne $TaskId){Throw-Failure 'WRITER_ASSIGNMENT_MISMATCH'}
        $state.slot.state='COMPLETED';$state.slot.completed_at_utc_ms=Get-CanonicalUtcMilliseconds;$state.revision=[Int64]$state.revision+1;Add-OperationReceipt $state $OperationId 'COMPLETE' $AuthorityId $AssignmentId $TaskId 'ACTIVE' 'COMPLETED';[void](Write-WriterStateAtomic $path $state $context);Invoke-WriterResponseLoss $OperationId
        Write-Result ([ordered]@{ACTION='WRITERCOMPLETE';STATUS='COMPLETED';OPERATION_ID=$OperationId;SLOT_STATE='COMPLETED';ASSIGNMENT_ID=$AssignmentId})
    }catch{Write-Result ([ordered]@{ACTION='WRITERCOMPLETE';STATUS='FAILED';ERROR=$_.Exception.Message;OPERATION_ID=$OperationId});exit 1}finally{if($null -ne $path){Exit-LeaseTransitionLock $lock $path}}
}

function Invoke-ControllerRelease {
    $lock=$null;$path=$null
    try {
        Assert-ValidIdentityText $AuthorityId 'AUTHORITY_ID_INVALID';Assert-ValidIdentityText $AssignmentId 'ASSIGNMENT_ID_INVALID';Assert-ValidIdentityText $TaskId 'WRITER_ID_INVALID';Assert-ValidOperationId $OperationId 'OPERATION_ID_INVALID'
        $context=Get-RepositoryContext;$path=Get-WriterLeasePath $context.CommonDirectory;$lock=Enter-LeaseTransitionLock $path;$state=Assert-WriterIsolationInterlock $context 'WRITER';$prior=Get-OperationReceipt $state $OperationId
        if($null -ne $prior){Assert-ReplayReceipt $prior $OperationId 'RELEASE' $AuthorityId $AssignmentId $TaskId 'COMPLETED' 'NONE';Write-Result ([ordered]@{ACTION='CONTROLLERRELEASE';STATUS='RECONCILED';OPERATION_ID=$OperationId;SLOT_STATE=$state.slot.state});return}
        if([string]$state.slot.state -ne 'COMPLETED' -or [string]$state.slot.authority_id -cne $AuthorityId -or [string]$state.slot.assignment_id -cne $AssignmentId){Throw-Failure 'WRITER_ASSIGNMENT_MISMATCH'}
        if([string]$state.slot.writer_id -cne $TaskId){Throw-Failure 'WRITER_ASSIGNMENT_MISMATCH'}
        $state.slot=[ordered]@{state='NONE';authority_id=$null;assignment_id=$null;writer_id=$null;assigned_at_utc_ms=$null;verified_at_utc_ms=$null;completed_at_utc_ms=$null};$state.revision=[Int64]$state.revision+1;Add-OperationReceipt $state $OperationId 'RELEASE' $AuthorityId $AssignmentId $TaskId 'COMPLETED' 'NONE';[void](Write-WriterStateAtomic $path $state $context);Invoke-WriterResponseLoss $OperationId
        Write-Result ([ordered]@{ACTION='CONTROLLERRELEASE';STATUS='RELEASED';OPERATION_ID=$OperationId;SLOT_STATE='NONE';ASSIGNMENT_ID=$AssignmentId})
    }catch{Write-Result ([ordered]@{ACTION='CONTROLLERRELEASE';STATUS='FAILED';ERROR=$_.Exception.Message;OPERATION_ID=$OperationId});exit 1}finally{if($null -ne $path){Exit-LeaseTransitionLock $lock $path}}
}

function Invoke-InspectWriterV3 {
    try { $context=Get-RepositoryContext;Assert-NoLegacyWriterState $context;$path=Get-WriterLeasePath $context.CommonDirectory;$before=Get-OptionalFileSha256 $path;$state=Read-WriterState $path $context;$after=Get-OptionalFileSha256 $path;if($before -cne $after){Throw-Failure 'INSPECT_WRITER_MUTATED_STATE'};Write-Result ([ordered]@{ACTION='INSPECTWRITER';STATUS='INSPECTED';SLOT_STATE=$state.slot.state;REVISION=$state.revision;STATE_SHA256=$after;PROCESS_AUTHORITY='NONE'}) }
    catch { Write-Result ([ordered]@{ACTION='INSPECTWRITER';STATUS='FAILED';ERROR=$_.Exception.Message});exit 1 }
}

function Test-ExistingUntrackedFile {
    param([string]$RepositoryRoot, [string]$RepositoryRelativePath, [string]$FullPath)
    if (-not (Test-Path -LiteralPath $FullPath -PathType Leaf)) { Throw-Failure 'UNTRACKED_PATH_MUST_BE_EXISTING_FILE' }
    $item = Get-Item -LiteralPath $FullPath -Force
    if (($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) { Throw-Failure 'REPARSE_POINT_REJECTED' }
    $literalPathspec = ':(literal)' + ($RepositoryRelativePath -replace '\\', '/')
    $tracked = Get-GitResult -Arguments @('-C', $RepositoryRoot, 'ls-files', '--error-unmatch', '--', $literalPathspec) -WorkingDirectory $RepositoryRoot
    if ($tracked.ExitCode -eq 0) { Throw-Failure 'UNTRACKED_PATH_IS_TRACKED' }
    $untracked = Get-GitResult -Arguments @('-C', $RepositoryRoot, 'ls-files', '--others', '--exclude-standard', '--', $literalPathspec) -WorkingDirectory $RepositoryRoot
    if ($untracked.ExitCode -ne 0 -or [string]::IsNullOrWhiteSpace($untracked.StandardOutput)) { Throw-Failure 'UNTRACKED_PATH_NOT_ELIGIBLE' }
}

function Get-FileBomState {
    param([Parameter(Mandatory = $true)][string]$Path)
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { Throw-Failure 'FILE_IDENTITY_UNAVAILABLE' }
    $bytes = [System.IO.File]::ReadAllBytes($Path)
    if ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF) { return 'UTF8_BOM' }
    return 'NONE'
}

function Get-SemanticIndexIdentity {
    param([Parameter(Mandatory = $true)][string]$WorkingDirectory)
    # This deliberately avoids git write-tree: it is a read-only digest over
    # staged entry records and the cached binary diff, so it cannot create an
    # object in the repository object database.
    $entries = Get-GitResult -Arguments @('-C', $WorkingDirectory, 'ls-files', '--stage', '-z') -WorkingDirectory $WorkingDirectory
    if ($entries.ExitCode -ne 0) { Throw-Failure 'SEMANTIC_INDEX_IDENTITY_UNAVAILABLE' }
    $patch = Get-GitResult -Arguments @('-C', $WorkingDirectory, 'diff', '--cached', '--binary', '--no-ext-diff', 'HEAD') -WorkingDirectory $WorkingDirectory
    if ($patch.ExitCode -ne 0) { Throw-Failure 'SEMANTIC_INDEX_IDENTITY_UNAVAILABLE' }
    return Get-TextSha256 ((Get-TextSha256 $entries.StandardOutput) + "`n" + (Get-TextSha256 $patch.StandardOutput))
}

function ConvertTo-DeterministicArray {
    param($Value)
    # A List[object] wrapped in @() remains a scalar under some PowerShell
    # expression paths. Enumerating first gives ConvertTo-Json an actual array
    # for zero, one, and many collection values.
    return ,@($Value | ForEach-Object { $_ })
}

function ConvertFrom-StrictUntrackedPathPayload {
    # Delimiters are deliberately not an encoding.  A legal path may contain a
    # comma (and Unicode), so the argument is one Base64 encoded strict UTF-8
    # JSON array.  Each runtime uses a structured parser that preserves the
    # top-level type instead of PowerShell pipeline enumeration semantics.
    if ($script:LegacyUntrackedPathProvided) { Throw-Failure 'UNTRACKED_PATH_LEGACY_NEW_AMBIGUOUS' }
    if (-not $script:UntrackedPathPayloadProvided) { Throw-Failure 'UNTRACKED_PATH_PAYLOAD_REQUIRED' }
    if ([string]::IsNullOrWhiteSpace($UntrackedPathPayload) -or $UntrackedPathPayload.Length % 4 -ne 0 -or $UntrackedPathPayload -notmatch '^[A-Za-z0-9+/]*={0,2}$') { Throw-Failure 'UNTRACKED_PATH_PAYLOAD_BASE64_INVALID' }
    try { $bytes = [Convert]::FromBase64String($UntrackedPathPayload) }
    catch { Throw-Failure 'UNTRACKED_PATH_PAYLOAD_BASE64_INVALID' }
    try { $json = [Text.UTF8Encoding]::new($false, $true).GetString($bytes) }
    catch { Throw-Failure 'UNTRACKED_PATH_PAYLOAD_UTF8_INVALID' }
    $paths = New-Object System.Collections.Generic.List[string]
    if ($PSVersionTable.PSEdition -eq 'Core') {
        $document = $null
        try { $document = [System.Text.Json.JsonDocument]::Parse($json) }
        catch { Throw-Failure 'UNTRACKED_PATH_PAYLOAD_JSON_INVALID' }
        try {
            $root = $document.RootElement
            if ($root.ValueKind -ne [System.Text.Json.JsonValueKind]::Array) { Throw-Failure 'UNTRACKED_PATH_PAYLOAD_ARRAY_REQUIRED' }
            foreach ($entry in $root.EnumerateArray()) {
                if ($entry.ValueKind -ne [System.Text.Json.JsonValueKind]::String) { Throw-Failure 'UNTRACKED_PATH_PAYLOAD_STRING_MEMBERS_REQUIRED' }
                $paths.Add($entry.GetString())
            }
        }
        finally { $document.Dispose() }
    }
    else {
        try {
            Add-Type -AssemblyName System.Web -ErrorAction Stop
            $parsed = [System.Web.Script.Serialization.JavaScriptSerializer]::new().DeserializeObject($json)
        }
        catch { Throw-Failure 'UNTRACKED_PATH_PAYLOAD_JSON_INVALID' }
        if ($parsed -isnot [System.Array]) { Throw-Failure 'UNTRACKED_PATH_PAYLOAD_ARRAY_REQUIRED' }
        foreach ($entry in $parsed) {
            if ($entry -isnot [string]) { Throw-Failure 'UNTRACKED_PATH_PAYLOAD_STRING_MEMBERS_REQUIRED' }
            $paths.Add($entry)
        }
    }
    return ,$paths.ToArray()
}

function Get-GitObjectDatabaseIdentity {
    param([Parameter(Mandatory = $true)][string]$WorkingDirectory)
    $common = Get-RequiredGitOutput -Arguments @('-C', $WorkingDirectory, 'rev-parse', '--path-format=absolute', '--git-common-dir') -WorkingDirectory $WorkingDirectory -FailureCode 'GIT_COMMON_DIRECTORY_UNAVAILABLE'
    $objects = Join-Path $common 'objects'
    if (-not (Test-Path -LiteralPath $objects -PathType Container)) { Throw-Failure 'GIT_OBJECT_DATABASE_MISSING' }
    $entries = @(Get-ChildItem -LiteralPath $objects -File -Recurse -Force | Sort-Object FullName | ForEach-Object {
            ($_.FullName.Substring($objects.Length).TrimStart([IO.Path]::DirectorySeparatorChar, [IO.Path]::AltDirectorySeparatorChar) + ':' + (Get-FileSha256 $_.FullName))
        })
    return Get-TextSha256 ($entries -join "`n")
}

function Assert-StringArray {
    param([Parameter(Mandatory = $true)]$Value, [Parameter(Mandatory = $true)][string]$Code)
    if ($Value -isnot [System.Array]) { Throw-Failure $Code }
    foreach ($item in $Value) { if ($item -isnot [string]) { Throw-Failure $Code } }
    return @($Value | ForEach-Object { [string]$_ })
}

function Assert-CanonicalIdentityArray {
    param([Parameter(Mandatory = $true)]$Value)
    if ($Value -isnot [System.Array]) { Throw-Failure 'TRACKED_CANONICAL_IDENTITY_TYPE_INVALID' }
    foreach ($item in $Value) {
        if ($item -isnot [System.Collections.IDictionary] -and $item.PSObject.Properties.Name -notcontains 'path') { Throw-Failure 'TRACKED_CANONICAL_IDENTITY_TYPE_INVALID' }
        if ($item.path -isnot [string] -or $item.canonical_git_blob -isnot [string]) { Throw-Failure 'TRACKED_CANONICAL_IDENTITY_TYPE_INVALID' }
    }
    return @($Value)
}

function Write-CreationMarker {
    param(
        [Parameter(Mandatory = $true)][string]$Root,
        [Parameter(Mandatory = $true)]$Context,
        [Parameter(Mandatory = $true)][string]$Nonce,
        [Parameter(Mandatory = $true)][string]$Head,
        [Parameter(Mandatory = $true)][string]$Purpose,
        [Parameter(Mandatory = $true)][string]$WorktreePath,
        [AllowEmptyString()][string]$ScratchPath,
        [Parameter(Mandatory = $true)][string]$SiblingBaseline
    )
    $markerPath = Join-Path $Root $script:CreationMarkerName
    $marker = [ordered]@{
        magic = $script:CreationMarkerMagic; schema_version = 1; nonce = $Nonce
        source_root = $Context.SourceRoot; git_common_directory = $Context.CommonDirectory
        workspace_identity = $Context.WorkspaceIdentity; head = $Head; purpose = $Purpose
        isolation_root = (Get-FullPath $Root); intended_worktree_path = (Get-FullPath $WorktreePath)
        intended_scratch_path = $ScratchPath; created_utc = [DateTime]::UtcNow.ToString('o')
        sibling_baseline_sha256 = $SiblingBaseline
    }
    # Publish only a complete, durably-flushed document.  The temporary name is
    # never accepted by the ownership verifier, and Move is an atomic rename in
    # this directory on Windows.
    $temporaryPath = Join-Path $Root ('.creation-owner-' + [Guid]::NewGuid().ToString('N') + '.tmp')
    try {
        $bytes = [Text.UTF8Encoding]::new($false).GetBytes(($marker | ConvertTo-Json -Depth 12))
        $stream = [IO.File]::Open($temporaryPath, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::None)
        try { $stream.Write($bytes, 0, $bytes.Length); $stream.Flush($true) } finally { $stream.Dispose() }
        [IO.File]::Move($temporaryPath, $markerPath)
    }
    finally { if (Test-Path -LiteralPath $temporaryPath) { Remove-Item -LiteralPath $temporaryPath -Force } }
    if ((Get-FileBomState $markerPath) -ne 'NONE') { Throw-Failure 'CREATION_MARKER_BOM_REJECTED' }
    return $markerPath
}

function Test-ExactCreationMarkerOwnership {
    param(
        [Parameter(Mandatory = $true)][string]$Root,
        [Parameter(Mandatory = $true)]$Context,
        [Parameter(Mandatory = $true)][string]$Nonce,
        [Parameter(Mandatory = $true)][string]$ExpectedWorktreePath,
        [AllowEmptyString()][string]$ExpectedScratchPath
    )
    try {
        $fullRoot = Get-FullPath $Root; $base = Get-FullPath $script:TempBase
        if (-not (Test-PathWithinRoot $fullRoot $base) -or [string]::Equals($fullRoot, $base, [StringComparison]::OrdinalIgnoreCase)) { return $false }
        $parent = [IO.Directory]::GetParent($fullRoot)
        if ($null -eq $parent -or -not [string]::Equals((Get-FullPath $parent.FullName), $base, [StringComparison]::OrdinalIgnoreCase) -or [IO.Path]::GetFileName($fullRoot) -notmatch '^[0-9a-f]{32}$') { return $false }
        Assert-NoReparsePointsUnderRoot $fullRoot
        $markerPath = Join-Path $fullRoot $script:CreationMarkerName
        if (-not (Test-Path -LiteralPath $markerPath -PathType Leaf) -or (Get-FileBomState $markerPath) -ne 'NONE') { return $false }
        $marker = [IO.File]::ReadAllText($markerPath, [Text.UTF8Encoding]::new($false)) | ConvertFrom-Json
        if ([string]$marker.magic -cne $script:CreationMarkerMagic -or [int]$marker.schema_version -ne 1 -or [string]$marker.nonce -cne $Nonce -or [string]::IsNullOrWhiteSpace([string]$marker.created_utc)) { return $false }
        if (-not [string]::Equals((Get-FullPath ([string]$marker.isolation_root)), $fullRoot, [StringComparison]::OrdinalIgnoreCase) -or
            -not [string]::Equals((Get-FullPath ([string]$marker.source_root)), (Get-FullPath $Context.SourceRoot), [StringComparison]::OrdinalIgnoreCase) -or
            -not [string]::Equals((Get-FullPath ([string]$marker.git_common_directory)), (Get-FullPath $Context.CommonDirectory), [StringComparison]::OrdinalIgnoreCase) -or
            [string]$marker.workspace_identity -cne [string]$Context.WorkspaceIdentity -or
            [string]$marker.head -cne (Get-RequiredGitOutput -Arguments @('-C', $Context.SourceRoot, 'rev-parse', 'HEAD') -WorkingDirectory $Context.SourceRoot -FailureCode 'HEAD_RESOLUTION_FAILED') -or
            [string]$marker.purpose -notin @('EXPLORER', 'REVIEWER', 'VERIFIER') -or
            -not [string]::Equals((Get-FullPath ([string]$marker.intended_worktree_path)), (Get-FullPath $ExpectedWorktreePath), [StringComparison]::OrdinalIgnoreCase) -or
            [string]$marker.intended_scratch_path -cne $ExpectedScratchPath -or
            [string]::IsNullOrWhiteSpace([string]$marker.sibling_baseline_sha256)) { return $false }
        return $true
    }
    catch { return $false }
}

function Invoke-MarkerOwnedRollback {
    param([string]$Root, $Context, [string]$Nonce, [string]$WorktreePath, [AllowEmptyString()][string]$ScratchPath)
    if (-not (Test-ExactCreationMarkerOwnership -Root $Root -Context $Context -Nonce $Nonce -ExpectedWorktreePath $WorktreePath -ExpectedScratchPath $ScratchPath)) { Throw-Failure 'CREATION_MARKER_OWNERSHIP_NOT_PROVEN' }
    if (Test-Path -LiteralPath $WorktreePath) {
        $remove = Get-GitResult -Arguments @('-C', $Context.SourceRoot, 'worktree', 'remove', '--force', $WorktreePath) -WorkingDirectory $Context.SourceRoot
        if ($remove.ExitCode -ne 0 -and (Test-Path -LiteralPath $WorktreePath)) { Throw-Failure 'CREATION_ROLLBACK_WORKTREE_REMOVE_FAILED' }
    }
    if (Test-Path -LiteralPath $Root) { Remove-Item -LiteralPath $Root -Recurse -Force }
    if (Test-Path -LiteralPath $Root) { Throw-Failure 'CREATION_ROLLBACK_ROOT_REMOVAL_UNVERIFIED' }
}

function Invoke-CreationFailureInjection {
    param([Parameter(Mandatory = $true)][string]$Point, [Parameter(Mandatory = $true)][string]$SourceRoot)
    if ([Environment]::GetEnvironmentVariable('SGDS_GOVERNANCE_TEST_MODE') -cne 'CREATION_FAILURE_V1') { return }
    $tempRoot = Get-FullPath ([IO.Path]::GetTempPath())
    if (-not (Test-PathWithinRoot $SourceRoot $tempRoot)) { Throw-Failure 'CREATION_TEST_HOOK_OUTSIDE_TEMP_REJECTED' }
    $requested = [Environment]::GetEnvironmentVariable('SGDS_GOVERNANCE_TEST_FAIL_AFTER')
    if ($requested -eq $Point) { Throw-Failure ('TEST_INJECTED_CREATE_FAILURE_' + $Point) }
}

function Get-TrackedPatchPaths {
    param([Parameter(Mandatory = $true)][string]$WorkingDirectory)
    $result = Get-GitResult -Arguments @('-C', $WorkingDirectory, 'diff', '--name-only', '-z', 'HEAD') -WorkingDirectory $WorkingDirectory
    if ($result.ExitCode -ne 0) { Throw-Failure 'TRACKED_PATCH_PATH_ENUMERATION_FAILED' }
    return @($result.StandardOutput -split "`0" | Where-Object { -not [string]::IsNullOrWhiteSpace($_) } | ForEach-Object { $_ -replace '\\', '/' } | Sort-Object -Unique)
}

function Sync-TrackedPatchRawBytes {
    param(
        [Parameter(Mandatory = $true)][string]$SourceRoot,
        [Parameter(Mandatory = $true)][string]$WorktreeRoot,
        [Parameter(Mandatory = $true)][AllowEmptyCollection()][string[]]$Paths
    )
    foreach ($relativePath in $Paths) {
        if ([string]::IsNullOrWhiteSpace($relativePath) -or [IO.Path]::IsPathRooted($relativePath)) { Throw-Failure 'TRACKED_MATERIALIZATION_PATH_INVALID' }
        $sourcePath = Get-FullPath (Join-Path $SourceRoot $relativePath)
        $destinationPath = Get-FullPath (Join-Path $WorktreeRoot $relativePath)
        if (-not (Test-PathWithinRoot -Path $sourcePath -Root $SourceRoot)) { Throw-Failure 'TRACKED_MATERIALIZATION_SOURCE_OUTSIDE_ROOT' }
        if (-not (Test-PathWithinRoot -Path $destinationPath -Root $WorktreeRoot)) { Throw-Failure 'TRACKED_MATERIALIZATION_DESTINATION_OUTSIDE_ROOT' }
        $normalizedRelativePath = $relativePath -replace '\\', '/'
        if ($normalizedRelativePath -eq '.git' -or $normalizedRelativePath.StartsWith('.git/', [StringComparison]::OrdinalIgnoreCase)) { Throw-Failure 'TRACKED_MATERIALIZATION_GIT_METADATA_REJECTED' }

        $sourceItem = Get-Item -LiteralPath $sourcePath -Force -ErrorAction SilentlyContinue
        if ($null -ne $sourceItem) {
            if ($sourceItem.PSIsContainer -or -not (Test-Path -LiteralPath $sourcePath -PathType Leaf)) { Throw-Failure 'TRACKED_MATERIALIZATION_SOURCE_NOT_LEAF' }
            Assert-NoReparsePoint $sourcePath
            $destinationItem = Get-Item -LiteralPath $destinationPath -Force -ErrorAction SilentlyContinue
            if ($null -ne $destinationItem) {
                if ($destinationItem.PSIsContainer -or -not (Test-Path -LiteralPath $destinationPath -PathType Leaf)) { Throw-Failure 'TRACKED_MATERIALIZATION_DESTINATION_NOT_LEAF' }
                Assert-NoReparsePoint $destinationPath
            }
            $destinationDirectory = Get-FullPath (Split-Path -Parent $destinationPath)
            if (-not (Test-PathWithinRoot -Path $destinationDirectory -Root $WorktreeRoot)) { Throw-Failure 'TRACKED_MATERIALIZATION_DIRECTORY_OUTSIDE_ROOT' }
            Assert-NoReparsePoint $destinationDirectory
            if (-not (Test-Path -LiteralPath $destinationDirectory)) { New-Item -ItemType Directory -Path $destinationDirectory -Force | Out-Null }
            if (-not (Test-Path -LiteralPath $destinationDirectory -PathType Container)) { Throw-Failure 'TRACKED_MATERIALIZATION_DIRECTORY_INVALID' }
            Assert-NoReparsePoint $destinationDirectory
            [IO.File]::Copy($sourcePath, $destinationPath, $true)
            if (-not (Test-Path -LiteralPath $destinationPath -PathType Leaf)) { Throw-Failure 'TRACKED_MATERIALIZATION_DESTINATION_NOT_LEAF' }
            Assert-NoReparsePoint $destinationPath
            if ((Get-FileSha256 $sourcePath) -cne (Get-FileSha256 $destinationPath)) { Throw-Failure 'TRACKED_MATERIALIZATION_RAW_IDENTITY_MISMATCH' }
        }
        else {
            Assert-NoReparsePoint $sourcePath
            $destinationItem = Get-Item -LiteralPath $destinationPath -Force -ErrorAction SilentlyContinue
            if ($null -ne $destinationItem) {
                if ($destinationItem.PSIsContainer -or -not (Test-Path -LiteralPath $destinationPath -PathType Leaf)) { Throw-Failure 'TRACKED_MATERIALIZATION_DELETION_DESTINATION_NOT_LEAF' }
                Assert-NoReparsePoint $destinationPath
                [IO.File]::Delete($destinationPath)
            }
            if ($null -ne (Get-Item -LiteralPath $destinationPath -Force -ErrorAction SilentlyContinue)) { Throw-Failure 'TRACKED_MATERIALIZATION_DELETION_FAILED' }
        }
    }
}

function Get-CanonicalTrackedIdentity {
    param([Parameter(Mandatory = $true)][string]$WorkingDirectory, [Parameter(Mandatory = $true)][AllowEmptyCollection()][string[]]$Paths)
    $items = New-Object System.Collections.Generic.List[object]
    foreach ($relativePath in @($Paths | Sort-Object -Unique)) {
        $fullPath = Get-FullPath (Join-Path $WorkingDirectory $relativePath)
        if (-not (Test-PathWithinRoot -Path $fullPath -Root $WorkingDirectory)) { Throw-Failure 'TRACKED_IDENTITY_PATH_OUTSIDE_WORKTREE' }
        $identity = 'missing'
        if (Test-Path -LiteralPath $fullPath -PathType Leaf) {
            # git hash-object can create loose objects.  Canonical identity is
            # therefore a direct file SHA-256, which is read-only for Git state.
            $identity = Get-FileSha256 $fullPath
        }
        $items.Add([ordered]@{ path = ($relativePath -replace '\\', '/'); canonical_git_blob = $identity })
    }
    return $items.ToArray()
}

function Get-ContentAwareWorktreeIdentity {
    param([Parameter(Mandatory = $true)][string]$WorkingDirectory)
    $status = Get-RequiredGitOutput -Arguments @('-C', $WorkingDirectory, '-c', 'core.quotePath=true', 'status', '--porcelain=v1', '--untracked-files=all') -WorkingDirectory $WorkingDirectory -FailureCode 'CONTENT_AWARE_STATUS_UNAVAILABLE'
    $tracked = @(Get-TrackedPatchPaths $WorkingDirectory)
    $untrackedResult = Get-GitResult -Arguments @('-C', $WorkingDirectory, 'ls-files', '--others', '--exclude-standard', '-z') -WorkingDirectory $WorkingDirectory
    if ($untrackedResult.ExitCode -ne 0) { Throw-Failure 'CONTENT_AWARE_UNTRACKED_ENUMERATION_FAILED' }
    $untracked = New-Object System.Collections.Generic.List[object]
    foreach ($relativePath in @($untrackedResult.StandardOutput -split "`0" | Where-Object { -not [string]::IsNullOrWhiteSpace($_) } | Sort-Object -Unique)) {
        $fullPath = Get-FullPath (Join-Path $WorkingDirectory $relativePath)
        if (-not (Test-PathWithinRoot -Path $fullPath -Root $WorkingDirectory) -or -not (Test-Path -LiteralPath $fullPath -PathType Leaf)) { Throw-Failure 'CONTENT_AWARE_UNTRACKED_PATH_INVALID' }
        $untracked.Add([ordered]@{ path = ($relativePath -replace '\\', '/'); raw_sha256 = Get-FileSha256 $fullPath })
    }
    $value = [ordered]@{ status = $status; tracked = @(Get-CanonicalTrackedIdentity $WorkingDirectory $tracked); untracked = $untracked.ToArray(); semantic_index = Get-SemanticIndexIdentity $WorkingDirectory }
    return Get-TextSha256 ($value | ConvertTo-Json -Depth 12 -Compress)
}

function Get-DirectSiblingIdentity {
    param([Parameter(Mandatory = $true)][string]$RootToExclude)
    if (-not (Test-Path -LiteralPath $script:TempBase -PathType Container)) { return Get-TextSha256 '' }
    $excluded = Get-NormalizedPath $RootToExclude
    $names = @(Get-ChildItem -LiteralPath $script:TempBase -Force | Where-Object { (Get-NormalizedPath $_.FullName) -cne $excluded } | ForEach-Object { $_.Name } | Sort-Object)
    return Get-TextSha256 ($names -join "`n")
}

function Test-SequenceExact {
    param($Expected, $Actual)
    $left = @($Expected); $right = @($Actual)
    if ($left.Count -ne $right.Count) { return $false }
    for ($i = 0; $i -lt $left.Count; $i++) {
        if (($left[$i] | ConvertTo-Json -Depth 12 -Compress) -cne ($right[$i] | ConvertTo-Json -Depth 12 -Compress)) { return $false }
    }
    return $true
}

function Read-OwnershipManifest {
    param([string]$Root, [string]$ExpectedSourceRoot)
    $manifestPath = Join-Path $Root $script:ManifestName
    if (-not (Test-Path -LiteralPath $manifestPath -PathType Leaf)) { Throw-Failure 'OWNERSHIP_MANIFEST_MISSING' }
    Assert-NoReparsePoint $manifestPath
    try { $manifest = [System.IO.File]::ReadAllText($manifestPath, [System.Text.UTF8Encoding]::new($false)) | ConvertFrom-Json }
    catch { Throw-Failure 'OWNERSHIP_MANIFEST_INVALID' }
    foreach ($requiredField in @('physical_layout', 'path_budget_status', 'path_budget_limit', 'path_budget_observed_maximum', 'path_budget_remaining', 'worktree_path_length', 'scratch_path_length', 'tracked_patch_paths', 'phase_owned_tracked_paths', 'inherited_protected_tracked_paths', 'tracked_canonical_content_identities', 'canonical_tracked_diff_sha256', 'retained_patch_path', 'retained_patch_sha256', 'retained_patch_bom_state', 'approved_untracked_paths', 'untracked_overlay_identities', 'content_aware_primary_worktree_state_sha256', 'content_aware_isolated_worktree_state_sha256', 'semantic_primary_index_identity', 'semantic_linked_index_identity', 'object_database_identity', 'sibling_baseline_sha256', 'created_utc', 'head', 'workspace_identity', 'git_common_directory')) {
        if ($manifest.PSObject.Properties.Name -notcontains $requiredField) { Throw-Failure 'OWNERSHIP_MANIFEST_MISMATCH' }
    }
    if ((Get-FileBomState $manifestPath) -ne 'NONE') { Throw-Failure 'MANIFEST_BOM_REJECTED' }
    if ($manifest.magic -cne $script:ManifestMagic -or [int]$manifest.schema_version -ne 2 -or
        [string]$manifest.physical_layout -cne $script:IsolationLayout -or [string]$manifest.path_budget_status -cne 'PASS' -or
        [int]$manifest.path_budget_limit -ne $script:PathBudgetLimit -or [int]$manifest.path_budget_observed_maximum -gt $script:PathBudgetLimit -or
        ([int]$manifest.path_budget_limit - [int]$manifest.path_budget_observed_maximum) -ne [int]$manifest.path_budget_remaining -or
        -not [string]::Equals((Get-FullPath $manifest.isolation_root), (Get-FullPath $Root), [System.StringComparison]::OrdinalIgnoreCase) -or
        -not [string]::Equals((Get-FullPath $manifest.source_root), (Get-FullPath $ExpectedSourceRoot), [System.StringComparison]::OrdinalIgnoreCase) -or
        [string]$manifest.purpose -notin @('EXPLORER', 'REVIEWER', 'VERIFIER') -or
        [string]::IsNullOrWhiteSpace([string]$manifest.created_utc) -or
        [string]::IsNullOrWhiteSpace([string]$manifest.workspace_identity) -or
        [string]::IsNullOrWhiteSpace([string]$manifest.git_common_directory)) { Throw-Failure 'OWNERSHIP_MANIFEST_MISMATCH' }
    [void](Assert-StringArray -Value $manifest.approved_untracked_paths -Code 'APPROVED_UNTRACKED_PATHS_TYPE_INVALID')
    [void](Assert-StringArray -Value $manifest.tracked_patch_paths -Code 'TRACKED_PATCH_PATHS_TYPE_INVALID')
    [void](Assert-StringArray -Value $manifest.phase_owned_tracked_paths -Code 'PHASE_TRACKED_PATHS_TYPE_INVALID')
    [void](Assert-StringArray -Value $manifest.inherited_protected_tracked_paths -Code 'INHERITED_TRACKED_PATHS_TYPE_INVALID')
    [void](Assert-CanonicalIdentityArray -Value $manifest.tracked_canonical_content_identities)
    if ($manifest.untracked_overlay_identities -isnot [System.Array]) { Throw-Failure 'UNTRACKED_OVERLAY_IDENTITIES_TYPE_INVALID' }
    foreach ($overlay in $manifest.untracked_overlay_identities) { if ($overlay.path -isnot [string] -or $overlay.raw_sha256 -isnot [string]) { Throw-Failure 'UNTRACKED_OVERLAY_IDENTITIES_TYPE_INVALID' } }
    $worktreePath = Get-FullPath ([string]$manifest.worktree_path)
    if ([string]$worktreePath -cne (Get-FullPath (Join-Path $Root 'w')) -or [int]$manifest.worktree_path_length -ne $worktreePath.Length) { Throw-Failure 'OWNERSHIP_MANIFEST_WORKTREE_OUTSIDE_ROOT' }
    if ([bool]$manifest.scratch_allowed) {
        if ([string]$manifest.purpose -cne 'VERIFIER' -or [string]::IsNullOrWhiteSpace([string]$manifest.scratch_path)) { Throw-Failure 'OWNERSHIP_MANIFEST_SCRATCH_MISMATCH' }
        $scratchPath = Get-FullPath ([string]$manifest.scratch_path)
        if ([string]$scratchPath -cne (Get-FullPath (Join-Path $Root 's')) -or [int]$manifest.scratch_path_length -ne $scratchPath.Length) { Throw-Failure 'OWNERSHIP_MANIFEST_SCRATCH_OUTSIDE_ALLOWED_ROOT' }
    }
    elseif (-not [string]::IsNullOrWhiteSpace([string]$manifest.scratch_path) -or [int]$manifest.scratch_path_length -ne 0) { Throw-Failure 'OWNERSHIP_MANIFEST_UNEXPECTED_SCRATCH' }
    return $manifest
}

function Assert-ValidIsolationManifest {
    param([string]$Root, [string]$SourceRoot)
    $fullRoot = Get-FullPath $Root
    $fullTempBase = Get-FullPath $script:TempBase
    if (-not (Test-PathWithinRoot -Path $fullRoot -Root $fullTempBase) -or [string]::Equals($fullRoot, $fullTempBase, [System.StringComparison]::OrdinalIgnoreCase)) { Throw-Failure 'ISOLATION_ROOT_OUTSIDE_HELPER_TEMP_BASE' }
    $parent = [System.IO.Directory]::GetParent($fullRoot.TrimEnd([System.IO.Path]::DirectorySeparatorChar, [System.IO.Path]::AltDirectorySeparatorChar))
    if ($null -eq $parent -or -not [string]::Equals((Get-FullPath $parent.FullName), $fullTempBase, [System.StringComparison]::OrdinalIgnoreCase)) { Throw-Failure 'ISOLATION_ROOT_MUST_BE_DIRECT_CHILD' }
    if ([System.IO.Path]::GetFileName($fullRoot) -notmatch '^[0-9a-fA-F]{32}$') { Throw-Failure 'ISOLATION_ROOT_NAME_INVALID' }
    if (-not (Test-Path -LiteralPath $fullRoot -PathType Container)) { Throw-Failure 'ISOLATION_ROOT_MISSING' }
    Assert-NoReparsePointsUnderRoot $fullRoot
    $manifest = Read-OwnershipManifest -Root $fullRoot -ExpectedSourceRoot $SourceRoot
    $context = Get-RepositoryContext
    if ([string]$manifest.workspace_identity -cne [string]$context.WorkspaceIdentity -or
        -not [string]::Equals((Get-FullPath ([string]$manifest.git_common_directory)), (Get-FullPath $context.CommonDirectory), [System.StringComparison]::OrdinalIgnoreCase) -or
        [string]$manifest.head -cne (Get-RequiredGitOutput -Arguments @('-C', $SourceRoot, 'rev-parse', 'HEAD') -WorkingDirectory $SourceRoot -FailureCode 'HEAD_RESOLUTION_FAILED')) { Throw-Failure 'MANIFEST_SOURCE_IDENTITY_INVALID' }
    $worktreePath = Get-FullPath ([string]$manifest.worktree_path)
    if (-not (Test-Path -LiteralPath $worktreePath -PathType Container)) { Throw-Failure 'ISOLATION_WORKTREE_MISSING' }
    Assert-NoReparsePoint $worktreePath
    if ([bool]$manifest.scratch_allowed -and (Test-Path -LiteralPath ([string]$manifest.scratch_path))) { Assert-NoReparsePointsUnderRoot ([string]$manifest.scratch_path) }

    $sourcePaths = @(Get-TrackedPatchPaths $SourceRoot)
    $phase = @($manifest.phase_owned_tracked_paths | ForEach-Object { [string]$_ } | Sort-Object)
    $inherited = @($manifest.inherited_protected_tracked_paths | ForEach-Object { [string]$_ } | Sort-Object)
    $all = @($manifest.tracked_patch_paths | ForEach-Object { [string]$_ } | Sort-Object)
    if (-not (Test-SequenceExact $all @($sourcePaths | Sort-Object)) -or @($phase + $inherited | Sort-Object -Unique).Count -ne $all.Count -or @($phase | Where-Object { $inherited -contains $_ }).Count -ne 0) { Throw-Failure 'TRACKED_OWNERSHIP_PARTITION_INVALID' }
    if (-not (Test-SequenceExact @($manifest.tracked_canonical_content_identities) @(Get-CanonicalTrackedIdentity $SourceRoot $sourcePaths))) { Throw-Failure 'PRIMARY_TRACKED_CANONICAL_IDENTITY_DRIFT' }
    if (-not (Test-SequenceExact @($manifest.tracked_canonical_content_identities) @(Get-CanonicalTrackedIdentity $worktreePath $sourcePaths))) { Throw-Failure 'ISOLATED_TRACKED_CANONICAL_IDENTITY_DRIFT' }
    $patchPath = Get-FullPath ([string]$manifest.retained_patch_path)
    if ([string]$patchPath -cne (Get-FullPath (Join-Path $fullRoot 'tracked.patch')) -or -not (Test-Path -LiteralPath $patchPath -PathType Leaf)) { Throw-Failure 'RETAINED_PATCH_IDENTITY_INVALID' }
    Assert-NoReparsePoint $patchPath
    if ((Get-FileSha256 $patchPath) -cne [string]$manifest.retained_patch_sha256 -or (Get-FileBomState $patchPath) -cne 'NONE' -or [string]$manifest.retained_patch_bom_state -cne 'NONE' -or (Get-TextSha256 ([System.IO.File]::ReadAllText($patchPath, [System.Text.UTF8Encoding]::new($false)))) -cne [string]$manifest.canonical_tracked_diff_sha256) { Throw-Failure 'RETAINED_PATCH_IDENTITY_INVALID' }
    $primaryStatusUnchanged = ((Get-ContentAwareWorktreeIdentity $SourceRoot) -ceq [string]$manifest.content_aware_primary_worktree_state_sha256)
    if ((Get-GitObjectDatabaseIdentity $SourceRoot) -cne [string]$manifest.object_database_identity) { Throw-Failure 'GIT_OBJECT_DATABASE_DRIFT' }
    $primaryIndexPath = Get-GitIndexPath $SourceRoot
    $primaryIndexUnchanged = ([string]::Equals((Get-FullPath $primaryIndexPath), (Get-FullPath ([string]$manifest.primary_index_path)), [System.StringComparison]::OrdinalIgnoreCase) -and (Get-OptionalFileSha256 $primaryIndexPath) -ceq [string]$manifest.primary_index_sha256 -and (Get-SemanticIndexIdentity $SourceRoot) -ceq [string]$manifest.semantic_primary_index_identity)
    $linkedIndex = Get-GitIndexPath $worktreePath
    $linkedIndexDistinct = -not [string]::Equals((Get-FullPath $linkedIndex), (Get-FullPath $primaryIndexPath), [System.StringComparison]::OrdinalIgnoreCase)
    $worktreeStatusUnchanged = ((Get-ContentAwareWorktreeIdentity $worktreePath) -ceq [string]$manifest.content_aware_isolated_worktree_state_sha256)
    if (-not $primaryStatusUnchanged) { Throw-Failure 'PRIMARY_CONTENT_AWARE_STATE_DRIFT' }
    if (-not $primaryIndexUnchanged) { Throw-Failure 'PRIMARY_SEMANTIC_INDEX_DRIFT' }
    if (-not $linkedIndexDistinct -or [string]$linkedIndex -cne [string]$manifest.linked_index_path -or (Get-SemanticIndexIdentity $worktreePath) -cne [string]$manifest.semantic_linked_index_identity) { Throw-Failure 'LINKED_INDEX_IDENTITY_INVALID' }
    if (-not $worktreeStatusUnchanged) { Throw-Failure 'ISOLATED_WORKTREE_CONTENT_AWARE_DRIFT' }
    foreach ($overlay in @($manifest.untracked_overlay_identities)) {
        $relativePath = [string]$overlay.path; $sourcePath = Get-FullPath (Join-Path $SourceRoot $relativePath); $isolatedPath = Get-FullPath (Join-Path $worktreePath $relativePath)
        Assert-NoReparsePoint $sourcePath; Assert-NoReparsePoint $isolatedPath
        if (-not (Test-PathWithinRoot $sourcePath $SourceRoot) -or -not (Test-PathWithinRoot $isolatedPath $worktreePath) -or -not (Test-Path -LiteralPath $sourcePath -PathType Leaf) -or -not (Test-Path -LiteralPath $isolatedPath -PathType Leaf) -or (Get-FileSha256 $sourcePath) -cne [string]$overlay.raw_sha256 -or (Get-FileSha256 $isolatedPath) -cne [string]$overlay.raw_sha256) { Throw-Failure 'UNTRACKED_OVERLAY_IDENTITY_INVALID' }
    }
    $approved = @($manifest.approved_untracked_paths | ForEach-Object { [string]$_ } | Sort-Object)
    $overlayPaths = @($manifest.untracked_overlay_identities | ForEach-Object { [string]$_.path } | Sort-Object)
    if (-not (Test-SequenceExact $approved $overlayPaths)) { Throw-Failure 'APPROVED_UNTRACKED_OVERLAY_CARDINALITY_INVALID' }
    $scratchPath = if ([bool]$manifest.scratch_allowed) { Get-FullPath ([string]$manifest.scratch_path) } else { '' }
    $budget = Get-IsolationPathBudget -SourceRoot $SourceRoot -CommonDirectory (Get-RepositoryContext).CommonDirectory -Head ([string]$manifest.head) -WorktreePath $worktreePath -ScratchPath $scratchPath
    if (-not $budget.Safe -or $budget.ObservedMaximum -ne [int]$manifest.path_budget_observed_maximum -or $budget.Remaining -ne [int]$manifest.path_budget_remaining -or $budget.CheckoutMaximum -ne [int]$manifest.checkout_path_maximum -or $budget.GitAdminMaximum -ne [int]$manifest.git_admin_path_maximum -or $budget.VerifierNestedMaximum -ne [int]$manifest.verifier_nested_path_maximum) { Throw-Failure 'PATH_BUDGET_NOT_PROVEN' }
    return [pscustomobject]@{
        Manifest = $manifest
        PrimaryStatusUnchanged = $primaryStatusUnchanged
        PrimaryIndexUnchanged = $primaryIndexUnchanged
        WorktreeStatusUnchanged = $worktreeStatusUnchanged
        LinkedIndexDistinct = $linkedIndexDistinct
        ScratchRemoved = $true
    }
}

function Remove-OwnedIsolation {
    param([string]$Root, [string]$SourceRoot)
    $result = Assert-ValidIsolationManifest -Root $Root -SourceRoot $SourceRoot
    $fullRoot = Get-FullPath $Root; $worktreePath = Get-FullPath ([string]$result.Manifest.worktree_path)
    if ((Get-DirectSiblingIdentity $fullRoot) -cne [string]$result.Manifest.sibling_baseline_sha256) { Throw-Failure 'ISOLATION_SIBLING_DRIFT' }
    $removeResult = Get-GitResult -Arguments @('-C', $SourceRoot, 'worktree', 'remove', '--force', $worktreePath) -WorkingDirectory $SourceRoot
    if ($removeResult.ExitCode -ne 0 -and (Test-Path -LiteralPath $worktreePath)) { Throw-Failure 'GIT_WORKTREE_REMOVE_FAILED' }
    if ([bool]$result.Manifest.scratch_allowed -and (Test-Path -LiteralPath ([string]$result.Manifest.scratch_path))) { Remove-Item -LiteralPath ([string]$result.Manifest.scratch_path) -Recurse -Force }
    Remove-Item -LiteralPath $fullRoot -Recurse -Force
    if (Test-Path -LiteralPath $fullRoot) { Throw-Failure 'ISOLATION_ROOT_REMOVAL_UNVERIFIED' }
    if ((Get-DirectSiblingIdentity $fullRoot) -cne [string]$result.Manifest.sibling_baseline_sha256) { Throw-Failure 'ISOLATION_SIBLING_POSTDELETE_DRIFT' }
    return $result
}

function Invoke-Create {
    $sourceRoot = $null
    $isolationRoot = $null
    $createdRoot = $false
    $creationNonce = $null
    $creationMarkerPath = $null
    $manifestValidated = $false
    $transitionLock = $null
    $writerStatePath = $null
    try {
        if ($IsolationPurpose -notin @('EXPLORER', 'REVIEWER', 'VERIFIER')) { Throw-Failure 'ISOLATION_PURPOSE_REQUIRED' }
        if ($EnableVerifierScratch -and $IsolationPurpose -cne 'VERIFIER') { Throw-Failure 'SCRATCH_REQUIRES_VERIFIER_PURPOSE' }
        $context = Get-RepositoryContext
        $sourceRoot = $context.SourceRoot
        $writerStatePath = Get-WriterLeasePath $context.CommonDirectory
        $transitionLock = Enter-LeaseTransitionLock $writerStatePath
        [void](Assert-WriterIsolationInterlock -Context $context -Direction 'ISOLATION')
        $head = Get-RequiredGitOutput -Arguments @('-C', $sourceRoot, 'rev-parse', 'HEAD') -WorkingDirectory $sourceRoot -FailureCode 'HEAD_RESOLUTION_FAILED'
        $primaryIndexPath = Get-GitIndexPath $sourceRoot
        $primaryIndexSha = Get-OptionalFileSha256 $primaryIndexPath
        $primaryStatusSha = Get-GitStatusSha256 $sourceRoot
        $primaryContentAwareState = Get-ContentAwareWorktreeIdentity $sourceRoot
        $semanticPrimaryIndex = Get-SemanticIndexIdentity $sourceRoot
        $objectDatabaseIdentity = Get-GitObjectDatabaseIdentity $sourceRoot
        $trackedPatchPaths = @(Get-TrackedPatchPaths $sourceRoot)
        $inheritedProtectedPaths = @('GUARD.bat', '_guard/PROJECT_GUARD.config.bat', '_guard/PROJECT_GUARD_ENGINE.bat', '_guard/README.md')
        $inheritedPartition = @($trackedPatchPaths | Where-Object { $inheritedProtectedPaths -contains $_ } | Sort-Object)
        $phaseOwnedPartition = @($trackedPatchPaths | Where-Object { $inheritedProtectedPaths -notcontains $_ } | Sort-Object)
        $trackedCanonicalIdentities = @(Get-CanonicalTrackedIdentity $sourceRoot $trackedPatchPaths)

        $isolationRoot = Join-Path $script:TempBase ([Guid]::NewGuid().ToString('N'))
        $worktreePath = Join-Path $isolationRoot 'w'
        $patchPath = Join-Path $isolationRoot 'tracked.patch'
        $manifestPath = Join-Path $isolationRoot $script:ManifestName
        $scratchPath = if ($EnableVerifierScratch) { Join-Path $isolationRoot 's' } else { '' }
        if (Test-PathWithinRoot -Path $isolationRoot -Root $sourceRoot) { Throw-Failure 'ISOLATION_ROOT_INSIDE_SOURCE_ROOT' }
        Assert-NoReparsePoint $script:TempBase
        $pathBudget = Get-IsolationPathBudget -SourceRoot $sourceRoot -CommonDirectory $context.CommonDirectory -Head $head -WorktreePath $worktreePath -ScratchPath $scratchPath
        if (-not $pathBudget.Safe) { Throw-Failure 'WINDOWS_PATH_BUDGET_EXCEEDED' }

        if (-not (Test-Path -LiteralPath $script:TempBase)) { New-Item -ItemType Directory -Path $script:TempBase | Out-Null }
        Assert-NoReparsePoint $script:TempBase
        New-Item -ItemType Directory -Path $isolationRoot | Out-Null
        $createdRoot = $true
        Assert-NoReparsePoint $isolationRoot
        $creationNonce = [Guid]::NewGuid().ToString('N')
        $creationMarkerPath = Write-CreationMarker -Root $isolationRoot -Context $context -Nonce $creationNonce -Head $head -Purpose $IsolationPurpose -WorktreePath $worktreePath -ScratchPath $scratchPath -SiblingBaseline (Get-DirectSiblingIdentity $isolationRoot)
        Invoke-CreationFailureInjection -Point 'ROOT_MARKER' -SourceRoot $sourceRoot

        $addResult = Get-GitResult -Arguments @('-C', $sourceRoot, 'worktree', 'add', '--detach', $worktreePath, $head) -WorkingDirectory $sourceRoot
        if ($addResult.ExitCode -ne 0) { Throw-Failure 'GIT_WORKTREE_ADD_FAILED' }
        Assert-NoReparsePoint $worktreePath
        Invoke-CreationFailureInjection -Point 'WORKTREE' -SourceRoot $sourceRoot
        $patch = Get-GitResult -Arguments @('-C', $sourceRoot, '-c', 'core.quotePath=true', 'diff', '--binary', '--no-ext-diff', $head) -WorkingDirectory $sourceRoot
        if ($patch.ExitCode -ne 0) { Throw-Failure 'TRACKED_PATCH_CAPTURE_FAILED' }
        [System.IO.File]::WriteAllText($patchPath, $patch.StandardOutput, [System.Text.UTF8Encoding]::new($false))
        if ((Get-FileBomState $patchPath) -ne 'NONE') { Throw-Failure 'RETAINED_PATCH_BOM_REJECTED' }
        Invoke-CreationFailureInjection -Point 'PATCH' -SourceRoot $sourceRoot
        $retainedPatchSha = Get-FileSha256 $patchPath
        $canonicalTrackedDiff = Get-TextSha256 $patch.StandardOutput
        $patchApplied = $false
        if (-not [string]::IsNullOrWhiteSpace($patch.StandardOutput)) {
            $applyResult = Get-GitResult -Arguments @('-C', $worktreePath, 'apply', '--binary', '--whitespace=nowarn', $patchPath) -WorkingDirectory $worktreePath
            if ($applyResult.ExitCode -ne 0) { Throw-Failure 'TRACKED_PATCH_APPLY_FAILED' }
            $patchApplied = $true
        }
        Sync-TrackedPatchRawBytes -SourceRoot $sourceRoot -WorktreeRoot $worktreePath -Paths $trackedPatchPaths
        $approvedOverlays = New-Object System.Collections.Generic.List[string]
        $overlayIdentities = New-Object System.Collections.Generic.List[object]
        $requestedPaths = ConvertFrom-StrictUntrackedPathPayload
        foreach ($requestedPath in $requestedPaths) {
            if ([string]::IsNullOrWhiteSpace($requestedPath) -or [System.IO.Path]::IsPathRooted($requestedPath)) { Throw-Failure 'UNTRACKED_PATH_MUST_BE_REPOSITORY_RELATIVE' }
            $sourcePath = Get-FullPath (Join-Path $sourceRoot $requestedPath)
            if (-not (Test-PathWithinRoot -Path $sourcePath -Root $sourceRoot)) { Throw-Failure 'UNTRACKED_PATH_OUTSIDE_SOURCE_ROOT' }
            Assert-NoReparsePoint $sourcePath
            $relativePath = $sourcePath.Substring($sourceRoot.TrimEnd([System.IO.Path]::DirectorySeparatorChar, [System.IO.Path]::AltDirectorySeparatorChar).Length).TrimStart([System.IO.Path]::DirectorySeparatorChar, [System.IO.Path]::AltDirectorySeparatorChar)
            if ($relativePath -eq '.git' -or $relativePath.StartsWith('.git' + [System.IO.Path]::DirectorySeparatorChar, [System.StringComparison]::OrdinalIgnoreCase)) { Throw-Failure 'UNTRACKED_PATH_GIT_METADATA_REJECTED' }
            Test-ExistingUntrackedFile -RepositoryRoot $sourceRoot -RepositoryRelativePath $relativePath -FullPath $sourcePath
            $destinationPath = Get-FullPath (Join-Path $worktreePath $relativePath)
            if (-not (Test-PathWithinRoot -Path $destinationPath -Root $worktreePath)) { Throw-Failure 'UNTRACKED_DESTINATION_OUTSIDE_WORKTREE' }
            $destinationDirectory = Split-Path -Parent $destinationPath
            if (-not (Test-Path -LiteralPath $destinationDirectory)) { New-Item -ItemType Directory -Path $destinationDirectory -Force | Out-Null }
            Assert-NoReparsePoint $destinationDirectory
            [System.IO.File]::Copy($sourcePath, $destinationPath, $false)
            $normalizedOverlay = ($relativePath -replace '\\', '/')
            $approvedOverlays.Add($normalizedOverlay)
            $overlayIdentities.Add([ordered]@{ path = $normalizedOverlay; raw_sha256 = Get-FileSha256 $sourcePath })
        }
        Invoke-CreationFailureInjection -Point 'OVERLAY' -SourceRoot $sourceRoot
        if ($EnableVerifierScratch) {
            New-Item -ItemType Directory -Path $scratchPath | Out-Null
            Assert-NoReparsePoint $scratchPath
        }
        $linkedIndexPath = Get-GitIndexPath $worktreePath
        if ([string]::Equals((Get-FullPath $linkedIndexPath), (Get-FullPath $primaryIndexPath), [System.StringComparison]::OrdinalIgnoreCase)) { Throw-Failure 'LINKED_WORKTREE_INDEX_NOT_DISTINCT' }
        if (-not (Test-SequenceExact $trackedCanonicalIdentities @(Get-CanonicalTrackedIdentity $worktreePath $trackedPatchPaths))) { Throw-Failure 'TRACKED_CANONICAL_IDENTITY_MISMATCH_AFTER_CREATE' }
        $manifest = [ordered]@{
            magic = $script:ManifestMagic
            schema_version = 2
            purpose = $IsolationPurpose
            physical_layout = $script:IsolationLayout
            source_root = $sourceRoot
            git_common_directory = $context.CommonDirectory
            workspace_identity = $context.WorkspaceIdentity
            isolation_root = $isolationRoot
            worktree_path = $worktreePath
            scratch_allowed = [bool]$EnableVerifierScratch
            scratch_path = $scratchPath
            approved_untracked_paths = ConvertTo-DeterministicArray $approvedOverlays
            head = $head
            primary_status_sha256 = $primaryStatusSha
            primary_index_path = $primaryIndexPath
            primary_index_sha256 = $primaryIndexSha
            linked_index_path = $linkedIndexPath
            initial_worktree_status_sha256 = Get-GitStatusSha256 $worktreePath
            tracked_patch_paths = ConvertTo-DeterministicArray $trackedPatchPaths
            phase_owned_tracked_paths = ConvertTo-DeterministicArray $phaseOwnedPartition
            inherited_protected_tracked_paths = ConvertTo-DeterministicArray $inheritedPartition
            tracked_canonical_content_identities = ConvertTo-DeterministicArray $trackedCanonicalIdentities
            canonical_tracked_diff_sha256 = $canonicalTrackedDiff
            retained_patch_path = $patchPath
            retained_patch_sha256 = $retainedPatchSha
            retained_patch_bom_state = 'NONE'
            untracked_overlay_identities = ConvertTo-DeterministicArray $overlayIdentities
            content_aware_primary_worktree_state_sha256 = $primaryContentAwareState
            content_aware_isolated_worktree_state_sha256 = Get-ContentAwareWorktreeIdentity $worktreePath
            semantic_primary_index_identity = $semanticPrimaryIndex
            semantic_linked_index_identity = Get-SemanticIndexIdentity $worktreePath
            object_database_identity = $objectDatabaseIdentity
            sibling_baseline_sha256 = Get-DirectSiblingIdentity $isolationRoot
            path_budget_status = 'PASS'
            path_budget_limit = $pathBudget.Limit
            path_budget_observed_maximum = $pathBudget.ObservedMaximum
            path_budget_remaining = $pathBudget.Remaining
            worktree_path_length = $pathBudget.WorktreePathLength
            scratch_path_length = $pathBudget.ScratchPathLength
            longest_tracked_relative_path = $pathBudget.LongestTrackedRelativePath
            checkout_path_maximum = $pathBudget.CheckoutMaximum
            git_admin_path_maximum = $pathBudget.GitAdminMaximum
            verifier_nested_path_maximum = $pathBudget.VerifierNestedMaximum
            created_utc = [DateTime]::UtcNow.ToString('o')
        }
        Invoke-CreationFailureInjection -Point 'BEFORE_MANIFEST' -SourceRoot $sourceRoot
        [System.IO.File]::WriteAllText($manifestPath, ($manifest | ConvertTo-Json -Depth 12), [System.Text.UTF8Encoding]::new($false))
        Invoke-CreationFailureInjection -Point 'AFTER_MANIFEST' -SourceRoot $sourceRoot
        [void](Assert-ValidIsolationManifest -Root $isolationRoot -SourceRoot $sourceRoot)
        $manifestValidated = $true
        Remove-Item -LiteralPath $creationMarkerPath -Force
        if (Test-Path -LiteralPath $creationMarkerPath) { Throw-Failure 'CREATION_MARKER_RETIREMENT_UNVERIFIED' }
        Invoke-CreationFailureInjection -Point 'AFTER_VALIDATION' -SourceRoot $sourceRoot
        Write-ActiveIsolationRegistry -Context $context -Root $isolationRoot
        Write-Result ([ordered]@{
                ACTION = 'CREATE'; STATUS = 'CREATED'; MANIFEST_VERSION = 2; PURPOSE = $IsolationPurpose
                ISOLATION_BASE = $script:TempBase; ISOLATION_ROOT = $isolationRoot; WORKTREE_PATH = $worktreePath
                SCRATCH_ALLOWED = ([bool]$EnableVerifierScratch).ToString().ToLowerInvariant(); SCRATCH_PATH = $scratchPath
                SOURCE_ROOT = $sourceRoot; HEAD = $head; TRACKED_PATCH_APPLIED = $patchApplied.ToString().ToLowerInvariant()
                UNTRACKED_OVERLAY_COUNT = $approvedOverlays.Count; LINKED_INDEX_DISTINCT = 'true'; RETAINED_PATCH_SHA256 = $retainedPatchSha
                PHYSICAL_LAYOUT = $script:IsolationLayout; PATH_BUDGET_PREFLIGHT = 'PASS'
                PATH_BUDGET_LIMIT = $pathBudget.Limit; PATH_BUDGET_OBSERVED_MAXIMUM = $pathBudget.ObservedMaximum
                PATH_BUDGET_REMAINING = $pathBudget.Remaining
            })
    }
    catch {
        $code = $_.Exception.Message
        $rollback = 'NOT_ATTEMPTED'
        if ($createdRoot -and $null -ne $context -and -not [string]::IsNullOrWhiteSpace($creationNonce)) {
            try {
                if (Test-Path -LiteralPath $creationMarkerPath -PathType Leaf) {
                    Invoke-MarkerOwnedRollback -Root $isolationRoot -Context $context -Nonce $creationNonce -WorktreePath $worktreePath -ScratchPath $scratchPath
                    $rollback = 'MARKER_OWNED_REMOVED'
                }
                elseif ($manifestValidated -and (Test-Path -LiteralPath $manifestPath -PathType Leaf)) {
                    [void](Remove-OwnedIsolation -Root $isolationRoot -SourceRoot $context.SourceRoot)
                    $rollback = 'MANIFEST_OWNED_REMOVED'
                }
                else { $rollback = 'OWNERSHIP_NOT_PROVEN_RETAINED' }
            }
            catch { $rollback = 'ROLLBACK_FAILED_' + $_.Exception.Message }
        }
        $evidenceRetained = if ($null -ne $isolationRoot -and -not [string]::IsNullOrWhiteSpace($isolationRoot)) { (Test-Path -LiteralPath $isolationRoot).ToString().ToLowerInvariant() } else { 'false' }
        Write-Result ([ordered]@{ ACTION = 'CREATE'; STATUS = 'FAILED'; ERROR = $code; ROLLBACK = $rollback; EVIDENCE_RETAINED = $evidenceRetained; ISOLATION_ROOT = $isolationRoot })
        exit 1
    }
    finally { if ($null -ne $writerStatePath) { Exit-LeaseTransitionLock $transitionLock $writerStatePath } }
}

function Invoke-Cleanup {
    $transitionLock = $null; $writerStatePath = $null
    try {
        $context = Get-RepositoryContext
        $writerStatePath = Get-WriterLeasePath $context.CommonDirectory
        $transitionLock = Enter-LeaseTransitionLock $writerStatePath
        [void](Assert-WriterIsolationInterlock -Context $context -Direction 'CLEANUP')
        $registered = Read-ActiveIsolationRegistry $context
        if ($null -eq $registered -or -not [string]::Equals((Get-FullPath ([string]$registered.isolation_root)), (Get-FullPath $IsolationRoot), [System.StringComparison]::OrdinalIgnoreCase)) { Throw-Failure 'ISOLATION_REGISTRY_MISMATCH' }
        $result = Remove-OwnedIsolation -Root (Get-FullPath $IsolationRoot) -SourceRoot $context.SourceRoot
        Clear-ActiveIsolationRegistry -Context $context -Root (Get-FullPath $IsolationRoot)
        $allPass = $result.PrimaryStatusUnchanged -and $result.PrimaryIndexUnchanged -and $result.WorktreeStatusUnchanged -and $result.LinkedIndexDistinct -and $result.ScratchRemoved
        Write-Result ([ordered]@{
                ACTION = 'CLEANUP'; STATUS = $(if ($allPass) { 'REMOVED' } else { 'FAILED' })
                ISOLATION_ROOT = (Get-FullPath $IsolationRoot); WORKTREE_PATH = $result.Manifest.worktree_path
                SOURCE_ROOT = $context.SourceRoot; HEAD = $result.Manifest.head
                PRIMARY_STATUS_UNCHANGED = $result.PrimaryStatusUnchanged.ToString().ToLowerInvariant()
                PRIMARY_INDEX_UNCHANGED = $result.PrimaryIndexUnchanged.ToString().ToLowerInvariant()
                ISOLATED_WORKTREE_STATUS_UNCHANGED = $result.WorktreeStatusUnchanged.ToString().ToLowerInvariant()
                LINKED_INDEX_DISTINCT = $result.LinkedIndexDistinct.ToString().ToLowerInvariant()
                VERIFIER_SCRATCH_REMOVED = $result.ScratchRemoved.ToString().ToLowerInvariant()
            })
        if (-not $allPass) { exit 1 }
    }
    catch {
        Write-Result ([ordered]@{ ACTION = 'CLEANUP'; STATUS = 'FAILED'; ERROR = $_.Exception.Message })
        exit 1
    }
    finally { if ($null -ne $writerStatePath) { Exit-LeaseTransitionLock $transitionLock $writerStatePath } }
}

function Invoke-ValidateIsolation {
    try {
        $context = Get-RepositoryContext
        $result = Assert-ValidIsolationManifest -Root (Get-FullPath $IsolationRoot) -SourceRoot $context.SourceRoot
        Write-Result ([ordered]@{ ACTION = 'VALIDATEISOLATION'; STATUS = 'VALID'; ISOLATION_ROOT = (Get-FullPath $IsolationRoot); WORKTREE_PATH = $result.Manifest.worktree_path; SOURCE_ROOT = $context.SourceRoot; MANIFEST_SCHEMA_VERSION = $result.Manifest.schema_version; READ_ONLY = 'true'; PRIMARY_CONTENT_AWARE_STATE = 'UNCHANGED'; PRIMARY_SEMANTIC_INDEX = 'UNCHANGED'; ISOLATED_CONTENT_AWARE_STATE = 'UNCHANGED'; RETAINED_PATCH = 'VALID'; PATH_BUDGET = 'PASS' })
    }
    catch { Write-Result ([ordered]@{ ACTION = 'VALIDATEISOLATION'; STATUS = 'FAILED'; ERROR = $_.Exception.Message; READ_ONLY = 'true' }); exit 1 }
}

function Invoke-AcquireWriter {
    try {
        Assert-ValidTaskId $TaskId
        Assert-ValidLeaseId $PlannedWriterInstanceId 'PLANNED_WRITER_INSTANCE_ID_INVALID'
        Assert-ValidIdentityText $AcquirerRuntimeSessionId 'ACQUIRER_RUNTIME_SESSION_ID_INVALID'
        $context = Get-RepositoryContext
        $leasePath = Get-WriterLeasePath $context.CommonDirectory
        if (Test-Path -LiteralPath $leasePath) {
            try { $existing = Read-WriterLease $leasePath; if (Test-CompleteWriterLeaseV2 -Lease $existing -Context $context) { Throw-Failure 'WRITER_LEASE_BLOCKED' } } catch { if ($_.Exception.Message -eq 'WRITER_LEASE_BLOCKED') { throw } }
            Throw-Failure 'WRITER_LEASE_BLOCKED_INCOMPLETE'
        }
        $leaseId = [Guid]::NewGuid().ToString('N')
        $lease = [ordered]@{
            magic = $script:WriterLeaseMagic; schema_version = 2; lease_state = 'RESERVED'
            source_root = $context.SourceRoot; git_common_directory = $context.CommonDirectory; workspace_identity = $context.WorkspaceIdentity
            repository_head_at_acquire = Get-RequiredGitOutput -Arguments @('rev-parse', 'HEAD') -WorkingDirectory $context.SourceRoot -FailureCode 'HEAD_RESOLUTION_FAILED'
            repository_state_sha256_at_acquire = Get-RepositoryStateSha256 $context.SourceRoot
            task_id = $TaskId; lease_id = $leaseId; planned_writer_instance_id = $PlannedWriterInstanceId
            acquirer_runtime_session_id = $AcquirerRuntimeSessionId; created_utc = [DateTime]::UtcNow.ToString('o')
            writer = $null; claimed_utc = $null; completed_utc = $null
        }
        Write-NewJsonFile -Path $leasePath -Value $lease
        $written = Read-WriterLease $leasePath
        if (-not (Test-CompleteWriterLeaseV2 -Lease $written -Context $context) -or $written.lease_state -cne 'RESERVED') { Throw-Failure 'WRITER_LEASE_WRITE_UNVERIFIED' }
        Write-Result ([ordered]@{ ACTION = 'ACQUIREWRITER'; STATUS = 'RESERVED'; LEASE_STATE = 'RESERVED'; SOURCE_ROOT = $context.SourceRoot; WORKSPACE_IDENTITY = $context.WorkspaceIdentity; WRITER_LEASE_PATH = $leasePath; TASK_ID = $TaskId; WRITER_LEASE_ID = $leaseId; PLANNED_WRITER_INSTANCE_ID = $PlannedWriterInstanceId })
    }
    catch { Write-Result ([ordered]@{ ACTION = 'ACQUIREWRITER'; STATUS = 'FAILED'; ERROR = $_.Exception.Message }); exit 1 }
}

function Invoke-VerifyWriter {
    $lock = $null; $leasePath = $null
    try {
        Assert-ValidTaskId $TaskId; Assert-ValidLeaseId $WriterLeaseId 'WRITER_LEASE_ID_INVALID'; Assert-ValidLeaseId $PlannedWriterInstanceId 'PLANNED_WRITER_INSTANCE_ID_INVALID'
        $context = Get-RepositoryContext; $leasePath = Get-WriterLeasePath $context.CommonDirectory; $lock = Enter-LeaseTransitionLock $leasePath
        $lease = Read-WriterLease $leasePath; Assert-LeaseMatches $lease $context
        $actualIdentity = Get-ClaimedWriterIdentity
        if ($lease.lease_state -ceq 'RESERVED') {
            $lease.writer = $actualIdentity; $lease.claimed_utc = [DateTime]::UtcNow.ToString('o'); $lease.lease_state = 'ACTIVE'; Replace-JsonFile $leasePath $lease
        }
        elseif ($lease.lease_state -ceq 'ACTIVE') {
            if (-not (Test-WriterIdentityExact $lease.writer $actualIdentity)) { Throw-Failure 'WRITER_IDENTITY_MISMATCH' }
        }
        else { Throw-Failure 'WRITER_LEASE_NOT_ACTIVE' }
        $verified = Read-WriterLease $leasePath
        if (-not (Test-CompleteWriterLeaseV2 $verified $context) -or $verified.lease_state -cne 'ACTIVE' -or -not (Test-WriterIdentityExact $verified.writer $actualIdentity)) { Throw-Failure 'WRITER_IDENTITY_WRITE_UNVERIFIED' }
        Write-Result ([ordered]@{ ACTION = 'VERIFYWRITER'; STATUS = 'VERIFIED'; LEASE_STATE = 'ACTIVE'; TASK_ID = $TaskId; WRITER_LEASE_ID = $WriterLeaseId; PLANNED_WRITER_INSTANCE_ID = $PlannedWriterInstanceId; WRITER_RUNTIME_PID = $actualIdentity.pid; WRITER_PROCESS_START_UTC = $actualIdentity.process_start_utc; WRITER_EXECUTABLE_CLASS = $actualIdentity.executable_class; WRITER_EXECUTABLE_SHA256 = $actualIdentity.executable_sha256; WRITER_PARENT_PID = $actualIdentity.parent_pid; WRITER_PARENT_PROCESS_START_UTC = $actualIdentity.parent_process_start_utc })
    }
    catch { Write-Result ([ordered]@{ ACTION = 'VERIFYWRITER'; STATUS = 'FAILED'; ERROR = $_.Exception.Message }); exit 1 }
    finally { if ($null -ne $leasePath) { Exit-LeaseTransitionLock $lock $leasePath } }
}

function Invoke-CompleteWriter {
    $lock = $null; $leasePath = $null
    try {
        Assert-ValidTaskId $TaskId; Assert-ValidLeaseId $WriterLeaseId 'WRITER_LEASE_ID_INVALID'; Assert-ValidLeaseId $PlannedWriterInstanceId 'PLANNED_WRITER_INSTANCE_ID_INVALID'
        $context = Get-RepositoryContext; $leasePath = Get-WriterLeasePath $context.CommonDirectory; $lock = Enter-LeaseTransitionLock $leasePath
        $lease = Read-WriterLease $leasePath; Assert-LeaseMatches $lease $context
        if ($lease.lease_state -cne 'ACTIVE') { Throw-Failure 'WRITER_LEASE_NOT_ACTIVE' }
        $actualIdentity = Get-ClaimedWriterIdentity
        if (-not (Test-WriterIdentityExact $lease.writer $actualIdentity)) { Throw-Failure 'WRITER_IDENTITY_MISMATCH' }
        $lease.lease_state = 'COMPLETED'; $lease.completed_utc = [DateTime]::UtcNow.ToString('o'); Replace-JsonFile $leasePath $lease
        $completed = Read-WriterLease $leasePath
        if (-not (Test-CompleteWriterLeaseV2 $completed $context) -or $completed.lease_state -cne 'COMPLETED') { Throw-Failure 'WRITER_COMPLETION_UNVERIFIED' }
        Write-Result ([ordered]@{ ACTION = 'COMPLETEWRITER'; STATUS = 'COMPLETED'; LEASE_STATE = 'COMPLETED'; TASK_ID = $TaskId; WRITER_LEASE_ID = $WriterLeaseId; PLANNED_WRITER_INSTANCE_ID = $PlannedWriterInstanceId })
    }
    catch { Write-Result ([ordered]@{ ACTION = 'COMPLETEWRITER'; STATUS = 'FAILED'; ERROR = $_.Exception.Message }); exit 1 }
    finally { if ($null -ne $leasePath) { Exit-LeaseTransitionLock $lock $leasePath } }
}

function Invoke-ReleaseWriter {
    $lock = $null; $leasePath = $null
    try {
        Assert-ValidTaskId $TaskId; Assert-ValidLeaseId $WriterLeaseId 'WRITER_LEASE_ID_INVALID'; Assert-ValidLeaseId $PlannedWriterInstanceId 'PLANNED_WRITER_INSTANCE_ID_INVALID'; Assert-ValidIdentityText $PrimaryRuntimeSessionId 'PRIMARY_RUNTIME_SESSION_ID_INVALID'
        $context = Get-RepositoryContext; $leasePath = Get-WriterLeasePath $context.CommonDirectory; $lock = Enter-LeaseTransitionLock $leasePath
        $lease = Read-WriterLease $leasePath; Assert-LeaseMatches $lease $context
        if ($lease.lease_state -cne 'COMPLETED') { Throw-Failure 'WRITER_LEASE_NOT_COMPLETED' }
        if ([string]$lease.acquirer_runtime_session_id -cne $PrimaryRuntimeSessionId) { Throw-Failure 'PRIMARY_RUNTIME_SESSION_MISMATCH' }
        [System.IO.File]::Delete($leasePath)
        if (Test-Path -LiteralPath $leasePath) { Throw-Failure 'WRITER_LEASE_REMOVAL_UNVERIFIED' }
        Write-Result ([ordered]@{ ACTION = 'RELEASEWRITER'; STATUS = 'RELEASED'; TASK_ID = $TaskId; WRITER_LEASE_ID = $WriterLeaseId; PLANNED_WRITER_INSTANCE_ID = $PlannedWriterInstanceId })
    }
    catch { Write-Result ([ordered]@{ ACTION = 'RELEASEWRITER'; STATUS = 'FAILED'; ERROR = $_.Exception.Message }); exit 1 }
    finally { if ($null -ne $leasePath) { Exit-LeaseTransitionLock $lock $leasePath } }
}

function Invoke-InspectWriter {
    try {
        Assert-ValidTaskId $TaskId; Assert-ValidLeaseId $WriterLeaseId 'WRITER_LEASE_ID_INVALID'
        $context = Get-RepositoryContext; $leasePath = Get-WriterLeasePath $context.CommonDirectory; $before = Get-FileSha256 $leasePath
        $lease = Read-WriterLease $leasePath; Assert-LeaseMatches $lease $context
        $inspection = Get-WriterInspection $lease; $after = Get-FileSha256 $leasePath
        if ($before -cne $after) { Throw-Failure 'INSPECT_WRITER_MUTATED_LEASE' }
        Write-Result ([ordered]@{ ACTION = 'INSPECTWRITER'; STATUS = 'INSPECTED'; WRITER_TERMINATION_PROOF = $inspection; LEASE_STATE = $lease.lease_state; TASK_ID = $TaskId; WRITER_LEASE_ID = $WriterLeaseId; LEASE_SHA256_UNCHANGED = 'true' })
    }
    catch { Write-Result ([ordered]@{ ACTION = 'INSPECTWRITER'; STATUS = 'FAILED'; ERROR = $_.Exception.Message }); exit 1 }
}


switch ($Action) {
    'Create' { Invoke-Create }
    'ValidateIsolation' { Invoke-ValidateIsolation }
    'Cleanup' { Invoke-Cleanup }
    'ControllerAssign' { Invoke-ControllerAssign }
    'ControllerVerify' { Invoke-ControllerVerify }
    'WriterComplete' { Invoke-WriterComplete }
    'ControllerRelease' { Invoke-ControllerRelease }
    'InspectWriter' { Invoke-InspectWriterV3 }
}
