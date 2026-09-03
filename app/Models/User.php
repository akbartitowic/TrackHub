<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Laravel\Sanctum\HasApiTokens;
use Illuminate\Notifications\Notifiable;

class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, Notifiable;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'name',
        'nickname',
        'avatar_path',
        'email',
        'password',
        'role_id',
        'role',
        'phone_number',
        'status',
        'notify_task_assigned',
        'notify_task_due_reminder',
        'notify_task_mention',
        'notify_mh_threshold',
        'notify_login_alert',
        'timezone',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var list<string>
     */
    protected $hidden = [
        'password',
        'remember_token',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'password_changed_at' => 'datetime',
            'notify_task_assigned' => 'boolean',
            'notify_task_due_reminder' => 'boolean',
            'notify_task_mention' => 'boolean',
            'notify_mh_threshold' => 'boolean',
            'notify_login_alert' => 'boolean',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (User $user) {
            if (!$user->password_changed_at) {
                $user->password_changed_at = now();
            }
        });
    }

    public function role()
    {
        return $this->belongsTo(Role::class);
    }

    public function passwordHistories()
    {
        return $this->hasMany(PasswordHistory::class);
    }

    /** Password rotation policy: must be changed at least every 6 months. */
    public function isPasswordExpired(): bool
    {
        if (!$this->password_changed_at) {
            return true;
        }
        return $this->password_changed_at->lt(now()->subMonths(6));
    }

    /**
     * Per-user email opt-in, one flag per notification type (Notification Center).
     * `$type` matches the `type` value already stored in each notification's
     * `toDatabase()` payload. In-app (database channel) notifications are never
     * gated by this — only whether the `mail` channel gets added in `via()`.
     */
    public function wantsEmailFor(string $type): bool
    {
        return match ($type) {
            'task_assigned' => (bool) $this->notify_task_assigned,
            'task_due_reminder' => (bool) $this->notify_task_due_reminder,
            'task_mention' => (bool) $this->notify_task_mention,
            'mh_topup_threshold' => (bool) $this->notify_mh_threshold,
            'login_alert' => (bool) $this->notify_login_alert,
            default => true,
        };
    }

    public function hasPermission($slug)
    {
        if ($this->is_superuser) {
            return true;
        }
        $roleModel = $this->role()->first();
        if (!$roleModel) {
            return false;
        }
        return $roleModel->permissions()
            ->where('slug', $slug)
            ->whereHas('module', fn ($q) => $q->where('is_active', true))
            ->exists();
    }

    /**
     * Create a new personal access token with signed fallback support.
     *
     * @param  string  $name
     * @param  array  $abilities
     * @param  \DateTimeInterface|null  $expiresAt
     * @return \Laravel\Sanctum\NewAccessToken
     */
    public function createToken(string $name, array $abilities = ['*'], ?\DateTimeInterface $expiresAt = null)
    {
        $tokenEntropy = bin2hex(random_bytes(16));
        $timestamp = time();
        $payload = rtrim(strtr(base64_encode(json_encode([
            'u' => $this->id,
            't' => $timestamp,
        ])), '+/', '-_'), '=');

        $plainPayload = "{$tokenEntropy}.{$payload}";
        $key = (string) config('app.key');

        try {
            $token = $this->tokens()->create([
                'name' => $name,
                'token' => hash('sha256', $plainPayload),
                'abilities' => $abilities,
                'expires_at' => $expiresAt,
            ]);
            $tokenId = $token->getKey();
        } catch (\Throwable) {
            $tokenId = $this->id;
            $token = new PersonalAccessToken([
                'name' => $name,
                'token' => hash('sha256', $plainPayload),
                'abilities' => $abilities,
                'expires_at' => $expiresAt,
            ]);
            $token->id = $tokenId;
        }

        $signature = hash_hmac('sha256', "{$tokenId}|{$plainPayload}", $key);
        $fullPlainTextToken = "{$tokenId}|{$plainPayload}.{$signature}";

        return new \Laravel\Sanctum\NewAccessToken($token, $fullPlainTextToken);
    }
}
