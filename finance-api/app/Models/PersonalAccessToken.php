<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

class PersonalAccessToken extends Model
{
    protected $fillable = [
        'user_id',
        'name',
        'token_hash',
        'last_used_at',
        'expires_at',
    ];

    protected $hidden = [
        'token_hash',
    ];

    protected $casts = [
        'last_used_at' => 'datetime',
        'expires_at' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function isExpired(): bool
    {
        return $this->expires_at !== null && $this->expires_at->isPast();
    }

    /**
     * @return array{0: self, 1: string}
     */
    public static function issueFor(User $user, string $name = 'mobile'): array
    {
        $plainToken = Str::random(80);

        $token = self::create([
            'user_id' => $user->id,
            'name' => $name,
            'token_hash' => hash('sha256', $plainToken),
            'expires_at' => now()->addMinutes((int) config('auth.api_token_ttl_minutes', 43200)),
        ]);

        return [$token, $plainToken];
    }
}
