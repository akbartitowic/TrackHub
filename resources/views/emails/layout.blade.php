<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="color-scheme" content="light">
    <title>@yield('title', $appName ?? 'HubTask')</title>
</head>
<body style="margin:0; padding:0; background-color:#f3f4f8; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f3f4f8;">
    <tr>
        <td align="center" style="padding: 32px 16px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px; background-color:#ffffff; border-radius:14px; overflow:hidden; border:1px solid #e5e7f0;">
                <tr>
                    <td style="background-color:#ffffff; padding:22px 28px; border-bottom:1px solid #edeef5;">
                        <table role="presentation" cellpadding="0" cellspacing="0">
                            <tr>
                                <td style="font-size:17px; font-weight:700; color:#00529C; letter-spacing:0.2px;">
                                    <span style="color:#0f9c8f;">&#9679;</span>&nbsp; {{ $appName ?? 'HubTask' }}
                                </td>
                            </tr>
                        </table>
                    </td>
                </tr>
                <tr>
                    <td style="padding: 28px; color:#374151; font-size:14px; line-height:1.6;">
                        @yield('content')
                    </td>
                </tr>
                <tr>
                    <td style="background-color:#f8fafc; padding:14px 28px; border-top:1px solid #edeef5;">
                        <p style="margin:0; font-size:11px; color:#8a8fa3;">Email otomatis dari {{ $appName ?? 'HubTask' }} &mdash; jangan balas email ini.</p>
                    </td>
                </tr>
            </table>
        </td>
    </tr>
</table>
</body>
</html>
