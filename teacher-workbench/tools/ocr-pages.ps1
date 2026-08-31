param(
  [Parameter(Mandatory=$true)][string]$ImageDir,
  [Parameter(Mandatory=$true)][string]$OutputFile
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Runtime.WindowsRuntime

[Windows.Storage.StorageFile, Windows.Storage, ContentType=WindowsRuntime] | Out-Null
[Windows.Storage.FileAccessMode, Windows.Storage, ContentType=WindowsRuntime] | Out-Null
[Windows.Graphics.Imaging.BitmapDecoder, Windows.Graphics.Imaging, ContentType=WindowsRuntime] | Out-Null
[Windows.Media.Ocr.OcrEngine, Windows.Foundation, ContentType=WindowsRuntime] | Out-Null
[Windows.Globalization.Language, Windows.Globalization, ContentType=WindowsRuntime] | Out-Null

$asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() |
  Where-Object {
    $_.Name -eq "AsTask" -and
    $_.GetParameters().Count -eq 1 -and
    $_.GetParameters()[0].ParameterType.Name -eq "IAsyncOperation`1"
  })[0]

function Await-WinRt($operation, [Type]$resultType) {
  $asTask = $asTaskGeneric.MakeGenericMethod($resultType)
  $task = $asTask.Invoke($null, @($operation))
  $task.Wait()
  return $task.Result
}

$language = [Windows.Globalization.Language]::new("zh-Hans-CN")
$engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage($language)
if ($null -eq $engine) {
  throw "Windows OCR Chinese language pack is unavailable."
}

$images = Get-ChildItem -LiteralPath $ImageDir -Filter "*.png" | Sort-Object Name
$chunks = New-Object System.Collections.Generic.List[string]

foreach ($image in $images) {
  $file = Await-WinRt ([Windows.Storage.StorageFile]::GetFileFromPathAsync($image.FullName)) ([Windows.Storage.StorageFile])
  $stream = Await-WinRt ($file.OpenAsync([Windows.Storage.FileAccessMode]::Read)) ([Windows.Storage.Streams.IRandomAccessStream])
  $decoder = Await-WinRt ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) ([Windows.Graphics.Imaging.BitmapDecoder])
  $bitmap = Await-WinRt ($decoder.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])
  $result = Await-WinRt ($engine.RecognizeAsync($bitmap)) ([Windows.Media.Ocr.OcrResult])
  $chunks.Add("`n===== $($image.Name) =====`n$($result.Text)") | Out-Null
  $stream.Dispose()
}

[System.IO.File]::WriteAllText((Resolve-Path -LiteralPath (Split-Path -Parent $OutputFile)).Path + "\" + (Split-Path -Leaf $OutputFile), ($chunks -join "`n"), [System.Text.Encoding]::UTF8)
