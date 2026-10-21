param(
  [string]$ProjectRoot = '\\Mac\Home\Documents\Codes\ListeningSlide',
  [ValidateSet('arm64','x64')][string]$Architecture = 'arm64'
)
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$converter = Join-Path $ProjectRoot "runtime\onlyoffice\win32-$Architecture\converter\x2t.exe"
$job = Join-Path $env:TEMP ('listeningslide-convert-check-' + [Guid]::NewGuid())
try {
  New-Item -ItemType Directory -Path "$job\output","$job\temp" | Out-Null
  $fields = [ordered]@{
    m_sFileFrom = Join-Path $ProjectRoot 'public\demo.pptx'
    m_sFileTo = "$job\output\Editor.bin"
    m_nFormatTo = '8195'
    m_sTempDir = "$job\temp"
    m_sFontDir = Join-Path $ProjectRoot 'runtime\onlyoffice\font-input'
    m_bIsNoBase64 = 'false'
  }
  $xml = '<TaskQueueDataConvert>'
  foreach($key in $fields.Keys) { $xml += "<$key>" + [System.Security.SecurityElement]::Escape($fields[$key]) + "</$key>" }
  $xml += '</TaskQueueDataConvert>'
  [IO.File]::WriteAllText("$job\params.xml", $xml, [Text.UTF8Encoding]::new($false))
  & $converter "$job\params.xml"
  $code = $LASTEXITCODE
  if($code -ne 0) { throw "x2t exit code: $code" }
  $bytes = [IO.File]::ReadAllBytes("$job\output\Editor.bin")
  if([Text.Encoding]::ASCII.GetString($bytes,0,5) -ne 'PPTY;') { throw 'Invalid PPTY signature' }
  [ordered]@{
    architecture = $Architecture
    windowsArchitecture = $env:PROCESSOR_ARCHITECTURE
    converterVersion = (Get-Item $converter).VersionInfo.FileVersion
    exitCode = $code
    binaryBytes = $bytes.Length
    mediaFiles = @(Get-ChildItem "$job\output\media" -File).Count
    systemMsvcp = (Get-Item "$env:windir\System32\msvcp140.dll").VersionInfo.FileVersion
  } | ConvertTo-Json
} finally {
  if(Test-Path $job) { Remove-Item -LiteralPath $job -Recurse -Force }
}
