<?php

namespace App\Http\Controllers;

use App\Models\Setting;
use App\Support\AppBranding;
use App\Support\SettingKeys;
use App\Traits\LogActivity;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Log;

class SettingController extends Controller
{
    use LogActivity;

    public function branding()
    {
        return response()->json([
            'status' => 'success',
            'data' => AppBranding::toArray(),
        ]);
    }

    public function uploadLogo(Request $request)
    {
        $request->validate([
            'logo' => 'required|image|max:4096',
        ]);

        AppBranding::deleteStoredFile(AppBranding::logoPath());
        $path = $request->file('logo')->store('app-branding', 'public');
        AppBranding::setLogoPath($path);

        return response()->json([
            'status' => 'success',
            'message' => 'Logo updated successfully',
            'data' => AppBranding::toArray(),
        ]);
    }

    public function removeLogo()
    {
        AppBranding::deleteStoredFile(AppBranding::logoPath());
        AppBranding::setLogoPath(null);

        return response()->json([
            'status' => 'success',
            'message' => 'Logo reset to default',
            'data' => AppBranding::toArray(),
        ]);
    }

    public function uploadFavicon(Request $request)
    {
        $request->validate([
            'favicon' => 'required|image|max:2048|mimes:png,jpg,jpeg,gif,webp,ico',
        ]);

        AppBranding::deleteStoredFile(AppBranding::faviconPath());
        $path = $request->file('favicon')->store('app-branding', 'public');
        AppBranding::setFaviconPath($path);

        return response()->json([
            'status' => 'success',
            'message' => 'Favicon updated successfully',
            'data' => AppBranding::toArray(),
        ]);
    }

    public function removeFavicon()
    {
        AppBranding::deleteStoredFile(AppBranding::faviconPath());
        AppBranding::setFaviconPath(null);

        return response()->json([
            'status' => 'success',
            'message' => 'Favicon reset to default',
            'data' => AppBranding::toArray(),
        ]);
    }

    public function getSettings(Request $request)
    {
        $keys = $request->query('keys');
        if ($keys) {
            $keyList = explode(',', $keys);
            $settings = Setting::whereIn('key', $keyList)->get();
        } else {
            $settings = Setting::all();
        }

        $data = SettingKeys::filterForRead($settings->pluck('value', 'key')->all());

        return response()->json([
            'status' => 'success',
            'data' => $data,
        ]);
    }

    public function updateSettings(Request $request)
    {
        $incoming = $request->all();
        $unknown = array_diff(array_keys($incoming), SettingKeys::UPDATABLE);

        if ($unknown !== []) {
            return response()->json([
                'status' => 'error',
                'message' => 'One or more settings keys are not allowed.',
                'invalid_keys' => array_values($unknown),
            ], 422);
        }

        foreach ($incoming as $key => $value) {
            Setting::updateOrCreate(
                ['key' => $key],
                ['value' => $value]
            );
        }

        return response()->json([
            'status' => 'success',
            'message' => 'Settings updated successfully',
        ]);
    }

    public function testSmtp(Request $request)
    {
        $settings = $request->validate([
            'mail_host' => 'required|string',
            'mail_port' => 'required',
            'mail_username' => 'required|string',
            'mail_password' => 'required|string',
            'mail_encryption' => 'nullable|string',
            'mail_from_address' => 'required|email',
            'mail_from_name' => 'required|string',
        ]);

        Config::set('mail.default', 'smtp');
        Config::set('mail.mailers.smtp.transport', 'smtp');
        Config::set('mail.mailers.smtp.host', $settings['mail_host']);
        Config::set('mail.mailers.smtp.port', $settings['mail_port']);
        Config::set('mail.mailers.smtp.username', $settings['mail_username']);
        Config::set('mail.mailers.smtp.password', $settings['mail_password']);
        Config::set('mail.mailers.smtp.encryption', $settings['mail_encryption'] ?? 'tls');

        Config::set('mail.from.address', $settings['mail_from_address']);
        Config::set('mail.from.name', $settings['mail_from_name']);

        Mail::purge('smtp');

        try {
            Mail::raw('This is a test email from Noohtify to verify your SMTP settings.', function ($message) use ($settings) {
                $message->to($settings['mail_from_address'])
                    ->subject('Noohtify SMTP Test');
            });

            $this->log('System', 'SMTP Test Email Sent', "Test email sent successfully to '{$settings['mail_from_address']}' via host '{$settings['mail_host']}'");

            return response()->json([
                'status' => 'success',
                'message' => 'Test email sent successfully to ' . $settings['mail_from_address'],
            ]);
        } catch (\Exception $e) {
            Log::error('SMTP Test Error: ' . $e->getMessage());
            $this->log('System', 'SMTP Test Email Failed', "Failed sending test email to '{$settings['mail_from_address']}' via host '{$settings['mail_host']}': {$e->getMessage()}");

            return response()->json([
                'status' => 'error',
                'message' => 'Failed to send test email: ' . $e->getMessage(),
            ], 500);
        }
    }
}
