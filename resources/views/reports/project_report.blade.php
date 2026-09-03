<!DOCTYPE html>
<html>
<head>
    <title>Project Report - {{ $project->name }}</title>
    <style>
        body { font-family: 'Helvetica', 'Arial', sans-serif; color: #333; line-height: 1.5; padding: 20px; }
        .header { border-bottom: 2px solid #135cec; padding-bottom: 15px; margin-bottom: 30px; }
        .header h1 { color: #135cec; margin: 0; font-size: 24px; }
        .header p { margin: 5px 0 0; color: #666; font-size: 14px; }
        
        .section { margin-bottom: 30px; }
        .section-title { font-size: 18px; font-weight: bold; margin-bottom: 15px; color: #1e293b; border-left: 4px solid #135cec; padding-left: 10px; }
        
        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 12px; }
        th { background-color: #f8fafc; color: #64748b; font-weight: bold; text-align: left; padding: 10px; border: 1px solid #e2e8f0; text-transform: uppercase; }
        td { padding: 10px; border: 1px solid #e2e8f0; vertical-align: top; }
        
        .stats-table { width: 100%; border-collapse: separate; border-spacing: 0; margin-bottom: 12px; table-layout: fixed; }
        .stats-table td { width: 20%; vertical-align: top; padding: 0 5px 10px 5px; }
        .stats-table td:first-child { padding-left: 0; }
        .stats-table td:last-child { padding-right: 0; }
        .stat-box { border: 1px solid #e2e8f0; padding: 14px 10px; border-radius: 8px; background-color: #f8fafc; min-height: 78px; box-sizing: border-box; }
        .stat-label { font-size: 8px; color: #64748b; text-transform: uppercase; font-weight: bold; margin-bottom: 6px; line-height: 1.25; letter-spacing: 0.02em; }
        .stat-value { font-size: 17px; font-weight: bold; color: #135cec; line-height: 1.2; }
        .stat-value-sm { font-size: 14px; line-height: 1.3; }
        .stat-value-done { color: #15803d; }
        .stat-value-progress { color: #1d4ed8; }
        .stat-value-muted { color: #475569; }
        .stat-hint { font-size: 8px; color: #94a3b8; margin-top: 5px; line-height: 1.25; }
        .stats-footnote { font-size: 9px; color: #64748b; margin-top: 2px; padding: 8px 10px; background: #f8fafc; border-radius: 6px; border: 1px solid #e2e8f0; }
        
        .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: bold; text-transform: uppercase; }
        .badge-todo { background-color: #f1f5f9; color: #475569; }
        .badge-progress { background-color: #eff6ff; color: #1d4ed8; }
        .badge-reopen { background-color: #fff1f2; color: #e11d48; }
        .badge-done { background-color: #f0fdf4; color: #15803d; }
        
        .progress-bar-container { background-color: #f1f5f9; height: 12px; border-radius: 6px; overflow: hidden; margin-top: 5px; border: 1px solid #e2e8f0; }
        .progress-bar { height: 100%; display: block; border-radius: 6px; }
        
        /* New Progress Colors */
        .pb-low { background-color: #e11d48; }    /* Rose 600 */
        .pb-mid { background-color: #f59e0b; }    /* Amber 500 */
        .pb-high { background-color: #10b981; }   /* Emerald 500 */

        .cat-row { margin-bottom: 20px; padding: 12px; background-color: #fff; border: 1px solid #e2e8f0; border-radius: 8px; }
        .cat-name { font-weight: bold; font-size: 14px; margin-bottom: 5px; display: inline-block; color: #1e293b; }
        .cat-perc-text { font-size: 12px; font-weight: bold; color: #1e293b; float: right; }
        .cat-subtitle { font-size: 10px; color: #64748b; margin-bottom: 8px; }

        .footer { position: fixed; bottom: 0; left: 0; width: 100%; text-align: center; font-size: 10px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 10px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>{{ $project->name }}</h1>
        <p>Project Report | Range: <strong>{{ ucfirst($range) }}</strong> ({{ $startDate }} - {{ $endDate }})</p>
    </div>

    @if($project->methodology === 'Agile Scrum')
    @php
        $totalQuota = (float) ($stats['total_quota'] ?? 0);
        $totalUsed = (float) ($stats['total_used'] ?? 0);
        $usagePercent = $totalQuota > 0 ? round(($totalUsed / $totalQuota) * 100, 1) : 0;
    @endphp
    <div class="section">
        <div class="section-title">Man-hour Statistics</div>
        <table class="stats-table" cellpadding="0" cellspacing="0">
            <tr>
                <td>
                    <div class="stat-box">
                        <div class="stat-label">Used In Range</div>
                        <div class="stat-value">{{ number_format($stats['used_in_range'], 1) }}h</div>
                        <div class="stat-hint">Estimasi task diperbarui dalam periode</div>
                    </div>
                </td>
                <td>
                    <div class="stat-box">
                        <div class="stat-label">Total Used</div>
                        <div class="stat-value">{{ number_format($stats['total_used'], 1) }}h</div>
                        <div class="stat-hint">{{ $usagePercent }}% dari quota · tanpa To Do</div>
                    </div>
                </td>
                <td>
                    <div class="stat-box">
                        <div class="stat-label">MH Done</div>
                        <div class="stat-value stat-value-done">{{ number_format($stats['done_hours'] ?? 0, 1) }}h</div>
                        <div class="stat-hint">Status Done</div>
                    </div>
                </td>
                <td>
                    <div class="stat-box">
                        <div class="stat-label">MH In Progress</div>
                        <div class="stat-value stat-value-progress">{{ number_format($stats['in_progress_hours'] ?? 0, 1) }}h</div>
                        <div class="stat-hint">In Progress, Review, Reopen</div>
                    </div>
                </td>
                <td>
                    <div class="stat-box">
                        <div class="stat-label">Remaining / Quota</div>
                        <div class="stat-value stat-value-sm stat-value-muted">
                            {{ number_format($stats['remaining'], 1) }}h
                            <span style="color:#94a3b8;font-weight:normal;"> / </span>
                            {{ number_format($totalQuota, 1) }}h
                        </div>
                        <div class="stat-hint">Sisa quota project</div>
                    </div>
                </td>
            </tr>
        </table>
        <div class="stats-footnote">
            Logged actual: {{ number_format($stats['actual_logged_in_range'] ?? 0, 1) }}h (range) · {{ number_format($stats['actual_logged_total'] ?? 0, 1) }}h (total)
        </div>
    </div>
    @endif
    <div class="section">
        <div class="section-title">Category Progress Breakdown</div>
        <div style="margin-bottom: 15px; font-size: 9px; color: #64748b; background: #f8fafc; padding: 10px; border-radius: 6px;">
            <strong>Status Progress:</strong> To Do (0%) | In Progress (25%) | Reopen (50%) | Review (75%) | Done (100%)
        </div>
        
        @foreach($categoryProgress as $cat => $p)
        <div class="cat-row">
            <div>
                <span class="cat-name">{{ $cat }}</span>
                <span class="cat-perc-text">{{ $p['weighted_total'] }}% Progress</span>
            </div>
            <div class="cat-subtitle">
                Total Tasks: {{ $p['total'] }} (
                Done: {{ $p['counts']['Done'] }} | 
                Review: {{ $p['counts']['Review'] }} | 
                In Progress: {{ $p['counts']['In Progress'] + $p['counts']['Reopen'] }} | 
                To Do: {{ $p['counts']['To Do'] }}
                )
            </div>
            <div class="progress-bar-container">
                @php
                    $colorClass = $p['weighted_total'] < 30 ? 'pb-low' : ($p['weighted_total'] < 70 ? 'pb-mid' : 'pb-high');
                @endphp
                <div class="progress-bar {{ $colorClass }}" style="width: {{ $p['weighted_total'] }}%"></div>
            </div>
        </div>
        @endforeach
    </div>

    <div class="section">
        <div class="section-title">Tasks Updated in Range</div>
        <table>
            <thead>
                <tr>
                    <th width="{{ $project->methodology === 'Agile Scrum' ? '32%' : '40%' }}">Task</th>
                    <th width="{{ $project->methodology === 'Agile Scrum' ? '18%' : '22%' }}">Feature</th>
                    <th width="{{ $project->methodology === 'Agile Scrum' ? '16%' : '18%' }}">Status</th>
                    @if($project->methodology === 'Agile Scrum')
                    <th width="14%">Total Penggunaan MH</th>
                    @endif
                    <th width="{{ $project->methodology === 'Agile Scrum' ? '20%' : '20%' }}">Last Update</th>
                </tr>
            </thead>
            <tbody>
                @forelse($tasksInRange as $task)
                <tr>
                    <td><strong>{{ $task->title }}</strong></td>
                    <td>{{ $task->feature_title ?: '-' }}</td>
                    <td>
                        <span class="badge {{ 
                            $task->normalized_status === 'Done' ? 'badge-done' : 
                            ($task->normalized_status === 'In Progress' ? 'badge-progress' : 
                            ($task->normalized_status === 'Reopen' ? 'badge-reopen' : 'badge-todo')) 
                        }}">
                            {{ $task->normalized_status }}
                        </span>
                    </td>
                    @if($project->methodology === 'Agile Scrum')
                    <td>{{ number_format((float) ($task->estimated_hours ?? 0), 1) }}h</td>
                    @endif
                    <td>{{ $task->updated_at->format('d M Y') }}</td>
                </tr>
                @empty
                <tr>
                    <td colspan="{{ $project->methodology === 'Agile Scrum' ? 5 : 4 }}" style="text-align: center; color: #94a3b8;">No tasks updated in this range.</td>
                </tr>
                @endforelse
            </tbody>
        </table>
    </div>

    @if($inProgressTasks->count() > 0)
    <div class="section">
        <div class="section-title">Current Tasks (InProgress/ReOpen)</div>
        <table>
            <thead>
                <tr>
                    <th width="{{ $project->methodology === 'Agile Scrum' ? '30%' : '45%' }}">Task</th>
                    <th width="{{ $project->methodology === 'Agile Scrum' ? '24%' : '30%' }}">Feature</th>
                    <th width="{{ $project->methodology === 'Agile Scrum' ? '18%' : '25%' }}">Status</th>
                    @if($project->methodology === 'Agile Scrum')
                    <th width="28%">Total Penggunaan MH</th>
                    @endif
                </tr>
            </thead>
            <tbody>
                @foreach($inProgressTasks as $task)
                <tr>
                    <td><strong>{{ $task->title }}</strong></td>
                    <td>{{ $task->feature_title ?: '-' }}</td>
                    <td>
                        <span class="badge {{ $task->normalized_status === 'Reopen' ? 'badge-reopen' : 'badge-progress' }}">
                            {{ $task->normalized_status }}
                        </span>
                    </td>
                    @if($project->methodology === 'Agile Scrum')
                    <td>{{ number_format((float) ($task->estimated_hours ?? 0), 1) }}h</td>
                    @endif
                </tr>
                @endforeach
            </tbody>
        </table>
    </div>
    @endif

    <div class="footer">
        Generated by MyActivity Software Management System on {{ date('d M Y H:i') }}
    </div>
</body>
</html>
