<?php

namespace App\Http\Requests;

use App\Enums\IncidentType;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Validation\Rule;

class StoreIncidentRequest extends FormRequest
{
    /** Solo usuarios autenticados pueden publicar. */
    public function authorize(): bool
    {
        return auth()->check();
    }

    protected function failedAuthorization(): void
    {
        throw new HttpResponseException(response()->json([
            'message' => 'Necesitas iniciar sesión para publicar reportes.',
        ], 401));
    }

    public function rules(): array
    {
        return [
            'type'        => ['required', Rule::enum(IncidentType::class)],
            'title'       => ['nullable', 'string', 'max:120'],
            'description' => ['required', 'string', 'min:5', 'max:500'],
            'lat'         => ['required', 'numeric', 'between:-90,90'],
            'lng'         => ['required', 'numeric', 'between:-180,180'],

            // Evidencia fotográfica. Cambia 'nullable' por 'required' para hacerla obligatoria.
            'photo'       => [
                'nullable', 'file', 'image',
                'mimes:jpg,jpeg,png,webp',
                'max:6144',                                    // 6 MB (el cliente ya la comprime)
                'dimensions:max_width=8000,max_height=8000',   // evita "bombas" de descompresión
            ],
        ];
    }

    public function messages(): array
    {
        return [
            'type.required'        => 'Selecciona un tipo de incidente.',
            'type.enum'            => 'El tipo de incidente no es válido.',
            'description.required' => 'Agrega una descripción.',
            'description.min'      => 'La descripción es muy corta.',
            'description.max'      => 'La descripción no puede pasar de 500 caracteres.',
            'lat.required'         => 'Falta la ubicación del reporte.',
            'lng.required'         => 'Falta la ubicación del reporte.',
            'photo.image'          => 'El archivo debe ser una imagen.',
            'photo.mimes'          => 'La foto debe ser JPG, PNG o WebP.',
            'photo.max'            => 'La foto pesa demasiado (máximo 6 MB).',
            'photo.dimensions'     => 'La foto tiene dimensiones demasiado grandes.',
            'photo.uploaded'       => 'No se pudo subir la foto. Intenta con una más ligera.',
        ];
    }

    protected function failedValidation(Validator $validator): void
    {
        throw new HttpResponseException(response()->json([
            'message' => $validator->errors()->first(),
            'errors'  => $validator->errors(),
        ], 422));
    }
}
