Add-Type -AssemblyName System.Drawing
$dir = 'c:\Users\User\OneDrive\程式設計\galgame-engine\public\stories\hong_men_yan\images\bg'
$files = Get-ChildItem -Path $dir -Filter '*.png'

foreach ($file in $files) {
    try {
        $img = [System.Drawing.Image]::FromFile($file.FullName)
        if ($img.Width -eq $img.Height) {
            $width = $img.Width
            $height = [math]::Round($width * 9 / 16)
            $y = [math]::Round(($img.Height - $height) / 2)
            
            $rect = New-Object System.Drawing.Rectangle(0, $y, $width, $height)
            $bmp = New-Object System.Drawing.Bitmap($width, $height)
            $bmp.SetResolution($img.HorizontalResolution, $img.VerticalResolution)
            
            $graphics = [System.Drawing.Graphics]::FromImage($bmp)
            $graphics.DrawImage($img, 0, 0, $rect, [System.Drawing.GraphicsUnit]::Pixel)
            
            $graphics.Dispose()
            $img.Dispose()
            
            $tempPath = $file.FullName + '.tmp.png'
            $bmp.Save($tempPath, [System.Drawing.Imaging.ImageFormat]::Png)
            $bmp.Dispose()
            
            Move-Item -Path $tempPath -Destination $file.FullName -Force
            Write-Host "Cropped $($file.Name) to 16:9 ($width x $height)"
        } else {
            $img.Dispose()
            Write-Host "Skipped $($file.Name) (already not 1:1)"
        }
    } catch {
        Write-Host "Error processing $($file.Name): $_"
    }
}
