$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$outputPath = Join-Path (Split-Path -Parent $projectRoot) 'my-stack-expo-client.zip'
$stagingRoot = Join-Path ([System.IO.Path]::GetTempPath()) "my-stack-expo-package-$PID"
$stagedProject = Join-Path $stagingRoot 'expo-client'

try {
    New-Item -ItemType Directory -Path $stagedProject -Force | Out-Null

    Get-ChildItem -LiteralPath $projectRoot -Force -Recurse -File |
        Where-Object {
            $relativePath = $_.FullName.Substring($projectRoot.Length).TrimStart('\')
            $parts = $relativePath.Split('\')
            $excludedDirectory = $parts | Where-Object {
                $_ -in @(
                    'node_modules',
                    '.expo',
                    '.git',
                    '.claude',
                    'android',
                    'ios',
                    'dist',
                    'web-build'
                )
            }
            $isLocalEnvironment = $_.Name -like '.env*' -and $_.Name -ne '.env.example'
            $isGeneratedState = $_.Name -like '*.tsbuildinfo' -or $_.Name -like 'npm-debug*'

            -not $excludedDirectory -and
            -not $isLocalEnvironment -and
            -not $isGeneratedState
        } |
        ForEach-Object {
            $relativePath = $_.FullName.Substring($projectRoot.Length).TrimStart('\')
            $destination = Join-Path $stagedProject $relativePath
            $destinationDirectory = Split-Path -Parent $destination
            New-Item -ItemType Directory -Path $destinationDirectory -Force | Out-Null
            Copy-Item -LiteralPath $_.FullName -Destination $destination
        }

    if (Test-Path -LiteralPath $outputPath) {
        Remove-Item -LiteralPath $outputPath -Force
    }

    Add-Type -AssemblyName System.IO.Compression.FileSystem
    [System.IO.Compression.ZipFile]::CreateFromDirectory(
        $stagingRoot,
        $outputPath,
        [System.IO.Compression.CompressionLevel]::Optimal,
        $false
    )

    Write-Output "Created $outputPath"
    Write-Output ('ZIP size: {0:N1} MB' -f ((Get-Item -LiteralPath $outputPath).Length / 1MB))
}
finally {
    if (Test-Path -LiteralPath $stagingRoot) {
        Remove-Item -LiteralPath $stagingRoot -Recurse -Force
    }
}
