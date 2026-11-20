<?php

namespace App\Http\Requests;

use App\Enums\VoteType;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Validation\Rule;

class VoteIncidentRequest extends FormRequest
{
    public function authorize(): bool
    {
        return auth()->check();
    }

    protected function failedAuthorization(): void
    {
        throw new HttpResponseException(response()->json([
            'message' => 'Inicia sesión para validar reportes.',
        ], 401));
    }

    public function rules(): array
    {
        return [
            'vote' => ['required', Rule::enum(VoteType::class)],
            // Posición actual del usuario (se compara contra el incidente en el servidor)
            'lat'  => ['required', 'numeric', 'between:-90,90'],
            'lng'  => ['required', 'numeric', 'between:-180,180'],
        ];
    }

    public function messages(): array
    {
        return [
            'vote.required' => 'Elige una opción.',
            'vote.enum'     => 'La opción de voto no es válida.',
            'lat.required'  => 'Necesitamos tu ubicación para validar el reporte.',
            'lng.required'  => 'Necesitamos tu ubicación para validar el reporte.',
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
