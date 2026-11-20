<?php

namespace App\Services;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * Guarda la evidencia fotográfica de un reporte.
 *
 * Decodifica con GD y re-codifica como JPEG (máx. 1280 px): elimina los metadatos EXIF
 * (que pueden incluir la ubicación GPS exacta) y descarta archivos "disfrazados" de imagen.
 * El disco se define en config('safemap.photo_disk'): 'public' (local) o uno externo (s3...).
 */
class IncidentPhotoStorage
{
    private const MAX_SIDE = 1280;
    private const QUALITY  = 82;

    /** @return string Ruta relativa dentro del disco, p. ej. incidents/uuid.jpg */
    public function store(UploadedFile $file): string
    {
        $source = @imagecreatefromstring($file->get());

        if ($source === false) {
            throw ValidationException::withMessages([
                'photo' => 'No se pudo procesar la imagen. Intenta con otra foto.',
            ]);
        }

        $width  = imagesx($source);
        $height = imagesy($source);
        $scale  = min(1, self::MAX_SIDE / max($width, $height));
        $newW   = max(1, (int) round($width * $scale));
        $newH   = max(1, (int) round($height * $scale));

        $canvas = imagecreatetruecolor($newW, $newH);
        imagefill($canvas, 0, 0, imagecolorallocate($canvas, 255, 255, 255));
        imagecopyresampled($canvas, $source, 0, 0, 0, 0, $newW, $newH, $width, $height);

        ob_start();
        imagejpeg($canvas, null, self::QUALITY);
        $binary = ob_get_clean();

        $path = 'incidents/' . Str::uuid() . '.jpg';
        Storage::disk(config('safemap.photo_disk', 'public'))->put($path, $binary);

        return $path;
    }
}
