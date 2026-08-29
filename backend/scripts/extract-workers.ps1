param(
  [Parameter(Mandatory = $true)]
  [string]$ExcelPath,

  [Parameter(Mandatory = $true)]
  [string]$SheetName,

  [int]$Column = 1,
  [int]$StartRow = 2,
  [int]$MaximumRows = 5000
)

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$OutputEncoding = [Console]::OutputEncoding

if (-not (Test-Path -LiteralPath $ExcelPath -PathType Leaf)) {
  throw "No existe el archivo Excel indicado."
}

$excel = $null
$workbook = $null
$worksheet = $null

try {
  $excel = New-Object -ComObject Excel.Application
  $excel.Visible = $false
  $excel.DisplayAlerts = $false
  $workbook = $excel.Workbooks.Open($ExcelPath, 0, $true)
  $worksheet = $workbook.Worksheets.Item($SheetName)

  $lastRow = [Math]::Min($worksheet.UsedRange.Rows.Count, $MaximumRows)
  $values = [System.Collections.Generic.List[string]]::new()

  for ($row = $StartRow; $row -le $lastRow; $row++) {
    $value = [string]$worksheet.Cells.Item($row, $Column).Text
    $value = ($value -replace "[\r\n]+", " " -replace "\s+", " ").Trim()
    if ($value) {
      $values.Add($value)
    }
  }

  Write-Output ($values | ConvertTo-Json -Compress)
}
finally {
  if ($workbook) {
    $workbook.Close($false)
  }
  if ($excel) {
    $excel.Quit()
  }
  if ($worksheet) {
    [void][Runtime.InteropServices.Marshal]::ReleaseComObject($worksheet)
  }
  if ($workbook) {
    [void][Runtime.InteropServices.Marshal]::ReleaseComObject($workbook)
  }
  if ($excel) {
    [void][Runtime.InteropServices.Marshal]::ReleaseComObject($excel)
  }
  [GC]::Collect()
  [GC]::WaitForPendingFinalizers()
}
