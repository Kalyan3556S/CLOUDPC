Add-Type -AssemblyName System.Drawing

function Create-PlaceholderIcon {
    param (
        [int]$size,
        [string]$outputPath
    )
    
    $bitmap = New-Object System.Drawing.Bitmap($size, $size)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    
    # Fill background
    $brush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(76, 175, 80))
    $graphics.FillRectangle($brush, 0, 0, $size, $size)
    
    # Draw C text
    $font = New-Object System.Drawing.Font("Arial", ($size * 0.6), [System.Drawing.FontStyle]::Bold)
    $textBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
    $format = New-Object System.Drawing.StringFormat
    $format.Alignment = [System.Drawing.StringAlignment]::Center
    $format.LineAlignment = [System.Drawing.StringAlignment]::Center
    $graphics.DrawString("C", $font, $textBrush, [System.Drawing.RectangleF]::new(0, 0, $size, $size), $format)
    
    # Save bitmap
    $bitmap.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
    
    # Cleanup
    $graphics.Dispose()
    $bitmap.Dispose()
    $brush.Dispose()
    $textBrush.Dispose()
    $font.Dispose()
}

$sizes = @(16, 48, 128)
foreach ($size in $sizes) {
    Create-PlaceholderIcon -size $size -outputPath "d:\python\chess-arrows-extension\images\icon$size.png"
}
